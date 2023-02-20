const dbh = require('../database/handler');

module.exports = async (req, res, next) => {
	// Basically, I'll use this to generate and manage sessions, while also adding req.user
	const { sessionId } = req.cookies;
	if (!sessionId) return next();
	req.user = await dbh.returnUserFromSession(sessionId);
	next();
};
