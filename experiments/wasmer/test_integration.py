"""Real Wasmer checks, including failure boundaries; no SDK mocks."""
import copy
import json
import os
from pathlib import Path
import tempfile
import time
import unittest

from contract import decode, validate_batch
from sandbox import run_source, HERE

BATCH = {'version': 1, 'scenarios': [
    {'seed': 711, 'car_speed': 2.5, 'car_start_y': -10.0, 'crossing_x': .6}]}
REQUEST = {'seed': 731, 'count': 3, 'feedback': []}


class ContractTests(unittest.TestCase):
    def test_reject_invalid_batches(self):
        cases = []
        for key, value in [('seed', 20002), ('seed', True), ('car_speed', float('nan')),
                           ('car_speed', float('inf')), ('car_speed', 0),
                           ('crossing_x', -3), ('car_start_y', -1), ('car_speed', '2.5')]:
            batch = copy.deepcopy(BATCH)
            batch['scenarios'][0][key] = value
            cases.append(batch)
        for extra in ['command', 'checkpoint', 'reward']:
            batch = copy.deepcopy(BATCH)
            batch['scenarios'][0][extra] = 'not allowed'
            cases.append(batch)
        cases += [{'version': True, 'scenarios': BATCH['scenarios']},
                  {'version': 1, 'scenarios': []},
                  {'version': 1, 'scenarios': BATCH['scenarios'] * 2}]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):
                validate_batch(case)

    def test_invalid_json(self):
        for raw in ['', '{', '{"version":1,"version":1}', '{"x":NaN}',
                    '{"x":Infinity}', 'x' * 65537]:
            with self.subTest(raw=raw[:40]), self.assertRaises(ValueError):
                decode(raw)


class SandboxTests(unittest.TestCase):
    def test_real_sandbox_and_repeatability(self):
        source = (HERE / 'example_generator.py').read_text()
        first, runtime = run_source(source, REQUEST)
        second, _ = run_source(source, REQUEST)
        validate_batch(first, count=3)
        self.assertEqual(first, second)
        self.assertEqual(runtime['runtime'], 'wasmer-sdk')
        self.assertEqual(runtime['network'], 'disabled')

    def test_no_host_files_secrets_or_network(self):
        with tempfile.TemporaryDirectory() as folder:
            canary = Path(folder) / 'host-canary.txt'
            canary.write_text('sandbox-test-canary')
            os.environ['STREETWISE_SANDBOX_TEST_SECRET'] = 'host-only-canary'
            try:
                source = '''import json, os, socket
request = json.load(open('/workspace/request.json'))
try:
    open(request['host_path']).read()
    host_file_visible = True
except OSError:
    host_file_visible = False
sock = socket.socket()
sock.settimeout(.2)
try:
    sock.connect(('127.0.0.1', request['port']))
    network_connected = True
except OSError:
    network_connected = False
finally:
    sock.close()
print(json.dumps({'host_file_visible':host_file_visible,
 'secret_visible':'STREETWISE_SANDBOX_TEST_SECRET' in os.environ,
 'network_connected':network_connected}))
'''
                import socket
                with socket.socket() as server:
                    server.bind(('127.0.0.1', 0))
                    server.listen()
                    result, _ = run_source(source, {'host_path': str(canary), 'port': server.getsockname()[1]})
                self.assertEqual(result, {'host_file_visible': False, 'secret_visible': False,
                                          'network_connected': False})
                self.assertEqual(canary.read_text(), 'sandbox-test-canary')
            finally:
                os.environ.pop('STREETWISE_SANDBOX_TEST_SECRET', None)

    def test_loop_is_terminated(self):
        start = time.monotonic()
        with self.assertRaisesRegex(RuntimeError, 'timeout'):
            run_source('while True: pass', {}, execution_timeout=.2, wall_timeout=10)
        self.assertLess(time.monotonic() - start, 12)

    def test_output_limit(self):
        with self.assertRaises(RuntimeError):
            run_source('print("x" * 100000)', {})

    def test_guest_error_has_no_host_fallback(self):
        with self.assertRaises(RuntimeError):
            run_source('raise RuntimeError("intentional")', {})

    def test_bad_guest_json_rejected(self):
        with self.assertRaises(ValueError):
            run_source('print("{")', {})


class PhysicsTests(unittest.TestCase):
    def test_validated_parameters_reach_real_physics(self):
        from simulator import evaluate
        batch, _ = run_source((HERE / 'example_generator.py').read_text(),
                              {'seed': 731, 'count': 1, 'feedback': []})
        report = evaluate(batch)
        self.assertEqual(report['physics'], 'MuJoCo')
        self.assertEqual(report['scoring'], 'physical-contact-v2')
        row = report['results'][0]
        scenario = batch['scenarios'][0]
        self.assertEqual(row['before_initial'], row['after_initial'])
        self.assertEqual(row['after_initial']['car_position'],
                         [scenario['crossing_x'], scenario['car_start_y'], .75])
        self.assertEqual(row['after_initial']['car_speed'], scenario['car_speed'])
        for label in ('before', 'after'):
            outcome = row[label]
            self.assertEqual(outcome['scenario_seed'], scenario['seed'])
            self.assertGreater(outcome['elapsed'], 0)
            if outcome['success']:
                self.assertFalse(outcome['contact'] or outcome['fall'] or outcome['timeout'])
            if outcome['physical_contact']:
                self.assertTrue(outcome['contact'])
                self.assertFalse(outcome['success'])
                self.assertIsNotNone(outcome['collision_geometry'])
        # This is an integration check, not a new policy success benchmark.


if __name__ == '__main__':
    unittest.main(verbosity=2)
