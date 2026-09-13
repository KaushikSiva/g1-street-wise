import * as THREE from 'three';

type GeometryBinding={name:string;positionSha256:string;normalSha256:string;matrixSha256:string;castShadow:boolean;glass:boolean};
type Receiver=GeometryBinding&{vertexCount:number;byteOffset:number};
async function hash(bytes:ArrayBuffer){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function floats(values:ArrayLike<number>){const canonical=new Float32Array(values.length);for(let i=0;i<values.length;i++)canonical[i]=values[i]===0?0:values[i];return hash(canonical.buffer);}

/** Geometry-derived local visibility, installed atomically after validating all
 * receivers and occluders. AO modulates Three's indirect terms only.
 */
export async function installAvinashVisibility(buildings:THREE.Group){
  const front=buildings.children.find(g=>g.userData.wayId===354839974);
  if(!front)return;
  if(new URLSearchParams(location.search).get('avinashAO')==='0'){front.userData.ambientVisibility={enabled:false,control:true};return;}
  front.updateWorldMatrix(true,true);const worldScale=front.getWorldScale(new THREE.Vector3());
  if(worldScale.toArray().some(v=>Math.abs(v-1)>1e-6))throw new Error('Avinash visibility radius requires unit world scale');
  const response=await fetch('/assets/avinash-visibility.json');if(!response.ok)throw new Error('Avinash visibility manifest unavailable');
  const manifest=await response.json();
  const meshes=new Map<string,THREE.Mesh>();front.traverse(o=>{if(o instanceof THREE.Mesh){if(meshes.has(o.name))throw new Error('Duplicate Avinash visibility mesh '+o.name);meshes.set(o.name,o);}});
  if(new Set(manifest.occluders.map((b:GeometryBinding)=>b.name)).size!==manifest.occluders.length||new Set(manifest.bindings.map((b:Receiver)=>b.name)).size!==manifest.bindings.length)throw new Error('Duplicate Avinash visibility binding');
  if(meshes.size!==manifest.occluders.length)throw new Error('Avinash visibility geometry set changed');
  for(const binding of manifest.occluders as GeometryBinding[]){
    const mesh=meshes.get(binding.name);
    if(!mesh||Array.isArray(mesh.material)||mesh.geometry.index)throw new Error('Missing Avinash visibility surface '+binding.name);
    mesh.updateMatrix();const material=mesh.material as THREE.MeshPhysicalMaterial;
    const [position,normal,matrix]=await Promise.all([floats(mesh.geometry.attributes.position.array),floats(mesh.geometry.attributes.normal.array),floats(mesh.matrix.elements)]);
    if(position!==binding.positionSha256||normal!==binding.normalSha256||matrix!==binding.matrixSha256||mesh.castShadow!==binding.castShadow||!!material.transmission!==binding.glass)throw new Error('Avinash visibility bake no longer matches '+binding.name);
  }
  const [uvResponse,atlasResponse]=await Promise.all([fetch(manifest.uvBuffer),fetch(manifest.atlas)]);
  if(!uvResponse.ok||!atlasResponse.ok)throw new Error('Avinash visibility assets unavailable');
  const [buffer,atlas]=await Promise.all([uvResponse.arrayBuffer(),atlasResponse.arrayBuffer()]);
  const [uvHash,atlasHash]=await Promise.all([hash(buffer),hash(atlas)]);
  if(uvHash!==manifest.uvSha256||atlasHash!==manifest.atlasSha256)throw new Error('Avinash visibility asset hash mismatch');
  const staged=(manifest.bindings as Receiver[]).map(binding=>{
    const mesh=meshes.get(binding.name),occluder=(manifest.occluders as GeometryBinding[]).find(b=>b.name===binding.name);
    if(!mesh||!occluder||['positionSha256','normalSha256','matrixSha256'].some(k=>(binding as unknown as Record<string,unknown>)[k]!==(occluder as unknown as Record<string,unknown>)[k]))throw new Error('Invalid Avinash receiver binding '+binding.name);
    if(mesh.geometry.attributes.position.count!==binding.vertexCount||binding.byteOffset%4||binding.byteOffset<0||binding.byteOffset+binding.vertexCount*8>buffer.byteLength)throw new Error('Invalid Avinash visibility receiver '+binding.name);
    const values=new Float32Array(buffer,binding.byteOffset,binding.vertexCount*2);
    if(values.some(v=>!Number.isFinite(v)||v<0||v>1))throw new Error('Invalid Avinash visibility coordinates');
    return{mesh,uv:new THREE.BufferAttribute(values,2)};
  });
  const url=URL.createObjectURL(new Blob([atlas],{type:'image/png'}));let texture:THREE.Texture;
  try{texture=await new THREE.TextureLoader().loadAsync(url);}finally{URL.revokeObjectURL(url);}
  const image=texture.image as HTMLImageElement;
  if(image.width!==manifest.size[0]||image.height!==manifest.size[1]){texture.dispose();throw new Error('Avinash visibility atlas dimensions changed');}
  texture.name='Avinash local geometry ambient visibility';texture.channel=1;texture.colorSpace=THREE.NoColorSpace;texture.anisotropy=8;
  let prepared:{mesh:THREE.Mesh;uv:THREE.BufferAttribute;material:THREE.MeshStandardMaterial}[]=[];
  try{
    for(const{mesh,uv}of staged){
      const sourceMaterial=mesh.material as THREE.MeshStandardMaterial,material=sourceMaterial.clone();
      prepared.push({mesh,uv,material});
      material.onBeforeCompile=sourceMaterial.onBeforeCompile;material.customProgramCacheKey=sourceMaterial.customProgramCacheKey;
      material.aoMap=texture;material.aoMapIntensity=1;material.needsUpdate=true;
    }
  }catch(error){for(const p of prepared)p.material.dispose();texture.dispose();throw error;}
  for(const{mesh,uv,material}of prepared){mesh.geometry.setAttribute('uv1',uv);mesh.material=material;}

  front.userData.ambientVisibility={enabled:true,revision:manifest.revision,receivers:staged.length,resolution:manifest.size,radiusMeters:manifest.radiusMeters,uvSha256:manifest.uvSha256,atlasSha256:manifest.atlasSha256,scope:manifest.scope,limits:manifest.limits};
}
