/* ======================================================================
   IMPLANTATION · VERSION AUTONOME (GitHub Pages)
   Remplace le serveur PHP d'origine :
   - api/modeles.php  -> catalogue chiffré (data/modeles.bin) + modèles ajoutés en local
   - api/projects.php -> projets enregistrés dans ce navigateur (IndexedDB)
   - api/account.php  -> profil du conseiller enregistré dans ce navigateur
   - api/proxy.php    -> relais Cloudflare (config.js) pour Géorisques et les documents PLU
   Le code de l'application, les tarifs et la notice sont chiffrés (AES-GCM, clé dérivée du mot de passe).
   ====================================================================== */
(function(){
'use strict';
const CFG=Object.assign({proxy:''},window.IMPLANT_CONFIG||{});
const LS={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const KEY_LS='implant:key', PROFILE_LS='implant:profil';
const realFetch=window.fetch.bind(window);
const enc=new TextEncoder(), dec=new TextDecoder();
const b64=u=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));

/* ---------------- chiffrement ---------------- */
let KEY=null, INFO=null;
async function keyInfo(){ if(!INFO) INFO=await (await realFetch('data/keyinfo.json',{cache:'no-store'})).json(); return INFO; }
async function deriveKey(pw){
  const ki=await keyInfo();
  const base=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:unb64(ki.salt),iterations:ki.iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},true,['decrypt']);
}
async function decryptFile(path){
  const ki=await keyInfo();
  const r=await realFetch(path+'?v='+ki.version); if(!r.ok) throw new Error('Fichier manquant : '+path);
  const buf=new Uint8Array(await r.arrayBuffer());
  return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:buf.subarray(0,12)},KEY,buf.subarray(12)));
}

/* ---------------- stockage local (IndexedDB) ---------------- */
let _db=null;
function idb(){ if(_db) return _db; _db=new Promise((res,rej)=>{ const q=indexedDB.open('implantation',1);
  q.onupgradeneeded=()=>{ const d=q.result; d.createObjectStore('projects',{keyPath:'id',autoIncrement:true}); d.createObjectStore('modeles',{keyPath:'id'}); };
  q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); }); return _db; }
async function tx(store,mode,fn){ const d=await idb(); return new Promise((res,rej)=>{ const t=d.transaction(store,mode), s=t.objectStore(store); let out; Promise.resolve(fn(s)).then(v=>out=v); t.oncomplete=()=>res(out); t.onerror=()=>rej(t.error); }); }
const reqP=q=>new Promise((res,rej)=>{ q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); });
const allOf=store=>tx(store,'readonly',s=>reqP(s.getAll()));
const getOne=(store,id)=>tx(store,'readonly',s=>reqP(s.get(id)));
const putOne=(store,v)=>tx(store,'readwrite',s=>reqP(s.put(v)));
const delOne=(store,id)=>tx(store,'readwrite',s=>reqP(s.delete(id)));

/* ---------------- profil ---------------- */
function profile(){ let p={}; try{ p=JSON.parse(LS.get(PROFILE_LS)||'{}')||{}; }catch(e){}
  const u=Object.assign({prenom:'',nom:'',email:'',agence:'',adresse:'',tel:'',photo:null},p);
  u.initiales=((u.prenom||'').trim().charAt(0)+(u.nom||'').trim().charAt(0)).toUpperCase(); return u; }
function saveProfile(u){ const c=Object.assign({},u); delete c.initiales; LS.set(PROFILE_LS,JSON.stringify(c)); return profile(); }
function shrinkPhoto(file){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>{ const N=320, c=document.createElement('canvas'); c.width=c.height=N; const s=Math.min(i.naturalWidth,i.naturalHeight);
  c.getContext('2d').drawImage(i,(i.naturalWidth-s)/2,(i.naturalHeight-s)/2,s,s,0,0,N,N); URL.revokeObjectURL(i.src); res(c.toDataURL('image/jpeg',0.88)); }; i.onerror=rej; i.src=URL.createObjectURL(file); }); }

