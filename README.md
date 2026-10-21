# Outil d'implantation (version autonome)

Plan de masse sur parcelle et chiffrage, à partir des modèles du book tarifaire.
Copie autonome de l'outil v4.3.1, hébergée sur GitHub Pages, sans serveur PHP.

## Fonctionnement

- **Accès** : un mot de passe commun déchiffre le code, les tarifs et la notice (AES-GCM 256, clé PBKDF2). Sans lui, les fichiers `data/*.bin` sont illisibles.
- **Projets** : enregistrés dans le navigateur de chaque poste (IndexedDB). « Mes projets » propose d'exporter et d'importer une sauvegarde.
- **Profil** (nom, agence, photo pour les PDF) : enregistré dans le navigateur, modifiable dans « Mon compte ».
- **Services publics appelés directement** : API Carto IGN (cadastre, zonage PLU, servitudes), Géoplateforme (géocodage, altimétrie, WFS), geo.api.gouv.fr.
- **Relais** (`outils/proxy-worker.js`, Cloudflare Workers, gratuit) : Géorisques et documents du Géoportail de l'urbanisme, qui refusent les appels directs. Son adresse se règle dans `config.js`.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | page et styles (en clair) |
| `app-shim.js` | verrou, remplacement des API PHP, sauvegardes |
| `config.js` | adresse du relais |
| `data/app.bin` | code de l'application (chiffré) |
| `data/modeles.bin` | catalogue des modèles et tarifs (chiffré) |
| `data/notice.bin` | notice descriptive Équation (chiffrée) |
| `data/modeles/` | plans et visuels des modèles |
| `vendor/` | bibliothèques PDF, géométrie, lecture PLU, aide |

## Modifier l'outil

```
python3 outils/dechiffrer.py "MOT-DE-PASSE"   # crée _prive/app.js, _prive/modeles.json, _prive/notice.pdf
# … modifications …
python3 outils/chiffrer.py "MOT-DE-PASSE"     # met à jour data/*.bin
```
Le dossier `_prive/` n'est jamais publié. `index.html`, `app-shim.js` et `config.js` se modifient directement.
