const util = require('util');
const { spawn } = require('child_process');
const config = require('config');
const express = require('express')
const expressPort = config.get('port');
const IPAPIKey = config.get('IPAPIKey');
const prettyTime = require('pretty-time');

const knex = require('./db/connection');
const iplocation = require('iplocation')
const EventSource = require('eventsource');
const isIp = require('is-ip');

const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http, { path: '/globe/socket.io'});

const ipAPIURL = `https://ipapi.co/*/json?key=${IPAPIKey}`;
const wikimediaStreamURL = 'https://stream.wikimedia.org/v2/stream/recentchange';

function onMessage(callback) {
	return async function(e) {
		let data, location;

		try {
			data = JSON.parse(e.data)
		} catch (err) {
			console.log('Error parsing data', err);
			return;
		}

		const ipAddress = data.user;

		if (!data || !isIp(ipAddress)) {
			return;
		}

		try {
			location = await iplocation(ipAddress, [ipAPIURL]);
		} catch (err) {
			console.log('IP Location Error:', err);
			return;
		}

		if (!location || location.error) {
			console.log('IP Location Error:', {location});
			return;
		}

		// We receive around 10k edits per hour
		const item = {
			data,
			location
		};

		// console.log(item);
		callback(item);
	}
}

function onWikiData(onData) {
	console.log('Connecting to ', wikimediaStreamURL);
	var es = new EventSource(wikimediaStreamURL)
	es.addEventListener('message', onMessage(onData))
}

async function writeWikiEditToDB(wikiEdit) {
	// This returns a promise, but it's unimportant as to when it completes
	await knex('edits').insert([{
		raw_data: JSON.stringify(wikiEdit),
		title: wikiEdit.data.title,
		wiki_name: wikiEdit.data.wiki,
		wiki_id: wikiEdit.data.id,
		edit_time: new Date(wikiEdit.data.meta.dt)
	}]);
}

function init() {
	app.use('/globe', express.static('public'))

	io.on('connection', function (socket) {
		console.log('Connection established');
	});

	const webhookURL = config.get('webhookURL');

	if (webhookURL && webhookURL.startsWith('/') && webhookURL.length > 1) {
		app.post(`/globe${webhookURL}`, (req, res) => {
			console.log('WebHook Request');
			res.send('Running the post-receive hook on the server ✅️');

			console.log('Executing the post receive script ');

			const subprocess = spawn('npm', ['run', 'post-receive'], {
				detached: true,
				stdio: 'ignore'
			});

			subprocess.unref();
		});
	}

	const startTime = process.hrtime();
	let ongoingDataCount = 0;
	let hasLoggedOneWikiEdit = false;

	onWikiData(data => {
		if (!hasLoggedOneWikiEdit) {
			hasLoggedOneWikiEdit = true;
			console.log('Data preview: ', data);
		}
		ongoingDataCount++;
		const elapsedTime = process.hrtime(startTime);

		if ((elapsedTime[0] % 10) === 0) {
			console.log(`${ongoingDataCount} wiki edits received after ${prettyTime(elapsedTime)}`);
		}

		io.emit('message', data);

		writeWikiEditToDB(data);
	});

	const port = config.get('port');

	http.listen(port, function(){
		console.log(`listening on port :${port}`);
	});
}

init();