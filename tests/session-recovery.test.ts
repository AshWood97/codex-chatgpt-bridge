import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Jobs } from '../src/jobs.js';
import { Store } from '../src/store.js';
import { CwcError } from '../src/errors.js';
import type { Binding } from '../src/types.js';

function setup(t: TestContext) {
  const home=mkdtempSync(join(tmpdir(),'ccb-session-'));
  t.after(()=>rmSync(home,{recursive:true,force:true}));
  const store=new Store(home);
  return { home, store, jobs:new Jobs(store) };
}
const reserveInput=(binding:Binding)=>({binding,model:'GPT-6',mode:'chat' as const,attachmentsReady:true});
const rejects=(action:Promise<unknown>,code:string)=>assert.rejects(action,error=>error instanceof CwcError && error.code===code);

test('confirmation without a conversation stays pending and can later confirm and recover without another reservation',async t=>{
  const {home,jobs}=setup(t);
  const binding={browser:'native-session',tab:'original'};
  const job=await jobs.prepare({kind:'collaborate',prompt:'Check the submitted task'});
  await jobs.bind(job.id,binding,[]);
  const reservation=await jobs.reserve(job.id,reserveInput(binding));
  const evidence={binding,nonce:reservation.nonce,turn:'submitted-turn',visiblePrompt:job.prompt,model:'GPT-6'};

  await rejects(jobs.submission(job.id,evidence),'CONVERSATION_REQUIRED');
  const pending=await jobs.status(job.id);
  assert.equal(pending.status,'send_pending');
  assert.equal(pending.turn,undefined);
  assert.equal(pending.binding?.conversation,undefined);
  assert.equal((await jobs.resume(job.id,binding)).nonce,reservation.nonce);
  await rejects(jobs.reserve(job.id,reserveInput(binding)),'ALREADY_RESERVED');

  const observed={...binding,conversation:'https://chatgpt.com/c/submitted-task'};
  const confirmed=await jobs.submission(job.id,{...evidence,binding:observed});
  assert.equal(confirmed.status,'running');
  assert.equal(confirmed.turn,evidence.turn);
  const recoveredBinding={...observed,tab:'replacement'};
  const recovered=await new Jobs(new Store(home)).recover(job.id,recoveredBinding);
  assert.equal(recovered.status,'running');
  assert.equal(recovered.turn,evidence.turn);
  assert.deepEqual(recovered.binding,recoveredBinding);
});

test('reservation rejects an occupied conversation and claims a newly observed conversation before sending',async t=>{
  const {jobs}=setup(t);
  const conversation='https://chatgpt.com/c/owned';
  const first=await jobs.prepare({kind:'collaborate',prompt:'First task'});
  await jobs.bind(first.id,{browser:'native-session',tab:'first',conversation},[]);
  const second=await jobs.prepare({kind:'collaborate',prompt:'Second task'});
  const secondBinding={browser:'native-session',tab:'second'};
  await jobs.bind(second.id,secondBinding,[]);

  await rejects(jobs.reserve(second.id,reserveInput({...secondBinding,conversation:conversation+'/'})),'CONVERSATION_BUSY');
  assert.equal((await jobs.status(second.id)).status,'bound');
  assert.equal((await jobs.resume(second.id,secondBinding)).nonce,undefined);

  const observed={...secondBinding,conversation:'https://chatgpt.com/c/newly-observed'};
  await jobs.reserve(second.id,reserveInput(observed));
  assert.deepEqual((await jobs.status(second.id)).binding,observed);
  await jobs.cancel(first.id,true);
  const third=await jobs.prepare({kind:'collaborate',prompt:'Third task'});
  await rejects(jobs.bind(third.id,{browser:'native-session',tab:'third',conversation:observed.conversation+'/'},[]),'CONVERSATION_BUSY');
  assert.equal((await jobs.status(third.id)).status,'prepared');
});

