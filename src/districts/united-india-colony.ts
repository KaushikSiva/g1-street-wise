import * as THREE from "three";

/** Work-package bounds, not an administrative or surveyed colony boundary. */
export const UNITED_INDIA_COLONY_BOUNDS = {
  west: 80.22465, south: 13.05085, east: 80.22770, north: 13.05330,
} as const;
export const UNITED_INDIA_COLONY_REPLACED_BUILDING_IDS: number[] = [];
export const UNITED_INDIA_COLONY_VIEW = {
  position: [-559.8, 74, 43] as const,
  target: [-559.8, 0, -44] as const,
};
const ORIGIN = { lon: 80.2306892, lat: 13.0516624 };
const EAST = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const PARK_ID = 27191741;
// Original OSM API coordinates, fetched 2026-09-09. Source archive and limits in district doc.
const PARK_OUTLINE: [number, number][] = [[80.2253257,13.0521901],[80.2252938,13.0521233],[80.2252851,13.0520501],[80.2253005,13.0519781],[80.2253386,13.0519144],[80.2253993,13.0518634],[80.225474,13.051835],[80.2255541,13.0518327],[80.2256305,13.0518566],[80.2256943,13.051904],[80.225738,13.0519694],[80.2257568,13.0520454],[80.2257485,13.052123],[80.225714,13.0521935],[80.2256609,13.0522461],[80.2255936,13.0522796],[80.2255189,13.0522907],[80.2254444,13.0522783],[80.2253778,13.0522435],[80.2253257,13.0521901]];
type Coordinate = { lon: number; lat: number };
type Way = { id: number; type?: string; geometry?: Coordinate[]; tags?: Record<string, string> };

function local(p: Coordinate) {
  return new THREE.Vector2((p.lon - ORIGIN.lon) * EAST, (p.lat - ORIGIN.lat) * 111320);
}
function outlineShape(points: THREE.Vector2[]) {
  return new THREE.Shape(points);
}
function groundTexture() {
  const size = 128, bytes = new Uint8Array(size * size * 4);
  let seed = PARK_ID;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const n = seed / 4294967296;
    const dry = .5 + .5 * Math.sin(x / 15 + Math.sin(y / 13));
    const i = (y * size + x) * 4;
    bytes[i] = 90 + dry * 21 + n * 18;
    bytes[i + 1] = 101 + dry * 8 + n * 15;
    bytes[i + 2] = 51 + dry * 16 + n * 11;
    bytes[i + 3] = 255;
  }
  const t = new THREE.DataTexture(bytes, size, size);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(.11, .11);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
/** Adds the previously omitted mapped park. Path/finish are explicit hypotheses, not photo matches. */
export function buildUnitedIndiaColony(
  data: { elements?: Way[] },
  options: { showHypotheses?: boolean } = {},
): THREE.Group {
  const group = new THREE.Group();
  group.name = "United India Colony · mapped Circular Park, inferred landscape finish";
  const source = data.elements?.find(e => e.type === "way" && e.id === PARK_ID && e.geometry);
  const coordinates = source?.geometry ?? PARK_OUTLINE.map(([lon, lat]) => ({ lon, lat }));
  const ring = coordinates.map(local);
  if (ring.length < 4 || ring[0].distanceTo(ring[ring.length - 1]) > .5) {
    group.userData = { rejected: "Park outline is missing or open", replacedBuildingIds: [] };
    return group;
  }
  ring.pop();
  const center = ring.reduce((sum, p) => sum.add(p), new THREE.Vector2()).multiplyScalar(1 / ring.length);
  const surface = new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: .98 });
  const base = new THREE.Mesh(new THREE.ShapeGeometry(outlineShape(ring)), surface);
  base.rotation.x = -Math.PI / 2;
  base.position.y = .045;
  base.name = "OSM way 27191741 · exact source boundary, inferred grass and soil";
  base.receiveShadow = true;
  group.add(base);

  // A reversible landscape hypothesis. The historic photo proves paved paths exist,
  // but does not locate this perimeter loop or establish these dimensions.
  const landscape = new THREE.Group();
  landscape.name = "Inferred park circulation · unvalidated position and width";
  landscape.visible = options.showHypotheses === true;
  const inset = (distance: number) => ring.map(p => {
    const v = p.clone().sub(center);
    return center.clone().add(v.multiplyScalar(Math.max(0, v.length() - distance) / v.length()));
  });
  const outer = inset(2.1), inner = inset(4.0);
  const pathShape = outlineShape(outer);
  pathShape.holes.push(new THREE.Path(inner.slice().reverse()));
  const paving = new THREE.MeshStandardMaterial({ color: 0xb4ab95, roughness: .96 });
  const path = new THREE.Mesh(new THREE.ShapeGeometry(pathShape), paving);
  path.rotation.x = -Math.PI / 2;
  path.position.y = .061;
  path.name = "Hypothesis: 1.9 m park walking loop";
  path.receiveShadow = true;
  landscape.add(path);
  // Narrow recessed expansion joints make the paving a surface rather than a flat graphic.
  const jointMaterial = new THREE.MeshStandardMaterial({ color: 0x837d6c, roughness: 1 });
  const joints = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), jointMaterial, ring.length);
  const transform = new THREE.Object3D();
  ring.forEach((_, i) => {
    const a = outer[i], b = inner[i], d = b.clone().sub(a);
    transform.position.set((a.x + b.x) / 2, .063, -(a.y + b.y) / 2);
    transform.rotation.set(0, Math.atan2(d.y, d.x), 0);
    transform.scale.set(d.length(), .002, .015);
    transform.updateMatrix(); joints.setMatrixAt(i, transform.matrix);
  });
  joints.name = "Inferred park path joints";
  joints.receiveShadow = true;
  joints.computeBoundingSphere();
  landscape.add(joints);
  group.add(landscape);

  const streets = (data.elements ?? []).filter(e => e.tags?.highway && e.geometry?.some(p =>
    p.lon >= UNITED_INDIA_COLONY_BOUNDS.west && p.lon <= UNITED_INDIA_COLONY_BOUNDS.east &&
    p.lat >= UNITED_INDIA_COLONY_BOUNDS.south && p.lat <= UNITED_INDIA_COLONY_BOUNDS.north));
  group.userData = {
    district: "united-india-colony", workBounds: UNITED_INDIA_COLONY_BOUNDS,
    mappedParkWayIds: [PARK_ID], replacedBuildingIds: [],
    mappedStreetIds: streets.map(e => e.id),
    source: "https://www.openstreetmap.org/way/27191741",
    attribution: "© OpenStreetMap contributors, ODbL 1.0",
    photo: "https://www.flickr.com/photos/21436376@N00/2270988453",
    photographPixelsEmbedded: false,
    observed: "Park outline from OSM; historic photograph shows grass/soil planting and paved paths.",
    inferred: "All elevation, grass finish, path layout, width and paving joints; no tree or building match asserted.",
    landscapeHypothesisGroup: landscape.name,
    landscapeHypothesesVisible: landscape.visible,
    parkAreaEvidence: { osmProjectedSquareMeters: 2024.723463, municipalListedSquareMeters: 1663, reconciled: false },
  };
  return group;
}
