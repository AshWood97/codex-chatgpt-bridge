import {mkdirSync,mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync,renameSync,realpathSync,lstatSync,unlinkSync,rmdirSync} from 'node:fs';
import {resolve,join,dirname,basename,relative,isAbsolute,sep} from 'node:path';
import {execFileSync} from 'node:child_process';

const requestedOut=resolve(process.argv[2]??'release');
mkdirSync(requestedOut,{recursive:true});
// All aliases to the same physical output directory must share one lock.
const out=realpathSync(requestedOut);
const name='codex-chatgpt-bridge';
const version=JSON.parse(readFileSync('package.json','utf8')).version;
const marketplaceName=name+'-marketplace',sourceName=name+'-source';
const files=[name+'-plugin-'+version+'.tar.gz',name+'-source-'+version+'.tar.gz'];
const outputs=[
 {name:marketplaceName,kind:'marketplace',directory:true},
 {name:sourceName,kind:'source',directory:true},
 {name:files[0],kind:'marketplace',directory:false},
 {name:files[1],kind:'source',directory:false}
];
const distributable=['.codex-plugin','.mcp.json','dist','skills','docs','runtime','README.md','HANDOFF.md','LICENSE','THIRD_PARTY_NOTICES.md','package.json','package-lock.json'];
const sourceInputs=[...distributable,'src','tests','scripts','tsconfig.json','.gitignore'];
const markerName='.ccb-package-owner.json';
const marker=kind=>JSON.stringify({generator:name,format:1,kind})+'\n';

function lstatOrNull(path) {
 try { return lstatSync(path); } catch(error) { if(error.code==='ENOENT')return null;throw error; }
}

// Resolve every existing prefix, so symlinked output paths cannot hide overlap.
function physicalPath(path) {
 let current=resolve(path), suffix=[];
 while(true) {
  try { return resolve(realpathSync(current),...suffix); }
  catch(error) {
   if(error.code!=='ENOENT')throw error;
   if(lstatOrNull(current)?.isSymbolicLink())throw new Error(`Cannot resolve symlink: ${current}`);
   const parent=dirname(current);
   if(parent===current)throw error;
   suffix.unshift(basename(current));current=parent;
  }
 }
}
function inside(path,root) {
 const rel=relative(root,path);
 return rel==='' || (rel!=='..' && !rel.startsWith('..'+sep) && !isAbsolute(rel));
}
function overlap(a,b) { return inside(a,b)||inside(b,a); }
function assertSafeTargets() {
 const workspace=physicalPath(process.cwd()),outputRoot=physicalPath(out);
 const inputs=sourceInputs.map(path=>physicalPath(resolve(path)));
 for(const input of inputs) {
  if(inside(outputRoot,input))throw new Error(`Output directory overlaps source input: ${out}`);
 }
 const gitPath=join(workspace,'.git');
 if(lstatOrNull(gitPath)?.isDirectory() && inside(outputRoot,physicalPath(gitPath)))throw new Error(`Output directory overlaps Git metadata: ${out}`);
 for(const entry of outputs) {
  const target=join(out,entry.name),physical=physicalPath(target);
  if(inside(workspace,physical) || inputs.some(input=>overlap(physical,input)))throw new Error(`Refusing output that overlaps source workspace: ${target}`);
  if(lstatOrNull(target)?.isDirectory() && lstatOrNull(join(target,'.git')))throw new Error(`Refusing to replace a Git working tree: ${target}`);
 }
}
function managedPrevious(path,entry) {
 const stat=lstatOrNull(path);
 if(!stat || stat.isSymbolicLink())return false;
 try {
  if(entry.directory && stat.isDirectory())return readFileSync(join(path,markerName),'utf8')===marker(entry.kind);
  if(!entry.directory && stat.isFile()) {
   const root=entry.kind==='marketplace'?marketplaceName:sourceName;
   return execFileSync('tar',['-xOf',path,`${root}/${markerName}`],{encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:4096})===marker(entry.kind);
  }
 } catch { return false; }
 return false;
}

