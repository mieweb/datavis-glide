#!/usr/bin/env node

var spawn = require('child_process').spawn;
var path = require('path');
var parseArgs = require('node:util').parseArgs;

var parsed = parseArgs({
	options: {
		file: { type: 'string', multiple: true, short: 'f' },
		test: { type: 'string', multiple: true, short: 't' }
	},
	allowPositionals: false
});

var testFiles = [];

if (parsed.values.file) {
	testFiles.push(...parsed.values.file);
}
if (parsed.values.test) {
	testFiles.push(...(parsed.values.test.map(test => path.join('tests', 'selenium', test + '.js'))));
}

if (testFiles.length === 0) {
	testFiles = [path.join('tests', 'selenium', '*.js')];
}

var mocha = spawn('mocha', ['-t', '10000'].concat(testFiles), {
	stdio: 'inherit'
});

mocha.on('exit', function(code) {
	process.exit(code);
});
