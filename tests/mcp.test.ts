import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
const desktopTools=['desktop_prepare','desktop_bind','desktop_reserve','desktop_confirm','desktop_observe','desktop_resume','desktop_result','desktop_cancel'].sort();
for(const readonly of [false,true])test(`bundled MCP process: ${readonly?'read-only':'local'} tool inventory`,async()=>{
 const client=new Client({name:'acceptance',version:'1.0'});const transport=new StdioClientTransport({command:process.execPath,args:[resolve('dist/mcp.mjs'),...(readonly?['--readonly']:[])],env:{PATH:process.env.PATH!,CWC_HOME:mkdtempSync(join(tmpdir(),'cwc-mcp-'))}});
 try{await client.connect(transport);const tools=await client.listTools();if(readonly)assert.deepEqual(tools.tools.map(x=>x.name),['read_snapshot']);else{assert.equal(tools.tools.length,27);assert.deepEqual(tools.tools.map(x=>x.name).filter(name=>name.startsWith('desktop_')).sort(),desktopTools);const result=await client.callTool({name:'voice',arguments:{}});assert.equal(result.isError,undefined);assert.match(JSON.stringify(result),/not_implemented/);const invalid=await client.callTool({name:'prepare',arguments:{kind:'review',prompt:'no repository'}});assert.equal(invalid.isError,true);}}
 finally{await client.close();}
});