assertSafeTargets();
const stage=mkdtempSync(join(out,'.ccb-package-'));
const build=join(stage,'new'),previous=join(stage,'previous');
mkdirSync(build);mkdirSync(previous);
const lock=join(out,'.ccb-package-publish.lock'),owner=join(lock,'owner.json');
const recovery=`Inspect ${owner}, confirm that the recorded publisher is no longer running, and restore any needed files from its stage/previous directory before manually removing ${lock}. No automatic lock takeover is performed.`;
let retainStage=false,retainLock=false,lockAcquired=false,stageRemoved=false,failure;
try {
 const marketplace=join(build,marketplaceName),plugin=join(marketplace,'plugins',name);
 mkdirSync(plugin,{recursive:true});
 for(const p of distributable)cpSync(p,join(plugin,p),{recursive:true});
 mkdirSync(join(marketplace,'.agents/plugins'),{recursive:true});
 writeFileSync(join(marketplace,'.agents/plugins/marketplace.json'),JSON.stringify({name:'codex-chatgpt-bridge-local',interface:{displayName:'Codex ChatGPT Bridge 本地'},plugins:[{name,source:{source:'local',path:'./plugins/'+name},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Productivity'}]},null,2));
 writeFileSync(join(marketplace,markerName),marker('marketplace'));
 execFileSync(process.execPath,['scripts/validate-package.mjs',plugin],{stdio:'inherit'});
 const source=join(build,sourceName);mkdirSync(source,{recursive:true});
 for(const p of sourceInputs)cpSync(p,join(source,p),{recursive:true});
 writeFileSync(join(source,markerName),marker('source'));
 execFileSync('tar',['-czf',join(build,files[0]),'-C',build,marketplaceName]);
 execFileSync('tar',['-czf',join(build,files[1]),'-C',build,sourceName]);

 // Lock only the shared publication phase; never reclaim a stale lock automatically.
 try { mkdirSync(lock,{mode:0o700}); }
 catch(error) {
  if(error.code==='EEXIST')throw new Error(`Publication lock exists at ${lock}. ${recovery}`);
  throw error;
 }
 lockAcquired=true;
 try { writeFileSync(owner,JSON.stringify({pid:process.pid,stage},null,2)+'\n',{flag:'wx',mode:0o600}); }
 catch(error) {
  retainStage=true;retainLock=true;
  throw new Error(`Could not record publication lock owner: ${error.message}. Recovery files retained at ${stage}. ${recovery}`);
 }
 try {
 // The names are not proof of ownership: preserve unrecognized prior outputs.
 assertSafeTargets();
 const backups=[],published=[];
 try {
  for(const entry of outputs) {
   const target=join(out,entry.name);
   if(!lstatOrNull(target))continue;
   const owned=managedPrevious(target,entry),backup=join(previous,entry.name);
   renameSync(target,backup);backups.push({target,backup,owned});
  }
  for(const entry of outputs) {
   const target=join(out,entry.name),staged=join(build,entry.name),stat=lstatSync(staged);
   renameSync(staged,target);
   published.push({target,staged,dev:stat.dev,ino:stat.ino});
  }
 } catch(error) {
  const failures=[];
  for(const item of published.reverse()) {
   try {
    const stat=lstatOrNull(item.target);
    if(!stat || stat.dev!==item.dev || stat.ino!==item.ino)throw new Error('output changed during rollback');
    renameSync(item.target,item.staged);
   } catch(rollbackError) { failures.push(`${item.target}: ${rollbackError.message}`); }
  }
  for(const item of backups.reverse()) {
   try {
    if(lstatOrNull(item.target))throw new Error('destination occupied during rollback');
    renameSync(item.backup,item.target);
   } catch(rollbackError) { failures.push(`${item.backup}: ${rollbackError.message}`); }
  }
  if(failures.length) {
   retainStage=true;retainLock=true;
   throw new Error(`Packaging failed: ${error.message}. Rollback incomplete; recovery files retained at ${stage}. ${failures.join('; ')}. ${recovery}`);
  }
  throw error;
 }
 const unowned=backups.filter(item=>!item.owned);
 if(unowned.length)retainStage=true;
 if(!retainStage) { rmSync(stage,{recursive:true,force:true});stageRemoved=true; }
 console.log(JSON.stringify({marketplace:join(out,marketplaceName),plugin:join(out,marketplaceName,'plugins',name),source:join(out,sourceName),archives:files,...(unowned.length?{preservedPrevious:unowned.map(item=>item.backup)}:{})},null,2));
 } catch(error) {
  if(!retainStage&&!stageRemoved) {
   try { rmSync(stage,{recursive:true,force:true});stageRemoved=true; }
   catch(cleanupError) {
    retainStage=true;retainLock=true;
    throw new Error(`Packaging failed: ${error.message}. Could not clean stage ${stage}: ${cleanupError.message}. ${recovery}`);
   }
  }
  throw error;
 }
} catch(error) {
 failure=error;
} finally {
 if(lockAcquired&&!retainLock) {
  try { unlinkSync(owner);rmdirSync(lock); }
  catch(error) { failure=new Error(`${failure?failure.message+' ':''}Could not release publication lock ${lock}: ${error.message}. ${recovery}`); }
 }
 // Before lock acquisition, the stage is unique to this process and has no backups.
 if(!lockAcquired&&!retainStage&&!stageRemoved) {
  try { rmSync(stage,{recursive:true,force:true}); }
  catch(error) { failure=new Error(`${failure?failure.message+' ':''}Could not clean stage ${stage}: ${error.message}`); }
 }
}
if(failure)throw failure;
