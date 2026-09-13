import {ACTIONS,CONTACT_RADIUS,DT,DURATION,baseline,scenario,simulate,type Action,type Episode,type Observation,type Scenario} from './simulation.ts';
import {fit,predict,type Sample,type WorldModel} from './model.ts';
export const TRAIN_INITIAL=Array.from({length:12},(_,i)=>i+1);
export const TRAIN_EXPAND=Array.from({length:168},(_,i)=>i+13);
export const VALIDATION=Array.from({length:32},(_,i)=>10001+i);
export const TEST=Array.from({length:64},(_,i)=>20001+i);
export type Forecast={action:Action;points:number[][];spread:number[];clearance:number;progress:number;score:number};
export type Metrics={episodes:number;forecastRMSE:number;pedestrianRMSE:number;contacts:number;completion:number;meanProgress:number;meanClearance:number};
export type Evaluation={learned:Metrics;baseline:Metrics;seeds:number[]};
export type Focus='balanced'|'fast'|'slow'|'hesitation';
export type UpdateResult={model:WorldModel;candidate:WorldModel;promoted:boolean;reason:string;validationBefore:Metrics;validationAfter:Metrics;test:Evaluation;durationMs:number;focus:Focus;curriculumSeeds:number[]};
export function forecast(model:WorldModel|null,o:Observation,action:Action):Forecast{
 const points:number[][]=[],spread:number[]=[];let clearance=Infinity;
 for(let k=0;k<=Math.round(DURATION/DT);k++){
  const t=k*DT,p=model?predict(model,o,action,t):{mean:baseline(o,action,t),spread:0};points.push(p.mean);spread.push(p.spread);
  clearance=Math.min(clearance,Math.hypot(p.mean[0]-p.mean[2],p.mean[1]-p.mean[3])-CONTACT_RADIUS-p.spread);
 }
 const progress=points.at(-1)![1]-o.rs;
 // Collision avoidance dominates progress. Ensemble spread is a heuristic,
 // not a calibrated probability or physical robot safety guarantee.
 const score=(clearance<.25?-100-20*(.25-clearance):0)+progress;
 return {action,points,spread,clearance,progress,score};
}
export function choose(fs:Forecast[]){return [...fs].sort((a,b)=>b.score-a.score)[0].action;}
export function samplesFor(s:Scenario):Sample[]{return ACTIONS.flatMap(a=>{const e=simulate(s,a);return e.states.filter((_,i)=>i%4===0).map(v=>({o:e.observation,a,t:v.t,y:[v.rn,v.rs,v.pn,v.ps]}));});}
export function bootstrap(){return fit(TRAIN_INITIAL.flatMap(seed=>samplesFor(scenario(seed))),TRAIN_INITIAL,1);}
function metrics(model:WorldModel|null,seeds:number[]):Metrics{
 let square=0,pedSquare=0,positions=0,contacts=0,completion=0,progress=0,clearance=0;
 for(const seed of seeds){const s=scenario(seed),episodes=ACTIONS.map(a=>simulate(s,a)),fs=ACTIONS.map(a=>forecast(model,episodes[0].observation,a));
  for(let a=0;a<3;a++)for(let i=4;i<episodes[a].states.length;i+=4){const v=episodes[a].states[i],p=fs[a].points[i];square+=(p[0]-v.rn)**2+(p[1]-v.rs)**2+(p[2]-v.pn)**2+(p[3]-v.ps)**2;pedSquare+=(p[2]-v.pn)**2+(p[3]-v.ps)**2;positions++;}
  const chosen=episodes.find(e=>e.action===choose(fs))!;contacts+=Number(chosen.contact);completion+=Number(!chosen.contact&&chosen.states.at(-1)!.rs>chosen.scenario.crossing+1);progress+=chosen.progress;clearance+=chosen.minClearance;
 }
 return {episodes:seeds.length,forecastRMSE:Math.sqrt(square/(positions*2)),pedestrianRMSE:Math.sqrt(pedSquare/positions),contacts,completion,meanProgress:progress/seeds.length,meanClearance:clearance/seeds.length};
}
export function evaluate(model:WorldModel,seeds=TEST):Evaluation{return {learned:metrics(model,seeds),baseline:metrics(null,seeds),seeds};}
export function improve(current:WorldModel,failures:Episode[]=[],focus:Focus='balanced'):UpdateResult{
 if(!['balanced','fast','slow','hesitation'].includes(focus))throw new Error('Unknown curriculum focus');
 const curriculumSeeds=focus==='balanced'?[]:Array.from({length:300},(_,i)=>181+i).filter(seed=>{const s=scenario(seed);return focus==='fast'?s.speed>1.4:focus==='slow'?s.speed<1:s.hesitation>.5;}).slice(0,48);
 const start=performance.now(),seeds=[...new Set([...current.trainingSeeds,...TRAIN_EXPAND,...curriculumSeeds])];
 if(seeds.some(s=>s>=10000))throw new Error('Evaluation seeds must never enter training');
 // Live examples are separately labelled and never taken from sealed evaluation.
 const live=failures.filter(e=>e.scenario.seed<10000).flatMap(e=>e.states.filter((_,i)=>i%4===0).map(v=>({o:e.observation,a:e.action,t:v.t,y:[v.rn,v.rs,v.pn,v.ps]})));
 const candidate=fit([...seeds.flatMap(seed=>samplesFor(scenario(seed))),...live],seeds,current.version+1);
 const before=metrics(current,VALIDATION),after=metrics(candidate,VALIDATION);
 const promoted=after.forecastRMSE<before.forecastRMSE*.995&&after.contacts<=before.contacts;
 const model=promoted?candidate:current;
 return {model,candidate,promoted,reason:promoted?'Lower validation forecast error without more simulated contacts.':'Rejected: validation error or contact count did not improve enough.',validationBefore:before,validationAfter:after,test:evaluate(model),durationMs:performance.now()-start,focus,curriculumSeeds};
}
