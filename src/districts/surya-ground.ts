import * as THREE from 'three';
import seam from './surya-ground.json';
export const SURYA_PASSAGE_DEPTH=10.5;
export const SURYA_PASSAGE_DOOR_DEPTH=7.5;
const groundY=-.043,baseY=-.127,thresholdY=.055,left=-11.865;
type XZ={x:number;z:number};
function outline(width:number,southMatrix:THREE.Matrix4){
 const sideWidth=27.701095949813126,back=new THREE.Vector3(sideWidth/2-SURYA_PASSAGE_DEPTH,0,0).applyMatrix4(southMatrix);
 return [{x:left,z:back.z},{x:back.x,z:back.z},{x:-width/2,z:0},{x:width/2,z:0},{x:width/2,z:8.4},{x:seam.gateRight,z:8.4},...seam.points.slice().reverse().map(p=>({x:p.point[0],z:p.point[2]})),{x:seam.gateLeft,z:8.4},{x:left,z:8.4}];
}
function inside(x:number,z:number,points:XZ[]){let result=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)result=!result;}return result;}
function sideStep(southMatrix:THREE.Matrix4){const g=new THREE.BoxGeometry(1.28,thresholdY-groundY,.42);g.translate(27.701095949813126/2-SURYA_PASSAGE_DOOR_DEPTH,(thresholdY+groundY)/2,.21);g.applyMatrix4(southMatrix);return g;}
export function buildSuryaGround(width:number,southMatrix:THREE.Matrix4,material:THREE.Material){
 const boundary=outline(width,southMatrix),shape=new THREE.Shape(boundary.map(p=>new THREE.Vector2(p.x,-p.z))),g=new THREE.ExtrudeGeometry(shape,{depth:groundY-baseY,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,baseY,0);
 const ground=new THREE.Mesh(g,material);ground.name='Surya continuous courtyard passage and gate apron';ground.castShadow=true;ground.receiveShadow=true;
 const step=new THREE.Mesh(sideStep(southMatrix),material);step.name='Surya south passage door landing';step.castShadow=true;step.receiveShadow=true;
 const metadata={groundY,baseY,thresholdY,passageDepth:SURYA_PASSAGE_DEPTH,southDoorDepth:SURYA_PASSAGE_DOOR_DEPTH,boundary,shoulderSeam:seam.points,source:'Gallery photo3: continuous grey concrete passage, ground openings and low doorway threshold; photo7 reciprocal gate view',limits:'Ground extent, 10.5 m observed-reach placement, slope, thickness and 98 mm landing step are inferred. Gate apron meets current rendered shoulder outer edge. This is not a parcel survey; no paving grid or unobserved rear courtyard is asserted.'};
 ground.userData=metadata;return{ground,step,metadata};
}
export function createSuryaGroundHeightSampler(data:any){
 const way=data.elements.find((e:any)=>e.type==='way'&&e.id===354840134),east=111320*Math.cos(13.0516624*Math.PI/180);if(!way?.geometry||way.geometry.length!==5)return()=>null;
 const points=way.geometry.slice(0,-1).map((p:any)=>new THREE.Vector3((p.lon-80.2306892)*east,0,(13.0516624-p.lat)*111320)),a=points[1],b=points[2],along=b.clone().sub(a).normalize(),outward=new THREE.Vector3(along.z,0,-along.x),width=a.distanceTo(b);
 const matrix=new THREE.Matrix4().compose(a.clone().lerp(b,.5),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(outward.x,outward.z)),new THREE.Vector3(1,1,1)),inverse=matrix.clone().invert(),local=points.map((p:THREE.Vector3)=>p.clone().applyMatrix4(inverse)),sp=local[2],sq=local[3],sd=sq.clone().sub(sp).normalize(),sn=new THREE.Vector3(sd.z,0,-sd.x);
 const southMatrix=new THREE.Matrix4().compose(sp.clone().lerp(sq,.5),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(sn.x,sn.z)),new THREE.Vector3(1,1,1)),southInverse=southMatrix.clone().invert(),boundary=outline(width,southMatrix),p=new THREE.Vector3(),q=new THREE.Vector3();
 return(x:number,z:number)=>{p.set(x,0,z).applyMatrix4(inverse);q.copy(p).applyMatrix4(southInverse);if(Math.abs(q.x-(sp.distanceTo(sq)/2-SURYA_PASSAGE_DOOR_DEPTH))<=.64&&q.z>=0&&q.z<=.42)return thresholdY;if(p.x>=3.775&&p.x<=5.125&&p.z>=0&&p.z<=.35)return thresholdY;return inside(p.x,p.z,boundary)?groundY:null;};
}
