# STREETWISE — 118-second demo script

The finished video uses actual application screens and recorded MuJoCo joint trajectories. Narration is synthetic speech from Fish Audio, using its public South Indian Male voice; subtitles are included. All before/after comparisons use the same test seed and clearly labeled recorded simulation. The full 64-seed metrics are shown to avoid presenting a selected clip as the aggregate result.

| Time | Screen | Narration |
|---|---|---|
| 00–12 | Hero, Kanakadhara frontage, robot and parked van | Streets are harder than laboratories. A parked van can hide a pedestrian, and a robot that simply keeps walking can make the wrong decision. This is STREETWISE. |
| 12–27 | Before RL, pedestrian test, then freeze at violation | We recreated a Central Avenue encounter beside Kanakadhara in Chennai. First, an official Unitree walking policy follows a constant forward command. The pedestrian emerges, and the robot enters the clearance envelope. |
| 27–43 | Same seed after RL; replay completion | Now replay the same encounter with trained navigation. PPO has learned when to slow down and wait before proceeding. The walking policy itself stays frozen. Every robot joint you see comes from recorded MuJoCo physics. |
| 43–58 | Actual W&B learning graph and held-out comparison | These are actual training measurements from Weights and Biases. On sixty-four unseen pedestrian encounters, completed crossings rise from forty-two to sixty-four. Clearance violations fall from twenty-two to zero, with no robot falls. |
| 58–78 | Moving-car before/after, then recorded wet-road encounter | Training on a molab Blackwell GPU adds lateral movement, moving cars and road defects. Mixed-hazard completion rises from twenty-eight to sixty-four out of sixty-four. Rain changes ground friction; fog limits tracking range. The first weather test still has one failure. |
| 78–96 | Separate world-model run and update | A separate world-model lab predicts futures and learns from simulated experience, with Weave tracing its analyst. For robot training, a challenge ladder introduces harder conditions after two perfect validation checks. Test results never control advancement. |
| 96–108 | Actual native MuJoCo screenshot, simple architecture | Compare both policies side by side, or run live MuJoCo with Chennai geometry. Marimo, checkpoints, official SDK evidence and startup instructions make the results inspectable. |
| 108–118 | Closing image, repository URL, limits | This is simulation, not a physical robot safety claim. STREETWISE helps teams discover navigation mistakes before street deployment. Robots that learn the street before they enter it. |

## Live demo fallback
If cloud access is unavailable, the local viewer still replays the saved official joint trajectories and full test outcomes. It labels them as recorded simulation. Do not call these recordings a live robot session. The independent browser world model can still fit and evaluate locally without API keys.

## Final presentation edit

The delivered `STREETWISE-demo.mp4` is 120 seconds: approved content through 1:50, “Thank you” from 1:50–1:52, then a silent QR invitation from 1:52–2:00. The QR opens the deployed live scenario controls at https://streetwise-cppv.onrender.com/?robot=1&live=1 . The earlier script above documents the original narration source; `finalize_demo.py` produces this final edit. Captions and the extracted narration audio match the edited video.
