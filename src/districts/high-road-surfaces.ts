import * as THREE from 'three';
import { buildHighRoadDetailed } from './high-road-details.ts';

function applyHighRoadPaint(group: THREE.Group) {
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

/** Mapped bridge with inferred paint wear tied to its physical asphalt surface. */
export function buildHighRoadSurfaces(data: any): THREE.Group {
  const group = buildHighRoadDetailed(data);
  applyHighRoadPaint(group);
  let triangles = 0;
  group.traverse(object => {
    if (object instanceof THREE.Mesh) triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object instanceof THREE.InstancedMesh ? object.count : 1);
  });
  group.userData = {...group.userData, revision: 'asphalt-bound-paint-04', triangles, pairedJoints: false};
  return group;
}
