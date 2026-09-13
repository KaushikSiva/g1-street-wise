import * as THREE from 'three';

/** Split the donor's broad cluster patches into smaller overlapping leaf sprays.
 * This Central-only morphology is inferred from fine, irregular source silhouettes;
 * it is not a measured species model. Atlas pixels and total nominal leaf area remain.
 */
export function centralAvenueFoliageGeometry(source:THREE.BufferGeometry) {
  const position=source.getAttribute('position'),normal=source.getAttribute('normal'),uv=source.getAttribute('uv');
  const index=source.index;
  // The authored donor consists of disconnected nine-vertex bent patches.
  if(!index||position.count%9||index.count!==position.count/9*24||!normal||!uv)
    throw new Error('Central foliage requires the donor nine-vertex cluster patches');
  const copies=2,patches=position.count/9,result=new THREE.BufferGeometry();
  for(const[name,attribute]of Object.entries(source.attributes)){
    if(name==='tangent')continue;
    const Storage=attribute.array.constructor as {new(length:number):typeof attribute.array};
    const data=new Storage(attribute.count*copies*attribute.itemSize);
    result.setAttribute(name,new THREE.BufferAttribute(data,attribute.itemSize,attribute.normalized));
  }
  const indices=new Uint16Array(index.count*copies);
  const x=new THREE.Vector3(),y=new THREE.Vector3(),z=new THREE.Vector3(),center=new THREE.Vector3(),corner=new THREE.Vector3();
  const local=new THREE.Vector3(),out=new THREE.Vector3(),n=new THREE.Vector3(),rotation=new THREE.Matrix4(),basis=new THREE.Matrix4(),warp=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3();
  const sprays=[[-.20,-.09,-.18,-.10],[.20,.09,.18,.10]];
  for(let patch=0;patch<patches;patch++){
    const first=patch*9;
    x.fromBufferAttribute(position,first+2).sub(corner.fromBufferAttribute(position,first));const width=x.length();x.normalize();
    y.fromBufferAttribute(position,first+6).sub(corner.fromBufferAttribute(position,first));const height=y.length();y.normalize();
    z.crossVectors(x,y).normalize();y.crossVectors(z,x).normalize();
    center.set(0,0,0);for(const i of[0,2,6,8])center.add(corner.fromBufferAttribute(position,first+i));center.multiplyScalar(.25);
    basis.makeBasis(x,y,z);
    const donorTileX=Math.floor(Math.min(uv.getX(first),uv.getX(first+8))*4+.0001),donorTileY=Math.floor(Math.min(uv.getY(first),uv.getY(first+8))*4+.0001);
    for(let spray=0;spray<copies;spray++){
      const [dx,dy,twist,tilt]=sprays[spray],variation=Math.sin(patch*12.9898+spray*4.1414)*.065;
      rotation.makeRotationZ(twist+variation).multiply(new THREE.Matrix4().makeRotationX(tilt));
      warp.copy(basis).multiply(rotation).scale(new THREE.Vector3(.62,.80,.80)).multiply(basis.clone().transpose());
      normalMatrix.getNormalMatrix(warp);
      const destFirst=(patch*copies+spray)*9,tile=(donorTileY*4+donorTileX+spray*7+patch%3*5)%16;
      for(let v=0;v<9;v++){
        const sourceVertex=first+v,destination=destFirst+v;
        for(const[name,attribute]of Object.entries(source.attributes)){
          const dest=result.getAttribute(name);if(!dest)continue;
          for(let k=0;k<attribute.itemSize;k++)dest.setComponent(destination,k,attribute.getComponent(sourceVertex,k));
        }
        local.fromBufferAttribute(position,sourceVertex).sub(center);
        out.copy(local).applyMatrix4(warp).add(center).addScaledVector(x,dx*width).addScaledVector(y,dy*height);
        result.getAttribute('position').setXYZ(destination,out.x,out.y,out.z);
        n.fromBufferAttribute(normal,sourceVertex).applyMatrix3(normalMatrix).normalize();
        result.getAttribute('normal').setXYZ(destination,n.x,n.y,n.z);
        result.getAttribute('uv').setXY(destination,uv.getX(sourceVertex)-donorTileX/4+(tile%4)/4,uv.getY(sourceVertex)-donorTileY/4+Math.floor(tile/4)/4);
      }
      for(let i=0;i<24;i++){
        const original=index.getX(patch*24+i);if(original<first||original>=first+9)throw new Error('Central foliage donor patch topology changed');
        indices[(patch*copies+spray)*24+i]=destFirst+original-first;
      }
    }
  }
  result.setIndex(new THREE.BufferAttribute(indices,1));result.computeBoundingBox();result.computeBoundingSphere();
  result.userData={centralFoliage:{revision:1,donorPatches:patches,sprays:patches*copies,nominalAreaRatio:copies*.62*.80,widthScale:.62,lengthScale:.80,source:'Fine irregular leaf sprays in Prashanth street views; dimensions and arrangement inferred',preserved:'Existing leaf atlas, shading normals transformed with each spray, alpha threshold, donor crown centers'}};
  return result;
}

