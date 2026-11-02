import { readFileSync } from 'node:fs';
import { invoke } from './api.js';
import { errorResult } from './errors.js';
import { runtimeCommand } from './runtime.js';
const [command='help',...args]=process.argv.slice(2);
try {
  if(command==='help') console.log('ccb <capabilities|inspect_page|prepare|bind|reserve_submission|confirm_submission|resume|recover|answer_question|observe|import_image|status|list|result|cancel|record_findings|grant_snapshot|read_snapshot|voice> [--input JSON_FILE | --stdin]\nccb runtime <status|prepare|launcher|configure|doctor|exec|rollback> [--input JSON_FILE]\ncwc is a compatibility alias for ccb. Input is a JSON object. Prompts are data, never shell commands. See docs/runtime.md.');
  else {
    const operation=command==='runtime'?args.shift():undefined;
    let input:unknown={};
    if(args[0]==='--input' && args[1] && args.length===2)input=JSON.parse(readFileSync(args[1],'utf8'));
    else if(args[0]==='--stdin' && args.length===1)input=JSON.parse(readFileSync(0,'utf8'));
    else if(args.length)throw new Error('Use --input JSON_FILE or --stdin; do not put prompt text in command flags.');
    const result=command==='runtime'?await runtimeCommand(operation??'status',input):await invoke(command,input);
    if(result!==undefined)console.log(JSON.stringify(result,null,2));
  }
} catch(e) { console.error(JSON.stringify(errorResult(e),null,2));process.exitCode=1; }
