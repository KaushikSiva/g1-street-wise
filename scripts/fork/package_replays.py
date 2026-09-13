"""Create compact browser replays; retain exact source data in artifacts."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def compact(value):
    if isinstance(value,float):return round(value,6)
    if isinstance(value,list):return [compact(v) for v in value]
    if isinstance(value,dict):return {k:compact(v) for k,v in value.items()}
    return value
for name,folder in [('robot-experiment','rl-corridor-v2'),('hazard-experiment','rl-hazards-v2'),('weather-experiment','rl-weather')]:
    source=ROOT/'artifacts/fork'/folder
    if not (source/'evaluation.json').exists():continue
    payload={'evaluation':json.loads((source/'evaluation.json').read_text()),'replays':compact(json.loads((source/'replays.json').read_text()))}
    path=ROOT/'public/assets/fork'/f'{name}.json';path.write_text(json.dumps(payload,separators=(',',':')))
    print(name,round(path.stat().st_size/1e6,2),'MB')
