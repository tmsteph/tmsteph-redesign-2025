import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createPlannerServer} from './family-calendar-server.mjs';
test('private calendar rejects unauthorized access, handles stale edits and revokes partner links',async()=>{
const dir=mkdtempSync(join(tmpdir(),'planner-')),room='a'.repeat(32),hash=x=>createHash('sha256').update(x).digest('hex');
writeFileSync(join(dir,room+'.json'),JSON.stringify({ownerHash:hash('owner'),partnerHash:'',revision:1,events:[],snapshotAt:new Date().toISOString()}));
const server=createPlannerServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port+'/rooms/'+room;
const call=(key,path='',method='GET',body)=>fetch(base+path,{method,headers:{Authorization:'Bearer '+key,Origin:'https://tmsteph.com','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
try{
assert.equal((await call('wrong')).status,401);
assert.equal((await fetch(base,{headers:{Authorization:'Bearer owner',Origin:'https://evil.example'}})).status,403);
const share=await(await call('owner','/share','POST')).json();
assert.equal((await call(share.key,'/share','POST')).status,403);
const event={id:'shift',title:'Partner shift',category:'partner-work',startDate:'2026-10-10',endDate:'2026-10-10',startTime:'09:00',endTime:'17:00'};
assert.equal((await call(share.key,'','PUT',{revision:1,events:[event]})).status,200);
assert.equal((await call('owner','','PUT',{revision:1,events:[]})).status,409);
assert.equal((await(await call('owner')).json()).events[0].title,'Partner shift');
assert.equal((await call('owner','','PUT',{revision:2,events:[{...event,endDate:'2026-10-09'}]})).status,400);
assert.equal((await call('owner','/revoke','POST')).status,200);
assert.equal((await call(share.key)).status,401);
assert.equal((await call('owner')).status,200);
}finally{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});
