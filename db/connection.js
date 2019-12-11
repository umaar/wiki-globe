import config from 'config';
import knex from 'knex';
import knexConfig from '../knexfile.cjs';

export default knex(knexConfig[config.get('environment')]);
