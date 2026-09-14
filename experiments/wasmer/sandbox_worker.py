"""SDK-only subprocess. Never runs guest source using host exec/eval/import."""
import asyncio
import json
import sys

from wasmer_sdk import Wasmer
from contract import MAX_BYTES

PACKAGE = 'python/python@=3.13.18'


async def execute(payload):
    async with Wasmer(cache_root=payload['cache_root']) as client:
        async with await client.sandboxes.create(
            packages=[PACKAGE], network='disabled', env={},
            files={'generator.py': payload['source'],
                   'request.json': json.dumps(payload['request'], allow_nan=False)},
        ) as sandbox:
            output = await sandbox.command('python', ['/workspace/generator.py']).run(
                stdin=json.dumps(payload['request'], allow_nan=False),
                timeout=payload['execution_timeout'], output_bytes=MAX_BYTES, check=False)
            if output.stdout.truncated or output.stderr.truncated:
                raise ValueError('Sandbox output exceeded 64 KiB')
            if not output.ok:
                raise ValueError(f'Sandbox command failed: {output.reason.value}, exit {output.exit_code}')
            return {'stdout': output.text(), 'runtime': 'wasmer-sdk', 'sdk_version': '0.2.1',
                    'package': PACKAGE, 'network': 'disabled', 'host_mounts': []}


if __name__ == '__main__':
    try:
        # Source plus request can each be 64 KiB; neither contains host secrets.
        raw = sys.stdin.read(2 * MAX_BYTES + 4097)
        if len(raw.encode()) > 2 * MAX_BYTES + 4096:
            raise ValueError('Worker input too large')
        payload = json.loads(raw)
        result = asyncio.run(execute(payload))
        print(json.dumps(result, allow_nan=False))
    except Exception as error:
        # Do not reflect arbitrary guest stderr into logs.
        print(json.dumps({'error': type(error).__name__, 'message': str(error)[:300]}))
        sys.exit(1)
