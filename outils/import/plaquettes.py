"""Plaquettes PDF -> images par modèle (vues, façades, plans, coupes) + manifeste JSON."""
import json,os,re,subprocess,sys,unicodedata,glob,tempfile
from multiprocessing import Pool
from PIL import Image, ImageOps
UP,MOD,OUT=sys.argv[1:4]
M=json.load(open(MOD,encoding='utf-8'))
NAMES=[(d['id'],d['nom']) for d in M['details'].values()]
NM=dict(NAMES)
def nk(s): s=unicodedata.normalize('NFD',str(s)).encode('ascii','ignore').decode().lower(); return re.sub(r'[^a-z0-9]','',s)
def txt(f,p): return subprocess.run(['pdftotext','-f',str(p),'-l',str(p),f,'-'],capture_output=True,text=True).stdout
def imgs(f,p):
    out=subprocess.run(['pdfimages','-f',str(p),'-l',str(p),'-list',f],capture_output=True,text=True).stdout.splitlines()[2:]
    return [(int(l.split()[3]),int(l.split()[4]),int(l.split()[1])) for l in out if len(l.split())>5]
def npages(f): return int(re.search(r'Pages:\s+(\d+)',subprocess.run(['pdfinfo',f],capture_output=True,text=True).stdout).group(1))
def ident(f,t1):
    k=nk(t1+' '+os.path.basename(f))
    cands=[(len(nk(n)),i,n) for i,n in NAMES if nk(n) in nk(t1)]
    if not cands: return None,None
    _,i,n=max(cands); b=os.path.basename(f)
    var='pmr' if re.search(r'\bPMR\b',t1) or '_PMR' in b else ('tt' if re.search(r'(^|[-_])TT[_ ]|_TT_',b) else ('4p' if re.search(r'4PANS|4_pans',b,re.I) else 'std'))
    return i,var
def trim(im,pad=18):
    g=ImageOps.invert(im.convert('L')).point(lambda v:255 if v>18 else 0); bb=g.getbbox()
    if not bb: return im
    x0,y0,x1,y1=bb; return im.crop((max(0,x0-pad),max(0,y0-pad),min(im.width,x1+pad),min(im.height,y1+pad)))
def render(f,p,dpi,width,q,dst,crop_title=True):
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(['pdftoppm','-f',str(p),'-l',str(p),'-r',str(dpi),'-png',f,td+'/x'],capture_output=True)
        fs=glob.glob(td+'/x*.png'); im=Image.open(fs[0]).convert('RGB')
        H=im.height
        if crop_title: im=im.crop((0,int(H*0.09),im.width,int(H*0.90)))   # bandeau titre et pied de page
        im=trim(im)
        if im.width>width: im=im.resize((width,int(im.height*width/im.width)),Image.LANCZOS)
        im.save(dst,'JPEG',quality=q,optimize=True,progressive=True); return im.size
def photo(f,p,dst,width=1600,q=80):
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(['pdftoppm','-f',str(p),'-l',str(p),'-r','150','-png',f,td+'/x'],capture_output=True)
        im=Image.open(glob.glob(td+'/x*.png')[0]).convert('RGB')
        # zone photo : plus grand bloc non blanc
        g=im.convert('L').point(lambda v:255 if v<235 else 0); bb=g.getbbox()
        if bb: im=im.crop(bb)
        if im.width<900: return None
        if im.width>width: im=im.resize((width,int(im.height*width/im.width)),Image.LANCZOS)
        im.save(dst,'JPEG',quality=q,optimize=True,progressive=True); return im.size
