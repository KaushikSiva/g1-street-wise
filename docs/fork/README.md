# STREETWISE

We recreated a street in Chennai to see how a robot learns to handle everyday situations: a person stepping out from behind a parked van, a car crossing its path, or rain starting while it is outside.

The robot already knows how to walk. STREETWISE trains it to decide when to wait, where to move and how to reach shelter. It practises in simulation, makes mistakes, and learns from what happens.

You can choose a scenario, watch the robot respond, and compare its behaviour before and after training.

[Try it on Render](https://streetwise-cppv.onrender.com/?robot=1&live=1) · [Open the marimo notebook](https://molab.marimo.io/notebooks/nb_gK678riXiVKWuUAnQjffef)

## How it works

Unitree's walking controller moves the robot's legs. PPO, a reinforcement learning algorithm, learns the navigation decisions through repeated attempts in MuJoCo. The current navigation policies use information from the simulator about the robot and its surroundings.

Weights & Biases tracks training and evaluation results. Weave records the AI agent's curriculum analysis. marimo brings the code and results together in an interactive notebook where we run and inspect experiments.

## Benchmark history

We started with pedestrians, added cars and road defects, then introduced weather and shelter seeking. Each of the original evaluations used 64 test scenarios.

| Original task | Walking straight ahead | Trained navigation |
|---|---:|---:|
| Pedestrian crossing | 42/64 | 64/64 |
| Mixed traffic and road defects | 28/64 | 64/64 |
| Wet roads and reduced visibility | 28/64 | 63/64 |

These were the successes reported by our original scoring. We later found that it missed some physical collisions, so these numbers do not mean every successful run avoided contact. The weather run kept its starting policy; further training did not improve it.

We corrected the collision checks and retrained the traffic policy. Here is how the policies performed on the same 64 traffic scenarios under the corrected scoring:

| Traffic policy | Successful runs |
|---|---:|
| Walking straight ahead | 6/64 |
| Previous trained policy | 41/64 |
| Retrained policy | 60/64 |

The four remaining runs failed. Because we reused these scenarios, this measures improvement on the existing benchmark, rather than performance on a new street.

For rain, we changed the task from continuing along a wet road to finding shelter when rain starts. The trained policy reached shelter in **56/64 scenarios**; eight timed out, with no collisions or falls recorded.

The first camera-based shelter experiment completed **0/16 scenarios**. It is still experimental; the live navigation policies use simulator state.

## Tech stack

Weights & Biases, Weave, marimo, MuJoCo, PPO, Stable-Baselines3, Gymnasium, Python, PyTorch, NumPy, Unitree RL Gym, Unitree SDK2, molab, TypeScript, Three.js, Vite, MapLibre GL, Docker, Render
