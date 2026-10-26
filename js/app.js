(function(){
"use strict";
/* ============ helpers ============ */
const $=s=>document.querySelector(s);
const eur=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2});
const eur0=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const fm=v=>eur.format(v), fm0=v=>eur0.format(Math.round(v));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const todayIso=()=>iso(new Date());
const sum=a=>a.reduce((s,t)=>s+(+t.amount||0),0);
const r2=n=>Math.round(n*100)/100;
const parseAmt=v=>{const n=parseFloat(String(v??"").replace(/[\s €]/g,"").replace(",","."));return isFinite(n)?r2(n):NaN;};
const dfmt=(d,o)=>new Date(d+"T12:00").toLocaleDateString("fr-FR",o);
const H48=48*3600e3;
const monthAdd=(mk,n)=>{const [y,m]=mk.split("-").map(Number);const d=new Date(y,m-1+n,1);return d.getFullYear()+"-"+pad(d.getMonth()+1);};
const monthName=(mk,o)=>dfmt(mk+"-15",o||{month:"long"});
// catch-up plans: profile.catchups = [{id,from,amount,months,start,kind:"plan"|"skip"|"surplus"}]
function deductionFor(mk,P){return (P.catchups||[]).filter(x=>x.kind==="plan"&&x.amount>0&&mk>=x.start&&mk<monthAdd(x.start,x.months)).reduce((s,x)=>s+x.amount/x.months,0);}
const PALETTE=["#1E8A63","#D07A1A","#3A6FD8","#C24A73","#7A4FD0","#2696A3","#8C8F2E","#6B7A72","#B5532F","#4C8A2E"];
const DEF_CATS=[["Courses",.34],["Restos & sorties",.14],["Shopping",.12],["Transport",.12],["Loisirs",.10],["Abonnements",.06],["Imprévus",.12]];

/* ============ state ============ */
// S.profile: {v:2,income,fixed,save,categories:[{id,name,budget,color}],createdAt}
// S.tx / S.pots / S.wishes : maps id -> doc
let S={profile:null,tx:{},pots:{},wishes:{}};
let phase="loading";           // loading | onboarding | app
let mode="pending";            // pending | cloud | local
let tab="accueil", txFilter="all", histLimit=3;
let pendingWrites=0, dirty=false;
let R=null;                    // cloud refs
try{const t=localStorage.getItem("tirelire_tab"); if(t) tab=t;}catch(e){}

const CACHE="tirelire_v2_cache";
function saveLocal(){try{localStorage.setItem(CACHE,JSON.stringify(S));}catch(e){}}
function loadLocal(){try{const s=JSON.parse(localStorage.getItem(CACHE)||"null"); if(s&&typeof s==="object"&&s.tx) return s;}catch(e){} return null;}

function migrateV1(o){
  if(!o||o.v!==1||o.example) return null;
  const out={profile:{v:2,income:+o.settings?.income||0,fixed:+o.settings?.fixed||0,save:+o.settings?.save||0,
    categories:(o.categories||[]).map((c,i)=>({id:c.id,name:c.name,budget:+c.budget||0,color:c.color||PALETTE[i%PALETTE.length]})),createdAt:Date.now()},tx:{},pots:{},wishes:{}};
  (o.tx||[]).forEach(t=>{const id=t.id||uid();out.tx[id]={id,date:t.date,amount:+t.amount,cat:t.cat,note:t.note||"",kind:t.kind||"besoin",createdAt:Date.now()};});
  (o.goals||[]).forEach((g,i)=>{const id=g.id||uid();out.pots[id]={id,name:g.name,target:+g.target||0,deadline:"",balance:+g.saved||0,color:PALETTE[(i+2)%PALETTE.length],
    moves:g.saved?[{d:todayIso(),amt:+g.saved,note:"Solde de départ"}]:[],createdAt:Date.now()+i};});
  (o.wishes||[]).forEach(w=>{const id=w.id||uid();out.wishes[id]={...w,id};});
  return out;
}

/* ============ database layer ============ */
const chains={};
function setSync(){
  const el=$("#sync"); if(!el) return;
  const txt=mode==="cloud"?(pendingWrites?"Enregistrement…":"Synchronisé avec ton compte"):mode==="local"?"Enregistré sur cet appareil":"Connexion…";
  el.className="sync "+(mode==="cloud"&&!pendingWrites?"ok":pendingWrites||mode==="pending"?"busy":"");
  el.querySelector("span").textContent=txt;
}
function refFor(kind,id){return kind==="profile"?R.profile:R.profile.collection(kind).doc(id);}
function write(kind,id,data){
  if(kind==="profile") S.profile=data; else { if(data===null) delete S[kind][id]; else S[kind][id]=data; }
  saveLocal();
  if(mode!=="cloud") return Promise.resolve();
  const ref=refFor(kind,id), key=ref.path;
  pendingWrites++; setSync();
  const body=data===null?null:JSON.parse(JSON.stringify(data));
  const p=(chains[key]||Promise.resolve()).then(()=>body===null?ref.delete():ref.set(body))
    .catch(e=>{ if(e&&e.code==="unavailable") return new Promise(r=>setTimeout(r,600+Math.random()*800)).then(()=>body===null?ref.delete():ref.set(body)).catch(onWriteErr); onWriteErr(e); })
    .finally(()=>{pendingWrites--; setSync();});
  chains[key]=p; return p;
}
function onWriteErr(e){
  const c=e&&e.code;
  toast(c==="quota_exceeded"?"Base pleine : supprime d'anciennes dépenses pour continuer.":c==="invalid_argument"?"Tu n'as pas le droit d'écrire ici.":"Enregistrement impossible pour l'instant. Réessaie.");
}

