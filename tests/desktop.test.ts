import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { invoke } from '../src/api.js';
import { Jobs } from '../src/jobs.js';
import { Store } from '../src/store.js';
import { CwcError } from '../src/errors.js';

const threadId='authorized-chatgpt-thread';
function setup(t:TestContext) {
  const home=mkdtempSync(join(tmpdir(),'ccb-desktop-'));
  t.after(()=>rmSync(home,{recursive:true,force:true}));
  let jobs=new Jobs(new Store(home));
  return {
    home,
    get jobs(){return jobs;},
    restart(){jobs=new Jobs(new Store(home));},
    call:(method:string,input:unknown):Promise<any>=>invoke(method,input,jobs)
  };
}
type Fixture=ReturnType<typeof setup>;
const rejects=(action:Promise<unknown>,code:string)=>assert.rejects(action,error=>error instanceof CwcError && error.code===code);
async function prepare(s:Fixture,prompt='Review this synthetic example',extra:object={}) {
  return s.call('desktop_prepare',{kind:'collaborate',prompt,threadId,confirmedPro:true,...extra});
}
async function started(s:Fixture,turnId='current-turn',extra:object={}) {
  const job=await prepare(s,'Review this synthetic example',extra);
  await s.call('desktop_bind',{id:job.id,threadId,baselineTurns:['old-turn']});
  const reservation=await s.call('desktop_reserve',{id:job.id,threadId});
  const submission={id:job.id,threadId,nonce:reservation.nonce,turnId,userMessageId:`user-${turnId}`,visiblePrompt:job.prompt};
  await s.call('desktop_confirm',submission);
  return {job,reservation,submission};
}
function finalObservation(id:string,turnId='current-turn',extra:object={}) {
  return {id,threadId,turnId,userMessageId:`user-${turnId}`,phase:'complete',assistantMessageId:`assistant-${turnId}`,text:'The requested synthetic review is complete.',turnCompleted:true,truncated:false,...extra};
}

test('desktop tasks preserve existing version-one browser task recovery',async t=>{
  const s=setup(t);
  const binding={browser:'existing-native-browser',tab:'existing-tab',conversation:'https://chatgpt.com/c/existing-web-task'};
  const web=await s.jobs.prepare({kind:'collaborate',prompt:'Existing web request'});
  await s.jobs.bind(web.id,binding,[]);
  const reserved=await s.jobs.reserve(web.id,{binding,model:'GPT-6',mode:'chat',attachmentsReady:true});
  const desktop=await prepare(s);
  await s.call('desktop_bind',{id:desktop.id,threadId,baselineTurns:[]});

  s.restart();
  const resumedWeb=await s.jobs.resume(web.id,binding);
  assert.equal(resumedWeb.status,'send_pending');
  assert.equal(resumedWeb.nonce,reserved.nonce);
  assert.deepEqual(resumedWeb.binding,binding);
  const resumedDesktop=await s.call('desktop_resume',{id:desktop.id,threadId});
  assert.equal(resumedDesktop.status,'bound');
  assert.deepEqual(resumedDesktop.modelEvidence,{requested:'pro',confirmedBy:'user',actual:'unknown'});
  const listed=await s.call('list',{});
  assert(listed.some((entry:{id:string})=>entry.id===web.id));
  assert(listed.some((entry:{id:string;transport?:string;threadId?:string})=>entry.id===desktop.id && entry.transport==='desktop' && entry.threadId===threadId));
});

test('a web research task waiting for clarification retains ownership of the desktop conversation',async t=>{
  const s=setup(t);
  const binding={browser:'native-browser',tab:'research-tab',conversation:`https://chatgpt.com/c/${threadId}`};
  const web=await s.jobs.prepare({kind:'research',prompt:'Research this bounded synthetic question'});
  await s.jobs.bind(web.id,binding,[]);
  const reservation=await s.jobs.reserve(web.id,{binding,model:'GPT-6',mode:'research',attachmentsReady:true});
  await s.jobs.submission(web.id,{binding,nonce:reservation.nonce,turn:'research-turn',visiblePrompt:web.prompt,model:'GPT-6',mode:'research'});
  const waiting=await s.jobs.observe(web.id,{binding,turn:'research-turn',phase:'clarification',text:'Which sources should I use?',model:'GPT-6',mode:'research',generating:false});
  assert.equal(waiting.status,'waiting_user');
  const desktop=await prepare(s);

  await rejects(s.call('desktop_bind',{id:desktop.id,threadId,baselineTurns:[]}), 'THREAD_BUSY');
  assert.equal((await s.call('desktop_resume',{id:desktop.id,threadId})).status,'prepared');
  await s.jobs.cancel(web.id,true);
  assert.equal((await s.call('desktop_bind',{id:desktop.id,threadId,baselineTurns:[]})).status,'bound');
});

