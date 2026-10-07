import copy
import http.client
import json
import socketserver
import sqlite3
import struct
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from control.core import Controller, ControlError, Journal, validate_config
from control.modbus import ModbusTCP, DeviceError, encode, decode
from control.server import handlers


class LocalDevice(socketserver.ThreadingTCPServer):
    """Test-only Modbus peer, bound to an ephemeral loopback port."""
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self):
        parent = self
        class Handler(socketserver.BaseRequestHandler):
            def receive(self, count):
                data = bytearray()
                while len(data) < count:
                    block = self.request.recv(count - len(data))
                    if not block:
                        raise EOFError
                    data.extend(block)
                return bytes(data)

            def handle(self):
                self.request.settimeout(1)
                try:
                    tx, protocol, length, unit = struct.unpack('>HHHB', self.receive(7))
                    pdu = self.receive(length - 1)
                    function = pdu[0]
                    mode, parent.next_mode = parent.next_mode, None
                    parent.requests.append(pdu)
                    if mode == 'close':
                        return
                    if mode == 'exception':
                        response = bytes((function | 0x80, 2))
                    elif function in (1, 2, 3, 4):
                        start, count = struct.unpack('>HH', pdu[1:])
                        bank = {1: 'coil', 2: 'discrete', 3: 'holding', 4: 'input'}[function]
                        values = [parent.values[bank].get(i, 0) for i in range(start, start + count)]
                        if function <= 2:
                            packed = bytearray((count + 7) // 8)
                            for i, value in enumerate(values):
                                packed[i // 8] |= value << (i % 8)
                            response = bytes((function, len(packed))) + packed
                        else:
                            response = bytes((function, count * 2)) + struct.pack('>' + 'H' * count, *values)
                    elif function in (5, 6):
                        address, value = struct.unpack('>HH', pdu[1:])
                        parent.writes.append(pdu)
                        if not parent.ignore_writes:
                            parent.values['coil' if function == 5 else 'holding'][address] = int(value == 0xff00) if function == 5 else value
                        response = pdu
                    elif function == 16:
                        address, count, byte_count = struct.unpack('>HHB', pdu[1:6])
                        words = struct.unpack('>' + 'H' * count, pdu[6:])
                        parent.writes.append(pdu)
                        if not parent.ignore_writes:
                            parent.values['holding'].update({address + i: word for i, word in enumerate(words)})
                        response = struct.pack('>BHH', function, address, count)
                    else:
                        response = bytes((function | 0x80, 1))
                    if mode == 'ack_mismatch':
                        response = response[:-1] + bytes((response[-1] ^ 1,))
                    if mode == 'wrong_function':
                        response = bytes((99,)) + response[1:]
                    if mode == 'wrong_length':
                        response = bytes((response[0], 255)) + response[2:]
                    header = struct.pack('>HHHB', tx + (mode == 'wrong_transaction'), protocol + (mode == 'wrong_protocol'), len(response) + 1, unit + (mode == 'wrong_unit'))
                    packet = header + response
                    if mode == 'fragment':
                        for block in (packet[:3], packet[3:8], packet[8:]):
                            self.request.sendall(block)
                            time.sleep(.002)
                    elif mode == 'drip':
                        for byte in packet:
                            self.request.sendall(bytes((byte,)))
                            time.sleep(.025)
                    else:
                        self.request.sendall(packet)
                except (OSError, EOFError):
                    pass
        super().__init__(('127.0.0.1', 0), Handler)
        self.values = {'input': {0: 245, 1: 700, 2: 182, 3: 400, 4: 65, 5: 187, 6: 240, 7: 500}, 'holding': {100: 180, 101: 300, 102: 90}, 'coil': {0: 0, 1: 0}, 'discrete': {0: 0}}
        self.next_mode = None
        self.ignore_writes = False
        self.writes, self.requests = [], []
        self.thread = threading.Thread(target=self.serve_forever, kwargs={'poll_interval': .01}, daemon=True)
        self.thread.start()

    def close(self):
        self.shutdown()
        self.server_close()
        self.thread.join()


class ProtocolTests(unittest.TestCase):
    def setUp(self):
        self.device = LocalDevice()
        self.addCleanup(self.device.close)
        self.client = ModbusTCP({'host': '127.0.0.1', 'port': self.device.server_address[1], 'timeout_seconds': .3})

    def test_engineering_units_signed_and_word_order(self):
        for point, value in [({'type': 'int16', 'scale': .1}, -3.2), ({'type': 'uint16', 'scale': .01}, 2.99), ({'type': 'uint32'}, 100000), ({'type': 'int32', 'word_order': 'little'}, -200000), ({'type': 'float32', 'word_order': 'little', 'scale': .5, 'offset': 2}, 19.25)]:
            with self.subTest(point=point):
                self.assertAlmostEqual(decode(encode(value, point), point), value)
        for value in (float('nan'), float('inf'), True):
            with self.assertRaises(ValueError):
                encode(value, {})
        with self.assertRaises(ValueError):
            encode(2.999, {'scale': .01})
        with self.assertRaises(ValueError):
            encode(70000, {})
        with self.assertRaises(DeviceError):
            decode([0x7f80, 0], {'type': 'float32'})

    def test_read_banks_and_group_only_contiguous_addresses(self):
        points = {'air': {'bank': 'input', 'address': 0, 'scale': .1}, 'humidity': {'bank': 'input', 'address': 1, 'scale': .1}, 'ec': {'bank': 'input', 'address': 5, 'scale': .01}, 'fault': {'bank': 'discrete', 'address': 0}, 'cooling': {'bank': 'coil', 'address': 0}, 'target': {'bank': 'holding', 'address': 100, 'scale': .1}}
        self.assertEqual(self.client.read_snapshot(points), {'air': 24.5, 'humidity': 70, 'ec': 1.87, 'target': 18, 'cooling': 0, 'fault': 0})
        input_requests = [struct.unpack('>BHH', p) for p in self.device.requests if p[0] == 4]
        self.assertEqual(input_requests, [(4, 0, 2), (4, 5, 1)])

    def test_write_coil_register_and_float_with_readback(self):
        for point, value in [({'bank': 'coil', 'address': 0}, 1), ({'bank': 'holding', 'address': 100, 'scale': .1}, 19), ({'bank': 'holding', 'address': 200, 'type': 'float32', 'word_order': 'little'}, 2.75)]:
            self.client.write(point, value)
            self.assertEqual(self.client.read_one(point), value)
        self.assertEqual([p[0] for p in self.device.writes], [5, 6, 16])

    def test_fragmented_response(self):
        self.device.next_mode = 'fragment'
        self.assertEqual(self.client.read_one({'bank': 'input', 'address': 0}), 245)

    def test_invalid_response_is_rejected(self):
        for mode in ('wrong_transaction', 'wrong_protocol', 'wrong_unit', 'wrong_function', 'wrong_length', 'exception', 'close'):
            with self.subTest(mode=mode):
                self.device.next_mode = mode
                with self.assertRaises(DeviceError):
                    self.client.read_one({'bank': 'input', 'address': 0})

    def test_write_acknowledgement_must_match(self):
        for point in ({'bank': 'coil', 'address': 0}, {'bank': 'holding', 'address': 100}, {'bank': 'holding', 'address': 200, 'type': 'uint32'}):
            self.device.next_mode = 'ack_mismatch'
            with self.assertRaises(DeviceError):
                self.client.write(point, 1)

    def test_slow_partial_response_has_overall_deadline(self):
        self.client.timeout = .07
        self.device.next_mode = 'drip'
        start = time.monotonic()
        with self.assertRaises(DeviceError):
            self.client.read_one({'bank': 'input', 'address': 0})
        self.assertLess(time.monotonic() - start, .25)


class ControlTests(unittest.TestCase):
    def setUp(self):
        self.device = LocalDevice()
        self.temp = tempfile.TemporaryDirectory()
        self.config = json.loads((Path(__file__).parents[1] / 'config.example.json').read_text())
        self.config['devices']['B05'].update(port=self.device.server_address[1], timeout_seconds=.2, write_enabled=True)
        self.config['server'].update(verify_seconds=.12, poll_seconds=.1, history_seconds=.1)
        self.controller = Controller(self.config, Path(self.temp.name) / 'control.sqlite3')
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.device.close)
        self.addCleanup(self.controller.close)
        self.controller.poll_once()

    @staticmethod
    def payload(request='request_001', point='root_target_temperature', value=19):
        return {'device': 'B05', 'point': point, 'value': value, 'requestId': request}

    def test_snapshot_and_history_come_from_protocol(self):
        snapshot = self.controller.snapshot()['devices']['B05']
        self.assertTrue(snapshot['connected'])
        self.assertEqual(snapshot['points']['pressure']['value'], 4)
        self.assertEqual(snapshot['points']['tank_level']['value'], 50)
        history = self.controller.journal.history('B05')
        self.assertEqual(history[0]['points']['air_temperature'], 24.5)

    def test_verified_command_has_readback_and_audit(self):
        command = self.controller.submit(self.payload())
        self.assertEqual(command['status'], 'queued')
        self.assertTrue(self.controller.execute_next())
        receipt = self.controller.journal.get(command['id'])
        self.assertEqual((receipt['status'], receipt['feedback']), ('verified', 19))
        statuses = [e['payload']['status'] for e in self.controller.journal.events() if e['kind'] == 'command']
        self.assertEqual(statuses, ['queued', 'sent', 'acknowledged', 'verified'])
        self.assertEqual(self.device.values['holding'][100], 190)

    def test_retry_is_idempotent_and_conflicts_are_rejected(self):
        first = self.controller.submit(self.payload())
        self.assertEqual(self.controller.submit(self.payload())['id'], first['id'])
        with self.assertRaises(ControlError) as caught:
            self.controller.submit(self.payload(value=20))
        self.assertEqual(caught.exception.status, 409)
        self.controller.execute_next()
        self.assertEqual(self.controller.submit(self.payload())['status'], 'verified')
        self.assertFalse(self.controller.execute_next())
        self.assertEqual(len(self.device.writes), 1)

    def test_concurrent_retries_only_enqueue_one_write(self):
        receipts, errors = [], []
        def submit():
            try:
                receipts.append(self.controller.submit(self.payload())['id'])
            except Exception as exc:
                errors.append(exc)
        threads = [threading.Thread(target=submit) for _ in range(10)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertFalse(errors)
        self.assertEqual(len(set(receipts)), 1)
        self.controller.execute_next()
        self.assertEqual(len(self.device.writes), 1)

    def test_invalid_commands_do_not_write(self):
        cases = [self.payload(value=26), self.payload(value=18.05), self.payload(value=float('nan')), self.payload(value=True), self.payload(point='pressure', value=4), self.payload(point='not_found'), self.payload(point='cooling_enabled', value=.5), {**self.payload(), 'requestId': 'bad'}, {**self.payload(), 'extra': 1}]
        for payload in cases:
            with self.subTest(payload=payload), self.assertRaises(ControlError):
                self.controller.submit(payload)
        self.assertFalse(self.device.writes)

    def test_write_switch_and_stale_feedback(self):
        self.controller.config['devices']['B05']['write_enabled'] = False
        with self.assertRaises(ControlError) as caught:
            self.controller.submit(self.payload())
        self.assertEqual(caught.exception.status, 403)
        self.controller.config['devices']['B05']['write_enabled'] = True
        for sample in self.controller.state['B05']['points'].values():
            sample['timestamp'] -= 10
        self.assertEqual(self.controller.snapshot()['devices']['B05']['points']['pressure']['quality'], 'stale')
        with self.assertRaises(ControlError) as caught:
            self.controller.submit(self.payload())
        self.assertEqual(caught.exception.status, 503)

    def test_interlock_is_re_read_before_dispatch(self):
        command = self.controller.submit(self.payload())
        self.device.values['discrete'][0] = 1
        self.controller.execute_next()
        receipt = self.controller.journal.get(command['id'])
        self.assertEqual(receipt['status'], 'failed')
        self.assertIn('interlock', receipt['error'])
        self.assertFalse(self.device.writes)

    def test_liquid_level_interlock_blocks_output(self):
        self.device.values['input'][7] = 50
        self.controller.poll_once()
        with self.assertRaises(ControlError):
            self.controller.submit(self.payload(point='cooling_enabled', value=1))
        self.assertFalse(self.device.writes)

    def test_start_interlocks_do_not_prevent_switching_output_off(self):
        self.device.values['discrete'][0] = 1
        self.device.values['coil'][0] = 1
        self.controller.poll_once()
        command = self.controller.submit(self.payload(point='cooling_enabled', value=0))
        self.controller.execute_next()
        self.assertEqual(self.controller.journal.get(command['id'])['status'], 'verified')
        self.assertEqual(self.device.values['coil'][0], 0)

    def test_acknowledgement_without_matching_readback_fails(self):
        self.device.ignore_writes = True
        command = self.controller.submit(self.payload())
        self.controller.execute_next()
        receipt = self.controller.journal.get(command['id'])
        self.assertEqual(receipt['status'], 'failed')
        self.assertIn('timed out', receipt['error'])
        self.assertIsNone(receipt['feedback'])

    def test_disconnect_does_not_create_success_or_fake_values(self):
        command = self.controller.submit(self.payload())
        self.device.next_mode = 'close'
        self.controller.execute_next()
        self.assertEqual(self.controller.journal.get(command['id'])['status'], 'failed')
        self.device.next_mode = 'exception'
        self.controller.poll_once()
        sample = self.controller.snapshot()['devices']['B05']
        self.assertFalse(sample['connected'])
        self.assertEqual(sample['points']['pressure']['quality'], 'bad')
        self.assertEqual(sample['points']['pressure']['value'], 4)

    def test_unavailable_initial_state(self):
        fresh = Controller(self.config, ':memory:')
        try:
            sample = fresh.snapshot()['devices']['B05']['points']['pressure']
            self.assertEqual(sample, {'value': None, 'quality': 'unavailable', 'timestamp': None})
        finally:
            fresh.close()

    def test_queue_capacity_rejects_before_record_creation(self):
        for i in range(128):
            self.controller.commands.put_nowait(str(i))
        with self.assertRaises(ControlError) as caught:
            self.controller.submit(self.payload())
        self.assertEqual(caught.exception.status, 503)
        self.assertIsNone(self.controller.journal.by_request('request_001'))

    def test_audit_failure_prevents_dispatch_and_disables_writes(self):
        command = self.controller.submit(self.payload())
        with patch.object(self.controller.journal, 'transition', side_effect=sqlite3.OperationalError('disk full')):
            self.controller.execute_next()
        self.assertFalse(self.device.writes)
        self.assertIsNotNone(self.controller.fatal_error)
        with self.assertRaises(ControlError):
            self.controller.submit(self.payload('request_002'))
        self.assertEqual(self.controller.journal.get(command['id'])['status'], 'queued')

    def test_acquisition_audit_failure_is_visible(self):
        self.controller.history_time.clear()
        with patch.object(self.controller.journal, 'sample', side_effect=sqlite3.OperationalError('disk full')), patch.object(self.controller.journal, 'event', side_effect=sqlite3.OperationalError('disk full')):
            self.controller.poll_once()
        self.assertIsNotNone(self.controller.snapshot()['serviceError'])

    def test_restart_marks_unfinished_command_interrupted_without_replay(self):
        path = Path(self.temp.name) / 'restart.sqlite3'
        journal = Journal(path)
        command, created = journal.create(self.payload())
        journal.transition(command['id'], 'acknowledged')
        journal.close()
        restart = Controller(self.config, path)
        try:
            self.assertEqual(restart.journal.get(command['id'])['status'], 'interrupted')
            self.assertFalse(restart.execute_next())
            self.assertEqual(len(self.device.writes), 0)
        finally:
            restart.close()

    def test_configuration_rejects_invalid_mapping(self):
        changes = [lambda c: c['devices']['B05'].update(timeout_seconds=True), lambda c: c['devices']['B05']['points']['pressure'].update(address=0), lambda c: c['devices']['B05']['points']['pressure'].update(scale=0), lambda c: c['devices']['B05']['points']['pressure'].update(writable=True, min=0, max=5), lambda c: c['devices']['B05']['points']['root_target_temperature'].update(verify_tolerance=-1), lambda c: c['devices']['B05']['points']['root_target_temperature'].update(interlocks=[{'point': 'fault_active', 'min': 5, 'max': 1}]), lambda c: c['server'].update(port=0)]
        for change in changes:
            config = copy.deepcopy(self.config)
            change(config)
            with self.assertRaises(ValueError):
                validate_config(config)


class ApiTests(unittest.TestCase):
    payload = staticmethod(ControlTests.payload)

    def setUp(self):
        ControlTests.setUp(self)
        self.token = 'unit_test_operation_token_0001'
        self.api = ThreadingHTTPServer(('127.0.0.1', 0), handlers(self.controller, self.token))
        self.api.daemon_threads = True
        self.thread = threading.Thread(target=self.api.serve_forever, kwargs={'poll_interval': .01}, daemon=True)
        self.thread.start()
        self.addCleanup(self.close_api)

    def close_api(self):
        self.api.shutdown()
        self.api.server_close()
        self.thread.join()

    def call(self, path, payload=None, token=None, origin=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.api.server_address[1], timeout=2)
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        if origin:
            headers['Origin'] = origin
        connection.request('POST' if payload is not None else 'GET', path, None if payload is None else json.dumps(payload), headers)
        response = connection.getresponse()
        data = response.read()
        content_type = response.getheader('Content-Type', '')
        result = json.loads(data) if content_type.startswith('application/json') else data
        connection.close()
        return response.status, result

    def test_http_authorization_and_readback_receipt(self):
        self.assertEqual(self.call('/api/v1/commands', self.payload())[0], 401)
        self.assertEqual(self.call('/api/v1/commands', self.payload(), token='wrong')[0], 401)
        self.assertEqual(self.call('/api/v1/commands', self.payload(), token=self.token, origin='https://different.invalid')[0], 403)
        status, command = self.call('/api/v1/commands', self.payload(), token=self.token)
        self.assertEqual(status, 202)
        self.controller.execute_next()
        self.assertEqual(self.call('/api/v1/commands/' + command['id'])[1]['status'], 'verified')

    def test_http_metadata_history_errors_and_static_console(self):
        self.assertEqual(self.call('/api/v1/health')[0], 200)
        metadata = self.call('/api/v1/metadata')[1]
        self.assertNotIn('host', metadata['devices']['B05'])
        self.assertEqual(self.call('/api/v1/telemetry')[1]['devices']['B05']['points']['ec']['value'], 1.87)
        self.assertEqual(self.call('/api/v1/history?device=B05')[1]['samples'][0]['points']['pressure'], 4)
        self.assertEqual(self.call('/api/v1/events')[0], 200)
        for path in ('/api/v1/history?device=nope', '/api/v1/history?device=B05&since=nan', '/api/v1/events?limit=999', '/api/v1/events?after=-1'):
            self.assertEqual(self.call(path)[0], 400)
        self.assertEqual(self.call('/api/v1/commands/nope')[0], 404)
        self.assertEqual(self.call('/../core.py')[0], 404)
        self.assertIn(b'console.js', self.call('/')[1])
        self.assertIn(b'EventSource', self.call('/console.js')[1])
        self.assertEqual(self.call('/brand.png')[0], 200)

    def test_sse_transmits_device_measurement(self):
        connection = http.client.HTTPConnection('127.0.0.1', self.api.server_address[1], timeout=2)
        connection.request('GET', '/api/v1/stream')
        response = connection.getresponse()
        self.assertEqual(response.status, 200)
        self.assertEqual(response.fp.readline().strip(), b'event: telemetry')
        data = json.loads(response.fp.readline().decode().removeprefix('data: '))
        self.assertEqual(data['devices']['B05']['points']['pressure']['value'], 4)
        response.close()
        connection.close()


if __name__ == '__main__':
    unittest.main()
