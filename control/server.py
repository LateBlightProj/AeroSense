"""AeroSense control API and operations console. Run with python -m control.server."""
import argparse
import hmac
import json
import math
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from .core import Controller, ControlError

ROOT = Path(__file__).resolve().parent


def handlers(controller, token):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, format, *args):
            # Request bodies and authorization headers are never logged.
            pass

        def _reply(self, status, payload):
            content = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        def _authorized(self):
            provided = self.headers.get('Authorization', '')
            return bool(token) and hmac.compare_digest(provided.encode(), ('Bearer ' + token).encode())

        def do_GET(self):
            route = urlsplit(self.path)
            args = parse_qs(route.query)
            try:
                if route.path == '/api/v1/health':
                    self._reply(200, {'service': 'AeroSense Control', 'version': '1.0', 'journal': 'sqlite', 'serviceError': controller.fatal_error})
                elif route.path == '/api/v1/metadata':
                    self._reply(200, controller.metadata())
                elif route.path == '/api/v1/telemetry':
                    self._reply(200, controller.snapshot())
                elif route.path == '/api/v1/events':
                    after, limit = int(args.get('after', ['0'])[0]), int(args.get('limit', ['100'])[0])
                    if after < 0 or not 1 <= limit <= 500:
                        raise ControlError('invalid event range')
                    self._reply(200, {'events': controller.journal.events(after, limit)})
                elif route.path == '/api/v1/history':
                    device, since = args.get('device', [''])[0], float(args.get('since', ['0'])[0])
                    limit = int(args.get('limit', ['500'])[0])
                    if device not in controller.config['devices'] or not math.isfinite(since) or since < 0 or not 1 <= limit <= 1000:
                        raise ControlError('invalid history range')
                    self._reply(200, {'device': device, 'samples': controller.journal.history(device, since, limit)})
                elif route.path.startswith('/api/v1/commands/'):
                    command = controller.journal.get(route.path.rsplit('/', 1)[1])
                    self._reply(200 if command else 404, command or {'error': 'command not found'})
                elif route.path == '/api/v1/stream':
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/event-stream')
                    self.send_header('Cache-Control', 'no-store')
                    self.send_header('X-Accel-Buffering', 'no')
                    self.end_headers()
                    while not controller.stop.is_set():
                        data = json.dumps(controller.snapshot(), ensure_ascii=False, allow_nan=False)
                        self.wfile.write(('event: telemetry\ndata: ' + data + '\n\n').encode())
                        self.wfile.flush()
                        controller.stop.wait(controller.settings['poll_seconds'])
                else:
                    files = {'/': (ROOT / 'web/index.html', 'text/html; charset=utf-8'),
                             '/console.js': (ROOT / 'web/console.js', 'text/javascript; charset=utf-8'),
                             '/brand.png': (ROOT.parent / 'assets/images/AeroSense_深色Logo_exec88eccbbe_ver8.7.9.png', 'image/png')}
                    if route.path not in files:
                        self._reply(404, {'error': 'not found'})
                        return
                    path, media = files[route.path]
                    content = path.read_bytes()
                    self.send_response(200)
                    self.send_header('Content-Type', media)
                    self.send_header('Content-Length', str(len(content)))
                    self.send_header('X-Content-Type-Options', 'nosniff')
                    self.send_header('Cache-Control', 'no-store')
                    self.send_header('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'")
                    self.end_headers()
                    self.wfile.write(content)
            except (ControlError, ValueError) as exc:
                self._reply(getattr(exc, 'status', 400), {'error': str(exc)})
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception:
                self._reply(500, {'error': 'service operation failed'})

        def do_POST(self):
            if urlsplit(self.path).path != '/api/v1/commands':
                self._reply(404, {'error': 'not found'})
                return
            if not self._authorized():
                self.close_connection = True
                self._reply(401, {'error': 'authorization is required'})
                return
            origin = self.headers.get('Origin')
            if origin and urlsplit(origin).netloc != self.headers.get('Host'):
                self.close_connection = True
                self._reply(403, {'error': 'origin does not match service host'})
                return
            try:
                if self.headers.get('Transfer-Encoding'):
                    raise ControlError('chunked request bodies are not supported')
                length = int(self.headers.get('Content-Length', '0'))
                if not 1 <= length <= 4096:
                    raise ControlError('invalid request size', 413)
                if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
                    raise ControlError('application/json is required', 415)
                def reject_constant(value):
                    raise ValueError('non-finite JSON number')
                payload = json.loads(self.rfile.read(length), parse_constant=reject_constant)
                command = controller.submit(payload)
                self._reply(202, command)
            except (ControlError, ValueError, UnicodeError) as exc:
                self.close_connection = True
                self._reply(getattr(exc, 'status', 400), {'error': str(exc)})
            except Exception:
                self.close_connection = True
                self._reply(500, {'error': 'command service failed'})
    return Handler


def main():
    parser = argparse.ArgumentParser(description='AeroSense device control service')
    parser.add_argument('--config', required=True)
    parser.add_argument('--database', default=str(ROOT / 'state/control.sqlite3'))
    options = parser.parse_args()
    config = json.loads(Path(options.config).read_text())
    token = os.environ.get('AEROSENSE_CONTROL_TOKEN', '')
    if token and len(token) < 24:
        parser.error('AEROSENSE_CONTROL_TOKEN must contain at least 24 characters')
    controller = Controller(config, options.database)
    settings = controller.config['server']
    server = ThreadingHTTPServer((settings.get('bind', '127.0.0.1'), settings.get('port', 8765)), handlers(controller, token))
    server.daemon_threads = True
    controller.start()
    print(f'AeroSense Control: http://{server.server_address[0]}:{server.server_address[1]}', flush=True)
    try:
        server.serve_forever(poll_interval=.1)
    except KeyboardInterrupt:
        pass
    finally:
        controller.close()
        server.server_close()


if __name__ == '__main__':
    main()
