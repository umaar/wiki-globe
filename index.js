const {spawn} = require('child_process');
const config = require('config');
const express = require('express');

const expressPort = config.get('port');
const IPAPIKey = config.get('IPAPIKey');
const prettyTime = require('pretty-time');
const LRU = require('lru-cache');
const iplocation = require('iplocation').default;
const EventSource = require('eventsource');
const isIp = require('is-ip');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {path: '/globe/socket.io'});

const knex = require('./db/connection');


const ipAPIURL = `https://api.ipstack.com/*?access_key=${IPAPIKey}`;
const wikimediaStreamURL = 'https://stream.wikimedia.org/v2/stream/recentchange';

const locationCache = new LRU(1000);

let latestWikiEditTime;

async function updateLatestWikiEditTime() {
	console.log('Updating latest Wiki edit time...');
	const last = await knex.from('edits').orderBy('id', 'desc').first();
	latestWikiEditTime = last.edit_time;
}

setInterval(updateLatestWikiEditTime, 60000);

const timeKeys = {
	'past-1-hour'(date) {
		date.setHours(date.getHours() - 1);
		return date;
	},
	'past-12-hours'(date) {
		date.setHours(date.getHours() - 12);
		return date;
	},
	'past-24-hours'(date) {
		date.setDate(date.getDate() - 1);
		return date;
	},
	'past-week'(date) {
		date.setDate(date.getDate() - 7);
		return date;
	}
};

async function getLocation(ipAddress) {
	const existingLocationForIP = locationCache.get(ipAddress);

	if (existingLocationForIP) {
		return existingLocationForIP;
	}
	const location = await iplocation(ipAddress, [ipAPIURL]);
	locationCache.set(ipAddress, location);
	return location;
}

function onMessage(callback) {
	return async function (e) {
		let data; let location;

		try {
			data = JSON.parse(e.data);
		} catch (error) {
			console.log('Error parsing data', error);
			return;
		}

		if (data.type !== 'edit') {
			return;
		}

		const ipAddress = data.user;

		if (!data || !isIp(ipAddress)) {
			return;
		}

		try {
			location = await getLocation(ipAddress, data);
		} catch (error) {
			console.log('IP Location Error:', error);
			return;
		}

		if (!location || location.error) {
			console.log('IP Location Error:', {location});
			return;
		}

		const item = {
			data,
			location
		};

		callback(item);
	};
}

function onWikiData(onData) {
	console.log('Connecting to ', wikimediaStreamURL);
	const es = new EventSource(wikimediaStreamURL);
	es.addEventListener('message', onMessage(onData));
}

function writeWikiEditToDB(wikiEdit) {
	knex.transaction(async trx => {
		try {
			await knex('edits').transacting(trx).insert([{
				raw_data: JSON.stringify(wikiEdit),
				title: wikiEdit.data.title,
				wiki_name: wikiEdit.data.wiki,
				wiki_id: wikiEdit.data.id,
				edit_time: new Date(wikiEdit.data.meta.dt)
			}]);
		} catch (err) {
			console.log('Error writing wiki edit to database', {
				err, wikiEdit
			});
		}
	}).catch(error => {
		console.log('Error writing wiki edit to database', {
			error
		});
	});
}

function registerWebhook(app) {
	const webhookURL = config.get('webhookURL');

	if (webhookURL && webhookURL.startsWith('/') && webhookURL.length > 1) {
		app.post(`/globe${webhookURL}`, (req, res) => {
			console.log('WebHook Request');
			res.send('Running the post-receive hook on the server ✅️');

			console.log('Executing the post receive script');

			const subprocess = spawn('npm', ['run', 'post-receive'], {
				detached: true,
				stdio: 'ignore',
				uid: 1001,
				gid: 1001
			});

			subprocess.unref();
		});
	}
}

async function init() {
	await updateLatestWikiEditTime();
	function daMiddleWarez(req, res, next) {
		const {path, query} = req;

		if (path === '/') {
			if (!query.query) {
				const selectedTime = query.time;
				const allowedTimeRangeKeys = Object.keys(timeKeys);

				if (!selectedTime || !allowedTimeRangeKeys.includes(selectedTime)) {
					console.log(`⚠️ ${selectedTime} is not a valid time range key. Redirecting... `);
					return res.redirect('?time=past-1-hour');
				}
			}
		}

		next();
	}

	app.use('/globe', daMiddleWarez, express.static('public'));

	io.on('connection', socket => {
		console.log('Connection established');

		socket.on('message', async ({selectedTime, offset = 0}) => {
			const allowedTimeRangeKeys = Object.keys(timeKeys);

			if (!allowedTimeRangeKeys.includes(selectedTime)) {
				console.log(`Invalid time key: ${selectedTime}`);
				return;
			}

			console.log(`Request for time range: ${selectedTime}. Offset ${offset}`);

			const timeKey = selectedTime;

			const startTime = timeKeys[timeKey](new Date(latestWikiEditTime));
			const timeRange = [Number(startTime), Number(new Date(latestWikiEditTime))];

			const res = await knex
				.from('edits')
				.offset(parseInt(offset, 10))
				.whereBetween('edit_time', timeRange)
				.limit(200);

			console.log(`Found ${res.length} results for ${timeKey}`);
			console.log('\n');

			socket.emit('results', res.map(item => JSON.parse(item.raw_data)));
		});

		socket.on('search-query', async ({searchQuery = '', offset = 0}) => {
			searchQuery = typeof (searchQuery) === 'string' ? searchQuery.toString().trim().toLowerCase() : '';

			if (!searchQuery || !searchQuery.length) {
				console.log('⚠️ Invalid search query ');
				return;
			}

			if (searchQuery === 'china') {
				console.log('⚠️ Query of \'china\' received, discarding until pooling issue is solved ');
				return;
			}

			console.log('Wiki title searches are disabled for now, returning');

			/*
			Console.log(`Request for wiki titles: ${searchQuery}. Offset ${offset}`);

			const res = await knex
				.from('edits')
				.offset(parseInt(offset, 10))
				.where('title', 'like', `%${searchQuery}%`)
				.limit(200);

			console.log(`Found ${res.length} results for ${searchQuery}`);
			console.log('\n');

			socket.emit('results', res.map(item => JSON.parse(item.raw_data)));
			*/
		});
	});

	registerWebhook(app);

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

		if ((elapsedTime[0] % 200) === 0) {
			console.log(`${ongoingDataCount} wiki edits received after ${prettyTime(elapsedTime)}`);
		}

		io.emit('message', data);
		writeWikiEditToDB(data);
	});

	const port = expressPort;

	http.listen(port, () => {
		console.log(`listening on port: ${port}`);
	});
}

init();