test('an uncertain desktop submission retains its nonce across restart and cannot be reserved again',async t=>{
  const s=setup(t);
  const job=await prepare(s);
  await s.call('desktop_bind',{id:job.id,threadId,baselineTurns:[]});
  await rejects(s.call('desktop_reserve',{id:job.id,threadId:'different-chat'}),'THREAD_MISMATCH');
  const reservation=await s.call('desktop_reserve',{id:job.id,threadId});
  s.restart();

  const resumed=await s.call('desktop_resume',{id:job.id,threadId});
  assert.equal(resumed.status,'send_pending');
  assert.equal(resumed.nonce,reservation.nonce);
  assert.equal(resumed.prompt,job.prompt);
  await rejects(s.call('desktop_reserve',{id:job.id,threadId}),'ALREADY_RESERVED');
  await rejects(s.call('desktop_resume',{id:job.id,threadId:'different-chat'}),'THREAD_MISMATCH');
  const confirmed=await s.call('desktop_confirm',{id:job.id,threadId,nonce:reservation.nonce,turnId:'observed-turn',userMessageId:'observed-user',visiblePrompt:job.prompt});
  assert.equal(confirmed.status,'running');
});

test('desktop confirmation and observations reject old turns and unrelated user messages',async t=>{
  const s=setup(t);
  const job=await prepare(s);
  await s.call('desktop_bind',{id:job.id,threadId,baselineTurns:['old-turn']});
  const reservation=await s.call('desktop_reserve',{id:job.id,threadId});
  const submission={id:job.id,threadId,nonce:reservation.nonce,turnId:'current-turn',userMessageId:'user-current-turn',visiblePrompt:job.prompt};
  await rejects(s.call('desktop_confirm',{...submission,turnId:'old-turn'}),'STALE_TURN');
  await rejects(s.call('desktop_confirm',{...submission,visiblePrompt:'A different request'}),'PROMPT_NOT_OBSERVED');
  assert.equal((await s.call('desktop_resume',{id:job.id,threadId})).status,'send_pending');
  await s.call('desktop_confirm',submission);

  await rejects(s.call('desktop_observe',finalObservation(job.id,'old-turn')),'TURN_MISMATCH');
  await rejects(s.call('desktop_observe',finalObservation(job.id,'current-turn',{userMessageId:'unrelated-user'})),'MESSAGE_MISMATCH');
  await rejects(s.call('desktop_observe',finalObservation(job.id,'current-turn',{threadId:'different-chat'})),'THREAD_MISMATCH');
  assert.equal((await s.call('desktop_resume',{id:job.id,threadId})).status,'running');
  await rejects(s.call('desktop_result',{id:job.id}),'RESULT_NOT_READY');
});

