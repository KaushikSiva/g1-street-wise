import * as THREE from 'three';
import {centralAvenueLeafMaterial} from './central-avenue-leaf-material';
import {repairCentralAvenueBarkNormals} from './central-avenue-bark-normals';
import {centralAvenueFoliageGeometry,centralAvenueLeafletGeometry} from './central-avenue-foliage-geometry';

type AvenueFrame = {length:number;point:(station:number,lateral:number,y?:number)=>THREE.Vector3};
type Planting = [station:number,lateral:number,width:number,height:number,depth:number];

// Broad overlapping crowns are visible around Prashanth/Avinash in panorama
// Vu0xhoBfuQb7XsmcWslizA. These planting points and metric scales are hypotheses.
// The s=65 eastern tree continues the earlier Encaarpus occlusion study.
const planting:Planting[] = [
  [12,4.35,.88,.79,.86],
  [39,-4.35,.98,.85,.96],
  [62,4.40,1.06,.86,1.04],
  [65,4.35,1.10,.89,1.04],
  [72,-4.45,1.07,.92,1.08],
  [83,4.35,1.03,.85,1.10],
  [94,-4.40,1.08,.90,1.04],
  [105,4.45,1.10,.94,1.06],
  [116,-4.35,1.04,.86,1.09],
  [127,4.40,1.06,.90,1.02],
  [138,-4.40,1.00,.85,1.04],
  [149,4.35,1.05,.88,1.02],
  [161,-4.35,.98,.84,.97],
  [181,4.35,.94,.82,.96],
  [201,4.35,.89,.80,.91],
];

/** Original project broadleaf geometry reused only within Central Avenue. */
export function buildCentralAvenueCanopy(model:THREE.Group,frame:AvenueFrame) {
  const group=new THREE.Group();group.name='Central Avenue canopy · inferred planting and species';
  model.updateMatrixWorld(true);
  const sourceMeshes:THREE.Mesh[]=[];
  model.traverse(o=>{if(o instanceof THREE.Mesh)sourceMeshes.push(o);});
  const sources=sourceMeshes.map(source=>{
    const isTrunk=source.name.toLowerCase().includes('trunk');
    const material=isTrunk?source.material:Array.isArray(source.material)?source.material.map(m=>centralAvenueLeafMaterial(m)):centralAvenueLeafMaterial(source.material);
    if(!isTrunk){
      const geometry=source.name.includes('cluster')?centralAvenueFoliageGeometry(source.geometry):centralAvenueLeafletGeometry(source.geometry);
      return {source,material,geometry,transform:source.matrixWorld.clone(),isTrunk};
    }
    // The source views show slender stems beneath broad crowns. Deform a
    // Central-only bark copy in donor Y-up coordinates, leaving its UVs and
    // the upper crown/leaf attachment region untouched. One continuous warp
    // keeps coincident branch junctions coincident.
    const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);
    const position=geometry.attributes.position;
    for(let i=0;i<position.count;i++){
      const y=position.getY(i),t=THREE.MathUtils.clamp((y-2.5)/3,0,1);
      const radial=.55+.45*t*t*(3-2*t);
      position.setXYZ(i,position.getX(i)*radial,y,position.getZ(i)*radial);
    }
    position.needsUpdate=true;repairCentralAvenueBarkNormals(geometry);geometry.computeBoundingBox();geometry.computeBoundingSphere();
    return {source,material,geometry,transform:new THREE.Matrix4(),isTrunk};
  });
  const placements=planting.filter(p=>p[0]<frame.length).map(([s,n,x,y,z])=>({
    stationMeters:s,lateralMeters:n,scale:[x,y,z] as [number,number,number],rotationY:s*.31,
  }));
  const quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),matrix=new THREE.Matrix4();
  let triangles=0,drawObjects=0;
  // Three street sections preserve useful frustum culling while sharing the
  // donor geometry and textures. A whole-road batch would draw every tree.
  for(const [lo,hi] of [[0,76],[76,146],[146,Infinity]]) {
    const section=placements.filter(p=>p.stationMeters>=lo&&p.stationMeters<hi);
    if(!section.length)continue;
    const batch=new THREE.Group();batch.name=`Central Avenue crowns from station ${lo}`;
    for(const {source,material,geometry,transform,isTrunk} of sources) {
      const mesh=new THREE.InstancedMesh(geometry,material,section.length);
      mesh.name=source.name;mesh.castShadow=mesh.receiveShadow=true;
      section.forEach((p,i)=>{
        quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,p.rotationY);
        scale.fromArray(p.scale);
        matrix.compose(frame.point(p.stationMeters,p.lateralMeters),quaternion,scale).multiply(transform);
        mesh.setMatrixAt(i,matrix);
      });
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
      mesh.userData={plantings:section,originalGeometry:source.name,adaptedLowerTrunk:isTrunk};batch.add(mesh);
      triangles+=(geometry.index?.count||geometry.attributes.position.count)/3*section.length;
      drawObjects++;
    }
    group.add(batch);
  }
  group.userData={
    revision:5,placements,treeCount:placements.length,triangles,drawObjects,
    asset:'/assets/station-broadleaf.glb',assetAttribution:'/assets/station-broadleaf.attribution.json',
    observed:'Broad crowns overlap above the street around Prashanth and Avinash; exposed branching and gaps remain visible beneath the foliage.',
    source:{panorama:'Vu0xhoBfuQb7XsmcWslizA',views:['900×600 street-context thumbnail','Prashanth east-facing entrance view','Prashanth upper frontage view','Closer Prashanth entrance view, trunk left of the name and a second farther north'],captureDate:'Unknown'},
    inferred:'Tree count, planting stations, side offsets, crown dimensions, branch architecture and species. Existing original broadleaf asset is a morphology proxy, not an identified local tree species.',
    rendering:'Three spatial sections; instanced Central-only finer foliage geometry with thin-leaf material copies. No new image assets or source photograph pixels.',
    foliageOptics:{pigment:'Restored original CC0 donor color before its station-specific gray tint',transmission:'Bounded opposite-side diffuse response; inferred transmission/reflection ratio .6',unchanged:'Alpha cutout, normal textures, roughness, specular response and global daylight'},
    foliageMorphology:{spraysPerDonorPatch:2,sprayWidthScale:.62,sprayLengthScale:.80,leafWidthScale:.75,leafLengthScale:.70,leafTriangles:2,source:'Fine irregular foliage in Prashanth entrance views; dimensions and arrangement inferred',geometry:'Central-only copies; original donor retained. Smaller normal-mapped leaf quads fund two smaller bent sprays per original patch; centers and broad crown envelope retained'},
    trunkAdaptation:{radialFactor:.55,fullStrengthBelowDonorMeters:2.5,unchangedAboveDonorMeters:5.5,blend:'Smooth cubic interpolation; donor heights then receive each planting height scale',source:'Slender exposed stems below broad crowns in the Prashanth entrance views',geometry:'Central-only bark copy; Triangle geometry and UVs preserved; angle-weighted normals welded across attribute seams with local splits at folded twig corners; derivative tangent frame used; original station asset and upper branch geometry unchanged',dimensions:'Radial ratio and transition heights inferred, not measured trunk diameters'},
    limits:'A canopy composition study, not a tree survey or calibrated camera match. Foreground crown overlap is source-supported; exact planting rhythm farther along the street is inferred. No photorealism pass.',
  };
  return group;
}
