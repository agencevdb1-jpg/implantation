"""Déchiffre le code, le catalogue et la notice dans _prive/ (ignoré par git) pour les modifier.
Usage : python3 outils/dechiffrer.py "MOT-DE-PASSE"
"""
import base64, json, os, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pw = sys.argv[1]
ki = json.load(open(os.path.join(ROOT, 'data/keyinfo.json')))
key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=base64.b64decode(ki['salt']), iterations=ki['iter']).derive(pw.encode())
aes = AESGCM(key)
os.makedirs(os.path.join(ROOT, '_prive'), exist_ok=True)
for src, dst in (('app.bin', 'app.js'), ('modeles.bin', 'modeles.json'), ('notice.bin', 'notice.pdf')):
    b = open(os.path.join(ROOT, 'data', src), 'rb').read()
    out = aes.decrypt(b[:12], b[12:], None)
    if dst == 'modeles.json':
        out = json.dumps(json.loads(out), ensure_ascii=False, indent=1).encode()
    open(os.path.join(ROOT, '_prive', dst), 'wb').write(out)
    print('_prive/' + dst, len(out))
