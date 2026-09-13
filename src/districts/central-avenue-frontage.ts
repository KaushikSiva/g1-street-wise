import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {createLakshmiPlaster,setLakshmiMaterialUV} from './lakshmi-material';
import {createLakshmiLettering} from './lakshmi-lettering';
import {buildLakshmiWall,lakshmiWallFaceZ,LAKSHMI_SETBACK,LAKSHMI_BAY_EDGES,LAKSHMI_GROOVES,LAKSHMI_GROOVE_WIDTH,LAKSHMI_GROOVE_DEPTH} from './lakshmi-wall';
import {createLakshmiWindow,createLakshmiWindowMaterials} from './lakshmi-window';
export const LAKSHMI_WAY_ID=355940221;
const EAST=111320*Math.cos(13.0516624*Math.PI/180);

/** One photographed frontage, conditionally associated by name/address and adjacent map pin. */
export function installCentralAvenueFrontage(buildings:THREE.Group,data:any) {
  const way=data.elements.find((e:any)=>e.type==='way' && e.id===LAKSHMI_WAY_ID);
  const record=buildings.userData.records?.find((r:any)=>r.id===LAKSHMI_WAY_ID);
  if(!way?.geometry || !record)return null;
  const originalSource=JSON.stringify(way);
  const points=way.geometry.map((p:any)=>new THREE.Vector3((p.lon-80.2306892)*EAST,0,(13.0516624-p.lat)*111320));
  const a=points[1],b=points[2],edge=b.clone().sub(a),width=edge.length(),height=record.height;
  if(width<11 || width>15 || Math.abs(height-9.65)>.001)throw new Error('Lakshmi frontage source dimensions need review');
  const along=edge.clone().normalize(),outward=new THREE.Vector3(along.z,0,-along.x);
  const center=a.clone().lerp(b,.5),yaw=Math.atan2(outward.x,outward.z);
  const front=new THREE.Group();front.name='Lakshmi Apartments · partial photo-informed Central Avenue frontage';front.position.copy(center);front.rotation.y=yaw;
  const staged:{mesh:THREE.Mesh;geometry:THREE.BufferGeometry}[]=[];
  let removedTriangles=0;
  for(const child of buildings.children){
    if(!(child instanceof THREE.Mesh) || !child.name.startsWith('Mapped building shells'))continue;
    const geo=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone(),p=geo.getAttribute('position');
    const keep:number[]=[];let removed=0;
    for(let i=0;i<p.count;i+=3){
      const onFront=[0,1,2].every(j=>{const v=new THREE.Vector3().fromBufferAttribute(p,i+j),d=v.clone().sub(a),t=d.dot(along);return Math.abs(d.dot(outward))<.001 && t>=-.001 && t<=width+.001 && v.y>=-.001 && v.y<=height+.001;});
      if(onFront){removed++;continue;}keep.push(i,i+1,i+2);
    }
    if(removed){
      const next=new THREE.BufferGeometry();
      for(const [key,raw] of Object.entries(geo.attributes)){
        const attr=raw as THREE.BufferAttribute;
        const v:number[]=[];for(const i of keep)for(let k=0;k<attr.itemSize;k++)v.push(attr.array[i*attr.itemSize+k]);
        next.setAttribute(key,new THREE.Float32BufferAttribute(v,attr.itemSize));
      }
      next.computeBoundingBox();next.computeBoundingSphere();staged.push({mesh:child,geometry:next});removedTriangles+=removed;
    }
    geo.dispose();
  }
  if(removedTriangles!==2){staged.forEach(x=>x.geometry.dispose());throw new Error(`Expected one Lakshmi frontage plane, got ${removedTriangles} triangles`);}
  const plaster=createLakshmiPlaster();
  const trim=new THREE.MeshStandardMaterial({color:0xd7d7cd,roughness:.9});
  const metal=new THREE.MeshStandardMaterial({color:0x546259,roughness:.54,metalness:.36});
  const glass=new THREE.MeshStandardMaterial({color:0x23312a,roughness:.32,metalness:.02});
  const windowMaterials=createLakshmiWindowMaterials();
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  function add(g:THREE.BufferGeometry,m:THREE.Material){if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(g);}
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material=plaster){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);if(m===plaster)setLakshmiMaterialUV(g);add(g,m);}
  function rod(a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material=trim){const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,d.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);add(g,m);}
  const openings:{x0:number;x1:number;y0:number;y1:number;kind:string}[]=[];
  for(let floor=0;floor<3;floor++){
    const y=.86+floor*3.1;
    for(const x of [-2.32,2.32])openings.push({x0:x-1.12,x1:x+1.12,y0:y,y1:y+1.86,kind:'window'});
    for(const x of [-5.05,5.05])openings.push({x0:x-.38,x1:x+.38,y0:y+.94,y1:y+1.34,kind:'vent'});
  }
  const depth=.68;
  const wallGeometry=buildLakshmiWall(width,height,depth,openings);setLakshmiMaterialUV(wallGeometry);
  const wall=new THREE.Mesh(wallGeometry,plaster);wall.name='Lakshmi continuous plaster wall and reveals';front.add(wall);
  const rearWindows:THREE.Group[]=[];
  for(const o of openings){
    const x=(o.x0+o.x1)/2,y=(o.y0+o.y1)/2,w=o.x1-o.x0,h=o.y1-o.y0;
    if(o.kind==='vent'){
      box(x,y,-depth,w,h,.035,glass);
      for(const yy of [o.y0+.045,o.y1-.045])box(x,yy,-depth+.05,w,.045,.045,metal);
      for(const xx of [o.x0+.035,x,o.x1-.035])box(xx,y,-depth+.05,.04,h,.045,metal);
      continue;
    }
    const rear=createLakshmiWindow(o,rearWindows.length,depth,plaster,windowMaterials);rearWindows.push(rear);front.add(rear);
    for(const xx of [o.x0-.12,o.x1+.12])box(xx,y,.025,.055,h+.28,.05,trim);
    for(const yy of [o.y0-.13,o.y1+.13])box(x,yy,.025,w+.28,.055,.05,trim);
  }
  // Source-visible short white pipe runs. Their absolute routes remain inferred.
  // Cross each bay step outside the wall rather than leaving a floating straight run.
  const pipeRuns=[
    [[-4.35,3.02],[-4.35,3.28],[-3.90,3.28],[-3.90,3.48]],
    [[3.45,3.35],[3.45,3.08],[4.30,3.08],[4.30,3.20]],
    [[-3.0,6.98],[-4.28,6.98],[-4.28,6.76]],
  ];
  for(const run of pipeRuns)for(let i=0;i<run.length-1;i++){
    const [ax,ay]=run[i],[bx,by]=run[i+1],points=[new THREE.Vector3(ax,ay,lakshmiWallFaceZ(ax,ay)+.026)];
    if(Math.abs(ax-bx)>1e-6){
      const boundaries=LAKSHMI_BAY_EDGES.filter(x=>x>Math.min(ax,bx) && x<Math.max(ax,bx)).sort((a,b)=>ax<bx?a-b:b-a);
      for(const x of boundaries){const y=ay+(by-ay)*(x-ax)/(bx-ax),left=lakshmiWallFaceZ(x-.001,y),right=lakshmiWallFaceZ(x+.001,y),outside=x+(left<right?-.032:.032);
        points.push(new THREE.Vector3(outside,y,(ax<bx?left:right)+.026),new THREE.Vector3(outside,y,(ax<bx?right:left)+.026));}
    }
    points.push(new THREE.Vector3(bx,by,lakshmiWallFaceZ(bx,by)+.026));
    for(let j=0;j<points.length-1;j++)rod(points[j],points[j+1],.018);
  }
  for(const [m,list] of batches){const g=mergeGeometries(list,false);if(g){const mesh=new THREE.Mesh(g,m);front.add(mesh);}list.forEach(g=>g.dispose());}
  const lettering=createLakshmiLettering();front.add(lettering);
  front.traverse(o=>{if(o instanceof THREE.Mesh){o.receiveShadow=true;o.castShadow=o.name!=='Frosted glazing' && o.name!=='AC wire guard';}});
  let removedInstances=0;
  const instanceChanges:{mesh:THREE.InstancedMesh;matrices:THREE.Matrix4[]}[]=[];
  for(const o of buildings.children){
    if(!(o instanceof THREE.InstancedMesh) || /parapet|tank|roof/i.test(o.name))continue;
    const matrices:THREE.Matrix4[]=[];
    for(let i=0;i<o.count;i++){
      const matrix=new THREE.Matrix4();o.getMatrixAt(i,matrix);const p=new THREE.Vector3().setFromMatrixPosition(matrix),d=p.clone().sub(a),s=d.dot(along);
      if(s>.25 && s<width-.25 && Math.abs(d.dot(outward))<.9 && p.y<height){removedInstances++;continue;}
      matrices.push(matrix);
    }
    if(matrices.length!==o.count)instanceChanges.push({mesh:o,matrices});
  }
  if(JSON.stringify(way)!==originalSource)throw new Error('Central Avenue source footprint was mutated');
  for(const {mesh,geometry} of staged){mesh.geometry.dispose();mesh.geometry=geometry;}
  for(const {mesh,matrices} of instanceChanges){matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.count=matrices.length;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
  const evidence={revision:4,wallProfile:{bayEdges:LAKSHMI_BAY_EDGES,setback:LAKSHMI_SETBACK,grooves:LAKSHMI_GROOVES,grooveWidth:LAKSHMI_GROOVE_WIDTH,grooveDepth:LAKSHMI_GROOVE_DEPTH,limits:'Projection/recess relationship observed; dimensions and continuous roof connection inferred'},pipeRuns,rearWindows:rearWindows.map(g=>g.userData),wallConstruction:'Single closed stepped wall boundary with two projecting window stacks, recessed connecting/flank walls, twelve holes and three shallow plaster joints; continuous metre-space UV',plaster:plaster.userData,lettering:lettering.userData,wayId:LAKSHMI_WAY_ID,removedTriangles,removedInstances,width,height,pose:center.toArray(),yaw,openings,depth,
    sourcePhoto:'Vishy Vishy, May 2024; Google photo CIHM0ogKEICAgICThPGJaw, captioned Rams Bridge View but visible lettering LAKSHMI APARTMENTS',
    identity:'Separate Lakshmi Apartments map listing at 2/12 Central Avenue, 13.053470,80.229074 lies adjacent to this mapped footprint. Conditional association, not a parcel survey.',
    limits:'Photo crops building edges and entrance; three visible window rows modeled within retained 9.65 m inferred shell height. Recess dimensions, colors, outer widths, AC geometry and lettering placement inferred. Ground entrance and unseen sides not reconstructed.'};
  front.userData=evidence;buildings.add(front);buildings.userData.centralAvenueFrontage=evidence;return evidence;
}
