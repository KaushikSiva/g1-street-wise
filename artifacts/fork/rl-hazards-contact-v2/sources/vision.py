"""RGB + proprioception environment; actor truth never enters policy observations.

Segmentation is available only as a supervised training target. Training,
validation and test layouts use disjoint parking/occlusion arrangements.
"""
import os
import xml.etree.ElementTree as ET
import gymnasium as gym
from gymnasium import spaces
import mujoco
import numpy as np

from environment import ROOT
from g1_policy import G1Controller, gravity
from streetlife import streetlife_scene
from rain_shelter import RainShelter

SCHEMA = 'streetwise-rgb-proprio-v1'
HEIGHT, WIDTH = 64, 96
LAYOUTS = {
    0: (-3.10, -2.00, 2.35, .85),
    1: (-3.65, -2.35, 2.50, .75),
    2: (-3.30, 2.15, 2.00, .75),
    3: (-3.75, -2.20, 1.65, .80),  # validation only
    4: (-3.80, 2.35, 2.70, .70),   # test only
    5: (-2.70, -2.40, 1.50, .65),  # test only
}


def vision_scene():
    tree = ET.parse(streetlife_scene())
    world = tree.getroot().find('worldbody')
    pelvis = world.find("body[@name='pelvis']")
    ET.SubElement(pelvis, 'camera', name='robot_rgb', pos='.30 0 .50',
                  xyaxes='0 -1 0 0 0 1', fovy='100')
    for side in (-1, 1):
        for i in range(5):
            ET.SubElement(world, 'geom', name=f'vision_facade_{side}_{i}', type='box',
                          pos=f'{-6+i*4} {side*6.5} 2.5', size='1.7 1.5 2.5',
                          rgba='.65 .55 .4 1', contype='0', conaffinity='0')
    person = world.find("body[@name='pedestrian']")
    ET.SubElement(person, 'geom', name='vision_person_head', type='sphere', pos='0 0 .70',
                  size='.13', rgba='.5 .35 .25 1', contype='0', conaffinity='0')
    for side in (-1, 1):
        ET.SubElement(person, 'geom', name=f'vision_person_arm_{side}', type='capsule',
                      fromto=f'{side*.18} 0 .4 {side*.30} 0 -.15', size='.065',
                      rgba='.3 .4 .6 1', contype='0', conaffinity='0')
    target = ROOT/'.fork-runs/robot'/f'vision-{os.getpid()}.xml'
    tree.write(target)
    return target


def line_clear(origin, target, bounds):
    lo, hi = 0., 1.
    for axis in range(2):
        delta = target[axis]-origin[axis]
        minimum, maximum = bounds[axis]
        if abs(delta) < 1e-9:
            if not minimum <= origin[axis] <= maximum:
                return True
        else:
            a, b = sorted(((minimum-origin[axis])/delta, (maximum-origin[axis])/delta))
            lo, hi = max(lo, a), min(hi, b)
            if lo > hi:
                return True
    return False


