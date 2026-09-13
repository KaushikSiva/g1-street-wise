import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {setLakshmiMaterialUV} from './lakshmi-material';

type Rect={x0:number;x1:number;y0:number;y1:number};
export function createLakshmiWindowMaterials() {
  const materials={
    frame:new THREE.MeshStandardMaterial({color:0x435449,roughness:.63,metalness:.32}),
    glass:new THREE.MeshPhysicalMaterial({color:0x45574b,roughness:.32,metalness:0,transmission:.24,thickness:.005,ior:1.52,attenuationColor:0xacc4af,attenuationDistance:1}),
    interior:new THREE.MeshStandardMaterial({color:0x131b16,roughness:.94}),
    gasket:new THREE.MeshStandardMaterial({color:0x202720,roughness:.92}),
    acPaint:new THREE.MeshStandardMaterial({color:0xb9b6a1,roughness:.74,metalness:.15}),
    radiator:new THREE.MeshStandardMaterial({color:0x333b34,roughness:.78,metalness:.45}),
    wire:new THREE.MeshStandardMaterial({color:0x848876,roughness:.57,metalness:.7}),
  };
  for(const [key,material] of Object.entries(materials))material.name=`Lakshmi window ${key}`;
  return materials;
}

/** Cut a mounting opening from planar glazing/frame strips, not just cover it. */
function outside(rect:Rect,hole:Rect|null):Rect[] {
  if(!hole || hole.x1<=rect.x0 || hole.x0>=rect.x1 || hole.y1<=rect.y0 || hole.y0>=rect.y1)return [rect];
  const x0=Math.max(rect.x0,hole.x0),x1=Math.min(rect.x1,hole.x1),y0=Math.max(rect.y0,hole.y0),y1=Math.min(rect.y1,hole.y1);
  return [{...rect,x1:x0},{...rect,x0:x1},{x0,x1,y0:rect.y0,y1:y0},{x0,x1,y0:y1,y1:rect.y1}].filter(r=>r.x1-r.x0>1e-5 && r.y1-r.y0>1e-5);
}

