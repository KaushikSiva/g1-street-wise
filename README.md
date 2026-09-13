![STREETWISE beside Kanakadhara](artifacts/fork/media/human-kanakadhara.png)

# STREETWISE

We recreated a street in Chennai to see how a robot learns to handle everyday situations: a person stepping out from behind a parked van, a car crossing its path, or rain starting while it is outside.

The robot already knows how to walk. STREETWISE trains it to decide when to wait, where to move and how to reach shelter. It practises in simulation, makes mistakes, and learns from what happens.

You can choose a scenario, watch the robot respond, and compare its behaviour before and after training.

[Try it on Render](https://streetwise-cppv.onrender.com/?robot=1&live=1) · [Open the marimo notebook](https://molab.marimo.io/notebooks/nb_gK678riXiVKWuUAnQjffef)

## How it works

Unitree's walking controller moves the robot's legs. PPO, a reinforcement learning algorithm, learns the navigation decisions through repeated attempts in MuJoCo. The current navigation policies use information from the simulator about the robot and its surroundings.

Weights & Biases tracks training and evaluation results. Weave records the AI agent's curriculum analysis. marimo brings the code and results together in an interactive notebook where we run and inspect experiments.

## Tech stack

Weights & Biases, Weave, marimo, MuJoCo, PPO, Stable-Baselines3, Gymnasium, Python, PyTorch, NumPy, Unitree RL Gym, Unitree SDK2, molab, TypeScript, Three.js, Vite, MapLibre GL, Docker, Render
