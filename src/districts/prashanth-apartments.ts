import {buildPrashanthGround} from './prashanth-ground';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLakshmiPlaster,setLakshmiMaterialUV} from './lakshmi-material';
import lettering from './prashanth-lettering.json';
export const PRASHANTH_WAY_ID=354840171;
export const PRASHANTH_HEIGHT=9.65;
export const PRASHANTH_HEIGHT_SOURCE='Photographs establish ground and at least two upper levels; inferred 3.1 m storey pitch plus 0.35 m roof allowance, not measured height';
type Point={x:number;z:number};
/** Partial photographed entrance. At least two upper levels are visible; their heights and hidden layout are inferred. */
export function buildPrashanthApartments(points:Point[],height:number,heightSource:string){
 if(points.length!==4)throw new Error('Prashanth mapped footprint changed');
 const a=new THREE.Vector3(points[3].x,0,points[3].z),b=new THREE.Vector3(points[0].x,0,points[0].z),along=b.clone().sub(a).normalize(),outward=new THREE.Vector3(along.z,0,-along.x),width=a.distanceTo(b);
 if(width<10.5||width>11.8)throw new Error('Prashanth front edge requires review');
 const group=new THREE.Group();group.name='Prashanth Apartments · partial photographed entrance';group.position.copy(a).lerp(b,.5);group.rotation.y=Math.atan2(outward.x,outward.z);group.updateMatrixWorld(true);
 const polygon=points.map(p=>group.worldToLocal(new THREE.Vector3(p.x,0,p.z))),batches=new Map<THREE.Material,THREE.BufferGeometry[]>(),semantic:Record<string,number>={};
 const base=createLakshmiPlaster();
 const plaster=(name:string,color:number)=>{const m=base.clone();m.name='Prashanth '+name;m.color.setHex(color);return m;};
 const orange=plaster('orange plaster',0xd69743),cream=plaster('pale masonry',0xc9c9b6),concrete=plaster('concrete',0x96968a);
 const weathered=plaster('weathered boundary plaster',0xc2c4ae);
 weathered.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 prashanthLocal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nprashanthLocal=position;');
  shader.fragmentShader=`varying vec3 prashanthLocal;
   float prHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float prNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(prHash(i),prHash(i+vec2(1,0)),f.x),mix(prHash(i+vec2(0,1)),prHash(i+vec2(1,1)),f.x),f.y);}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 coord=prashanthLocal.xy;
   float patches=.5*prNoise(coord*vec2(7.,8.))+.28*prNoise(coord*vec2(22.,24.))+.14*prNoise(coord*vec2(65.,71.))+.08*prNoise(coord*180.);
   float streaks=prNoise(coord*vec2(43.,5.));
   float risingDamp=(1.-smoothstep(.10,1.05,coord.y))*(.3+.7*smoothstep(.28,.65,patches));
   float drip=smoothstep(.50,.70,patches*.62+streaks*.38)*.45;
   float severity=mix(.38,.90,smoothstep(3.5,4.65,coord.x));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.036,.050,.027),clamp((risingDamp*.85+drip)*severity,0.,.82));
  `);
 };
 weathered.customProgramCacheKey=()=> 'prashanth-boundary-weathering-2';
 const metal=new THREE.MeshStandardMaterial({color:0x333932,metalness:.40,roughness:.73});metal.name='Prashanth iron';
 const glass=new THREE.MeshPhysicalMaterial({color:0x526963,roughness:.30,transmission:.12,ior:1.5,thickness:.004});glass.name='Prashanth glazing';
 const dark=new THREE.MeshStandardMaterial({color:0x41433a,roughness:.9});dark.name='Prashanth recessed interior';
 const namePaint=new THREE.MeshStandardMaterial({color:0xc2cbb5,roughness:.8});namePaint.name='Prashanth raised name';
 function add(g:THREE.BufferGeometry,m:THREE.Material,kind:string){if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}g.clearGroups();if([orange,cream,concrete,weathered].includes(m as THREE.MeshStandardMaterial))setLakshmiMaterialUV(g);if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(g);semantic[kind]=(semantic[kind]||0)+1;}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material=orange,kind='masonry'){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,m,kind);}
 function rod(a:number[],b:number[],r:number,m:THREE.Material=metal,kind='metalwork'){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);if(d.length()<1e-6)return;const g=new THREE.CylinderGeometry(r,r,d.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());add(g,m,kind);}
 for(const y of [.055,height]){const shape=new THREE.Shape(polygon.map(p=>new THREE.Vector2(p.x,-p.z))),g=new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y-.18,0);add(g,concrete,'mapped slab');}
 for(const i of [0,1,2]){const p=polygon[i],q=polygon[(i+1)%4],d=q.clone().sub(p),g=new THREE.BoxGeometry(d.length(),height,.20);g.rotateY(-Math.atan2(d.z,d.x));g.translate((p.x+q.x)/2,height/2,(p.z+q.z)/2);add(g,orange,'unobserved side wall');}
 const front=new THREE.Shape();front.moveTo(-width/2,0);front.lineTo(width/2,0);front.lineTo(width/2,height);front.lineTo(-width/2,height);front.closePath();
 const openings:{id:string;x:number;y:number;w:number;h:number;z:number;kind:string}[]=[];
 function opening(id:string,x:number,y:number,w:number,h:number,z:number,kind='window'){
  const path=new THREE.Path();path.moveTo(x-w/2,y);path.lineTo(x-w/2,y+h);path.lineTo(x+w/2,y+h);path.lineTo(x+w/2,y);path.closePath();front.holes.push(path);openings.push({id,x,y,w,h,z,kind});
  box(x,y+h/2,z-.10,w,h,.10,dark,'recess back');
  for(const xx of [x-w/2+.04,x+w/2-.04])box(xx,y+h/2,z/2,.08,h,-z,orange,'reveal');
  for(const yy of [y+.035,y+h-.035])box(x,yy,z/2,w,.07,-z,orange,'reveal');
  if(kind==='window'){
   box(x,y+h/2,z,w-.1,h-.1,.008,glass,'glazing');
   for(const xx of [x-w/2+.035,x,x+w/2-.035])box(xx,y+h/2,z+.045,.065,h,.065,metal,'casement');
   for(const yy of [y+.035,y+h*.5,y+h-.035])box(x,yy,z+.045,w,.06,.065,metal,'casement');
   for(let xx=x-w/2+.14;xx<x+w/2;xx+=.18)rod([xx,y+.06,.09],[xx,y+h-.06,.09],.008);
   box(x,y+h+.09,.20,w+.20,.10,.58,orange,'window hood');
  }
 }
 opening('ground-left',-4.45,1.25,.80,.85,-.35);
 opening('ground-middle',-2.05,1.3,.65,.8,-.35);
 opening('ground-right',2.9,1.35,.70,.72,-.35);
 opening('entry',4.60,.16,.9,2.35,-.8,'entry');
 // Visible openings on the first upper level. Pale solid elements continue above; higher openings remain obscured.
 opening('upper-left',-3.45,4.2,1.3,1.6,-.4);
 opening('upper-right',3.95,4.25,.9,1.45,-.4);
 opening('upper-balcony',0,3.30,4.2,2.55,-1.4,'balcony');
 for(let x=-2.02;x<2.1;x+=.16)rod([x,3.65,.15],[x,5.81,.15],.010);
 for(const y of [4.25,5.05,5.8])rod([-2.08,y,.15],[2.08,y,.15],.012);
 const g=new THREE.ExtrudeGeometry(front,{depth:.20,bevelEnabled:false});g.translate(0,0,-.20);add(g,orange,'perforated front wall');
 box(4.6,1.32,-.76,.82,2.18,.045,dark,'entry door');
 const stepProfile=new THREE.Shape([new THREE.Vector2(0,.005),new THREE.Vector2(-.62,.005),new THREE.Vector2(-.62,.1425),new THREE.Vector2(-.32,.1425),new THREE.Vector2(-.32,.23),new THREE.Vector2(0,.23)]);
 const entrySteps=new THREE.ExtrudeGeometry(stepProfile,{depth:1.1,bevelEnabled:false});entrySteps.rotateY(Math.PI/2);entrySteps.translate(4.05,0,0);add(entrySteps,concrete,'closed entry steps');
 // Low projecting orange canopy and curved name parapet, dimensions inferred.
 const curveZ=(x:number)=>1.00+.28*(1-Math.pow(x/2.35,2));
 const capPositions:number[]=[],capIndices:number[]=[];const segments=32;
 for(let i=0;i<=segments;i++){const x=-2.35+4.7*i/segments,z=curveZ(x);for(const [y,zz]of [[3.1,z],[3.96,z],[3.1,z-.16],[3.96,z-.16]])capPositions.push(x,y,zz);}
 for(let i=0;i<segments;i++){const k=i*4,n=k+4;capIndices.push(k,n,k+1,n,n+1,k+1,k+2,k+3,n+2,n+2,k+3,n+3,k+1,n+1,k+3,n+1,n+3,k+3,k,k+2,n,n,k+2,n+2);}
 capIndices.push(0,1,2,2,1,3,segments*4,segments*4+2,segments*4+1,segments*4+2,segments*4+3,segments*4+1);
 const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(capPositions,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(capPositions.filter((_,i)=>i%3!==2),2));cap.setIndex(capIndices);cap.computeVertexNormals();add(cap,orange,'curved name parapet');
 box(0,3.06,.51,4.9,.16,1.7,orange,'entrance canopy slab');
 // Source-visible service boxes and exposed conduit on the solid ground wall.
 box(1.25,1.82,.13,.36,.54,.18,concrete,'meter enclosure');
 box(1.62,1.63,.14,.25,.31,.20,concrete,'meter enclosure');
 box(1.15,2.35,.14,.61,.45,.20,dark,'service panel');
 for(const [x,y,w]of [[1.25,1.84,.15],[1.62,1.65,.10]])box(x,y,.231,w,.09,.012,glass,'meter window');
 for(const x of [.82,1.50]){rod([x,.55,.11],[x,2.98,.11],.015,metal,'surface conduit');rod([x,2.98,.11],[x-2.5,2.98,.11],.015,metal,'surface conduit');}
 box(-3.75,2.62,.24,.72,.50,.46,cream,'air conditioner housing');
 for(let x=-4.04;x<-3.47;x+=.075)box(x,2.62,.479,.022,.38,.018,metal,'air conditioner grille');
 // Source upper continuation: the dark vertical strip is read as the shaded
 // side of a projecting pale return. No upper window is asserted from it.
 box(2.60,4.875,.18,.35,3.0,.38,cream,'first upper pale divider');
 box(2.60,7.70,.31,.75,2.65,.62,cream,'upper projecting pale return');
 box(.05,6.94,.09,4.35,.58,.18,cream,'upper pale horizontal band');
 box(4.02,7.61,.0225,1.22,1.56,.045,cream,'upper pale infill');
 const upperSolidDetails={
  sourceViews:['prashanth-east.jpg','prashanth-upper.jpg','entrance-directed.jpg'],
  sourceSha256:['663a51d2e1698d4fcf1aaa97861538460f98c5440f700d1b2a9f2f84bcdf63dd','281a60dfcb2afa44b2a7dd12a4574479af8d6d127279e230617acccb24f2ca64','fa39e258ed439253ecf20342e1d614315bb7a422626f8a128951fabfcdb627ea'],
  observations:'Pale horizontal area left of a projecting pale vertical return; pale rectangular area to its right within orange masonry. The dark vertical strip is interpreted as the shaded return side, not a confirmed opening.',
  controls:[{id:'pale-band',point:[.05,6.94,.18]},{id:'projecting-return',point:[2.60,7.70,.62]},{id:'pale-infill',point:[4.02,7.61,.045]}],
  limits:'Solid appearance and relative placement supported; exact dimensions, depth, material and architectural function inferred. Foliage prevents a defensible upper opening pattern. No new opening, storey or roofline asserted.'
 };
 const shapes:THREE.Shape[]=[];
 for(const glyph of lettering.glyphs){const path=new THREE.ShapePath();for(const raw of glyph.commands){const [command,...values]=raw,v=values as number[];if(command==='M')path.moveTo(v[0]+glyph.advance,v[1]);else if(command==='L')path.lineTo(v[0]+glyph.advance,v[1]);else if(command==='Q')path.quadraticCurveTo(v[0]+glyph.advance,v[1],v[2]+glyph.advance,v[3]);else if(command==='C')path.bezierCurveTo(v[0]+glyph.advance,v[1],v[2]+glyph.advance,v[3],v[4]+glyph.advance,v[5]);else path.currentPath!.closePath();}shapes.push(...path.toShapes());}
 const letters=new THREE.ExtrudeGeometry(shapes,{depth:1,bevelEnabled:false,curveSegments:3});letters.computeBoundingBox();const bounds=letters.boundingBox!,scale=2.7/(bounds.max.x-bounds.min.x);letters.translate(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,0);letters.scale(scale,.27/(bounds.max.y-bounds.min.y),.006);const p=letters.getAttribute('position');for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+curveZ(p.getX(i))+.008);letters.translate(0,3.48,0);letters.computeVertexNormals();add(letters,namePaint,'raised name');
 const gateZ=8.35,gateLeft=-.6,gateRight=4.75;
 // Only the named orange property's boundary; the adjacent 13/7 driveway is separate.
 box((-width/2+gateLeft)/2,.57,gateZ,gateLeft+width/2,1.24,.20,weathered,'boundary wall');
 box((gateRight+width/2)/2,.57,gateZ,width/2-gateRight,1.24,.20,weathered,'boundary wall');
 for(const x of [-width/2,gateLeft-.12,gateRight+.12,width/2]){const pierWidth=x===gateRight+.12?.52:.26;box(x,.78,gateZ,pierWidth,1.56,.35,weathered,'boundary pier');box(x,1.59,gateZ,pierWidth+.06,.08,.40,weathered,'pier cap');}
 box(gateRight+.12,1.36,gateZ+.19,.48,.18,.025,cream,'name plaque');
 const plaqueLetters=letters.clone();plaqueLetters.translate(0,-3.48,0);plaqueLetters.scale(.15,.37,.20);const plaqueP=plaqueLetters.getAttribute('position');for(let i=0;i<plaqueP.count;i++)plaqueP.setZ(i,.018+(plaqueP.getZ(i)-curveZ(plaqueP.getX(i)/.15)*.2));plaqueLetters.translate(gateRight+.12,1.31,gateZ+.194);plaqueLetters.computeVertexNormals();add(plaqueLetters,metal,'boundary name');
 for(const x of [gateLeft-.12,gateRight+.12]){
  box(x,1.66,gateZ,.18,.09,.18,concrete,'pier lamp base');
  rod([x,1.69,gateZ],[x,1.90,gateZ],.026,metal,'pier lamp stem');
  const globe=new THREE.SphereGeometry(.10,12,8);globe.translate(x,1.91,gateZ);add(globe,cream,'pier lamp globe');
  const cap=new THREE.ConeGeometry(.13,.12,12);cap.translate(x,2.04,gateZ);add(cap,metal,'pier lamp cap');
 }
 for(const [left,right]of [[gateLeft,(gateLeft+gateRight)/2],[(gateLeft+gateRight)/2,gateRight]]){
  for(const x of [left,right])rod([x,.10,gateZ+.02],[x,1.45,gateZ+.02],.020);
  for(const y of [.12,.46,1.03,1.40])rod([left,y,gateZ+.02],[right,y,gateZ+.02],.018);
  for(let x=left+.10;x<right;x+=.13)rod([x,.12,gateZ+.02],[x,1.49,gateZ+.02],.008);
  const lo=.46,hi=1.03,h=hi-lo;
  for(const sign of [-1,1])for(let intercept=left-h;intercept<right+h;intercept+=.25){let y0=0,y1=h;if(sign>0){y0=Math.max(0,left-intercept);y1=Math.min(h,right-intercept);}else{y0=Math.max(0,intercept-right);y1=Math.min(h,intercept-left);}if(y1>y0)rod([intercept+sign*y0,lo+y0,gateZ+.04],[intercept+sign*y1,lo+y1,gateZ+.04],.007);}
 }
 for(const [m,geometries]of batches){const g=mergeGeometries(geometries,false);if(!g)throw new Error('Prashanth geometry merge failed');const mesh=new THREE.Mesh(g,m);mesh.name=m.name;mesh.castShadow=m!==glass;mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
 const ground=buildPrashanthGround(width);group.add(ground);
 group.userData={wayId:PRASHANTH_WAY_ID,revision:3,ground:ground.userData,width,height,heightSource,frontEdge:[3,0],pose:group.position.toArray(),yaw:group.rotation.y,gateZ,gateLeft,gateRight,openings,semantic,minimumUpperLevels:2,upperSolidDetails,upperOpeningLayout:'Unresolved above modeled first upper level; observed pale solid continuation represented without invented openings',sourcePano:'Vu0xhoBfuQb7XsmcWslizA',captureDate:'Unknown',sourceSha256:'fa39e258ed439253ecf20342e1d614315bb7a422626f8a128951fabfcdb627ea',association:'Named OSM footprint and visible PRASHANTH name; conditional alignment, not cadastral proof',limits:'Partial visible entrance only. Minimum ground plus two upper levels observed; provisional 9.65 m height inferred. Higher opening layout, exact total floor count and roofline obscured by canopy. Upper pale band/infill and projecting return are partial source-informed solids; their sections and function remain inferred. Bay dimensions, paint reflectance, curved parapet, gate fabrication and boundary setback inferred. Unseen sides/rear remain plain. Neighbor 13/7 gate is excluded. No calibrated photo match.'};
 return group;
}
