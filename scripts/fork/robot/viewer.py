"""Run fresh policy-controlled MuJoCo physics, optionally in imported Chennai scenery.

On macOS run with .venv-fork/bin/mjpython so the native viewer owns the main thread.
"""
import argparse,json,time
from pathlib import Path
import mujoco
import mujoco.viewer
from stable_baselines3 import PPO
from environment import CentralAvenueG1
from g1_policy import G1Controller,ROOT


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--policy',choices=['before','after'],default='after')
    p.add_argument('--checkpoint')
    p.add_argument('--environment',choices=['crossing','hazards','weather'],default='crossing')
    p.add_argument('--difficulty',type=int,default=0,choices=range(4))
    p.add_argument('--seed',type=int,default=20002)
    p.add_argument('--chennai',action='store_true')
    p.add_argument('--seconds',type=float,default=0,help='Auto-close after this many wall seconds; 0 waits for window close')
    p.add_argument('--headless',action='store_true',help='Run one fresh episode without opening a window')
    p.add_argument('--screenshot-time',type=float,default=0)
    p.add_argument('--screenshot',help='Render the initial native physics scene to PNG')
    args=p.parse_args()
    cls=CentralAvenueG1
    if args.environment=='hazards':
        from hazards import CentralAvenueHazards
        cls=CentralAvenueHazards
    elif args.environment=='weather':
        from weather import CentralAvenueWeather
        cls=CentralAvenueWeather;cls.difficulty=args.difficulty
    env=cls()
    if args.chennai:
        from native_scene import decorate
        from native_human import attach,NativeHumans
        env.robot=G1Controller(attach(decorate(args.environment)))
        native_humans=NativeHumans(env.robot.model)
    default={'crossing':'rl-corridor-v2','hazards':'rl-hazards-v2','weather':'rl-weather'}[args.environment]
    checkpoint=ROOT/(args.checkpoint or f'artifacts/fork/{default}/best.zip')
    policy=PPO.load(checkpoint,device='cpu') if args.policy=='after' else None
    obs,_=env.reset(seed=args.seed)
    if args.chennai:native_humans.update(env)
    def advance():
        nonlocal obs
        action=2 if policy is None else int(policy.predict(obs,deterministic=True)[0])
        obs,_,done,truncated,info=env.step(action)
        if args.chennai:native_humans.update(env)
        return done or truncated,info
    if args.screenshot:
        while env.t<args.screenshot_time:
            done,_=advance()
            if done:break
        import matplotlib.pyplot as plt
        camera=mujoco.MjvCamera();camera.lookat[:]=[-1,-1,1.1];camera.distance=12;camera.azimuth=-35;camera.elevation=-15
        with mujoco.Renderer(env.robot.model,height=900,width=1400) as renderer:
            renderer.update_scene(env.robot.data,camera=camera)
            plt.imsave(args.screenshot,renderer.render())
    if args.headless:
        while True:
            done,info=advance()
            if done:print(json.dumps(info));return
    started=time.monotonic();paused=False;finished=False
    def key(code):
        nonlocal paused,finished,obs
        if code==32:paused=not paused
        if code in (82,114):obs,_=env.reset(seed=args.seed);finished=False
    print('Fresh MuJoCo physics. Space: pause/resume. R: restart this seed. Close window to exit.',flush=True)
    with mujoco.viewer.launch_passive(env.robot.model,env.robot.data,key_callback=key) as viewer:
        viewer.cam.lookat[:]=[-1,-1,1.1];viewer.cam.distance=12;viewer.cam.azimuth=-35;viewer.cam.elevation=-15
        next_frame=time.monotonic()
        def render_step(_env):
            nonlocal next_frame
            if args.chennai:native_humans.update(env)
            viewer.sync();next_frame+=.02
            time.sleep(max(0,next_frame-time.monotonic()))
            if time.monotonic()-next_frame>.2:next_frame=time.monotonic()
        env.frame_callback=render_step
        while viewer.is_running() and (args.seconds<=0 or time.monotonic()-started<args.seconds):
            start=time.monotonic()
            if not paused and not finished:
                finished,info=advance()
                if finished:print(json.dumps(info),flush=True)
            viewer.sync();time.sleep(max(0,.2-(time.monotonic()-start)))


if __name__=='__main__':main()