async function connect(){
  try{
    if(!window.claude||!window.claude.use) return false;
    const [db,user]=await Promise.all([claude.use("db"),claude.use("user")]);
    if(!db||!user) return false;
    const id=await user.id(); if(!id) return false;
    const base="data/users/"+id;
    R={profile:db.doc(base+"/profile")};
    const snap=await R.profile.get();
    mode="cloud";
    if(snap.exists){
      S.profile={...snap.data()};
    }else{
      // first time on this account: bring over earlier data (v1 doc, or what was saved on this device)
      let seed=null;
      try{const old=await db.doc(base+"/tirelire").get(); if(old.exists) seed=migrateV1(old.data());}catch(e){}
      if(!seed){const loc=loadLocal(); if(loc&&loc.profile) seed=loc;}
      if(!seed){try{seed=migrateV1(JSON.parse(localStorage.getItem("tirelire_state")||"null"));}catch(e){}}
      if(seed){
        S={profile:null,tx:{},pots:{},wishes:{}};
        for(const k of ["tx","pots","wishes"]) for(const [i,d] of Object.entries(seed[k]||{})) await write(k,i,d);
        await write("profile","profile",seed.profile);
      }else{
        S={profile:null,tx:{},pots:{},wishes:{}}; saveLocal();
      }
    }
    phase=S.profile?"app":"onboarding";
    render();
    // live sync (other phone, other tab)
    R.profile.onSnapshot(s=>{ if(s.exists){S.profile={...s.data()}; if(phase!=="app"){phase="app";} saveLocal(); requestRender();} },()=>{});
    for(const k of ["tx","pots","wishes"]){
      R.profile.collection(k).limit(1000).onSnapshot(q=>{const m={}; q.docs.forEach(d=>{m[d.id]={...d.data(),id:d.id};}); S[k]=m; saveLocal(); requestRender();},()=>{});
    }
    return true;
  }catch(e){ return false; }
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
  return {P,now,td,mk,day,dim,mtx,spent,avail,base,catchup,prevMk,prevSpent,prevAvail,prevDiff,prevPending,activeCatchups,remaining,ws,we,weekBudget,spentWeek,leftWeek,todayBudget,leftToday,spentToday,dailyTarget,daysLeftWeek,daysInWeek,week,
    wants,byCat,projection,streak,skipped,wishes,pots:potInfo,totalSaved,savedThisMonth,needMonthly,weeklyNormal:avail*12/52};
}
const catOf=id=>(S.profile?.categories||[]).find(c=>c.id===id)||{name:"Autre",color:"#6B7A72"};

/* ============ icons ============ */
const sv=(p,f)=>`<svg viewBox="0 0 24 24" fill="${f?"currentColor":"none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I={
  home:sv('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  card:sv('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>'),
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
  bag:sv('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>')
};
const TABS=[["accueil","Accueil",I.home],["depenses","Dépenses",I.card],["tresorerie","Trésorerie",I.vault],["envies","Envies",I.clock],["profil","Profil",I.user]];

/* ============ render ============ */
function isBusy(){const a=document.activeElement; return !!$("#scrim")||!!(a&&/INPUT|SELECT|TEXTAREA/.test(a.tagName)&&a.closest("#app"));}
function requestRender(){ if(isBusy()){dirty=true;return;} render(); }
document.addEventListener("focusout",()=>setTimeout(()=>{if(dirty&&!isBusy()){dirty=false;render();}},0));

function render(){
  setSync();
  const app=$("#app"), tabs=$("#tabs");
  $("#fab").hidden=phase!=="app"||tab==="profil";
  if(phase==="loading"){tabs.hidden=true;app.innerHTML=`<div class="loading"><i></i><div>Ouverture de tes comptes…</div></div>`;return;}
  if(phase==="onboarding"){tabs.hidden=true;app.innerHTML=vOnboarding();return;}
  tabs.hidden=false;
  tabs.innerHTML=TABS.map(([k,l,ic])=>`<button role="tab" data-tab="${k}" aria-selected="${tab===k}">${ic}<span>${l}</span></button>`).join("");
  const c=calc();
  const v={accueil:vHome,depenses:vSpend,tresorerie:vTreso,envies:vWishes,profil:vProfile}[tab]||vHome;
  app.innerHTML=`<section class="view">${v(c)}</section>`;
}

/* ---------- onboarding ---------- */
let ob={step:0,income:"",fixed:"",save:""};
function vOnboarding(){
  const st=ob.step, inc=parseAmt(ob.income)||0, fix=parseAmt(ob.fixed)||0, sav=parseAmt(ob.save)||0;
  const avail=Math.max(0,inc-fix-sav);
  const dots=`<div class="steps">${[0,1,2,3].map(i=>`<i class="${i<=st?"on":""}"></i>`).join("")}</div>`;
  const back=st>0?`<button class="btn ghost" data-ob="back">Retour</button>`:"";
  if(st===0) return `<div class="onb">${dots}<h2>On commence par ce qui rentre.</h2><p class="muted">Ton salaire net et tes autres revenus réguliers, par mois. Trois questions et c'est prêt.</p>
    <div class="card"><label class="f">Revenus nets par mois<input class="in num" id="obIncome" inputmode="decimal" placeholder="ex. 1 850" value="${esc(ob.income)}"></label>
    <div class="err" id="obErr"></div><button class="btn pri block" data-ob="next">Continuer</button></div>
    <button class="link" data-act="import" style="align-self:center">J'ai déjà une sauvegarde à importer</button></div>`;
  if(st===1) return `<div class="onb">${dots}<h2>Ce qui part tout seul chaque mois.</h2><p class="muted">Loyer, électricité, internet, téléphone, assurance, crédit… Additionne tout ce qui tombe automatiquement.</p>
    <div class="card"><label class="f">Charges fixes par mois<input class="in num" id="obFixed" inputmode="decimal" placeholder="ex. 780" value="${esc(ob.fixed)}"></label>
    <div class="err" id="obErr"></div><div class="row">${back}<button class="btn pri" style="flex:1" data-ob="next">Continuer</button></div></div></div>`;
  if(st===2){const base=Math.max(0,inc-fix);
    return `<div class="onb">${dots}<h2>Ce que tu mets de côté, avant tout le reste.</h2><p class="muted">Il te reste ${fm0(base)} après tes charges. Même un petit montant chaque mois change tout. Tu pourras l'ajuster.</p>
    <div class="card"><div class="row">${[.1,.15,.2].map(r=>`<button class="btn sm ghost" data-ob-save="${Math.round(base*r/5)*5}">${Math.round(r*100)} % · ${fm0(Math.round(base*r/5)*5)}</button>`).join("")}</div>
    <label class="f">Épargne par mois<input class="in num" id="obSave" inputmode="decimal" placeholder="ex. 150" value="${esc(ob.save)}"></label>
    <div class="err" id="obErr"></div><div class="row">${back}<button class="btn pri" style="flex:1" data-ob="next">Voir mon budget</button></div></div></div>`;}
  return `<div class="onb">${dots}<h2>Voilà ton cadre.</h2>
    <div class="result"><div class="eyebrow" style="color:var(--mint)">Tu peux dépenser environ</div><div class="big num">${fm0(avail*12/52)}</div><div style="opacity:.85;margin-top:6px">par semaine, soit ${fm0(avail)} par mois pour le quotidien</div></div>
    <p class="muted small">Courses, sorties, shopping, transport : tout passe par ce montant. L'appli recalcule ta semaine chaque jour selon ce que tu as déjà dépensé. Des budgets par catégorie sont proposés, tu pourras les modifier dans Profil.</p>
    <div class="row">${back}<button class="btn pri" style="flex:1" data-ob="finish">C'est parti</button></div></div>`;
}
function obNext(){
  const map={0:["obIncome","income"],1:["obFixed","fixed"],2:["obSave","save"]};
  if(map[ob.step]){const [idd,key]=map[ob.step]; const v=$("#"+idd).value; const n=parseAmt(v||"0");
    if(ob.step===0&&!(n>0)){$("#obErr").textContent="Indique un montant supérieur à 0.";return;}
    if(isNaN(n)||n<0){$("#obErr").textContent="Ce montant n'est pas valide.";return;}
    ob[key]=String(n); }
  ob.step++; render(); const f=document.querySelector("#app input"); if(f) f.focus();
}
async function obFinish(){
  const inc=parseAmt(ob.income)||0, fix=parseAmt(ob.fixed)||0, sav=parseAmt(ob.save)||0, avail=Math.max(0,inc-fix-sav);
  const cats=DEF_CATS.map(([name,r],i)=>({id:"c"+i+uid().slice(-3),name,budget:Math.round(avail*r/5)*5,color:PALETTE[i]}));
  const potId=uid();
  phase="app"; tab="accueil";
  write("pots",potId,{id:potId,name:"Coussin de sécurité",target:Math.round((fix+avail)*3/50)*50||1000,deadline:"",balance:0,moves:[],color:PALETTE[0],createdAt:Date.now()});
  write("profile","profile",{v:2,income:inc,fixed:fix,save:sav,categories:cats,createdAt:Date.now()});
  render(); toast("Ton budget est prêt");
}

