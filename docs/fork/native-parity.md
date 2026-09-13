# Native Chennai transfer — September 13, 2026

The native MuJoCo scene now includes all nine finished neighboring OSM shells, their mineral plaster albedo, and the two source-visible Encaarpus roof dishes. This supersedes the earlier five-shell export. Neighbor revision 4 adds nine drainage stacks, 38 clamps, 36 parapet faces and 368 coping joints; the existing 354 framed windows and seven entries remain. These finishes are inferred architectural details, not surveyed facade measurements. The dish count and silhouettes have photo support; dimensions and mounting details remain inferred.

The export now retains inherited glazing, sills and other mapped building details to the same 90 m backdrop radius as their shells. Single-material boxes also now export all six faces: the earlier exporter mistakenly skipped five faces because it treated per-face geometry groups as separate materials. These fixes restore missing windows and fittings; other local scenery retains its 38 m cutoff.

The transfer contains 141 native meshes, 677,067 triangles and 28 textures including the road/verge albedo atlas. All eight neighboring facade material batches transferred, totaling exactly 56,976 triangles. Three plaster colors share the exported fine pigment texture. The two dish batches retain 960 nondegenerate triangles. Native lighting approximates the browser sun; browser normal maps, GTAO, shader weathering and exact tone mapping remain unavailable. Foliage alpha uses triangle trimming. Geometry outside the exported neighborhood remains incomplete.

The reproducible verifier matched 1,580,965 exported float32 vertices and 677,061 source triangles exactly. The vertex count includes two vertices repeated at mesh chunk boundaries. Preparation removed 128 degenerate triangles and added six backing triangles to two planar meshes for MuJoCo compilation. It preserved all six colliding geometries and the complete 37-action trajectory of the crossing policy on seed 20002: maximum joint-position difference **0.0**. Both runs succeeded without contact or falling, with minimum clearance 0.1907067394 m. This is a deterministic transfer check for one seed, not additional learning or a new benchmark.

The native and browser images use the same actual MuJoCo camera, resolution 1400×900, seed 20002 and time 3.0 seconds. The browser G1 uses the fresh native joint pose; its human uses the corresponding saved replay. Renderer differences are expected. The native capture was visually inspected for the animated human, bark texture, road/verge atlas, facade placement and cast shadows.

- [Native capture](../../artifacts/fork/media/native-mujoco.png)
- [Matched browser reference](../../artifacts/fork/media/native-browser-reference.png)
- [Machine-readable geometry and physics checks](../../artifacts/fork/media/native-verification.json)
- [Camera and native pose](../../artifacts/fork/media/native-camera.json)
- [Web revision 4 evidence](../districts/central-avenue-neighbors-revision-4.md)

Reproduce from the source development checkout, with Vite running on port 5188:

```sh
node scripts/fork/export-native-scene.mjs
.venv-fork/bin/python scripts/fork/robot/native_scene.py
.venv-fork/bin/python scripts/fork/robot/verify_native_scene.py
node scripts/fork/capture-native-reference.mjs
```

`STREETWISE_SOURCE_URL` overrides the browser URL; it must point to a development server exposing the Three.js module import. Use the full export for facade or fixture edits; `--buildings-only` refreshes only the merged map shells and flat roof surfaces. The exported manifest carries the source metadata and SHA-256 of the raw export. Raw export JSON is local under `.fork-runs/robot`; deployable meshes/textures and manifest are under `public/assets/fork/native-chennai`.
