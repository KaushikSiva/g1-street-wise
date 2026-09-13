# STREETWISE — 118-second demo script

The finished video uses actual application screens and recorded MuJoCo joint trajectories. Narration is synthetic speech from macOS; subtitles are included. All before/after comparisons use the same test seed and clearly labeled recorded simulation. The full 64-seed metrics are shown to avoid presenting a selected clip as the aggregate result.

| Time | Screen | Narration |
|---|---|---|
| 00–12 | Hero, Kanakadhara frontage, robot and parked van | Streets are harder than laboratories. A parked van can hide a pedestrian, and a robot that simply keeps walking can make the wrong decision. This is STREETWISE. |
| 12–27 | Before RL, pedestrian test, then freeze at violation | We recreated a Central Avenue encounter beside Kanakadhara in Chennai. First, an official Unitree walking policy follows a constant forward command. The pedestrian emerges, and the robot enters the clearance envelope. |
| 27–43 | Same seed after RL; replay completion | Now replay the same encounter with trained navigation. PPO has learned when to slow down and wait before proceeding. The walking policy itself stays frozen. Every robot joint you see comes from recorded MuJoCo physics. |
| 43–58 | Actual W&B learning graph and held-out comparison | These are actual training measurements from Weights and Biases. On sixty-four unseen pedestrian encounters, completed crossings rise from forty-two to sixty-four. Clearance violations fall from twenty-two to zero, with no robot falls. |
| 58–78 | Moving-car before/after, road-defect avoidance | We then broadened training on a molab Blackwell GPU. The robot now chooses lateral movement as well as speed, facing moving cars and a marked road-defect zone. On the mixed held-out test, completion rises from twenty-eight to sixty-four out of sixty-four. |
| 78–96 | Three possible futures, run encounter, update model | A second experiment asks: what might happen next? The learned world model predicts three action-conditioned futures, compares its prediction with a separate simulator, and updates from experience. A Weave-traced analyst selects the training focus; validation controls promotion. |
| 96–108 | marimo graphs, SDK evidence, architecture | Marimo exposes the experiment and its evidence. The official Unitree SDK exchanges checked commands and feedback with simulated joints. Code, selected checkpoints and startup instructions are included, so judges can inspect and rerun the work. |
| 108–118 | Closing image, repository URL, limits | This is simulation, not a physical robot safety claim. STREETWISE helps teams discover navigation mistakes before street deployment. Robots that learn the street before they enter it. |

## Live demo fallback
If cloud access is unavailable, the local viewer still replays the saved official joint trajectories and full test outcomes. It labels them as recorded simulation. Do not call these recordings a live robot session. The independent browser world model can still fit and evaluate locally without API keys.
