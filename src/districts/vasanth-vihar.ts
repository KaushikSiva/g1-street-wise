import {buildVasanthGround,sampleVasanthApronLocal} from './vasanth-ground';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLakshmiPlaster,setLakshmiMaterialUV} from './lakshmi-material';
import type {FrontageBarrier} from './frontage-barriers';
import {buildVasanthPassageBoundary} from './vasanth-passage';
import {buildVasanthGate} from './vasanth-gate';
import {buildVasanthWindowAC} from './vasanth-window-ac';
import {applyVasanthWeathering} from './vasanth-plaster';

export const VASANTH_WAY_ID=354840013;
export const VASANTH_HEIGHT=12.4;
export const VASANTH_HEIGHT_SOURCE='Photographic ground plus three upper levels; inferred 3.1 m pitch, unmeasured roof height';
type Point={x:number;z:number};
type Data={elements:{id:number;geometry?:{lat:number;lon:number}[]}[]};
const gateZ=3.0, passageWidth=2.4;
function frame(points:Point[]){
  if(points.length!==4)throw new Error('Vasanth Vihar requires its four mapped corners');
  const a=new THREE.Vector3(points[1].x,0,points[1].z),b=new THREE.Vector3(points[2].x,0,points[2].z),d=b.clone().sub(a).normalize();
  const group=new THREE.Group();group.position.copy(a).lerp(b,.5);group.rotation.y=Math.atan2(d.z,-d.x);group.updateMatrixWorld(true);
  return {group,width:a.distanceTo(b),polygon:points.map(p=>group.worldToLocal(new THREE.Vector3(p.x,0,p.z)))};
}
export function createVasanthGroundHeightSampler(data:Data){
  const geometry=data.elements.find(e=>e.id===VASANTH_WAY_ID)?.geometry;
  if(!geometry)return ()=>null;
  const east=111320*Math.cos(13.0516624*Math.PI/180);
  const {group,width,polygon}=frame(geometry.slice(0,-1).map(p=>({x:(p.lon-80.2306892)*east,z:(13.0516624-p.lat)*111320})));
  const inverse=group.matrixWorld.clone().invert(),rear=Math.min(...polygon.map(p=>p.z));
  return (x:number,z:number):number|null=>{
    const p=new THREE.Vector3(x,0,z).applyMatrix4(inverse);
    const apron=sampleVasanthApronLocal(p.x,p.z);
    if(apron!==null)return apron;
    return p.z>=rear&&p.z<0&&p.x>=width/2&&p.x<=width/2+passageWidth?0:null;
  };
}

