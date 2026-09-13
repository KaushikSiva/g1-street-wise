import {LiveApiError,readJob} from './live-api';
import type {LiveResult} from './live-api';

export function installLiveLab(load:(result:LiveResult)=>void){
 const section=document.createElement('section');section.className='live-lab';section.id='live-lab';
 section.innerHTML=`<div><span class="eyebrow">TRY A NEW ENCOUNTER</span><h2>Your scenario. Both policies.</h2><p>Run fresh MuJoCo physics, then watch how each policy handles the same encounter.</p></div>
 <form id="live-form"><label>Scenario family<select id="live-curriculum"><option value="crossing">Pedestrian crossing</option><option value="cars">Car crossing · retrained</option><option value="road-defects">Road defect · retrained</option><option value="hazards">Mixed traffic · retrained</option><option value="rain-shelter">Rain onset → seek shelter</option><option value="weather">Wet-road crossing · legacy task</option><option value="streetlife">Crowds & rain shelters</option><option value="emergencies">Fallen people & debris · experimental</option></select></label><label>Scenario seed<input id="live-seed" type="number" min="1" max="99999999" step="1" value="30001" required></label><button type="button" class="secondary" id="live-random">New seed ↻</button><button type="submit" class="primary" id="live-run">Run both policies ▶</button></form>
 <p id="live-status" role="status">A seed reproduces the same encounter. Runs may take a short while on the demo server.</p><div id="live-results" hidden></div><div id="live-history" hidden><label>Recent runs this session<select id="live-history-filter"><option value="all">Newest runs first</option><option value="passed">Trained policy passed · physical checks</option></select></label><select id="live-history-pick" aria-label="Recent completed scenarios"></select><p id="live-provenance"></p></div><small>These runs do not retrain the robot or enter the published benchmark. Emergency avoidance is still experimental; sensors are simulator tracks, not camera recognition.</small>`;
 document.querySelector('.robot-transport')!.after(section);
 const recent:LiveResult[]=[];
 const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
 const describe=(r:LiveResult)=>{get('live-provenance').textContent=`Checkpoint ${r.checkpoint||'unknown'} · ${r.checkpointSha256?.slice(0,12)||'unverified'} · ${r.scoring||'legacy scoring'}`;};
 const refreshHistory=()=>{const picker=get<HTMLSelectElement>('live-history-pick');picker.replaceChildren();const passed=get<HTMLSelectElement>('live-history-filter').value==='passed';for(const [index,r] of recent.entries()){const o=r.replays.after[0].outcome;if(passed&&!(r.scoring==='physical-contact-v2'&&o.success&&!o.contact&&!o.physical_contact&&!o.fall))continue;picker.add(new Option(`${new Date((r.generatedAt||Date.now()/1000)*1000).toLocaleTimeString()} · Seed ${r.seed} · ${r.curriculum} · ${o.success?'Passed':'Failed / incomplete'}`,String(index)));}if(!picker.options.length)picker.add(new Option('No matching fresh runs yet',''));get('live-history').hidden=false;};
 get('live-history-filter').onchange=refreshHistory;
 get('live-history-pick').onchange=()=>{const value=get<HTMLSelectElement>('live-history-pick').value;if(value==='')return;const r=recent[Number(value)];load(r);describe(r);};
 get('live-random').onclick=()=>{get<HTMLInputElement>('live-seed').value=String(30000+crypto.getRandomValues(new Uint32Array(1))[0]%99969999);};
 get<HTMLFormElement>('live-form').onsubmit=async event=>{
  event.preventDefault();const button=get<HTMLButtonElement>('live-run');button.disabled=true;
  get('live-results').hidden=true;get('live-status').textContent='Starting a fresh physics comparison…';
  const curriculum=get<HTMLSelectElement>('live-curriculum').value,seed=Number(get<HTMLInputElement>('live-seed').value);
  try{
   const response=await fetch('/live-api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({curriculum,seed}),signal:AbortSignal.timeout(90000)});
   const job=await readJob(response);
   const deadline=Date.now()+600000;
   while(Date.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,1500));
    let state;
    try{state=await readJob(await fetch(`/live-api/runs/${job.id}`,{signal:AbortSignal.timeout(30000)}));}
    catch(error){if((error instanceof LiveApiError&&error.retryable)||error instanceof TypeError||(error instanceof DOMException&&error.name==='TimeoutError')){get('live-status').textContent='The server connection was interrupted. Reconnecting to your run…';continue;}throw error;}
    if(state.status==='failed')throw new Error(state.error||'The run could not finish.');
    get('live-status').textContent=state.phase||'Running MuJoCo…';
    if(state.status==='complete'&&state.result){
     const result=state.result;load(result);recent.unshift(result);recent.splice(20);refreshHistory();describe(result);
     get('live-status').textContent=`Fresh comparison ready · seed ${result.seed} · ${result.wallSeconds.toFixed(1)} seconds of server computation. Use Before / After and Play encounter above.`;
     const results=get('live-results');results.replaceChildren();
     for(const mode of ['before','after'] as const){
      const r=result.replays[mode][0],o=r.outcome,card=document.createElement('p');
      const label=document.createElement('strong');label.textContent=mode==='before'?'Before · constant forward':'After · navigation policy';
      const detail=document.createElement('span');detail.textContent=`${o.success?(o.safe_stop?'Safe stop':o.shelter_reached?'Shelter reached':'Route completed'):o.physical_contact?'Physical collision':o.contact?'Clearance violated':o.fall?'Robot fell':'Route incomplete'} · ${o.elapsed.toFixed(1)} s${o.emergency_contact?' · emergency clearance violated':''}${o.foot_contact?' · foot contact':''}`;
      card.append(label,detail);results.append(card);
     }
     results.hidden=false;document.querySelector('.robot-scene')!.scrollIntoView({behavior:'smooth',block:'start'});return;
    }
   }
   throw new Error('This comparison is taking longer than expected. Try again shortly.');
  }catch(error){get('live-status').textContent=error instanceof Error?error.message:String(error);}
  finally{button.disabled=false;}
 };
 if(new URLSearchParams(location.search).has('live'))section.scrollIntoView({block:'center'});
}
