import {mkdir,writeFile} from 'node:fs/promises';
import {bootstrap,improve,evaluate,forecast,choose,TRAIN_INITIAL,VALIDATION,TEST} from '../../src/fork/learning.ts';
import {ACTIONS,scenario,simulate,VAN} from '../../src/fork/simulation.ts';
const initial=bootstrap(),update=improve(initial),models={initial,updated:update.model};
const cases=TEST.map(seed=>{
 const s=scenario(seed),actual=ACTIONS.map(a=>simulate(s,a));
 const forecasts=Object.fromEntries([...Object.entries(models),['baseline',null] as const].map(([name,model])=>{
  const branches=ACTIONS.map(a=>forecast(model,actual[0].observation,a));
  return [name,{chosen:choose(branches),branches}];
 }));
 return {seed,scenario:s,actual,forecasts};
});
await mkdir('artifacts/fork',{recursive:true});
await writeFile('artifacts/fork/lab-data.json',JSON.stringify({schema:'fork-lab-v1',createdAt:new Date().toISOString(),
 initial:evaluate(initial),updated:update.test,promotion:{promoted:update.promoted,reason:update.reason,before:update.validationBefore,after:update.validationAfter},
 partitions:{initial:TRAIN_INITIAL,expanded:update.model.trainingSeeds,validation:VALIDATION,test:TEST},
 training:update.model.trainingSeeds.map(scenario),models,van:VAN,cases,
 limits:'Synthetic kinematics. No real pedestrian calibration, G1 motor control or physical safety validation.'}));
console.log('Exported 64 held-out scenarios × 3 actions × 3 predictors to artifacts/fork/lab-data.json');
