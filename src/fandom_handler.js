const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const checker = require('./checker.js');
const dbh = PARAMS.mongoless ? {} : require('../database/handler');

const handlerContext = {}; // Store cross-request context here

function handler (app, nunjEnv) {
	// Static Page Routes
	// Home page
	app.get(['/', '/home'], async (req, res) => {
		const notif = PARAMS.dev ? 'Operating in dev' : 'Registrations open!!!';
		return res.renderFile('fandom_home.njk', { notif });
	});
	// Quiz Details Page
	app.get('/info', (req, res) => res.renderFile('events/fandom_info.njk'));

	// Auth and profile related
	// Login GET
	app.get('/login', (req, res) => {
		if (req.loggedIn) return res.redirect('/');
		res.renderFile('login.njk');
	});
	// Login POST
	app.post('/login', async (req, res) => {
		const id = await dbh.validateUserLogin(req.body);
		if (!id) throw new Error('Credentials don\'t match.');
		res.cookie('sessionId', await dbh.generateSessionRecord(id));
		return res.send('Login Successful');
	});
	// Signup GET
	app.get('/signup', (req, res) => {
		if (req.loggedIn) return res.redirect('/');
		res.renderFile('signup.njk', { images: require('./images') });
	});
	// Signup POST
	app.post('/signup', async (req, res) => {
		// req.body = { name, username, password, email, image, signedUpFor, transactionID }
		try {
			// Here's hoping Ankan added proper validation in the njk file
			req.user = await dbh.createNewUser(req.body);
			// Generate a session for login middleware to recognize
			req.cookies.sessionId = dbh.generateSessionRecord(req.user.id);
			// Send a message to indicate successful login
			return res.send('Successfully logged in');
		} catch (err) {
			// Sending an error: Can do next as well, but eh. Using this for now.
			return res.status(400).error(err);
		}
	});
	// Logout GET
	app.get('/logout', (req, res) => {
		if (!req.loggedIn) return res.redirect('/login');
		return res.renderFile('logout.njk');
	});
	// Logout POST
	app.post('/logout', async (req, res, next) => {
		if (!req.user) return next('How are you logging out without even logging in, b-baka.');
		await res.clearCookie('sessionId');
		return res.send('Signed out successfully. Mata ne.');
	});
	// Profile
	app.get('/profile', async (req, res) => {
		if (!req.loggedIn) return res.redirect('/');
		req.user.imageLink = require('./images')[req.user.toObject().image]?.src;
		return res.renderFile('profile.njk', req.user);
	});

	// Event-related pages
	// Lists the quizzes
	app.get('/events', async (req, res) => {
		if (!req.user) return res.redirect('/login');
		const quizzes = (await dbh.getQuizzes()).map(quiz => {
			return {
				id: quiz._id,
				name: quiz._id === 'NRT' ? 'Naruto' : quiz._id,
				active: (new Date).getTime() >= quiz.startTime.getTime() && (new Date).getTime() < quiz.endTime.getTime()
				&& (quiz._id === 'SQ1' || req.user.signedUpFor[quiz._id])
			};
		});
		return res.renderFile('events.njk', { quizzes });
	});
	// Actual quiz
	app.get('/quiz/:arg', async (req, res) => {
		return res.redirect(`/events`);
		// eslint-disable-next-line no-unreachable
		return res.renderFile('events/fandom_quiz.njk');
	});
	// Update Participant Quiz Status
	app.post('/update-status/:arg', async (req, res) => {
		// Will be used when the person starts the quiz or moves to another question
	});
	// Quiz submit POST function
	app.post('/submit', async (req, res) => {});

	// Results page
	app.get('/results/:arg', async (req, res) => {
		const RES = await dbh.getFandomResult(req.params.arg);
		if (!RES) return res.notfound();
		const results = [];
		RES.forEach(r => {
			if (!results.find(res => res.uid === r.userID)) {
				results.push({
					uid: r.userID,
					points: r.points,
					time: r.endTime
				});
			}
		});
		results.sort((a, b) => {
			if (a.points === b.points) return a.endTime > b.endTime;
			return -(a.points > b.points);
		});
		results.map((ele, index) => {
			ele.rank = index + 1;
			delete ele.time;
		});
		return res.renderFile('events/results.njk', { results: results });
	});

	// Admin-related only
	// Records of registered people
	app.get('/registered', async (req, res) => {
		if (!req.admin) return res.redirect('/');
		const records = await dbh.getAllUsers();
		// const images = require('./images');
		// records.forEach(user => user.imageLink = images[user.image]);
		return res.renderFile('/admin/reg_records.njk', { records });
	});
	// Edit a profile in case of inappropriate words
	app.get('/edit-profile/:arg', async (req, res) => {
		// if (!req.admin) return res.redirect('/');
		const user = await dbh.getUser('933939822073621628860');
		return res.renderFile('admin/edit_profile.njk', user);
	});
	// Update profile
	app.post('/update-profile', async (req, res) => {
		if (!req.admin) return res.status(403).error('Access Denied. Not an admin');
	});
	// Quiz Portal
	app.get('/quiz-portal', async (req, res) => {
		if (!req.admin) return res.redirect('/');
		const quizzes = await dbh.getQuizzes();
		quizzes.forEach(quiz => {
			quiz.status = new Date().getTime() < new Date(quiz.startTime).getTime() ? 'To be started' :
				new Date().getTime() < new Date(quiz.endTime).getTime() ? 'Running' : 'Ended';
		});
		return res.renderFile('admin/quiz_portal.njk', { quizzes });
	});
	// Re-evaluate a quiz's answers
	app.post('/re-evaluate/:arg', async (req, res) => {
		if (!req.admin) return res.status(403).error('Access Denied. Not an admin');
	});
	// Rebuild
	app.get('/rebuild', async (req, res) => {
		if (!req.admin) return res.redirect('/');
	});
}

module.exports = handler;
