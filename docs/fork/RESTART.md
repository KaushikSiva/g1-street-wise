# STREETWISE restart checkpoint

Saved September 13, 2026 after resuming work. Main workspace: `/Users/kaushiksivakumar/workspace/chennai-gta`. Publication checkout: `/Users/kaushiksivakumar/workspace/g1-street-wise`. Repository: https://github.com/KaushikSiva/g1-street-wise. Do not resume SHOWROOM.

## Latest public demo and scoring correction

Public URL: https://streetwise-cppv.onrender.com/?robot=1&live=1 . Render service `srv-dajf0h0jo6nc73dk2880` is free, automatic deployment disabled. Private CLI is `.fork-runs/render-cli/cli_v2.28.0`; use its authenticated workspace and never print credentials. Publish only this service. The latest deploy adds strict-contact traffic and rain-onset shelter policies; check deployment status before claiming a commit is live.

Recorded seed 20002 contacted the car with its left hand but the original center-clearance scoring missed it. Original 64/64 claims below are historical under that scoring definition. The three original public replay datasets now contain a 50 Hz physical-contact audit with original outcomes retained. Fresh scoring checks contacts at 500 Hz, latches failure, and adds two seconds of physical continuation. A side brush may not cause a fall; a direct same-speed impact does in the diagnostic.

New traffic checkpoint `artifacts/fork/rl-hazards-contact-v2/best.zip`: 60/64 strict-scoring test successes versus 41/64 for the old policy under the same checks. Seed 20002 now succeeds, no contact, minimum clearance 0.516 m. Four failures remain. New shelter checkpoint `artifacts/fork/rain-shelter-v3/best.zip`: 56/64 reaches cover and stops, eight timeouts, zero contacts/falls. Rain onset is randomized at 0–3 seconds, with lateral/backward actions and an exposure penalty. It uses simulator tracks, not RGB.

Camera experiment: `vision.py`, `vision_network.py`, and `train_vision.py`. Input is two 96×64 RGB frames and own proprioception, with no world xy or actor/goal coordinates. Joint imitation/perception pretraining, then end-to-end PPO. Disjoint training/validation/test layouts and blank-image ablation. Local output `artifacts/fork/vision-v1`, log `.fork-runs/vision-v1.log`; final test is 0/16 shelter completions (all timeouts, no contacts/falls), also 0/16 with blank images. No useful generalization is demonstrated. This experimental policy is not the state-input policy served publicly.

Typed runtime API validation handles empty/truncated/non-JSON responses. Recent fresh runs sort newest first and filter strict-contact passing outcomes, showing checkpoint SHA and scoring version. Server restarts were caused by 879 MiB runtime mesh-compilation peaks. Docker precompiles `.mjb` scenes and uses NumPy to execute unchanged gait/navigation weights; measured startup peaks 237–329 MiB. Public mesh files use gzip and loading retries.

Final video and QR are in `artifacts/fork/media` and Desktop/STREETWISE Demo: first 110 seconds retained, thank-you 110–112 seconds, silent QR 112–120 seconds. QR points to the public live controls. Original benchmark narration predates the contact audit; README discloses that. Video/QR decode verification passed.

## Local launch

```sh
cd /Users/kaushiksivakumar/workspace/g1-street-wise
npm run build
.venv-fork/bin/python scripts/fork/start.py
```

Demo: http://127.0.0.1:5189/?robot=1. Synchronized comparison: http://127.0.0.1:5189/?compare=1. Local marimo lab: http://127.0.0.1:2718. Native MuJoCo: double-click `Launch STREETWISE MuJoCo.command` in Desktop/STREETWISE Demo, or run `.venv-fork/bin/mjpython scripts/fork/robot/viewer.py --chennai --policy after --seed 20002`. Space pauses; R restarts. Local services stop when the laptop restarts.

## Cloud connection

Cloud notebook: https://molab.marimo.io/notebooks/nb_gK678riXiVKWuUAnQjffef. Private pairing helper: `.fork-runs/pairing/connect.py`. Read the marimo-pair skill before notebook APIs. Credentials stay private. A laptop restart does not intentionally stop cloud jobs, but continuation requires the cloud session to remain alive.

Original shelter root `/marimo/streetwise`; driver `scripts/fork/robot/streetlife_loop.py`; output `artifacts/fork/streetlife-multiple-shelters`; log `.fork-runs/streetlife-multiple-shelters.log`. Emergency root and processes are described below. Check actual commands before relying on saved PIDs; never start a duplicate job.

## Preserved benchmark evidence

