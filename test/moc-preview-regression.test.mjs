import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {preview,day,hash,markdown,semanticVersion,parserVersion,scopeVersion} from '../scripts/moc-preview.mjs';

const row=(v={})=>({UID:'regression-001',title:'限期特展',category:'6',sourceWebPromote:'https://www.chimeimuseum.org/exhibition/1',showInfo:[{time:'2026/11/01',endTime:'2026/12/01',locationName:'奇美博物館'}],...v});
const run=(rows,options)=>preview(Buffer.from(JSON.stringify(rows)),options);
const one=(v={})=>run([row(v)]).occurrenceCandidates[0];
const baseline=(v={})=>({retrievedAt:'2026-11-02T00:00:00Z',scope:'合成資料：含隱藏展及全部日期',events:[{id:'b1',title:'限期特展',museumId:'chimei',venue:'特展廳A',startDate:'2026-11-01',endDate:'2026-12-01',visible:false,...v}]});

test('未知展廳及館旁商店不可誤排或誤認館別',()=>{
  for(const venue of ['第一特展廳','奇美博物館旁的紀念品店','奇美博物館／國立自然科學博物館']){
    const c=one({showInfo:[{...row().showInfo[0],locationName:venue}]});assert.equal(c.status,'review');assert.equal(c.museumId,null);
  }
  assert.equal(one({showInfo:[{...row().showInfo[0],locationName:'國立台灣美術館'}]}).museumId,'ntmofa');
});
test('只有明列其他機構可判範圍外；有七館地址衝突則待審',()=>{
  assert.equal(one({showInfo:[{...row().showInfo[0],locationName:'朱銘美術館'}]}).status,'excluded');
  assert.equal(one({showInfo:[{...row().showInfo[0],locationName:'某文化中心',location:'奇美博物館'}]}).status,'review');
});
test('日期去標籤後解析並保留原文，無效時間及多日文字不誤轉',()=>{
  assert.equal(day('<span>2026/11/01</span>'),'2026-11-01');
  for(const v of ['2026/11/01 24:00','2026/11/01 23:60:00','2026/11/01 23:59:60','2026/11/01<br>2026/11/02'])assert.equal(day(v),null);
  const c=one({showInfo:[{...row().showInfo[0],time:'<b>2026/11/01</b>'}]});assert.equal(c.rawDate[0].time,'<b>2026/11/01</b>');assert.equal(c.startDate,'2026-11-01');
});
test('分類來源含糊留待審，導覽字樣不硬排、實境遊戲不當特展',()=>{
  assert.equal(one({title:'導覽科技的百年特展'}).status,'review');
  const game=one({descriptionFilterHtml:'使用遊戲盒進行解謎任務。'});assert.equal(game.eventType,'activity');assert.equal(game.status,'review');
  assert.equal(one({category:{invalid:6}}).status,'review');
  assert.equal(one({title:'自然史常設展（維護公告）'}).status,'excluded');
});
test('館方網域與已確認詳情分開，內網及有帳密網址不得成為連結',()=>{
  const c=one({sourceWebPromote:'https://www.chimeimuseum.org/'});assert.equal(c.officialDetailUrl,null);assert.equal(c.museumWebsiteUrl,'https://www.chimeimuseum.org/');
  for(const u of ['http://127.0.0.1/a','http://10.0.0.1/a','http://[::1]/','https://user:secret@example.org/a','file:///tmp/a','http://service.internal/a'])assert.equal(one({sourceWebPromote:u}).sourceUrl,null);
});
test('館別、展廳及日期衝突均包含雙方值，既有隱藏旗標不變',()=>{
  const b=baseline({endDate:'2026-12-02'}),before=JSON.stringify(b);
  const r=run([row({showInfo:[{...row().showInfo[0],locationName:'奇美博物館 特展廳B'}]})],{baseline:b});
  assert.equal(r.matches[0].decision,'conflict');assert.deepEqual(r.matches[0].conflictFields,['venue','endDate']);assert.equal(r.matches[0].opposingEvidence[0].existing,'特展廳A');assert.equal(r.matches[0].existing[0].visible,false);assert.equal(JSON.stringify(b),before);
});
test('同 UID 保留來源修訂證據，但同來源跨站不能自動視為同展',()=>{
  const b=baseline({provider:'moc',externalRecordId:'regression-001'});
  const r=run([row({showInfo:[{...row().showInfo[0],locationName:'奇美博物館 特展廳A'}]})],{baseline:b});assert.equal(r.matches[0].decision,'same_source_revision');
  b.events.push({...b.events[0],id:'b2',museumId:'nstm'});assert.equal(run([row()],{baseline:b}).matches[0].decision,'ambiguous');
});
test('格式錯、空白範圍、重複 ID 及未完成分頁的基準一律拒絕',()=>{
  const invalid=[{...baseline(),retrievedAt:'not-a-date'},{...baseline(),scope:' '},{...baseline(),events:[null]},{...baseline(),scope:{endpoint:'/exhibitions',status:'all',visibility:'public',paginationComplete:false}},{...baseline(),events:[...baseline().events,...baseline().events]}];
  for(const b of invalid)assert.throws(()=>run([row()],{baseline:b}));
});
test('分母分開列，清理與映射規則升版綁入候選版本',()=>{
  const r=run([row(),row()]);assert.equal(r.summary.rawShowInfoItems,2);assert.equal(r.summary.showInfoItems,1);assert.equal(r.summary.showInfoItemsBasis,'unique_source_records');
  assert.equal(semanticVersion,'semantic-v2');assert.equal(parserVersion,'moc-preview-v2');assert.equal(scopeVersion,'seven-museums-v2');
});
test('閱讀摘要列出比對限制與衝突，來源文字不能注入圖片或 HTML',()=>{
  const r=run([row({UID:'[點我](https://example.org/)',title:'<img src=x>![圖](https://example.org/image)'})],{baseline:baseline()});
  const md=markdown(r);assert.ok(md.includes('原始場次子項'));assert.ok(md.includes('既有展覽基準'));assert.ok(!md.includes('![圖]('));assert.ok(!md.includes('<img'));assert.ok(!md.includes('[點我]('));
  const conflict=markdown(run([row({showInfo:[{...row().showInfo[0],locationName:'奇美博物館 特展廳B'}]})],{baseline:baseline()}));assert.ok(conflict.includes('衝突欄位：venue'));
});

