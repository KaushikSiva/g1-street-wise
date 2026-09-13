import * as THREE from 'three';
export const CENTRAL_AVENUE_MOTORCYCLE_ASSET='/assets/central-avenue-commuter-motorcycle.glb';
/** Historical source occupancy; no exact make, surveyed pose or current-location claim. */
export function placeCentralAvenueMotorcycle(model:THREE.Group,data:any,heightAt:(x:number,z:number)=>number|null){
 const way=data.elements.find((e:any)=>e.type==='way'&&e.id===354839974);
 if(!way?.geometry)return null;
 const east=111320*Math.cos(13.0516624*Math.PI/180),project=(p:any)=>new THREE.Vector3((p.lon-80.2306892)*east,0,(13.0516624-p.lat)*111320);
 const a=project(way.geometry[1]),b=project(way.geometry[2]),along=b.clone().sub(a).normalize(),outward=new THREE.Vector3(along.z,0,-along.x);
 const frontMatrix=new THREE.Matrix4().compose(a.clone().lerp(b,.5),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(outward.x,outward.z)),new THREE.Vector3(1,1,1));
 // Front points south with a slight outward angle, outside the northern panel.
 const localPose=[6.2,0,5.05],yaw=Math.atan2(outward.x,outward.z)+Math.PI/2+.12;
 const position=new THREE.Vector3(...localPose).applyMatrix4(frontMatrix),rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
 const contacts=[[-1.1176e-8,0,.639999986],[-1.1176e-8,0,-.680000007],[-.33,0,.28]].map(p=>{
  const local=new THREE.Vector3(...p),world=local.clone().applyQuaternion(rotation).add(position);return{local:p,surface:heightAt(world.x,world.z)??-.045};
 });
 // Three real support points determine the rigid support plane, without
 // reapplying the asset's baked parked lean or bending the model.
 const [p,q,r]=contacts,dx=q.local[0]-p.local[0],dz=q.local[2]-p.local[2],ex=r.local[0]-p.local[0],ez=r.local[2]-p.local[2],det=dx*ez-ex*dz;
 const slopeX=((q.surface-p.surface)*ez-(r.surface-p.surface)*dz)/det;
 const slopeZ=(dx*(r.surface-p.surface)-ex*(q.surface-p.surface))/det;
 const intercept=p.surface-slopeX*p.local[0]-slopeZ*p.local[2];
 const right=new THREE.Vector3(1,slopeX,0).normalize(),back=new THREE.Vector3(0,slopeZ,1).normalize(),up=back.clone().cross(right).normalize();back.copy(right).cross(up).normalize();
 const tilt=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,back));
 const group=new THREE.Group();group.name='Central Avenue source-informed parked commuter motorcycle';group.position.copy(position).setY(intercept);group.quaternion.copy(rotation).multiply(tilt);group.add(model);
 let triangles=0,meshes=0;model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;meshes++;}});
 group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),point=new THREE.Vector3();
 const blocks=(x:number,z:number)=>{point.set(x,group.position.y,z).applyMatrix4(inverse);return point.x>-.705&&point.x<.396&&Math.abs(point.z)<1.13;};
 group.userData={centralAvenueMotorcycle:true,revision:1,asset:CENTRAL_AVENUE_MOTORCYCLE_ASSET,attribution:'/assets/central-avenue-commuter-motorcycle.attribution.json',triangles,meshes,frontLocalPose:localPose,yaw,contacts,support:{slopeX,slopeZ,intercept},source:'Private Avinash west photograph: unoccupied dark commuter motorcycle beside the northern blue boundary panel and yellow cover',limits:'Original approximate commuter geometry; make, dimensions, materials, parking pose and date unknown. Seven-degree parked lean baked into asset. No rider or source-photo pixels; historical occupancy, not a current vehicle-location claim.'};
 return {group,blocks};
}
