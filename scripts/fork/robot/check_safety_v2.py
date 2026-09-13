"""Regression tests for missed car contact and rainfall changing the objective."""
import sys,json
import numpy as np
import mujoco
from environment import ROOT
from hazards import CentralAvenueHazards
from rain_shelter import RainShelter
sys.path.insert(0,str(ROOT/'scripts/fork'))
from live_server import NavigationPolicy

e=CentralAvenueHazards();e.enforce_physical_contacts=True
p=NavigationPolicy(ROOT/'artifacts/fork/rl-hazards-v2/best.npz');obs,_=e.reset(seed=20002)
while True:
 obs,_,done,timeout,info=e.step(p.predict(obs))
 if done or timeout:break
assert info['physical_contact'] and not info['success'] and info['collision_geometry']=='moving_car_body',info
assert info['min_clearance']>0,'This regression must cover a hit missed by the center envelope.'
r=RainShelter();r.reset(seed=4)
assert not r.seek_shelter and not r.goal_reached()
r.t=r.rain_onset+.01;r._weather_update();r._observe()
assert r.seek_shelter and r.condition=='rain'
p0=r.robot.data.qpos[:2].copy();r.robot.data.qpos[:2]=r.shelters[0];r.robot.data.qvel[:]=0
assert r.covered() and not r.goal_reached(),'Merely touching the shelter must not finish.'
r.cover_duration=.81
assert r.goal_reached()
r.robot.data.qpos[:2]=p0
report={'car_20002':info,'rain_onset_switches_goal':True,'cover_requires_stopped_dwell':True}
(ROOT/'artifacts/fork/live-demo/safety-v2-check.json').write_text(json.dumps(report,indent=2));print('PASS actual car contact fails despite positive center clearance; rain changes goal; shelter requires stopping.')
