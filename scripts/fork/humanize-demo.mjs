import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const image=await fs.readFile('artifacts/fork/media/chennai-street-reference.png');
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await p.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;background:#f1f0e7;color:#284034;font-family:Arial}h1{font-size:54px;letter-spacing:-1.5px;margin:45px 50px 25px}img{display:block;width:1820px;height:759px;object-fit:contain;margin:0 auto}p{font-size:22px;margin:20px 50px;color:#526153}</style></head><body><h1>We recreated a street in Chennai.</h1><img src="data:image/png;base64,${image.toString('base64')}"><p>Central Avenue · Chennai, India · Street View reference supplied by the creator</p></body></html>`);
await p.locator('img').evaluate(i=>i.decode());await p.screenshot({path:'artifacts/fork/media/chennai-reference-card.png'});await b.close();
