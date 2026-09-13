import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Point = { x: number; z: number };
type Way = {
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};
const east = 111320 * Math.cos((13.0516624 * Math.PI) / 180);
const local = (p: { lat: number; lon: number }): Point => ({
  x: (p.lon - 80.2306892) * east,
  z: -(p.lat - 13.0516624) * 111320,
});

/** Clip a perimeter-wide pattern to one outline segment without restarting it. */
function* edgePattern(offset: number, length: number, pitch: number, gap = 0) {
  const end = offset + length;
  for (let index = Math.floor(offset / pitch); index * pitch < end; index++) {
    const start = Math.max(offset, index * pitch + gap / 2),
      stop = Math.min(end, (index + 1) * pitch - gap / 2);
    if (stop - start > 1e-8)
      yield { index, distance: (start + stop) / 2 - offset, length: stop - start };
  }
}

function clip(a: Point, b: Point, radius: number): [Point, Point] | undefined {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    aa = dx * dx + dz * dz;
  if (aa < 0.0001) return;
  const bb = 2 * (a.x * dx + a.z * dz),
    cc = a.x * a.x + a.z * a.z - radius * radius;
  const discriminant = bb * bb - 4 * aa * cc;
  if (discriminant < 0) return;
  const lo = Math.max(0, (-bb - Math.sqrt(discriminant)) / (2 * aa));
  const hi = Math.min(1, (-bb + Math.sqrt(discriminant)) / (2 * aa));
  if (hi <= lo) return;
  return [
    { x: a.x + dx * lo, z: a.z + dz * lo },
    { x: a.x + dx * hi, z: a.z + dz * hi },
  ];
}

