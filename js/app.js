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

/* ============ effets ============ */
const calm=()=>!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
// vibrations : Android seulement, l'iPhone ne les autorise pas depuis une page web
const HAP={tap:8,hold:25,ok:[14,50,22],err:[40,40,40]};
const haptic=p=>{try{if(navigator.vibrate) navigator.vibrate(p);}catch(e){}};
// pluie de cauris pour les réussites
function burst(from){
  if(calm()) return;
  const r=from&&from.getBoundingClientRect?from.getBoundingClientRect():{left:innerWidth/2-20,top:innerHeight/2-20,width:40,height:40};
  const cx=r.left+r.width/2, cy=r.top+r.height/2, layer=document.createElement("div"); layer.className="burst"; layer.setAttribute("aria-hidden","true");
  for(let i=0;i<22;i++){const b=document.createElement("i"), a=Math.random()*Math.PI*2, d=60+Math.random()*130;
    b.style.cssText=`left:${cx}px;top:${cy}px;--dx:${(Math.cos(a)*d).toFixed(0)}px;--dy:${(Math.sin(a)*d-70).toFixed(0)}px;--r:${(Math.random()*540-270).toFixed(0)}deg;--d:${(.75+Math.random()*.5).toFixed(2)}s`;
    if(i%3===0) b.className="sand"; layer.appendChild(b);}
  document.body.appendChild(layer); setTimeout(()=>layer.remove(),1500);
}
// gros montants qui défilent jusqu'à leur valeur
const counts={};
const cnt=(key,v,fmt)=>`<span data-count="${v}" data-key="${key}"${fmt?` data-fmt="${fmt}"`:""}>${fmt==="eur0"?fm0(v):money(v)}</span>`;
function runCounters(entered){
  document.querySelectorAll("[data-count]").forEach(el=>{
    const key=el.dataset.key, to=+el.dataset.count, from=entered?0:(key in counts?counts[key]:to); counts[key]=to;
    if(calm()||from===to) return;
    const t0=performance.now(), dur=entered?800:450, f=el.dataset.fmt==="eur0"?fm0:money;
    el.innerHTML=f(from);
    const step=now=>{const p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3); el.innerHTML=f(from+(to-from)*e); if(p<1&&document.contains(el)) requestAnimationFrame(step);};
    requestAnimationFrame(step);
  });
}
const replay=(el,cls)=>{if(!el||calm()) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);};
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
const KINDS=["tx","pots","wishes","transfers","contacts","cards","wallet"];
const emptyState=()=>({profile:null,tx:{},pots:{},wishes:{},transfers:{},contacts:{},cards:{},wallet:{},savedAt:0});
// compte CauriPay (démo) : mouvements dans S.wallet (argent reçu d'Afrique, recharges, paiements par carte)
const walletBal=()=>r2(Object.values(S.wallet).reduce((a,m)=>a+(+m.amt||0),0));
let S=emptyState();
let phase="loading";           // loading | auth | verify | reset | onboarding | app | payer
let mode="pending";            // pending | cloud (compte Claude) | supabase | local
let user=null;                 // {id,email,name}
let tab="accueil", navStack=[], txFilter="all", histLimit=3, weekOpen=false;
let authView="login", authErr="", authMsg="", pendingEmail="", authBusy=false;
let rx={tab:"new",contact:null,country:"SN",str:"",cur:"EUR"};
let pendingWrites=0, dirty=false, R=null, lastSync=0;
try{let t=localStorage.getItem("cauripay_tab"); t={depenses:"budget",tresorerie:"epargne"}[t]||t; if(["accueil","budget","epargne","envies","cartes"].includes(t)) tab=t;}catch(e){}
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
  const wal=walletBal();
  return {P,now,td,mk,day,dim,mtx,spent,avail,base,catchup,prevMk,prevSpent,prevAvail,prevDiff,prevPending,activeCatchups,remaining,ws,we,weekBudget,spentWeek,leftWeek,todayBudget,leftToday,spentToday,dailyTarget,daysLeftWeek,daysInWeek,week,
    wants,byCat,projection,streak,skipped,wishes,pots:potInfo,totalSaved,savedThisMonth,needMonthly,weeklyNormal:avail*12/52,transfers,trMonth,walletBal:wal};
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
  undo:sv('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  card:sv('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>'),
  nfc:sv('<path d="M6 8.5a5 5 0 0 1 0 7M9.5 6a8.5 8.5 0 0 1 0 12M13 3.5a12 12 0 0 1 0 17M16.5 1.5a15 15 0 0 1 0 21"/>'),
  snow:sv('<path d="M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>'),
  sliders:sv('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  phone:sv('<rect x="6.5" y="2" width="11" height="20" rx="2.5"/><path d="M11 18.5h2"/>'),
  ban:sv('<circle cx="12" cy="12" r="9"/><path d="M5.7 5.7l12.6 12.6"/>'),
  cart:sv('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2.5 4h2.2l2.3 11a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L20.5 8H6"/>'),
  lock:sv('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')
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
  // un écran qui change s'anime à l'entrée ; un simple rafraîchissement ne rejoue pas l'animation
  const key=phase==="app"?"app:"+tab:phase==="onboarding"?"ob:"+ob.step:phase+":"+authView;
  const entered=key!==render.key; render.key=key;
  if(phase==="loading"){app.innerHTML=`<div class="loading"><i></i><div>Ouverture de tes comptes…</div></div>`;return;}
  if(phase==="app"){
    const c=calc();
    if(!sub) nav.innerHTML=navHtml(entered);
    const v={accueil:vHome,budget:vSpend,epargne:vTreso,envies:vWishes,cartes:vCards,transfert:vTransfer,profil:vProfile}[tab]||vHome;
    app.innerHTML=`<section class="view view-${tab}">${v(c)}</section>`;
  }else app.innerHTML=phase==="payer"?vPayer():phase==="onboarding"?vOnboarding():vAuth();
  const root=app.firstElementChild;
  if(entered&&root&&!calm()){root.classList.add("enter"); [...root.children].forEach((ch,i)=>ch.style.setProperty("--i",Math.min(i,8)));}
  runCounters(entered);
  if(phase==="app"&&tab==="transfert"&&rx.tab==="new") rxUpdate();
  if(phase==="app"&&tab==="cartes") cardsAfterRender();
}
function goTab(k,isBack){
  if($("#scrim")) closeModal();
  if(k==="transfert"||k==="profil"){ if(!isBack&&tab!==k) navStack.push(tab); }
  else{ navStack=[]; try{localStorage.setItem("cauripay_tab",k);}catch(_){} }
  tab=k; render(); window.scrollTo({top:0});
}
function navHtml(entered){
  const it=(k,l,ic)=>`<button data-tab="${k}" ${tab===k?`aria-current="page"${entered?' class="just"':""}`:""}>${ic}<span>${l}</span></button>`;
  return `<div class="nav-in">${it("accueil","Accueil",I.home)}${it("cartes","Cartes",I.card)}
    <button class="nav-main" data-act="actions" aria-label="Actions rapides" aria-haspopup="dialog">${I.scan}</button>
    ${it("budget","Budget",I.chart)}${it("epargne","Épargne",I.vault)}</div>`;
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
  render(); toast("Ton budget est prêt"); haptic(HAP.ok); setTimeout(()=>burst($(".bal")),250);
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
  Object.values(S.tx).filter(t=>t.card&&now-(t.createdAt||0)<864e5).forEach(t=>out.push({ic:I.card,t:`Paiement de ${fm(t.amount)} chez ${esc(t.note)} avec ta carte •• ${esc(t.last4||"")}.`,a:'data-tab="cartes"'}));
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
      <div class="bal-amt num ${left<0?"neg":""}">${left<0?"−":""}${cnt("home-left",r2(Math.abs(left)))}</div>
      <div class="bal-meta"><span class="pill-dk">${I.up}${fm0(Math.max(0,c.leftToday))} max aujourd'hui</span><span>sur ${fm0(c.weekBudget)} prévus</span></div>
      <div class="acts">${act("expense",I.up,"Dépense")}${act("receive",I.down,"Recevoir")}${act("pay",I.nfc,"Payer")}${act("deposit",I.piggy,"Épargner")}</div>
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
  ${c.walletBal>0||liveCards().length?`<button class="wal home" data-tab="cartes"><span class="wal-l"><small>Compte CauriPay${DEMO?" (démo)":""}</small><b class="num">${cnt("home-wal",c.walletBal)}</b></span><span class="pill">${I.card} Cartes ${I.chevR}</span></button>`:""}
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
    <span class="t"><b>${esc(t.note||k.name)}</b><span>${esc(k.name)}${t.card?` · Carte •• ${esc(t.last4||"")}`:""}${t.kind==="envie"?' · <em class="want">Envie</em>':""}</span></span>
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
    <div class="sum-amt num ${c.remaining<0?"neg":""}">${c.remaining<0?"−":""}${cnt("bud-rem",r2(Math.abs(c.remaining)))}</div>
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
  <button class="card linkcard" data-tab="envies"><span class="sq">${I.clock}</span><span><b>Règle des 48 heures</b><small>${c.wishes.filter(w=>w.status==="wait").length} en attente · ${fm0(c.skipped)} économisés</small></span>${I.chevR}</button>
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
      <div class="vc-amt num">${cnt("treso",c.totalSaved)}</div>
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
  rx.str=s; rxUpdate(); replay($("#rxAmt"),"bump"); haptic(HAP.tap);
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
  openModal(`<span class="big-ico ok-draw" style="align-self:center">${I.check}</span><h2 style="text-align:center">Demande créée</h2>
    <div class="ref num">${esc(t.ref)}</div>
    <p class="muted" style="text-align:center">Envoie ce lien à ${esc(first(t.senderName))} : le paiement de <b>${fmLocal(t.localAmount,t.currency)}</b> se fait avec ${esc(METHODS[t.method])}.</p>
    <div class="share">
      <a class="btn pri" href="https://wa.me/${phone}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${I.chat}WhatsApp</a>
      <a class="btn" href="sms:+${phone}?body=${encodeURIComponent(msg)}">${I.msg}SMS</a>
      <button class="btn" data-copy="${esc(link)}">${I.copy}Copier</button>
    </div>
    ${t.demo&&t.status==="created"?`<button class="btn ghost block" data-sim="${t.id}">Simuler le paiement de ${esc(first(t.senderName))}</button>`:""}
    <button class="btn ghost block" data-close>Fermer</button>`,()=>{haptic(HAP.ok); setTimeout(()=>burst($(".ref")),120);});
}
function transferSheet(id){
  const raw=S.transfers[id]; if(!raw) return;
  const t=trView(raw), hist={}; (t.history||[]).forEach(h=>hist[h.s]=h.t);
  const steps=[["created","Demande créée"],["paid","Payée par l'expéditeur"],["checking","Vérifications légales"],["credited","Argent reçu sur ton compte CauriPay"]];
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
  if(s==="credited"){creditWallet(t); toast(`${fm(t.amountEur)} reçus de ${first(t.senderName)}`); haptic(HAP.ok); if(phase==="app") burst();}
  requestRender();
}
// l'argent reçu arrive sur le compte CauriPay (une seule fois par transfert)
function creditWallet(t){const wid="tr"+t.id; if(!S.wallet[wid]) write("wallet",wid,{id:wid,amt:t.amountEur,kind:"transfer",note:"Reçu de "+t.senderName,at:Date.now()});}
function simulate(id){advance(id,"paid"); setTimeout(()=>advance(id,"checking"),1600); setTimeout(()=>advance(id,"credited"),3800);}
function tickDemo(){Object.values(S.transfers).forEach(t=>{if(t.status==="credited") creditWallet(t);}); Object.values(S.transfers).forEach(t=>{if(t.demo&&(t.status==="paid"||t.status==="checking")&&Date.now()-(t.statusAt||0)>5000) advance(t.id,"credited");});}
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

/* ============ cartes CauriPay ============ */
// Démonstration. En réel, la carte est émise par un établissement agréé, membre d'un réseau de cartes,
// et le numéro complet et le cryptogramme restent chez l'émetteur (norme PCI DSS) : CauriPay ne doit jamais les stocker.
const DESIGNS=[["citron","Citron"],["nuit","Nuit"],["sable","Sable"],["indigo","Indigo"]];
const CARD_TYPES={
  virtual:{label:"Carte virtuelle",short:"Virtuelle",desc:"Achats en ligne, et sans contact avec ton téléphone"},
  single:{label:"Carte à usage unique",short:"Usage unique",desc:"Un seul achat en ligne, puis le numéro change"}};
const MAX_CARDS=5;
// sans contact : authentification forte au-delà de 50 € par paiement, de 150 € cumulés ou de 5 paiements d'affilée
// (règlement délégué (UE) 2018/389, article 11)
const NFC_ONE=50, NFC_SUM=150, NFC_COUNT=5;
const MERCHANTS_NFC=["Supérette du Coin","Boulangerie du Marché","Pharmacie Centrale","Café des Amis","Primeur du Quartier","Kiosque Presse"];
const MERCHANTS_WEB=["Boutique en ligne","Librairie en ligne","Billetterie Concerts","Mode & Wax"];
const COWRIE=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><ellipse cx="12" cy="12" rx="7" ry="10"/><path d="M12 4.5c-1 2.5-1 12.5 0 15M10 8H8.6M10 11H8.3M10 14H8.3M10 17H8.7M14 8h1.4M14 11h1.7M14 14h1.7M14 17h1.3"/></svg>`;
let cardSel=null, cw=null, fxCard=null;
const pick=a=>a[Math.floor(Math.random()*a.length)];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const digits=n=>{const b=new Uint8Array(n); crypto.getRandomValues(b); return [...b].map(x=>x%10).join("");};
// numéro de démonstration : le préfixe 0000 n'appartient à aucun réseau de cartes, il ne fonctionne nulle part
function newNumbers(){const d=new Date(); return {pan:"0000"+digits(12),cvv:digits(3),exp:pad(d.getMonth()+1)+"/"+String(d.getFullYear()+4).slice(2)};}
const fmtPan=p=>String(p).replace(/(\d{4})(?=\d)/g,"$1 ");
const liveCards=()=>Object.values(S.cards).filter(k=>k.status!=="closed").sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
const activeCard=()=>{const k=S.cards[cardSel]; return k&&k.status==="active"?k:liveCards().find(x=>x.status==="active")||null;};
const kycOk=()=>!!(S.profile&&S.profile.kyc&&S.profile.kyc.status==="verified");
function cardSpent(id){const mk=todayIso().slice(0,7); return sum(Object.values(S.tx).filter(t=>t.card===id&&t.date&&t.date.slice(0,7)===mk));}
const sw=(id,title,sub,on,dis)=>`<label class="sw"><span><b>${title}</b><small>${sub}</small></span><input type="checkbox" role="switch" id="${id}" ${on?"checked":""} ${dis?"disabled":""}><i aria-hidden="true"></i></label>`;
const pwBox=(id,ph)=>`<span class="pw"><input class="in" id="${id}" type="password" autocomplete="current-password" placeholder="${ph||""}" aria-label="Mot de passe"><button type="button" class="pw-eye" data-eye="${id}" aria-label="Afficher le mot de passe" aria-pressed="false">${I.eye}</button></span>`;

function cardVisual(k,o){
  o=o||{};
  const num=o.reveal?fmtPan(k.pan):"•••• •••• •••• "+String(k.pan).slice(-4);
  return `<div class="ccard d-${k.design} ${o.tilt===false?"":"tilt"} ${k.frozen?"frozen":""} ${o.cls||""}" data-card-id="${k.id||""}" ${o.label!==false?`role="img" aria-label="${esc(CARD_TYPES[k.type].label)} CauriPay se terminant par ${String(k.pan).slice(-4)}${k.frozen?", gelée":""}${k.status==="blocked"?", en opposition":""}"`:""}>
    <span class="cc-pat"></span><span class="cc-wm">${COWRIE}</span><span class="cc-shine"></span>
    <div class="cc-top"><span class="cc-brand">${COWRIE}CauriPay</span><span class="cc-type">${CARD_TYPES[k.type].short}</span></div>
    <div class="cc-mid">${k.type==="single"?I.cart:I.nfc}</div>
    <div class="cc-num num">${num}</div>
    <div class="cc-bot"><div><small>Titulaire</small><b class="cc-holder">${esc(k.holder||"—")}</b></div><div><small>Expire</small><b class="num">${k.exp}</b></div><span class="cc-scheme">DÉMO</span></div>
    ${k.frozen?`<div class="cc-frost">${I.snow}<b>Carte gelée</b></div>`:""}
    ${k.status==="blocked"?`<div class="cc-frost blocked">${I.ban}<b>Opposition faite</b></div>`:""}
  </div>`;
}
const cardBack=k=>`<div class="ccard back d-${k.design}" aria-hidden="true"><span class="cc-pat"></span><div class="cc-stripe"></div>
  <div class="cc-cvv"><small>Cryptogramme</small><b class="num">${k.cvv}</b></div><p class="cc-legal">Carte de démonstration CauriPay, sans valeur.</p></div>`;

function vCards(c){
  const cards=liveCards(), head=pageHead("Cartes",c);
  if(!cards.length){
    const d=new Date(), sample={type:"virtual",design:"citron",pan:"0000000000002026",exp:pad(d.getMonth()+1)+"/"+String(d.getFullYear()+4).slice(2),holder:(displayName()||"CAURIPAY").toUpperCase()};
    return head+`
    <div class="card-empty">
      <div class="ce-stack">${cardVisual(sample)}</div>
      <h2>Ta carte CauriPay</h2>
      <p class="muted">Une carte virtuelle pour payer en ligne, et sans contact avec ton téléphone. Elle se crée en une minute.</p>
      <ul class="ticks"><li>Gratuite pendant la démonstration</li><li>Gelable et dégelable en un geste</li><li>Plafonds réglables et opposition immédiate</li><li>Chaque achat est ajouté à ton budget</li></ul>
      ${DEMO?`<div class="demo-flag">${I.alert}<span><b>Démonstration.</b> Les cartes créées ici n'ont aucune valeur et ne fonctionnent chez aucun commerçant.</span></div>`:""}
    </div>
    <button class="lime-big" data-act="newcard">${I.plus} Créer ma carte CauriPay</button>`;
  }
  if(!cardSel||!S.cards[cardSel]||S.cards[cardSel].status==="closed") cardSel=cards[cards.length-1].id;
  return head+`
    <div class="cc-rail" id="cardRail" aria-label="Mes cartes">${cards.map(k=>`<div class="cc-slide">${cardVisual(k)}</div>`).join("")}</div>
    ${cards.length>1?`<div class="cc-dots">${cards.map((k,i)=>`<button data-card-dot="${k.id}" aria-label="Carte ${i+1} : ${esc(k.name)}" ${k.id===cardSel?'aria-current="true"':""}></button>`).join("")}</div>`:""}
    <div id="cardPanel" class="card-panel">${cardPanel(c,S.cards[cardSel])}</div>`;
}
function cardPanel(c,k){
  const spent=cardSpent(k.id), lim=+k.limit||0, p=lim?Math.min(1,spent/lim):0, blocked=k.status==="blocked";
  const flag=(on,l)=>`<span class="chip ${on?"ok":"need"}">${on?"✓":"✕"} ${l}</span>`;
  const tile=(a,ic,l,dis)=>`<button class="tile" data-card-act="${a}" ${dis?"disabled":""}><span class="sq">${ic}</span>${l}</button>`;
  const txs=Object.values(S.tx).filter(t=>t.card===k.id).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,5);
  return `
  <div class="wal"><span class="wal-l"><small>Compte CauriPay${DEMO?" (démo)":""}</small><b class="num">${cnt("wallet",c.walletBal)}</b></span><button class="pill" data-card-act="topup">${I.plus} Recharger</button></div>
  <div class="card">
    <div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div style="min-width:0"><b>${esc(k.name)}</b><div class="small muted">${CARD_TYPES[k.type].desc}</div></div>
      <span class="chip ${blocked?"d":k.frozen?"w":"ok"}">${blocked?"Opposition":k.frozen?"Gelée":"Active"}</span></div>
    <div class="lim-head" style="margin-top:14px"><span>Dépensé ce mois-ci</span><span class="num">${fm0(spent)} / ${fm0(lim)}</span></div>
    <div class="bar" style="margin-top:8px"><i style="width:${p*100}%;${p>=.9?"background:var(--danger)":""}"></i></div>
    <div class="cc-flags">${flag(k.online,"En ligne")}${flag(k.nfc,"Sans contact")}${flag(k.abroad,"Hors zone euro")}</div>
  </div>
  <h2 class="sec-title">Actions rapides</h2>
  <div class="grid4">
    ${tile("nfc",I.nfc,"Sans contact",blocked||k.type==="single")}${tile("online",I.cart,"Payer en ligne",blocked)}${tile("details",I.eye,"Voir les infos",blocked)}${tile("freeze",I.snow,k.frozen?"Dégeler":"Geler",blocked)}
    ${tile("limits",I.sliders,"Plafonds",blocked)}${tile("wallet",I.phone,"Portefeuille",blocked)}${tile("oppose",I.ban,"Opposition",blocked)}${tile("close",I.trash,"Supprimer")}
  </div>
  <section>${secHead("Paiements avec cette carte")}
    ${txs.length?`<div class="list">${txs.map(txRow).join("")}</div>`:`<div class="empty">Aucun paiement pour l'instant. Essaie « Sans contact » ou « Payer en ligne ».</div>`}</section>
  ${liveCards().filter(x=>x.status==="active").length<MAX_CARDS?`<button class="lime-big" data-act="newcard">${I.plus} Ajouter une carte</button>`:""}`;
}
function cardsAfterRender(){
  const rail=$("#cardRail"); if(!rail) return;
  const ids=[...rail.querySelectorAll(".ccard")].map(e=>e.dataset.cardId);
  rail.scrollLeft=Math.max(0,ids.indexOf(cardSel))*rail.clientWidth;
  if(fxCard){const el=rail.querySelector(`.ccard[data-card-id="${fxCard.id}"]`); if(el&&!calm()){el.classList.add("fx-"+fxCard.fx); if(fxCard.fx==="issued") setTimeout(()=>burst(el),450);} fxCard=null;}
  let tm; rail.addEventListener("scroll",()=>{clearTimeout(tm); tm=setTimeout(()=>{
    const id=ids[Math.round(rail.scrollLeft/rail.clientWidth)]; if(!id||id===cardSel) return;
    cardSel=id; $("#cardPanel").innerHTML=cardPanel(calc(),S.cards[id]); replay($("#cardPanel"),"swap-fx");
    document.querySelectorAll("[data-card-dot]").forEach(d=>d.toggleAttribute("aria-current",d.dataset.cardDot===id));
    haptic(HAP.tap);
  },90);},{passive:true});
}

/* ---------- création d'une carte : 4 étapes ---------- */
function newCardFlow(){
  if(liveCards().filter(k=>k.status==="active").length>=MAX_CARDS){toast(`Tu peux avoir ${MAX_CARDS} cartes actives au maximum.`);return;}
  if(!kycOk()){kycSheet(newCardFlow);return;}   // identité vérifiée obligatoire avant d'émettre une carte
  cw={step:0,type:"virtual",design:"citron",holder:(displayName()||"").toUpperCase(),name:"",limit:500,online:true,nfc:true,abroad:false};
  wizard(1);
}
function wizard(dir){
  const st=cw.step, single=cw.type==="single";
  const prev=`<div class="pay-card">${cardVisual({type:cw.type,design:cw.design,pan:"0000000000000000",exp:"MM/AA",holder:cw.holder},{cls:"preview",label:false})}</div>`;
  const dots=`<div class="steps" role="img" aria-label="Étape ${st+1} sur 4">${[0,1,2,3].map(i=>`<i class="${i<=st?"on":""}"></i>`).join("")}</div>`;
  const back=st?`<button class="btn ghost" data-cw="back">Retour</button>`:`<button class="btn ghost" data-close>Annuler</button>`;
  const next=`<button class="btn pri" style="flex:1" data-cw="next">Continuer</button>`;
  let body="";
  if(st===0) body=`<h2>Quelle carte veux-tu ?</h2><div class="opt-list">
      ${Object.entries(CARD_TYPES).map(([k,v])=>`<button type="button" class="opt" data-cw-type="${k}" aria-pressed="${cw.type===k}"><span class="sq">${k==="single"?I.cart:I.card}</span><span><b>${v.label}</b><small>${v.desc}</small></span></button>`).join("")}
      <button type="button" class="opt" disabled><span class="sq">${I.card}</span><span><b>Carte physique</b><small>Bientôt</small></span></button></div>
    <div class="row">${back}${next}</div>`;
  if(st===1) body=`<h2>Choisis son style</h2>${prev}
    <div class="designs" role="group" aria-label="Style de la carte">${DESIGNS.map(([k,l])=>`<button type="button" class="dsg" data-cw-design="${k}" aria-pressed="${cw.design===k}"><span class="sw-c d-${k}"><span class="cc-pat"></span></span>${l}</button>`).join("")}</div>
    <label class="f">Nom sur la carte<input class="in" id="cwHolder" maxlength="24" autocomplete="name" value="${esc(cw.holder)}"></label>
    <label class="f">Surnom, pour toi (facultatif)<input class="in" id="cwName" maxlength="24" placeholder="ex. Achats en ligne" value="${esc(cw.name)}"></label>
    <div class="err" id="cwErr"></div>
    <div class="row">${back}${next}</div>`;
  if(st===2) body=`<h2>Règle ta carte</h2>
    <label class="f">Plafond par mois : <b id="cwLimV" style="color:var(--ink)">${fm0(cw.limit)}</b><input type="range" class="range" id="cwLim" min="50" max="3000" step="50" value="${cw.limit}"></label>
    <div>${sw("cwOnline","Paiements en ligne","Chaque achat est validé dans CauriPay (3-D Secure)",cw.online)}
      ${sw("cwNfc","Sans contact",single?"Pas disponible sur une carte à usage unique":"Avec ton téléphone, en magasin",!single&&cw.nfc,single)}
      ${sw("cwAbroad","Paiements hors zone euro","Désactivés par défaut, par sécurité",cw.abroad)}</div>
    <div class="row">${back}${next}</div>`;
  if(st===3) body=`<h2>Vérifie et confirme</h2>${prev}
    <div class="recap">${recapLine("Type",CARD_TYPES[cw.type].label)}${recapLine("Nom sur la carte",esc(cw.holder))}${recapLine("Plafond",fm0(cw.limit)+" par mois")}
      ${recapLine("Usages",[cw.online&&"en ligne",!single&&cw.nfc&&"sans contact",cw.abroad&&"hors zone euro"].filter(Boolean).join(", ")||"aucun")}
      ${recapLine("Prix",DEMO?"Gratuite (démonstration)":"[tarif]")}${recapLine("Émetteur",DEMO?"Démonstration, sans valeur":"[partenaire agréé]")}</div>
    <label class="chk"><input type="checkbox" id="cwCgu"><span>J'accepte les <a href="legal/cgu.html#carte" target="_blank" rel="noopener">conditions de la carte</a>.</span></label>
    ${mode!=="cloud"?`<label class="f">Authentification forte : ton mot de passe${pwBox("cwPw")}</label>`:""}
    <div class="err" id="cwErr"></div>
    <div class="row">${back}<button class="btn pri" style="flex:1" id="cwGo" data-cw="create">Créer ma carte</button></div>`;
  setSheet(dots+body,null,dir);
}
function wizNav(a){
  if(a==="create"){cwCreate();return;}
  if(cw.step===1){cw.holder=$("#cwHolder").value.trim().replace(/\s+/g," ").toUpperCase(); cw.name=$("#cwName").value.trim();}
  if(cw.step===2){cw.limit=+$("#cwLim").value; cw.online=$("#cwOnline").checked; cw.nfc=$("#cwNfc").checked; cw.abroad=$("#cwAbroad").checked;}
  if(a==="next"){
    if(cw.step===1&&cw.holder.length<2){$("#cwErr").textContent="Indique le nom à afficher sur la carte.";return;}
    cw.step++; wizard(1);
  }else{cw.step--; wizard(-1);}
  haptic(HAP.tap);
}
async function cwCreate(){
  const err=m=>{$("#cwErr").textContent=m;}, btn=$("#cwGo");
  if(!$("#cwCgu").checked) return err("Accepte les conditions de la carte.");
  if(mode!=="cloud"){
    const pw=$("#cwPw").value; if(!pw) return err("Indique ton mot de passe.");
    btn.disabled=true; btn.textContent="Vérification…";
    try{await Auth.signIn({email:user.email,password:pw});}catch(e){btn.disabled=false; btn.textContent="Créer ma carte"; return err(e.message||"Mot de passe incorrect.");}
  }
  const id=uid();
  write("cards",id,{id,type:cw.type,design:cw.design,holder:cw.holder,name:cw.name||CARD_TYPES[cw.type].label,...newNumbers(),limit:cw.limit,
    online:cw.online,nfc:cw.type!=="single"&&cw.nfc,abroad:cw.abroad,frozen:false,status:"active",nfcSince:{sum:0,count:0},createdAt:Date.now()});
  cw=null; cardSel=id; fxCard={id,fx:"issued"}; closeModal();
  if(tab!=="cartes") goTab("cartes"); else render();
  haptic(HAP.ok); toast("Ta carte CauriPay est prête");
}

/* ---------- voir les infos (après authentification forte) ---------- */
function reauth(title,why,next){
  if(mode==="cloud"){next();return;}
  openModal(`<span class="big-ico">${I.lock}</span><h2>${title}</h2><p class="muted">${why}</p>
    <label class="f">Mot de passe${pwBox("raPw")}</label>
    <div class="err" id="raErr"></div>
    <div class="row"><button class="btn ghost" data-close>Annuler</button><button class="btn pri" style="flex:1" id="raGo">Confirmer</button></div>`,()=>{
    const go=async()=>{const pw=$("#raPw").value; if(!pw){$("#raErr").textContent="Indique ton mot de passe.";return;}
      const b=$("#raGo"); b.disabled=true;
      try{await Auth.signIn({email:user.email,password:pw});}catch(e){b.disabled=false; $("#raErr").textContent=e.message||"Mot de passe incorrect."; return;}
      next();};
    $("#raGo").onclick=go; $("#raPw").addEventListener("keydown",e=>{if(e.key==="Enter") go();});
    setTimeout(()=>{const p=$("#raPw"); if(p) p.focus();},60);
  });
}
function detailsSheet(k){
  let left=60;
  setSheet(`<h2>Infos de la carte</h2>
    <div class="flip" id="flip"><div class="flip-in">${cardVisual(k,{reveal:true,tilt:false})}${cardBack(k)}</div></div>
    <button class="link" data-flip style="align-self:center">Retourner la carte</button>
    <div class="recap">
      <div><span>Numéro</span><b class="num">${fmtPan(k.pan)} <button class="iconbtn" data-copy-raw="${k.pan}" aria-label="Copier le numéro">${I.copy}</button></b></div>
      ${recapLine("Expiration",k.exp)}${recapLine("Cryptogramme",k.cvv)}${recapLine("Titulaire",esc(k.holder))}
    </div>
    <p class="small muted" id="hideIn">Masquage automatique dans 60 s.</p>
    ${DEMO?`<div class="nudge">Numéro de démonstration (il commence par 0000) : il ne fonctionne sur aucun site. En réel, ces infos s'affichent dans un cadre sécurisé de l'émetteur et ne passent jamais par CauriPay.</div>`:""}
    <button class="btn ghost block" data-close>Masquer</button>`,()=>{
    const tick=setInterval(()=>{left--; const h=$("#hideIn"); if(!h){clearInterval(tick);return;} if(left<=0){clearInterval(tick); closeModal(); toast("Infos de la carte masquées"); return;} h.textContent=`Masquage automatique dans ${left} s.`;},1000);
  },1);
}

/* ---------- payer : sans contact ou en ligne ---------- */
function chargeCheck(k,amount,ch){
  if(!k||k.status!=="active") return "Une opposition a été faite sur cette carte.";
  if(k.frozen) return "Ta carte est gelée. Dégèle-la pour payer.";
  if(ch==="nfc"&&!k.nfc) return "Le sans contact est désactivé pour cette carte.";
  if(ch==="online"&&!k.online) return "Les paiements en ligne sont désactivés pour cette carte.";
  if(amount>walletBal()) return `Solde insuffisant (${fm(walletBal())}). Recharge ton compte CauriPay.`;
  if(cardSpent(k.id)+amount>k.limit) return `Plafond mensuel de ${fm0(k.limit)} atteint.`;
  return "";
}
function charge(k,amount,ch,merchant,sca){
  const now=Date.now(), id=uid(), cats=S.profile.categories||[], re=ch==="nfc"?/course/i:/shop/i, cat=(cats.find(x=>re.test(x.name))||cats[0]||{}).id;
  write("tx",id,{id,date:todayIso(),cat,amount,note:merchant,kind:"besoin",card:k.id,last4:String(k.pan).slice(-4),channel:ch,createdAt:now});
  write("wallet","p"+id,{id:"p"+id,amt:-amount,kind:"card",note:merchant,card:k.id,at:now});
  const nk={...k,lastUsedAt:now};
  if(ch==="nfc") nk.nfcSince=sca?{sum:0,count:0}:{sum:r2(((k.nfcSince||{}).sum||0)+amount),count:((k.nfcSince||{}).count||0)+1};
  if(k.type==="single"){Object.assign(nk,newNumbers()); setTimeout(()=>toast("Usage unique : ta carte a reçu un nouveau numéro."),1800);}
  write("cards",k.id,nk);
}
function paySheet(k,ch){
  const nfc=ch==="nfc";
  openModal(`<span class="eyebrow" style="text-align:center">${nfc?"Paiement sans contact":"Paiement en ligne"}</span>
    <div class="pay-card">${cardVisual(k,{tilt:false})}</div>
    <div class="pay-zone" id="payZone" data-state="idle" data-ch="${ch}" aria-live="polite">
      <div class="nfc-rings"><i></i><i></i><i></i><span id="payIco">${nfc?I.nfc:I.cart}</span></div>
      <p id="payMsg">${nfc?`<b>Prêt à payer</b><br><span class="muted">Approche le haut de ton téléphone du terminal.</span>`:`<b>Achat sur un site marchand</b><br><span class="muted">Tu le valideras ici : c'est le 3-D Secure.</span>`}</p></div>
    <div id="payAuth" class="pay-auth" hidden></div>
    ${DEMO?`<label class="f">Montant du test<input class="in num" id="payAmt" inputmode="decimal" autocomplete="off" value="${nfc?"12,50":"39,90"}"></label>
      <button class="btn pri block" id="payGo">${nfc?"Simuler le passage au terminal":"Simuler l'achat"}</button>
      <p class="small muted">${nfc?"Démonstration : une page web ne peut pas utiliser la puce NFC du téléphone. En réel, la carte CauriPay s'ajoute à Apple Pay ou Google Pay.":"Démonstration : aucun site ne débite cette carte."}</p>`:""}
    <button class="btn ghost block" data-close>Fermer</button>`,()=>{const g=$("#payGo"); if(g) g.onclick=()=>payFlow(k.id,ch);},"pay");
}
function setPay(st,html){
  const z=$("#payZone"); if(!z) return;
  z.dataset.state=st; $("#payMsg").innerHTML=html;
  const ico=$("#payIco");
  ico.innerHTML=st==="ok"?`<span class="ok-draw">${I.check}</span>`:st==="err"?I.alert:st==="auth"?I.lock:(z.dataset.ch==="nfc"?I.nfc:I.cart);
  if(st==="err") replay($("#payMsg"),"shake");
}
// authentification forte dans la fenêtre de paiement : mot de passe (en réel : Face ID, empreinte ou code)
function scaStep(){return new Promise(res=>{
  const box=$("#payAuth"), pw=mode!=="cloud"; box.hidden=false;
  box.innerHTML=`${pw?pwBox("payPw","Ton mot de passe"):""}<div class="err" id="payErr"></div>
    <div class="row"><button class="btn ghost" id="payNo">Refuser</button><button class="btn pri" style="flex:1" id="payYes">Valider le paiement</button></div>`;
  const done=v=>{box.hidden=true; box.innerHTML=""; res(v);};
  $("#payNo").onclick=()=>done(false);
  const ok=async()=>{
    if(pw){const p=$("#payPw").value; if(!p){$("#payErr").textContent="Indique ton mot de passe.";return;}
      $("#payYes").disabled=true;
      try{await Auth.signIn({email:user.email,password:p});}catch(e){$("#payYes").disabled=false; $("#payErr").textContent=e.message||"Mot de passe incorrect."; return;}}
    done(true);};
  $("#payYes").onclick=ok;
  if(pw){$("#payPw").addEventListener("keydown",e=>{if(e.key==="Enter") ok();}); setTimeout(()=>{const p=$("#payPw"); if(p) p.focus();},60);}
});}
async function payFlow(id,ch){
  const go=$("#payGo"), amount=parseAmt($("#payAmt").value);
  if(!(amount>0)){setPay("err","<b>Indique un montant.</b>"); haptic(HAP.err); return;}
  const merchant=pick(ch==="nfc"?MERCHANTS_NFC:MERCHANTS_WEB);
  go.disabled=true; go.textContent=ch==="nfc"?"Simuler le passage au terminal":"Simuler l'achat";
  setPay("read",`<b>${ch==="nfc"?"Lecture…":"Connexion au site marchand…"}</b><br><span class="muted">${esc(merchant)} · ${fm(amount)}</span>`);
  await wait(calm()?150:1100);
  if(!$("#payZone")) return;
  let k=S.cards[id], why=chargeCheck(k,amount,ch);
  if(why){setPay("err",`<b>Paiement refusé</b><br><span class="muted">${why}</span>`); haptic(HAP.err); go.disabled=false; return;}
  const since=k.nfcSince||{sum:0,count:0}; let sca=false;
  if(ch==="online"||amount>NFC_ONE||since.sum+amount>NFC_SUM||since.count>=NFC_COUNT){
    setPay("auth",`<b>Confirme ce paiement</b><br><span class="muted">${ch==="online"?`3-D Secure : ${fm(amount)} chez ${esc(merchant)}.`:`Au-delà de ${NFC_ONE} € par paiement, de ${NFC_SUM} € cumulés ou de ${NFC_COUNT} paiements d'affilée, ton identité doit être vérifiée.`}</span>`);
    sca=await scaStep();
    if(!$("#payZone")) return;
    if(!sca){setPay("err","<b>Paiement annulé</b>"); go.disabled=false; return;}
    k=S.cards[id]; why=chargeCheck(k,amount,ch);
    if(why){setPay("err",`<b>Paiement refusé</b><br><span class="muted">${why}</span>`); go.disabled=false; return;}
  }
  charge(k,amount,ch,merchant,sca);
  setPay("ok",`<b>Paiement accepté · ${fm(amount)}</b><br><span class="muted">${esc(merchant)} · ajouté à ton budget</span>`);
  haptic(HAP.ok); burst($("#payIco")); go.disabled=false; go.textContent="Payer encore"; requestRender();
}

/* ---------- réglages, recharge, portefeuille, opposition ---------- */
function limitsSheet(k){
  const single=k.type==="single";
  openModal(`<h2>Plafonds et usages</h2>
    <label class="f">Plafond par mois : <b id="lmV" style="color:var(--ink)">${fm0(k.limit)}</b><input type="range" class="range" id="lmLim" min="50" max="3000" step="50" value="${k.limit}"></label>
    <div>${sw("lmOnline","Paiements en ligne","Validés dans CauriPay (3-D Secure)",k.online)}${sw("lmNfc","Sans contact",single?"Pas disponible sur une carte à usage unique":"Avec ton téléphone, en magasin",k.nfc,single)}${sw("lmAbroad","Paiements hors zone euro","Désactivés par défaut, par sécurité",k.abroad)}</div>
    <p class="small muted">Sans contact : au-delà de ${NFC_ONE} € par paiement, de ${NFC_SUM} € cumulés ou de ${NFC_COUNT} paiements d'affilée, CauriPay te demande de confirmer ton identité.</p>
    <div class="row"><button class="btn ghost" data-close>Annuler</button><button class="btn pri" style="flex:1" id="lmSave">Enregistrer</button></div>`,()=>{
    $("#lmLim").addEventListener("input",e=>{$("#lmV").textContent=fm0(+e.target.value);});
    $("#lmSave").onclick=()=>{write("cards",k.id,{...S.cards[k.id],limit:+$("#lmLim").value,online:$("#lmOnline").checked,nfc:!single&&$("#lmNfc").checked,abroad:$("#lmAbroad").checked});
      closeModal(); render(); haptic(HAP.ok); toast("Réglages de la carte enregistrés");};
  });
}
function topupSheet(){
  openModal(`<h2>Recharger mon compte</h2>
    <p class="small muted">L'argent reçu d'Afrique arrive directement sur ton compte CauriPay. Tu peux aussi ajouter un montant de démonstration.</p>
    <div class="amt-in"><input class="num" id="tuAmt" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="Montant"><span>€</span></div>
    <div class="row" style="justify-content:center">${[20,50,100,200].map(a=>`<button type="button" class="btn sm" data-q="${a}">${a} €</button>`).join("")}</div>
    <div class="err" id="tuErr"></div>
    <div class="row"><button class="btn ghost" data-act="receive">Recevoir d'Afrique</button><button class="btn pri" style="flex:1" id="tuGo">Recharger${DEMO?" (démo)":""}</button></div>`,()=>{
    $("#scrim").addEventListener("click",e=>{const q=e.target.closest("[data-q]"); if(q){$("#tuAmt").value=q.dataset.q; haptic(HAP.tap);}});
    $("#tuGo").onclick=()=>{const a=parseAmt($("#tuAmt").value);
      if(!(a>0)){$("#tuErr").textContent="Indique un montant supérieur à 0.";return;}
      if(a>1000){$("#tuErr").textContent="1 000 € au maximum par recharge.";return;}
      const id=uid(); write("wallet",id,{id,amt:a,kind:"topup",note:"Recharge de démonstration",at:Date.now()});
      closeModal(); render(); haptic(HAP.ok); burst(); toast(`${fm(a)} ajoutés à ton compte`);};
    setTimeout(()=>{const i=$("#tuAmt"); if(i) i.focus();},60);
  });
}
function walletSheet(){
  openModal(`<span class="big-ico">${I.phone}</span><h2>Payer avec ton téléphone</h2>
    <p class="muted">Pour payer sans contact en magasin, la carte CauriPay s'ajoute au portefeuille de ton téléphone : Apple Pay sur iPhone, Google Pay sur Android.</p>
    <ul class="ticks">
      <li><b>Version réelle :</b> l'ajout se fait depuis l'application CauriPay, avec notre partenaire émetteur. Le vrai numéro n'est jamais stocké sur le téléphone : il est remplacé par un numéro de substitution (jeton).</li>
      <li><b>Plus tard :</b> une application CauriPay native pourra aussi payer directement en NFC. Sur iPhone, Apple l'autorise dans l'Espace économique européen depuis iOS 17.4, sur demande.</li>
      <li><b>Cette version web</b> ne peut pas utiliser la puce NFC du téléphone : le sans contact est simulé.</li></ul>
    <div class="row"><button class="btn ghost" data-close>Fermer</button><button class="btn pri" style="flex:1" data-card-act="nfc">Essayer le sans contact</button></div>`);
}
function opposeSheet(k){
  let why="perdue";
  openModal(`<h2>Faire opposition</h2>
    <p class="muted">À utiliser si ta carte ou ses infos sont perdues, volées ou utilisées sans ton accord. L'opposition est <b>définitive</b> : la carte ne pourra plus jamais servir. Pour une simple pause, utilise plutôt « Geler ».</p>
    <div class="seg" role="group" aria-label="Motif">${[["perdue","Perdue"],["volee","Volée"],["fraude","Fraude"]].map(([v,l])=>`<button type="button" data-why="${v}" aria-pressed="${v===why}">${l}</button>`).join("")}</div>
    <p class="small muted">Après l'opposition, tu n'es plus responsable des paiements frauduleux. Avant, ta responsabilité est limitée à 50 € (Code monétaire et financier, art. L. 133-19).</p>
    <div class="row"><button class="btn ghost" data-close>Annuler</button><button class="btn danger" style="flex:1" id="opGo">Faire opposition</button></div>`,()=>{
    $("#scrim").addEventListener("click",e=>{const b=e.target.closest("[data-why]"); if(b){why=b.dataset.why; document.querySelectorAll("[data-why]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.why===why));}});
    $("#opGo").onclick=()=>{write("cards",k.id,{...S.cards[k.id],status:"blocked",frozen:false,blockedAt:Date.now(),blockedWhy:why}); fxCard={id:k.id,fx:"freeze"};
      closeModal(); render(); haptic(HAP.ok); toast("Opposition enregistrée. Tu peux créer une nouvelle carte.");};
  });
}
function cardAct(a){
  if(a==="topup"){topupSheet();return;}
  const k=S.cards[cardSel]; if(!k) return;
  if(a==="nfc"){paySheet(k,"nfc");return;}
  if(a==="online"){paySheet(k,"online");return;}
  if(a==="details"){reauth("Voir les infos de la carte","Pour ta sécurité, confirme ton identité avant d'afficher le numéro complet et le cryptogramme.",()=>detailsSheet(S.cards[k.id]));return;}
  if(a==="freeze"){const f=!k.frozen; write("cards",k.id,{...k,frozen:f}); fxCard={id:k.id,fx:f?"freeze":"thaw"}; haptic(f?HAP.ok:HAP.tap); render();
    toast(f?"Carte gelée : plus aucun paiement possible.":"Carte dégelée : elle fonctionne à nouveau."); return;}
  if(a==="limits"){limitsSheet(k);return;}
  if(a==="wallet"){walletSheet();return;}
  if(a==="oppose"){opposeSheet(k);return;}
  if(a==="close"){confirmBox("Supprimer cette carte ?","Elle disparaît de ton appli et ne pourra plus servir. Les paiements déjà faits restent dans ton budget.","Supprimer",()=>{
    write("cards",k.id,{...S.cards[k.id],status:"closed",closedAt:Date.now()}); cardSel=null; render(); toast("Carte supprimée");}); return;}
}

/* ============ sheets ============ */
let lastFocus=null;
function openModal(html,onMount,cls){
  const prev=$("#scrim");
  if(!prev) lastFocus=document.activeElement; else prev.remove();
  $("#modalSlot").insertAdjacentHTML("beforeend",`<div class="scrim${prev?" swap":""}" id="scrim"><div class="sheet ${cls||""}" role="dialog" aria-modal="true" tabindex="-1">${html}</div></div>`);
  $("#scrim").addEventListener("click",e=>{if(e.target.id==="scrim") closeModal();});
  onMount&&onMount();
  if(!$("#scrim").contains(document.activeElement)) $("#scrim .sheet").focus();
}
// remplace le contenu de la fenêtre ouverte (étapes d'un parcours), ou en ouvre une
function setSheet(html,onMount,dir){
  const sh=$("#scrim .sheet"); if(!sh){openModal(html,onMount);return;}
  sh.innerHTML=html; sh.scrollTop=0; replay(sh,dir<0?"step-b":"step-f"); onMount&&onMount();
}
function closeModal(){
  const sc=$("#scrim");
  if(sc){ // la fenêtre glisse vers le bas avant de disparaître ; ses id sont retirés pour ne pas gêner la suivante
    sc.removeAttribute("id"); sc.querySelectorAll("[id]").forEach(n=>n.removeAttribute("id"));
    sc.classList.add("closing"); sc.style.pointerEvents="none"; setTimeout(()=>sc.remove(),calm()?0:230);
  }
  if(lastFocus&&document.contains(lastFocus)) try{lastFocus.focus();}catch(e){} lastFocus=null; if(dirty){dirty=false;render();}
}
function toast(t){
  const slot=$("#toastSlot"); slot.innerHTML=`<div class="toast" role="status">${esc(t)}</div>`; clearTimeout(toast.t);
  toast.t=setTimeout(()=>{const el=slot.firstElementChild; if(!el) return; el.classList.add("out"); setTimeout(()=>{if(el.parentNode) el.remove();},calm()?0:230);},2800);
}
function confirmBox(title,text,label,fn){
  openModal(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Annuler</button><button class="btn danger" id="cfBoxOk">${esc(label)}</button></div>`,()=>{$("#cfBoxOk").onclick=()=>{closeModal();fn();};});
}
function actionsSheet(){
  const t=(a,ic,l)=>`<button class="tile2" data-act="${a}"><span class="sq">${ic}</span>${l}</button>`;
  openModal(`<h2>Que veux-tu faire ?</h2><div class="grid2">${t("pay",I.nfc,"Payer sans contact")}${t("receive",I.down,"Recevoir d'Afrique")}${t("expense",I.up,"Noter une dépense")}${t("deposit",I.piggy,"Mettre de côté")}${t("newcard",I.card,"Créer une carte")}${t("wish",I.bag,"Noter une envie")}</div>`);
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
      const nb=r2(p.balance+dir*a), reached=dir>0&&p.target>0&&p.balance<p.target&&nb>=p.target;
      write("pots",p.id,{...p,balance:nb,moves});
      closeModal();render();
      if(reached){toast(`Objectif atteint pour « ${p.name} » !`); haptic(HAP.ok); burst();}
      else toast(dir>0?`${fm0(a)} mis de côté pour « ${p.name} »`:`${fm0(a)} retirés de « ${p.name} »`);};
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
function copyText(s,label){
  const done=()=>toast(label||"Lien copié");
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
  holdT=setTimeout(()=>{holdT=null; b.classList.remove("holding"); haptic(HAP.hold); rxSubmit();},950);});
function holdEnd(){ if(!holdT) return; clearTimeout(holdT); holdT=null; const b=$("#holdBtn"); if(b) b.classList.remove("holding");
  if(Date.now()-holdStart<600) toast("Garde le doigt appuyé une seconde"); }
document.addEventListener("pointerup",holdEnd); document.addEventListener("pointercancel",holdEnd);
document.addEventListener("pointerout",e=>{const b=e.target.closest&&e.target.closest("#holdBtn"); if(b&&!b.contains(e.relatedTarget)) holdEnd();});
document.addEventListener("contextmenu",e=>{if(e.target.closest&&e.target.closest("#holdBtn")) e.preventDefault();});

document.addEventListener("click",e=>{
  const t=e.target.closest("button"); if(!t) return;
  if(t.hasAttribute("data-close")){closeModal();return;}
  if(t.id==="holdBtn"){ if(e.detail===0) rxSubmit(); return; }   // clic clavier (Entrée, Espace) : pas besoin d'appui long
  if(t.dataset.cardAct){cardAct(t.dataset.cardAct);return;}
  if(t.dataset.cardDot){const rail=$("#cardRail"), ids=liveCards().map(k=>k.id), j=ids.indexOf(t.dataset.cardDot); if(rail&&j>=0) rail.scrollTo({left:j*rail.clientWidth,behavior:calm()?"auto":"smooth"}); return;}
  if(t.dataset.cw){wizNav(t.dataset.cw);return;}
  if(t.dataset.cwType){cw.type=t.dataset.cwType; document.querySelectorAll("[data-cw-type]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.cwType===cw.type)); haptic(HAP.tap); return;}
  if(t.dataset.cwDesign){cw.design=t.dataset.cwDesign; document.querySelectorAll("[data-cw-design]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.cwDesign===cw.design));
    const pv=$(".ccard.preview"); if(pv){DESIGNS.forEach(([k])=>pv.classList.remove("d-"+k)); pv.classList.add("d-"+cw.design); replay(pv,"fx-thaw");} haptic(HAP.tap); return;}
  if(t.hasAttribute("data-flip")){const f=$("#flip"); if(f) f.classList.toggle("flipped"); haptic(HAP.tap); return;}
  if(t.dataset.copyRaw){copyText(t.dataset.copyRaw,"Numéro copié");return;}
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
  if(a==="toggleweek"){weekOpen=!weekOpen; const w=$("#weekMore"); if(w){w.hidden=!weekOpen; if(weekOpen) replay(w,"open-fx");}
    const n=$(".notch"); if(n){n.setAttribute("aria-expanded",weekOpen); n.setAttribute("aria-label",(weekOpen?"Masquer":"Afficher")+" le détail de la semaine");} haptic(HAP.tap); return;}
  if(a==="pay"){const k=activeCard(); if(!k){toast("Crée d'abord ta carte CauriPay."); newCardFlow(); return;} cardSel=k.id; paySheet(k,"nfc"); return;}
  if(a==="newcard"){newCardFlow();return;}
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
    else{toast(`${fm0(w.price)} gardés dans ta poche`); haptic(HAP.ok); burst(t);}
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
  if(el.id==="cwHolder"){const b=$(".ccard.preview .cc-holder"); if(b) b.textContent=el.value.trim().toUpperCase()||"—";}
  if(el.id==="cwLim"){const v=$("#cwLimV"); if(v) v.textContent=fm0(+el.value);}
  if(el.id==="auPw"&&$("#pwRules")){const r=Auth.checkPassword(el.value); document.querySelectorAll("#pwRules [data-rule]").forEach(li=>li.classList.toggle("ok",!!r[li.dataset.rule]));}
});
document.addEventListener("change",e=>{
  const el=e.target; if(!S.profile) return;
  if(el.dataset.pfText){const v=el.value.trim(); editProfile(np=>np[el.dataset.pfText]=v); if(el.dataset.pfText==="name"&&mode!=="cloud") Auth.updateName(v).catch(()=>{}); dirty=true; return;}
  if(el.dataset.pf){const v=parseAmt(el.value||"0"); editProfile(np=>np[el.dataset.pf]=v>0?v:0); dirty=true; return;}
  if(el.dataset.catName){const v=el.value.trim(); if(v) editProfile(np=>{const k=np.categories.find(x=>x.id===el.dataset.catName); if(k) k.name=v;}); return;}
  if(el.dataset.catBudget){const v=parseAmt(el.value||"0"); editProfile(np=>{const k=np.categories.find(x=>x.id===el.dataset.catBudget); if(k) k.budget=v>0?v:0;}); dirty=true; return;}
});
new MutationObserver(ms=>{for(const m of ms){const n=m.target.nodeType===1?m.target:m.target.parentElement, e=n&&n.closest&&n.closest(".err");
  if(e&&e.textContent.trim()){replay(e,"shake"); haptic(HAP.err); break;}}}).observe(document.body,{subtree:true,childList:true,characterData:true});
// inclinaison et reflet des cartes sous le doigt ou la souris
document.addEventListener("pointermove",e=>{const k=e.target.closest&&e.target.closest(".ccard.tilt"); if(!k||calm()) return; const r=k.getBoundingClientRect(), x=(e.clientX-r.left)/r.width, y=(e.clientY-r.top)/r.height;
  k.style.setProperty("--ry",((x-.5)*14).toFixed(2)+"deg"); k.style.setProperty("--rx",((.5-y)*10).toFixed(2)+"deg"); k.style.setProperty("--mx",(x*100).toFixed(0)+"%"); k.style.setProperty("--my",(y*100).toFixed(0)+"%");},{passive:true});
document.addEventListener("pointerout",e=>{const k=e.target.closest&&e.target.closest(".ccard.tilt"); if(k&&!k.contains(e.relatedTarget)){k.style.removeProperty("--rx"); k.style.removeProperty("--ry");}});
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