class CameraStreet(gym.Env):
    metadata = {'render_modes': ['rgb_array']}

    def __init__(self, split='train', record=False):
        self.split = split
        self.base = RainShelter(record=record)
        self.base.robot = G1Controller(vision_scene())
        self.action_space = self.base.action_space
        self.observation_space = spaces.Dict({
            'image': spaces.Box(0, 255, (6, HEIGHT, WIDTH), dtype=np.uint8),
            'proprio': spaces.Box(-10, 10, (8,), dtype=np.float32),
        })
        self.renderer = mujoco.Renderer(self.base.robot.model, height=HEIGHT, width=WIDTH)
        self.previous = np.zeros((3, HEIGHT, WIDTH), dtype=np.uint8)
        self.rgb = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
        self.layout = 0
        self.van_bounds = [(-5.45, -.75), (-2.85, -1.15)]
        self.base.actor_visible = self._teacher_visible

    def _teacher_visible(self):
        b = self.base
        return bool(line_clear(b.robot.data.qpos[:2], [b.crossing, b.py], self.van_bounds)
                    and np.linalg.norm(b.robot.data.qpos[:2]-[b.crossing, b.py]) <= b.visibility_range)

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        seed = int(seed if seed is not None else self.np_random.integers(1, 9000))
        choices = {'train': [0, 1, 2], 'validation': [3], 'test': [4, 5]}[self.split]
        self.layout = choices[seed % len(choices)]
        model = self.base.robot.model
        van = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_GEOM, 'parked_van')
        x, y, hx, hy = LAYOUTS[self.layout]
        model.geom_pos[van, :2] = [x, y]
        model.geom_size[van, :2] = [hx, hy]
        self.van_bounds = [(x-hx, x+hx), (y-hy, y+hy)]
        rng = np.random.default_rng(seed+600000+self.layout*10000)
        for i in range(model.ngeom):
            name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_GEOM, i) or ''
            if name.startswith('vision_facade') or name in ('central_avenue_road', 'parked_van', 'pedestrian_body', 'moving_car_body'):
                model.geom_rgba[i, :3] = rng.uniform(.15, .75, 3)
            if name.startswith('vision_facade'):
                height = float(rng.uniform(1.7, 4.3))
                model.geom_size[i, 2] = height
                model.geom_pos[i, 2] = height
        model.light_diffuse[:] = rng.uniform(.45, .95)
        _, info = self.base.reset(seed=seed)
        # Car sweeps remain beyond the relocated van's front bumper.
        if self.base.kind == 1:
            self.base.crossing = max(self.base.crossing, x+hx+1.15)
            self.base.robot.data.mocap_pos[1]=[self.base.crossing,self.base.py,.75]
        self.teacher_observation = self.base._observe()
        mujoco.mj_forward(model, self.base.robot.data)
        image = self._pixels()
        self.previous = image.copy()
        return self._pack(image), {**info, 'layout': self.layout, 'observation_schema': SCHEMA}

    def _pixels(self):
        self.renderer.disable_segmentation_rendering()
        self.renderer.update_scene(self.base.robot.data, camera='robot_rgb')
        rgb = self.renderer.render().copy()
        # Rendered fog degrades pixels; it is not a condition-label input.
        if self.base.condition == 'fog':
            rgb = np.clip(.52*rgb+.48*np.array([184, 194, 196]), 0, 255).astype(np.uint8)
        if self.base.condition == 'rain':
            # Synthetic visible streaks, randomized over time; no numeric weather label.
            rgb=(rgb.astype(np.float32)*.8).astype(np.uint8)
            for k in range(22):
                xx=(k*37+int(self.base.t*9))%WIDTH; yy=(k*19+int(self.base.t*70))%HEIGHT
                rgb[yy:min(HEIGHT,yy+4),xx]=[180,195,205]
        self.rgb = rgb
        return np.ascontiguousarray(rgb.transpose(2, 0, 1))

    def _pack(self, image):
        d = self.base.robot.data
        proprio = np.array([d.qvel[5], np.sin(2*np.pi*self.base.t/.8), d.qpos[2], d.qvel[0], d.qvel[1],
                            *gravity(d.qpos[3:7])], dtype=np.float32)
        observation = {'image': np.concatenate([self.previous, image]),
                       'proprio': np.clip(proprio, -10, 10)}
        self.previous = image.copy()
        return observation

    def step(self, action):
        self.teacher_observation, reward, done, truncated, info = self.base.step(action)
        return self._pack(self._pixels()), reward, done, truncated, {
            **info, 'layout': self.layout, 'observation_schema': SCHEMA,
        }

    def perception_target(self):
        """Training-only presence/bounding-box target from renderer segmentation."""
        self.renderer.enable_segmentation_rendering()
        self.renderer.update_scene(self.base.robot.data, camera='robot_rgb')
        segments = self.renderer.render().copy()
        self.renderer.disable_segmentation_rendering()
        body_name = ['pedestrian', 'moving_car', 'pothole_zone'][self.base.kind]
        body = mujoco.mj_name2id(self.base.robot.model, mujoco.mjtObj.mjOBJ_BODY, body_name)
        ids = np.flatnonzero(self.base.robot.model.geom_bodyid == body)
        mask = np.isin(segments[:, :, 0], ids) & (segments[:, :, 1] == int(mujoco.mjtObj.mjOBJ_GEOM))
        ys, xs = np.nonzero(mask)
        if len(xs) < 3:
            return np.zeros(5, dtype=np.float32)
        return np.array([1., (xs.min()+xs.max())/(2*WIDTH), (ys.min()+ys.max())/(2*HEIGHT),
                         (xs.max()-xs.min()+1)/WIDTH, (ys.max()-ys.min()+1)/HEIGHT], dtype=np.float32)

    def close(self):
        self.renderer.close()
        self.base.close()
