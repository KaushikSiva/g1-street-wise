// Capture actual application behaviour. The visible captions are demo annotations.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const base=process.env.STREETWISE_URL||'http://127.0.0.1:5189';
const media=path.resolve('artifacts/fork/media');const timeline=JSON.parse(await fs.readFile(path.join(media,'demo-timeline.json'),'utf8'));
const hazards=JSON.parse(await fs.readFile('public/assets/fork/hazard-experiment.json','utf8'));
const carSeed=hazards.replays.before.find(r=>r.hazard==='moving_car'&&r.outcome.contact&&r.outcome.elapsed<=6&&hazards.replays.after.find(a=>a.seed===r.seed)?.outcome.success).seed;
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:'.fork-runs/media/capture',size:{width:1920,height:1080}}});
await context.route('**/demo-media/*',async r=>{const name=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({path:path.join(media,name)});});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'/?robot=1');await page.waitForFunction(()=>window.forkRobot?.ready,null,{timeout:60000});
await page.evaluate(()=>window.forkRobot.curriculum('hazards'));await page.evaluate(()=>window.forkRobot.curriculum('crossing'));
await page.evaluate(()=>{window.forkRobot.select('after',20002);window.forkRobot.seek(3);document.querySelectorAll('.robot-title,.mode-switch,.replay-badge,.robot-live,#cinema,.cinema-shade').forEach(e=>e.style.visibility='hidden');});
await page.locator('#g1-scene').screenshot({path:path.join(media,'hero.png')});
await page.evaluate(()=>document.querySelectorAll('.robot-title,.mode-switch,.replay-badge,.robot-live,#cinema,.cinema-shade').forEach(e=>e.style.visibility=''));
await page.evaluate(({base,timeline,carSeed})=>{window.demoCarSeed=carSeed;
 const style=document.createElement('style');style.textContent='#demo-caption{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);max-width:1260px;padding:10px 22px;background:#10271eee;color:#fff9ec;border-radius:4px;font:27px/1.4 Arial;text-align:center;z-index:99999;pointer-events:none}#demo-overlay{position:fixed;inset:0;background:#f1f0e7;z-index:9998;display:none;padding:60px;box-sizing:border-box;color:#284034;font-family:Arial}#demo-overlay h1{font-size:54px;letter-spacing:-2px;margin:10px 0 30px}#demo-overlay img{width:100%;height:610px;object-fit:contain}#demo-world{position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9997;display:none}';document.head.append(style);
 const caption=document.createElement('div');caption.id='demo-caption';document.body.append(caption);
 const overlay=document.createElement('div');overlay.id='demo-overlay';document.body.append(overlay);
 const world=document.createElement('iframe');world.id='demo-world';world.src=base+'/?fork=1';document.body.append(world);
 window.demoTimeline=timeline;
}, {base,timeline,carSeed});
const world=page.frameLocator('#demo-world');await world.locator('#play').waitFor({state:'attached'});await page.waitForFunction(()=>{const w=document.querySelector('#demo-world').contentWindow;return w.fork&&w.fork.model;},{timeout:60000});
await page.evaluate(()=>{window.forkRobot.select('before',20002);window.forkRobot.seek(0);});
const start=Date.now();let lastPhase=-1;
while(Date.now()-start<118000){
 const t=(Date.now()-start)/1000;const phase=t<12?0:t<27?1:t<43?2:t<58?3:t<64?4:t<72?5:t<78?6:t<96?7:t<102?8:t<108?9:10;
 if(phase!==lastPhase){
  if(phase===1)await page.evaluate(()=>{window.forkRobot.select('before',20002);document.querySelector('.robot-title h1').innerHTML='Before learning.';document.querySelector('.robot-title p').innerHTML='Constant forward command · same held-out encounter';});
  if(phase===2)await page.evaluate(()=>{window.forkRobot.select('after',20002);document.querySelector('.robot-title h1').innerHTML='A better decision.';document.querySelector('.robot-title p').innerHTML='Trained navigation · same frozen walking policy';});
  if(phase===3)await page.evaluate(()=>{const o=document.querySelector('#demo-overlay');o.style.display='block';o.innerHTML='<h1>Measured improvement. Unseen encounters.</h1><img src="/demo-media/learning-evidence.png"><p>Actual W&B history · run 8upngyv4 · checkpoint selected on validation, then tested.</p>';});
  if(phase===4){await page.evaluate(()=>window.forkRobot.curriculum('hazards'));await page.evaluate(()=>{document.querySelector('#demo-overlay').style.display='none';window.forkRobot.select('before',window.demoCarSeed);document.querySelector('.robot-title h1').innerHTML='A changing street.';document.querySelector('.robot-title p').innerHTML='Moving car · constant forward command';});}
  if(phase===5)await page.evaluate(()=>{window.forkRobot.select('after',window.demoCarSeed);document.querySelector('.robot-title p').innerHTML='Moving car · trained navigation · excerpt from recorded encounter';});
  if(phase===6)await page.evaluate(()=>{window.forkRobot.select('after',20003);document.querySelector('.robot-title p').innerHTML='Marked road defect · avoidance footprint, not deformed terrain';});
  if(phase===7){await page.evaluate(()=>{document.querySelector('#demo-world').style.display='block';});await world.locator('#play').click();}
  if(phase===8)await page.evaluate(()=>{document.querySelector('#demo-world').style.display='none';const o=document.querySelector('#demo-overlay');o.style.display='block';o.innerHTML='<h1>Open the experiment. Inspect the evidence.</h1><img src="/demo-media/marimo.png"><p>Actual marimo lab screenshot · source and notebook included.</p>';});
  if(phase===9)await page.evaluate(()=>{document.querySelector('#demo-overlay').innerHTML='<img style="height:720px" src="/demo-media/architecture.svg">';});
  if(phase===10)await page.evaluate(()=>{const o=document.querySelector('#demo-overlay');o.style.background='linear-gradient(90deg,#173528ee,#17352855),url(/demo-media/hero.png) center/cover';o.style.color='#f3f0e3';o.innerHTML='<h1 style="font-size:100px;margin-top:120px">STREETWISE</h1><p style="font-size:38px;line-height:1.4">Robots that learn the street<br>before they enter it.</p><p style="font-size:28px;margin-top:65px">github.com/KaushikSiva/g1-street-wise</p><p>Recorded simulation · no physical robot safety claim</p>';});
  console.log('Recorded scene',phase,'at',t.toFixed(1));lastPhase=phase;
 }
 if(t>85&&t<86)await world.locator('#learn').evaluate(e=>{if(!window.__demoLearnClicked&&!e.disabled){window.__demoLearnClicked=true;e.click();}});
 await page.evaluate(({t,phase})=>{
  const segment=window.demoTimeline.find(s=>t>=s.start&&t<s.end);if(segment){const words=segment.text.split(' ');const count=Math.ceil(words.length/12);const i=Math.min(count-1,Math.floor((t-segment.start)/(segment.end-segment.start)*count));document.querySelector('#demo-caption').textContent=words.slice(i*12,i*12+12).join(' ');}
  const r=window.forkRobot;if(phase===1)r.seek(t-12);if(phase===2)r.seek(t-27);if(phase===4)r.seek(t-58);if(phase===5)r.seek(3+t-64);if(phase===6)r.seek(1+t-72);
 },{t,phase});
 await page.waitForTimeout(70);
}
const video=page.video();await context.close();const file=await video.path();await browser.close();await fs.writeFile(path.join(media,'capture-evidence.json'),JSON.stringify({file:path.basename(file),seconds:118,carSeed,pedestrianSeed:20002,errors,source:'Actual browser recording; joint trajectories are recorded MuJoCo; captions and title cards added for the demo.'},null,2));await fs.writeFile('.fork-runs/media/capture-path.txt',file);console.log('Video recording saved');
