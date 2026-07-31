'use strict';
/* Le jeu s'installe et se joue hors ligne (PWA), sans jamais rester coincé
   sur une ancienne version. Ces contrôles tournent sur un vrai serveur HTTP :
   un service worker refuse de s'enregistrer en file://. */
const { serveurStatique } = require('./outils');

module.exports = {
  nom: 'Hors ligne (PWA)',
  async executer({ navigateur, v }) {
    const serveur = await serveurStatique();
    const ctx = await navigateur.newContext({ viewport: { width: 414, height: 820 } });
    const page = await ctx.newPage();
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));

    try {
      await page.goto(serveur.url, { waitUntil: 'load' });

      // le service worker doit s'enregistrer puis prendre la main
      const actif = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return 'pas de support';
        const r = await navigator.serviceWorker.ready;
        return r.active ? r.active.state : 'inactif';
      });
      v('le service worker s\'active', actif === 'activated' || actif === 'activating', actif);

      // laisser le temps de mettre les fichiers en cache
      await page.waitForTimeout(1200);
      const enCache = await page.evaluate(async () => {
        const noms = await caches.keys();
        if (!noms.length) return [];
        const c = await caches.open(noms[0]);
        return (await c.keys()).map(r => new URL(r.url).pathname);
      });
      v('les fichiers du jeu sont mis en cache', enCache.length >= 3, JSON.stringify(enCache));

      // --- hors ligne : le jeu doit encore démarrer
      await ctx.setOffline(true);
      await page.goto(serveur.url, { waitUntil: 'load' });
      await page.waitForTimeout(900);
      const horsLigne = await page.evaluate(() => ({
        demarre: typeof etat !== 'undefined' && typeof MW !== 'undefined',
        canvas: !!document.getElementById('c'),
        region: typeof Y_CENDRE !== 'undefined' ? Y_CENDRE : null,
      }));
      v('LE JEU DÉMARRE HORS LIGNE',
        horsLigne.demarre && horsLigne.canvas, JSON.stringify(horsLigne));
      v('les deux régions sont là hors ligne', horsLigne.region === 80, horsLigne.region);

      // --- de retour en ligne, une nouvelle version doit parvenir au joueur
      await ctx.setOffline(false);
      serveur.marquer('version-neuve');
      await page.goto(serveur.url, { waitUntil: 'load' });
      await page.waitForTimeout(500);
      const marqueur = await page.evaluate(() =>
        (document.querySelector('meta[name=marqueur]') || {}).content || '');
      v('EN LIGNE, LA DERNIÈRE VERSION EST SERVIE (pas de cache figé)',
        marqueur === 'version-neuve', `marqueur reçu : « ${marqueur} »`);

      v('aucune erreur JS', erreurs.length === 0, erreurs[0]);
    } finally {
      await ctx.close();
      await serveur.fermer();
    }
  },
};
