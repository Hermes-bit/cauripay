/* Comptes : inscription et connexion par e-mail.
   - Si supabaseUrl et supabaseAnonKey sont remplis dans js/config.js : vrais comptes (Supabase),
     e-mail de confirmation, mot de passe oublié, données synchronisées entre appareils.
   - Sinon : mode démo, les comptes sont enregistrés dans ce navigateur uniquement. */
(function(){
"use strict";
const CFG=window.CAURIPAY_CONFIG||{};
const live=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey);
const SB_SRC="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
const TABLE="cauripay_data";
const here=()=>location.origin+location.pathname;
let sb=null;

function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("Le service de comptes ne répond pas. Vérifie ta connexion."));document.head.appendChild(s);});}
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}};
const put=(k,v)=>{try{v===null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const normEmail=e=>String(e||"").trim().toLowerCase();

/* ---------- messages d'erreur ---------- */
function frError(e){
  const m=String(e&&(e.message||e.error_description||e)||"");
  if(/invalid login credentials/i.test(m)) return "E-mail ou mot de passe incorrect.";
  if(/already registered|already exists/i.test(m)) return "Un compte existe déjà avec cet e-mail. Connecte-toi.";
  if(/email not confirmed/i.test(m)) return "Confirme d'abord ton adresse : clique sur le lien reçu par e-mail.";
  if(/rate limit|too many|security purposes/i.test(m)) return "Trop de tentatives. Patiente une minute avant de réessayer.";
  if(/password/i.test(m)&&/(weak|short|least|characters)/i.test(m)) return "Ce mot de passe est trop faible.";
  if(/invalid.*email|email.*invalid/i.test(m)) return "Cette adresse e-mail n'est pas valide.";
  if(/fetch|network|failed to/i.test(m)) return "Pas de connexion au service de comptes. Vérifie ton réseau.";
  return m||"Une erreur est survenue. Réessaie.";
}
const toUser=u=>u?{id:u.id,email:u.email,name:(u.user_metadata&&u.user_metadata.name)||"",confirmed:!!u.email_confirmed_at}:null;

/* ---------- mode démo : comptes dans ce navigateur ---------- */
const ACC="cauripay_accounts", SES="cauripay_session", FAIL="cauripay_auth_fail";
const b64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf)));
async function hashPw(pw,salt){
  if(!(window.crypto&&crypto.subtle)) throw new Error("Ouvre l'appli en https (ou avec Live Server) pour créer un compte.");
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode(salt),iterations:210000,hash:"SHA-256"},key,256);
  return b64(bits);
}
function lockCheck(email){const f=(read(FAIL)||{})[email]; if(f&&f.until>Date.now()) throw new Error("Trop de tentatives. Patiente une minute avant de réessayer.");}
function lockFail(email){const all=read(FAIL)||{}, f=all[email]||{n:0,until:0}; f.n++; if(f.n>=5){f.until=Date.now()+60e3;f.n=0;} all[email]=f; put(FAIL,all);}
function lockClear(email){const all=read(FAIL)||{}; delete all[email]; put(FAIL,all);}

const Local={
  async init(){return read(SES);},
  async signUp({email,password,name,consents}){
    email=normEmail(email); const accs=read(ACC)||{};
    if(accs[email]) throw new Error("Un compte existe déjà avec cet e-mail. Connecte-toi.");
    const salt=Math.random().toString(36).slice(2)+Date.now().toString(36);
    const id="loc_"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
    accs[email]={id,name,salt,hash:await hashPw(password,salt),createdAt:Date.now(),consents};
    put(ACC,accs);
    const u={id,email,name,confirmed:true}; put(SES,u); return {user:u};
  },
  async signIn({email,password}){
    email=normEmail(email); lockCheck(email);
    const a=(read(ACC)||{})[email];
    if(!a||await hashPw(password,a.salt)!==a.hash){lockFail(email);throw new Error("E-mail ou mot de passe incorrect.");}
    lockClear(email);
    const u={id:a.id,email,name:a.name,confirmed:true}; put(SES,u); return u;
  },
  async signOut(){put(SES,null);},
  async resetPassword(){throw new Error("En mode démo, aucun e-mail n'est envoyé : le mot de passe ne peut pas être réinitialisé.");},
  async updatePassword(){throw new Error("Indisponible en mode démo.");},
  async resend(){},
  async updateName(name){const s=read(SES); if(!s) return; const accs=read(ACC)||{}; if(accs[s.email]){accs[s.email].name=name;put(ACC,accs);} s.name=name; put(SES,s);},
  async deleteAccount(){const s=read(SES); if(!s) return; const accs=read(ACC)||{}; delete accs[s.email]; put(ACC,accs); put(SES,null);},
  onChange(){},
  async pull(){return null;},
  async push(){}
};