Original navigation PPO uses actual MuJoCo and the frozen official Unitree LSTM gait. Gait weights are not fine-tuned. Original pedestrian and mixed-hazard final tests each reached 64/64 successful encounters. Weather refinement has a measured 63/64 to 64/64 improvement. Those results do not describe the harder shelter/emergency curricula. Retaining a starting checkpoint is not a further gain.

## Current resumed state


Local preview, experiment service and marimo lab were restarted from the publication checkout. Browser comparison passed synchronized time/seed, pause and mobile layout checks. The source development server also runs on 5188.

The original shelter driver survived the laptop restart (PID 30694, verified by command). Round two completed with **23/64 starting-policy to 31/64 selected-policy successes on the same unseen seeds**, clearance violations 19 to 9, and zero falls. It mined 34 training failures and began round three. W&B round two: https://wandb.ai/kaushik-siva88/Unitree%20G1/runs/0c0dsvp9. These measurements do not establish mastery.

Emergency curriculum v1 is implemented: collidable prone-human and rigid-rubble geometry; combined accident scenes; randomized onset/position/orientation; range/van-occlusion-limited simulator tracks; conservative body clearance and actual foot-contact checks; deliberate safe stops near observed accident scenes. It has 57 observations/eight velocity options, including pure lateral/backward commands. Base Unitree gait is unchanged. This emergency checkpoint has no camera input; the separate camera experiment is described above. See `docs/fork/emergencies.md` and `artifacts/fork/emergencies-v1/behavior-checks.json`. All executable behavior checks passed; native baseline seed 10 violates emergency clearance at four seconds.

A separate continuous emergency driver was launched in **/marimo/streetwise-emergencies-v1**, PID **37581** at launch (verify the command before relying on this). Its vendor and private .env are linked to the original cloud project; sources/output are independent. Log `.fork-runs/emergencies-v1.log`, output `artifacts/fork/emergencies-v1`. First W&B run: https://wandb.ai/kaushik-siva88/Unitree%20G1/runs/x3p0xav5. Each round runs 32,768 PPO steps with learning rate 0.00003, entropy 0.008, validation/test offsets beginning 9,100,000, and training-only failure mining. Initial validation measured 3/32 successes for constant forward motion and 4/32 for the transferred policy. Training is ongoing; no emergency learning gain is claimed. Do not launch a duplicate emergency or shelter job. Cloud notebook now has an emergency/shelter progress table and refresh control.

Local cloud backup refreshed with 64 checkpoint/source/metric files; full replay files excluded. Private snapshot helpers: `.fork-runs/pairing/resumed-snapshot.py` and `connect.py`. Read marimo-pair before notebook APIs. To reproduce the emergency viewer after training, use a downloaded matching 57-observation/eight-action checkpoint; the old 37-observation shelter policy is incompatible without transfer.

Web realism revision 4 finishes the same nine mapped shells with inferred parapet plaster, coping joints and rainwater stacks (56,976 triangles/eight batches). Map count stays 1,173. Native transfer now includes all nine shells, the two roof dishes, textures and corrected missing glazing faces. Native parity passed: exact exported geometry and unchanged crossing seed 20002 trajectory, maximum joint-position difference 0.0. See `docs/fork/native-parity.md`. Both realism agents completed their bounded resumed batches. Native lighting/shader differences remain; mobile performance parity is unproven under concurrent local load.

## Next work

Continue checking the existing cloud jobs, back up newly completed rounds, and inspect training-only failures. Emergency camera recognition remains unimplemented. Preserve schema/source/checkpoint provenance for any future changes. Finish a measured emergency before/after comparison only after its round completes; do not substitute the behavior checks or an initial-policy replay for learned improvement. Keep commits/pushes and regular progress updates as previously requested.

At the first 8,192-step emergency check, validation completion was 5/32 (starting policy 4/32), with 22 total clearance violations, 17 emergency-envelope violations and one actual foot contact. No successful accident stops were measured. These are interim validation results, not final unseen-test evidence or a solved task.

The local 118-second MP4 was refreshed from actual application capture with the latest native scene and saved naturally paced Fish Audio narration. H.264/AAC 1920×1080 encoding and full decode passed. Desktop/STREETWISE Demo has the refreshed MP4, captions, narration, script and this checkpoint.

## Human-language video edit

The final demo now shows the user-supplied Chennai Street View image at 12–16 seconds, then says the robot bumps into a person. Spoken clearance jargon in the results segment is replaced with plain language about giving people space. Edits cover 12–27 and 43–58 seconds; other content, thank-you at 110–112, and QR at 112–120 are preserved. Scripts: `humanize_demo.py`, `humanize-demo.mjs`, `verify_human_edit.py`. Verification: `artifacts/fork/media/human-edit-verification.json`.
