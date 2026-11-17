import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function compile(file,require){
 const exports={};const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',source)(require,exports);return exports;
}
const guest=compile('app/api/room/guest.ts',()=>{throw Error('Unexpected import')});
const tables=Object.fromEntries(['profiles','rooms','entries'].map(name=>[name,Object.assign({table:name},Object.fromEntries(['id','name','owner','title','open','room','user','status','joined'].map(c=>[c,c])))]));
const values={profiles:[{id:'teacher',name:'unused'}],rooms:[{id:'ABC123',owner:'teacher',title:'Test classroom',open:1}],entries:[]};
let user=null;
const match=(field,value)=>row=>row[field]===value;
const db={
 select(){return{from(table){let rows=values[table.table];const q={where(predicate){rows=rows.filter(predicate);return q},get:async()=>rows[0],then(resolve,reject){return Promise.resolve(rows).then(resolve,reject)}};return q}}},
 insert(table){return{values(row){return{async onConflictDoNothing(){if(!values[table.table].some(v=>v.id===row.id))values[table.table].push(row)},async onConflictDoUpdate(){}}}}},
 delete(table){return{async where(predicate){values[table.table]=values[table.table].filter(row=>!predicate(row))}}},
 update(table){return{set(fields){return{async where(predicate){for(const row of values[table.table])if(predicate(row))Object.assign(row,fields)}}}}}
};
const route=compile('app/api/room/route.ts',id=>{
 if(id==='cloudflare:workers')return{env:{NAME_ENCRYPTION_KEY:btoa('x'.repeat(32))}};
 if(id==='../../chatgpt-auth')return{getChatGPTUser:async()=>user};
 if(id==='../../../db')return{getDb:()=>db};
 if(id==='../../../db/schema')return tables;
 if(id==='drizzle-orm')return{eq:match,and:(...p)=>row=>p.every(f=>f(row)),or:(...p)=>row=>p.some(f=>f(row))};
 if(id==='./guest')return guest;
 throw Error('Unexpected import '+id);
});
const origin='https://education.example';
const req=(body,cookie='',requestOrigin=origin)=>new Request(origin+'/api/room',{method:'POST',headers:{'Content-Type':'application/json',origin:requestOrigin,...(cookie?{cookie}:{})},body:JSON.stringify(body)});
const get=(cookie='')=>route.GET(new Request(origin+'/api/room?code=ABC123',{headers:cookie?{cookie}:{}}));
test('anonymous students join, resume, stay private, get admitted and leave; teacher operations remain protected',async()=>{
 let res=await get();assert.equal(res.status,200);assert.deepEqual((await res.json()).list,[]);
 res=await route.POST(req({action:'join',code:'ABC123',name:'  Acorn  '}));assert.equal(res.status,200);
 const cookie=res.headers.get('set-cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);assert.equal(values.entries.length,1);
 const row=values.entries[0];assert.notEqual(row.name,'Acorn');assert.equal(row.id.includes(row.user),false);
 res=await get(cookie);let data=await res.json();assert.equal(data.signedIn,false);assert.equal(data.list[0].name,'Acorn');assert.equal(data.list[0].mine,true);assert.equal(JSON.stringify(data).includes(row.user),false);
 const other=await route.POST(req({action:'join',code:'ABC123',name:'Birch'}));const otherCookie=other.headers.get('set-cookie');
 data=await(await get(otherCookie)).json();assert.equal(data.list.length,1);assert.equal(data.list[0].name,'Birch');
 for(const action of ['create','admit','admitAll','remove','toggle','signup'])assert.equal((await route.POST(req({action,code:'ABC123',id:row.id},cookie))).status,401);
 assert.equal((await route.POST(req({action:'join',code:'ABC123',name:'Acorn'},cookie,'https://other.example'))).status,403);
 for(const name of ['',' '.repeat(2),'a'.repeat(31),'bad\nname'])assert.equal((await route.POST(req({action:'join',code:'ABC123',name}))).status,400);
 assert.equal((await route.POST(req({action:'join',code:'WRONG',name:'Cedar'}))).status,404);
 await route.POST(req({action:'join',code:'ABC123',name:'Acorn'},cookie));assert.equal(values.entries.length,2);
 // Supply an encrypted teacher profile using a valid encrypted name from the join.
 values.profiles[0].name=row.name;user={userId:'teacher'};
 data=await(await get()).json();assert.equal(data.room.isTeacher,true);assert.equal(data.list.length,2);
 assert.equal((await route.POST(req({action:'admit',code:'ABC123',id:row.id}))).status,200);
 user=null;data=await(await get(cookie)).json();assert.equal(data.list[0].status,'admitted');
 user={userId:'other-teacher'};values.profiles.push({id:'other-teacher',name:row.name});
 assert.equal((await route.POST(req({action:'admitAll',code:'ABC123'}))).status,403);
 user={userId:'teacher'};await route.POST(req({action:'toggle',code:'ABC123'}));
 user=null;assert.equal((await route.POST(req({action:'join',code:'ABC123',name:'Cedar'}))).status,400);
 await route.POST(req({action:'leave',code:'ABC123'},cookie));assert.equal(values.entries.length,1);assert.equal(values.entries[0].user,guest.guestSession(new Request(origin,{headers:{cookie:otherCookie}})));
 assert.equal(guest.guestSession(new Request(origin,{headers:{cookie:'__Host-nuttyinc_guest=teacher'}})),null);
});
