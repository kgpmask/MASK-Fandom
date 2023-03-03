exports.compare = function compare (puzzleType, date, obj) {
	return new Promise((resolve, reject) => {
		const solutions = require('./solutions.json');
		if (!solutions.hasOwnProperty(date)) return reject(new Error('No date in the puzzle.'));
		const puzzles = solutions[date];
		if (!puzzles.hasOwnProperty(puzzleType)) return reject(new Error('Puzzle without a type... sus'));
		if (puzzleType.startsWith('quiz')) return resolve(puzzles[puzzleType][obj.index]);
		resolve(Tools.deepEquals(puzzles[puzzleType], obj));
	});
};

exports.checkNewsletterPuzzle = function (puzzleType, submission, solutions) {
	if (!solutions.hasOwnProperty(puzzleType)) throw new Error('Puzzle without a type... sus');
	if (puzzleType.startsWith('quiz')) return solutions[puzzleType][submission.index];
	return Tools.deepEquals(solutions[puzzleType], submission);
};

exports.checkLiveQuiz = function check (answer, solutions, questionType, basePoints, timeLeft) {
	return new Promise((resolve, reject) => {
		if (!Array.isArray(solutions)) solutions = [solutions];
		else if (solutions.length < 1) throw new Error('Did not have the answer to this...');
		if (typeof solutions[0] === 'number') answer = parseInt(answer);
		if (typeof solutions[0] !== typeof answer) throw new TypeError('Type mismatch between answer and solution');
		const finalPoints = Math.max(...solutions.map(solution => {
			// Unfortunately, we can't use a direct .find here, because
			// that will terminate on a partial correct even if there's a
			// later-occurring perfectly accurate solution.
			let points = 0;
			switch (basePoints) {
				case 10: {
					if (timeLeft >= 17) points = 10;
					else if (timeLeft >= 9) points = timeLeft - 7;
					else points = 1;
					break;
				}
				case 5: {
					if (timeLeft >= 12) points = 5;
					else if (timeLeft >= 5) points = Math.floor(timeLeft / 2) - 1;
					else points = 1;
					break;
				}
				case 3: default: {
					if (timeLeft >= 9) points = 3;
					else if (timeLeft >= 3) points = Math.floor(timeLeft / 3);
					else points = 1;
					break;
				}
			}
			// points based on the accuracy of the answer
			switch (questionType) {
				case 'mcq': {
					if (answer !== solution) points = 0;
					break;
				}
				case 'text': {
					if (Tools.levenshtein(Tools.toID(answer), Tools.toID(solution)) > 5) points = 0;
					break;
				}
				case 'number': {
					if (answer !== solution) points = 0;
					break;
				}
				default: {
					if (answer !== solution) points = 0;
				}
			}
			return points;
		}));
		return resolve({ points: finalPoints, timeLeft });
	});
};

exports.checkFandomQuiz = function (answer, solution, basepoints) {
	// The main reason we need a checker function is because we are dealing with different data types.
	// There are two ways you can proceed with this.

	//   One: the way you were going with: Note that you'll need to take another argument for whether the
	// quiz is randomized or not. Even then, rather than solution, it would be advised if you renamed it
	// as 'quiz' or something since the amount of points a question carries also varies.

	//   Two: Generate the questions based on random or not, and then pass a answer-solution couple, and then
	// just multiply the boolean true/false return value with the points that question is worth.

	// checker.js functions generally deal with comparing individual instances, generally, as evident from
	// the other checker functions. Would prefer if you could compare it that way itself.

	// PS: Imagine getting scolded by lint even after working with it all this while. This one's for Part ig ;-;
	return new Promise((resolve, reject) => {
		let points = basepoints;
		const questionType = parseInt(answer) ? 'mcq' : 'text';
		switch (questionType) {
			case 'mcq':
				points = points * (parseInt(answer) !== solution);
			case 'text':
				points = points * (Tools.levenshtein(Tools.toID(answer), Tools.toID(solution)) <= 5);
		}
		return resolve({ points: points });
	});
};
