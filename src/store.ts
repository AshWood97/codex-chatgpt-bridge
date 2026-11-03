import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, unlinkSync, statSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { CwcError } from './errors.js';
import type { Database } from './types.js';

type LockOwner = { pid: number; nonce: string };

function readLock(path: string): { raw: string; owner: LockOwner } | undefined {
  let raw: string;
  try { raw = readFileSync(path, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  try {
    const owner = JSON.parse(raw) as LockOwner;
    if (Number.isInteger(owner.pid) && owner.pid > 0 && owner.pid <= 0x7fffffff && typeof owner.nonce === 'string' && owner.nonce) return { raw, owner };
  } catch { /* A newly created lock may not yet contain its owner. */ }
  try {
    if (Date.now() - statSync(path).mtimeMs > 30_000) throw new CwcError('LOCK_CORRUPT', `Inspect ${path}; its owner could not be verified.`);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return;
}

function processExited(pid: number): boolean {
  try { process.kill(pid, 0); return false; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true;
    if ((error as NodeJS.ErrnoException).code === 'EPERM') return false;
    throw error;
  }
}

/** Only one process may inspect and remove a dead main lock at a time.
 * A recovery lock is never stolen: if its owner dies, manual inspection is
 * required, since deleting it with another check/unlink would race again. */
function recoverDeadLock(lock: string, recovery: string, owner: LockOwner): void {
  const previous = readLock(lock);
  if (!previous || !processExited(previous.owner.pid)) return;
  try { writeFileSync(recovery, JSON.stringify(owner), { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const recoveryOwner = readLock(recovery);
    if (recoveryOwner && processExited(recoveryOwner.owner.pid)) {
      throw new CwcError('LOCK_RECOVERY_INTERRUPTED', `A previous lock recovery was interrupted. Stop all writers, inspect ${lock} and ${recovery}, then remove the recovery lock before retrying.`);
    }
    return;
  }
  try {
    // The dead owner cannot release its lock, and every automatic reclaimer
    // must hold the recovery lock, so this comparison and unlink are serialized.
    const current = readLock(lock);
    if (current && current.raw === previous.raw && processExited(current.owner.pid)) {
      try { unlinkSync(lock); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  } finally {
    unlinkSync(recovery);
  }
}

/** Resolve the data directory without moving or overwriting existing data. */
export function defaultStoreHome(env: NodeJS.ProcessEnv = process.env, userHome = homedir()): string {
  if (env.CCB_HOME !== undefined) return env.CCB_HOME;
  if (env.CWC_HOME !== undefined) return env.CWC_HOME;
  const newDefault = join(userHome, '.local/share/codex-chatgpt-bridge');
  const oldDefault = join(userHome, '.local/share/codex-web-capabilities');
  if (existsSync(oldDefault) && existsSync(newDefault)) {
    throw new CwcError('DATA_HOME_AMBIGUOUS', 'Both old and new data directories exist. Set CCB_HOME to the directory to use; neither was changed.');
  }
  return existsSync(oldDefault) ? oldDefault : newDefault;
}

export class Store {
  readonly home: string;
  constructor(home = defaultStoreHome()) {
    this.home = resolve(home); mkdirSync(this.home, { recursive: true, mode: 0o700 });
    chmodSync(this.home, 0o700);
  }
  path(...parts: string[]) { return join(this.home, ...parts); }
  async transact<T>(fn: (db: Database) => T): Promise<T> {
    const lock = this.path('state.lock');
    const owner: LockOwner = { pid: process.pid, nonce: randomUUID() };
    const deadline = Date.now() + 5000;
    while (true) {
      try { writeFileSync(lock, JSON.stringify(owner), { flag: 'wx', mode: 0o600 }); break; }
      catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        // Never steal a live owner's lock, even if it has been held for a while.
        recoverDeadLock(lock, this.path('state.lock.recovery'), owner);
        if (Date.now() >= deadline) throw new CwcError('STATE_BUSY', 'Another local writer owns the state lock. Retry later.');
        await new Promise(r => setTimeout(r, 25));
      }
    }
    try {
      const path = this.path('state.json');
      const db: Database = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { version: 1, jobs: {}, maxConcurrent: 2 };
      if (db.version !== 1) throw new CwcError('STATE_VERSION', 'Unsupported state version; state was not overwritten.');
      const result = fn(db);
      const temp = this.path(`state.${randomUUID()}.tmp`);
      writeFileSync(temp, JSON.stringify(db, null, 2), { mode: 0o600 }); renameSync(temp, path);
      return result;
    } finally {
      if (existsSync(lock) && readFileSync(lock, 'utf8') === JSON.stringify(owner)) unlinkSync(lock);
    }
  }
}
