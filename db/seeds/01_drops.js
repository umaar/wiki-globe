const sampleWikiEdit = {
	"data": {
		"bot": false,
		"comment": "",
		"id": 1074938833,
		"length": {
			"new": 4921,
			"old": 5378
		},
		"meta": {
			"domain": "en.wikipedia.org",
			"dt": "2018-07-29T21:01:27+00:00",
			"id": "90026261-9372-11e8-a522-b083fecefa7f",
			"request_id": "7a08e4f4-2656-44bf-a88c-4d669d1ed694",
			"schema_uri": "mediawiki/recentchange/2",
			"topic": "eqiad.mediawiki.recentchange",
			"uri": "https://en.wikipedia.org/wiki/Hari",
			"partition": 0,
			"offset": 1034951857
		},
		"minor": false,
		"namespace": 0,
		"parsedcomment": "",
		"revision": {
			"new": 852560795,
			"old": 852560746
		},
		"server_name": "en.wikipedia.org",
		"server_script_path": "/w",
		"server_url": "https://en.wikipedia.org",
		"timestamp": 1532898087,
		"title": "Hari",
		"type": "edit",
		"user": "129.255.225.111",
		"wiki": "enwiki"
	},
	"location": {
		"ip": "129.255.225.111",
		"city": "Iowa City",
		"region": "Iowa",
		"region_code": "IA",
		"country": "US",
		"country_name": "United States",
		"continent_code": "NA",
		"in_eu": false,
		"postal": "52242",
		"latitude": 41.664,
		"longitude": -91.5447,
		"timezone": "America/Chicago",
		"utc_offset": "-0500",
		"country_calling_code": "+1",
		"currency": "USD",
		"languages": "en-US,es-US,haw,fr",
		"asn": "AS3676",
		"org": "University of Iowa"
	}
};

exports.seed = async function(knex) {
	await knex('edits').del();

	await knex('edits').insert([{
		raw_data: JSON.stringify(sampleWikiEdit),
		title: sampleWikiEdit.data.title,
		wiki_name: sampleWikiEdit.data.wiki,
		wiki_id: sampleWikiEdit.data.id + process.hrtime()[1],
		edit_time: new Date(sampleWikiEdit.data.meta.dt)
	}, {
		raw_data: JSON.stringify(sampleWikiEdit),
		title: sampleWikiEdit.data.title,
		wiki_name: sampleWikiEdit.data.wiki,
		wiki_id: sampleWikiEdit.data.id + process.hrtime()[1],
		edit_time: new Date(sampleWikiEdit.data.meta.dt)
	}]);
};
