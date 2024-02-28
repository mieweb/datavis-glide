#!/usr/bin/env python

import json
import os

import tornado.ioloop
import tornado.web
import tornado.httpserver

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        with open("tests/data/random1000.json", "r") as f:
            data = json.load(f)
        start = int(self.get_argument("start", "0"))
        if start > 0:
            oldStuff = data["data"][max(start - 10, 0):start]
            newStuff = data["data"][start:start+50]
        else:
            oldStuff = []
            newStuff = data["data"][:50]
        data["data"] = oldStuff + newStuff
        self.write(data)

    def get_content_type(self):
        return "application/json"

class StaticHandler(tornado.web.StaticFileHandler):
    @classmethod
    def get_content(cls, absolute_path, start, end):
        if not os.path.isdir(absolute_path):
            return super(StaticHandler, cls).get_content(absolute_path, start, end)

        templateLoader = tornado.template.Loader(os.path.join(os.path.abspath(os.path.dirname(__file__)), "templates"))
        return templateLoader.load("dirlist.html").generate(path=absolute_path)

    @classmethod
    def get_content_version(cls, absolute_path):
        return None # no caching

    def write_error(self, status_code, **kwargs):
        templateLoader = tornado.template.Loader(os.path.join(os.path.abspath(os.path.dirname(__file__)), "templates"))
        e = kwargs['exc_info'][1]
        self.set_header("Content-Type", "text/html")
        self.finish(templateLoader.load("error.html").generate(code=e.status_code, msg=str(e)))

    def validate_absolute_path(self, root, path):
        absolute_path = os.path.join(root, path)
        if not os.path.isdir(absolute_path) or os.path.isfile(os.path.join(absolute_path, self.default_filename)):
            return super().validate_absolute_path(root, path)
        else:
            return absolute_path

    def get_content_type(self):
        if not os.path.isdir(self.absolute_path):
            return super().get_content_type()
        else:
            return "text/html"

    def get_content_size(self):
        if not os.path.isdir(self.absolute_path):
            return super().get_content_size()
        else:
            templateLoader = tornado.template.Loader(os.path.join(os.path.abspath(os.path.dirname(__file__)), "templates"))
            return len(templateLoader.load("dirlist.html").generate(path=self.absolute_path))

if __name__ == "__main__":
    app = tornado.web.Application([
        (r"/data-server", MainHandler),
        (r"/(.*)", StaticHandler, {"path": os.getcwd(), "default_filename": "index.html"}),
        # (r"/(doc/.*)", StaticHandler, {"path": os.getcwd()}),
        # (r"/(jsdoc/.*)", StaticHandler, {"path": os.getcwd()}),
        # (r"/(tests/.*)", StaticHandler, {"path": os.getcwd()}),
        ], debug=True)
    server = tornado.httpserver.HTTPServer(app)
    port = 5000
    if "PORT" in os.environ:
        port = os.environ["PORT"]
    print("Listening for requests on http://localhost:%u" % (port))
    server.listen(port)
    tornado.ioloop.IOLoop.current().start()
