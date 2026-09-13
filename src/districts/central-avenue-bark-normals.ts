import * as THREE from 'three';

type Incident={normal:THREE.Vector3;angle:number};
type Seam={vertices:number[];sum:THREE.Vector3;incident:Incident[]};

/** Repair shading on the Central-only deformed bark, keeping triangle geometry.
 * Attribute seams must not become lighting seams. Angle weighting also prevents
 * long tube triangles from overwhelming short triangles at tapered junctions.
 */
export function repairCentralAvenueBarkNormals(geometry:THREE.BufferGeometry) {
  const position=geometry.getAttribute('position'),index=geometry.index;
  if(!index)throw new Error('Central bark normal repair requires indexed triangles');
  const seams=new Map<string,Seam>(),vertexSeam:Seam[]=[];
  for(let i=0;i<position.count;i++){
    const key=[position.getX(i),position.getY(i),position.getZ(i)].join(',');
    let seam=seams.get(key);
    if(!seam){seam={vertices:[],sum:new THREE.Vector3(),incident:[]};seams.set(key,seam);}
    seam.vertices.push(i);vertexSeam[i]=seam;
  }
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const faceNormals:THREE.Vector3[]=[];
  for(let i=0;i<index.count;i+=3){
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    a.fromBufferAttribute(position,ids[0]);b.fromBufferAttribute(position,ids[1]);c.fromBufferAttribute(position,ids[2]);
    const normal=new THREE.Vector3().crossVectors(b.sub(a),c.sub(a));
    if(normal.lengthSq()===0)throw new Error('Degenerate Central bark triangle');
    normal.normalize();faceNormals.push(normal);
    for(let k=0;k<3;k++){
      a.fromBufferAttribute(position,ids[k]);
      b.fromBufferAttribute(position,ids[(k+1)%3]).sub(a).normalize();
      c.fromBufferAttribute(position,ids[(k+2)%3]).sub(a).normalize();
      const angle=Math.acos(THREE.MathUtils.clamp(b.dot(c),-1,1)),seam=vertexSeam[ids[k]];
      seam.sum.addScaledVector(normal,angle);seam.incident.push({normal,angle});
    }
  }
  for(const seam of seams.values())seam.sum.normalize();
  const normals=new Float32Array(position.count*3);
  for(let i=0;i<position.count;i++)vertexSeam[i].sum.toArray(normals,i*3);
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));

  // A tiny folded donor twig has mutually opposed incident faces. Sharing one
  // smooth normal there is impossible; split only its backward-facing corners,
  // averaging the faces on that side of the fold. Ordinary tubes stay smooth.
  const splits:{source:number;normal:THREE.Vector3;corner:number}[]=[],indices=Array.from(index.array);
  for(let triangle=0;triangle<faceNormals.length;triangle++){
    const face=faceNormals[triangle];
    for(let k=0;k<3;k++){
      const corner=triangle*3+k,source=index.getX(corner),seam=vertexSeam[source];
      if(face.dot(seam.sum)>=1e-5)continue;
      const normal=new THREE.Vector3();
      for(const incident of seam.incident)if(incident.normal.dot(face)>.15)normal.addScaledVector(incident.normal,incident.angle);
      normal.normalize();
      indices[corner]=position.count+splits.length;splits.push({source,normal,corner});
    }
  }
  if(splits.length){
    for(const[name,attribute]of Object.entries(geometry.attributes)){
      if(name==='tangent')continue;
      const Storage=attribute.array.constructor as {new(length:number):typeof attribute.array};
      const data=new Storage((position.count+splits.length)*attribute.itemSize);data.set(attribute.array);
      const extended=new THREE.BufferAttribute(data,attribute.itemSize,attribute.normalized);
      splits.forEach((split,i)=>{
        for(let k=0;k<attribute.itemSize;k++)extended.setComponent(position.count+i,k,name==='normal'?split.normal.getComponent(k):attribute.getComponent(split.source,k));
      });
      geometry.setAttribute(name,extended);
    }
    geometry.setIndex(indices);
  }
  // A changed normal basis invalidates any authored tangents; Three derives it
  // from the preserved UVs. The current donor does not contain tangent data.
  geometry.deleteAttribute('tangent');
  geometry.userData.centralBarkNormals={revision:1,method:'Angle-weighted normals shared across exact coincident UV-seam positions; local normal splits only at folded donor corners',coincidentSeamGroups:[...seams.values()].filter(s=>s.vertices.length>1).length,normalSplits:splits.map(s=>({sourceVertex:s.source,triangleCorner:s.corner})),unchanged:'Every triangle position, UV and material; trunk dimensions, crown attachment geometry and planting matrices'};
}
