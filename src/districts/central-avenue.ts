import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {buildCentralAvenueNeighbors} from './central-avenue-neighbors';

export const CENTRAL_AVENUE_WAY_ID = 214356669;
const ORIGIN = {lon:80.2306892, lat:13.0516624};
const EAST = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
type Way = {id:number; type?:string; tags?:Record<string,string>; geometry?:{lat:number;lon:number}[]};
type Data = {elements:Way[]};
const project = (p:{lat:number;lon:number}) => new THREE.Vector3((p.lon-ORIGIN.lon)*EAST,0,(ORIGIN.lat-p.lat)*111320);
export function centralAvenueFrame(data:Data) {
  const way=data.elements.find(e=>e.type==='way' && e.id===CENTRAL_AVENUE_WAY_ID);
  if (!way?.geometry || way.geometry.length!==2) return null;
  const start=project(way.geometry[0]),end=project(way.geometry[1]);
  const length=start.distanceTo(end), direction=end.clone().sub(start).normalize();
  if (!Number.isFinite(length) || length<10) return null;
  const normal=new THREE.Vector3(-direction.z,0,direction.x);
  return {start,end,length,direction,normal,
    point:(s:number,n:number,y=0)=>start.clone().addScaledVector(direction,s).addScaledVector(normal,n).setY(y),
    coordinates:(p:THREE.Vector3)=>{const d=p.clone().sub(start);return {s:d.dot(direction),n:d.dot(normal)};}};
}
const halfWidth = (s:number) => 2.75 + .035*Math.sin(s*.43) + .024*Math.sin(s*1.29);
// Variable unkerbed verge study; image supports an irregular dusty edge, not these dimensions.
const vergeWidth = (s:number,side:number) => 1.18+.18*Math.sin(s*.17+side*.8)+.08*Math.sin(s*.83+side);
function surfaceY(s:number,n:number,length:number) {
  const taper=Math.min(1, Math.max(0,s/3), Math.max(0,(length-s)/3));
  return .035 + .035*taper*Math.max(0,1-Math.pow(Math.abs(n)/halfWidth(s),1.6));
}
export function createCentralAvenueHeightSampler(data:Data) {
  const frame=centralAvenueFrame(data);
  return (x:number,z:number):number|null=>{
    if (!frame) return null;
    const {s,n}=frame.coordinates(new THREE.Vector3(x,0,z));
    if(s<0||s>frame.length)return null;
    const lateral=Math.abs(n),edge=halfWidth(s);
    if(lateral<=edge)return surfaceY(s,n,frame.length);
    const side=Math.sign(n),t=(lateral-edge)/vergeWidth(s,side);
    // Match the existing sloped shoulder as walkers leave a driveway apron.
    return t<=1 ? .035*(1-t)-.043*t+.006*Math.sin(s*1.31+side)*Math.sin(Math.PI*t) : null;
  };
}

