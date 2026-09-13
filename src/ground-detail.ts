import * as THREE from "three";

type Point = { x: number; z: number };
type Way = {
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};
const EAST = 111320 * Math.cos((13.0516624 * Math.PI) / 180);
const CAMERA = { x: 25.2, z: -170.8 };
const local = (p: { lat: number; lon: number }): Point => ({
  x: (p.lon - 80.2306892) * EAST,
  z: -(p.lat - 13.0516624) * 111320,
});
function random(seed: number) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
// A 64 px local mask adds broad, irregular wear without another downloaded asset.
// This is inferred material variation, not a photograph or a surveyed stain map.
function wearMask() {
  const size = 64,
    pixels = new Uint8Array(size * size * 4);
  const rng = random(8701);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1,
        v = ((y + 0.5) / size) * 2 - 1;
      const edge = Math.max(Math.abs(u), Math.abs(v));
      const variation =
        0.62 +
        Math.sin(u * 9 + v * 3) * 0.13 +
        Math.cos(v * 13 - u * 5) * 0.1 +
        (rng() - 0.5) * 0.12;
      const value = Math.round(
        255 * variation * (1 - THREE.MathUtils.smoothstep(edge, 0.55, 1)),
      );
      const offset = (y * size + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
function inside(p: Point, polygon: Point[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    )
      result = !result;
  }
  return result;
}
function edgeDistance(p: Point, polygon: Point[]) {
  let distance = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length],
      dx = b.x - a.x,
      dz = b.z - a.z;
    const t = THREE.MathUtils.clamp(
      ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1),
      0,
      1,
    );
    distance = Math.min(
      distance,
      Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t),
    );
  }
  return distance;
}
// Match railway.ts's 250m clip so tie locations and fasteners share an origin.
function clip(a: Point, b: Point): [Point, Point] | undefined {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    aa = dx * dx + dz * dz;
  if (aa < 0.0001) return;
  const bb = 2 * (a.x * dx + a.z * dz),
    cc = a.x * a.x + a.z * a.z - 250 * 250;
  const disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return;
  const lo = Math.max(0, (-bb - Math.sqrt(disc)) / (2 * aa)),
    hi = Math.min(1, (-bb + Math.sqrt(disc)) / (2 * aa));
  return hi > lo
    ? [
        { x: a.x + dx * lo, z: a.z + dz * lo },
        { x: a.x + dx * hi, z: a.z + dz * hi },
      ]
    : undefined;
}

