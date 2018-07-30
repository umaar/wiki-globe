const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const iplocation = require('iplocation')
const EventSource = require('eventsource');
const isIp = require('is-ip');

const adapter = new FileSync('./data.json')
const db = low(adapter);

const ipAPIURL = 'https://ipapi.co/json';

const wikimediaStreamURL = 'https://stream.wikimedia.org/v2/stream/recentchange';

db.defaults({entries: []}).write()

async function onMessage(e) {
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

	// We receive around 10k edits per hour

	const item = {
		data,
		location
	};

	console.log(item);
	db.get('entries').push(item).write();
}

function init() {
	console.log('Connecting to ', wikimediaStreamURL);

	var es = new EventSource(wikimediaStreamURL)
	es.addEventListener('message', onMessage)
}

init();