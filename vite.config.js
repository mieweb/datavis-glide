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

const reflectJsonWhere = (req, res, u) => {
  const jsonWhere = JSON.parse(u.query.report_json_where);
  let data = [];
  for (let k1 of Object.keys(jsonWhere.model).sort()) {
    if (typeof jsonWhere.model[k1] === 'string') {
      data.push({
        name: k1,
        operator: '$eq (implicit)',
        value: jsonWhere.model[k1]
      });
      continue;
    }
    for (let k2 of Object.keys(jsonWhere.model[k1]).sort()) {
      let x = jsonWhere.model[k1][k2];
      data.push({
        name: k1,
        operator: k2,
        value: typeof x === 'string' ? x
          : Array.isArray(x) ? x.join(',')
          : JSON.stringify(x)
      });
    }
  }
  let o = {
    data: data,
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

const delayed = (req, res, u) => {
  var filePath = 'tests/data/random100.json';
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err != null) {
      res.statusCode = 500;
      res.end();
      return;
    }
    setTimeout(() => {
      res.setHeader('Content-Type', 'application/json');
      res.end(data);
    }, 5000);
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
        case '/reflect/json_where':
          return reflectJsonWhere(req, res, u);
        case '/ds/autolimit':
          return autoLimit(req, res, u);
        case '/source/delayed':
          return delayed(req, res, u);
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
  build: {
    lib: {
      entry: 'index.js',
      formats: ['es', 'iife'],
      name: 'MIE.WC_DataVis',
      fileName: 'vite/wcdatavis',
      cssFileName: 'vite/wcdatavis'
    }
  },
  server: {
    port: process.env['PORT']
  }
});
