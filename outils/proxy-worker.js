/* Relais Cloudflare Worker pour l'outil d'implantation (remplace api/proxy.php).
   Utilisé uniquement pour les services qui refusent les appels directs depuis un navigateur :
   Géorisques et les documents du Géoportail de l'urbanisme (fiches et règlements PLU en PDF).
   Appel : https://<worker>.workers.dev/?u=<URL encodée>[&bin=1]
   Seuls les sites publics listés ci-dessous sont relayés. */
const ALLOWED = [
  'georisques.gouv.fr', 'www.georisques.gouv.fr',
  'www.geoportail-urbanisme.gouv.fr', 'geoportail-urbanisme.gouv.fr',
  'apicarto.ign.fr', 'data.geopf.fr', 'geo.api.gouv.fr', 'wxs.ign.fr'
];
// Sites autorisés à utiliser le relais (votre GitHub Pages). Laisser vide = tous.
const ORIGINS = [];

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.length && !ORIGINS.includes(origin) ? ORIGINS[0] : (origin || '*'),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Content-Type',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (ORIGINS.length && origin && !ORIGINS.includes(origin)) return new Response('Origine refusée', { status: 403, headers: cors });
    const u = new URL(request.url).searchParams.get('u');
    let target;
    try { target = new URL(u); } catch (e) { return new Response('Paramètre u manquant', { status: 400, headers: cors }); }
    if (target.protocol !== 'https:' || !ALLOWED.includes(target.hostname)) return new Response('Site non autorisé', { status: 403, headers: cors });
    const r = await fetch(target.toString(), {
      headers: { 'Accept': request.headers.get('Accept') || '*/*', 'User-Agent': 'Mozilla/5.0 (implantation)' },
      cf: { cacheTtl: 3600, cacheEverything: true }
    });
    const h = new Headers(cors);
    h.set('Content-Type', r.headers.get('Content-Type') || 'application/octet-stream');
    h.set('Cache-Control', 'public, max-age=3600');
    return new Response(r.body, { status: r.status, headers: h });
  }
};
