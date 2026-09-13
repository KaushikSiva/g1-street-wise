# STREETWISE restart checkpoint

Saved September 13, 2026. Main work: /Users/kaushiksivakumar/workspace/chennai-gta. Publication checkout: /Users/kaushiksivakumar/workspace/g1-street-wise. Repository: https://github.com/KaushikSiva/g1-street-wise.

## Restart locally

```sh
cd /Users/kaushiksivakumar/workspace/g1-street-wise
npm run build
.venv-fork/bin/python scripts/fork/start.py
```

Open http://127.0.0.1:5189/?robot=1 or http://127.0.0.1:5189/?compare=1. The marimo lab opens at http://127.0.0.1:2718. Existing dependencies are installed; a fresh machine uses `python3 scripts/fork/setup.py` first.

For native MuJoCo, double-click `Launch STREETWISE MuJoCo.command` in Desktop/STREETWISE Demo, or run:

```sh
cd /Users/kaushiksivakumar/workspace/g1-street-wise
.venv-fork/bin/mjpython scripts/fork/robot/viewer.py --chennai --policy after --seed 20002
```

Space pauses, R restarts. Local web/native processes stop when the PC restarts. Keys remain in the private source .env and are intentionally excluded from GitHub.

## Verified state

Original navigation PPO uses actual MuJoCo and the frozen official Unitree LSTM gait. The gait weights are not fine-tuned. Original pedestrian and mixed-hazard final tests each reached 64/64 successful encounters. Weather refinement has one measured 63/64 to 64/64 improvement. Later retained checkpoints must not be called additional gains.

Latest web work: nine already mapped buildings detailed with 354 framed windows, seven entries and mineral plaster; two source-supported roof dishes. Map count remains 1,173. Production build passed after the agents paused.

Native work: animated real FBX human, corrected bark textures, road/verge albedo atlas, sunlight and shadow bounds, mapped backdrop shells. Assets are stable. Native parity report predates the latest decorative batch and needs refreshing. Native export contains the first five improved background blocks; the remaining four web blocks/roof details still need transfer.

The two-minute (118-second) MP4 and script are in Desktop/STREETWISE Demo. Refresh pending: newest native visuals and the latest naturally paced narration. The existing MP4 is playable.

## Cloud training and how to resume work

The cloud job is on molab Blackwell, separate from the laptop. Its continuation depends on the cloud session staying alive; a laptop restart does not intentionally stop it. Notebook: https://molab.marimo.io/notebooks/nb_gK678riXiVKWuUAnQjffef.

Cloud root: /marimo/streetwise. Driver: scripts/fork/robot/streetlife_loop.py. Current output: artifacts/fork/streetlife-multiple-shelters. Driver PID at launch was 30694; verify before relying on it. Log: .fork-runs/streetlife-multiple-shelters.log. W&B first round: https://wandb.ai/kaushik-siva88/Unitree%20G1/runs/h051m5wv.

Local backup now includes 31 cloud checkpoint/source/metric files under artifacts/fork/streetlife and artifacts/fork/streetlife-multiple-shelters. These partial snapshots exclude full replay files.

The 37-observation multiple-shelter task starts at 62.5% validation success. Round one reached 65,536 PPO steps but did not improve validation; the best checkpoint preserves the starting policy. Evaluation/failure mining follows. Do not claim emergency avoidance or camera recognition is implemented.

Next training investigation: reduce learning rate and improve rollout diversity; assess pure lateral/backward action options because the current five actions can overshoot shelters. Version any changed action/observation schema and preserve source snapshots. Mine only training seeds, never held-out tests. Do not start a duplicate cloud job without checking the existing process. Local private pairing helper: .fork-runs/pairing/connect.py. Read the marimo-pair skill before using notebook APIs; credentials stay private.

## Latest user request: emergency avoidance (pending implementation)

Teach the robot to avoid fallen people, accident scenes and unexpected hard debris. This request has been saved, but implementation had not begun before the restart checkpoint. Add plausible prone-human and concrete/rubble hazards, randomized onset and locations, safety clearance/foot-contact checks, and stopping/rerouting outcomes. Evaluate new unseen encounters with before/after evidence. Simulator-provided tracks are not learned camera perception; make that distinction explicit. Do not invent recognition capability.

Two authorized realism agents paused cleanly: web_city_realism (web buildings), central_avenue_finish (web-to-native transfer). Resume them in separate scopes after restart. Continue frequent commits/pushes and progress reports every five minutes. Expanded task approximately 80% complete. Do not resume SHOWROOM.
