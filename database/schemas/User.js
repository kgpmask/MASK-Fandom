const mongoose = require('mongoose');

const userInfoSchema = new mongoose.Schema({
	_id: { type: String, required: true },
	name: { type: String, required: true },
	username: { type: String, required: true },
	email: { type: String, required: true },
	image: { type: String, required: true },
	salt: { type: String, required: true },
	hash: { type: String, required: true },
	signedUpFor: {
		Naruto: Boolean,
		AOT: Boolean,
		OPM: Boolean,
		MHA: Boolean
	},
	transactionID: { type: Number, required: true },
	qrScanned: Boolean,
	paymentConfirmed: Boolean,
	permissions: { type: [String], default: [] }
});

userInfoSchema.set('collection', 'fandom-users');

module.exports = mongoose.model('User', userInfoSchema);
