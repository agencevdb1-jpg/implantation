"""Rechiffre _prive/app.js, _prive/modeles.json et _prive/notice.pdf dans data/*.bin.
Change le sel et la version : chaque poste redemande le mot de passe une fois.
Usage : python3 outils/chiffrer.py "MOT-DE-PASSE"   (un nouveau mot de passe change l'accès pour tous)
"""
import base64, json, os, secrets, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pw = sys.argv[1]
ITER = 310000
salt = secrets.token_bytes(16)
aes = AESGCM(PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER).derive(pw.encode()))
def seal(data):
    iv = secrets.token_bytes(12); return iv + aes.encrypt(iv, data, None)
P = lambda *a: os.path.join(ROOT, *a)
app = open(P('_prive', 'app.js'), 'rb').read()
mod = json.dumps(json.load(open(P('_prive', 'modeles.json'), encoding='utf-8')), ensure_ascii=False, separators=(',', ':')).encode()
notice = open(P('_prive', 'notice.pdf'), 'rb').read()
open(P('data', 'app.bin'), 'wb').write(seal(app))
open(P('data', 'modeles.bin'), 'wb').write(seal(mod))
open(P('data', 'notice.bin'), 'wb').write(seal(notice))
version = secrets.token_hex(4)
json.dump({'salt': base64.b64encode(salt).decode(), 'iter': ITER, 'version': version}, open(P('data', 'keyinfo.json'), 'w'))
print('Chiffré, version', version)
