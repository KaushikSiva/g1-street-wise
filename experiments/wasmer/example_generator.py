"""Bundled example, not LLM output. This file runs ONLY inside Wasmer."""
import json
import random

request = json.load(open('/workspace/request.json'))
rng = random.Random(request['seed'])
# Focus on faster traffic after a collision in the supplied training feedback.
failures = sum(row['after']['contact'] for row in request.get('feedback', []))
scenarios = []
for seed in rng.sample(range(1, 9000), request['count']):
    scenarios.append({
        'seed': seed,
        'car_speed': round(rng.uniform(2.5 if failures else 1.5, 3.5), 4),
        'car_start_y': round(rng.uniform(-13, -8), 4),
        'crossing_x': round(rng.uniform(.4, 1.2), 4),
    })
print(json.dumps({'version': 1, 'scenarios': scenarios}))
