import * as THREE from "three";
/** Reference-visible seating; dimensions and placement remain inferred. */
export function buildStationDetail() {
  const group = new THREE.Group();
  group.name = "Station seating · reference-informed inference";
  const concrete = new THREE.MeshStandardMaterial({
    color: "#727c72",
    roughness: 0.97,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#282e2b",
    roughness: 0.85,
  });
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  }
  // Benches are inferred in shelter zone. No invented readable advertising or station metadata.
  for (let i = 0; i < 5; i++) {
    const z = -104 + i * 25,
      x = 15.7 - (z + 104) * 0.16;
    box(x, 1.58, z, 1.6, 0.11, 0.5, concrete);
    box(x, 1.89, z + 0.22, 1.6, 0.5, 0.09, concrete);
    for (const dx of [-0.55, 0.55]) box(x + dx, 1.3, z, 0.18, 0.5, 0.38, dark);
  }
  group.userData = {
    provenance:
      "Station-2018 photo shows platform seating. The foreground mast and lamp are loaded separately from Blender assets. All dimensions, positions and hidden surfaces inferred.",
    accuracy: "Unsurveyed",
  };
  return group;
}
