FROM node:24-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM python:3.12-slim-bookworm
WORKDIR /app
ENV STREETWISE_NUMPY_GAIT=1 HOST=0.0.0.0 PYTHONUNBUFFERED=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MPLBACKEND=Agg
RUN apt-get update && apt-get install -y --no-install-recommends git libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY scripts/fork/live-requirements.txt /app/live-requirements.txt
RUN pip install --no-cache-dir -r live-requirements.txt
RUN git clone --filter=blob:none --no-checkout https://github.com/unitreerobotics/unitree_rl_gym.git vendor/unitree_rl_gym && \
    git -C vendor/unitree_rl_gym sparse-checkout set deploy/pre_train/g1 deploy/deploy_mujoco resources/robots/g1_description && \
    git -C vendor/unitree_rl_gym checkout 276801e46c5d433564f24658bac64f254b7d2d4b && \
    rm -rf vendor/unitree_rl_gym/.git
COPY scripts/fork/robot ./scripts/fork/robot
COPY artifacts/fork/live-demo/gait.npz ./artifacts/fork/live-demo/gait.npz
COPY scripts/fork/live_server.py ./scripts/fork/live_server.py
COPY artifacts/fork/rl-corridor-v2/best.zip ./artifacts/fork/rl-corridor-v2/best.zip
COPY artifacts/fork/rl-hazards-v2/best.zip ./artifacts/fork/rl-hazards-v2/best.zip
COPY artifacts/fork/rl-weather/best.zip ./artifacts/fork/rl-weather/best.zip
COPY artifacts/fork/streetlife-multiple-shelters/round-002/best.zip ./artifacts/fork/streetlife-multiple-shelters/round-002/best.zip
COPY artifacts/fork/emergencies-v1/round-001/best.zip ./artifacts/fork/emergencies-v1/round-001/best.zip
COPY artifacts/fork/rl-corridor-v2/best.npz ./artifacts/fork/rl-corridor-v2/best.npz
COPY artifacts/fork/rl-hazards-v2/best.npz ./artifacts/fork/rl-hazards-v2/best.npz
COPY artifacts/fork/rl-weather/best.npz ./artifacts/fork/rl-weather/best.npz
COPY artifacts/fork/streetlife-multiple-shelters/round-002/best.npz ./artifacts/fork/streetlife-multiple-shelters/round-002/best.npz
COPY artifacts/fork/emergencies-v1/round-001/best.npz ./artifacts/fork/emergencies-v1/round-001/best.npz
COPY --from=frontend /app/dist ./dist
COPY scripts/fork/compress_assets.py ./scripts/fork/compress_assets.py
RUN python scripts/fork/compress_assets.py
RUN mkdir -p .fork-runs/robot && useradd --uid 10001 --no-create-home streetwise && chown -R streetwise:streetwise /app/.fork-runs
USER streetwise
EXPOSE 10000
CMD ["python", "scripts/fork/live_server.py"]
