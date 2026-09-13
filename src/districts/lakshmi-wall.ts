import * as THREE from 'three';

export const LAKSHMI_SETBACK=.21;
export const LAKSHMI_BAY_EDGES=[-3.96,-.68,.68,3.96];
export const LAKSHMI_GROOVES=[3.03,6.13,9.23];
export const LAKSHMI_GROOVE_WIDTH=.015;
export const LAKSHMI_GROOVE_DEPTH=.006;
type Opening={x0:number;x1:number;y0:number;y1:number};

export function lakshmiWallFaceZ(x:number,y:number) {
  const inBay=(x>=LAKSHMI_BAY_EDGES[0] && x<=LAKSHMI_BAY_EDGES[1]) || (x>=LAKSHMI_BAY_EDGES[2] && x<=LAKSHMI_BAY_EDGES[3]);
  const inJoint=LAKSHMI_GROOVES.some(v=>Math.abs(y-v)<LAKSHMI_GROOVE_WIDTH/2);
  return (inBay?0:-LAKSHMI_SETBACK)-(inJoint?LAKSHMI_GROOVE_DEPTH:0);
}

/** One closed wall boundary with projecting window stacks and actual shallow
 * plaster joints. Adjacent cells share a boundary, never overlapping boxes. */
export function buildLakshmiWall(width:number,height:number,depth:number,openings:Opening[]) {
  const xs=[-width/2,...LAKSHMI_BAY_EDGES,width/2];
  const ys=[0,...LAKSHMI_GROOVES.flatMap(y=>[y-LAKSHMI_GROOVE_WIDTH/2,y+LAKSHMI_GROOVE_WIDTH/2]),height];
  const out:number[]=[],back=-depth;
  function face(x0:number,x1:number,y0:number,y1:number,z:number,holes:Opening[],reverse=false){
    const shape=new THREE.Shape();shape.moveTo(x0,y0);shape.lineTo(x1,y0);shape.lineTo(x1,y1);shape.lineTo(x0,y1);shape.closePath();
    for(const o of holes){const path=new THREE.Path();path.moveTo(o.x0,o.y0);path.lineTo(o.x0,o.y1);path.lineTo(o.x1,o.y1);path.lineTo(o.x1,o.y0);path.closePath();shape.holes.push(path);}
    const geometry=new THREE.ShapeGeometry(shape),p=geometry.attributes.position,idx=geometry.index!;
    for(let i=0;i<idx.count;i+=3)for(const j of reverse?[0,2,1]:[0,1,2]){const v=idx.getX(i+j);out.push(p.getX(v),p.getY(v),z);}
    geometry.dispose();
  }
  type P=[number,number,number];
  function quad(a:P,b:P,c:P,d:P,normal:P){
    const cross=new THREE.Vector3().fromArray(b).sub(new THREE.Vector3().fromArray(a)).cross(new THREE.Vector3().fromArray(c).sub(new THREE.Vector3().fromArray(a)));
    if(cross.dot(new THREE.Vector3().fromArray(normal))<0)out.push(...a,...c,...b,...a,...d,...c);
    else out.push(...a,...b,...c,...a,...c,...d);
  }
  face(-width/2,width/2,0,height,back,openings,true);
  let assigned=0;
  for(let xi=0;xi<xs.length-1;xi++)for(let yi=0;yi<ys.length-1;yi++){
    const [x0,x1]=[xs[xi],xs[xi+1]],[y0,y1]=[ys[yi],ys[yi+1]],z=lakshmiWallFaceZ((x0+x1)/2,(y0+y1)/2);
    const holes=openings.filter(o=>o.x0>x0 && o.x1<x1 && o.y0>y0 && o.y1<y1);assigned+=holes.length;
    face(x0,x1,y0,y1,z,holes);
    if(xi===0)quad([x0,y0,back],[x0,y1,back],[x0,y1,z],[x0,y0,z],[-1,0,0]);
    if(xi===xs.length-2)quad([x1,y0,back],[x1,y1,back],[x1,y1,z],[x1,y0,z],[1,0,0]);
    if(yi===0)quad([x0,y0,back],[x1,y0,back],[x1,y0,z],[x0,y0,z],[0,-1,0]);
    if(yi===ys.length-2)quad([x0,y1,back],[x1,y1,back],[x1,y1,z],[x0,y1,z],[0,1,0]);
    if(xi<xs.length-2){const next=lakshmiWallFaceZ((x1+xs[xi+2])/2,(y0+y1)/2);if(Math.abs(z-next)>1e-8)quad([x1,y0,z],[x1,y1,z],[x1,y1,next],[x1,y0,next],[z>next?1:-1,0,0]);}
    if(yi<ys.length-2){const next=lakshmiWallFaceZ((x0+x1)/2,(y1+ys[yi+2])/2);if(Math.abs(z-next)>1e-8)quad([x0,y1,z],[x1,y1,z],[x1,y1,next],[x0,y1,next],[0,z>next?1:-1,0]);}
    for(const o of holes){
      quad([o.x0,o.y0,back],[o.x0,o.y1,back],[o.x0,o.y1,z],[o.x0,o.y0,z],[1,0,0]);
      quad([o.x1,o.y0,back],[o.x1,o.y1,back],[o.x1,o.y1,z],[o.x1,o.y0,z],[-1,0,0]);
      quad([o.x0,o.y0,back],[o.x1,o.y0,back],[o.x1,o.y0,z],[o.x0,o.y0,z],[0,1,0]);
      quad([o.x0,o.y1,back],[o.x1,o.y1,back],[o.x1,o.y1,z],[o.x0,o.y1,z],[0,-1,0]);
    }
  }
  if(assigned!==openings.length)throw new Error('An opening crosses a Lakshmi wall step or plaster joint');
  const source=new THREE.BufferGeometry();source.setAttribute('position',new THREE.Float32BufferAttribute(out,3));
  const result=conformLakshmiWall(source);source.dispose();return result;
}

/** Extrusion caps can skip collinear opening corners. Split those long edges
 * so the front/back triangles share every reveal vertex without T-junctions. */
export function conformLakshmiWall(source:THREE.BufferGeometry) {
  const positions=source.getAttribute('position'),unique=new Map<string,THREE.Vector3>();
  for(let i=0;i<positions.count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(positions,i);
    unique.set(p.toArray().map(v=>Math.round(v*1e5)).join(','),p);
  }
  const vertices=[...unique.values()],output:number[]=[];
  function emit(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3) {
    const triangle=[a,b,c];
    for(let edge=0;edge<3;edge++){
      const start=triangle[edge],end=triangle[(edge+1)%3],opposite=triangle[(edge+2)%3];
      const direction=end.clone().sub(start),lengthSquared=direction.lengthSq();
      for(const point of vertices){
        const t=point.clone().sub(start).dot(direction)/lengthSquared;
        if(t<=1e-6 || t>=1-1e-6)continue;
        if(start.clone().addScaledVector(direction,t).distanceToSquared(point)>1e-12)continue;
        emit(start,point,opposite);emit(point,end,opposite);return;
      }
    }
    output.push(...a.toArray(),...b.toArray(),...c.toArray());
  }
  for(let i=0;i<positions.count;i+=3)emit(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(positions,i+j)) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]);
  const result=new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(output,3));
  result.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(output.length/3*2),2));
  result.computeVertexNormals();return result;
}