/* ---------- accueil ---------- */
function coachLine(c){
  if(!c.avail) return "Tes charges et ton épargne prennent tout. Revois tes montants dans Profil.";
  if(c.leftWeek<0) return `Semaine dépassée de ${fm0(-c.leftWeek)}. Plus de dépense plaisir jusqu'à lundi : ça sera retiré des semaines suivantes.`;
  if(c.leftToday<0) return `Tu as dépassé ta part du jour de ${fm0(-c.leftToday)}. Demain, fais une journée à zéro pour rattraper.`;
  if(c.daysLeftWeek===1) return `Dernier jour de la semaine : ${fm0(c.leftWeek)} encore dispo. Ce qui reste repart sur la suite du mois.`;
  if(c.spentWeek<c.dailyTarget*(c.daysInWeek-c.daysLeftWeek)*0.8) return "Tu es sous ton rythme cette semaine. Continue comme ça, c'est de la marge pour la fin du mois.";
  return `Pour tenir, garde en moyenne ${fm0(c.leftWeek/c.daysLeftWeek)} par jour jusqu'à ${c.we.toLocaleDateString("fr-FR",{weekday:"long"})}.`;
}
function vHome(c){
  const wpct=c.weekBudget?Math.min(100,c.spentWeek/c.weekBudget*100):0;
  const maxCol=Math.max(c.dailyTarget*1.5,...c.week.map(d=>d.spent),1);
  const range=`${c.ws.getDate()}${c.ws.getMonth()!==c.we.getMonth()?" "+c.ws.toLocaleDateString("fr-FR",{month:"short"}):""} – ${c.we.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}`;
  const P=c.P;
  const watch=(P.categories||[]).filter(k=>k.budget>0).map(k=>({...k,sp:c.byCat[k.id]||0,p:(c.byCat[k.id]||0)/k.budget})).sort((a,b)=>b.p-a.p).slice(0,3);
  const recent=Object.values(S.tx).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||0)-(a.createdAt||0)).slice(0,5);
  const projOver=c.projection-c.avail;
  return `
  ${prevCard(c)}
  <div class="hero">
    <div class="eyebrow">Cette semaine · ${range}</div>
    <div class="lead">Il te reste</div>
    <div class="big num ${c.leftWeek<0?"neg":""}">${c.leftWeek<0?"−":""}${fm0(Math.abs(c.leftWeek))}</div>
    <div class="sub">sur ${fm0(c.weekBudget)} prévus · ${fm0(c.spentWeek)} dépensés</div>
    <div class="wbar"><i class="${c.leftWeek<0?"over":""}" style="width:${c.leftWeek<0?100:wpct}%"></i></div>
    <div class="week" aria-label="Dépenses par jour cette semaine">
      ${c.week.map(d=>`<div class="wd ${d.inMonth?"":"out"} ${d.today?"today":""}" title="${d.n} : ${fm(d.spent)}"><div class="col"><i class="${d.spent>c.dailyTarget*1.0001&&d.inMonth?"over":""}" style="height:${Math.min(100,d.spent/maxCol*100)}%"></i></div><span class="l">${d.letter}</span></div>`).join("")}
    </div>
    <div class="hero-foot">
      <div><div class="k">Aujourd'hui, max</div><div class="v num">${fm0(Math.max(0,c.leftToday))}</div></div>
      <div><div class="k">Reste ce mois-ci</div><div class="v num">${c.remaining<0?"−":""}${fm0(Math.abs(c.remaining))}</div></div>
    </div>
    <div class="coach">${I.spark}<span>${esc(coachLine(c))}</span></div>
  </div>

  <div class="quick">
    <button class="qa" data-act="expense"><span class="ico" style="background:var(--surface-2)">${I.minus}</span>Noter une dépense</button>
    <button class="qa" data-act="deposit"><span class="ico" style="background:var(--accent-soft);color:var(--accent)">${I.piggy}</span>Mettre de côté</button>
    <button class="qa" data-tab="envies"><span class="ico" style="background:var(--want-soft);color:var(--want)">${I.bag}</span>J'ai une envie</button>
  </div>

  <div class="card">
    <div class="card-head"><h2 style="text-transform:capitalize">${c.now.toLocaleDateString("fr-FR",{month:"long"})}</h2><span class="small muted">jour ${c.day} sur ${c.dim}</span></div>
    <div class="stats3">
      <div><div class="s">Dépensé</div><div class="v num">${fm0(c.spent)}</div></div>
      <div><div class="s">Budget du mois</div><div class="v num">${fm0(c.avail)}</div></div>
      <div><div class="s">Fin de mois au rythme actuel</div><div class="v num" style="color:${projOver>0?"var(--danger)":"var(--accent)"}">${projOver>0?"+":"−"}${fm0(Math.abs(projOver))}</div></div>
    </div>
    <p class="small muted" style="margin-top:12px">${projOver>0?`À ce rythme, tu finis le mois ${fm0(projOver)} au-dessus de ton budget. Le dépassement sera à rattraper le mois prochain.`:`À ce rythme, il te restera ${fm0(-projOver)} en fin de mois.`}</p>
    ${c.catchup>0?`<p class="small" style="margin-top:6px">Ton budget inclut <b class="num">${fm0(c.catchup)}</b> de rattrapage ce mois-ci (${fm0(c.base)} sans rattrapage).</p>`:""}
  </div>
  ${c.activeCatchups.length?`<div class="card"><div class="card-head"><h2>Rattrapage en cours</h2><button class="link" data-tab="profil">Gérer</button></div>
    <div class="bud">${c.activeCatchups.map(x=>`<div class="bud-row"><div class="n">${x.from.startsWith("manuel")?"Montant ajouté":"Dépassement de "+monthName(x.from)} <span class="chip w num">−${fm0(x.per)}/mois</span></div>
      <div class="a num"><b>${x.doneMonths}</b> <span class="muted">/ ${x.months} mois</span></div>
      <div class="bar"><i style="width:${(x.doneMonths+(x.started?1:0))/x.months*100}%;background:var(--warn)"></i></div>
      <div class="small muted" style="grid-column:1/-1">${fm0(x.amount)} à récupérer, ${x.started?"en cours":"à partir de "+monthName(x.start)}, terminé fin ${monthName(x.end,{month:"long",year:"numeric"})}.</div></div>`).join("")}</div></div>`:""}

  ${watch.length?`<div class="card"><div class="card-head"><h2>À surveiller</h2><button class="link" data-tab="depenses">Tous les budgets</button></div><div class="bud">${watch.map(budRow).join("")}</div></div>`:""}

  <div class="card">
    <div class="card-head"><h2>Trésorerie</h2><button class="link" data-tab="tresorerie">Voir tout</button></div>
    <div class="row" style="justify-content:space-between;align-items:baseline"><div class="num" style="font-family:var(--display);font-size:30px;font-weight:800;letter-spacing:-.02em">${fm0(c.totalSaved)}</div><span class="small muted">${c.savedThisMonth>=0?"+":""}${fm0(c.savedThisMonth)} ce mois-ci</span></div>
    <div class="bud" style="margin-top:12px">${c.pots.slice(0,3).map(p=>`<div class="bud-row"><div class="n"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</div><div class="a num"><b>${fm0(p.balance)}</b>${p.target?` <span class="muted">/ ${fm0(p.target)}</span>`:""}</div><div class="bar"><i style="width:${p.pct*100}%;background:${p.color}"></i></div></div>`).join("")||`<div class="empty">Crée un projet d'épargne dans Trésorerie.</div>`}</div>
  </div>

  <div class="card">
    <div class="card-head"><h2>Dernières dépenses</h2><button class="link" data-tab="depenses">Historique</button></div>
    <div class="list">${recent.length?recent.map(txRow).join(""):`<div class="empty">Aucune dépense pour l'instant. Touche « Dépense » dès que tu paies quelque chose.</div>`}</div>
  </div>`;
}
function prevCard(c){
  if(!c.prevPending) return "";
  const pm=monthName(c.prevMk);
  if(c.prevDiff>0) return `<div class="card" style="box-shadow:inset 0 0 0 2px var(--warn),var(--shadow)">
    <div class="eyebrow" style="color:var(--warn)">Bilan de ${pm}</div>
    <h2 style="margin-top:6px">Tu as dépassé de <span class="num">${fm0(c.prevDiff)}</span>.</h2>
    <p class="small muted" style="margin-top:6px">${fm0(c.prevSpent)} dépensés pour ${fm0(c.prevAvail)} prévus. Choisis comment le récupérer : le montant sera retiré de tes prochains budgets.</p>
    <div class="row" style="margin-top:14px"><button class="btn pri" data-catchup="${c.prevDiff}" data-from="${c.prevMk}">Rattraper</button><button class="btn ghost" data-skip-prev="${c.prevMk}">Ne pas rattraper</button></div></div>`;
  return `<div class="card" style="box-shadow:inset 0 0 0 2px var(--accent),var(--shadow)">
    <div class="eyebrow" style="color:var(--accent)">Bilan de ${pm}</div>
    <h2 style="margin-top:6px">Il te reste <span class="num">${fm0(-c.prevDiff)}</span> du mois dernier.</h2>
    <p class="small muted" style="margin-top:6px">Bien joué. Mets-les de côté pour qu'ils ne repartent pas en dépenses.</p>
    <div class="row" style="margin-top:14px"><button class="btn pri" data-surplus="${-c.prevDiff}" data-from="${c.prevMk}">Mettre de côté</button><button class="btn ghost" data-skip-prev="${c.prevMk}">Plus tard</button></div></div>`;
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
function budRow(k){
  const sp=k.sp, b=+k.budget||0, p=b?sp/b:0;
  const chip=!b?`<span class="chip need">Sans budget</span>`:p>1?`<span class="chip d">Dépassé de ${fm0(sp-b)}</span>`:p>=.8?`<span class="chip w">Reste ${fm0(b-sp)}</span>`:`<span class="chip ok">Reste ${fm0(b-sp)}</span>`;
  const col=p>1?"var(--danger)":p>=.8?"var(--warn)":k.color;
  return `<div class="bud-row"><div class="n"><span class="dot" style="background:${k.color}"></span>${esc(k.name)} ${chip}</div>
    <div class="a num"><b>${fm0(sp)}</b> <span class="muted">/ ${b?fm0(b):"—"}</span></div>
    <div class="bar"><i style="width:${Math.min(100,p*100)}%;background:${col}"></i></div></div>`;
}
function txRow(t){
  const k=catOf(t.cat);
  return `<button class="tx" data-edit-tx="${t.id}"><div class="ic" style="background:${k.color}22;color:${k.color}">${esc((k.name||"?")[0])}</div>
    <div class="t"><b>${esc(t.note||k.name)}</b><span>${esc(k.name)} · ${dfmt(t.date,{day:"numeric",month:"short"})}</span></div>
    <div class="r"><span class="amt num">−${fm(t.amount)}</span><span class="chip ${t.kind==="envie"?"want":"need"}">${t.kind==="envie"?"Envie":"Besoin"}</span></div></button>`;
}

/* ---------- dépenses ---------- */
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
    <path d="${line} L${x(lp[0]).toFixed(1)} ${y(0)} L${x(0)} ${y(0)} Z" fill="var(--accent)" fill-opacity=".13"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(lp[0])}" cy="${y(lp[1])}" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>${ticks}</svg>`;
}
function vSpend(c){
  const P=c.P, cats=(P.categories||[]).map(k=>({...k,sp:c.byCat[k.id]||0}));
  const tot=cats.reduce((a,k)=>a+(+k.budget||0),0);
  const wp=c.spent?c.wants/c.spent*100:0;
  let all=Object.values(S.tx); if(txFilter!=="all") all=all.filter(t=>t.kind===txFilter);
  const months=[...new Set(all.map(t=>t.date.slice(0,7)))].sort().reverse();
  const shown=months.slice(0,histLimit);
  return `
  <div class="card">
    <div class="card-head"><h2>Budgets du mois</h2><span class="small muted num">${fm0(c.spent)} / ${fm0(c.avail)}</span></div>
    ${tot>c.avail+1?`<div class="alert w" style="margin-bottom:14px">${I.alert}<span>La somme de tes budgets (${fm0(tot)}) dépasse ton disponible de ${fm0(tot-c.avail)}. Baisse une catégorie dans Profil.</span></div>`:""}
    <div class="bud">${cats.map(budRow).join("")}</div>
  </div>
  <div class="card chart">
    <div class="card-head"><h2>Rythme du mois</h2><span class="small muted">pointillés = rythme idéal</span></div>
    ${paceChart(c)}
  </div>
  <div class="card">
    <div class="card-head"><h2>Besoins ou envies</h2><span class="chip ${wp>35?"w":"ok"}">${Math.round(wp)} % d'envies</span></div>
    <div style="display:flex;height:12px;border-radius:99px;overflow:hidden;background:var(--surface-2)"><i style="width:${100-wp}%;background:var(--accent)"></i><i style="width:${wp}%;background:var(--want)"></i></div>
    <div class="row small" style="margin-top:10px;gap:16px"><span><span class="dot" style="background:var(--accent);margin-right:6px"></span>Besoins ${fm0(c.spent-c.wants)}</span><span><span class="dot" style="background:var(--want);margin-right:6px"></span>Envies ${fm0(c.wants)}</span></div>
    <p class="small muted" style="margin-top:8px">Garde les envies sous 30 % de tes dépenses du mois.</p>
  </div>
  <div class="row" style="justify-content:space-between"><h2 style="font-size:20px">Historique</h2>
    <div class="filters">${[["all","Tout"],["besoin","Besoins"],["envie","Envies"]].map(([k,l])=>`<button data-filter="${k}" aria-pressed="${txFilter===k}">${l}</button>`).join("")}</div></div>
  ${shown.length?shown.map(m=>{
    const list=all.filter(t=>t.date.slice(0,7)===m).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||0)-(a.createdAt||0));
    let last="",html=""; list.forEach(t=>{if(t.date!==last){last=t.date;html+=`<div class="day-h">${dfmt(t.date,{weekday:"long",day:"numeric",month:"long"})}</div>`;}html+=txRow(t);});
    return `<div class="card"><div class="card-head" style="margin-bottom:0"><h2 style="text-transform:capitalize">${dfmt(m+"-15",{month:"long",year:"numeric"})}</h2><span class="num" style="font-weight:800">${fm(sum(list))}</span></div><div class="list">${html}</div></div>`;
  }).join(""):`<div class="card"><div class="empty">Aucune dépense ici.</div></div>`}
  ${months.length>histLimit?`<button class="btn ghost block" data-act="more">Afficher les mois précédents</button>`:""}`;
}

