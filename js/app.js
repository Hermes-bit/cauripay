(function(){
"use strict";
/* ============ helpers ============ */
const $=s=>document.querySelector(s);
const CFG=window.CAURIPAY_CONFIG||{}, Auth=window.CauriPayAuth;
const DEMO=CFG.transferMode!=="live";
const LEGAL_VERSION="2026-10";
const URL_RECOVERY=/type=recovery/.test(location.hash);
const eur=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2});
const eur0=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const nf0=new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0});
const nf5=new Intl.NumberFormat("fr-FR",{maximumFractionDigits:5});
const fm=v=>eur.format(v), fm0=v=>eur0.format(Math.round(v));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const todayIso=()=>iso(new Date());
const sum=a=>a.reduce((s,t)=>s+(+t.amount||0),0);
const r2=n=>Math.round(n*100)/100;
const parseAmt=v=>{const n=parseFloat(String(v??"").replace(/[\s €]/g,"").replace(",","."));return isFinite(n)?r2(n):NaN;};
const dfmt=(d,o)=>new Date(d+"T12:00").toLocaleDateString("fr-FR",o);
const timeOf=ts=>new Date(ts).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
const H48=48*3600e3;
const monthAdd=(mk,n)=>{const [y,m]=mk.split("-").map(Number);const d=new Date(y,m-1+n,1);return d.getFullYear()+"-"+pad(d.getMonth()+1);};
const monthName=(mk,o)=>dfmt(mk+"-15",o||{month:"long"});
const initials=n=>String(n||"").trim().split(/[\s@.]+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?";
const first=n=>String(n||"").trim().split(/\s+/)[0]||"";
const maskPhone=p=>{const d=String(p||"").replace(/\D/g,"");return d?"•••• "+d.slice(-2):"";};
// "1 234,56 €" → "1 234<small>,56 €</small>" (centimes plus petits, comme sur la maquette)
const money=v=>{const s=fm(v), m=s.match(/^(.*?)(,\d{2}\s€)$/); return m?`${m[1]}<small>${m[2]}</small>`:s;};
const b64e=s=>btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const b64d=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0)));
// catch-up plans: profile.catchups = [{id,from,amount,months,start,kind:"plan"|"skip"|"surplus"}]
function deductionFor(mk,P){return (P.catchups||[]).filter(x=>x.kind==="plan"&&x.amount>0&&mk>=x.start&&mk<monthAdd(x.start,x.months)).reduce((s,x)=>s+x.amount/x.months,0);}
// anciennes couleurs (thème clair) → couleurs lisibles sur fond sombre
const OLD2NEW={"#1E8A63":"#C8F04B","#D07A1A":"#F5B748","#3A6FD8":"#7FB2FF","#C24A73":"#FF8FB1","#7A4FD0":"#B9A3FF","#2696A3":"#5ED6C9","#8C8F2E":"#E6E36A","#6B7A72":"#A3B096","#B5532F":"#FF9C6B","#4C8A2E":"#8EE07A"};
const PALETTE=Object.values(OLD2NEW);
const col=c=>OLD2NEW[String(c||"").toUpperCase()]||c||"#A3B096";
const DEF_CATS=[["Courses",.34],["Restos & sorties",.14],["Shopping",.12],["Transport",.12],["Loisirs",.10],["Abonnements",.06],["Imprévus",.12]];

/* ============ Afrique → Europe ============ */
// Seules les monnaies à parité fixe avec l'euro sont ouvertes : le taux est connu à l'avance, sans risque de change.
const CUR={XOF:{rate:655.957,label:"F CFA"},XAF:{rate:655.957,label:"F CFA"},KMF:{rate:491.96775,label:"FC"},CVE:{rate:110.265,label:"CVE"}};
const METHODS={wave:"Wave",orange:"Orange Money",mtn:"MTN MoMo",moov:"Moov Money",airtel:"Airtel Money",bank:"Virement bancaire"};
const COUNTRIES=[
  ["SN","Sénégal","XOF","+221",["wave","orange","bank"]],
  ["CI","Côte d'Ivoire","XOF","+225",["wave","orange","mtn","moov","bank"]],
  ["ML","Mali","XOF","+223",["orange","moov","wave","bank"]],
  ["BF","Burkina Faso","XOF","+226",["orange","moov","wave","bank"]],
  ["BJ","Bénin","XOF","+229",["mtn","moov","bank"]],
  ["TG","Togo","XOF","+228",["moov","bank"]],
  ["NE","Niger","XOF","+227",["airtel","moov","bank"]],
  ["GW","Guinée-Bissau","XOF","+245",["orange","bank"]],
  ["CM","Cameroun","XAF","+237",["orange","mtn","bank"]],
  ["GA","Gabon","XAF","+241",["airtel","moov","bank"]],
  ["CG","Congo","XAF","+242",["mtn","airtel","bank"]],
  ["TD","Tchad","XAF","+235",["airtel","moov","bank"]],
  ["CF","Centrafrique","XAF","+236",["orange","bank"]],
  ["GQ","Guinée équatoriale","XAF","+240",["bank"]],
  ["KM","Comores","KMF","+269",["bank"]],
  ["CV","Cap-Vert","CVE","+238",["bank"]]
].map(([code,name,cur,dial,methods])=>({code,name,cur,dial,methods}));
const SOON=["Maroc","Tunisie","Algérie","Guinée","RD Congo","Madagascar","Nigeria","Ghana","Kenya"];
const ZONES=[["XOF","Afrique de l'Ouest · franc CFA (UEMOA)"],["XAF","Afrique centrale · franc CFA (CEMAC)"],["other","Autres monnaies liées à l'euro"]];
const country=c=>COUNTRIES.find(x=>x.code===c)||COUNTRIES[0];
const fmLocal=(v,cur)=>nf0.format(v)+" "+(CUR[cur]||{label:cur}).label;
const PURPOSES=["Aide familiale","Frais de scolarité ou d'études","Loyer ou logement","Remboursement entre proches","Mon propre argent (compte en Afrique)","Cadeau","Autre"];
const RELATIONS=["Parent","Conjoint ou conjointe","Frère ou sœur","Enfant","Autre membre de la famille","Ami ou amie","Moi-même","Autre"];
const STATUS={created:["En attente","w"],paid:["Payée","ok"],checking:["Vérification","w"],credited:["Reçue","ok"],cancelled:["Annulée","need"],expired:["Expirée","need"]};
const VALID=(CFG.requestValidityDays||7)*864e5;
const trView=t=>t.status==="created"&&Date.now()-t.createdAt>VALID?{...t,status:"expired"}:t;
const feeFor=e=>e>0?r2(Math.max(CFG.transferFeeMin||0,e*(CFG.transferFeePct||0))):0;

/* ============ state ============ */
// S.profile: {v:2,name,income,fixed,save,categories:[{id,name,budget,color}],catchups,kyc,createdAt}
// S.tx / S.pots / S.wishes / S.transfers / S.contacts : maps id -> doc
const KINDS=["tx","pots","wishes","transfers","contacts"];
const emptyState=()=>({profile:null,tx:{},pots:{},wishes:{},transfers:{},contacts:{},savedAt:0});
let S=emptyState();
let phase="loading";           // loading | auth | verify | reset | onboarding | app | payer
let mode="pending";            // pending | cloud (compte Claude) | supabase | local
let user=null;                 // {id,email,name}
let tab="accueil", navStack=[], txFilter="all", histLimit=3, weekOpen=false;
let authView="login", authErr="", authMsg="", pendingEmail="", authBusy=false;
let rx={tab:"new",contact:null,country:"SN",str:"",cur:"EUR"};
let pendingWrites=0, dirty=false, R=null, lastSync=0;
try{let t=localStorage.getItem("cauripay_tab"); t={depenses:"budget",tresorerie:"epargne"}[t]||t; if(["accueil","budget","epargne","envies"].includes(t)) tab=t;}catch(e){}
const displayName=()=>(S.profile&&S.profile.name)||(user&&user.name)||"";

const cacheKey=()=>"cauripay_v3_"+(user?user.id:"anon");
function saveLocal(){try{localStorage.setItem(cacheKey(),JSON.stringify(S));}catch(e){}}
function normalize(d){const o=emptyState(); if(d&&typeof d==="object"){o.profile=d.profile||null; o.savedAt=+d.savedAt||0; KINDS.forEach(k=>{if(d[k]&&typeof d[k]==="object") o[k]=d[k];});} return o;}
function loadLocal(){try{const s=JSON.parse(localStorage.getItem(cacheKey())||"null"); if(s&&typeof s==="object"&&s.tx) return normalize(s);}catch(e){} return null;}
// Données de l'ancienne version (Tirelire, avant les comptes) : reprises une seule fois, par le premier compte qui se connecte sur l'appareil.
function legacyData(){
  try{if(localStorage.getItem("cauripay_legacy_owner")) return null;}catch(e){return null;}
  let d=null;
  try{const s=JSON.parse(localStorage.getItem("tirelire_v2_cache")||"null"); if(s&&s.profile) d=normalize(s);}catch(e){}
  if(!d){try{d=migrateV1(JSON.parse(localStorage.getItem("tirelire_state")||"null"));}catch(e){}}
  return d;
}
function claimLegacy(){try{localStorage.setItem("cauripay_legacy_owner",user?user.id:"?");}catch(e){}}

function migrateV1(o){
  if(!o||o.v!==1||o.example) return null;
  const out={...emptyState(),profile:{v:2,income:+o.settings?.income||0,fixed:+o.settings?.fixed||0,save:+o.settings?.save||0,
    categories:(o.categories||[]).map((c,i)=>({id:c.id,name:c.name,budget:+c.budget||0,color:c.color||PALETTE[i%PALETTE.length]})),createdAt:Date.now()}};
  (o.tx||[]).forEach(t=>{const id=t.id||uid();out.tx[id]={id,date:t.date,amount:+t.amount,cat:t.cat,note:t.note||"",kind:t.kind||"besoin",createdAt:Date.now()};});
  (o.goals||[]).forEach((g,i)=>{const id=g.id||uid();out.pots[id]={id,name:g.name,target:+g.target||0,deadline:"",balance:+g.saved||0,color:PALETTE[(i+2)%PALETTE.length],
    moves:g.saved?[{d:todayIso(),amt:+g.saved,note:"Solde de départ"}]:[],createdAt:Date.now()+i};});
  (o.wishes||[]).forEach(w=>{const id=w.id||uid();out.wishes[id]={...w,id};});
  return out;
}

/* ============ database layer ============ */
const chains={};
function syncLabel(){
  if(mode==="cloud") return pendingWrites?"Enregistrement…":"Synchronisé avec ton compte Claude";
  if(mode==="supabase") return pendingWrites?"Enregistrement…":lastSync?"Synchronisé":"Enregistré sur cet appareil";
  return "Enregistré sur cet appareil";
}
function refFor(kind,id){return kind==="profile"?R.profile:R.profile.collection(kind).doc(id);}
let pushT=null;
function schedulePush(){pendingWrites=1; clearTimeout(pushT); pushT=setTimeout(pushNow,700);}
async function pushNow(){
  clearTimeout(pushT); pushT=null; if(mode!=="supabase") return;
  pendingWrites=1;
  try{await Auth.push(S); lastSync=Date.now();}
  catch(e){toast("Synchronisation impossible pour l'instant. Tes données restent sur cet appareil.");}
  pendingWrites=0;
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&pushT) pushNow();});
function write(kind,id,data){
  if(kind==="profile") S.profile=data; else { if(data===null) delete S[kind][id]; else S[kind][id]=data; }
  S.savedAt=Date.now();
  saveLocal();
  if(mode==="supabase"){schedulePush(); return Promise.resolve();}
  if(mode!=="cloud") return Promise.resolve();
  const ref=refFor(kind,id), key=ref.path;
  pendingWrites++;
  const body=data===null?null:JSON.parse(JSON.stringify(data));
  const p=(chains[key]||Promise.resolve()).then(()=>body===null?ref.delete():ref.set(body))
    .catch(e=>{ if(e&&e.code==="unavailable") return new Promise(r=>setTimeout(r,600+Math.random()*800)).then(()=>body===null?ref.delete():ref.set(body)).catch(onWriteErr); onWriteErr(e); })
    .finally(()=>{pendingWrites--;});
  chains[key]=p; return p;
}
function onWriteErr(e){
  const c=e&&e.code;
  toast(c==="quota_exceeded"?"Base pleine : supprime d'anciennes dépenses pour continuer.":c==="invalid_argument"?"Tu n'as pas le droit d'écrire ici.":"Enregistrement impossible pour l'instant. Réessaie.");
}

// Version ouverte depuis Claude : le compte Claude sert d'identité, pas besoin de connexion par e-mail.
async function connectClaude(){
  try{
    if(!window.claude||!window.claude.use) return false;
    const [db,cu]=await Promise.all([claude.use("db"),claude.use("user")]);
    if(!db||!cu) return false;
    const id=await cu.id(); if(!id) return false;
    user={id:"claude_"+id,email:"",name:""};
    const base="data/users/"+id;
    R={profile:db.doc(base+"/profile")};
    const snap=await R.profile.get();
    mode="cloud";
    S=loadLocal()||emptyState();
    if(snap.exists){
      S.profile={...snap.data()};
    }else{
      let seed=null;
      try{const old=await db.doc(base+"/tirelire").get(); if(old.exists) seed=migrateV1(old.data());}catch(e){}
      if(!seed&&S.profile) seed=S;
      if(!seed) seed=legacyData();
      S=emptyState();
      if(seed&&seed.profile){
        claimLegacy();
        for(const k of KINDS) for(const [i,d] of Object.entries(seed[k]||{})) await write(k,i,d);
        await write("profile","profile",seed.profile);
      }else saveLocal();
    }
    phase=S.profile?"app":"onboarding";
    render();
    R.profile.onSnapshot(s=>{ if(s.exists){S.profile={...s.data()}; if(phase!=="app") phase="app"; saveLocal(); requestRender();} },()=>{});
    for(const k of KINDS){
      R.profile.collection(k).limit(1000).onSnapshot(q=>{const m={}; q.docs.forEach(d=>{m[d.id]={...d.data(),id:d.id};}); S[k]=m; saveLocal(); requestRender();},()=>{});
    }
    return true;
  }catch(e){ return false; }
}

async function startSession(){
  mode=Auth.live?"supabase":"local";
  S=loadLocal()||emptyState();
  if(!S.profile){const L=legacyData(); if(L){S=L; claimLegacy(); saveLocal();}}
  if(Auth.live){
    if(!S.profile){phase="loading"; render();}
    try{
      const remote=await Auth.pull();
      if(remote&&remote.profile&&(!S.profile||(+remote.savedAt||0)>=(S.savedAt||0))){S=normalize(remote); saveLocal(); lastSync=Date.now();}
      else if(S.profile) await pushNow();
    }catch(e){toast("Synchronisation impossible. Tes données restent sur cet appareil.");}
  }
  tickDemo();
  ob={step:0,name:"",income:"",fixed:"",save:""};
  phase=URL_RECOVERY&&Auth.live&&!startSession.done?"reset":S.profile?"app":"onboarding";
  startSession.done=true;
  render();
}

