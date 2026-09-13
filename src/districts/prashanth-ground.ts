import * as THREE from 'three';
import seam from './prashanth-ground.json';
type P=[number,number,number];
const courtyardBackY=.055,gateY=.015,gateZ=8.35,baseY=-.065;
function surface(width:number){
 const edge=seam.points.map(p=>p.point as P),xs=[-width/2,...edge.map(p=>p[0]),width/2],positions:P[]=[],triangles:number[][]=[];
 for(const z of [0,gateZ])for(const x of xs)positions.push([x,z===0?courtyardBackY:gateY,z]);
 const n=xs.length;
 for(let i=0;i<n-1;i++)triangles.push([i,n+i,i+1],[i+1,n+i,n+i+1]);
 const offset=positions.length;positions.push(...edge);
 for(let i=0;i<edge.length-1;i++)triangles.push([n+i+1,offset+i,n+i+2],[n+i+2,offset+i,offset+i+1]);
 return{positions,triangles,edge};
}
function triangleHeight(x:number,z:number,a:P,b:P,c:P){
 const denominator=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/denominator;
 const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/denominator,w=1-u-v;
 return u>=-1e-8&&v>=-1e-8&&w>=-1e-8?u*a[1]+v*b[1]+w*c[1]:null;
}
export function samplePrashanthGroundLocal(x:number,z:number,width:number){
 if(x>=4.05&&x<=5.15&&z>=0&&z<=.62)return z<=.32?.23:.1425;
 if(z>=0&&z<=gateZ&&Math.abs(x)<=width/2)return courtyardBackY+(gateY-courtyardBackY)*z/gateZ;
 if(z<gateZ||x<seam.gateLeft||x>seam.gateRight)return null;
 const {positions,triangles}=surface(width);
 for(const [a,b,c]of triangles){const y=triangleHeight(x,z,positions[a],positions[b],positions[c]);if(y!==null)return y;}
 return null;
}
/** Same local piecewise planes used by the rendered courtyard and apron. */
export function createPrashanthGroundHeightSampler(data:any){
 const way=data.elements.find((e:any)=>e.type==='way'&&e.id===354840171),east=111320*Math.cos(13.0516624*Math.PI/180);
 if(!way?.geometry||way.geometry.length!==5)return()=>null;
 const project=(p:any)=>new THREE.Vector3((p.lon-80.2306892)*east,0,(13.0516624-p.lat)*111320),a=project(way.geometry[3]),b=project(way.geometry[0]),along=b.clone().sub(a).normalize(),outward=new THREE.Vector3(along.z,0,-along.x),width=a.distanceTo(b);
 const inverse=new THREE.Matrix4().compose(a.clone().lerp(b,.5),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(outward.x,outward.z)),new THREE.Vector3(1,1,1)).invert(),p=new THREE.Vector3();
 return(x:number,z:number)=>{p.set(x,0,z).applyMatrix4(inverse);return samplePrashanthGroundLocal(p.x,p.z,width);};
}
export function buildPrashanthGround(width:number){
 const {positions,triangles,edge}=surface(width),boundary=new Map<string,{a:number;b:number;count:number}>();
 for(const tri of triangles)for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3],key=[a,b].sort((a,b)=>a-b).join(':');const existing=boundary.get(key);if(existing)existing.count++;else boundary.set(key,{a,b,count:1});}
 const originalCount=positions.length;
 for(let i=0;i<originalCount;i++)positions.push([positions[i][0],baseY,positions[i][2]]);
 const center=positions.length;positions.push([(seam.gateLeft+seam.gateRight)/2,baseY,gateZ/2]);
 for(const {a,b,count}of boundary.values())if(count===1){const aa=a+originalCount,bb=b+originalCount;triangles.push([b,a,aa],[b,aa,bb],[bb,aa,center]);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions.flat(),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(positions.flatMap(p=>[p[0],p[2]]),2));geometry.setIndex(triangles.flat());geometry.computeVertexNormals();
 // Flat geometric normals keep the apron/courtyard transition crisp; scan relief is independent.
 const flat=geometry.toNonIndexed();flat.computeVertexNormals();geometry.dispose();
 const loader=new THREE.TextureLoader(),texture=(suffix:string,srgb=false)=>{const t=loader.load(`/assets/textures/concrete_floor_worn_001_${suffix}.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(.5,.5);t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;};
 const material=new THREE.MeshStandardMaterial({color:0xffffff,map:texture('Diffuse',true),normalMap:texture('nor_gl'),normalScale:new THREE.Vector2(.16,.16),roughnessMap:texture('Rough'),roughness:.95});material.name='Prashanth continuous hardstanding';
 // Preserve the scan's relative wear while choosing an explicit grey-concrete
 // pigment prior. Its original mean albedo (.093672) made the approach nearly black.
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  float mineralVariation=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))/.0936721751,.6,1.4);
  diffuseColor.rgb=vec3(.22,.215,.20)*mineralVariation;
 `);};
 material.customProgramCacheKey=()=> 'prashanth-hardstanding-pigment-1';
 material.userData={pigmentLinear:[.22,.215,.20],scanMeanLuminance:.0936721751,variationBounds:[.6,1.4],evidence:'Grey/brown worn continuous hardstanding observed; reflectance is an unmeasured material prior'};

 const mesh=new THREE.Mesh(flat,material);mesh.name='Prashanth courtyard and driveway apron';mesh.receiveShadow=true;mesh.castShadow=true;
 mesh.userData={revision:1,courtyardBackY,gateY,gateZ,baseY,source:'Private Prashanth entrance view: worn continuous-looking grey/brown hardstanding; no measured paving grid or grade',shoulderSeam:edge,stepLevels:[.1425,.23],stepRun:[0,.32,.62],material:{source:'Existing Poly Haven CC0 concrete scan for relative wear/relief/roughness',repeatMeters:2,pigmentLinear:[.22,.215,.20],scanMeanLuminance:.0936721751,limits:'Pigment, scale and optical response inferred; no source-photo color calibration'},limits:'Courtyard extent uses the existing inferred boundary, not a parcel survey. Elevations, grade, apron, concrete product, step count and dimensions inferred. Apron copies the current shoulder outer-edge polyline; no asphalt geometry changes.'};
 return mesh;
}
