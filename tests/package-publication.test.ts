import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';

const repository = resolve('.');
const pkg = JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8'));
const marketplaceName = `${pkg.name}-marketplace`;
const sourceName = `${pkg.name}-source`;
const archives = [`${pkg.name}-plugin-${pkg.version}.tar.gz`, `${pkg.name}-source-${pkg.version}.tar.gz`];
const outputNames = [marketplaceName, sourceName, ...archives];

function fixture(t: TestContext, directoryName = 'workspace') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ccb-package-publication-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const workspace = join(root, directoryName);
  mkdirSync(workspace);
  for (const entry of ['.codex-plugin', '.mcp.json', 'skills', 'docs', 'runtime', 'README.md', 'HANDOFF.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'package.json', 'package-lock.json', 'tsconfig.json', '.gitignore']) {
    cpSync(join(repository, entry), join(workspace, entry), { recursive: true });
  }
  for (const entry of ['src', 'tests', 'scripts', 'dist']) mkdirSync(join(workspace, entry));
  for (const entry of ['package.mjs', 'validate-package.mjs']) cpSync(join(repository, 'scripts', entry), join(workspace, 'scripts', entry));
  for (const entry of ['mcp.mjs', 'cli.mjs', 'native-browser.mjs', 'native-downloads.mjs']) writeFileSync(join(workspace, 'dist', entry), '// isolated packaging fixture\n');
  writeFileSync(join(workspace, 'src', 'fixture.ts'), 'export const fixture = true;\n');
  return { root, workspace, out: join(root, 'release') };
}

function runPackage(workspace: string, out: string, hook?: string, failTarget?: string) {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  if (failTarget) env.CCB_PACKAGE_FAIL_TARGET = failTarget;
  else delete env.CCB_PACKAGE_FAIL_TARGET;
  return spawnSync(process.execPath, [...(hook ? ['--import', hook] : []), 'scripts/package.mjs', out], {
    cwd: workspace, env, encoding: 'utf8', timeout: 30_000
  });
}

