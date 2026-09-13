"""Expanded navigation curriculum: pedestrian, moving car, pothole keep-out zone.

The car is a kinematic MuJoCo body. The pothole is a detected road-defect keep-out
zone, not a deformed terrain or a learned ability to step through a physical pit.
"""
import os
import xml.etree.ElementTree as ET
import numpy as np
from gymnasium import spaces
from environment import CentralAvenueG1, make_scene, ROOT, visible
from g1_policy import G1Controller

COMMANDS=[[0,0,0],[.35,0,0],[.7,0,0],[.35,.3,0],[.35,-.3,0]]
KINDS=['pedestrian','moving_car','pothole_zone']


def hazard_scene():
    tree=ET.parse(make_scene())
    world=tree.getroot().find('worldbody')
    car=ET.SubElement(world,'body',name='moving_car',mocap='true',pos='0 100 .75')
    ET.SubElement(car,'geom',name='moving_car_body',type='box',size='.85 2.05 .72',rgba='.25 .33 .38 1')
    hole=ET.SubElement(world,'body',name='pothole_zone',mocap='true',pos='0 100 -.02')
    ET.SubElement(hole,'geom',name='pothole_zone_marker',type='cylinder',size='.35 .025',contype='0',conaffinity='0',rgba='.08 .07 .06 1')
    target=ROOT/'.fork-runs/robot'/f'hazards-{os.getpid()}.xml'
    temporary=target.with_suffix('.tmp');tree.write(temporary);temporary.replace(target)
    return target


class CentralAvenueHazards(CentralAvenueG1):
    scene_factory = staticmethod(hazard_scene)
    def __init__(self,record=False):
        self.kind=0
        super().__init__(record)
        self.action_space=spaces.Discrete(5)
        self.observation_space=spaces.Box(-10,10,(13,),dtype=np.float32)

    def reset(self,*,seed=None,options=None):
        self.kind=int(seed%3) if seed is not None else int(self.np_random.integers(0,3))
        _,info=super().reset(seed=seed,options=options)
        self.robot.data.mocap_pos[1:3]=[[0,100,.75],[0,100,-.02]]
        rng=np.random.default_rng(self.scenario_seed+50000)
        if self.kind==1:
            # Keep the full 1.7 m-wide car beyond the parked van's front bumper.
            self.crossing=float(rng.uniform(.4,.9))
            self.speed=float(rng.uniform(1.5,2.5));self.start=float(rng.uniform(-11,-8.5))
            self.py=self.start;self.pv=self.speed;self.last_y=self.start;self.last_v=self.speed;self.age=0.
            self.robot.data.mocap_pos[0]=[0,100,.85]
            self.robot.data.mocap_pos[1]=[self.crossing,self.py,.75]
        elif self.kind==2:
            self.speed=0.;self.start=0.;self.py=0.;self.pv=0.;self.last_y=0.;self.last_v=0.;self.age=0.
            self.robot.data.mocap_pos[0]=[0,100,.85]
            self.robot.data.mocap_pos[2]=[self.crossing,0,-.02]
        self.frames=[]
        if self.record:self._frame(0)
        return self._observe(),{**info,'hazard':KINDS[self.kind]}

    def _observe(self):
        obs=super()._observe()
        return np.concatenate([obs,np.eye(3,dtype=np.float32)[self.kind]])

    def command_for_action(self,action):
        return COMMANDS[action]

    def _pedestrian_step(self):
        if self.kind==0:
            return super()._pedestrian_step()
        d=self.robot.data
        if self.kind==1:
            self.py+=self.speed*self.robot.model.opt.timestep
            d.mocap_pos[1]=[self.crossing,self.py,.75]
            delta=np.abs(d.qpos[:2]-[self.crossing,self.py])-[.85,2.05]
            clearance=float(np.linalg.norm(np.maximum(delta,0))+min(max(delta),0)-.28)
        else:
            # Avoid the detected footprint; terrain deformation is not simulated.
            clearance=float(np.hypot(d.qpos[0]-self.crossing,d.qpos[1])-.55)
        self.min_clearance=min(self.min_clearance,clearance)
        self.contact|=clearance<=0

    def _frame(self,action):
        super()._frame(action)
        self.frames[-1]['hazard']=KINDS[self.kind]
        self.frames[-1]['hazard_position']=[self.crossing,self.py,0]
        self.frames[-1]['clearance']=self.min_clearance

    def step(self,action):
        obs,reward,terminated,truncated,info=super().step(action)
        return obs,reward,terminated,truncated,{**info,'hazard':KINDS[self.kind]}

    def episode_record(self):
        return {**super().episode_record(),'hazard':KINDS[self.kind],
                'hazardGeometry':{'car_half_extents':[.85,2.05,.72],'pothole_keepout_radius':.55}}
