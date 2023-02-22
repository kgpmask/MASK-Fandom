const assert = require('assert');
const axios = require('axios');
const DB = require('../database/database.js');
const handler = require('../database/handler.js');

let db;

before(async function () {
	this.timeout(5_000);
	db = await DB.init();
});

describe('Database connection', () => {
	it('should be connected', () => assert(db.connection.readyState));
});

describe('User', () => {
	it('should find a test user', async () => {
		const query = await handler.getUser('933939822073621628860');
		// Custom user made for testing purposes
		return assert(query?.name === 'Shinda Gacho');
	}).timeout(10_000);
});

after(() => DB.disconnect());
