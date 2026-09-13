"""Versioned emergency curriculum with simulator tracks, not camera recognition.

Adds non-graphic prone people and rigid rubble to the crowded weather task.
Unknown incidents contribute zero observation values until in tracking range
and clear of the parked van. Physical contacts and conservative footprint
clearance are checked separately. The official locomotion policy stays frozen.
"""
import os
import xml.etree.ElementTree as ET

import mujoco
import numpy as np
from gymnasium import spaces

from environment import ROOT, visible
from g1_policy import G1Controller
from hazards import COMMANDS as LEGACY_COMMANDS
from streetlife import CentralAvenueStreetlife, streetlife_scene

SCHEMA = 'streetwise-emergency-v1'
COMMANDS = [*LEGACY_COMMANDS, [0., .3, 0.], [0., -.3, 0.], [-.25, 0., 0.]]
KINDS = ['clear', 'fallen_person', 'hard_debris', 'accident_scene']


def emergency_scene():
    tree = ET.parse(streetlife_scene())
    world = tree.getroot().find('worldbody')
    person = ET.SubElement(world, 'body', name='emergency_person', mocap='true', pos='0 100 0')
    # A simple clothed, non-graphic prone silhouette. All pieces are collidable.
    ET.SubElement(person, 'geom', name='emergency_torso', type='capsule',
                  fromto='-.30 0 .23 .28 0 .23', size='.20', rgba='.24 .36 .50 1')
    ET.SubElement(person, 'geom', name='emergency_head', type='sphere',
                  pos='.66 0 .20', size='.16', rgba='.52 .34 .23 1')
    for side in (-1, 1):
        ET.SubElement(person, 'geom', name=f'emergency_leg_{side}', type='capsule',
                      fromto=f'-.28 {side*.11} .16 -.82 {side*.19} .12',
                      size='.09', rgba='.19 .21 .26 1')
        ET.SubElement(person, 'geom', name=f'emergency_arm_{side}', type='capsule',
                      fromto=f'.23 {side*.19} .18 -.20 {side*.28} .13',
                      size='.065', rgba='.24 .36 .50 1')
    debris = ET.SubElement(world, 'body', name='emergency_debris', mocap='true', pos='0 100 0')
    for i, (x, y, sx, sy, sz, yaw) in enumerate([
        (0., 0., .31, .23, .16, 0.), (.37, .18, .17, .17, .22, 20.),
        (-.39, -.18, .16, .18, .12, -15.), (.12, -.30, .19, .12, .09, 12.),
    ]):
        ET.SubElement(debris, 'geom', name=f'emergency_rubble_{i}', type='box',
                      pos=f'{x} {y} {sz}', size=f'{sx} {sy} {sz}',
                      euler=f'0 0 {yaw}', rgba='.47 .45 .40 1', friction='.9 .01 .001')
    target = ROOT/'.fork-runs/robot'/f'emergencies-{os.getpid()}.xml'
    tree.write(target)
    return target


def footprint_clearance(position, center, half_extents, yaw, margin=.30):
    delta = np.asarray(position) - center
    c, s = np.cos(yaw), np.sin(yaw)
    local = np.array([c*delta[0]+s*delta[1], -s*delta[0]+c*delta[1]])
    q = np.abs(local) - half_extents
    return float(np.linalg.norm(np.maximum(q, 0)) + min(float(max(q)), 0.) - margin)


