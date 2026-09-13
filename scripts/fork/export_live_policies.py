"""Export inference-only PPO MLP weights; verify identical deterministic actions."""
import hashlib
import json
from pathlib import Path

import numpy as np
from stable_baselines3 import PPO

ROOT = Path(__file__).resolve().parents[2]
FOLDERS = ['rl-corridor-v2', 'rl-hazards-v2', 'rl-weather',
           'streetlife-multiple-shelters/round-002', 'emergencies-v1/round-001']


def main():
    from live_server import NavigationPolicy
    results = []
    for folder in FOLDERS:
        checkpoint = ROOT/'artifacts/fork'/folder/'best.zip'
        policy = PPO.load(checkpoint, device='cpu')
        weights = policy.policy.state_dict()
        exported = {name: weights[key].cpu().numpy() for name, key in {
            'w0': 'mlp_extractor.policy_net.0.weight', 'b0': 'mlp_extractor.policy_net.0.bias',
            'w1': 'mlp_extractor.policy_net.2.weight', 'b1': 'mlp_extractor.policy_net.2.bias',
            'wa': 'action_net.weight', 'ba': 'action_net.bias',
        }.items()}
        exported['checkpoint_sha256'] = np.array(hashlib.sha256(checkpoint.read_bytes()).hexdigest())
        target = checkpoint.with_suffix('.npz')
        np.savez_compressed(target, **exported)
        lightweight = NavigationPolicy(target)
        observations = np.random.default_rng(17).uniform(-2, 2, (1024, policy.observation_space.shape[0])).astype(np.float32)
        expected, _ = policy.predict(observations, deterministic=True)
        actual = np.array([lightweight.predict(obs) for obs in observations])
        np.testing.assert_array_equal(expected, actual)
        results.append({'checkpoint': folder, 'observations': 1024, 'actionMismatches': 0,
                        'checkpointSha256': str(exported['checkpoint_sha256']), 'inferenceBytes': target.stat().st_size})
    path = ROOT/'artifacts/fork/live-demo/inference-parity.json'
    path.write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
