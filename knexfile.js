const databaseName = 'wiki';

module.exports = {
	development: {
		client: 'sqlite3',
		connection: {
			filename: `./db-development-${databaseName}.sqlite`
		},
		migrations: {
			directory: __dirname + '/db/migrations'
		},
		seeds: {
			directory: __dirname + '/db/seeds'
		},
		useNullAsDefault: true
	},
	production: {
		client: 'sqlite3',
		connection: {
			filename: `./db-production-${databaseName}.sqlite`
		},
		migrations: {
			directory: __dirname + '/db/migrations'
		},
		seeds: {
			directory: __dirname + '/db/seeds'
		},
		useNullAsDefault: true
	}
};
