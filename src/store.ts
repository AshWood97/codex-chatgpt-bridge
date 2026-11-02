import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, unlinkSync, statSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { CwcError } from './errors.js';
import type { Database } from './types.js';

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
    const owner = { pid: process.pid, nonce: randomUUID() };
    const deadline = Date.now() + 5000;
    while (true) {
      try { writeFileSync(lock, JSON.stringify(owner), { flag: 'wx', mode: 0o600 }); break; }
      catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        // A live process never loses its lock merely because it is slow.
        try {
          const previous = JSON.parse(readFileSync(lock, 'utf8')) as typeof owner;
          try { process.kill(previous.pid, 0); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH' && readFileSync(lock, 'utf8') === JSON.stringify(previous)) unlinkSync(lock);
          }
        } catch { if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs > 30_000) throw new CwcError('LOCK_CORRUPT', 'Inspect state.lock before removing it; owner could not be verified.'); }
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