function packageSuccessfully(workspace: string, out: string) {
  const result = runPackage(workspace, out);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function directoryContents(path: string): Record<string, Buffer> {
  const result: Record<string, Buffer> = {};
  function visit(current: string, relative: string) {
    for (const name of readdirSync(current).sort()) {
      const child = join(current, name), key = relative ? `${relative}/${name}` : name;
      if (statSync(child).isDirectory()) visit(child, key);
      else result[key] = readFileSync(child);
    }
  }
  visit(path, '');
  return result;
}

function publishedContents(out: string, names = outputNames) {
  return Object.fromEntries(names.map(name => {
    const path = join(out, name);
    return [name, statSync(path).isDirectory() ? directoryContents(path) : readFileSync(path)];
  }));
}

function archiveEntries(path: string) {
  const result = spawnSync('tar', ['-tzf', path], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split('\n');
}

test('packaging to the parent of an identically named source worktree preserves that worktree', t => {
  const f = fixture(t, sourceName);
  mkdirSync(join(f.workspace, '.git'));
  writeFileSync(join(f.workspace, '.git', 'config'), 'private git metadata\n');
  writeFileSync(join(f.workspace, 'private-sentinel.txt'), 'must survive packaging\n');
  const before = directoryContents(f.workspace);

  const result = runPackage(f.workspace, f.root);

  assert.notEqual(result.status, 0, 'an output target must not replace the current source workspace');
  assert.match(result.stderr, /overlap.*source|source.*overlap/i);
  assert.deepEqual(directoryContents(f.workspace), before, 'packaging must not delete or replace source and unlisted private files');
});

test('publication failures restore both directories and both archives without mixing releases', t => {
  const f = fixture(t);
  const document = join(f.workspace, 'docs', 'publication-version.txt');
  writeFileSync(document, 'old release\n');
  packageSuccessfully(f.workspace, f.out);
  writeFileSync(join(f.out, 'unrelated.txt'), 'leave this output alone\n');
  const before = publishedContents(f.out);
  writeFileSync(document, 'new release\n');
  const hook = join(f.root, 'fail-publication.mjs');
  writeFileSync(hook, `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const original = fs.renameSync;
let injected = false;
fs.renameSync = function(source, destination) {
  if (!injected && String(destination) === process.env.CCB_PACKAGE_FAIL_TARGET) {
    injected = true;
    throw new Error('injected publication failure');
  }
  return original(source, destination);
};
syncBuiltinESMExports();
`);

  for (const target of [sourceName, archives[1]!]) {
    const result = runPackage(f.workspace, f.out, hook, join(f.out, target));
    assert.notEqual(result.status, 0, `the ${target} failure must reach the caller`);
    assert.match(result.stderr, /injected publication failure/);
    assert.deepEqual(publishedContents(f.out), before, `${target} failure must restore every old directory and archive`);
    assert.equal(readFileSync(join(f.out, 'unrelated.txt'), 'utf8'), 'leave this output alone\n');
  }
});

test('a second package excludes deleted source documents from directories and archives', t => {
  const f = fixture(t);
  const obsolete = 'obsolete-publication-fixture.txt';
  writeFileSync(join(f.workspace, 'docs', obsolete), 'only in the first release\n');
  packageSuccessfully(f.workspace, f.out);
  for (const archive of archives) assert.ok(archiveEntries(join(f.out, archive)).some(path => path.endsWith(`/docs/${obsolete}`)));
  writeFileSync(join(f.out, 'unrelated.txt'), 'preserve unrelated output\n');
  unlinkSync(join(f.workspace, 'docs', obsolete));

  packageSuccessfully(f.workspace, f.out);

  for (const archive of archives) assert.equal(archiveEntries(join(f.out, archive)).some(path => path.endsWith(`/docs/${obsolete}`)), false);
  for (const name of [marketplaceName, sourceName]) assert.equal(Object.keys(directoryContents(join(f.out, name))).some(path => path.endsWith(`docs/${obsolete}`)), false);
  assert.equal(readFileSync(join(f.out, 'unrelated.txt'), 'utf8'), 'preserve unrelated output\n');
});

test('failure after publishing a previously absent directory withdraws it and restores the other outputs', t => {
  const f = fixture(t);
  writeFileSync(join(f.workspace, 'docs', 'publication-version.txt'), 'old release\n');
  packageSuccessfully(f.workspace, f.out);
  const absentTarget = join(f.out, sourceName);
  rmSync(absentTarget, { recursive: true });
  const remaining = outputNames.filter(name => name !== sourceName);
  const before = publishedContents(f.out, remaining);
  writeFileSync(join(f.workspace, 'docs', 'publication-version.txt'), 'new release\n');
  const hook = join(f.root, 'fail-after-publishing.mjs');
  writeFileSync(hook, `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const originalRename = fs.renameSync;
const originalStat = fs.lstatSync;
let published = false, injected = false;
fs.renameSync = function(source, destination) {
  const result = originalRename(source, destination);
  if (String(destination) === ${JSON.stringify(absentTarget)}) published = true;
  return result;
};
fs.lstatSync = function(path, ...args) {
  // Fail the next publication's pre-rename check. The preceding directory
  // has already moved successfully and must be tracked for rollback.
  if (published && !injected && String(path).endsWith(${JSON.stringify(`/new/${archives[0]}`)})) {
    injected = true;
    throw new Error('injected stat failure after directory publication');
  }
  return originalStat(path, ...args);
};
syncBuiltinESMExports();
`);

  const result = runPackage(f.workspace, f.out, hook);

  assert.notEqual(result.status, 0, 'a filesystem failure after publication must reach the caller');
  assert.match(result.stderr, /injected stat failure after directory publication/);
  assert.equal(existsSync(absentTarget), false, 'the new directory must be withdrawn even though it had no old backup');
  assert.deepEqual(publishedContents(f.out, remaining), before, 'all previously existing outputs must be restored');
});

test('concurrent packages cannot interleave the directories and archives of different source trees', { timeout: 20_000 }, async t => {
  const children: { child: ReturnType<typeof spawn>; done: Promise<{ code: number | null; output: string }>; exited: () => boolean }[] = [];
  t.after(async () => {
    for (const item of children) if (!item.exited()) item.child.kill('SIGKILL');
    await Promise.all(children.map(item => item.done));
  });
  const a = fixture(t, 'source-a'), b = fixture(t, 'source-b');
  const documentName = 'publication-version.txt';
  writeFileSync(join(a.workspace, 'docs', documentName), 'release A\n');
  writeFileSync(join(b.workspace, 'docs', documentName), 'release B\n');
  const paused = join(a.root, 'a-published-first-output'), release = join(a.root, 'release-a');
  const hook = join(a.root, 'pause-publication.mjs');
  writeFileSync(hook, `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const original = fs.renameSync;
const delay = new Int32Array(new SharedArrayBuffer(4));
let paused = false;
fs.renameSync = function(source, destination) {
  const result = original(source, destination);
  if (!paused && String(destination) === ${JSON.stringify(join(a.out, marketplaceName))}) {
    paused = true;
    fs.writeFileSync(${JSON.stringify(paused)}, 'first output published');
    const deadline = Date.now() + 10_000;
    while (!fs.existsSync(${JSON.stringify(release)})) {
      if (Date.now() >= deadline) throw new Error('concurrent packaging barrier timed out');
      Atomics.wait(delay, 0, 0, 5);
    }
  }
  return result;
};
syncBuiltinESMExports();
`);
  const env = { ...process.env };
  delete env.NODE_OPTIONS; delete env.CCB_PACKAGE_FAIL_TARGET;
  const child = spawn(process.execPath, ['--import', hook, 'scripts/package.mjs', a.out], {
    cwd: a.workspace, env, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '', exited = false;
  child.stdout.on('data', text => { output += text; });
  child.stderr.on('data', text => { output += text; });
  const done = new Promise<{ code: number | null; output: string }>(resolve => {
    child.on('error', error => { output += String(error); });
    child.on('close', code => { exited = true; resolve({ code, output }); });
  });
  children.push({ child, done, exited: () => exited });
  const deadline = Date.now() + 7_000;
  while (!existsSync(paused)) {
    assert.equal(exited, false, output);
    assert.ok(Date.now() < deadline, 'the first process must reach the publication barrier');
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  const competing = runPackage(b.workspace, a.out);
  writeFileSync(release, 'release first publisher');
  const first = await done;

  assert.notEqual(competing.status, 0, 'the second publisher must report that the shared output is busy');
  assert.match(competing.stderr, /Publication lock exists/);
  assert.equal(first.code, 0, first.output);
  const versions = [
    readFileSync(join(a.out, marketplaceName, 'plugins', pkg.name, 'docs', documentName), 'utf8'),
    readFileSync(join(a.out, sourceName, 'docs', documentName), 'utf8'),
    ...archives.map((archive, index) => {
      const entry = index === 0 ? `${marketplaceName}/plugins/${pkg.name}/docs/${documentName}` : `${sourceName}/docs/${documentName}`;
      const result = spawnSync('tar', ['-xOf', join(a.out, archive), entry], { encoding: 'utf8', timeout: 10_000 });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    })
  ];
  assert.deepEqual(versions, Array(4).fill('release A\n'), 'both directories and both archives must come from the successful publisher');
});
