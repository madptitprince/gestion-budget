"""Vercel Python function: all routes share the same authenticated handler."""
from urllib.parse import parse_qs, urlparse
from server import Handler

class handler(Handler):
    def translate_route(self):
        route = parse_qs(urlparse(self.path).query).get('__route', [None])[0]
        if route and route.startswith('/'):
            self.path = route
    def do_GET(self):
        self.translate_route(); super().do_GET()
    def do_POST(self):
        self.translate_route(); super().do_POST()
    def do_PUT(self):
        self.translate_route(); super().do_PUT()
    def do_DELETE(self):
        self.translate_route(); super().do_DELETE()
