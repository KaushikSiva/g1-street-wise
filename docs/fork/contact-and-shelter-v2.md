# Collision scoring and rain response

The September 13 audit found that recorded car seed 20002 physically touched the robot's left hand even though the old center-clearance score remained positive. The G1 stayed upright. The diagnostic also produces a fall when the same-speed car directly strikes the robot; falls are simulated outcomes, not scripted animations. Upper-body joints are fixed in this official 12-DoF model, and the car follows a kinematic path, so this is not validated vehicle-impact biomechanics.

Fresh scoring now checks physical robot/obstacle contacts at every 2 ms physics step. Contact, clearance violation, fall, off-road movement, and timeout cannot count as success. Failed live runs continue for two seconds under the last command to show the physical response. Their original scored outcome remains failed. Recorded trajectories were separately audited at 50 Hz; original scores are retained as provenance. The original demo video's benchmark narration reflects the earlier center-clearance definition.

## Retrained traffic

The previously selected navigation policy was evaluated under strict contact scoring, then refined for 32,768 PPO steps. Training uses seeds 1–8999; validation seeds 10001–10032 select a checkpoint. The fixed 64-seed evaluation set (20001–20064) is used only after selection. It is the same historical test set, not a newly untouched benchmark after the user-reported diagnosis.

| Policy | Successful tasks | Violations | Falls |
|---|---:|---:|---:|
| Constant forward | 6/64 | 58 | 0 |
| Previous navigation checkpoint | 41/64 | 23 | 0 |
| Selected retrained navigation | 60/64 | 4 | 0 |

The selected checkpoint passes 20002 with no physical contact and minimum center-envelope clearance 0.516 m. Remaining failures: 20011, 20023, 20034, 20056. The public actor exports have zero action mismatches against PPO on 1,024 random observations. Live simulations use the exported official gait weights through NumPy; small floating-point differences can change trajectories.

## Rain onset and shelter

The old weather task rewarded completing the crossing on wet roads. The new version starts dry, randomizes rainfall onset between zero and three seconds, changes road friction at onset, and switches the goal to cover. It penalizes exposure and requires the robot to remain under the roof with speed below 0.18 m/s for at least 0.8 seconds. Moving through a building or contacting a car is a failure. Cover positions are inferred simulation geometry, not surveyed building entrances.

Training uses 64 scripted demonstrations from training-only seeds, action imitation, then 16,384 PPO steps. The learned policy—not the demonstration script—runs at inference. On 64 test encounters, the selected checkpoint reaches shelter in 56, times out in eight, and records no contacts or falls. It uses simulator tracks and shelter coordinates; it is separate from the experimental camera policy.

Artifacts: `artifacts/fork/rl-hazards-contact-v2`, `artifacts/fork/rain-shelter-v3`, and `artifacts/fork/live-demo/{recorded-contact-audit,safety-v2-check,car-impact-diagnostic}.json`.
