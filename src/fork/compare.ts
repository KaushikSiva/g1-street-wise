import './compare.css';
document.title='STREETWISE · Compare policies';
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`<header><a href="?robot=1">STREETWISE</a><span>Two policies. The same encounter.</span></header><main><div class="controls"><label>Environment <select id="environment"><option value="crossing">Pedestrian crossing</option><option value="hazards">Cars & road defects</option><option value="weather">Rain & fog</option></select></label><label>Scenario <select id="seed"></select></label><button id="play" disabled>Play both ▶</button><input id="time" type="range" min="0" max="12" step=".02" value="0" aria-label="Synchronized simulation time"><output id="clock">0.0 s</output></div><p id="status" role="status">Loading the two recorded physics replays…</p><div class="panes"><section><h2>Before · constant forward command</h2><iframe id="left" title="Baseline policy replay" src="?robot=1&embed=1"></iframe></section><section><h2>After · trained navigation</h2><iframe id="right" title="Trained navigation policy replay" src="about:blank"></iframe></section></div><p>Recorded MuJoCo trajectories, synchronized by simulation time. A finished episode freezes while the other continues. Use the native MuJoCo viewer to run fresh physics.</p></main>`;
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const api=(id:string)=>($<HTMLIFrameElement>(id).contentWindow as any)?.forkRobot;
let ready=false,playing=false,time=0,duration=12,last=0;
async function load(){
 playing=false;ready=false;$<HTMLButtonElement>('play').disabled=true;
 try{
  const key=$<HTMLSelectElement>('environment').value;
  await Promise.all([api('left').curriculum(key),api('right').curriculum(key)]);
  for(const id of ['left','right']){const doc=$<HTMLIFrameElement>(id).contentDocument!;if(!doc.getElementById('robot-error')!.hidden)throw new Error(doc.getElementById('robot-error')!.textContent||'Environment unavailable');}
  const source=$<HTMLIFrameElement>('left').contentDocument!.getElementById('robot-seed') as HTMLSelectElement;
  $<HTMLSelectElement>('seed').innerHTML=source.innerHTML;
  choose();ready=true;$<HTMLButtonElement>('play').disabled=false;$('status').textContent='Both policies use the same scenario and frozen Unitree walking skill.';
 }catch(e){$('status').textContent=`Could not load this comparison: ${String(e)}. Choose another environment to retry.`;}
}
function choose(){const seed=Number($<HTMLSelectElement>('seed').value);api('left').select('before',seed);api('right').select('after',seed);duration=Math.max(api('left').current.frames.at(-1).t,api('right').current.frames.at(-1).t);$<HTMLInputElement>('time').max=String(duration);playing=false;seek(0);$('play').textContent='Play both ▶';}
function seek(t:number){time=Math.min(t,duration);api('left').seek(time);api('right').seek(time);$<HTMLInputElement>('time').value=String(time);$('clock').textContent=`${time.toFixed(1)} / ${duration.toFixed(1)} s`;}
function tick(t:number){if(ready&&playing){seek(time+Math.min(.08,(t-last)/1000));if(time>=duration){playing=false;$('play').textContent='Replay both ▶';}}last=t;requestAnimationFrame(tick);}requestAnimationFrame(tick);
$('play').onclick=()=>{if(time>=duration)seek(0);playing=!playing;$('play').textContent=playing?'Pause both Ⅱ':'Resume both ▶';};
$<HTMLInputElement>('time').oninput=e=>{if(!ready)return;playing=false;seek(Number((e.target as HTMLInputElement).value));$('play').textContent='Resume both ▶';};
$('seed').onchange=choose;$('environment').onchange=()=>void load();
let attempts=0,rightStarted=false;const timer=setInterval(()=>{if(api('left')?.ready&&!rightStarted){rightStarted=true;$<HTMLIFrameElement>('right').src='?robot=1&embed=1';}if(api('left')?.ready&&api('right')?.ready){clearInterval(timer);void load();}else if(++attempts>180){clearInterval(timer);$('status').textContent='The scenes could not load. Reload to retry.';}},500);
(window as any).streetwiseCompare={get ready(){return ready;},get time(){return time;},seek,load};