/** Smaller two-triangle leaflets replace the broad four-triangle blades.
 * Normal maps retain sub-leaf relief; halving these triangles funds the finer sprays.
 */
export function centralAvenueLeafletGeometry(source:THREE.BufferGeometry) {
  const position=source.getAttribute('position'),normal=source.getAttribute('normal'),index=source.index;
  if(!index||position.count%6||index.count!==position.count/6*12||!normal)
    throw new Error('Central leaflets require the donor six-vertex leaf strips');
  const leaves=position.count/6,result=new THREE.BufferGeometry(),vertices=leaves*4;
  for(const[name,attribute]of Object.entries(source.attributes)){
    if(name==='tangent')continue;
    const Storage=attribute.array.constructor as {new(length:number):typeof attribute.array};
    result.setAttribute(name,new THREE.BufferAttribute(new Storage(vertices*attribute.itemSize),attribute.itemSize,attribute.normalized));
  }
  const indices=new Uint16Array(leaves*6),x=new THREE.Vector3(),y=new THREE.Vector3(),z=new THREE.Vector3(),center=new THREE.Vector3(),corner=new THREE.Vector3(),v=new THREE.Vector3(),n=new THREE.Vector3();
  const basis=new THREE.Matrix4(),warp=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3();
  for(let leaf=0;leaf<leaves;leaf++){
    const first=leaf*6;
    x.fromBufferAttribute(position,first+1).sub(corner.fromBufferAttribute(position,first)).normalize();
    y.fromBufferAttribute(position,first+4).sub(corner.fromBufferAttribute(position,first)).normalize();
    z.crossVectors(x,y).normalize();y.crossVectors(z,x).normalize();basis.makeBasis(x,y,z);
    center.set(0,0,0);for(const k of[0,1,4,5])center.add(corner.fromBufferAttribute(position,first+k));center.multiplyScalar(.25);
    {
      const offset=leaf*4;
      warp.copy(basis).scale(new THREE.Vector3(.75,.70,.70)).multiply(basis.clone().transpose());normalMatrix.getNormalMatrix(warp);
      for(const[k,sourceCorner]of[0,1,4,5].entries()){
        const sourceVertex=first+sourceCorner,destination=offset+k;
        for(const[name,attribute]of Object.entries(source.attributes)){
          const dest=result.getAttribute(name);if(!dest)continue;
          for(let j=0;j<attribute.itemSize;j++)dest.setComponent(destination,j,attribute.getComponent(sourceVertex,j));
        }
        v.fromBufferAttribute(position,sourceVertex).sub(center).applyMatrix4(warp).add(center);
        result.getAttribute('position').setXYZ(destination,v.x,v.y,v.z);
        n.fromBufferAttribute(normal,sourceVertex).applyMatrix3(normalMatrix).normalize();result.getAttribute('normal').setXYZ(destination,n.x,n.y,n.z);
      }
      for(const[k,i]of[0,1,2,1,3,2].entries())indices[leaf*6+k]=offset+i;
    }
  }
  result.setIndex(new THREE.BufferAttribute(indices,1));result.computeBoundingBox();result.computeBoundingSphere();
  result.userData={centralLeaflets:{revision:1,donorLeaves:leaves,leaflets:leaves,nominalAreaRatio:.75*.70,widthScale:.75,lengthScale:.70,source:'Fine divided leaf silhouettes in Prashanth street views; morphology and sizes inferred',preserved:'Existing individual leaf atlas, vertex tones, centers and orientations; half the blade triangles'}};
  return result;
}
