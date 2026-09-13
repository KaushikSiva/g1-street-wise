import {ACTIONS, type Action, type Observation, rng} from './simulation.ts';
export type Sample={o:Observation;a:Action;t:number;y:number[]};
export type Member={projection:number[][];weights:number[][]};
export type WorldModel={version:number;members:Member[];trainingSeeds:number[];samples:number;createdAt:string};
const INPUT=12,FEATURES=44;
export function input(o:Observation,a:Action,t:number){return [1,o.rn/4,o.rs/6,o.lastN/5,o.lastS/2,o.lastV/2,o.age,t/6,...ACTIONS.map(v=>v===a?1:0),(o.lastV/2)*(t/6)];}
function features(x:number[],p:number[][]){return [...x,...p.map(w=>Math.tanh(w.reduce((s,v,i)=>s+v*x[i],0)))];}
function solve(a:Float64Array[],b:Float64Array[]){
 const n=a.length,l=Array.from({length:n},()=>new Float64Array(n));
 for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let s=a[i][j];for(let k=0;k<j;k++)s-=l[i][k]*l[j][k];l[i][j]=i===j?Math.sqrt(Math.max(s,1e-10)):s/l[j][j];}
 const out=Array.from({length:n},()=>[0,0,0,0]);
 for(let d=0;d<4;d++){const y=new Float64Array(n);for(let i=0;i<n;i++){let v=b[i][d];for(let j=0;j<i;j++)v-=l[i][j]*y[j];y[i]=v/l[i][i];}for(let i=n-1;i>=0;i--){let v=y[i];for(let j=i+1;j<n;j++)v-=l[j][i]*out[j][d];out[i][d]=v/l[i][i];}}
 return out;
}
export function fit(samples:Sample[],trainingSeeds:number[],version:number):WorldModel{
 const members:Member[]=[];
 for(let m=0;m<3;m++){
  const r=rng(7821+m*317),projection=Array.from({length:FEATURES},()=>Array.from({length:INPUT},()=> (r()*2-1)*2.4));
  const n=INPUT+FEATURES,a=Array.from({length:n},()=>new Float64Array(n)),b=Array.from({length:n},()=>new Float64Array(4));
  for(const sample of samples){const x=features(input(sample.o,sample.a,sample.t),projection),weight=.65+r()*.7;
   for(let i=0;i<n;i++){const v=x[i]*weight;for(let j=0;j<=i;j++)a[i][j]+=v*x[j];for(let d=0;d<4;d++)b[i][d]+=v*sample.y[d];}}
  for(let i=0;i<n;i++){a[i][i]+=.08;for(let j=0;j<i;j++)a[j][i]=a[i][j];}members.push({projection,weights:solve(a,b)});
 }
 return {version,members,trainingSeeds,samples:samples.length,createdAt:new Date().toISOString()};
}
export function predict(model:WorldModel,o:Observation,a:Action,t:number){
 if(t===0)return {mean:[o.rn,o.rs,o.lastN+o.lastV*o.age,o.lastS],spread:0};
 const ys=model.members.map(m=>{const x=features(input(o,a,t),m.projection);return [0,1,2,3].map(d=>x.reduce((s,v,i)=>s+v*m.weights[i][d],0));});
 const mean=[0,1,2,3].map(d=>ys.reduce((s,y)=>s+y[d],0)/ys.length);
 const spread=Math.sqrt(ys.reduce((s,y)=>s+(y[2]-mean[2])**2+(y[3]-mean[3])**2,0)/ys.length);
 return {mean,spread};
}
