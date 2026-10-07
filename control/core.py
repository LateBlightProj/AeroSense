"""Acquisition, command lifecycle, readback verification and persistent audit."""
import copy
import json
import math
import queue
import re
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from .modbus import ModbusTCP, encode, width


class ControlError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def validate_config(config):
    config = copy.deepcopy(config)
    if not isinstance(config.get('devices'), dict) or not config['devices']:
        raise ValueError('devices must be a non-empty mapping')
    server = config.setdefault('server', {})
    server.setdefault('bind', '127.0.0.1')
    server.setdefault('port', 8765)
    if not isinstance(server['bind'], str) or not server['bind'] or type(server['port']) is not int or not 1 <= server['port'] <= 65535:
        raise ValueError('invalid control service address')
    for key, default, minimum, maximum in [('poll_seconds', 1, .1, 60), ('stale_seconds', 5, .2, 3600), ('verify_seconds', 3, .1, 60), ('history_seconds', 5, .1, 3600)]:
        value = server.setdefault(key, default)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not minimum <= value <= maximum:
            raise ValueError('invalid server setting: ' + key)
    for device, entry in config['devices'].items():
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,32}', device) or entry.get('protocol') != 'modbus_tcp':
            raise ValueError('invalid device identifier or protocol')
        if not isinstance(entry.get('host'), str) or not entry['host']:
            raise ValueError('device host is required')
        for key, default, lo, hi in [('port', 502, 1, 65535), ('unit_id', 1, 1, 247)]:
            entry.setdefault(key, default)
            if type(entry[key]) is not int or not lo <= entry[key] <= hi:
                raise ValueError('invalid ' + key)
        entry.setdefault('timeout_seconds', 1.5)
        if isinstance(entry['timeout_seconds'], bool) or not isinstance(entry['timeout_seconds'], (int, float)) or not math.isfinite(entry['timeout_seconds']) or not .05 <= entry['timeout_seconds'] <= 30:
            raise ValueError('invalid device timeout')
        if type(entry.get('write_enabled', False)) is not bool:
            raise ValueError('write_enabled must be boolean')
        if not isinstance(entry.get('points'), dict) or not entry['points']:
            raise ValueError('points are required')
        occupied = set()
        for name, point in entry['points'].items():
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', name):
                raise ValueError('invalid point name')
            if point.get('bank') not in ('coil', 'discrete', 'input', 'holding'):
                raise ValueError('invalid point bank')
            if point.get('type', 'uint16') not in ('uint16', 'int16', 'uint32', 'int32', 'float32'):
                raise ValueError('invalid point type')
            if point.get('word_order', 'big') not in ('big', 'little'):
                raise ValueError('invalid word order')
            address = point.get('address')
            if type(address) is not int or not 0 <= address <= 65536 - width(point):
                raise ValueError('invalid point address')
            if point['bank'] in ('coil', 'discrete') and width(point) != 1:
                raise ValueError('bit bank requires one-bit points')
            for offset in range(width(point)):
                key = (point['bank'], address + offset)
                if key in occupied:
                    raise ValueError('overlapping point addresses')
                occupied.add(key)
            for key, default in [('scale', 1), ('offset', 0)]:
                value = point.setdefault(key, default)
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                    raise ValueError('invalid point conversion')
            if point['scale'] <= 0:
                raise ValueError('scale must be positive')
            if type(point.get('writable', False)) is not bool:
                raise ValueError('writable must be boolean')
            if point['bank'] in ('coil', 'discrete') and (point['scale'] != 1 or point['offset'] != 0):
                raise ValueError('bit bank cannot use scale or offset')
            if 'verify_tolerance' in point and (isinstance(point['verify_tolerance'], bool) or not isinstance(point['verify_tolerance'], (int, float)) or not math.isfinite(point['verify_tolerance']) or point['verify_tolerance'] < 0):
                raise ValueError('invalid readback tolerance')
            if point.get('writable'):
                if point['bank'] not in ('coil', 'holding'):
                    raise ValueError('writable point must use coil or holding bank')
                if any(isinstance(point.get(k), bool) or not isinstance(point.get(k), (int, float)) or not math.isfinite(point[k]) for k in ('min', 'max')) or point['min'] > point['max']:
                    raise ValueError('writable point requires finite limits')
            for rule in point.get('interlocks', []):
                if rule.get('point') not in entry['points'] or not any(k in rule for k in ('equals', 'min', 'max')):
                    raise ValueError('invalid interlock')
                if any(isinstance(rule[k], bool) or not isinstance(rule[k], (int, float)) or not math.isfinite(rule[k]) for k in ('equals', 'min', 'max', 'when_value') if k in rule):
                    raise ValueError('invalid interlock bound')
                if 'min' in rule and 'max' in rule and rule['min'] > rule['max']:
                    raise ValueError('inverted interlock bounds')
    return config


