import assert from 'node:assert/strict';
import {bootstrap,improve,TRAIN_INITIAL,TRAIN_EXPAND,VALIDATION,TEST,evaluate,forecast,choose} from '../../src/fork/learning.ts';
import {scenario,simulate,ACTIONS,observation} from '../../src/fork/simulation.ts';
import {mkdir,writeFile} from 'node:fs/promises';
const m=bootstrap(),initial=evaluate(m),update=improve(m);
for(const a of [TRAIN_INITIAL,TRAIN_EXPAND])for(const seed of a){assert.ok(!VALIDATION.includes(seed));assert.ok(!TEST.includes(seed));}
assert.ok(!VALIDATION.some(s=>TEST.includes(s)));
assert.ok(Number.isFinite(initial.learned.forecastRMSE));assert.ok(update.promoted,update.reason);
assert.ok(update.test.learned.forecastRMSE<initial.learned.forecastRMSE,'Held-out forecasts should improve');
const s=scenario(42);assert.deepEqual(simulate(s,'continue'),simulate(s,'continue'));
const o=observation(s);assert.ok(!('hesitation' in o));assert.ok(!('pn' in o));
const changed={...s,hesitation:s.hesitation+.5};assert.deepEqual(observation(changed),o,'Hidden behavior must not leak into observation');
const fs=ACTIONS.map(a=>forecast(update.model,o,a));assert.ok(ACTIONS.includes(choose(fs)));
await mkdir('artifacts/fork',{recursive:true});await writeFile('artifacts/fork/model-validation.json',JSON.stringify({initial,validationBefore:update.validationBefore,validationAfter:update.validationAfter,test:update.test,promoted:update.promoted,durationMs:update.durationMs,forecasts:fs.map(({action,clearance,progress,score})=>({action,clearance,progress,score}))},null,2));
console.log(JSON.stringify({initial:initial.learned,updated:update.test.learned,baseline:initial.baseline,promoted:update.promoted,ms:update.durationMs},null,2));
