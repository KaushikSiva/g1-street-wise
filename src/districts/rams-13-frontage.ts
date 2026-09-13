import {buildRamsGround,sampleRamsGroundLocal} from './rams-ground';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLakshmiPlaster,setLakshmiMaterialUV} from './lakshmi-material';
import {buildRamsNumber} from './rams-number';
import {applyRamsWeathering,RAMS_FASCIA} from './rams-plaster';
import type {FrontageBarrier} from './frontage-barriers';

// A source-visible frontage missing from OSM, deliberately kept outside mapped records.
export const RAMS_FRONTAGE_ID='central-avenue-13-7';
const roadStart=new THREE.Vector3(-203.56070558203234,0,-59.289031999962276);
const along=new THREE.Vector3(.28716258058250976,0,-.9578818571792628);
const normal=new THREE.Vector3(.9578818571792628,0,.28716258058250976);
const width=12,height=9.65,depth=6,station=40,offset=13.1,gateZ=8.30;
const center=roadStart.clone().addScaledVector(along,station).addScaledVector(normal,offset);
const yaw=Math.atan2(-normal.x,-normal.z);
const inverse=new THREE.Matrix4().compose(center,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(1,1,1)).invert();
export function sampleRamsGround(x:number,z:number){const p=new THREE.Vector3(x,0,z).applyMatrix4(inverse);return sampleRamsGroundLocal(p.x,p.z);}
export function ramsFrontageBlocks(x:number,z:number){const p=new THREE.Vector3(x,0,z).applyMatrix4(inverse);return p.x>=-width/2-.12&&p.x<=width/2+.12&&p.z>=-depth-.12&&p.z<=.20;}
export function buildRams13Frontage(){
 const group=new THREE.Group();group.name='13/7 · partial photographed opposite frontage';group.position.copy(center);group.rotation.y=yaw;
 const barriers:FrontageBarrier[]=[];
 const base=createLakshmiPlaster(),white=base.clone();white.color.setHex(0xd9dcd3);white.name='13/7 weathered white plaster';
 applyRamsWeathering(white,'wall');
 const fascia=base.clone();fascia.color.setHex(0xc4c9be);fascia.name='13/7 stained ground-floor fascia';applyRamsWeathering(fascia,'fascia');
 const ledge=base.clone();ledge.color.setHex(0xb0b7ad);ledge.name='13/7 grey bands';
 const concrete=base.clone();concrete.color.setHex(0x898d83);concrete.name='13/7 inferred concrete support';
 const dark=new THREE.MeshStandardMaterial({color:0x29312e,roughness:.78,metalness:.25});dark.name='13/7 dark window guards and gate';
 const frames=new THREE.MeshStandardMaterial({color:0x9caaa4,roughness:.55,metalness:.35});frames.name='13/7 pale casements';
 const glass=new THREE.MeshPhysicalMaterial({color:0x576461,roughness:.32,transmission:.12,thickness:.006});glass.name='13/7 recessed glazing';
 const inner=new THREE.MeshStandardMaterial({color:0x545b54,roughness:.98});inner.name='13/7 dark room backing';
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>(),semantic:Record<string,number>={},apertures:{point:number[];normal:number[];kind:string}[]=[];
 function add(g:THREE.BufferGeometry,m:THREE.Material,kind:string){if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.clearGroups();if([white,ledge,concrete,fascia].includes(m as THREE.MeshStandardMaterial))setLakshmiMaterialUV(g);if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(g);semantic[kind]=(semantic[kind]||0)+1;}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,kind:string){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,m,kind);}
 function rod(a:number[],b:number[],r=.009,m:THREE.Material=dark,kind='metalwork'){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p),g=new THREE.CylinderGeometry(r,r,d.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());add(g,m,kind);}
 const wall=new THREE.Shape();wall.moveTo(-width/2,0);wall.lineTo(width/2,0);wall.lineTo(width/2,height);wall.lineTo(-width/2,height);wall.closePath();
 for(const level of [0,1,2])for(const [i,x]of [-4.3,-.45,3.55].entries()){
  const bottom=level*3.1+.92,w=i===0?1.42:1.96,h=1.43,z=-.45;
  const hole=new THREE.Path();hole.moveTo(x-w/2,bottom);hole.lineTo(x-w/2,bottom+h);hole.lineTo(x+w/2,bottom+h);hole.lineTo(x+w/2,bottom);hole.closePath();wall.holes.push(hole);
  box(x,bottom+h/2,-.56,w,h,.12,inner,'recess room back');
  for(const xx of [x-w/2+.045,x+w/2-.045])box(xx,bottom+h/2,-.225,.09,h,.45,white,'window jamb');
  for(const yy of [bottom+.045,bottom+h-.045])box(x,yy,-.225,w-.18,.09,.45,white,'window sill header');
  box(x,bottom+h/2,z,w-.18,h-.18,.012,glass,'recessed glass');
  for(const xx of [x-w/2+.10,x,x+w/2-.10])box(xx,bottom+h/2,z+.04,.045,h-.15,.045,frames,'casement stile');
  for(const yy of [bottom+.09,bottom+h-.09])box(x,yy,z+.04,w-.15,.045,.045,frames,'casement rail');
  box(x,bottom+h+.14,.16,w+.36,.10,.66,white,'shallow window hood');
  const guardZ=level===0?.24:.13;
  for(let j=0;j<=10;j++){const xx=x-w/2+.065+j*(w-.13)/10;rod([xx,bottom+.065,guardZ],[xx,bottom+h-.065,guardZ]);}
  for(const yy of [bottom+.065,bottom+h*.46,bottom+h-.065])rod([x-w/2+.065,yy,guardZ],[x+w/2-.065,yy,guardZ],.011);
  if(level===0)for(const xx of [x-w/2+.065,x+w/2-.065])for(const yy of [bottom+.065,bottom+h-.065])rod([xx,yy,.015],[xx,yy,guardZ],.010);
  apertures.push({point:[x-w*.22,bottom+h*.70,z+.006],normal:[0,0,1],kind:'window'});
 }
 const wallGeometry=new THREE.ExtrudeGeometry(wall,{depth:.20,bevelEnabled:false});wallGeometry.translate(0,0,-.20);add(wallGeometry,white,'source perforated white frontage');
 box(width/2-.10,height/2,-depth/2,.20,height,depth,white,'inferred plain south shell termination');
 // The existing inferred access position now has a physical opening/reveal,
 // rather than a dark rectangle pasted onto an uninterrupted solid wall.
 const northWall=new THREE.Shape();northWall.moveTo(-depth/2,0);northWall.lineTo(depth/2,0);northWall.lineTo(depth/2,height);northWall.lineTo(-depth/2,height);northWall.closePath();
 const entry=new THREE.Path();entry.moveTo(-.02,.18);entry.lineTo(-.02,2.38);entry.lineTo(1.02,2.38);entry.lineTo(1.02,.18);entry.closePath();northWall.holes.push(entry);
 const northGeometry=new THREE.ExtrudeGeometry(northWall,{depth:.20,bevelEnabled:false});northGeometry.translate(0,0,-.20);northGeometry.rotateY(-Math.PI/2);northGeometry.translate(-width/2,0,-depth/2);add(northGeometry,white,'north wall with inferred entry opening');
 box(0,height/2,-depth+.10,width-.40,height,.20,white,'inferred rear termination');
 box(0,height-.08,-depth/2,width,.16,depth,concrete,'inferred minimum-height closure');
 box(0,(RAMS_FASCIA.top+RAMS_FASCIA.bottom)/2,.045,width,RAMS_FASCIA.top-RAMS_FASCIA.bottom,.28,fascia,'source broad ground-floor fascia');
 box(0,6.2,.045,width,.16,.28,ledge,'shallow upper floor band');
 for(const x of [-2.6,1.65])box(x,6.15,.028,.10,6.65,.055,ledge,'source narrow vertical division');
 box(-width/2-.04,4.7,-1.45,.075,9.30,.075,ledge,'north return downpipe');
 // A short observed north return and door into the shared side approach.
 for(const z of [-3.02+.04,-1.98-.04])box(-width/2+.19,1.28,z,.38,2.2,.08,white,'north door reveal jamb');
 box(-width/2+.19,2.34,-2.5,.38,.08,.88,white,'north door reveal header');
 box(-width/2+.19,.19,-2.5,.38,.02,.88,concrete,'north door threshold');
 box(-width/2+.38,1.29,-2.5,.06,2.18,.88,dark,'recessed north access door');
 const northDoorProbe={point:[-width/2+.35,1.35,-2.5],normal:[-1,0,0]};

 // Inferred near-ground support only; southern extent is deliberately incomplete.
 const ground=buildRamsGround(width);group.add(ground);
 const gateLeft=-12.6,gateRight=-6.35;
 for(const x of [gateLeft-.14,gateRight+.14,width/2-.13]){box(x,.91,gateZ,.28,1.82,.30,white,'boundary pier');box(x,1.85,gateZ,.36,.10,.37,ledge,'pier cap');barriers.push({x,z:gateZ,width:.28,depth:.30,kind:'boundary pier'});}
 // Photo resolves dark organic motifs; open voids versus paint is unresolved.
 // Use original shallow dark inlays in a solid panel, not unsupported see-through openings.
 box(0,.70,gateZ,width,1.40,.20,white,'source white patterned boundary');
 barriers.push({x:0,z:gateZ,width,depth:.20,kind:'boundary wall'},{x:(gateLeft+gateRight)/2,z:gateZ,width:gateRight-gateLeft,depth:.04,kind:'closed gate'});
 for(let panel=0;panel<8;panel++){
  const cx=-5.25+panel*1.50;
  for(let k=0;k<6;k++){
   const angle=k*Math.PI/3+.18,px=cx+Math.cos(angle)*.34,py=.72+Math.sin(angle)*.40;
   const leaf=new THREE.Shape();leaf.moveTo(0,-.17);leaf.quadraticCurveTo(.14,-.03,0,.20);leaf.quadraticCurveTo(-.12,.02,0,-.17);
   const g=new THREE.ExtrudeGeometry(leaf,{depth:.003,bevelEnabled:false,curveSegments:4});g.rotateZ(angle-.6);g.translate(px,py,gateZ+.101);add(g,dark,'inferred organic boundary inlay');
  }
 }
 for(const yy of [.08,.56,1.39,1.73])rod([gateLeft,yy,gateZ],[gateRight,yy,gateZ],.014);
 for(let j=0;j<=36;j++){const x=THREE.MathUtils.lerp(gateLeft,gateRight,j/36);rod([x,.08,gateZ],[x,1.84,gateZ],.010);const tip=new THREE.ConeGeometry(.023,.085,5);tip.translate(x,1.88,gateZ);add(tip,dark,'gate tip');if(j%2===0){const curve=new THREE.EllipseCurve(x,.88,.080,.17,0,Math.PI*2,false,0),pts=curve.getPoints(12).map(p=>new THREE.Vector3(p.x,p.y,gateZ));add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),12,.007,5,true),dark,'source gate oval scroll');}}
 rod([(gateLeft+gateRight)/2,.08,gateZ],[(gateLeft+gateRight)/2,1.82,gateZ],.020);
 box(-5.32,1.58,gateZ+.012,1.15,.38,.24,dark,'13/7 number plaque');const number=buildRamsNumber(.85,.22,.003);number.translate(-5.32,1.47,gateZ+.135);add(number,white,'source readable 13/7');
 for(const [m,gs]of batches){const g=mergeGeometries(gs,false);if(!g)throw new Error('13/7 batch merge failed');const mesh=new THREE.Mesh(g,m);mesh.name=m.name;mesh.castShadow=m!==glass;mesh.receiveShadow=true;group.add(mesh);gs.forEach(g=>g.dispose());}
 group.userData={frontageId:RAMS_FRONTAGE_ID,revision:4,fascia:RAMS_FASCIA,ground:ground.userData,northDoorProbe,barriers,wayId:null,width,height,depth,station,offset,yaw,pose:center.toArray(),groundY:0,gateZ,gateLeft,gateRight,apertures,semantic,observedUpperLevels:2,mapped:false,sourceSha256:['663a51d2e1698d4fcf1aaa97861538460f98c5440f700d1b2a9f2f84bcdf63dd'],association:'Readable13/7 boundary in private Prashanth east street photograph, south ofPrashanth; Rams13/7 listing pin lies in unmapped frontage gap. No rear OSM building reassigned.',limits:'Partial observed north/front section only. Source proves ground and at least two upper window rows; roofline, southern extent and rear are cropped or hidden.12m width,9.65m closure height,6m depth,placement,window dimensions,gate extent,all materials and support elevations inferred. The broad ground-floor fascia and irregular staining are photo-informed;500mm fascia depth and pigment coverage are not calibrated measurements. Side access position,380mm door recess,180mm step and door details are an inferred construction study, not measured photographic details. Plain closure is a study boundary, not a surveyed roof/rear. Organic dark boundary motifs could be voids or surfacework; represented as original shallow inlays. No source pixels, advertisements, vehicle plates or personal details in runtime.'};
 return group;
}