test('desktop confirmation requires the full prepared source context, not just its task marker',async t=>{
  const s=setup(t);
  const root=join(s.home,'fixture');
  mkdirSync(root);
  execFileSync('git',['init','-q',root]);
  execFileSync('git',['-C',root,'config','user.email','test@example.invalid']);
  execFileSync('git',['-C',root,'config','user.name','Test']);
  writeFileSync(join(root,'booking.js'),'export function canBook(count, capacity) { return count < capacity; }\n');
  execFileSync('git',['-C',root,'add','.']);
  execFileSync('git',['-C',root,'commit','-qm','fixture']);
  const job=await prepare(s,'Review the provided booking source',{context:{root,scope:'repository'}});
  assert.match(job.prompt,/return count < capacity;/);
  await s.call('desktop_bind',{id:job.id,threadId,baselineTurns:[]});
  const reservation=await s.call('desktop_reserve',{id:job.id,threadId});
  const submission={id:job.id,threadId,nonce:reservation.nonce,turnId:'source-review',userMessageId:'source-user',visiblePrompt:job.prompt};
  const missingContext=job.prompt.replace('return count < capacity;','');
  assert.match(missingContext,new RegExp(`CWC-${job.id}`));
  await rejects(s.call('desktop_confirm',{...submission,visiblePrompt:missingContext}),'PROMPT_NOT_OBSERVED');
  assert.equal((await s.call('desktop_resume',{id:job.id,threadId})).status,'send_pending');
  assert.equal((await s.call('desktop_confirm',submission)).status,'running');
});

test('a desktop request beyond the host read limit is rejected before reserving a send',async t=>{
  const s=setup(t);
  const job=await prepare(s,'x'.repeat(20_000));
  await s.call('desktop_bind',{id:job.id,threadId,baselineTurns:[]});
  await rejects(s.call('desktop_reserve',{id:job.id,threadId}),'PROMPT_TOO_LARGE');
  const resumed=await s.call('desktop_resume',{id:job.id,threadId});
  assert.equal(resumed.status,'bound');
  assert.equal(resumed.nonce,undefined);
});

test('a truncated desktop reply remains partial until the same completed turn provides full text',async t=>{
  const s=setup(t);
  const {job}=await started(s);
  const partial=await s.call('desktop_observe',finalObservation(job.id,'current-turn',{text:'Only the first part of the review.',truncated:true}));
  assert.equal(partial.status,'partial');
  await rejects(s.call('desktop_result',{id:job.id}),'RESULT_NOT_READY');
  await rejects(s.call('desktop_observe',finalObservation(job.id,'current-turn',{turnCompleted:false})),'TURN_NOT_COMPLETED');
  s.restart();
  assert.equal((await s.call('desktop_resume',{id:job.id,threadId})).status,'partial');

  const final=finalObservation(job.id);
  assert.equal((await s.call('desktop_observe',final)).status,'completed');
  const result=await s.call('desktop_result',{id:job.id});
  assert.equal(result.result.text,final.text);
  assert.equal(result.result.assistantMessageId,final.assistantMessageId);
  assert.equal(result.result.turnId,final.turnId);
  assert.equal(result.result.userMessageId,final.userMessageId);
  assert.equal(result.result.truncated,false);
  assert.deepEqual(result.modelEvidence,{requested:'pro',confirmedBy:'user',actual:'unknown'});
});

test('same-chat continuation uses a new turn and preserves the first round result',async t=>{
  const s=setup(t);
  const first=await started(s,'first-turn');
  await s.call('desktop_observe',finalObservation(first.job.id,'first-turn',{text:'First round conclusion.'}));
  await rejects(prepare(s,'Follow up',{parent:first.job.id,threadId:'different-chat'}),'CONTINUATION_MISMATCH');
  const second=await prepare(s,'Use the first round conclusion',{parent:first.job.id});
  await s.call('desktop_bind',{id:second.id,threadId,baselineTurns:['old-turn','first-turn']});
  const reservation=await s.call('desktop_reserve',{id:second.id,threadId});
  const submission={id:second.id,threadId,nonce:reservation.nonce,turnId:'second-turn',userMessageId:'user-second-turn',visiblePrompt:second.prompt};
  await rejects(s.call('desktop_confirm',{...submission,turnId:'first-turn'}),'STALE_TURN');
  await s.call('desktop_confirm',submission);
  await rejects(s.call('desktop_observe',finalObservation(second.id,'first-turn')),'TURN_MISMATCH');
  await s.call('desktop_observe',finalObservation(second.id,'second-turn',{text:'Second round conclusion.'}));

  s.restart();
  assert.equal((await s.call('desktop_result',{id:first.job.id})).result.text,'First round conclusion.');
  const result=await s.call('desktop_result',{id:second.id});
  assert.equal(result.result.text,'Second round conclusion.');
  assert.equal(result.result.turnId,'second-turn');
});
