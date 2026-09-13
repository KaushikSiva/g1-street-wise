"""Bootstrap rain-onset navigation with scripted training demonstrations, then PPO."""
import json
import numpy as np
import torch
from torch.nn import functional as F
from stable_baselines3 import PPO
from rain_shelter import RainShelter
from train import transfer_navigation,EvaluationCallback,evaluate
import train
from environment import ROOT

def expert(env):
 if not env.seek_shelter:return 0
 d=env.robot.data;goal=env.shelters[0];dx,dy=goal-d.qpos[:2]
 if abs(dy)>.18:
  if d.qpos[0]>-.95:return 7
  return 5 if dy>0 else 6
 if abs(dx)>.17:return 2 if dx>0 else 7
 return 0

def main():
 torch.set_num_threads(1);torch.manual_seed(73);rng=np.random.default_rng(73)
 folder=ROOT/'artifacts/fork/rain-shelter-v3';folder.mkdir(parents=True,exist_ok=True)
 train.CentralAvenueG1=RainShelter
 train.VALIDATION=list(range(10001,10033));train.TEST=list(range(20001,20065))
 env=RainShelter();model=PPO('MlpPolicy',env,n_steps=512,batch_size=64,n_epochs=5,learning_rate=1e-4,ent_coef=.01,seed=73,policy_kwargs={'net_arch':{'pi':[64,64],'vf':[64,64]}})
 transfer_navigation(PPO.load(ROOT/'artifacts/fork/streetlife-multiple-shelters/round-002/best.zip'),model)
 observations=[];actions=[];expert_results=[]
 for seed in range(1,65):
  obs,_=env.reset(seed=seed)
  while True:
   a=expert(env);observations.append(obs);actions.append(a);obs,_,done,timeout,info=env.step(a)
   if done or timeout:expert_results.append(info);break
 x=torch.tensor(np.stack(observations));y=torch.tensor(actions)
 optimizer=torch.optim.Adam(model.policy.parameters(),lr=5e-4)
 for epoch in range(50):
  for start in range(0,len(y),128):
   idx=torch.tensor(rng.integers(0,len(y),128));loss=F.cross_entropy(model.policy.get_distribution(x[idx]).distribution.logits,y[idx]);optimizer.zero_grad();loss.backward();optimizer.step()
  if epoch%10==0:print(json.dumps({'phase':'shelter_imitation','epoch':epoch,'loss':float(loss.detach()),'expert_successes':sum(r['success'] for r in expert_results)}),flush=True)
 model.save(folder/'initial');model.save(folder/'best')
 initial,_,_=evaluate(model,train.VALIDATION);callback=EvaluationCallback(folder,None,every=4096);callback.best_score=initial['mean_return'];callback.history=[{'step':0,**{'validation/'+k:v for k,v in initial.items()}}]
 print(json.dumps({'initial_validation':initial}),flush=True)
 model.learn(16384,callback=callback);model.save(folder/'final')
 chosen=PPO.load(folder/'best');before,br,bp=evaluate(None,train.TEST,record=True);after,ar,ap=evaluate(chosen,train.TEST,record=True)
 result={'schema':env.schema,'baseline':before,'trained':after,'beforeRows':br,'afterRows':ar,'history':callback.history,'wandbUrl':None,'training':'64 scripted training-only demonstrations, action imitation, then 16384 PPO steps. Physical contacts fail.','expert_training_successes':sum(r['success'] for r in expert_results),'test_seeds':train.TEST,'validation_seeds':train.VALIDATION,'limits':'Inferred shelter locations, simulator tracks. No vision input to this checkpoint.'}
 (folder/'evaluation.json').write_text(json.dumps(result,indent=2));(folder/'replays.json').write_text(json.dumps({'before':bp,'after':ap},separators=(',',':')))
 print(json.dumps({'complete':True,'trained':after}),flush=True)
if __name__=='__main__':main()
