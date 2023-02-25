const bcrypt = require('bcrypt');

const User = require('./schemas/User');
const Quiz = require('./schemas/Quiz');
const { LiveQuiz, LiveResult } = require('./schemas/LiveQuiz');
const Member = require('./schemas/Member');
const Newsletter = require('./schemas/Newsletter');
const Post = require('./schemas/Post');
const Session = require('./schemas/Session');

// Handle newly registered user or normal login
async function createNewUser (profile) {
	// Yeah... profile is pretty much explained over here.
	const { name, username, password } = profile;
	let user = await getUserByUsername(username);
	if (user) throw new Error('User with username already exists :(');
	user = new User({ _id: [...Array(21)].map(() => Math.floor(10 * Math.random() + '')).join(''), name, username });
	// Generate a salt and hash. Then save them both.
	user.salt = await bcrypt.genSalt(7);
	user.hash = await bcrypt.hash(password, user.salt);
	return user.save();
}

// Get User (by using ID)
function getUser (id) {
	return User.findById(id);
}

// Get User (by using username)
function getUserByUsername (username) {
	return User.findOne({ username });
}

// Validates if the login is valid or not
async function validateUserLogin (creds) {
	const { username, password } = creds;
	const user = await getUserByUsername(username);
	if (!user) throw new Error('User does not exist!');
	return user.hash === await bcrypt.hash(password, user.salt) ? user._id : false;
}

// Wondering why this one exists TBH...
function getAllUsers (id) {
	return User.find().lean();
}

// Add new record to database
async function updateUserQuizRecord (stats) { // {userId, quizId, time, score}
	// This... should be fine as it is
	const user = await Quiz.UserInfo.findOne({ userId: stats.userId });
	const userName = (await getUser(stats.userId)).name;
	const record = user || new Quiz.UserInfo({ userId: stats.userId, userName, points: 0, quizData: [] });
	if (!record.quizData) record.quizData = [];
	const key = stats.quizId;
	if (!key) return record.save();
	if (record.quizData.find(elm => elm.quizId === key)) return record;
	else {
		record.quizData.push({
			quizId: key,
			points: stats.score,
			time: stats.time
		});
		record.points += stats.score;
	}
	return record.save();
}

// User statistics
async function getUserStats (userId) {
	// This should be fine as it is too
	const user = await Quiz.UserInfo.findOne({ userId });
	if (user) return user;
	else return updateUserQuizRecord({ userId });
}

function getQuizzes () {
	return Quiz.Questions.find().lean();
}

async function getLiveQuiz (query) {
	// TODO: Use IDs as a parameter properly
	const date = query || new Date().toISOString().slice(0, 10);
	// The first live quiz
	const quiz = await LiveQuiz.findOne({ title: date });
	if (quiz) return quiz.toObject();
}

async function getLiveResult (userId, quizId, currentQ) {
	const res = await LiveResult.findOne({ userId, quizId, question: currentQ });
	if (res) return res.toObject();
}

async function getAllLiveResults (quizId) {
	const res = await LiveResult.find({ quizId }).lean();
	return res;
}

async function addLiveResult (userId, quizId, currentQ, points, answer, timeLeft, result) {
	const user = await getUser(userId);
	const results = new LiveResult({
		userId,
		username: user.name,
		quizId,
		question: currentQ,
		points,
		answer,
		timeLeft,
		result
	});
	await results.save();
	return results.toObject();
}

// Fetch newsletter solutions
async function getNewsletter (date) {
	const newsletter = await Newsletter.findById(date);
	if (!Object.keys(newsletter).every(e => e)) throw new Error('No newsletters on this date');
	return newsletter;
}

// Fetching posts based on type (art/video/newsletter)
function getPosts (postType) {
	// TODO: Make this accept a number of posts as a cap filter
	return Post.find(postType ? { type: postType } : {}).sort({ date: -1 });
}

// Sessions for local auth
function generateSessionRecord (userId) {
	// 3524: The Goose is Dead
	const sessionId = [3, 5, 2, 4].map(i => (Math.random() + 1).toString(36).substring(2, 2 + i)).join('-');
	const session = new Session({
		_id: sessionId,
		userId
	});
	session.save();
	return sessionId;
}

async function returnUserFromSession (sessionId) {
	const { userId } = await Session.findById(sessionId);
	if (!userId) throw new Error('Invalid Session ID!');
	return await getUser(userId);
}

async function removeSession (sessionId) {
	await Session.findByIdAndDelete(sessionId);
}

async function getMembersbyYear (year) {
	const data = await Member.find({ 'records.year': year }).sort('name').lean();
	const yearData = [];
	const teamsData = require("../src/teams.json");
	data.forEach(member => {
		const rec = member.records.find(rec => rec.year === year);
		let pos;
		yearData.push({
			name: member.name,
			roll: member.roll,
			image: "../assets/members/" + member.image,
			teams: rec.teams.map(teamID => {
				const team = {
					name: teamsData[year][teamID[0]].name,
					icon: teamsData[year][teamID[0]].icon
				};
				team.icon += teamID[1] === 'H' ? !(pos = "H") || "-head" : teamID[1] === 'S' ? !(pos = "S") || "-sub" : '';
				return team;
			}),
			position: pos ? rec.position === 'Governor' ? rec.position : pos === 'H' ? 'Team Heads' : 'Team Sub-Heads' : rec.position
		});
	});
	return yearData;
}

module.exports = {
	createNewUser,
	validateUserLogin,
	getUser,
	getAllUsers,
	updateUserQuizRecord,
	getQuizzes,
	getUserStats,
	getLiveQuiz,
	getLiveResult,
	getAllLiveResults,
	addLiveResult,
	getNewsletter,
	getPosts,
	generateSessionRecord,
	returnUserFromSession,
	removeSession,
	getMembersbyYear
};
