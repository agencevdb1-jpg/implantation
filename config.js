window.IMPLANT_CONFIG={
  // Relais PHP sur alwaysdata (outils/proxy.php) pour les services qui refusent les appels directs du navigateur
  proxy:'https://grisel.alwaysdata.net/proxy.php',
  // Services injoignables même via le relais : appel abandonné tout de suite au lieu d'attendre
  blockedHosts:['www.geoportail-urbanisme.gouv.fr']
};
