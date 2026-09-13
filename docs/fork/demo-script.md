# STREETWISE — 120-second demo script

The finished video uses actual application screens and recorded MuJoCo joint trajectories. Narration is synthetic speech from Fish Audio, using its public South Indian Male voice; subtitles are included. All before/after comparisons use the same test seed and clearly labeled recorded simulation. The full 64-seed metrics are shown to avoid presenting a selected clip as the aggregate result.

| Time | Screen | Narration |
|---|---|---|
| 00–12 | Hero, Kanakadhara frontage, robot and parked van | Streets are harder than laboratories. A parked van can hide a pedestrian, and a robot that simply keeps walking can make the wrong decision. This is STREETWISE. |
| 12–16 | User-supplied Chennai Street View image | We recreated a street in Chennai, India. |
| 16–27 | Recorded robot bumps into the pedestrian | At first, the robot just keeps walking. A person steps out from behind the van, and the robot bumps into them. |
| 27–43 | Same seed after RL; replay completion | Now replay the same encounter with trained navigation. PPO has learned when to slow down and wait before proceeding. The walking policy itself stays frozen. Every robot joint you see comes from recorded MuJoCo physics. |
| 43–58 | Actual W&B learning graph and held-out comparison | These are the original training results from Weights and Biases. Across sixty-four pedestrian tests, successful crossings rose from forty-two to sixty-four. The robot also learned to give people more space. |
| 58–78 | Moving-car before/after, then recorded wet-road encounter | Training on a molab Blackwell GPU adds lateral movement, moving cars and road defects. Mixed-hazard completion rises from twenty-eight to sixty-four out of sixty-four. Rain changes ground friction; fog limits tracking range. The first weather test still has one failure. |
| 78–96 | Separate world-model run and update | A separate world-model lab predicts futures and learns from simulated experience, with Weave tracing its analyst. For robot training, a challenge ladder introduces harder conditions after two perfect validation checks. Test results never control advancement. |
| 96–108 | Actual native MuJoCo screenshot, simple architecture | Compare both policies side by side, or run live MuJoCo with Chennai geometry. Marimo, checkpoints, official SDK evidence and startup instructions make the results inspectable. |
| 108–118 | Closing image, repository URL, limits | This is simulation, not a physical robot safety claim. STREETWISE helps teams discover navigation mistakes before street deployment. Robots that learn the street before they enter it. |

## Live demo fallback
If cloud access is unavailable, the local viewer still replays the saved official joint trajectories and full test outcomes. It labels them as recorded simulation. Do not call these recordings a live robot session. The independent browser world model can still fit and evaluate locally without API keys.

## Final presentation edit

The delivered `STREETWISE-demo.mp4` is 120 seconds: approved content with the Chennai image and plain-language edits through 1:50, “Thank you” from 1:50–1:52, then a silent QR invitation from 1:52–2:00. The QR opens the deployed live scenario controls at https://streetwise-cppv.onrender.com/?robot=1&live=1 . The earlier script above documents the original narration source; `finalize_demo.py` produces this final edit. Captions and the extracted narration audio match the edited video.

## Human-language revision

`humanize_demo.py` and `humanize-demo.mjs` replace only 12–27 and 43–58 seconds. The supplied Street View image is shown intact at 12–16 seconds, including Google attribution. Pedestrian seed 20002 has verified physical contact, so the narration says the robot bumps into the person. The updated metrics narration identifies the chart as the original training results; no new collision-free score is asserted. Remaining picture/audio content, the thank-you, and QR ending are retained. The prior approved video is archived in Git at revision `5fc9442` and locally in `.fork-runs/media/human-edit/STREETWISE-demo.mp4`.
