const mongoose = require('mongoose');

const userInfoSchema = new mongoose.Schema({
	_id: { type: String, required: true },
	name: { type: String, required: true },
	username: { type: String, required: true },
	salt: { type: String, required: true },
	hash: { type: String, required: true },
	permissions: { type: [String], default: [] }
});

userInfoSchema.set('collection', 'pw-users');

module.exports = mongoose.model('User', userInfoSchema);
