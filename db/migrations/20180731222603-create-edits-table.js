exports.up = knex => {
	return knex.schema.createTable('edits', table => {
		table.increments('id');
		table.text('rawData').notNullable();
		table.string('title').notNullable();
		table.string('wikiName').notNullable();
		table.integer('wikiID');
		table.timestamp('editTime').index().notNullable();
	});
};

exports.down = knex => {
	return knex.schema.dropTable('edits');
};
