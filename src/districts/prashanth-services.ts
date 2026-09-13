import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Source-visible equipment only; cabinet dimensions and fabrication are inferred. */
export function buildPrashanthServices(){
 const group=new THREE.Group();group.name='Prashanth source-visible condenser and electrical services';
 const paint=new THREE.MeshStandardMaterial({color:0xaaa99a,roughness:.88,metalness:.10});
 const edge=new THREE.MeshStandardMaterial({color:0x73796b,roughness:.76,metalness:.36});
 const dark=new THREE.MeshStandardMaterial({color:0x343c35,roughness:.9});
 const cable=new THREE.MeshStandardMaterial({color:0x32342d,roughness:.86});
 const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>();
 const add=(g:THREE.BufferGeometry,m:THREE.Material)=>{if(!buckets.has(m))buckets.set(m,[]);buckets.get(m)!.push(g);};
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m=paint){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,m);}
 function rod(a:number[],b:number[],r:number,m=edge){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const g=new THREE.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());add(g,m);}
 // The photograph has a circular fan on the left, not a full-width bar grille.
 const cx=-3.75,cy=2.62,z=.46,w=.72,h=.50;
 const fanX=cx-.115,fanR=.176;
 box(cx,cy,.027,w,h,.032);
 for(const x of [cx-w/2+.009,cx+w/2-.009])box(x,cy,.245,.018,h,.45);
 for(const y of [cy-h/2+.009,cy+h/2-.009])box(cx,y,.245,w,.018,.45);
 const front=new THREE.Shape();front.moveTo(cx-w/2,cy-h/2);front.lineTo(cx+w/2,cy-h/2);front.lineTo(cx+w/2,cy+h/2);front.lineTo(cx-w/2,cy+h/2);front.closePath();
 const fanHole=new THREE.Path();fanHole.absarc(fanX,cy,fanR,0,Math.PI*2,true);front.holes.push(fanHole);
 const face=new THREE.ExtrudeGeometry(front,{depth:.008,bevelEnabled:false,curveSegments:24});face.translate(0,0,z+.006);add(face,paint);
 const recess=new THREE.CircleGeometry(fanR,40);recess.translate(fanX,cy,z-.045);add(recess,dark);
 // Recessed stationary fan blades and a separate concentric wire guard.
 for(let i=0;i<5;i++){const blade=new THREE.Shape();blade.moveTo(.028,-.018);blade.quadraticCurveTo(.115,-.10,.158,-.022);blade.quadraticCurveTo(.12,.063,.03,.035);blade.closePath();const g=new THREE.ShapeGeometry(blade,5);g.rotateZ(i*Math.PI*2/5);g.translate(fanX,cy,z-.025);add(g,edge);}
 for(const radius of [.043,.077,.111,.146,.176]){const g=new THREE.TorusGeometry(radius,.0032,5,40);g.translate(fanX,cy,z+.037);add(g,edge);}
 for(let i=0;i<8;i++){const angle=i*Math.PI/4;rod([fanX,cy,z+.039],[fanX+Math.cos(angle)*fanR,cy+Math.sin(angle)*fanR,z+.039],.0028);}
 const hub=new THREE.CircleGeometry(.022,16);hub.translate(fanX,cy,z+.042);add(hub,paint);
 for(let i=0;i<9;i++)box(cx+.245,cy-.175+i*.041,z+.026,.115,.015,.009,dark);
 for(const x of [cx-w/2+.028,cx+w/2-.028])for(const y of [cy-h/2+.028,cy+h/2-.028]){const screw=new THREE.CircleGeometry(.006,8);screw.translate(x,y,z+.025);add(screw,edge);}
 // Small supporting wall brackets sit under the retained condenser envelope.
 for(const x of [cx-.25,cx+.25]){box(x,cy-h/2-.020,.255,.045,.035,.43,edge);box(x,cy-h/2-.105,.032,.045,.24,.045,edge);rod([x,cy-h/2-.18,.052],[x,cy-h/2-.025,.39],.011);}
 // The source shows exposed wires between the electrical panel and meters.
 const wirePaths=[[[1.07,2.18,.26],[1.04,1.98,.265],[1.19,1.91,.27]],[[1.24,2.16,.26],[1.42,2.00,.265],[1.57,1.84,.27]],[[1.09,1.57,.23],[1.10,1.36,.23],[1.25,1.26,.23],[1.38,1.40,.23],[1.38,1.55,.23]]];
 for(const points of wirePaths){const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),18,.008,5,false);add(g,cable);}
 for(const [x,y,width,height] of [[1.25,1.82,.36,.54],[1.62,1.63,.25,.31],[1.15,2.35,.61,.45]]){
  for(const xx of [x-width/2+.035,x+width/2-.035])for(const yy of [y-height/2+.035,y+height/2-.035]){const g=new THREE.CircleGeometry(.005,6);g.translate(xx,yy,.246);add(g,edge);}
 }
 for(const [material,list] of buckets){const geometry=mergeGeometries(list,false);if(!geometry)throw Error('Prashanth equipment merge failed');const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=material===paint;mesh.receiveShadow=true;group.add(mesh);list.forEach(g=>g.dispose());}
 group.userData={sourceSha256:'fa39e258ed439253ecf20342e1d614315bb7a422626f8a128951fabfcdb627ea',observed:'Circular left fan and narrow right grille on pale outdoor condenser; exposed short dark electrical wires at ground service panel.',retainedCondenserEnvelope:{center:[cx,cy,.24],size:[w,h,.46]},limits:'Original inferred fabrication within retained equipment envelope. Fan blade count, guard rings, fasteners, brackets, wire paths and material reflectance are not measured. Stationary visual model, no brand or present installation claim. No source photo pixels.'};
 return group;
}