/* ---------- trésorerie ---------- */
function vTreso(c){
  const save=+c.P.save||0, pctMonth=save?Math.min(100,Math.max(0,c.savedThisMonth/save*100)):0;
  let alert="";
  if(c.needMonthly>save+1) alert=`<div class="alert w">${I.alert}<span>Tes projets demandent <b>${fm0(c.needMonthly)}</b> par mois, mais tu prévois d'épargner ${fm0(save)}. Repousse une échéance ou augmente ton épargne dans Profil.</span></div>`;
  else if(c.needMonthly>0) alert=`<div class="alert ok">${I.check}<span>Tes projets demandent ${fm0(c.needMonthly)} par mois. Ton épargne prévue (${fm0(save)}) suffit.</span></div>`;
  return `
  <div class="treso">
    <div class="eyebrow">Ma trésorerie</div>
    <div class="big num">${fm0(c.totalSaved)}</div>
    <p class="small muted" style="margin-top:6px">mis de côté dans ${c.pots.length} projet${c.pots.length>1?"s":""}</p>
    <div style="margin-top:16px"><div class="row" style="justify-content:space-between"><span class="small" style="font-weight:700">Versé ce mois-ci</span><span class="small num"><b>${fm0(c.savedThisMonth)}</b> <span class="muted">/ ${fm0(save)} prévus</span></span></div>
    <div class="bar" style="margin-top:8px"><i style="width:${pctMonth}%"></i></div></div>
    <div class="row" style="margin-top:16px"><button class="btn pri" data-act="deposit">${I.plus.replace("<svg","<svg width='18' height='18'")} Mettre de côté</button><button class="btn ghost" data-act="newpot">Nouveau projet</button></div>
  </div>
  ${alert}
  <div class="pots">${c.pots.map(p=>`
    <div class="pot">
      <div class="pot-top"><div style="min-width:0"><div class="row" style="gap:8px"><span class="dot" style="background:${p.color}"></span><h3>${esc(p.name)}</h3></div>
        <div class="small muted" style="margin-top:3px">${p.deadline?`Pour ${dfmt(p.deadline+"-15",{month:"long",year:"numeric"})}`:"Sans date"}</div></div>
        ${p.done?`<span class="chip ok">Atteint</span>`:p.monthsLeft?`<span class="chip need">${p.monthsLeft} mois</span>`:""}</div>
      <div><span class="bal num">${fm0(p.balance)}</span>${p.target?` <span class="muted num">/ ${fm0(p.target)}</span>`:""}</div>
      ${p.target?`<div class="bar"><i style="width:${p.pct*100}%;background:${p.color}"></i></div>`:""}
      ${p.perMonth?`<div class="need">Pour y arriver : <b class="num">${fm0(p.perMonth)}/mois</b> · soit <b class="num">${fm0(p.perWeek)}/semaine</b></div>`:p.done?"":p.target?`<div class="need">Ajoute une date pour savoir combien verser chaque mois.</div>`:""}
      <div class="row"><button class="btn sm pri" data-pot-in="${p.id}">Ajouter</button><button class="btn sm" data-pot-out="${p.id}">Retirer</button><button class="btn sm ghost" data-pot-open="${p.id}">Détails</button></div>
    </div>`).join("")||`<div class="card empty">Aucun projet. Crée-en un pour un voyage, un achat important ou un coussin de sécurité.</div>`}
  </div>
  <div class="card">
    <div class="card-head"><h2>Si tu tiens le rythme</h2></div>
    <div class="stats3">${[3,6,12].map(n=>`<div><div class="s">Dans ${n} mois</div><div class="v num">${fm0(c.totalSaved+save*n)}</div></div>`).join("")}</div>
    <p class="small muted" style="margin-top:10px">En versant ${fm0(save)} chaque mois, le jour de ta paie, avant de dépenser quoi que ce soit.</p>
  </div>`;
}

