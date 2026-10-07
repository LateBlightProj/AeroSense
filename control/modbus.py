"""Modbus TCP transport with transaction checks and engineering-unit conversion."""
import math
import socket
import struct
import threading
import time


class DeviceError(Exception):
    pass


def width(point):
    return 2 if point.get('type', 'uint16') in ('uint32', 'int32', 'float32') else 1


def decode(words, point):
    kind = point.get('type', 'uint16')
    words = list(words)
    if len(words) == 2 and point.get('word_order', 'big') == 'little':
        words.reverse()
    formats = {'uint16': '>H', 'int16': '>h', 'uint32': '>I', 'int32': '>i', 'float32': '>f'}
    raw = struct.unpack(formats[kind], struct.pack('>' + 'H' * len(words), *words))[0]
    value = raw * point.get('scale', 1) + point.get('offset', 0)
    if not math.isfinite(value):
        raise DeviceError('non-finite device value')
    return value


def encode(value, point):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError('value must be finite')
    raw = (value - point.get('offset', 0)) / point.get('scale', 1)
    kind = point.get('type', 'uint16')
    if kind != 'float32':
        integer = round(raw)
        if abs(raw - integer) > 1e-6:
            raise ValueError('value does not match register resolution')
        raw = integer
    formats = {'uint16': '>H', 'int16': '>h', 'uint32': '>I', 'int32': '>i', 'float32': '>f'}
    try:
        packed = struct.pack(formats[kind], raw)
    except (struct.error, OverflowError) as exc:
        raise ValueError('value exceeds register representation') from exc
    words = list(struct.unpack('>' + 'H' * (len(packed) // 2), packed))
    if len(words) == 2 and point.get('word_order', 'big') == 'little':
        words.reverse()
    return words


class ModbusTCP:
    def __init__(self, config):
        self.host, self.port = config['host'], config.get('port', 502)
        self.unit = config.get('unit_id', 1)
        self.timeout = config.get('timeout_seconds', 1.5)
        self._transaction = 0
        self._lock = threading.Lock()

    @staticmethod
    def _receive(sock, size, deadline):
        data = bytearray()
        while len(data) < size:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise DeviceError('device response deadline exceeded')
            sock.settimeout(remaining)
            block = sock.recv(size - len(data))
            if not block:
                raise DeviceError('device closed an incomplete response')
            data.extend(block)
        return bytes(data)

    def _exchange(self, pdu):
        with self._lock:
            self._transaction = self._transaction % 65535 + 1
            transaction = self._transaction
            deadline = time.monotonic() + self.timeout
            packet = struct.pack('>HHHB', transaction, 0, len(pdu) + 1, self.unit) + pdu
            try:
                with socket.create_connection((self.host, self.port), self.timeout) as sock:
                    sock.settimeout(max(.001, deadline - time.monotonic()))
                    sock.sendall(packet)
                    rx_id, protocol, length, unit = struct.unpack('>HHHB', self._receive(sock, 7, deadline))
                    if rx_id != transaction or protocol != 0 or unit != self.unit or not 2 <= length <= 254:
                        raise DeviceError('invalid MBAP response header')
                    response = self._receive(sock, length - 1, deadline)
            except (OSError, TimeoutError) as exc:
                raise DeviceError('device communication failed: ' + type(exc).__name__) from exc
        if response[0] == (pdu[0] | 0x80):
            if len(response) != 2:
                raise DeviceError('invalid exception response')
            raise DeviceError(f'device exception {response[1]}')
        if response[0] != pdu[0]:
            raise DeviceError('unexpected response function')
        return response

    def _read(self, bank, start, count):
        function = {'coil': 1, 'discrete': 2, 'holding': 3, 'input': 4}[bank]
        response = self._exchange(struct.pack('>BHH', function, start, count))
        expected = (count + 7) // 8 if function <= 2 else count * 2
        if len(response) != expected + 2 or response[1] != expected:
            raise DeviceError('invalid read response length')
        if function <= 2:
            return [(response[2 + i // 8] >> (i % 8)) & 1 for i in range(count)]
        return list(struct.unpack('>' + 'H' * count, response[2:]))

    def read_snapshot(self, points):
        result = {}
        for bank in ('input', 'holding', 'coil', 'discrete'):
            items = sorted(((name, p) for name, p in points.items() if p['bank'] == bank), key=lambda item: item[1]['address'])
            maximum = 2000 if bank in ('coil', 'discrete') else 125
            while items:
                group = [items.pop(0)]
                start = group[0][1]['address']
                end = start + width(group[0][1])
                while items and items[0][1]['address'] + width(items[0][1]) - start <= maximum and items[0][1]['address'] == end:
                    group.append(items.pop(0))
                    end = group[-1][1]['address'] + width(group[-1][1])
                values = self._read(bank, start, end - start)
                for name, point in group:
                    index = point['address'] - start
                    result[name] = values[index] if bank in ('coil', 'discrete') else decode(values[index:index + width(point)], point)
        return result

    def read_one(self, point):
        return self.read_snapshot({'value': point})['value']

    def write(self, point, value):
        if point['bank'] == 'coil':
            pdu = struct.pack('>BHH', 5, point['address'], 0xFF00 if value else 0)
            if self._exchange(pdu) != pdu:
                raise DeviceError('coil write acknowledgement mismatch')
            return
        if point['bank'] != 'holding':
            raise ValueError('read-only register bank')
        words = encode(value, point)
        if len(words) == 1:
            pdu = struct.pack('>BHH', 6, point['address'], words[0])
            if self._exchange(pdu) != pdu:
                raise DeviceError('register write acknowledgement mismatch')
        else:
            pdu = struct.pack('>BHHB', 16, point['address'], len(words), 2 * len(words)) + struct.pack('>' + 'H' * len(words), *words)
            expected = struct.pack('>BHH', 16, point['address'], len(words))
            if self._exchange(pdu) != expected:
                raise DeviceError('multiple-register acknowledgement mismatch')
