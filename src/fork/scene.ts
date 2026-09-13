import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildNeighborhood} from '../buildings';
import {buildCentralAvenue,centralAvenueFrame} from '../districts/central-avenue';
import {buildRams13Frontage} from '../districts/rams-13-frontage';
import {type Forecast} from './learning';
import {VAN,type Episode,type Action,DT} from './simulation';
const COLORS={continue:0xd7a14a,peek:0x77bcb5,wait:0xb19bc8};
export class ForkScene{
 renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(48,1,.1,1600);controls:OrbitControls;
 frame:NonNullable<ReturnType<typeof centralAvenueFrame>>|null=null;
 stage=new THREE.Group();robot:THREE.Group;pedestrian:THREE.Group;ghostRobot:THREE.Group;ghostPed:THREE.Group;paths=new THREE.Group();
 renderFrame:(()=>void)|null=null;
 coverage=0;error='';time=0;running=false;private last=0;private episode:Episode|null=null;private prediction:Forecast|null=null;
 onTime:(t:number)=>void=()=>{};ready:Promise<void>;private sizes:ResizeObserver;private previews:HTMLElement[]=[];private forecastViews:Forecast[]=[];
 constructor(readonly canvas:HTMLCanvasElement){
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor(0xbac8c6);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;
  this.scene.background=new THREE.Color(0xbac8c6);this.scene.fog=new THREE.Fog(0xbac8c6,120,400);
  this.scene.add(new THREE.HemisphereLight(0xe5f3ff,0x8a795d,2.2));const sun=new THREE.DirectionalLight(0xffedcf,3.0);sun.position.set(-145,100,-160);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:250});sun.shadow.normalBias=.025;this.scene.add(sun,sun.target);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),new THREE.MeshStandardMaterial({color:0xb7ae98,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.05;ground.receiveShadow=true;this.scene.add(ground);
  this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=true;this.controls.minDistance=7;this.controls.maxDistance=70;this.controls.maxPolarAngle=Math.PI/2-.05;
  this.robot=this.actor(0x74bcb3,true);this.pedestrian=this.actor(0xd5a250,false);this.ghostRobot=this.actor(0xffffff,true,true);this.ghostPed=this.actor(0xffffff,false,true);
  this.stage.add(this.robot,this.pedestrian,this.ghostRobot,this.ghostPed,this.paths);this.scene.add(this.stage);
  this.sizes=new ResizeObserver(()=>this.resize());this.sizes.observe(canvas.parentElement!);this.resize();
  this.ready=this.load(sun);requestAnimationFrame(t=>this.animate(t));
 }
 private actor(color:number,robot:boolean,ghost=false){const g=new THREE.Group();const material=new THREE.MeshStandardMaterial({color,roughness:.55,metalness:robot?.25:0,transparent:ghost,opacity:ghost?.26:1,depthWrite:!ghost});
  const mesh=(geometry:THREE.BufferGeometry,x:number,y:number,z:number)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=!ghost;g.add(m);};
  if(robot){mesh(new THREE.BoxGeometry(.44,.68,.28),0,1.05,0);mesh(new THREE.BoxGeometry(.33,.28,.28),0,1.55,0);for(const x of [-.16,.16])mesh(new THREE.BoxGeometry(.13,.57,.16),x,.43,0);for(const x of [-.32,.32])mesh(new THREE.BoxGeometry(.12,.56,.14),x,1.02,0);const visor=new THREE.Mesh(new THREE.BoxGeometry(.25,.075,.01),new THREE.MeshStandardMaterial({color:0x172a2a,emissive:0x284b49}));visor.position.set(0,1.57,-.146);g.add(visor);}
  else{mesh(new THREE.CapsuleGeometry(.20,.43,4,8),0,1.05,0);mesh(new THREE.SphereGeometry(.16,12,8),0,1.57,0);for(const x of [-.12,.12])mesh(new THREE.CapsuleGeometry(.07,.48,3,6),x,.42,0);}
  const ring=new THREE.Mesh(new THREE.RingGeometry(.36,.41,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:ghost?.25:.8,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;g.add(ring);return g;
 }
 private async load(sun:THREE.DirectionalLight){try{const response=await fetch('/reference/kodambakkam-osm.json');if(!response.ok)throw new Error('Mapped neighborhood could not load');const data=await response.json();this.frame=centralAvenueFrame(data);if(!this.frame)throw new Error('Central Avenue centerline is missing');const b=buildNeighborhood(data);this.coverage=b.userData.buildingCount;this.scene.add(b,buildCentralAvenue(data),buildRams13Frontage());
  const origin=this.frame.point(42,0);this.stage.position.copy(origin);this.stage.scale.x=-1;this.stage.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(this.frame.normal.clone().negate(),new THREE.Vector3(0,1,0),this.frame.direction));
  // An explicitly synthetic occluder. Its rectangle exactly matches the sensor model.
  const van=new THREE.Group(),body=new THREE.MeshStandardMaterial({color:0xe6e4d9,roughness:.65});const box=(w:number,h:number,d:number,x:number,y:number,z:number,m=body)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;van.add(o);};
  const cx=(VAN.nMin+VAN.nMax)/2,cz=(VAN.sMin+VAN.sMax)/2;box(VAN.nMax-VAN.nMin,1.95,VAN.sMax-VAN.sMin,cx,1.24,cz);const glass=new THREE.MeshStandardMaterial({color:0x304a4a,roughness:.25});box(.014,.68,1.7,VAN.nMax+.01,1.78,cz,glass);
  for(const n of [VAN.nMin+.1,VAN.nMax-.1])for(const s of [VAN.sMin+.5,VAN.sMax-.5]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.16,16),new THREE.MeshStandardMaterial({color:0x202629,roughness:.9}));w.rotation.z=Math.PI/2;w.position.set(n,.30,s);van.add(w);}this.stage.add(van);
  const finish=new THREE.Mesh(new THREE.PlaneGeometry(2.5,.1),new THREE.MeshBasicMaterial({color:0x75bcb4,transparent:true,opacity:.75}));finish.rotation.x=-Math.PI/2;finish.position.set(.3,.05,2);this.stage.add(finish);
  sun.target.position.copy(origin);sun.position.copy(origin).add(new THREE.Vector3(-25,45,30));this.resetCamera();
 }catch(e){this.error=e instanceof Error?e.message:String(e);throw e;}}
 resetCamera(){if(!this.frame)return;this.camera.position.copy(this.frame.point(34,13,12));this.controls.target.copy(this.frame.point(41,0,1));this.controls.update();}
 private resize(){const r=this.canvas.parentElement!.getBoundingClientRect();this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
 setPreviews(elements:HTMLElement[],forecasts:Forecast[]){this.previews=elements;this.forecastViews=forecasts;}
 setEpisode(e:Episode,p:Forecast){this.episode=e;this.prediction=p;this.time=0;this.running=false;this.drawPaths(p);this.pose();}
 private drawPaths(p:Forecast){while(this.paths.children.length){const o=this.paths.children[0] as THREE.Line;o.geometry.dispose();(o.material as THREE.Material).dispose();this.paths.remove(o);}for(const [offset,color]of [[0,COLORS[p.action]],[2,0xf0dcba]]){const geometry=new THREE.BufferGeometry().setFromPoints(p.points.map(v=>new THREE.Vector3(v[offset],.07,v[offset+1])));const line=new THREE.Line(geometry,new THREE.LineDashedMaterial({color,dashSize:.15,gapSize:.10,transparent:true,opacity:.8}));line.computeLineDistances();this.paths.add(line);}}
 seek(t:number){this.time=Math.max(0,Math.min(6,t));this.pose();this.onTime(this.time);}
 private pose(){if(!this.episode||!this.prediction)return;const i=Math.min(120,Math.round(this.time/DT)),s=this.episode.states[i],p=this.prediction.points[i];this.robot.position.set(s.rn,.045,s.rs);this.pedestrian.position.set(s.pn,.045,s.ps);this.pedestrian.rotation.y=Math.PI/2;this.ghostRobot.position.set(p[0],.045,p[1]);this.ghostPed.position.set(p[2],.045,p[3]);this.ghostPed.rotation.y=Math.PI/2;}
 private animate(t:number){requestAnimationFrame(n=>this.animate(n));if(this.running){this.time=Math.min(6,this.time+Math.min(.08,(t-this.last)/1000));this.pose();this.onTime(this.time);if(this.time===6)this.running=false;}this.last=t;this.controls.update();if(this.renderFrame)this.renderFrame();else this.renderer.render(this.scene,this.camera);this.paintPreviews();}
 private paintPreviews(){for(let j=0;j<this.previews.length;j++){const element=this.previews[j] as HTMLCanvasElement,c=element.getContext('2d'),f=this.forecastViews[j];if(!c||!f)continue;const w=element.width,h=element.height;c.clearRect(0,0,w,h);c.fillStyle='#273736';c.fillRect(0,0,w,h);const xy=(n:number,s:number)=>[w*.5+n*w/11,h*.86-(s+6)*h/14];c.strokeStyle='#ffffff14';for(const n of [-3,3]){const [x]=xy(n,0);c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}const [vx,vy]=xy(VAN.nMin,VAN.sMax);c.fillStyle='#d2cebf';c.fillRect(vx,vy,(VAN.nMax-VAN.nMin)*w/11,(VAN.sMax-VAN.sMin)*h/14);
  for(const [offset,color]of [[0,'#'+COLORS[f.action].toString(16)],[2,'#e4d3ad']] as const){c.strokeStyle=color;c.setLineDash([3,3]);c.beginPath();f.points.forEach((p,i)=>{const [x,y]=xy(p[offset],p[offset+1]);if(i===0)c.moveTo(x,y);else c.lineTo(x,y);});c.stroke();c.setLineDash([]);const p=f.points[Math.min(120,Math.round(this.time/DT))],[x,y]=xy(p[offset],p[offset+1]);c.fillStyle=color;c.beginPath();c.arc(x,y,offset===0?5:4,0,Math.PI*2);c.fill();}
 }}
 get currentAction():Action|undefined{return this.episode?.action;}
}
