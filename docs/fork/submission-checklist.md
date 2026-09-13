# STREETWISE — submission acceptance checklist

Source: [participant handbook](https://wandbai.notion.site/CoreWeave-Hacks-Participant-Handbook-3c9e2f5c7ef380eab21ecdde12620caf), read 2026-09-13. Its June 6–7 dates appear stale; the user requests its submission requirements. Use a 118-second video to satisfy “less than 2 mins”.

## Required deliverables
- [x] Official Unitree SDK integration exercised against simulation; official pretrained G1 policy executed.
- [x] Actual RL training and measurable held-out before/after improvement, clearly separated from frozen pretrained locomotion.
- [x] Central Avenue testing scene, photographic references and actual robot geometry; all recorded motion from simulator state.
- [x] Reproducible startup, dependencies, assets, credentials template, training/checkpoint/evaluation commands.
- [x] W&B Models training graphs and run URLs; Weave traces of agent loop.
- [x] marimo interactive experiment notebook with actual data and comparisons.
- [ ] 118-second MP4 including problem, before/after, W&B graphs and explanation, plus narration script and captions.
- [ ] Public GitHub publication package, repository URL or judge access instructions.
- [x] 2–3 sentence summary, utility, architecture, RL environments, sponsor tools/protocols, prior work disclosure.
- [ ] Unique team name, member names, social handles; AGI House account + participant survey for each member (user supplied).
- [ ] Track: Best Use of Weave and/or marimo; Best Loop Design automatic. Claim ARIA only if actually used.
- [x] One or two presentation slides for optional 3-minute live demo.

## User-owned submission actions
AGI House participant surveys and in-person eligibility cannot be completed or claimed by this agent. Do not submit until all account/team details are real and final assets are reviewed. No messages or social posts without explicit instruction.

## Existing work disclosure
The Chennai map, OSM footprints and photo-informed facade modeling predate the hackathon. STREETWISE adds robot simulation, learning loop, evaluation, sponsor instrumentation, notebook and demonstration. Unitree pretrained policy and robot model are third-party upstream assets with attribution; do not claim training that base policy from scratch.

## Verified access
macOS Apple Silicon local application and full fresh-checkout setup passed. A paired molab RTX PRO 6000 Blackwell ran actual PPO training with CUDA; physics and the frozen Unitree gait ran on CPU. Private credentials are excluded from the publication. No physical robot connected.
