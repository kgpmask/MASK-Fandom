const mongoose = require('mongoose');

const userQuizDataSchema = new mongoose.Schema({
	userId: { type: String, required: true, index: true, unique: true },
	quizId: { type: String, required: true },
	points: { type: Number, required: true, default: 0 },
	endTime: { type: Date, required: true },
	records: { type: [Number, String], required: true }
});

const questionsSchema = new mongoose.Schema({
	_id: { type: String, required: true, enum: ['NRT', 'OPM', 'AOT', 'MHA'] },
	startTime: { type: String, required: true }, // timeStamp of start time
	endTime: { type: String, required: true }, // start time + 21m (20m quiz, 1 min for forced submissions)
	questions: [
		{
			points: { type: Number, required: true },
			q: [
				{
					type: { type: String, required: true, enum: ['text', 'image', 'audio', 'video', 'table', 'gallery'] },
					value: { type: [String, [String]], required: true }
				}
			],
			options: [
				{
					type: { type: String, required: true, enum: ['text', 'number', 'mcq'] },
					// only when MCQ
					value: [
						{
							type: { type: String, required: true, enum: ['text', 'image'] },
							value: { type: String, required: true }
						}
					]
				}
			],
			solution: { type: [Number, [String]], required: true }
		}
	]
});

questionsSchema.set('collection', 'fandom-questions');
userQuizDataSchema.set('collection', 'fandom-records');

module.exports = {
	UserInfo: mongoose.model('UserQuizData', userQuizDataSchema),
	Questions: mongoose.model('Questions', questionsSchema)
};
