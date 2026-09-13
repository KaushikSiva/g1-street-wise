import * as THREE from 'three';
/** Only the visible form is identified: a low yellow round object beside the
 * parked motorcycle. Utility purpose, construction and dimensions are unknown. */
export function buildAvinashYellowObject(front:THREE.Object3D,heightAt:(x:number,z:number)=>number|null){
 const position=front.localToWorld(new THREE.Vector3(8.1,0,5.4)),ground=heightAt(position.x,position.z)??-.045;
 const radius=.335,groundAt=(x:number,z:number)=>heightAt(x,z)??-.045;
 const slopeX=(groundAt(position.x+radius,position.z)-groundAt(position.x-radius,position.z))/(2*radius);
 const slopeZ=(groundAt(position.x,position.z+radius)-groundAt(position.x,position.z-radius))/(2*radius);
 const right=new THREE.Vector3(1,slopeX,0).normalize(),back=new THREE.Vector3(0,slopeZ,1).normalize(),up=back.clone().cross(right).normalize();back.copy(right).cross(up).normalize();
 const group=new THREE.Group();group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,back));group.name='Avinash source-visible yellow round ground object';group.position.copy(position).setY(ground);
 const baseMaterial=new THREE.MeshStandardMaterial({color:0x77735b,roughness:.97}),topMaterial=new THREE.MeshStandardMaterial({color:0xb4a12c,roughness:.91});
 baseMaterial.name='Yellow round object inferred low grey collar';topMaterial.name='Yellow round object inferred ochre finish';
 const base=new THREE.Mesh(new THREE.CylinderGeometry(.315,.32,.04,64),baseMaterial);base.position.y=.02;
 const top=new THREE.Mesh(new THREE.CylinderGeometry(.32,.335,.018,64),topMaterial);top.position.y=.049;
 for(const mesh of [base,top]){mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
 group.userData={avinashYellowObject:true,revision:1,frontLocal:[8.1,0,5.4],supportY:ground,supportSlope:[slopeX,slopeZ],radius:.335,height:.058,source:'Private Avinash west view shows a low yellow round object beside the rear of the unoccupied motorcycle, outside the northern blue boundary',sourceSha256:'9454a6e8e1ad98ee3fe917cdeb6d47be95d6808a4d21888e1489fb1b83fcb909',limits:'Only yellow circular top and low side silhouette observed. Exact pose, diameter, thickness, material and purpose unverified; no asserted utility lid, signage, hardware or photo pixels.'};
 group.updateMatrixWorld(true);
 // Match the actual tilted top and shallow beveled rim when walked over.
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const sample=(x:number,z:number)=>{if(Math.hypot(x-position.x,z-position.z)>.34)return null;ray.set(new THREE.Vector3(x,ground+1,z),down);return ray.intersectObject(group,true)[0]?.point.y??null;};
 return {group,heightAt:sample};
}