/* ---------- envies ---------- */
function vWishes(c){
  const now=Date.now();
  const w=c.wishes.filter(x=>x.status==="wait").sort((a,b)=>a.created-b.created);
  const done=c.wishes.filter(x=>x.status!=="wait").sort((a,b)=>(b.decided||0)-(a.decided||0)).slice(0,12);
  return `
  <div class="card">
    <div class="card-head"><h2>La règle des 48 heures</h2><span class="chip ok num">${fm0(c.skipped)} économisés</span></div>
    <p class="small muted">Un achat pas prévu te fait envie ? Note-le et attends 48 heures. Si tu y tiens toujours, tu décides. Sinon, l'argent reste à toi.</p>
    <form id="wishForm" style="display:grid;grid-template-columns:1fr 96px auto;gap:8px;margin-top:14px">
      <input class="in" id="wishName" placeholder="Ce qui te fait envie" maxlength="60">
      <input class="in num" id="wishPrice" placeholder="Prix" inputmode="decimal">
      <button class="btn dark" type="submit">Attendre</button>
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
  ${done.length?`<div class="card"><div class="card-head"><h2>Tes décisions</h2></div><div class="list">${done.map(x=>`<div class="wish"><div><b>${esc(x.name)}</b> <span class="num muted">· ${fm(x.price)}</span></div><span class="chip ${x.status==="skipped"?"ok":"want"}">${x.status==="skipped"?"Pas acheté":"Acheté"}</span></div>`).join("")}</div></div>`:""}
  <div class="card"><div class="row" style="justify-content:space-between"><div><div class="eyebrow">Série en cours</div><div style="font-family:var(--display);font-size:26px;font-weight:800">${c.streak} jour${c.streak>1?"s":""} sans achat plaisir</div></div></div>
  <p class="small muted" style="margin-top:6px">${c.streak>=7?"Belle série. Ne la casse pas pour un truc que tu auras oublié demain.":"Objectif : 7 jours d'affilée."}</p></div>`;
}

