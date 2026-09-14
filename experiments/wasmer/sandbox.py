"""Host adapter: a hard process deadline surrounds the SDK's guest deadline."""
import json
import os
from pathlib import Path
import subprocess

from contract import MAX_BYTES, decode

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SDK_PYTHON = ROOT / '.fork-runs/wasmer-venv/bin/python'


def run_source(source, request, *, execution_timeout=10.0, wall_timeout=180.0):
    if not isinstance(source, str) or not source.strip() or len(source.encode()) > MAX_BYTES:
        raise ValueError('Generator must contain 1–65536 bytes of Python')
    request_json = json.dumps(request, allow_nan=False)
    if len(request_json.encode()) > MAX_BYTES:
        raise ValueError('Request exceeds 64 KiB')
    if not SDK_PYTHON.exists():
        raise RuntimeError('Install experiments/wasmer/requirements.txt in .fork-runs/wasmer-venv first')
    payload = {'source': source, 'request': request,
               'cache_root': str(ROOT / '.fork-runs/wasmer-cache'),
               'execution_timeout': execution_timeout}
    try:
        child = subprocess.run(
            [str(SDK_PYTHON), str(HERE / 'sandbox_worker.py')],
            input=json.dumps(payload), text=True, capture_output=True,
            cwd=HERE, env={'PATH': os.defpath, 'LANG': 'C.UTF-8'}, timeout=wall_timeout)
    except subprocess.TimeoutExpired as error:
        raise RuntimeError('Wasmer worker exceeded its wall-clock deadline and was killed') from error
    try:
        # Escaped stdout can exceed the guest byte limit inside this host envelope.
        envelope = json.loads(child.stdout)
    except (ValueError, UnicodeError) as error:
        raise RuntimeError('Wasmer worker failed without a valid result') from error
    if child.returncode or 'error' in envelope:
        raise RuntimeError(envelope.get('message', 'Wasmer worker failed'))
    return decode(envelope.pop('stdout')), envelope
