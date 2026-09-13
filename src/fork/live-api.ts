export type Outcome = {success:boolean;contact:boolean;fall?:boolean;physical_contact?:boolean;first_violation_time?:number|null;safe_stop?:boolean;shelter_reached?:boolean;emergency_contact?:boolean;foot_contact?:boolean;elapsed:number;min_clearance:number};
export type LiveFrame = {t:number;qpos:number[];pedestrian:number[];action:number;visible:boolean;clearance:number;condition?:string;seek_shelter?:boolean;hazard_position?:number[];people?:{position:number[];direction:number;visible:boolean}[];emergencies?:{kind:string;position:number[];yaw:number;active:boolean;visible:boolean}[]};
export type LiveReplay = {seed:number;frames:LiveFrame[];outcome:Outcome;scenario:{speed:number;hesitation:number;crossing:number;start:number};hazard?:string;condition?:string;shelters?:number[][];seek_shelter?:boolean;goal?:number[];people?:{start:number;v:number}[];road_friction?:number;visibility_range?:number};
export type LiveResult = {source:'fresh_mujoco';seed:number;curriculum:string;wallSeconds:number;checkpoint?:string;checkpointSha256?:string;scoring?:string;generatedAt?:number;replays:{before:LiveReplay[];after:LiveReplay[]}};
type Job = {id:string;status:'queued'|'running'|'complete'|'failed';phase?:string;error?:string;result?:LiveResult};
const object=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x);
const number=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const numbers=(x:unknown,min:number):x is number[]=>Array.isArray(x)&&x.length>=min&&x.every(number);
const optional=(x:unknown,check:(x:unknown)=>boolean)=>x===undefined||check(x);
const bool=(x:unknown)=>typeof x==='boolean';
const string=(x:unknown)=>typeof x==='string';
function replay(x:unknown):x is LiveReplay{
 if(!object(x)||!number(x.seed)||!object(x.outcome)||!object(x.scenario)||!Array.isArray(x.frames)||!x.frames.length)return false;
 const o=x.outcome;
 if(!bool(o.success)||!bool(o.contact)||!number(o.elapsed)||!number(o.min_clearance))return false;
 for(const k of ['fall','physical_contact','safe_stop','shelter_reached','emergency_contact','foot_contact'])if(!optional(o[k],bool))return false;
 if(!optional(o.first_violation_time,v=>v===null||number(v)))return false;
 if(!['speed','hesitation','crossing','start'].every(k=>number((x.scenario as Record<string,unknown>)[k])))return false;
 if(!['hazard','condition'].every(k=>optional(x[k],string)))return false;
 if(!['road_friction','visibility_range'].every(k=>optional(x[k],number)))return false;
 if(!optional(x.seek_shelter,bool)||!optional(x.goal,v=>numbers(v,2))||!optional(x.shelters,v=>Array.isArray(v)&&v.every(p=>numbers(p,2))))return false;
 if(!optional(x.people,v=>Array.isArray(v)&&v.every(p=>object(p)&&number(p.start)&&number(p.v))))return false;
 let previous=-1;
 return x.frames.every(f=>{
  if(!object(f)||!number(f.t)||f.t<previous||!numbers(f.qpos,19)||!numbers(f.pedestrian,3)||!Number.isInteger(f.action)||!number(f.action)||f.action<0||f.action>7||!bool(f.visible)||!number(f.clearance))return false;
  previous=f.t;
  return optional(f.condition,string)&&optional(f.seek_shelter,bool)&&optional(f.hazard_position,v=>numbers(v,3))
   &&optional(f.people,v=>Array.isArray(v)&&v.every(p=>object(p)&&numbers(p.position,3)&&number(p.direction)&&bool(p.visible)))
   &&optional(f.emergencies,v=>Array.isArray(v)&&v.every(p=>object(p)&&string(p.kind)&&numbers(p.position,3)&&number(p.yaw)&&bool(p.active)&&bool(p.visible)));
 });
}
export function isLiveResult(x:unknown):x is LiveResult{
 return object(x)&&x.source==='fresh_mujoco'&&number(x.seed)&&string(x.curriculum)&&number(x.wallSeconds)&&object(x.replays)&&optional(x.checkpoint,string)&&optional(x.checkpointSha256,string)&&optional(x.scoring,string)&&optional(x.generatedAt,number)
  &&['before','after'].every(k=>{const rows=(x.replays as Record<string,unknown>)[k];return Array.isArray(rows)&&rows.length===1&&replay(rows[0])&&rows[0].seed===x.seed;});
}
export class LiveApiError extends Error{constructor(message:string,public retryable=false){super(message);}}
export async function readJob(response:Response):Promise<Job>{
 const raw=await response.text();
 if(!raw.trim())throw new LiveApiError(`The demo server returned an empty response (HTTP ${response.status}). It may be restarting.`,true);
 let value:unknown;
 try{value=JSON.parse(raw);}catch{throw new LiveApiError(`The demo server returned an incomplete response (HTTP ${response.status}).`,true);}
 if(!response.ok)throw new LiveApiError(object(value)&&typeof value.error==='string'?value.error:`The demo server returned HTTP ${response.status}.`,response.status>=500||response.status===429);
 if(!object(value)||typeof value.id!=='string'||!['queued','running','complete','failed'].includes(String(value.status))||!optional(value.phase,string)||!optional(value.error,string))throw new LiveApiError('The demo returned an invalid run status. Please start a new comparison.');
 if(value.status==='complete'&&!isLiveResult(value.result))throw new LiveApiError('The completed simulation did not match the expected replay format.');
 // All fields used below have passed runtime validation.
 return value as Job;
}
export type ValidationPoint={step:number;'validation/success_rate':number};
type Metrics={episodes?:number;success_rate:number;clearance_violations:number;falls:number};
export type RecordedExperiment={replays:{before:LiveReplay[];after:LiveReplay[]};evaluation:{baseline:Metrics;trained:Metrics;history:ValidationPoint[];wandbUrl?:string|null};contactAudit?:unknown};
export async function readRecorded(response:Response):Promise<RecordedExperiment>{
 if(!response.ok)throw new LiveApiError(`Recorded encounters could not load (HTTP ${response.status}). Please retry.`,response.status>=500);
 const raw=await response.text();let value:unknown;
 try{value=JSON.parse(raw);}catch{throw new LiveApiError('The recorded encounter download was interrupted. Please reload to retry.',true);}
 const metrics=(m:unknown)=>object(m)&&number(m.success_rate)&&number(m.clearance_violations)&&number(m.falls)&&optional(m.episodes,number);
 if(!object(value)||!object(value.replays)||!['before','after'].every(k=>{const rows=(value.replays as Record<string,unknown>)[k];return Array.isArray(rows)&&rows.length>0&&rows.every(replay);})||!object(value.evaluation)||!metrics(value.evaluation.baseline)||!metrics(value.evaluation.trained)||!optional(value.evaluation.wandbUrl,v=>v===null||string(v))||!Array.isArray(value.evaluation.history)||!value.evaluation.history.every(p=>object(p)&&number(p.step)&&number(p['validation/success_rate'])))throw new LiveApiError('The recorded encounter file has an invalid format.');
 return value as RecordedExperiment;
}
