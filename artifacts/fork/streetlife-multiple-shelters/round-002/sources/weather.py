"""Condition-randomized navigation on the existing three real MuJoCo tasks.

Rain changes ground contact friction, not only appearance. Fog limits perfect
actor tracking to a finite range; the last-seen estimator continues outside it.
No rendered-image perception, water dynamics or weather sensor is claimed.
The existing 13-value observation is retained for checkpoint transfer.
"""
import numpy as np
import mujoco
from hazards import CentralAvenueHazards

CONDITIONS = ['dry', 'rain', 'fog']

class CentralAvenueWeather(CentralAvenueHazards):
    difficulty = 0

    def __init__(self, record=False):
        self.condition='dry'
        self.visibility_range=100.
        self.road_friction=1.
        super().__init__(record)

    def reset(self, *, seed=None, options=None):
        # Resolve a training seed before superclass reset so physics and metadata agree.
        seed=int(seed if seed is not None else self.np_random.integers(1,9000))
        self.condition=CONDITIONS[(seed//3)%3]
        rng=np.random.default_rng(seed+70000)
        self.road_friction=float(rng.uniform(max(.18,.4-.06*self.difficulty),max(.3,.65-.07*self.difficulty))) if self.condition=='rain' else 1.
        self.visibility_range=float(rng.uniform(max(1.4,2.5-.3*self.difficulty),max(2.,4.-.45*self.difficulty))) if self.condition=='fog' else (6. if self.condition=='rain' else 100.)
        ground=mujoco.mj_name2id(self.robot.model,mujoco.mjtObj.mjOBJ_GEOM,'central_avenue_road')
        self.robot.model.geom_friction[ground]=[self.road_friction,.005,.0001]
        # Higher priority forces this contact friction, rather than max(foot, road).
        self.robot.model.geom_priority[ground]=1
        obs,info=super().reset(seed=seed,options=options)
        if self.kind != 2:
            self.speed *= 1 + .12*self.difficulty
            self.pv = self.speed
            self.last_v = self.speed
        self.hesitation *= 1 + .25*self.difficulty
        self.frames=[]
        if self.record:self._frame(0)
        return self._observe(),{**info,**self.condition_metadata()}

    def actor_visible(self):
        return bool(super().actor_visible() and np.linalg.norm(self.robot.data.qpos[:2]-[self.crossing,self.py])<=self.visibility_range)

    def condition_metadata(self):
        return {'difficulty':self.difficulty,'condition':self.condition,'road_friction':self.road_friction,'visibility_range':self.visibility_range}

    def step(self,action):
        obs,reward,terminated,truncated,info=super().step(action)
        return obs,reward,terminated,truncated,{**info,**self.condition_metadata()}

    def episode_record(self):
        return {**super().episode_record(),**self.condition_metadata()}
