import marimo

__generated_with = '0.24.2'
app = marimo.App(width='full', app_title='STREETWISE / Experiment lab')


@app.cell
def _():
    import json
    from pathlib import Path
    import subprocess
    import marimo as mo
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle
    root = Path(__file__).resolve().parents[1]
    return Rectangle, json, mo, plt, root, subprocess


@app.cell
def _(mo):
    mo.md('''
    # STREETWISE / Learn before the next move.
    **Chennai · action-conditioned world model lab**

    Inspect what the model imagined, what the simulator did, and whether learning
    helped on unseen scenarios. These are real outputs from STREETWISE's TypeScript model,
    using synthetic kinematics—not physical robot trials.

    [Open the 3D encounter ↗](http://127.0.0.1:5189/?fork=1)
    ''')
    return


@app.cell
def _(mo):
    rebuild = mo.ui.run_button(label='Re-run deterministic training & evaluation')
    mo.vstack([rebuild, mo.md('Rebuild uses the same CPU training code as the browser. No API key or GPU required.')])
    return (rebuild,)


@app.cell
def _(json, rebuild, root, subprocess):
    lab_path = root / 'artifacts/fork/lab-data.json'
    if rebuild.value or not lab_path.exists():
        subprocess.run(['node', '--experimental-strip-types', 'scripts/fork/export-lab.ts'],
                       cwd=root, check=True, capture_output=True, text=True, timeout=60)
    data = json.loads(lab_path.read_text())
    return (data,)


@app.cell
def _(data, mo):
    _first = data['initial']['learned']
    _last = data['updated']['learned']
    _base = data['updated']['baseline']
    _improvement = 100 * (1 - _last['forecastRMSE'] / _first['forecastRMSE'])
    mo.vstack([
        mo.md(f'## {_improvement:.1f}% lower held-out forecast error after learning'),
        mo.ui.table([
            {'Predictor': _name, 'Position RMSE (m)': round(_m['forecastRMSE'], 4),
             'Contacts / 64': _m['contacts'], 'Completed / 64': _m['completion'],
             'Mean progress (m)': round(_m['meanProgress'], 3)}
            for _name, _m in [('Initial · 12 scenarios', _first), ('Updated · 180 scenarios', _last), ('Constant velocity', _base)]
        ], selection=None),
        mo.md('**Promotion:** ' + data['promotion']['reason'] +
              f" Validation error: {data['promotion']['before']['forecastRMSE']:.3f} → {data['promotion']['after']['forecastRMSE']:.3f} m. "
              'The 64 test seeds are excluded from fitting and promotion.'),
    ])
    return


@app.cell
def _(data, mo):
    seed_picker = mo.ui.dropdown(options=[str(c['seed']) for c in data['cases']], value=str(data['cases'][0]['seed']), label='Held-out scenario')
    action_picker = mo.ui.dropdown(options={'Continue': 'continue', 'Slow & look': 'peek', 'Wait, then go': 'wait'}, value='Continue', label='Proposed action')
    predictor_picker = mo.ui.dropdown(options={'Updated model': 'updated', 'Initial model': 'initial', 'Constant velocity': 'baseline'}, value='Updated model', label='Predictor')
    horizon = mo.ui.slider(start=0.05, stop=6, step=0.05, value=6, label='Horizon (seconds)', show_value=True)
    mo.vstack([mo.md('## Inspect a possible future'), mo.hstack([seed_picker, action_picker, predictor_picker]), horizon])
    return action_picker, horizon, predictor_picker, seed_picker


@app.cell
def _(Rectangle, action_picker, data, horizon, mo, plt, predictor_picker, seed_picker):
    case = next(c for c in data['cases'] if str(c['seed']) == seed_picker.value)
    actual = next(e for e in case['actual'] if e['action'] == action_picker.value)
    predicted = next(f for f in case['forecasts'][predictor_picker.value]['branches'] if f['action'] == action_picker.value)
    count = min(121, round(horizon.value / 0.05) + 1)
    states, points = actual['states'][:count], predicted['points'][:count]
    fig, axes = plt.subplots(1, 2, figsize=(13, 4.6), layout='constrained')
    fig.set_facecolor('#f2f0e7')
    for _ax in axes:
        _ax.set_facecolor('#f2f0e7')
        _ax.spines[['top', 'right']].set_visible(False)
    _van = data['van']
    axes[0].add_patch(Rectangle((_van['nMin'], _van['sMin']), _van['nMax']-_van['nMin'], _van['sMax']-_van['sMin'], color='#bdb8a7', label='Synthetic van'))
    for _nk, _sk, _offset, _color, _label in [('rn', 'rs', 0, '#247369', 'Robot'), ('pn', 'ps', 2, '#ba7828', 'Pedestrian')]:
        axes[0].plot([s[_nk] for s in states], [s[_sk] for s in states], color=_color, label=_label+' actual')
        axes[0].plot([p[_offset] for p in points], [p[_offset+1] for p in points], '--', color=_color, label=_label+' predicted')
        axes[0].scatter(states[-1][_nk], states[-1][_sk], color=_color, s=35)
    axes[0].set(xlabel='Lateral position (m)', ylabel='Along-road position (m)', title='Predicted vs actual trajectory', xlim=(-5, 6), ylim=(-6.5, 5))
    axes[0].set_aspect('equal')
    axes[0].legend(fontsize=8, loc='upper left')
    errors = [((p[2]-s['pn'])**2+(p[3]-s['ps'])**2)**0.5 for p, s in zip(points, states)]
    axes[1].plot([s['t'] for s in states], errors, color='#247369', label='Pedestrian position error')
    axes[1].plot([s['t'] for s in states], predicted['spread'][:count], '--', color='#ba7828', label='Ensemble spread (heuristic)')
    axes[1].set(xlabel='Time (s)', ylabel='Distance (m)', title='Where imagination misses', xlim=(0,6), ylim=(0, max(.6, max(errors)*1.1)))
    axes[1].legend(fontsize=8)
    chosen = case['forecasts'][predictor_picker.value]['chosen']
    plt.close(fig)
    mo.vstack([mo.md(f"**Scenario {case['seed']} · {action_picker.value} · {predictor_picker.value} · {horizon.value:.2f} s**  \n"
                     f"Predictor selected **{chosen}**. Actual minimum clearance: **{actual['minClearance']:.2f} m**. "
                     f"Contact: **{'yes' if actual['contact'] else 'no'}**. End-of-window pedestrian error: **{errors[-1]:.3f} m**."), fig])
    return


