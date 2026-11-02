import { z } from 'zod';
import { Jobs } from './jobs.js';
import { Store } from './store.js';
import { pageEvidence } from './page-evidence.js';
import { runtimeStatus } from './runtime.js';
import { resolveModelSelection } from './model-selection.js';

export const binding = z.object({browser:z.string().min(1),tab:z.string().min(1),conversation:z.string().optional()});
const id=z.string().uuid();
const context=z.object({root:z.string(),scope:z.enum(['changes','repository','files']).optional(),files:z.array(z.string()).optional(),baseline:z.string().optional(),maxBytes:z.number().int().min(1).max(16*1024*1024).optional()});
const mode=z.enum(['chat','pro','research','image']);
const effort=z.string().min(1).optional();
const selectionOption=z.object({label:z.string().min(1),selected:z.boolean(),visible:z.boolean(),disabled:z.boolean().optional()});
const selection=z.object({models:z.array(selectionOption),efforts:z.array(selectionOption).optional()});
export function api(jobs=new Jobs(new Store())) {
  const definitions = {
    inspect_page: {description:"Classify a current-turn DOM excerpt. Optional selection contains observed active model/effort control options, not account badges or hidden menus. Never declares completion.",schema:z.object({snapshot:z.string().min(1),selection:selection.optional()}),run:(x:any)=>({...pageEvidence(x.snapshot),...(x.selection?{selection:resolveModelSelection(x.selection)}:{})})},
    capabilities: {description:'Report implemented interfaces and account verification boundaries. Never assumes a model or browser connection is available.',schema:z.object({}),run:async()=>({version:'0.1.1',capabilities:{review:'native-browser-workflow',collaborate:'native-browser-workflow',research:'native-browser-workflow',image:'native-browser-workflow',desktopChat:'existing-chat-via-codex-app-tools',agent:'optional-pinned-runtime',voice:'not_implemented'},browserControl:'Codex native Browser Use; this task server does not drive a browser',desktopChat:'Codex app-tools are provided by the desktop environment, not this server; user selects Pro in an existing chat',account:{models:'discover in bound page',pro:'selected Pro model or Pro effort; never infer from subscription',developerMode:'requires account UI verification',tunnel:'requires optional runtime doctor'},concurrency:2,runtime:runtimeStatus(jobs.store.home)})},
    prepare: {description:'Prepare prompt and filtered repository context. Review/collaboration default to ordinary chat; select the visible GPT-6 model in the bound page. This does not send anything to ChatGPT.',schema:z.object({kind:z.enum(['review','collaborate','research','image']),mode:mode.optional(),prompt:z.string().min(1),context:context.optional(),expectedImages:z.number().int().min(1).max(9).optional(),outputDir:z.string().optional(),parent:id.optional()}),run:(x:any)=>jobs.prepare(x)},
    bind: {description:'Bind a prepared job to an observed browser/tab and baseline user-message IDs. Enforces tab/conversation ownership.',schema:z.object({id,binding,baselineTurns:z.array(z.string())}),run:(x:any)=>jobs.bind(x.id,x.binding,x.baselineTurns)},
    reserve_submission: {description:'Persist observed model, mode and optional effort BEFORE clicking Send. Only once. If this succeeds but send outcome is unknown, resume and observe; do not send again.',schema:z.object({id,binding,model:z.string().min(1),mode,effort,attachmentsReady:z.boolean()}),run:(x:any)=>jobs.reserve(x.id,x)},
    confirm_submission: {description:'Record the actual new user-message ID, observed prompt, model and optional effort after exactly one browser submission.',schema:z.object({id,binding,nonce:z.string(),turn:z.string().min(1),visiblePrompt:z.string(),model:z.string(),mode:mode.optional(),effort}),run:(x:any)=>jobs.submission(x.id,x)},
    resume: {description:'Resume on the exact bound tab after a process interruption; returns pending nonce for observation, never authorization to resend.',schema:z.object({id,binding}),run:(x:any)=>jobs.resume(x.id,x.binding)},
    recover: {description:'Rebind to the same conversation in the same browser. If interrupted before saving its URL, require nonce plus the actual full submitted prompt/unique marker observed in the recovered conversation.',schema:z.object({id,binding,pendingEvidence:z.object({nonce:z.string(),visiblePrompt:z.string()}).optional()}),run:(x:any)=>jobs.recover(x.id,x.binding,x.pendingEvidence)},
    answer_question: {description:'Prepare a clarification answer in the existing bound task. Reserve and confirm the NEW message after this call.',schema:z.object({id,binding,answer:z.string().min(1)}),run:(x:any)=>jobs.answer(x.id,x.answer,x.binding)},
    observe: {description:'Record real UI evidence for current turn, including optional visible effort. Completion requires two unchanged observations at least 15 seconds apart, no active generation, and capability-specific evidence.',schema:z.object({id,binding,turn:z.string(),phase:z.enum(['thinking','clarification','planning','researching','generating','complete','partial','error']),text:z.string().optional(),model:z.string(),mode,effort,generating:z.boolean(),citations:z.array(z.string().url()).optional(),reportOwnerTurn:z.string().optional(),researchStarted:z.boolean().optional(),stopVisible:z.boolean().optional(),error:z.string().optional()}),run:(x:any)=>jobs.observe(x.id,x)},
    import_image: {description:'Validate/copy an original native-browser download into the task. Never supply screenshots or thumbnails.',schema:z.object({id,binding,turn:z.string(),path:z.string(),approvedDownloadRoot:z.string(),original:z.literal(true)}),run:(x:any)=>jobs.artifact(x.id,x)},
    status: {description:'Read persisted task state and whether a review snapshot is stale.',schema:z.object({id}),run:(x:any)=>jobs.status(x.id)},
    list: {description:'List local jobs for recovery.',schema:z.object({}),run:async()=>jobs.list()},
    result: {description:'Read completed result, original images and receipt paths. Incomplete tasks fail explicitly.',schema:z.object({id}),run:(x:any)=>jobs.result(x.id)},
    cancel: {description:'Request cancellation. For a submitted task, verify Stop in the bound browser before browserStopped=true. No implicit remote cancellation.',schema:z.object({id,browserStopped:z.boolean().default(false)}),run:(x:any)=>jobs.cancel(x.id,x.browserStopped)},
    record_findings: {description:'Store locally assessed CR findings tied to included source lines. Requires a current, completed snapshot.',schema:z.object({id,findings:z.array(z.object({title:z.string(),severity:z.enum(['P0','P1','P2','P3']),path:z.string(),line:z.number().int().min(1),evidence:z.string().min(1),suggestion:z.string().min(1),disposition:z.enum(['apply','consider','reject','needs_user']).optional(),validation:z.string().optional()}))}),run:(x:any)=>jobs.findings(x.id,x.findings)},
    grant_snapshot: {description:'Issue a 30-minute read-only snapshot capability for the optional isolated read-only MCP endpoint. Never grants live filesystem access.',schema:z.object({id}),run:(x:any)=>jobs.grant(x.id)},
    read_snapshot: {description:'Read/search only the frozen files authorized by a task capability; cannot write, run commands or traverse the live repository.',schema:z.object({id,token:z.string(),path:z.string().optional(),query:z.string().min(1).optional(),diff:z.boolean().optional(),startLine:z.number().int().min(1).optional(),maxLines:z.number().int().min(1).max(500).optional()}),run:(x:any)=>jobs.read(x.id,x.token,x)},
    voice: {description:'Reserved real-time web voice adapter. Does not open a microphone or fall back to TTS/API.',schema:z.object({}),run:async()=>({status:'not_implemented',capability:'web_realtime_voice',microphoneStarted:false})}
  };
  return definitions;
}
export type Method=keyof ReturnType<typeof api>;
export async function invoke(method:string,input:unknown,jobs?:Jobs) {
  const methods=api(jobs); if(!(method in methods))throw new Error(`Unknown command: ${method}`);
  const entry=methods[method as Method]; return entry.run(entry.schema.parse(input) as never);
}
