import {mkdir,writeFile,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {hash,markdown} from './moc-preview.mjs';

async function atomic(file,content){
  const temp=file+'.'+randomUUID()+'.tmp';
  try{await writeFile(temp,content);await rename(temp,file);}
  finally{await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}

// The complete immutable run is authoritative; a single pointer publishes it.
// Top-level files are compatibility copies, not a multi-file transaction.
export async function persistAttempt(folder,{bytes=null,report=null,fetchInfo=null,error=null}){
  const id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID();
  const relative='runs/'+id,dir=path.join(folder,'runs',id);
  await mkdir(dir,{recursive:true});
  const files={};
  if(bytes!==null)files['source.json']=bytes;
  if(report){files['report.json']=JSON.stringify(report,null,2);files['report.md']=markdown(report);}
  if(fetchInfo)files['fetch.json']=JSON.stringify(fetchInfo,null,2);
  const attempt={schemaVersion:1,id,path:relative,completedAt:new Date().toISOString(),outcome:report?.run.outcome??'source_failed',exitCode:report?.run.exitCode??1,errorCode:error?.code??null,httpStatus:fetchInfo?.status??null,files:Object.fromEntries(Object.entries(files).map(([name,content])=>[name,hash(content)]))};
  for(const [name,content] of Object.entries(files))await writeFile(path.join(dir,name),content);
  await writeFile(path.join(dir,'attempt.json'),JSON.stringify(attempt,null,2));
  await atomic(path.join(folder,'last-attempt.json'),JSON.stringify(attempt,null,2));
  if(attempt.exitCode!==0){
    await atomic(path.join(folder,'last-error.json'),JSON.stringify(attempt,null,2));
    return {attempt,warning:null};
  }
  try{await atomic(path.join(folder,'last-success.json'),JSON.stringify(attempt,null,2));}
  catch{
    const failed={...attempt,outcome:'output_failed',exitCode:1,errorCode:'SUCCESS_POINTER_WRITE_FAILED'};
    await writeFile(path.join(dir,'publication-error.json'),JSON.stringify(failed,null,2));
    await atomic(path.join(folder,'last-attempt.json'),JSON.stringify(failed,null,2));
    await atomic(path.join(folder,'last-error.json'),JSON.stringify(failed,null,2));
    return {attempt:failed,warning:null};
  }
  let warning=null;
  try{
    for(const [name,content] of Object.entries(files))await atomic(path.join(folder,name),content);
    if(!files['fetch.json'])await unlink(path.join(folder,'fetch.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});
    await unlink(path.join(folder,'last-error.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});
  }catch{warning='REPORT_ALIAS_WRITE_FAILED';}
  return {attempt,warning};
}
