import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLakshmiPlaster} from './lakshmi-material';

// These are existing OSM shells, not newly asserted buildings. No exterior photo
// establishes their fenestration: every added finish is explicitly illustrative.
const NEIGHBORS = [
  354839696, 354840154, 355940211, 354759778, 364160225,
  354839712, 354839933, 355940230, 354759816,
] as const;
const ORIGIN = {lon:80.2306892, lat:13.0516624};
const EAST = 111320*Math.cos(ORIGIN.lat*Math.PI/180);
type Way = {id:number;tags?:Record<string,string>;geometry?:{lon:number;lat:number}[]};

/** Finish the existing generic bays without changing a footprint, height or opening. */
export function buildCentralAvenueNeighbors(data:{elements:Way[]}) {
  const group=new THREE.Group();
  group.name='Central Avenue neighbors · inferred architectural finishing';
  const frame=new THREE.MeshStandardMaterial({color:0xaeb5ac,roughness:.57,metalness:.18});
  const trim=new THREE.MeshStandardMaterial({color:0xc6c1ae,roughness:.9});
  const steel=new THREE.MeshStandardMaterial({color:0x4d5751,roughness:.67,metalness:.3});
  const sill=new THREE.MeshStandardMaterial({color:0x8f9388,roughness:.95});
  const door=new THREE.MeshStandardMaterial({color:0x59665c,roughness:.81});
  // A quiet inferred palette for unreferenced properties. Fine millimetre-scale
  // plaster replaces the appearance of the inherited coarse massing texture.
  const plasterBase=createLakshmiPlaster();
  const plasters=[0xc8c4b3,0xc6bca7,0xb8c1b3].map((color,i)=>{
    const material=plasterBase.clone();material.color.setHex(color);
    material.name=`Neighbor inferred mineral plaster ${i+1}`;
    material.userData={...plasterBase.userData,inferred:true,colorEvidence:'Original contextual palette; no photographed paint color asserted'};
    return material;
  });
  plasterBase.dispose();
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  const records:{wayId:number;height:number;windows:number;entries:number}[]=[];
  const road=data.elements.find(e=>e.id===214356669)?.geometry;
  const project=(p:{lon:number;lat:number})=>new THREE.Vector2((p.lon-ORIGIN.lon)*EAST,(ORIGIN.lat-p.lat)*111320);
  const roadStart=road?.length===2?project(road[0]):null;
  const roadDirection=roadStart&&road?project(road[1]).sub(roadStart).normalize():null;
  for(const id of NEIGHBORS){
    const way=data.elements.find(e=>e.id===id && e.geometry);
    if(!way?.geometry || way.tags?.building!=='yes')continue;
    // Keep this study within its audited generic-height source. A real height
    // tag needs review rather than silently moving details onto another story.
    if(way.tags.height || way.tags['building:levels'])continue;
    const points=way.geometry.slice(0,-1).map(p=>new THREE.Vector2((p.lon-ORIGIN.lon)*EAST,(ORIGIN.lat-p.lat)*111320));
    const signed=points.reduce((sum,p,i)=>sum+p.x*points[(i+1)%points.length].y-p.y*points[(i+1)%points.length].x,0);
    const initialRandom=((Math.imul(id,1664525)+1013904223)>>>0)/4294967296;
    const floors=2+(initialRandom>.68?1:0),height=floors*3.1+.35,story=height/floors;
    const frontEdge=points.map((a,i)=>{
      const b=points[(i+1)%points.length],mid=a.clone().add(b).multiplyScalar(.5).sub(roadStart??new THREE.Vector2());
      return {i,d:roadDirection?Math.abs(mid.x*roadDirection.y-mid.y*roadDirection.x):Infinity};
    }).sort((a,b)=>a.d-b.d)[0].i;
    let windows=0,entries=0;
    const plaster=plasters[id%plasters.length];
    for(let edge=0;edge<points.length;edge++){
      const a=points[edge],b=points[(edge+1)%points.length],delta=b.clone().sub(a),length=delta.length();
      if(length<3)continue;
      const direction=delta.clone().normalize(),out=new THREE.Vector2(direction.y,-direction.x).multiplyScalar(signed>0?1:-1);
      const yaw=-Math.atan2(delta.y,delta.x);
      // Thin finish follows the retained mapped shell, behind the inherited
      // glazing, bands and plinth. Four millimetres avoids coplanar flicker.
      const coat=new THREE.PlaneGeometry(length,height).toNonIndexed();
      const coatUV=coat.getAttribute('uv');
      for(let i=0;i<coatUV.count;i++)coatUV.setXY(i,coatUV.getX(i)*length,coatUV.getY(i)*height);
      coat.rotateY(Math.atan2(out.x,out.y));coat.translate((a.x+b.x)/2+out.x*.004,height/2,(a.y+b.y)/2+out.y*.004);
      if(!batches.has(plaster))batches.set(plaster,[]);batches.get(plaster)!.push(coat);
      const box=(x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material)=>{
        const geometry=new THREE.BoxGeometry(w,h,d).toNonIndexed();
        geometry.rotateY(yaw);geometry.translate(a.x+direction.x*x+out.x*z,y,a.y+direction.y*x+out.y*z);
        geometry.clearGroups();if(!batches.has(material))batches.set(material,[]);batches.get(material)!.push(geometry);
      };
      const bays=Math.min(16,Math.floor(length/3.3));
      const width=Math.min(1.42,length/(bays+1)*.57),wh=Math.min(1.42,story*.46);
      for(let floor=0;floor<floors;floor++)for(let bay=0;bay<bays;bay++){
        const x=length*(bay+1)/(bays+1),y=floor*story+1.65;
        // Existing glazing stays visible between open frame members. The frames
        // add actual depth/shadows; no pasted photo or fake room is introduced.
        for(const xx of [x-width/2,x+width/2])box(xx,y,.115,.055,wh+.08,.095,frame);
        for(const yy of [y-wh/2,y+wh/2])box(x,yy,.115,width,.055,.095,frame);
        box(x,y,.129,.042,wh,.074,frame);
        box(x,y+.22,.13,width,.035,.072,frame);
        box(x,y-wh/2-.072,.21,width+.24,.12,.44,sill);
        // Small drip edge beneath the existing roofed sunshade, connected to
        // its underside. It keeps the inherited silhouette and hood extent.
        box(x,y+wh/2+.112,.535,width+.32,.025,.035,trim);
        if(floor===0){
          for(const fraction of [-.3,0,.3])box(x+width*fraction,y,.22,.018,wh+.02,.026,steel);
          for(const yy of [y-.35,y+.35])box(x,yy,.22,width,.019,.026,steel);
        }
        windows++;
      }
      // One entry between the first two existing bays, only on the long front
      // elevation. The closed leaf sits against the retained shell, not a false
      // walk-through opening. All dimensions are inferred.
      if(edge===frontEdge && length>10 && bays>=3){
        const x=length*1.5/(bays+1),w=Math.min(1.0,length/(bays+1)-width-.22);
        if(w>.72){
          box(x,1.11,.075,w,2.1,.075,door);
          for(const xx of [x-w/2-.04,x+w/2+.04])box(xx,1.13,.13,.08,2.22,.19,trim);
          box(x,2.24,.13,w+.16,.10,.19,trim);
          box(x,.06,.37,w+.35,.12,.76,sill);
          for(let i=0;i<7;i++)box(x, .36+i*.24,.119,w-.11,.018,.012,steel);
          box(x+w*.32,1.12,.15,.025,.23,.04,frame);
          entries++;
        }
      }
    }
    records.push({wayId:id,height,windows,entries});
  }
  for(const [material,geometries]of batches){
    const merged=mergeGeometries(geometries,false);if(!merged)throw new Error('Neighbor facade geometry could not merge');
    const mesh=new THREE.Mesh(merged,material);mesh.name='Inferred neighboring facade '+material.uuid.slice(0,8);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
    geometries.forEach(g=>g.dispose());
  }
  group.userData={revision:3,records,paintFinish:{palette:'Three muted mineral colors, inferred',texture:'Original fine plaster field shared with existing district materials',shellOffsetMeters:.004},source:'Existing OpenStreetMap footprints and already inferred generic window grid',inferred:true,
    limits:'Original architectural finishing study; no facade photographs, surveyed heights, tenancy or real opening positions asserted. Existing shells, heights, glazing and map source unchanged. Unmapped buildings remain unresolved.'};
  return group;
}