/* ============ calculations ============ */
function calc(){
  const P=S.profile||{income:0,fixed:0,save:0,categories:[]};
  const now=new Date(), td=iso(now), mk=td.slice(0,7);
  const y=now.getFullYear(), m=now.getMonth(), day=now.getDate(), dim=new Date(y,m+1,0).getDate();
  const txs=Object.values(S.tx);
  const mtx=txs.filter(t=>t.date&&t.date.slice(0,7)===mk);
  const spent=sum(mtx);
  const base=Math.max(0,(+P.income||0)-(+P.fixed||0)-(+P.save||0));
  const catchup=deductionFor(mk,P);
  const avail=Math.max(0,base-catchup);
  const remaining=avail-spent;
  // last month: did it go over or under?
  const prevMk=monthAdd(mk,-1);
  const prevSpent=sum(txs.filter(t=>t.date&&t.date.slice(0,7)===prevMk));
  const prevAvail=Math.max(0,base-deductionFor(prevMk,P));
  const prevDiff=r2(prevSpent-prevAvail);
  const usedPrev=P.createdAt&&iso(new Date(P.createdAt)).slice(0,7)<=prevMk;
  const prevPending=!!(usedPrev&&Math.abs(prevDiff)>=1&&!(P.catchups||[]).some(x=>x.from===prevMk));
  const activeCatchups=(P.catchups||[]).filter(x=>x.kind==="plan"&&x.amount>0&&mk<monthAdd(x.start,x.months)).map(x=>{
    const done=Math.max(0,(+mk.slice(0,4)-+x.start.slice(0,4))*12+(+mk.slice(5)-+x.start.slice(5)));
    return {...x,per:x.amount/x.months,doneMonths:Math.min(x.months,done),started:mk>=x.start,end:monthAdd(x.start,x.months-1)};});
  // week (Mon–Sun), clipped to this month
  const dow=(now.getDay()+6)%7;
  const monday=new Date(y,m,day-dow);
  const first=new Date(y,m,1), last=new Date(y,m,dim);
  const ws=monday<first?first:monday;
  const sunday=new Date(y,m,day-dow+6), we=sunday>last?last:sunday;
  const wsI=iso(ws), weI=iso(we);
  const spentBefore=sum(mtx.filter(t=>t.date<wsI));
  const daysFromWs=dim-ws.getDate()+1, daysInWeek=we.getDate()-ws.getDate()+1;
  const weekBudget=Math.max(0,(avail-spentBefore)*daysInWeek/daysFromWs);
  const wtx=mtx.filter(t=>t.date>=wsI&&t.date<=weI);
  const spentWeek=sum(wtx);
  const leftWeek=weekBudget-spentWeek;
  const spentToday=sum(mtx.filter(t=>t.date===td));
  const spentWeekBefore=sum(wtx.filter(t=>t.date<td));
  const daysLeftWeek=we.getDate()-day+1;
  const todayBudget=Math.max(0,(weekBudget-spentWeekBefore)/daysLeftWeek);
  const leftToday=todayBudget-spentToday;
  const dailyTarget=weekBudget/daysInWeek;
  const week=[...Array(7)].map((_,i)=>{const d=new Date(y,m,day-dow+i),k=iso(d);
    return {k,letter:"LMMJVSD"[i],n:d.getDate(),inMonth:d.getMonth()===m,today:k===td,future:k>td,spent:sum(txs.filter(t=>t.date===k))};});
  const wants=sum(mtx.filter(t=>t.kind==="envie"));
  const byCat={}; (P.categories||[]).forEach(c=>byCat[c.id]=0); mtx.forEach(t=>{byCat[t.cat]=(byCat[t.cat]||0)+t.amount;});
  const projection=day?spent/day*dim:0;
  // streak without "envie"
  const wantDays=new Set(txs.filter(t=>t.kind==="envie").map(t=>t.date));
  const start=P.createdAt?iso(new Date(P.createdAt)):td;
  let streak=0; for(let i=0;i<500;i++){const k=iso(new Date(y,m,day-i)); if(k<start||wantDays.has(k)) break; streak++;}
  const wishes=Object.values(S.wishes);
  const skipped=wishes.filter(w=>w.status==="skipped").reduce((a,w)=>a+(+w.price||0),0);
  // trésorerie
  const pots=Object.values(S.pots).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  const totalSaved=pots.reduce((a,p)=>a+(+p.balance||0),0);
  const savedThisMonth=pots.reduce((a,p)=>a+(p.moves||[]).filter(x=>x.d&&x.d.slice(0,7)===mk).reduce((s,x)=>s+x.amt,0),0);
  const potInfo=pots.map(p=>{
    const left=Math.max(0,(+p.target||0)-(+p.balance||0));
    let monthsLeft=null,perMonth=null,perWeek=null;
    if(p.deadline&&left>0){const [dy,dm]=p.deadline.split("-").map(Number); monthsLeft=Math.max(1,(dy-y)*12+(dm-1-m)+1); perMonth=left/monthsLeft; perWeek=perMonth*12/52;}
    const done=p.target>0&&p.balance>=p.target;
    return {...p,left,monthsLeft,perMonth,perWeek,done,pct:p.target?Math.min(1,p.balance/p.target):0};
  });
  const needMonthly=potInfo.reduce((a,p)=>a+(p.perMonth||0),0);
  // réceptions depuis l'Afrique
  const transfers=Object.values(S.transfers).map(trView);
  const trMonth=transfers.filter(t=>t.status!=="cancelled"&&t.status!=="expired"&&iso(new Date(t.createdAt)).slice(0,7)===mk).reduce((a,t)=>a+(+t.amountEur||0),0);
  return {P,now,td,mk,day,dim,mtx,spent,avail,base,catchup,prevMk,prevSpent,prevAvail,prevDiff,prevPending,activeCatchups,remaining,ws,we,weekBudget,spentWeek,leftWeek,todayBudget,leftToday,spentToday,dailyTarget,daysLeftWeek,daysInWeek,week,
    wants,byCat,projection,streak,skipped,wishes,pots:potInfo,totalSaved,savedThisMonth,needMonthly,weeklyNormal:avail*12/52,transfers,trMonth};
}
const catOf=id=>(S.profile?.categories||[]).find(c=>c.id===id)||{name:"Autre",color:"#A3B096"};

/* ============ icons ============ */
const sv=(p,f)=>`<svg viewBox="0 0 24 24" fill="${f?"currentColor":"none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I={
  home:sv('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  chart:sv('<path d="M5 20V11M11 20V5M17 20v-6M3 20h18"/>'),
  vault:sv('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5V7M12 17v-1.5M7 20v1.5M17 20v1.5"/>'),
  clock:sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  user:sv('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  trash:sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  plus:sv('<path d="M12 5v14M5 12h14"/>'),
  minus:sv('<path d="M5 12h14"/>'),
  spark:sv('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
  alert:sv('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
  check:sv('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'),
  piggy:sv('<path d="M19 9c1 0 2 .5 2 2v2h-2l-1 3h-2v2h-3v-2h-3v2H7v-2.5A6 6 0 0 1 4 10c0-3 3-5 7-5h1l3-2v3.5c1.4.6 2.5 1.5 3 2.5z"/><circle cx="15" cy="10" r=".6" fill="currentColor"/>'),
  bag:sv('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  up:sv('<path d="M7 17L17 7M8 7h9v9"/>'),
  down:sv('<path d="M17 7L7 17M16 17H7V8"/>'),
  back:sv('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  bell:sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  trophy:sv('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  chevD:sv('<path d="M6 9l6 6 6-6"/>'),
  chevR:sv('<path d="M9 6l6 6-6 6"/>'),
  dots:sv('<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>'),
  scan:sv('<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><rect x="8.5" y="8.5" width="7" height="7" rx="1.5"/>'),
  globe:sv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  folder:sv('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>'),
  shield:sv('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  help:sv('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.8 1c0 1.7-2.3 2-2.3 3.5M12 17h.01"/>'),
  copy:sv('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  chat:sv('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
  msg:sv('<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z"/>'),
  mail:sv('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 7l9 6 9-6"/>'),
  logout:sv('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>'),
  key:sv('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>'),
  eye:sv('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  doc:sv('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  del:sv('<path d="M9 6h11v12H9l-6-6z"/><path d="M12 10l4 4M16 10l-4 4"/>'),
  edit:sv('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  undo:sv('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>')
};
const LOGO=`<img class="logo" src="icons/logo.svg" alt="CauriPay" width="56" height="56">`;

/* ============ render ============ */
function isBusy(){const a=document.activeElement; return !!$("#scrim")||!!(a&&/INPUT|SELECT|TEXTAREA/.test(a.tagName)&&a.closest("#app"));}
function requestRender(){ if(isBusy()){dirty=true;return;} render(); }
document.addEventListener("focusout",()=>setTimeout(()=>{if(dirty&&!isBusy()){dirty=false;render();}},0));

function render(){
  const app=$("#app"), nav=$("#nav");
  const sub=phase!=="app"||tab==="transfert"||tab==="profil";
  document.body.classList.toggle("no-nav",sub);
  nav.hidden=sub;
  if(phase==="loading"){app.innerHTML=`<div class="loading"><i></i><div>Ouverture de tes comptes…</div></div>`;return;}
  if(phase==="payer"){app.innerHTML=vPayer();return;}
  if(phase==="auth"||phase==="verify"||phase==="reset"){app.innerHTML=vAuth();return;}
  if(phase==="onboarding"){app.innerHTML=vOnboarding();return;}
  const c=calc();
  if(!sub) nav.innerHTML=navHtml();
  const v={accueil:vHome,budget:vSpend,epargne:vTreso,envies:vWishes,transfert:vTransfer,profil:vProfile}[tab]||vHome;
  app.innerHTML=`<section class="view view-${tab}">${v(c)}</section>`;
  if(tab==="transfert"&&rx.tab==="new") rxUpdate();
}
function goTab(k,isBack){
  if($("#scrim")) closeModal();
  if(k==="transfert"||k==="profil"){ if(!isBack&&tab!==k) navStack.push(tab); }
  else{ navStack=[]; try{localStorage.setItem("cauripay_tab",k);}catch(_){} }
  tab=k; render(); window.scrollTo({top:0});
}
function navHtml(){
  const it=(k,l,ic)=>`<button data-tab="${k}" ${tab===k?'aria-current="page"':""}>${ic}<span>${l}</span></button>`;
  return `<div class="nav-in">${it("accueil","Accueil",I.home)}${it("budget","Budget",I.chart)}
    <button class="nav-main" data-act="actions" aria-label="Actions rapides" aria-haspopup="dialog">${I.scan}</button>
    ${it("epargne","Épargne",I.vault)}${it("envies","Envies",I.clock)}</div>`;
}
const avatarBtn=cls=>`<button class="avatar ${cls||""}" data-tab="profil" aria-label="Mon profil">${esc(initials(displayName()||(user&&user.email)))}</button>`;
function bellBtn(c,cls){const n=notifs(c).length; return `<button class="sq-btn ${cls||""}" data-act="notifs" aria-label="Notifications${n?` : ${n}`:""}">${I.bell}${n?`<i class="badge">${n}</i>`:""}</button>`;}
const pageHead=(title,c)=>`<header class="phdr">${avatarBtn()}<h1>${title}</h1>${bellBtn(c,"dark")}</header>`;
const subHead=(title,right)=>`<header class="phdr"><button class="sq-btn lime" data-back aria-label="Retour">${I.back}</button><h1>${title}</h1>${right||'<span></span>'}</header>`;
const secHead=(title,btn)=>`<div class="sec-head"><h2>${title}</h2>${btn||""}</div>`;

/* ---------- connexion / inscription ---------- */
const pwField=(id,ac,label)=>`<label class="f">${label||"Mot de passe"}<span class="pw"><input class="in" id="${id}" type="password" autocomplete="${ac}" required><button type="button" class="pw-eye" data-eye="${id}" aria-label="Afficher le mot de passe" aria-pressed="false">${I.eye}</button></span></label>`;
const pwRules=()=>`<ul class="pw-rules" id="pwRules">${[["len","12 caractères minimum"],["mix","Une majuscule et une minuscule"],["digit","Un chiffre"],["special","Un caractère spécial, ou 14 caractères"]].map(([k,l])=>`<li data-rule="${k}">${l}</li>`).join("")}</ul>`;
const legalLinks=()=>`<nav class="legal-links" aria-label="Informations légales"><a href="legal/mentions-legales.html" target="_blank" rel="noopener">Mentions légales</a><a href="legal/confidentialite.html" target="_blank" rel="noopener">Confidentialité</a><a href="legal/cgu.html" target="_blank" rel="noopener">CGU</a></nav>`;
function vAuth(){
  let body;
  if(phase==="verify") body=`<div class="auth-card">
      <span class="big-ico">${I.mail}</span>
      <h2>Vérifie ta boîte mail</h2>
      <p class="muted">On a envoyé un lien de confirmation à <b>${esc(pendingEmail)}</b>. Clique dessus pour activer ton compte. Pense à regarder dans les indésirables.</p>
      <div class="err" id="auErr" role="alert">${esc(authErr)}</div>
      ${authMsg?`<div class="nudge ok">${esc(authMsg)}</div>`:""}
      <button class="btn pri block" data-auth="login">J'ai confirmé, me connecter</button>
      <button class="link" data-auth="resend">Renvoyer l'e-mail</button></div>`;
  else if(phase==="reset") body=`<form class="auth-card" id="authForm" data-mode="reset" novalidate>
      <h2>Choisis un nouveau mot de passe</h2>
      ${pwField("auPw","new-password","Nouveau mot de passe")}${pwRules()}
      <div class="err" id="auErr" role="alert"></div>
      <button class="btn pri block" type="submit">Enregistrer</button></form>`;
  else{
    const v=authView;
    body=`${v!=="forgot"?`<div class="seg" role="group" aria-label="Choix"><button type="button" data-auth="login" aria-pressed="${v==="login"}">Connexion</button><button type="button" data-auth="signup" aria-pressed="${v==="signup"}">Inscription</button></div>`:""}
      <form class="auth-card" id="authForm" data-mode="${v}" novalidate>
        ${v==="forgot"?`<h2>Mot de passe oublié</h2><p class="muted small">Indique ton e-mail : tu recevras un lien pour choisir un nouveau mot de passe.</p>`:""}
        ${v==="signup"?`<label class="f">Prénom<input class="in" id="auName" autocomplete="given-name" maxlength="40" required></label>`:""}
        <label class="f">Adresse e-mail<input class="in" id="auEmail" type="email" autocomplete="email" inputmode="email" required value="${esc(pendingEmail)}"></label>
        ${v!=="forgot"?pwField("auPw",v==="signup"?"new-password":"current-password"):""}
        ${v==="signup"?pwRules()+`
          <label class="chk"><input type="checkbox" id="auAge"><span>J'ai 18 ans ou plus.</span></label>
          <label class="chk"><input type="checkbox" id="auCgu"><span>J'accepte les <a href="legal/cgu.html" target="_blank" rel="noopener">conditions d'utilisation</a> et j'ai lu la <a href="legal/confidentialite.html" target="_blank" rel="noopener">politique de confidentialité</a>.</span></label>
          <label class="chk"><input type="checkbox" id="auNews"><span>Je veux recevoir les nouveautés de CauriPay par e-mail. <span class="muted">Facultatif.</span></span></label>`:""}
        <div class="err" id="auErr" role="alert">${esc(authErr)}</div>
        ${authMsg?`<div class="nudge ok">${esc(authMsg)}</div>`:""}
        <button class="btn pri block" type="submit">${v==="signup"?"Créer mon compte":v==="forgot"?"Recevoir le lien":"Se connecter"}</button>
        ${v==="login"?`<button type="button" class="link" data-auth="forgot">Mot de passe oublié ?</button>`:v==="forgot"?`<button type="button" class="link" data-auth="login">Retour à la connexion</button>`:""}
      </form>`;
  }
  return `<div class="auth">
    <div class="auth-hero">${LOGO}<h1>CauriPay</h1><p>Ton budget, ton épargne et l'argent envoyé par tes proches d'Afrique, au même endroit.</p></div>
    ${Auth.live?"":`<div class="demo-flag">${I.alert}<span><b>Mode démo.</b> Ton compte reste sur cet appareil et aucun e-mail n'est envoyé.</span></div>`}
    ${body}${legalLinks()}</div>`;
}
async function handleAuth(form){
  const m=form.dataset.mode, err=t=>{const e=$("#auErr"); if(e) e.textContent=t;};
  const val=id=>{const el=$("#"+id); return el?el.value:"";};
  const email=val("auEmail").trim(), pw=val("auPw"), name=val("auName").trim();
  if(m!=="reset"&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return err("Indique une adresse e-mail valide.");
  if(m==="login"&&!pw) return err("Indique ton mot de passe.");
  if(m==="signup"){
    if(!name) return err("Indique ton prénom.");
    if(!Auth.checkPassword(pw).ok) return err("Ton mot de passe ne respecte pas encore toutes les règles.");
    if(!$("#auAge").checked) return err("CauriPay est réservée aux personnes majeures.");
    if(!$("#auCgu").checked) return err("Accepte les conditions d'utilisation pour créer ton compte.");
  }
  if(m==="reset"&&!Auth.checkPassword(pw).ok) return err("Ton mot de passe ne respecte pas encore toutes les règles.");
  const btn=form.querySelector("[type=submit]"), lbl=btn.textContent;
  btn.disabled=true; btn.textContent="Patiente…"; err(""); authBusy=true;
  try{
    if(m==="signup"){
      const consents={cgu_version:LEGAL_VERSION,cgu_accepted_at:new Date().toISOString(),adult:true,marketing:$("#auNews").checked};
      const r=await Auth.signUp({email,password:pw,name,consents});
      pendingEmail=email; authErr=""; authMsg="";
      if(r.needsConfirm){phase="verify"; render(); return;}
      user=r.user; await startSession(); toast("Bienvenue "+name+" !"); return;
    }
    if(m==="login"){user=await Auth.signIn({email,password:pw}); authErr=""; authMsg=""; await startSession(); return;}
    if(m==="forgot"){await Auth.resetPassword(email); pendingEmail=email; authView="login"; authMsg="Si un compte existe pour cette adresse, un lien vient de partir."; render(); return;}
    if(m==="reset"){await Auth.updatePassword(pw); history.replaceState(null,"",location.pathname); phase=S.profile?"app":"onboarding"; render(); toast("Mot de passe modifié"); return;}
  }catch(e){err(e.message||String(e));}
  finally{authBusy=false;}
  btn.disabled=false; btn.textContent=lbl;
}

/* ---------- onboarding ---------- */
let ob={step:0,name:"",income:"",fixed:"",save:""};
function vOnboarding(){
  const st=ob.step, inc=parseAmt(ob.income)||0, fix=parseAmt(ob.fixed)||0, sav=parseAmt(ob.save)||0;
  const avail=Math.max(0,inc-fix-sav);
  const dots=`<div class="steps">${[0,1,2,3].map(i=>`<i class="${i<=st?"on":""}"></i>`).join("")}</div>`;
  const back=st>0?`<button class="btn ghost" data-ob="back">Retour</button>`:"";
  const out=mode!=="cloud"?`<button class="link" data-act="logout" style="align-self:center">Se déconnecter</button>`:"";
  if(st===0) return `<div class="onb">${dots}<h2>On commence par ce qui rentre.</h2><p class="muted">Ton salaire net et tes autres revenus réguliers, par mois. Trois questions et c'est prêt.</p>
    <div class="card">${displayName()?"":`<label class="f">Ton prénom<input class="in" id="obName" maxlength="40" autocomplete="given-name" value="${esc(ob.name)}"></label>`}
    <label class="f">Revenus nets par mois<input class="in num" id="obIncome" inputmode="decimal" placeholder="ex. 1 850" value="${esc(ob.income)}"></label>
    <div class="err" id="obErr"></div><button class="btn pri block" data-ob="next">Continuer</button></div>
    <button class="link" data-act="import" style="align-self:center">J'ai déjà une sauvegarde à importer</button>${out}</div>`;
  if(st===1) return `<div class="onb">${dots}<h2>Ce qui part tout seul chaque mois.</h2><p class="muted">Loyer, électricité, internet, téléphone, assurance, crédit… Additionne tout ce qui tombe automatiquement.</p>
    <div class="card"><label class="f">Charges fixes par mois<input class="in num" id="obFixed" inputmode="decimal" placeholder="ex. 780" value="${esc(ob.fixed)}"></label>
    <div class="err" id="obErr"></div><div class="row">${back}<button class="btn pri" style="flex:1" data-ob="next">Continuer</button></div></div></div>`;
  if(st===2){const base=Math.max(0,inc-fix);
    return `<div class="onb">${dots}<h2>Ce que tu mets de côté, avant tout le reste.</h2><p class="muted">Il te reste ${fm0(base)} après tes charges. Même un petit montant chaque mois change tout. Tu pourras l'ajuster.</p>
    <div class="card"><div class="row">${[.1,.15,.2].map(r=>`<button class="btn sm ghost" data-ob-save="${Math.round(base*r/5)*5}">${Math.round(r*100)} % · ${fm0(Math.round(base*r/5)*5)}</button>`).join("")}</div>
    <label class="f">Épargne par mois<input class="in num" id="obSave" inputmode="decimal" placeholder="ex. 150" value="${esc(ob.save)}"></label>
    <div class="err" id="obErr"></div><div class="row">${back}<button class="btn pri" style="flex:1" data-ob="next">Voir mon budget</button></div></div></div>`;}
  return `<div class="onb">${dots}<h2>Voilà ton cadre.</h2>
    <div class="result"><div class="eyebrow">Tu peux dépenser environ</div><div class="big num">${fm0(avail*12/52)}</div><div style="margin-top:6px;font-weight:600">par semaine, soit ${fm0(avail)} par mois pour le quotidien</div></div>
    <p class="muted small">Courses, sorties, shopping, transport : tout passe par ce montant. L'appli recalcule ta semaine chaque jour selon ce que tu as déjà dépensé. Des budgets par catégorie sont proposés, tu pourras les modifier dans ton profil.</p>
    <div class="row">${back}<button class="btn pri" style="flex:1" data-ob="finish">C'est parti</button></div></div>`;
}
function obNext(){
  const map={0:["obIncome","income"],1:["obFixed","fixed"],2:["obSave","save"]};
  if(ob.step===0&&$("#obName")) ob.name=$("#obName").value.trim();
  if(map[ob.step]){const [idd,key]=map[ob.step]; const v=$("#"+idd).value; const n=parseAmt(v||"0");
    if(ob.step===0&&!(n>0)){$("#obErr").textContent="Indique un montant supérieur à 0.";return;}
    if(isNaN(n)||n<0){$("#obErr").textContent="Ce montant n'est pas valide.";return;}
    ob[key]=String(n); }
  ob.step++; render(); const f=document.querySelector("#app input"); if(f) f.focus();
}
async function obFinish(){
  const inc=parseAmt(ob.income)||0, fix=parseAmt(ob.fixed)||0, sav=parseAmt(ob.save)||0, avail=Math.max(0,inc-fix-sav);
  const cats=DEF_CATS.map(([name,r],i)=>({id:"c"+i+uid().slice(-3),name,budget:Math.round(avail*r/5)*5,color:PALETTE[i]}));
  const over=cats.reduce((a,k)=>a+k.budget,0)-avail; if(over>0) cats[0].budget=Math.max(0,cats[0].budget-Math.ceil(over/5)*5); // les arrondis ne doivent pas dépasser le disponible
  const potId=uid();
  phase="app"; tab="accueil";
  write("pots",potId,{id:potId,name:"Coussin de sécurité",target:Math.round((fix+avail)*3/50)*50||1000,deadline:"",balance:0,moves:[],color:PALETTE[0],createdAt:Date.now()});
  write("profile","profile",{v:2,name:ob.name||(user&&user.name)||"",income:inc,fixed:fix,save:sav,categories:cats,createdAt:Date.now()});
  render(); toast("Ton budget est prêt");
}

