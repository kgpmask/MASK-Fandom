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
		const sample = [
			{
				name: 'How to get into MASK',
				link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
				type: 'youtube',
				attr: ['Parth Mane'],
				date: new Date('Oct 25, 2009'),
				page: '_blank',
				hype: true
			},
			{
				name: 'Art - Tanjiro Kamado',
				link: '0025.webp',
				type: 'art',
				attr: ['Sanjeev Raj Ganji'],
				date: new Date(1630261800000),
				hype: true
			},
			{
				name: 'Art - Saitama',
				link: '0019.webp',
				type: 'art',
				attr: ['Garima Mendhe'],
				date: new Date(1628879400000),
				hype: true
			},
			{
				name: 'Art - Kirigakure Shinobi Massacre',
				link: '0012.webp',
				type: 'art',
				attr: ['Arpit Das'],
				date: new Date(1589308200000),
				hype: true
			},
			{
				name: 'Art - Garou',
				link: '0008.webp',
				type: 'art',
				attr: ['Pritam Mallick'],
				date: new Date(1572220800000),
				hype: true
			},
			{
				name: '「AMV」Phantasy Star Online 2 - Symphony',
				link: 'https://www.youtube.com/watch?v=GX7TAigwZPw',
				type: 'youtube',
				attr: ['Hrishabh Kumar Tundwar'],
				date: new Date(1673289000000),
				hype: true
			},
			{
				name: '「AMV」The Garden of Words - A Thousand Years',
				link: 'https://www.youtube.com/watch?v=9W4eyQ7LP7g',
				type: 'youtube',
				attr: ['Hrishabh Kumar Tundwar'],
				date: new Date(1673289000000),
				hype: true
			},
			{
				name: '「AMV」Assassination Classroom - Heathens',
				link: 'https://www.youtube.com/watch?v=unITcghHNVI',
				type: 'youtube',
				attr: ['Chiranjeet Mishra'],
				date: new Date(1673289000000),
				hype: true
			}
		];
		const allPosts = PARAMS.mongoless ? sample : await dbh.getPosts();
		const posts = PARAMS.mongoless ? allPosts.splice(0, 2) : allPosts.splice(0, 7);
		posts.forEach(post => {
			const elapsed = Date.now() - post.date;
			if (!isNaN(elapsed) && elapsed < 7 * 24 * 60 * 60 * 1000) post.recent = true;
		});
		const toBeDisplayed = PARAMS.mongoless ? 3 : 5;
		const art = allPosts.filter(post => post.type === 'art' && post.hype).splice(0, toBeDisplayed);
		const vids = allPosts.filter(post => post.type === 'youtube' && post.hype).splice(0, toBeDisplayed);
		return res.renderFile('home.njk', { posts, vids, art });
	});
	// Quiz Details Page
	app.get('/info', (req, res) => res.renderFile('event_info.njk'));

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
		const records = await dbh.getAllUsers();
		// const images = require('./images');
		// records.forEach(user => user.imageLink = images[user.image]);
		return res.renderFile('/admin/req_records.njk', { records });
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
		// if (!req.admin) return res.redirect('/');
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
