# Central Avenue neighbors: construction finish, revision 4

September 13, 2026. This batch finishes the same nine stored OSM shells as [the existing neighbor study](central-avenue-neighbors.md). It adds no buildings, tenancy claims, surveyed heights or observed drainage routes. The named photo-informed facades are outside this module's scope.

The inherited roof parapets now receive the same fine mineral-plaster surface as the walls. This follows their existing 780 mm height and inset exterior face; it does not grow the roof outline. Small mortar joints divide the existing coping into approximately 1.5 m lengths. Nine pale rainwater stacks occupy blank corner margins on the road-facing edges, with curved upper and lower bends, open discharge shoes and actual metal clips/backplates. The 90 mm pipe diameter, service routes, clamp spacing and coping construction are inferred architectural choices. No functioning drainage system or below-ground connection is modeled.

The nine shells retain 354 window assemblies and seven closed entries. The batch adds nine stacks, 38 clamps, 36 parapet face finishes and 368 coping joints. The neighbor group has 56,976 triangles, up from 44,508, and still uses eight merged meshes/material batches. Existing wall finish UVs remain in metres; the plaster extends continuously in height onto parapets.

Verification used the source checkout at `http://127.0.0.1:5188/?robot=1`. `npm run build` passed (the existing large-chunk advisory remains). Actual browser geometry contains only finite vertices. The overall building count remains 1,173 and the stored map SHA-256 is unchanged: `a5b62fe3d269c998b32e74d77aa5dbe3e149cf6fffd0a3cdf07a45cde110013d`. Desktop and emulated 390×844 captures produced no page errors or horizontal overflow.

Matched before/after evidence and its reproducible capture script are in `artifacts/web-city-realism/revision-4/`:

- `before-street.png` / `after-street.png`: retained demonstration camera.
- `before-neighbor.png` / `after-neighbor.png`: same mapped building and adjacent row, showing full stack and roof termination.
- `before-construction.png` / `after-construction.png`: same close view of actual pipe and bracket depth.
- `before-mobile.png` / `after-mobile.png`: emulated mobile layout.
- `before-verification.json` / `after-verification.json`: actual scene counts, map hash, exact camera poses, errors and timing samples.
- `source-before.ts`: revision 3 source snapshot for auditing this batch.
- `capture.mjs`: capture and browser verification procedure (`node artifacts/web-city-realism/revision-4/capture.mjs after`).

The 45-frame mobile timing samples were 33.4/50.0 ms median/p90 before and 49.9/50.1 ms after while other resumed work was active on this Mac. Those samples are too variable to establish performance parity, and the median is slower; no performance improvement or physical-phone frame-rate claim is made. The extra geometry is bounded and merged, but an isolated performance comparison remains appropriate before claiming a mobile performance pass.

This is a construction-plausibility finish, not a photographed reconstruction. Unmapped properties still require references. The native transfer agent was notified of the frozen revision 4 source after the build and browser checks; native verification is reported separately.
