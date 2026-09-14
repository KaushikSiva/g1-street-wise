"""Standalone Wasmer curriculum experiment; never publishes or trains policies."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import time
import uuid

from contract import decode, validate_batch
from sandbox import run_source, ROOT, HERE


def feedback_from(path):
    report = decode(path.read_text())
    batch = validate_batch(report['batch'])
    rows = report['simulation']['results']
    if len(rows) != len(batch['scenarios']):
        raise ValueError('Feedback rows do not match scenarios')
    feedback = []
    for row, scenario in zip(rows, batch['scenarios']):
        if row['scenario'] != scenario:
            raise ValueError('Feedback scenario mismatch')
        item = {'scenario': scenario}
        for label in ('before', 'after'):
            outcome = row[label]
            item[label] = {}
            for key in ('success', 'contact', 'physical_contact', 'fall', 'timeout'):
                if type(outcome[key]) is not bool:
                    raise ValueError('Feedback outcomes must be booleans')
                item[label][key] = outcome[key]
        feedback.append(item)
    return feedback


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--agent', action='store_true', help='Ask W&B inference to author the generator')
    mode.add_argument('--generator', type=Path, help='Python source to execute ONLY inside Wasmer')
    parser.add_argument('--feedback', type=Path, help='A previous report from this experiment')
    parser.add_argument('--seed', type=int, default=731)
    parser.add_argument('--count', type=int, choices=range(1, 9), default=3)
    parser.add_argument('--generate-only', action='store_true', help='Validate scenarios without running physics')
    args = parser.parse_args()
    request = {'seed': args.seed, 'count': args.count,
               'feedback': feedback_from(args.feedback) if args.feedback else []}
    folder = ROOT / '.fork-runs/wasmer-experiment' / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8])
    folder.mkdir(parents=True)
    trace = []
    def event(stage, **data):
        trace.append({'stage': stage, 'at': datetime.now(timezone.utc).isoformat(), **data})
        (folder / 'trace.json').write_text(json.dumps(trace, indent=2, allow_nan=False))
    try:
        (folder / 'request.json').write_text(json.dumps(request, indent=2))
        event('started', mode='agent' if args.agent else 'provided-source' if args.generator else 'bundled-example')
        if args.agent:
            from agent import author
            source, author_info = author(request)
        else:
            source = (args.generator or HERE / 'example_generator.py').read_text()
            author_info = {'kind': 'provided-source' if args.generator else 'bundled-example'}
        (folder / 'generator.py').write_text(source)
        digest = hashlib.sha256(source.encode()).hexdigest()
        event('source-authored', source_sha256=digest, author=author_info)
        print('Running generator in Wasmer (network disabled, no host mounts)…', flush=True)
        started = time.monotonic()
        batch, runtime = run_source(source, request)
        validate_batch(batch, count=args.count)
        event('sandbox-output-validated', seconds=time.monotonic() - started, runtime=runtime)
        (folder / 'scenarios.json').write_text(json.dumps(batch, indent=2, allow_nan=False))
        report = {'version': 1, 'purpose': 'training-challenge-experiment', 'request': request,
                  'author': author_info, 'source_sha256': digest, 'sandbox': runtime, 'batch': batch}
        if not args.generate_only:
            from simulator import evaluate
            print(f'Running {len(batch["scenarios"])} fresh MuJoCo comparisons…', flush=True)
            report['simulation'] = evaluate(batch)
            event('simulation-complete', scenarios=len(batch['scenarios']))
        (folder / 'report.json').write_text(json.dumps(report, indent=2, allow_nan=False))
        event('complete', report='report.json')
        print(f'Report: {folder / "report.json"}')
        if 'simulation' in report:
            for row in report['simulation']['results']:
                print(f'Seed {row["scenario"]["seed"]}: before success={row["before"]["success"]}, after success={row["after"]["success"]}, after contact={row["after"]["contact"]}')
        return 0
    except Exception as error:
        # Guest stderr and provider responses can contain arbitrary text: retain
        # only the exception type in the local failure trace.
        event('failed', error=type(error).__name__)
        print(f'Experiment failed ({type(error).__name__}); trace: {folder / "trace.json"}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
