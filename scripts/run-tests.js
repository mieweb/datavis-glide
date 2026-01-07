#!/usr/bin/env node

var spawn = require('child_process').spawn;
var path = require('path');

var files = process.env.npm_config_file || '*';
var testFiles = files.split(/\s+/).map(function(file) {
	return path.join('tests/selenium', file + '.js');
});

var mocha = spawn('mocha', ['-t', '10000'].concat(testFiles), {
	stdio: 'inherit'
});

mocha.on('exit', function(code) {
	process.exit(code);
});
