import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLakshmiPlaster,setLakshmiMaterialUV} from './lakshmi-material';

/** Photographs resolve small red rectangles and pale joints on this band.
 * Ceramic facing versus full brick, unit size and joint sections are unverified.
 */
export function buildAvinashRedFacing(sx:number) {
  const x0=-.32*sx,x1=.56*sx,y0=3.1,y1=12.4;
  const pitchX=.22*sx,pitchY=.073,joint=.006,bevel=.0012;
  const faceZ=.032,shoulderZ=.030,backZ=.023,mortarZ=.026;
  const clay=createLakshmiPlaster();clay.name='Avinash red vertical band';clay.color.setHex(0xb46550);clay.normalScale.set(.32,.32);clay.vertexColors=true;
  clay.userData={...clay.userData,finish:'Inferred red mineral/ceramic facing; existing original fine relief prior, not a site scan'};
  const mortar=createLakshmiPlaster();mortar.name='Avinash pale facing joints';mortar.color.setHex(0xb2a495);mortar.normalScale.set(.24,.24);
  const bedding=new THREE.BoxGeometry(x1-x0,y1-y0,.026);bedding.translate((x0+x1)/2,(y0+y1)/2,.013);setLakshmiMaterialUV(bedding);
  const units:THREE.BufferGeometry[]=[],bounds:{x0:number;x1:number;y0:number;y1:number}[]=[];
  for(let row=0;y0+row*pitchY<y1;row++){
    const bottom=y0+row*pitchY+joint/2,top=Math.min(y1,y0+(row+1)*pitchY-joint/2);
    if(top-bottom<.006)continue;
    for(let column=-1;column<6;column++){
      const left=Math.max(x0,x0+(column+(row%2)*.5)*pitchX+joint/2),right=Math.min(x1,x0+(column+1+(row%2)*.5)*pitchX-joint/2);
      if(right-left<.006)continue;
      const positions:number[]=[],indices:number[]=[];
      for(const [z,inset]of [[backZ,0],[shoulderZ,0],[faceZ,bevel]])positions.push(left+inset,bottom+inset,z,right-inset,bottom+inset,z,right-inset,top-inset,z,left+inset,top-inset,z);
      // Closed solid with a shallow bevel, so seams have actual depth and light.
      indices.push(0,2,1,0,3,2,8,9,10,8,10,11);
      for(let ring=0;ring<2;ring++)for(let i=0;i<4;i++){
        const a=ring*4+i,b=ring*4+(i+1)%4,c=(ring+1)*4+(i+1)%4,d=(ring+1)*4+i;indices.push(a,b,c,a,c,d);
      }
      const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));indexed.setIndex(indices);
      const g=indexed.toNonIndexed();indexed.dispose();g.computeVertexNormals();g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));setLakshmiMaterialUV(g);
      const random=Math.sin(row*31.773+column*17.197)*43758.5453,tone=.945+.11*(random-Math.floor(random)),colors=new Float32Array(g.attributes.position.count*3).fill(tone);
      g.setAttribute('color',new THREE.BufferAttribute(colors,3));units.push(g);bounds.push({x0:left,x1:right,y0:bottom,y1:top});
    }
  }
  const facing=mergeGeometries(units,false);units.forEach(g=>g.dispose());if(!facing)throw new Error('Avinash facing merge failed');
  const evidence={revision:1,source:'Avinash alternate corner photograph and 900×600 Prashanth context view show red rectangular surface units with pale horizontal and offset vertical joints',
    sourceHashes:['2d35b04f17f1193820473500dee4be1fefd88a6644cbf13364dafb382bf2d96e','1da40acae2dc148579c94ef423b2bfbf2612ffafa0d79d7d2880d2b29b8de3c8'],
    band:{x0,x1,y0,y1,faceZ,mortarZ,backZ},pitch:[pitchX,pitchY],jointWidth:joint,bevel,units:bounds.length,
    limits:'Visible unit pattern only; brick versus ceramic facing, stagger, metric dimensions, pigment, microrelief and joints inferred. Original band envelope and wall pose retained; no inscription reconstructed.'};
  return {facing,bedding,clay,mortar,bounds,evidence};
}
