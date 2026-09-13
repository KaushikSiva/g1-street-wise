# Public scenario testing

The public demo can execute fresh MuJoCo comparisons. Choose a scenario family and an integer seed, then select **Run both policies**. The server resets the same environment twice, once with the constant-forward baseline and once with the saved navigation policy. The browser displays the returned joint trajectories and outcomes. It does not train on visitor requests or append them to published benchmark results.

Families include pedestrian crossings, mixed traffic/road defects, rain/fog, crowded shelter navigation, and experimental fallen-person/debris/accident scenes. A seed determines the concrete encounter within a family. Before/After switching and playback remain available after completion. Recorded benchmark comparisons are also available for immediate playback.

The emergency policy is an interim checkpoint; its failures are shown without claiming mastery. Tracks come from the simulator and respect each environment's existing visibility rules. This is fresh simulation, not camera recognition or physical robot testing.

`live_server.py` serves the built frontend and a same-origin job API. A single physics worker and four total active/queued jobs bound resource use; finished results are kept temporarily in memory. No sponsor API keys, cloud training connection or persistent database are required. The Docker image includes CPU PyTorch, the pinned official Unitree walking assets, MuJoCo and saved PPO checkpoints. Native decorative meshes do not participate in training collision geometry.

`render.yaml` defines a free Docker web service with `/live-api/health` as its health check. The deployment does not modify other Render services. Automatic deployment is disabled so later experiment pushes do not silently change the public demo. Free service cold starts can delay the first request.

Local checks: `artifacts/fork/live-demo/api-check.json` and `browser-check.json`. They cover a real same-seed comparison, fresh trajectory playback, Before/After switching, rejected invalid seeds/cross-origin requests, and emulated mobile layout.

```sh
npm run build
.venv-fork/bin/python scripts/fork/live_server.py
# Open http://127.0.0.1:8192/?robot=1
node scripts/fork/verify-live-demo.mjs
```
