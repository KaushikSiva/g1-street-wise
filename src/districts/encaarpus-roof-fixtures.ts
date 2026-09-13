import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Two roof dishes visible above the central piers in the January 2024 photo. */
export function buildEncaarpusRoofFixtures(width:number){
  const group=new THREE.Group();group.name='Encaarpus source-visible roof dishes';
  const coating=new THREE.MeshStandardMaterial({color:0x878b85,roughness:.79,metalness:.15});
  const support=new THREE.MeshStandardMaterial({color:0x555c57,roughness:.7,metalness:.42});
  const shellParts:THREE.BufferGeometry[]=[],supportParts:THREE.BufferGeometry[]=[];
  const poses=[{x:-2.94,y:16.63,z:-.55,yaw:-.30},{x:2.53,y:16.58,z:-.64,yaw:.17}];
  const sx=width/14;
  for(const pose of poses){
    const center=new THREE.Vector3(pose.x*sx,pose.y,pose.z);
    // Closed, shallow reflecting bowl: no captured pixels, brand or operator.
    const profile=[new THREE.Vector2(0,.035),new THREE.Vector2(.10,.041),new THREE.Vector2(.20,.063),new THREE.Vector2(.30,.10),new THREE.Vector2(.30,.092),new THREE.Vector2(.20,.055),new THREE.Vector2(.10,.033),new THREE.Vector2(0,.027)];
    const shell=new THREE.LatheGeometry(profile,32).toNonIndexed();
    shell.rotateX(Math.PI/2-.18);shell.rotateY(pose.yaw);shell.translate(...center.toArray());shell.clearGroups();shellParts.push(shell);
    const mast=new THREE.CylinderGeometry(.022,.027,1.09,10).toNonIndexed();
    mast.translate(center.x,16.065,center.z-.095);mast.clearGroups();supportParts.push(mast);
    const base=new THREE.BoxGeometry(.24,.03,.22).toNonIndexed();base.translate(center.x,15.535,center.z-.095);base.clearGroups();supportParts.push(base);
    const clamp=new THREE.BoxGeometry(.14,.10,.10).toNonIndexed();clamp.translate(center.x,16.57,center.z-.095);clamp.clearGroups();supportParts.push(clamp);
    const start=new THREE.Vector3(center.x,16.57,center.z-.095),end=center.clone().add(new THREE.Vector3(0,0,.032)),delta=end.clone().sub(start);
    const brace=new THREE.CylinderGeometry(.017,.017,delta.length(),8).toNonIndexed();brace.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()));brace.translate(...start.add(end).multiplyScalar(.5).toArray());brace.clearGroups();supportParts.push(brace);
  }
  for(const [parts,material,name]of [[shellParts,coating,'dish bowls'],[supportParts,support,'mounts']] as const){
    const merged=mergeGeometries(parts,false);if(!merged)throw new Error('Roof fixture geometry merge failed');
    const mesh=new THREE.Mesh(merged,material);mesh.name='Encaarpus roof '+name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);parts.forEach(g=>g.dispose());
  }
  group.userData={sourcePhoto:'Frankleen Seeralan, January 2024, CIHM0ogKEICAgICtsaaHCA',sourceSha256:'0b02fddb8fcfeeb9b8552d5e12927ffea82ff016f3cf67bb972e8c735dd4bb99',observed:'Two shallow grey dish silhouettes above the inner grey roof piers',poses,diameterMeters:.6,
    limits:'Source supports count, broad silhouette and relative roof location. Diameter, depth, mounting, azimuth, elevation and hidden parts are inferred. No operator, brand, current installation or functional communications claim. Separate meshes preserve the existing facade AO geometry.'};
  return group;
}
