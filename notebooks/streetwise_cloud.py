# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "matplotlib==3.11.2",
#     "mujoco==3.13.0",
#     "python-dotenv==1.2.3",
#     "pyyaml==6.0.3",
#     "stable-baselines3==2.9.0",
#     "torch==2.14.0",
#     "wandb==0.30.0",
# ]
# ///

import marimo

__generated_with = "0.24.0"
app = marimo.App(width="medium", auto_download=["html"])


@app.cell
def _():
    import marimo as mo

    return (mo,)


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    # STREETWISE
    ### Robots that learn the street before they enter it.
    Central Avenue · MuJoCo · Unitree policy · PPO · Weights & Biases
    """)
    return


@app.cell
def streetwise_setup(mo):
    from pathlib import Path
    import subprocess
    import sys
    import json
    import os
    import torch
    streetwise_root = Path('/marimo/streetwise')
    import urllib.request
    for _name in ['g1_policy.py', 'environment.py', 'hazards.py', 'train.py']:
        _target = streetwise_root / 'scripts/fork/robot' / _name
        if not _target.exists():
            _target.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve('https://raw.githubusercontent.com/KaushikSiva/g1-street-wise/main/scripts/fork/robot/' + _name, _target)
    _upstream = streetwise_root / 'vendor/unitree_rl_gym'
    _upstream.parent.mkdir(parents=True, exist_ok=True)
    if not _upstream.exists():
        subprocess.run(['git','clone','--depth','1','https://github.com/unitreerobotics/unitree_rl_gym.git',str(_upstream)],check=True,capture_output=True)
    subprocess.run(['git','-C',str(_upstream),'fetch','--depth','1','origin','276801e46c5d433564f24658bac64f254b7d2d4b'],check=True,capture_output=True)
    subprocess.run(['git','-C',str(_upstream),'checkout','276801e46c5d433564f24658bac64f254b7d2d4b'],check=True,capture_output=True)
    streetwise_compute = {'gpu': torch.cuda.get_device_name(0) if torch.cuda.is_available() else None, 'cuda': torch.cuda.is_available(), 'torch': torch.__version__, 'physics': 'MuJoCo on CPU; PPO network on CUDA'}
    mo.md(f"### Compute verified\n`{streetwise_compute}`")
    return json, os, streetwise_root, subprocess, sys


@app.cell(hide_code=True)
def training_control(mo):
    streetwise_train_button = mo.ui.run_button(label="Train obstacle curriculum · 131,072 PPO steps")
    streetwise_train_button
    return (streetwise_train_button,)


@app.cell
def streetwise_training(
    mo,
    os,
    streetwise_root,
    streetwise_train_button,
    subprocess,
    sys,
):
    mo.stop(not streetwise_train_button.value, mo.md("Ready to train. Results are measured in MuJoCo; no hardware connected."))
    _log = streetwise_root / 'training.log'
    _pid = streetwise_root / 'training.pid'
    _running = False
    if _pid.exists():
        try:
            os.kill(int(_pid.read_text()), 0)
            _running = True
        except (ProcessLookupError, ValueError):
            pass
    if not _running:
        with _log.open('w') as _output:
            _process = subprocess.Popen([sys.executable, 'scripts/fork/robot/train.py', '--hazards', '--steps', '131072', '--device', 'cuda', '--wandb', '--output', 'artifacts/fork/rl-hazards'], cwd=streetwise_root, env={**os.environ, "PYTHONPATH": str(streetwise_root / "scripts/fork/robot")}, stdout=_output, stderr=subprocess.STDOUT, start_new_session=True)
        _pid.write_text(str(_process.pid))
    mo.md("### Obstacle training started\nPPO learns waiting, forward motion and lateral avoidance. Pedestrians and cars move; the road defect is a keep-out zone, not a simulated terrain pit. Training progress is logged to W&B.")
    return


@app.cell(hide_code=True)
def progress_control(mo):
    streetwise_refresh = mo.ui.run_button(label="Refresh measured training progress")
    streetwise_refresh
    return (streetwise_refresh,)


@app.cell
def training_evidence(json, mo, streetwise_refresh, streetwise_root):
    streetwise_refresh
    import matplotlib.pyplot as plt
    _run_dir = streetwise_root / 'artifacts/fork/rl-hazards-v2'
    if not (_run_dir / 'learning-curve.json').exists():
        _run_dir = streetwise_root / 'artifacts/fork/rl-hazards'
    _curve_path = _run_dir / 'learning-curve.json'
    if _curve_path.exists():
        _rows = json.loads(_curve_path.read_text())
        _figure, _axis = plt.subplots(figsize=(10,3.5), facecolor='#f1f0e7')
        _axis.set_facecolor('#f1f0e7')
        _axis.plot([r['step'] for r in _rows], [100*r['validation/success_rate'] for r in _rows], color='#285a47', linewidth=2.5)
        _axis.set(xlabel='PPO training steps', ylabel='Validation completion (%)', ylim=(0,105), title='STREETWISE · Measured obstacle curriculum')
        _axis.grid(alpha=.2)
        plt.close(_figure)
        _result_path = _run_dir / 'evaluation.json'
        _run_url = 'https://wandb.ai/kaushik-siva88/Unitree%20G1'
        _status = 'Training in progress. Validation selects checkpoints; the test set is reserved until training ends.'
        if _result_path.exists():
            _evaluation = json.loads(_result_path.read_text())
            _run_url = _evaluation['wandbUrl']
            _status = f"Held-out test: {_evaluation['baseline']['success_rate']:.1%} baseline → {_evaluation['trained']['success_rate']:.1%} trained. Simulation only."
        mo.vstack([mo.md(_status), _figure, mo.md(f'[Open W&B experiment]({_run_url})')])
    else:
        mo.md('The first validation checkpoint is being measured.')
    return


@app.cell(hide_code=True)
def refinement_control(mo):
    streetwise_refine = mo.ui.run_button(label="Refine car spacing · 65,536 additional PPO steps")
    streetwise_refine
    return (streetwise_refine,)


@app.cell
def refinement_run(
    mo,
    os,
    streetwise_refine,
    streetwise_root,
    subprocess,
    sys,
):
    mo.stop(not streetwise_refine.value)
    with (streetwise_root / 'refinement.log').open('w') as _log:
        _p = subprocess.Popen([sys.executable, 'scripts/fork/robot/train.py', '--hazards', '--steps', '65536', '--device', 'cuda', '--wandb', '--resume', 'artifacts/fork/rl-hazards/best.zip', '--output', 'artifacts/fork/rl-hazards-v2'], cwd=streetwise_root, env={**os.environ, 'PYTHONPATH': str(streetwise_root / 'scripts/fork/robot')}, stdout=_log, stderr=subprocess.STDOUT, start_new_session=True)
    mo.md('### Corrected vehicle spacing\nThe crossing car now has at least 0.30 m separation from the parked van. Refining navigation from the previous checkpoint; a new held-out evaluation follows checkpoint selection.')
    return


@app.cell(hide_code=True)
def weather_review_control(mo):
    weather_review_refresh = mo.ui.run_button(label="Refresh automatic curriculum results")
    weather_review_refresh
    return (weather_review_refresh,)


@app.cell(hide_code=True)
def weather_curriculum_evidence(
    json,
    mo,
    streetwise_root,
    weather_review_refresh,
):
    weather_review_refresh
    _weather_rows=[]
    for _folder in sorted((streetwise_root/'artifacts/fork').glob('rl-weather*')):
        _file=_folder/'evaluation.json'
        if _file.exists():
            _run=json.loads(_file.read_text())
            _weather_rows.append({'run':_folder.name,'steps':_run['steps'],'baseline / 64':round(_run['baseline']['success_rate']*64),'starting checkpoint / 64':round(_run['untrained']['success_rate']*64),'selected checkpoint / 64':round(_run['trained']['success_rate']*64),'W&B':_run.get('wandbUrl')})
    _weather_status=streetwise_root/'artifacts/fork/curriculum/status.json'
    mo.vstack([mo.md("## A street that gets harder\nRain changes actual contact friction. Fog limits actor tracking. Two perfect validation checks unlock the next level; independent test results do not decide advancement."),mo.ui.table(_weather_rows),mo.md("Starting and selected checkpoints are compared explicitly: a retained checkpoint is not a new improvement."),mo.json(json.loads(_weather_status.read_text())) if _weather_status.exists() else mo.md("Curriculum has not started.")])
    return


if __name__ == "__main__":
    app.run()
