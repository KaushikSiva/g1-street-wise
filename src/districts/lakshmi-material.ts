import * as THREE from 'three';

/** A 1.024 m original plaster field; maps carry no captured lighting. */
export function createLakshmiPlaster() {
  const loader=new THREE.TextureLoader();
  const texture=(name:string)=>{
    const t=loader.load(`/assets/textures/plaster_fine_${name}.png`);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/1.024,1/1.024);
    t.colorSpace=THREE.NoColorSpace;t.anisotropy=8;return t;
  };
  // Match the old average linear pigment response; changing the texture must
  // not covertly change exposure or pretend to be a measured paint color.
  const material=new THREE.MeshStandardMaterial({color:new THREE.Color(0xe7e5dc).multiplyScalar(.82/.945),
    map:texture('pigment'),normalMap:texture('normal'),roughnessMap:texture('roughness'),roughness:1});
  material.name='Lakshmi plaster · original millimetre relief, metre-space UV';
  material.userData={tileMeters:1.024,normalScale:1,heightPriorMeters:[-.000451593,.00054055],status:'Original procedural material prior; not a scan of this building'};
  return material;
}

/** Assign physical planar UV coordinates from local positions, never each panel's 0..1 bounds. */
export function setLakshmiMaterialUV(geometry:THREE.BufferGeometry) {
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i);
    if(Math.abs(nz)>=Math.abs(nx) && Math.abs(nz)>=Math.abs(ny))uv.setXY(i,nz>=0?x:-x,y);
    else if(Math.abs(nx)>=Math.abs(ny))uv.setXY(i,nx>=0?-z:z,y);
    else uv.setXY(i,x,ny>=0?-z:z);
  }
  uv.needsUpdate=true;
}
