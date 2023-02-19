// Trying something similar to the 'sessions' collection which Guugul worked on
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
	_id: { type: String, required: true },
	userId: { type: String, required: true }
});

sessionSchema.set('collection', 'pw-sessions');

module.exports = mongoose.model('Session', sessionSchema);
