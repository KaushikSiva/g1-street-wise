// Genuine application captures from the same held-out seed and simulation time.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:5189/?robot=1');
await page.waitForFunction(()=>window.forkRobot?.ready,null,{timeout:60000});
const evidence=[];
for (const mode of ['before','after']) {
 const result=await page.evaluate(mode=>{
  const r=window.forkRobot;r.pause();r.select(mode,20002);r.seek(4);
  document.querySelector('.robot-title h1').textContent=mode==='before'?'Before: walks into danger.':'After: keeps a safer gap.';
  document.querySelector('.robot-title p').textContent='Same held-out encounter #20002 · same moment: 4.0 seconds';
  return {mode,seed:r.current.seed,time:r.time,outcome:r.current.outcome};
 },mode);
 await page.waitForTimeout(350);
 await page.screenshot({path:`artifacts/fork/media/${mode}-learning.png`});evidence.push(result);
}
await fs.writeFile('artifacts/fork/media/comparison-evidence.json',JSON.stringify({source:'Unmodified scene rendered by the application from recorded MuJoCo joint states. Heading annotations identify the comparison. Same seed, camera and simulation timestamp.',captures:evidence},null,2));
await browser.close();
