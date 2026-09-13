import * as THREE from 'three';
import { buildHighRoad } from './high-road.ts';

function field(x: number, y: number, seed: number) {
  const a = Math.sin(x * 127.1 + y * 311.7 + seed * 41.31) * 43758.5453;
  return a - Math.floor(a);
}
function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(field(ix, iy, seed), field(ix + 1, iy, seed), u), THREE.MathUtils.lerp(field(ix, iy + 1, seed), field(ix + 1, iy + 1, seed), u), v);
}
function agedConcrete(darkPaint: boolean): THREE.MeshStandardMaterial {
  const size = 256, pixels = new Uint8Array(size * size * 4), relief = new Uint8Array(size * size * 4);
  const base = darkPaint ? [62, 65, 59] : [177, 177, 163];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const broad = noise(u * 9, v * 8, 17), grains = noise(u * 113, v * 101, 29);
    const runoff = noise(u * 38, v * 3, 81) * (1 - v);
    const wear = Math.max(0, (noise(u * 51, v * 32, 37) - 0.70) * 5) * (v > 0.80 || u < 0.05 || u > 0.95 ? 0.75 : 0.10);
    const tint = 0.83 + broad * 0.18 + grains * 0.08 - runoff * 0.15;
    const index = (y * size + x) * 4;
    for (let channel = 0; channel < 3; channel++) pixels[index + channel] = Math.round(THREE.MathUtils.lerp(base[channel] * tint, [145, 142, 126][channel], wear));
    pixels[index + 3] = 255;
    const height = Math.round(118 + grains * 18 + broad * 5 - wear * 12);
    relief.set([height, height, height, 255], index);
  }
  const texture = new THREE.DataTexture(pixels, size, size); texture.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.DataTexture(relief, size, size);
  for (const tex of [texture, bump]) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true; }
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, map: texture, bumpMap: bump, bumpScale: 0.007, roughness: 0.96 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_INSTANCING
        vec2 wearOffset = vec2(fract(instanceMatrix[3].x * 0.137), fract(instanceMatrix[3].z * 0.193));
        #ifdef USE_MAP
          vMapUv += wearOffset;
        #endif
        #ifdef USE_BUMPMAP
          vBumpMapUv += wearOffset;
        #endif
      #endif`);
  };
  material.customProgramCacheKey = () => 'high-road-cast-wear-02';
  return material;
}

