#!/usr/bin/env node
/** Zaproszenia: Gmail compose / WhatsApp wa.me + Inbox. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const src=fs.readFileSync(path.join(__dirname,'../../09-posture-kb-invites-private.js'),'utf8');
function extract(name){
  const start=src.indexOf('function '+name);
  if(start<0)throw new Error('missing '+name);
  let i=start,depth=0,begun=false;
  for(;i<src.length;i++){
    if(src[i]==='{'){depth++;begun=true;}
    else if(src[i]==='}'){depth--;if(begun&&depth===0){i++;break;}}
  }
  return src.slice(start,i);
}

const opened=[];
const msgs=[];
const events=[];
const sandbox={
  window:{open:(url)=>{opened.push(String(url));return {closed:false};},CL:[]},
  CL:[
    {id:'c1',name:'Ada Nowak',email:'ada@example.com',phone:'500600700'},
    {id:'c2',name:'Bartek',email:'',phone:''},
    {id:'c3',name:'Celina',email:'',phone:'501502503'}
  ],
  getTrainerName:()=>'Trener Test',
  waPhone:(raw)=>{
    let d=String(raw||'').replace(/\D/g,'');
    if(!d)return '';
    if(d.length===9)d='48'+d;
    return d;
  },
  pushMsg:(id,t)=>msgs.push({id,t}),
  persistById:()=>{},
  fireIntEvent:(e,p)=>events.push({e,p}),
  addNotification:()=>{},
  notify:()=>{},
  closeM:()=>{},
  maybeResumeOnboard:()=>{},
  renderClients:()=>{},
  renderDash:()=>{},
  navigator:{clipboard:{writeText:async()=>{}}},
  document:{
    body:{appendChild(){},},
    createElement:()=>({href:'',target:'',click(){opened.push(this.href);},remove(){}}),
    getElementById:(id)=>{
      if(id==='inv-link')return{textContent:'https://app.example/?invite=tok1'};
      if(id==='inv-msg-preview')return{textContent:''};
      return null;
    }
  },
  inviteClientId:'c1',
  inviteMethod:'email',
  encodeURIComponent,
  console
};
sandbox.window.CL=sandbox.CL;
sandbox.window.open=sandbox.window.open;
vm.runInNewContext(
  extract('defaultInviteMethod')+'\n'+
  extract('inviteGmailComposeUrl')+'\n'+
  extract('inviteMailtoUrl')+'\n'+
  extract('openInviteEmailComposer')+'\n'+
  extract('buildInviteMessage')+'\n'+
  extract('sendInvitation')+'\n'+
  'window.buildInviteMessage=buildInviteMessage;window.sendInvitation=sendInvitation;window.defaultInviteMethod=defaultInviteMethod;window.openInviteEmailComposer=openInviteEmailComposer;',
  sandbox
);

let failed=0;
function eq(name,got,want){
  if(JSON.stringify(got)!==JSON.stringify(want)){console.error('FAIL',name,got,want);failed++;}
  else console.log('OK  ',name);
}

eq('default email',sandbox.defaultInviteMethod(sandbox.CL[0]),'email');
eq('default inbox no contact',sandbox.defaultInviteMethod(sandbox.CL[1]),'wiadomosc');
eq('default wa if phone only',sandbox.defaultInviteMethod(sandbox.CL[2]),'whatsapp');

const gmail=sandbox.inviteGmailComposeUrl('ada@example.com','Temat','Cześć');
eq('gmail compose host',gmail.indexOf('https://mail.google.com/mail/?view=cm')===0,true);
eq('gmail has to',gmail.indexOf('ada')>=0,true);

const built=sandbox.buildInviteMessage(sandbox.CL[0],'https://x/?invite=1','email');
eq('email has subject',!!built.subject,true);
eq('email body has link',built.body.includes('https://x/?invite=1'),true);
eq('wa body short',sandbox.buildInviteMessage(sandbox.CL[0],'https://x','whatsapp').body.includes('https://x'),true);

opened.length=0;msgs.length=0;events.length=0;
sandbox.inviteMethod='email';
sandbox.inviteClientId='c1';
sandbox.sendInvitation();
eq('gmail opened',opened.some(u=>u.indexOf('mail.google.com/mail')>=0),true);
eq('inbox copy',msgs.length>=1,true);
eq('invite marked',sandbox.CL[0].inviteSent,true);
eq('event fired',events.some(x=>x.e==='invite.sent'),true);

opened.length=0;
sandbox.inviteMethod='whatsapp';
sandbox.sendInvitation();
eq('wa opened',opened.some(u=>u.indexOf('wa.me/48500600700')>=0),true);

opened.length=0;msgs.length=0;
sandbox.inviteClientId='c2';
sandbox.inviteMethod='email';
sandbox.sendInvitation();
eq('no gmail without email',opened.length,0);
eq('still inbox',msgs.length>=1,true);

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll invite channel tests passed');