function pbr(asset:string,color:number,repeat:number) {
  const loader=new THREE.TextureLoader();
  const texture=(suffix:string,srgb=false)=>{
    const t=loader.load(`/assets/textures/${asset}_${suffix}.jpg`);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;
    if(srgb)t.colorSpace=THREE.SRGBColorSpace;
    return t;
  };
  return new THREE.MeshStandardMaterial({color,roughness:.95,map:texture('Diffuse',true),normalMap:texture('nor_gl'),normalScale:new THREE.Vector2(.28,.28),roughnessMap:texture('Rough')});
}
function roadMaterial() {
  const mat=pbr('asphalt_02',0xaaaaa4,.7);
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 caMeters;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ncaMeters=uv;');
    shader.fragmentShader=`varying vec2 caMeters;
      vec2 caHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
      float caNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(caHash(i).x,caHash(i+vec2(1,0)).x,f.x),mix(caHash(i+vec2(0,1)).x,caHash(i+vec2(1,1)).x,f.x),f.y);}
      // The same continuous translated samples drive albedo, normal and roughness.
      // No baked lighting or copied street photograph is used.
      vec4 caSample(sampler2D tex,vec2 uv){vec2 cell=floor(uv*.16),f=fract(uv*.16);f=f*f*(3.-2.*f);
      return mix(mix(texture2D(tex,uv+caHash(cell)*13.),texture2D(tex,uv+caHash(cell+vec2(1,0))*13.),f.x),mix(texture2D(tex,uv+caHash(cell+vec2(0,1))*13.),texture2D(tex,uv+caHash(cell+vec2(1,1))*13.),f.x),f.y);}
    `+shader.fragmentShader;
    for(const [chunk,needle,replacement] of [
      ['map_fragment','texture2D( map, vMapUv )','caSample( map, vMapUv )'],
      ['normal_fragment_maps','texture2D( normalMap, vNormalMapUv )','caSample( normalMap, vNormalMapUv )'],
      ['roughnessmap_fragment','texture2D( roughnessMap, vRoughnessMapUv )','caSample( roughnessMap, vRoughnessMapUv )'],
    ]) shader.fragmentShader=shader.fragmentShader.replace(`#include <${chunk}>`,THREE.ShaderChunk[chunk as keyof typeof THREE.ShaderChunk].replaceAll(needle,replacement));
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float dust=smoothstep(1.85,2.8,abs(caMeters.y)+.28*(caNoise(caMeters*vec2(.7,1.8))-.5));
      float aging=caNoise(caMeters*vec2(.14,.36));
      diffuseColor.rgb*=.91+.17*aging;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.158,.122),dust*.90);
    `);
  };
  mat.customProgramCacheKey=()=> 'central-avenue-asphalt-2';
  return mat;
}

function vergeMaterial(){
  const mat=pbr('concrete_floor_worn_001',0xffffff,1.3);
  mat.name='Central Avenue dusty mineral verge';mat.roughness=.98;mat.normalScale.set(.18,.18);
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float vergeT; varying float caVergeT; varying vec2 caVergeMeters;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ncaVergeT=vergeT;caVergeMeters=uv;');
    shader.fragmentShader=`varying float caVergeT; varying vec2 caVergeMeters;
      float caVergeHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float caVergeNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(caVergeHash(i),caVergeHash(i+vec2(1,0)),f.x),mix(caVergeHash(i+vec2(0,1)),caVergeHash(i+vec2(1,1)),f.x),f.y);}
    `+shader.fragmentShader;
    // Retain the licensed scan's local mineral variation, without multiplying its
    // already dark albedo by another dark tint. These dust pigments are inferred.
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float mineralVariation=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*4.,.35,1.3);
      float patches=caVergeNoise(caVergeMeters*vec2(.7,1.8));
      float grit=caVergeNoise(caVergeMeters*35.);
      vec3 dustPigment=mix(vec3(.18,.158,.122),vec3(.40,.36,.28),smoothstep(0.,1.,caVergeT+(patches-.5)*.45));
      diffuseColor.rgb=dustPigment*(.62+.3*mineralVariation+.3*patches+.14*grit);
    `);
  };
  mat.customProgramCacheKey=()=> 'central-avenue-mineral-verge-1';
  return mat;
}

