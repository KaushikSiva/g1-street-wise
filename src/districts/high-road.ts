import * as THREE from 'three';

type GeoPoint = { lat: number; lon: number };
type Way = { id: number; tags?: Record<string, string>; geometry?: GeoPoint[] };
type Point = { x: number; z: number; distance: number };
type Sample = { x: number; y: number; z: number; nx: number; nz: number; distance: number };
export const HIGH_ROAD_BOUNDS = { west: 80.22820, south: 13.05365, east: 80.23410, north: 13.05438 } as const;
export const HIGH_ROAD_REPLACED_WAY_IDS = [23186335, 1177170714, 1177170715, 1177170716, 1177170717] as const;
const EAST = 111320 * Math.cos(13.0516624 * Math.PI / 180);
const ROAD_HALF_WIDTH = 3.8, OUTER_HALF_WIDTH = 5.62;
const toLocal = (p: GeoPoint) => ({ x: (p.lon - 80.2306892) * EAST, z: -(p.lat - 13.0516624) * 111320 });

function pathFrom(data: any): Point[] {
  const way = (data?.elements as Way[] | undefined)?.find(w => w.id === 23186335);
  const points: Point[] = []; let distance = 0;
  for (const p of way?.geometry ?? []) {
    const xy = toLocal(p), previous = points.at(-1);
    if (previous) distance += Math.hypot(xy.x - previous.x, xy.z - previous.z);
    points.push({ ...xy, distance });
  }
  return points;
}
function deckHeight(distance: number, length: number) {
  const fraction = distance / length;
  const ramp = fraction < 0.44 ? fraction / 0.44 : fraction > 0.60 ? (1 - fraction) / 0.40 : 1;
  // Explicit inferred vertical profile. No OSM elevation or engineering drawings exist here.
  const t = THREE.MathUtils.clamp(ramp, 0, 1);
  return 0.08 + 8.52 * (t * t * (3 - 2 * t));
}
function sample(path: Point[], distance: number): Sample {
  const length = path.at(-1)!.distance;
  let i = 1; while (i < path.length - 1 && path[i].distance < distance) i++;
  const a = path[i - 1], b = path[i], segment = b.distance - a.distance || 1;
  const t = THREE.MathUtils.clamp((distance - a.distance) / segment, 0, 1), dx = (b.x - a.x) / segment, dz = (b.z - a.z) / segment;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: deckHeight(distance, length), nx: -dz, nz: dx, distance };
}

/** Returns null outside the deck; bridge carriageway and raised walkway elevations in metres. */
export function createHighRoadHeightSampler(data: any): (x: number, z: number) => number | null {
  const path = pathFrom(data);
  return (x, z) => {
    let best = Infinity, distance = 0, lateral = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], dx = b.x - a.x, dz = b.z - a.z, length = b.distance - a.distance;
      const raw = ((x - a.x) * dx + (z - a.z) * dz) / (length * length || 1);
      if ((i === 1 && raw < 0) || (i === path.length - 1 && raw > 1)) continue;
      const t = THREE.MathUtils.clamp(raw, 0, 1), ox = x - a.x - dx * t, oz = z - a.z - dz * t, d = Math.hypot(ox, oz);
      if (d < best) { best = d; distance = a.distance + length * t; lateral = (-dz * ox + dx * oz) / (length || 1); }
    }
    if (best > OUTER_HALF_WIDTH || path.length < 2) return null;
    const width = Math.abs(lateral);
    if (!(width < 3.80 || (width >= 4.20 && width <= 5.32))) return null;
    return deckHeight(distance, path.at(-1)!.distance) + (Math.abs(lateral) > 4.03 ? 0.22 : 0.015);
  };
}

