/**
 * Functions used for common test setup/teardown.
 * @module setup
 */

const http = require('http');
const url = require('url');

const serveHandler = require('serve-handler');
const _ = require('lodash');

const reflectCgi = (req, res, u) => {
  let o = {
    data: _.map(Object.keys(u.query).sort(), (k) => {
    	let x = u.query[k];
      return {
      	name: k,
				value: typeof x === 'string' ? x
					: Array.isArray(x) ? x.join(',')
					: JSON.stringify(x)
      };
    }),
    typeInfo: [{
      field: 'name',
      type: 'string'
    }, {
      field: 'value',
      type: 'string'
    }]
  };
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(o));
}

/**
 * Creates a handler for requests coming to the testing web server.
 *
 * @alias module:setup.handler
 * @param {object} opts Handler options, passed directly to [serve-handler](https://www.npmjs.com/package/serve-handler#options).
 */

const handler = (opts) => (req, res) => {
  let u = url.parse(req.url, true);
  if (u.pathname === '/reflect/cgi') {
    return reflectCgi(req, res, u);
  }
  else {
    return serveHandler(req, res, opts);
  }
};

/**
 * Installs test before/after callbacks to manage the web server used for testing.  This server
 * listens on port 3000 (it's important for now that this port be free), and when testing is done
 * the server is shut down.  In this way, tests are entirely self-contained, there's no need to set
 * up another web server to host what we're testing.
 *
 * @alias module:setup.server
 * @example
 * setup.server();
 */

function server() {
	let s;

	before(function () {
		s = http.createServer(handler({
      cleanUrls: false,
			public: 'tests/pages'
    }));
		return s.listen(3000);
	});

	after(function () {
		return s.close();
	});
}

module.exports = {
	server: server,
	handler: handler
};