/** Source-visible rear sill, divided casements and window ACs. Profiles/optics remain inferred. */
export function createLakshmiWindow(o:Rect,index:number,depth:number,plaster:THREE.Material,m:ReturnType<typeof createLakshmiWindowMaterials>) {
  const group=new THREE.Group();group.name=`Lakshmi rear window ${index}`;
  const w=o.x1-o.x0,h=o.y1-o.y0,x=(o.x0+o.x1)/2,floor=Math.floor(index/2),right=index%2===1;
  // Ratios from the lower-left rear-frame fit under the conditional photo camera.
  const sill=o.y0+h*.4310052865,lintel=o.y1-h*.0347124388,rearZ=-depth;
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  function add(g:THREE.BufferGeometry,material:THREE.Material){if(!batches.has(material))batches.set(material,[]);batches.get(material)!.push(g);}
  function box(cx:number,cy:number,z:number,width:number,height:number,d:number,material:THREE.Material){
    const g=new THREE.BoxGeometry(width,height,d);g.translate(cx,cy,z);if(material===plaster)setLakshmiMaterialUV(g);add(g,material);
  }
  function strip(r:Rect,z:number,d:number,material:THREE.Material,hole:Rect|null=null){for(const a of outside(r,hole))box((a.x0+a.x1)/2,(a.y0+a.y1)/2,z,a.x1-a.x0,a.y1-a.y0,d,material);}
  function rod(a:THREE.Vector3,b:THREE.Vector3,r:number,material:THREE.Material){const v=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);add(g,material);}
  box(x,(o.y0+sill)/2,rearZ-.055,w,sill-o.y0,.11,plaster);
  box(x,(lintel+o.y1)/2,rearZ-.055,w,o.y1-lintel,.11,plaster);
  box(x,sill-.014,rearZ+.018,w,.028,.11,plaster);
  box(x,(sill+lintel)/2,rearZ-.55,w+.1,lintel-sill+.1,.04,m.interior);
  box(x,lintel+.0125,rearZ-.285,w,.025,.57,m.interior);
  box(x,sill-.0125,rearZ-.285,w,.025,.57,m.interior);
  for(const side of [-1,1])box(x+side*(w/2+.0125),(sill+lintel)/2,rearZ-.285,.025,lintel-sill,.57,m.interior);
  // This is a dark interior backing, not copied shadows or a photographed wall texture.
  const hasAC=floor===0 || (floor===2 && !right),acWidth=w*.43,acHeight=Math.min(.54,(lintel-sill)*.53),acCenter=x+w*(right?.05:.15);
  const cut:Rect|null=hasAC?{x0:acCenter-acWidth/2-.012,x1:acCenter+acWidth/2+.012,y0:sill+.016,y1:sill+.016+acHeight+.024}:null;
  const perimeter=.038,frameZ=rearZ+.025;
  for(const r of [{x0:o.x0,x1:o.x0+perimeter,y0:sill,y1:lintel},{x0:o.x1-perimeter,x1:o.x1,y0:sill,y1:lintel},{x0:o.x0,x1:o.x1,y0:sill,y1:sill+perimeter},{x0:o.x0,x1:o.x1,y0:lintel-perimeter,y1:lintel}])strip(r,frameZ,.055,m.frame,cut);
  const leafWidth=(w-perimeter*2)/3,leafHeight=lintel-sill-perimeter*2,leafBottom=sill+perimeter;
  const openings:number[]=floor===0 && right?[58,0,-58]:floor===1 && !right?[54,0,0]:floor===2 && right?[0,0,-48]:[0,0,0];
  const leaves=[];
  for(let leaf=0;leaf<3;leaf++){
    const left=o.x0+perimeter+leafWidth*leaf,edge=left+leafWidth,angle=openings[leaf];
    if(leaf>0)strip({x0:left-.014,x1:left+.014,y0:sill,y1:lintel},frameZ,.06,m.frame,cut);
    // Open leaves rotate about their real vertical hinge; closed glazing is cut around the AC.
    const hingeRight=angle<0,hingeX=hingeRight?edge:left,assembly=new THREE.Group();assembly.name=`Casement ${index}/${leaf}`;assembly.position.set(hingeX,leafBottom,frameZ+.04);assembly.rotation.y=-THREE.MathUtils.degToRad(angle);
    const sashBatches=new Map<THREE.Material,THREE.BufferGeometry[]>();
    function sash(r:Rect,z:number,d:number,material:THREE.Material){
      const hole=angle===0 && cut?{x0:cut.x0-hingeX,x1:cut.x1-hingeX,y0:cut.y0-leafBottom,y1:cut.y1-leafBottom}:null;
      for(const a of outside(r,hole)){const g=new THREE.BoxGeometry(a.x1-a.x0,a.y1-a.y0,d);g.translate((a.x0+a.x1)/2,(a.y0+a.y1)/2,z);if(!sashBatches.has(material))sashBatches.set(material,[]);sashBatches.get(material)!.push(g);}
    }
    const lx=hingeRight?-leafWidth:0,rx=lx+leafWidth,profile=.028,transom=leafHeight*.49;
    for(const r of [{x0:lx,x1:lx+profile,y0:0,y1:leafHeight},{x0:rx-profile,x1:rx,y0:0,y1:leafHeight},{x0:lx,x1:rx,y0:0,y1:profile},{x0:lx,x1:rx,y0:leafHeight-profile,y1:leafHeight},{x0:lx,x1:rx,y0:transom-.013,y1:transom+.013}])sash(r,0,.034,m.frame);
    for(const [bottom,top] of [[profile,transom-.013],[transom+.013,leafHeight-profile]]){
      for(const r of [{x0:lx+profile,x1:lx+profile+.01,y0:bottom,y1:top},{x0:rx-profile-.01,x1:rx-profile,y0:bottom,y1:top},{x0:lx+profile,x1:rx-profile,y0:bottom,y1:bottom+.01},{x0:lx+profile,x1:rx-profile,y0:top-.01,y1:top}])sash(r,-.01,.009,m.gasket);
      // Smaller panes overlap only the gasket margin, avoiding coplanar glass/frame faces.
      sash({x0:lx+profile+.008,x1:rx-profile-.008,y0:bottom+.008,y1:top-.008},-.003,.005,m.glass);
    }
    for(const yy of [leafHeight*.18,leafHeight*.8]){
      if(angle===0 && cut && hingeX+.012>cut.x0 && hingeX-.012<cut.x1 && leafBottom+yy+.0325>cut.y0 && leafBottom+yy-.0325<cut.y1)continue;
      const g=new THREE.CylinderGeometry(.012,.012,.065,8);g.translate(0,yy,.013);if(!sashBatches.has(m.frame))sashBatches.set(m.frame,[]);sashBatches.get(m.frame)!.push(g);
    }
    for(const [material,list] of sashBatches){const g=mergeGeometries(list,false)!;list.forEach(g=>g.dispose());const mesh=new THREE.Mesh(g,material);mesh.name=material===m.glass?'Frosted glazing':'Casement profiles';mesh.castShadow=material!==m.glass;mesh.receiveShadow=true;assembly.add(mesh);}
    group.add(assembly);leaves.push({hingeX,angleDegrees:angle,width:leafWidth,height:leafHeight});
  }
  if(cut){
    const acBottom=cut.y0+.012,acTop=acBottom+acHeight,acRear=rearZ-.12,acFront=rearZ+.48,panel=.018;
    // Open-front housing, inset radiator and wire guard; no solid face behind painted stripes.
    box(acCenter,acBottom+panel/2,(acRear+acFront)/2,acWidth,panel,acFront-acRear,m.acPaint);
    box(acCenter,acTop-panel/2,(acRear+acFront)/2,acWidth,panel,acFront-acRear,m.acPaint);
    for(const side of [-1,1])box(acCenter+side*(acWidth-panel)/2,(acTop+acBottom)/2,(acRear+acFront)/2,panel,acHeight,acFront-acRear,m.acPaint);
    box(acCenter,(acTop+acBottom)/2,acFront-.065,acWidth-.04,acHeight-.04,.014,m.radiator);
    const grille={x0:acCenter-acWidth/2+.035,x1:acCenter+acWidth/2-.035,y0:acBottom+.035,y1:acTop-.035};
    for(const yy of [grille.y0-.01,grille.y1+.01])box(acCenter,yy,acFront,acWidth-.04,.02,.035,m.acPaint);
    for(const xx of [grille.x0-.01,grille.x1+.01])box(xx,(grille.y0+grille.y1)/2,acFront,.02,grille.y1-grille.y0,.035,m.acPaint);
    for(let j=0;j<=18;j++){const xx=THREE.MathUtils.lerp(grille.x0,grille.x1,j/18);rod(new THREE.Vector3(xx,grille.y0,acFront+.006),new THREE.Vector3(xx,grille.y1,acFront+.006),.0016,m.wire);}
    for(let j=0;j<=11;j++){const yy=THREE.MathUtils.lerp(grille.y0,grille.y1,j/11);rod(new THREE.Vector3(grille.x0,yy,acFront+.009),new THREE.Vector3(grille.x1,yy,acFront+.009),.0016,m.wire);}
    for(const dx of [-.3,.3]){const xx=acCenter+acWidth*dx;rod(new THREE.Vector3(xx,acBottom-.04,rearZ),new THREE.Vector3(xx,acBottom-.04,acFront+.025),.012,m.frame);rod(new THREE.Vector3(xx,sill-.22,rearZ+.01),new THREE.Vector3(xx,acBottom-.04,acFront),.012,m.frame);}
    const drainX=acCenter+acWidth*.4;rod(new THREE.Vector3(drainX,acBottom,acFront-.06),new THREE.Vector3(drainX+.04,o.y0+.02,acFront-.08),.009,m.acPaint);
  }
  for(const [material,list] of batches){const g=mergeGeometries(list,false)!;list.forEach(g=>g.dispose());const mesh=new THREE.Mesh(g,material);mesh.name=material===plaster?'Rear sill and lintel':material===m.wire?'AC wire guard':'Window fittings';mesh.castShadow=material!==m.wire;mesh.receiveShadow=true;group.add(mesh);}
  group.userData={index,sill,lintel,rearZ,leaves,acCutout:cut,source:'Source-visible rear plaster below glazing, divided green casements and three window ACs',limits:'Ratios conditional on manual source fit. Absolute dimensions, leaf angles, profiles, AC housing and optical values inferred.'};return group;
}
