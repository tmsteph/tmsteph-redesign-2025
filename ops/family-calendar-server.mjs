import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const equal = (a,b) => typeof a==='string' && a.length===b.length && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const categories = ['thomas-work','partner-work','thomas-event','partner-event','together'];
export function validateEvent(e) {
  if (!e || typeof e.id!=='string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(e.id) || typeof e.title!=='string' || !e.title.trim() || e.title.length>200 || !categories.includes(e.category)) throw Error('Invalid event');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(e.endDate) || e.endDate<e.startDate || !Number.isFinite(Date.parse(e.startDate)) || !Number.isFinite(Date.parse(e.endDate))) throw Error('Invalid dates');
  for (const t of [e.startTime,e.endTime]) if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw Error('Invalid times');
  if (e.startDate===e.endDate && e.startTime && e.endTime && e.endTime<=e.startTime) throw Error('End must be after start');
  return {id:e.id,title:e.title.trim(),category:e.category,startDate:e.startDate,endDate:e.endDate,startTime:e.startTime||'',endTime:e.endTime||'',notes:String(e.notes||'').slice(0,1000),tentative:!!e.tentative,source:String(e.source||'Together').slice(0,100)};
}
export function createPlannerServer(directory) {
  mkdirSync(directory,{recursive:true,mode:0o700});
  const allowed = new Set(['https://tmsteph.com','https://www.tmsteph.com']);
  const save = (file,data) => {const tmp=file+'.tmp';writeFileSync(tmp,JSON.stringify(data),{mode:0o600});renameSync(tmp,file);};
  return http.createServer(async(req,res)=>{
    const origin=req.headers.origin;
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
    if (origin && allowed.has(origin)) Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS'});
    const reply=(code,body)=>{res.writeHead(code,headers);res.end(JSON.stringify(body));};
    if (origin && !allowed.has(origin)) return reply(403,{error:'Origin not allowed'});
    if(req.method==='OPTIONS') return reply(204,{});
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/health' && req.method==='GET') return reply(200,{ok:true});
    const match=url.pathname.match(/^\/rooms\/([a-f0-9]{32})(\/share|\/revoke)?$/);
    if(!match) return reply(404,{error:'Not found'});
    const file=join(directory,match[1]+'.json');
    let data;
    try {data=JSON.parse(readFileSync(file,'utf8'));} catch {return reply(404,{error:'Calendar unavailable'});}
    const supplied=hash((req.headers.authorization||'').replace(/^Bearer /,''));
    const owner=equal(supplied,data.ownerHash),partner=equal(supplied,data.partnerHash||'');
    if(!owner&&!partner) return reply(401,{error:'This private link is invalid or has been revoked.'});
    const publicData=()=>({revision:data.revision,events:data.events,snapshotAt:data.snapshotAt,updatedAt:data.updatedAt,role:owner?'owner':'partner'});
    if(req.method==='GET'&&!match[2]) return reply(200,publicData());
    if(req.method==='POST'&&match[2]) {
      if(!owner) return reply(403,{error:'Only Thomas can manage sharing.'});
      if(match[2]==='/revoke') {data.partnerHash='';save(file,data);return reply(200,{ok:true});}
      const key=token();data.partnerHash=hash(key);save(file,data);return reply(200,{key});
    }
    if(req.method!=='PUT'||match[2]) return reply(405,{error:'Method not allowed'});
    try {
      let body='';for await(const chunk of req){body+=chunk;if(body.length>512000) {reply(413,{error:'Calendar too large'});return;}}
      const input=JSON.parse(body);
      // No awaits between revision comparison and rename: updates are serialized.
      data=JSON.parse(readFileSync(file,'utf8'));
      if(!equal(supplied,data.ownerHash)&&!equal(supplied,data.partnerHash||'')) return reply(401,{error:'Link revoked'});
      if(input.revision!==data.revision) return reply(409,{error:'The calendar changed. Refresh before saving.'});
      if(!Array.isArray(input.events)||input.events.length>1000) throw Error('Too many events');
      const events=input.events.map(validateEvent);
      if(new Set(events.map(e=>e.id)).size!==events.length) throw Error('Duplicate event');
      data.events=events;data.revision++;data.updatedAt=new Date().toISOString();save(file,data);reply(200,publicData());
    }catch(e){reply(400,{error:e.message||'Unable to save'});}
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const directory=process.env.PLANNER_DATA_DIR;
  if(!directory) throw Error('PLANNER_DATA_DIR is required');
  createPlannerServer(directory).listen(Number(process.env.PORT||4346),'127.0.0.1',()=>console.log('tmsteph planner listening on loopback'));
}