/* ---------------- catalogue ---------------- */
let CAT=null;  // {light:[], details:{}}
const slug=s=>String(s||'modele').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'modele';
function lightOf(d){
  const sp=d.specs||{}, pn=d.prix&&d.prix.nord;
  return { id:d.id, nom:d.nom||d.id, gamme:d.gamme||'', famille:d.famille||'', surf:sp.surfaceSol!=null?sp.surfaceSol:((d.surfaces&&d.surfaces.habitation)||null),
    facade:sp.facade!=null?sp.facade:(d.facade||null), prof:sp.profondeur!=null?sp.profondeur:null, prix:pn?Object.assign({},pn):null,
    nbOpt:(d.options||[]).length, plan:!!d.plan, finitions:d.finitions||[], variante:d.variante||'', approx:!!d.approx, toit4pans:!!d.toit4pans, alerte:d.alerte||'' };
}
async function catalogue(){
  const base=CAT, local=await allOf('modeles').catch(()=>[]);
  const det=Object.assign({},base.details), order=base.light.map(l=>l.id), light=new Map(base.light.map(l=>[l.id,l]));
  local.forEach(m=>{ if(m.deleted){ light.delete(m.id); delete det[m.id]; return; } det[m.id]=m.model; if(!light.has(m.id)) order.push(m.id); light.set(m.id,Object.assign(lightOf(m.model),{local:true})); });
  return {light:order.filter(id=>light.has(id)).map(id=>light.get(id)), details:det};
}

/* ---------------- réponses simulées ---------------- */
const J=(o,status)=>new Response(JSON.stringify(o),{status:status||200,headers:{'Content-Type':'application/json'}});
async function body(init){ if(!init||init.body==null) return {}; if(init.body instanceof FormData) return init.body; try{ return JSON.parse(init.body); }catch(e){ return {}; } }
let UNLOCKED; const unlocked=new Promise(r=>UNLOCKED=r);

async function apiModeles(url,init){
  await unlocked;
  const c=await catalogue();
  if((init&&init.method||'GET').toUpperCase()==='POST'){
    const b=await body(init);
    if(b.action==='delete'){ const isBase=CAT.details[b.id]; if(isBase) await putOne('modeles',{id:b.id,deleted:true}); else await delOne('modeles',b.id); return J({ok:true}); }
    if(b.action==='save'){
      const m=JSON.parse(JSON.stringify(b.model||{}));
      if(m.imageData){ m.image=Object.assign({},m.image,{url:m.imageData}); delete m.imageData; }
      if(!m.id){ let id=slug(m.nom), k=2; while(c.details[id]) id=slug(m.nom)+'-'+(k++); m.id=id; }
      await putOne('modeles',{id:m.id,model:m,saved:Date.now()});
      return J({ok:true,id:m.id,model:m});
    }
    return J({error:'Action inconnue.'},400);
  }
  const id=url.searchParams.get('id');
  if(id){ const d=c.details[id]; return d?J(d):J({error:'Modèle introuvable'},404); }
  return J(c.light);
}

async function apiProjects(url,init){
  const now=new Date().toISOString();
  if((init&&init.method||'GET').toUpperCase()==='POST'){
    const b=await body(init);
    if(b.action==='save'){
      const rec={nom:String(b.nom||'Projet').slice(0,160),resume:b.resume||{},data:b.data,updated_at:now};
      if(b.id){ const old=await getOne('projects',+b.id); rec.id=+b.id; rec.created_at=old&&old.created_at||now; } else rec.created_at=now;
      const id=await putOne('projects',rec); return J({ok:true,id:+id,nom:rec.nom});
    }
    const p=await getOne('projects',+b.id); if(!p) return J({error:'Projet introuvable.'},404);
    if(b.action==='rename'){ p.nom=String(b.nom||'').trim().slice(0,160)||p.nom; p.updated_at=now; await putOne('projects',p); return J({ok:true,nom:p.nom}); }
    if(b.action==='duplicate'){ const c=Object.assign({},p); delete c.id; c.nom=p.nom+' (copie)'; c.created_at=c.updated_at=now; const id=await putOne('projects',c); return J({ok:true,id}); }
    if(b.action==='delete'){ await delOne('projects',p.id); return J({ok:true}); }
    return J({error:'Action inconnue.'},400);
  }
  const id=url.searchParams.get('id');
  if(id){ const p=await getOne('projects',+id); return p?J(p):J({error:'Projet introuvable.'},404); }
  const L=(await allOf('projects')).map(p=>({id:p.id,nom:p.nom,resume:p.resume,updated_at:p.updated_at})).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
  return J(L);
}

