"""Central Avenue crossing task: PPO navigation above frozen Unitree locomotion.

MuJoCo runs all G1 joints and contacts. The pedestrian is a synthetic mocap actor.
Coordinates: x = along Central Avenue; y = left across the road; z = up.
"""
import json
import os
from pathlib import Path
import xml.etree.ElementTree as ET
import numpy as np
import mujoco
import gymnasium as gym
from gymnasium import spaces
from g1_policy import G1Controller, ROOT, UPSTREAM, gravity

ACTION_SPEEDS = [0.0, 0.35, 0.7]
HORIZON = 12.0
CONTROL_DT = .2
VAN = {'xmin': -5.45, 'xmax': -.75, 'ymin': -2.85, 'ymax': -1.15}


def make_scene():
    folder = ROOT / '.fork-runs/robot'
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f'central-avenue-g1-{os.getpid()}.xml'
    source = UPSTREAM / 'resources/robots/g1_description'
    tree = ET.parse(source / 'g1_12dof.xml')
    root = tree.getroot()
    root.find('compiler').set('meshdir', str(source / 'meshes'))
    ET.SubElement(root, 'option', timestep='.002', gravity='0 0 -9.81')
    world = root.find('worldbody')
    ET.SubElement(world, 'geom', name='central_avenue_road', type='plane', size='25 3 .1', rgba='.24 .23 .21 1', friction='1 .005 .0001')
    ET.SubElement(world, 'geom', name='parked_van', type='box', pos='-3.1 -2 1.075', size='2.35 .85 1.075', rgba='.85 .84 .79 1')
    # Inferred frontage boundaries agree with the map's 5.5 m road width.
    for side in (-1, 1):
        ET.SubElement(world, 'geom', name=f'frontage_{side}', type='box', pos=f'0 {side*4.2} 1.5', size='20 .2 1.5', rgba='.6 .55 .45 1')
    pedestrian = ET.SubElement(world, 'body', name='pedestrian', mocap='true', pos='0 -3 .85')
    ET.SubElement(pedestrian, 'geom', name='pedestrian_body', type='capsule', size='.22 .6', rgba='.6 .3 .12 1')
    ET.SubElement(world, 'light', pos='0 0 8', dir='0 0 -1', directional='true')
    temporary=target.with_suffix('.tmp')
    tree.write(temporary)
    temporary.replace(target)
    return target


def visible(rx, ry, px, py):
    lo, hi = 0., 1.
    for origin, delta, minimum, maximum in ((rx, px-rx, VAN['xmin'], VAN['xmax']), (ry, py-ry, VAN['ymin'], VAN['ymax'])):
        if abs(delta) < 1e-9:
            if origin < minimum or origin > maximum:
                return True
        else:
            a, b = sorted(((minimum-origin)/delta, (maximum-origin)/delta))
            lo, hi = max(lo, a), min(hi, b)
            if lo > hi:
                return True
    return False


