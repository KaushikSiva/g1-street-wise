// Match the actual MuJoCo renderer camera to the browser street coordinate frame.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const camera=JSON.parse(await fs.readFile('artifacts/fork/media/native-camera.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:camera.width,height:camera.height},deviceScaleFactor:1});
await page.goto(process.env.STREETWISE_SOURCE_URL||'http://127.0.0.1:5188/?robot=1');
await page.waitForFunction(()=>window.forkRobot?.ready,null,{timeout:60000});
await page.addStyleTag({content:'.robot-scene{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:9999!important}.robot-scene>*:not(canvas){display:none!important}canvas#g1-scene{width:100%!important;height:100%!important}'});
await page.evaluate(async config=>{
 const THREE=await import('/node_modules/three/build/three.module.js');
 const app=window.forkRobot;app.pause();app.select('after',config.seed);app.seek(config.time);
 // Use the fresh native pose for the robot; browser actor remains a replay.
 app.g1.pose(config.nativeQpos);
 const scene=app.scene,frame=scene.frame;
 const transform=new THREE.Matrix4().makeBasis(frame.direction,frame.normal.clone().negate(),new THREE.Vector3(0,1,0));transform.setPosition(frame.point(75,0,.07));
 const world=p=>new THREE.Vector3(...p).applyMatrix4(transform);
 scene.controls.enableDamping=false;scene.controls.minDistance=0;scene.controls.maxDistance=Infinity;
 scene.controls.target.copy(world(config.target));scene.camera.position.copy(world(config.position));
 scene.camera.up.set(0,1,0);scene.camera.fov=config.fov;scene.camera.aspect=config.width/config.height;scene.camera.updateProjectionMatrix();scene.controls.update();
 scene.renderer.setPixelRatio(1);scene.renderer.setSize(config.width,config.height,false);
},camera);
await page.waitForTimeout(1500);
await page.locator('#g1-scene').screenshot({path:'artifacts/fork/media/native-browser-reference.png'});
console.log({seed:camera.seed,time:camera.time,size:[camera.width,camera.height],camera:'Actual native OpenGL camera transformed into browser coordinates'});
await browser.close();