/** Original geometry from privately reviewed exterior references; no source photo textures. */
export function buildVasanthVihar(points:Point[]){
  const {group,width,polygon}=frame(points);group.name='Vasanth Vihar · partial photographed frontage';
  const barriers:FrontageBarrier[]=[];
  const base=createLakshmiPlaster();
  const plaster=(name:string,color:number)=>{const m=base.clone();m.name='Vasanth '+name;m.color.setHex(color);return m;};
  const pale=plaster('pale green plaster',0xcbd0b4),cream=plaster('cream frames',0xd8d7bf),olive=plaster('olive ground storey',0x888c65),concrete=plaster('concrete',0x96988b);
  applyVasanthWeathering(pale,'wall');applyVasanthWeathering(cream,'trim');applyVasanthWeathering(olive,'base');
  const steel=new THREE.MeshStandardMaterial({name:'Vasanth black metalwork',color:0x303931,roughness:.72,metalness:.3});
  const glass=new THREE.MeshStandardMaterial({name:'Vasanth glazing',color:0x53635c,roughness:.38,metalness:.12});
  const inner=new THREE.MeshStandardMaterial({name:'Vasanth recess interior',color:0x666b53,roughness:.97});
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>(),apertures:{point:number[];normal:number[];edge:number}[]=[];
  function add(g:THREE.BufferGeometry,m:THREE.Material){
    if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.clearGroups();
    // Earcut may emit zero-area triangles between aligned aperture corners.
    const p=g.attributes.position,keep:number[]=[];
    for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-20)keep.push(i,i+1,i+2);}
    if(keep.length!==p.count){const clean=new THREE.BufferGeometry();for(const [name,a]of Object.entries(g.attributes))clean.setAttribute(name,new THREE.Float32BufferAttribute(keep.flatMap(i=>Array.from({length:a.itemSize},(_,j)=>a.array[i*a.itemSize+j])),a.itemSize));g.dispose();g=clean;}
    if([pale,cream,olive,concrete].includes(m as THREE.MeshStandardMaterial))setLakshmiMaterialUV(g);
    if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(g);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,matrix?:THREE.Matrix4){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);if(matrix)g.applyMatrix4(matrix);add(g,m);}
  for(const y of [0,VASANTH_HEIGHT]){const shape=new THREE.Shape(polygon.map(p=>new THREE.Vector2(p.x,-p.z))),g=new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y-.16,0);add(g,concrete);}
  for(let edge=0;edge<4;edge++){
    const a=polygon[edge],b=polygon[(edge+1)%4],d=b.clone().sub(a).normalize(),normal=new THREE.Vector3(d.z,0,-d.x),w=a.distanceTo(b);
    const matrix=new THREE.Matrix4().compose(a.clone().lerp(b,.5),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(normal.x,normal.z)),new THREE.Vector3(1,1,1));
    const localBox=(x:number,y:number,z:number,ww:number,h:number,dd:number,m:THREE.Material)=>box(x,y,z,ww,h,dd,m,matrix);
    for(const level of [0,1,2,3]){
      const bottom=level*3.1,wall=new THREE.Shape();wall.moveTo(-w/2,bottom);wall.lineTo(w/2,bottom);wall.lineTo(w/2,bottom+3.1);wall.lineTo(-w/2,bottom+3.1);wall.closePath();
      // Only the east facade and its photographed north return receive openings.
      const openings=edge===1?[[w*.32,1.50],[-w*.04,.64],[-w*.31,1.35]]:edge===0?[[ -w*.35,1.40],[w*.04,1.32]]:[];
      for(const [x,ww]of openings){
        const y=bottom+.62,h=2.12,depth=.64;
        const hole=new THREE.Path();hole.moveTo(x-ww/2,y);hole.lineTo(x-ww/2,y+h);hole.lineTo(x+ww/2,y+h);hole.lineTo(x+ww/2,y);hole.closePath();wall.holes.push(hole);
        localBox(x,y+h/2,-depth-.05,ww,h,.10,inner);
        for(const xx of [x-ww/2+.045,x+ww/2-.045])localBox(xx,y+h/2,-depth/2,.09,h,depth,cream);
        for(const yy of [y+.045,y+h-.045])localBox(x,yy,-depth/2,ww-.18,.09,depth,cream);
        localBox(x,y+h/2,-depth+.06,ww-.18,h-.18,.012,glass);
        localBox(x,y+h/2,-depth+.10,.045,h-.18,.04,steel);
        for(const yy of [y+.10,y+h-.10])localBox(x,yy,-depth+.10,ww-.18,.045,.04,steel);
        if(level===0||ww<1){for(let xx=x-ww/2+.15;xx<x+ww/2-.09;xx+=.16)localBox(xx,y+h/2,.08,.014,h-.12,.014,steel);}
        if(ww>1){localBox(x,y-.06,.19,ww+.28,.14,.60,cream);localBox(x,y+h+.10,.19,ww+.28,.16,.60,cream);}
        apertures.push({point:new THREE.Vector3(x-ww*.21,y+h*.7,-depth+.066).applyMatrix4(matrix).toArray(),normal:normal.toArray(),edge});
      }
      const g=new THREE.ExtrudeGeometry(wall,{depth:.20,bevelEnabled:false});g.translate(0,0,-.20);g.applyMatrix4(matrix);add(g,level===0?olive:pale);
    }
    if(edge===0||edge===1){
      for(const y of [3.1,6.2,9.3,12.2])localBox(0,y,.08,w,.20,.32,cream);
      for(const x of [-w/2+.18,w/2-.18])localBox(x,7.65,.14,.30,9.10,.48,cream);
      // Visible shallow service runs; routing and diameters remain inferred.
      localBox(w/2-.55,5.8,.23,.045,11.4,.045,concrete);
      localBox(0,2.92,.26,w,.045,.045,concrete);
    }
  }
  const windowAC=buildVasanthWindowAC(width*.32);group.add(windowAC);
  const rear=Math.min(...polygon.map(p=>p.z)),sideX=width/2+passageWidth/2;
  const ground=buildVasanthGround(width,rear);group.add(ground);
  const passageBoundary=buildVasanthPassageBoundary(width,passageWidth,gateZ);group.add(passageBoundary.group);barriers.push(passageBoundary.barrier);
  box(0,.68,gateZ,width,1.36,.20,pale);
  barriers.push({x:0,z:gateZ,width,depth:.20,kind:'boundary wall'});
  for(const x of [-width/2+.14,width/2,width/2+passageWidth]){box(x,.96,gateZ,.30,1.92,.34,cream);box(x,1.95,gateZ,.42,.12,.44,cream);barriers.push({x,z:gateZ,width:.30,depth:.34,kind:'boundary pier'});}
  // The named exterior resolves a pale shaped finial above the numbered post.
  // Only that observed post receives it; dimensions/profile are inferred.
  const capProfile=[[0,0],[.09,0],[.09,.045],[.19,.12],[.10,.20],[0,.31]];
  const cap=new THREE.LatheGeometry(capProfile.map(([r,y])=>new THREE.Vector2(r,y)),4);cap.rotateY(Math.PI/4);cap.translate(width/2,2.01,gateZ);add(cap,cream);
  const gate=buildVasanthGate(sideX,gateZ,passageWidth-.30);group.add(gate);
  barriers.push({x:sideX,z:gateZ,width:passageWidth-.30,depth:.045,kind:'closed gate'});
  for(const [m,gs]of batches){const geometry=mergeGeometries(gs,false);if(!geometry)throw new Error('Vasanth geometry merge failed');const mesh=new THREE.Mesh(geometry,m);mesh.name=m.name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);gs.forEach(g=>g.dispose());}
  // Original text on a generated canvas; no private image pixels are redistributed.
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#d5d6c2';ctx.fillRect(0,0,768,192);ctx.fillStyle='#545b50';ctx.textAlign='center';ctx.font='44px serif';ctx.fillText('VASANTH VIHAR',384,106);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.8,.70),new THREE.MeshStandardMaterial({map:texture,roughness:.9}));sign.name='Vasanth original nameplate';sign.position.set(width/2-2.3,.78,gateZ+.106);group.add(sign);
  const numberPlates=[];
  for(const [text,y,oval]of [['8',1.62,false],['12',1.23,true]] as const){
    const c=document.createElement('canvas');c.width=256;c.height=256;
    const context=c.getContext('2d')!;context.fillStyle=oval?'#393d43':'#e0e0d4';context.fillRect(0,0,256,256);
    context.fillStyle=oval?'#e6e4d9':'#353b38';context.font='bold 130px serif';context.textAlign='center';context.textBaseline='middle';context.fillText(text,128,140);
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
    const geometry=oval?new THREE.CircleGeometry(.13,32):new THREE.PlaneGeometry(.24,.24);
    if(oval)geometry.scale(.82,1,1);
    const plate=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map,roughness:.82}));plate.name='Vasanth address '+text;plate.position.set(width/2,y,gateZ+.174);group.add(plate);
    numberPlates.push({text,shape:oval?'oval':'square',position:plate.position.toArray()});
  }
  group.userData={wayId:VASANTH_WAY_ID,revision:7,passageBoundary:passageBoundary.group.userData,gate:gate.userData,windowAC:windowAC.userData,ground:ground.userData,width,height:VASANTH_HEIGHT,localPolygon:polygon.map(p=>p.toArray()),apertures,barriers,numberPlates,numberedPostCap:{base:[width/2,2.01,gateZ],profile:capProfile,inferred:true},weathering:'Original metre-space pigment/deposit variation, ledge runoff and lower-wall discoloration; no baked light or private pixels. Extent and finish unmeasured.',gateZ,passageWidth,observedUpperLevels:3,sourceSha256:['d7f1bb013feac07661ecf78e023c289feac6d6acd128552581f5426570801742','71a828907cbb350fae1dcd47e88f43fec430c6368ddc901832992e3f48541121'],limits:'Exact mapped four-corner footprint. Partial east/north frontage from named private exterior references. Height, aperture dimensions and count behind vegetation, recesses, material colors, gate pose, support extents and service routes are inferred. Boundary numbers8/12 are observed; old/new numbering is unresolved. Plate dimensions, cap profile and font are inferred. Unseen south/rear walls stay plain. No private source pixels in runtime.'};
  return group;
}
