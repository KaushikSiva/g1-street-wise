"""Re-evaluate a saved navigation checkpoint without retraining or selection."""
import argparse
import json
from pathlib import Path
from stable_baselines3 import PPO
import train
from g1_policy import ROOT


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('checkpoint')
    parser.add_argument('--hazards',action='store_true')
    parser.add_argument('--output',default='artifacts/fork/checkpoint-reproduction.json')
    args=parser.parse_args()
    if args.hazards:
        from hazards import CentralAvenueHazards
        train.CentralAvenueG1=CentralAvenueHazards
    policy=PPO.load(ROOT/args.checkpoint,device='cpu')
    baseline,_,_=train.evaluate(None,train.TEST)
    result,rows,_=train.evaluate(policy,train.TEST)
    payload={'checkpoint':args.checkpoint,'testSeeds':train.TEST,'baseline':baseline,'trained':result,'rows':rows,'purpose':'Reproduction of the already selected checkpoint; no new selection.'}
    output=ROOT/args.output;output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(payload,indent=2))
    print(json.dumps({'baseline':baseline,'trained':result}))

if __name__=='__main__':main()
