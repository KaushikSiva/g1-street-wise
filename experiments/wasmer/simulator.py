"""Trusted adapter applies validated data to existing MuJoCo car physics."""
import hashlib
import os
from pathlib import Path
import sys

from contract import validate_batch

ROOT = Path(__file__).resolve().parents[2]


def evaluate(batch):
    validate_batch(batch)
    # Separate process CLI; use the same exported gait as the public demo.
    os.environ['STREETWISE_NUMPY_GAIT'] = '1'
    os.environ['STREETWISE_COMPILED_SCENES'] = '1'
    sys.path.insert(0, str(ROOT / 'scripts/fork/robot'))
    sys.path.insert(0, str(ROOT / 'scripts/fork'))
    import mujoco
    from hazards import CarCrossing
    from live_server import NavigationPolicy

    checkpoint = ROOT / 'artifacts/fork/rl-hazards-contact-v2/best.zip'
    actor = checkpoint.with_suffix('.npz')
    policy = NavigationPolicy(actor)
    digest = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
    if str(policy.weights['checkpoint_sha256']) != digest:
        raise ValueError('Navigation export does not match its checkpoint')
    env = CarCrossing(record=False)
    env.enforce_physical_contacts = True
    results = []
    for scenario in batch['scenarios']:
        result = {'scenario': scenario}
        for label in ('before', 'after'):
            env.reset(seed=scenario['seed'])
            env.speed = env.pv = env.last_v = scenario['car_speed']
            env.start = env.py = env.last_y = scenario['car_start_y']
            env.crossing = scenario['crossing_x']
            env.age = 0.0
            env.robot.data.mocap_pos[1] = [env.crossing, env.py, .75]
            mujoco.mj_forward(env.robot.model, env.robot.data)
            obs = env._observe()
            result[label + '_initial'] = {
                'car_position': env.robot.data.mocap_pos[1].tolist(),
                'car_speed': env.speed, 'robot_qpos': env.robot.data.qpos.tolist(),
                'observation': obs.tolist()}
            for _ in range(61):
                obs, _, done, timeout, info = env.step(2 if label == 'before' else policy.predict(obs))
                if done or timeout:
                    result[label] = {**info, 'timeout': bool(timeout)}
                    break
            else:
                raise RuntimeError('Episode exceeded the 12-second simulation horizon')
        results.append(result)
    return {'physics': 'MuJoCo', 'scoring': 'physical-contact-v2', 'gait_backend': 'numpy',
            'checkpoint': str(checkpoint.relative_to(ROOT)), 'checkpoint_sha256': digest,
            'actor_sha256': hashlib.sha256(actor.read_bytes()).hexdigest(), 'results': results}
