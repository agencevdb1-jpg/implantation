"""Complète modeles.json avec la Google Sheet des books (versions, options, garages, Otthona)."""
import json,re,sys,unicodedata,collections
MOD,VER,OPT,GEN,OUT=sys.argv[1:6]
M=json.load(open(MOD,encoding='utf-8')); L=M['light']; D=M['details']
V=json.load(open(VER))['values'][1:]; O=json.load(open(OPT))['values'][1:]; G=json.load(open(GEN))['values'][1:]
def k(s): s=unicodedata.normalize('NFD',str(s)).encode('ascii','ignore').decode().lower(); return re.sub(r'[^a-z0-9]','',s)
def slug(s): s=unicodedata.normalize('NFD',str(s)).encode('ascii','ignore').decode().lower(); return re.sub(r'[^a-z0-9]+','-',s).strip('-')[:70]
def eur(s):
    t=re.sub(r'[^\d\-]','',str(s))
    if t in ('','-'): return None
    v=int(t); return v if abs(v)<2_000_000 else None
byname={k(l['nom']):l['id'] for l in L}
FIN={'Ma Maison':'ma_maison','Premium':'premium','Wagram':'wagram'}
REGLAB={'nord':'Région NORD tuile 10 m² béton PAC Air/Air','sud':'Région SUD tuile 10 m² béton PAC Air/Air','ardoise':'Ardoise ciment (hors IDF) PAC Air/Air'}
stats=collections.Counter()
# ---------------- Otthona (absents) : fiche provisoire
newm=sorted({v[1] for v in V if k(v[1]) not in byname})
for nm in newm:
    mid=slug(nm); g=nm.split()[0]
    D[mid]={'id':mid,'nom':nm,'gamme':g,'famille':'R+1','specs':{'typeConstruction':'R+1'},'finitions':[],'prix':{},'options':[],
            'habitation':[[0,0],[10,0],[10,10],[0,10]],'garage':None,'ensemble':[[0,0],[10,0],[10,10],[0,10]],'surfaces':{'habitation':100},
            'plan':False,'planStatut':'inconnu','empriseApprox':True,'empriseInconnue':True,'catalogue':{'edition':'Book Maisons Pierre 2026'}}
    L.append({'id':mid,'nom':nm}); byname[k(nm)]=mid; stats['modeles ajoutés']+=1
# ---------------- versions
for v in V:
    mid=byname.get(k(v[1])); p=eur(v[3])
    if not mid or p is None: stats['versions ignorées']+=1; continue
    d=D[mid]; lab=v[2]; fin=reg=None
    m=re.match(r'^(Ma Maison|Premium|Wagram) - Région (Nord|Sud)',lab)
    if m: fin,reg=FIN[m.group(1)],m.group(2).lower()
    m=m or None
    if not fin:
        m=re.match(r'^(Ma Maison|Premium|Wagram) - Ardoise',lab)
        if m: fin,reg=FIN[m.group(1)],'ardoise'
    if not fin:
        m=re.match(r"^Hors d'eau hors d'air \(Ma Maison\) - (Région Nord|Région Sud|Ardoise)",lab)
        if m: fin='hors_eau_air'; reg={'Région Nord':'nord','Région Sud':'sud','Ardoise':'ardoise'}[m.group(1)]
    if not fin:
        m=re.match(r'^Ma Maison - (tuile 10 m² béton|ardoise ciment \(hors IDF\)) - PAC Air/(Air|Eau)',lab)
        if m: fin='air_'+m.group(2).lower(); reg='nord' if m.group(1).startswith('tuile') else 'ardoise'
    if not fin: stats['versions non reconnues (contemporaine/équation déjà présentes)']+=1; continue
    pr=d.setdefault('prix',{}); cur=pr.setdefault(reg,{})
    if fin in cur:
        if cur[fin]!=p: stats['versions en conflit']+=1
        continue
    cur[fin]=p; stats['versions ajoutées '+reg]+=1
    ids=[f['id'] for f in d.get('finitions',[])]
    if fin not in ids:
        lab2={'ma_maison':'Ma Maison','premium':'Premium','wagram':'Wagram','hors_eau_air':"Hors d'eau hors d'air",'air_air':'PAC Air/Air','air_eau':'PAC Air/Eau'}[fin]
        d.setdefault('finitions',[]).append({'id':fin,'label':lab2}); stats['finitions ajoutées']+=1
