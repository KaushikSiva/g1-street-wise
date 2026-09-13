// Render a thank-you frame and a scan-friendly end card from a verified QR SVG.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const url=process.argv[2];
if(!url?.startsWith('https://'))throw new Error('Pass the verified HTTPS demo URL.');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const folder='artifacts/fork/media';
const qr=await fs.readFile(`${folder}/STREETWISE-QR.svg`,'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await page.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;background:#f3f2e9;color:#214a37;font-family:Arial,sans-serif}.page{height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center}.brand{position:absolute;top:70px;left:86px;font-size:26px;letter-spacing:5px;font-weight:700}h1{font-size:110px;font-weight:500;letter-spacing:-5px;margin:0}.qr-page h1{font-size:65px;letter-spacing:-2px;margin:0 0 28px}.code{height:600px;width:600px;background:white}.code svg{width:100%;height:100%;display:block}p{font-size:28px;margin:24px 0 0}.url{font-size:24px;letter-spacing:.2px;margin-top:12px;color:#47674e}.note{position:absolute;bottom:36px;font-size:18px;color:#6a7d66}</style></head><body><div class="brand">STREETWISE</div><main class="page"><h1>Thank you.</h1></main></body></html>`);
await page.screenshot({path:`${folder}/thank-you.png`});
await page.evaluate(({qr,url})=>{const main=document.querySelector('main');main.classList.add('qr-page');main.innerHTML=`<h1>Try STREETWISE</h1><div class="code">${qr}</div><p>Choose a scenario. See how the robot performs.</p><div class="url"></div><div class="note">Scan to open the live demo</div>`;main.querySelector('.url').textContent=new URL(url).host;},{qr,url});
await page.screenshot({path:`${folder}/STREETWISE-QR.png`});
await fs.writeFile(`${folder}/end-card.html`,(await page.content()).replace('</body>',`<!-- Demo: ${escape(url)} --></body>`));
await browser.close();
