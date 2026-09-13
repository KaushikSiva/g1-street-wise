import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Source-informed two-leaf metalwork in an inferred closed pose. */
export function buildVasanthGate(centerX:number,z:number,width:number){
 const group=new THREE.Group();group.name='Vasanth two-leaf gate';group.position.set(centerX,0,z);
 const paint=new THREE.MeshStandardMaterial({name:'Vasanth gate painted steel',color:0x303931,roughness:.79,metalness:.3});
 const hardware=new THREE.MeshStandardMaterial({name:'Vasanth gate hinge and latch steel',color:0x50594e,roughness:.62,metalness:.65});
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
 function add(g:THREE.BufferGeometry,m:THREE.Material){const flat=g.toNonIndexed();g.dispose();flat.clearGroups();if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(flat);}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m=paint){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,m);}
 const split=-width/2+width*.68,seam=.012,frame=.035;
 const leaves=[[-width/2,split-seam/2],[split+seam/2,width/2]];
 const openings:number[][]=[],bars:number[][]=[],panels:number[][]=[];
 for(const [left,right]of leaves){
  const mid=(left+right)/2,span=right-left;
  for(const x of [left+frame/2,right-frame/2])box(x,.9675,0,frame,1.735,.045);
  for(const y of [.1175,.6975,1.76])box(mid,y,0,span-frame*2,frame,.045);
  // Thin sheet inside the lower frame, with shallow vertical stiffening ribs.
  box(mid,.4075,0,span-frame*2,.545,.003);
  const ribCount=Math.max(2,Math.round((span-frame*2)/.14));
  for(let i=1;i<ribCount;i++){const x=left+frame+(span-frame*2)*i/ribCount;box(x,.4075,.0055,.013,.505,.008);}
  panels.push([left+frame+.025,.4,.0015]);
  const n=Math.max(3,Math.round((span-frame*2)/.13)),dx=(span-frame*2)/n;
  for(let i=1;i<n;i++){const x=left+frame+i*dx;box(x,1.298,0,.020,1.20,.020);bars.push([x,1.20,.010]);}
  for(let i=0;i<n;i++)openings.push([left+frame+(i+.5)*dx,1.20,.10]);
 }
 // Barrel hinges stay within the existing45mm collision depth and meet the posts.
 for(const x of [-width/2+.014,width/2-.014])for(const y of [.31,1.48]){
  const barrel=new THREE.CylinderGeometry(.021,.021,.11,10);barrel.translate(x,y,0);add(barrel,hardware);
  box(x+(x<0?-.016:.016),y,0,.025,.085,.030,hardware);
 }
 // An inferred surface bolt bridges the meeting seam, without welding the sheets.
 box(split,.79,.015,.18,.014,.014,hardware);
 for(const x of [split-.062,split+.062])box(x,.79,.015,.018,.060,.014,hardware);
 for(const [m,gs]of batches){const g=mergeGeometries(gs,false);if(!g)throw new Error('Vasanth gate merge failed');const mesh=new THREE.Mesh(g,m);mesh.name=m.name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);gs.forEach(g=>g.dispose());}
 group.userData={kind:'vasanth-two-leaf-gate',revision:1,width,depth:.045,split,seam,leaves,openings,bars,panels,seamProbe:[split,.40,.10],pose:'closed',sourceSha256:'b358e3216399a7f49148164b91aa3dae8b8fb869bb7af85bf74ab52247f9db0a',
  limits:'Private gallery photo1 resolves unequal gate leaves, vertical bars and ribbed lower sheets.68/32 leaf ratio,12mm seam,frame sections,bar/rib count,hinges and latch are inferred. Existing2.10m modeled opening and45mm collision depth retained. Closed pose is a study choice; source gate is partly open. No source pixels, advertising or phone numbers in runtime.'};
 return group;
}