/* ---------- accueil ---------- */
function coachLine(c){
  if(!c.avail) return "Tes charges et ton épargne prennent tout. Revois tes montants dans ton profil.";
  if(c.leftWeek<0) return `Semaine dépassée de ${fm0(-c.leftWeek)}. Plus de dépense plaisir jusqu'à lundi : ça sera retiré des semaines suivantes.`;
  if(c.leftToday<0) return `Tu as dépassé ta part du jour de ${fm0(-c.leftToday)}. Demain, fais une journée à zéro pour rattraper.`;
  if(c.daysLeftWeek===1) return `Dernier jour de la semaine : ${fm0(c.leftWeek)} encore dispo. Ce qui reste repart sur la suite du mois.`;
  if(c.spentWeek<c.dailyTarget*(c.daysInWeek-c.daysLeftWeek)*0.8) return "Tu es sous ton rythme cette semaine. Continue comme ça, c'est de la marge pour la fin du mois.";
  return `Pour tenir, garde en moyenne ${fm0(c.leftWeek/c.daysLeftWeek)} par jour jusqu'à ${c.we.toLocaleDateString("fr-FR",{weekday:"long"})}.`;
}
function notifs(c){
  if(!S.profile) return [];
  const out=[], now=Date.now();
  if(c.prevPending) out.push({ic:I.alert,t:`Bilan de ${monthName(c.prevMk)} : choisis quoi faire de ${c.prevDiff>0?"ton dépassement":"ce qui reste"}.`,a:'data-tab="accueil"'});
  if(c.leftWeek<0) out.push({ic:I.alert,t:`Semaine dépassée de ${fm0(-c.leftWeek)}.`,a:'data-tab="budget"'});
  c.wishes.filter(w=>w.status==="wait"&&now-w.created>=H48).forEach(w=>out.push({ic:I.clock,t:`Les 48 h sont passées pour « ${esc(w.name)} » : à toi de décider.`,a:'data-tab="envies"'}));
  c.transfers.filter(t=>t.status==="credited"&&now-(t.statusAt||0)<3*864e5).forEach(t=>out.push({ic:I.down,t:`${fm(t.amountEur)} reçus de ${esc(first(t.senderName))}.`,a:`data-tr="${t.id}"`}));
  c.transfers.filter(t=>t.status==="created").forEach(t=>out.push({ic:I.globe,t:`${esc(first(t.senderName))} n'a pas encore payé ta demande de ${fm(t.amountEur)}.`,a:`data-tr="${t.id}"`}));
  return out;
}
function vHome(c){
  const name=displayName(), left=c.leftWeek;
  const wpct=c.weekBudget?Math.min(100,c.spentWeek/c.weekBudget*100):0;
  const maxCol=Math.max(c.dailyTarget*1.5,...c.week.map(d=>d.spent),1);
  const range=`${c.ws.getDate()}${c.ws.getMonth()!==c.we.getMonth()?" "+c.ws.toLocaleDateString("fr-FR",{month:"short"}):""} – ${c.we.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}`;
  const contacts=Object.values(S.contacts).sort((a,b)=>(b.usedAt||b.createdAt||0)-(a.usedAt||a.createdAt||0));
  const act=(a,ic,l,attr)=>`<button ${attr||`data-act="${a}"`}><span class="sq">${ic}</span>${l}</button>`;
  return `
  <div class="top-lime">
    <header class="hhdr">
      ${avatarBtn("on-lime")}
      <div class="who"><b>${name?"Bonjour "+esc(name):"Bonjour"}</b><span>${esc((user&&user.email)||"Mon compte")}</span></div>
      <button class="sq-btn" data-tab="envies" aria-label="Série : ${c.streak} jour${c.streak>1?"s":""} sans achat plaisir">${I.trophy}${c.streak?`<i class="badge ok">${c.streak}</i>`:""}</button>
      ${bellBtn(c)}
    </header>
    <div class="bal">
      <div class="bal-top"><span>Reste cette semaine · ${range}</span><button class="dots" data-act="toggleweek" aria-label="Détail de la semaine">${I.dots}</button></div>
      <div class="bal-amt num ${left<0?"neg":""}">${left<0?"−":""}${money(Math.abs(left))}</div>
      <div class="bal-meta"><span class="pill-dk">${I.up}${fm0(Math.max(0,c.leftToday))} max aujourd'hui</span><span>sur ${fm0(c.weekBudget)} prévus</span></div>
      <div class="acts">${act("expense",I.up,"Dépense")}${act("receive",I.down,"Recevoir")}${act("deposit",I.piggy,"Épargner")}${act("",I.bag,"Envie",'data-act="wish"')}</div>
    </div>
    <div class="week-more" id="weekMore" ${weekOpen?"":"hidden"}>
      <div class="wbar"><i class="${left<0?"over":""}" style="width:${left<0?100:wpct}%"></i></div>
      <div class="week" aria-label="Dépenses par jour cette semaine">
        ${c.week.map(d=>`<div class="wd ${d.inMonth?"":"out"} ${d.today?"today":""}" title="${d.n} : ${fm(d.spent)}"><div class="col"><i class="${d.spent>c.dailyTarget*1.0001&&d.inMonth?"over":""}" style="height:${Math.min(100,d.spent/maxCol*100)}%"></i></div><span class="l">${d.letter}</span></div>`).join("")}
      </div>
      <div class="hero-foot">
        <div><div class="k">Dépensé cette semaine</div><div class="v num">${fm0(c.spentWeek)}</div></div>
        <div><div class="k">Reste ce mois-ci</div><div class="v num">${c.remaining<0?"−":""}${fm0(Math.abs(c.remaining))}</div></div>
      </div>
    </div>
    <div class="coach">${I.spark}<span>${esc(coachLine(c))}</span></div>
    <button class="notch" data-act="toggleweek" aria-expanded="${weekOpen}" aria-controls="weekMore" aria-label="${weekOpen?"Masquer":"Afficher"} le détail de la semaine">${I.chevD}</button>
  </div>
  ${prevCard(c)}
  <section>
    ${secHead("Expéditeurs favoris",`<button class="pill" data-act="receive">Recevoir ${I.chevR}</button>`)}
    <div class="chips"><button class="add-chip" data-act="newcontact" aria-label="Ajouter un expéditeur">${I.plus}</button>
      ${contacts.length?contacts.map(x=>contactChip(x)).join(""):`<p class="chips-hint">Ajoute un proche qui t'envoie de l'argent depuis l'Afrique.</p>`}</div>
  </section>
  <section>
    ${secHead("Transactions",`<button class="pill" data-tab="budget">Voir tout ${I.chevR}</button>`)}
    ${feedHtml(6)}
  </section>`;
}
function prevCard(c){
  if(!c.prevPending) return "";
  const pm=monthName(c.prevMk);
  if(c.prevDiff>0) return `<div class="card hl-warn">
    <div class="eyebrow" style="color:var(--warn)">Bilan de ${pm}</div>
    <h2 style="margin-top:6px">Tu as dépassé de <span class="num">${fm0(c.prevDiff)}</span>.</h2>
    <p class="small muted" style="margin-top:6px">${fm0(c.prevSpent)} dépensés pour ${fm0(c.prevAvail)} prévus. Choisis comment le récupérer : le montant sera retiré de tes prochains budgets.</p>
    <div class="row" style="margin-top:14px"><button class="btn pri" data-catchup="${c.prevDiff}" data-from="${c.prevMk}">Rattraper</button><button class="btn ghost" data-skip-prev="${c.prevMk}">Ne pas rattraper</button></div></div>`;
  return `<div class="card hl-ok">
    <div class="eyebrow" style="color:var(--lime)">Bilan de ${pm}</div>
    <h2 style="margin-top:6px">Il te reste <span class="num">${fm0(-c.prevDiff)}</span> du mois dernier.</h2>
    <p class="small muted" style="margin-top:6px">Bien joué. Mets-les de côté pour qu'ils ne repartent pas en dépenses.</p>
    <div class="row" style="margin-top:14px"><button class="btn pri" data-surplus="${-c.prevDiff}" data-from="${c.prevMk}">Mettre de côté</button><button class="btn ghost" data-skip-prev="${c.prevMk}">Plus tard</button></div></div>`;
}
const contactChip=(x,sel)=>`<button class="cchip" data-contact="${x.id}" ${sel!==undefined?`aria-pressed="${sel}"`:""}><span class="av">${esc(initials(x.name))}</span><span class="cn"><b>${esc(first(x.name))}</b><span>${x.country} ${maskPhone(x.phone)}</span></span></button>`;
const dayLabel=d=>d===todayIso()?"Aujourd'hui":d===iso(new Date(Date.now()-864e5))?"Hier":dfmt(d,{weekday:"long",day:"numeric",month:"long"});
function feedHtml(limit){
  const items=[...Object.values(S.tx).map(t=>({k:"tx",date:t.date,ts:t.createdAt||0,t})),
    ...Object.values(S.transfers).map(t=>({k:"tr",date:iso(new Date(t.createdAt)),ts:t.createdAt,t:trView(t)}))]
    .sort((a,b)=>b.date.localeCompare(a.date)||b.ts-a.ts).slice(0,limit);
  if(!items.length) return `<div class="empty">Aucune transaction pour l'instant. Note ta première dépense ou crée une demande de réception.</div>`;
  let last="",h="";
  items.forEach(it=>{const l=dayLabel(it.date); if(l!==last){last=l;h+=`<div class="day-h">${l}</div>`;} h+=it.k==="tx"?txRow(it.t):trRow(it.t);});
  return `<div class="list">${h}</div>`;
}
function budRow(k){
  const sp=k.sp, b=+k.budget||0, p=b?sp/b:0, kc=col(k.color);
  const chip=!b?`<span class="chip need">Sans budget</span>`:p>1?`<span class="chip d">Dépassé de ${fm0(sp-b)}</span>`:p>=.8?`<span class="chip w">Reste ${fm0(b-sp)}</span>`:`<span class="chip ok">Reste ${fm0(b-sp)}</span>`;
  const bc=p>1?"var(--danger)":p>=.8?"var(--warn)":kc;
  return `<div class="bud-row"><div class="n"><span class="dot" style="background:${kc}"></span>${esc(k.name)} ${chip}</div>
    <div class="a num"><b>${fm0(sp)}</b> <span class="muted">/ ${b?fm0(b):"—"}</span></div>
    <div class="bar"><i style="width:${Math.min(100,p*100)}%;background:${bc}"></i></div></div>`;
}
function txRow(t){
  const k=catOf(t.cat), kc=col(k.color);
  const tm=t.createdAt&&iso(new Date(t.createdAt))===t.date?timeOf(t.createdAt):dfmt(t.date,{day:"numeric",month:"short"});
  return `<button class="tx" data-edit-tx="${t.id}"><span class="ic" style="color:${kc}">${I.up}</span>
    <span class="t"><b>${esc(t.note||k.name)}</b><span>${esc(k.name)}${t.kind==="envie"?' · <em class="want">Envie</em>':""}</span></span>
    <span class="r"><span class="amt neg num">−${fm(t.amount)}</span><span class="tm">${tm}</span></span></button>`;
}
function trRow(t){
  const st=STATUS[t.status]||STATUS.created, ok=t.status==="credited", dead=t.status==="cancelled"||t.status==="expired";
  return `<button class="tx" data-tr="${t.id}"><span class="ic">${I.down}</span>
    <span class="t"><b>${ok?"Reçu de":"Demande à"} ${esc(t.senderName)}</b><span>${esc(t.ref)} · ${esc(country(t.country).name)}</span></span>
    <span class="r"><span class="amt ${ok?"pos":dead?"dead":"pend"} num">+${fm(t.amountEur)}</span>${ok?`<span class="tm">${timeOf(t.statusAt||t.createdAt)}</span>`:`<span class="chip ${st[1]}">${st[0]}</span>`}</span></button>`;
}

