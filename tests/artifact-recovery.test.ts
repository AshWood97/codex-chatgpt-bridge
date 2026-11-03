import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { constants, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Jobs } from '../src/jobs.js';
import { Store } from '../src/store.js';
import type { Binding, Database } from '../src/types.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9kAAAAASUVORK5CYII=', 'base64');
const binding: Binding = { browser: 'native-browser', tab: 'image-tab', conversation: 'https://chatgpt.com/c/image-recovery' };
const recoveryUnsupported = !constants.O_NOFOLLOW && 'Recovering an existing file requires O_NOFOLLOW on this platform';

class InterruptedImportStore extends Store {
  failJob?: string;
  writtenPath?: string;

  override transact<T>(fn: (db: Database) => T): Promise<T> {
    return super.transact(db => {
      const result = fn(db);
      const artifact = this.failJob ? db.jobs[this.failJob]?.artifacts[0] : undefined;
      if (artifact) {
        assert.ok(existsSync(artifact.path), 'the image must be written before the injected state-commit failure');
        this.writtenPath = artifact.path;
        this.failJob = undefined;
        throw new Error('injected image state-commit failure');
      }
      return result;
    });
  }
}

async function imageTask(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'ccb-artifact-recovery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const downloads = join(root, 'downloads');
  mkdirSync(downloads);
  const source = join(downloads, 'original.png');
  writeFileSync(source, png);
  const store = new InterruptedImportStore(join(root, 'state'));
  const jobs = new Jobs(store);
  const job = await jobs.prepare({ kind: 'image', prompt: 'Generate a cube' });
  await jobs.bind(job.id, binding, []);
  const reserved = await jobs.reserve(job.id, { binding, model: 'Web image', mode: 'image', attachmentsReady: true });
  await jobs.submission(job.id, { binding, nonce: reserved.nonce, turn: 'image-turn', visiblePrompt: job.prompt, model: 'Web image', mode: 'image' });
  const input = { path: source, binding, turn: 'image-turn', original: true, approvedDownloadRoot: downloads };
  return { store, jobs, job, input, root };
}

async function interruptedImport(t: TestContext) {
  const { store, jobs, job, input, root } = await imageTask(t);
  store.failJob = job.id;
  await assert.rejects(jobs.artifact(job.id, input), /injected image state-commit failure/);
  assert.ok(store.writtenPath);
  const path = store.writtenPath;
  assert.deepEqual(readFileSync(path), png);
  const persisted = JSON.parse(readFileSync(store.path('state.json'), 'utf8')) as Database;
  assert.equal(persisted.jobs[job.id]!.artifacts.length, 0, 'the failed commit must not register the image');
  return { jobs: new Jobs(new Store(store.home)), job, input, path, root };
}

test('image import resumes after the image was written but its state commit failed', { skip: recoveryUnsupported }, async t => {
  const s = await interruptedImport(t);
  const artifact = await s.jobs.artifact(s.job.id, s.input);
  assert.equal(artifact.path, s.path, 'retry must recover the already-written image');
  assert.equal(artifact.sourceTurn, s.input.turn);
  assert.deepEqual(readFileSync(artifact.path), png);
  const saved = await s.jobs.status(s.job.id);
  assert.equal(saved.artifacts.length, 1);
  assert.equal(saved.artifacts[0]!.id, artifact.id);
  assert.equal((await s.jobs.artifact(s.job.id, s.input)).id, artifact.id, 'a later retry must not create another artifact');
});

test('image import rejects a conflicting file without overwriting it or registering an artifact', { skip: recoveryUnsupported }, async t => {
  const s = await interruptedImport(t);
  const conflicting = Buffer.from('unrelated existing file');
  writeFileSync(s.path, conflicting);
  await assert.rejects(s.jobs.artifact(s.job.id, s.input), (error: any) => error.code === 'ARTIFACT_CONFLICT');
  assert.deepEqual(readFileSync(s.path), conflicting);
  assert.equal((await s.jobs.status(s.job.id)).artifacts.length, 0);
});

test('image import rejects a symlink at the interrupted destination without touching its target', { skip: recoveryUnsupported }, async t => {
  const s = await interruptedImport(t);
  const target = join(s.root, 'unrelated.png');
  writeFileSync(target, png);
  unlinkSync(s.path);
  symlinkSync(target, s.path);
  await assert.rejects(s.jobs.artifact(s.job.id, s.input), (error: any) => error.code === 'ARTIFACT_CONFLICT');
  assert.ok(lstatSync(s.path).isSymbolicLink());
  assert.equal(readlinkSync(s.path), target);
  assert.deepEqual(readFileSync(target), png);
  assert.equal((await s.jobs.status(s.job.id)).artifacts.length, 0);
});

test('a partial image write is not published and retries preserve an unknown destination', { skip: recoveryUnsupported }, async t => {
  const s = await imageTask(t);
  const originalWrite = fs.writeFileSync;
  let injected = false;
  const writeMock = t.mock.method(fs, 'writeFileSync', (
    file: Parameters<typeof writeFileSync>[0],
    data: Parameters<typeof writeFileSync>[1],
    options?: Parameters<typeof writeFileSync>[2]
  ) => {
    if (!injected && typeof file === 'number' && Buffer.isBuffer(data) && data.equals(png)) {
      injected = true;
      originalWrite(file, data.subarray(0, 12), options);
      throw Object.assign(new Error('injected partial image write'), { code: 'ENOSPC' });
    }
    return originalWrite(file, data, options);
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(s.jobs.artifact(s.job.id, s.input), (error: any) => error.code === 'ENOSPC');
  } finally {
    writeMock.mock.restore();
    syncBuiltinESMExports();
  }
  assert.ok(injected, 'the fault must occur after writing part of the image');
  const persisted = JSON.parse(readFileSync(s.store.path('state.json'), 'utf8')) as Database & {
    pendingImageImports?: Record<string, { path: string }[]>;
  };
  const destination = persisted.pendingImageImports?.[s.job.id]?.[0]?.path;
  assert.ok(destination, 'the failed write must retain its recoverable import intent');
  assert.equal(existsSync(destination), false, 'partial bytes must never be published at the final destination');
  assert.equal(persisted.jobs[s.job.id]!.artifacts.length, 0);

  const unknown = Buffer.from('unknown file created before retry');
  writeFileSync(destination, unknown);
  const restarted = new Jobs(new Store(s.store.home));
  await assert.rejects(restarted.artifact(s.job.id, s.input), (error: any) => error.code === 'ARTIFACT_CONFLICT');
  assert.deepEqual(readFileSync(destination), unknown, 'retry must not overwrite an unknown destination');
  assert.equal((await restarted.status(s.job.id)).artifacts.length, 0);
  unlinkSync(destination);

  const artifact = await new Jobs(new Store(s.store.home)).artifact(s.job.id, s.input);
  assert.equal(artifact.path, destination);
  assert.deepEqual(readFileSync(destination), png);
  assert.equal((await restarted.status(s.job.id)).artifacts.length, 1);
});
