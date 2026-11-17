import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {getDb} from '../../../db';
import {profiles,rooms,entries} from '../../../db/schema';
import {eq,and} from 'drizzle-orm';
export const dynamic='force-dynamic';
const json=(v:any,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
async function crypt(value:string,decode=false){
 const raw=Uint8Array.from(atob((env as any).NAME_ENCRYPTION_KEY),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
 if(decode){const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},key,bytes.slice(12)));}
 const iv=crypto.getRandomValues(new Uint8Array(12));const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value)));return btoa(String.fromCharCode(...iv,...data));
}
export async function GET(req:Request){try{
 const u=await getChatGPTUser();if(!u)return json({signedIn:false});const db=getDb();const p=await db.select().from(profiles).where(eq(profiles.id,u.userId)).get();
 const owned=await db.select().from(rooms).where(eq(rooms.owner,u.userId));
 const code=new URL(req.url).searchParams.get('code');const room=code?await db.select().from(rooms).where(eq(rooms.id,code)).get():null;
 let list:any[]=[];if(room){const all=await db.select().from(entries).where(eq(entries.room,room.id));for(const e of all.sort((a,b)=>a.joined-b.joined)){if(room.owner===u.userId||e.user===u.userId)list.push({id:e.id,name:await crypt(e.name,true),status:e.status,joined:e.joined,mine:e.user===u.userId});}}
 return json({signedIn:true,profile:p?await crypt(p.name,true):null,owned,room:room?{...room,owner:undefined,isTeacher:room.owner===u.userId}:null,list});
 }catch{return json({error:'Unable to load your room. Please try again.'},500)}}
export async function POST(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid request'},403);
 const u=await getChatGPTUser();if(!u)return json({error:'Please sign in first.'},401);const b=await req.json() as Record<string, unknown>;const db=getDb();
 if(b.action==='signup'){const name=String(b.name||'').trim();if(!name||name.length>60)return json({error:'Use a name between 1 and 60 characters.'},400);const nameEnc=await crypt(name);await db.insert(profiles).values({id:u.userId,name:nameEnc}).onConflictDoUpdate({target:profiles.id,set:{name:nameEnc}});return json({ok:true});}
 const p=await db.select().from(profiles).where(eq(profiles.id,u.userId)).get();if(!p)return json({error:'Create your profile first.'},400);
 if(b.action==='create'){const title=String(b.title||'My classroom').trim().slice(0,80);const id=crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();await db.insert(rooms).values({id,owner:u.userId,title});return json({code:id});}
 const room=await db.select().from(rooms).where(eq(rooms.id,String(b.code||'').toUpperCase())).get();if(!room)return json({error:'Room not found. Check your classroom code.'},404);
 if(b.action==='join'){if(!room.open)return json({error:'This waiting room is closed.'},400);await db.insert(entries).values({id:room.id+':'+u.userId,room:room.id,user:u.userId,name:p.name,status:'waiting',joined:Date.now()}).onConflictDoNothing();return json({ok:true});}
 if(b.action==='leave'){await db.delete(entries).where(and(eq(entries.room,room.id),eq(entries.user,u.userId)));return json({ok:true});}
 if(room.owner!==u.userId)return json({error:'Only this room’s teacher can do that.'},403);
 if(b.action==='toggle')await db.update(rooms).set({open:room.open?0:1}).where(eq(rooms.id,room.id));
 else if(b.action==='admitAll')await db.update(entries).set({status:'admitted'}).where(and(eq(entries.room,room.id),eq(entries.status,'waiting')));
 else if(b.action==='admit')await db.update(entries).set({status:'admitted'}).where(and(eq(entries.room,room.id),eq(entries.id,String(b.id))));
 else if(b.action==='remove')await db.delete(entries).where(and(eq(entries.room,room.id),eq(entries.id,String(b.id))));
 else return json({error:'Unknown action'},400);return json({ok:true});
 }catch{return json({error:'That did not save. Please try again.'},500)}}

