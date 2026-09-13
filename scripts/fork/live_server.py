"""Public demo server: static assets and bounded fresh MuJoCo comparisons.

No training or sponsor credentials are needed. One worker serializes physics
runs; a small queue bounds CPU/memory use. Results expire and are not training
data. Browser requests can choose only an allowlisted curriculum and seed.
"""
import hashlib
import json
import os
from pathlib import Path
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'scripts/fork/robot'))
CURRICULA = {
    'crossing': ('environment', 'CentralAvenueG1', 'rl-corridor-v2'),
    'hazards': ('hazards', 'CentralAvenueHazards', 'rl-hazards-v2'),
    'weather': ('weather', 'CentralAvenueWeather', 'rl-weather'),
    'streetlife': ('streetlife', 'CentralAvenueStreetlife', 'streetlife-multiple-shelters/round-002'),
    'emergencies': ('emergencies', 'CentralAvenueEmergencies', 'emergencies-v1/round-001'),
}
JOBS = {}
LOCK = threading.Lock()
SLOTS = threading.BoundedSemaphore(4)
WORKER = ThreadPoolExecutor(max_workers=1)


class NavigationPolicy:
    """The trained two-layer PPO actor, without training-library imports."""
    def __init__(self, path):
        import numpy as np
        self.weights = dict(np.load(path, allow_pickle=False))

    def predict(self, obs):
        import numpy as np
        w = self.weights
        x = np.asarray(obs, dtype=np.float32)
        x = np.tanh(w['w0'] @ x + w['b0'])
        x = np.tanh(w['w1'] @ x + w['b1'])
        return int(np.argmax(w['wa'] @ x + w['ba']))


