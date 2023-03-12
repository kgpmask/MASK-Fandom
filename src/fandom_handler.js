const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { body, validationResult } = require('express-validator');

const checker = require('./checker.js');
const dbh = PARAMS.mongoless ? {} : require('../database/handler');
const fandomImages = require('./images');

const handlerContext = {}; // Store cross-request context here

function handler (app, nunjEnv) {
	// Static Page Routes
	// Home page
	app.get(['/', '/home'], async (req, res) => {
		const notif = PARAMS.dev ? 'Operating in dev' : 'Registrations open!!!';
		const timeLeft = Math.floor((new Date('2023-03-12T06:30:00.000Z') - Date.now()) / 1000);
		return res.renderFile('fandom_home.njk', { notif, timevalue: timeLeft });
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
	app.post('/login', [
		body('username')
			.notEmpty().withMessage('Please provide a username.')
			.trim(),

		body('password')
			.notEmpty().withMessage('Please provide a password.')
			.isLength({ min: 6, max: 24 }).withMessage('Password must be between 6 and 24 characters long.')
			.trim()
	], async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				const errorMessages = errors.array().map(error => error.msg);
				return res.status(400).json({ errors: errorMessages });
			}

			const id = await dbh.validateUserLogin(req.body);
			if (!id) throw new Error('Credentials don\'t match.');

			res.cookie('sessionId', await dbh.generateSessionRecord(id));
			return res.send('Login Successful');
		} catch (err) {
			return res.status(400).json({ errors: [err.message] });
		}
	});
	// Signup GET
	app.get('/signup', (req, res) => {
		if (req.loggedIn) return res.redirect('/');
		const timeLeft = Math.floor((new Date('2023-03-12T06:30:00.000Z') - Date.now()) / 1000);
		if (timeLeft < 0) return res.redirect('/');
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
			res.cookie('sessionId', await dbh.generateSessionRecord(req.user._id));
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
		if (!req.loggedIn) return res.redirect('/login');
		const [sauce, char] = req.user.image.split('-');
		req.user.imageLink = fandomImages[sauce][char];
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
				active: new Date().getTime() >= quiz.startTime.getTime()
					&& new Date().getTime() < (PARAMS.dev ? quiz.endTime.getTime() : quiz.startTime.getTime() + 23 * 60 * 1000)
					&& (quiz._id === 'SQ1' || req.user.signedUpFor[quiz._id === 'NRT' ? 'Naruto' : quiz._id])
					&& req.user.qrScanned && req.user.paymentConfirmed
			};
		});
		return res.renderFile('events.njk', { quizzes });
	});
	// Actual quiz
	app.get('/quiz/:arg', async (req, res) => {
		if (!req.loggedIn) return res.redirect('/login');
		const quizzes = (await dbh.getQuizzes()).map(quiz => {
			return {
				id: quiz._id,
				name: quiz._id === 'NRT' ? 'Naruto' : quiz._id,
				active: new Date().getTime() >= quiz.startTime.getTime()
					&& new Date().getTime() < (PARAMS.dev ? quiz.endTime.getTime() : quiz.startTime.getTime() + 23 * 60 * 1000)
					&& (quiz._id === 'SQ1' || req.user.signedUpFor[quiz._id === 'NRT' ? 'Naruto' : quiz._id])
					&& req.user.qrScanned && req.user.paymentConfirmed
			};
		});
		if (!req.user.paymentConfirmed) return res.renderFile('events/quizzes_404.njk', {
			message: 'Your payment is not confirmed yet, please contact the administrators',
			quizzes: quizzes
		});
		if (!req.user.qrScanned) return res.renderFile('events/quizzes_404.njk', {
			message: 'Your attendance has not been marked. Contact the administrators.',
			quizzes: quizzes
		});
		// if (!req.user.signedUpFor[req.params.arg]) {
		// 	// made it compatible for testing... may remove later
		// 	if (!(PARAMS.dev && req.params.arg === 'SQ1')) return res.renderFile('events/quizzes_404.njk', {
		// 		message: 'Invalid Quiz URL',
		// 		quizzes: quizzes
		// 	});
		// }
		const quiz = await dbh.getQuiz(req.params.arg);
		if (new Date().getTime() < quiz.startTime.getTime()) return res.renderFile('events/quizzes_404.njk', {
			message: 'Quiz not started yet',
			quizzes: quizzes
		});
		if (new Date().getTime() > (PARAMS.dev ? quiz.endTime.getTime()
			: quiz.startTime.getTime() + 23 * 60 * 1000)) return res.renderFile('events/quizzes_404.njk', {
			message: 'The quiz timings have ended.',
			quizzes: quizzes
		});
		const questions = [];
		const types = [];
		const userStat = await dbh.getUserStats(req.user._id, req.params.arg);
		// Redirect to /events if timeout, redirect to /submitted if submitted
		if (userStat.status === 'Submitted') {
			return res.renderFile('events/quizzes_404.njk', {
				message: 'You have already submitted this quiz.',
				quizzes: quizzes
			});
		} else if (quiz.startTime.getTime() + 23 * 60 * 1000 < new Date().getTime()) {
			return res.renderFile('events/quizzes_404.njk', {
				message: 'Quiz time has ended for this account.',
				quizzes: quizzes
			});
		}

		currentQ = userStat.records.length;
		quiz.questions.forEach((question, i) => {
			if (i >= currentQ) {
				types.push(question.options.type);
				questions.push({
					number: i + 1,
					question: question.q,
					options: question.options,
					points: question.points
				});
			}
		});

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
		if (!req.user.signedUpFor[req.params.id === 'NRT' ? 'Naruto' : 'NRT']) {
			// made it compatible for testing... may remove later
			if (!(PARAMS.dev && req.params.id === 'SQ1')) return res.error('Not registered');
		}
		const quiz = await dbh.getQuiz(req.params.id);
		const userData = await dbh.getUserStats(req.user._id, req.params.id);
		if (!quiz) throw new Error('Unable to find the quiz!');
		// Resetting endTime for the first time, to avoid time loss due to loading...
		if (!userData.timeStampSet) {
			userData.endTime = new Date(new Date().getTime() + (20 * 60 + 3) * 1000);
			userData.timeStampSet = true;
			await userData.save();
		}
		const timeLeft = Math.floor((Math.min(userData.endTime.getTime(), quiz.startTime.getTime() * 23 * 60 * 1000)
			- new Date().getTime()) / 1000);
		if (timeLeft <= 0) return res.status(403).send('Time limit crossed already');
		return res.send(timeLeft.toString());
	});
	app.post('/quiz/:arg', async (req, res) => {
		const quiz = await dbh.getQuiz(req.params.arg);
		return res.send(quiz);
	});
	// Update Participant Quiz Status
	app.post('/update-status/:id', async (req, res) => {
		if (!req.user.signedUpFor[req.params.id === 'NRT' ? 'Naruto' : 'NRT']) {
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
		if (!req.user.signedUpFor[req.params.id === 'NRT' ? 'Naruto' : 'NRT']) {
			// made it compatible for testing... may remove later
			if (!(PARAMS.dev && req.params.id === 'SQ1')) return res.error('Not registered');
		}
		try {
			const answer = { endTime: new Date(), points: 0 };
			const quiz = await dbh.getQuiz(req.params.id);
			if (answer.endTime.getTime() > quiz.endTime.getTime()) throw new Error('Submitting after end of quiz');
			const userStat = await dbh.getUserStats(req.user._id, req.params.id);
			for (let i = 0; i < userStat.records.length; i++) answer.points += quiz.questions[i].points *
				await checker.checkFandomQuiz(userStat.records[i], quiz.questions[i].solution, quiz.questions[i].options.type);
			await dbh.updateUserStats(req.user._id, req.params.id, answer);
			return res.redirect('/submitted');
		} catch (err) {
			console.log(err);
			return res.error(err);
		}
	});

	app.get('/submitted', (req, res) => {
		return res.renderFile('events/quiz_success.njk');
	});
	// Results page
	app.get('/results/:arg', async (req, res) => {
		if (!req.admin) return res.redirect('/');
		const RES = await dbh.getFandomResult(req.params.arg);
		if (!RES.some(Boolean)) return res.notFound();
		const results = [];
		const users = await dbh.getAllUsers();
		RES.forEach(r => {
			if (!results.find(res => res.uid === r.userId)) {
				const user = users.find(user => user._id === r.userId);
				results.push({
					name: user.name,
					username: user.username,
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
		const records = (await dbh.getAllUsers()).filter(record => !record.permissions?.find(perm => perm === 'Admin'));
		const count = { Naruto: 0, AOT: 0, OPM: 0, MHA: 0 };
		records.forEach(record => Object.keys(count).forEach(sauce => count[sauce] += record.signedUpFor[sauce]));
		const countRecord = Object.keys(count).map(sauce => `<b>${sauce}:</b> ${count[sauce]}`).join(', ');
		const images = require('./images');
		records.forEach(user => user.imageLink = images[user.image.split('-')[0]][user.image.split('-')[1]]);
		return res.renderFile('/admin/reg_records.njk', { records, countRecord });
	});
	// Confirm payment (will be done by Parmar ig)
	app.post('/confirm-payment', async (req, res) => {
		try {
			if (!req.admin) return res.status(403).send('How are you sending this request??');
			await dbh.confirmPayment(req.body.userId);
			return res.send('Confirmation successful');
		} catch (err) {
			return res.error(err);
		}
	});
	// Edit a profile in case of inappropriate words
	app.get('/edit-profile/:id', async (req, res) => {
		if (!req.admin) return res.redirect('/');
		const user = await dbh.getUser(req.params.id);
		return res.renderFile('admin/edit_profile.njk', user);
	});
	// Update profile
	app.post('/update-profile', async (req, res) => {
		try {
			if (!req.admin) return res.status(403).send('Access Denied. Not an admin');
			await dbh.editUserDetails(req.body);
			return res.send('Updated successfully');
		} catch (err) {
			return res.error(err);
		}
	});
	// Mark as present (can't attempt quiz without being marked present)
	app.post('/mark-present', async (req, res) => {
		try {
			if (!req.admin) return res.status(403).send('Access Denied. Not an admin!');
			await dbh.markUserAsPresent(req.body.id);
			return res.send('Marked as present');
		} catch (err) {
			return res.error(err);
		}
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
	// Show answers to quizzes
	app.get('/show-answers/:arg', async (req, res) => {
		if (!req.admin) return res.redirect('/');
		const quiz = await dbh.getQuiz(req.params.arg);
		const quizQuestions = [];
		quiz.questions.forEach((question, i) => quizQuestions.push({ number: i + 1, ...question, _id: req.params.arg }));
		return res.renderFile('admin/quiz_solutions.njk', { quizQuestions, questions: JSON.stringify(quizQuestions) });
	});
	// Re-evaluate a quiz's answers
	app.post('/re-evaluate/:id', async (req, res) => {
		if (!req.admin) return res.status(403).send('Access Denied. Not an admin');
		const stats = await dbh.getStatsOfQuiz(req.params.id);
		const quiz = await dbh.getQuiz(req.params.id);
		for (let i = 0; i < stats.length; i++) {
			const record = stats[i];
			const answer = { endTime: record.endTime, points: 0, reEvaluation: true };
			for (let i = 0; i < record.records.length; i++) answer.points += quiz.questions[i].points *
				await checker.checkFandomQuiz(record.records[i], quiz.questions[i].solution, quiz.questions[i].options.type);
			await dbh.updateUserStats(record.userId, record.quizId, answer);
		}
		return res.send('Evaluation successful.');
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
