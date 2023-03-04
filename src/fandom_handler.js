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
	app.get('/info', (req, res) => res.renderFile('fandom_info.njk'));

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
		req.cookies.sessionId = dbh.generateSessionRecord(id);
		return res.send('Login Successful');
	});
	// Signup GET
	app.get('/signup', (req, res) => {
		if (req.loggedIn) return res.redirect('/');
		res.send("Bully Jai for this page. It's not done yet.");
	});
	// Signup POST
	app.post('/signup', async (req, res) => {

	});
	// Logout GET
	app.get('/logout', (req, res) => {
		if (!req.loggedIn) return res.redirect('/login');
		return req.logout(() => res.redirect('/'));
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
		const user = await dbh.getUserStats(req.user._id);
		return res.renderFile('profile.njk', {
			name: req.user.name,
			picture: req.user.picture,
			points: user.points,
			quizzes: user.quizData.map(stamp => {
				const months = [
					'-',
					'January',
					'February',
					'March',
					'April',
					'May',
					'June',
					'July',
					'August',
					'September',
					'October',
					'November',
					'December'
				];
				const [year, month, date] = stamp.quizId.split('-');
				return `${Tools.nth(~~date)} ${months[~~month]}`;
			})
		});
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
}

module.exports = handler;