def simulate(job_id, curriculum, seed):
    try:
        with LOCK:
            JOBS[job_id].update(status='running', phase='Loading walking and navigation policies')
        import importlib
        module, name, checkpoint_dir = CURRICULA[curriculum]
        checkpoint = ROOT/'artifacts/fork'/checkpoint_dir/'best.zip'
        env = getattr(importlib.import_module(module), name)(record=True)
        env.enforce_physical_contacts = True
        policy = NavigationPolicy(checkpoint.with_suffix('.npz'))
        assert str(policy.weights['checkpoint_sha256']) == hashlib.sha256(checkpoint.read_bytes()).hexdigest()
        results = {}
        started = time.monotonic()
        for label in ('before', 'after'):
            with LOCK:
                JOBS[job_id]['phase'] = f'Running {"constant-forward" if label == "before" else "trained navigation"} policy'
            obs, _ = env.reset(seed=seed)
            for _ in range(1000):
                action = 2 if label == 'before' else policy.predict(obs)
                obs, _, terminated, truncated, info = env.step(action)
                if terminated or truncated:
                    break
            else:
                raise RuntimeError('Episode exceeded its control-step budget')
            outcome = dict(info)
            if info['contact'] or info['fall']:
                # Hold the final issued command; show real dynamics after failure.
                # The scored episode has ended, so these frames cannot earn success.
                for _ in range(10):
                    _, _, _, _, consequence = env.step(action)
                    outcome['fall'] |= consequence['fall']
                    outcome['physical_contact'] |= consequence['physical_contact']
                    if consequence['collision_geometry'] and not outcome['collision_geometry']:
                        outcome['collision_geometry'] = consequence['collision_geometry']
                outcome['continuation_seconds'] = 2.
            results[label] = {**env.episode_record(), 'outcome': outcome}
        result = {'source': 'fresh_mujoco', 'curriculum': curriculum, 'seed': seed,
                  'wallSeconds': round(time.monotonic()-started, 2),
                  'generatedAt': time.time(), 'scoring': 'physical-contact-v2',
                  'gaitBackend': 'numpy-lstm' if os.getenv('STREETWISE_NUMPY_GAIT') == '1' else 'torchscript',
                  'checkpointSha256': hashlib.sha256(checkpoint.read_bytes()).hexdigest(),
                  'checkpoint': checkpoint_dir, 'replays': {k: [v] for k, v in results.items()},
                  'limits': 'Fresh simulated physics with frozen walking policy; not a physical robot trial. '
                            'Emergency policy is an interim checkpoint and still fails many encounters.'}
        with LOCK:
            JOBS[job_id].update(status='complete', result=result, phase='Comparison ready')
        env.close()
    except Exception as error:
        # Keep internals out of the public response, but retain useful server logs.
        print(f'Live simulation failed: {type(error).__name__}: {error}', flush=True)
        with LOCK:
            JOBS[job_id].update(status='failed', error='The simulation could not finish. Try another scenario.')
    finally:
        SLOTS.release()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT/'dist'), **kwargs)

    def log_message(self, *_):
        pass

    def send_head(self):
        path = Path(self.translate_path(self.path))
        compressed = Path(str(path)+'.gz')
        if 'gzip' in self.headers.get('Accept-Encoding', '') and compressed.is_file():
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type(str(path)))
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Vary', 'Accept-Encoding')
            self.send_header('Cache-Control', 'public, max-age=3600')
            self.send_header('Content-Length', str(compressed.stat().st_size))
            self.end_headers()
            return compressed.open('rb')
        return super().send_head()

    def send_json(self, status, payload):
        body = json.dumps(payload, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/live-api/health':
            return self.send_json(200, {'ready': True, 'physics': 'MuJoCo', 'curricula': list(CURRICULA),
                                        'queueCapacity': 4, 'concurrentPhysicsRuns': 1})
        if path.startswith('/live-api/runs/'):
            job_id = path.rsplit('/', 1)[-1]
            with LOCK:
                job = JOBS.get(job_id)
                snapshot = dict(job) if job else None
            return self.send_json(200 if snapshot else 404, snapshot or {'error': 'Run expired or not found. Start a new comparison.'})
        if path.startswith(('/live-api/', '/fork-api/')):
            return self.send_json(404, {'error': 'This endpoint is not hosted in the public demo.'})
        if any(part.startswith('.') for part in Path(path).parts):
            return self.send_json(404, {'error': 'Not found'})
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != '/live-api/runs':
            return self.send_json(404, {'error': 'Not found'})
        origin = self.headers.get('Origin')
        if origin and urlparse(origin).netloc != self.headers.get('Host'):
            return self.send_json(403, {'error': 'Use the STREETWISE demo to start a run.'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 2 <= size <= 1024:
                return self.send_json(413, {'error': 'Expected a small scenario request.'})
            request = json.loads(self.rfile.read(size))
            curriculum, seed = request.get('curriculum'), request.get('seed')
            if curriculum not in CURRICULA or type(seed) is not int or not 1 <= seed <= 99999999:
                return self.send_json(400, {'error': 'Choose a listed curriculum and an integer seed from 1 to 99999999.'})
        except (ValueError, TypeError, AttributeError):
            return self.send_json(400, {'error': 'Invalid scenario request.'})
        if not SLOTS.acquire(blocking=False):
            return self.send_json(429, {'error': 'The demo is busy with four comparisons. Try again shortly.'})
        job_id = uuid.uuid4().hex
        with LOCK:
            expired = [key for key, job in JOBS.items() if job['status'] in ('complete', 'failed') and time.time()-job['createdAt'] > 900]
            for key in expired:
                del JOBS[key]
            # Retain at most eight finished comparisons, plus the four queued/running jobs.
            finished = [key for key, job in JOBS.items() if job['status'] in ('complete', 'failed')]
            for key in finished[:-7]:
                del JOBS[key]
            JOBS[job_id] = {'id': job_id, 'status': 'queued', 'phase': 'Waiting for the physics worker', 'createdAt': time.time()}
        WORKER.submit(simulate, job_id, curriculum, seed)
        return self.send_json(202, {'id': job_id, 'status': 'queued'})


if __name__ == '__main__':
    server = ThreadingHTTPServer((os.getenv('HOST', '127.0.0.1'), int(os.getenv('PORT', '8192'))), Handler)
    print(f'STREETWISE static demo and fresh physics listening on {server.server_port}', flush=True)
    server.serve_forever()
