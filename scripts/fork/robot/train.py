"""Train PPO navigation in actual G1 MuJoCo dynamics; log measured W&B curves."""
import argparse
import json
import time
from pathlib import Path
import numpy as np
import torch
from dotenv import load_dotenv
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.monitor import Monitor
import wandb
from environment import CentralAvenueG1, ROOT

VALIDATION = list(range(10001, 10033))
TEST = list(range(20001, 20065))


def evaluate(policy, seeds, record=False):
    env = CentralAvenueG1(record=record)
    results, replays = [], []
    for seed in seeds:
        obs, _ = env.reset(seed=seed)
        while True:
            action = 2 if policy is None else int(policy.predict(obs, deterministic=True)[0])
            obs, _, terminated, truncated, info = env.step(action)
            if terminated or truncated:
                results.append(info)
                if record:
                    replays.append({**env.episode_record(), 'outcome': info})
                break
    metrics = {'episodes': len(results), 'success_rate': float(np.mean([r['success'] for r in results])),
               'clearance_violations': sum(r['contact'] for r in results),
               'falls': sum(r['fall'] for r in results),
               'mean_return': float(np.mean([r['return'] for r in results])),
               'mean_progress': float(np.mean([r['progress'] for r in results])),
               'mean_elapsed': float(np.mean([r['elapsed'] for r in results]))}
    return metrics, results, replays


