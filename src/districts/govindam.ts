import * as THREE from 'three';
import { buildNeighborhood } from '../buildings';

export const GOVINDAM_WAY_ID = 1095927870;
export const GOVINDAM_BAY_ASSET_PATH = "/assets/govindam-bay.glb";
// Coordinated with revision4's unequal guard panels; inferred height, not a survey.
export const GOVINDAM_BAY_TOP_METERS = 8.99658229194451;

/** Builds one isolated source-footprint shell; caller excludes only this way from generic massing. */
export function buildGovindamShell(data: any, entranceFraction = .5): THREE.Group {
  const id = 1095927870;
  const way = data.elements.find((e: any) => e.type === 'way' && e.id === id);
  if (!way) throw new Error('Required Govindam source footprint missing');
  const sourceFingerprint=JSON.stringify(way);
  const east = 111320 * Math.cos(13.0516624 * Math.PI / 180);
  const points = way.geometry.map((p: any) => new THREE.Vector3((p.lon - 80.2306892) * east, 0, (13.0516624 - p.lat) * 111320));
  const a = points[0], b = points[1];
  const edge = b.clone().sub(a), width = edge.length();
  const outward = new THREE.Vector3(edge.z, 0, -edge.x).normalize();
  const pose = a.clone().lerp(b, entranceFraction);
  const yaw = Math.PI - Math.atan2(edge.z, edge.x);
  const halfBay = 1.945, upperHalfBay = 1.46, top = GOVINDAM_BAY_TOP_METERS;
  if (entranceFraction * width < halfBay || (1 - entranceFraction) * width < halfBay) throw new Error('Bay crosses mapped frontage end');
  const target = buildNeighborhood({ ...data, elements: data.elements.filter((e: any) => e.type === 'node' || (e.type === 'way' && e.id === id)) });
  target.name = 'Govindam same-footprint shell · unverified central entrance hypothesis';
  const heightRecord = target.userData.records.find((r:any)=>r.id===id);
  if (!heightRecord) throw new Error('Target source shell was rejected by building generator');
  const height = heightRecord.height;
  if (way.tags?.['building:levels'] !== '4' || heightRecord.heightSource !== 'OSM levels × inferred 3.1 m' || Math.abs(height - 12.75) > 1e-8) {
    throw new Error('Govindam source-height provenance changed; staged hypothesis needs review');
  }
  const sourceSceneBounds=new THREE.Box3().setFromObject(target);
  const preservedParts=target.children.filter(o=>!o.name.startsWith('Mapped building shells')).map(o=>({object:o,geometry:(o as THREE.Mesh).geometry}));
  if (height <= top) throw new Error('Source shell shorter than staged facade aperture');
  const cutFaces: any[] = [];
  let uvSamples: {distance:number;height:number;u:number;v:number}[] = [];
  let wallMaterial: THREE.Material | THREE.Material[] | undefined;
  let removedTriangles = 0;
  target.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.name.startsWith('Mapped building shells')) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const pos = geo.getAttribute('position'); const keep: number[] = [];
    for (let i = 0; i < pos.count; i += 3) {
      let onFront = true;
      for (let j = 0; j < 3; j++) {
        const p = new THREE.Vector3().fromBufferAttribute(pos, i+j);
        if (Math.abs(p.clone().sub(a).dot(outward)) > .001) onFront = false;
      }
      if (onFront) {
        removedTriangles++; wallMaterial = o.material;
        const uv=geo.getAttribute('uv');
        const samples=[0,1,2].map(j=>{const p=new THREE.Vector3().fromBufferAttribute(pos,i+j);return {distance:p.clone().sub(a).dot(edge.clone().normalize()),height:p.y,u:uv.getX(i+j),v:uv.getY(i+j)};});
        if (!uvSamples.length) uvSamples=samples;
        cutFaces.push({mesh:o.name,triangleIndex:i/3,vertices:[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(pos,i+j).toArray()),uv:samples.map(v=>[v.u,v.v])});
      }
      else keep.push(i, i+1, i+2);
    }
    const next = new THREE.BufferGeometry();
    for (const [key, raw] of Object.entries(geo.attributes)) {
      const attr = raw as THREE.BufferAttribute; const values: number[] = [];
      for (const index of keep) for (let k = 0; k < attr.itemSize; k++) values.push(attr.array[index*attr.itemSize+k]);
      next.setAttribute(key, new THREE.Float32BufferAttribute(values, attr.itemSize));
    }
    next.computeBoundingBox(); next.computeBoundingSphere(); o.geometry.dispose(); o.geometry=next; geo.dispose();
  });
  if (removedTriangles !== 2 || !wallMaterial) throw new Error(`Expected one front face; removed ${removedTriangles} triangles`);
  if (!(wallMaterial instanceof THREE.MeshStandardMaterial)) throw new Error('Expected source plaster material for isolated north wall');
  const originalWallColor = wallMaterial.color.getHexString();
  const northPlaster = wallMaterial.clone();
  northPlaster.name = 'Govindam north plaster · observed white near bay, extrapolated outside crop';
  northPlaster.color.set(0xf7f5f1);
  // Clone only material state; retaining the source maps preserves the established physical UV scale.
  northPlaster.userData = {
    sourcePhoto: 'Victor Livingstone, October 2018; Google photo CIHM0ogKEICAgICkv6CP_wE',
    observed: 'White plaster immediately flanking the blue entrance frame',
    inferred: 'Exact albedo and continuation across the full north face outside the narrow photo crop',
  };
  const front = new THREE.Group();front.position.copy(pose);front.rotation.y=yaw;
  front.name = 'Govindam north wall panels · reference-informed plaster';
  // Asset local +X points opposite source edge0→1 when its +Z faces outward.
  const leftExtent = (1-entranceFraction)*width, rightExtent = entranceFraction*width;
  function panel(x0:number,x1:number,y0:number,y1:number) {
    const geometry=new THREE.PlaneGeometry(x1-x0,y1-y0);
    // Preserve the removed face's affine physical UV mapping, not stretched 0..1 panel UVs.
    const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
    const [s0,s1,s2]=uvSamples;
    const dd1=s1.distance-s0.distance,dh1=s1.height-s0.height,dd2=s2.distance-s0.distance,dh2=s2.height-s0.height;
    const determinant=dd1*dh2-dd2*dh1;
    if(Math.abs(determinant)<1e-8)throw new Error('Degenerate source wall UV control triangle');
    for(let i=0;i<p.count;i++) {
      const distance=entranceFraction*width-((x0+x1)/2+p.getX(i)),h=(y0+y1)/2+p.getY(i);
      const dd=distance-s0.distance,dh=h-s0.height;
      const w1=(dd*dh2-dd2*dh)/determinant,w2=(dd1*dh-dd*dh1)/determinant;
      uv.setXY(i,s0.u+w1*(s1.u-s0.u)+w2*(s2.u-s0.u),s0.v+w1*(s1.v-s0.v)+w2*(s2.v-s0.v));
    }
    const mesh=new THREE.Mesh(geometry,northPlaster);
    mesh.position.set((x0+x1)/2,(y0+y1)/2,0);mesh.castShadow=mesh.receiveShadow=true;front.add(mesh);
  }
  panel(-leftExtent,-halfBay,0,3.1);panel(halfBay,rightExtent,0,3.1);
  panel(-leftExtent,-upperHalfBay,3.1,height);panel(upperHalfBay,rightExtent,3.1,height);
  panel(-upperHalfBay,upperHalfBay,top,height);
  target.add(front);
  if(wallMaterial.color.getHexString()!==originalWallColor || northPlaster===wallMaterial || northPlaster.map!==wallMaterial.map || northPlaster.bumpMap!==wallMaterial.bumpMap)throw new Error('North plaster clone altered source material or texture controls');
  const finalSceneBounds=new THREE.Box3().setFromObject(target);
  const boundsError=Math.max(sourceSceneBounds.min.distanceTo(finalSceneBounds.min),sourceSceneBounds.max.distanceTo(finalSceneBounds.max));
  if(boundsError>1e-4)throw new Error(`Source shell bounds changed by ${boundsError} m`);
  if(JSON.stringify(way)!==sourceFingerprint)throw new Error('Input source footprint mutated');
  if(preservedParts.some(p=>(p.object as THREE.Mesh).geometry!==p.geometry))throw new Error('Roof/parapet geometry changed');
  const modelRight = new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const camera = pose.clone().addScaledVector(outward, 15).addScaledVector(modelRight,-2.0);camera.y=3.4;
  const lookAt=pose.clone();lookAt.y=3.9;
  const result={pose:pose.toArray(),yawRadians:yaw,modelFrontAxis:'+Z',modelInteriorAxis:'-Z',units:'metres; dimensions inferred',entranceFraction,sourceEdge:[0,1],sourceWidth:width,maskWidth:halfBay*2,upperMaskWidth:upperHalfBay*2,maskStepHeight:3.1,maskHeight:top,sourceShellHeight:height,sourceHeightProvenance:heightRecord.heightSource,sourceLevelsTag:way.tags?.["building:levels"],footprintWgs84:way.geometry,sourceBounds:way.bounds,roofPreserved:true,parapetsPreserved:true,sourceDataUnchanged:true,shellBoundsDeltaMeters:boundsError,shellSceneBounds:{min:finalSceneBounds.min.toArray(),max:finalSceneBounds.max.toArray()},wallUvMapping:"Affine interpolation of original front-face position/UV controls",cutFaces,removedTriangles,approvedReplacementIds:[],candidateBuildingId:id,camera:camera.toArray(),target:lookAt.toArray(),warning:'Reference-informed partial frontage; entrance center, width, height and north-edge correspondence not metrically verified.'};
  target.userData = {...target.userData, govindamStudy:{...result,northPlaster:{...northPlaster.userData,colorSrgbHex:northPlaster.color.getHexString(),originalShellColorSrgbHex:originalWallColor,materialCloned:true,sourceMaterialUnchanged:true,sourceTextureMappingPreserved:true,scope:'Five replacement panels on nominated north face only'}}};
  return target;
}