async function apiAccount(url,init){
  if((init&&init.method||'GET').toUpperCase()==='POST'){
    const b=await body(init), act=b instanceof FormData?b.get('action'):b.action;
    if(act==='update'){
      const u=profile(); ['prenom','nom','agence','adresse','tel'].forEach(k=>{ const v=b.get(k); if(v!=null) u[k]=String(v).trim(); });
      const em=document.querySelector('#f-account [name=email]'); if(em) u.email=em.value.trim();
      if(b.get('removePhoto')) u.photo=null;
      const f=b.get('photo'); if(f && f.size){ try{ u.photo=await shrinkPhoto(f); }catch(e){ return J({error:'Photo illisible.'},400); } }
      const nu=saveProfile(u); window.__USER__=nu; return J({ok:true,user:nu});
    }
    return J({error:"Cette version n'a pas de compte individuel : l'accès se fait avec le mot de passe commun."},400);
  }
  return J({user:profile(),csrf:'local'});
}

const DIRECT_HOSTS=['data.geopf.fr','apicarto.ign.fr','geo.api.gouv.fr'];   // acceptent les appels directs (CORS)
async function apiProxy(url){
  const u=url.searchParams.get('u'); let host=''; try{ host=new URL(u).hostname; }catch(e){}
  if(DIRECT_HOSTS.includes(host)) return realFetch(u,{cache:'no-store'});
  const blocked=(CFG.blockedHosts||[]);
  if(!CFG.proxy || blocked.includes(host)) return J({error:"Service non joignable depuis cette version (relais indisponible pour "+host+")."},503);
  const t=new URL(CFG.proxy); t.searchParams.set('u',u); if(url.searchParams.get('bin')) t.searchParams.set('bin','1');
  return realFetch(t.toString(),{cache:'no-store'});
}

let noticeBlob=null;
async function notice(){ await unlocked; if(!noticeBlob) noticeBlob=await decryptFile('data/notice.bin'); return new Response(noticeBlob,{headers:{'Content-Type':'application/pdf'}}); }

window.fetch=async function(input,init){
  const raw=typeof input==='string'?input:(input&&input.url)||String(input);
  let url; try{ url=new URL(raw,location.href); }catch(e){ return realFetch(input,init); }
  if(url.origin===location.origin){
    const p=url.pathname;
    try{
      if(/\/api\/modeles\.php$/.test(p)) return await apiModeles(url,init);
      if(/\/api\/projects\.php$/.test(p)) return await apiProjects(url,init);
      if(/\/api\/account\.php$/.test(p)) return await apiAccount(url,init);
      if(/\/api\/proxy\.php$/.test(p)) return await apiProxy(url);
      if(/NOTICE_EQUATION[^/]*\.pdf$/.test(p)) return await notice();
    }catch(e){ console.error('[implant]',e); return J({error:(e&&e.message)||'Erreur locale.'},500); }
  }
  return realFetch(input,init);
};

/* ---------------- sauvegarde / restauration (projets + modèles ajoutés) ---------------- */
async function exportAll(){
  const data={app:'implantation',version:1,date:new Date().toISOString(),profil:profile(),projets:await allOf('projects'),modeles:await allOf('modeles')};
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
  a.download='implantation-sauvegarde-'+new Date().toISOString().slice(0,10)+'.json'; document.body.appendChild(a); a.click(); a.remove();
}
async function importAll(file,msg){
  try{ const d=JSON.parse(await file.text()); if(d.app!=='implantation') throw new Error();
    let n=0; for(const p of d.projets||[]){ const c=Object.assign({},p); delete c.id; await putOne('projects',c); n++; }
    for(const m of d.modeles||[]) await putOne('modeles',m);
    if(d.profil && !profile().nom) saveProfile(d.profil);
    msg(`${n} projet${n>1?'s':''} importé${n>1?'s':''}${(d.modeles||[]).length?' et '+d.modeles.length+' modèle(s)':''}.`,true);
  }catch(e){ msg("Ce fichier n'est pas une sauvegarde de l'outil d'implantation.",false); }
}
function addBackupUi(){
  const dlg=document.getElementById('dlg-projects'); if(!dlg || dlg.querySelector('.bk-row')) return;
  const ft=dlg.querySelector('.ft')||dlg.querySelector('form')||dlg;
  const row=document.createElement('div'); row.className='bk-row';
  row.innerHTML='<p class="fine bk-note">Les projets sont enregistrés dans ce navigateur. Exportez une sauvegarde pour les garder en sécurité ou les retrouver sur un autre poste.</p><div class="bk-btns"><button type="button" class="sm" id="bk-exp">Exporter une sauvegarde</button><label class="sm bk-imp" for="bk-file">Importer une sauvegarde</label><input type="file" id="bk-file" accept=".json,application/json" hidden></div>';
  ft.parentNode.insertBefore(row,ft);
  row.querySelector('#bk-exp').addEventListener('click',exportAll);
  row.querySelector('#bk-file').addEventListener('change',async e=>{ const f=e.target.files[0]; if(!f) return; const m=document.getElementById('pj-msg');
    await importAll(f,(t,ok)=>{ if(m){ m.textContent=t; m.className='msg '+(ok?'ok':'err'); } }); e.target.value='';
    const b=document.getElementById('btn-projects'); if(b){ dlg.close(); b.click(); } });
}

