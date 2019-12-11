const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const iplocation = require('iplocation');
const EventSource = require('eventsource');
const isIp = require('is-ip');

const adapter = new FileSync('./data.json');
const database = low(adapter);

const ipAPIURL = 'https://ipapi.co/json';

const wikimediaStreamURL = 'https://stream.wikimedia.org/v2/stream/recentchange';

database.defaults({entries: []}).write();

async function onMessage(event) {
	let data;
	let location;

	try {
		data = JSON.parse(event.data);
	} catch (error) {
		console.log('Error parsing data', error);
		return;
	}

	const ipAddress = data.user;

	if (!data || !isIp(ipAddress)) {
		return;
	}

	try {
		location = await iplocation(ipAddress, [ipAPIURL]);
	} catch (error) {
		console.log('IP Location Error:', error);
		return;
	}

	// We receive around 10k edits per hour

	const item = {
		data,
		location
	};

	console.log(item);
	database.get('entries').push(item).write();
}

function init() {
	console.log('Connecting to', wikimediaStreamURL);

	const es = new EventSource(wikimediaStreamURL);
	es.addEventListener('message', onMessage);
}

init();
