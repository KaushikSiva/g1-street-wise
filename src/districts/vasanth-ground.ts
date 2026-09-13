import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import seam from './vasanth-ground.json';
type P=[number,number,number];
const gateZ=3,baseY=-.12,lidMinZ=3.14,lidMaxZ=3.50;
const lids=[.4,1.2,2].map(offset=>({x:seam.width/2+offset,width:.70,z:(lidMinZ+lidMaxZ)/2,depth:lidMaxZ-lidMinZ}));
function edgeAt(x:number):P|null{
 for(let i=0;i<seam.points.length-1;i++){const a=seam.points[i],b=seam.points[i+1];if(x>=a[0]-1e-8&&x<=b[0]+1e-8){const t=(x-a[0])/(b[0]-a[0]);return[x,a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])];}}
 return null;
}
function surface(){
 const xs=[...new Set([...seam.points.map(p=>p[0]),...lids.flatMap(p=>[p.x-p.width/2,p.x+p.width/2])])].sort((a,b)=>a-b),points:P[]=[],triangles:number[][]=[];
 for(const row of [0,1,2,3,4])for(const x of xs){const edge=edgeAt(x)!;const z=[0,gateZ,lidMinZ,lidMaxZ,edge[2]][row];points.push([x,z<=gateZ?0:edge[1]*(z-gateZ)/(edge[2]-gateZ),z]);}
 for(let row=0;row<4;row++)for(let i=0;i<xs.length-1;i++){const a=row*xs.length+i,b=(row+1)*xs.length+i;triangles.push([a,b,a+1],[a+1,b,b+1]);}
 return{points,triangles};
}
const top=surface();
function heightInTriangle(x:number,z:number,a:P,b:P,c:P){
 const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;
 return u>=-1e-8&&v>=-1e-8&&w>=-1e-8?u*a[1]+v*b[1]+w*c[1]:null;
}
export function sampleVasanthApronLocal(x:number,z:number):number|null{
 if(z<0||z>4.3||x< -seam.width/2||x>seam.width/2+2.4)return null;
 for(const [a,b,c]of top.triangles){const h=heightInTriangle(x,z,top.points[a],top.points[b],top.points[c]);if(h!==null)return h;}
 return null;
}
function material(){
 const loader=new THREE.TextureLoader(),texture=(suffix:string,srgb=false)=>{const t=loader.load(`/assets/textures/concrete_floor_worn_001_${suffix}.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(.6,.6);t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;};
 const m=new THREE.MeshStandardMaterial({color:0xffffff,map:texture('Diffuse',true),normalMap:texture('nor_gl'),normalScale:new THREE.Vector2(.12,.12),roughnessMap:texture('Rough'),roughness:.98});m.name='Vasanth continuous hardstanding';
 m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float vvMineral=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))/.0936721751,.65,1.35);
 diffuseColor.rgb=vec3(.24,.225,.193)*vvMineral;
 `);};m.customProgramCacheKey=()=> 'vasanth-original-hardstanding-1';return m;
}
export function buildVasanthGround(width:number,rear:number){
 if(Math.abs(width-seam.width)>.0001)throw Error('Vasanth footprint changed: regenerate shoulder seam');
 const group=new THREE.Group();group.name='Vasanth continuous ground and perforated threshold covers';
 const groundMaterial=material(),coverMaterial=groundMaterial.clone();coverMaterial.name='Vasanth perforated threshold covers';coverMaterial.onBeforeCompile=groundMaterial.onBeforeCompile;coverMaterial.customProgramCacheKey=groundMaterial.customProgramCacheKey;
 const cavityMaterial=new THREE.MeshStandardMaterial({name:'Vasanth threshold recess',color:0x555349,roughness:1});
 const points:P[]=[...top.points],triangles=top.triangles.filter(t=>{const p=t.map(i=>points[i]),x=p.reduce((s,p)=>s+p[0],0)/3,z=p.reduce((s,p)=>s+p[2],0)/3;return !lids.some(l=>Math.abs(x-l.x)<l.width/2&&z>lidMinZ&&z<lidMaxZ);});
 const boundary=new Map<string,{a:number;b:number;count:number}>();
 for(const t of triangles)for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],key=[a,b].sort((a,b)=>a-b).join(':');const old=boundary.get(key);if(old)old.count++;else boundary.set(key,{a,b,count:1});}
 for(const {a,b,count}of boundary.values())if(count===1){const aa=points.length;points.push([points[a][0],baseY,points[a][2]],[points[b][0],baseY,points[b][2]]);triangles.push([b,a,aa],[b,aa,aa+1]);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(points.flatMap(p=>[p[0],p[2]]),2));geometry.setIndex(triangles.flat());const flat=geometry.toNonIndexed();geometry.dispose();flat.computeVertexNormals();
 const mesh=new THREE.Mesh(flat,groundMaterial);mesh.name='Vasanth shoulder-connected apron';mesh.receiveShadow=mesh.castShadow=true;group.add(mesh);
 const side=new THREE.BoxGeometry(2.4,.12,-rear);side.translate(width/2+1.2,-.06,rear/2);const uv=side.attributes.uv,p=side.attributes.position;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i),p.getZ(i));const passage=new THREE.Mesh(side,groundMaterial);passage.name='Vasanth north passage support';passage.receiveShadow=passage.castShadow=true;group.add(passage);
 const coverGeometries:THREE.BufferGeometry[]=[],cavityGeometries:THREE.BufferGeometry[]=[],holes:P[]=[];
 for(const lid of lids){
  const shape=new THREE.Shape();const x0=lid.x-lid.width/2+.004,x1=lid.x+lid.width/2-.004,z0=lidMinZ+.004,z1=lidMaxZ-.004;
  shape.moveTo(x0,-z0);shape.lineTo(x1,-z0);shape.lineTo(x1,-z1);shape.lineTo(x0,-z1);shape.closePath();
  for(const dx of [-.22,0,.22])for(const dz of [-.105,0,.105]){const x=lid.x+dx,z=lid.z+dz,hole=new THREE.Path();hole.absarc(x,-z,.028,0,Math.PI*2,true);shape.holes.push(hole);holes.push([x,sampleVasanthApronLocal(x,z)!,z]);}
  const g=new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false,curveSegments:8});g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)-.035+sampleVasanthApronLocal(p.getX(i),p.getZ(i))!);g.computeVertexNormals();coverGeometries.push(g);
  const bottom=new THREE.BoxGeometry(lid.width,.008,lid.depth);bottom.translate(lid.x,-.047,lid.z);cavityGeometries.push(bottom.toNonIndexed());bottom.dispose();
 }
 for(const [geometries,mat]of [[coverGeometries,coverMaterial],[cavityGeometries,cavityMaterial]] as const){const g=mergeGeometries([...geometries],false);if(!g)throw Error('Vasanth cover merge failed');const mesh=new THREE.Mesh(g,mat);mesh.name=mat.name;mesh.receiveShadow=mesh.castShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
 group.userData={seam:seam.points,sourcePositionSha256:seam.sourcePositionSha256,lids,holes,holeRadius:.028,navigation:'Walking support bridges 56 mm holes; covers follow the apron grade within tessellation tolerance.',sourceSha256:'b358e3216399a7f49148164b91aa3dae8b8fb869bb7af85bf74ab52247f9db0a',source:'Saved Vasanth gallery photo1: continuous driveway and perforated covers at gate threshold.',limits:'Three covers, 3x3 perforations, dimensions, shallow recess and all levels/finish are inferred from a partly open gate photograph. Underground connection/function not established. Outer seam retains actual generated road geometry. Existing CC0 concrete scan supplies relative wear only; no private source pixels.'};return group;
}
