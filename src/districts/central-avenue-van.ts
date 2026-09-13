import * as THREE from 'three';
import type {centralAvenueFrame} from './central-avenue';

type Frame=NonNullable<ReturnType<typeof centralAvenueFrame>>;
export const CENTRAL_AVENUE_VAN_ASSET='/assets/central-avenue-passenger-van.glb';

/** Source-visible parking side/orientation; exact station and dimensions inferred. */
export function placeCentralAvenueVan(model:THREE.Group,frame:Frame,heightAt:(x:number,z:number)=>number|null) {
  const station=53.5,lateral=-3.85;
  const sample=(s:number,n:number)=>{const p=frame.point(s,n);return heightAt(p.x,p.z)??-.045;};
  const contacts=[-1.83,1.83].flatMap(s=>[-.905,.905].map(n=>({s,n,y:sample(station+s,lateral+n)})));
  const mean=contacts.reduce((sum,p)=>sum+p.y,0)/4;
  const slopeS=contacts.reduce((sum,p)=>sum+p.y*p.s,0)/contacts.reduce((sum,p)=>sum+p.s*p.s,0);
  const slopeN=contacts.reduce((sum,p)=>sum+p.y*p.n,0)/contacts.reduce((sum,p)=>sum+p.n*p.n,0);
  const right=frame.normal.clone().setY(slopeN).normalize();
  const z=frame.direction.clone().negate().setY(-slopeS).normalize();
  const up=z.clone().cross(right).normalize();z.copy(right).cross(up).normalize();
  const pose=new THREE.Matrix4().makeBasis(right,up,z);
  const group=new THREE.Group();group.name='Central Avenue source-informed parked passenger van';
  group.quaternion.setFromRotationMatrix(pose);group.position.copy(frame.point(station,lateral,mean));
  // Tangency of a tilted circular tyre lowers its bottom by <0.3mm here.
  group.position.y+=.375*(1-up.y);
  group.add(model);let triangles=0,meshes=0;
  model.traverse(o=>{if(o instanceof THREE.Mesh){
    o.castShadow=!/glazing/i.test(o.name);o.receiveShadow=true;
    triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;meshes++;
  }});
  group.userData={centralAvenueVan:true,revision:1,station,lateral,triangles,meshes,
    asset:CENTRAL_AVENUE_VAN_ASSET,attribution:'/assets/central-avenue-passenger-van.attribution.json',
    source:'Avinash west view and Prashanth street-context panorama show a tall white passenger van parked along the western verge, facing north',
    inferred:'Variant, dimensions, parking station/offset, material response, cabin and hidden front geometry; source capture date unknown',
    support:{contacts,mean,slopeS,slopeN,up:up.toArray(),maxPlaneResidual:Math.max(...contacts.map(p=>Math.abs(p.y-mean-p.s*slopeS-p.n*slopeN)))},
    limits:'Historical scene occupancy study, not a current vehicle-location claim or verified manufacturer replica'};
  // Account for body and mirror envelope, with 120mm walking clearance.
  const blocks=(x:number,z:number)=>{const p=frame.coordinates(new THREE.Vector3(x,0,z));return Math.abs(p.s-station)<3.26&&Math.abs(p.n-lateral)<1.50;};
  return {group,blocks};
}
