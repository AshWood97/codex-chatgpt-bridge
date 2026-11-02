import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Jobs } from '../src/jobs.js';
import { Store, defaultStoreHome } from '../src/store.js';

const bins = JSON.parse(readFileSync('package.json', 'utf8')).bin as Record<string, string>;
function cli(alias: 'ccb' | 'cwc', command: string, input: unknown, overrides: NodeJS.ProcessEnv) {
  assert.ok(bins[alias], `${alias} must be installed as a CLI entrypoint`);
  const env = { ...process.env };
  delete env.CCB_HOME; delete env.CWC_HOME;
  const result = spawnSync(process.execPath, [resolve(bins[alias]!), command, '--stdin'], {
    env: { ...env, ...overrides }, input: JSON.stringify(input), encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('CCB_HOME selects its own state ahead of CWC_HOME while the legacy override remains usable', async t => {
  const root = mkdtempSync(join(tmpdir(), 'ccb-env-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const legacy = join(root, 'legacy'), current = join(root, 'current');
  const oldJob = await new Jobs(new Store(legacy)).prepare({ kind: 'collaborate', prompt: 'Legacy data' });
  const newJob = await new Jobs(new Store(current)).prepare({ kind: 'collaborate', prompt: 'Current data' });
  const oldState = readFileSync(join(legacy, 'state.json'), 'utf8');

  const currentJobs = cli('ccb', 'list', {}, { CCB_HOME: current, CWC_HOME: legacy });
  assert.deepEqual(currentJobs.map((j: { id: string }) => j.id), [newJob.id]);
  const legacyJobs = cli('cwc', 'list', {}, { CWC_HOME: legacy });
  assert.deepEqual(legacyJobs.map((j: { id: string }) => j.id), [oldJob.id]);
  assert.equal(readFileSync(join(legacy, 'state.json'), 'utf8'), oldState);
});

test('the renamed CLI resumes a CWC-marked pending task created by the legacy CLI alias', t => {
  const root = mkdtempSync(join(tmpdir(), 'ccb-resume-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const job = cli('cwc', 'prepare', { kind: 'collaborate', prompt: 'Preserve the legacy request' }, { CWC_HOME: root });
  assert.ok(job.prompt.includes(`CWC-${job.id}`));
  const binding = { browser: 'native-browser', tab: 'legacy-tab' };
  cli('cwc', 'bind', { id: job.id, binding, baselineTurns: [] }, { CWC_HOME: root });
  const reservation = cli('cwc', 'reserve_submission', {
    id: job.id, binding, model: 'GPT-6', mode: 'chat', attachmentsReady: true
  }, { CWC_HOME: root });
  const resumed = cli('ccb', 'resume', { id: job.id, binding }, { CCB_HOME: root });
  assert.equal(resumed.id, job.id);
  assert.equal(resumed.status, 'send_pending');
  assert.equal(resumed.nonce, reservation.nonce);
  assert.deepEqual(resumed.binding, binding);
  assert.equal(bins['ccb-mcp'], bins['cwc-mcp']);
  assert.ok(bins['ccb-mcp'] && existsSync(resolve(bins['ccb-mcp'])));
});

test('default-directory selection preserves old jobs and refuses conflicting stores without overwriting either', async t => {
  const root = mkdtempSync(join(tmpdir(), 'ccb-default-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const freshUser = join(root, 'fresh-user');
  const freshHome = join(freshUser, '.local/share/codex-chatgpt-bridge');
  await new Jobs(new Store(defaultStoreHome({}, freshUser))).prepare({ kind: 'collaborate', prompt: 'Fresh installation' });
  assert.ok(existsSync(join(freshHome, 'state.json')));
  assert.equal(existsSync(join(freshUser, '.local/share/codex-web-capabilities')), false);

  const existingUser = join(root, 'existing-user');
  const oldHome = join(existingUser, '.local/share/codex-web-capabilities');
  const newHome = join(existingUser, '.local/share/codex-chatgpt-bridge');
  const oldJob = await new Jobs(new Store(oldHome)).prepare({ kind: 'collaborate', prompt: 'Existing installation' });
  const loaded = await new Jobs(new Store(defaultStoreHome({}, existingUser))).list();
  assert.deepEqual(loaded.map(j => j.id), [oldJob.id]);
  assert.equal(existsSync(newHome), false);

  await new Jobs(new Store(newHome)).prepare({ kind: 'collaborate', prompt: 'Separate existing data' });
  const oldState = readFileSync(join(oldHome, 'state.json'), 'utf8');
  const newState = readFileSync(join(newHome, 'state.json'), 'utf8');
  assert.throws(() => defaultStoreHome({}, existingUser), (error: any) => error.code === 'DATA_HOME_AMBIGUOUS');
  assert.equal(readFileSync(join(oldHome, 'state.json'), 'utf8'), oldState);
  assert.equal(readFileSync(join(newHome, 'state.json'), 'utf8'), newState);
});
