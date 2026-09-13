import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLakshmiPlaster,setLakshmiMaterialUV} from './lakshmi-material';
import type {FrontageBarrier} from './frontage-barriers';

/** Partial boundary visible in the inward/reverse passage photographs. */
export function buildVasanthPassageBoundary(width:number,passageWidth:number,gateZ:number){
 const group=new THREE.Group();group.name='Vasanth partial north passage boundary';
 const thickness=.18,innerX=width/2+passageWidth-thickness,from=-8,to=gateZ-.17,join=-.4;
 const wall=createLakshmiPlaster();wall.name='Vasanth passage boundary plaster';wall.color.setHex(0xb9c0a6);
 const cap=wall.clone();cap.name='Vasanth passage boundary coping';cap.color.setHex(0xc8c9b2);
 const body:THREE.BufferGeometry[]=[],caps:THREE.BufferGeometry[]=[],slots:number[][]=[];
 const parts=[{from,to:join,height:1.5},{from:join,to,height:1.25}];
 for(const part of parts){
  // In wall coordinates, horizontal is the building-local z axis.
  const shape=new THREE.Shape();shape.moveTo(part.from,0);shape.lineTo(part.to,0);shape.lineTo(part.to,part.height);shape.lineTo(part.from,part.height);shape.closePath();
  if(part.from===join)for(let i=0;i<6;i++){
   const z=join+.38+i*.48,hole=new THREE.Path();
   hole.moveTo(z-.07,.82);hole.lineTo(z-.07,1.06);hole.lineTo(z+.07,1.06);hole.lineTo(z+.07,.82);hole.closePath();shape.holes.push(hole);slots.push([innerX,.94,z]);
  }
  const g=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false});g.translate(0,0,-thickness);g.rotateY(-Math.PI/2);g.translate(innerX,0,0);setLakshmiMaterialUV(g);body.push(g);
  const coping=new THREE.BoxGeometry(.24,.08,part.to-part.from);coping.translate(innerX+thickness/2,part.height+.04,(part.from+part.to)/2);setLakshmiMaterialUV(coping);caps.push(coping.toNonIndexed());coping.dispose();
 }
 for(const [geometries,material]of [[body,wall],[caps,cap]] as const){const geometry=mergeGeometries([...geometries],false);if(!geometry)throw new Error('Vasanth passage merge failed');const mesh=new THREE.Mesh(geometry,material);mesh.name=material.name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
 // Include the coping overhang in the same walker's footprint exclusion.
 const barrier:FrontageBarrier={x:innerX+thickness/2,z:(from+to)/2,width:.24,depth:to-from,kind:'north passage boundary'};
 group.userData={kind:'vasanth-passage-boundary-study',revision:1,innerX,thickness,from,to,join,parts,slots,barrier,
  sourceSha256:'fbabbbf4b3f0e46e23293ac30f69dc9151dc72c5c01949d00949ba4efa1aac4d',
  limits:'Gallery photo3 supports a low north-side passage boundary and small vertical openings near its street end.11m extent,1.50/1.25m heights,180mm wall,240mm coping,six140×240mm openings,placement and finish are inferred. Rear termination is the end of this partial study, not an established property corner. No parcel boundary, utility function, private pixels or neighbor identity asserted.'};
 return {group,barrier};
}
