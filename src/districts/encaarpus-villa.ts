import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLakshmiPlaster,setLakshmiMaterialUV} from './lakshmi-material';
import outlines from './encaarpus-lettering.json';
import {buildEncaarpusPaving} from './encaarpus-entry';
import {buildEncaarpusServices} from './encaarpus-services';

export const ENCAARPUS_WAY_ID=354839754;
// Four residential rows over open parking are visible. Metre heights are priors.
export const ENCAARPUS_HEIGHT=15.52;
export const ENCAARPUS_HEIGHT_SOURCE='Photo: four residential levels over stilt parking; inferred 3.1 m floor pitch and 3.12 m parking slab datum';
type Point={x:number;z:number};

/** Conditional map association, original geometry from the January 2024 photograph.
 * No photograph, captured lighting, or marketing rendering is used as a texture.
 */
export function buildEncaarpusVilla(points:Point[]) {
  const a=new THREE.Vector3(points[3].x,0,points[3].z),b=new THREE.Vector3(points[0].x,0,points[0].z);
  const width=a.distanceTo(b),along=b.clone().sub(a).normalize(),outward=new THREE.Vector3(along.z,0,-along.x);
  if(points.length!==4 || width<13 || width>15)throw new Error('Encaarpus candidate footprint requires review');
  const group=new THREE.Group();group.name='Encaarpus Villa · conditional photo-informed reconstruction';
  group.position.copy(a).lerp(b,.5);group.rotation.y=Math.atan2(outward.x,outward.z);
  // With local +Z facing outward, local +X is opposite the source edge direction.
  const toLocal=(p:Point)=>{const d=new THREE.Vector3(p.x,0,p.z).sub(group.position);return new THREE.Vector2(-d.dot(along),d.dot(outward));};
  const polygon=points.map(toLocal),sx=width/14;
  const base=createLakshmiPlaster();
  function paint(name:string,color:number){const m=base.clone();m.color.setHex(color);m.name='Encaarpus '+name;m.userData={...base.userData,colorEvidence:'January 2024 photo, uncalibrated pigment approximation'};return m;}
  const cream=paint('cream plaster',0xd2cfc0),grey=paint('grey piers',0x817a80),yellow=paint('ochre flank plaster',0xc4a24e),coral=paint('coral panels',0xb36752);
  const cement=paint('parking concrete',0x8d8c81);
  base.dispose();
  const frame=new THREE.MeshStandardMaterial({color:0xbab18c,roughness:.63,metalness:.15});frame.name='Encaarpus cream casements';
  const iron=new THREE.MeshStandardMaterial({color:0x333733,roughness:.62,metalness:.45});iron.name='Encaarpus dark painted steel';
  const gold=new THREE.MeshStandardMaterial({color:0xa89560,roughness:.48,metalness:.65});gold.name='Encaarpus gate and grille ornament';
  const interior=new THREE.MeshStandardMaterial({color:0x33372e,roughness:.97});interior.name='Encaarpus unobserved room interior';
  const glass=new THREE.MeshPhysicalMaterial({color:0x546054,roughness:.28,metalness:0,transmission:.18,thickness:.004,ior:1.5});glass.name='Encaarpus window glass';
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>(),semantic:Record<string,number>={};
  function add(g:THREE.BufferGeometry,m:THREE.Material,kind='detail'){
    if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}
    g.clearGroups();if([cream,grey,yellow,coral,cement].includes(m as THREE.MeshStandardMaterial))setLakshmiMaterialUV(g);
    if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(g);semantic[kind]=(semantic[kind]||0)+1;
  }
  // X coordinates describe proportions of the 14.05 m mapped front, not a survey.
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material=cream,kind='masonry'){
    const g=new THREE.BoxGeometry(w*sx,h,d);g.translate(x*sx,y,z);add(g,m,kind);
  }
  function rod(a:number[],b:number[],radius:number,m:THREE.Material=iron,kind='metalwork'){
    const p=new THREE.Vector3(a[0]*sx,a[1],a[2]),q=new THREE.Vector3(b[0]*sx,b[1],b[2]),delta=q.clone().sub(p);
    const g=new THREE.CylinderGeometry(radius,radius,delta.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());add(g,m,kind);
  }
  function panel(coords:number[][],frontZ:number,depth:number,m:THREE.Material,kind='masonry'){
    const shape=new THREE.Shape(coords.map(p=>new THREE.Vector2(p[0]*sx,p[1]))),g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});g.translate(0,0,frontZ-depth);add(g,m,kind);
  }
  function ring(x:number,y:number,z:number,r:number,m:THREE.Material=gold){const g=new THREE.TorusGeometry(r,.011,5,16);g.translate(x*sx,y,z);add(g,m,'ornament');}
  function slab(y:number){const shape=new THREE.Shape(polygon.map(p=>new THREE.Vector2(p.x,-p.y)));const g=new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y-.22,0);add(g,cement,'mapped floor slab');}
  slab(3.12);slab(ENCAARPUS_HEIGHT);
  // Plain side/rear closures follow the stored map exactly. Their fenestration is unknown.
  for(let i=0;i<3;i++){
    const p=polygon[i],q=polygon[i+1],d=q.clone().sub(p),length=d.length();
    const g=new THREE.BoxGeometry(length,ENCAARPUS_HEIGHT-3.12,.20);g.rotateY(-Math.atan2(d.y,d.x));g.translate((p.x+q.x)/2,(ENCAARPUS_HEIGHT+3.12)/2,(p.y+q.y)/2);add(g,cream,'unobserved side wall');
    const parapet=new THREE.BoxGeometry(length,.66,.23);parapet.rotateY(-Math.atan2(d.y,d.x));parapet.translate((p.x+q.x)/2,ENCAARPUS_HEIGHT+.33,(p.y+q.y)/2);add(parapet,cream,'unobserved side parapet');
  }
  // Ground parking: separated supports and a recessed back wall leave actual open bays.
  for(const x of [-5.95,-2.5,2.5,5.95])for(const z of [-.35,-5.7])box(x,1.45,z,.34,2.9,.40,cream,'parking column');
  box(0,1.4,-8.5,13.6,2.8,.20,cement,'parking back wall');
  box(0,.005,-5.3,14,.10,8.8,cement,'parking floor');
  box(0,.003,1.35,14,.096,4.5,cement,'entrance joint bed');
  const paving=buildEncaarpusPaving(width);group.add(paving);
  box(0,2.96,-.05,14,.29,.72,grey,'parking lintel');
  for(const y of [3.14,3.21])box(0,y,.03,14.08,.055,.83,cream,'slab moulding');
  // Side bands and window stacks. Heights/layout vary by photographed floor.
  const floors=[3.12,6.22,9.32,12.42],windowChecks:{x:number;y:number;z:number;floor:number}[]=[];
  function room(x:number,y0:number,y1:number,w:number,rear:number){
    box(x,(y0+y1)/2,rear-1.05,w,y1-y0,.04,interior,'room back');
    for(const xx of [x-w/2,x+w/2])box(xx,(y0+y1)/2,rear-.5,.04,y1-y0,1.1,interior,'room side');
    for(const y of [y0,y1])box(x,y,rear-.5,w,.04,1.1,interior,'room closure');
  }
  function ac(x:number,y:number,z:number,w=.82){
    // Open housing and inset radiator; no solid front box behind the grille.
    for(const xx of [x-w/2+.018,x+w/2-.018])box(xx,y,z-.19,.036,.54,.49,cream,'AC housing');
    for(const yy of [y-.252,y+.252])box(x,yy,z-.19,w-.072,.036,.49,cream,'AC housing');
    box(x,y,z-.23,w-.07,.46,.03,iron,'AC radiator');
    for(let xx=x-w/2+.06;xx<x+w/2;xx+=.066)rod([xx,y-.23,z+.052],[xx,y+.23,z+.052],.007,iron,'AC grille');
    for(let yy=y-.23;yy<y+.24;yy+=.067)rod([x-w/2+.04,yy,z+.052],[x+w/2-.04,yy,z+.052],.007,iron,'AC grille');
    for(const xx of [x-.27,x+.27]){rod([xx,y-.31,z-.42],[xx,y-.31,z+.07],.016,iron,'AC support');rod([xx,y-.6,z-.42],[xx,y-.31,z+.05],.014,iron,'AC support');}
  }
  function window(x:number,floor:number,y0:number,y1:number,w:number,z:number,withAC:boolean){
    const h=y1-y0,leafW=(w-.10)/3,acBox=withAC?{x0:x+.12,x1:x+.98,y0:y0+.01,y1:y0+.59}:null;
    room(x,y0,y1,w,z);
    for(const yy of [y0+.035,y1-.035])box(x,yy,z+.03,w-.14,.07,.09,frame,'window frame');
    for(const xx of [x-w/2+.035,x+w/2-.035])box(xx,(y0+y1)/2,z+.03,.07,h,.09,frame,'window frame');
    // Three real hinged leaves. Two upper-left leaves open, as visible in the source.
    for(let j=0;j<3;j++){
      const left=x-w/2+.05+j*leafW,right=left+leafW,open=x<0 && floor>=2 && j<2;
      const g=new THREE.Group(),hinge=(j===0?left:right)*sx,angle=open?(j===0?-1:1)*.94:0;
      function leafPart(xx:number,yy:number,ww:number,hh:number,m:THREE.Material,depth:number){
        // Split closed parts at the AC sleeve; the room and grille remain behind.
        const x0=xx-ww/2,x1=xx+ww/2,by0=yy-hh/2,by1=yy+hh/2,rects:number[][]=[];
        if(!open&&acBox&&x1>acBox.x0&&x0<acBox.x1&&by1>acBox.y0&&by0<acBox.y1){
          if(x0<acBox.x0)rects.push([x0,Math.min(x1,acBox.x0),by0,by1]);if(x1>acBox.x1)rects.push([Math.max(x0,acBox.x1),x1,by0,by1]);
          const ax=Math.max(x0,acBox.x0),bx=Math.min(x1,acBox.x1);
          if(by0<acBox.y0)rects.push([ax,bx,by0,acBox.y0]);if(by1>acBox.y1)rects.push([ax,bx,acBox.y1,by1]);
        }else rects.push([x0,x1,by0,by1]);
        for(const [a,b,c,d]of rects){const geo=new THREE.BoxGeometry((b-a)*sx,d-c,depth);geo.translate((a+b)/2*sx-hinge,(c+d)/2,0);const mesh=new THREE.Mesh(geo,m);g.add(mesh);}
      }
      for(const xx of [left+.027,right-.027])leafPart(xx,(y0+y1)/2,.054,h-.09,frame,.062);
      for(const yy of [y0+.068,y1-.068,y0+h*.34])leafPart((left+right)/2,yy,leafW-.108,.046,frame,.066);
      for(const [lo,hi]of [[y0+.09,y0+h*.34-.025],[y0+h*.34+.025,y1-.09]])leafPart((left+right)/2,(lo+hi)/2,leafW-.08,hi-lo,glass,.005);
      g.position.set(hinge,0,z+.085);g.rotation.y=angle;g.updateMatrix();
      for(const child of g.children){const mesh=child as THREE.Mesh;mesh.updateMatrix();mesh.geometry.applyMatrix4(g.matrix.clone().multiply(mesh.matrix));add(mesh.geometry,mesh.material as THREE.Material,'casement leaf');}
    }
    // Rear security lattice is fixed to the opening, behind the moving casements.
    for(let xx=x-w/2+.1;xx<x+w/2-.05;xx+=.17)rod([xx,y0+.08,z-.035],[xx,y1-.08,z-.035],.009);
    for(let yy=y0+.13;yy<y1-.07;yy+=.17)rod([x-w/2+.08,yy,z-.035],[x+w/2-.08,yy,z-.035],.009);
    if(withAC)ac(x+.55,y0+.30,z+.31);
    windowChecks.push({x:x*sx,y:y1-.3,z,floor});
  }
  for(const side of [-1,1]){
    box(side*6.66,9.32,-.31,.68,12.4,.36,grey);
    box(side*5.89,9.32,-.25,.86,12.4,.38,yellow);
    for(let y=3.5;y<9.25;y+=.46)box(side*5.89,y,-.051,.85,.012,.006,grey,'flank joint');
    const x=side*4.16,w=2.60;
    for(let floor=0;floor<4;floor++){
      const y=floors[floor],lo=y+.88,hi=y+2.64;
      const topProjection=floor>=2?.05:0;
      // Four masonry strips surround a real window aperture.
      box(x,y+.44,topProjection-.20,w,.88,.40,floor===3?coral:cream);
      box(x,(hi+y+3.1)/2,topProjection-.20,w,y+3.1-hi,.40,floor===2?coral:cream);
      for(const xx of [x-w/2+.105,x+w/2-.105])box(xx,(lo+hi)/2,topProjection-.23,.21,hi-lo,.46);
      window(x,floor,lo,hi,w-.42,topProjection-.42,side>0&&floor<3);
      box(x,lo-.045,topProjection+.015,w-.13,.09,.50,cream,'window sill');
      box(x,hi+.095,.18,w+.13,.14,.71,floor<2?grey:cream,'window hood');
      if(floor===1){for(let dx=-.92;dx<1;dx+=.39)box(x+dx,y+3.23,.02,.095,.46,.20,coral,'baluster relief');}
    }
    // Upper grey pilasters terminate in small moulded capitals above the roof.
    box(side*2.73,12.8,-.22,.76,7.02,.50,grey,'upper pier');
    for(const y of [9.29,9.36,16.27,16.34])box(side*2.73,y,.015,.91,.055,.61,cream,'pier cap');
    // Photo-visible hood crest over the top side window.
    const crest:number[][]=[];for(let j=0;j<=16;j++){const dx=-1.4+j*2.8/16;crest.push([x+dx,15.2+.32*Math.sin(Math.PI*j/16)]);}crest.push([x+1.4,15.17],[x-1.4,15.17]);panel(crest,.20,.23,coral,'curved hood crest');
    for(const y of [15.62,15.71])box(side*4.16,y,-.27,2.58,.07,.26,cream,'roof rail');
    for(let xx=-1.06;xx<=1.07;xx+=.33)box(side*4.16+xx,15.95,-.30,.105,.42,.17,cream,'roof baluster');
    box(side*4.16,16.2,-.30,2.63,.08,.29,cream,'roof rail');
  }
  // Lower two central grille openings, coral flanks with shallow horizontal joints.
  for(let floor=0;floor<2;floor++){
    const y=floors[floor],lo=y+.42,hi=y+2.73;
    for(const x of [-2.45,2.45]){
      if(floor===0)box(x,y+1.55,-.19,.9,3.1,.42,coral);
      else {const sign=Math.sign(x);panel([[sign*2,y],[sign*2.9,y],[sign*2.9,y+2.48],[sign*2.1,y+3.1],[sign*2,y+3.1]],.02,.42,coral);}
    }
    box(0,y+.21,-.19,4,.42,.42,coral);box(0,(hi+y+3.1)/2,-.19,4,y+3.1-hi,.42,floor===1?coral:cream);
    room(0,lo,hi,4,-1.05);
    // Recessed entry/window backing: glazing and a central doorway, behind the grille.
    box(0,(lo+hi)/2,-1.07,1.1,hi-lo,.08,interior,'recessed doorway');
    for(const x of [-1.3,1.3])window(x,floor,lo+.16,hi-.13,1.14,-1.05,false);
    for(let x=-1.98;x<=2;x+=.285)rod([x,lo,.055],[x,hi,.055],.013);
    for(let yy=lo;yy<=hi+.01;yy+=.29)rod([-2,yy,.055],[2,yy,.055],.012);
    for(let x=-1.84;x<1.9;x+=.57)for(let yy=lo+.29;yy<hi-.2;yy+=.58){
      for(const sign of [-1,1])rod([x-.265,yy-sign*.26,.06],[x+.265,yy+sign*.26,.06],.008);
      ring(x,yy,.074,.044);
    }
    for(let yy=y+.1;yy<y+(floor===1?2.45:3.1);yy+=.43){for(const x of [-2.45,2.45])box(x,yy,.025,.9,.018,.01,cream,'coral horizontal joint');}
  }
  // Bowed upper balcony fronts: curved plan, actual grille depth and interior void.
  const curveZ=(x:number)=>-.36+(Math.abs(x)<1.4?.68*Math.cos(x/1.4*Math.PI/2):0);
  function curvedBand(y:number,h:number,depth:number,m:THREE.Material,projection=0){
    const path:THREE.Vector2[]=[];for(let i=0;i<=48;i++){const x=-2.25+4.5*i/48;path.push(new THREE.Vector2(x*sx,-curveZ(x)-projection));}
    for(let i=48;i>=0;i--){const x=-2.25+4.5*i/48;path.push(new THREE.Vector2(x*sx,-curveZ(x)-projection+depth));}
    const g=new THREE.ExtrudeGeometry(new THREE.Shape(path),{depth:h,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y,0);add(g,m,'curved balcony masonry');
  }
  for(let floor=2;floor<4;floor++){
    const y=floors[floor],lo=y+.66,hi=y+2.19;
    room(0,y+.15,y+3.1,4.5,-1.4);
    curvedBand(y+.08,.50,.19,cream);curvedBand(hi,y+3.1-hi,.21,cream);
    for(const yy of [y+.04,y+.12,y+.58,y+.65,hi,hi+.075])curvedBand(yy,.055,.29,cream,.045);
    for(let x=-2.22;x<2.24;x+=.118)rod([x,lo,curveZ(x)+.008],[x,hi,curveZ(x)+.008],.010);
    for(let yy=lo;yy<hi+.02;yy+=.18)for(let i=0;i<40;i++){const x=-2.25+4.5*i/40,xx=x+4.5/40;rod([x,yy,curveZ(x)+.014],[xx,yy,curveZ(xx)+.014],.009);}
    for(const x of [-1.38,1.38])rod([x,lo,curveZ(x)],[x,hi,curveZ(x)],.023);
    box(0,y+1.55,-1.42,1.1,2.55,.05,interior,'balcony door');
  }
  curvedBand(15.52,.75,.23,cream);curvedBand(16.27,.06,.30,cream,.045);curvedBand(16.34,.045,.33,cream,.06);
  // Two raised name lines on the actual lower centre band; lettering approximation.
  box(0,6.23,.07,4.0,.78,.12,cream,'name panel');
  const nameBlue=new THREE.MeshStandardMaterial({color:0x3d565f,roughness:.56,metalness:.24});nameBlue.name='Encaarpus blue name and emblem';
  // Approximation of the small four-lobed blue emblem visible beside the name.
  const emblem=new THREE.Shape();
  emblem.moveTo(0,.49);emblem.bezierCurveTo(.25,.59,.58,.35,.43,.10);emblem.bezierCurveTo(.65,-.18,.34,-.56,.09,-.43);emblem.bezierCurveTo(-.18,-.64,-.57,-.34,-.43,-.08);emblem.bezierCurveTo(-.66,.17,-.33,.59,-.10,.43);emblem.closePath();
  const centerHole=new THREE.Path();centerHole.moveTo(0,.17);centerHole.lineTo(-.17,0);centerHole.lineTo(0,-.17);centerHole.lineTo(.17,0);centerHole.closePath();emblem.holes.push(centerHole);
  for(const [x,y]of [[-.22,.23],[.22,.23],[.22,-.23],[-.22,-.23]]){const hole=new THREE.Path();hole.absellipse(x,y,.09,.055,Math.PI*2,0,true,Math.PI/4);emblem.holes.push(hole);}
  const emblemGeo=new THREE.ExtrudeGeometry(emblem,{depth:.012/.34,bevelEnabled:false,curveSegments:6});emblemGeo.scale(.34,.34,.34);emblemGeo.translate(-1.65*sx,6.425,.133);add(emblemGeo,nameBlue,'name emblem');
  for(let i=0;i<outlines.words.length;i++){
    const word=outlines.words[i],paths:THREE.Shape[]=[];
    for(const glyph of word.glyphs){const path=new THREE.ShapePath();for(const raw of glyph.commands){const [command,...values]=raw,v=values as number[];
      if(command==='M')path.moveTo(v[0]+glyph.advance,v[1]);else if(command==='L')path.lineTo(v[0]+glyph.advance,v[1]);else if(command==='Q')path.quadraticCurveTo(v[0]+glyph.advance,v[1],v[2]+glyph.advance,v[3]);else if(command==='C')path.bezierCurveTo(v[0]+glyph.advance,v[1],v[2]+glyph.advance,v[3],v[4]+glyph.advance,v[5]);else path.currentPath!.closePath();}paths.push(...path.toShapes());}
    const geo=new THREE.ExtrudeGeometry(paths,{depth:12,bevelEnabled:false,curveSegments:4});geo.computeBoundingBox();const bounds=geo.boundingBox!,scale=(i===0?2.90:2.75)*sx/(bounds.max.x-bounds.min.x);
    geo.translate(-(bounds.max.x+bounds.min.x)/2,-bounds.min.y,0);geo.scale(scale,(i===0?.28:.26)/(bounds.max.y-bounds.min.y),.012/12);geo.translate(.22*sx,i===0?6.29:5.94,.133);add(geo,i===0?nameBlue:new THREE.MeshStandardMaterial({color:0x713d34,roughness:.69}),'name lettering');
    semantic['lettering height '+i]=i===0?.28:.26;
  }
  // Source gate pattern: three openings, solid diagonal panels, slim rails and rings.
  const gateZ=2.9,gatePiers=[-6.9,-2.85,2.85,6.9];
  for(const x of gatePiers){box(x,1.05,gateZ,.46,2.10,.51,grey,'boundary pier');box(x,2.115,gateZ,.58,.09,.64,cream,'boundary cap');}
  for(let bay=0;bay<3;bay++){
    const left=gatePiers[bay]+.25,right=gatePiers[bay+1]-.25,mid=(left+right)/2;
    for(const [a,b]of [[left,mid-.025],[mid+.025,right]]){
      for(const x of [a,b])rod([x,.14,gateZ],[x,1.88,gateZ],.021);
      for(const y of [.14,.27,.41,.55,1.88])rod([a,y,gateZ],[b,y,gateZ],.021);
      const mirrored=a>mid,innerGap=.43;
      // The source plates are rectangular except for a narrow diagonal opening
      // descending inward from each outer edge and the clear inner vertical strip.
      const outer=mirrored?b:a,sign=mirrored?-1:1,inner=mirrored?a+innerGap:b-innerGap;
      panel([[outer,1.65],[inner,1.65],[inner,.57],[outer+sign*.95,.57]],gateZ+.012,.025,iron,'gate plate');
      panel([[outer,1.32],[outer+sign*.72,.57],[outer,.57]],gateZ+.012,.025,iron,'gate lower plate');
      rod([inner,.55,gateZ],[inner,1.65,gateZ],.013);
      rod([outer+sign*.08,1.36,gateZ+.036],[outer+sign*.83,.59,gateZ+.036],.012,gold);
      ring(outer+sign*.39,1.04,gateZ+.042,.10);
      const handle=mirrored?a+.14:b-.14;
      rod([handle,.58,gateZ+.036],[handle,1.30,gateZ+.036],.009,gold);
      ring(handle,1.10,gateZ+.042,.10);
      for(let i=1;i<3;i++){const x=a+(b-a)*i/3;rod([x,.16,gateZ],[x,.53,gateZ],.012);}

    }
  }
  // Short source-visible vertical conduit; detailed routing and utility wires remain open.
  rod([-2.3,9.5,-.02],[-2.3,15.75,-.02],.018,cream,'conduit');
  for(const [m,geometries]of batches){const merged=mergeGeometries(geometries,false);if(!merged)throw new Error('Encaarpus geometry merge failed');const mesh=new THREE.Mesh(merged,m);mesh.name=m.name||'Encaarpus painted name';mesh.castShadow=m!==glass;mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
  const facadeServices=buildEncaarpusServices(width);group.add(facadeServices);
  group.userData={wayId:ENCAARPUS_WAY_ID,revision:3,facadeServices:facadeServices.userData,width,height:ENCAARPUS_HEIGHT,heightSource:ENCAARPUS_HEIGHT_SOURCE,observedResidentialRows:4,observedStiltParking:true,sourcePhoto:'Frankleen Seeralan, January 2024, CIHM0ogKEICAgICtsaaHCA',sourceSha256:'0b02fddb8fcfeeb9b8552d5e12927ffea82ff016f3cf67bb972e8c735dd4bb99',identity:'Conditional association: visible name + 9/5 Central Avenue listing pin 3.99 m from way 354839754; not cadastral proof',pose:group.position.toArray(),yaw:group.rotation.y,windowChecks,semantic,gateZ,limits:'Photo-informed frontage and open parking; floor heights, recesses, paint reflectance, metal sections and gate setback inferred. Plain unseen sides/rear, no measured floor plan, no present-day condition claim, no photorealism pass.'};
  return group;
}
