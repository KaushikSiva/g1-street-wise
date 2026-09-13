import {buildMallesLettering} from './malles-lettering';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLakshmiPlaster,setLakshmiMaterialUV} from './lakshmi-material';
export const MALLES_WAY_ID=354839651;
export const MALLES_HEIGHT=12.4;
export const MALLES_HEIGHT_SOURCE='Photographic minimum ground plus three upper levels; inferred 3.1 m pitch, roof height unmeasured';
type Point={x:number;z:number};
/** The mapped recessed western frontage is essential: never flatten its five edges. */
export function buildMallesRoyEnclave(points:Point[]){
 if(points.length!==12)throw new Error('Malles Roy Enclave footprint association needs review');
 const a=new THREE.Vector3(points[7].x,0,points[7].z),b=new THREE.Vector3(points[0].x,0,points[0].z),direction=b.clone().sub(a).normalize(),outward=new THREE.Vector3(direction.z,0,-direction.x),width=a.distanceTo(b);
 const group=new THREE.Group();group.name='Malles Roy Enclave · partial photographed frontage';group.position.copy(a).lerp(b,.5);group.rotation.y=Math.atan2(outward.x,outward.z);group.updateMatrixWorld(true);
 const polygon=points.map(p=>group.worldToLocal(new THREE.Vector3(p.x,0,p.z))),base=createLakshmiPlaster();
 const plaster=(name:string,color:number)=>{const m=base.clone();m.name='Malles '+name;m.color.setHex(color);return m;};
 const pink=plaster('rose plaster',0xc18d94),cream=plaster('cream bands',0xe2ded1),concrete=plaster('concrete',0xa9a99e);
 const steel=new THREE.MeshStandardMaterial({color:0x292f2d,roughness:.65,metalness:.4});steel.name='Malles black metalwork';
 const clay=new THREE.MeshStandardMaterial({color:0x735047,roughness:.92});clay.name='Malles clay canopy';
 const gold=new THREE.MeshStandardMaterial({color:0xb69b46,roughness:.68,metalness:.25});gold.name='Malles ochre spear tips';
 const timber=new THREE.MeshStandardMaterial({color:0x61483f,roughness:.8});timber.name='Malles brown frames';
 const glass=new THREE.MeshPhysicalMaterial({color:0x697975,roughness:.31,transmission:.14,thickness:.005});glass.name='Malles glazing';
 const interior=new THREE.MeshStandardMaterial({color:0x666760,roughness:.98});interior.name='Malles recess interior';
 const nameMaterial=new THREE.MeshStandardMaterial({color:0x95533f,roughness:.78});nameMaterial.name='Malles fascia lettering';let nameFrame:Record<string,unknown>|undefined;
 let removedDegenerateTriangles=0;
 const porchGlazingChecks:{point:number[];normal:number[]}[]=[];
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>(),semantic:Record<string,number>={},apertures:{kind:string;edge:number;point:number[];normal:number[]}[]=[];
 function add(g:THREE.BufferGeometry,m:THREE.Material,kind:string){if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.clearGroups();if([pink,cream,concrete].includes(m as THREE.MeshStandardMaterial))setLakshmiMaterialUV(g);if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(g);semantic[kind]=(semantic[kind]||0)+1;}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,kind:string){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,m,kind);}
 function rod(a:number[],b:number[],r=.012,m:THREE.Material=steel,kind='metal bar'){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p),g=new THREE.CylinderGeometry(r,r,d.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());add(g,m,kind);}
 for(const y of [.055,MALLES_HEIGHT]){const shape=new THREE.Shape(polygon.map(p=>new THREE.Vector2(p.x,-p.z))),g=new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y-.16,0);add(g,concrete,'exact mapped slab');}
 // Facade patches are tied to actual individual mapped edges, including notch returns.
 for(let edge=0;edge<polygon.length;edge++){
  const p=polygon[edge],q=polygon[(edge+1)%polygon.length],d=q.clone().sub(p).normalize(),normal=new THREE.Vector3(d.z,0,-d.x),w=p.distanceTo(q),matrix=new THREE.Matrix4().compose(p.clone().lerp(q,.5),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(normal.x,normal.z)),new THREE.Vector3(1,1,1));
  const observed=[7,8,9,10,11].includes(edge),wall=new THREE.Shape();wall.moveTo(-w/2,0);wall.lineTo(w/2,0);wall.lineTo(w/2,MALLES_HEIGHT);wall.lineTo(-w/2,MALLES_HEIGHT);wall.closePath();
  const localBox=(x:number,y:number,z:number,ww:number,h:number,depth:number,m:THREE.Material,kind:string)=>{const g=new THREE.BoxGeometry(ww,h,depth);g.translate(x,y,z);g.applyMatrix4(matrix);add(g,m,kind);};
  const canopy=(x:number,y:number,ww:number,depth:number,rise:number)=>{
   const z0=-.10,z1=depth,topWidth=ww-.70,vertices=[[-ww/2,y,z0],[ww/2,y,z0],[ww/2,y,z1],[-ww/2,y,z1],[-topWidth/2,y+rise,z0+.10],[topWidth/2,y+rise,z0+.10],[topWidth/2,y+rise,z1-.40],[-topWidth/2,y+rise,z1-.40]].map(p=>[p[0]+x,p[1],p[2]]),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap(p=>[p[0],p[2]]),2));g.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);const idx=g.index!,pos=g.attributes.position,center=new THREE.Vector3();for(const v of vertices)center.add(new THREE.Vector3(...v));center.multiplyScalar(1/vertices.length);for(let i=0;i<idx.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,idx.getX(i)),b=new THREE.Vector3().fromBufferAttribute(pos,idx.getX(i+1)),c=new THREE.Vector3().fromBufferAttribute(pos,idx.getX(i+2)),n=b.clone().sub(a).cross(c.clone().sub(a));if(n.dot(a.clone().add(b).add(c).multiplyScalar(1/3).sub(center))<0){const j=idx.getX(i+1);idx.setX(i+1,idx.getX(i+2));idx.setX(i+2,j);}}const flat=g.toNonIndexed();flat.computeVertexNormals();flat.applyMatrix4(matrix);g.dispose();add(flat,clay,'source shallow hipped canopy');
  };
  const localRod=(a:number[],b:number[],r=.009)=>{const p=new THREE.Vector3(...a).applyMatrix4(matrix),q=new THREE.Vector3(...b).applyMatrix4(matrix);rod(p.toArray(),q.toArray(),r);};
  const opening=(x:number,y:number,ww:number,h:number,kind:string)=>{
   const hole=new THREE.Path();hole.moveTo(x-ww/2,y);hole.lineTo(x-ww/2,y+h);hole.lineTo(x+ww/2,y+h);hole.lineTo(x+ww/2,y);hole.closePath();wall.holes.push(hole);
   const depth=kind.includes('balcony')?-1.10:kind==='porch'?-.95:kind==='door'?-.80:-.54;
   localBox(x,y+h/2,depth,ww,h,.10,interior,'recess back');for(const xx of [x-ww/2+.04,x+ww/2-.04])localBox(xx,y+h/2,depth/2,.08,h,-depth,cream,'reveal jamb');for(const yy of [y+.035,y+h-.035])localBox(x,yy,depth/2,ww,.07,-depth,cream,'reveal sill ceiling');
   let targetZ=depth+.05;
   if(kind==='window'||kind==='glazed-balcony'){
    localBox(x,y+h/2,depth+.10,ww-.12,h-.12,.012,glass,'glazing');targetZ=depth+.106;
    for(const xx of [x-ww/2+.035,x,x+ww/2-.035])localBox(xx,y+h/2,depth+.14,.07,h,.07,timber,'casement stile');for(const yy of [y+.04,y+h*.45,y+h-.04])localBox(x,yy,depth+.14,ww,.07,.07,timber,'casement rail');
    if(kind==='window'){for(let xx=x-ww/2+.12;xx<x+ww/2;xx+=.15)localRod([xx,y+.10,.08],[xx,y+h-.1,.08],.008);for(const yy of [y+.11,y+h-.11])localRod([x-ww/2+.10,yy,.08],[x+ww/2-.10,yy,.08],.010);
    localBox(x,y+h+.08,.18,ww+.36,.12,.58,cream,'window hood');}
   }else if(kind==='door'){
    localBox(x,y+h/2,depth+.10,ww-.12,h-.08,.06,timber,'entry door');targetZ=depth+.13;
   }
   if(kind==='balcony'||kind==='glazed-balcony'){
    if(edge===9&&y<9){
     localBox(x,y+.28,.18,ww,.48,.22,pink,'source rose balcony parapet');
     localBox(x,y+.79,.18,ww,.09,.25,cream,'source slotted parapet cap');
     for(let xx=x-ww/2+.065;xx<x+ww/2;xx+=.37)localBox(xx,y+.635,.18,.13,.23,.22,cream,'source narrow parapet slot divider');
    }else localBox(x,y+.42,.18,ww,.76,.22,cream,'balcony pale parapet');localBox(x,y-.04,.05,ww+.22,.16,.62,cream,'balcony sill projection');for(const sign of [-1,1])localBox(x+sign*(ww/2+.12),y+h/2,.17,.20,h+.20,.52,pink,'balcony rose pier');
   }
   // Window probe begins behind the external protective grille; other kinds start outside the wall.
   const point=new THREE.Vector3(x-ww*.22,y+h*.73,targetZ).applyMatrix4(matrix);apertures.push({kind,edge,point:point.toArray(),normal:normal.toArray()});
  };
  if(edge===11){
   // Northern wing: top balcony in gallery4; lower casements clarified by gallery8's corresponding wing pattern.
   opening(0,9.48,2.22,2.51,'glazed-balcony');
   for(const level of [1,2])opening(0,level*3.1+.80,1.44,1.61,'window');
   opening(.10,.73,1.40,1.62,'window');canopy(0,12.02,2.90,1.02,.28);
  }
  if(edge===7){
   // Gallery8 exposes the southern projecting wing: a glazed top balcony above two casement rows.
   opening(.20,9.48,2.22,2.51,'glazed-balcony');
   for(const level of [1,2])opening(.20,level*3.1+.80,1.44,1.61,'window');
   const letters=buildMallesLettering(1.55,.20,.003);letters.translate(.20,6.43,.068);letters.applyMatrix4(matrix);add(letters,nameMaterial,'source MALLES fascia lettering');nameFrame={matrix:matrix.toArray(),x:.20,y:6.43,z:.068,width:1.55,height:.20,depth:.003,text:'MALLES'};
   opening(.25,.76,1.34,1.57,'window');canopy(.20,12.02,2.90,1.02,.28);
  }
  if(edge===9){
   // Gallery8 resolves two upper balconies over a tall open columned porch.
   for(const level of [2,3])opening(0,level*3.1+.18,3.70,2.51,'balcony');
   opening(0,.055,4.55,5.60,'porch');
   for(const x of [-2.42,2.42]){const column=new THREE.CylinderGeometry(.14,.16,5.85,12);column.translate(x,2.975,.40);column.applyMatrix4(matrix);add(column,cream,'source tall porch column');}
   localBox(0,3.03,-.35,4.55,.14,1.00,cream,'source intermediate porch landing');
   for(const yy of [3.19,4.04])localRod([-2.12,yy,.15],[2.12,yy,.15],.018);
   for(let x=-2.12;x<=2.13;x+=.265)localRod([x,3.19,.15],[x,4.04,.15],.010);
   localBox(0,1.38,-.78,4.28,2.56,.012,glass,'source porch ground glazing');
   for(const x of [-2.12,-.72,.72,2.12])localBox(x,1.38,-.73,.075,2.66,.075,cream,'porch entry glazed stile');
   for(const yy of [.09,2.35,2.68])localBox(0,yy,-.73,4.30,.07,.075,cream,'porch entry glazed rail');
   for(const x of [-1.43,0,1.43]){const point=new THREE.Vector3(x,1.75,-.774).applyMatrix4(matrix);porchGlazingChecks.push({point:point.toArray(),normal:normal.toArray()});}
   localBox(0,5.99,.28,5.42,.18,1.12,cream,'porch canopy slab');canopy(0,6.09,5.62,1.02,.26);

  }
  let g:THREE.BufferGeometry=new THREE.ExtrudeGeometry(wall,{depth:.20,bevelEnabled:false});
  // Earcut can emit zero-area caps where vertically aligned aperture corners
  // are collinear. Remove only those triangles, retaining all actual wall faces.
  const positions=g.attributes.position,keep:number[]=[];
  for(let i=0;i<positions.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(positions,i),b=new THREE.Vector3().fromBufferAttribute(positions,i+1),c=new THREE.Vector3().fromBufferAttribute(positions,i+2);if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-20)keep.push(i,i+1,i+2);else removedDegenerateTriangles++;}
  if(keep.length!==positions.count){const clean=new THREE.BufferGeometry();for(const [name,attribute]of Object.entries(g.attributes)){const values:number[]=[];for(const i of keep)for(let j=0;j<attribute.itemSize;j++)values.push(attribute.array[i*attribute.itemSize+j]);clean.setAttribute(name,new THREE.Float32BufferAttribute(values,attribute.itemSize));}g.dispose();g=clean;}
  g.translate(0,0,-.20);g.applyMatrix4(matrix);add(g,pink,observed?'mapped perforated west wall':'unobserved plain wall');
  if(observed){
   for(const y of (edge===9?[6.2,9.3]:[3.1,6.2,9.3]))localBox(0,y+.23,.028,w,.52,.07,cream,'source pale horizontal belt');
   localBox(0,12.56,.015,w,.32,.22,cream,'source pale parapet');
   for(const x of [-w/2+.08,w/2-.08])localBox(x,6.16,.027,.075,12.32,.055,cream,'pale corner bead');
  }
 }
 // Inferred frontage support at nominal navigation datum. The source shows
 // interlocking paving; precise unit pattern and ground grade are unresolved.
 const gateZ=6.30,gateLeft=-12.20,gateRight=-9.12;
 const groundInnerX=polygon[0].x+(polygon[1].x-polygon[0].x)*(-8/polygon[1].z),groundOutline=[[-12.4,-8],[groundInnerX,-8],[polygon[0].x,0],[width/2,0],[width/2,gateZ],[-12.4,gateZ]];
 const groundShape=new THREE.Shape(groundOutline.map(([x,z])=>new THREE.Vector2(x,-z))),groundGeometry=new THREE.ExtrudeGeometry(groundShape,{depth:.10,bevelEnabled:false});groundGeometry.rotateX(-Math.PI/2);groundGeometry.translate(0,-.10,0);add(groundGeometry,concrete,'continuous front and north access hardstanding');
 box(0,.67,gateZ,width,1.34,.24,pink,'front boundary');
 // Source-visible central round cream border with rose infill; lettering unreadable.
 const panelShape=new THREE.Shape();panelShape.absarc(0,0,.72,0,Math.PI*2,false);const panel=new THREE.ExtrudeGeometry(panelShape,{depth:.18,bevelEnabled:false,curveSegments:32});panel.translate(.50,.85,gateZ+.005);add(panel,pink,'source rose round boundary backing');
 const borderShape=new THREE.Shape();borderShape.absarc(0,0,.795,0,Math.PI*2,false);const inner=new THREE.Path();inner.absarc(0,0,.645,0,Math.PI*2,true);borderShape.holes.push(inner);const border=new THREE.ExtrudeGeometry(borderShape,{depth:.05,bevelEnabled:false,curveSegments:32});border.translate(.50,.85,gateZ+.18);add(border,cream,'source flat round boundary border');
 for(const x of [gateLeft-.15,gateRight+.15,width/2-.15]){
  box(x,1.08,gateZ,.38,2.16,.40,pink,'gate pier');
  for(const [y,w,h]of [[2.13,.58,.10],[2.24,.49,.12],[2.34,.40,.09],[2.42,.28,.07]])box(x,y,gateZ,w,h,w,cream,'stepped pier capital');
 }
 const lo=.09,hi=2.10,gateChecks:{x:number;y:number;blocked:boolean}[]=[];
 for(const y of [lo,.70,1.90])rod([gateLeft,y,gateZ],[gateRight,y,gateZ],.018);
 for(let i=0;i<=20;i++){
  const x=THREE.MathUtils.lerp(gateLeft,gateRight,i/20),top=hi+.13*Math.sin(i/20*Math.PI);rod([x,lo,gateZ],[x,top,gateZ],.011);const tip=new THREE.ConeGeometry(.034,.13,5);tip.translate(x,top+.065,gateZ);add(tip,gold,'source ochre spear tip');
  if(i<20){const next=THREE.MathUtils.lerp(gateLeft,gateRight,(i+1)/20),mid=(x+next)/2;for(const y of [.32,1.16]){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,y+.10,gateZ),new THREE.Vector3(mid,y+.19,gateZ),new THREE.Vector3(next,y+.10,gateZ),new THREE.Vector3(mid,y-.07,gateZ)]);add(new THREE.TubeGeometry(curve,10,.008,5,false),steel,'gate curled motif');}}
 }
 rod([(gateLeft+gateRight)/2,lo,gateZ],[(gateLeft+gateRight)/2,hi+.13,gateZ],.022);
 gateChecks.push({x:gateLeft+(gateRight-gateLeft)/40,y:1.55,blocked:false},{x:gateLeft+(gateRight-gateLeft)/20,y:1.55,blocked:true});
 for(const [m,geometries]of batches){const g=mergeGeometries(geometries,false);if(!g)throw new Error('Malles merge failed');const mesh=new THREE.Mesh(g,m);mesh.name=m.name;mesh.castShadow=m!==glass;mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
 group.userData={wayId:MALLES_WAY_ID,revision:1,width,height:MALLES_HEIGHT,heightSource:MALLES_HEIGHT_SOURCE,frameEndpoints:[7,0],frontEdges:[7,8,9,10,11],pose:group.position.toArray(),yaw:group.rotation.y,localPolygon:polygon.map(p=>p.toArray()),observedUpperLevels:3,removedDegenerateTriangles,nameFrame,porchGlazingChecks,clarifyingSourceSha256:'6fcfa78b0960b87f21735f7fe8779f6a449f322f30bf95cd892f2c0e99929008',apertures,semantic,gateZ,gateChecks,groundY:0,sourceSha256:['826d034b70b1434f4ae4c2393a11fc42435c1cc4fb79a91e2e470e6a581f4f00','5bcd33d9097497804fd782ca870a90be5158f0981c3e4ec031b73eb76b76312a'],captureDate:'Unknown',association:'Conditional: gallery Roy Enclave4/7 Central Avenue, municipal old4/new7 address, both named Google listing pins inside unnamed12-corner way354839651; photographed central setback matches map notch',limits:'Partial observed western frontage; exact12-corner mapped roof preserved. G+3 row count photo-supported;12.4m height, bay dimensions, partially obscured lower casement extents, finishes, gate pose, boundary/ground extent and construction inferred. Tall central porch and upper balcony positions follow gallery8; unobserved return/rear openings and unreadable boundary lettering are not invented. Hardstanding at nominal zero is an inferred support datum, not surveyed grade or paving-unit reconstruction. No source pixels in runtime.'};
 return group;
}
