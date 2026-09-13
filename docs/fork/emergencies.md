# Emergency avoidance curriculum

September 13, 2026. `streetwise-emergency-v1` extends the multiple-pedestrian weather/shelter task with non-graphic prone people, rigid concrete/rubble proxies and combined accident scenes. One quarter of the seed cycle has no additional incident. Incident position, orientation and appearance time are randomized; appearance occurs within the first three seconds, with a short additional delay for the rubble in a combined scene.

The robot receives simulator-provided tracks after an incident is within its tracking range and unoccluded by the parked van. An unseen incident contributes ten zeros, including no future location or onset time. Once observed, its last known position persists outside tracking range. This is **not camera recognition**, a learned accident classifier or a real-world safety system. The synthetic actor classification and geometry are supplied by the simulator.

The original 37 streetlife observations are followed by two ten-value tracks: relative XY divided by four, footprint half extents divided by two, sine/cosine orientation, capped track age divided by four, currently visible, ever observed, and whether this incident permits stopping. Actions retain the existing five options and add pure left, pure right and backward velocity commands. The base Unitree LSTM gait stays frozen. Checkpoint transfer preserves existing network weights and action logits, zero-initializes additional input columns, and gives new actions initially low logits. Each run saves `schema.json` with dimensions, velocity commands, source hashes and the starting checkpoint hash.

Each active obstacle has a conservative oriented footprint with a 0.30 m robot clearance margin. Entering that envelope terminates the encounter as a failure. Actual MuJoCo foot/ankle contacts with the collidable prone-person and rubble geometry are measured separately. Most envelope violations occur before physical contact, so zero foot contacts alone does not mean successful avoidance. The prone-person proxy is rigid; injury, human articulation and debris fragmentation are not simulated.

A combined accident scene permits a successful stop after 1.2 seconds below 0.12 m/s, near an observed incident and outside its clearance envelope. Waiting before appearance or far from the incident cannot earn this outcome. Fallen-person and ordinary-debris encounters require completing the route or reaching shelter. `safe_stop`, `route_completed`, emergency clearance violations and physical foot contacts are recorded separately. Moving pedestrians/cars, road boundaries, falls and weather still affect success.

## Run and verify

```sh
.venv-fork/bin/python scripts/fork/robot/check_emergencies.py
.venv-fork/bin/mjpython scripts/fork/robot/viewer.py --environment emergencies --policy before --chennai --seed 10
# Use a downloaded 57-observation/eight-action checkpoint for --policy after.
.venv-fork/bin/python scripts/fork/robot/train.py --emergencies --resume artifacts/fork/streetlife-multiple-shelters/round-001/best.zip --steps 32768 --learning-rate 0.00003 --entropy 0.008 --output artifacts/fork/emergency-reproduction --device cpu
```

The executable checks cover Gymnasium compatibility, deterministic reset, pre-appearance/range/van-occlusion gating, last-seen tracking, failure on envelope entry, actual MuJoCo foot/rubble contact, safe-stop eligibility, rotated distance and legacy weight transfer. Evidence: `artifacts/fork/emergencies-v1/behavior-checks.json`. `native-fallen-person.png` is an actual native rendering of training seed 10 at two seconds; constant forward motion violates emergency clearance at four seconds. This is a failure demonstration, not a learned before/after claim.

## Cloud continuation

The emergency driver runs in `/marimo/streetwise-emergencies-v1`, with independent source files and outputs. It shares the installed vendor assets and private credentials with the existing `/marimo/streetwise` project. It does not replace or mutate the running shelter curriculum. Log: `.fork-runs/emergencies-v1.log`; output: `artifacts/fork/emergencies-v1`. First W&B run: https://wandb.ai/kaushik-siva88/Unitree%20G1/runs/x3p0xav5. The marimo notebook has a new emergency/shelter evidence table and refresh control.

Each emergency round trains for 32,768 PPO steps at learning rate 0.00003 and entropy coefficient 0.008. Validation uses 32 seeds; 64 distinct test seeds are evaluated after checkpoint selection. Round offsets begin at 9,100,000 and increase by 100,000. Only seeds below 9000 feed failure mining and training replay. Two clean, perfect validation checks control difficulty promotion. Existing output directories are protected against accidental relaunch overwrites.

Training is ongoing. Do not claim emergency learning gains until the completed round's starting-policy and selected-policy results are available on the same unseen test seeds. A retained starting checkpoint is not an improvement. Cloud execution depends on the molab session remaining alive.

At the first 8,192-step emergency check, validation completion was 5/32 (starting policy 4/32), with 22 total clearance violations, 17 emergency-envelope violations and one actual foot contact. No successful accident stops were measured. These are interim validation results, not final unseen-test evidence or a solved task.
