import {buildSuryaGround,SURYA_PASSAGE_DOOR_DEPTH} from './surya-ground';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLakshmiPlaster,setLakshmiMaterialUV} from './lakshmi-material';
import lettering from './surya-lettering.json';
export const SURYA_WAY_ID=354840134;
export const SURYA_HEIGHT=12.4;
export const SURYA_HEIGHT_SOURCE='Photograph: ground plus three upper balcony rows; inferred 3.1 m pitch, roof height unmeasured';
type Point={x:number;z:number};
/** Conditional address/point association; original geometry from private photographic observations. */
export function buildSuryaApartments(points:Point[]){
 if(points.length!==4)throw new Error('Surya footprint association needs review');
 const a=new THREE.Vector3(points[1].x,0,points[1].z),b=new THREE.Vector3(points[2].x,0,points[2].z),along=b.clone().sub(a).normalize(),outward=new THREE.Vector3(along.z,0,-along.x),width=a.distanceTo(b);
 if(width<16||width>18)throw new Error('Surya frontage width needs review');
 const group=new THREE.Group();group.name='Surya Apartments · partial photo-informed frontage';group.position.copy(a).lerp(b,.5);group.rotation.y=Math.atan2(outward.x,outward.z);group.updateMatrixWorld(true);
 const polygon=points.map(p=>group.worldToLocal(new THREE.Vector3(p.x,0,p.z))),sx=width/16.7255890418377;
 const base=createLakshmiPlaster();
 const plaster=(name:string,color:number)=>{const m=base.clone();m.name='Surya '+name;m.color.setHex(color);return m;};
 const cream=plaster('cream plaster',0xe2debf),peach=plaster('peach plaster',0xcab3a2),concrete=plaster('concrete',0xaaa99b);
 const steel=new THREE.MeshStandardMaterial({color:0x2d3430,metalness:.38,roughness:.66});steel.name='Surya dark metalwork';
 const timber=new THREE.MeshStandardMaterial({color:0x5e3b31,roughness:.76});timber.name='Surya brown frames';
 const glass=new THREE.MeshPhysicalMaterial({color:0x657b78,roughness:.32,transmission:.16,thickness:.006});glass.name='Surya window glass';
 const interior=new THREE.MeshStandardMaterial({color:0x75736a,roughness:.97});interior.name='Surya recess interior';
 const burgundy=new THREE.MeshStandardMaterial({color:0x652c2b,roughness:.83});burgundy.name='Surya burgundy nameboard';
 const lettersMaterial=new THREE.MeshStandardMaterial({color:0xe8e6d8,roughness:.78});lettersMaterial.name='Surya white name lettering';
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>(),semantic:Record<string,number>={},windowChecks:{x:number;y:number;z:number}[]=[],balconyChecks:{x:number;y:number;z:number}[]=[];
 function add(g:THREE.BufferGeometry,m:THREE.Material,kind:string){if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.clearGroups();if([cream,peach,concrete].includes(m as THREE.MeshStandardMaterial))setLakshmiMaterialUV(g);if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(g);semantic[kind]=(semantic[kind]||0)+1;}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material=cream,kind='masonry'){const g=new THREE.BoxGeometry(w*sx,h,d);g.translate(x*sx,y,z);add(g,m,kind);}
 function rod(p:number[],q:number[],radius=.009,m:THREE.Material=steel,kind='grille bar'){const a=new THREE.Vector3(p[0]*sx,p[1],p[2]),b=new THREE.Vector3(q[0]*sx,q[1],q[2]),d=b.clone().sub(a);const g=new THREE.CylinderGeometry(radius,radius,d.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...a.add(b).multiplyScalar(.5).toArray());add(g,m,kind);}
 function curve(points:number[][],radius=.009,kind='curved grille'){const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0]*sx,p[1],p[2])));add(new THREE.TubeGeometry(c,8,radius,6,false),steel,kind);}
 function rectangle(x:number,y:number,w:number,h:number){const p=new THREE.Path();p.moveTo((x-w/2)*sx,y);p.lineTo((x-w/2)*sx,y+h);p.lineTo((x+w/2)*sx,y+h);p.lineTo((x+w/2)*sx,y);p.closePath();return p;}
 function room(x:number,y:number,w:number,h:number,back:number){box(x,y+h/2,back,w,h,.10,interior,'recess back');for(const side of [-1,1])box(x+side*(w/2-.05),y+h/2,back/2,.10,h,-back,cream,'reveal jamb');for(const yy of [y+.04,y+h-.04])box(x,yy,back/2,w,.08,-back,cream,'reveal sill ceiling');}
 function window(x:number,y:number,w:number,h:number,z:number){box(x,y+h/2,z-.025,w-.10,h-.10,.012,glass,'window glazing');for(const xx of [x-w/2+.03,x,x+w/2-.03])box(xx,y+h/2,z,.06,h,.065,timber,'window stile');for(const yy of [y+.03,y+h/2,y+h-.03])box(x,yy,z,w,.06,.065,timber,'window rail');windowChecks.push({x:(x-w*.22)*sx,y:y+h*.74,z:z-.019});}
 for(const y of [.055,SURYA_HEIGHT]){const shape=new THREE.Shape(polygon.map(p=>new THREE.Vector2(p.x,-p.z))),g=new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y-.16,0);add(g,concrete,'exact mapped slab');}
 for(const i of [0,2,3]){const p=polygon[i],q=polygon[(i+1)%4],d=q.clone().sub(p),g=new THREE.BoxGeometry(d.length(),SURYA_HEIGHT,.20);g.rotateY(-Math.atan2(d.z,d.x));g.translate((p.x+q.x)/2,SURYA_HEIGHT/2,(p.z+q.z)/2);if(i!==2)add(g,cream,'unobserved wall');else g.dispose();}
 const wall=new THREE.Shape();wall.moveTo(-width/2,0);wall.lineTo(width/2,0);wall.lineTo(width/2,SURYA_HEIGHT);wall.lineTo(-width/2,SURYA_HEIGHT);wall.closePath();
 const bays=[{x:-7.15,w:1.95,m:peach},{x:5.90,w:3.95,m:cream}];
 for(let floor=1;floor<=3;floor++){
  const y=floor*3.1;
  for(const bay of bays)wall.holes.push(rectangle(bay.x,y+.15,bay.w,2.73));
  for(const x of [-1.95,1.25])wall.holes.push(rectangle(x,y+.72,1.42,1.65));
 }
 // The broad peach face in gallery 6 lies on the SOUTH return. Its narrow
 // east-facing grille return is the first east bay, not a second broad front tower.
 const sp=polygon[2],sq=polygon[3],sd=sq.clone().sub(sp).normalize(),sn=new THREE.Vector3(sd.z,0,-sd.x),sideWidth=sp.distanceTo(sq);
 const sideMatrix=new THREE.Matrix4().compose(sp.clone().lerp(sq,.5),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(sn.x,sn.z)),new THREE.Vector3(1,1,1));
 const sideWall=new THREE.Shape();sideWall.moveTo(-sideWidth/2,0);sideWall.lineTo(sideWidth/2,0);sideWall.lineTo(sideWidth/2,SURYA_HEIGHT);sideWall.lineTo(-sideWidth/2,SURYA_HEIGHT);sideWall.closePath();
 const sideX=sideWidth/2-3.25,sideW=5.90,sideChecks:{point:number[];normal:number[]}[]=[];
 function sideBox(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,kind:string){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);g.applyMatrix4(sideMatrix);add(g,m,kind);}
 function sideRod(p:number[],q:number[],r=.009){const a=new THREE.Vector3(...p).applyMatrix4(sideMatrix),b=new THREE.Vector3(...q).applyMatrix4(sideMatrix);rod([a.x/sx,a.y,a.z],[b.x/sx,b.y,b.z],r,steel,'south grille');}
 for(let floor=1;floor<=3;floor++){
  const y=floor*3.1,path=new THREE.Path();path.moveTo(sideX-sideW/2,y+.15);path.lineTo(sideX-sideW/2,y+2.88);path.lineTo(sideX+sideW/2,y+2.88);path.lineTo(sideX+sideW/2,y+.15);path.closePath();sideWall.holes.push(path);
  sideBox(sideX,y+1.50,-1.26,sideW,2.73,.10,interior,'south recess back');
  for(const sign of [-1])sideBox(sideX+sign*(sideW/2-.05),y+1.50,-.60,.10,2.73,1.30,peach,'south recess jamb');
  for(const yy of [y+.20,y+2.83])sideBox(sideX,yy,-.60,sideW,.10,1.30,peach,'south recess sill ceiling');
  sideBox(sideX,y+.04,.39,sideW+.18,.18,1.02,peach,'south balcony slab');const parapet=new THREE.Shape(),l=sideX-sideW/2,r=sideX+sideW/2;
  parapet.moveTo(l,y+.08);parapet.lineTo(r,y+.08);parapet.lineTo(r,y+.92);parapet.lineTo(r-.85,y+.92);parapet.lineTo(r-.85,y+.82);parapet.lineTo(r-1.30,y+.82);parapet.lineTo(r-1.30,y+.69);parapet.lineTo(l+1.30,y+.69);parapet.lineTo(l+1.30,y+.82);parapet.lineTo(l+.85,y+.82);parapet.lineTo(l+.85,y+.92);parapet.lineTo(l,y+.92);parapet.closePath();
  const pg=new THREE.ExtrudeGeometry(parapet,{depth:.22,bevelEnabled:false});pg.translate(0,0,.72);pg.applyMatrix4(sideMatrix);add(pg,peach,'south stepped peach parapet');sideBox(sideX,y+2.92,.40,sideW+.18,.18,1.03,peach,'south balcony head');
  for(const sign of [-1,1])sideBox(sideX+sign*(sideW/2-.07),y+1.5,.42,.14,2.86,.96,peach,'south balcony pier');
  for(const yy of [y+.13])sideBox(sideX,yy,.948,sideW+.07,.035,.028,cream,'south pale horizontal band');
  const x0=sideX-sideW/2+.16,x1=sideX+sideW/2-.16,lo=y+.95,hi=y+2.77,n=38,spacing=(x1-x0)/n;
  const depth=(x:number)=>1.015+.20*(1-Math.pow(2*(x-x0)/(x1-x0)-1,2));
  for(let i=0;i<=n;i++){const x=x0+i*spacing;sideRod([x,lo,depth(x)],[x,hi,depth(x)]);
   if(i<n){const next=x+spacing;for(const yy of [lo,lo+.32,hi])sideRod([x,yy,depth(x)],[next,yy,depth(next)],.014);
    const pts=[[x,lo+.65],[x+.02,lo+.43],[(x+next)/2,lo+.32],[next-.02,lo+.43],[next,lo+.65]].map(([xx,yy])=>new THREE.Vector3(xx,yy,depth(xx)).applyMatrix4(sideMatrix));
    const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),6,.008,6,false);add(g,steel,'south scalloped grille');}
  }
  const point=new THREE.Vector3(sideX+.80,y+1.86,-1.21).applyMatrix4(sideMatrix);sideChecks.push({point:point.toArray(),normal:sn.toArray()});
 }
 const sideGroundX=sideX+1.55,sideGround=new THREE.Path();sideGround.moveTo(sideGroundX-1.02,.18);sideGround.lineTo(sideGroundX-1.02,2.50);sideGround.lineTo(sideGroundX+1.02,2.50);sideGround.lineTo(sideGroundX+1.02,.18);sideGround.closePath();sideWall.holes.push(sideGround);
 sideBox(sideGroundX,1.34,-.65,2.04,2.32,.10,interior,'south ground recess');
 for(const xx of [sideGroundX-.97,sideGroundX+.97])sideBox(xx,1.34,-.30,.10,2.32,.60,cream,'south ground jamb');
 for(const yy of [.22,2.46])sideBox(sideGroundX,yy,-.30,2.04,.08,.60,cream,'south ground sill');
 sideBox(sideGroundX,1.34,-.52,1.90,2.16,.012,glass,'south ground glazing');
 for(const xx of [sideGroundX-.94,sideGroundX,sideGroundX+.94])sideBox(xx,1.34,-.48,.075,2.24,.08,timber,'south ground frame');
 for(const yy of [.24,1.45,2.43])sideBox(sideGroundX,yy,-.48,1.95,.075,.08,timber,'south ground rail');
 const sideGroundPoint=new THREE.Vector3(sideGroundX-.48,1.94,-.514).applyMatrix4(sideMatrix);
 // Photo3 also resolves a higher-sill window and a taller opening farther
 // along the same passage. Laundry/car occlusion prevents extending the pattern.
 const passageOpenings=[{kind:'window',depth:4.60,y:1.02,w:1.13,h:1.30},{kind:'door',depth:SURYA_PASSAGE_DOOR_DEPTH,y:.055,w:1.10,h:2.36}],passageChecks:{kind:string;point:number[];normal:number[]}[]=[];
 for(const opening of passageOpenings){
  const x=sideWidth/2-opening.depth,y=opening.y,w=opening.w,h=opening.h,hole=new THREE.Path();hole.moveTo(x-w/2,y);hole.lineTo(x-w/2,y+h);hole.lineTo(x+w/2,y+h);hole.lineTo(x+w/2,y);hole.closePath();sideWall.holes.push(hole);
  sideBox(x,y+h/2,-.65,w,h,.10,interior,'passage recess back');for(const xx of [x-w/2+.04,x+w/2-.04])sideBox(xx,y+h/2,-.30,.08,h,.60,cream,'passage reveal jamb');for(const yy of opening.kind==='window'?[y+.035,y+h-.035]:[y+h-.035])sideBox(x,yy,-.30,w,.07,.60,cream,'passage reveal sill');
  if(opening.kind==='window'){
   sideBox(x,y+h/2,-.52,w-.12,h-.12,.012,glass,'passage glazing');for(const xx of [x-w/2+.03,x,x+w/2-.03])sideBox(xx,y+h/2,-.48,.06,h,.07,timber,'passage window frame');for(const yy of [y+.03,y+h-.03])sideBox(x,yy,-.48,w,.06,.07,timber,'passage window frame');
  }else{
   sideBox(x,y+h/2,-.52,w-.12,h,.06,timber,'passage recessed door');for(const xx of [x-w/2+.035,x+w/2-.035])sideBox(xx,y+h/2,-.47,.07,h,.09,timber,'passage door frame');
  }
  sideBox(x,y+h+.10,.20,w+.35,.12,.66,cream,'passage opening hood');
  const point=new THREE.Vector3(x-w*.22,y+h*.72,opening.kind==='window'?-.514:-.49).applyMatrix4(sideMatrix);passageChecks.push({kind:opening.kind,point:point.toArray(),normal:sn.toArray()});
 }
 const swg=new THREE.ExtrudeGeometry(sideWall,{depth:.20,bevelEnabled:false});swg.translate(0,0,-.20);swg.applyMatrix4(sideMatrix);add(swg,cream,'perforated south wall');
 // Only the ground bays visible in the main photo are represented; no mirrored hidden openings.
 for(const x of [-1.95,1.25])wall.holes.push(rectangle(x,.67,1.28,1.83));
 const doorX=4.45;wall.holes.push(rectangle(doorX,.055,1.20,2.445));
 const wg=new THREE.ExtrudeGeometry(wall,{depth:.20,bevelEnabled:false});wg.translate(0,0,-.20);add(wg,cream,'perforated facade');
 for(const bay of bays)for(let floor=1;floor<=3;floor++){
  const y=floor*3.1,left=bay.x-bay.w/2,right=bay.x+bay.w/2;
  room(bay.x,y+.15,bay.w,2.73,-1.32);balconyChecks.push({x:(left+.45)*sx,y:y+1.85,z:-1.27});
  box(bay.x,y+.04,.39,bay.w+.18,.18,1.02,bay.m,'projecting balcony slab');
  box(bay.x,y+.50,.83,bay.w,.84,.22,bay.m,'balcony parapet');
  box(bay.x,y+2.92,.40,bay.w+.18,.18,1.03,bay.m,'balcony head');
  for(const side of [-1,1])box(bay.x+side*(bay.w/2-.07),y+1.5,.42,.14,2.86,.96,bay.m,'balcony side pier');
  // Horizontal pale reveals continue over peach parapets in the source.
  for(const yy of [y+.13,y+.79])box(bay.x,yy,.948,bay.w+.07,.035,.028,cream,'pale balcony band');
  const lo=y+.95,hi=y+2.77,x0=left+.16,x1=right-.16;
  const depth=(x:number)=>1.015+.20*(1-Math.pow(2*(x-x0)/(x1-x0)-1,2));
  for(const yy of [lo,lo+.32,hi])curve(Array.from({length:17},(_,i)=>{const x=THREE.MathUtils.lerp(x0,x1,i/16);return[x,yy,depth(x)];}),.014,'bowed balcony rail');
  const n=Math.ceil((x1-x0)/.15),spacing=(x1-x0)/n;
  for(let i=0;i<=n;i++){
   const x=x0+i*spacing;rod([x,lo,depth(x)],[x,hi,depth(x)],.008);
   if(i<n){const next=x+spacing;curve([[x,lo+.65,depth(x)],[x+.02,lo+.43,depth(x+.02)],[(x+next)/2,lo+.32,depth((x+next)/2)],[next-.02,lo+.43,depth(next-.02)],[next,lo+.65,depth(next)]],.008,'scalloped balcony motif');}
  }
  // Short open side returns attach the bowed front to solid balcony piers.
  for(const x of [x0,x1])for(const yy of [lo,hi])rod([x,yy,.90],[x,yy,depth(x)],.014);
 }
 for(let floor=1;floor<=3;floor++)for(const x of [-1.95,1.25]){
  const y=floor*3.1+.72;room(x,y,1.42,1.65,-.65);window(x,y+.05,1.30,1.54,-.54);
  box(x,y+1.77,.29,2.30,.13,.83,cream,'projecting window hood');
  for(const xx of [x-1.04,x+1.04])box(xx,y+.65,.29,.14,2.12,.82,cream,'paired vertical fin');
 }
 for(const x of [-1.95,1.25]){const w=1.28;room(x,.67,w,1.83,-.62);window(x,.72,w-.12,1.72,-.52);}
 room(doorX,.055,1.20,2.445,-.92);box(doorX,1.255,-.80,1.08,2.40,.06,timber,'recessed entrance door');
 for(let yy=.24;yy<2.40;yy+=.18)rod([doorX-.50,yy,-.75],[doorX+.50,yy,-.75],.009,steel,'entrance grille');
 box(doorX,.006,.175,1.35,.098,.35,concrete,'inferred door threshold');
 // Source-visible vertical service conduit; route and diameter are inferred.
 rod([-3.32,.18,.13],[-3.32,12.2,.13],.024,cream,'external conduit');
 // One source-visible south-passage gate, seen from opposite directions, restrained inferred boundary placement.
 const gateZ=8.4,gateSpans=[[-11.80,-8.48]];
 box(0,.64,gateZ,width/sx,1.38,.26,cream,'compound wall');
 const ground=buildSuryaGround(width,sideMatrix,concrete);setLakshmiMaterialUV(ground.ground.geometry);setLakshmiMaterialUV(ground.step.geometry);group.add(ground.ground,ground.step);
 for(const x of [-11.92,-8.37,8.28])box(x,.77,gateZ,.22,1.64,.34,cream,'gate pier');
 const gateChecks:{x:number;y:number;blocked:boolean}[]=[];
 for(const [left,right]of gateSpans){
  const lo=.10,hi=1.58,n=18,spacing=(right-left)/n;
  for(const yy of [lo,hi])rod([left,yy,gateZ],[right,yy,gateZ],.018);
  for(let i=0;i<=n;i++){
   const x=left+i*spacing;rod([x,lo,gateZ],[x,hi,gateZ],.008);
   if(i<n){const next=x+spacing,mid=(x+next)/2;
    for(const [join,sign]of [[.42,-1],[1.21,1]]){
     curve([[x,join-sign*.25,gateZ],[x+.018,join-sign*.10,gateZ],[mid,join,gateZ],[next-.018,join-sign*.10,gateZ],[next,join-sign*.25,gateZ]],.008,'interlaced gate curve');
    }
   }
  }
  rod([(left+right)/2,lo,gateZ],[(left+right)/2,hi,gateZ],.020,steel,'gate leaf stile');
  gateChecks.push({x:(left+spacing*.5)*sx,y:.82,blocked:false},{x:(left+spacing)*sx,y:.82,blocked:true});
 }
 // The three gallery views establish the name; sign faces the observed south access passage; exact placement is inferred.
 const nameX=sideGroundX,nameY=2.78;sideBox(nameX,nameY,.095,3.05,.43,.07,burgundy,'nameboard');
 const shapes:THREE.Shape[]=[];
 for(const glyph of lettering.glyphs){const p=new THREE.ShapePath();for(const raw of glyph.commands){const [cmd,...rest]=raw,v=rest as number[];if(cmd==='M')p.moveTo(v[0]+glyph.advance,v[1]);else if(cmd==='L')p.lineTo(v[0]+glyph.advance,v[1]);else if(cmd==='Q')p.quadraticCurveTo(v[0]+glyph.advance,v[1],v[2]+glyph.advance,v[3]);else if(cmd==='C')p.bezierCurveTo(v[0]+glyph.advance,v[1],v[2]+glyph.advance,v[3],v[4]+glyph.advance,v[5]);else p.currentPath!.closePath();}shapes.push(...p.toShapes());}
 const text=new THREE.ExtrudeGeometry(shapes,{depth:1,bevelEnabled:false,curveSegments:3});text.computeBoundingBox();const bb=text.boundingBox!;text.translate(-(bb.min.x+bb.max.x)/2,-(bb.min.y+bb.max.y)/2,0);text.scale(2.78*sx/(bb.max.x-bb.min.x),.24/(bb.max.y-bb.min.y),.004);text.translate(nameX,nameY,.134);text.applyMatrix4(sideMatrix);add(text,lettersMaterial,'name lettering');
 for(const [m,gs]of batches){const g=mergeGeometries(gs,false);if(!g)throw new Error('Surya merge failed');const mesh=new THREE.Mesh(g,m);mesh.name=m.name;mesh.castShadow=m!==glass;mesh.receiveShadow=true;group.add(mesh);gs.forEach(g=>g.dispose());}
 group.userData={wayId:SURYA_WAY_ID,revision:2,width,height:SURYA_HEIGHT,heightSource:SURYA_HEIGHT_SOURCE,frontEdge:[1,2],pose:group.position.toArray(),yaw:group.rotation.y,gateZ,gateSpans,gateChecks,windowChecks,balconyChecks,sideChecks,passageChecks,ground:ground.metadata,sideGroundCheck:{point:sideGroundPoint.toArray(),normal:sn.toArray()},southBalconyRows:3,balconyStacks:2,observedUpperRows:3,semantic,sourceSha256:'e284f73973e9af9457869ebf41f7b1096c48156e9adce1ce6d521d6a4f4c9064',additionalSourceSha256:['3a508969478aa7ae867074594ff466288c610e466212795be867e05469a060c5','29c6aeb40981aa0cea361feb71df23f987540e1155a91bae7810a895f8efb6ca'],captureDate:'Unknown',association:'Conditional: visible SURYA APARTMENTS / 8/10 CENTRAL AVENUE, Gazette old 10/new 8, Google listing pin inside unnamed way 354840134',limits:'Partial east frontage study. G+3 row count observed; pitch, roof height, bays, setback, gate widths, sign placement, materials and grille fabrication inferred. Gallery photographs are uncalibrated and partially occluded. Exact OSM roof footprint retained. Broad peach face on south return and narrow peach east return form a corner study; depth and interior connections unobserved. Single gate serves inferred south-side passage, gate photos are opposite views of one entrance. Courtyard at -0.043 m is inferred hardstanding, not a surveyed parcel. South near-corner balcony face and two additional passage ground openings observed; farther upper south/north/rear walls plain; no unseen openings invented. No source photograph pixels in runtime.'};
 return group;
}
