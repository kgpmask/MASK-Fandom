const mongoose = require('mongoose');

const userAttemptData = new mongoose.Schema({
	userId: { type: String, required: true, index: true, unique: true },
	quizId: { type: String, required: true, index: true, unique: true },
	points: { type: Number, required: true, default: 0 },
	timeStamp: { type: Date, require: true },
	records: [{
		questionNo: { type: String, required: true },
		answer: String,
		timeTaken: Number
	}]
}, { 'collection': 'fandom-user-attempt' });

module.exports = new mongoose.model("Fandom", userAttemptData);
