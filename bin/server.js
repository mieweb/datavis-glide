#!/usr/bin/env node

const http = require('http');
const server = require('../tests/lib/server.js');

const s = http.createServer(server.handler({
  	cleanUrls: false
}));

s.on('listening', () => {
	console.log(`Listening on: http://localhost:${s.address().port}`);
});

s.listen(process.env.PORT, 'localhost');