const repo=fileURLToPath(new URL('../',import.meta.url)),cli=path.join(repo,'scripts/moc-preview-cli.mjs'),fixture=path.join(repo,'test/fixtures/moc-preview-sample.json'),preload=pathToFileURL(path.join(repo,'test/fixtures/moc-preview-fault.mjs')).href;
const env={};for(const k of ['PATH','Path','SystemRoot','WINDIR','COMSPEC','PATHEXT','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
const invoke=(out,args,mode)=>spawnSync(process.execPath,[...(mode?['--import',preload]:[]),cli,...args,'--out',out],{cwd:repo,encoding:'utf8',env:{...env,...(mode?{MOC_TEST_FAULT:mode}:{})},timeout:10000});
function seed(){const out=mkdtempSync(path.join(os.tmpdir(),'moc-regression-'));const r=invoke(out,['--input',fixture]);assert.equal(r.status,0,r.stderr);return out;}
const snapshot=out=>Object.fromEntries(['report.json','report.md','source.json','last-success.json'].map(f=>[f,hash(readFileSync(path.join(out,f)))]));
function verifyPointer(out){const p=JSON.parse(readFileSync(path.join(out,'last-success.json')));for(const [name,digest] of Object.entries(p.files))assert.equal(hash(readFileSync(path.join(out,p.path,name))),digest);return p;}

for(const mode of ['bad-json','empty','403','html','timeout','oversize'])test('CLI 故障保留完整成功快照：'+mode,()=>{
  const out=seed(),before=snapshot(out),r=invoke(out,['--fetch'],mode);assert.equal(r.status,mode==='empty'?2:1);assert.deepEqual(snapshot(out),before);
  const error=JSON.parse(readFileSync(path.join(out,'last-error.json')));assert.equal(error.exitCode,r.status);assert.ok(error.errorCode);verifyPointer(out);assert.ok(existsSync(path.join(out,error.path,'attempt.json')));
});
test('成功指標提交前寫入失敗，舊指標及便捷副本皆保留',()=>{
  const out=seed(),before=snapshot(out),r=invoke(out,['--fetch'],'commit-failure');assert.equal(r.status,1);assert.deepEqual(snapshot(out),before);verifyPointer(out);
  const attempt=JSON.parse(readFileSync(path.join(out,'last-attempt.json')));assert.equal(attempt.exitCode,1);assert.equal(attempt.errorCode,'SUCCESS_POINTER_WRITE_FAILED');
});
test('便捷副本失敗時有警示，權威成功指標仍指向完整且可驗證的同批資料',()=>{
  const out=seed(),r=invoke(out,['--fetch'],'alias-failure');assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).warning,'REPORT_ALIAS_WRITE_FAILED');
  const p=verifyPointer(out),raw=readFileSync(path.join(out,p.path,'source.json')),report=JSON.parse(readFileSync(path.join(out,p.path,'report.json')));assert.equal(report.run.inputHash,hash(raw));assert.equal(report.occurrenceCandidates[0].title,'修訂特展');
});
test('寫入鎖、輸入輸出重疊與無效基準不損壞成功報告',()=>{
  const out=seed(),before=snapshot(out);
  assert.equal(invoke(out,['--input',path.join(out,'source.json')]).status,1);assert.deepEqual(snapshot(out),before);
  const bad=path.join(os.tmpdir(),'moc-baseline-'+Date.now()+'.json');writeFileSync(bad,JSON.stringify({retrievedAt:'secret-sentinel',scope:' ',events:[]}));
  const r=invoke(out,['--input',fixture,'--baseline',bad]);assert.equal(r.status,1);assert.doesNotMatch(r.stdout+r.stderr,/secret-sentinel/);assert.deepEqual(snapshot(out),before);
  mkdirSync(path.join(out,'.writer-lock'));const busy=invoke(out,['--input',fixture]);assert.equal(busy.status,1);assert.match(busy.stderr,/OUTPUT_BUSY/);assert.deepEqual(snapshot(out),before);
});