/* ---------------- verrou ---------------- */
const gate=document.getElementById('gate');
function gateMsg(t){ const m=document.getElementById('g-msg'); m.textContent=t||''; }
async function tryUnlock(key,remember){
  KEY=key;
  const code=dec.decode(await decryptFile('data/app.bin'));   // échoue si la clé est mauvaise
  CAT=JSON.parse(dec.decode(await decryptFile('data/modeles.bin')));
  if(remember){ const raw=new Uint8Array(await crypto.subtle.exportKey('raw',key)); LS.set(KEY_LS,JSON.stringify({v:INFO.version,k:b64(raw)})); }
  return code;
}
function needProfile(){ const u=profile(); return !(u.prenom&&u.nom); }
function start(code){
  window.__USER__=profile(); window.__CSRF__='local';
  const s=document.createElement('script'); s.textContent=code; document.body.appendChild(s);
  const f=document.createElement('script'); f.src='vendor/faq-aide.js'; document.body.appendChild(f);
  UNLOCKED();
  gate.remove(); document.documentElement.classList.remove('locked');
  addBackupUi();
  document.querySelectorAll('a[href*="verrouiller"]').forEach(a=>a.addEventListener('click',e=>{ e.preventDefault(); LS.del(KEY_LS); location.replace(location.pathname); }));
}
async function boot(){
  const qs=new URLSearchParams(location.search);
  if(qs.has('verrouiller')){ LS.del(KEY_LS); history.replaceState(null,'',location.pathname); }
  await keyInfo();
  let code=null;
  const st=LS.get(KEY_LS);
  if(st){ try{ const o=JSON.parse(st); if(o.v===INFO.version){ const k=await crypto.subtle.importKey('raw',unb64(o.k),{name:'AES-GCM'},true,['decrypt']); code=await tryUnlock(k,false); } }catch(e){ LS.del(KEY_LS); KEY=null; } }
  if(code && !needProfile()) return start(code);
  gate.hidden=false;
  const f=document.getElementById('g-form'), pf=document.getElementById('g-profile');
  if(code){ f.querySelector('.g-pw').hidden=true; }
  pf.hidden=!needProfile();
  const u=profile(); ['prenom','nom','email','agence','adresse','tel'].forEach(k=>{ const i=f.elements['g-'+k]; if(i) i.value=u[k]||''; });
  f.addEventListener('submit',async e=>{
    e.preventDefault(); gateMsg(''); const btn=f.querySelector('button[type=submit]'); btn.disabled=true; btn.textContent='Déverrouillage…';
    try{
      if(!code){ const pw=f.elements['g-pw'].value; if(!pw){ throw new Error('Saisissez le mot de passe.'); }
        try{ code=await tryUnlock(await deriveKey(pw),f.elements['g-rem'].checked); }catch(err){ KEY=null; throw new Error('Mot de passe incorrect.'); } }
      if(!pf.hidden){ const nu=profile(); ['prenom','nom','email','agence','adresse','tel'].forEach(k=>{ nu[k]=(f.elements['g-'+k].value||'').trim(); });
        if(!nu.prenom||!nu.nom){ pf.hidden=false; f.querySelector('.g-pw').hidden=true; throw new Error('Renseignez au moins votre prénom et votre nom (ils figurent sur les PDF).'); }
        saveProfile(nu); }
      start(code);
    }catch(err){ gateMsg(err.message); btn.disabled=false; btn.textContent='Ouvrir l’outil'; }
  });
  (f.querySelector('.g-pw:not([hidden]) input')||f.elements['g-prenom']).focus();
}
boot().catch(e=>{ console.error(e); gate.hidden=false; gateMsg("L'outil n'a pas pu démarrer : "+(e.message||e)); });
})();
