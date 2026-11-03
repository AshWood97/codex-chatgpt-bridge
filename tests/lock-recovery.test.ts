import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { Store } from '../src/store.js';

function exitedPid() {
  const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  assert.equal(child.status, 0);
  assert.throws(() => process.kill(child.pid, 0), { code: 'ESRCH' });
  return child.pid;
}

async function until(check: () => boolean, message: string) {
  const deadline = Date.now() + 7_000;
  while (!check()) {
    assert.ok(Date.now() < deadline, message);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

// Pause a real reclaimer at the old check/unlink race window. The second
// process signals when it has either waited for recovery or entered a
// transaction, so the test does not depend on winning a scheduling race.
const writer = String.raw`
import fs from 'node:fs';
import { join } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
const [home, role, moduleUrl] = process.argv.slice(1);
const mainLock = join(home, 'state.lock');
const recoveryLock = join(home, 'state.lock.recovery');
const originalWrite = fs.writeFileSync;
const originalUnlink = fs.unlinkSync;
const pause = new Int32Array(new SharedArrayBuffer(4));
function waitFor(name) {
  const deadline = Date.now() + 7_000;
  while (!fs.existsSync(join(home, name))) {
    if (Date.now() >= deadline) throw new Error('Barrier timeout: ' + name);
    Atomics.wait(pause, 0, 0, 5);
  }
}
let paused = false;
fs.unlinkSync = function(path) {
  if (role === 'a' && path === mainLock && !paused) {
    paused = true;
    originalWrite(join(home, 'a-before-unlink'), 'ready');
    waitFor('release-a');
  }
  return originalUnlink(path);
};
fs.writeFileSync = function(path, ...args) {
  try { return originalWrite(path, ...args); }
  catch (error) {
    if (role === 'b' && path === recoveryLock && error.code === 'EEXIST')
      originalWrite(join(home, 'b-waiting-for-recovery'), 'waiting');
    throw error;
  }
};
syncBuiltinESMExports();
const { Store } = await import(moduleUrl);
await new Store(home).transact(db => {
  originalWrite(join(home, role + '-entered'), 'entered');
  const active = join(home, 'transaction-active');
  try { originalWrite(active, role, { flag: 'wx' }); }
  catch (error) {
    originalWrite(join(home, 'transaction-overlap'), role);
    throw error;
  }
  try {
    if (role === 'b') waitFor('release-b');
    db.maxConcurrent += 1;
  } finally { originalUnlink(active); }
});
`;

test('competing dead-lock reclaimers keep transactions exclusive and retain both updates', { timeout: 20_000 }, async t => {
  const home = mkdtempSync(join(tmpdir(), 'ccb-lock-race-'));
  const children: { child: ReturnType<typeof spawn>; done: Promise<{ code: number | null; output: string }>; exited: () => boolean }[] = [];
  t.after(async () => {
    writeFileSync(join(home, 'release-a'), 'release');
    writeFileSync(join(home, 'release-b'), 'release');
    for (const item of children) if (!item.exited()) item.child.kill('SIGKILL');
    await Promise.all(children.map(item => item.done));
    rmSync(home, { recursive: true, force: true });
  });
  writeFileSync(join(home, 'state.json'), JSON.stringify({ version: 1, jobs: {}, maxConcurrent: 2 }));
  writeFileSync(join(home, 'state.lock'), JSON.stringify({ pid: exitedPid(), nonce: 'dead-owner' }));
  function start(role: string) {
    const child = spawn(process.execPath, ['--input-type=module', '-e', writer, home, role, new URL('../src/store.js', import.meta.url).href], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', exited = false;
    child.stdout.on('data', text => { output += text; });
    child.stderr.on('data', text => { output += text; });
    const done = new Promise<{ code: number | null; output: string }>(resolve => {
      child.on('error', error => { output += String(error); });
      child.on('close', code => { exited = true; resolve({ code, output }); });
    });
    const item = { child, done, exited: () => exited };
    children.push(item);
    return item;
  }
  const a = start('a');
  await until(() => existsSync(join(home, 'a-before-unlink')), 'first reclaimer did not reach the stale-lock deletion barrier');
  const b = start('b');
  await until(() => existsSync(join(home, 'b-waiting-for-recovery')) || existsSync(join(home, 'b-entered')), 'second reclaimer did not attempt recovery');
  const enteredWhileAWasReclaiming = existsSync(join(home, 'b-entered'));
  writeFileSync(join(home, 'release-a'), 'release');
  await until(() => existsSync(join(home, 'b-entered')), 'second writer did not acquire the released lock');
  writeFileSync(join(home, 'release-b'), 'release');
  const outcomes = await Promise.all([a.done, b.done]);

  assert.equal(enteredWhileAWasReclaiming, false, 'a second writer entered before the first stale-lock reclaimer finished');
  for (const outcome of outcomes) assert.equal(outcome.code, 0, outcome.output);
  assert.equal(existsSync(join(home, 'transaction-overlap')), false, 'both transaction callbacks ran at once');
  assert.equal(JSON.parse(readFileSync(join(home, 'state.json'), 'utf8')).maxConcurrent, 4);
  assert.equal(existsSync(join(home, 'state.lock')), false);
  assert.equal(existsSync(join(home, 'state.lock.recovery')), false);
});

test('an interrupted recovery reports its error and preserves both locks and the database', async t => {
  const home = mkdtempSync(join(tmpdir(), 'ccb-lock-interrupted-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const state = JSON.stringify({ version: 1, jobs: {}, maxConcurrent: 2 });
  const pid = exitedPid();
  const main = JSON.stringify({ pid, nonce: 'dead-main-owner' });
  const recovery = JSON.stringify({ pid, nonce: 'dead-recovery-owner' });
  writeFileSync(join(home, 'state.json'), state);
  writeFileSync(join(home, 'state.lock'), main);
  writeFileSync(join(home, 'state.lock.recovery'), recovery);
  let entered = false;
  await assert.rejects(new Store(home).transact(db => { entered = true; db.maxConcurrent += 1; }), (error: any) => {
    assert.equal(error.code, 'LOCK_RECOVERY_INTERRUPTED');
    assert.match(error.message, /Stop all writers/);
    return true;
  });
  assert.equal(entered, false);
  assert.equal(readFileSync(join(home, 'state.json'), 'utf8'), state);
  assert.equal(readFileSync(join(home, 'state.lock'), 'utf8'), main);
  assert.equal(readFileSync(join(home, 'state.lock.recovery'), 'utf8'), recovery);
});
