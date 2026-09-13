"""Rain-to-shelter navigation with multiple independently moving pedestrians.

The scene is a plausible generated task, not a surveyed canopy location. A
covered roadside waiting area is the rain destination. Extra pedestrians have
separate last-seen tracks; their hidden true positions are never observations.
"""
import os
import xml.etree.ElementTree as ET
import mujoco
import numpy as np
from gymnasium import spaces
from environment import ROOT,visible
from hazards import hazard_scene
from weather import CentralAvenueWeather
from g1_policy import G1Controller


def streetlife_scene():
    tree=ET.parse(hazard_scene());world=tree.getroot().find('worldbody')
    for i in range(2):
        body=ET.SubElement(world,'body',name=f'additional_pedestrian_{i}',mocap='true',pos='0 100 .85')
        ET.SubElement(body,'geom',name=f'additional_person_{i}',type='capsule',size='.22 .6',rgba='.2 .4 .6 1')
    # Roof projects over an inferred roadside waiting spot. It does not alter the floor.
    ET.SubElement(world,'geom',name='shelter_roof',type='box',pos='2.6 1.9 2.65',size='.95 .7 .06',contype='0',conaffinity='0',rgba='.28 .45 .39 1')
    for x in (1.7,3.5):ET.SubElement(world,'geom',name=f'shelter_post_{x}',type='cylinder',pos=f'{x} 2.5 1.3',size='.035 1.3',rgba='.25 .3 .28 1',contype='0',conaffinity='0')
    target=ROOT/'.fork-runs/robot'/f'streetlife-{os.getpid()}.xml';tree.write(target);return target


class CentralAvenueStreetlife(CentralAvenueWeather):
    horizon=18.
    adversarial_seeds=[]

    def __init__(self,record=False):
        self.people=[]
        self.goal=np.array([3.2,0.])
        self.seek_shelter=False
        super().__init__(record)
        self.robot=G1Controller(streetlife_scene())
        self.observation_space=spaces.Box(-10,10,(28,),dtype=np.float32)

    def reset(self,*,seed=None,options=None):
        # Replay challenging TRAINING seeds; explicit validation/test seeds bypass this.
        if seed is None and self.adversarial_seeds and self.np_random.random()<.5:
            seed=int(self.np_random.choice(self.adversarial_seeds))
        seed=int(seed if seed is not None else self.np_random.integers(1,9000))
        self.people=[]
        _,info=super().reset(seed=seed,options=options)
        self.robot.data.mocap_pos[3:]=[[0,100,.85],[0,100,.85]]
        rng=np.random.default_rng(seed+90000)
        self.seek_shelter=self.condition=='rain'
        self.goal=np.array([2.6,1.9]) if self.seek_shelter else np.array([3.2,0.])
        for i in range(1+(seed%2)):
            direction=-1 if i==0 else 1
            speed=float(rng.uniform(.45,1.1))*(1+.08*self.difficulty)
            start=float(rng.uniform(2.8,3.6))*(-direction)
            self.people.append({'x':float(rng.uniform(.7,1.2) if i==0 else rng.uniform(1.65,2.1)),
              'y':start,'start':start,'v':direction*speed,'delay':float(rng.uniform(0,2.5)),
              'last_y':start-direction*speed*.8,'last_v':direction*speed,'age':.8,'seen':False})
        for i,actor in enumerate(self.people):self.robot.data.mocap_pos[3+i]=[actor['x'],actor['y'],.85]
        self.frames=[]
        if self.record:self._frame(0)
        return self._observe(),{**info,'task':'reach_shelter' if self.seek_shelter else 'cross_crowded_street'}

    def _observe(self):
        original=super()._observe();d=self.robot.data;extra=[]
        for i in range(2):
            if i>=len(self.people):extra.extend([0]*6);continue
            actor=self.people[i]
            seen=visible(*d.qpos[:2],actor['x'],actor['y']) and np.linalg.norm(d.qpos[:2]-[actor['x'],actor['y']])<=self.visibility_range
            actor['seen']=bool(seen)
            if seen:actor['last_y']=actor['y'];actor['last_v']=actor['v'] if self.t>=actor['delay'] else 0.;actor['age']=0.
            estimate=actor['last_y']+actor['last_v']*actor['age']
            extra.extend([(actor['x']-d.qpos[0])/4,(estimate-d.qpos[1])/4,actor['last_v'],min(actor['age'],4)/4,float(seen),1.])
        extra.extend([(self.goal[0]-d.qpos[0])/4,(self.goal[1]-d.qpos[1])/3,float(self.seek_shelter)])
        return np.clip(np.concatenate([original,np.array(extra,dtype=np.float32)]),-10,10).astype(np.float32)

    def _pedestrian_step(self):
        super()._pedestrian_step();dt=self.robot.model.opt.timestep;d=self.robot.data
        for i,actor in enumerate(self.people):
            if self.t>=actor['delay']:actor['y']+=actor['v']*dt
            actor['age']+=dt
            d.mocap_pos[3+i]=[actor['x'],actor['y'],.85]
            clearance=float(np.linalg.norm(d.qpos[:2]-[actor['x'],actor['y']])-.55)
            self.min_clearance=min(self.min_clearance,clearance);self.contact|=clearance<=0

    def goal_reached(self):
        p=self.robot.data.qpos[:2]
        return bool(np.linalg.norm(p-self.goal)<.45) if self.seek_shelter else bool(p[0]>self.goal[0])

    def extra_reward(self,old_position):
        # Distance shaping directs rain navigation towards cover; dry traffic still rewards progress.
        if not self.seek_shelter:return 0.
        current=self.robot.data.qpos[:2]
        # Replace the base forward-only shaping with progress toward the shelter.
        return 3*(float(np.linalg.norm(old_position-self.goal))-float(np.linalg.norm(current-self.goal)))-2*(current[0]-old_position[0])-.035

    def _frame(self,action):
        super()._frame(action)
        self.frames[-1]['people']=[{'position':[a['x'],a['y'],.85],'direction':int(np.sign(a['v'])),'visible':a['seen']} for a in self.people]

    def step(self,action):
        obs,reward,done,truncated,info=super().step(action)
        return obs,reward,done,truncated,{**info,'task':'reach_shelter' if self.seek_shelter else 'cross_crowded_street','shelter_reached':bool(self.seek_shelter and info['success']),'pedestrian_count':len(self.people)+(self.kind==0)}

    def episode_record(self):
        return {**super().episode_record(),'goal':self.goal.tolist(),'seek_shelter':self.seek_shelter,'people':[dict(a) for a in self.people],
          'limits':'Synthetic multiple pedestrians and inferred roadside shelter. Rain means reduced friction/exposure cost; no fluid simulation. Frozen Unitree gait.'}