/** Reference-informed inferred microdetail; no individual stones or slab joints are surveyed. */
export function buildGroundDetail(data: any): THREE.Group {
  const group = new THREE.Group();
  group.name = "Inferred station ground microdetail";
  const ways: Way[] = data?.elements ?? [];
  const platforms = ways
    .filter(
      (w) => w.tags?.railway === "platform" && (w.geometry?.length ?? 0) > 3,
    )
    .map((w) => w.geometry!.slice(0, -1).map(local));
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x88857b,
    roughness: 1,
    flatShading: true,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x48413a,
    roughness: 0.86,
    metalness: 0.36,
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x656157,
    roughness: 1,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  // Subpixel seams should disappear with distance instead of becoming dotted lines.
  jointMat.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec2 vSeamUv;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <uv_vertex>",
      "#include <uv_vertex>\n vSeamUv = uv;",
    );
    shader.fragmentShader = "varying vec2 vSeamUv;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float seamFootprint = max(fwidth(vSeamUv.y), 0.001);
      float seamCoverage = 1.0 - smoothstep(0.25 - seamFootprint, 0.25 + seamFootprint, abs(vSeamUv.y - 0.5));
      diffuseColor.a *= seamCoverage * min(1.0, 0.5 / seamFootprint);
      diffuseColor.a *= 1.0 - smoothstep(16.0, 45.0, length(vViewPosition));`,
    );
  };
  jointMat.customProgramCacheKey = () => "platform-seam-coverage-v2";
  const patchMat = new THREE.MeshStandardMaterial({
    color: 0x706c61,
    roughness: 1,
    transparent: true,
    opacity: 0.23,
    alphaMap: wearMask(),
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const surface = new THREE.PlaneGeometry(1, 1);
  surface.rotateX(-Math.PI / 2);
  // Asymmetric angular octahedron: 8 triangles, uneven cut faces rather than rounded pebbles.
  const rock = new THREE.OctahedronGeometry(1, 0);
  const position = rock.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      y = position.getY(i),
      z = position.getZ(i);
    position.setXYZ(
      i,
      x * (y > 0 ? 0.8 : 1) + z * 0.13,
      y * (x < 0 ? 0.68 : 1),
      z + x * 0.19,
    );
  }
  rock.computeVertexNormals();
  const dummy = new THREE.Object3D();
  type Batch = {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    matrices: THREE.Matrix4[];
    colors: THREE.Color[];
  };
  const batches = new Map<string, Batch>();
  let stoneCount = 0,
    fastenerCount = 0,
    jointLengthMeters = 0,
    patchCount = 0;
  function add(
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    p: Point,
    y: number,
    sx: number,
    sy: number,
    sz: number,
    angle = 0,
    tone = 1,
    tilt = 0,
  ) {
    if (!batches.has(name))
      batches.set(name, { geometry, material, matrices: [], colors: [] });
    dummy.position.set(p.x, y, p.z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(tilt, angle, tilt * 0.45);
    dummy.updateMatrix();
    const batch = batches.get(name)!;
    batch.matrices.push(dummy.matrix.clone());
    batch.colors.push(new THREE.Color(tone, tone, tone));
  }
  const onPlatform = (p: Point) =>
    platforms.some(
      (polygon) => inside(p, polygon) || edgeDistance(p, polygon) < 0.09,
    );
  for (const way of ways) {
    if (way.tags?.railway !== "rail" || !way.geometry) continue;
    const points = way.geometry.map(local),
      rng = random(way.id + 1329),
      gauge = (Number.parseFloat(way.tags.gauge ?? "") || 1676) / 1000;
    for (let i = 1; i < points.length; i++) {
      const segment = clip(points[i - 1], points[i]);
      if (!segment) continue;
      const [a, b] = segment,
        dx = b.x - a.x,
        dz = b.z - a.z,
        length = Math.hypot(dx, dz),
        ux = dx / length,
        uz = dz / length,
        nx = -uz,
        nz = ux;
      const angle = -Math.atan2(dz, dx);
      for (let d = 0.13; d < length && stoneCount < 7800; d += 0.19) {
        for (
          let across = -1.55;
          across <= 1.55 && stoneCount < 7800;
          across += 0.29
        ) {
          const distance = d + (rng() - 0.5) * 0.17,
            lateral = across + (rng() - 0.5) * 0.22;
          const p = {
            x: a.x + ux * distance + nx * lateral,
            z: a.z + uz * distance + nz * lateral,
          };
          const radius = Math.hypot(p.x - CAMERA.x, p.z - CAMERA.z);
          if (
            radius > 80 ||
            (radius > 35 && rng() > 0.3) ||
            (radius > 18 && rng() > 0.5)
          )
            continue;
          const tiePhase = ((distance % 0.64) + 0.64) % 0.64;
          if (Math.abs(tiePhase - 0.32) < 0.17 && Math.abs(lateral) < 1.39)
            continue;
          if (Math.abs(Math.abs(lateral) - gauge / 2) < 0.075 || onPlatform(p))
            continue;
          const size = 0.035 + rng() * 0.043;
          add(
            "Angular ballast stones",
            rock,
            stoneMat,
            p,
            0.148 + size * 0.19,
            size * (0.8 + rng() * 0.65),
            size * (0.55 + rng() * 0.4),
            size * (0.7 + rng() * 0.7),
            rng() * Math.PI,
            0.48 + rng() * 0.52,
            (rng() - 0.5) * 0.65,
          );
          stoneCount++;
        }
      }
      for (let j = 0; j < Math.floor(length / 0.64); j++) {
        const d = (j + 0.5) * 0.64,
          center = { x: a.x + ux * d, z: a.z + uz * d };
        if (Math.hypot(center.x - CAMERA.x, center.z - CAMERA.z) > 32) continue;
        for (const railSide of [-1, 1]) {
          const lateral = (railSide * gauge) / 2,
            p = { x: center.x + nx * lateral, z: center.z + nz * lateral };
          if (onPlatform(p)) continue;
          add(
            "Sleeper rail baseplates",
            box,
            ironMat,
            p,
            0.262,
            0.18,
            0.016,
            0.22,
            angle,
            0.8 + rng() * 0.2,
          );
          for (const clipSide of [-1, 1]) {
            const offset = lateral + clipSide * 0.073;
            add(
              "Rail clip fasteners",
              box,
              ironMat,
              { x: center.x + nx * offset, z: center.z + nz * offset },
              0.282,
              0.055,
              0.028,
              0.045,
              angle,
              0.72 + rng() * 0.28,
            );
            fastenerCount++;
          }
        }
      }
    }
  }
  for (let index = 0; index < platforms.length; index++) {
    const polygon = platforms[index],
      rng = random(901 + index);
    // Slab grid follows the actual platform's longest edge and remains inset from paving.
    let longest = 0,
      ux = 0,
      uz = 1;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length],
        length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length > longest) {
        longest = length;
        ux = (b.x - a.x) / length;
        uz = (b.z - a.z) / length;
      }
    }
    const nx = -uz,
      nz = ux,
      origin = polygon[0];
    const valid = (p: Point) =>
      inside(p, polygon) &&
      edgeDistance(p, polygon) > 0.97 &&
      Math.hypot(p.x - CAMERA.x, p.z - CAMERA.z) < 80;
    const at = (along: number, across: number) => ({
      x: origin.x + ux * along + nx * across,
      z: origin.z + uz * along + nz * across,
    });
    function stroke(from: Point, to: Point, width: number) {
      const length = Math.hypot(to.x - from.x, to.z - from.z),
        count = Math.ceil(length / 0.22);
      // Sample clipping at 22 cm, but draw each contiguous run as one strip.
      // The old separate fragments and per-fragment tones read as dotted drafting lines.
      let start: Point | undefined;
      let end: Point | undefined;
      const tone = 0.92 + rng() * 0.08;
      function flush() {
        if (!start || !end) return;
        const runLength = Math.hypot(end.x - start.x, end.z - start.z);
        add(
          "Concrete slab expansion joints",
          surface,
          jointMat,
          { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 },
          1.061,
          runLength,
          1,
          width,
          -Math.atan2(end.z - start.z, end.x - start.x),
          tone,
        );
        jointLengthMeters += runLength;
        start = end = undefined;
      }
      for (let i = 0; i < count; i++) {
        const a = {
          x: from.x + ((to.x - from.x) * i) / count,
          z: from.z + ((to.z - from.z) * i) / count,
        };
        const b = {
          x: from.x + ((to.x - from.x) * (i + 1)) / count,
          z: from.z + ((to.z - from.z) * (i + 1)) / count,
        };
        if (!valid(a) || !valid(b)) {
          flush();
          continue;
        }
        start ??= a;
        end = b;
      }
      flush();
    }
    for (let along = -330; along <= 330; along += 5.4)
      stroke(at(along, -18), at(along, 18), 0.044 + rng() * 0.006);
    for (let across = -15; across <= 15; across += 2.75)
      stroke(at(-330, across), at(330, across), 0.048);
    // Sample in platform coordinates so narrow platforms receive actual coverage.
    // Broad low-contrast abrasion alternates with smaller repair discoloration.
    const projected = polygon.map((p) => ({
      along: (p.x - origin.x) * ux + (p.z - origin.z) * uz,
      across: (p.x - origin.x) * nx + (p.z - origin.z) * nz,
    }));
    const minAlong = Math.min(...projected.map((p) => p.along));
    const maxAlong = Math.max(...projected.map((p) => p.along));
    const minAcross = Math.min(...projected.map((p) => p.across));
    const maxAcross = Math.max(...projected.map((p) => p.across));
    for (let along = minAlong; along < maxAlong; along += 2.1) {
      for (let across = minAcross; across < maxAcross; across += 1.5) {
        if (rng() < 0.18) continue;
        const p = at(along + rng() * 1.5, across + rng() * 1.1);
        const broad = rng() < 0.7;
        const width = broad ? 1.8 + rng() * 2.3 : 0.35 + rng() * 0.8,
          depth = broad ? 0.8 + rng() * 1.0 : 0.3 + rng() * 0.7;
        const corners = [-1, 1].flatMap((a) =>
          [-1, 1].map((b) => ({
            x: p.x + (ux * width * a) / 2 + (nx * depth * b) / 2,
            z: p.z + (uz * width * a) / 2 + (nz * depth * b) / 2,
          })),
        );
        if (!valid(p) || !corners.every(valid)) continue;
        const angle = -Math.atan2(uz, ux);
        add(
          "Inferred concrete wear and repair discoloration",
          surface,
          patchMat,
          p,
          1.059,
          width,
          1,
          depth,
          angle,
          0.8 + rng() * 0.35,
        );
        patchCount++;
      }
    }
  }
  let triangles = 0;
  for (const [name, batch] of batches) {
    const mesh = new THREE.InstancedMesh(
      batch.geometry,
      batch.material,
      batch.matrices.length,
    );
    batch.matrices.forEach((matrix, i) => {
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, batch.colors[i]);
    });
    mesh.name = name;
    mesh.castShadow = name.includes("stones") || name.includes("fasteners");
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    triangles +=
      ((batch.geometry.index?.count ??
        batch.geometry.attributes.position.count) /
        3) *
      batch.matrices.length;
  }
  group.userData = {
    stoneCount,
    fastenerCount,
    jointLengthMeters: Math.round(jointLengthMeters),
    patchCount,
    triangles,
    radiusMeters: 80,
    referenceCamera: CAMERA,
    provenance:
      "Inferred individual ballast stones, rail fasteners, slab joints and repairs. Rail centerlines and platform outlines are OSM evidence; ballast avoids platform footprints, overlays remain inset inside them, and rail fasteners follow existing sleeper spacing. Photo-informed by station-2018.jpg, not surveyed microgeometry.",
  };
  return group;
}
