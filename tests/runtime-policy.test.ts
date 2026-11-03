import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';import {join,delimiter} from 'node:path';import {tmpdir,homedir} from 'node:os';import {runtimeEnvironment,runtimeCommand} from '../src/runtime.js';
test('runtime child rejects inherited DEV and browser routing while keeping its pinned Bun and isolated homes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cwc-runtime-'));
 const poisoned=['CODEX_WEB_GPT_DEV_HOME','VITE_DEV_SERVER_URL','CODEX_CHATGPT_WEB_LAUNCHER','CODEX_CHATGPT_WEB_TRUSTED_CODEX_HOMES','CODEX_CHATGPT_WEB_BROWSER_HOST_DESCRIPTOR','CODEX_WEB_GPT_LAUNCHER_CONTROL_TOKEN','ELECTRON_RUN_AS_NODE'];
 const before=Object.fromEntries(poisoned.map(k=>[k,process.env[k]]));
 for(const k of poisoned)process.env[k]='foreign-profile';
 try {
  const bun=join(dir,'tools/bun');const env=runtimeEnvironment(dir,bun);
  assert.equal(env.CODEX_HOME,join(dir,'runtime/codex-home'));assert.equal(env.CODEX_CHATGPT_WEB_HOME,join(dir,'runtime/profile'));assert.equal(env.CODEX_WEB_GPT_LAUNCHER_DATA_DIR,join(dir,'runtime/launcher-data'));
  assert.equal(env.CODEX_WEB_GPT_BUN,bun);assert.equal(env.CODEX_CHATGPT_WEB_BUN,bun);assert.equal(env.PATH,join(dir,'tools')+delimiter+(process.env.PATH??''));
  for(const k of poisoned){assert.equal(env[k],undefined,k);assert.equal(process.env[k],'foreign-profile','host environment was mutated');}
  assert.notEqual(env.CODEX_HOME,process.env.CODEX_HOME??join(homedir(),'.codex'));
 }finally{for(const k of poisoned){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}}
});
test('runtime refuses concurrent mutation and preserves journal/lock',async()=>{const previous=process.env.CWC_HOME;const previousCcb=process.env.CCB_HOME;const dir=mkdtempSync(join(tmpdir(),'cwc-runtime-lock-'));delete process.env.CCB_HOME;process.env.CWC_HOME=dir;const lock=join(dir,'runtime-operation.lock');writeFileSync(lock,'owned-by-other-operation');try{await assert.rejects(runtimeCommand('configure',{}),/Another runtime operation/);assert.equal(readFileSync(lock,'utf8'),'owned-by-other-operation');}finally{if(previous===undefined)delete process.env.CWC_HOME;else process.env.CWC_HOME=previous;if(previousCcb===undefined)delete process.env.CCB_HOME;else process.env.CCB_HOME=previousCcb;}});
