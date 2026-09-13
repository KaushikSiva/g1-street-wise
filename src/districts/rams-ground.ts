import * as THREE from 'three';
import seam from './rams-ground.json';
type Point=[number,number,number];
const gateZ=8.30,baseY=-.12;
export const RAMS_STEP={x:-6.26,z:-2.5,width:.50,depth:1.30,height:.18};
function surface(){
 const points:Point[]=[],triangles:number[][]=[],n=seam.points.length;
 for(const z of [0,gateZ])for(const p of seam.points)points.push([p[0],0,z]);
 points.push(...seam.points.map(p=>p as Point));
 for(let row=0;row<2;row++)for(let i=0;i<n-1;i++){const a=row*n+i,b=(row+1)*n+i;triangles.push([a,b,a+1],[a+1,b,b+1]);}
 return{points,triangles};
}
const top=surface();
function triangleHeight(x:number,z:number,a:Point,b:Point,c:Point){
 const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;
 return u>=-1e-8&&v>=-1e-8&&w>=-1e-8?u*a[1]+v*b[1]+w*c[1]:null;
}
export function sampleRamsGroundLocal(x:number,z:number):number|null{
 const s=RAMS_STEP;if(Math.abs(x-s.x)<=s.width/2&&Math.abs(z-s.z)<=s.depth/2)return s.height;
 if(x< -12.8||x>seam.width/2||z< -6||z>10)return null;
 if(z<0)return x< -seam.width/2?0:null;
 for(const[a,b,c]of top.triangles){const h=triangleHeight(x,z,top.points[a],top.points[b],top.points[c]);if(h!==null)return h;}
 return null;
}
export function buildRamsGround(width:number){
 if(Math.abs(width-seam.width)>.0001)throw Error('13/7 study width changed; regenerate road seam');
 const group=new THREE.Group();group.name='13/7 continuous hardstanding';
 const points:Point[]=[...top.points],triangles=top.triangles.map(t=>[...t]),boundary=new Map<string,{a:number;b:number;count:number}>();
 for(const t of triangles)for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],key=[a,b].sort((a,b)=>a-b).join(':');const old=boundary.get(key);if(old)old.count++;else boundary.set(key,{a,b,count:1});}
 for(const{a,b,count}of boundary.values())if(count===1){const aa=points.length;points.push([points[a][0],baseY,points[a][2]],[points[b][0],baseY,points[b][2]]);triangles.push([b,a,aa],[b,aa,aa+1]);}
 const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));indexed.setAttribute('uv',new THREE.Float32BufferAttribute(points.flatMap(p=>[p[0],p[2]]),2));indexed.setIndex(triangles.flat());const geometry=indexed.toNonIndexed();indexed.dispose();geometry.computeVertexNormals();
 const loader=new THREE.TextureLoader(),texture=(suffix:string,srgb=false)=>{const t=loader.load(`/assets/textures/concrete_floor_worn_001_${suffix}.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(.5,.5);t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;};
 const material=new THREE.MeshStandardMaterial({color:0xffffff,map:texture('Diffuse',true),normalMap:texture('nor_gl'),normalScale:new THREE.Vector2(.12,.12),roughnessMap:texture('Rough'),roughness:.98});material.name='13/7 worn hardstanding';
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float ramsMineral=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))/.0936721751,.65,1.4);
 diffuseColor.rgb=vec3(.205,.20,.18)*ramsMineral;
 `);};material.customProgramCacheKey=()=> 'rams-original-hardstanding-1';
 const add=(g:THREE.BufferGeometry,name:string)=>{const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);};
 add(geometry,'13/7 shoulder-connected apron');
 const side=new THREE.BoxGeometry(6.8,.12,6);side.translate(-9.4,-.06,-3);const uv=side.attributes.uv,p=side.attributes.position;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i),p.getZ(i));add(side,'13/7 north passage support');
 const s=RAMS_STEP,step=new THREE.BoxGeometry(s.width,s.height,s.depth);step.translate(s.x,s.height/2,s.z);add(step,'13/7 side-entry step');
 group.userData={seam:seam.points,sourcePositionSha256:seam.sourcePositionSha256,step:RAMS_STEP,sourceSha256:'663a51d2e1698d4fcf1aaa97861538460f98c5440f700d1b2a9f2f84bcdf63dd',limits:'Partial photographed13/7 frontage study. Existing inferred width, gate and side approach retained. Shoulder seam follows generated road geometry, not surveyed paving. Grade, material and180mm step are inferred; underground drainage and hidden property extent unverified. CC0 concrete scan provides relative wear with original pigment; no private source pixels.'};return group;
}
