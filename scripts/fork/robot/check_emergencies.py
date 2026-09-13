"""Behavior checks for incident visibility, termination, contact and transfer."""
import json
import numpy as np
import mujoco
import torch
from stable_baselines3 import PPO
from gymnasium.utils.env_checker import check_env

from emergencies import CentralAvenueEmergencies, footprint_clearance
from environment import ROOT
from train import transfer_navigation


def main():
    env = CentralAvenueEmergencies()
    check_env(env, skip_render_check=True)
    first, _ = env.reset(seed=10)
    second, _ = env.reset(seed=10)
    np.testing.assert_array_equal(first, second)
    assert np.count_nonzero(second[37:]) == 0, 'Unseen future incidents leaked into observation'
    actor = env.incidents[0]
    actor.update(onset=0., yaw=0.)
    actor['center'] = env.robot.data.qpos[:2] + [2., 0.]
    env.visibility_range = .5
    env._update_incidents()
    assert np.count_nonzero(env._observe()[37:]) == 0, 'Out-of-range incident leaked'
    # Occluded by the known parked van, even within sensor range.
    actor['center'] = np.array([-3., -3.5])
    env.visibility_range = 10.
    assert np.count_nonzero(env._observe()[37:]) == 0, 'Van-occluded incident leaked'
    actor['center'] = env.robot.data.qpos[:2] + [2., 0.]
    assert env._observe()[45] == 1, 'Visible incident failed to create a track'
    tracked = actor['last_center'].copy()
    actor['center'] += [10., 0.]
    env.visibility_range = .5
    env._observe()
    np.testing.assert_array_equal(actor['last_center'], tracked)

    env.reset(seed=10)
    actor = env.incidents[0]
    actor.update(onset=0., yaw=0.)
    actor['center'] = env.robot.data.qpos[:2].copy()
    _, _, done, _, info = env.step(0)
    assert done and info['emergency_contact'] and not info['success'], info

    # Exercise actual MuJoCo foot/rubble contact, independently of the envelope.
    env.reset(seed=19)
    foot = next(i for i in sorted(env._foot_geoms) if env.robot.model.geom_contype[i] and env.robot.model.geom_type[i] == mujoco.mjtGeom.mjGEOM_SPHERE)
    pos = env.robot.data.geom_xpos[foot].copy()
    mid = env._incident_mocaps[1]
    env.robot.data.mocap_pos[mid] = [pos[0], pos[1], pos[2]-.16]
    mujoco.mj_forward(env.robot.model, env.robot.data)
    env._check_emergency_contacts()
    assert env.foot_contact and env.contact, 'Actual foot/rubble contact was not reported'

    env.reset(seed=28)
    # Waiting before a hazard appears cannot earn a successful stop.
    for _ in range(610):
        env._pedestrian_step()
    assert not env.safe_stop
    actor = env.incidents[0]
    actor.update(onset=0., yaw=0.)
    actor['center'] = env.robot.data.qpos[:2] + [1.5, 0.]
    env.incidents[1]['enabled'] = False
    env.robot.data.qvel[:2] = 0.
    env._update_incidents()
    env._observe()
    for _ in range(610):
        env._pedestrian_step()
    assert env.safe_stop and env.goal_reached() and not env.contact

    # Rotated footprint distance is rotation invariant.
    assert abs(footprint_clearance([2., 0.], [0., 0.], [.95, .38], 0.) -
               footprint_clearance([0., 2.], [0., 0.], [.95, .38], np.pi/2)) < 1e-10
    checkpoint = ROOT/'artifacts/fork/streetlife-multiple-shelters/round-001/best.zip'
    source = PPO.load(checkpoint, device='cpu')
    target = PPO('MlpPolicy', env, policy_kwargs={'net_arch': {'pi': [64, 64], 'vf': [64, 64]}}, device='cpu')
    transfer_navigation(source, target)
    old = source.policy.state_dict()
    new = target.policy.state_dict()
    for key in ['action_net.weight', 'action_net.bias']:
        torch.testing.assert_close(new[key][:old[key].shape[0]], old[key])
    for key in ['mlp_extractor.policy_net.0.weight', 'mlp_extractor.value_net.0.weight']:
        torch.testing.assert_close(new[key][:, :37], old[key])
        assert torch.count_nonzero(new[key][:, 37:]) == 0
    report = {'schema': env.schema, 'gymnasium': 'passed', 'deterministic_reset': True,
              'no_unseen_incident_leakage': True, 'range_and_occlusion_gating': True,
              'retained_last_seen_track': True, 'clearance_terminates_failure': True,
              'actual_mujoco_foot_contact_detected': True, 'safe_stop_requires_observed_nearby_accident': True,
              'rotated_footprint': True, 'legacy_checkpoint_transfer': True,
              'observation_size': 57, 'actions': 8}
    path = ROOT/'artifacts/fork/emergencies-v1/behavior-checks.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
