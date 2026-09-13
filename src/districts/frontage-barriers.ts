import * as THREE from 'three';

export type FrontageBarrier={x:number;z:number;width:number;depth:number;kind:string};
// A 25 cm walker radius also prevents stepping over thin metalwork in a
// single capped Shift-walk frame (8 m/s × 0.05 s = 40 cm).
export const WALKER_RADIUS=.25;
export function createFrontageBarrierSampler(group:THREE.Group,barriers:FrontageBarrier[]){
  group.updateWorldMatrix(true,false);
  const inverse=group.matrixWorld.clone().invert(),point=new THREE.Vector3();
  return (x:number,z:number)=>{
    point.set(x,0,z).applyMatrix4(inverse);
    return barriers.some(b=>{
      const dx=Math.max(0,Math.abs(point.x-b.x)-b.width/2);
      const dz=Math.max(0,Math.abs(point.z-b.z)-b.depth/2);
      return dx*dx+dz*dz<=WALKER_RADIUS*WALKER_RADIUS;
    });
  };
}
