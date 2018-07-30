const config = require('config');
const express = require('express')
const expressPort = config.get('port');
const IPAPIKey = config.get('IPAPIKey');

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

function init() {
	app.use('/globe', express.static('public'))

	io.on('connection', function (socket) {
		console.log('Connection established');
	});

	onWikiData(data => {
		io.emit('message', data);
	});

	const port = config.get('port');

	http.listen(port, function(){
		console.log(`listening on *:${port}`);
	});
}

init();