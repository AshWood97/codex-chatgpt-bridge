import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,lstatSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(process.argv[2]??'.');const read=p=>JSON.parse(readFileSync(join(root,p),'utf8'));
const pkg=read('package.json');const manifest=read('.codex-plugin/plugin.json');assert.equal(pkg.name,manifest.name);assert.equal(pkg.version,manifest.version);assert.equal(manifest.requires_local_executor,true);
const mcp=read('.mcp.json').mcpServers['codex-chatgpt-bridge'];assert.equal(mcp.command,'node');assert.deepEqual(mcp.args,['${PLUGIN_ROOT}/dist/mcp.mjs']);
for(const p of ['dist/mcp.mjs','dist/cli.mjs','dist/native-browser.mjs','dist/native-downloads.mjs','README.md','LICENSE','THIRD_PARTY_NOTICES.md','docs/reference-projects.md','docs/browser-workflow.md','docs/desktop-chat.md','docs/runtime.md','runtime/integration-policy.json'])assert(existsSync(join(root,p)),p);
const skills=readdirSync(join(root,'skills'));assert.equal(skills.length,7);
for(const skill of skills){const text=readFileSync(join(root,'skills',skill,'SKILL.md'),'utf8');assert(text.startsWith('---\n'));assert(text.includes(`name: ${skill}\n`));assert(text.includes('description: '));assert(text.includes('../../docs/'));}
for(const path of ['skills','docs','dist','runtime'])assert(!lstatSync(join(root,path)).isSymbolicLink());
const runtime=read('runtime/reference-lock.json').find(x=>x.repo==='miuuyy/codex-chatgpt-web');
assert(runtime && /^[a-f0-9]{40}$/.test(runtime.sha));
assert.equal(read('runtime/integration-policy.json').commit,runtime.sha);
console.log('Plugin manifest, MCP entrypoint, seven skills, references and runtime pin validated.');
