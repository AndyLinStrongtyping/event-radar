import {createHash} from 'node:crypto';
import {isIP} from 'node:net';

export const retrievalUrl='https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?method=doFindTypeJ&category=6';
export const parserVersion='moc-preview-v2';
export const scopeVersion='seven-museums-v2';
export const semanticVersion='semantic-v2';
const museums={chimei:['奇美博物館'],nmns:['國立自然科學博物館'],nmmba:['國立海洋生物博物館'],nstm:['國立科學工藝博物館'],ntmofa:['國立臺灣美術館'], 'npm-north':['國立故宮博物院北部院區','國立故宮博物院北院'], 'npm-south':['國立故宮博物院南部院區','國立故宮博物院南院']};
export function canonical(value){return JSON.stringify(sortKeys(value));}
function sortKeys(v){return Array.isArray(v)?v.map(sortKeys):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sortKeys(v[k])])):v;}
export const hash=v=>createHash('sha256').update(v).digest('hex');
function text(v){return typeof v==='string'?v.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/gi,' ').normalize('NFC').split(/\r?\n/).map(s=>s.replace(/[^\S\n]+/g,' ').trim()).join('\n').trim()||null:null;}
export function day(v){
  const cleaned=text(v);if(!cleaned)return null;
  const m=cleaned.match(/^(\d{4})[/.\-](\d{2})[/.\-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if(!m)return null;
  if(m[4]!==undefined&&(Number(m[4])>23||Number(m[5])>59||Number(m[6]??0)>59))return null;
  const date=m.slice(1,4).join('-'),dt=new Date(date+'T00:00:00Z');
  return !Number.isNaN(+dt)&&dt.toISOString().slice(0,10)===date?date:null;
}
function scalar(v){return v===undefined||v===null||v===''?null:typeof v==='string'?text(v):v;}
function show(s){return {rawTime:scalar(s.time),rawEndTime:scalar(s.endTime),startDate:day(s.time),endDate:day(s.endTime),locationName:text(s.locationName),address:text(s.location),priceText:scalar(s.price),onSales:scalar(s.onSales),ticketUrl:scalar(s.webSales)};}
function semantic(r){
  const shows=Array.isArray(r.showInfo)?r.showInfo.filter(isObject).map(show):[];
  return {provider:'moc',externalRecordId:r.UID,title:text(r.title),category:scalar(r.category),performerText:scalar(r.showUnit),organizerNames:Array.isArray(r.masterUnit)?r.masterUnit.map(scalar):[],sourceUrl:scalar(r.sourceWebPromote),ticketUrl:scalar(r.webSales),descriptionExcerpt:text(r.descriptionFilterHtml)?.slice(0,500)??null,rawStartDate:scalar(r.startDate),rawEndDate:scalar(r.endDate),startDate:day(r.startDate),endDate:day(r.endDate),shows:[...new Map(shows.map(s=>[canonical(s),s])).values()].sort((a,b)=>canonical(a).localeCompare(canonical(b),'en'))};
}
function isObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
const nameKey=v=>(text(v)??'').replace(/台/g,'臺').replace(/\s+/g,' ').trim();
const hallSuffix=/^(?:特展廳[A-Z0-9甲乙丙]?|[一二三四五六七八九十0-9、]+特?展廳|第[一二三四五六七八九十0-9]+展覽館(?:\s*[0-9、,]+)?|[0-9B]+F(?:\s*特展廳[A-Z0-9甲乙丙]?)?)$/i;
function mapping(s){
  const original=nameKey(s.locationName),name=original.replace(/^臺南市(?=奇美博物館)/,''),address=nameKey(s.address);
  const ids=Object.entries(museums).filter(([,aliases])=>aliases.some(a=>{
    const key=nameKey(a);return name===key||(name.startsWith(key)&&hallSuffix.test(name.slice(key.length).trim()));
  })).map(([id])=>id);
  if(ids.length===1)return {museumId:ids[0],reason:'場地符合完整館名（台／臺等價）及限定展廳格式'};
  if(ids.length>1||!name||/未知|不明|故宮|科博|科工|海生|國美/.test(name)||Object.values(museums).flat().some(a=>name.includes(nameKey(a))))return {museumId:null,reason:'館名／展廳不足以唯一確認館別，保留待審'};
  if(Object.values(museums).flat().some(a=>address.includes(nameKey(a))))return {museumId:null,reason:'館名只出現在地址，需人工確認'};
  // Only a clearly named other institution is outside; a bare room is not.
  if(/(?:博物館|美術館|文化中心|圖書館|紀念館|文獻館|文化館|文化園區|文化發展中心)[）)]?$/.test(name))return {museumId:null,outside:true,reason:'來源明列另一館所，不在本次七館範圍'};
  return {museumId:null,reason:'未識別場地，不能當成確定範圍外'};
}
function activityType(sem){
  if(sem.category!==null&&!['string','number'].includes(typeof sem.category))return {eventType:'unknown',reason:'來源活動分類格式不符，需人工確認'};
  if(sem.category!==null&&String(sem.category)!=='6')return {eventType:'unknown',excluded:true,reason:'來源分類不是本次展覽類'};
  if(/常設展(?:覽)?(?:[】》\]：:（(]|$)/.test(sem.title)||/更新(?:該)?常設展區/.test(sem.descriptionExcerpt??''))return {eventType:'permanent',excluded:true,reason:'來源明列常設展或常設展區更新，不屬本次限期展'};
  if(/實境遊戲|解謎任務|遊戲盒/.test(sem.title+' '+(sem.descriptionExcerpt??'')))return {eventType:'activity',reason:'來源描述實境／解謎活動，需核對活動分類及完整期間'};
  if(/導覽|講座/.test(sem.title))return {eventType:'unknown',reason:'標題涉及導覽／講座，僅憑字詞無法排除或確認限期展'};
  return {eventType:'exhibition',reason:sem.category===null?'來源未提供活動類型，需人工確認':null};
}
function schedule(shows){
  const valid=shows.every(s=>s.startDate&&s.endDate&&s.startDate<=s.endDate);
  if(!valid){const raw=shows.map(s=>s.rawTime??'').join(' ');return {scheduleType:/即日起|持續|常設/.test(raw)?'ongoing':/\d{1,2}:\d{2}/.test(raw)&&!shows.some(s=>s.startDate)?'time_only':'unknown',startDate:null,endDate:null,reason:'缺少安全可解析的完整起訖日'};}
  const ranges=shows.map(s=>[s.startDate,s.endDate]).sort((a,b)=>a[0].localeCompare(b[0]));
  let end=ranges[0][1],gaps=false;
  for(const [start,nextEnd] of ranges.slice(1)){if(Date.parse(start)-Date.parse(end)>86400000)gaps=true;if(nextEnd>end)end=nextEnd;}
  return {scheduleType:gaps?'multiple_dates':'date_range',startDate:gaps?null:ranges[0][0],endDate:gaps?null:end,reason:gaps?'多個不連續日期，不能視為連續展期':null};
}
function evidence(url){try{if(typeof url!=='string')return null;const u=new URL(url),host=u.hostname.replace(/^\[|\]$/g,'');return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!isIP(host)&&host.includes('.')&&!/(?:^|\.)(?:localhost|local|internal)$/.test(host)?u.href:null;}catch{return null;}}
const officialHosts={chimei:['www.chimeimuseum.org','chimeimuseum.org'],nmns:['www.nmns.edu.tw'],nmmba:['www.nmmba.gov.tw'],nstm:['www.nstm.gov.tw'],ntmofa:['www.ntmofa.gov.tw'],'npm-north':['www.npm.gov.tw','theme.npm.edu.tw'],'npm-south':['south.npm.gov.tw','theme.npm.edu.tw']};
function timestamp(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&day(v.slice(0,19).replace('T',' '))!==null&&!Number.isNaN(Date.parse(v));}
function validateBaseline(baseline){
  if(baseline===null)return;
  const scope=baseline?.scope;
  const validScope=typeof scope==='string'?!!scope.trim():isObject(scope)&&!!text(scope.endpoint)&&!!text(scope.visibility)&&['all','active','ongoing','upcoming','ended'].includes(scope.status)&&scope.paginationComplete===true;
  if(!isObject(baseline)||!timestamp(baseline.retrievedAt)||!validScope||!Array.isArray(baseline.events))throw Error('既有展覽快照的時間、範圍或 events 無效');
  const seen=new Set();
  for(const e of baseline.events){
    if(!isObject(e)||!((typeof e.id==='string'&&e.id.trim())||Number.isSafeInteger(e.id))||seen.has(String(e.id))||!text(e.title)||!(e.museumId===null||typeof e.museumId==='string'&&e.museumId.trim()))throw Error('既有展覽快照含無效或重複展覽');
    for(const k of ['startDate','endDate'])if(e[k]!==null&&(typeof e[k]!=='string'||day(e[k])!==e[k]))throw Error('既有展覽快照日期無效');
    if(e.startDate&&e.endDate&&e.endDate<e.startDate)throw Error('既有展覽快照展期反向');
    if(e.visible!=null&&typeof e.visible!=='boolean'||e.venue!=null&&typeof e.venue!=='string'||e.sourceUrl!=null&&e.sourceUrl!==''&&!evidence(e.sourceUrl)||e.externalRecordId!=null&&(typeof e.externalRecordId!=='string'||!e.externalRecordId.trim())||e.provider!=null&&(typeof e.provider!=='string'||!e.provider.trim()))throw Error('既有展覽快照欄位無效');
    seen.add(String(e.id));
  }
}
export function preview(bytes,{retrievedAt=null,codeVersion=null,dirty=null,baseline=null}={}){
  if(retrievedAt!==null&&!timestamp(retrievedAt))throw Error('取得時間無效');
  validateBaseline(baseline);
  const base={run:{schemaVersion:1,sourceId:'moc-exhibitions',provider:'moc',dataset:'6012',retrievalUrl,licenseUrl:'https://data.gov.tw/license',retrievedAt,inputHash:hash(bytes),parserVersion,scopeVersion,semanticVersion,codeVersion,dirty,baseline:baseline?{retrievedAt:baseline.retrievedAt,scope:baseline.scope,eventCount:baseline.events.length,hash:hash(canonical(baseline))}:null},inputDispositions:[],sourceRecords:[],occurrenceCandidates:[],matches:[]};
  let rows;try{rows=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));if(!Array.isArray(rows))throw Error();}catch{return finish(base,'invalid_response',1);}
  if(!rows.length)return finish(base,'source_empty',2);
  base.rawShowInfoItems=rows.reduce((n,r)=>n+(Array.isArray(r?.showInfo)?r.showInfo.length:0),0);
  const groups=new Map();
  rows.forEach((raw,index)=>{
    if(!isObject(raw)||typeof raw.UID!=='string'||!raw.UID.trim())base.inputDispositions.push({inputIndex:index,disposition:'invalid',reason:'缺少來源 UID 或來源列不是物件'});
    else{const key=raw.UID;const group=groups.get(key)??[];group.push({raw,index});groups.set(key,group);}
  });
  for(const [uid,items] of groups){
    const versions=new Set(items.map(i=>hash(canonical(i.raw))));
    const conflict=versions.size>1;
    items.forEach((i,n)=>base.inputDispositions.push({inputIndex:i.index,externalRecordId:uid,disposition:conflict?'review':n?'duplicate':'observed',reason:conflict?'同 UID 同批內容不一致':n?'同 UID 相同內容重複觀察':'唯一來源觀察'}));
    const r=items[0].raw,sem=semantic(r);
    const rec={provider:'moc',externalRecordId:uid,inputIndices:items.map(i=>i.index),rawHash:hash(canonical(r)),semanticHash:hash(canonical(sem)),semanticVersion,raw:r,rawDate:{start:r.startDate??null,end:r.endDate??null},sourceUrl:evidence(r.sourceWebPromote),imageUrl:evidence(r.imageUrl),imageRights:'not_assessed',disposition:'review',reasons:[],variants:conflict?items.map(i=>({inputIndex:i.index,raw:i.raw,rawHash:hash(canonical(i.raw))})):[]};
    base.sourceRecords.push(rec);
    if(conflict){rec.reasons.push('同 UID 多版本衝突，整組待審');continue;}
    if(!sem.title||!Array.isArray(r.showInfo)||!r.showInfo.length||r.showInfo.some(s=>!isObject(s))){rec.disposition='invalid';rec.reasons.push('缺展名或有效 showInfo 子項');continue;}
    const grouped=new Map();
    r.showInfo.forEach((s,index)=>{const clean=show(s),m=mapping(clean),key=canonical([m.museumId,clean.locationName,clean.address]);const g=grouped.get(key)??{mapping:m,shows:[],indices:[]};g.shows.push(clean);g.indices.push(index);grouped.set(key,g);});
    for(const g of grouped.values()){
      const dates=schedule(g.shows),reasons=[];
      const kind=activityType(sem),excluded=g.mapping.outside||kind.excluded;
      if(g.mapping.outside)reasons.push(g.mapping.reason);
      if(kind.reason)reasons.push(kind.reason);
      if(!g.mapping.museumId&&!g.mapping.outside)reasons.push(g.mapping.reason);
      if(dates.reason)reasons.push(dates.reason);
      const sourceUrl=rec.sourceUrl;
      const museumWebsiteUrl=sourceUrl&&g.mapping.museumId&&officialHosts[g.mapping.museumId].includes(new URL(sourceUrl).hostname)?sourceUrl:null;
      const candidateVersion=hash(canonical([rec.semanticHash,parserVersion,scopeVersion,semanticVersion,[...new Set(g.shows.map(canonical))].sort()]));
      const c={candidateRef:`${uid}:${base.occurrenceCandidates.length}`,provider:'moc',externalRecordId:uid,candidateVersion,expectedCandidateVersion:candidateVersion,museumId:g.mapping.museumId,mappingEvidence:g.mapping.reason,title:sem.title,venue:g.shows[0].locationName,address:g.shows[0].address,eventType:kind.eventType,scheduleType:dates.scheduleType,startDate:dates.startDate,endDate:dates.endDate,rawDate:g.indices.map(i=>({time:r.showInfo[i].time??null,endTime:r.showInfo[i].endTime??null})),showInfoIndices:g.indices,sourceUrl,ticketUrl:evidence(r.webSales),officialDetailUrl:null,museumWebsiteUrl,detailVerification:'not_performed',evidenceUrl:retrievalUrl,evidenceLevel:museumWebsiteUrl?'government_record_with_museum_url':'government_record',priceText:g.shows.map(s=>s.priceText),isFree:null,status:excluded?'excluded':reasons.length?'review':'valid',reasons};
      base.occurrenceCandidates.push(c);
      base.matches.push(match(c,baseline));
    }
    const cs=base.occurrenceCandidates.filter(c=>c.externalRecordId===uid);
    rec.disposition=cs.every(c=>c.status==='excluded')?'excluded':cs.some(c=>c.status!=='excluded')?'candidates':'review';
  }
  const cs=base.occurrenceCandidates;
  const hasIssues=base.inputDispositions.some(d=>d.disposition==='invalid')||base.sourceRecords.some(r=>['review','invalid'].includes(r.disposition))||cs.some(c=>c.status==='review');
  return finish(base,cs.some(c=>c.status==='valid')?'parsed_candidates':hasIssues?'parsed_all_review':'parsed_no_in_scope',cs.some(c=>c.status==='valid')||!hasIssues?0:2);
}
function match(c,baseline){
  const result={candidateRef:c.candidateRef,decision:'not_evaluated',existing:[],supportingEvidence:[],opposingEvidence:[],conflictFields:[],unknownFields:[]};
  if(!baseline)return {...result,reason:'未提供既有展覽快照，未評估重複或新增'};
  const titleKey=v=>(text(v)??'').replace(/\s+/g,' ');
  const hits=baseline.events.filter(e=>e.provider==='moc'&&e.externalRecordId===c.externalRecordId||c.sourceUrl&&evidence(e.sourceUrl)===c.sourceUrl||titleKey(e.title)===titleKey(c.title));
  if(!hits.length)return {...result,decision:'distinct',reason:'只在指定基準未找到 UID、網址或同名對應，不代表整個資料庫全新'};
  for(const e of hits){
    result.existing.push({id:e.id,visible:e.visible??null});
    if(e.provider==='moc'&&e.externalRecordId===c.externalRecordId)result.supportingEvidence.push({existingId:e.id,field:'externalRecordId',candidate:c.externalRecordId,existing:e.externalRecordId});
    if(c.sourceUrl&&evidence(e.sourceUrl)===c.sourceUrl)result.supportingEvidence.push({existingId:e.id,field:'sourceUrl',candidate:c.sourceUrl,existing:e.sourceUrl});
    for(const field of ['title','museumId','venue','startDate','endDate']){
      const normalize=field==='venue'?venueKey:field==='title'?titleKey:v=>v;
      const a=normalize(c[field]),b=normalize(e[field]);
      if(a==null||b==null||a===''||b===''){result.unknownFields.push(field);continue;}
      const evidence={existingId:e.id,field,candidate:c[field],existing:e[field]};
      if(a===b)result.supportingEvidence.push(evidence);
      else{result.opposingEvidence.push(evidence);result.conflictFields.push(field);}
    }
  }
  result.conflictFields=[...new Set(result.conflictFields)];result.unknownFields=[...new Set(result.unknownFields)];
  result.decision=hits.length>1?'ambiguous':result.conflictFields.length?'conflict':result.unknownFields.length?'ambiguous':hits[0].provider==='moc'&&hits[0].externalRecordId===c.externalRecordId?'same_source_revision':'possible_same_occurrence';
  return {...result,reason:'僅離線比對建議；同來源不等於同站次，隱藏狀態與既有資料皆未變更'};
}
function venueKey(v){let value=nameKey(v);for(const a of Object.values(museums).flat().sort((a,b)=>b.length-a.length))value=value.replace(nameKey(a),'');return value.replace(/^臺南市/,'').replace(/\s+/g,'')||null;}
function count(items,key){return items.reduce((a,i)=>(a[i[key]]=(a[i[key]]??0)+1,a),{});}
function finish(r,outcome,exitCode){const {rawShowInfoItems=0,...report}=r;return {...report,run:{...r.run,outcome,exitCode},summary:{inputRows:r.inputDispositions.length,uniqueSources:r.sourceRecords.length,rawShowInfoItems,showInfoItems:r.sourceRecords.reduce((n,r)=>n+(Array.isArray(r.raw.showInfo)?r.raw.showInfo.length:0),0),showInfoItemsBasis:'unique_source_records',candidates:r.occurrenceCandidates.length,inputDispositions:count(r.inputDispositions,'disposition'),sourceDispositions:count(r.sourceRecords,'disposition'),candidateStatuses:count(r.occurrenceCandidates,'status')}};}
const mdText=v=>String(v??'未知').replace(/[\r\n]+/g,' ').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\\`*_\[\]()!|]/g,'\\$&');
export function markdown(r){
  const s=r.summary,b=r.run.baseline;
  return `# 文化部展覽離線預覽\n\n取得時間：${mdText(r.run.retrievedAt)}\n結果：${r.run.outcome}；結束碼：${r.run.exitCode}\n原始列 ${s.inputRows}；唯一來源 ${s.uniqueSources}；原始場次子項 ${s.rawShowInfoItems}；唯一來源內場次子項 ${s.showInfoItems}；候選 ${s.candidates}\n欄位有效 ${s.candidateStatuses.valid??0}；待審 ${s.candidateStatuses.review??0}；排除 ${s.candidateStatuses.excluded??0}\n\n有效候選不代表已發布；館方網址尚未逐頁查證，不能視為已確認的詳情頁。\n既有展覽基準：${b?`${b.eventCount} 筆，取得於 ${mdText(b.retrievedAt)}；範圍 ${mdText(typeof b.scope==='string'?b.scope:JSON.stringify(b.scope))}`:'未提供，不能計算有效新增或重複數'}。\n\n## 來源處置\n\n${r.sourceRecords.map(s=>`- ${mdText(s.externalRecordId)}：${s.disposition} ${mdText(s.reasons.join('；'))}`).join('\n')}\n\n## 候選與比對\n\n${r.occurrenceCandidates.map(c=>{
    const m=r.matches.find(m=>m.candidateRef===c.candidateRef);
    return `- ${mdText(c.externalRecordId)}｜${mdText(c.title)}｜${mdText(c.museumId??'館別未知')}｜${c.startDate??'未知'}～${c.endDate??'未知'}｜${c.status}：${mdText(c.reasons.join('；'))}\n  比對：${m?.decision??'not_evaluated'}；衝突欄位：${mdText(m?.conflictFields.join('、')||'無')}；未確認欄位：${mdText(m?.unknownFields.join('、')||'無')}。${mdText(m?.reason)}`;
  }).join('\n')}\n`;
}
