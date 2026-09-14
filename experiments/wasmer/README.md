# Wasmer scenario experiment

An independent STREETWISE experiment that runs Python scenario generators inside
Wasmer, validates the returned JSON, and evaluates the scenarios in native MuJoCo.
It does not change the live demo, train or promote a policy, deploy, or publish.

The optional AI author uses the project's existing W&B inference configuration.
The default uses an explicitly labelled bundled example; it does not pretend an
LLM wrote it. Every run saves the source, input, source hash, sandbox metadata,
validated scenarios, checkpoint hashes, simulation results and a local trace.

## Install once

Run from the STREETWISE repository root after completing the Python setup in
the main README:

```sh
.venv-fork/bin/python -m venv .fork-runs/wasmer-venv
.fork-runs/wasmer-venv/bin/python -m pip install -r experiments/wasmer/requirements.txt
```

Wasmer SDK 0.2.1 is isolated from the simulation environment. The pinned guest
runtime is `python/python@=3.13.18`. The first run downloads and compiles the
runtime; subsequent runs reuse `.fork-runs/wasmer-cache`. The trusted SDK needs
internet access to obtain runtime packages; the guest generator has no network.

## Run

```sh
# No API key: bundled generator → real Wasmer → three MuJoCo comparisons.
.venv-fork/bin/python experiments/wasmer/run.py

# Have W&B inference write the generator, then execute and evaluate it.
.venv-fork/bin/python experiments/wasmer/run.py --agent

# Give the author actual results from a previous run.
.venv-fork/bin/python experiments/wasmer/run.py --agent --feedback PATH_TO_REPORT_JSON

# Test your own generator in the sandbox.
.venv-fork/bin/python experiments/wasmer/run.py --generator path/to/generator.py

# Generate and validate without starting MuJoCo.
.venv-fork/bin/python experiments/wasmer/run.py --generate-only --count 2 --seed 731
```

`--agent` reads `WANDB_API_KEY`, `WANDB_ENTITY`, `WANDB_PROJECT` and
`WANDB_INFERENCE_MODEL` from the private root `.env`. Only the host calls the
inference API. Keys are not passed into the worker or guest. Inference may incur
normal provider charges. No W&B metric upload or Weave upload is enabled by this
experiment: `trace.json` and results stay local.

The command prints the report location under `.fork-runs/wasmer-experiment/`.
Each run gets a new directory. `generator.py` in that directory is untrusted
source: rerun it using `--generator`, never with host Python. A failed generation
stops before physics, records the failed stage, and returns a nonzero exit code.
There is no fallback to host execution or a bundled generator in agent mode.

## Data boundary

The guest receives the request through `/workspace/request.json` and stdin.
It must print exactly one JSON object:

```json
{"version":1,"scenarios":[{"seed":711,"car_speed":2.5,"car_start_y":-10.0,"crossing_x":0.6}]}
```

Only car crossing is supported in this first experiment. Speeds are metres per
second; positions are metres in the existing street coordinate system. Allowed
ranges are speed 1–3.5, starting y −14 to −7 and crossing x 0.4–1.2. Each batch
contains 1–8 unique training seeds from 1–8999. The seed and all explicit
parameters together identify the scenario. No benchmark seeds or scoring,
checkpoint, reward, filesystem or shell-command fields are accepted.

The SDK uses a private virtual filesystem, explicit disabled networking and no
host mounts. Guest execution is limited to 10 seconds and 64 KiB of output; the
host kills a stuck worker after 180 seconds, including package setup. This SDK
integration does not currently impose a separate per-guest memory quota.

The trusted simulator adapter applies the validated values after reset, refreshes
MuJoCo state and observations, then runs the baseline and the selected
`rl-hazards-contact-v2` policy from identical initial states. Physical contacts are
checked every 2 ms. The report records the actual starting car position, speed,
robot pose and observation for both runs. Generated challenges are exploratory
training inputs, not a new held-out benchmark or evidence of learning.

## Verify

```sh
.venv-fork/bin/python experiments/wasmer/test_integration.py
```

These tests use the real SDK and real physics. They check repeatable generation,
blocked host file/environment/network access, an infinite loop, excessive output,
nonzero guest exits, malformed JSON, invalid scenario fields/ranges, and that
validated parameters actually reach MuJoCo with identical before/after starts.

Reference: https://docs.wasmer.io/runtime/python/

## Demo video chapter

The video scripts reproduce the recorded Wasmer chapter using an actual AI-authored
run. They require the main repository's media assets, Node dependencies, installed
Chrome, FFmpeg/FFprobe, and Python `requests`, `python-dotenv`, `opencv-python` and
`numpy`. Narration uses `FISH_AUDIO_API_KEY` from the private `.env`.

```sh
node experiments/wasmer/video-cards.mjs PATH_TO_REPORT_JSON
.venv-fork/bin/python experiments/wasmer/video.py
.venv-fork/bin/python experiments/wasmer/verify_video.py
```

The narration describes the recorded three-scenario passing run; the card builder
rejects reports that do not match those results. Use that run's report, or update
the narration and cards together for different outcomes. Cards and evidence are
written to `.fork-runs/media/wasmer-edit/`. The 140-second output keeps the original
first 110 seconds, adds Wasmer at 110–130 seconds, and ends with the existing
thank-you and QR. Verification checks video decoding, preserved picture/audio and
the QR destination, and copies the extended cut to `~/Desktop/STREETWISE Demo/`.