@app.cell
def _(data, mo, plt):
    coverage_fig, coverage_ax = plt.subplots(figsize=(10, 3), layout='constrained')
    coverage_fig.set_facecolor('#f2f0e7')
    coverage_ax.set_facecolor('#f2f0e7')
    coverage_ax.scatter([s['speed'] for s in data['training']], [s['hesitation'] for s in data['training']], s=18, color='#aabcb4', label='Expanded training')
    coverage_ax.scatter([s['speed'] for s in data['training'][:12]], [s['hesitation'] for s in data['training'][:12]], s=35, color='#247369', label='Initial training')
    coverage_ax.set(xlabel='Crossing speed (m/s)', ylabel='Hidden hesitation (s)', title='Training coverage')
    coverage_ax.spines[['top','right']].set_visible(False)
    coverage_ax.legend()
    plt.close(coverage_fig)
    mo.vstack([mo.md('## Data boundaries'), coverage_fig, mo.ui.table([
        {'Partition': name, 'Scenarios': len(seeds), 'First seed': min(seeds), 'Last seed': max(seeds)}
        for name, seeds in data['partitions'].items()
    ], selection=None), mo.md('Initial training is a subset of expanded training. Validation and test are separate from both. Hidden hesitation is used only by the simulator and to label training coverage; it is absent from predictor inputs.')])
    return


@app.cell
def _(mo):
    refresh = mo.ui.run_button(label='Refresh latest browser experiment')
    mo.vstack([mo.md('## Your latest browser run'), refresh])
    return (refresh,)


@app.cell
def _(json, mo, refresh, root):
    refresh.value
    _latest = root / '.fork-runs/latest.json'
    if _latest.exists():
        _report = json.loads(_latest.read_text())
        _trace = _report.get('telemetry', {}).get('url')
        _text = f"Saved {_report.get('savedAt', '')}. Model v{_report['model']['version']}; {len(_report['runs'])} completed encounters."
        if _trace:
            _text += f' [Open Weave trace ↗]({_trace})'
        _rows = [{'Action': e['action'], 'Speed (m/s)': e['scenario']['speed'], 'Contact': e['contact'], 'Clearance (m)': round(e['minClearance'],3)} for e in _report['runs']]
        mo.output.replace(mo.vstack([mo.md(_text), mo.ui.table(_rows, selection=None) if _rows else mo.md('No completed encounters yet.')]))
    else:
        mo.output.replace(mo.md('Run an encounter in STREETWISE with the local experiment service running, then refresh. The reproducible comparison above works independently.'))
    return


@app.cell
def _(mo):
    mo.md('''
    **Interpretation limits.** This ensemble fits future 2D actor positions using
    fixed random features and learned ridge-regression weights. It is an
    action-conditioned dynamics model, not a pretrained generative video model.
    The baseline knows the exact robot command schedule and extrapolates the
    pedestrian at constant velocity from the same last-seen track. Contacts use
    a 0.65 m combined actor radius, sampled every 50 ms. Completion means passing
    the crossing by 1 m without contact within six seconds. Map footprints come
    from OpenStreetMap; scene dimensions and facade details are inferred.

    Model improvement in this simulator does not establish real-world robot safety.
    ''')
    return



@app.cell
def _(json, mo, plt, root):
    _rl = json.loads((root / 'artifacts/fork/rl-corridor-v2/evaluation.json').read_text())
    _figure, _axes = plt.subplots(1, 2, figsize=(12, 3.8), layout='constrained')
    _figure.set_facecolor('#f2f0e7')
    for _ax in _axes:
        _ax.set_facecolor('#f2f0e7')
        _ax.spines[['top','right']].set_visible(False)
    _history = _rl['history']
    _axes[0].plot([r['step'] for r in _history], [100*r['validation/success_rate'] for r in _history], color='#285a47', linewidth=2)
    _axes[0].set(xlabel='PPO steps', ylabel='Validation success (%)', ylim=(0,105), title='Actual PPO training curve · W&B run 8upngyv4')
    _axes[1].bar(['Constant speed', 'Trained PPO'], [100*_rl['baseline']['success_rate'],100*_rl['trained']['success_rate']],color=['#ba7828','#285a47'])
    _axes[1].set(ylabel='Held-out completion (%)', ylim=(0,110), title='64 unseen MuJoCo encounters')
    plt.close(_figure)
    mo.vstack([mo.md('## Physical robot navigation · measured before and after'),_figure,mo.md('**42 → 64 completed; 22 → 0 clearance violations; zero falls.** The official Unitree gait stays frozen. PPO learns navigation speed selection. These are recorded MuJoCo outcomes, not physical robot trials. [Inspect W&B](https://wandb.ai/kaushik-siva88/Unitree%20G1/runs/8upngyv4) · [Open robot replay](http://127.0.0.1:5189/?robot=1)')])
    return


if __name__ == '__main__':
    app.run()
