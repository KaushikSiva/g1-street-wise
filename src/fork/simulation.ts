export const ACTIONS = ['continue', 'peek', 'wait'] as const;
export type Action = typeof ACTIONS[number];
export const DURATION = 6;
export const DT = .05;
export const CONTACT_RADIUS = .65;
export type Scenario = {seed:number; speed:number; crossing:number; hesitation:number; start:number};
export type State = {t:number; rn:number; rs:number; rv:number; pn:number; ps:number; pv:number; visible:boolean};
// Only this observation crosses the simulator/predictor boundary. It contains
// a synthetic last-seen track, never current occluded state or hidden behavior.
export type Observation = {rn:number;rs:number;lastN:number;lastS:number;lastV:number;age:number};
export type Episode = {scenario:Scenario;action:Action;observation:Observation;states:State[];contact:boolean;minClearance:number;progress:number};
export function rng(seed:number){let v=seed>>>0;return ()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296;};}
export function scenario(seed:number):Scenario{const r=rng(seed*7919);return {seed,speed:.65+r()*1.1,crossing:-.75+r()*1.5,hesitation:.1+r()*.65,start:-3.8+r()*.45};}
export function observation(s:Scenario):Observation{return {rn:0,rs:-6,lastN:s.start-s.speed*.8,lastS:s.crossing,lastV:s.speed,age:.8};}
export const VAN = {nMin:-3.1,nMax:-1.25,sMin:-5.4,sMax:-1.2};
export function occluded(rn:number,rs:number,pn:number,ps:number){
 let lo=0,hi=1;for(const [o,d,min,max]of [[rn,pn-rn,VAN.nMin,VAN.nMax],[rs,ps-rs,VAN.sMin,VAN.sMax]]){if(Math.abs(d)<1e-9){if(o<min||o>max)return false;}else{const a=(min-o)/d,b=(max-o)/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi)return false;}}return hi>0&&lo<1;
}
function approach(v:number,target:number,step:number){return v+Math.max(-step,Math.min(step,target-v));}
export function simulate(s:Scenario,action:Action):Episode{
 const obs=observation(s);let rn=0,rs=-6,rv=0,pn=s.start,pv=s.speed,pause=0,triggered=false;const states:State[]=[];let minClearance=Infinity;
 for(let k=0;k<=Math.round(DURATION/DT);k++){
  const t=k*DT;states.push({t,rn,rs,rv,pn,ps:s.crossing,pv,visible:!occluded(rn,rs,pn,s.crossing)});
  minClearance=Math.min(minClearance,Math.hypot(rn-pn,rs-s.crossing)-CONTACT_RADIUS);
  if(k===Math.round(DURATION/DT))break;
  const target=action==='continue'?1.8:action==='peek'?(t<2?.7:1.65):(t<2.5?0:1.6);
  rv=approach(rv,target,DT*1.8);rn=approach(rn,action==='peek'?.85:0,DT*.55);rs+=rv*DT;
  // Synthetic interaction: a pedestrian briefly hesitates at the occluder's
  // edge when the approaching robot is moving quickly. This is a test rule,
  // not an estimate of real Chennai pedestrians.
  if(!triggered&&pn>=-1.2){triggered=true;if(rv>1.2&&rs<s.crossing&&s.crossing-rs<4.5)pause=s.hesitation;}
  const desired=pause>0?0:s.speed*(pn>-.8?1.18:1);pause=Math.max(0,pause-DT);pv=approach(pv,desired,DT*3);pn+=pv*DT;
 }
 return {scenario:s,action,observation:obs,states,contact:minClearance<0,minClearance,progress:rs+6};
}
export function stateAt(states:State[],t:number){const i=Math.min(states.length-1,Math.max(0,Math.round(t/DT)));return states[i];}
export function baseline(o:Observation,action:Action,t:number):number[]{
 // A strong baseline: exact known robot command schedule + constant-velocity
 // pedestrian extrapolation. It has the same last-seen observation as the model.
 let n=o.rn,s=o.rs,v=0;
 for(let k=0;k<Math.round(t/DT);k++){const time=k*DT,target=action==='continue'?1.8:action==='peek'?(time<2?.7:1.65):(time<2.5?0:1.6);v=approach(v,target,DT*1.8);n=approach(n,action==='peek'?.85:0,DT*.55);s+=v*DT;}
 return [n,s,o.lastN+o.lastV*(o.age+t),o.lastS];
}
