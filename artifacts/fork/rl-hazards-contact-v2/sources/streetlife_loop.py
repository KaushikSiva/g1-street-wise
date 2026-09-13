"""Continual road-scenario mining and PPO refinement; stop with Ctrl-C.

Failure search uses only seeds 1..8999. Every round gets disjoint validation/test
seeds. Hard examples are replayed during training; test failures are never mined.
"""
import argparse,json,os,subprocess,sys,time
from pathlib import Path
import numpy as np
from stable_baselines3 import PPO
from g1_policy import ROOT
from streetlife import CentralAvenueStreetlife


def mine(policy_path,difficulty,round_index,count=64,emergencies=False):
    cls = CentralAvenueStreetlife
    if emergencies:
        from emergencies import CentralAvenueEmergencies
        cls = CentralAvenueEmergencies
    cls.difficulty=difficulty
    env=cls()
    policy=PPO.load(policy_path,device='cpu')
    candidates=np.random.default_rng(41000+round_index).choice(np.arange(1,9000),size=count,replace=False)
    failures=[];results=[]
    for seed in candidates:
        obs,_=env.reset(seed=int(seed))
        while True:
            obs,_,done,truncated,info=env.step(int(policy.predict(obs,deterministic=True)[0]))
            if done or truncated:break
        results.append(info)
        if not info['success']:failures.append(int(seed))
    return failures,results


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--output',default='artifacts/fork/streetlife')
    p.add_argument('--checkpoint',default='artifacts/fork/rl-weather-level-3/best.zip')
    p.add_argument('--rounds',type=int,default=0,help='0 continues until stopped')
    p.add_argument('--steps',type=int,default=65536)
    p.add_argument('--device',choices=['cpu','cuda'],default='cuda')
    p.add_argument('--wandb',action='store_true')
    p.add_argument('--emergencies',action='store_true')
    p.add_argument('--learning-rate',type=float,default=.0001)
    p.add_argument('--entropy',type=float,default=.01)
    args=p.parse_args()
    output=ROOT/args.output;output.mkdir(parents=True,exist_ok=True)
    if (output/'round-001').exists():
        raise SystemExit('This output already contains a run. Choose a new output and pass its saved best checkpoint; existing evidence was preserved.')
    (output/'process.json').write_text(json.dumps({'pid':os.getpid(),'startedAt':time.time(),'stop':'Send SIGTERM to this PID; checkpoints already saved remain intact.'}))
    checkpoint=ROOT/args.checkpoint;difficulty=0;round_index=1;history=[]
    while args.rounds==0 or round_index<=args.rounds:
        folder=output/f'round-{round_index:03}'
        state={'status':'training','round':round_index,'difficulty':difficulty,'history':history,'seedPolicy':'Training and adversarial seeds below 9000. Validation/test use distinct round offsets.','goal':'Find plausible failure cases, learn from training failures, measure on independent encounters.'}
        (output/'status.json').write_text(json.dumps(state,indent=2))
        command=[sys.executable,str(ROOT/'scripts/fork/robot/train.py'),'--emergencies' if args.emergencies else '--streetlife','--difficulty',str(difficulty),'--seed-offset',str((9000000 if args.emergencies else 5000000)+round_index*100000),'--steps',str(args.steps),'--eval-every','8192','--resume',str(checkpoint),'--output',str(folder),'--device',args.device,'--learning-rate',str(args.learning_rate),'--entropy',str(args.entropy)]
        if args.wandb:command.append('--wandb')
        pool=output/'hard-training-seeds.json'
        if pool.exists():command.extend(['--adversarial-seeds',str(pool)])
        subprocess.run(command,cwd=ROOT,check=True,env=os.environ.copy())
        result=json.loads((folder/'evaluation.json').read_text());checkpoint=folder/'best.zip'
        failures,rows=mine(checkpoint,difficulty,round_index,emergencies=args.emergencies)
        pool.write_text(json.dumps(failures))
        (folder/'failure-search.json').write_text(json.dumps({'split':'training-only','seeds':[r['scenario_seed'] for r in rows],'failures':failures,'outcomes':rows},indent=2))
        from curriculum import mastered
        promote=mastered(result['history'])
        history.append({'round':round_index,'difficulty':difficulty,'steps':result['steps'],'trainingFailuresFound':len(failures),'validationMastered':promote,'baseline':result['baseline'],'starting':result['untrained'],'trained':result['trained'],'wandbUrl':result['wandbUrl']})
        if promote:difficulty=min(3,difficulty+1)
        round_index+=1
    state.update({'status':'configured_rounds_complete','history':history});(output/'status.json').write_text(json.dumps(state,indent=2))


if __name__=='__main__':main()
