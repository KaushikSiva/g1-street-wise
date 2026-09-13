import * as THREE from 'three';
import seam from './avinash-ground.json';
type Point=[number,number,number];
const backY=.055,gateY=.005,gateZ=4.3,baseY=-.095;
function surface(width:number){
 if(Math.abs(width-seam.width)>.0001)throw new Error('Avinash ground footprint width changed; regenerate shoulder seam');
 const edge=seam.points.map(p=>p.point as Point),positions:Point[]=[],triangles:number[][]=[];
 for(const z of [0,gateZ])for(const [x]of edge)positions.push([x,z===0?backY:gateY,z]);
 positions.push(...edge);const n=edge.length;
 for(let row=0;row<2;row++)for(let i=0;i<n-1;i++){
  const a=row*n+i,b=(row+1)*n+i;triangles.push([a,b,a+1],[a+1,b,b+1]);
 }
 return{positions,triangles,edge};
}
function triangleHeight(x:number,z:number,a:Point,b:Point,c:Point){
 const denominator=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/denominator;
 const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/denominator,w=1-u-v;
 return u>=-1e-8&&v>=-1e-8&&w>=-1e-8?u*a[1]+v*b[1]+w*c[1]:null;
}
const cachedSurface=surface(seam.width);
/** Exact same piecewise planar top used by the closed rendered mesh. */
export function sampleAvinashGroundLocal(x:number,z:number,width=seam.width):number|null{
 if(Math.abs(width-seam.width)>.0001)return null;
 if(x < -width/2-1e-8||x > width/2+1e-8||z<0||z>6.01)return null;
 if(z<=gateZ)return backY+(gateY-backY)*z/gateZ;
 for(const[a,b,c]of cachedSurface.triangles){const y=triangleHeight(x,z,cachedSurface.positions[a],cachedSurface.positions[b],cachedSurface.positions[c]);if(y!==null)return y;}
 return null;
}
export function createAvinashGroundHeightSampler(data:any){
 const way=data.elements.find((e:any)=>e.type==='way'&&e.id===354839974),east=111320*Math.cos(13.0516624*Math.PI/180);
 if(!way?.geometry||way.geometry.length!==5)return()=>null;
 const project=(p:any)=>new THREE.Vector3((p.lon-80.2306892)*east,0,(13.0516624-p.lat)*111320);
 const a=project(way.geometry[1]),b=project(way.geometry[2]),along=b.clone().sub(a).normalize(),outward=new THREE.Vector3(along.z,0,-along.x),width=a.distanceTo(b);
 const inverse=new THREE.Matrix4().compose(a.clone().lerp(b,.5),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(outward.x,outward.z)),new THREE.Vector3(1,1,1)).invert(),p=new THREE.Vector3();
 return(x:number,z:number)=>{p.set(x,0,z).applyMatrix4(inverse);return sampleAvinashGroundLocal(p.x,p.z,width);};
}
/** Source-visible courtyard/apron study bounded by the existing frontage width
 * and actual rendered shoulder seam. Heights and material response are priors.
 */
export function buildAvinashGround(width:number){
 const{positions,triangles,edge}=surface(width),boundary=new Map<string,{a:number;b:number;count:number}>();
 for(const tri of triangles)for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3],key=[a,b].sort((a,b)=>a-b).join(':');const existing=boundary.get(key);if(existing)existing.count++;else boundary.set(key,{a,b,count:1});}
 const bottom=new Map<number,number>(),base=(i:number)=>{let b=bottom.get(i);if(b===undefined){b=positions.length;positions.push([positions[i][0],baseY,positions[i][2]]);bottom.set(i,b);}return b;};
 const center=positions.length;positions.push([0,baseY,gateZ/2]);
 for(const{a,b,count}of boundary.values())if(count===1){const aa=base(a),bb=base(b);triangles.push([b,a,aa],[b,aa,bb],[bb,aa,center]);}
 const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(positions.flat(),3));indexed.setAttribute('uv',new THREE.Float32BufferAttribute(positions.flatMap(p=>[p[0],p[2]]),2));indexed.setIndex(triangles.flat());
 const geometry=indexed.toNonIndexed();indexed.dispose();geometry.computeVertexNormals();
 const loader=new THREE.TextureLoader(),texture=(suffix:string,srgb=false)=>{const t=loader.load(`/assets/textures/concrete_floor_worn_001_${suffix}.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(.5,.5);t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;};
 const material=new THREE.MeshStandardMaterial({color:0xffffff,map:texture('Diffuse',true),normalMap:texture('nor_gl'),normalScale:new THREE.Vector2(.10,.10),roughnessMap:texture('Rough'),roughness:.98});
 material.name='Avinash continuous hardstanding';
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float mineralVariation=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))/.0936721751,.6,1.4);
 diffuseColor.rgb=vec3(.22,.215,.20)*mineralVariation;
 `);};
 material.customProgramCacheKey=()=> 'avinash-hardstanding-pigment-1';
 material.userData={pigmentLinear:[.22,.215,.20],scanMeanLuminance:.0936721751,variationBounds:[.6,1.4],source:'Existing Poly Haven CC0 concrete_floor_worn_001 scan, relative wear/roughness/normal only',limits:'Original grey/brown pigment prior, scale and grade inferred; no captured lighting or private photograph pixels'};
 const mesh=new THREE.Mesh(geometry,material);mesh.name='Avinash continuous hardstanding';mesh.receiveShadow=true;mesh.castShadow=true;
 mesh.userData={revision:1,backY,gateY,gateZ,baseY,shoulderSeam:edge,sourcePositionSha256:seam.sourcePositionSha256,source:'Private Avinash west view shows worn continuous grey/brown apron beneath the parked motorcycle and through the gate',sourceSha256:'9454a6e8e1ad98ee3fe917cdeb6d47be95d6808a4d21888e1489fb1b83fcb909',limits:'Frontage width and existing boundary retained; paving extent, grade, material, scale and construction inferred. Outer edge copies actual generated shoulder vertices, not a surveyed paving line. No new kerb, utility function or hidden side/rear paving asserted.'};
 return mesh;
}
