"""Demonstrate that glancing contact and direct impact produce different dynamics."""
import json,sys
import mujoco,numpy as np
from environment import ROOT
from hazards import CentralAvenueHazards
sys.path.insert(0,str(ROOT/'scripts/fork'))
from live_server import NavigationPolicy
p=NavigationPolicy(ROOT/'artifacts/fork/rl-hazards-v2/best.npz');e=CentralAvenueHazards();obs,_=e.reset(seed=20002)
car=mujoco.mj_name2id(e.robot.model,mujoco.mjtObj.mjOBJ_GEOM,'moving_car_body');original=e.robot.step;samples=[]
def measure():
 for i,c in enumerate(e.robot.data.contact):
  if car not in (c.geom1,c.geom2) or c.dist>0:continue
  other=c.geom2 if c.geom1==car else c.geom1;force=np.zeros(6);mujoco.mj_contactForce(e.robot.model,e.robot.data,i,force)
  mesh=int(e.robot.model.geom_dataid[other]);mesh_name=mujoco.mj_id2name(e.robot.model,mujoco.mjtObj.mjOBJ_MESH,mesh) if int(e.robot.model.geom_type[other])==int(mujoco.mjtGeom.mjGEOM_MESH) else None
  samples.append({'t':round(e.t,3),'mesh':mesh_name,'normal_force_N':float(force[0]),'normal':c.frame[:3].tolist()})
def measured_step(command,steps=10,before_step=None,after_step=None):return original(command,steps,before_step,measure)
e.robot.step=measured_step
while True:
 obs,_,done,timeout,info=e.step(p.predict(obs))
 if done or timeout:break
report={'seed':20002,'speed_m_s':e.speed,'glancing':{'first':samples[0],'fall':info['fall'],'normal_impulse_Ns':sum(s['normal_force_N'] for s in samples)*.002}}
assert samples and not info['fall']
e=CentralAvenueHazards();e.reset(seed=20002);e.crossing=-3.;e.py=-5.;fell=False
for _ in range(25):
 _,_,_,_,info=e.step(0);fell|=info['fall']
assert fell
report['direct_impact']={'same_speed':e.speed,'fall':fell,'command':'stand','car_path':'directly through robot initial position'}
report['limits']='Diagnostic synthetic kinematic car and fixed upper-body G1. Not validated vehicle-impact biomechanics.'
(ROOT/'artifacts/fork/live-demo/car-impact-diagnostic.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
