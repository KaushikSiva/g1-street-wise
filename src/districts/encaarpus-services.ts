import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Small visible cable runs beside the central piers; routing is a visual hypothesis. */
export function buildEncaarpusServices(width:number){
 const group=new THREE.Group();group.name='Encaarpus source-visible loose facade cables';
 const material=new THREE.MeshStandardMaterial({color:0x545346,roughness:.86,metalness:.03});
 const sx=width/14;
 // These local runs stay on the frontage; no invented connection across the road.
 const runs=[
  [[-2.27,15.75,.075],[-2.25,14.28,.070],[-2.19,12.92,.075],[-2.18,12.46,.065],[-2.05,12.10,.085],[-1.73,11.95,.09]],
  [[-1.73,11.95,.09],[-1.70,11.78,.11],[-1.91,11.74,.12],[-2.03,11.90,.11],[-1.99,12.11,.10],[-1.76,12.14,.095],[-1.62,11.97,.09],[-1.69,11.79,.09],[-1.88,11.71,.10]],
  [[2.30,13.04,.073],[2.36,12.40,.09],[2.26,11.70,.09],[2.38,10.85,.08],[2.35,10.30,.10],[2.17,10.03,.09],[2.13,9.88,.085],[2.24,9.79,.085],[2.31,9.92,.078],[2.24,10.17,.07]],
 ];
 const geometries=runs.map(points=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0]*sx,p[1],p[2]))),Math.max(28,points.length*8),.006,5,false));
 const geometry=mergeGeometries(geometries,false);if(!geometry)throw new Error('Encaarpus cable geometry merge failed');
 const mesh=new THREE.Mesh(geometry,material);mesh.name='Encaarpus loose cable geometry';mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());
 group.userData={sourceSha256:'0b02fddb8fcfeeb9b8552d5e12927ffea82ff016f3cf67bb972e8c735dd4bb99',observed:'Loose slender runs beside both upper central grey piers and a small coil on the left beside the curved balcony.',runs,diameterMeters:.012,limits:'Partial source-visible cable study. Metric routing, diameter, material and slack curves are inferred. No electrical connectivity, current installation, road-spanning wire, brand or surveyed dimension is asserted. Separate geometry preserves existing facade and AO receiver meshes.'};
 return group;
}