class Journal:
    def __init__(self, path):
        if str(path) != ':memory:':
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(str(path), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY, request_id TEXT UNIQUE,
                payload TEXT NOT NULL, status TEXT NOT NULL, created REAL, updated REAL,
                error TEXT, feedback REAL);
            CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS samples(id INTEGER PRIMARY KEY AUTOINCREMENT,
                device TEXT NOT NULL, timestamp REAL NOT NULL, payload TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS samples_device_time ON samples(device,timestamp);
        ''')
        self.db.commit()
        with self.lock:
            pending = self.db.execute("SELECT id FROM commands WHERE status IN ('queued','sent','acknowledged')").fetchall()
            for row in pending:
                self.transition(row['id'], 'interrupted', error='service restarted; device state requires review')

    @staticmethod
    def _command(row):
        if row is None:
            return None
        result = dict(row)
        result['payload'] = json.loads(result['payload'])
        return result

    def create(self, payload):
        request = payload['requestId']
        packed = json.dumps(payload, sort_keys=True, separators=(',', ':'))
        with self.lock:
            row = self.db.execute('SELECT * FROM commands WHERE request_id=?', (request,)).fetchone()
            if row:
                if row['payload'] != packed:
                    raise ControlError('requestId already belongs to a different command', 409)
                return self._command(row), False
            now, identifier = time.time(), str(uuid.uuid4())
            with self.db:
                self.db.execute('INSERT INTO commands VALUES(?,?,?,?,?,?,?,?)', (identifier, request, packed, 'queued', now, now, None, None))
                self.db.execute('INSERT INTO events(timestamp,kind,payload) VALUES(?,?,?)', (now, 'command', json.dumps({'id': identifier, 'status': 'queued', **payload})))
            return self.get(identifier), True

    def get(self, identifier):
        with self.lock:
            return self._command(self.db.execute('SELECT * FROM commands WHERE id=?', (identifier,)).fetchone())

    def by_request(self, request):
        with self.lock:
            return self._command(self.db.execute('SELECT * FROM commands WHERE request_id=?', (request,)).fetchone())

    def transition(self, identifier, status, error=None, feedback=None):
        with self.lock, self.db:
            now = time.time()
            self.db.execute('UPDATE commands SET status=?,updated=?,error=?,feedback=? WHERE id=?', (status, now, error, feedback, identifier))
            self.db.execute('INSERT INTO events(timestamp,kind,payload) VALUES(?,?,?)', (now, 'command', json.dumps({'id': identifier, 'status': status, 'error': error, 'feedback': feedback})))

    def event(self, kind, payload):
        with self.lock, self.db:
            self.db.execute('INSERT INTO events(timestamp,kind,payload) VALUES(?,?,?)', (time.time(), kind, json.dumps(payload)))

    def events(self, after=0, limit=100):
        with self.lock:
            rows = self.db.execute('SELECT * FROM events WHERE id>? ORDER BY id LIMIT ?', (after, limit)).fetchall()
            return [dict(row, payload=json.loads(row['payload'])) for row in rows]

    def close(self):
        with self.lock:
            self.db.close()

    def sample(self, device, timestamp, values):
        with self.lock, self.db:
            self.db.execute('INSERT INTO samples(device,timestamp,payload) VALUES(?,?,?)', (device, timestamp, json.dumps(values)))
            self.db.execute('DELETE FROM samples WHERE device=? AND id NOT IN (SELECT id FROM samples WHERE device=? ORDER BY id DESC LIMIT 10000)', (device, device))

    def history(self, device, since=0, limit=500):
        with self.lock:
            rows = self.db.execute('SELECT timestamp,payload FROM samples WHERE device=? AND timestamp>=? ORDER BY timestamp LIMIT ?', (device, since, limit)).fetchall()
            return [{'timestamp': row['timestamp'], 'points': json.loads(row['payload'])} for row in rows]


class Controller:
    def __init__(self, config, database, adapters=None):
        self.config = validate_config(config)
        self.settings = self.config['server']
        self.journal = Journal(database)
        self.adapters = adapters or {key: ModbusTCP(value) for key, value in self.config['devices'].items()}
        self.state = {key: {'connected': False, 'error': None, 'points': {name: {'value': None, 'quality': 'unavailable', 'timestamp': None} for name in entry['points']}} for key, entry in self.config['devices'].items()}
        self.lock = threading.RLock()
        self.commands = queue.Queue(maxsize=128)
        self.stop = threading.Event()
        self.threads = []
        self.history_time = {}
        self.fatal_error = None

    def metadata(self):
        return {'devices': {key: {'label': entry.get('label', key), 'protocol': entry['protocol'], 'writeEnabled': entry.get('write_enabled', False), 'points': {name: {field: p[field] for field in ('label', 'unit', 'min', 'max', 'scale', 'writable', 'bank', 'type') if field in p} for name, p in entry['points'].items()}} for key, entry in self.config['devices'].items()}}

    def poll_once(self):
        for key, entry in self.config['devices'].items():
            if self.stop.is_set():
                return
            try:
                values = self.adapters[key].read_snapshot(entry['points'])
                if set(values) != set(entry['points']) or any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in values.values()):
                    raise ValueError('incomplete or invalid device snapshot')
                timestamp = time.time()
                with self.lock:
                    changed = not self.state[key]['connected']
                    self.state[key].update(connected=True, error=None)
                    self.state[key]['points'] = {name: {'value': value, 'quality': 'good', 'timestamp': timestamp} for name, value in values.items()}
                if changed:
                    self.journal.event('connection', {'device': key, 'connected': True})
                if timestamp - self.history_time.get(key, 0) >= self.settings['history_seconds']:
                    self.journal.sample(key, timestamp, values)
                    self.history_time[key] = timestamp
            except Exception as exc:
                with self.lock:
                    changed = self.state[key]['connected'] or self.state[key]['error'] != str(exc)
                    self.state[key].update(connected=False, error=str(exc))
                    for point in self.state[key]['points'].values():
                        point['quality'] = 'bad'
                if changed:
                    try:
                        self.journal.event('connection', {'device': key, 'connected': False, 'error': str(exc)})
                    except sqlite3.Error:
                        self.fatal_error = 'command journal is unavailable; writing is disabled'

    def snapshot(self):
        with self.lock:
            state = copy.deepcopy(self.state)
        now = time.time()
        for device in state.values():
            for point in device['points'].values():
                if point['quality'] == 'good' and now - point['timestamp'] > self.settings['stale_seconds']:
                    point['quality'] = 'stale'
                    device['connected'] = False
        return {'timestamp': now, 'devices': state, 'serviceError': self.fatal_error}

    def _validate_command(self, payload):
        if not isinstance(payload, dict) or set(payload) != {'device', 'point', 'value', 'requestId'}:
            raise ControlError('device, point, value and requestId are required')
        device, name, value = payload['device'], payload['point'], payload['value']
        if not isinstance(device, str) or not isinstance(name, str) or device not in self.config['devices'] or name not in self.config['devices'][device]['points']:
            raise ControlError('unknown device or point', 404)
        if not isinstance(payload['requestId'], str) or not re.fullmatch(r'[A-Za-z0-9_-]{8,128}', payload['requestId']):
            raise ControlError('invalid requestId')
        point, entry = self.config['devices'][device]['points'][name], self.config['devices'][device]
        if not point.get('writable') or not entry.get('write_enabled', False):
            raise ControlError('point is not enabled for writing', 403)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not point['min'] <= value <= point['max']:
            raise ControlError('value is outside configured limits')
        if point['bank'] == 'coil':
            if value not in (0, 1):
                raise ControlError('coil value must be 0 or 1')
        else:
            try:
                encode(value, point)
            except ValueError as exc:
                raise ControlError(str(exc)) from exc
        state = self.snapshot()['devices'][device]
        if not state['connected'] or state['points'][name]['quality'] != 'good':
            raise ControlError('device feedback is unavailable or stale', 503)
        for rule in point.get('interlocks', []):
            if 'when_value' in rule and value != rule['when_value']:
                continue
            sample = state['points'][rule['point']]
            current = sample['value']
            if sample['quality'] != 'good' or ('equals' in rule and current != rule['equals']) or ('min' in rule and current < rule['min']) or ('max' in rule and current > rule['max']):
                raise ControlError('interlock is not satisfied: ' + rule['point'], 409)

    def submit(self, payload):
        if self.fatal_error or self.stop.is_set():
            raise ControlError('control service is unavailable', 503)
        # Return the durable receipt for retries; never dispatch a duplicate write.
        if isinstance(payload, dict) and isinstance(payload.get('requestId'), str):
            old = self.journal.by_request(payload['requestId'])
            if old:
                if old['payload'] != payload:
                    raise ControlError('requestId already belongs to a different command', 409)
                return old
        self._validate_command(payload)
        with self.lock:
            old = self.journal.by_request(payload['requestId'])
            if old:
                if old['payload'] != payload:
                    raise ControlError('requestId already belongs to a different command', 409)
                return old
            if self.commands.full():
                raise ControlError('command queue is full', 503)
            command, created = self.journal.create(payload)
            if created:
                self.commands.put_nowait(command['id'])
            return command

    def execute_next(self):
        try:
            identifier = self.commands.get_nowait()
        except queue.Empty:
            return False
        try:
            command = self.journal.get(identifier)
            payload = command['payload']
            if self.stop.is_set() or self.fatal_error:
                self.journal.transition(identifier, 'interrupted', error='control service is unavailable')
                return True
            self._validate_command(payload)
            entry = self.config['devices'][payload['device']]
            point = entry['points'][payload['point']]
            adapter = self.adapters[payload['device']]
            # Re-read the output and its permissives immediately before dispatch.
            names = {payload['point']} | {rule['point'] for rule in point.get('interlocks', [])}
            values = adapter.read_snapshot({name: entry['points'][name] for name in names})
            if set(values) != names or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values.values()):
                raise ControlError('invalid dispatch feedback', 503)
            with self.lock:
                for name, value in values.items():
                    self.state[payload['device']]['points'][name] = {'value': value, 'quality': 'good', 'timestamp': time.time()}
            self._validate_command(payload)
            self.journal.transition(identifier, 'sent')
            adapter.write(point, payload['value'])
            self.journal.transition(identifier, 'acknowledged')
            deadline = time.monotonic() + self.settings['verify_seconds']
            tolerance = point.get('verify_tolerance', max(point['scale'] / 2, .0001))
            while not self.stop.is_set():
                if time.monotonic() >= deadline:
                    raise ControlError('readback verification timed out', 504)
                feedback = adapter.read_one(point)
                if time.monotonic() > deadline:
                    raise ControlError('readback verification timed out', 504)
                if math.isfinite(feedback) and abs(feedback - payload['value']) <= tolerance:
                    with self.lock:
                        self.state[payload['device']]['points'][payload['point']] = {'value': feedback, 'quality': 'good', 'timestamp': time.time()}
                    self.journal.transition(identifier, 'verified', feedback=feedback)
                    break
                if time.monotonic() >= deadline:
                    raise ControlError('write acknowledged but readback did not match before timeout', 504)
                self.stop.wait(.05)
            else:
                self.journal.transition(identifier, 'interrupted', error='service stopped before readback verification')
        except Exception as exc:
            try:
                self.journal.transition(identifier, 'failed', error=str(exc))
            except sqlite3.Error:
                self.fatal_error = 'command journal is unavailable; writing is disabled'
        finally:
            self.commands.task_done()
        return True

    def start(self):
        if self.threads:
            return
        def acquisition():
            while not self.stop.is_set():
                self.poll_once()
                self.stop.wait(self.settings['poll_seconds'])
        def execution():
            while not self.stop.is_set():
                if not self.execute_next():
                    self.stop.wait(.025)
        self.threads = [threading.Thread(target=fn, daemon=True) for fn in (acquisition, execution)]
        for thread in self.threads:
            thread.start()

    def close(self):
        self.stop.set()
        for thread in self.threads:
            thread.join()
        self.journal.close()
