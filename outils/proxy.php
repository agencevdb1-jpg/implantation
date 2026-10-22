<?php
/* Relais pour l'outil d'implantation (hébergement alwaysdata).
   Sert les services publics qui refusent les appels directs du navigateur et les serveurs Cloudflare :
   Géorisques, Géoportail de l'urbanisme, Atlas des patrimoines.
   Appel : https://grisel.alwaysdata.net/proxy.php?u=<URL encodée>[&bin=1] */
$ALLOWED = ['georisques.gouv.fr', 'www.georisques.gouv.fr', 'www.geoportail-urbanisme.gouv.fr', 'geoportail-urbanisme.gouv.fr',
            'apicarto.ign.fr', 'data.geopf.fr', 'geo.api.gouv.fr', 'atlas.patrimoines.culture.gouv.fr', 'atlas.patrimoines.culture.fr'];
$ORIGINS = ['https://agencevdb1-jpg.github.io'];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
header('Access-Control-Allow-Origin: ' . (in_array($origin, $ORIGINS, true) ? $origin : $ORIGINS[0]));
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Accept, Content-Type');
header('Vary: Origin');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }
if ($origin !== '' && !in_array($origin, $ORIGINS, true)) { http_response_code(403); exit('Origine refusée'); }

$u = $_GET['u'] ?? '';
$p = parse_url($u);
if (!$p || ($p['scheme'] ?? '') !== 'https' && ($p['scheme'] ?? '') !== 'http' || !in_array($p['host'] ?? '', $ALLOWED, true)) {
  http_response_code(403); exit('Site non autorisé');
}
$ch = curl_init($u);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 4,
  CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 60, CURLOPT_ENCODING => '',
  CURLOPT_USERAGENT => 'Mozilla/5.0 (outil implantation)',
  CURLOPT_HTTPHEADER => ['Accept: ' . ($_SERVER['HTTP_ACCEPT'] ?? '*/*')],
  CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | CURLPROTO_HTTP,
]);
$body = curl_exec($ch);
if ($body === false) { http_response_code(502); exit('Service indisponible : ' . curl_error($ch)); }
$code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'application/octet-stream';
curl_close($ch);
http_response_code($code);
header('Content-Type: ' . $type);
header('Cache-Control: public, max-age=3600');
echo $body;
