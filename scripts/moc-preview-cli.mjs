import {readFile,mkdir,rmdir,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {preview,retrievalUrl} from './moc-preview.mjs';
import {persistAttempt} from './moc-preview-store.mjs';

const maxBytes=20000000;
const fail=code=>Object.assign(new Error(code),{code});
function optionsFrom(args){
  const options={};
  for(let i=0;i<args.length;i++){
    const k=args[i];
    if(k==='--fetch'&&!options.fetch)options.fetch=true;
    else if(['--input','--out','--retrieved-at','--baseline'].includes(k)&&args[i+1]&&!args[i+1].startsWith('--')&&!options[k.slice(2)])options[k.slice(2)]=args[++i];
    else throw fail('INVALID_ARGUMENTS');
  }
  if(!options.out||Boolean(options.input)===Boolean(options.fetch))throw fail('INVALID_ARGUMENTS');
  return options;
}
async function readLimited(file){
  if((await stat(file)).size>maxBytes)throw fail('SOURCE_TOO_LARGE');
  const bytes=await readFile(file);if(bytes.length>maxBytes)throw fail('SOURCE_TOO_LARGE');return bytes;
}
function within(parent,file){
  const key=v=>process.platform==='win32'?v.toLowerCase():v;
  return key(file)===key(parent)||key(file).startsWith(key(parent+path.sep));
}
async function main(){
  const options=optionsFrom(process.argv.slice(2)),folder=path.resolve(options.out);
  await mkdir(folder,{recursive:true});
  const actualFolder=await realpath(folder);
  for(const input of [options.input,options.baseline].filter(Boolean)){
    const actualInput=await realpath(input).catch(()=>path.resolve(input));
    if(within(actualFolder,actualInput))throw fail('INPUT_OUTPUT_OVERLAP');
  }
  const lock=path.join(folder,'.writer-lock');
  try{await mkdir(lock);}catch(e){throw fail(e.code==='EEXIST'?'OUTPUT_BUSY':'OUTPUT_UNAVAILABLE');}
  try{
    let bytes=null,report=null,fetchInfo=null,error=null,codeVersion=null,dirty=null;
    try{codeVersion=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
    try{
      if(options.fetch){
        fetchInfo={requestedAt:new Date().toISOString(),status:null,url:retrievalUrl,contentType:null};
        const response=await fetch(retrievalUrl,{signal:AbortSignal.timeout(30000),redirect:'error',headers:{accept:'application/json'}});
        Object.assign(fetchInfo,{respondedAt:new Date().toISOString(),status:response.status,url:response.url||retrievalUrl,contentType:response.headers.get('content-type')});
        if(!response.ok)throw fail('SOURCE_HTTP_ERROR');
        if(!/^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i.test(fetchInfo.contentType??''))throw fail('SOURCE_CONTENT_TYPE');
        const chunks=[];let length=0;
        for await(const chunk of response.body){length+=chunk.length;if(length>maxBytes)throw fail('SOURCE_TOO_LARGE');chunks.push(chunk);}
        bytes=Buffer.concat(chunks);options['retrieved-at']=new Date().toISOString();
      }else bytes=await readLimited(options.input);
      let baseline=null;
      if(options.baseline){try{baseline=JSON.parse(await readLimited(options.baseline));}catch{throw fail('BASELINE_INVALID');}}
      try{report=preview(bytes,{retrievedAt:options['retrieved-at']??null,codeVersion,dirty,baseline});}
      catch{throw fail(options.baseline?'BASELINE_INVALID':'INPUT_METADATA_INVALID');}
      if(report.run.exitCode!==0)error={code:report.run.outcome==='invalid_response'?'SOURCE_INVALID_JSON':report.run.outcome==='source_empty'?'SOURCE_EMPTY':'SOURCE_NEEDS_REVIEW'};
    }catch(e){error={code:e.name==='TimeoutError'?'SOURCE_TIMEOUT':['SOURCE_HTTP_ERROR','SOURCE_CONTENT_TYPE','SOURCE_TOO_LARGE','BASELINE_INVALID','INPUT_METADATA_INVALID'].includes(e.code)?e.code:options.fetch?'SOURCE_FETCH_FAILED':'INPUT_READ_FAILED'};}
    const {attempt,warning}=await persistAttempt(folder,{bytes,report,fetchInfo,error});
    console.log(JSON.stringify({outcome:attempt.outcome,exitCode:attempt.exitCode,errorCode:attempt.errorCode,runPath:attempt.path,warning,...(report?.summary??{})}));
    if(attempt.exitCode!==0)console.error('本輪需處理；診斷已保存，未替換上次成功報告。');
    process.exitCode=attempt.exitCode;
  }finally{await rmdir(lock);}
}
try{await main();}
catch(e){console.error(JSON.stringify({outcome:'source_failed',exitCode:1,errorCode:['INVALID_ARGUMENTS','INPUT_OUTPUT_OVERLAP','OUTPUT_BUSY','OUTPUT_UNAVAILABLE'].includes(e.code)?e.code:'OUTPUT_WRITE_FAILED'}));process.exitCode=1;}
