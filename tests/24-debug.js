'use strict';
/* CORRECTIFS.md § 19 — le panneau de débug.

   Il sert à diagnostiquer une saccade LÀ OÙ ELLE SE PRODUIT : sur le téléphone
   du joueur, pas sur une machine de développement. D'où deux exigences que l'on
   vérifie ici :

   - l'instrument doit être **gratuit** : un panneau qui alloue à chaque image
     mesurerait ses propres déchets, et le diagnostic serait faux ;
   - il ne doit **rien coûter quand il est éteint**. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Panneau de débug',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    // le bouton existe et bascule
    const avant = await page.evaluate(() => ({ actif: debugOn,
      libelle: document.getElementById('btDbg') && document.getElementById('btDbg').textContent }));
    v('le bouton DÉBUG existe', avant.libelle !== null && avant.libelle !== undefined,
      'aucun bouton');
    await page.click('#btDbg');
    const apres = await page.evaluate(() => ({ actif: debugOn,
      libelle: document.getElementById('btDbg').textContent,
      stocke: localStorage.getItem('kaze-debug') }));
    v('il allume le panneau et retient le choix',
      apres.actif === !avant.actif && apres.stocke === '1' && /✕/.test(apres.libelle),
      JSON.stringify(apres));

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      await dort(1200);                       // de quoi remplir l'historique

      /* ---------- le panneau est réellement dessiné, et il dit vrai ---------- */
      const vus = [];
      const vrai = window.texte;
      window.texte = (g, s, x, y, ...a) => {
        if (g === X) vus.push({ s: String(s), x, y, w: largeurTexte(s), h: 7 });
        return vrai(g, s, x, y, ...a);
      };
      panneauDebug();
      window.texte = vrai;
      out.lignes = vus.map(t => t.s);
      out.nbLignes = vus.length;
      out.debordeADroite = vus.filter(t => t.x + t.w > W).map(t => t.s);

      /* Il ne doit pas recouvrir le HUD — cœurs, rubis, étoiles : c'est
         justement ce qu'on veut continuer à voir pendant qu'on diagnostique. */
      const hud = { x: W - 92, y: 2, w: 92, h: 18 };
      const chev = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
                           * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      out.surHud = vus.filter(t => chev(t, hud) > 0).map(t => t.s);

      /* ---------- l'instrument ne doit rien allouer ---------- */
      out.tamponsFixes = (dbgDurees instanceof Float64Array)
                      && (dbgIntervalles instanceof Float64Array)
                      && dbgDurees.length === DBG_N;
      // les tampons sont les MÊMES objets après mille images de mesure
      const t1 = dbgDurees, t2 = dbgIntervalles;
      for (let k = 0; k < 1000; k++) { dbgStats(dbgDurees); }
      out.memesTampons = (dbgDurees === t1) && (dbgIntervalles === t2);
      // dbgStats ne rend qu'un petit objet : il ne trie ni ne copie le tampon
      const copie = Array.from(dbgDurees);
      dbgStats(dbgDurees);
      out.tamponIntact = Array.from(dbgDurees).every((x, i) => x === copie[i]);

      /* ---------- éteint, il ne mesure ni ne dessine rien ----------
         On compte les appels que fait la VRAIE boucle. Une première version
         appelait `boucleCorps()` à la main : or le panneau est dessiné par
         `boucle()`, qui l'enveloppe. Le contrôle restait donc vert même si le
         panneau se dessinait sans arrêt. */
      let appels = 0;
      const vraiP = window.panneauDebug;
      window.panneauDebug = function(){ appels++; return vraiP.apply(null, arguments); };
      basculerDebug();
      out.eteint = !debugOn;
      const avantI = dbgI;
      await dort(400);
      out.plusDeMesure = dbgI === avantI;      // l'index d'écriture n'avance plus
      out.appelsEteint = appels;
      basculerDebug();                          // on le rallume
      appels = 0;
      await dort(400);
      out.appelsAllume = appels;
      window.panneauDebug = vraiP;

      /* Une ligne trop longue doit être tronquée, pas laissée à déborder. */
      const vus3 = [];
      const vrai3 = window.texte;
      window.texte = (g, s, x, y, ...a) => {
        if (g === X) vus3.push({ s: String(s), x, w: largeurTexte(s) });
        return vrai3(g, s, x, y, ...a);
      };
      const vraiNom = NOMS_REGION[0];
      NOMS_REGION[0] = 'UN NOM DE RÉGION ABSURDEMENT LONG POUR VOIR';
      const yAv = J.y; J.y = 45 * TS;
      panneauDebug();
      J.y = yAv; NOMS_REGION[0] = vraiNom;
      window.texte = vrai3;
      out.longueTronquee = vus3.every(t => t.x + t.w <= W);
      return out;
    });

    v('LE PANNEAU EST RÉELLEMENT DESSINÉ', r.nbLignes >= 5, `${r.nbLignes} lignes`);
    v('il donne les images par seconde et le pire cas',
      /^IPS \d+/.test(r.lignes[0] || '') && /PIRE/.test(r.lignes[0] || ''), r.lignes[0]);
    v('il donne le lieu, les entités et les bandes',
      r.lignes.some(l => /ENN \d+/.test(l)) && r.lignes.some(l => /BANDES \d+\/\d+/.test(l)),
      r.lignes.join(' | '));
    v('AUCUNE LIGNE NE DÉBORDE DE L\'ÉCRAN',
      r.debordeADroite.length === 0, r.debordeADroite.join(' · '));
    v('IL NE RECOUVRE PAS LE HUD', r.surHud.length === 0, r.surHud.join(' · '));

    v('les tampons de mesure sont préalloués et de taille fixe', r.tamponsFixes, 'tampons dynamiques');
    v('L\'INSTRUMENT N\'ALLOUE PAS CE QU\'IL MESURE',
      r.memesTampons, 'les tampons sont recréés');
    v('il ne trie ni ne copie son historique', r.tamponIntact, 'le tampon a été réordonné');

    v('éteint, il cesse de mesurer', r.eteint && r.plusDeMesure, 'il mesure encore');
    v('ÉTEINT, LA BOUCLE NE LE DESSINE PLUS',
      r.appelsEteint === 0 && r.appelsAllume > 0,
      `${r.appelsEteint} appels éteint, ${r.appelsAllume} allumé`);
    v('UNE LIGNE TROP LONGUE EST TRONQUÉE, PAS LAISSÉE À DÉBORDER',
      r.longueTronquee, 'elle sort de l\'écran');
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
