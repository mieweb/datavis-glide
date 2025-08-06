import url from 'url';
import fs from 'fs';
import path from 'path';
import process from 'process';
import handler from 'serve-handler';

import _ from 'lodash';
import { defineConfig } from 'vite';

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
};

const autoLimit = (req, res, u) => {
  res.setHeader('Content-Type', 'application/json');
  fs.readFile('tests/data/random1000.json', 'utf8', (err, data) => {
    if (err != null) {
      res.end();
    }
    let json = JSON.parse(data);
    if (u.query.state) {
      json.data = _.filter(json.data, (d) => d.state === u.query.state);
    }
    if (u.query.limit != null) {
      json.data = json.data.slice(0, u.query.limit);
    }
    res.end(JSON.stringify(json));
  });
};

const testScaffold = () => ({
  name: 'test-scaffold',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      try {
        let u = url.parse(req.url, true);
        switch (u.pathname) {
        case '/reflect/cgi':
          return reflectCgi(req, res, u);
        case '/ds/autolimit':
          return autoLimit(req, res, u);
        default:
          let p = path.normalize(server.config.root + '/' + u.pathname);
          if (!fs.existsSync(p)) {
            return next();
          }
          let s = fs.statSync(p);
          if (s.isDirectory()) {
            return handler(req, res, {
              cleanUrls: true,
              directoryListing: true
            });
          }
        }
      }
      catch (e) {
        res.setHeader('Content-Type', 'text/plain');
        res.statusCode = 500;
        res.end(e.stack);
        const u = url.parse(req.url, true);
        console.error('METHOD:', req.method);
        console.error('PATH:  ', u.pathname);
        console.error('QUERY: ', u.query);
        console.error(e);
        return;
      }
      next();
    });
  }
});

export default defineConfig({
  plugins: [
    testScaffold()
  ],
  appType: 'mpa',
  server: {
    port: process.env['PORT']
  }
});
