import * as THREE from 'three';
import { buildHighRoadDetailed } from './high-road-details.ts';

export type HighRoadCandidateOptions = { paint?: boolean; pairedJoints?: boolean };

function applyPaintCandidate(group: THREE.Group) {
  const old = group.getObjectByName('Faint worn center marking');
  const asphalt = group.getObjectByName('Worn asphalt carriageway');
  if (!(old instanceof THREE.InstancedMesh) || !(asphalt instanceof THREE.Mesh)) return;
  const roadMaterial = asphalt.material as THREE.MeshStandardMaterial;
  const positions: number[] = [], uvs: number[] = [], edges: number[] = [], indices: number[] = [];
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0), ray = new THREE.Raycaster();
  asphalt.updateMatrixWorld(true);
  let minOffset = Infinity, maxOffset = -Infinity, missingSamples = 0;
  for (let instance = 0; instance < old.count; instance++) {
    old.getMatrixAt(instance, matrix);
    const start = positions.length / 3, subdivisions = 16;
    for (let j = 0; j <= subdivisions; j++) for (const side of [-1, 1]) {
      point.set(j / subdivisions - 0.5, 0, side * 0.5).applyMatrix4(matrix);
      ray.set(point.clone().add(new THREE.Vector3(0, 0.15, 0)), down);
      const hit = ray.intersectObject(asphalt, false)[0];
      if (!hit) { missingSamples++; continue; }
      const y = hit.point.y + 0.0005;
      minOffset = Math.min(minOffset, y - hit.point.y); maxOffset = Math.max(maxOffset, y - hit.point.y);
      positions.push(point.x, y, point.z); uvs.push(hit.uv?.x ?? 0, hit.uv?.y ?? 0); edges.push(j / subdivisions * 2 - 1, side);
    }
    if (positions.length / 3 - start !== (subdivisions + 1) * 2) {
      positions.length = start * 3; uvs.length = start * 2; edges.length = start * 2; continue;
    }
    for (let j = 0; j < subdivisions; j++) { const n = start + j * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setAttribute('paintEdge', new THREE.Float32BufferAttribute(edges, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const paint = new THREE.MeshStandardMaterial({ color: 0xb4a665, roughness: 0.98, map: roadMaterial.map, roughnessMap: roadMaterial.roughnessMap, transparent: true, opacity: 0.78, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  paint.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute vec2 paintEdge; varying vec2 vPaintEdge; varying vec2 vPaintMeters;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvPaintMeters = uv; vPaintEdge = paintEdge;');
    shader.fragmentShader = 'varying vec2 vPaintEdge; varying vec2 vPaintMeters;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', `
      float paintHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float paintNoise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(paintHash(i),paintHash(i+vec2(1,0)),f.x),mix(paintHash(i+vec2(0,1)),paintHash(i+vec2(1,1)),f.x),f.y); }
      void main() {`);
    // Preserve pigment reflectance while inheriting the actual road aggregate
    // modulation; multiplying paint by dark asphalt albedo would erase it.
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_MAP
        float stoneTone = clamp(dot(sampledDiffuseColor.rgb, vec3(0.2126,0.7152,0.0722))*3.0,0.0,1.0);
        diffuseColor.rgb = diffuse * (0.66 + 0.34 * stoneTone);
      #endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
      float aggregate = paintNoise(vPaintMeters / 0.014);
      float chips = paintNoise(vPaintMeters / 0.070);
      float abrasion = paintNoise(vPaintMeters / 0.28);
      float coverage = smoothstep(0.34, 0.61, aggregate * 0.45 + chips * 0.32 + abrasion * 0.23);
      float feather = 1.0-smoothstep(0.63,1.0,abs(vPaintEdge.y)+chips*0.13);
      float endWear = 1.0-smoothstep(0.84,1.0,abs(vPaintEdge.x));
      diffuseColor.a *= coverage * feather * endWear;
    `);
  };
  paint.customProgramCacheKey = () => 'high-road-asphalt-bound-paint-04';
  const mesh = new THREE.Mesh(geometry, paint); mesh.name = 'Asphalt-bound abraded center paint'; mesh.receiveShadow = true; mesh.castShadow = false;
  group.remove(old); group.add(mesh);
  group.userData.paintStudy = { dashCount: old.count, missedRoadSamples: missingSamples, minOffsetMeters: minOffset, maxOffsetMeters: maxOffset, asphaltUvRepeat: [0.24, 0.24], abrasionScalesMeters: [0.014, 0.070, 0.28], evidence: 'Historic Apr2018 flyover panorama shows faint discontinuous yellow center paint. Dash locations are inherited inferred positions; wear patterns are procedural inference. Every paint sample reuses the underlying asphalt hit UV and surface height.' };
}

/** Default candidate isolates worn paint; paired joints remain explicitly disabled. */
export function buildHighRoadCandidate(data: any, options: HighRoadCandidateOptions = {}): THREE.Group {
  const group = buildHighRoadDetailed(data);
  group.name = 'High Road surface construction · staged';
  if (options.paint !== false) applyPaintCandidate(group);
  if (options.pairedJoints !== true) {
    let triangles = 0;
    group.traverse(o => { if (o instanceof THREE.Mesh) triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * (o instanceof THREE.InstancedMesh ? o.count : 1); });
    group.userData = { ...group.userData, status: 'staged candidate / not production', revision: 'asphalt-bound-paint-04', pairedJoints: false, paintEnabled: options.paint !== false, triangles };
    return group;
  }
  const original = group.getObjectByName('Deck expansion joints');
  if (!(original instanceof THREE.InstancedMesh)) return group;
  const asphalt = group.getObjectByName('Worn asphalt carriageway');
  const asphaltMaterial = asphalt instanceof THREE.Mesh ? asphalt.material as THREE.MeshStandardMaterial : undefined;
  const steel = new THREE.MeshStandardMaterial({ color: 0x777a72, roughness: 0.72, metalness: 0.52 });
  const seal = new THREE.MeshStandardMaterial({ color: 0x353730, roughness: 0.98 });
  const repair = new THREE.MeshStandardMaterial({ color: 0x7d7d70, roughness: 0.98, map: asphaltMaterial?.map ?? null, roughnessMap: asphaltMaterial?.roughnessMap ?? null, transparent: true, opacity: 0.23, depthWrite: false });
  repair.polygonOffset = true; repair.polygonOffsetFactor = -1; repair.polygonOffsetUnits = -1;
  const box = new THREE.BoxGeometry(1, 1, 1), plane = new THREE.PlaneGeometry(1, 1); plane.rotateX(-Math.PI / 2);
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), position = new THREE.Vector3(), scale = new THREE.Vector3(), temp = new THREE.Object3D();
  const edges: THREE.Matrix4[] = [], seals: THREE.Matrix4[] = [], repairs: THREE.Matrix4[] = [], anchors: THREE.Matrix4[] = [];
  const recordedTransforms: number[][] = [];
  function add(batch: THREE.Matrix4[], offset: THREE.Vector3, dimensions: THREE.Vector3) {
    temp.position.copy(offset).applyQuaternion(rotation).add(position); temp.quaternion.copy(rotation); temp.scale.copy(dimensions); temp.updateMatrix(); batch.push(temp.matrix.clone());
  }
  for (let i = 0; i < original.count; i++) {
    original.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale); recordedTransforms.push(matrix.toArray());
    // Original joint center is deck +0.021 m. The carriageway top is +0.014.
    // Keep the dark seal embedded and the steel shoulders nearly flush; no raised bump.
    add(seals, new THREE.Vector3(0, -0.005, 0), new THREE.Vector3(scale.x, 0.006, 0.033));
    for (const side of [-1, 1]) {
      add(edges, new THREE.Vector3(0, -0.001, side * 0.031), new THREE.Vector3(scale.x, 0.009, 0.022));
      // Narrow resurfaced aggregate apron, anchored to the existing joint only.
      add(repairs, new THREE.Vector3(0, -0.006, side * 0.117), new THREE.Vector3(scale.x, 1, 0.145));
      if (Math.hypot(position.x - 69.7, position.z + 275.9) < 95) {
        for (let across = -scale.x / 2 + 0.35; across < scale.x / 2 - 0.1; across += 0.55) {
          add(anchors, new THREE.Vector3(across, 0.004, side * 0.031), new THREE.Vector3(0.018, 0.003, 0.014));
        }
      }
    }
  }
  group.remove(original);
  const batches: [string, THREE.BufferGeometry, THREE.Material, THREE.Matrix4[]][] = [
    ['Expansion joint steel shoulder strips', box, steel, edges],
    ['Recessed expansion joint seal', box, seal, seals],
    ['Joint aggregate repair aprons', plane, repair, repairs],
    ['Local joint countersunk fixings', box, seal, anchors],
  ];
  for (const [name, geometry, material, matrices] of batches) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length); mesh.name = name;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.instanceMatrix.needsUpdate = true; mesh.receiveShadow = true; mesh.castShadow = false; mesh.computeBoundingSphere(); group.add(mesh);
  }
  let triangles = 0;
  group.traverse(o => { if (o instanceof THREE.Mesh) triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * (o instanceof THREE.InstancedMesh ? o.count : 1); });
  group.userData = {
    ...group.userData,
    status: 'staged candidate / not production', revision: 'expansion-joint-construction-03', pairedJoints: true, paintEnabled: options.paint !== false, triangles,
    jointCount: original.count, jointSteelStripCount: edges.length, jointFixingCount: anchors.length,
    retainedJointTransforms: recordedTransforms,
    evidence: 'Apr2018 Kodambakkam flyover panorama visibly shows narrow paired transverse joint edges and nearby road-surface wear. Existing modeled joint transforms are retained; they remain inferred positions rather than mapped fixture locations. Steel profile, seal, apron widths and fixings are inferred construction details. No Google image pixels copied.',
    unchanged: ['centerline', 'road deck geometry', 'road elevations', 'navigation height sampler', 'barriers', 'pier geometry', 'existing joint positions'],
  };
  return group;
}