/** Exact stored centerline; widths, repairs, drainage and frontage fittings are hypotheses. */
export function buildCentralAvenue(data:Data) {
  const group=new THREE.Group();group.name='Central Avenue · mapped road, inferred surface and street fittings';
  const f=centralAvenueFrame(data);
  if(!f){group.userData={district:'central-avenue',rejected:'Missing or unsupported centerline'};return group;}
  const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>();
  const add=(g:THREE.BufferGeometry,m:THREE.Material)=>{if(!buckets.has(m))buckets.set(m,[]);buckets.get(m)!.push(g);};
  const cement=pbr('concrete_floor_worn_001',0xa99e89,.8);
  const shoulder=vergeMaterial();
  const iron=new THREE.MeshStandardMaterial({color:0x44433c,roughness:.78,metalness:.45});
  const paint=new THREE.MeshStandardMaterial({color:0x847969,roughness:.95});
  const gate=new THREE.MeshStandardMaterial({color:0x4e5955,roughness:.72,metalness:.25});
  const unitBox=new THREE.BoxGeometry(1,1,1);
  const yaw=Math.atan2(-f.direction.z,f.direction.x);
  function box(s:number,n:number,y:number,length:number,height:number,width:number,mat=cement){
    const g=unitBox.clone();g.scale(length,height,width);g.rotateY(yaw);const p=f!.point(s,n,y);g.translate(p.x,p.y,p.z);add(g,mat);
  }
  function rod(a:THREE.Vector3,b:THREE.Vector3,r:number,mat=iron){
    const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,d.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));const c=a.clone().add(b).multiplyScalar(.5);g.translate(c.x,c.y,c.z);add(g,mat);
  }
  function strip(side:number,mat:THREE.Material,asphalt=false){
    const positions:number[]=[],uvs:number[]=[],indices:number[]=[],vergeCoordinates:number[]=[];
    const steps=Math.ceil(f!.length/.5), across=asphalt?8:6;
    for(let i=0;i<=steps;i++)for(let j=0;j<=across;j++){
      const s=f!.length*i/steps,t=j/across;
      const n=asphalt ? (t*2-1)*halfWidth(s) : side*(halfWidth(s)+t*vergeWidth(s,side));
      // Meet the unchanged asphalt edge exactly, then descend gradually to the
      // existing ground plane (-45 mm); no kerb or raised outer lip is asserted.
      const y=asphalt?surfaceY(s,n,f!.length):.035*(1-t)-.043*t+.006*Math.sin(s*1.31+side)*Math.sin(Math.PI*t);
      const p=f!.point(s,n,y);positions.push(p.x,p.y,p.z);uvs.push(s,n);vergeCoordinates.push(t);
    }
    for(let i=0;i<steps;i++)for(let j=0;j<across;j++){
      const k=i*(across+1)+j;
      // direction cross normal points downward; reverse the front-face winding.
      if(asphalt||side===1)indices.push(k,k+1,k+across+1,k+1,k+across+2,k+across+1);
      else indices.push(k,k+across+1,k+1,k+1,k+across+1,k+across+2);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
    if(!asphalt)g.setAttribute('vergeT',new THREE.Float32BufferAttribute(vergeCoordinates,1));
    const mesh=new THREE.Mesh(g,mat);mesh.name=asphalt?'Central Avenue asphalt':'Central Avenue compacted shoulder';mesh.receiveShadow=true;group.add(mesh);
  }
  strip(0,roadMaterial(),true);strip(-1,shoulder);strip(1,shoulder);
  // Offset utility-cut reinstatements are explicit surface hypotheses, not repeated tile cracks.
  const patch=pbr('asphalt_02',0x7e7d77,1.1);
  for(const [s,n,len,width] of [[28,-1.6,7.2,.68],[77,.3,3.1,1.6],[136,1.9,12.3,.52],[178,-.9,2.7,1.1]]){
    box(s,n,surfaceY(s,n,f.length)+.001,len,.002,width,patch);
  }
  // Repeated inspection lids and raised rectangular grates were unverified
  // fittings. Remove them until references establish their actual locations.
  // A separately placed yellow round ground object follows the Avinash photo.
  const frontages:{wayId:number;start:number;end:number;side:number}[]=[];
  for(const way of data.elements){
    if(!way.tags?.building || way.tags.building==='roof' || !way.geometry)continue;
    const points=way.geometry.map(project).map(f.coordinates);
    const min=Math.min(...points.map(p=>p.s)),max=Math.max(...points.map(p=>p.s));
    const nearest=Math.min(...points.map(p=>Math.abs(p.n)));
    const center=points.reduce((sum,p)=>sum+p.n,0)/points.length;
    if(nearest<6 || nearest>16 || min<5 || max>f.length-5 || max-min<7)continue;
    frontages.push({wayId:way.id,start:min,end:max,side:Math.sign(center)});
  }
  // Avoid assigning plot ownership: these are removable street-edge enclosure studies.
  for(const entry of frontages){
    // These photo-informed property models provide their own boundary wall/gate.
    if(entry.wayId===354839754 || entry.wayId===354839974 || entry.wayId===354840171 || entry.wayId===354840134 || entry.wayId===354839651 || entry.wayId===354840013)continue;
    const {start,end,side}=entry,middle=(start+end)/2,n=side*4.7,gap=3.1;
    for(const [a,b] of [[start,middle-gap/2],[middle+gap/2,end]]){
      box((a+b)/2,n,.65,b-a,1.2,.18);box((a+b)/2,n,1.27,b-a+.04,.10,.25,paint);
    }
    for(const s of [start,middle-gap/2,middle+gap/2,end]){box(s,n,.8,.28,1.5,.28);box(s,n,1.59,.35,.09,.35,paint);}
    for(const y of [.26,1.34])box(middle,n,y,gap,.04,.055,gate);
    for(let s=middle-gap/2+.09;s<middle+gap/2;s+=.14)box(s,n,.8,.024,1.1,.03,gate);
    box(middle,n,.33,gap,.24,.065,gate);
  }
  const polePositions=[{s:12,n:-3.9},{s:48,n:-4.02},{s:89,n:-4.03},{s:133,n:-4.03},{s:177,n:-3.96},{s:202,n:-3.88}];
  for(const {s,n} of polePositions){
    rod(f.point(s,n,0),f.point(s,n,7.5),.085,cement);
    rod(f.point(s,n,5.9),f.point(s,n+1.5,6.12),.036,iron);
    box(s,n+1.54,6.1,.55,.06,.17,iron);
    box(s,n,2.3,.24,.4,.18,gate);
    for(const y of [2,3,5.9])box(s,n,y,.20,.035,.20,iron);
  }
  const cable=new THREE.MeshStandardMaterial({color:0x272a27,roughness:.9});
  for(let i=1;i<polePositions.length;i++)for(let wire=0;wire<3;wire++){
    const a=polePositions[i-1],b=polePositions[i],points=[];
    for(let j=0;j<=18;j++){const t=j/18;points.push(f.point(THREE.MathUtils.lerp(a.s,b.s,t),THREE.MathUtils.lerp(a.n,b.n,t)+wire*.15,7.05+wire*.18-Math.sin(Math.PI*t)*.5));}
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),36,.012,5,false),cable);
  }
  for(const [mat,geometries] of buckets){
    const merged=mergeGeometries(geometries,false);if(merged){const mesh=new THREE.Mesh(merged,mat);mesh.name='Central Avenue inferred fittings';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
    geometries.forEach(g=>g.dispose());
  }
  unitBox.dispose();
  const neighboringFacades=buildCentralAvenueNeighbors(data);group.add(neighboringFacades);
  group.userData={district:'central-avenue',revision:4,navigationSurface:'Asphalt and existing sloped shoulders; analytic profile sampler, measured against rendered triangles',roadWayId:CENTRAL_AVENUE_WAY_ID,lengthMeters:f.length,sourceCenterline:[f.start.toArray(),f.end.toArray()],surface:'5.5 m nominal width and 35 mm crown inferred; no lane markings asserted',verge:{source:'Private Prashanth street-context thumbnail Vu0xhoBfuQb7XsmcWslizA shows dusty irregular unkerbed road edges; capture date and camera unknown',nominalWidth:1.18,widthVariation:.26,innerY:.035,outerY:-.043,appearance:'Original dust pigment treatment with CC0 concrete scan variation; no source photo pixels',limits:'Widths, edge variation, slopes and pigment are visual hypotheses, not a surveyed cross section. Mapped centerline and walkable asphalt core unchanged.'},genericEnclosureExclusions:[354839754,354839974,354840171,354840134,354839651,354840013],frontages,poles:polePositions,removedUnverifiedFittings:{inspectionLids:5,raisedGrates:5,reason:'Repeated locations were illustrative and unsupported by the photographed street; retain observed objects separately'},source:'OpenStreetMap stored geometry, 2026-07-15; material scans Poly Haven CC0',limits:'No street-level survey. Widths, surfaces, repairs, drainage, enclosure positions and wiring are inferred visual studies. Mapped footprints retained; identified frontages replace generic studies. No photorealism pass.'};
  return group;
}