for d in D.values():
    pr=d.get('prix',{}); regs=[r for r in pr if isinstance(pr[r],dict)]
    if len(regs)>1 or 'nord' not in regs:
        libs=pr.setdefault('libelles',{})
        for r in regs: libs.setdefault(r, pr.get('baseLibelle') if r=='nord' and pr.get('baseLibelle') else REGLAB[r])
    if not pr.get('baseLibelle') and regs: pr['baseLibelle']=REGLAB[regs[0]]
    order=['ma_maison','premium','wagram','air_air','air_eau','complet','equation','hors_eau_air']
    d['finitions'].sort(key=lambda f:order.index(f['id']) if f['id'] in order else 99)
# ---------------- options par modèle manquantes
CATMAP={'Couverture':'Couverture','Divers':'Diverses','Options diverses':'Diverses','Adaptation V.S.':'Adaptation sol / sous-sol','Adaptation sous-sol':'Adaptation sol / sous-sol','Menuiseries':'Menuiseries'}
for o in O:
    mid=byname.get(k(o[1])); p=eur(o[5])
    if not mid or p is None: continue
    d=D[mid]; have={k(x['lib']) for x in d['options']}
    if k(o[3]) in have: continue
    if 'pack bdf' in o[3].lower() and any(x['cat']=='Pack BDF' and abs(x.get('prix') or 0)==abs(p) for x in d['options']): continue
    if d.get('empriseInconnue') is None and o[2] in ('Adaptation V.S.','Adaptation sous-sol','Menuiseries') : 
        # libellé reformulé sur le site : on ne double pas si le même prix existe dans la même catégorie
        if any(abs(x.get('prix') or -1)==abs(p) and x['cat']==CATMAP.get(o[2],o[2]) for x in d['options']): continue
    base=slug(o[2]+'-'+o[3]); oid=base; n=2
    ids={x['id'] for x in d['options']}
    while oid in ids: oid=f'{base}-{n}'; n+=1
    typ='moins' if p<0 or re.match(r'moins[- ]value',o[3],re.I) else 'plus'
    d['options'].append({'id':oid,'cat':CATMAP.get(o[2],o[2]),'lib':o[3],'prix':p if typ=='plus' or p<0 else -p,'type':typ,'note':'Book '+o[6].replace('p.','p. ')}); stats['options modèle ajoutées']+=1
# ---------------- garage accolé générique (book Maisons Pierre) pour les modèles hors Équation
GM=[g for g in G if g[1]=='Book Maisons Pierre 2026' and g[2].startswith('Garage')]
TAILLES=[('3x6',3,6,'Garage 3x6 (18 m²)','Garage 3x6','3x6'),('4x6',4,6,'Garage 4x6 (24 m²)','Garage 4x6','4x6'),('5x6',5,6,'Garage 5x6 (30 m²)','Garage 5x6','5x6'),('6x6',6,6,'Garage 6x6 (36 m²)','Garage 6x6','6x6'),
 ('3x8',3,8,'Garage 3x8 ou 3,60x8','Garage 3x8 / 3,60x8','3,60x8'),('3.6x8',3.6,8,'Garage 3x8 ou 3,60x8','Garage 3x8 / 3,60x8','3,60x8'),('3.6x8.8',3.6,8.8,'Garage 3,60x8,80','Garage 3,60x8,80','3,60x8,80'),
 ('4x8.8',4,8.8,'Garage 4x8,80','Garage 4x8,80','4x8,80'),('5x8.8',5,8.8,'Garage 5x8,80','Garage 5x8,80','5x8,80'),('6x8.8',6,8.8,'Garage 6x8,80','Garage 6x8,80','6x8,80')]
ROOF6={'plat':'toit plat','t35':'tuiles 10 m² béton 35°','t45':'tuiles 10 m² béton 40°-45°','a35':'ardoise ciment 35°','a45':'ardoise ciment 40°-45°'}
ROOF8={'plat':'toit plat','t35':'pente 35° double romane','t45':'pente 45° double romane','a35':'pente 35° ardoise ciment','a45':'pente 45° ardoise ciment'}
ROOFLAB={'plat':'toit plat','t35':'tuiles béton 35°','t45':'tuiles béton 40-45°','a35':'ardoise ciment 35°','a45':'ardoise ciment 40-45°'}
def gfind(prefix,suffix):
    for g in GM:
        if g[3].startswith(prefix+' - ') and g[3][len(prefix)+3:].startswith(suffix): return eur(g[5]),g[3]
    return None,None
