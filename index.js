import {spawn} from 'child_process';
import httpModule from 'http';

import config from 'config';
import express from 'express';
import prettyTime from 'pretty-time';
import LRU from 'lru-cache';
import iplocationModule from 'iplocation';
import EventSource from 'eventsource';
import isIp from 'is-ip';
import socketIO from 'socket.io';

import knex from './db/connection.js';

const iplocation = iplocationModule.default;

const expressPort = config.get('port');

const app = express();
const http = httpModule.Server(app); // eslint-disable-line new-cap
const io = socketIO(http, {path: '/globe/socket.io'});

const IPAPIKey = config.get('IPAPIKey');
const ipAPIURL = `https://api.ipstack.com/*?access_key=${IPAPIKey}`;
const wikimediaStreamURL = 'https://stream.wikimedia.org/v2/stream/recentchange';

const locationCache = new LRU(5000);

const maxDBItems = config.get('maxDBItems');

const stats = {
	latestWikiEditTime: undefined,
	itemCountInDBAtStartup: 0,
	ongoingDataCount: 0
};

async function updateLatestWikiEditTime() {
	const last = await knex.from('edits').orderBy('id', 'desc').first();
	if (last) {
		stats.latestWikiEditTime = last.editTime;
	} else {
		stats.latestWikiEditTime = new Date();
	}
}

async function purgeOldItems() {
	const totalItemCount = stats.itemCountInDBAtStartup + stats.ongoingDataCount;

	if (totalItemCount < maxDBItems) {
		return;
	}

	const numberOfItemsToDelete = totalItemCount - maxDBItems;

	const items = await knex.from('edits').limit(numberOfItemsToDelete);

	const itemIDs = items.map(item => item.id);
	const deletedItemCount = await knex.from('edits').whereIn('id', itemIDs).del();
	console.log(`Deleted ${deletedItemCount} items`);

	stats.itemCountInDBAtStartup -= deletedItemCount;
}

setInterval(updateLatestWikiEditTime, 240000);
setInterval(purgeOldItems, 240000);

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
	return async function (event) {
		let data;
		let location;

		try {
			data = JSON.parse(event.data);
		} catch (error) {
			console.log('Error parsing Wiki data', error);
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
	console.log('Connecting to', wikimediaStreamURL);
	const es = new EventSource(wikimediaStreamURL);
	es.addEventListener('message', onMessage(onData));
}

function writeWikiEditToDB(wikiEdit) {
	knex.transaction(async transaction => {
		try {
			await knex('edits').transacting(transaction).insert([{
				rawData: JSON.stringify(wikiEdit),
				title: wikiEdit.data.title,
				wikiName: wikiEdit.data.wiki,
				wikiID: wikiEdit.data.id,
				editTime: new Date(wikiEdit.data.meta.dt)
			}]);
		} catch (error) {
			console.log('Error writing Wiki edit to database', {
				err: error,
				wikiEdit
			});
		}
	}).catch(error => {
		console.log('Error writing Wiki edit to database', {
			error,
			wikiEdit
		});
	});
}

function registerWebhook(app) {
	const webhookURL = config.get('webhookURL');

	if (webhookURL && webhookURL.startsWith('/') && webhookURL.length > 1) {
		app.post(`/globe${webhookURL}`, (request, response) => {
			console.log('WebHook Request');
			response.send('Running the post-receive hook on the server ✅️');

			console.log('Executing the post receive script');

			const subprocess = spawn('npm', ['run', 'post-receive'], {
				detached: true,
				stdio: 'ignore',
				uid: 1001,
				gid: 1001
			});

			subprocess.unref();
		});
	} else {
		throw new Error('Webhook was not registered correctly. Check the webhookURL');
	}
}

async function updateStats() {
	await updateLatestWikiEditTime();
	const countResult = await knex.from('edits').count();
	stats.itemCountInDBAtStartup = countResult[0]['count(*)'];
}

function timeRangeMiddlewareHandler(request, response, next) {
	const {path, query} = request;

	if (path === '/') {
		if (!query.query) {
			const selectedTime = query.time;
			const allowedTimeRangeKeys = Object.keys(timeKeys);

			if (!selectedTime || !allowedTimeRangeKeys.includes(selectedTime)) {
				console.log(`⚠️ ${selectedTime} is not a valid time range key. Redirecting... `);
				return response.redirect('?time=past-1-hour');
			}
		}
	}

	next();
}

async function init() {
	await updateStats();
	await purgeOldItems();

	app.use('/globe', timeRangeMiddlewareHandler, express.static('public'));

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

			const latestEditTime = stats.latestWikiEditTime;
			const startTime = timeKeys[timeKey](new Date(latestEditTime));
			const timeRange = [Number(startTime), Number(new Date(latestEditTime))];

			const result = await knex
				.from('edits')
				.offset(parseInt(offset, 10))
				.whereBetween('editTime', timeRange)
				.limit(200);

			console.log(`Found ${result.length} results for ${timeKey}`);
			console.log('\n');

			socket.emit('results', result.map(item => JSON.parse(item.rawData)));
		});
	});

	registerWebhook(app);

	const startTime = process.hrtime();
	let hasLoggedOneWikiEdit = false;

	onWikiData(data => {
		if (!hasLoggedOneWikiEdit) {
			hasLoggedOneWikiEdit = true;
			console.log('Data preview:', data);
		}

		stats.ongoingDataCount++;
		const elapsedTime = process.hrtime(startTime);

		if ((elapsedTime[0] % 200) === 0) {
			console.log(`${stats.ongoingDataCount} wiki edits received after ${prettyTime(elapsedTime)}`);
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
