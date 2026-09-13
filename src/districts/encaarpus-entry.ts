import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLakshmiPlaster,setLakshmiMaterialUV} from './lakshmi-material';

type P=[number,number];
function clip(poly:P[],nx:number,nz:number,d:number){
  const result:P[]=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]*nx+a[1]*nz-d,db=b[0]*nx+b[1]*nz-d;
    if(da<=1e-9)result.push(a);
    if((da<0)!==(db<0)){const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return result;
}
/** Photo-visible irregular grey paving; tile layout and dimensions are inferred. */
export function buildEncaarpusPaving(width:number){
  let seed=185734;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const sites:P[]=[],cols=28,rows=9,z0=-.9,z1=3.6;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)sites.push([((col+.5+(random()-.5)*.55)/cols-.5)*width,z0+(row+.5+(random()-.5)*.58)/rows*(z1-z0)]);
  const pieces:THREE.BufferGeometry[]=[];let count=0;
  for(const site of sites){
    let poly:P[]=[[-width/2,z0],[width/2,z0],[width/2,z1],[-width/2,z1]];
    for(const other of sites){if(other===site || Math.hypot(other[0]-site[0],other[1]-site[1])>1.6)continue;poly=clip(poly,other[0]-site[0],other[1]-site[1],(other[0]**2+other[1]**2-site[0]**2-site[1]**2)/2);}
    const original=poly;
    for(let i=0;i<original.length;i++){const a=original[i],b=original[(i+1)%original.length],nx=b[1]-a[1],nz=a[0]-b[0];poly=clip(poly,nx,nz,nx*a[0]+nz*a[1]-.004*Math.hypot(nx,nz));}
    if(poly.length<3)continue;
    const shape=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0],-p[1])));
    const g=new THREE.ExtrudeGeometry(shape,{depth:.0226,bevelEnabled:true,bevelThickness:.0012,bevelSize:.0015,bevelSegments:1,steps:1});g.rotateX(-Math.PI/2);g.translate(0,.0312,0);g.clearGroups();setLakshmiMaterialUV(g);
    const shade=.88+random()*.20,warm=(random()-.5)*.026,colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=shade+warm;colors[i+1]=shade;colors[i+2]=shade-warm;}
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));pieces.push(g);count++;
  }
  const material=createLakshmiPlaster();material.name='Encaarpus entrance stone';material.color.setHex(0x8c8d82);material.vertexColors=true;material.roughness=.96;
  const geometry=mergeGeometries(pieces,false)!;pieces.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,material);mesh.name=material.name;mesh.castShadow=mesh.receiveShadow=true;
  mesh.userData={pavers:count,extent:[-width/2,width/2,z0,z1],topY:.055,jointPriorMeters:.008,source:'Grey irregular jointed entrance paving visible in January 2024 photo',limits:'Polygon layout, unit sizes, joints, bevels and pigment inferred; not a tile survey or identified stone product'};return mesh;
}

export async function installEncaarpusCar(buildings:THREE.Group){
  const front=buildings.children.find(g=>g.userData.wayId===354839754);if(!front)return;
  const [gltf,response]=await Promise.all([new GLTFLoader().loadAsync('/assets/encaarpus-parked-car.glb'),fetch('/assets/encaarpus-parked-car.json')]);
  if(!response.ok)throw new Error('Encaarpus car provenance unavailable');
  const evidence=await response.json();gltf.scene.name='Encaarpus parked hatchback';
  gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){const m=o.material as THREE.MeshPhysicalMaterial;o.name=m.name;if(o.geometry.index){const old=o.geometry;o.geometry=old.toNonIndexed();old.dispose();}o.castShadow=!(m.transmission>0);o.receiveShadow=true;}});
  front.add(gltf.scene);front.userData.parkedCar=evidence;
}
