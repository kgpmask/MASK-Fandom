const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const checker = require('./checker.js');
const dbh = PARAMS.mongoless ? {} : require('../database/handler');
const fandomImages = require('./images');

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
			return res.error(e);
		}
	});
	// Signup GET
	app.get('/signup', (req, res) => {
		if (req.loggedIn) return res.redirect('/');
		res.renderFile('signup.njk', { images: fandomImages });
	});
	// Signup POST
	app.post('/signup', async (req, res) => {
		// req.body = { name, username, rollno, password, email, image, signedUpFor, transactionID }
		try {
			// Here's hoping Ankan added proper validation in the njk file
			// Goose what did we say about only having client-side validation...
			const { name, username, rollno, password, email, image, signedUpFor, transactionID } = req.body;
			if (!name.match(/^[a-zA-Z0-9. ]*$/)) throw new Error('Name doesn\'t meet requirements');
			if (!email) throw new Error('Empty email address');
			if (!email.match(/^[a-zA-Z0-9\.\-\_]*@[a-zA-Z\.\-\_]*.[a-zA-z]{2,4}$/)) throw new Error('Invalid email address');
			// Ankan, for the future, use lookarounds and arbitrary matches - like `(?!.*) - VERY carefully`
			if (!rollno) throw new Error('Roll number not found');
			if (!rollno.match(/^[12][89012][A-Z]{2}[0-9][A-Z0-9]{2}\d\d$/i)) throw new Error('Roll number is invalid');
			if (!image) throw new Error('Valid profile picture not selected.');
			const [sauce, char] = image?.split('-');
			if (!fandomImages[sauce]?.hasOwnProperty(char)) throw new Error('Invalid profile picture selected');
			if (!Object.keys(fandomImages).map(k => signedUpFor[k]).some(v => v)) throw new Error('Sign up for at least one quiz.');
			if (!username) throw new Error('No username given.');
			if (username.match(/[<>]/)) throw new Error(`The characters < and > are not permitted in usernames.`);
			if (!password.match(/^.{6,24}$/)) throw new Error('Password must be between 6 and 24 characters long');
			if (!transactionID.match(/^\d{12}$/)) throw new Error('Transaction ID provided is invalid!');
			// Validated...

			req.user = await dbh.createNewUser(req.body);
			// Generate a session for login middleware to recognize
			res.cookie('sessionId', await dbh.generateSessionRecord(req.user.id));
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
		const [sauce, char] = req.user.image.split('-');
		req.user.imageLink = fandomImages[sauce][char];
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
	app.use((req, res) => {
		// Catch-all 404
		res.notFound();
	});
}

module.exports = handler;
