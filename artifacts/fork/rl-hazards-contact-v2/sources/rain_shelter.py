"""Versioned rain-onset task: reach cover, stop there, and avoid physical contact."""
import numpy as np
import mujoco
from gymnasium import spaces
from streetlife import CentralAvenueStreetlife

COMMANDS = [[0,0,0],[.35,0,0],[.7,0,0],[.35,.3,0],[.35,-.3,0],[0,.35,0],[0,-.35,0],[-.3,0,0]]

class RainShelter(CentralAvenueStreetlife):
    schema = 'rain-onset-shelter-v2'
    enforce_physical_contacts = True
    horizon = 22.

    def __init__(self, record=False):
        self.rain_onset = float('inf')
        self.cover_duration = self.exposure_seconds = 0.
        super().__init__(record)
        self.action_space = spaces.Discrete(len(COMMANDS))

    def reset(self, *, seed=None, options=None):
        seed = int(seed if seed is not None else self.np_random.integers(1,9000))
        self.rain_onset = float('inf')
        self.cover_duration = self.exposure_seconds = 0.
        super().reset(seed=seed, options=options)
        rng = np.random.default_rng(seed+910000)
        self.rain_onset = float(rng.uniform(0.,3.))
        self.wet_friction = float(rng.uniform(.38,.6))
        # Roadside cover remains outside the parked van and the car's swept lane.
        self.shelters = [np.array([-1.6+rng.uniform(-.5,.5),1.95]),
                         np.array([2.7+rng.uniform(-.3,.3),-1.95]), np.array([3.6,1.95])]
        for i,p in enumerate(self.shelters): self.robot.data.mocap_pos[5+i]=[*p,0]
        self.condition='dry';self.seek_shelter=False;self.goal=np.array([3.2,0.])
        self._weather_update()
        self.frames=[]
        if self.record:self._frame(0)
        return self._observe(), {'scenario_seed':seed,'schema':self.schema}

    def _weather_update(self):
        active = self.t >= self.rain_onset
        self.seek_shelter=active
        self.condition='rain' if active else 'dry'
        self.road_friction=self.wet_friction if active else 1.
        self.visibility_range=6. if active else 100.
        ground=mujoco.mj_name2id(self.robot.model,mujoco.mjtObj.mjOBJ_GEOM,'central_avenue_road')
        self.robot.model.geom_friction[ground]=[self.road_friction,.005,.0001]
        self.robot.model.geom_priority[ground]=1

    def covered(self):
        p=self.robot.data.qpos[:2]
        # Full robot center margin lies under the .7 x .65 m roof half-extents.
        return any(np.all(np.abs(p-goal)<[.42,.37]) for goal in self.shelters)

    def command_for_action(self, action):return COMMANDS[action]

    def step(self, action):
        self._weather_update()
        obs,reward,done,truncated,info=super().step(action)
        return obs,reward,done,truncated,{**info,'rain_onset':self.rain_onset,
            'exposure_seconds':self.exposure_seconds,'cover_duration':self.cover_duration,'schema':self.schema}

    def _pedestrian_step(self):
        super()._pedestrian_step()
        if self.seek_shelter:
            dt=self.robot.model.opt.timestep
            covered=self.covered()
            self.exposure_seconds+=dt*float(not covered)
            self.cover_duration = self.cover_duration+dt if covered and np.linalg.norm(self.robot.data.qvel[:2])<.18 else 0.

    def goal_reached(self):
        return bool(self.seek_shelter and self.cover_duration>=.8)

    def extra_reward(self,old_position):
        reward=super().extra_reward(old_position)
        if self.seek_shelter:
            reward-=.15*float(not self.covered())
            if self.covered():reward+=.2
        return reward

    def _frame(self,action):
        super()._frame(action)
        self.frames[-1].update(condition=self.condition,seek_shelter=self.seek_shelter)

    def episode_record(self):
        return {**super().episode_record(),'schema':self.schema,'rain_onset':self.rain_onset,
            'limits':'Random rain onset; reduced road friction; reach inferred cover and stop for 0.8 s. Physical contacts fail. No fluid or structural shelter simulation.'}
