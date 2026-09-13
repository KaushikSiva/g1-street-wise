# STREETWISE — submission copy

## Project description
STREETWISE is a robot learning lab that turns a photo-informed Chennai street into repeatable navigation tests. An official Unitree walking policy powers a simulated robot while PPO learns to wait, advance and steer around occluded pedestrians, moving cars and marked road defects; a separate action-conditioned world model predicts futures, observes mistakes and improves through validation-gated updates. W&B records training and evaluations, Weave traces the agent's curriculum analysis, and marimo makes the evidence inspectable and reproducible.

## Why it matters
Street deployments expose robots to hazards that tidy laboratory tests miss. STREETWISE helps robotics teams find navigation failures, compare policies on identical encounters and review measured improvements before spending scarce hardware-testing time. It is a simulation-first evaluation tool, with a path toward site-specific testing for delivery, inspection and campus robots; it does not establish real-world safety.

## Evidence
- Pedestrian curriculum: 42 → 64 completed crossings on 64 held-out encounters; 22 → 0 clearance violations; zero falls.
- Mixed curriculum: 28 → 64 completed encounters on 64 held-out tests; 35 → 0 clearance violations; 0 → 0 falls.
- Official SDK: 500 CRC-checked commands applied to simulated joints and 500 feedback messages through DDS loopback.
- World model: held-out position RMSE fell from 0.206 m to 0.169 m after expanding training. Constant-velocity baseline: 0.286 m.
- GPU: actual molab RTX PRO 6000 Blackwell; PPO uses CUDA, MuJoCo and the frozen locomotion policy use CPU.

## Links
- Code: https://github.com/KaushikSiva/g1-street-wise
- Pedestrian run: https://wandb.ai/kaushik-siva88/Unitree%20G1/runs/8upngyv4
- Expanded GPU run: https://wandb.ai/kaushik-siva88/Unitree%20G1/runs/aer2e51j
- Weave trace: https://wandb.ai/kaushik-siva88/Unitree%20G1/r/call/01a09b64-edf0-7a57-82a2-08df5cddf768
- molab: https://molab.marimo.io/notebooks/nb_gK678riXiVKWuUAnQjffef

## Tools and protocols actually used
**Weights & Biases:** PPO training curves, validation checkpoints, held-out summaries and model artifacts. **Weave:** traced experiment reporting and a W&B-hosted Qwen curriculum analyst. **marimo/molab:** reactive experiments, cloud training controls, GPU execution and measured evidence. **Unitree:** official URDF/MJCF, frozen LSTM locomotion policy, SDK2 DDS command/feedback and CRC. **MuJoCo/Gymnasium/Stable-Baselines3:** physical simulation, navigation environment and PPO. **Three.js/Blender:** Central Avenue scene, URDF joint replay and licensed animated human FBX. ARIA is not integrated.

## Tracks
Best Use of Weave; marimo; Best Loop Design. Confirm the live submission form's exact labels.

## Prior work and limits
The Chennai map, OSM footprints, buildings, vehicle reconstruction and facade detailing existed before the hackathon. New work is the robot/world-model learning loop, training, evaluation, sponsor instrumentation, notebooks and demo. Unitree's pretrained locomotion weights were reused, not trained from scratch. The pedestrian and traffic are synthetic; the road defect is a keep-out zone without terrain deformation. The visible scene is photo-informed, with inferred dimensions, rather than a surveyed digital twin. No physical robot was connected.

## Team and account actions
Project/team name: STREETWISE. Team member: Kaushik Sivakumar (confirmed). Social profile not yet supplied. Each member must complete the organizer's participant survey and eligibility requirements; one member submits the final project. Those account actions have not been performed by this agent.
