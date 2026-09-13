import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLakshmiPlaster,setLakshmiMaterialUV} from './lakshmi-material';
import lettering from './avinash-lettering.json';
import {buildAvinashRedFacing} from './avinash-red-facing';
import {buildAvinashGround} from './avinash-ground';

export const AVINASH_WAY_ID=354839974;
export const AVINASH_HEIGHT=12.4;
export const AVINASH_HEIGHT_SOURCE='Photograph: three upper balcony rows above ground; inferred 3.1 m storey pitch, not a measured height';
type Point={x:number;z:number};
/** Visible eastern frontage only. Hidden right-side and rear construction remains plain. */
export function buildAvinashApartments(points:Point[]){
  if(points.length!==4)throw new Error('Avinash footprint changed; review its association');
  const a=new THREE.Vector3(points[1].x,0,points[1].z),b=new THREE.Vector3(points[2].x,0,points[2].z),along=b.clone().sub(a).normalize();
  const outward=new THREE.Vector3(along.z,0,-along.x),width=a.distanceTo(b);
  if(width<16||width>18)throw new Error('Avinash frontage extent requires review');
  const group=new THREE.Group();group.name='Avinash Apartments · conditional photo-informed frontage';group.position.copy(a).lerp(b,.5);group.rotation.y=Math.atan2(outward.x,outward.z);group.updateMatrixWorld(true);
  const polygon=points.map(p=>group.worldToLocal(new THREE.Vector3(p.x,0,p.z))),sx=width/17.2455;
  const base=createLakshmiPlaster();
  function plaster(name:string,color:number){const m=base.clone();m.name='Avinash '+name;m.color.setHex(color);m.userData={...base.userData,evidence:'Private undated streetscape; paint reflectance inferred from uncalibrated image'};return m;}
  const white=plaster('white plaster',0xdbded5),blue=plaster('blue trim',0x526f89),concrete=plaster('concrete',0x979a91);
  const steel=new THREE.MeshStandardMaterial({color:0x424b4b,roughness:.65,metalness:.45});steel.name='Avinash dark steel';
  const green=new THREE.MeshStandardMaterial({color:0x497f6e,roughness:.60,metalness:.3});green.name='Avinash green balcony grille';
  const meshMetal=new THREE.MeshStandardMaterial({color:0x9a9d95,roughness:.52,metalness:.62});meshMetal.name='Avinash upper diamond mesh';
  const windowFrame=new THREE.MeshStandardMaterial({color:0xc5d1c9,roughness:.65,metalness:.12});windowFrame.name='Avinash pale casements';
  const glass=new THREE.MeshPhysicalMaterial({color:0x68847c,roughness:.28,transmission:.22,thickness:.004,ior:1.5});glass.name='Avinash window glass';
  const interior=new THREE.MeshStandardMaterial({color:0x666b60,roughness:.96});interior.name='Avinash unobserved recess';
  const screenFabric=new THREE.MeshStandardMaterial({color:0x356894,roughness:.96,side:THREE.DoubleSide});screenFabric.name='Avinash blue balcony screening';
  const equipment=new THREE.MeshStandardMaterial({color:0xc4c8bc,roughness:.77,metalness:.12});equipment.name='Avinash exterior equipment casing';
  const wallTop=AVINASH_HEIGHT-.20;
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>(),semantic:Record<string,number>={};
  const windowChecks:{x:number;y:number;z:number}[]=[];
  const greenParts:{kind:string;startVertex:number;vertexCount:number}[]=[];let greenVertexCount=0,greenProfile:Record<string,unknown>|undefined;
  function add(g:THREE.BufferGeometry,m:THREE.Material,kind:string){if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}g.clearGroups();if([white,blue,concrete].includes(m as THREE.MeshStandardMaterial))setLakshmiMaterialUV(g);if(m===green){greenParts.push({kind,startVertex:greenVertexCount,vertexCount:g.attributes.position.count});greenVertexCount+=g.attributes.position.count;}if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(g);semantic[kind]=(semantic[kind]||0)+1;}
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material=white,kind='masonry'){const g=new THREE.BoxGeometry(w*sx,h,d);g.translate(x*sx,y,z);add(g,m,kind);}
  function rod(a:number[],b:number[],r:number,m:THREE.Material=steel,kind='metalwork'){const p=new THREE.Vector3(a[0]*sx,a[1],a[2]),q=new THREE.Vector3(b[0]*sx,b[1],b[2]),delta=q.clone().sub(p);if(delta.length()<1e-5)return;const g=new THREE.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());add(g,m,kind);}
  function shapePanel(shape:THREE.Shape,z:number,depth:number,m:THREE.Material,kind:string){const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:10});g.translate(0,0,z-depth);add(g,m,kind);}
  function rectangle(x:number,y:number,w:number,h:number){const p=new THREE.Path();p.moveTo((x-w/2)*sx,y);p.lineTo((x-w/2)*sx,y+h);p.lineTo((x+w/2)*sx,y+h);p.lineTo((x+w/2)*sx,y);p.closePath();return p;}
  function room(x:number,y:number,w:number,h:number,back:number){box(x,y+h/2,back,w,h,.10,interior,'recess back');for(const side of [-1,1])box(x+side*(w/2-.05),y+h/2,back/2,.10,h-.16,-back,white,'recess jamb');box(x,y+.04,back/2,w,.08,-back,white,'recess sill');box(x,y+h-.04,back/2,w,.08,-back,white,'recess ceiling');}
  function casement(x:number,y:number,w:number,h:number,z:number){
    box(x,y+h/2,z-.025,w-.10,h-.10,.008,glass,'glazing');
    for(const xx of [x-w/2+.035,x,x+w/2-.035])box(xx,y+h/2,z,.065,h,.065,windowFrame,'casement stile');
    for(const yy of [y+.035,y+h*.40,y+h-.035])box(x,yy,z,w-.13,.06,.065,windowFrame,'casement rail');
    windowChecks.push({x:(x-w*.22)*sx,y:y+h*.73,z:z-.025});
  }
  // The roof slab owns the upper 20 cm and its underside. Clip masonry to
  // that physical interface; keeping full-height wall faces would duplicate
  // the slab's visible outer edge. Cut-plane caps are internal and omitted.
  function belowRoof(geometry:THREE.BufferGeometry){
    const g=geometry.index?geometry.toNonIndexed():geometry,p=g.attributes.position,values:number[]=[],top=Math.fround(wallTop);
    for(let start=0;start<p.count;start+=3){
      const polygon=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(p,start+i));
      if(polygon.every(v=>v.y>=top))continue;
      const clipped:THREE.Vector3[]=[];
      for(let i=0;i<3;i++){
        const a=polygon[i],b=polygon[(i+1)%3],insideA=a.y<=top,insideB=b.y<=top;
        if(insideA)clipped.push(a);
        if(insideA!==insideB){const v=a.clone().lerp(b,(top-a.y)/(b.y-a.y));v.y=top;clipped.push(v);}
      }
      for(let i=1;i<clipped.length-1;i++){
        const a=clipped[0],b=clipped[i],c=clipped[i+1];
        if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()>1e-20)values.push(...a.toArray(),...b.toArray(),...c.toArray());
      }
    }
    if(g!==geometry)g.dispose();geometry.dispose();const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(values,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(values.length/3*2),2));result.computeVertexNormals();return result;
  }
  // Exact mapped slabs and plain unseen sides. Do not mirror the observed frontage.
  for(const y of [0.055,AVINASH_HEIGHT]){const shape=new THREE.Shape(polygon.map(p=>new THREE.Vector2(p.x,-p.z))),g=new THREE.ExtrudeGeometry(shape,{depth:y===.055?.10:.20,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y-(y===.055?.10:.20),0);add(g,concrete,'mapped slab');}
  for(const i of [0,2,3]){const p=polygon[i],q=polygon[(i+1)%4],delta=q.clone().sub(p),length=delta.length(),g=new THREE.BoxGeometry(length,AVINASH_HEIGHT,.20);g.rotateY(-Math.atan2(delta.z,delta.x));g.translate((p.x+q.x)/2,AVINASH_HEIGHT/2,(p.z+q.z)/2);if(i!==2)add(belowRoof(g),white,'unobserved side wall');else g.dispose();const cap=new THREE.BoxGeometry(length,.65,.22);cap.rotateY(-Math.atan2(delta.z,delta.x));cap.translate((p.x+q.x)/2,AVINASH_HEIGHT+.325,(p.z+q.z)/2);add(cap,white,'unobserved parapet');}
  // The alternate southern view traces this return to the same front corner.
  // Upper finned-window positions are proportional studies within the exact mapped side.
  const sp=polygon[2],sq=polygon[3],sd=sq.clone().sub(sp).normalize(),sn=new THREE.Vector3(sd.z,0,-sd.x),sideWidth=sp.distanceTo(sq);
  const sideMatrix=new THREE.Matrix4().compose(sp.clone().lerp(sq,.5),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(sn.x,sn.z)),new THREE.Vector3(1,1,1));
  const sideWindowChecks:{point:number[];normal:number[]}[]=[];
  // Join the two masonry solids at the mapped outer corner and the exact
  // intersection of their inner planes. Their old end caps overlapped the
  // visible front face; neither internal cap belongs to the joined envelope.
  const wallDepth=.20,joinOuter=new THREE.Vector3(-width/2,0,0);
  const joinInner=new THREE.Vector3(sp.x+(-wallDepth-sn.z*(-wallDepth-sp.z))/sn.x,0,-wallDepth);
  const joinPieces:{kind:string;startVertex:number;vertexCount:number;removedTriangles:number}[]=[];
  function joinedWall(g:THREE.BufferGeometry,endX:number,kind:string,matrix?:THREE.Matrix4){
    const p=g.attributes.position,values:number[]=[],boundary=Math.fround(endX);let removedTriangles=0;
    for(let start=0;start<p.count;start+=3){
      if([0,1,2].every(i=>p.getX(start+i)===boundary)){removedTriangles++;continue;}
      for(let i=0;i<3;i++){
        const j=start+i,v=new THREE.Vector3().fromBufferAttribute(p,j);
        if(p.getX(j)===boundary){const q=p.getZ(j)>-wallDepth/2?joinOuter:joinInner;v.x=q.x;v.z=q.z;}
        else if(matrix)v.applyMatrix4(matrix);
        values.push(v.x,v.y,v.z);
      }
    }
    if(removedTriangles!==2)throw new Error('Avinash wall join topology changed');
    g.dispose();const joined=new THREE.BufferGeometry();joined.setAttribute('position',new THREE.Float32BufferAttribute(values,3));joined.computeVertexNormals();
    // The material helper derives UV0 from the final physical positions.
    joined.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(values.length/3*2),2));
    const startVertex=(batches.get(white)||[]).reduce((sum,g)=>sum+g.attributes.position.count,0);
    const clipped=belowRoof(joined);add(clipped,white,kind);joinPieces.push({kind,startVertex,vertexCount:clipped.attributes.position.count,removedTriangles});
  }

  const sideWall=new THREE.Shape();sideWall.moveTo(-sideWidth/2,0);sideWall.lineTo(sideWidth/2,0);sideWall.lineTo(sideWidth/2,AVINASH_HEIGHT);sideWall.lineTo(-sideWidth/2,AVINASH_HEIGHT);sideWall.closePath();
  function sideBox(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,kind:string){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);g.applyMatrix4(sideMatrix);add(g,m,kind);}
  for(let floor=1;floor<=3;floor++)for(const x of [-4.5,0,4.5]){
    const y=floor*3.1+.75,w=1.48,h=1.65,path=new THREE.Path();path.moveTo(x-w/2,y);path.lineTo(x-w/2,y+h);path.lineTo(x+w/2,y+h);path.lineTo(x+w/2,y);path.closePath();sideWall.holes.push(path);
    sideBox(x,y+h/2,-.73,w,h,.10,interior,'south recess back');
    for(const xx of [x-w/2+.05,x+w/2-.05])sideBox(xx,y+h/2,-.34,.10,h-.16,.68,white,'south reveal');
    for(const yy of [y+.04,y+h-.04])sideBox(x,yy,-.34,w,.08,.68,white,'south reveal');
    sideBox(x,y+h/2,-.59,w-.13,h-.13,.008,glass,'south glazing');
    for(const xx of [x-w/2+.035,x,x+w/2-.035])sideBox(xx,y+h/2,-.55,.06,h,.06,windowFrame,'south casement');
    for(const yy of [y+.04,y+h*.40,y+h-.04])sideBox(x,yy,-.55,w-.12,.06,.06,windowFrame,'south casement');
    sideBox(x,y+h+.06,.22,2.05,.10,.64,white,'south window hood');
    for(const xx of [x-.90,x,x+.90]){sideBox(xx,y+.87,.25,.08,2.10,.58,white,'south window fin');sideBox(xx,y+.87,.55,.035,2.10,.015,blue,'south fin blue edge');}
    const point=new THREE.Vector3(x-w*.22,y+h*.73,-.59).applyMatrix4(sideMatrix);sideWindowChecks.push({point:point.toArray(),normal:sn.toArray()});
  }
  const sideGeo=new THREE.ExtrudeGeometry(sideWall,{depth:.20,bevelEnabled:false});sideGeo.translate(0,0,-.20);joinedWall(sideGeo,sideWidth/2,'source south perforated wall',sideMatrix);
  const front=new THREE.Shape();front.moveTo(-width/2,0);front.lineTo(width/2,0);front.lineTo(width/2,AVINASH_HEIGHT);front.lineTo(-width/2,AVINASH_HEIGHT);front.closePath();
  const bays=[{x:-6.25,w:4.15,greenFirst:true},{x:6.70,w:3.55,greenFirst:false}];
  for(let floor=1;floor<=3;floor++){
    const y=floor*3.1;for(const bay of bays)front.holes.push(rectangle(bay.x,y+.12,bay.w,2.78));
    for(const x of [-2.67,2.05])front.holes.push(rectangle(x,y+.75,1.60,1.70));
    front.holes.push(rectangle(-3.83,y+1.56,.45,.48));
  }
  // Small ground windows are visible either side of the arched entry.
  for(const x of [-2.65,2.05,4.65])front.holes.push(rectangle(x,.83,1.22,1.55));
  const arch=new THREE.Path(),doorX=.05,doorW=1.58,doorShoulder=1.88,doorTop=2.64;
  arch.moveTo((doorX-doorW/2)*sx,.10);arch.lineTo((doorX-doorW/2)*sx,doorShoulder);arch.quadraticCurveTo(doorX*sx,doorTop+.40,(doorX+doorW/2)*sx,doorShoulder);arch.lineTo((doorX+doorW/2)*sx,.10);arch.closePath();front.holes.push(arch);const frontGeo=new THREE.ExtrudeGeometry(front,{depth:wallDepth,bevelEnabled:false,curveSegments:10});frontGeo.translate(0,0,-wallDepth);joinedWall(frontGeo,-width/2,'perforated front wall');
  // Two stacks are visible in the alternate-angle photo; only the left lowest grille is green.
  for(const {x:balconyX,w:balconyW,greenFirst} of bays)for(let floor=1;floor<=3;floor++){
    const y=floor*3.1,left=balconyX-balconyW/2,right=balconyX+balconyW/2;
    room(balconyX,y+.12,balconyW,2.78,-1.65);
    box(balconyX,y+.01,.32,balconyW+.16,.18,1.05,white,'balcony slab');box(balconyX,y-.075,.79,balconyW+.16,.05,.055,blue,'balcony blue edge');
    box(balconyX,y+.32,.78,balconyW,.46,.15,white,'balcony parapet');
    for(const side of [-1,1])box(balconyX+side*(balconyW/2-.065),y+1.60,.40,.13,2.72,.90,white,'balcony side return');
    const lo=y+.58,hi=y+2.61,z=.86,isGreen=floor===1&&greenFirst,m=isGreen?green:meshMetal;
    const frameShape=new THREE.Shape(),x0=(left-.005)*sx,x1=(right+.005)*sx;
    frameShape.moveTo(x0,lo-.14);frameShape.lineTo(x1,lo-.14);frameShape.lineTo(x1,hi+.16);frameShape.lineTo(x0,hi+.16);frameShape.closePath();
    const hole=new THREE.Path(),a0=(left+.13)*sx,a1=(right-.13)*sx,r=.20;
    hole.moveTo(a0+r,lo);hole.quadraticCurveTo(a0,lo,a0,lo+r);hole.lineTo(a0,hi-r);hole.quadraticCurveTo(a0,hi,a0+r,hi);hole.lineTo(a1-r,hi);hole.quadraticCurveTo(a1,hi,a1,hi-r);hole.lineTo(a1,lo+r);hole.quadraticCurveTo(a1,lo,a1-r,lo);hole.closePath();frameShape.holes.push(hole);
    shapePanel(frameShape,.925,.10,white,'rounded balcony surround');

    if(isGreen){
      // The photographed enclosure bows outward and uses a few broad swept
      // upper motifs. Projection, radii and fabrication remain metric priors.
      const xL=left+.21,xR=right-.21,yL=lo+.07,yH=hi-.07,r=.16,baseZ=.99,bow=.28;
      const depth=(x:number)=>baseZ+bow*(1-Math.pow(2*(x-xL)/(xR-xL)-1,2));
      const point=(x:number,yy:number)=>new THREE.Vector3(x*sx,yy,depth(x));
      const outline=new THREE.Path();outline.moveTo(xL+r,yL);outline.lineTo(xR-r,yL);outline.quadraticCurveTo(xR,yL,xR,yL+r);outline.lineTo(xR,yH-r);outline.quadraticCurveTo(xR,yH,xR-r,yH);outline.lineTo(xL+r,yH);outline.quadraticCurveTo(xL,yH,xL,yH-r);outline.lineTo(xL,yL+r);outline.quadraticCurveTo(xL,yL,xL+r,yL);
      const outlinePoints=outline.getSpacedPoints(160);outlinePoints.pop();
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outlinePoints.map(p=>point(p.x,p.y)),true,'centripetal'),160,.016,6,true),m,'green rounded bowed perimeter');
      const curveBar=(sample:(t:number)=>THREE.Vector3,radius:number,kind:string)=>{const pts=Array.from({length:33},(_,i)=>sample(i/32));add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),48,radius,6,false),m,kind);};
      for(let i=0;i<=24;i++){const x=THREE.MathUtils.lerp(xL+r,xR-r,i/24);rod([x,yL,depth(x)],[x,yH,depth(x)],.009,m,'green vertical bar');}
      for(const yy of [yL+.30,yH-.60])curveBar(t=>point(THREE.MathUtils.lerp(xL,xR,t),yy),.012,'green bowed crossrail');
      for(const sag of [.25,.43,.62])curveBar(t=>point(THREE.MathUtils.lerp(xL+r,balconyX,t),yH-sag*4*t*(1-t)),.009,'green broad swept ornament');
      curveBar(t=>point(THREE.MathUtils.lerp(balconyX,xR,t),yH-.28),.011,'green right upper rail');
      // Flush mounting pads touch the surround; all other green members clear
      // its front plane. Mounts attach to the straight side portions, not corners.
      for(const [padX,frameX]of [[left+.065,xL],[right-.065,xR]])for(const yy of [yL+.40,yH-.40]){
        box(padX,yy,.935,.10,.14,.020,m,'green mounting pad');
        rod([padX,yy,.945],[frameX,yy,baseZ],.009,m,'green mounting arm');
      }
      greenProfile={xExtent:[xL*sx,xR*sx],yExtent:[yL,yH],baseZ,bow,maximumCenterZ:baseZ+bow,surroundFrontZ:.925,frameRadius:.016,cornerRadius:r,broadSweeps:3,verticalBars:25,parts:greenParts,limits:'Only lowest left enclosure. Bow, corner radius, swept motif curves, member sections, spacing and mounts inferred from uncalibrated photographs; not a fabrication survey.'};
    }else{
      for(const xx of [left+.13,right-.13])rod([xx,lo,z],[xx,hi,z],.018,m);
      for(const yy of [lo,hi])rod([left+.13,yy,z],[right-.13,yy,z],.018,m);
      // Clipped diagonals have no wires extending beyond the photographed enclosure.
      const x0=left+.13,x1=right-.13,h=hi-lo;
      for(const sign of [-1,1])for(let intercept=x0-h;intercept<=x1+h;intercept+=.19){let y0=0,y1=h;if(sign>0){y0=Math.max(0,x0-intercept);y1=Math.min(h,x1-intercept);}else{y0=Math.max(0,intercept-x1);y1=Math.min(h,intercept-x0);}if(y1>y0)rod([intercept+sign*y0,lo+y0,z],[intercept+sign*y1,lo+y1,z],.005,m,'diamond grille');}
      for(const yy of [lo+.15,lo+.64])rod([x0,yy,z+.01],[x1,yy,z+.01],.012,steel);
    }
    // Interior casements and narrow door are visible through the metalwork; layout remains a prior.
    casement(balconyX-.55,y+.65,1.10,1.60,-1.57);box(balconyX+.85,y+1.20,-1.58,.83,2.25,.04,interior,'balcony doorway');
  }
  for(let floor=1;floor<=3;floor++){
    const y=floor*3.1;
    for(const x of [-2.67,2.05]){
      room(x,y+.75,1.60,1.70,-.65);casement(x,y+.80,1.46,1.60,-.56);
      box(x,y+2.51,.19,2.15,.10,.55,white,'window sunshade');
      for(const xx of [x-.94,x,x+.94]){box(xx,y+1.57,.23,.08,2.20,.55,white,'window vertical fin');box(xx,y+1.57,.515,.035,2.20,.015,blue,'fin blue edge');}
    }
    room(-3.83,y+1.56,.45,.48,-.40);
    for(let yy=y+1.62;yy<y+2;yy+=.065)box(-3.83,yy,-.08,.38,.025,.045,steel,'vent louvre');
  }
  const redFacing=buildAvinashRedFacing(sx);
  add(redFacing.bedding,redFacing.mortar,'red facing mortar bed');
  add(redFacing.facing,redFacing.clay,'red rectangular facing units');
  // Corner photograph: blue screening occupies the upper part of the top-left
  // enclosure. This is an observed movable state, not a permanent facade panel.
  // It lies outside the grille, within the surround. Small folds and pale bindings are original approximations; no photo pixels.
  const screenLeft=-8.06,screenRight=-4.44,screenTop=11.82,screenBottom=10.82,screenZ=.895;
  const screenGeo=new THREE.PlaneGeometry((screenRight-screenLeft)*sx,screenTop-screenBottom,48,8),screenPositions=screenGeo.attributes.position;
  for(let i=0;i<screenPositions.count;i++){
    const u=screenPositions.getX(i)/((screenRight-screenLeft)*sx)+.5,v=screenPositions.getY(i)/(screenTop-screenBottom)+.5;
    screenPositions.setXYZ(i,screenPositions.getX(i)+(screenLeft+screenRight)*sx/2,screenBottom+v*(screenTop-screenBottom)-.035*Math.sin(u*Math.PI)*(1-v),screenZ+.016*Math.sin(u*Math.PI*16)*(1-v*.65));
  }
  screenGeo.computeVertexNormals();add(screenGeo,screenFabric,'upper balcony blue screening');
  rod([screenLeft-.20,screenTop,screenZ],[screenRight+.20,screenTop,screenZ],.027,windowFrame,'screen top support');
  for(const u of [.06,.29,.52,.75,.94]){
    const x=THREE.MathUtils.lerp(screenLeft,screenRight,u),bottom=screenBottom-.035*Math.sin(u*Math.PI);
    box(x,(bottom+screenTop)/2,screenZ+.021,.024,screenTop-bottom,.008,windowFrame,'screen pale binding');
  }
  // A small outdoor AC cabinet is visible under the left balcony in the corner
  // source. Cabinet proportions, fan layout, brackets and pipe routing inferred.
  // Keep it below the slab and outside the wall, clear of all mapped apertures.
  const acX=-7.28,acY=2.60,acBack=.06,acFront=.40;
  box(acX,acY,(acBack+acFront)/2,.94,.57,acFront-acBack,equipment,'AC cabinet');
  // Inset dark fan face with a physical protective cage. No brand inscription.
  const fan=new THREE.CircleGeometry(.213,32);fan.translate((acX-.16)*sx,acY,acFront+.002);add(fan,interior,'AC fan shadow');
  for(const radius of [.068,.135,.20]){const ring=new THREE.TorusGeometry(radius,.006,5,32);ring.translate((acX-.16)*sx,acY,acFront+.014);add(ring,equipment,'AC fan guard ring');}
  for(let i=0;i<8;i++){const angle=i*Math.PI/4;rod([acX-.16,acY,acFront+.014],[acX-.16+.204*Math.cos(angle)/sx,acY+.204*Math.sin(angle),acFront+.014],.005,equipment,'AC fan guard spoke');}
  for(let yy=acY-.18;yy<=acY+.18;yy+=.06)box(acX+.30,yy,acFront+.004,.15,.012,.009,interior,'AC side vents');
  for(const xx of [acX-.33,acX+.33]){
    box(xx,2.28,.232,.045,.07,.415,steel,'AC support bracket');
    box(xx,2.46,.024,.045,.42,.048,steel,'AC wall bracket');
    rod([xx,2.255,.035],[xx,2.255,.42],.012,steel,'AC bracket lower edge');
  }
  rod([acX-.47,acY,.13],[acX-.75,acY,.045],.024,equipment,'AC short service line');
  rod([acX-.75,acY,.045],[acX-.75,2.97,.045],.024,equipment,'AC short service line');
  for(const x of [-2.65,2.05,4.65]){room(x,.83,1.22,1.55,-.57);casement(x,.87,1.12,1.45,-.46);}
  // Continue the actual curved aperture behind the front wall. The former
  // rectangular reveal caps lay on top of solid facade outside the arch.
  box(doorX,.10+2.75/2,-1.32,doorW,2.75,.10,interior,'recess back');
  box(doorX,.14,-.66,doorW,.08,1.32,white,'recess sill');
  const entryReveal=new THREE.Shape();entryReveal.moveTo((doorX-doorW/2-.10)*sx,0);entryReveal.lineTo((doorX+doorW/2+.10)*sx,0);entryReveal.lineTo((doorX+doorW/2+.10)*sx,2.85);entryReveal.lineTo((doorX-doorW/2-.10)*sx,2.85);entryReveal.closePath();entryReveal.holes.push(arch.clone());
  const entryGeo=new THREE.ExtrudeGeometry(entryReveal,{depth:1.12,bevelEnabled:false,curveSegments:10}),entryPosition=entryGeo.attributes.position;
  for(let i=0;i<entryPosition.count;i++)entryPosition.setZ(i,entryPosition.getZ(i)===0?-1.32:-.20);
  add(entryGeo,white,'curved entry reveal');
  box(doorX,1.30,-1.20,doorW-.14,2.40,.05,steel,'entry door');
  for(let y=.25;y<2.25;y+=.16)rod([doorX-.65,y,-1.14],[doorX+.65,y,-1.14],.011,windowFrame,'entry door rails');
  // Blue roof outlines are visible above the left tower; hidden rooftop equipment is omitted.
  for(const {x:balconyX,w:balconyW}of bays){
    box(balconyX,12.31,.32,balconyW+.16,.18,1.05,white,'balcony roof slab');
    box(balconyX,12.70,.79,balconyW+.16,.60,.22,white,'front roof parapet');
    for(const y of [12.43,12.96])box(balconyX,y,.93,balconyW+.24,.055,.06,blue,'blue parapet band');
  }
  // The corner source shows an open guard above the left tower, including a
  // short visible south return. Section sizes, spacing and height are inferred;
  // do not extend this detail around the unseen roof perimeter.
  const guardBottom=13.06,guardTop=13.44,guardFrontZ=.89;
  const guardLeft=bays[0].x-bays[0].w/2+.06,guardRight=bays[0].x+bays[0].w/2-.06;
  for(const y of [guardBottom,guardTop])rod([guardLeft,y,guardFrontZ],[guardRight,y,guardFrontZ],.011,steel,'left roof guard rail');
  const guardPosts=Math.ceil((guardRight-guardLeft)/.20);
  for(let i=0;i<=guardPosts;i++){const x=THREE.MathUtils.lerp(guardLeft,guardRight,i/guardPosts);rod([x,12.98,guardFrontZ],[x,guardTop,guardFrontZ],.008,steel,'left roof guard picket');}
  // Follow the actual mapped south parapet rather than inventing a parallel
  // return. The small corner junction between these sections is unresolved.
  const guardReturnStart=sp.clone().addScaledVector(sd,.12),guardReturnEnd=sp.clone().addScaledVector(sd,2.0);
  for(const y of [guardBottom,guardTop])rod([guardReturnStart.x/sx,y,guardReturnStart.z],[guardReturnEnd.x/sx,y,guardReturnEnd.z],.011,steel,'south roof guard rail');
  for(let i=0;i<=10;i++){const p=guardReturnStart.clone().lerp(guardReturnEnd,i/10);rod([p.x/sx,13.03,p.z],[p.x/sx,guardTop,p.z],.008,steel,'south roof guard picket');}
  for(const x of [-3.94,4.73])box(x,6.25,.09,.14,12.30,.24,blue,'balcony edge stripe');
  // Source boundary: blue piers and surround, recessed pale panels, simple steel gate.
  const gateZ=4.3,gateX=.75,gateW=2.15;
  group.add(buildAvinashGround(width));
  for(const [left,right]of [[-4.10,gateX-gateW/2],[gateX+gateW/2,width/2/sx]]){
    const middle=(left+right)/2,w=right-left;box(middle,.73,gateZ,w,1.46,.22,blue,'boundary surround');
    // Rounded upper corners are directly visible on the cream infill.
    const x0=(left+.22)*sx,x1=(right-.22)*sx,y0=.18,y1=1.32,r=.22,shape=new THREE.Shape();shape.moveTo(x0,y0);shape.lineTo(x1,y0);shape.lineTo(x1,y1-r);shape.quadraticCurveTo(x1,y1,x1-r,y1);shape.lineTo(x0+r,y1);shape.quadraticCurveTo(x0,y1,x0,y1-r);shape.closePath();shapePanel(shape,gateZ+.123,.016,white,'rounded boundary infill');
  }
  for(const [left,right]of [[-width/2/sx,-4.10],[gateX-gateW/2,gateX+gateW/2]]){
    for(const x of [left-.08,right+.08])box(x,.8,gateZ,.20,1.60,.31,blue,'gate pier');
    const lo=.14,hi=1.41,vehicleGate=left<-4.10;
    const latticeLo=vehicleGate?.50:lo,latticeHi=vehicleGate?1.09:hi,h=latticeHi-latticeLo;
    for(const y of [lo,hi])rod([left,y,gateZ+.04],[right,y,gateZ+.04],.022);
    for(let x=left;x<=right+.01;x+=.14)rod([x,lo,gateZ+.04],[x,hi,gateZ+.04],.009);
    // The clearly visible vehicle gate has a central diamond band with vertical
    // divisions above/below. The partly hidden pedestrian gate stays unchanged.
    if(vehicleGate)for(const y of [latticeLo,latticeHi])rod([left,y,gateZ+.06],[right,y,gateZ+.06],.011,steel,'vehicle gate band rail');
    for(const sign of [-1,1])for(let intercept=left-h;intercept<right+h;intercept+=.24){let y0=0,y1=h;if(sign>0){y0=Math.max(0,left-intercept);y1=Math.min(h,right-intercept);}else{y0=Math.max(0,intercept-right);y1=Math.min(h,intercept-left);}if(y1>y0)rod([intercept+sign*y0,latticeLo+y0,gateZ+.06],[intercept+sign*y1,latticeLo+y1,gateZ+.06],.007);}
  }
  // Displayed-name outlines only; lettering typeface and dimensions remain approximate.
  const nameX=-2.43,nameY=1.12,paths:THREE.Shape[]=[];
  for(const glyph of lettering.glyphs){const path=new THREE.ShapePath();for(const raw of glyph.commands){const [command,...values]=raw,v=values as number[];if(command==='M')path.moveTo(v[0]+glyph.advance,v[1]);else if(command==='L')path.lineTo(v[0]+glyph.advance,v[1]);else if(command==='Q')path.quadraticCurveTo(v[0]+glyph.advance,v[1],v[2]+glyph.advance,v[3]);else if(command==='C')path.bezierCurveTo(v[0]+glyph.advance,v[1],v[2]+glyph.advance,v[3],v[4]+glyph.advance,v[5]);else path.currentPath!.closePath();}paths.push(...path.toShapes());}
  const letters=new THREE.ExtrudeGeometry(paths,{depth:1,bevelEnabled:false,curveSegments:3});letters.computeBoundingBox();const bounds=letters.boundingBox!,scale=2.0*sx/(bounds.max.x-bounds.min.x);letters.translate(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,0);letters.scale(scale,.14/(bounds.max.y-bounds.min.y),.004);letters.translate(nameX*sx,nameY,gateZ+.144);add(letters,blue,'name lettering');
  for(const [m,geometries]of batches){const g=mergeGeometries(geometries,false);if(!g)throw new Error('Avinash merge failed');const mesh=new THREE.Mesh(g,m);mesh.name=m.name;mesh.castShadow=m!==glass;mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
  group.userData={wayId:AVINASH_WAY_ID,revision:7,roofMasonryTop:wallTop,entryReveal:{frontZ:-.20,backZ:-1.32,curveSegments:10},wallJoin:{outer:joinOuter.toArray(),inner:joinInner.toArray(),wallDepth,wallTop,pieces:joinPieces,method:'Mitered front/south masonry envelope; internal endcaps removed; exact mapped exterior corner retained'},redFacing:redFacing.evidence,width,height:AVINASH_HEIGHT,heightSource:AVINASH_HEIGHT_SOURCE,sourcePano:'jA1SRlYEzW_-i3dxbqIi3A',sourceSha256:'229abb2cf039a4e4dd3288adc152269e765ffceb76f20f5d51619adf3d5fbd1b',captureDate:'Unknown; copyright year does not date the photograph',association:'Conditional visible AVINASH APARTMENTS name and matching listing/Gazette address; listing pin 0.777 m outside unnamed OSM way 354839974',observedUpperBalconies:3,balconyStacks:2,alternateSourceSha256:'2d35b04f17f1193820473500dee4be1fefd88a6644cbf13364dafb382bf2d96e',frontEdge:[1,2],pose:group.position.toArray(),yaw:group.rotation.y,semantic,windowChecks,sideWindowChecks,greenGrille:greenProfile,balconyScreen:{xExtent:[screenLeft*sx,screenRight*sx],yExtent:[screenBottom-.035,screenTop],depthExtent:[screenZ-.016,screenZ+.027],limits:"Blue upper-half screening and pale bindings visible in the alternate corner source; movable condition, fabric, folds, support, dimensions and depth inferred. No capture-date match claimed."},condenser:{center:[acX*sx,acY],backZ:acBack,frontZ:acFront,width:.94*sx,height:.57,limits:"Cabinet beneath left balcony observed in alternate corner source; dimensions, fan layout, bracket sections and short service-line routing inferred. No brand or exact equipment identification."},gateZ,roofGuard:{bottom:guardBottom,top:guardTop,frontZ:guardFrontZ,frontExtent:[guardLeft*sx,guardRight*sx],southReturnLength:1.88,limits:'Source-visible left tower front and short south return only; height, sections, spacing and unresolved corner junction inferred'},vehicleGateBands:{verticalExtent:[.14,1.41],diamondExtent:[.50,1.09],limits:'Central diamond band observed in corner source; exact band heights and bar spacing inferred; pedestrian gate unchanged'},limits:'Two-angle visible frontage study; floor heights, bay widths, setback, construction and materials inferred. Alternate view establishes the red front band, second balcony stack, left roof guard and vehicle gate band relationships; foliage and van still hide portions. South upper finned windows are photo-informed; remaining rear/north walls plain. Green grille bow and broad ornament are source-informed approximations; exact fabrication and roof guard corner junction unresolved. Upper-left blue screening and outdoor AC cabinet follow visible corner-source details; movable screen state, equipment construction and dimensions inferred. No calibrated camera or photorealism pass.'};
  return group;
}