gopts=[]; tailles=[]
for tid,w,Lg,bp,xp,tp in TAILLES:
    RO=ROOF6 if Lg==6 else ROOF8; ok=False
    for rk,rs in RO.items():
        p,lab=gfind(bp,rs)
        if p is None: continue
        ok=True; gopts.append({'id':f'gacc-{tid}-{rk}','cat':'Garage accolé','lib':f"Garage accolé {str(w).replace('.',',')} × {str(Lg).replace('.',',')} m · {ROOFLAB[rk]}",'prix':p,'type':'plus','grp':'gacc-base','note':'Book Maisons Pierre 2026 · garages accolés'})
    if ok: tailles.append({'id':tid,'w':w,'L':Lg})
    if tid=='3.6x8': continue
    for g in GM:
        if g[3].startswith(xp+' - ') and not any(g[3][len(xp)+3:].startswith(s) for s in list(ROOF6.values())+list(ROOF8.values())):
            p=eur(g[5]); 
            if p is None: continue
            gopts.append({'id':f'gacc-{tid}-x-'+slug(g[3][len(xp)+3:])[:40],'cat':'Garage accolé','lib':f"Garage {str(w).replace('.',',')} × {str(Lg).replace('.',',')} m · {g[3][len(xp)+3:]}",'prix':p,'type':'plus','note':'Book Maisons Pierre 2026'})
    for g in GM:
        if g[3].startswith('Tuiles garage '+tp+' - '):
            p=eur(g[5]); 
            if p is None: continue
            gopts.append({'id':f'gacc-{tid}-tuile-'+slug(g[3].split(' - ',1)[1])[:40],'cat':'Garage accolé','lib':f"Garage {str(w).replace('.',',')} × {str(Lg).replace('.',',')} m · tuiles {g[3].split(' - ',1)[1]}",'prix':p,'type':'plus','note':'Book Maisons Pierre 2026'})
for g in GM:
    if g[2]=='Garage':
        p=eur(g[5]); oid='gacc-th' if 'toute hauteur' in g[3] else 'gar-'+slug(g[3])[:50]
        gopts.append({'id':oid,'cat':'Garage accolé','lib':g[3],'prix':p,'type':'plus','note':'Book Maisons Pierre 2026'})
seen=set(); gopts=[o for o in gopts if not (o['id'] in seen or seen.add(o['id']))]
for d in D.values():
    eq='equation' in json.dumps(d.get('prix',{}))
    if eq:
        if not any(o['id']=='gacc-th' for o in d['options']):
            d['options'].append({'id':'gacc-th','cat':'Garage accolé','lib':'Plus-value garage toute hauteur incluant plancher intermédiaire','prix':5500,'type':'plus','note':'Book Equation oct. 2026'}); stats['toute hauteur Équation']+=1
        continue
    if d.get('garageAccole'): continue
    d['garageAccole']={'generic':True,'tailles':tailles,'toitures':[[r,ROOFLAB[r]] for r in ROOF6]}
    have={o['id'] for o in d['options']}
    d['options']+= [dict(o) for o in gopts if o['id'] not in have]; stats['modèles avec garage générique']+=1
# light
def lightOf(d):
    sp=d.get('specs') if isinstance(d.get('specs'),dict) else {}; pr=d.get('prix',{}); regs=[r for r in ('nord','sud','ardoise') if isinstance(pr.get(r),dict)]
    pn=pr[regs[0]] if regs else None
    return {'id':d['id'],'nom':d['nom'],'gamme':d.get('gamme',''),'famille':d.get('famille',''),'surf':sp.get('surfaceSol') or (d.get('surfaces') or {}).get('habitation'),
            'facade':sp.get('facade',d.get('facade')),'prof':sp.get('profondeur'),'prix':dict(pn) if pn else None,'nbOpt':len(d.get('options',[])),'plan':bool(d.get('plan')),
            'finitions':d.get('finitions',[]),'variante':d.get('variante',''),'approx':bool(d.get('approx') or d.get('empriseInconnue')),'toit4pans':bool(d.get('toit4pans')),
            'alerte':d.get('alerte','') or ('Emprise inconnue : importez le plan du modèle.' if d.get('empriseInconnue') else '')}
old={l['id']:l for l in M['light']}
M['light']=[ (dict(old[l['id']],nbOpt=len(D[l['id']]['options']),finitions=D[l['id']]['finitions'],prix=lightOf(D[l['id']])['prix']) if l['id'] in old and 'gamme' in old[l['id']] else lightOf(D[l['id']])) for l in L]
json.dump(M,open(OUT,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
for a,b in sorted(stats.items()): print(f'{b:6d}  {a}')
print('garage : tailles',len(tailles),'options par modèle',len(gopts))
