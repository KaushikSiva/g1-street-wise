import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.STREETWISE_URL||'http://127.0.0.1:5189';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'/?robot=1');await page.waitForFunction(()=>window.forkRobot?.ready,{timeout:60000});
assert.match(await page.locator('#success-comparison').innerText(),/42 → 64/);
await page.screenshot({path:'artifacts/fork/media/desktop.png',fullPage:true});
await page.locator('#robot-play').click();await page.waitForTimeout(400);await page.locator('#robot-play').click();const paused=await page.evaluate(()=>window.forkRobot.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.forkRobot.time),paused);
await page.evaluate(()=>window.forkRobot.curriculum('hazards'));assert.match(await page.locator('#success-comparison').innerText(),/28 → 64/);
const outcomes=[];
for(const seed of [20001,20002,20003])for(const mode of ['before','after']){
 const r=await page.evaluate(({seed,mode})=>{const r=window.forkRobot;r.select(mode,seed);r.seek(12);return {seed,mode,hazard:r.current.hazard,outcome:r.current.outcome,valid:r.current.frames.every(f=>f.qpos.length===19&&f.qpos.every(Number.isFinite))};},{seed,mode});assert(r.valid);outcomes.push(r);
}
await page.evaluate(()=>{window.forkRobot.select('after',20003);window.forkRobot.seek(4);});await page.screenshot({path:'artifacts/fork/media/road-defect.png'});
await page.evaluate(()=>{window.forkRobot.select('after',20002);window.forkRobot.seek(4);});await page.screenshot({path:'artifacts/fork/media/moving-car.png'});
await page.evaluate(()=>window.forkRobot.curriculum('crossing'));await page.evaluate(()=>{window.forkRobot.select('after',20002);window.forkRobot.seek(3);});await page.screenshot({path:'artifacts/fork/media/human-kanakadhara.png'});
const orientation=await page.evaluate(()=>{const r=window.forkRobot;const v=()=>r.scene.camera.position.clone();const checks=[];for(const t of [1,2,3,4,5]){r.seek(t-.1);r.human.updateMatrixWorld(true);const previous=r.human.getWorldPosition(v());r.seek(t);r.human.updateMatrixWorld(true);const direction=r.human.getWorldPosition(v()).sub(previous);const distance=direction.length();direction.normalize();let head,left,right;r.human.traverse(o=>{if(/Bip01.*Head$/.test(o.name))head=o;if(/Bip01.*REye$/.test(o.name))right=o;if(/Bip01.*LEye$/.test(o.name))left=o;});const face=left.getWorldPosition(v()).add(right.getWorldPosition(v())).multiplyScalar(.5).sub(head.getWorldPosition(v()));face.y=0;checks.push({time:t,distance,alignment:face.normalize().dot(direction)});}return checks;});console.log('Facing checks',orientation);assert(orientation.some(r=>r.distance>1e-6)&&orientation.filter(r=>r.distance>1e-6).every(r=>r.alignment>.9),'Human must face its direction of travel while moving');
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile horizontal overflow');await page.screenshot({path:'artifacts/fork/media/mobile.png',fullPage:true});
await context.close();
const recovery=await browser.newPage({viewport:{width:1200,height:800}});await recovery.route('**/hazard-experiment.json',r=>r.abort());await recovery.goto(base+'/?robot=1');await recovery.waitForFunction(()=>window.forkRobot?.ready);await recovery.evaluate(()=>window.forkRobot.curriculum('hazards'));assert(await recovery.locator('#robot-error').isVisible());await recovery.evaluate(()=>window.forkRobot.curriculum('crossing'));assert(await recovery.locator('#robot-error').isHidden());
await browser.close();assert.deepEqual(errors,[]);await fs.writeFile('artifacts/fork/browser-verification.json',JSON.stringify({desktop:true,mobile:true,pause:true,scrub:true,apiFailureRecovery:true,orientation,errors,outcomes},null,2));console.log('PASS: desktop, mobile, pause, scrub, both curricula, finite joint recordings and failure recovery');