/* ---------- vrais comptes : Supabase ---------- */
const Live={
  async init(){
    await loadScript(SB_SRC);
    sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data,error}=await sb.auth.getSession(); if(error) throw new Error(frError(error));
    return toUser(data.session&&data.session.user);
  },
  async signUp({email,password,name,consents}){
    const {data,error}=await sb.auth.signUp({email:normEmail(email),password,options:{emailRedirectTo:here(),data:{name,...consents}}});
    if(error) throw new Error(frError(error));
    // Supabase renvoie un utilisateur sans identités quand l'e-mail est déjà pris (pour ne pas le révéler).
    if(data.user&&Array.isArray(data.user.identities)&&!data.user.identities.length) throw new Error("Un compte existe déjà avec cet e-mail. Connecte-toi.");
    return data.session?{user:toUser(data.user)}:{needsConfirm:true};
  },
  async signIn({email,password}){
    const {data,error}=await sb.auth.signInWithPassword({email:normEmail(email),password});
    if(error) throw new Error(frError(error)); return toUser(data.user);
  },
  async signOut(){await sb.auth.signOut();},
  async resetPassword(email){const {error}=await sb.auth.resetPasswordForEmail(normEmail(email),{redirectTo:here()}); if(error) throw new Error(frError(error));},
  async updatePassword(password){const {error}=await sb.auth.updateUser({password}); if(error) throw new Error(frError(error));},
  async resend(email){const {error}=await sb.auth.resend({type:"signup",email:normEmail(email),options:{emailRedirectTo:here()}}); if(error) throw new Error(frError(error));},
  async updateName(name){await sb.auth.updateUser({data:{name}});},
  async deleteAccount(){
    // supprime le compte et ses données (fonction delete_my_account de supabase/schema.sql)
    const {error}=await sb.rpc("delete_my_account"); if(error) throw new Error(frError(error));
    await sb.auth.signOut();
  },
  onChange(fn){sb.auth.onAuthStateChange((event,session)=>fn(event,toUser(session&&session.user)));},
  async pull(){const {data,error}=await sb.from(TABLE).select("data").maybeSingle(); if(error) throw error; return data?data.data:null;},
  async push(obj){
    const {data:{user}}=await sb.auth.getUser(); if(!user) throw new Error("Session expirée.");
    const {error}=await sb.from(TABLE).upsert({user_id:user.id,data:obj,updated_at:new Date().toISOString()}); if(error) throw error;
  }
};

// Règle CNIL (délibération 2022-100) pour un mot de passe seul :
// 12 caractères avec majuscule, minuscule, chiffre et caractère spécial, ou 14 caractères avec majuscule, minuscule et chiffre.
function checkPassword(p){
  p=String(p||"");
  const up=p!==p.toLowerCase(), lo=p!==p.toUpperCase(), di=/\d/.test(p), sp=/[^\p{L}\d]/u.test(p);
  return {len:p.length>=12, mix:up&&lo, digit:di, special:sp||p.length>=14,
    ok:(p.length>=12&&up&&lo&&di&&sp)||(p.length>=14&&up&&lo&&di)};
}

window.CauriPayAuth={live,checkPassword,frError,...(live?Live:Local)};
})();
