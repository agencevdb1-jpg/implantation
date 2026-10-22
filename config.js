window.IMPLANT_CONFIG={
  // Relais (outils/proxy-worker.js) pour les services qui refusent les appels directs du navigateur
  proxy:'https://implant-relais.agencevdb1.workers.dev/',
  // Services qui refusent aussi le relais Cloudflare : appel abandonné tout de suite au lieu d'attendre
  blockedHosts:['georisques.gouv.fr','www.georisques.gouv.fr','www.geoportail-urbanisme.gouv.fr']
};
