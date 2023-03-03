const mongoose = require('mongoose');

const userQuizDataSchema = new mongoose.Schema({
	userId: { type: String, required: true, index: true, unique: true },
	quizId: { type: String, required: true },
	points: { type: Number, required: true, default: 0 },
	timeTaken: { type: Number, required: true },
	records: { type: [{
		questionNo: { type: Number, required: true },
		answer: { type: Number | [String] }
	}], required: true }
});

const questionsSchema = new mongoose.Schema({
	_id: { type: String, required: true },
	startTime: Date, // timeStamp of start time
	endTime: Date, // start time + 21m (20m quiz, 1 min for forced submissions)
	questions: [{
		points: Number,
		q: [{
			type: mongoose.Schema.Types.Mixed, // 'text' || 'image' || 'audio' || 'video' || 'table' || 'gallery'
			value: String | [String]
		}],
		options: [{
			type: mongoose.Schema.Types.Mixed, // 'text' || 'number' || 'mcq'
			// only when MCQ
			value: [{
				type: mongoose.Schema.Types.Mixed, // 'text' || 'image'
				value: String
			}]
		}],
		solution: Number | [String],
		basepoints: Number
	}],
	random: Boolean
});

questionsSchema.set('collection', 'fanodm-questions');
userQuizDataSchema.set('collection', 'fandom-records');

module.exports = {
	UserInfo: mongoose.model('UserQuizData', userQuizDataSchema),
	Questions: mongoose.model('Questions', questionsSchema)
};
