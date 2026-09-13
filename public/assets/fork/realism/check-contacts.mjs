import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
page.on('pageerror',error=>console.log('PAGE ERROR',error.message));
await page.goto('http://localhost:5188/?robot=1');
await page.waitForFunction(()=>window.forkRobot?.ready,{timeout:60000});
await page.locator('#cinema').click();await page.waitForTimeout(1000);
await page.screenshot({path:'public/assets/fork/realism/contact-before.png'});
await page.evaluate(async()=>{
 const {createCentralAvenueRender}=await import('/src/fork/realism.ts');
 const s=window.forkRobot.scene,pipeline=createCentralAvenueRender(s.scene,s.renderer,s.camera);
 window.realismPipeline=pipeline;
 const render=()=>{pipeline.render();requestAnimationFrame(render);};requestAnimationFrame(render);
});
await page.waitForTimeout(4000);
await page.screenshot({path:'public/assets/fork/realism/contact-after.png'});
console.log(await page.evaluate(()=>({realism:window.forkRobot.scene.scene.userData.centralAvenueRealism,render:window.forkRobot.scene.renderer.info.render})));
await browser.close();