test('a conversation conflict discovered after sending leaves the original submission pending and cannot authorize a resend',async t=>{
  const {jobs}=setup(t);
  const second=await jobs.prepare({kind:'collaborate',prompt:'Request with an initially unknown conversation'});
  const secondBinding={browser:'native-session',tab:'second'};
  await jobs.bind(second.id,secondBinding,[]);
  const reservation=await jobs.reserve(second.id,reserveInput(secondBinding));
  const conversation='https://chatgpt.com/c/already-owned';
  const first=await jobs.prepare({kind:'collaborate',prompt:'Owner of the discovered conversation'});
  const firstBinding={browser:'native-session',tab:'first',conversation};
  await jobs.bind(first.id,firstBinding,[]);

  await rejects(jobs.submission(second.id,{
    binding:{...secondBinding,conversation:conversation+'/'},nonce:reservation.nonce,
    turn:'submitted-turn',visiblePrompt:second.prompt,model:'GPT-6'
  }),'CONVERSATION_BUSY');
  const pending=await jobs.resume(second.id,secondBinding);
  assert.equal(pending.status,'send_pending');
  assert.equal(pending.nonce,reservation.nonce);
  assert.equal(pending.turn,undefined);
  assert.deepEqual(pending.binding,secondBinding);
  assert.deepEqual((await jobs.status(first.id)).binding,firstBinding);
  await rejects(jobs.reserve(second.id,reserveInput(secondBinding)),'ALREADY_RESERVED');
});

test('legacy confirmed tasks without a URL recover only with their nonce, full prompt, saved turn and original browser',async t=>{
  for(const status of ['running','waiting_user','partial','cancel_requested'] as const) {
    const {home,store,jobs}=setup(t);
    const binding={browser:'native-session',tab:'lost',conversation:`https://chatgpt.com/c/legacy-${status}`};
    const job=await jobs.prepare({kind:'collaborate',prompt:'Original legacy request'});
    await jobs.bind(job.id,binding,[]);
    const reservation=await jobs.reserve(job.id,reserveInput(binding));
    const turn='original-turn';
    await jobs.submission(job.id,{binding,nonce:reservation.nonce,turn,visiblePrompt:job.prompt,model:'GPT-6'});
    // Persist the state an older version could leave after confirming without a URL.
    await store.transact(db=>{const saved=db.jobs[job.id]!;delete saved.binding!.conversation;saved.status=status;});
    const restarted=new Jobs(new Store(home));
    const originalBinding={browser:binding.browser,tab:binding.tab};
    const resumed=await restarted.resume(job.id,originalBinding);
    assert.equal(resumed.nonce,reservation.nonce);
    assert.equal(resumed.status,status);
    const recoveredBinding={...binding,tab:'replacement'};
    const evidence={nonce:reservation.nonce,turn,visiblePrompt:job.prompt};

    await rejects(restarted.recover(job.id,recoveredBinding),'RECOVERY_IDENTITY');
    for(const invalid of [
      {...evidence,nonce:'wrong-nonce'},
      {...evidence,turn:'another-turn'},
      {nonce:reservation.nonce,visiblePrompt:job.prompt},
      {...evidence,visiblePrompt:`Original legacy request\nRequest identifier: CWC-${job.id}`}
    ]) await rejects(restarted.recover(job.id,recoveredBinding,invalid),'RECOVERY_IDENTITY');
    await rejects(restarted.recover(job.id,{...recoveredBinding,browser:'different-browser'},evidence),'BROWSER_MISMATCH');
    const unchanged=await restarted.status(job.id);
    assert.equal(unchanged.status,status);
    assert.equal(unchanged.turn,turn);
    assert.deepEqual(unchanged.binding,originalBinding);

    const recovered=await restarted.recover(job.id,recoveredBinding,evidence);
    assert.equal(recovered.status,status);
    assert.equal(recovered.turn,turn);
    assert.deepEqual(recovered.binding,recoveredBinding);
    await rejects(restarted.reserve(job.id,reserveInput(recoveredBinding)),'ALREADY_RESERVED');
  }
});
