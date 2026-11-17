import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {getDb} from '../../../db';
import {profiles,rooms,entries} from '../../../db/schema';
import {eq,and,or} from 'drizzle-orm';
import {guestSession,newGuestSession,displayName} from './guest';
export const dynamic='force-dynamic';
const json=(v:any,s=200,cookie?:string)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
async function crypt(value:string,decode=false){
 const raw=Uint8Array.from(atob((env as any).NAME_ENCRYPTION_KEY),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
 if(decode){const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},key,bytes.slice(12)));}
 const iv=crypto.getRandomValues(new Uint8Array(12));const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value)));return btoa(String.fromCharCode(...iv,...data));
}
export async function GET(req:Request){try{
 const u=await getChatGPTUser(), guest=guestSession(req), db=getDb();
 const p=u?await db.select().from(profiles).where(eq(profiles.id,u.userId)).get():null;
 const owned=u?await db.select().from(rooms).where(eq(rooms.owner,u.userId)):[];
 const code=(new URL(req.url).searchParams.get('code')||'').trim().toUpperCase();
 const room=code?await db.select().from(rooms).where(eq(rooms.id,code)).get():null;
 const teacher=!!u&&room?.owner===u.userId;
 const identities=[guest,u?.userId].filter((id):id is string=>!!id);
 let list:any[]=[];
 if(room&&(teacher||identities.length)){
   const filter=teacher?eq(entries.room,room.id):and(eq(entries.room,room.id),or(...identities.map(id=>eq(entries.user,id))));
   const all=await db.select().from(entries).where(filter);
   for(const e of all.sort((a,b)=>a.joined-b.joined))list.push({id:e.id,name:await crypt(e.name,true),status:e.status,joined:e.joined,mine:identities.includes(e.user)});
 }
 return json({signedIn:!!u,profile:p?await crypt(p.name,true):null,owned,room:room?{id:room.id,title:room.title,open:room.open,isTeacher:teacher}:null,list});
 }catch{return json({error:'Unable to load your room. Please try again.'},500)}}
export async function POST(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid request'},403);
 const body=await req.json();
 if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Invalid request'},400);
 const b=body as Record<string,unknown>,u=await getChatGPTUser(),db=getDb();
 if(b.action==='join'){
   const name=displayName(b.name);if(!name)return json({error:'Enter a display name between 1 and 30 characters.'},400);
   const code=String(b.code||'').trim().toUpperCase();
   const room=await db.select().from(rooms).where(eq(rooms.id,code)).get();
   if(!room)return json({error:'Room not found. Check your classroom code.'},404);
   if(!room.open)return json({error:'This waiting room is closed.'},400);
   const existing=guestSession(req),session=existing?{id:existing,cookie:undefined}:newGuestSession();
   // The browser token is never included in API JSON or queue entry IDs.
   const id=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(room.id+':'+session.id));
   const entryId=Array.from(new Uint8Array(id),v=>v.toString(16).padStart(2,'0')).join('');
   await db.insert(entries).values({id:entryId,room:room.id,user:session.id,name:await crypt(name),status:'waiting',joined:Date.now()}).onConflictDoNothing();
   return json({ok:true},200,session.cookie);
 }
 if(b.action==='leave'){
   const guest=guestSession(req),identities=[guest,u?.userId].filter((id):id is string=>!!id);
   if(!identities.length)return json({error:'Join a waiting room first.'},401);
   await db.delete(entries).where(and(eq(entries.room,String(b.code||'').trim().toUpperCase()),or(...identities.map(id=>eq(entries.user,id)))));
   return json({ok:true});
 }
 // Every teacher operation requires platform identity and room ownership.
 if(!u)return json({error:'Teachers must sign in to manage rooms.'},401);
 if(b.action==='signup'){const name=String(b.name||'').trim();if(!name||name.length>60)return json({error:'Use a name between 1 and 60 characters.'},400);const nameEnc=await crypt(name);await db.insert(profiles).values({id:u.userId,name:nameEnc}).onConflictDoUpdate({target:profiles.id,set:{name:nameEnc}});return json({ok:true});}
 const p=await db.select().from(profiles).where(eq(profiles.id,u.userId)).get();if(!p)return json({error:'Create your teacher profile first.'},400);
 if(b.action==='create'){const title=String(b.title||'My classroom').trim().slice(0,80);const id=crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();await db.insert(rooms).values({id,owner:u.userId,title});return json({code:id});}
 const room=await db.select().from(rooms).where(eq(rooms.id,String(b.code||'').trim().toUpperCase())).get();if(!room)return json({error:'Room not found. Check your classroom code.'},404);
 if(room.owner!==u.userId)return json({error:'Only this room’s teacher can do that.'},403);
 if(b.action==='toggle')await db.update(rooms).set({open:room.open?0:1}).where(eq(rooms.id,room.id));
 else if(b.action==='admitAll')await db.update(entries).set({status:'admitted'}).where(and(eq(entries.room,room.id),eq(entries.status,'waiting')));
 else if(b.action==='admit')await db.update(entries).set({status:'admitted'}).where(and(eq(entries.room,room.id),eq(entries.id,String(b.id))));
 else if(b.action==='remove')await db.delete(entries).where(and(eq(entries.room,room.id),eq(entries.id,String(b.id))));
 else return json({error:'Unknown action'},400);return json({ok:true});
 }catch{return json({error:'That did not save. Please try again.'},500)}}
