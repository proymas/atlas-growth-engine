import {mkdir,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
export type XAction={id:string;postId:string;threadUrl:string;username:string;kind:'reply'|'followup';status:'queued'|'published'|'failed';text:string;decision:any;createdAt:string;publishedAt?:string;error?:string};
const file=path.resolve('.state/x-actions.json');
export async function loadXActions():Promise<XAction[]>{await mkdir(path.dirname(file),{recursive:true});try{return JSON.parse(await readFile(file,'utf8'))}catch{return[]}}
export async function saveXActions(a:XAction[]){await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(a,null,2),'utf8')}
export async function enqueueXAction(input:Omit<XAction,'id'|'status'|'createdAt'>){const a=await loadXActions();if(a.some(x=>x.postId===input.postId&&x.kind===input.kind&&(x.status==='queued'||x.status==='published')))return null;const x:XAction={...input,id:`${input.postId}:${input.kind}:${Date.now()}`,status:'queued',createdAt:new Date().toISOString()};a.push(x);await saveXActions(a);return x}