/* ---------- budget ---------- */
function paceChart(c){
  const W=640,Hh=190,L=48,R=14,T=12,B=24,pw=W-L-R,ph=Hh-T-B;
  const daily=new Array(c.dim+1).fill(0); c.mtx.forEach(t=>{const d=+t.date.slice(8,10); if(d<=c.day) daily[d]+=t.amount;});
  let cum=0; const pts=[[0,0]]; for(let d=1;d<=c.day;d++){cum+=daily[d];pts.push([d,cum]);}
  const max=Math.max(c.avail,cum,1)*1.05;
  const nice=n=>{const p=Math.pow(10,Math.floor(Math.log10(n)));const f=n/p;return (f<=1?1:f<=2?2:f<=5?5:10)*p;};
  const step=nice(max/4), top=Math.ceil(max/step)*step;
  const x=d=>L+d/c.dim*pw, y=v=>T+ph-v/top*ph;
  let g=""; for(let v=0;v<=top+1e-9;v+=step) g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${eur0.format(v)}</text>`;
  const ticks=[1,10,20,c.dim].map(d=>`<text x="${x(d)}" y="${Hh-5}" text-anchor="middle">${d}</text>`).join("");
  const line=pts.map((p,i)=>(i?"L":"M")+x(p[0]).toFixed(1)+" "+y(p[1]).toFixed(1)).join(" ");
  const lp=pts[pts.length-1];
  return `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Dépenses cumulées du mois et rythme idéal">${g}
    ${c.avail?`<line x1="${x(0)}" y1="${y(0)}" x2="${x(c.dim)}" y2="${y(c.avail)}" stroke="var(--muted)" stroke-dasharray="5 5" stroke-width="1.5"/>`:""}
    <path d="${line} L${x(lp[0]).toFixed(1)} ${y(0)} L${x(0)} ${y(0)} Z" fill="var(--lime)" fill-opacity=".14"/>
    <path d="${line}" fill="none" stroke="var(--lime)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(lp[0])}" cy="${y(lp[1])}" r="5" fill="var(--lime)" stroke="var(--surface)" stroke-width="2"/>${ticks}</svg>`;
}
function vSpend(c){
  const P=c.P, cats=(P.categories||[]).map(k=>({...k,sp:c.byCat[k.id]||0}));
  const tot=cats.reduce((a,k)=>a+(+k.budget||0),0);
  const wp=c.spent?c.wants/c.spent*100:0;
  const projOver=c.projection-c.avail, mp=c.avail?Math.min(100,c.spent/c.avail*100):0;
  let all=Object.values(S.tx); if(txFilter!=="all") all=all.filter(t=>t.kind===txFilter);
  const months=[...new Set(all.map(t=>t.date.slice(0,7)))].sort().reverse();
  const shown=months.slice(0,histLimit);
  return `${pageHead("Budget",c)}
  <div class="sum-card">
    <div class="eyebrow">${monthName(c.mk,{month:"long",year:"numeric"})} · jour ${c.day} sur ${c.dim}</div>
    <div class="sum-amt num ${c.remaining<0?"neg":""}">${c.remaining<0?"−":""}${money(Math.abs(c.remaining))}</div>
    <div class="small" style="font-weight:600">reste sur ${fm0(c.avail)} prévus ce mois-ci</div>
    <div class="bar dk"><i style="width:${c.remaining<0?100:mp}%"></i></div>
    <div class="stats3">
      <div><div class="s">Dépensé</div><div class="v num">${fm0(c.spent)}</div></div>
      <div><div class="s">Par semaine</div><div class="v num">${fm0(c.weeklyNormal)}</div></div>
      <div><div class="s">Fin de mois</div><div class="v num ${projOver>0?"over":""}">${projOver>0?"+":"−"}${fm0(Math.abs(projOver))}</div></div>
    </div>
    <p class="small" style="margin-top:10px">${projOver>0?`À ce rythme, tu finis le mois ${fm0(projOver)} au-dessus de ton budget. Le dépassement sera à rattraper le mois prochain.`:`À ce rythme, il te restera ${fm0(-projOver)} en fin de mois.`}</p>
    ${c.catchup>0?`<p class="small" style="margin-top:6px">Ton budget inclut <b class="num">${fm0(c.catchup)}</b> de rattrapage ce mois-ci (${fm0(c.base)} sans rattrapage).</p>`:""}
  </div>
  ${c.activeCatchups.length?`<div class="card"><div class="card-head"><h2>Rattrapage en cours</h2><button class="link" data-tab="profil">Gérer</button></div>
    <div class="bud">${c.activeCatchups.map(x=>`<div class="bud-row"><div class="n">${x.from.startsWith("manuel")?"Montant ajouté":"Dépassement de "+monthName(x.from)} <span class="chip w num">−${fm0(x.per)}/mois</span></div>
      <div class="a num"><b>${x.doneMonths}</b> <span class="muted">/ ${x.months} mois</span></div>
      <div class="bar"><i style="width:${(x.doneMonths+(x.started?1:0))/x.months*100}%;background:var(--warn)"></i></div>
      <div class="small muted" style="grid-column:1/-1">${fm0(x.amount)} à récupérer, ${x.started?"en cours":"à partir de "+monthName(x.start)}, terminé fin ${monthName(x.end,{month:"long",year:"numeric"})}.</div></div>`).join("")}</div></div>`:""}
  <div class="card">
    <div class="card-head"><h2>Budgets par catégorie</h2><span class="small muted num">${fm0(c.spent)} / ${fm0(c.avail)}</span></div>
    ${tot>c.avail+1?`<div class="alert w" style="margin-bottom:14px">${I.alert}<span>La somme de tes budgets (${fm0(tot)}) dépasse ton disponible de ${fm0(tot-c.avail)}. Baisse une catégorie dans ton profil.</span></div>`:""}
    <div class="bud">${cats.map(budRow).join("")}</div>
  </div>
  <div class="card chart">
    <div class="card-head"><h2>Rythme du mois</h2><span class="small muted">pointillés = rythme idéal</span></div>
    ${paceChart(c)}
  </div>
  <div class="card">
    <div class="card-head"><h2>Besoins ou envies</h2><span class="chip ${wp>35?"w":"ok"}">${Math.round(wp)} % d'envies</span></div>
    <div style="display:flex;height:12px;border-radius:99px;overflow:hidden;background:var(--surface-3)"><i style="width:${100-wp}%;background:var(--lime)"></i><i style="width:${wp}%;background:var(--want)"></i></div>
    <div class="row small" style="margin-top:10px;gap:16px"><span><span class="dot" style="background:var(--lime);margin-right:6px"></span>Besoins ${fm0(c.spent-c.wants)}</span><span><span class="dot" style="background:var(--want);margin-right:6px"></span>Envies ${fm0(c.wants)}</span></div>
    <p class="small muted" style="margin-top:8px">Garde les envies sous 30 % de tes dépenses du mois.</p>
  </div>
  <div class="row" style="justify-content:space-between;margin-top:4px"><h2 class="sec-title">Historique</h2>
    <div class="filters">${[["all","Tout"],["besoin","Besoins"],["envie","Envies"]].map(([k,l])=>`<button data-filter="${k}" aria-pressed="${txFilter===k}">${l}</button>`).join("")}</div></div>
  ${shown.length?shown.map(m=>{
    const list=all.filter(t=>t.date.slice(0,7)===m).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||0)-(a.createdAt||0));
    let last="",html=""; list.forEach(t=>{if(t.date!==last){last=t.date;html+=`<div class="day-h">${dfmt(t.date,{weekday:"long",day:"numeric",month:"long"})}</div>`;}html+=txRow(t);});
    return `<div class="card"><div class="card-head" style="margin-bottom:0"><h2 style="text-transform:capitalize">${dfmt(m+"-15",{month:"long",year:"numeric"})}</h2><span class="num" style="font-weight:800">${fm(sum(list))}</span></div><div class="list">${html}</div></div>`;
  }).join(""):`<div class="card"><div class="empty">Aucune dépense ici.</div></div>`}
  ${months.length>histLimit?`<button class="btn ghost block" data-act="more">Afficher les mois précédents</button>`:""}`;
}

/* ---------- épargne ---------- */
function vTreso(c){
  const save=+c.P.save||0, pctMonth=save?Math.min(100,Math.max(0,c.savedThisMonth/save*100)):0;
  let alert="";
  if(c.needMonthly>save+1) alert=`<div class="alert w">${I.alert}<span>Tes projets demandent <b>${fm0(c.needMonthly)}</b> par mois, mais tu prévois d'épargner ${fm0(save)}. Repousse une échéance ou augmente ton épargne dans ton profil.</span></div>`;
  else if(c.needMonthly>0) alert=`<div class="alert ok">${I.check}<span>Tes projets demandent ${fm0(c.needMonthly)} par mois. Ton épargne prévue (${fm0(save)}) suffit.</span></div>`;
  const tile=(a,ic,l)=>`<button class="tile" data-act="${a}"><span class="sq">${ic}</span>${l}</button>`;
  return `${pageHead("Épargne",c)}
  <div class="vstack">
    <div class="vcard">
      <div class="vc-top"><div><div class="vc-name">Ma trésorerie</div><div class="vc-sub">${c.pots.length} projet${c.pots.length>1?"s":""} d'épargne</div></div><span class="vc-brand">CAURIPAY</span></div>
      <div class="vc-amt num">${money(c.totalSaved)}</div>
      <div class="vc-foot"><div><small>Versé ce mois-ci</small><b class="num">${fm0(c.savedThisMonth)} / ${fm0(save)}</b></div><div style="text-align:right"><small>Objectif du mois</small><b class="num">${Math.round(pctMonth)} %</b></div></div>
      <div class="vc-bar"><i style="width:${pctMonth}%"></i></div>
      <span class="vc-wm" aria-hidden="true">cauripay</span>
    </div>
  </div>
  <h2 class="sec-title">Actions rapides</h2>
  <div class="grid4">${tile("deposit",I.plus,"Mettre de côté")}${tile("withdraw",I.up,"Retirer")}${tile("newpot",I.folder,"Nouveau projet")}${tile("receive",I.down,"Recevoir")}</div>
  ${alert}
  <div class="pots">${c.pots.map(p=>{const pc=col(p.color); return `
    <div class="pot">
      <div class="pot-top"><div style="min-width:0"><div class="row" style="gap:8px"><span class="dot" style="background:${pc}"></span><h3>${esc(p.name)}</h3></div>
        <div class="small muted" style="margin-top:3px">${p.deadline?`Pour ${dfmt(p.deadline+"-15",{month:"long",year:"numeric"})}`:"Sans date"}</div></div>
        ${p.done?`<span class="chip ok">Atteint</span>`:p.monthsLeft?`<span class="chip need">${p.monthsLeft} mois</span>`:""}</div>
      <div><span class="pot-bal num">${fm0(p.balance)}</span>${p.target?` <span class="muted num">/ ${fm0(p.target)}</span>`:""}</div>
      ${p.target?`<div class="bar"><i style="width:${p.pct*100}%;background:${pc}"></i></div>`:""}
      ${p.perMonth?`<div class="pot-need">Pour y arriver : <b class="num">${fm0(p.perMonth)}/mois</b> · soit <b class="num">${fm0(p.perWeek)}/semaine</b></div>`:p.done?"":p.target?`<div class="pot-need">Ajoute une date pour savoir combien verser chaque mois.</div>`:""}
      <div class="row"><button class="btn sm pri" data-pot-in="${p.id}">Ajouter</button><button class="btn sm" data-pot-out="${p.id}">Retirer</button><button class="btn sm ghost" data-pot-open="${p.id}">Détails</button></div>
    </div>`;}).join("")||`<div class="card empty">Aucun projet. Crée-en un pour un voyage, un achat important ou un coussin de sécurité.</div>`}
  </div>
  <div class="card">
    <div class="card-head"><h2>Si tu tiens le rythme</h2></div>
    <div class="stats3">${[3,6,12].map(n=>`<div><div class="s">Dans ${n} mois</div><div class="v num">${fm0(c.totalSaved+save*n)}</div></div>`).join("")}</div>
    <p class="small muted" style="margin-top:10px">En versant ${fm0(save)} chaque mois, le jour de ta paie, avant de dépenser quoi que ce soit.</p>
  </div>
  <button class="lime-big" data-act="newpot">${I.plus} Nouveau projet</button>`;
}