/* ---------- profil ---------- */
function vProfile(c){
  const P=c.P;
  return `
  <div class="card">
    <div class="card-head"><h2>Mon mois type</h2></div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <label class="f">Revenus nets par mois<input class="in num" id="pIncome" data-pf="income" inputmode="decimal" value="${P.income||""}"></label>
      <label class="f">Charges fixes par mois<input class="in num" id="pFixed" data-pf="fixed" inputmode="decimal" value="${P.fixed||""}"></label>
      <label class="f">Épargne par mois<input class="in num" id="pSave" data-pf="save" inputmode="decimal" value="${P.save||""}"></label>
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
      ${(P.categories||[]).map(k=>`<div class="catedit"><span class="dot" style="background:${k.color}"></span><input class="in" id="cn_${k.id}" data-cat-name="${k.id}" value="${esc(k.name)}" maxlength="24" aria-label="Nom"><input class="in num" id="cb_${k.id}" data-cat-budget="${k.id}" inputmode="decimal" value="${k.budget||""}" placeholder="€" aria-label="Budget"><button class="iconbtn" data-del-cat="${k.id}" aria-label="Supprimer ${esc(k.name)}">${I.trash}</button></div>`).join("")}
    </div>
    <div class="row" style="margin-top:12px"><button class="btn ghost" data-act="addcat">Ajouter une catégorie</button><button class="btn ghost" data-act="autobudget">Répartir automatiquement</button></div>
  </div>
  <div class="card">
    <div class="card-head"><h2>Mes données</h2></div>
    <p class="small muted">${mode==="cloud"?"Tout est enregistré dans une base de données liée à ton compte : tes dépenses, tes projets et tes envies te suivent sur tous tes appareils. Personne d'autre ne peut les lire, même si tu partages le lien.":"Tes données sont enregistrées dans ce navigateur, sur cet appareil uniquement. Exporte une sauvegarde de temps en temps : elle te permet de tout récupérer sur un autre téléphone ou si le navigateur est vidé."}</p>
    <p class="small muted" style="margin-top:8px">${Object.keys(S.tx).length} dépenses · ${Object.keys(S.pots).length} projets · ${Object.keys(S.wishes).length} envies</p>
    <div class="row" style="margin-top:12px"><button class="btn ghost" data-act="export">Exporter une sauvegarde</button><button class="btn ghost" data-act="import">Importer une sauvegarde</button><button class="btn ghost" data-act="reset" style="color:var(--danger)">Tout effacer</button></div>
  </div>`;
}

