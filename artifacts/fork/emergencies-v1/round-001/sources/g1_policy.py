"""Official Unitree G1 12-DoF LSTM controller in MuJoCo.

Observation ordering, gains and phase follow unitree_rl_gym deploy_mujoco.py.
The supplied base policy is frozen; FORK trains the navigation layer above it.
"""
from pathlib import Path
import numpy as np
import mujoco
import torch
import yaml

ROOT = Path(__file__).resolve().parents[3]
UPSTREAM = ROOT / 'vendor/unitree_rl_gym'
CONFIG = yaml.safe_load((UPSTREAM / 'deploy/deploy_mujoco/configs/g1.yaml').read_text())
torch.set_num_threads(1)


def gravity(quat):
    w, x, y, z = quat
    return np.array([2*(-z*x+w*y), -2*(z*y+w*x), 1-2*(w*w+z*z)])


class G1Controller:
    def __init__(self, xml=None):
        self.model = mujoco.MjModel.from_xml_path(str(xml or UPSTREAM / 'resources/robots/g1_description/scene.xml'))
        self.data = mujoco.MjData(self.model)
        self.model.opt.timestep = CONFIG['simulation_dt']
        self.policy = torch.jit.load(str(UPSTREAM / 'deploy/pre_train/g1/motion.pt'), map_location='cpu').eval()
        self.kp = np.array(CONFIG['kps'])
        self.kd = np.array(CONFIG['kds'])
        self.default = np.array(CONFIG['default_angles'])
        self.reset()

    def reset(self, x=0, y=0):
        mujoco.mj_resetData(self.model, self.data)
        self.data.qpos[:2] = [x, y]
        self.data.qpos[7:19] = self.default
        self.policy.reset_memory()
        self.action = np.zeros(12, dtype=np.float32)
        self.target = self.default.copy()
        self.counter = 0
        mujoco.mj_forward(self.model, self.data)

    def update_target(self, command):
        phase = (self.counter * self.model.opt.timestep % .8) / .8
        obs = np.concatenate([
            self.data.qvel[3:6] * CONFIG['ang_vel_scale'], gravity(self.data.qpos[3:7]),
            np.array(command)*CONFIG['cmd_scale'],
            (self.data.qpos[7:19]-self.default)*CONFIG['dof_pos_scale'],
            self.data.qvel[6:18]*CONFIG['dof_vel_scale'], self.action,
            [np.sin(2*np.pi*phase), np.cos(2*np.pi*phase)],
        ]).astype(np.float32)
        with torch.inference_mode():
            self.action = self.policy(torch.from_numpy(obs).unsqueeze(0)).numpy().reshape(12).copy()
        self.target = self.action*CONFIG['action_scale']+self.default

    def step(self, command, steps=10, before_step=None):
        for _ in range(steps):
            if before_step:
                before_step()
            self.data.ctrl[:] = (self.target-self.data.qpos[7:19])*self.kp-self.data.qvel[6:18]*self.kd
            mujoco.mj_step(self.model, self.data)
            self.counter += 1
            if self.counter % CONFIG['control_decimation'] == 0:
                self.update_target(command)
        return self.data.qpos.copy()


if __name__ == '__main__':
    import time, json
    sim = G1Controller()
    start = time.perf_counter()
    frames = []
    for k in range(500):
        sim.step([.5 if k>=50 else 0, 0, 0])
        if k%5==0:
            frames.append({'t': float(sim.data.time), 'qpos': sim.data.qpos.tolist()})
    outcome = {'seconds': float(sim.data.time), 'distance': float(sim.data.qpos[0]),
               'height': float(sim.data.qpos[2]), 'wall_seconds': time.perf_counter()-start,
               'policy': 'Official Unitree G1 motion.pt, frozen', 'frames': frames}
    (ROOT/'artifacts/fork/g1-policy-smoke.json').write_text(json.dumps(outcome))
    print({k:v for k,v in outcome.items() if k!='frames'})
    assert .5 < sim.data.qpos[2] < 1.1, 'G1 fell in the base-policy smoke test'
    assert sim.data.qpos[0] > 2, 'G1 did not walk forward'
