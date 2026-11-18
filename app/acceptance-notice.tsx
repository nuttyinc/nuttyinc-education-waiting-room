"use client";
import {useEffect,useRef} from 'react';
import {CheckCircle2,Ticket} from 'lucide-react';

type Admission={id:string;status:string;joined:number;admittedAt?:number|null;acceptedBy?:string|null;ticket:number};
export default function AcceptanceNotice({entry,roomCode}:{entry:Admission;roomCode:string}){
 const dialog=useRef<HTMLDialogElement>(null);
 const dismissed=useRef(new Set<string>());
 const key='nuttyinc:accepted:'+roomCode+':'+entry.id+':'+entry.joined+':'+(entry.admittedAt||'legacy');
 function remember(){
   dismissed.current.add(key);
   try{sessionStorage.setItem(key,'seen')}catch{}
 }
 useEffect(()=>{
   const el=dialog.current;
   if(!el||entry.status!=='admitted')return;
   let seen=dismissed.current.has(key);
   try{seen=seen||sessionStorage.getItem(key)==='seen'}catch{}
   if(!seen&&!el.open)el.showModal();
   return()=>{if(el.open)el.close()};
 },[key,entry.status]);
 return <dialog ref={dialog} className="acceptanceDialog" aria-labelledby="accepted-title" aria-describedby="accepted-message" onClose={remember} onCancel={remember}>
   <div className="acceptedIcon"><CheckCircle2 size={36}/></div>
   <p className="acceptedEyebrow">CLASSROOM NOTIFICATION</p>
   <h2 id="accepted-title">You’re accepted!</h2>
   <p id="accepted-message"><strong>{entry.acceptedBy||'Your teacher'}</strong> has accepted you.</p>
   <div className="acceptedTicket"><Ticket size={23}/><span>Your ticket <strong>#{String(entry.ticket).padStart(3,'0')}</strong></span></div>
   <p className="acceptedHint">You’re ready. Follow your teacher’s instructions to begin.</p>
   <button autoFocus className="button dark full" onClick={()=>dialog.current?.close()}>Got it</button>
 </dialog>;
}
