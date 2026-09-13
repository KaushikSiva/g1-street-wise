FORK working model

Visual thesis: a warm, restrained robotics workbench built around the existing Chennai street scene, with amber predictions and teal measured outcomes.
Content plan: project identity and scenario controls; one large 3D street workspace; three action previews; replay and forecast errors; an expandable evaluation report and provenance.
Interaction thesis: scrub synchronized imagined/actual trajectories, switch action branches, and animate a bounded training/evaluation cycle. Respect reduced motion and provide explicit pause.

Architecture: independent ?fork=1 entry reuses the mapped neighborhood and Central Avenue meshes. A deterministic synthetic simulator produces action-conditioned trajectories. A small ensemble of fitted random-feature regressors predicts future robot/pedestrian positions from a last-seen observation and proposed action/time horizon. Hidden simulator state is never given to the predictor. Training, promotion-validation and final evaluation seed sets are disjoint. Prediction metrics and simulator-scored decision outcomes are distinct.

No G1 controller or physical-robot safety validation. No claims about actual pedestrian behavior in Chennai. W&B telemetry is optional and requires separate credentials; all core runs and reports work locally.