/* ---------- envies ---------- */
function vWishes(c){
  const now=Date.now();
  const w=c.wishes.filter(x=>x.status==="wait").sort((a,b)=>a.created-b.created);
  const done=c.wishes.filter(x=>x.status!=="wait").sort((a,b)=>(b.decided||0)-(a.decided||0)).slice(0,12);
  return `${pageHead("Envies",c)}
  <div class="streak"><span class="sq">${I.trophy}</span><div><div class="eyebrow">Série en cours</div><div class="streak-n">${c.streak} jour${c.streak>1?"s":""} sans achat plaisir</div>
    <p class="small">${c.streak>=7?"Belle série. Ne la casse pas pour un truc que tu auras oublié demain.":"Objectif : 7 jours d'affilée."}</p></div></div>
  <div class="card">
    <div class="card-head"><h2>La règle des 48 heures</h2><span class="chip ok num">${fm0(c.skipped)} économisés</span></div>
    <p class="small muted">Un achat pas prévu te fait envie ? Note-le et attends 48 heures. Si tu y tiens toujours, tu décides. Sinon, l'argent reste à toi.</p>
    <form id="wishForm" class="wish-form">
      <input class="in" id="wishName" placeholder="Ce qui te fait envie" maxlength="60" aria-label="Ce qui te fait envie">
      <input class="in num" id="wishPrice" placeholder="Prix" inputmode="decimal" aria-label="Prix">
      <button class="btn pri" type="submit">Attendre</button>
    </form>
    <div class="err" id="wishErr" style="margin-top:6px"></div>
    <div class="list">${w.length?w.map(x=>{const el=now-x.created, ready=el>=H48, h=Math.ceil((H48-el)/3600e3);
      const share=c.leftWeek>0?x.price/c.leftWeek:null;
      return `<div class="wish"><div style="min-width:0"><b>${esc(x.name)}</b> <span class="num muted">· ${fm(x.price)}</span>
        <div class="timer"><span class="tbar"><i style="width:${Math.min(100,el/H48*100)}%"></i></span>${ready?"Attente terminée":`encore ${h} h`}</div>
        ${share!==null?`<div class="small muted" style="margin-top:4px">${share>=1?`C'est plus que tout ce qu'il te reste cette semaine (${fm0(c.leftWeek)}).`:`Soit ${Math.round(share*100)} % de ce qu'il te reste cette semaine.`}</div>`:""}</div><div></div>
        <div class="row"><button class="btn sm pri" data-wish="${x.id}" data-to="skipped">Je n'en ai plus envie</button>
        <button class="btn sm ghost" data-wish="${x.id}" data-to="bought" ${ready?"":"disabled"}>${ready?"Je l'achète":"Achat possible dans "+h+" h"}</button></div></div>`;}).join(""):`<div class="empty">Rien en attente.</div>`}</div>
  </div>
  ${done.length?`<div class="card"><div class="card-head"><h2>Tes décisions</h2></div><div class="list">${done.map(x=>`<div class="wish"><div><b>${esc(x.name)}</b> <span class="num muted">· ${fm(x.price)}</span></div><span class="chip ${x.status==="skipped"?"ok":"want"}">${x.status==="skipped"?"Pas acheté":"Acheté"}</span></div>`).join("")}</div></div>`:""}`;
}

/* ---------- recevoir d'Afrique ---------- */
function quote(){
  const ct=rx.contact&&S.contacts[rx.contact], co=country(ct?ct.country:rx.country), rate=CUR[co.cur].rate;
  const n=parseAmt(rx.str)||0; let eurAmt,fee,local;
  if(rx.cur==="EUR"){eurAmt=r2(n); fee=feeFor(eurAmt); local=eurAmt>0?Math.ceil(r2(eurAmt+fee)*rate):0;}
  else{
    // l'expéditeur paie un montant en monnaie locale : on en déduit ce que tu reçois, frais retirés
    local=Math.round(n); const tot=local/rate, pct=CFG.transferFeePct||0, min=CFG.transferFeeMin||0;
    let e=tot/(1+pct); if(e*pct<min) e=tot-min;
    eurAmt=Math.max(0,Math.floor(e*100+1e-6)/100); fee=eurAmt>0?r2(tot-eurAmt):0;
  }
  return {co,ct,rate,eur:eurAmt,fee,local,who:ct?first(ct.name):"L'expéditeur"};
}
function typed(s,dec){
  if(!s) return dec?`0<span class="ghost">,00</span>`:"0";
  const [a,b]=s.split(","), A=nf0.format(+a||0);
  if(!dec) return A;
  return b===undefined?`${A}<span class="ghost">,00</span>`:`${A},${b}<span class="ghost">${"0".repeat(Math.max(0,2-b.length))}</span>`;
}
function rxUpdate(){
  const el=$("#rxAmt"); if(!el) return;
  const q=quote(), lab=CUR[q.co.cur].label, max=CFG.transferMax||1000, p=Math.min(1,q.eur/max), over=q.eur>max;
  el.innerHTML=rx.cur==="EUR"?`${typed(rx.str,2)} €`:`${typed(rx.str,0)} ${lab}`;
  const rate=`1 € = ${nf5.format(q.rate)} ${lab}, parité fixe`;
  $("#rxConv").innerHTML=q.eur>0
    ?(rx.cur==="EUR"?`${esc(q.who)} paie <b>${fmLocal(q.local,q.co.cur)}</b>`:`Tu reçois <b>${fm(q.eur)}</b>`)+` · frais ${fm(q.fee)}<br><span class="muted">${rate}</span>`
    :`<span class="muted">${rate}</span>`;
  $("#rxLim").innerHTML=`<div class="lim-head"><span>Plafond par demande</span><span class="num">${fm0(max)}</span></div>
    <div class="slider ${over?"over":""}"><i style="width:${p*100}%"></i><b style="left:${p*100}%"></b></div>
    ${over?`<div class="err">Le plafond est de ${fm0(max)} par demande.</div>`:""}`;
}
function rxKey(k){
  let s=rx.str; const dec=rx.cur==="EUR"?2:0;
  if(k==="del") s=s.slice(0,-1);
  else if(k===","){ if(dec&&!s.includes(",")) s=(s||"0")+","; }
  else{
    const [a,b]=s.split(",");
    if(b!==undefined){ if(b.length>=dec) return; }
    else if(a.length>=(dec?5:9)) return;
    s=(s==="0"?"":s)+k;
  }
  rx.str=s; rxUpdate();
}
function vTransfer(c){
  const trs=c.transfers.slice().sort((a,b)=>b.createdAt-a.createdAt);
  const open=trs.filter(t=>["created","paid","checking"].includes(t.status)).length;
  const head=subHead("Recevoir d'Afrique",`<button class="sq-btn dark" data-act="txinfo" aria-label="Comment ça marche">${I.help}</button>`);
  const seg=`<div class="seg" role="group" aria-label="Affichage"><button data-rxtab="new" aria-pressed="${rx.tab==="new"}">Nouvelle demande</button><button data-rxtab="track" aria-pressed="${rx.tab==="track"}">Suivi${open?` (${open})`:""}</button></div>`;
  const demo=DEMO?`<div class="demo-flag">${I.alert}<span><b>Démonstration.</b> Aucun argent réel ne circule : le paiement de l'expéditeur est simulé.</span></div>`:"";
  if(rx.tab==="track") return head+seg+demo+(trs.length?`<div class="card"><div class="list">${trs.map(trRow).join("")}</div></div>`
    :`<div class="card empty">Aucune demande pour l'instant. Crée ta première demande dans « Nouvelle demande ».</div>`);
  const ct=rx.contact&&S.contacts[rx.contact], co=country(ct?ct.country:rx.country);
  const contacts=Object.values(S.contacts).sort((a,b)=>(b.usedAt||b.createdAt||0)-(a.usedAt||a.createdAt||0));
  const lab=CUR[co.cur].label;
  return `${head}${seg}${demo}
  <div class="from-card">
    <div class="fc-head"><span>Envoyé depuis</span><button class="dots" data-act="editcontact" aria-label="${ct?"Modifier l'expéditeur":"Ajouter un expéditeur"}">${I.dots}</button></div>
    <button class="fc-body" data-act="editcontact">
      <span class="av lg">${ct?esc(initials(ct.name)):co.code}</span>
      <span class="fc-txt"><small>${ct?esc(ct.name):"Aucun expéditeur choisi"}</small><b>${ct?`${esc(co.name)} · ${esc(METHODS[ct.method]||"")}`:"Ajoute ou choisis un proche"}</b></span>
      <span class="pill-dk">${esc(lab)}</span>
    </button>
  </div>
  <div class="amt-zone">
    <div class="amt-big num" id="rxAmt" aria-live="polite"></div>
    <button class="cur-sw" data-act="swapcur">${rx.cur==="EUR"?`Saisir ce que paie l'expéditeur (${esc(lab)})`:"Saisir ce que je reçois (€)"}</button>
    <div class="conv" id="rxConv"></div>
  </div>
  <div class="limit" id="rxLim"></div>
  ${secHead("Expéditeurs",contacts.length?`<button class="pill" data-tab="profil">Gérer ${I.chevR}</button>`:"")}
  <div class="chips"><button class="add-chip" data-act="newcontact" aria-label="Ajouter un expéditeur">${I.plus}</button>
    ${contacts.length?contacts.map(x=>contactChip(x,x.id===rx.contact)).join(""):`<p class="chips-hint">Ajoute la personne qui va t'envoyer l'argent.</p>`}</div>
  <div class="keypad" role="group" aria-label="Clavier numérique">${["1","2","3","4","5","6","7","8","9",",","0","del"].map(k=>`<button data-key="${k}" ${k===","&&rx.cur!=="EUR"?"disabled":""} aria-label="${k==="del"?"Effacer":k===","?"Virgule":k}">${k==="del"?I.del:k}</button>`).join("")}</div>
  <div class="hold-zone"><button class="hold" id="holdBtn" aria-describedby="holdHint"><i aria-hidden="true"></i><span>Maintenir pour demander</span></button>
    <p class="hold-hint" id="holdHint">Garde le doigt appuyé une seconde. Au clavier : touche Entrée.</p></div>`;
}
function rxSubmit(){
  const q=quote(), c=calc();
  if(!q.ct){toast("Choisis d'abord qui t'envoie l'argent."); contactSheet(); return;}
  if(!(q.eur>0)){toast("Indique un montant."); return;}
  if(q.eur>CFG.transferMax){toast(`Le plafond est de ${fm0(CFG.transferMax)} par demande.`); return;}
  if(c.trMonth+q.eur>CFG.transferMonthlyMax){toast(`Plafond du mois atteint : ${fm0(CFG.transferMonthlyMax)} au maximum, dont ${fm0(c.trMonth)} déjà demandés.`); return;}
  if(!(S.profile.kyc&&S.profile.kyc.status==="verified")){kycSheet(()=>confirmSheet(q)); return;}
  confirmSheet(q);
}
function kycSheet(next){
  openModal(`<span class="big-ico">${I.shield}</span><h2>Vérifie ton identité</h2>
    <p class="muted">Avant de recevoir de l'argent de l'étranger, la loi impose de vérifier l'identité de chaque client, pour lutter contre le blanchiment et la fraude. Ça se fait une seule fois.</p>
    <ul class="ticks"><li>Une pièce d'identité en cours de validité</li><li>Un selfie vidéo</li><li>Un justificatif de domicile en Europe de moins de 3 mois</li></ul>
    ${DEMO?`<div class="nudge">En démonstration, la vérification est simulée : aucun document n'est demandé ni enregistré.</div>`:""}
    <div class="row"><button class="btn ghost" data-close>Plus tard</button><button class="btn pri" style="flex:1" id="kycGo">${DEMO?"Simuler la vérification":"Commencer"}</button></div>`,()=>{
    $("#kycGo").onclick=()=>{editProfile(np=>{np.kyc={status:"verified",at:Date.now(),demo:DEMO};}); closeModal(); toast(DEMO?"Identité vérifiée (démo)":"Identité vérifiée"); if(next) next();};
  });
}
const recapLine=(k,v)=>`<div><span>${k}</span><b>${v}</b></div>`;
function confirmSheet(q){
  const lab=CUR[q.co.cur].label, big=q.local>=1e6&&(q.co.cur==="XOF"||q.co.cur==="XAF");
  openModal(`<h2>Vérifie ta demande</h2>
    <div class="recap">
      ${recapLine("Tu reçois",fm(q.eur))}
      ${recapLine("Frais, payés par l'expéditeur",fm(q.fee)+(DEMO?" (exemple)":""))}
      ${recapLine("Taux de change",`1 € = ${nf5.format(q.rate)} ${lab}`)}
      ${recapLine(esc(q.who)+" paie",fmLocal(q.local,q.co.cur))}
      ${recapLine("Avec",`${esc(METHODS[q.ct.method])} · ${esc(q.co.name)}`)}
      ${recapLine("Expéditeur",`${esc(q.ct.name)} · ${esc(q.co.dial)} ${maskPhone(q.ct.phone)}`)}
      ${recapLine("Valable",`${CFG.requestValidityDays||7} jours`)}
    </div>
    <label class="f">Motif du transfert<select class="in" id="cfPurpose"><option value="">Choisir…</option>${PURPOSES.map(p=>`<option>${esc(p)}</option>`).join("")}</select></label>
    ${big?`<div class="nudge">Montant élevé : la banque ou l'opérateur de ${esc(q.who)} peut lui demander des justificatifs (contrôle des changes).</div>`
      :`<p class="small muted">Selon le pays et le montant, la banque ou l'opérateur de l'expéditeur peut demander des justificatifs (contrôle des changes).</p>`}
    <label class="chk"><input type="checkbox" id="cfOk"><span>Je connais personnellement ${esc(q.ct.name)} et cet argent a une origine légale.</span></label>
    <div class="nudge d"><b>Attention aux arnaques.</b> Ne reçois jamais d'argent pour le compte d'une personne que tu ne connais pas, même contre une commission.</div>
    <div class="err" id="cfErr"></div>
    <div class="row"><button class="btn ghost" data-close>Annuler</button><button class="btn pri" style="flex:1" id="cfGo">Créer la demande</button></div>`,()=>{
    $("#cfGo").onclick=()=>{
      const purpose=$("#cfPurpose").value;
      if(!purpose){$("#cfErr").textContent="Choisis le motif du transfert.";return;}
      if(!$("#cfOk").checked){$("#cfErr").textContent="Coche la case pour confirmer.";return;}
      const id=uid(), now=Date.now();
      write("transfers",id,{id,ref:makeRef(),contactId:q.ct.id,senderName:q.ct.name,senderPhone:q.ct.phone,country:q.co.code,currency:q.co.cur,method:q.ct.method,
        amountEur:q.eur,fee:q.fee,rate:q.rate,localAmount:q.local,purpose,relation:q.ct.relation||"",status:"created",createdAt:now,statusAt:now,history:[{s:"created",t:now}],demo:DEMO});
      write("contacts",q.ct.id,{...q.ct,usedAt:now});
      rx.str=""; closeModal(); render(); shareSheet(id);
    };
  });
}
function makeRef(){
  const A="ABCDEFGHJKMNPQRSTUVWXYZ23456789", b=new Uint8Array(8); crypto.getRandomValues(b);
  const s=[...b].map(x=>A[x%A.length]).join(""); return "CPY-"+s.slice(0,4)+"-"+s.slice(4);
}
function payerLink(t){
  const d={r:t.ref,n:first(displayName())||"Ton proche",e:t.amountEur,l:t.localAmount,c:t.currency,m:t.method,k:t.country,d:t.demo?1:0};
  return location.origin+location.pathname+"#payer="+b64e(JSON.stringify(d));
}
function shareText(t,link){
  return `Bonjour ${first(t.senderName)}, voici ma demande CauriPay de ${fm(t.amountEur)} : tu paies ${fmLocal(t.localAmount,t.currency)} avec ${METHODS[t.method]}. Référence ${t.ref}.\n${link}`
    +(t.demo?"\n(Démonstration : ne paie rien.)":"");
}
function shareSheet(id){
  const t=S.transfers[id]; if(!t) return;
  const link=payerLink(t), msg=shareText(t,link), phone=(country(t.country).dial+t.senderPhone).replace(/\D/g,"");
  openModal(`<span class="big-ico" style="align-self:center">${I.check}</span><h2 style="text-align:center">Demande créée</h2>
    <div class="ref num">${esc(t.ref)}</div>
    <p class="muted" style="text-align:center">Envoie ce lien à ${esc(first(t.senderName))} : le paiement de <b>${fmLocal(t.localAmount,t.currency)}</b> se fait avec ${esc(METHODS[t.method])}.</p>
    <div class="share">
      <a class="btn pri" href="https://wa.me/${phone}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${I.chat}WhatsApp</a>
      <a class="btn" href="sms:+${phone}?body=${encodeURIComponent(msg)}">${I.msg}SMS</a>
      <button class="btn" data-copy="${esc(link)}">${I.copy}Copier</button>
    </div>
    ${t.demo&&t.status==="created"?`<button class="btn ghost block" data-sim="${t.id}">Simuler le paiement de ${esc(first(t.senderName))}</button>`:""}
    <button class="btn ghost block" data-close>Fermer</button>`);
}
function transferSheet(id){
  const raw=S.transfers[id]; if(!raw) return;
  const t=trView(raw), hist={}; (t.history||[]).forEach(h=>hist[h.s]=h.t);
  const steps=[["created","Demande créée"],["paid","Payée par l'expéditeur"],["checking","Vérifications légales"],["credited","Argent reçu sur ton compte"]];
  const dead=t.status==="cancelled"||t.status==="expired", idx=steps.findIndex(s=>s[0]===t.status);
  openModal(`<div class="row" style="justify-content:space-between"><h2>${t.status==="credited"?"Argent reçu":"Demande"} · <span class="num">${fm(t.amountEur)}</span></h2><span class="chip ${STATUS[t.status][1]}">${STATUS[t.status][0]}</span></div>
    ${dead?`<div class="alert w">${I.alert}<span>${t.status==="expired"?"Cette demande a expiré sans être payée.":"Cette demande a été annulée."}</span></div>`
      :`<ol class="timeline">${steps.map((s,i)=>`<li class="${i<=idx?"done":i===idx+1?"cur":""}">${s[1]}${hist[s[0]]?`<small>${new Date(hist[s[0]]).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</small>`:""}</li>`).join("")}</ol>`}
    <div class="recap">
      ${recapLine("Référence",esc(t.ref))}
      ${recapLine("Expéditeur",esc(t.senderName))}
      ${recapLine("Depuis",`${esc(country(t.country).name)} · ${esc(METHODS[t.method])}`)}
      ${recapLine("Montant payé",fmLocal(t.localAmount,t.currency))}
      ${recapLine("Frais",fm(t.fee))}
      ${recapLine("Motif",esc(t.purpose||"—"))}
    </div>
    ${t.status==="created"?`<div class="row"><button class="btn ghost" data-cancel-tr="${t.id}" style="color:var(--danger)">Annuler</button><button class="btn pri" style="flex:1" data-share-tr="${t.id}">Renvoyer le lien</button></div>
      ${t.demo?`<button class="btn ghost block" data-sim="${t.id}">Simuler le paiement</button>`:""}`:""}
    ${t.status==="credited"?`<button class="btn pri block" data-tr-save="${t.id}">${I.piggy} Mettre de côté</button>`:""}
    <button class="btn ghost block" data-close>Fermer</button>`);
}
// démonstration : l'expéditeur « paie », puis les vérifications passent, puis l'argent est crédité
function advance(id,s){
  const t=S.transfers[id]; if(!t||t.status==="cancelled"||t.status==="credited") return;
  const now=Date.now(); write("transfers",id,{...t,status:s,statusAt:now,history:[...(t.history||[]),{s,t:now}]});
  if(s==="credited") toast(`${fm(t.amountEur)} reçus de ${first(t.senderName)}`);
  requestRender();
}
function simulate(id){advance(id,"paid"); setTimeout(()=>advance(id,"checking"),1600); setTimeout(()=>advance(id,"credited"),3800);}
function tickDemo(){Object.values(S.transfers).forEach(t=>{if(t.demo&&(t.status==="paid"||t.status==="checking")&&Date.now()-(t.statusAt||0)>5000) advance(t.id,"credited");});}
function contactSheet(id){
  const x=id?S.contacts[id]:null; let cc=x?x.country:rx.country, m=x?x.method:null;
  const opts=ZONES.map(([z,l])=>`<optgroup label="${esc(l)}">${COUNTRIES.filter(k=>z==="other"?k.cur!=="XOF"&&k.cur!=="XAF":k.cur===z).map(k=>`<option value="${k.code}" ${k.code===cc?"selected":""}>${esc(k.name)}</option>`).join("")}</optgroup>`).join("")
    +`<optgroup label="Bientôt (taux de change variable)">${SOON.map(n=>`<option disabled>${esc(n)}</option>`).join("")}</optgroup>`;
  openModal(`<h2>${x?"Modifier l'expéditeur":"Nouvel expéditeur"}</h2>
    <p class="small muted">La personne qui t'envoie l'argent depuis l'Afrique.</p>
    <label class="f">Nom et prénom<input class="in" id="ctName" maxlength="50" autocomplete="off" placeholder="ex. Awa Diop" value="${esc(x?.name||"")}"></label>
    <label class="f">Pays<select class="in" id="ctCountry">${opts}</select></label>
    <div><div class="eyebrow" style="margin-bottom:8px">Moyen de paiement</div><div class="cats" id="ctMethods"></div></div>
    <label class="f">Son numéro de téléphone<span class="tel"><span id="ctDial"></span><input class="in" id="ctPhone" inputmode="tel" autocomplete="off" placeholder="77 123 45 67" value="${esc(x?.phone||"")}"></span></label>
    <label class="f">Lien avec toi<select class="in" id="ctRel">${RELATIONS.map(r=>`<option ${x&&x.relation===r?"selected":""}>${esc(r)}</option>`).join("")}</select></label>
    <p class="small muted">Préviens ton proche que tu enregistres ses coordonnées : elles servent uniquement à préparer vos transferts.</p>
    <div class="err" id="ctErr"></div>
    <div class="row">${x?`<button class="btn ghost" id="ctDel" style="color:var(--danger)">Supprimer</button>`:`<button class="btn ghost" data-close>Annuler</button>`}<button class="btn pri" style="flex:1" id="ctSave">${x?"Enregistrer":"Ajouter"}</button></div>`,()=>{
    const upd=()=>{cc=$("#ctCountry").value; const co=country(cc); if(!co.methods.includes(m)) m=co.methods[0];
      $("#ctDial").textContent=co.dial; $("#ctMethods").innerHTML=co.methods.map(k=>`<button type="button" data-meth="${k}" aria-pressed="${k===m}">${esc(METHODS[k])}</button>`).join("");};
    $("#ctCountry").addEventListener("change",upd);
    $("#scrim").addEventListener("click",e=>{const b=e.target.closest("[data-meth]"); if(b){m=b.dataset.meth; upd();}});
    upd(); if(!x) setTimeout(()=>$("#ctName").focus(),60);
    $("#ctSave").onclick=()=>{
      const name=$("#ctName").value.trim().replace(/\s+/g," "), phone=$("#ctPhone").value.replace(/\D/g,"");
      if(name.length<2){$("#ctErr").textContent="Indique son nom et son prénom.";return;}
      if(phone.length<6||phone.length>12){$("#ctErr").textContent="Ce numéro de téléphone n'est pas valide.";return;}
      const nid=x?x.id:uid();
      write("contacts",nid,{...(x||{}),id:nid,name,country:cc,method:m,phone,relation:$("#ctRel").value,createdAt:x?.createdAt||Date.now()});
      rx.contact=nid; rx.country=cc; closeModal(); render(); toast(x?"Expéditeur modifié":`Expéditeur ajouté : ${first(name)}`);
    };
    if(x) $("#ctDel").onclick=()=>{closeModal(); confirmBox("Supprimer cet expéditeur ?",`${x.name} sera retiré de tes expéditeurs. Les demandes déjà créées restent dans ton suivi.`,"Supprimer",()=>{
      write("contacts",x.id,null); if(rx.contact===x.id) rx.contact=null; render(); toast("Expéditeur supprimé");});};
  });
}
function infoSheet(){
  openModal(`<h2>Recevoir de l'argent d'Afrique</h2>
    <p class="muted">Envoyer de l'argent d'Europe vers l'Afrique est simple. Dans l'autre sens, c'est souvent long et cher : contrôle des changes, justificatifs, peu de services agréés. CauriPay veut simplifier ce trajet.</p>
    <ol class="steps-list">
      <li><b>Tu crées une demande</b> : le montant, l'expéditeur et son moyen de paiement.</li>
      <li><b>Tu l'envoies</b> à ton proche par WhatsApp ou SMS.</li>
      <li><b>Ton proche paie</b> en monnaie locale, en mobile money (Wave, Orange Money, MTN…) ou par virement.</li>
      <li><b>Tu reçois des euros</b> une fois les vérifications légales passées.</li>
    </ol>
    <p class="small muted">On commence par la zone franc CFA, les Comores et le Cap-Vert : leur monnaie est liée à l'euro par un taux fixe, donc le montant est connu d'avance. Les pays à taux variable arriveront ensuite.</p>
    ${DEMO?`<div class="nudge">Version de démonstration. En réel, l'argent est encaissé et versé par un établissement de paiement agréé, partenaire de CauriPay.</div>`:""}
    <button class="btn pri block" data-close>Compris</button>`);
}

/* ---------- profil ---------- */
function vProfile(c){
  const P=c.P, name=displayName(), kyc=P.kyc&&P.kyc.status==="verified";
  const contacts=Object.values(S.contacts).sort((a,b)=>a.name.localeCompare(b.name));
  const menu=(attr,ic,l,danger)=>`<button ${attr} ${danger?'class="danger"':""}>${ic}<span>${l}</span><span class="chev">${I.chevR}</span></button>`;
  const doc=(href,l)=>`<a href="${href}" target="_blank" rel="noopener">${I.doc}<span>${l}</span><span class="chev">${I.chevR}</span></a>`;
  return `${subHead("Mon profil")}
  <div class="prof">
    <span class="avatar xl">${esc(initials(name||(user&&user.email)))}</span>
    <div style="min-width:0"><h2>${esc(name||"Mon compte")}</h2><div class="muted small">${esc((user&&user.email)||"")}</div>
      <div class="row" style="margin-top:8px"><span class="chip ${kyc?"ok":"w"}">${kyc?"Identité vérifiée"+(P.kyc.demo?" (démo)":""):"Identité non vérifiée"}</span><span class="chip need">${syncLabel()}</span></div></div>
  </div>
  <div class="card">
    <div class="card-head"><h2>Mon mois type</h2></div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <label class="f">Prénom<input class="in" data-pf-text="name" maxlength="40" value="${esc(name)}"></label>
      <label class="f">Revenus nets par mois<input class="in num" data-pf="income" inputmode="decimal" value="${P.income||""}"></label>
      <label class="f">Charges fixes par mois<input class="in num" data-pf="fixed" inputmode="decimal" value="${P.fixed||""}"></label>
      <label class="f">Épargne par mois<input class="in num" data-pf="save" inputmode="decimal" value="${P.save||""}"></label>
    </div>
    <div class="alert ok" style="margin-top:14px">${I.check}<span>Disponible pour le quotidien : <b class="num">${fm0(c.base)}</b> par mois, environ <b class="num">${fm0(c.base*12/52)}</b> par semaine.${c.catchup>0?` Ce mois-ci : <b class="num">${fm0(c.avail)}</b> après rattrapage.`:""}</span></div>
  </div>
  <div class="card">
    <div class="card-head"><h2>Rattrapages</h2></div>
    <p class="small muted">Quand un mois dépasse, le surplus est retiré des mois suivants. Ton budget de la semaine baisse d'autant, sans que tu aies à calculer.</p>
    <div class="list" style="margin-top:10px">${(P.catchups||[]).filter(x=>x.kind==="plan"&&c.mk<monthAdd(x.start,x.months)).map(x=>`<div class="row" style="justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);flex-wrap:nowrap">
      <div style="min-width:0"><b>${x.from.startsWith("manuel")?"Montant ajouté":"Dépassement de "+monthName(x.from)}</b><div class="small muted num">${fm0(x.amount)} sur ${x.months} mois · −${fm0(x.amount/x.months)}/mois · jusqu'en ${monthName(monthAdd(x.start,x.months-1))}</div></div>
      <button class="iconbtn" data-del-catchup="${x.id}" aria-label="Annuler ce rattrapage">${I.trash}</button></div>`).join("")||`<div class="small muted" style="padding:6px 0">Aucun rattrapage en cours.</div>`}</div>
    <div class="row" style="margin-top:12px"><button class="btn ghost" data-act="addcatchup">Ajouter un montant à rattraper</button></div>
  </div>
  <div class="card">
    <div class="card-head"><h2>Catégories et budgets</h2><span class="small muted num">${fm0((P.categories||[]).reduce((a,k)=>a+(+k.budget||0),0))} / ${fm0(c.avail)}</span></div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${(P.categories||[]).map(k=>`<div class="catedit"><span class="dot" style="background:${col(k.color)}"></span><input class="in" data-cat-name="${k.id}" value="${esc(k.name)}" maxlength="24" aria-label="Nom"><input class="in num" data-cat-budget="${k.id}" inputmode="decimal" value="${k.budget||""}" placeholder="€" aria-label="Budget"><button class="iconbtn" data-del-cat="${k.id}" aria-label="Supprimer ${esc(k.name)}">${I.trash}</button></div>`).join("")}
    </div>
    <div class="row" style="margin-top:12px"><button class="btn ghost" data-act="addcat">Ajouter une catégorie</button><button class="btn ghost" data-act="autobudget">Répartir automatiquement</button></div>
  </div>
  <div class="card">
    <div class="card-head"><h2>Mes expéditeurs</h2><button class="link" data-act="newcontact">Ajouter</button></div>
    <div class="list">${contacts.map(x=>`<button class="tx" data-edit-contact="${x.id}"><span class="av">${esc(initials(x.name))}</span>
      <span class="t"><b>${esc(x.name)}</b><span>${esc(country(x.country).name)} · ${esc(METHODS[x.method]||"")} · ${maskPhone(x.phone)}</span></span><span class="r">${I.edit}</span></button>`).join("")||`<div class="small muted" style="padding:6px 0">Personne pour l'instant.</div>`}</div>
  </div>
  <div class="card">
    <div class="card-head"><h2>Mes données</h2></div>
    <p class="small muted">${mode==="cloud"?"Tout est enregistré dans une base liée à ton compte Claude et te suit sur tous tes appareils.":mode==="supabase"?"Tes données sont enregistrées dans ton compte et synchronisées entre tes appareils. Une copie reste sur cet appareil pour fonctionner hors ligne.":"Mode démo : tes données sont enregistrées dans ce navigateur, sur cet appareil uniquement. Exporte une sauvegarde de temps en temps."}</p>
    <p class="small muted" style="margin-top:8px">${[["tx","dépense"],["pots","projet"],["wishes","envie"],["transfers","demande"]].map(([k,w])=>{const n=Object.keys(S[k]).length; return n+" "+w+(n>1?"s":"");}).join(" · ")}</p>
    <div class="row" style="margin-top:12px"><button class="btn ghost" data-act="export">Exporter mes données</button><button class="btn ghost" data-act="import">Importer une sauvegarde</button><button class="btn ghost" data-act="reset" style="color:var(--danger)">Tout effacer</button></div>
  </div>
  ${mode!=="cloud"?`<div class="card"><div class="card-head"><h2>Compte et sécurité</h2></div><div class="menu">
    ${mode==="supabase"?menu('data-act="chpw"',I.key,"Changer de mot de passe"):""}
    ${menu('data-act="logout"',I.logout,"Se déconnecter")}
    ${Date.now()-(P.createdAt||0)<14*864e5?menu('data-act="withdraw-contract"',I.undo,"Me rétracter du contrat (14 jours)",true):""}
    ${menu('data-act="delaccount"',I.trash,"Supprimer mon compte",true)}</div></div>`:""}
  <div class="card"><div class="card-head"><h2>Informations légales</h2></div><div class="menu">
    ${doc("legal/mentions-legales.html","Mentions légales")}${doc("legal/confidentialite.html","Politique de confidentialité")}${doc("legal/cgu.html","Conditions générales d'utilisation")}</div></div>`;
}

/* ---------- page de l'expéditeur (lien partagé) ---------- */
function vPayer(){
  let d=null; try{d=JSON.parse(b64d(location.hash.slice(7)));}catch(e){}
  const head=`<div class="auth-hero">${LOGO}<h1>CauriPay</h1></div>`;
  if(!d||!d.r||!CUR[d.c]) return `<div class="auth">${head}<div class="auth-card"><h2>Lien incomplet</h2><p class="muted">Ce lien de paiement ne fonctionne pas. Demande à ton proche de te le renvoyer.</p></div>${legalLinks()}</div>`;
  return `<div class="auth">${head}
    ${d.d?`<div class="demo-flag">${I.alert}<span><b>Démonstration.</b> Ne paie rien : ce lien ne déclenche aucun paiement réel.</span></div>`:""}
    <div class="from-card">
      <div class="fc-head"><span>Demande de ${esc(d.n)}</span><span class="pill-dk">${esc(d.r)}</span></div>
      <div class="bal-amt num" style="margin-top:12px">${fmLocal(d.l,d.c)}</div>
      <div class="small" style="font-weight:600;margin-top:6px">${esc(d.n)} reçoit ${fm(d.e)} en Europe. Les frais sont compris.</div>
    </div>
    <div class="auth-card"><h2>Comment payer</h2>
      <ol class="steps-list"><li>Ouvre ${esc(METHODS[d.m]||"ton application de paiement")}.</li><li>Paie <b>${fmLocal(d.l,d.c)}</b> en indiquant la référence <b>${esc(d.r)}</b>.</li><li>${esc(d.n)} reçoit une notification dès que l'argent arrive.</li></ol>
      <p class="small muted">En version réelle, cette page est celle du partenaire de paiement agréé, qui encaisse ton paiement.</p>
      ${d.d?`<button class="btn pri block" data-act="payersim">Payer (simulation)</button>`:""}</div>
    ${legalLinks()}</div>`;
}

/* ============ sheets ============ */
let lastFocus=null;
function openModal(html,onMount){
  if(!$("#scrim")) lastFocus=document.activeElement;
  $("#modalSlot").innerHTML=`<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true" tabindex="-1">${html}</div></div>`;
  $("#scrim").addEventListener("click",e=>{if(e.target.id==="scrim") closeModal();});
  onMount&&onMount();
  if(!$("#scrim").contains(document.activeElement)) $(".sheet").focus();
}
function closeModal(){$("#modalSlot").innerHTML=""; if(lastFocus&&document.contains(lastFocus)) try{lastFocus.focus();}catch(e){} lastFocus=null; if(dirty){dirty=false;render();}}
function toast(t){$("#toastSlot").innerHTML=`<div class="toast" role="status">${esc(t)}</div>`;clearTimeout(toast.t);toast.t=setTimeout(()=>$("#toastSlot").innerHTML="",2800);}
function confirmBox(title,text,label,fn){
  openModal(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Annuler</button><button class="btn danger" id="cfBoxOk">${esc(label)}</button></div>`,()=>{$("#cfBoxOk").onclick=()=>{closeModal();fn();};});
}
function actionsSheet(){
  const t=(a,ic,l)=>`<button class="tile2" data-act="${a}"><span class="sq">${ic}</span>${l}</button>`;
  openModal(`<h2>Que veux-tu faire ?</h2><div class="grid2">${t("expense",I.up,"Noter une dépense")}${t("receive",I.down,"Recevoir d'Afrique")}${t("deposit",I.piggy,"Mettre de côté")}${t("wish",I.bag,"Noter une envie")}</div>`);
}
function notifsSheet(){
  const list=notifs(calc());
  openModal(`<h2>Notifications</h2>${list.length?`<div class="menu">${list.map(n=>`<button ${n.a}>${n.ic}<span>${n.t}</span><span class="chev">${I.chevR}</span></button>`).join("")}</div>`:`<div class="empty">Rien de neuf pour l'instant.</div>`}
    <button class="btn ghost block" data-close>Fermer</button>`);
}

function expenseSheet(existing){
  const P=S.profile; const t=existing||{};
  let kind=t.kind||"besoin", cat=t.cat||P.categories[0]?.id;
  openModal(`<h2>${existing?"Modifier la dépense":"Nouvelle dépense"}</h2>
    <div class="amt-in"><input class="num" id="exAmt" inputmode="decimal" placeholder="0" value="${existing?String(t.amount).replace(".",","):""}" autocomplete="off" aria-label="Montant"><span>€</span></div>
    <div class="seg" role="group" aria-label="Type de dépense"><button type="button" data-kind="besoin">Besoin</button><button type="button" data-kind="envie">Envie</button></div>
    <div id="nudge" style="display:flex;flex-direction:column;gap:8px"></div>
    <div><div class="eyebrow" style="margin-bottom:8px">Catégorie</div><div class="cats">${P.categories.map(k=>`<button type="button" data-cat="${k.id}"><span class="dot" style="background:${col(k.color)}"></span>${esc(k.name)}</button>`).join("")}</div></div>
    <div class="two"><label class="f">Note<input class="in" id="exNote" maxlength="50" placeholder="ex. Lidl" value="${esc(t.note||"")}"></label>
    <label class="f">Date<input class="in" id="exDate" type="date" value="${t.date||todayIso()}"></label></div>
    <div class="err" id="exErr"></div>
    <div class="row">${existing?`<button class="btn ghost" id="exDel" style="color:var(--danger)">Supprimer</button>`:`<button class="btn ghost" data-close>Annuler</button>`}<button class="btn pri" style="flex:1" id="exSave">${existing?"Enregistrer":"Ajouter la dépense"}</button></div>`,()=>{
    const upd=()=>{
      document.querySelectorAll("[data-kind]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.kind===kind));
      document.querySelectorAll(".cats [data-cat]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.cat===cat));
      const a=parseAmt($("#exAmt").value)||0, c=calc(), k=P.categories.find(x=>x.id===cat);
      const prev=existing?existing.amount:0, delta=a-prev;
      let h="";
      if(a>0&&(!existing||($("#exDate").value||"")>=iso(c.ws))){
        const after=c.leftWeek-delta;
        h+=after<0?`<div class="nudge d"><b>Semaine dépassée</b> de ${fm0(-after)} avec cet achat.</div>`:`<div class="nudge ok">Après ça, il te restera <b>${fm0(after)}</b> pour la semaine.</div>`;
      }
      if(kind==="envie"&&a>=25&&!existing) h+=`<div class="nudge"><b>C'est une envie.</b> Tu peux la mettre en attente 48 h avant de payer. <button type="button" class="btn sm" id="toWish" style="margin-left:4px">Mettre en attente</button></div>`;
      if(k&&k.budget&&a>0){const after=(c.byCat[k.id]||0)-(existing&&existing.cat===cat?prev:0)+a; if(after>k.budget) h+=`<div class="nudge d"><b>Budget ${esc(k.name)}</b> dépassé de ${fm0(after-k.budget)}.</div>`;}
      $("#nudge").innerHTML=h;
      const tw=$("#toWish"); if(tw) tw.onclick=()=>{const id=uid(); write("wishes",id,{id,name:$("#exNote").value.trim()||(k?k.name:"Achat"),price:a,created:Date.now(),status:"wait"});closeModal();goTab("envies");toast("En attente pendant 48 h");};
    };
    $("#scrim").addEventListener("click",e=>{const b=e.target.closest("[data-kind],[data-cat]");if(!b)return;if(b.dataset.kind)kind=b.dataset.kind;if(b.dataset.cat)cat=b.dataset.cat;upd();});
    $("#exAmt").addEventListener("input",upd); upd();
    $("#exSave").onclick=()=>{const a=parseAmt($("#exAmt").value);
      if(!(a>0)){$("#exErr").textContent="Indique un montant supérieur à 0.";$("#exAmt").focus();return;}
      if(!cat){$("#exErr").textContent="Choisis une catégorie.";return;}
      const id=t.id||uid();
      write("tx",id,{id,date:$("#exDate").value||todayIso(),cat,amount:a,note:$("#exNote").value.trim(),kind,createdAt:t.createdAt||Date.now()});
      closeModal();render();toast(existing?"Dépense modifiée":"Dépense ajoutée");};
    if(existing) $("#exDel").onclick=()=>{write("tx",t.id,null);closeModal();render();toast("Dépense supprimée");};
    if(!existing) setTimeout(()=>$("#exAmt").focus(),60);
  });
}

