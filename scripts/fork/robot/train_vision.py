"""Train RGB encoder with action imitation + visible-object supervision, then PPO.

Only RGB frame pairs and own proprioception enter the deployed policy. Simulator
labels supervise perception during training; they are absent from policy inputs.
"""
import argparse,json,time
from pathlib import Path
import numpy as np
import torch
from torch.nn import functional as F
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback
from vision import CameraStreet,SCHEMA
from vision_network import VisionFeatures
from environment import ROOT

def evaluate(policy,split,seeds,blank=False):
 env=CameraStreet(split);rows=[]
 for seed in seeds:
  obs,_=env.reset(seed=seed)
  while True:
   if blank:obs={**obs,'image':np.zeros_like(obs['image'])}
   a=int(policy.predict(obs,deterministic=True)[0]);obs,_,done,timeout,info=env.step(a)
   if done or timeout:rows.append(info);break
 env.close()
 return {'episodes':len(rows),'successes':sum(r['success'] for r in rows),'contacts':sum(r['contact'] for r in rows),'falls':sum(r['fall'] for r in rows),'mean_return':float(np.mean([r['return'] for r in rows])),'rows':rows}

def main():
 p=argparse.ArgumentParser();p.add_argument('--steps',type=int,default=8192);p.add_argument('--samples',type=int,default=2048);p.add_argument('--device',default='cpu');p.add_argument('--output',default='artifacts/fork/vision-v1');args=p.parse_args()
 folder=ROOT/args.output;folder.mkdir(parents=True,exist_ok=True)
 torch.set_num_threads(1);torch.manual_seed(47);rng=np.random.default_rng(47)
 env=CameraStreet('train');model=PPO('MultiInputPolicy',env,device=args.device,n_steps=256,batch_size=64,n_epochs=5,learning_rate=1e-4,ent_coef=.02,seed=47,policy_kwargs={'features_extractor_class':VisionFeatures,'net_arch':{'pi':[64,64],'vf':[64,64]}})
 teacher=PPO.load(ROOT/'artifacts/fork/rain-shelter-v3/initial.zip',device='cpu')
 images=[];proprio=[];actions=[];targets=[];obs,_=env.reset(seed=1)
 for j in range(args.samples):
  a=int(teacher.predict(env.teacher_observation,deterministic=True)[0]);images.append(obs['image']);proprio.append(obs['proprio']);actions.append(a);targets.append(env.perception_target())
  obs,_,done,timeout,_=env.step(a if rng.random()>.12 else int(rng.integers(0,8)))
  if done or timeout:obs,_=env.reset(seed=int(rng.integers(1,9000)))
  if j%256==0:print(json.dumps({'phase':'camera_dataset','samples':j}),flush=True)
 data={'image':np.stack(images),'proprio':np.stack(proprio)};targets=np.stack(targets);actions=np.array(actions)
 optimizer=torch.optim.Adam(model.policy.parameters(),lr=3e-4)
 losses=[]
 for epoch in range(12):
  for start in range(0,len(actions),64):
   idx=rng.integers(0,len(actions),min(64,len(actions)))
   ob={k:torch.as_tensor(v[idx],device=args.device) for k,v in data.items()}
   distribution=model.policy.get_distribution(ob).distribution
   action_loss=F.cross_entropy(distribution.logits,torch.as_tensor(actions[idx],device=args.device))
   prediction=model.policy.features_extractor.perception(ob['image'].float()/255.)
   target=torch.as_tensor(targets[idx],device=args.device)
   presence=F.binary_cross_entropy_with_logits(prediction[:,0],target[:,0]);seen=target[:,0]>0
   bbox=F.smooth_l1_loss(prediction[seen,1:].sigmoid(),target[seen,1:]) if seen.any() else prediction.sum()*0
   loss=action_loss+.4*presence+bbox
   optimizer.zero_grad();loss.backward();torch.nn.utils.clip_grad_norm_(model.policy.parameters(),1.);optimizer.step()
  losses.append(float(loss.detach().cpu()));print(json.dumps({'phase':'joint_perception_imitation','epoch':epoch,'loss':losses[-1]}),flush=True)
 model.save(folder/'initial')
 validation=list(range(10001,10009));test=list(range(20001,20017))
 initial=evaluate(model,'validation',validation);best=initial['mean_return'];model.save(folder/'best');history=[{'step':0,**initial}]
 class Check(BaseCallback):
  def _on_step(self):
   nonlocal best
   if self.num_timesteps%2048==0:
    measured=evaluate(self.model,'validation',validation);history.append({'step':self.num_timesteps,**measured})
    if measured['mean_return']>best:best=measured['mean_return'];self.model.save(folder/'best')
    (folder/'progress.json').write_text(json.dumps(history,indent=2));print(json.dumps({'phase':'ppo_validation','step':self.num_timesteps,**{k:v for k,v in measured.items() if k!='rows'}}),flush=True)
   return True
 model.learn(args.steps,callback=Check());model.save(folder/'final');selected=PPO.load(folder/'best',device=args.device)
 tested=evaluate(selected,'test',test);ablated=evaluate(selected,'test',test,blank=True)
 report={'schema':SCHEMA,'input':'two RGB frames and 8 own-proprioception values; no world xy, actor positions, weather flags, or segmentation inputs','training':'joint action imitation and visible-object presence/bounding box loss, then end-to-end PPO','train_layouts':[0,1,2],'validation_layouts':[3],'test_layouts':[4,5],'samples':args.samples,'ppo_steps':args.steps,'imitation_losses':losses,'history':history,'test':tested,'blank_image_test':ablated,'limits':'Synthetic low-resolution camera imagery. Small initial experiment; no real-world or arbitrary-environment generalization claim.'}
 (folder/'evaluation.json').write_text(json.dumps(report,indent=2));env.close();print(json.dumps({'complete':True,'test':{k:v for k,v in tested.items() if k!='rows'},'blank_image_test':{k:v for k,v in ablated.items() if k!='rows'}}),flush=True)
if __name__=='__main__':main()
