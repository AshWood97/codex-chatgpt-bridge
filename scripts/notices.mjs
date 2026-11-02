import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
const references=JSON.parse(readFileSync('runtime/reference-lock.json','utf8'));
const referenceRevisions=references.flatMap(row=>[row,...(row.reviewedRevisions??[]).map(revision=>({repo:row.repo,...revision}))]);
const lines=['# Third-party notices','','Codex ChatGPT Bridge is MIT licensed.','The optional upstream runtime is installed separately, preserving its own LICENSE and dependency notices. No upstream project source files were copied into this plugin. References below distinguish runtime dependencies, independent design adaptations, and research candidates; listing a project does not mean its code was adopted. Exact revisions, module choices, and modification notes are in docs/reference-projects.md.','','## Referenced projects','',`Latest reference update: ${referenceRevisions.map(r=>r.checkedAt).sort().at(-1)}. Individual verification dates follow. Code ports: none.`];
for(const [heading,types]of [
 ['Optional runtime dependencies',['runtime-dependency','indirect-runtime-dependency']],
 ['Design references',['design-reference']],
 ['Research only — not ported',['researched-only']],
]){
 lines.push('',`### ${heading}`,'');
 for(const row of referenceRevisions.filter(row=>types.includes(row.adoption))){
  const license=row.license?`[${row.license.spdx_id}](${row.license.source_url})`:'No license file found; code excluded';
  lines.push(`- [${row.repo} @ ${row.sha}](https://github.com/${row.repo}/tree/${row.sha}) — ${license}. Checked: ${row.checkedAt}. Status: ${row.adoptionStatus}.${row.attributionNote?' '+row.attributionNote:''}`);
 }
}
lines.push('','openai/tunnel-client is an indirect optional runtime dependency pinned by upstream to release v0.0.16 (Apache-2.0). No tunnel binary is bundled.','Private backend/session/cookie download routes and unlicensed project code are excluded. Live verification is limited to the dated observations recorded above and in docs/reference-projects.md and docs/acceptance.md.','','## JavaScript production dependency licenses','','The self-contained dist bundles include portions of these locked production dependencies. This inventory is conservative and also includes production packages whose code may be tree-shaken.');
const missing=[];
for(const [path,entry]of Object.entries(lock.packages).sort()){
 if(!path||entry.dev||!existsSync(join(path,'package.json')))continue;
 const pkg=JSON.parse(readFileSync(join(path,'package.json'),'utf8'));const files=readdirSync(path).filter(f=>/^(licen[sc]e|copying|notice)(\..*)?$/i.test(f));
 lines.push('',`### ${pkg.name} ${pkg.version}`,`License: ${typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license)}`,'');
 if(!files.length){missing.push(pkg.name);continue;}
 for(const file of files)lines.push(`Source: ${pkg.name}/${file}`,'',readFileSync(join(path,file),'utf8'));
}
if(missing.length)throw new Error('License texts missing: '+missing.join(', '));
writeFileSync('THIRD_PARTY_NOTICES.md',lines.join('\n')+'\n');
console.log('Third-party license inventory generated.');
