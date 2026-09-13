import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Partial exterior housing study: the photograph does not resolve internals or a brand. */
export function buildVasanthWindowAC(x:number){
 const group=new THREE.Group();group.name='Vasanth window air conditioner';
 // Existing sill top is 3.73m. Two 20mm pads support the 480mm housing.
 group.position.set(x,3.99,.34);
 const paint=new THREE.MeshStandardMaterial({name:'Vasanth AC painted casing',color:0xc6c7ae,roughness:.72,metalness:.12});
 const metal=new THREE.MeshStandardMaterial({name:'Vasanth AC grille and fasteners',color:0x747b73,roughness:.56,metalness:.65});
 const backing=new THREE.MeshStandardMaterial({name:'Vasanth AC recessed interior',color:0x303a36,roughness:.93,metalness:.1});
 const rubber=new THREE.MeshStandardMaterial({name:'Vasanth AC support pads',color:0x454b40,roughness:.98});
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
 function add(g:THREE.BufferGeometry,m:THREE.Material){const flat=g.toNonIndexed();g.dispose();flat.clearGroups();if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(flat);}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,m);}
 const w=.72,h=.48,d=.40,skin=.012,opening={width:.656,height:.416};
 // Shell plates enclose the sides; the front is a real framed opening.
 for(const xx of [-w/2+skin/2,w/2-skin/2])box(xx,0,0,skin,h,d,paint);
 for(const yy of [-h/2+skin/2,h/2-skin/2])box(0,yy,0,w-skin*2,skin,d,paint);
 box(0,0,-d/2+skin/2,w-skin*2,h-skin*2,skin,paint);
 for(const xx of [-(w+opening.width)/4,(w+opening.width)/4])box(xx,0,.194,(w-opening.width)/2,opening.height,.012,paint);
 for(const yy of [-(h+opening.height)/4,(h+opening.height)/4])box(0,yy,.194,w,(h-opening.height)/2,.012,paint);
 // A recessed opaque interior controls the depth, without asserting a visible fan.
 box(0,0,.095,opening.width,opening.height,.010,backing);
 const grilleZ=.177,rows=11,spacing=opening.height/rows;
 const grilleRows=[];
 for(let i=0;i<rows;i++){
  const y=-opening.height/2+spacing*(i+.5);grilleRows.push(y);
  box(0,y,grilleZ,opening.width,.006,.012,metal);
 }
 for(const xx of [-.22,0,.22])box(xx,0,grilleZ-.006,.005,opening.height,.009,metal);
 // Four original screw heads; no manufacturer text or invented badge.
 for(const xx of [-.344,.344])for(const yy of [-.224,.224]){
  const screw=new THREE.CylinderGeometry(.004,.004,.002,8);screw.rotateX(Math.PI/2);screw.translate(xx,yy,.201);add(screw,metal);
 }
 for(const xx of [-.25,.25])box(xx,-.25,0,.085,.020,.19,rubber);
 for(const [m,gs]of batches){const g=mergeGeometries(gs,false);if(!g)throw new Error('Vasanth AC merge failed');const mesh=new THREE.Mesh(g,m);mesh.name=m.name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);gs.forEach(g=>g.dispose());}
 // Probe points sit in actual openings, away from both horizontal and vertical bars.
 const gapProbes=grilleRows.slice(0,-1).map(y=>[.11,y+spacing/2,.100]);
 group.userData={kind:'window-air-conditioner-study',revision:1,width:w,height:h,depth:d,opening,grilleRows,grilleFront:grilleZ+.006,gapProbes,sillTop:3.73,padBottom:3.73,bodyBottom:3.75,
  sourceSha256:'d7f1bb013feac07661ecf78e023c289feac6d6acd128552581f5426570801742',
  limits:'Photo supports a pale rectangular window unit with a dark grille at the lowest upper front opening. Retained720×480×400mm size is inferred. Housing raised90mm to sit on the existing modeled sill with20mm pads. Grille count, internal depth, casing construction, screws and pads are original construction estimates. No brand, working internals, private pixels or current installation claim.'};
 return group;
}