/* ============ sheets ============ */
function openModal(html,onMount){$("#modalSlot").innerHTML=`<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  $("#scrim").addEventListener("click",e=>{if(e.target.id==="scrim") closeModal();}); onMount&&onMount();}
function closeModal(){$("#modalSlot").innerHTML=""; if(dirty){dirty=false;render();}}
function toast(t){$("#toastSlot").innerHTML=`<div class="toast" role="status">${esc(t)}</div>`;clearTimeout(toast.t);toast.t=setTimeout(()=>$("#toastSlot").innerHTML="",2600);}
function confirmBox(title,text,label,fn){
  openModal(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Annuler</button><button class="btn danger" id="cfOk">${esc(label)}</button></div>`,()=>{$("#cfOk").onclick=()=>{closeModal();fn();};});
}

function expenseSheet(existing){
  const P=S.profile; const t=existing||{};
  let kind=t.kind||"besoin", cat=t.cat||P.categories[0]?.id;
  openModal(`<h2>${existing?"Modifier la dépense":"Nouvelle dépense"}</h2>
    <div class="amt-in"><input class="num" id="exAmt" inputmode="decimal" placeholder="0" value="${existing?String(t.amount).replace(".",","):""}" autocomplete="off" aria-label="Montant"><span>€</span></div>
    <div class="seg" role="group" aria-label="Type de dépense"><button type="button" data-kind="besoin">Besoin</button><button type="button" data-kind="envie">Envie</button></div>
    <div id="nudge" style="display:flex;flex-direction:column;gap:8px"></div>
    <div><div class="eyebrow" style="margin-bottom:8px">Catégorie</div><div class="cats">${P.categories.map(k=>`<button type="button" data-cat="${k.id}"><span class="dot" style="background:${k.color}"></span>${esc(k.name)}</button>`).join("")}</div></div>
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
      const tw=$("#toWish"); if(tw) tw.onclick=()=>{const id=uid(); write("wishes",id,{id,name:$("#exNote").value.trim()||(k?k.name:"Achat"),price:a,created:Date.now(),status:"wait"});closeModal();tab="envies";render();toast("En attente pendant 48 h");};
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
    <div><div class="eyebrow" style="margin-bottom:8px">Projet</div><div class="cats">${pots.map(p=>`<button type="button" data-psel="${p.id}" aria-pressed="${p.id===sel}"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join("")}</div></div>
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
    ${p?`<div><div class="eyebrow" style="margin:6px 0 4px">Mouvements</div>${hist.length?hist.map(m=>`<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span class="small">${dfmt(m.d,{day:"numeric",month:"short",year:"numeric"})}${m.note?" · "+esc(m.note):""}</span><b class="num" style="color:${m.amt>=0?"var(--accent)":"var(--danger)"}">${m.amt>=0?"+":"−"}${fm(Math.abs(m.amt))}</b></div>`).join(""):`<div class="small muted">Aucun mouvement.</div>`}</div>`:""}`,()=>{
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
      closeModal();tab="tresorerie";render();toast(p?"Projet mis à jour":"Projet créé");};
    if(p) $("#peDel").onclick=()=>{closeModal();confirmBox("Supprimer ce projet ?",`« ${p.name} » et son historique seront effacés. L'argent lui-même reste sur ton compte.`,"Supprimer",()=>{write("pots",p.id,null);render();toast("Projet supprimé");});};
    if(!p) setTimeout(()=>$("#peName").focus(),60);
  });
}