class CentralAvenueEmergencies(CentralAvenueStreetlife):
    schema = SCHEMA

    def __init__(self, record=False):
        self.incidents = []
        self.emergency_kind = 'clear'
        self.stop_duration = 0.
        self.safe_stop = False
        self.foot_contact = False
        self.emergency_contact = False
        self.emergency_min_clearance = 100.
        super().__init__(record)
        self.robot = G1Controller(emergency_scene())
        self.action_space = spaces.Discrete(len(COMMANDS))
        self.observation_space = spaces.Box(-10, 10, (57,), dtype=np.float32)
        self._bind_geometry()

    def _bind_geometry(self):
        # Rebind after the native viewer replaces the controller with scenery.
        m = self.robot.model
        self._bound_model = m
        self._incident_mocaps = [int(m.body_mocapid[mujoco.mj_name2id(
            m, mujoco.mjtObj.mjOBJ_BODY, name)]) for name in ['emergency_person', 'emergency_debris']]
        self._incident_geoms = set()
        self._foot_geoms = set()
        for i in range(m.ngeom):
            body = int(m.geom_bodyid[i])
            name = mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_BODY, body) or ''
            if name in ['emergency_person', 'emergency_debris']:
                self._incident_geoms.add(i)
            if 'ankle' in name or 'foot' in name:
                self._foot_geoms.add(i)

    def reset(self, *, seed=None, options=None):
        self.incidents = []
        self.stop_duration = 0.
        self.safe_stop = self.foot_contact = self.emergency_contact = False
        self.emergency_min_clearance = 100.
        self.emergency_kind = 'clear'
        if self._bound_model is not self.robot.model:
            self._bind_geometry()
        _, info = super().reset(seed=seed, options=options)
        rng = np.random.default_rng(self.scenario_seed + 170000)
        self.emergency_kind = KINDS[(self.scenario_seed//9) % 4]
        onset = float(rng.uniform(0., 3.))
        x, y = float(rng.uniform(-.55, 1.1)), float(rng.uniform(-.5, .5))
        for slot in range(2):
            enabled = self.emergency_kind == 'accident_scene' or self.emergency_kind == KINDS[slot+1]
            self.incidents.append({
                'enabled': enabled, 'active': False, 'known': False, 'visible': False,
                'center': np.array([x + (.65 if slot else 0.), y + (-.7 if slot else .15)]),
                'half_extents': np.array([.95, .38] if slot == 0 else [.62, .48]),
                'yaw': float(rng.uniform(-.9, .9)), 'onset': onset + slot*.2,
                'age': 0., 'last_center': np.zeros(2),
            })
            self.robot.data.mocap_pos[self._incident_mocaps[slot]] = [0, 100, 0]
        self.frames = []
        self._update_incidents()
        mujoco.mj_forward(self.robot.model, self.robot.data)
        obs = self._observe()
        if self.record:
            self._frame(0)
        return obs, {**info, 'emergency': self.emergency_kind, 'schema': self.schema}

    def command_for_action(self, action):
        return COMMANDS[action]

    def _update_incidents(self):
        for slot, incident in enumerate(self.incidents):
            if not incident['enabled'] or self.t < incident['onset']:
                continue
            incident['active'] = True
            mid = self._incident_mocaps[slot]
            self.robot.data.mocap_pos[mid] = [*incident['center'], 0.]
            yaw = incident['yaw']
            self.robot.data.mocap_quat[mid] = [np.cos(yaw/2), 0, 0, np.sin(yaw/2)]

    def _check_emergency_contacts(self):
        for contact in self.robot.data.contact:
            a, b = int(contact.geom1), int(contact.geom2)
            if (a in self._incident_geoms and b in self._foot_geoms) or (b in self._incident_geoms and a in self._foot_geoms):
                self.foot_contact = True
                self.emergency_contact = self.contact = True

    def _observe(self):
        original = super()._observe()
        extra = []
        d = self.robot.data
        for slot in range(2):
            incident = self.incidents[slot] if slot < len(self.incidents) else None
            if incident is None:
                extra.extend([0.]*10)
                continue
            seen = bool(incident['active'] and visible(*d.qpos[:2], *incident['center'])
                        and np.linalg.norm(d.qpos[:2]-incident['center']) <= self.visibility_range)
            incident['visible'] = seen
            if seen:
                incident['known'] = True
                incident['last_center'] = incident['center'].copy()
                incident['age'] = 0.
            if not incident['known']:
                extra.extend([0.]*10)
                continue
            delta = (incident['last_center'] - d.qpos[:2])/4
            extra.extend([*delta, *(incident['half_extents']/2), np.sin(incident['yaw']),
                          np.cos(incident['yaw']), min(incident['age'], 4.)/4, float(seen),
                          1., float(self.emergency_kind == 'accident_scene')])
        if hasattr(self, '_incident_geoms'):
            self._check_emergency_contacts()
        return np.clip(np.concatenate([original, np.array(extra, dtype=np.float32)]), -10, 10).astype(np.float32)

    def _pedestrian_step(self):
        super()._pedestrian_step()
        self._update_incidents()
        dt = self.robot.model.opt.timestep
        nearest = 100.
        for incident in self.incidents:
            incident['age'] += dt
            if not incident['active']:
                continue
            clearance = footprint_clearance(self.robot.data.qpos[:2], incident['center'],
                                            incident['half_extents'], incident['yaw'])
            nearest = min(nearest, clearance)
            self.emergency_min_clearance = min(self.emergency_min_clearance, clearance)
            self.min_clearance = min(self.min_clearance, clearance)
            self.emergency_contact |= clearance <= 0
            self.contact |= clearance <= 0
        self._check_emergency_contacts()
        # A deliberate stop near an observed accident is an acceptable outcome.
        # Waiting far away, before onset, or at ordinary debris does not complete.
        observed = any(a['known'] for a in self.incidents)
        stopped = np.linalg.norm(self.robot.data.qvel[:2]) < .12
        if self.emergency_kind == 'accident_scene' and observed and .15 < nearest < 1.25 and stopped and not self.contact:
            self.stop_duration += dt
        else:
            self.stop_duration = 0.
        self.safe_stop = self.stop_duration >= 1.2

    def goal_reached(self):
        return bool(self.safe_stop or super().goal_reached())

    def extra_reward(self, old_position):
        reward = super().extra_reward(old_position)
        # Mild clearance shaping is based on observed static tracks only.
        for incident in self.incidents:
            if incident['known']:
                gap = footprint_clearance(self.robot.data.qpos[:2], incident['last_center'],
                                          incident['half_extents'], incident['yaw'])
                reward -= .12*max(0., .6-gap)
        if self.stop_duration > 0:
            reward += .12
        return reward

    def step(self, action):
        obs, reward, done, truncated, info = super().step(action)
        stopped = bool(info['success'] and self.safe_stop)
        return obs, reward, done, truncated, {
            **info, 'schema': self.schema, 'emergency': self.emergency_kind,
            'emergency_contact': bool(self.emergency_contact), 'foot_contact': bool(self.foot_contact),
            'emergency_min_clearance': float(self.emergency_min_clearance), 'safe_stop': stopped,
            'shelter_reached': bool(info['success'] and not stopped and self.seek_shelter),
            'outcome': 'safe_stop' if stopped else 'route_completed' if info['success'] else 'failed' if done or truncated else 'running',
        }

    def _frame(self, action):
        super()._frame(action)
        self.frames[-1]['emergencies'] = [
            {'kind': KINDS[i+1], 'position': [*a['center'].tolist(), 0.], 'yaw': a['yaw'],
             'active': a['active'], 'visible': a['visible']} for i, a in enumerate(self.incidents)]

    def episode_record(self):
        return {**super().episode_record(), 'schema': self.schema, 'emergency': self.emergency_kind,
                'emergencyScope': 'Simulator-provided, range/occlusion-limited tracks. No camera recognition. '
                'Rigid prone-human and rubble proxies; randomized onset; conservative body clearance and actual foot contacts. '
                'Accident scenes permit a 1.2-second safe stop; other encounters require destination completion.',
                'actions': COMMANDS}
