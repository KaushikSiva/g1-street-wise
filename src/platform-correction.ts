/** Bounded geometric hypothesis for an inconsistent mapped boarding edge.
 * Raw OSM input is never mutated. This is NOT a surveyed correction.
 */
type Coordinate = { lat: number; lon: number };
type Point = { x: number; z: number };
type Element = { id: number; geometry?: Coordinate[]; [key: string]: unknown };
const origin = { lat: 13.0516624, lon: 80.2306892 };
const east = 111320 * Math.cos((origin.lat * Math.PI) / 180);
const project = (p: Coordinate): Point => ({
  x: (p.lon - origin.lon) * east,
  z: (origin.lat - p.lat) * 111320,
});
const geographic = (p: Point): Coordinate => ({
  lat: origin.lat - p.z / 111320,
  lon: origin.lon + p.x / east,
});
function distance(p: Point, line: Point[]) {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i],
      dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1),
      ),
    );
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz));
  }
  return best;
}
export function inferPlatformEdge<T extends { elements: Element[] }>(raw: T) {
  const platform = raw.elements.find((e) => e.id === 214598986);
  const track = raw.elements.find((e) => e.id === 240340276);
  if (
    !platform?.geometry ||
    platform.geometry.length !== 13 ||
    !track?.geometry
  ) {
    return {
      data: raw,
      correction: {
        applied: false,
        reason: "Expected source geometry unavailable",
      },
    };
  }
  const ring = platform.geometry.map(project),
    rail = track.geometry.map(project);
  // Validate the two intended western ring segments against this exact dataset.
  if (
    Math.abs(ring[0].z + 112.65584) > 0.1 ||
    Math.abs(ring[1].z + 192.617) > 0.1
  ) {
    return {
      data: raw,
      correction: {
        applied: false,
        reason: "Source geometry changed; re-audit required",
      },
    };
  }
  const samples: { z: number; westward: number; centerlineDistance: number }[] =
    [];
  const corrected: Point[] = [];
  function move(p: Point) {
    const smooth = (value: number) => {
      const t = Math.max(0, Math.min(1, value));
      return t * t * (3 - 2 * t);
    };
    const taper = smooth((p.z + 190) / 10) * smooth((-95 - p.z) / 20);
    let lo = 0,
      hi = 1.4 * taper;
    // Keep at least 0.25m beyond an assumed 1.62m coach half-envelope.
    for (let i = 0; i < 24; i++) {
      const middle = (lo + hi) / 2;
      if (distance({ x: p.x - middle, z: p.z }, rail) >= 1.872) lo = middle;
      else hi = middle;
    }
    const q = { x: p.x - lo, z: p.z };
    samples.push({
      z: p.z,
      westward: lo,
      centerlineDistance: distance(q, rail),
    });
    return q;
  }
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i],
      b = ring[i + 1];
    if (i !== 0 && i !== 11) {
      corrected.push(a);
      continue;
    }
    const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 1);
    for (let j = 0; j < count; j++) {
      const t = j / count;
      corrected.push(
        move({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }),
      );
    }
  }
  corrected.push({ ...corrected[0] });
  const data = {
    ...raw,
    elements: raw.elements.map((e) =>
      e === platform ? { ...e, geometry: corrected.map(geographic) } : e,
    ),
  };
  return {
    data,
    correction: {
      applied: true,
      platformWay: 214598986,
      trackWay: 240340276,
      status: "Inferred clearance-constrained edge; not surveyed",
      maxWestwardMeters: Math.max(...samples.map((s) => s.westward)),
      assumedCoachHalfEnvelopeMeters: 1.62,
      minimumTargetGapMeters: 0.25,
      minimumChangedCenterDistance: Math.min(
        ...samples
          .filter((s) => s.westward > 0.001)
          .map((s) => s.centerlineDistance),
      ),
      samples,
    },
  };
}