/** Staged geographic district: mapped flyover alignment with reference-informed inferred construction. */
export function buildHighRoad(data: any): THREE.Group {
  const group = new THREE.Group(); group.name = 'High Road / railway overbridge · staged';
  const path = pathFrom(data); if (path.length < 2) return group;
  const length = path.at(-1)!.distance;
  const material = (color: number, roughness = 0.9, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const concrete = material(0x96968a), pale = material(0xb5b5a9), dark = material(0x383c37), metal = material(0x89928d, 0.47, 0.7);
  const asphalt = material(0x686b65, 0.96), joint = material(0x444640), paint = material(0x8e885f, 0.98);
  if (typeof document !== 'undefined') {
    const loader = new THREE.TextureLoader();
    const roadMap = loader.load('/assets/textures/asphalt_02_Diffuse.jpg'); roadMap.colorSpace = THREE.SRGBColorSpace;
    roadMap.wrapS = roadMap.wrapT = THREE.RepeatWrapping; roadMap.repeat.set(0.24, 0.24); asphalt.map = roadMap;
    const rough = loader.load('/assets/textures/asphalt_02_Rough.jpg'); rough.wrapS = rough.wrapT = THREE.RepeatWrapping; rough.repeat.copy(roadMap.repeat); asphalt.roughnessMap = rough;
  }
  const box = new THREE.BoxGeometry(1, 1, 1), post = new THREE.CylinderGeometry(0.029, 0.029, 1, 8);
  const batches = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[] }>();
  const dummy = new THREE.Object3D(), unitX = new THREE.Vector3(1, 0, 0);
  let barrierSegments = 0, pierCount = 0;
  function add(name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, position: THREE.Vector3, scale: THREE.Vector3, quaternion = new THREE.Quaternion()) {
    if (!batches.has(name)) batches.set(name, { geometry, material: mat, matrices: [] });
    dummy.position.copy(position); dummy.scale.copy(scale); dummy.quaternion.copy(quaternion); dummy.updateMatrix(); batches.get(name)!.matrices.push(dummy.matrix.clone());
  }
  function at(s: Sample, lateral: number, height: number) { return new THREE.Vector3(s.x + s.nx * lateral, s.y + height, s.z + s.nz * lateral); }
  function beam(name: string, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, height: number, width: number) {
    const direction = b.clone().sub(a), size = direction.length();
    add(name, box, mat, a.clone().add(b).multiplyScalar(0.5), new THREE.Vector3(size, height, width), new THREE.Quaternion().setFromUnitVectors(unitX, direction.normalize()));
  }
  const samples: Sample[] = []; const count = Math.ceil(length / 2);
  for (let i = 0; i <= count; i++) samples.push(sample(path, length * i / count));
  function strip(name: string, mat: THREE.Material, lateral: number, width: number, elevation: number, depth: number) {
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      for (const [offset, h] of [[lateral - width / 2, elevation], [lateral + width / 2, elevation], [lateral - width / 2, elevation - depth], [lateral + width / 2, elevation - depth]]) {
        const p = at(s, offset, h); positions.push(p.x, p.y, p.z); uvs.push(s.distance, offset);
      }
      if (i < samples.length - 1) {
        const v = i * 4;
        indices.push(v, v + 1, v + 4, v + 1, v + 5, v + 4, v + 2, v + 6, v + 3, v + 3, v + 6, v + 7, v, v + 4, v + 2, v + 2, v + 4, v + 6, v + 1, v + 3, v + 5, v + 3, v + 7, v + 5);
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }
  strip('Mapped flyover alignment · inferred reinforced deck', concrete, 0, 11.24, -0.045, 0.82);
  strip('Worn asphalt carriageway', asphalt, 0, 7.6, 0.014, 0.055);
  for (const side of [-1, 1]) strip('Raised pedestrian walkway', pale, side * 4.80, 1.46, 0.22, 0.30);
  for (let d = 0; d < length; d += 1.23) {
    const a = sample(path, d), b = sample(path, Math.min(length, d + 1.215)), alternate = Math.floor(d / 1.23) % 2;
    for (const side of [-1, 1]) {
      beam('Alternating ' + (alternate ? 'dark' : 'pale') + ' road parapet panels', alternate ? dark : pale, at(a, side * 3.99, 0.48), at(b, side * 3.99, 0.48), 0.73, 0.38);
      barrierSegments++;
    }
  }
  for (let d = 0.7; d < length; d += 2.5) {
    const s = sample(path, d);
    for (const side of [-1, 1]) {
      add('Galvanized pedestrian posts', post, metal, at(s, side * 4.05, 1.08), new THREE.Vector3(1, 0.69, 1));
      add('Outer concrete walkway posts', box, pale, at(s, side * 5.46, 0.76), new THREE.Vector3(0.20, 1.08, 0.20));
    }
  }
  for (let i = 1; i < samples.length; i++) for (const side of [-1, 1]) {
    const a = samples[i - 1], b = samples[i];
    for (const height of [0.94, 1.34]) beam('Horizontal pedestrian handrails', metal, at(a, side * 4.05, height), at(b, side * 4.05, height), 0.038, 0.038);
    beam('Outer walkway low parapet', concrete, at(a, side * 5.47, 0.48), at(b, side * 5.47, 0.48), 0.54, 0.16);
    beam('Outer walkway rail', metal, at(a, side * 5.47, 1.16), at(b, side * 5.47, 1.16), 0.055, 0.055);
  }
  for (let d = 25; d < length - 10; d += 27) {
    const s = sample(path, d); beam('Deck expansion joints', joint, at(s, -ROAD_HALF_WIDTH, 0.021), at(s, ROAD_HALF_WIDTH, 0.021), 0.007, 0.043);
  }
  for (let d = 12; d < length - 5; d += 10) {
    const a = sample(path, d), b = sample(path, d + 2.3); beam('Faint worn center marking', paint, at(a, 0, 0.024), at(b, 0, 0.024), 0.008, 0.065);
  }
  const railway = (data.elements as Way[]).filter(w => w.tags?.railway === 'rail').map(w => (w.geometry ?? []).map(toLocal));
  function clearOfRails(p: Sample) {
    return !railway.some(line => line.some((a, i) => {
      const b = line[i + 1]; if (!b) return false;
      const dx = b.x - a.x, dz = b.z - a.z, t = THREE.MathUtils.clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      // Conservative plan envelope: cap half-diagonal 4.75m + 2.2m rail envelope.
      return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t) < 6.95;
    }));
  }
  for (let d = 70; d < length - 65; d += 34) {
    const s = sample(path, d); if (s.y < 2 || !clearOfRails(s)) continue;
    const h = s.y - 0.90;
    add('Inferred bridge support piers', box, concrete, new THREE.Vector3(s.x, h / 2, s.z), new THREE.Vector3(1.1, h, 4.4));
    add('Pier cap beams', box, concrete, new THREE.Vector3(s.x, h - 0.20, s.z), new THREE.Vector3(1.35, 0.65, 9.4)); pierCount++;
  }
  // Short footway ways establish routing connections, not transverse structural
  // slabs. Preserve their IDs and exclude old ribbons without fabricating slabs.
  let triangles = 0;
  for (const [name, batch] of batches) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length); mesh.name = name;
    batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh);
  }
  group.traverse(o => { if (o instanceof THREE.Mesh) triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * (o instanceof THREE.InstancedMesh ? o.count : 1); });
  group.userData = { district: 'high-road', status: 'staged / unreviewed', boundsWgs84: HIGH_ROAD_BOUNDS, replacedWayIds: [...HIGH_ROAD_REPLACED_WAY_IDS], bridgeWayId: 23186335, bridgeLengthMeters: length, carriagewayWidthMeters: 7.6, outerWidthMeters: 11.24, inferredCrestHeightMeters: 8.6, barrierSegments, pierCount, triangles, heightAt: createHighRoadHeightSampler(data), buildingReplacementIds: [], observed: ['mapped bridge centerline', 'black/pale alternating barriers', 'narrow raised walkways', 'horizontal metal pedestrian rails', 'worn gray asphalt'], inferred: ['all widths and elevations', 'vertical ramp profile', 'barrier segmentation and dimensions', 'pier locations and structure', 'handrail dimensions', 'faint lane marking positions'], provenance: 'OSM way23186335 and four mapped footway routing connectors, which do not establish raised transverse structures. Appearance informed by public-domain overbridge-2008 photograph and privately inspected Apr2018 Google user panorama; Google pixels are not bundled. High-road-2017 is context only, with unmatched facade identities.' };
  group.userData.nonStructuralRouteWayIds = [1177170714, 1177170715, 1177170716, 1177170717];
  return group;
}
