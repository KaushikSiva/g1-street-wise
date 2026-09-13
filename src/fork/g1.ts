import * as THREE from 'three';
import URDFLoader, {type URDFRobot} from 'urdf-loader';
export class UnitreeG1 {
 readonly group=new THREE.Group();private robot:URDFRobot|null=null;private joints:string[]=[];
 async load(){const manager=new THREE.LoadingManager();const complete=new Promise<void>((resolve,reject)=>{manager.onLoad=()=>resolve();manager.onError=url=>reject(new Error('Could not load G1 mesh: '+url));});const loader=new URDFLoader(manager);loader.parseCollision=false;const [robot,response]=await Promise.all([loader.loadAsync('/assets/fork/g1/g1_12dof.urdf'),fetch('/assets/fork/g1/joints.json')]);if(!response.ok)throw new Error('G1 joint map unavailable');this.joints=await response.json();this.robot=robot;this.group.add(robot);await complete;robot.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=o.receiveShadow=true;const source=o.material as THREE.MeshPhongMaterial;o.material=new THREE.MeshStandardMaterial({color:source.color,roughness:.4,metalness:.28});}});}
 pose(q:number[]){if(!this.robot)return;this.robot.position.set(q[0],q[1],q[2]);this.robot.quaternion.set(q[4],q[5],q[6],q[3]);this.joints.forEach((name,i)=>this.robot!.setJointValue(name,q[i+7]));}
}
