import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveModelSelection } from '../src/model-selection.js';
import { api } from '../src/api.js';
import { Jobs } from '../src/jobs.js';
import { Store } from '../src/store.js';

const option=(label:string,selected=true,visible=true)=>({label,selected,visible});
const rejects=(p:Promise<unknown>,code:string)=>assert.rejects(p,(e:any)=>e.code===code);

test('Pro selection supports model and effort controls, rejecting hidden, unavailable or ambiguous choices',()=>{
  assert.deepEqual(resolveModelSelection({models:[option('GPT-6 Pro')]}),{model:'GPT-6 Pro',effort:undefined,mode:'pro'});
  assert.deepEqual(resolveModelSelection({models:[option('GPT-6')],efforts:[option('Pro')]}),{model:'GPT-6',effort:'Pro',mode:'pro'});
  for(const label of ['High','高','Max']) assert.equal(resolveModelSelection({models:[option('GPT-6')],efforts:[option(label)]}).mode,'chat');
  assert.equal(resolveModelSelection({models:[option('GPT-6'),option('GPT-6 Pro',true,false)]}).mode,'chat');
  for(const models of [[],[option('GPT-6',false)],[option('GPT-6'),option('GPT-6 Pro')],[{...option('GPT-6 Pro'),disabled:true}]])
    assert.throws(()=>resolveModelSelection({models}));
});

test('inspect_page keeps its old contract and uses explicit selection rather than a Pro account badge',async()=>{
  assert.equal(Object.keys(api()).length,19);
  const entry=api().inspect_page;
  const plain=entry.run(entry.schema.parse({snapshot:'Account: ChatGPT Pro. button "Stop"'}));
  assert.equal(plain.complete,false);assert.equal(plain.selection,undefined);
  const observed=entry.run(entry.schema.parse({snapshot:'Power: Pro; current task only',selection:{models:[option('GPT-6')],efforts:[option('Pro')]}}));
  assert.equal(observed.selection?.mode,'pro');assert.equal(observed.complete,false);
});

test('Web Pro reservation, reconnect and same-conversation continuation preserve model, effort and browser ownership',async()=>{
  let now=1_000;const home=mkdtempSync(join(tmpdir(),'cwc-pro-'));let jobs=new Jobs(new Store(home),()=>now);
  const binding={browser:'native-browser:session-a',tab:'7',conversation:'https://chatgpt.com/c/pro-fixture'};
  const job=await jobs.prepare({kind:'collaborate',mode:'pro',prompt:'Inspect fixture'});await jobs.bind(job.id,binding,[]);
  for(const effort of ['High','高','Max',undefined]) await rejects(jobs.reserve(job.id,{binding,model:'GPT-6',mode:'pro',effort,attachmentsReady:true}),'PRO_SELECTION_MISMATCH');
  const reservation=await jobs.reserve(job.id,{binding,model:'GPT-6',mode:'pro',effort:'Pro',attachmentsReady:true});
  now+=3_700_000;jobs=new Jobs(new Store(home),()=>now);
  assert.equal((await jobs.resume(job.id,binding)).nonce,reservation.nonce);
  await rejects(jobs.reserve(job.id,{binding,model:'GPT-6',mode:'pro',effort:'Pro',attachmentsReady:true}),'ALREADY_RESERVED');
  await rejects(jobs.recover(job.id,{...binding,browser:'native-browser:different-session'}),'BROWSER_MISMATCH');
  const recovered={...binding,tab:'8'};await jobs.recover(job.id,recovered);
  await jobs.submission(job.id,{binding:recovered,nonce:reservation.nonce,turn:'one',visiblePrompt:job.prompt,model:'GPT-6',mode:'pro',effort:'Pro'});
  const observation={binding:recovered,turn:'one',phase:'complete' as const,text:'A scoped Pro result with a verified boundary finding.',model:'GPT-6',mode:'pro' as const,effort:'Pro',generating:false};
  await rejects(jobs.observe(job.id,{...observation,binding}),'BINDING_MISMATCH');
  await rejects(jobs.observe(job.id,{...observation,effort:'High'}),'EFFORT_MISMATCH');
  await rejects(jobs.observe(job.id,{...observation,mode:'chat'}),'MODE_MISMATCH');
  await jobs.observe(job.id,observation);now+=15_000;await jobs.observe(job.id,observation);
  const result=await jobs.result(job.id);assert.equal(result.actualModel,'GPT-6');assert.equal(result.actualEffort,'Pro');
  const next=await jobs.prepare({kind:'collaborate',prompt:'Review fix',parent:job.id});assert.equal(next.mode,'pro');assert.deepEqual(next.binding,recovered);
});
