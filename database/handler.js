const bcrypt = require('bcryptjs');

const User = require('./schemas/User');
const Quiz = require('./schemas/Quiz');
const { LiveQuiz, LiveResult } = require('./schemas/LiveQuiz');
const Member = require('./schemas/Member');
const Newsletter = require('./schemas/Newsletter');
const Post = require('./schemas/Post');
const Session = require('./schemas/Session');

// Handle newly registered user or normal login
async function createNewUser (profile) {
	// profile = { name, username, password, email, rollno, image, signedUpFor, transactionID }
	let user = await getUserByUsername(profile.username);
	if (user) throw new Error('User with username already exists :(');
	user = new User({ _id: [...Array(21)].map(() => Math.floor(10 * Math.random() + '')).join('') });
	Object.keys(profile).filter(key => key !== 'password').forEach(key => user[key] = profile[key]);
	// Generate a salt and hash. Then save them both.
	user.salt = await bcrypt.genSalt(7);
	user.hash = await bcrypt.hash(profile.password, user.salt);
	user.rollno = user.rollno?.toUpperCase();
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
	if (!user) throw new Error('User does not exist');
	return user.hash === await bcrypt.hash(password, user.salt) ? user._id : false;
}

// Purpose served in admin pages
function getAllUsers () {
	return User.find().lean();
}

// Edit user details
async function editUserDetails (details) {
	// details = { _id, name, username, password };
	const user = await getUser(details._id);
	if (!user) throw new Error('Invalid User ID');
	if (user.username !== details.username && details.username) {
		const userByUsername = await getUserByUsername(details.username);
		if (userByUsername) throw new Error('Username already exists.');
	}
	user.username = details.username || user.username;
	user.name = details.name ?? user.name;
	if (details.password) user.hash = bcrypt.hash(details.password, user.salt);
	return user.save();
}

// Confirm Payment
async function confirmPayment (userId) {
	const user = await getUser(userId);
	if (!user) throw new Error('Invalid User ID!');
	user.paymentConfirmed = true;
	return user.save();
}

// Mark as present
async function markUserAsPresent (userId) {
	const user = await getUser(userId);
	if (!user) throw new Error('Invalid User ID!');
	user.qrScanned = true;
	return user.save();
}

// Add new record to database
async function generateUserQuizRecord (creds) {
	// stats = { userId, quizId }
	if (await Quiz.UserInfo.findOne(creds)) throw new Error('Record already exists.');
	const userStat = new Quiz.UserInfo(creds);
	userStat.endTime = new Date(new Date().getTime() + 20 * 60 * 1000);
	userStat.timeStampSet = false;
	userStat.points = 0;
	userStat.records = [];
	return userStat.save();
}

// User statistics
async function getUserStats (userId, quizId) {
	// This should be fine as it is too
	const user = await Quiz.UserInfo.findOne({ userId, quizId });
	if (user) return user;
	else return generateUserQuizRecord({ userId, quizId });
}

function getStatsOfQuiz (quizId) {
	return Quiz.UserInfo.find({ quizId }).lean();
}

async function updateUserStats (userId, quizId, answer) {
	const user = await getUserStats(userId, quizId);
	if (user.status === 'Submitted' && !answer.reEvaluation) throw new Error('Updating a submitted record!!');
	if (typeof answer === 'object') {
		user.status = 'Submitted';
		user.endTime = answer.endTime;
		user.points = answer.points;
	} else user.records.push(answer);
	return user.save();
}

function getQuizzes () {
	return Quiz.Questions.find().lean();
}

function getQuiz (quizId) {
	return Quiz.Questions.findById(quizId).lean();
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
async function generateSessionRecord (userId) {
	// 3524: The Goose is Dead
	const sessionId = [3, 5, 2, 4].map(i => (Math.random() + 1).toString(36).substring(2, 2 + i)).join('-');
	const session = new Session({
		_id: sessionId,
		userId
	});
	await session.save();
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
	const teamsData = require('../src/teams.json');
	data.forEach(member => {
		const rec = member.records.find(rec => rec.year === year);
		let pos;
		yearData.push({
			name: member.name,
			roll: member.roll,
			image: '../assets/members/' + member.image,
			teams: rec.teams.map(teamID => {
				const team = {
					name: teamsData[year][teamID[0]].name,
					icon: teamsData[year][teamID[0]].icon
				};
				team.icon += teamID[1] === 'H' ? !(pos = 'H') || '-head' : teamID[1] === 'S' ? !(pos = 'S') || '-sub' : '';
				return team;
			}),
			position: pos ? rec.position === 'Governor' ? rec.position : pos === 'H' ? 'Team Heads' : 'Team Sub-Heads' : rec.position
		});
	});
	return yearData;
}

// Get Fandom results (using the quiz id)
async function getFandomResult (quizId) {
	return await Quiz.UserInfo.find({ quizId });
}

module.exports = {
	createNewUser,
	validateUserLogin,
	getUser,
	getAllUsers,
	editUserDetails,
	confirmPayment,
	markUserAsPresent,
	getQuizzes,
	getQuiz,
	getUserStats,
	getStatsOfQuiz,
	updateUserStats,
	getLiveQuiz,
	getLiveResult,
	getAllLiveResults,
	addLiveResult,
	getNewsletter,
	getPosts,
	generateSessionRecord,
	returnUserFromSession,
	removeSession,
	getMembersbyYear,
	getFandomResult
};
