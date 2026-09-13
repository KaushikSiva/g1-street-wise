type LiveResult = {source:string;seed:number;curriculum:string;wallSeconds:number;replays:{before:any[];after:any[]}};

export function installLiveLab(load:(result:LiveResult)=>void){
 const section=document.createElement('section');section.className='live-lab';section.id='live-lab';
 section.innerHTML=`<div><span class="eyebrow">TRY A NEW ENCOUNTER</span><h2>Your scenario. Both policies.</h2><p>Run fresh MuJoCo physics, then watch how each policy handles the same encounter.</p></div>
 <form id="live-form"><label>Scenario family<select id="live-curriculum"><option value="crossing">Pedestrian crossing</option><option value="hazards">Cars & road defects</option><option value="weather">Rain & fog</option><option value="streetlife">Crowds & rain shelters</option><option value="emergencies">Fallen people & debris · experimental</option></select></label><label>Scenario seed<input id="live-seed" type="number" min="1" max="99999999" step="1" value="30001" required></label><button type="button" class="secondary" id="live-random">New seed ↻</button><button type="submit" class="primary" id="live-run">Run both policies ▶</button></form>
 <p id="live-status" role="status">A seed reproduces the same encounter. Runs may take a short while on the demo server.</p><div id="live-results" hidden></div><small>These runs do not retrain the robot or enter the published benchmark. Emergency avoidance is still experimental; sensors are simulator tracks, not camera recognition.</small>`;
 document.querySelector('.robot-transport')!.after(section);
 const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
 get('live-random').onclick=()=>{get<HTMLInputElement>('live-seed').value=String(30000+crypto.getRandomValues(new Uint32Array(1))[0]%99969999);};
 get<HTMLFormElement>('live-form').onsubmit=async event=>{
  event.preventDefault();const button=get<HTMLButtonElement>('live-run');button.disabled=true;
  get('live-results').hidden=true;get('live-status').textContent='Starting a fresh physics comparison…';
  const curriculum=get<HTMLSelectElement>('live-curriculum').value,seed=Number(get<HTMLInputElement>('live-seed').value);
  try{
   const response=await fetch('/live-api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({curriculum,seed}),signal:AbortSignal.timeout(90000)});
   if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Fresh physics is unavailable on this server. Recorded encounters still work.');
   const job=await response.json();if(!response.ok)throw new Error(job.error||'Could not start this comparison.');
   const deadline=Date.now()+600000;
   while(Date.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,1500));
    const progress=await fetch(`/live-api/runs/${job.id}`,{signal:AbortSignal.timeout(30000)});
    const state=await progress.json();if(!progress.ok||state.status==='failed')throw new Error(state.error||'The run could not finish.');
    get('live-status').textContent=state.phase||'Running MuJoCo…';
    if(state.status==='complete'){
     const result=state.result as LiveResult;load(result);
     get('live-status').textContent=`Fresh comparison ready · seed ${result.seed} · ${result.wallSeconds.toFixed(1)} seconds of server computation. Use Before / After and Play encounter above.`;
     const results=get('live-results');results.replaceChildren();
     for(const mode of ['before','after'] as const){
      const r=result.replays[mode][0],o=r.outcome,card=document.createElement('p');
      const label=document.createElement('strong');label.textContent=mode==='before'?'Before · constant forward':'After · navigation policy';
      const detail=document.createElement('span');detail.textContent=`${o.success?(o.safe_stop?'Safe stop':o.shelter_reached?'Shelter reached':'Route completed'):o.contact?'Clearance violated':o.fall?'Robot fell':'Route incomplete'} · ${o.elapsed.toFixed(1)} s${o.emergency_contact?' · emergency clearance violated':''}${o.foot_contact?' · foot contact':''}`;
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
