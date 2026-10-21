/* Lecture assistée d'un règlement de PLU : repère le chapitre de la zone puis propose les règles chiffrées
   (emprise au sol, pleine terre, retraits, hauteurs, voies) avec la phrase source et la page.
   Entrée : pages = tableau de textes (une chaîne par page, lignes séparées par \n), zone = code de zone du plan de zonage. */
(function(root){
  'use strict';
  const NUM='(\\d{1,3}(?:[ \\u00a0]\\d{3})*(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?)';
  const toNum=s=>parseFloat(String(s).replace(/[ \u00a0]/g,'').replace(',','.'));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const isToc=t=>(t.match(/\.{5,}|…{3,}/g)||[]).length>=6;

  /* ---------- repérage du chapitre de la zone ---------- */
  function codeCandidates(zone){
    const z=String(zone||'').trim(), out=[]; if(!z) return out;
    out.push(z);
    let c=z; while(c.length>1){ c=c.replace(/[a-z0-9]$/,'').replace(/[A-Z](?=[a-z0-9]*$)(?<=.{3,})/,m=>m); if(out.includes(c)||c===z) { if(c===z) c=c.slice(0,-1); else break; } out.push(c); }
    const base=(z.match(/^[A-Za-z]+/)||[''])[0]; if(base) out.push(base);
    for(let k=base.length-1;k>=1;k--) out.push(base.slice(0,k));
    return [...new Set(out.filter(Boolean))];
  }
  function articleRe(code){ return new RegExp('(?:ARTICLE|Article)\\s+'+esc(code)+'\\s*[.\\-–:]?\\s*(\\d{1,2})\\b','g'); }
  function findChapter(pages, zone){
    for(const code of codeCandidates(zone)){
      const re=articleRe(code), hits=[];
      pages.forEach((t,i)=>{ if(isToc(t)) return; re.lastIndex=0; let m; while((m=re.exec(t))) hits.push({i,n:+m[1]}); });
      const nums=new Set(hits.map(h=>h.n));
      if(nums.size>=4){
        const first=Math.min(...hits.map(h=>h.i));
        const lastRaw=Math.max(...hits.filter(h=>h.i<=first+70).map(h=>h.i));
        return {code, start:first, end:lastRaw, via:'articles'};
      }
    }
    for(const code of codeCandidates(zone)){      // en-tête de page « ZONE UH »
      const re=new RegExp('(?:^|\\n)\\s*(?:ZONE|Zone|CHAPITRE [IVX\\d]+\\s*[-–:]?\\s*ZONE)\\s+'+esc(code)+'\\b'), ix=[];
      pages.forEach((t,i)=>{ if(!isToc(t) && re.test(t.slice(0,420))) ix.push(i); });
      if(ix.length>=2) return {code,start:ix[0],end:ix[ix.length-1],via:'en-tête'};
    }
    return null;
  }
  function listZones(pages){
    const seen={}; const re=/(?:ARTICLE|Article)\s+([A-Z]{1,4}[a-z]?\d?)\s*[.\-–:]?\s*1\b/g;
    pages.forEach((t,i)=>{ if(isToc(t)) return; re.lastIndex=0; let m; while((m=re.exec(t))){ if(!(m[1] in seen)) seen[m[1]]=i; } });
    return seen;
  }

  /* ---------- découpage du chapitre en blocs thématiques ---------- */
  const TOPICS=[
    ['emprise',   /emprise au sol|coefficient d.emprise|\bces\b/],
    ['hauteur',   /\bhauteurs?\b/],
    ['limites',   /limites? (s[eé]paratives?|lat[eé]rales?|de fond|de propri|aboutissant)|par rapport aux limites|aux limites/],
    ['desserte',  /desserte|voirie|\bacc[eè]s\b|conditions? de desserte/],
    ['voie',      /implantation[^.]{0,60}(voies?|emprises?|alignement)|(voies?|emprises?) publiques?|alignement|marges? de recul|\brecul\b|par rapport aux voies/],
    ['pleineTerre',/pleine terre|espaces? (libres|verts|non b[aâ]tis|perm[eé]ables)|surfaces? (non imperm|perm[eé]ables|v[eé]g[eé]talis|[eé]co-am[eé]nag)|coefficient de (biotope|pleine terre|v[eé]g)|\bplantations?\b|biotope|traitement (environnemental|paysager)|espaces? non b[aâ]tis/],
    ['aspect',    /aspect (ext[eé]rieur|des constructions)|toitures?|couvertures?|fa[cç]ades?|cl[oô]tures?|qualit[eé] (urbaine|architecturale)/],
    ['stationnement',/stationnement/]
  ];
  const PLAIN_HEAD=/^(?:l.|les? |la )?(emprise au sol|hauteur(?: maximale| des constructions)?|implantation des constructions(?: par rapport| sur)?[^.]{0,70}|implantation par rapport[^.]{0,70}|recul[^.]{0,40}|espaces? (?:libres|verts|non b[aâ]tis)[^.]{0,50}|pleine terre|coefficient de [^.]{0,40}|desserte[^.]{0,60}|acc[eè]s et voirie|voirie|stationnement[^.]{0,40})\s*:?$/i;
  const HEAD_RE=/^\s*(?:(?:ARTICLE|Article)\s+\S+\s*[.\-–:]?\s*\d{1,2}\b|\d{1,2}(?:\.\d{1,2}){0,3}\.?\s+[A-ZÉÈÀa-zéèà][^.]{3,100}$|(?:SECTION|Section|CHAPITRE|Chapitre|Paragraphe|PARAGRAPHE)\s+[IVX\d]+\b.*|[IVX]{1,4}\.\d?\s*[-–]\s*\S.*|[A-Z]\)?\s*[-–.]\s+[A-ZÉ][^.]{3,90}$)/;
  function topicOf(head){ const h=norm(head); for(const [k,re] of TOPICS){ if(re.test(h)) return k; } return null; }
  function blocks(pages, ch){
    const out=[]; let cur={topic:null,head:'(début)',lines:[],page:ch.start+1};
    for(let i=ch.start;i<=ch.end;i++){
      const lines=pages[i].split('\n');
      lines.forEach(line=>{
        const l=line.trim(); if(!l) return;
        if(/^(Accus[eé] de r[eé]ception|Date de (t[eé]l[eé]transmission|r[eé]ception)|PLU |Plan Local|Page \d+|\d{1,3}$)/.test(l)) return;
        const isHead=(HEAD_RE.test(l) && l.length<130) || (l.length<90 && PLAIN_HEAD.test(l));
        if(isHead){
          const tp=topicOf(l);
          if(tp || /^(ARTICLE|Article)\s/.test(l)){ out.push(cur); cur={topic:tp,head:l,lines:[],page:i+1}; return; }
          cur.lines.push({t:l,p:i+1}); return;      // sous-titre sans thème : même bloc
        }
        cur.lines.push({t:l,p:i+1});
      });
    }
    out.push(cur); return out.filter(b=>b.lines.length||b.topic);
  }

  /* ---------- extraction des valeurs ---------- */
  function sentences(b){
    const txt=b.lines.map(x=>x.t).join(' ').replace(/\s+/g,' ');
    return txt.split(/(?<=[.;:!?])\s+(?=[A-ZÉÈÀÂ\-–•]|o\s)/).map(s=>s.trim()).filter(Boolean);
  }
  const pageOf=(b,frag)=>{ const l=b.lines.find(x=>x.t.includes(frag.slice(0,24))); return l?l.p:b.page; };
  function cut(s,n){ s=s.replace(/\s+/g,' ').trim(); return s.length>n?s.slice(0,n-1)+'…':s; }
  function win(s,i,b,a){ b=b||170; a=a||120; let x=Math.max(0,i-b), y=Math.min(s.length,i+a); if(x>0){ const sp=s.indexOf(' ',x); if(sp>=0&&sp<i) x=sp+1; } if(y<s.length){ const sp=s.lastIndexOf(' ',y); if(sp>i) y=sp; } return (x>0?'… ':'')+s.slice(x,y).replace(/\s+/g,' ').trim()+(y<s.length?' …':''); }
  const MRE='(\\d{1,3}(?:[ \\u00a0]\\d{3})*(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?)\\s*(?:m(?:[eè]tres?)?\\b|M\\b)';
  /* nombres en mètres d'une phrase, avec la clause qui les suit et le début de phrase */
  function metreItems(s){
    const re=new RegExp(MRE,'g'), found=[]; let m;
    while((m=re.exec(s))){ const v=toNum(m[1]); if(v>=0&&v<400) found.push({v,i:m.index,e:m.index+m[0].length}); }
    found.forEach((f,k)=>{ f.next=k+1<found.length?found[k+1].i:s.length; f.after=s.slice(f.e,Math.min(f.next,f.e+110)); f.before=s.slice(Math.max(k?found[k-1].e:0,f.i-150),f.i); });
    const lead=found.length?s.slice(0,found[0].i):s;
    return {items:found,lead};
  }
  function pctItems(s){
    const re=new RegExp(NUM+'\\s*(?:%|pour ?cent)','g'), out=[]; let m;
    while((m=re.exec(s))){ const v=toNum(m[1]); if(v>0&&v<=100) out.push({v,i:m.index,before:s.slice(Math.max(0,m.index-120),m.index),after:s.slice(m.index+m[0].length,m.index+m[0].length+90)}); }
    return out;
  }
  const SECTOR=/(^|[^a-z])(dans|en|pour|au sein d)[^.,;:]{0,14}(le |les |l.)?(sous-?)?secteurs? [a-z]{1,4}[a-z0-9]*\b|(sous-?)?secteurs? [a-z]{1,3}[0-9a-z]*\s*[:,(]/i;
  const EXCEPT=/(equipements? d.interet|equipements? collectifs?|services? publics?|\beicsp\b|annexes?|abris?|garages?|existantes?|existant|extension|surelevation|reconstruction|piscines?|serres?|toutefois|sauf|a titre derogatoire|derogation)/;
  const GENERAL=/(regle generale|dispositions? generales?|constructions? (nouvelles?|principales?|doivent|sont|s.implant)|l.emprise au sol (maximale|des constructions)|ne peut (pas )?exc)/;

  function rEmprise(B){
    const strict=B.length&&B[0].topic==='all'; const r={pct:null,cands:[],none:false};
    B.forEach(b=>{ sentences(b).forEach(s=>{ const n=norm(s); if(strict){ if(!/(emprise au sol|coefficient d.emprise|\bces\b)/.test(n)) return; } else if(!/(emprise|\bces\b|surface bati|bati)/.test(n)&&!/(superficie|terrain|unite fonciere|parcelle)/.test(n)) return;
      pctItems(s).forEach(p=>{ const ctx=n.slice(Math.max(0,n.indexOf(String(p.v).replace('.',','))-90),n.length);
        r.cands.push({v:p.v,ctx:win(s,p.i),page:pageOf(b,s),score:(GENERAL.test(n)?3:0)+(/(emprise)/.test(n)?2:0)-(EXCEPT.test(n.slice(0,120))?4:0)-(SECTOR.test(s.slice(0,110))?2:0), sect:SECTOR.test(s.slice(0,110))}); }); }); });
    if(r.cands.length){ const best=[...r.cands].sort((a,b)=>b.score-a.score)[0]; r.pct=best.v; r.sect=!!best.sect; r.sure=r.cands.filter(c=>c.v!==best.v&&c.score>=best.score-1).length===0; }
    else r.none=B.some(b=>/(non reglement|pas (fixe|de regle|reglement)|sans objet|neant|n.est pas reglement)/.test(norm(b.lines.map(x=>x.t).join(' ')).slice(0,500)));
    return r;
  }
  function rPleineTerre(B){
    const r={pct:null,cands:[],none:false};
    B.forEach(b=>{ sentences(b).forEach(s=>{ const n=norm(s);
      if(!/(pleine terre|espaces? (verts|libres|non b)|non imperm|permeable|vegetalis|biotope|plantes?|surfaces? (libres|vertes))/.test(n)) return;
      const PI=pctItems(s), anyNear=PI.some(p=>/pleine terre/.test(norm(p.after.slice(0,45)+' '+p.before.slice(-30))));
      const moitie=/dont (la moitie|au moins la moitie|50 ?%)|dont la moitie/.test(n)&&!anyNear;
      PI.forEach(p=>{ const near=norm(p.after.slice(0,45)+' '+p.before.slice(-30)); const pt=/pleine terre/.test(near)||(!anyNear&&/pleine terre/.test(n));
        if(moitie){ r.cands.push({v:Math.round(p.v/2*10)/10,ctx:win(s,p.i),page:pageOf(b,s),sect:SECTOR.test(s.slice(0,110)),pt:true,derive:'moitié de '+p.v+' %',score:9}); return; }
        r.cands.push({v:p.v,ctx:win(s,p.i),page:pageOf(b,s),sect:SECTOR.test(s.slice(0,110)),pt,score:(pt?8:0)+(/(dont|moitie|au moins la moitie)/.test(n)&&!pt?-2:0)+(/(minimum|au moins|au minimum|doivent|obligatoire|reserve|traites?|consacr|amenag)/.test(n)?2:0)+(/(superficie|surface|terrain|unite fonciere|parcelle)/.test(n)?1:0)-(EXCEPT.test(n.slice(0,140))?4:0)}); }); }); });
    if(r.cands.length){ const best=[...r.cands].sort((a,b)=>b.score-a.score)[0]; r.pct=best.score>=1?best.v:null; r.sect=!!best.sect; r.sure=r.cands.filter(c=>c.v!==best.v&&c.score>=best.score-1).length===0; }
    return r;
  }
  function rVoie(B){
    const strict=B.length&&B[0].topic==='all'; const r={m:null,alignement:false,cands:[]};
    B.forEach(b=>{ sentences(b).forEach(s=>{ const n=norm(s);
      if(/(a l.alignement (ou|des|actuel|existant)|soit a l.alignement|alignement ou (en )?retrait|implant\w+ (a|sur) l.alignement|en limite d.emprise)/.test(n)) r.alignement=true;
      if(!/(retrait|recul|distance|marge|implant|alignement|reculees?)/.test(n)) return;
      if(strict && !(/(voies?|emprises? publiques?|alignement|rue)/.test(n) && /(retrait|recul|marge|implant)/.test(n)) ) return;
      if(strict && /(limites? separatives?|limites? lateral|fond de parcelle)/.test(n) && !/(voie|alignement|emprise)/.test(n)) return;
      metreItems(s).items.forEach(x=>{ if(x.v<1||x.v>15) return;
        const loc=norm(x.before+' '+x.after);
        if(/(hauteur|largeur|longueur|egout|faitage|\bm2\b|par logement)/.test(norm(x.after).slice(0,25))) return;
        const score=(GENERAL.test(n)?3:0)+(/(minimum|minimale|au moins|au minimum|egale? a|egal a|distance de)/.test(loc)?3:0)+(/(constructions?|batiments?)/.test(n)?1:0)+(/(alignement|voies?|emprises?)/.test(n)?1:0)
          -(EXCEPT.test(n.slice(0,170))?5:0)-(/(en cas de|lorsque|dans le cas|hors|sentier|cours d.eau|berge|riviere|voie ferree|autoroute|route departementale|talus|ravin|axe)/.test(n.slice(0,90))?3:0);
        r.cands.push({v:x.v,ctx:win(s,x.i),page:pageOf(b,s),score}); }); }); });
    if(r.cands.length){ const best=[...r.cands].sort((a,b)=>b.score-a.score||a.page-b.page)[0]; r.m=best.score>=2?best.v:null; r.sure=r.cands.filter(c=>c.v!==best.v&&c.score>=best.score-1).length===0; }
    return r;
  }
  function rLimites(B){
    const strict=B.length&&B[0].topic==='all'; const r={sansVue:null,avecVue:null,fond:null,fondCands:[],bande:null,formule:'',minFormule:null,limiteAutorisee:false,cands:[]};
    const SANS=/(ne comporte pas|ne comportant pas|sans (vue|ouverture|baie|fenetre)|aucune (ouverture|vue|baie)|pas d.ouverture|pas de vue|depourvu|facade aveugle|mur aveugle|non comportant)/g;
    const AVEC=/(vues? directes?|au moins une baie|comporte(nt)? (des )?(baies?|ouvertures?|vues?)|baies?|ouvertures? creant|fenetres?|pieces? principales?|jours? de souffrance)/g;
    const lastIdx=(re,t)=>{ let m,l=-1; re.lastIndex=0; while((m=re.exec(t))) l=m.index; return l; };
    const best={sans:null,avec:null,fond:null,defaut:null}; const take=(k,c)=>{ if(!best[k]||c.score>best[k].score) best[k]=c; };
    B.forEach(b=>{ sentences(b).forEach(s=>{ const n=norm(s); if(strict && !/limites? (separatives?|lateral|de fond|de propriete|aboutissant)|limites? sep/.test(n)) return;
      const bm=n.match(/bande de (\d+(?:[.,]\d+)?)\s*(?:m\b|metres?)/); if(bm && r.bande==null) r.bande=toNum(bm[1]);
      if(/(sur (une|l.une|les|la) (des |ou les )?limites?|en limite|a la limite|limite separative ou en retrait|ou en retrait|peuvent s.implanter sur|soit sur)/.test(n)) r.limiteAutorisee=true;
      const fm=n.match(/(l\s*=\s*h\s*\/\s*2|h\s*\/\s*2|moitie de (la|leur|sa) hauteur|egale? (a|au) la moitie|h\s*\/\s*3|tiers de la hauteur)/);
      if(fm && !r.formule){ r.formule=/h\s*\/\s*3|tiers/.test(fm[0])?'H/3':'H/2'; const mm=n.match(/(?:minimum|au moins|avec un minimum|min\.?)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(?:m\b|metres?)/); if(mm) r.minFormule=toNum(mm[1]); }
      const {items,lead}=metreItems(s); const leadN=norm(lead);
      const fondSent=/(fond de (parcelle|terrain|propriete)|limites? de fond|limites? posterieures?|au fond)/.test(leadN)||/(fond de (parcelle|terrain|propriete)|limites? de fond)/.test(n.slice(0,170));
      const lateral=/(laterales?|separatives?)/.test(n)&&!fondSent;
      items.forEach(x=>{ if(x.v<1||x.v>40) return;
        const bef=norm(x.before), aft=norm(x.after.slice(0,70));
        if(/(largeur|profondeur|superieure? ou egale?|inferieure? ou egale?|inferieure? a|superieure? a|plus de|moins de|jusqu.a|au-dela|depasse)/.test(norm(x.before.slice(-45)))||/^\s*(de largeur|de profondeur|de facade|de large)/.test(aft.slice(0,20))) return;
        if(/(hauteur|longueur|largeur)/.test(aft.slice(0,22)) && !/(retrait|distance|marge)/.test(n)) return;
        const iS=Math.max(lastIdx(SANS,bef),(()=>{ const m=aft.match(/^[^.;]{0,50}?(ne comporte pas|sans (vue|ouverture|baie)|aucune (ouverture|vue)|pas d.ouverture)/); return m?bef.length+1:-1; })());
        const iA=Math.max(lastIdx(AVEC,bef),(()=>{ const m=aft.match(/^[^.;]{0,40}?(vues? directes?|baies?|ouvertures?)/); return m&&!/(ne comporte|sans|aucune)/.test(aft.slice(0,60))?bef.length:-1; })());
        const sans=iS>=0&&iS>=iA, vues=iA>=0&&iA>iS;
        const min=/(minimum|au moins|au minimum|egale? a|egal a|distance de)/.test(norm(x.before.slice(-40)+' '+x.after.slice(0,40)));
        const fondHere=(fondSent&&!/lateral/.test(aft.slice(0,60)))||/fond de (terrain|parcelle|propriete)|limites? de fond|limites? posterieures?/.test(aft.slice(0,70));
        const c={v:x.v,ctx:win(s,x.i),page:pageOf(b,s),fond:fondHere,vues,sans,min,score:(min?2:0)+(lateral?1:0)+(GENERAL.test(n)?1:0)-(EXCEPT.test(n.slice(0,110))?4:0)-(SECTOR.test(s.slice(0,110))?2:0)+(SECTOR.test(s.slice(0,110))?0:0)};
        r.cands.push(c);
        if(fondHere){ if(x.v<=30){ r.fondCands.push(x.v); take('fond',c); } return; }
        if(x.v>12) return;
        if(sans) take('sans',{...c,score:c.score+4});
        else if(vues) take('avec',c);
        else if(x.v<=10 && /(retrait|distance|marge|recul)/.test(n) && min && !/(lorsqu.elles s.implantent en limite|en limite separative)/.test(n.slice(0,60)) && !EXCEPT.test(n.slice(0,100))) take('defaut',c); }); }); });
    r.sansVue=best.sans?best.sans.v:(best.defaut?best.defaut.v:null);
    r.avecVue=best.avec?best.avec.v:null; r.fond=best.fond?best.fond.v:null;
    if(r.sansVue==null && r.minFormule!=null) r.sansVue=r.minFormule;
    return r;
  }
  function rHauteur(B){
    const strict=B.length&&B[0].topic==='all'; const r={egout:null,faitage:null,acrotere:null,niveaux:'',cands:[]}; const best={};
    B.forEach(b=>{ sentences(b).forEach(s=>{ const n=norm(s);
      const nv=s.match(/R\s?\+\s?\d(?:\s?\+\s?(?:combles|comble|C|attique))?/i); if(nv && !r.niveaux) r.niveaux=nv[0].replace(/\s+/g,'');
      if(!/(hauteur|egout|faitage|acrotere|point le plus haut|sommet)/.test(n)) return;
      if(strict && !(/(egout|faitage|acrotere|point le plus haut)/.test(n) || /hauteur (maximale|totale|des constructions|autorisee|limitee|de la construction)/.test(n))) return;
      const except=EXCEPT.test(n.slice(0,110));
      const sscore=(/(egout)/.test(n)&&/(faitage|point le plus haut|sommet)/.test(n)?4:0)+(/(ne peut (pas )?exceder|ne doit pas exceder|est limitee|maximale|ne peut depasser|ne doit pas depasser)/.test(n)?3:0)+(GENERAL.test(n)?1:0)+(/(construction|batiment|habitation)/.test(n.slice(0,140))?1:0)-(except?6:0)-(/(toutefois|sauf|en cas de|lorsque|dans le cas|jusqu.a|sous reserve)/.test(n.slice(0,70))?2:0)-(/(cloture|mur|annexe|abri|garage|piscine|antenne|cheminee|pergola)/.test(n.slice(0,120))?5:0)-(SECTOR.test(s.slice(0,110))?5:0);
      metreItems(s).items.forEach(x=>{ if(x.v<2||x.v>60) return;
        const after=norm(x.after.slice(0,60)), before=norm(x.before.slice(-45));
        let kind=null;
        const ma=after.match(/(egout|faitage|acrotere|point le plus haut|sommet)/), mb=before.match(/(egout|faitage|acrotere|point le plus haut|sommet)(?!.*(egout|faitage))/);
        if(ma) kind=/egout/.test(ma[1])?'egout':/acrotere/.test(ma[1])?'acrotere':'faitage'; else if(mb) kind=/egout/.test(mb[1])?'egout':/acrotere/.test(mb[1])?'acrotere':'faitage';
        r.cands.push({v:x.v,kind,except,score:sscore,sect:SECTOR.test(s.slice(0,110)),ctx:win(s,x.i),page:pageOf(b,s)});
        const key=kind||'gen'; if(sscore>=0 && (!best[key]||sscore>best[key].score)) best[key]=r.cands[r.cands.length-1]; }); }); });
    if(best.egout) r.egout=best.egout.v; if(best.faitage) r.faitage=best.faitage.v; if(best.acrotere) r.acrotere=best.acrotere.v;
    if(r.faitage==null&&r.egout==null&&r.acrotere==null&&best.gen){ r.faitage=best.gen.v; r.generique=true; }
    const pick=best.egout||best.faitage||best.acrotere||best.gen; r.sect=!!(pick&&pick.sect);
    r.best=best; return r;
  }
  function rVoies(B){
    const strict=B.length&&B[0].topic==='all'; const r={largeur:null,cands:[]};
    B.forEach(b=>{ sentences(b).forEach(s=>{ const n=norm(s);
      if(!/(largeur|emprise|chaussee|plate-?forme|gabarit)/.test(n)) return;
      if(!/(voie|chaussee|acces|desserte|circulation)/.test(n)) return;
      if(strict && !/(largeur|emprise)[^.]{0,60}(voies?|chaussee|acces|plate)|(voies?|acces|chaussee)[^.]{0,60}(largeur|emprise)/.test(n)) return;
      metreItems(s).items.forEach(x=>{ if(x.v<2||x.v>25) return; if(/(hauteur|longueur|profondeur|\bm2\b)/.test(norm(x.after).slice(0,18))) return;
        const score=(/(largeur|emprise)/.test(n)?2:0)+(/(minimum|minimale|au moins|au minimum)/.test(n)?2:0)+(/(voies? (nouvelles?|privees?|creees?|ouvertes)|nouvelles? voies?)/.test(n)?1:0)+(/\bacces\b/.test(n)?1:0);
        r.cands.push({v:x.v,ctx:win(s,x.i),page:pageOf(b,s),score,sens:/sens unique/.test(n),double:/(double sens|deux sens)/.test(n),acces:/\bacces\b/.test(n)}); }); }); });
    if(r.cands.length){ const best=[...r.cands].sort((a,b)=>b.score-a.score||a.page-b.page)[0]; r.largeur=best.score>=2?best.v:null; }
    return r;
  }
  const SPECIALS=[
    ['arbres remarquables', /arbres? (remarquables?|a conserver|a proteger|classes?)|sujets? remarquables?/],
    ['alignement d\'arbres', /alignements? d.arbres/],
    ['espaces boisés classés', /espaces? bois[eé]s? class[eé]s?|\bebc\b/],
    ['tuiles / couverture imposée', /(tuiles?|ardoises?|zinc|bac acier|couverture)[^.]{0,80}(obligatoire|impos|exclusivement|seul|doivent|admis|autoris|interdit)/],
    ['pente de toiture imposée', /pentes? (de toiture|des toitures|minimale|maximale|comprise)|toitures? (a|en) (deux|2|quatre|4) pans|toiture[- ]terrasse/],
    ['clôtures réglementées', /cl[oô]tures?[^.]{0,80}(hauteur|ne (peut|doit)|maximale?)/],
    ['risque inondation (PPRI)', /\bppri\b|plan de pr[eé]vention des risques d.inondation|zone inondable|zones? inondables?/],
    ['retrait-gonflement des argiles', /argiles?|retrait.gonflement/],
    ['bâtiment / secteur patrimonial', /abords? des monuments|monuments? historiques?|site patrimonial|svpr|\bspr\b|\bavap\b|b[aâ]timents? remarquables?/],
    ['emplacement réservé', /emplacements? r[eé]serv[eé]s?/],
    ['marge de recul particulière', /marges? de recul|ligne de recul|recul (impos|particulier)/],
    ['sentier piéton / servitude', /sentiers? pi[eé]tons?|servitudes? de passage/],
    ['stationnement imposé', /places? de stationnement[^.]{0,80}(par logement|par maison|par construction)/]
  ];
  function rSpeciales(pages,ch){
    const out=[]; const seen={};
    for(let i=ch.start;i<=ch.end;i++){
      const txt=pages[i].split('\n').filter(l=>!/^(Accus|Date de)/.test(l)).join(' ').replace(/\s+/g,' ');
      const ss=txt.split(/(?<=[.;:!?])\s+(?=[A-ZÉÈÀÂ\-–•])/);
      ss.forEach(s=>{ const n=norm(s); SPECIALS.forEach(([name,re])=>{ if(seen[name]>=2) return; if(re.test(n)){ seen[name]=(seen[name]||0)+1; out.push({type:name,texte:cut(s,300),page:i+1}); } }); });
    }
    return out;
  }


  /* ---------- préconisations architecturales (article « aspect extérieur ») ---------- */
  const ARCHI=[
    ['cloture','Clôtures et portails',/(clotures?|portails?|portillons?|pilastres?|murets?|grillages?|mur de cloture|mur de soutenement)/],
    ['menuiserie','Menuiseries et fermetures',/(menuiseries?|fenetres?|porte-?fenetres?|\bportes?\b|volets?|persiennes?|jalousies?|huisseries?|vitrages?|petits?[- ]bois|\bbaies?\b|garde-?corps|ferronneries?)/],
    ['equipement','Équipements techniques et énergies',/(panneaux? (solaires?|photovolta)|capteurs? solaires?|photovolta|antennes?|paraboles?|climatis|pompes? a chaleur|groupes? exterieurs?|coffrets?|boites? aux lettres|citernes?|cuves?|compteurs?|energies? renouvelables?|eoliennes?|conduits? de (fumee|cheminee|ventilation))/],
    ['toiture','Toitures et couverture',/(toitures?|couvertures?|tuiles?|ardoises?|zinc|bac acier|\btoles?\b|shingle|fibrociment|\bpentes?\b|versants?|lucarnes?|chassis de toit|fenetres? de toit|\btoits?\b|toit[- ]terrasse|debords? de toit|souches?|cheminees?|gouttieres?|faitage)/],
    ['annexe','Annexes, garages et abris',/(annexes?|garages?|\babris?\b|appentis|verandas?|pergolas?|carports?|piscines?|serres?|dependances?|remises?)/],
    ['facade','Façades, matériaux et couleurs',/(facades?|enduits?|crepis|parements?|bardages?|briques?|pierres?|moellons?|soubassements?|ravalements?|teintes?|couleurs?|coloris|\btons?\b|materiaux|parpaings?|agglomeres?|carreaux de platre|beton|colombages?|modenatures?|corniches?|balcons?|loggias?|encadrements?|bandeaux?|\bmurs?\b|pignons?)/],
    ['general','Aspect général et intégration',/(unite d.aspect|s.integrer|integration|harmonie|harmonieux|architecture (locale|traditionnelle|regionale)|pastiche|volumetrie|proportions?|simplicite|environnement bati|qualite architecturale|caractere|paysage)/]
  ];
  const ARCHI_HEAD=/^(?:\d{1,2}(?:\.\d{1,2})*[.)\-–]?\s*)?(?:les?\s+|la\s+|l.|des\s+)?(clotures?|portails?|menuiseries?|toitures?|couvertures?|facades?|batiments? annexes?|annexes?|equipements?|antennes?|energies?|aspect general|couleurs?|materiaux)\b/;
  const ARCHI_NUMHEAD=/^\d{1,2}(?:\.\d{1,2})*[.)\-–]?\s+[A-ZÉÈÀa-zéèà]/;
  const ARCHI_BUL=/^(?:[-–•·▪]\s*|o\s+(?=[A-Za-zÀ-ÿ])|soit\b)/i;
  const ARCHI_JUNK=/(Plan Local d.Urbanisme|Accus[eé] de r[eé]ception|^Date de|^Page \d+|^\d{1,3}$|^Commune d.{0,40}•)/;
  const MATIERES={
    toiture:[['tuile',/tuiles?/],['ardoise',/ardoises?/],['zinc',/zinc/],['bac acier',/bac acier/],['toit-terrasse',/toits?[- ]terrasses?/],['tôle',/\btoles?\b/],['chaume',/chaume/]],
    menuiserie:[['bois',/\bbois\b/],['PVC',/\bpvc\b/],['aluminium',/\balu(minium)?\b/],['métal',/\b(metal|metalliques?|acier|fer)\b/],['volets roulants',/volets? roulants?/],['persiennes',/persiennes?/]],
    facade:[['enduit',/enduits?|crepis/],['brique',/briques?/],['pierre',/pierres?|moellons?/],['bardage',/bardages?/],['bois',/\bbois\b/]]
  };
  /* lines = [{t,p}] de l'article « aspect extérieur » (ou du chapitre entier à défaut) */
  function rArchi(lines,via,junk){
    const paras=[]; let cur=null, headTheme=null;
    lines.forEach(({t,p})=>{
      const l=String(t).trim(); if(!l || ARCHI_JUNK.test(l) || (junk && junk.has(norm(l).replace(/\d+/g,'#').trim()))) return;
      const n=norm(l), short=l.length<70 && !/[.;:,]$/.test(l);
      if(short && (ARCHI_HEAD.test(n)||ARCHI_NUMHEAD.test(l))){
        const m=ARCHI.filter(a=>a[2].test(n)||(a[0]==='general'&&/aspect general/.test(n))); headTheme=m.length===1?m[0][0]:null; cur=null; return; }
      const bullet=ARCHI_BUL.test(l), txt=l.replace(/^(?:[-–•·▪]\s*|o\s+(?=[A-Za-zÀ-ÿ]))/,'');
      if(cur && (bullet || !/[.;:!?]$/.test(cur.t))){ cur.t=cur.t.replace(/[,;\s]+$/,(m)=>/:/.test(cur.t.slice(-2))?m:'')+(bullet?(/:\s*$/.test(cur.t)?' ':' ; '):' ')+txt; return; }
      cur={t:txt,p,theme:headTheme}; paras.push(cur);
    });
    const out={}; ARCHI.forEach(a=>{ out[a[0]]=[]; }); const seen=new Set();
    paras.forEach(pa=>{
      pa.t.replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-ZÉÈÀÂ])/).map(s=>s.trim()).filter(s=>s.length>=20).forEach(s=>{
        const n=norm(s); if(/r\.? ?111-2|code de l.urbanisme/.test(n)) return;
        let k=pa.theme; if(!k){ const a=ARCHI.find(a=>a[2].test(n)); k=a?a[0]:null; }
        if(!k) return;
        const key=n.slice(0,60); if(seen.has(key)) return; seen.add(key);
        if(out[k].length<6) out[k].push({texte:cut(s,340),page:pa.p});
      });
    });
    const mat=k=>MATIERES[k]?MATIERES[k].filter(([,re])=>out[k].some(x=>re.test(norm(x.texte)))).map(([nm])=>nm):[];
    const themes=ARCHI.filter(a=>out[a[0]].length).map(a=>({k:a[0],label:a[1],items:out[a[0]]}));
    return {via,themes,matieres:{toiture:mat('toiture'),menuiserie:mat('menuiserie'),facade:mat('facade')}};
  }

  function has(k,r){ return k==='emprise'||k==='pleineTerre'?r.pct!=null:k==='voie'?r.m!=null:k==='limites'?(r.sansVue!=null||r.avecVue!=null||r.fond!=null):k==='hauteur'?(r.egout!=null||r.faitage!=null||r.acrotere!=null):r.largeur!=null; }
  function analyse(pages, zone){
    const ch=findChapter(pages,zone); if(!ch) return {ok:false,motif:'chapitre de la zone introuvable'};
    const bs=blocks(pages,ch);
    const ALL={topic:'all',head:'(chapitre entier)',page:ch.start+1,lines:[]};
    for(let i=ch.start;i<=ch.end;i++) pages[i].split('\n').forEach(l=>{ l=l.trim(); if(l&&!/^(Accus|Date de (t|r))/.test(l)) ALL.lines.push({t:l,p:i+1}); });
    const spec={emprise:[rEmprise,['emprise']],pleineTerre:[rPleineTerre,['pleineTerre','emprise']],voie:[rVoie,['voie']],limites:[rLimites,['limites']],hauteur:[rHauteur,['hauteur']],voies:[rVoies,['desserte','voie']]};
    const rules={};
    Object.keys(spec).forEach(k=>{ const [fn,tp]=spec[k]; let r=fn(bs.filter(b=>tp.includes(b.topic))); r.source='articles';
      if(!has(k,r)){ const r2=fn([ALL]); if(has(k,r2)){ r=r2; r.source='chapitre'; } } rules[k]=r; });
    rules.speciales=rSpeciales(pages,ch);
    { const cnt={}; ALL.lines.forEach(x=>{ const k=norm(x.t).replace(/\d+/g,'#').trim(); if(k.length<80) (cnt[k]=cnt[k]||new Set()).add(x.p); });
      const junk=new Set(Object.keys(cnt).filter(k=>cnt[k].size>=3));   // en-têtes et pieds de page répétés
      const al=[]; bs.filter(b=>b.topic==='aspect').forEach(b=>{ if(b.head && !/^(ARTICLE|Article)\s/.test(b.head)) al.push({t:b.head,p:b.page}); b.lines.forEach(x=>al.push(x)); });
      rules.archi = al.length>=5 ? rArchi(al,'article',junk) : rArchi(ALL.lines,'chapitre',junk); }
    rules.topics=bs.reduce((a,b)=>{ if(b.topic) a[b.topic]=(a[b.topic]||0)+1; return a; },{});
    return {ok:true,zone:ch.code,zoneDemandee:zone,pages:[ch.start+1,ch.end+1],via:ch.via,rules};
  }
  const API={analyse,findChapter,listZones,codeCandidates,blocks,norm};
  if(typeof module!=='undefined'&&module.exports) module.exports=API; else root.PluEngine=API;
})(typeof self!=='undefined'?self:this);