def kind(t,big,p,name=''):
    a=nk(t[:300])
    for pre in ('mamaison','contemporaine','equation'):
        if a.startswith(pre): a=a[len(pre):]
    if a.startswith('modele'): return 'interieur' if big and 'illustration' in a else None
    kn=nk(name)
    if kn and kn in a[:len(kn)+25]: a=a[a.index(kn)+len(kn):]
    for pre in ('mamaison','contemporaine','equation','pmr'):
        if a.startswith(pre): a=a[len(pre):]
    h=a[:40]
    if 'electrique' in a[:60] or h.startswith('modele') or h.startswith('plan') and 'electrique' in a: return None
    if big and (p==1 or 'facadeavant' in a[:120]): return 'vue'
    if big and 'facadearriere' in a[:120]: return 'vue'
    for key,k in (('facadeavant','facade-avant'),('facadearriere','facade-arriere'),('pignongauche','pignon-gauche'),('pignondroit','pignon-droit'),('facadegauche','pignon-gauche'),('pignonavant','facade-avant'),('pignonarriere','facade-arriere'),('facadedroite','pignon-droit'),('coupelongitudinale','coupe-longitudinale')):
        if h.startswith(key): return k
    if h.startswith('coupe'): return 'coupe'
    if h.startswith('etage'): return 'plan-etage'
    if h.startswith('combles'): return 'plan-combles'
    if 'rezdechaussee' in a[:250]: return 'plan-rdc'
    if 'etage' in a[:120] and 'distribution' in a: return 'plan-etage'
    if h.startswith('combles') or ('combles' in a[:120] and 'distribution' in a): return 'plan-combles'
    if big and ('vue3d' in a[:120] or 'illustration' in a[:200]): return 'interieur'
    if 'distribution' in a and not h.startswith('modele'): return 'plan-rdc?'
    return None
def heights(t):
    o={}; m=re.search(r'°\s*(\d{2})',t) or re.search(r'(\d{2})\s*°',t)
    if m and 15<=int(m.group(1))<=60: o['pente']=int(m.group(1))
    if re.search(r'TOITURE TERRASSE|TOIT TERRASSE',t,re.I): o['terrasse']=True
    return o
def one(f):
    try:
        t1=txt(f,1); mid,var=ident(f,t1)
        if not mid: return {'f':os.path.basename(f),'err':'modèle non reconnu','t':t1[:80]}
        d=os.path.join(OUT,mid,var); os.makedirs(d,exist_ok=True)
        res={'f':os.path.basename(f),'id':mid,'var':var,'items':[],'h':{}}; nv=0; seen=set()
        for p in range(1,npages(f)+1):
            t=txt(f,p); im=imgs(f,p); ill='illustrationnon' in nk(t)
            big=any((w>=2000 and h>=1100) or (ill and w>=1300 and h>=800) for w,h,_ in im)
            k=kind(t,big,p,NM.get(mid,''))
            if not k: continue
            if k=='plan-rdc?':
                k='plan-rdc' if 'plan-rdc' not in seen else ('plan-etage' if 'plan-etage' not in seen else None)
                if not k: continue
            if k.startswith('coupe'): res['h'].update(heights(t))
            if k in ('vue','interieur'):
                nv+=1; fn=f'{k}-{nv}.jpg'; sz=photo(f,p,os.path.join(d,fn),1400 if k=='interieur' else 1600,76)
                if not sz: continue
            else:
                if k in seen: continue
                fn=k+'.jpg'; sz=render(f,p,130 if k.startswith('plan') else 110,1500 if k.startswith('plan') else 1300,72,os.path.join(d,fn))
            seen.add(k); res['items'].append({'k':k,'f':f'{mid}/{var}/{fn}','w':sz[0],'h':sz[1]})
        return res
    except Exception as e: return {'f':os.path.basename(f),'err':repr(e)[:200]}
if __name__=='__main__':
    fs=sorted(glob.glob(os.path.join(UP,'*.pdf')))
    # doublons : même nom sans uuid/prix -> garder le premier
    with Pool(8) as pl: R=pl.map(one,fs)
    json.dump(R,open(os.path.join(OUT,'_manifeste.json'),'w'),ensure_ascii=False,indent=1)
    ok=[r for r in R if 'id' in r]; print('pdf',len(fs),'reconnus',len(ok),'erreurs',len(R)-len(ok))
    for r in R:
        if 'err' in r: print(' ERR',r)
