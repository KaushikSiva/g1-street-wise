"""Bounded automatic challenge ladder. Only validation determines advancement.

A stage ends after two consecutive perfect validation checks or its step budget.
New stages have disjoint validation/test seeds. Test results never unlock levels.
"""
import argparse,json,os,subprocess,sys,time
from pathlib import Path
from g1_policy import ROOT


def mastered(history):
    rows=[r for r in history if r['step']>0]
    return len(rows)>=2 and all(r.get('validation/success_rate')==1 and r.get('validation/clearance_violations')==0 and r.get('validation/falls')==0 for r in rows[-2:])


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--initial-run',default='artifacts/fork/rl-weather')
    p.add_argument('--max-level',type=int,default=3,choices=range(1,4))
    p.add_argument('--steps-per-level',type=int,default=32768)
    p.add_argument('--device',default='cuda',choices=['cuda','cpu'])
    p.add_argument('--wandb',action='store_true')
    p.add_argument('--wait',action='store_true',help='Wait for initial run evaluation to complete')
    args=p.parse_args()
    initial=ROOT/args.initial_run
    while not (initial/'evaluation.json').exists():
        if not args.wait:raise SystemExit('Initial run is incomplete. Use --wait to monitor it.')
        time.sleep(5)
    result=json.loads((initial/'evaluation.json').read_text())
    state={'schema':'streetwise-curriculum-v1','promotionRule':'Two consecutive validation checkpoints at 100% success, zero violations, zero falls. Test results are not consulted.','levels':[],'status':'running'}
    folder=ROOT/'artifacts/fork/curriculum';folder.mkdir(parents=True,exist_ok=True)
    def save():
        temp=folder/'status.tmp';temp.write_text(json.dumps(state,indent=2));temp.replace(folder/'status.json')
    previous=initial
    for level in range(args.max_level+1):
        qualifies=result.get('masteryReached',False) or mastered(result['history'])
        state['levels'].append({'level':level,'run':str(previous.relative_to(ROOT)),'mastered':qualifies,'steps':result['steps'],'wandbUrl':result.get('wandbUrl'),'validationSuccess':result['history'][-1]['validation/success_rate']})
        if not qualifies:
            state['status']='needs_more_practice';save();break
        if level==args.max_level:
            state['status']='configured_ladder_mastered';save();break
        next_level=level+1
        state['status']='training_harder_level';state['activeLevel']=next_level;save()
        destination=ROOT/f'artifacts/fork/rl-weather-level-{next_level}'
        command=[sys.executable,str(ROOT/'scripts/fork/robot/train.py'),'--weather','--difficulty',str(next_level),'--seed-offset',str(next_level*100000),'--steps',str(args.steps_per_level),'--eval-every','4096','--stop-on-mastery','--resume',str(previous/'best.zip'),'--output',str(destination),'--device',args.device]
        if args.wandb:command.append('--wandb')
        subprocess.run(command,cwd=ROOT,check=True,env=os.environ.copy())
        previous=destination;result=json.loads((destination/'evaluation.json').read_text())
    save();print(json.dumps(state),flush=True)


if __name__=='__main__':main()
