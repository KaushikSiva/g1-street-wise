"""Audit physical overlap in stored poses without retraining or altering trajectories."""
import json
from pathlib import Path
import mujoco
from environment import CentralAvenueG1,ROOT
from hazards import CentralAvenueHazards
from weather import CentralAvenueWeather
from streetlife import CentralAvenueStreetlife
report={}
for path in (ROOT/'public/assets/fork').glob('*experiment.json'):
 data=json.loads(path.read_text())
 if 'replays' not in data or data.get('contactAudit'):continue
 cls=CentralAvenueStreetlife if path.name.startswith('streetlife') else CentralAvenueWeather if path.name.startswith('weather') else CentralAvenueHazards if path.name.startswith('hazard') else CentralAvenueG1
 env=cls();changed=[]
 for label in ('before','after'):
  for replay in data['replays'][label]:
   env.reset(seed=replay['seed']);d=env.robot.data
   hit=None
   for f in replay['frames']:
    d.qpos[:19]=f['qpos'];env.t=f['t'];d.mocap_pos[0]=f['pedestrian']
    if replay.get('hazard')=='moving_car':d.mocap_pos[0]=[0,100,.85];d.mocap_pos[1]=[*f['hazard_position'][:2],.75]
    if replay.get('hazard')=='pothole_zone':d.mocap_pos[0]=[0,100,.85];d.mocap_pos[2]=[*f['hazard_position'][:2],-.02]
    for i,p in enumerate(f.get('people',[])):d.mocap_pos[3+i]=p['position']
    mujoco.mj_forward(env.robot.model,d);env._physical_contact_step()
    if env.physical_contact:hit=(f['t'],env.collision_geometry);break
   if hit:
    o=replay['outcome'];replay['originalOutcome']=dict(o)
    o.update(success=False,contact=True,physical_contact=True,first_violation_time=hit[0],collision_geometry=hit[1],scoring='recorded-contact-audit-v2')
    changed.append({'mode':label,'seed':replay['seed'],'original_success':replay['originalOutcome']['success'],'time':hit[0],'geometry':hit[1]})
  e=data['evaluation'][ 'baseline' if label=='before' else 'trained'];rows=[r['outcome'] for r in data['replays'][label]]
  data.setdefault('originalEvaluation',{})[label]=dict(e)
  e.update(success_rate=sum(r['success'] for r in rows)/len(rows),clearance_violations=sum(r['contact'] for r in rows),physical_contacts=sum(r.get('physical_contact',False) for r in rows))
 data['contactAudit']={'method':'MuJoCo contacts reconstructed at stored 50 Hz poses. Original trajectories unchanged. Can miss between-frame contacts; fresh runs check 500 Hz. Original validation curve retained.','corrected':changed}
 path.write_text(json.dumps(data,separators=(',',':')))
 report[path.name]=changed
 print(path.name,len(changed),'physical collisions',flush=True)
folder=ROOT/'artifacts/fork/live-demo';folder.mkdir(exist_ok=True,parents=True)
(folder/'recorded-contact-audit.json').write_text(json.dumps(report,indent=2))
