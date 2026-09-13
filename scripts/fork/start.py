"""Start STREETWISE preview, experiment service and marimo; Ctrl-C stops this group."""
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def main():
    python=ROOT/'.venv-fork/bin/python'
    marimo=ROOT/'.venv-fork/bin/marimo'
    if not python.exists() or not (ROOT/'dist/index.html').exists():
        raise SystemExit('Run python3 scripts/fork/setup.py first.')
    for port in [5189,8191,8192,2718]:
        with socket.socket() as sock:
            if sock.connect_ex(('127.0.0.1',port))==0:
                raise SystemExit(f'Port {port} is already in use. Existing processes were preserved.')
    processes=[]
    def stop(*_):
        for process in processes:
            os.killpg(process.pid,signal.SIGTERM)
        for process in processes:
            try:process.wait(timeout=8)
            except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL)
    signal.signal(signal.SIGINT,lambda *_:sys.exit(0))
    signal.signal(signal.SIGTERM,lambda *_:sys.exit(0))
    try:
        for command in [[str(python),'scripts/fork/service.py'],
                        [str(python),'scripts/fork/live_server.py'],
                        ['npm','run','preview','--','--host','127.0.0.1','--port','5189','--strictPort'],
                        [str(marimo),'run','notebooks/streetwise_lab.py','--headless','--port','2718']]:
            processes.append(subprocess.Popen(command,cwd=ROOT,start_new_session=True))
        print('G1 demo: http://127.0.0.1:5189/?robot=1\nWorld model: http://127.0.0.1:5189/?fork=1\nmarimo: http://127.0.0.1:2718',flush=True)
        while all(p.poll() is None for p in processes):
            time.sleep(.5)
        raise SystemExit('A service stopped. See its error above.')
    finally:
        stop()


if __name__=='__main__':
    main()
