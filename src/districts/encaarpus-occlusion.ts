import * as THREE from 'three';

type Binding={name:string;vertexCount:number;byteOffset:number;positionSha256:string;normalSha256:string};
async function hash(bytes:ArrayBuffer){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function surfaceHash(attribute:THREE.BufferAttribute){
  // JSON source interchange does not preserve negative zero. Canonicalize only zero signs.
  const values=new Float32Array(attribute.array.length);for(let i=0;i<values.length;i++)values[i]=attribute.array[i]===0?0:attribute.array[i];
  return hash(values.buffer);
}
/** Secondary UVs and AO only; the runtime mesh, normal field and material UV0 remain authoritative. */
export async function installEncaarpusOcclusion(buildings:THREE.Group){
  const front=buildings.children.find(g=>g.userData.wayId===354839754);
  if(!front)return;
  if(new URLSearchParams(location.search).get('encaarpusAO')==='0'){front.userData.ambientVisibility={enabled:false,control:true};return;}
  const response=await fetch('/assets/encaarpus-visibility.json');if(!response.ok)throw new Error('Encaarpus visibility manifest unavailable');
  const manifest=await response.json();
  const uvResponse=await fetch(manifest.uvBuffer);if(!uvResponse.ok)throw new Error('Encaarpus visibility coordinates unavailable');
  const buffer=await uvResponse.arrayBuffer();if(await hash(buffer)!==manifest.uvSha256)throw new Error('Encaarpus visibility coordinates have changed');
  const staged:{mesh:THREE.Mesh;uv:THREE.BufferAttribute}[]=[];
  for(const binding of manifest.bindings as Binding[]){
    const mesh=front.getObjectByName(binding.name) as THREE.Mesh|undefined;
    if(!mesh?.isMesh || Array.isArray(mesh.material))throw new Error('Missing Encaarpus visibility receiver '+binding.name);
    const p=mesh.geometry.getAttribute('position') as THREE.BufferAttribute,n=mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
    const [ph,nh]=await Promise.all([surfaceHash(p),surfaceHash(n)]);
    if(p.count!==binding.vertexCount || ph!==binding.positionSha256 || nh!==binding.normalSha256)throw new Error('Encaarpus visibility bake no longer matches '+binding.name);
    const values=new Float32Array(buffer,binding.byteOffset,binding.vertexCount*2);
    if(values.some(v=>!Number.isFinite(v)||v<0||v>1))throw new Error('Invalid Encaarpus visibility UV');
    staged.push({mesh,uv:new THREE.BufferAttribute(values,2)});
  }
  const texture=await new THREE.TextureLoader().loadAsync(manifest.atlas);
  texture.name='Encaarpus local-geometry ambient visibility';texture.channel=1;texture.colorSpace=THREE.NoColorSpace;texture.anisotropy=8;
  for(const {mesh,uv}of staged){
    mesh.geometry.setAttribute('uv1',uv);const material=mesh.material as THREE.MeshStandardMaterial;
    material.aoMap=texture;material.aoMapIntensity=1;material.needsUpdate=true;
  }
  front.userData.ambientVisibility={enabled:true,revision:manifest.revision,receivers:staged.length,resolution:manifest.size,uvBytes:buffer.byteLength,uvSha256:manifest.uvSha256,atlasSha256:manifest.atlasSha256,scope:manifest.scope,limits:manifest.limits};
}
