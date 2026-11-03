import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { api } from './api.js';
import { errorResult } from './errors.js';
const readonly=process.argv.includes('--readonly');
const server=new McpServer({name:readonly?'codex-chatgpt-snapshot-readonly':'codex-chatgpt-bridge',version:'0.1.1'});
for(const [name,entry] of Object.entries(api())) {
  if(readonly && name!=='read_snapshot')continue;
  server.registerTool(name,{description:entry.description,inputSchema:entry.schema.shape,annotations:{readOnlyHint:['inspect_page','capabilities','status','list','result','read_snapshot','desktop_resume','desktop_result','voice'].includes(name),destructiveHint:false,openWorldHint:false}},async(input:any)=>{
    try { const data=await entry.run(entry.schema.parse(input) as never);return {content:[{type:'text' as const,text:JSON.stringify(data)}]}; }
    catch(e){return {isError:true,content:[{type:'text' as const,text:JSON.stringify(errorResult(e))}]};}
  });
}
await server.connect(new StdioServerTransport());