/* ============ sauvegarde (export / import) ============ */
function exportData(){
  const payload={app:"tirelire",version:2,exportedAt:new Date().toISOString(),data:S};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download="tirelire-sauvegarde-"+todayIso()+".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  toast("Sauvegarde téléchargée");
}
function importData(){
  const inp=document.createElement("input"); inp.type="file"; inp.accept="application/json,.json";
  inp.onchange=()=>{const f=inp.files&&inp.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{
      let d; try{const p=JSON.parse(rd.result); d=p&&p.app==="tirelire"?p.data:migrateV1(p);}catch(e){d=null;}
      if(!d||!d.profile||typeof d.tx!=="object"){toast("Ce fichier n'est pas une sauvegarde Tirelire.");return;}
      const n=Object.keys(d.tx).length;
      const go=()=>{
        for(const k of ["tx","pots","wishes"]) for(const id of Object.keys(S[k])) if(!(d[k]||{})[id]) write(k,id,null);
        for(const k of ["tx","pots","wishes"]) for(const [id,doc] of Object.entries(d[k]||{})) write(k,id,doc);
        write("profile","profile",d.profile);
        phase="app"; tab="accueil"; render(); toast(n+" dépenses importées");
      };
      if(S.profile) confirmBox("Remplacer tes données ?",`Tes données actuelles seront remplacées par la sauvegarde (${n} dépenses).`,"Importer",go); else go();
    };
    rd.readAsText(f);
  };
  inp.click();
}

/* ============ profile edits ============ */
function editProfile(fn){const P=S.profile; const np={...P,categories:P.categories.map(c=>({...c}))}; fn(np); write("profile","profile",np);}

/* ============ events ============ */
document.addEventListener("click",e=>{
  const t=e.target.closest("button"); if(!t) return;
  if(t.hasAttribute("data-close")){closeModal();return;}
  if(t.dataset.ob){ if(t.dataset.ob==="next") obNext(); else if(t.dataset.ob==="back"){ob.step--;render();} else obFinish(); return;}
  if(t.dataset.obSave){ob.save=t.dataset.obSave;$("#obSave").value=t.dataset.obSave;return;}
  if(t.dataset.tab){tab=t.dataset.tab;try{localStorage.setItem("tirelire_tab",tab);}catch(_){}render();window.scrollTo({top:0});return;}
  if(t.id==="fab"){expenseSheet();return;}
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
  if(a==="addcatchup"){catchupSheet(0,null);return;}
  if(a==="export"){exportData();return;}
  if(a==="import"){importData();return;}
  if(a==="expense"){expenseSheet();return;}
  if(a==="deposit"){potMoveSheet(null,1);return;}
  if(a==="newpot"){potEditSheet();return;}
  if(a==="more"){histLimit+=6;render();return;}
  if(a==="addcat"){editProfile(np=>np.categories.push({id:"c"+uid(),name:"Nouvelle catégorie",budget:0,color:PALETTE[np.categories.length%PALETTE.length]}));render();return;}
  if(a==="autobudget"){const c=calc(); confirmBox("Répartir automatiquement ?",`Les budgets seront recalculés à partir de tes ${fm0(c.avail)} disponibles, selon le poids habituel de chaque catégorie.`,"Répartir",()=>{
      editProfile(np=>{const n=np.categories.length; np.categories.forEach((k,i)=>{const d=DEF_CATS.find(x=>x[0]===k.name); k.budget=Math.round(c.avail*(d?d[1]:1/n)/5)*5;});
        const tot=np.categories.reduce((s,k)=>s+k.budget,0); if(tot>c.avail&&tot>0) np.categories.forEach(k=>k.budget=Math.floor(k.budget*c.avail/tot/5)*5);});render();toast("Budgets répartis");});return;}
  if(a==="reset"){confirmBox("Tout effacer ?","Dépenses, projets, envies et réglages seront supprimés définitivement de la base.","Tout effacer",async()=>{
      for(const k of ["tx","pots","wishes"]) for(const id of Object.keys(S[k])) write(k,id,null);
      if(mode==="cloud") chains["p"]=refFor("profile").delete().catch(()=>{});
      S={profile:null,tx:{},pots:{},wishes:{}}; saveLocal(); ob={step:0,income:"",fixed:"",save:""}; phase="onboarding"; render(); toast("Tout a été effacé");});return;}
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
document.addEventListener("submit",e=>{if(e.target.id!=="wishForm")return;e.preventDefault();
  const n=$("#wishName").value.trim(), p=parseAmt($("#wishPrice").value);
  if(!n||!(p>0)){$("#wishErr").textContent="Indique ce qui te fait envie et son prix.";return;}
  const id=uid(); write("wishes",id,{id,name:n,price:p,created:Date.now(),status:"wait"}); dirty=false; document.activeElement.blur(); render(); toast("Rendez-vous dans 48 h");});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&$("#scrim")) closeModal();
  if(e.key==="Enter"&&phase==="onboarding"&&e.target.tagName==="INPUT"){e.preventDefault();obNext();}
});
document.addEventListener("input",e=>{const el=e.target; if(el.id==="obSave") ob.save=el.value; if(el.id==="obIncome") ob.income=el.value; if(el.id==="obFixed") ob.fixed=el.value;});
document.addEventListener("change",e=>{
  const el=e.target; if(!S.profile) return;
  if(el.dataset.pf){const v=parseAmt(el.value||"0"); editProfile(np=>np[el.dataset.pf]=v>0?v:0); dirty=true; return;}
  if(el.dataset.catName){const v=el.value.trim(); if(v) editProfile(np=>{const k=np.categories.find(x=>x.id===el.dataset.catName); if(k) k.name=v;}); return;}
  if(el.dataset.catBudget){const v=parseAmt(el.value||"0"); editProfile(np=>{const k=np.categories.find(x=>x.id===el.dataset.catBudget); if(k) k.budget=v>0?v:0;}); dirty=true; return;}
});
setInterval(()=>{if(phase==="app"&&(tab==="envies"||tab==="accueil")) requestRender();},60000);

/* ============ boot ============ */
const cached=loadLocal();
if(cached){S=cached; phase=S.profile?"app":"onboarding";}
else{ try{const v1=migrateV1(JSON.parse(localStorage.getItem("tirelire_state")||"null")); if(v1){S=v1; saveLocal(); phase="app";}}catch(e){} }
render();
const fallback=setTimeout(()=>{ if(mode==="pending"){ mode="local"; if(phase==="loading") phase=S.profile?"app":"onboarding"; render(); } },11000);
connect().then(ok=>{ clearTimeout(fallback); if(!ok){ mode="local"; if(phase==="loading") phase=S.profile?"app":"onboarding"; render(); } });
})();
