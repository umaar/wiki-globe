const path = require('path');
const databaseName = 'wiki-globe';

const migrationsDirectory = path.join(process.cwd(), 'db/migrations');
const seedsDirectory = path.join(process.cwd(), 'db/seeds');

const config = {
	development: {
		client: 'sqlite3',
		connection: {
			filename: `./db-development-${databaseName}.sqlite`
		},
		migrations: {
			directory: migrationsDirectory
		},
		seeds: {
			directory: seedsDirectory
		},
		useNullAsDefault: true
	},
	production: {
		client: 'sqlite3',
		connection: {
			filename: `./db-production-${databaseName}.sqlite`
		},
		migrations: {
			directory: migrationsDirectory
		},
		seeds: {
			directory: seedsDirectory
		}
	}
};

module.exports = config;
