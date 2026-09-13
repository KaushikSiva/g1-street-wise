# Perception training experiment

`CameraStreet` supplies two consecutive 96×64 RGB images from a robot-mounted MuJoCo camera and eight proprioceptive values. It does not supply world x/y coordinates, actor locations or velocities, condition labels, shelter coordinates, depth, or segmentation to the policy. The robot's own velocity remains a proprioceptive measurement.

The convolutional encoder is trained, not a decorative camera. Training first combines navigation imitation with visible-object presence/bounding-box supervision. The labels are generated from segmentation during training only. PPO subsequently updates the image encoder and navigation policy through environment rewards. The frozen Unitree gait remains unchanged.

The initial experiment uses 2,048 camera samples, 12 imitation epochs, and 8,192 PPO steps. Parking/occlusion layouts 0–2 are training layouts, layout 3 is validation only, and layouts 4–5 are test only. Colors, facade heights, lighting, rain onset, and wet-road friction vary. After validation selects a checkpoint, it is evaluated on held-out layouts with both real input images and blank images. The task includes physical collision checks and rain-to-shelter stopping.

These are synthetic low-resolution camera images of simplified geometry. They are not the decorative web camera view, real Chennai imagery, or evidence of real-world generalization. The experiment is separate from the reliable state-input shelter policy served in the public demo. Check `artifacts/fork/vision-v1/evaluation.json` for final measured outcomes; no mastery is assumed.

```sh
.venv-fork/bin/python scripts/fork/robot/train_rain.py
.venv-fork/bin/python scripts/fork/robot/train_vision.py --samples 2048 --steps 8192
```

## Initial measured result

The selected checkpoint completed **0/16 held-out shelter tasks**, with zero contacts or falls; all trials timed out. Blank-image evaluation also completed 0/16. Mean return was −22.96 with camera images and −26.84 with blank images. This difference does not establish useful visual generalization. The training pipeline works, but the first policy is not ready to replace the state-input live policy. We retain the checkpoints, learning history, and failed evaluations rather than presenting it as a successful vision controller.