/** Reference-informed parapet and pedestrian rail construction revision. */
export function buildHighRoadDetailed(data: any): THREE.Group {
  const group = buildHighRoad(data); group.name = 'High Road barrier revision · inferred construction';
  const pale = agedConcrete(false), dark = agedConcrete(true);
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a918a, roughness: 0.63, metalness: 0.62 });
  const oxidized = new THREE.MeshStandardMaterial({ color: 0x655b4b, roughness: 0.9, metalness: 0.2 });
  // Cross section is normalized to the baseline barrier's extents. Cast shoulder
  // chamfers break hard silhouette edges without changing any navigable width.
  const profile = new THREE.Shape();
  profile.moveTo(-0.50, -0.50); profile.lineTo(0.50, -0.50); profile.lineTo(0.50, -0.31);
  profile.lineTo(0.44, 0.43); profile.lineTo(0.36, 0.50); profile.lineTo(-0.36, 0.50);
  profile.lineTo(-0.44, 0.43); profile.lineTo(-0.50, -0.31); profile.closePath();
  const cast = new THREE.ExtrudeGeometry(profile, { depth: 1, bevelEnabled: false, steps: 1 });
  cast.translate(0, 0, -0.5); cast.rotateY(Math.PI / 2); cast.clearGroups();
  const tube = new THREE.CylinderGeometry(0.5, 0.5, 1, 8); tube.rotateZ(-Math.PI / 2);
  const box = new THREE.BoxGeometry(1, 1, 1), bolt = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6);
  const collar = new THREE.CylinderGeometry(0.037, 0.037, 0.035, 12);
  const cap = new THREE.SphereGeometry(0.031, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const footplates: THREE.Matrix4[] = [], bolts: THREE.Matrix4[] = [], collars: THREE.Matrix4[] = [], caps: THREE.Matrix4[] = [], seamCaps: THREE.Matrix4[] = [];
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(), temp = new THREE.Object3D();
  function collect(batch: THREE.Matrix4[], p: THREE.Vector3, s: THREE.Vector3, q = new THREE.Quaternion()) { temp.position.copy(p); temp.quaternion.copy(q); temp.scale.copy(s); temp.updateMatrix(); batch.push(temp.matrix.clone()); }
  for (const object of [...group.children]) {
    if (!(object instanceof THREE.InstancedMesh)) continue;
    if (object.name.includes('road parapet panels')) {
      object.geometry = cast; object.material = object.name.includes('dark') ? dark : pale;
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale);
        // Paint stripes are not individual blocks: close most seams, keep an
        // occasional actual expansion joint and slight cast coping projection.
        if (i % 3 !== 0) scale.x += 0.014;
        matrix.compose(position, rotation, scale); object.setMatrixAt(i, matrix);
        const tone = 0.90 + field(i, object.name.includes('dark') ? 7 : 11, 32) * 0.13;
        object.setColorAt(i, new THREE.Color(tone, tone, tone));
        if (i % 3 === 0) collect(seamCaps, position.clone().add(new THREE.Vector3(0, 0.346, 0)), new THREE.Vector3(0.027, 0.035, 0.34), rotation);
      }
      object.instanceMatrix.needsUpdate = true; if (object.instanceColor) object.instanceColor.needsUpdate = true;
      object.computeBoundingSphere();
    }
    if (object.name === 'Horizontal pedestrian handrails' || object.name === 'Outer walkway rail') { object.geometry = tube; object.material = steel; object.computeBoundingSphere(); }
    if (object.name === 'Galvanized pedestrian posts') {
      object.material = steel;
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale);
        // Mounting plate is embedded at the barrier top. Bolts/collars resolve
        // the previous visually floating post-to-concrete connection.
        const base = position.clone().add(new THREE.Vector3(0, -0.225, 0));
        collect(footplates, base, new THREE.Vector3(0.13, 0.018, 0.105));
        collect(collars, base.clone().add(new THREE.Vector3(0, 0.028, 0)), new THREE.Vector3(1, 1, 1));
        if (Math.hypot(position.x - 69.7, position.z + 275.9) < 95) {
          for (const x of [-0.042, 0.042]) for (const z of [-0.031, 0.031]) collect(bolts, base.clone().add(new THREE.Vector3(x, 0.014, z)), new THREE.Vector3(1, 1, 1));
          collect(caps, position.clone().add(new THREE.Vector3(0, 0.345, 0)), new THREE.Vector3(1, 1, 1));
        }
      }
    }
    if (object.name === 'Outer concrete walkway posts') object.material = pale;
  }
  for (const [name, geometry, material, matrices] of [
    ['Embedded rail post mounting plates', box, steel, footplates],
    ['Localized rail anchor bolts', bolt, oxidized, bolts],
    ['Rail post welded collars', collar, steel, collars],
    ['Rounded rail post caps', cap, steel, caps],
    ['Concrete coping joint edges', box, pale, seamCaps],
  ] as [string, THREE.BufferGeometry, THREE.Material, THREE.Matrix4[]][]) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length); mesh.name = name;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh);
  }
  let triangles = 0;
  group.traverse(o => { if (o instanceof THREE.Mesh) triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * (o instanceof THREE.InstancedMesh ? o.count : 1); });
  group.userData = { ...group.userData, status: 'Integrated reference-informed construction; dimensions and wear inferred', revision: 'barrier-construction-02', triangles, anchorBoltCount: bolts.length, mountingPlateCount: footplates.length, materialEvidence: 'Qualitative wear and assembly construction inferred from inspected Apr2018 flyover panorama and overbridge-2008. No image pixels copied; texture parameters, exact profiles, bolt and joint locations are inferred.' };
  return group;
}