function potMoveSheet(potId,dir,preset){
  const pots=Object.values(S.pots).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  if(!pots.length){potEditSheet();return;}
  let sel=potId||pots[0].id;
  openModal(`<h2>${dir>0?"Mettre de côté":"Retirer de l'argent"}</h2>
    <div class="amt-in"><input class="num" id="pmAmt" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="Montant" value="${preset?String(r2(preset)).replace(".",","):""}"><span>€</span></div>
    <div class="row" style="justify-content:center">${[10,20,50,100].map(a=>`<button type="button" class="btn sm" data-q="${a}">${a} €</button>`).join("")}</div>
    <div><div class="eyebrow" style="margin-bottom:8px">Projet</div><div class="cats">${pots.map(p=>`<button type="button" data-psel="${p.id}" aria-pressed="${p.id===sel}"><span class="dot" style="background:${col(p.color)}"></span>${esc(p.name)}</button>`).join("")}</div></div>
    <label class="f">Note (facultatif)<input class="in" id="pmNote" maxlength="40" placeholder="${dir>0?"ex. Virement paie":"ex. Réparation voiture"}"></label>
    <div class="err" id="pmErr"></div>
    <div class="row"><button class="btn ghost" data-close>Annuler</button><button class="btn ${dir>0?"pri":"dark"}" style="flex:1" id="pmSave">${dir>0?"Ajouter":"Retirer"}</button></div>`,()=>{
    $("#scrim").addEventListener("click",e=>{const q=e.target.closest("[data-q]"); if(q){$("#pmAmt").value=q.dataset.q;}
      const s=e.target.closest("[data-psel]"); if(s){sel=s.dataset.psel;document.querySelectorAll("[data-psel]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.psel===sel));}});
    $("#pmSave").onclick=()=>{const a=parseAmt($("#pmAmt").value), p=S.pots[sel];
      if(!(a>0)){$("#pmErr").textContent="Indique un montant supérieur à 0.";return;}
      if(dir<0&&a>p.balance){$("#pmErr").textContent=`Ce projet ne contient que ${fm(p.balance)}.`;return;}
      const moves=[...(p.moves||[]),{d:todayIso(),amt:dir*a,note:$("#pmNote").value.trim()}].slice(-200);
      write("pots",p.id,{...p,balance:r2(p.balance+dir*a),moves});
      closeModal();render();toast(dir>0?`${fm0(a)} mis de côté pour « ${p.name} »`:`${fm0(a)} retirés de « ${p.name} »`);};
    setTimeout(()=>$("#pmAmt").focus(),60);
  });
}

function potEditSheet(id){
  const p=id?S.pots[id]:null;
  const hist=p?[...(p.moves||[])].reverse().slice(0,30):[];
  openModal(`<h2>${p?esc(p.name):"Nouveau projet d'épargne"}</h2>
    <label class="f">Nom du projet<input class="in" id="peName" maxlength="40" placeholder="ex. Vacances au Portugal" value="${esc(p?.name||"")}"></label>
    <div class="two"><label class="f">Montant visé<input class="in num" id="peTarget" inputmode="decimal" placeholder="ex. 900" value="${p?.target||""}"></label>
    <label class="f">Pour quand ?<input class="in" id="peDate" type="month" value="${p?.deadline||""}"></label></div>
    ${p?"":`<label class="f">Déjà de côté<input class="in num" id="peStart" inputmode="decimal" placeholder="0"></label>`}
    <div id="peHint"></div>
    <div class="err" id="peErr"></div>
    <div class="row">${p?`<button class="btn ghost" id="peDel" style="color:var(--danger)">Supprimer</button>`:`<button class="btn ghost" data-close>Annuler</button>`}<button class="btn pri" style="flex:1" id="peSave">${p?"Enregistrer":"Créer le projet"}</button></div>
    ${p?`<div><div class="eyebrow" style="margin:6px 0 4px">Mouvements</div>${hist.length?hist.map(m=>`<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span class="small">${dfmt(m.d,{day:"numeric",month:"short",year:"numeric"})}${m.note?" · "+esc(m.note):""}</span><b class="num" style="color:${m.amt>=0?"var(--lime)":"var(--danger)"}">${m.amt>=0?"+":"−"}${fm(Math.abs(m.amt))}</b></div>`).join(""):`<div class="small muted">Aucun mouvement.</div>`}</div>`:""}`,()=>{
    const hint=()=>{const t=parseAmt($("#peTarget").value), d=$("#peDate").value, start=p?p.balance:(parseAmt($("#peStart")?.value)||0);
      if(t>0&&d){const now=new Date(), [dy,dm]=d.split("-").map(Number), ml=Math.max(1,(dy-now.getFullYear())*12+(dm-1-now.getMonth())+1), per=Math.max(0,t-start)/ml;
        $("#peHint").innerHTML=`<div class="nudge ok">Il faudra mettre <b>${fm0(per)} par mois</b> (${fm0(per*12/52)} par semaine) pendant ${ml} mois.</div>`;} else $("#peHint").innerHTML="";};
    ["#peTarget","#peDate","#peStart"].forEach(s=>{const el=$(s); if(el) el.addEventListener("input",hint);}); hint();
    $("#peSave").onclick=()=>{const n=$("#peName").value.trim(), t=parseAmt($("#peTarget").value||"0"), d=$("#peDate").value;
      if(!n){$("#peErr").textContent="Donne un nom à ton projet.";return;}
      if(isNaN(t)||t<0){$("#peErr").textContent="Le montant visé n'est pas valide.";return;}
      if(p){write("pots",p.id,{...p,name:n,target:t||0,deadline:d||""});}
      else{const s=parseAmt($("#peStart").value||"0")||0, nid=uid(), cnt=Object.keys(S.pots).length;
        write("pots",nid,{id:nid,name:n,target:t||0,deadline:d||"",balance:Math.max(0,s),moves:s>0?[{d:todayIso(),amt:s,note:"Solde de départ"}]:[],color:PALETTE[(cnt+2)%PALETTE.length],createdAt:Date.now()});}
      closeModal();goTab("epargne");toast(p?"Projet mis à jour":"Projet créé");};
    if(p) $("#peDel").onclick=()=>{closeModal();confirmBox("Supprimer ce projet ?",`« ${p.name} » et son historique seront effacés. L'argent lui-même reste sur ton compte.`,"Supprimer",()=>{write("pots",p.id,null);render();toast("Projet supprimé");});};
    if(!p) setTimeout(()=>$("#peName").focus(),60);
  });
}

function catchupSheet(amount,from){
  const c=calc(), manual=!from;
  let months=amount>c.base*0.3?2:1;
  openModal(`<h2>${manual?"Ajouter un montant à rattraper":"Rattraper "+monthName(from)}</h2>
    ${manual?`<p class="small muted">Un dépassement, un découvert ou une dépense imprévue à récupérer sur tes prochains budgets.</p>
      <div class="amt-in"><input class="num" id="cuAmt" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="Montant"><span>€</span></div>`
      :`<p class="muted">Dépassement : <b class="num" style="color:var(--ink)">${fm0(amount)}</b>. Sur combien de mois veux-tu le récupérer ?</p>`}
    <div class="seg" role="group" aria-label="Durée">${[1,2,3].map(n=>`<button type="button" data-months="${n}">${n} mois</button>`).join("")}</div>
    <div id="cuHint"></div>
    ${manual?`<label class="f">À partir de<select class="in" id="cuStart"><option value="${c.mk}">${monthName(c.mk,{month:"long",year:"numeric"})} (ce mois-ci)</option><option value="${monthAdd(c.mk,1)}">${monthName(monthAdd(c.mk,1),{month:"long",year:"numeric"})}</option></select></label>`:""}
    <div class="err" id="cuErr"></div>
    <div class="row"><button class="btn ghost" data-close>Annuler</button><button class="btn pri" style="flex:1" id="cuSave">Valider le rattrapage</button></div>`,()=>{
    const amt=()=>manual?(parseAmt($("#cuAmt").value)||0):amount;
    const upd=()=>{document.querySelectorAll("[data-months]").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.months===months));
      const a=amt(), per=a/months, newAvail=Math.max(0,c.base-c.catchup-per);
      $("#cuHint").innerHTML=a>0?`<div class="nudge ${per>c.base*0.35?"d":"ok"}">${per>c.base*0.35?"<b>Ça va être serré.</b> ":""}<b>−${fm0(per)} par mois</b> pendant ${months} mois. Ton budget passera à environ <b>${fm0(newAvail)}</b> par mois, soit <b>${fm0(newAvail*12/52)}</b> par semaine.</div>`:"";};
    $("#scrim").addEventListener("click",e=>{const b=e.target.closest("[data-months]"); if(b){months=+b.dataset.months;upd();}});
    if(manual){$("#cuAmt").addEventListener("input",upd); setTimeout(()=>$("#cuAmt").focus(),60);}
    upd();
    $("#cuSave").onclick=()=>{const a=r2(amt()); if(!(a>0)){$("#cuErr").textContent="Indique un montant supérieur à 0.";return;}
      const start=manual?$("#cuStart").value:c.mk;
      editProfile(np=>{np.catchups=[...(np.catchups||[]),{id:uid(),from:from||("manuel-"+todayIso()),amount:a,months,start,kind:"plan"}];});
      closeModal();render();toast(`Rattrapage prévu : −${fm0(a/months)} par mois`);};
  });
}

/* ============ sauvegarde (export / import) ============ */
function exportData(){
  const payload={app:"cauripay",version:3,exportedAt:new Date().toISOString(),data:S};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download="cauripay-sauvegarde-"+todayIso()+".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  toast("Sauvegarde téléchargée");
}
function importData(){
  const inp=document.createElement("input"); inp.type="file"; inp.accept="application/json,.json";
  inp.onchange=()=>{const f=inp.files&&inp.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{
      let d; try{const p=JSON.parse(rd.result); d=p&&(p.app==="cauripay"||p.app==="tirelire")?p.data:migrateV1(p);}catch(e){d=null;}
      if(!d||!d.profile||typeof d.tx!=="object"){toast("Ce fichier n'est pas une sauvegarde CauriPay.");return;}
      d=normalize(d);
      const n=Object.keys(d.tx).length;
      const go=()=>{
        for(const k of KINDS) for(const id of Object.keys(S[k])) if(!d[k][id]) write(k,id,null);
        for(const k of KINDS) for(const [id,doc] of Object.entries(d[k])) write(k,id,doc);
        write("profile","profile",d.profile);
        phase="app"; tab="accueil"; render(); toast(n+" dépenses importées");
      };
      if(S.profile) confirmBox("Remplacer tes données ?",`Tes données actuelles seront remplacées par la sauvegarde (${n} dépenses).`,"Importer",go); else go();
    };
    rd.readAsText(f);
  };
  inp.click();
}

/* ============ compte ============ */
function editProfile(fn){const P=S.profile; const np={...P,categories:P.categories.map(c=>({...c}))}; fn(np); write("profile","profile",np);}
async function logout(){
  if(pushT) await pushNow();
  try{await Auth.signOut();}catch(e){}
  if(Auth.live) try{localStorage.removeItem(cacheKey());}catch(e){}
  user=null; S=emptyState(); mode="pending"; phase="auth"; authView="login"; authErr=""; authMsg=""; tab="accueil"; rx.contact=null;
  render(); toast("Déconnexion réussie");
}
function deleteAccountFlow(title,text,label,done){
  confirmBox(title,text,label,async()=>{
    try{await Auth.deleteAccount();}catch(er){toast(er.message);return;}
    try{localStorage.removeItem(cacheKey());}catch(_){}
    clearTimeout(pushT); pushT=null;
    user=null; S=emptyState(); mode="pending"; phase="auth"; authView="signup"; tab="accueil"; navStack=[]; render(); toast(done);
  });
}
function copyText(s){
  const done=()=>toast("Lien copié");
  if(navigator.clipboard&&window.isSecureContext) navigator.clipboard.writeText(s).then(done,()=>fallback());
  else fallback();
  function fallback(){const ta=document.createElement("textarea"); ta.value=s; ta.setAttribute("readonly",""); ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.select(); try{document.execCommand("copy"); done();}catch(e){toast("Copie impossible : sélectionne le lien à la main.");} ta.remove();}
}

/* ============ events ============ */
// bouton « Maintenir pour demander » : appui long d'une seconde
let holdT=null, holdStart=0;
document.addEventListener("pointerdown",e=>{const b=e.target.closest("#holdBtn"); if(!b||e.button>0) return;
  b.classList.add("holding"); holdStart=Date.now();
  holdT=setTimeout(()=>{holdT=null; b.classList.remove("holding"); if(navigator.vibrate) navigator.vibrate(25); rxSubmit();},950);});
function holdEnd(){ if(!holdT) return; clearTimeout(holdT); holdT=null; const b=$("#holdBtn"); if(b) b.classList.remove("holding");
  if(Date.now()-holdStart<600) toast("Garde le doigt appuyé une seconde"); }
document.addEventListener("pointerup",holdEnd); document.addEventListener("pointercancel",holdEnd);
document.addEventListener("pointerout",e=>{const b=e.target.closest&&e.target.closest("#holdBtn"); if(b&&!b.contains(e.relatedTarget)) holdEnd();});
document.addEventListener("contextmenu",e=>{if(e.target.closest&&e.target.closest("#holdBtn")) e.preventDefault();});

document.addEventListener("click",e=>{
  const t=e.target.closest("button"); if(!t) return;
  if(t.hasAttribute("data-close")){closeModal();return;}
  if(t.id==="holdBtn"){ if(e.detail===0) rxSubmit(); return; }   // clic clavier (Entrée, Espace) : pas besoin d'appui long
  if(t.hasAttribute("data-back")){goTab(navStack.pop()||"accueil",true);return;}
  if(t.dataset.auth){const a=t.dataset.auth; authErr=""; authMsg="";
    if(a==="resend"){Auth.resend(pendingEmail).then(()=>{authMsg="E-mail renvoyé.";render();},er=>{authErr=er.message;render();});return;}
    const em=$("#auEmail"); if(em&&em.value) pendingEmail=em.value.trim();
    phase="auth"; authView=a; render(); const f=$("#auName")||$("#auEmail"); if(f) f.focus(); return;}
  if(t.dataset.eye){const i=$("#"+t.dataset.eye), show=i.type==="password"; i.type=show?"text":"password"; t.setAttribute("aria-pressed",show); t.setAttribute("aria-label",show?"Masquer le mot de passe":"Afficher le mot de passe"); return;}
  if(t.dataset.ob){ if(t.dataset.ob==="next") obNext(); else if(t.dataset.ob==="back"){ob.step--;render();} else obFinish(); return;}
  if(t.dataset.obSave){ob.save=t.dataset.obSave;$("#obSave").value=t.dataset.obSave;return;}
  if(t.dataset.tab){goTab(t.dataset.tab);return;}
  if(t.dataset.key){rxKey(t.dataset.key);return;}
  if(t.dataset.rxtab){rx.tab=t.dataset.rxtab;render();return;}
  if(t.dataset.contact){const id=t.dataset.contact;
    if(tab==="transfert"){rx.contact=rx.contact===id?null:id; render(); return;}
    rx.contact=id; rx.tab="new"; goTab("transfert"); return;}
  if(t.dataset.editContact){contactSheet(t.dataset.editContact);return;}
  if(t.dataset.tr){const id=t.dataset.tr; if($("#scrim")) closeModal(); transferSheet(id); return;}
  if(t.dataset.shareTr){shareSheet(t.dataset.shareTr);return;}
  if(t.dataset.sim){closeModal(); simulate(t.dataset.sim); if(tab==="transfert") rx.tab="track"; render(); toast("Paiement simulé : suis l'avancement ici"); return;}
  if(t.dataset.cancelTr){const id=t.dataset.cancelTr; closeModal(); confirmBox("Annuler cette demande ?","Le lien envoyé ne fonctionnera plus.","Annuler la demande",()=>{advance(id,"cancelled"); toast("Demande annulée");}); return;}
  if(t.dataset.trSave){const tr=S.transfers[t.dataset.trSave]; closeModal(); if(tr) potMoveSheet(null,1,tr.amountEur); return;}
  if(t.dataset.copy){copyText(t.dataset.copy);return;}
  if(t.dataset.editTx){const x=S.tx[t.dataset.editTx]; if(x) expenseSheet(x); return;}
  if(t.dataset.filter){txFilter=t.dataset.filter;render();return;}
  if(t.dataset.potIn){potMoveSheet(t.dataset.potIn,1);return;}
  if(t.dataset.potOut){potMoveSheet(t.dataset.potOut,-1);return;}
  if(t.dataset.potOpen){potEditSheet(t.dataset.potOpen);return;}
  if(t.dataset.catchup){catchupSheet(+t.dataset.catchup,t.dataset.from);return;}
  if(t.dataset.skipPrev){const from=t.dataset.skipPrev; editProfile(np=>{np.catchups=[...(np.catchups||[]),{id:uid(),from,amount:0,months:1,start:from,kind:"skip"}];}); render(); toast("C'est noté"); return;}
  if(t.dataset.surplus){const amt=+t.dataset.surplus, from=t.dataset.from; editProfile(np=>{np.catchups=[...(np.catchups||[]),{id:uid(),from,amount:0,months:1,start:from,kind:"surplus"}];}); render(); potMoveSheet(null,1,amt); return;}
  if(t.dataset.delCatchup){const id=t.dataset.delCatchup; confirmBox("Supprimer ce rattrapage ?","Ton budget reviendra à son niveau normal dès maintenant.","Supprimer",()=>{editProfile(np=>{np.catchups=(np.catchups||[]).filter(x=>x.id!==id);});render();toast("Rattrapage annulé");}); return;}
  const a=t.dataset.act;
  if(a==="actions"){actionsSheet();return;}
  if(a==="notifs"){notifsSheet();return;}
  if(a==="toggleweek"){weekOpen=!weekOpen;render();return;}
  if(a==="receive"){rx.tab="new"; goTab("transfert"); return;}
  if(a==="wish"){goTab("envies"); setTimeout(()=>{const w=$("#wishName"); if(w) w.focus();},60); return;}
  if(a==="newcontact"){contactSheet();return;}
  if(a==="editcontact"){contactSheet(rx.contact&&S.contacts[rx.contact]?rx.contact:null);return;}
  if(a==="swapcur"){const q=quote(); if(rx.cur==="EUR"){rx.cur="LOC"; rx.str=q.local?String(q.local):"";} else {rx.cur="EUR"; rx.str=q.eur?String(q.eur).replace(".",","):"";} render(); return;}
  if(a==="txinfo"){infoSheet();return;}
  if(a==="payersim"){toast("Paiement simulé. Aucun argent n'a été débité.");return;}
  if(a==="addcatchup"){catchupSheet(0,null);return;}
  if(a==="export"){exportData();return;}
  if(a==="import"){importData();return;}
  if(a==="expense"){expenseSheet();return;}
  if(a==="deposit"){potMoveSheet(null,1);return;}
  if(a==="withdraw"){potMoveSheet(null,-1);return;}
  if(a==="newpot"){potEditSheet();return;}
  if(a==="more"){histLimit+=6;render();return;}
  if(a==="logout"){logout();return;}
  if(a==="chpw"){Auth.resetPassword(user.email).then(()=>toast("Un lien pour changer ton mot de passe vient de partir par e-mail."),er=>toast(er.message));return;}
  if(a==="delaccount"){deleteAccountFlow("Supprimer ton compte ?","Ton compte et toutes tes données (dépenses, projets, envies, expéditeurs, demandes) seront effacés définitivement. Exporte une sauvegarde avant si tu veux les garder.","Supprimer définitivement","Ton compte a été supprimé");return;}
  if(a==="withdraw-contract"){deleteAccountFlow("Te rétracter du contrat ?","Pendant les 14 jours qui suivent ton inscription, tu peux te rétracter sans te justifier et sans frais. Ton compte et toutes tes données seront supprimés.","Me rétracter","Rétractation enregistrée : ton compte a été supprimé");return;}
  if(a==="addcat"){editProfile(np=>np.categories.push({id:"c"+uid(),name:"Nouvelle catégorie",budget:0,color:PALETTE[np.categories.length%PALETTE.length]}));render();return;}
  if(a==="autobudget"){const c=calc(); confirmBox("Répartir automatiquement ?",`Les budgets seront recalculés à partir de tes ${fm0(c.avail)} disponibles, selon le poids habituel de chaque catégorie.`,"Répartir",()=>{
      editProfile(np=>{const n=np.categories.length; np.categories.forEach(k=>{const d=DEF_CATS.find(x=>x[0]===k.name); k.budget=Math.round(c.avail*(d?d[1]:1/n)/5)*5;});
        const tot=np.categories.reduce((s,k)=>s+k.budget,0); if(tot>c.avail&&tot>0) np.categories.forEach(k=>k.budget=Math.floor(k.budget*c.avail/tot/5)*5);});render();toast("Budgets répartis");});return;}
  if(a==="reset"){confirmBox("Tout effacer ?","Dépenses, projets, envies, expéditeurs, demandes et réglages seront supprimés définitivement. Ton compte reste ouvert.","Tout effacer",async()=>{
      for(const k of KINDS) for(const id of Object.keys(S[k])) write(k,id,null);
      if(mode==="cloud") chains["p"]=refFor("profile").delete().catch(()=>{});
      S={...emptyState(),savedAt:Date.now()}; saveLocal(); if(mode==="supabase") pushNow();
      ob={step:0,name:"",income:"",fixed:"",save:""}; phase="onboarding"; render(); toast("Tout a été effacé");});return;}
  if(t.dataset.delCat){const id=t.dataset.delCat; if(S.profile.categories.length<=1){toast("Garde au moins une catégorie.");return;}
    const used=Object.values(S.tx).some(x=>x.cat===id);
    confirmBox("Supprimer la catégorie ?",used?"Les dépenses déjà classées dedans resteront dans l'historique sous « Autre ».":"Elle ne contient aucune dépense.","Supprimer",()=>{editProfile(np=>np.categories=np.categories.filter(k=>k.id!==id));render();});return;}
  if(t.dataset.wish){const w=S.wishes[t.dataset.wish]; if(!w) return; const nw={...w,status:t.dataset.to,decided:Date.now()};
    write("wishes",w.id,nw);
    if(nw.status==="bought"){const k=S.profile.categories.find(x=>/shop/i.test(x.name))||S.profile.categories[0]; const id=uid();
      write("tx",id,{id,date:todayIso(),cat:k.id,amount:w.price,note:w.name,kind:"envie",createdAt:Date.now()}); toast("Ajouté à tes dépenses");}
    else toast(`${fm0(w.price)} gardés dans ta poche`);
    render();return;}
});
document.addEventListener("submit",e=>{
  if(e.target.id==="authForm"){e.preventDefault(); handleAuth(e.target); return;}
  if(e.target.id!=="wishForm") return; e.preventDefault();
  const n=$("#wishName").value.trim(), p=parseAmt($("#wishPrice").value);
  if(!n||!(p>0)){$("#wishErr").textContent="Indique ce qui te fait envie et son prix.";return;}
  const id=uid(); write("wishes",id,{id,name:n,price:p,created:Date.now(),status:"wait"}); dirty=false; document.activeElement.blur(); render(); toast("Rendez-vous dans 48 h");});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&$("#scrim")){closeModal();return;}
  if(e.key==="Enter"&&phase==="onboarding"&&e.target.tagName==="INPUT"){e.preventDefault();obNext();return;}
  // clavier physique sur l'écran « Recevoir »
  if(phase==="app"&&tab==="transfert"&&rx.tab==="new"&&!$("#scrim")&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
    if(/^\d$/.test(e.key)){rxKey(e.key);e.preventDefault();}
    else if((e.key===","||e.key===".")&&rx.cur==="EUR"){rxKey(",");e.preventDefault();}
    else if(e.key==="Backspace"){rxKey("del");e.preventDefault();}
  }
});
document.addEventListener("input",e=>{const el=e.target;
  if(el.id==="obSave") ob.save=el.value; if(el.id==="obIncome") ob.income=el.value; if(el.id==="obFixed") ob.fixed=el.value; if(el.id==="obName") ob.name=el.value;
  if(el.id==="auPw"&&$("#pwRules")){const r=Auth.checkPassword(el.value); document.querySelectorAll("#pwRules [data-rule]").forEach(li=>li.classList.toggle("ok",!!r[li.dataset.rule]));}
});
document.addEventListener("change",e=>{
  const el=e.target; if(!S.profile) return;
  if(el.dataset.pfText){const v=el.value.trim(); editProfile(np=>np[el.dataset.pfText]=v); if(el.dataset.pfText==="name"&&mode!=="cloud") Auth.updateName(v).catch(()=>{}); dirty=true; return;}
  if(el.dataset.pf){const v=parseAmt(el.value||"0"); editProfile(np=>np[el.dataset.pf]=v>0?v:0); dirty=true; return;}
  if(el.dataset.catName){const v=el.value.trim(); if(v) editProfile(np=>{const k=np.categories.find(x=>x.id===el.dataset.catName); if(k) k.name=v;}); return;}
  if(el.dataset.catBudget){const v=parseAmt(el.value||"0"); editProfile(np=>{const k=np.categories.find(x=>x.id===el.dataset.catBudget); if(k) k.budget=v>0?v:0;}); dirty=true; return;}
});
setInterval(()=>{ if(phase!=="app") return; tickDemo(); if(tab==="envies"||tab==="accueil"||tab==="transfert") requestRender(); },60000);

/* ============ boot ============ */
async function boot(){
  if(location.hash.startsWith("#payer=")){phase="payer"; render(); return;}
  render();
  if(window.claude&&window.claude.use){
    const ok=await Promise.race([connectClaude(),new Promise(r=>setTimeout(()=>r(false),9000))]);
    if(ok) return;
  }
  try{
    user=await Auth.init();
    Auth.onChange((event,u)=>{
      if(event==="PASSWORD_RECOVERY"){user=u||user; phase="reset"; render(); return;}
      if(event==="SIGNED_IN"&&u&&!user&&!authBusy){user=u; startSession();}
    });
  }catch(e){user=null; authErr=e.message||"Le service de comptes ne répond pas.";}
  if(user){ if(/type=signup/.test(location.hash)) toast("Adresse e-mail confirmée"); await startSession(); }
  else{phase="auth"; render();}
}
boot();
})();
