const http = require('http');
const url = require('url');

const serveHandler = require('serve-handler');
const _ = require('lodash');

const reflectCgi = (req, res, u) => {
  let o = {
    data: _.map(Object.keys(u.query).sort(), (k) => {
      return {name: k, value: u.query[k]};
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

const handler = (opts) => (req, res) => {
  let u = url.parse(req.url, true);
  if (u.pathname === '/reflect/cgi') {
    return reflectCgi(req, res, u);
  }
  else {
    return serveHandler(req, res, opts);
  }
};

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