class CentralAvenueG1(gym.Env):
    scene_factory = staticmethod(make_scene)
    metadata = {'render_modes': []}
    horizon = HORIZON
    enforce_physical_contacts = False  # Preserve the original benchmark definition.

    def __init__(self, record=False):
        self.robot = G1Controller(self.scene_factory())
        self.action_space = spaces.Discrete(3)
        self.observation_space = spaces.Box(-10, 10, (10,), dtype=np.float32)
        self.record = record
        self.episode_index = 0
        self.frame_callback = None

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self.episode_index += 1
        self.scenario_seed = int(seed if seed is not None else self.np_random.integers(1, 9000))
        rng = np.random.default_rng(self.scenario_seed)
        self.speed = float(rng.uniform(.38, .82))
        self.crossing = float(rng.uniform(-.35, .35))
        self.hesitation = float(rng.uniform(0, .9))
        self.start = float(rng.uniform(-2.8, -2.3))
        self.robot.reset(-3, 0)
        # Let the supplied controller establish a stable standing gait.
        self.robot.data.mocap_pos[0] = [self.crossing, self.start, .85]
        for _ in range(50):
            self.robot.step([0, 0, 0])
        self.t = 0.
        self.py = self.start
        self.pv = self.speed
        self.paused = False
        self.pause_remaining = 0.
        self.last_y = self.start-self.speed*.8
        self.last_v = self.speed
        self.age = .8
        self.return_sum = 0.
        self.min_clearance = 100.
        self.contact = False
        self.physical_contact = False
        self.collision_geometry = None
        self.first_violation_time = None
        self._contact_model = None
        self.fall = False
        self.frames = []
        self.decisions = []
        self._observe()
        if self.record:
            self._frame(0)
        return self._observe(), {'scenario_seed': self.scenario_seed}

    def actor_visible(self):
        d = self.robot.data
        return visible(d.qpos[0], d.qpos[1], self.crossing, self.py)

    def _observe(self):
        d = self.robot.data
        seen = self.actor_visible()
        if seen:
            self.last_y, self.last_v, self.age = self.py, self.pv, 0.
        estimated_y = self.last_y+self.last_v*self.age
        return np.clip(np.array([
            d.qpos[0]/4, d.qpos[1]/3, d.qvel[0], self.crossing/2,
            estimated_y/4, self.last_v, min(self.age, 4)/4,
            float(seen), self.t/self.horizon, d.qpos[2],
        ], dtype=np.float32), -10, 10)

    def _pedestrian_step(self):
        dt = self.robot.model.opt.timestep
        d = self.robot.data
        if not self.paused and self.py >= -.9 and d.qpos[0] < self.crossing and d.qvel[0] > .3:
            self.paused = True
            self.pause_remaining = self.hesitation
        target = 0. if self.pause_remaining > 0 else self.speed
        self.pause_remaining = max(0, self.pause_remaining-dt)
        self.pv += float(np.clip(target-self.pv, -3*dt, 3*dt))
        self.py += self.pv*dt
        d.mocap_pos[0] = [self.crossing, self.py, .85]
        clearance = float(np.hypot(d.qpos[0]-self.crossing, d.qpos[1]-self.py)-.55)
        self.min_clearance = min(self.min_clearance, clearance)
        self.contact |= clearance <= 0

    def _frame(self, action):
        d = self.robot.data
        self.frames.append({'t': round(self.t, 4), 'qpos': d.qpos[:19].tolist(),
            'pedestrian': [self.crossing, self.py, .85], 'action': int(action),
            'visible': self.actor_visible(),
            'clearance': float(np.hypot(d.qpos[0]-self.crossing,d.qpos[1]-self.py)-.55)})

    def command_for_action(self, action):
        return [ACTION_SPEEDS[action], 0, 0]

    def _physical_contact_step(self):
        model, data = self.robot.model, self.robot.data
        if self._contact_model is not model:
            pelvis = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, 'pelvis')
            bodies = {pelvis}
            for body in range(pelvis+1, model.nbody):
                if int(model.body_parentid[body]) in bodies:
                    bodies.add(body)
            self._robot_geoms = {i for i in range(model.ngeom) if int(model.geom_bodyid[i]) in bodies}
            self._obstacle_geoms = {i for i in range(model.ngeom) if i not in self._robot_geoms
                and (mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_GEOM, i) or '') != 'central_avenue_road'}
            self._contact_model = model
        for contact in data.contact:
            a, b = int(contact.geom1), int(contact.geom2)
            other = b if a in self._robot_geoms else a if b in self._robot_geoms else -1
            if contact.dist <= 0 and other in self._obstacle_geoms:
                self.physical_contact = self.contact = True
                if self.collision_geometry is None:
                    self.collision_geometry = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_GEOM, other)
        if self.contact and self.first_violation_time is None:
            self.first_violation_time = round(self.t + (self.robot.counter % 10+1)*model.opt.timestep, 4)

    def goal_reached(self):
        return self.robot.data.qpos[0] > self.crossing+1

    def extra_reward(self, old_position):
        return 0.

    def step(self, action):
        action = int(action)
        old_x = float(self.robot.data.qpos[0])
        old_position = self.robot.data.qpos[:2].copy()
        command=self.command_for_action(action)
        self.decisions.append({'t': round(self.t, 3), 'action': action, 'speed': command[0], 'command': command})
        for _ in range(10):
            self.robot.step(command, before_step=self._pedestrian_step,
                            after_step=self._physical_contact_step if self.enforce_physical_contacts else None)
            self.t += .02
            self.age += .02
            self._observe()
            if self.frame_callback:self.frame_callback(self)
            if self.record:
                self._frame(action)
        d = self.robot.data
        self.fall = bool(d.qpos[2] < .48 or gravity(d.qpos[3:7])[2] > -.4)
        offroad = abs(d.qpos[1]) > 2.5
        success = bool(self.goal_reached() and not self.contact and not self.fall and not offroad)
        terminated = bool(self.contact or self.fall or offroad or success)
        truncated = bool(self.t >= self.horizon-1e-6 and not terminated)
        reward = 2*(float(d.qpos[0])-old_x)-.04+self.extra_reward(old_position)
        if self.contact or self.fall or offroad:
            reward -= 20
        elif success:
            reward += 12
        elif truncated:
            reward -= 4
        self.return_sum += reward
        info = {'scenario_seed': self.scenario_seed, 'contact': bool(self.contact),
                'fall': self.fall, 'success': success, 'min_clearance': self.min_clearance,
                'progress': float(d.qpos[0]+3), 'return': self.return_sum, 'elapsed': self.t}
        if self.enforce_physical_contacts:
            info.update(physical_contact=self.physical_contact, collision_geometry=self.collision_geometry,
                        first_violation_time=self.first_violation_time, scoring='physical-contact-v2')
        return self._observe(), reward, terminated, truncated, info

    def episode_record(self):
        return {'seed': self.scenario_seed, 'scenario': {'speed': self.speed, 'crossing': self.crossing,
                 'hesitation': self.hesitation, 'start': self.start},
                'frames': self.frames, 'decisions': self.decisions,
                'physics': 'MuJoCo + official frozen Unitree G1 12-DoF LSTM locomotion'}


if __name__ == '__main__':
    from gymnasium.utils.env_checker import check_env
    env = CentralAvenueG1(record=True)
    check_env(env, skip_render_check=True)
    outcomes = []
    for seed in range(10001, 10017):
        env.reset(seed=seed)
        while True:
            _, _, done, timeout, info = env.step(2)
            if done or timeout:
                outcomes.append(info)
                break
    print(json.dumps({'baseline_contacts': sum(x['contact'] for x in outcomes),
                      'baseline_successes': sum(x['success'] for x in outcomes), 'episodes': len(outcomes)}))
    (ROOT/'artifacts/fork/g1-baseline-smoke.json').write_text(json.dumps({'outcomes': outcomes,'last':env.episode_record()}))
