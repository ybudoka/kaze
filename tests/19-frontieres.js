'use strict';
/* CORRECTIFS.md § 18 — les monstres restent dans LEUR région. Un ennemi ne suit
   plus le héros d'une région à l'autre par les passages (le col, l'oued, le
   marécage) : son centre est confiné à la bande de sa région d'origine, fixée
   au premier réveil. On le vérifie sur le vrai jeu — on place l'ennemi près
   d'une frontière, le héros juste de l'autre côté, et on prouve que l'ennemi ne
   la franchit jamais, tout en continuant de chasser DANS sa région. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Frontières des régions',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const out = {};

      // un ennemi près de la frontière BASSE de sa région, le héros juste en
      // dessous (région suivante) et à portée : il descend vers lui mais ne doit
      // pas franchir la frontière.
      const versLeBas = (type, tyBord) => {
        ennemis.length = 0;
        pondre(type, 44, tyBord - 2);
        const e = ennemis[0]; e.pv = 999;
        J.x = 44 * TS + 8; J.y = (tyBord + 3) * TS + 8; J.z = 0; J.invuln = 9e9;
        let maxY = 0, rIdx = null;
        for (let f = 0; f < 240 && ennemis[0]; f++) { majEnnemis(); rIdx = ennemis[0].rIdx; maxY = Math.max(maxY, ennemis[0].y); }
        return { franchi: maxY >= tyBord * TS, rIdx, marge: tyBord * TS - maxY };
      };
      // idem vers le HAUT : héros au-dessus, l'ennemi ne remonte pas d'une région
      const versLeHaut = (type, tyBord) => {
        ennemis.length = 0;
        pondre(type, 44, tyBord + 2);
        const e = ennemis[0]; e.pv = 999;
        J.x = 44 * TS + 8; J.y = (tyBord - 3) * TS + 8; J.z = 0; J.invuln = 9e9;
        let minY = 1e9, rIdx = null;
        for (let f = 0; f < 240 && ennemis[0]; f++) { majEnnemis(); rIdx = ennemis[0].rIdx; minY = Math.min(minY, ennemis[0].y); }
        return { franchi: minY < tyBord * TS, rIdx, marge: minY - tyBord * TS };
      };

      out.braise = versLeBas('braise', Y_CIMES);    // Cendres (1) -> Cimes
      out.loup   = versLeBas('loup', Y_LAGON);      // Cimes (2)   -> Lagon
      out.triton = versLeBas('triton', Y_SABLES);   // Lagon (3)   -> Sables
      out.lancier = versLeBas('lancier', Y_MARAIS); // Sables (4)  -> Marais
      out.follet = versLeHaut('follet', Y_MARAIS);  // Marais (5) volant, ne remonte pas
      out.harpie = versLeHaut('harpie', Y_LAGON);   // Lagon (3) volant, ne remonte pas aux Cimes

      // la région d'origine est bien celle du réveil (indices attendus)
      out.indices = [out.braise.rIdx, out.loup.rIdx, out.triton.rIdx,
                     out.lancier.rIdx, out.follet.rIdx, out.harpie.rIdx];

      // le confinement ne CASSE PAS la chasse : dans sa propre région, l'ennemi
      // se rapproche toujours du héros.
      ennemis.length = 0;
      pondre('gluant', 20, 100);
      const g = ennemis[0]; g.pv = 999; const y0 = g.y;
      J.x = 20 * TS + 8; J.y = 110 * TS + 8; J.z = 0; J.invuln = 9e9;   // à portée (< 210px)
      for (let f = 0; f < 160 && ennemis[0]; f++) majEnnemis();
      out.chasseIntra = ennemis[0] ? ennemis[0].y - y0 : 0;

      return out;
    });

    const confine = (o, nom) => v(`${nom} ne franchit pas sa frontière`,
      !o.franchi, `franchie (marge ${o.marge}px, région ${o.rIdx})`);
    confine(r.braise, 'la braise des Cendres');
    confine(r.loup, 'le loup des Cimes');
    confine(r.triton, 'le triton du Lagon');
    confine(r.lancier, 'le lancier des Sables');
    v('le follet du Marais ne remonte pas vers les Sables', !r.follet.franchi,
      `franchie (marge ${r.follet.marge}px)`);
    v('la harpie du Lagon ne remonte pas vers les Cimes', !r.harpie.franchi,
      `franchie (marge ${r.harpie.marge}px)`);
    v('chaque monstre garde la région de son réveil',
      r.indices.join() === '1,2,3,4,5,3', r.indices.join());
    v('LE CONFINEMENT NE CASSE PAS LA CHASSE (il avance vers le héros)',
      r.chasseIntra > 8, `${Math.round(r.chasseIntra)}px vers le héros`);
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
