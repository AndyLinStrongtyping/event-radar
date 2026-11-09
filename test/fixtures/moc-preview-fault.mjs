import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
const mode=process.env.MOC_TEST_FAULT;
const realRename=fs.rename;
if(mode==='commit-failure'||mode==='alias-failure'){
  fs.rename=async(from,to)=>{
    const leaf=String(to).replaceAll('\\','/');
    if(mode==='commit-failure'&&leaf.endsWith('/last-success.json')||mode==='alias-failure'&&leaf.endsWith('/report.json')&&!leaf.includes('/runs/'))throw Object.assign(Error('simulated write error'),{code:'EIO'});
    return realRename(from,to);
  };
  syncBuiltinESMExports();
}
globalThis.fetch=async()=>{
  const headers={'content-type':'application/json'};
  if(mode==='bad-json')return new Response('{broken',{headers});
  if(mode==='empty')return new Response('[]',{headers});
  if(mode==='403')return new Response('denied',{status:403,headers});
  if(mode==='html')return new Response('<html>unavailable</html>',{headers:{'content-type':'text/html'}});
  if(mode==='timeout')throw new DOMException('controlled timeout','TimeoutError');
  if(mode==='oversize')return new Response(new Uint8Array(20000001),{headers});
  if(mode==='commit-failure'||mode==='alias-failure')return new Response(JSON.stringify([{UID:'store-regression-new',title:'修訂特展',category:'6',showInfo:[{locationName:'奇美博物館',time:'2026/11/01',endTime:'2027/01/01'}]}]),{headers});
  throw Error('No real network is allowed in this fixture');
};
