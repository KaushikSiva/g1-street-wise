import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const phase=process.argv[2]||'before',out='artifacts/web-city-realism/revision-4';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5188/?robot=1');
 await page.waitForFunction(()=>window.forkRobot?.ready,null,{timeout:120000});
 await page.waitForTimeout(1500);
 const source=JSON.parse(await readFile('public/reference/kodambakkam-osm.json','utf8'));
 const geometry=source.elements.find(e=>e.id===354839696).geometry;
 const poses=await page.evaluate(geometry=>{
  const points=geometry.slice(0,-1).map(p=>[(p.lon-80.2306892)*111320*Math.cos(13.0516624*Math.PI/180),(13.0516624-p.lat)*111320]);
  const c=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
  const road=window.forkRobot.scene.frame;let best;
  const area=points.reduce((a,p,i)=>a+p[0]*points[(i+1)%points.length][1]-p[1]*points[(i+1)%points.length][0],0);
  points.forEach((a,i)=>{const b=points[(i+1)%points.length],m=[(a[0]+b[0])/2,(a[1]+b[1])/2],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),n=[dz/len*Math.sign(area),-dx/len*Math.sign(area)];const d=Math.abs((m[0]-road.start.x)*road.direction.z-(m[1]-road.start.z)*road.direction.x);if(!best||d<best.d)best={m,n,d,a,b,len};});
  return [{name:'street',camera:window.forkRobot.scene.camera.position.toArray(),target:window.forkRobot.scene.controls.target.toArray()},
   {name:'neighbor',camera:[best.m[0]+best.n[0]*19,4.7,best.m[1]+best.n[1]*19],target:[best.m[0],3.6,best.m[1]]},
   {name:'construction',camera:[best.a[0]+(best.b[0]-best.a[0])*.10+best.n[0]*6,4.2,best.a[1]+(best.b[1]-best.a[1])*.10+best.n[1]*6],target:[best.a[0]+(best.b[0]-best.a[0])*.08,4.0,best.a[1]+(best.b[1]-best.a[1])*.08]}];
 },geometry);
 await page.addStyleTag({content:'.robot-title,.cinema-shade,.robot-live,.replay-badge,.mode-switch,#cinema{visibility:hidden}'});
 for(const pose of poses){await page.evaluate(p=>{const s=window.forkRobot.scene;s.camera.position.fromArray(p.camera);s.controls.target.fromArray(p.target);s.controls.update();},pose);await page.waitForTimeout(500);await page.locator('#g1-scene').screenshot({path:`${out}/${phase}-${pose.name}.png`});}
 const result=await page.evaluate(()=>{const s=window.forkRobot.scene;let group; s.scene.traverse(o=>{if(o.name.startsWith('Central Avenue neighbors'))group=o;});let vertices=0,triangles=0,finite=true;group.traverse(o=>{if(o.isMesh){const a=o.geometry.attributes.position;vertices+=a.count;triangles+=(o.geometry.index?.count||a.count)/3;for(const n of a.array)if(!Number.isFinite(n))finite=false;}});return {...group.userData,vertices,triangles,finite,meshes:group.children.length,buildingCount:s.scene.children.find(g=>g.userData.buildingCount)?.userData.buildingCount};});
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(p=>{const s=window.forkRobot.scene;s.camera.position.fromArray(p.camera);s.controls.target.fromArray(p.target);s.controls.update();},poses[0]);await page.waitForTimeout(500);
 const performanceSample=await page.evaluate(async()=>{const times=[];let prev=await new Promise(r=>requestAnimationFrame(r));for(let i=0;i<45;i++){const t=await new Promise(r=>requestAnimationFrame(r));times.push(t-prev);prev=t;}times.sort((a,b)=>a-b);return {p50:times[22],p90:times[40],overflow:document.documentElement.scrollWidth>innerWidth};});
 await page.screenshot({path:`${out}/${phase}-mobile.png`});
 const report={phase,errors,...result,...performanceSample,poses,mapSha256:createHash('sha256').update(await readFile('public/reference/kodambakkam-osm.json')).digest('hex'),performanceScope:'45 browser animation intervals at emulated 390x844 on this Mac; not physical-phone evidence'};
 await writeFile(`${out}/${phase}-verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(errors.length||!result.finite||result.buildingCount!==1173||performanceSample.overflow)throw new Error('Browser verification failed');
} finally {await browser.close();}
