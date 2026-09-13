import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
page.on('pageerror',error=>console.log('PAGE ERROR',error.message));
await page.goto('http://localhost:5188/?robot=1');
await page.waitForFunction(()=>window.forkRobot?.ready,{timeout:60000});
await page.evaluate(async()=>{const {applyCentralAvenueRealism}=await import('/src/fork/realism.ts');const s=window.forkRobot.scene;await applyCentralAvenueRealism(s.scene,s.renderer,s.frame);});
await page.locator('#cinema').click();
for(const [name,position,target,fov] of [
 ['reverse',[32,7,3],[40,0,1],48],
 ['street',[29,-2.5,2],[40,0,1.1],50],
 ['threequarter',[33,-5.5,2.6],[40.5,0,1.2],48],
 ['avenue',[47,5,2.5],[38,-.7,1.1],48],
 ['observer',[45,-6.6,3.4],[40.5,0,1],42],
]){
 await page.evaluate(({position,target,fov})=>{const s=window.forkRobot.scene;s.camera.fov=fov;s.camera.updateProjectionMatrix();s.camera.position.copy(s.frame.point(...position));s.controls.target.copy(s.frame.point(...target));s.controls.update();},{position,target,fov});
 await page.waitForTimeout(800);
 await page.screenshot({path:`public/assets/fork/realism/${name}.png`});
}
console.log(await page.evaluate(()=>({realism:window.forkRobot.scene.scene.userData.centralAvenueRealism,render:window.forkRobot.scene.renderer.info.render})));
await browser.close();
