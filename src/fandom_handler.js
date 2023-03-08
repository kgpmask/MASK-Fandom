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
		try {
			const id = await dbh.validateUserLogin(req.body);
			if (!id) throw new Error('Credentials don\'t match.');
			res.cookie('sessionId', await dbh.generateSessionRecord(id));
			return res.send('Login Successful');
		} catch (e) {
			return false;
		}
	});
	// Signup GET
	app.get('/signup', (req, res) => {
		if (req.loggedIn) return res.redirect('/');
		const images = require('./images.json');
		res.renderFile('signup.njk', { images });
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
		if (!req.loggedIn) return next('How are you logging out without even logging in, b-baka.');
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
	app.get('/fandom', (req, res) => {
		return res.renderFile('events/fandom_quiz.njk');
	});
	app.get('/events', async (req, res) => {
		if (!req.loggedIn) return res.redirect('/login');
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
		if (!req.loggedIn) return res.redirect('/login');
		if (!req.user.signedUpFor[req.params.arg]) {
			// made it compatible for testing... may remove later
			if (!(PARAMS.dev && req.params.arg === 'SQ1')) return res.redirect('/events');
		}
		const quiz = (await dbh.getQuizzes()).find(e => e._id === req.params.arg);
		const questions = [];
		const types = [];
		const userStat = await dbh.getUserStats(req.user._id, req.params.arg);
		if (userStat.status === 'Submitted') return res.redirect('/submitted');
		currentQ = userStat.records.length;
		quiz.questions.forEach((question, i) => i >= currentQ ? types.push(question.options.type) && questions.push({
			number: i + 1,
			question: question.q,
			options: question.options
		}) : undefined);

		return res.renderFile('events/fandom_quiz.njk', {
			id: req.params.arg,
			currentQ,
			types,
			questions: JSON.stringify(questions),
			qAmt: questions.length
		});
	});
	// Time left fetcher
	app.post('/time-left/:id', async (req, res) => {
		if (!req.user.signedUpFor[req.params.id]) {
			// made it compatible for testing... may remove later
			if (!(PARAMS.dev && req.params.id === 'SQ1')) return res.error('Not registered');
		}
		const quiz = (await dbh.getQuizzes()).find(quiz => quiz._id === req.params.id);
		if (!quiz) throw new Error('Unable to find the quiz!');
		return res.send(Math.min(20 * 60, (new Date(quiz.endTime).getTime() - new Date().getTime()) / 1000).toString());
	});
	// Update Participant Quiz Status
	app.post('/update-status/:id', async (req, res) => {
		if (!req.user.signedUpFor[req.params.id]) {
			// made it compatible for testing... may remove later
			if (!(PARAMS.dev && req.params.id === 'SQ1')) return res.error('Not registered');
		}
		// Will be used when the person starts the quiz or moves to another question
		const { answer } = req.body;
		await dbh.updateUserStats(req.user._id, req.params.id, answer);
		return res.status(200).send('Success');
	});
	// Quiz submit POST function
	app.post('/submit/:id', async (req, res) => {
		if (!req.user.signedUpFor[req.params.id]) {
			// made it compatible for testing... may remove later
			if (!(PARAMS.dev && req.params.id === 'SQ1')) return res.error('Not registered');
		}
		try {
			await dbh.updateUserStats(req.user._id, req.params.id, 1.063);
			return res.redirect('/submitted');
		} catch (err) {
			return res.error(err);
		}
	});

	app.get('/submitted', (req, res) => {
		return res.send("Submitted...");
	});

	// Results page
	app.get('/results/:arg', async (req, res) => {
		return res.redirect('/');
	});

	// Admin-related only
	// Records of registered people
	app.get('/registered', async (req, res) => {
		if (!req.admin) return res.redirect('/');
		// left blank for goose
	});
	// Edit a profile in case of inappropriate words
	app.get('/edit-profile/:arg', async (req, res) => {
		if (!req.admin) return res.redirect('/');
		// left blank for goose
	});
	// Update profile
	app.post('/update-profile', async (req, res) => {
		if (!req.admin) return res.status(403).error('Access Denied. Not an admin');
	});
	// Quiz Portal
	app.get('/quiz-portal', async (req, res) => {
		if (!req.admin) return res.redirect('/');
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
