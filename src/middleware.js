const cookieParser = require('cookie-parser');
const express = require('express');
const session = require('express-session');
const fs = require('fs').promises;
const passport = require('passport');
const path = require('path');

const login = require('./login.js');

module.exports = function setMiddleware (app) {
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));
	app.use(cookieParser());

	// Checks the session token, and sets req.user accordingly
	app.use(login);

	app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

	app.use((req, res, next) => {
		res.locals.mongoless = PARAMS.mongoless;
		res.locals.userless = PARAMS.mongoless || PARAMS.userless;
		res.locals.quizFlag = PARAMS.quiz;
		req.loggedIn = res.locals.loggedIn = Boolean(req.user);
		req.admin = req.user?.permissions.find(e => e === 'Admin');
		next();
	});

	app.use((req, res, next) => {
		res.renderFile = (files, ctx = {}) => {
			ctx.isAdmin = req.admin;
			if (!Array.isArray(files)) files = [files];
			return res.render(path.join(__dirname, '../templates', ...files), ctx);
		};
		res.error = err => {
			res.status(400).send(err?.message || err);
		};
		res.notFound = (custom404, ctx) => {
			res.status(404).renderFile(custom404 || '404.njk', ctx);
		};
		res.tryFile = (path, asset, ctx) => {
			fs.access(path).then(err => {
				if (err) res.notFound(false, ctx);
				else res[asset ? 'sendFile' : 'render'](path, ctx);
			}).catch(() => {
				res.notFound(false, ctx);
			});
		};

		next();
	});
};