function grainTexture(contrast: number): THREE.DataTexture {
  const width = 128,
    pixels = new Uint8Array(width * width * 4);
  let seed = 731;
  for (let i = 0; i < width * width; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const n = Math.round(255 - (seed / 4294967296) * contrast);
    pixels.set([n, n, n, 255], i * 4);
  }
  const texture = new THREE.DataTexture(pixels, width, width);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(0.38, 0.38);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** OSM platform polygons/rail centerlines. Fine construction, heights and gantry positions inferred. */
export function buildRailway(
  data: any,
  options: { trackExtent?: "station" | "source" } = {},
): THREE.Group {
  const sourceExtent = options.trackExtent === "source";
  const trackKinds = new Set(["ballast beds", "concrete sleepers", "rail webs", "rail heads", "contact wires", "messenger wires", "wire droppers"]);
  const batchKey = (name: string, z: number) => sourceExtent && trackKinds.has(name)
    ? `${name} · corridor chunk ${Math.floor(z / 128)}` : name;
  const group = new THREE.Group();
  group.name = "Mapped railway · inferred construction details";
  const ways: Way[] = data?.elements ?? [];
  const groundGrain = grainTexture(38),
    ballastGrain = grainTexture(135);
  const concrete = new THREE.MeshStandardMaterial({
    color: 0x9b978b,
    roughness: 0.98,
    map: groundGrain,
    bumpMap: groundGrain,
    bumpScale: 0.012,
  });
  const ballast = new THREE.MeshStandardMaterial({
    color: 0x696358,
    roughness: 1,
    map: ballastGrain,
    bumpMap: ballastGrain,
    bumpScale: 0.09,
  });
  const sleeper = new THREE.MeshStandardMaterial({
    color: 0x7e7b70,
    roughness: 0.95,
    map: groundGrain,
  });
  const red = new THREE.MeshStandardMaterial({
    color: 0x9b6a57,
    roughness: 0.92,
  });
  const cream = new THREE.MeshStandardMaterial({
    color: 0xc7b496,
    roughness: 0.94,
  });
  const yellow = new THREE.MeshStandardMaterial({
    color: 0xc8ad49,
    roughness: 0.9,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: 0x787b74,
    metalness: 0.55,
    roughness: 0.53,
  });
  const rust = new THREE.MeshStandardMaterial({
    color: 0x655244,
    metalness: 0.6,
    roughness: 0.7,
  });
  const cable = new THREE.MeshStandardMaterial({
    color: 0x302f2a,
    metalness: 0.5,
    roughness: 0.72,
  });
  const roofMetal = new THREE.MeshStandardMaterial({
    color: 0x8b9898,
    metalness: 0.45,
    roughness: 0.67,
    side: THREE.DoubleSide,
    map: groundGrain,
  });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const batches = new Map<
    string,
    { material: THREE.Material; matrices: THREE.Matrix4[] }
  >();
  const dummy = new THREE.Object3D(),
    unitY = new THREE.Vector3(0, 1, 0);
  const platformGeometry: THREE.BufferGeometry[] = [];
  let platformCount = 0,
    trackLength = 0,
    sleeperCount = 0,
    gantryCount = 0;
  const canopyWayIds: number[] = [];
  const detailedTrackWayIds: number[] = [];
  const trackCoverage: { wayId: number; sourceLengthMeters: number; detailedLengthMeters: number; gaugeMeters: number }[] = [];
  function add(
    name: string,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    angle = 0,
  ) {
    name = batchKey(name, z);
    if (!batches.has(name)) batches.set(name, { material, matrices: [] });
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, angle, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    batches.get(name)!.matrices.push(dummy.matrix.clone());
  }
  function beam(
    name: string,
    material: THREE.Material,
    a: THREE.Vector3,
    b: THREE.Vector3,
    width: number,
  ) {
    name = batchKey(name, (a.z + b.z) / 2);
    if (!batches.has(name)) batches.set(name, { material, matrices: [] });
    const direction = b.clone().sub(a),
      length = direction.length();
    dummy.position.copy(a).add(b).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(unitY, direction.normalize());
    dummy.scale.set(width, length, width);
    dummy.updateMatrix();
    batches.get(name)!.matrices.push(dummy.matrix.clone());
  }
  const tracks: Point[][] = [];
  for (const way of ways) {
    if (!way.geometry || way.geometry.length < 2) continue;
    const tags = way.tags ?? {},
      points = way.geometry.map(local);
    // These explicit building=roof polygons cover the mapped island platform.
    // Do not infer station identity for roofs elsewhere in the neighborhood.
    if (
      tags.building === "roof" &&
      [214599003, 214599063].includes(way.id) &&
      points.length === 5
    ) {
      const corners = points.slice(0, 4);
      const firstLength = Math.hypot(
        corners[1].x - corners[0].x,
        corners[1].z - corners[0].z,
      );
      const secondLength = Math.hypot(
        corners[2].x - corners[1].x,
        corners[2].z - corners[1].z,
      );
      if (firstLength > secondLength) corners.push(corners.shift()!);
      const [a, b, c, d] = corners;
      const start = new THREE.Vector3((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
      const end = new THREE.Vector3((c.x + d.x) / 2, 0, (c.z + d.z) / 2);
      const length = start.distanceTo(end),
        slices = Math.ceil(length / 0.055);
      const positions: number[] = [],
        uvs: number[] = [],
        indices: number[] = [];
      for (let i = 0; i <= slices; i++) {
        const t = i / slices;
        const left = { x: a.x + (d.x - a.x) * t, z: a.z + (d.z - a.z) * t };
        const right = { x: b.x + (c.x - b.x) * t, z: b.z + (c.z - b.z) * t };
        const width = Math.hypot(right.x - left.x, right.z - left.z);
        const ripple = Math.cos((t * length * Math.PI * 2) / 0.165) * 0.021;
        for (const s of [0, 0.5, 1]) {
          positions.push(
            left.x + (right.x - left.x) * s,
            4.5 + (s === 0.5 ? 0.85 : 0) + ripple,
            left.z + (right.z - left.z) * s,
          );
          uvs.push(t * length, s * width);
        }
        if (i < slices)
          for (let side = 0; side < 2; side++) {
            const vertex = i * 3 + side;
            indices.push(
              vertex,
              vertex + 3,
              vertex + 1,
              vertex + 1,
              vertex + 3,
              vertex + 4,
            );
          }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const roof = new THREE.Mesh(geometry, roofMetal);
      roof.name = `OSM roof ${way.id} · inferred corrugation and pitch`;
      roof.castShadow = roof.receiveShadow = true;
      group.add(roof);
      canopyWayIds.push(way.id);
      const supports = Math.max(2, Math.floor(length / 6));
      for (let i = 0; i <= supports; i++) {
        const t = 0.025 + (i / supports) * 0.95;
        const left = new THREE.Vector3(
          a.x + (d.x - a.x) * t,
          4.43,
          a.z + (d.z - a.z) * t,
        );
        const right = new THREE.Vector3(
          b.x + (c.x - b.x) * t,
          4.43,
          b.z + (c.z - b.z) * t,
        );
        const center = left.clone().add(right).multiplyScalar(0.5);
        add(
          "shelter column bases",
          concrete,
          center.x,
          1.2,
          center.z,
          0.5,
          0.3,
          0.5,
        );
        add(
          "shelter central columns",
          steel,
          center.x,
          2.83,
          center.z,
          0.14,
          3.45,
          0.14,
        );
        beam("shelter truss lower chords", steel, left, right, 0.09);
        const ridge = center.clone().setY(5.29);
        beam("shelter pitched rafters", steel, left, ridge, 0.085);
        beam("shelter pitched rafters", steel, ridge, right, 0.085);
        beam(
          "shelter knee braces",
          steel,
          center.clone().setY(3.55),
          left.clone().lerp(center, 0.45),
          0.065,
        );
        beam(
          "shelter knee braces",
          steel,
          center.clone().setY(3.55),
          right.clone().lerp(center, 0.45),
          0.065,
        );
        beam("shelter ridge struts", steel, center, ridge, 0.06);
      }
      for (const side of [0, 0.25, 0.5, 0.75, 1]) {
        const height = 4.39 + (1 - Math.abs(side * 2 - 1)) * 0.85;
        beam(
          "shelter longitudinal purlins",
          steel,
          new THREE.Vector3(
            a.x + (b.x - a.x) * side,
            height,
            a.z + (b.z - a.z) * side,
          ),
          new THREE.Vector3(
            d.x + (c.x - d.x) * side,
            height,
            d.z + (c.z - d.z) * side,
          ),
          0.07,
        );
      }
    }
    if (tags.railway === "platform" || tags.public_transport === "platform") {
      if (
        points.length < 4 ||
        Math.hypot(
          points[0].x - points.at(-1)!.x,
          points[0].z - points.at(-1)!.z,
        ) > 0.5
      )
        continue;
      points.pop();
      let signedArea = 0;
      for (let i = 0; i < points.length; i++) {
        const a = points[i],
          b = points[(i + 1) % points.length];
        signedArea += a.x * b.z - b.x * a.z;
      }
      const shape = new THREE.Shape(
        points.map((p) => new THREE.Vector2(p.x, -p.z)),
      );
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 1.05,
        bevelEnabled: false,
        steps: 1,
      });
      geometry.rotateX(-Math.PI / 2);
      geometry.clearGroups();
      platformGeometry.push(geometry);
      platformCount++;
      let perimeterOffset = 0;
      for (let i = 0; i < points.length; i++) {
        const a = points[i],
          b = points[(i + 1) % points.length],
          dx = b.x - a.x,
          dz = b.z - a.z,
          length = Math.hypot(dx, dz);
        if (length < 1e-8) continue;
        const ux = dx / length,
          uz = dz / length,
          sign = signedArea > 0 ? 1 : -1,
          nx = -uz * sign,
          nz = ux * sign,
          angle = -Math.atan2(dz, dx);
        for (const piece of edgePattern(perimeterOffset, length, 0.48, 0.012)) {
          add(
            piece.index % 2 ? "cream edge pavers" : "red edge pavers",
            piece.index % 2 ? cream : red,
            a.x + ux * piece.distance + nx * 0.28,
            1.058,
            a.z + uz * piece.distance + nz * 0.28,
            piece.length,
            0.016,
            0.54,
            angle,
          );
        }
        add(
          "yellow platform safety lines",
          yellow,
          (a.x + b.x) / 2 + nx * 0.87,
          1.069,
          (a.z + b.z) / 2 + nz * 0.87,
          length,
          0.016,
          0.06,
          angle,
        );
        // Continuous painted faces: outline vertices split geometry, not paint bands.
        for (const piece of edgePattern(perimeterOffset, length, 1.4)) {
          add(
            piece.index % 2 ? "cream edge faces" : "red edge faces",
            piece.index % 2 ? cream : red,
            a.x + ux * piece.distance - nx * 0.006,
            0.69,
            a.z + uz * piece.distance - nz * 0.006,
            piece.length,
            0.42,
            0.018,
            angle,
          );
        }
        perimeterOffset += length;
      }
    }
    if (
      tags.railway !== "rail" ||
      tags.tunnel === "yes" ||
      tags.bridge === "yes"
    )
      continue;
    tracks.push(points);
    const gauge = (Number.parseFloat(tags.gauge ?? "") || 1676) / 1000;
    let sourceOffset = 0, wayDetailedLength = 0;
    const segments: { a: Point; b: Point; offset: number }[] = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length < 1e-8) continue;
      if (sourceExtent) {
        // Subdivide the original straight segments for bounded culling groups; no resampling or lateral shifts.
        const pieces = Math.ceil(length / 128);
        for (let j = 0; j < pieces; j++) {
          const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
          segments.push({ a: at(j / pieces), b: at((j + 1) / pieces), offset: sourceOffset + length * j / pieces });
        }
      } else {
        const segment = clip(a, b, 250);
        if (segment) segments.push({ a: segment[0], b: segment[1], offset: 0 });
      }
      sourceOffset += length;
    }
    if (segments.length) detailedTrackWayIds.push(way.id);
    for (const { a, b, offset } of segments) {
      const
        dx = b.x - a.x,
        dz = b.z - a.z,
        length = Math.hypot(dx, dz),
        ux = dx / length,
        uz = dz / length,
        nx = -uz,
        nz = ux;
      const angle = -Math.atan2(dz, dx),
        mx = (a.x + b.x) / 2,
        mz = (a.z + b.z) / 2;
      trackLength += length;
      wayDetailedLength += length;
      add(
        "ballast beds",
        ballast,
        mx,
        0.075,
        mz,
        length + 0.05,
        0.15,
        3.25,
        angle,
      );
      const firstSleeper = sourceExtent ? Math.ceil(offset / 0.64 - 0.5) : 0;
      const lastSleeper = sourceExtent ? Math.ceil((offset + length) / 0.64 - 0.5) : Math.floor(length / 0.64);
      for (let j = firstSleeper; j < lastSleeper; j++) {
        const d = (j + 0.5) * 0.64 - offset;
        add(
          "concrete sleepers",
          sleeper,
          a.x + ux * d,
          0.18,
          a.z + uz * d,
          0.23,
          0.15,
          2.65,
          angle,
        );
        sleeperCount++;
      }
      for (const side of [-1, 1]) {
        add(
          "rail webs",
          rust,
          mx + ((nx * gauge) / 2) * side,
          0.275,
          mz + ((nz * gauge) / 2) * side,
          length + 0.03,
          0.145,
          0.055,
          angle,
        );
        add(
          "rail heads",
          steel,
          mx + ((nx * gauge) / 2) * side,
          0.354,
          mz + ((nz * gauge) / 2) * side,
          length + 0.03,
          0.032,
          0.08,
          angle,
        );
      }
      beam(
        "contact wires",
        cable,
        new THREE.Vector3(a.x, 5.8, a.z),
        new THREE.Vector3(b.x, 5.8, b.z),
        0.015,
      );
      beam(
        "messenger wires",
        cable,
        new THREE.Vector3(a.x, 6.35, a.z),
        new THREE.Vector3(b.x, 6.35, b.z),
        0.016,
      );
      for (let d = sourceExtent ? 4 + Math.ceil((offset - 4) / 9) * 9 - offset : 4; d < length; d += 9)
        beam(
          "wire droppers",
          cable,
          new THREE.Vector3(a.x + ux * d, 5.8, a.z + uz * d),
          new THREE.Vector3(a.x + ux * d, 6.35, a.z + uz * d),
          0.012,
        );
    }
    trackCoverage.push({ wayId: way.id, sourceLengthMeters: sourceOffset, detailedLengthMeters: wayDetailedLength, gaugeMeters: gauge });
  }
  // Infer one shared portal across the mapped rail corridor every 48 m.
  const sourceZ = tracks.flat().map(p => p.z);
  const gantryStart = sourceExtent && sourceZ.length ? -220 + Math.ceil((Math.min(...sourceZ) + 220) / 48) * 48 : -220;
  const gantryEnd = sourceExtent && sourceZ.length ? Math.max(...sourceZ) : 220;
  for (let z = gantryStart; z <= gantryEnd; z += 48) {
    const crossings: number[] = [];
    for (const track of tracks)
      for (let i = 1; i < track.length; i++) {
        const a = track[i - 1],
          b = track[i];
        if ((a.z <= z && b.z > z) || (b.z <= z && a.z > z))
          crossings.push(a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z));
      }
    if (crossings.length < 2) continue;
    const left = Math.min(...crossings) - 3.3,
      right = Math.max(...crossings) + 3.3;
    if (right - left > 65) continue;
    gantryCount++;
    for (const x of [left, right]) {
      add("gantry footings", concrete, x, 0.25, z, 0.9, 0.5, 0.9);
      for (const offset of [-0.22, 0.22])
        add("gantry uprights", steel, x + offset, 4.15, z, 0.075, 7.9, 0.075);
      for (let h = 0.55; h < 7.9; h += 0.75)
        beam(
          "gantry lattice",
          steel,
          new THREE.Vector3(x - 0.22, h, z),
          new THREE.Vector3(x + 0.22, h + 0.65, z),
          0.035,
        );
    }
    for (const y of [7.45, 8.05])
      beam(
        "gantry chords",
        steel,
        new THREE.Vector3(left, y, z),
        new THREE.Vector3(right, y, z),
        0.08,
      );
    const sections = Math.ceil((right - left) / 1.15),
      step = (right - left) / sections;
    for (let i = 0; i < sections; i++)
      beam(
        "gantry cross bracing",
        steel,
        new THREE.Vector3(left + i * step, i % 2 ? 8.05 : 7.45, z),
        new THREE.Vector3(left + (i + 1) * step, i % 2 ? 7.45 : 8.05, z),
        0.04,
      );
    for (const x of crossings) {
      beam(
        "catenary hangers",
        steel,
        new THREE.Vector3(x, 7.45, z),
        new THREE.Vector3(x, 6.05, z),
        0.035,
      );
      add("catenary insulators", cable, x, 6.85, z, 0.12, 0.29, 0.12);
    }
  }
  if (platformGeometry.length) {
    const merged = mergeGeometries(platformGeometry, false);
    platformGeometry.forEach((g) => g.dispose());
    if (merged) {
      const mesh = new THREE.Mesh(merged, concrete);
      mesh.name = "OSM platform footprints · inferred 1.05 m elevation";
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  for (const [name, batch] of batches) {
    const mesh = new THREE.InstancedMesh(
      box,
      batch.material,
      batch.matrices.length,
    );
    batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.name = name;
    mesh.castShadow = !name.includes("wire");
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  group.userData = {
    platformCount,
    canopyWayIds,
    canopyEaveHeight: 4.5,
    canopyRidgeHeight: 5.35,
    trackLengthMeters: Math.round(trackLength),
    sleeperCount,
    gantryCount,
    platformHeight: 1.05,
    railHeadHeight: 0.37,
    radiusMeters: sourceExtent ? null : 250,
    trackExtent: sourceExtent ? "source" : "station",
    detailedTrackWayIds,
    trackCoverage,
    trackChunkMeters: sourceExtent ? 128 : null,
    sourceEndpointLimitation: sourceExtent ? "Track detail ends only at mapped source endpoints; no geometry is inferred beyond them. Sleepers restart their chainage at each source way, and switch blades/frogs are not reconstructed." : null,
    provenance:
      "OSM platform outlines, rail centerlines, gauge and explicit building=roof shelter outlines (214599003, 214599063). Inferred platform/roof elevations, shelter pitch, corrugation, support layout, paving, ballast, sleepers, overhead support positions and dimensions. Appearance informed by station-2018.jpg and station-2025.jpg; no per-object photo match.",
  };
  return group;
}
