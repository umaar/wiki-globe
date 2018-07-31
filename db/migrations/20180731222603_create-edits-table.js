exports.up = (knex, Promise) => {
	return knex.schema.createTable('edits', table => {
		table.increments('id');
		table.text('raw_data').notNullable();
		table.string('title').notNullable();
		table.string('wiki_name').notNullable();
		table.integer('wiki_id').unique().notNullable();
		table.timestamp('edit_time').notNullable();
	});
};

exports.down = (knex, Promise) => {
	return knex.schema.dropTable('edits');
};