class EvaluationCallback(BaseCallback):
    def __init__(self, folder, run, every=2048):
        super().__init__()
        self.folder, self.run, self.every = folder, run, every
        self.history = []
        self.best_score = -float('inf')
        self.returns, self.successes = [], []
        self.mastery_checks=0
        self.stop_on_mastery=False
        self.mastered=False
        self.start = time.time()

    def _on_step(self):
        for info in self.locals.get('infos', []):
            if 'episode' in info:
                self.returns.append(float(info['episode']['r']))
                self.successes.append(int(info.get('success', False)))
        if self.num_timesteps % self.every == 0:
            metrics, _, _ = evaluate(self.model, VALIDATION)
            row = {'step': self.num_timesteps, 'wall_seconds': time.time()-self.start,
                   'train/mean_return': float(np.mean(self.returns[-50:])) if self.returns else 0,
                   'train/success_rate': float(np.mean(self.successes[-50:])) if self.successes else 0,
                   **{'validation/'+k:v for k,v in metrics.items()}}
            self.history.append(row)
            if self.run:
                self.run.log(row, step=self.num_timesteps)
            # Only validation selects a checkpoint. Test data never enters training.
            score = metrics['mean_return']
            if score > self.best_score:
                self.best_score = score
                self.model.save(self.folder/'best')
            (self.folder/'learning-curve.json').write_text(json.dumps(self.history, indent=2))
            print(json.dumps(row), flush=True)
            self.mastery_checks = self.mastery_checks+1 if metrics["success_rate"]==1 and metrics["clearance_violations"]==0 and metrics["falls"]==0 else 0
            if self.stop_on_mastery and self.mastery_checks>=2:
                self.mastered=True
                return False
        return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--steps', type=int, default=24576)
    parser.add_argument('--seed', type=int, default=7)
    parser.add_argument('--device', default='cpu', choices=['cpu', 'cuda'])
    parser.add_argument('--wandb', action='store_true')
    parser.add_argument('--resume')
    parser.add_argument('--hazards',action='store_true')
    parser.add_argument('--weather',action='store_true',help='Mixed hazards under dry, wet-road and fog conditions')
    parser.add_argument('--eval-every',type=int,default=2048)
    parser.add_argument('--difficulty',type=int,default=0,choices=range(4))
    parser.add_argument('--stop-on-mastery',action='store_true')
    parser.add_argument('--seed-offset',type=int,default=0)
    parser.add_argument('--output', default='artifacts/fork/rl')
    args = parser.parse_args()
    global CentralAvenueG1, VALIDATION, TEST
    VALIDATION=[s+args.seed_offset for s in VALIDATION]
    TEST=[s+args.seed_offset for s in TEST]
    if args.weather:
        from weather import CentralAvenueWeather
        CentralAvenueWeather.difficulty=args.difficulty
        CentralAvenueG1=CentralAvenueWeather
        args.hazards=True
    elif args.hazards:
        from hazards import CentralAvenueHazards
        CentralAvenueG1=CentralAvenueHazards
    load_dotenv(ROOT/'.env')
    import os
    torch.set_num_threads(1)
    folder = ROOT/args.output
    folder.mkdir(parents=True, exist_ok=True)
    run = None
    if args.wandb:
        run = wandb.init(entity=os.getenv('WANDB_ENTITY'), project=os.getenv('WANDB_PROJECT','Unitree G1'),
            name=f'STREETWISE-PPO-{"weather" if args.weather else "hazards" if args.hazards else "crossing"}-{args.seed}', job_type='navigation-rl', dir=str(ROOT/'.fork-runs'),
            config={'algorithm':'PPO', 'difficulty':args.difficulty, 'steps':args.steps, 'seed':args.seed, 'device':args.device,
                    'physics':'MuJoCo', 'base_policy':'official Unitree G1 LSTM, frozen',
                    'action':'5 Hz velocity options; lateral steering included for hazards' if args.hazards else 'forward speed at 5 Hz', 'train_seed_range':[1,8999],
                    'validation_seeds':VALIDATION, 'test_seeds':TEST,
                    'scene':'Central Avenue corridor v2: 4.7 m van behind crossing; pedestrian never intersects van',
                    'reward':'2*forward_delta - .04 per step; +12 success; -20 violation/fall; -4 timeout',
                    'scope':'Navigation RL; base locomotion weights unchanged; simulation only','curriculum':'dry+wet_road+fog across pedestrian/car/road-defect' if args.weather else 'pedestrian+moving_car+pothole_keepout' if args.hazards else 'pedestrian'})
    env = Monitor(CentralAvenueG1(), info_keywords=('success','contact','fall'))
    policy = PPO('MlpPolicy', env, seed=args.seed, device=args.device,
                 n_steps=512, batch_size=64, n_epochs=10, learning_rate=3e-4,
                 gamma=.99, gae_lambda=.95, ent_coef=.02,
                 policy_kwargs={'net_arch':dict(pi=[64,64],vf=[64,64])}, verbose=0)
    if args.resume:
        policy = PPO.load(ROOT/args.resume, env=env, device=args.device)
    policy.save(folder/'initial')
    baseline, _, _ = evaluate(None, VALIDATION)
    initial, _, _ = evaluate(policy, VALIDATION)
    print(json.dumps({'baseline_validation':baseline,'initial_validation':initial}),flush=True)
    callback = EvaluationCallback(folder, run, every=args.eval_every)
    callback.stop_on_mastery=args.stop_on_mastery
    callback.best_score=initial["mean_return"]
    policy.save(folder/"best")
    callback.history.append({'step':0, **{'validation/'+k:v for k,v in initial.items()}})
    if run:
        run.log(callback.history[0],step=0)
    policy.learn(total_timesteps=args.steps, callback=callback)
    policy.save(folder/'final')
    best = PPO.load(folder/'best', device=args.device)
    # Evaluate exactly once after checkpoint selection is complete.
    before, before_rows, before_replays = evaluate(None, TEST, record=True)
    after, after_rows, after_replays = evaluate(best, TEST, record=True)
    untrained, _, _ = evaluate(PPO.load(folder/'initial',device=args.device), TEST)
    result = {'schema':'fork-g1-rl-v1','algorithm':'PPO','basePolicy':'Official frozen Unitree G1 motion.pt',
              'scope':'Navigation speed selection trained through G1 MuJoCo outcomes; not base locomotion retraining.',
              'masteryReached':callback.mastered,'difficulty':args.difficulty,
              'initialPolicyKind':'resumed checkpoint' if args.resume else 'random initialization','steps':policy.num_timesteps,'seed':args.seed,'device':args.device,'curriculum':'weather' if args.weather else 'hazards' if args.hazards else 'pedestrian',
              'baseline':before,'untrained':untrained,'trained':after,
              'validationSelection':callback.best_score,'history':callback.history,
              'seeds':{'validation':VALIDATION,'test':TEST},
              'beforeRows':before_rows,'afterRows':after_rows,'wandbUrl':run.url if run else None,
              'limits':'Synthetic actors; pedestrian 0.55 m center envelope, moving car rectangular envelope, pothole keep-out zone without terrain deformation. No physical robot trial.' if args.hazards else 'Synthetic pedestrian. Clearance violation uses 0.55 m center-distance threshold; no physical robot trial.'}
    if args.weather:
        result['conditions'] = {}
        for condition in ['dry', 'rain', 'fog']:
            result['conditions'][condition] = {}
            for label, rows in [('baseline',before_rows),('trained',after_rows)]:
                group=[r for r in rows if r.get('condition')==condition]
                result['conditions'][condition][label]={'episodes':len(group),'successes':sum(r['success'] for r in group),'clearance_violations':sum(r['contact'] for r in group),'falls':sum(r['fall'] for r in group)}
        result['weatherScope']='Rain changes contact friction and track visibility; fog limits tracking range. No fluid, camera-perception or hydrodynamic simulation. Condition labels are not policy inputs.'
    (folder/'evaluation.json').write_text(json.dumps(result,indent=2))
    (folder/'replays.json').write_text(json.dumps({'before':before_replays,'after':after_replays}))
    if run:
        run.summary.update({'test/'+k:v for k,v in after.items()})
        run.summary.update({'baseline/'+k:v for k,v in before.items()})
        artifact = wandb.Artifact('fork-g1-navigation',type='model',metadata={'base_policy_frozen':True,'seed':args.seed})
        for name in ['best.zip','initial.zip','evaluation.json','learning-curve.json']:
            artifact.add_file(str(folder/name))
        run.log_artifact(artifact)
        run.finish()
    print(json.dumps({'baseline':before,'trained':after,'untrained':untrained,'wandb':result['wandbUrl']}),flush=True)


if __name__ == '__main__':
    main()
