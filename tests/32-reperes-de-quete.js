'use strict';
/* CORRECTIFS.md § 38 — les ramassages de quête qui ne se voyaient pas.

   Les six FLEURS DE GIVRE et les huit PAPILLONS sont posés à la volée par
   `perchoirLibre` : faute de table de positions, ils étaient les seuls
   ramassages de quête sans repère sur la carte. Six fleurs blanches sur la
   neige d'une région de 6 400 cases, cela ne se cherche pas à l'œil — et la
   fleur, la perle et le fragment de fresque sont chacun peints de la couleur
   de leur propre décor, sans halo pour les détacher. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Les ramassages de quête se voient',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      const nb = t => butins.filter(b => b.type === t).length;
      out.nb = { fleur: nb('fleurgivre'), papillon: nb('papillon'),
                 perle: nb('perle2'), fresque: nb('fresque') };
      out.fleursDansLesCimes = butins.filter(b => b.type === 'fleurgivre')
        .every(b => b.y >= Y_CIMES * TS && b.y < Y_LAGON * TS);

      /* ---- les repères de la carte, relevés au tracé ---- */
      for (let i = 0; i < vu.length; i++) vu[i] = 1;
      const rects = [];
      const vraiFill = X.fillRect.bind(X);
      let capture = false;
      X.fillRect = (x, y, w, h) => { if (capture) rects.push({ c: X.fillStyle, x, y, w, h });
                                     return vraiFill(x, y, w, h); };
      const releve = region => {
        carteRegion = region; rects.length = 0;
        capture = true; ecranCarte(); capture = false;
        return rects.slice();
      };
      const compte = (rs, pal) => rs.filter(o => o.c === pal.a || o.c === pal.b).length;
      etat = 'carte'; await dort(200);
      const cimes = releve(2);
      out.repFleurs = compte(cimes, REPS.fleur);
      out.repCloches = compte(cimes, REPS.cloche);   // témoin : les cloches en avaient déjà
      const vallee = releve(0);
      out.repPapillonVallee = compte(vallee, REPS.papillon);

      /* ---- CORRECTIFS.md § 41 — et sous le VRAI brouillard ?
         Le relevé ci-dessus force `vu` à 1 partout : il était vert alors que la
         carte, en jeu, ne montrait aucune fleur. On rejoue donc la scène réelle
         — brouillard rendu à son état neuf, quête de Borve ouverte, joueur au
         col — et l'on recompte. Les CLOCHES servent de témoin : elles restent
         soumises au brouillard, et doivent rester invisibles ici. */
      vu.fill(0);
      Q.guideParle = true;
      const col = [(CIMES.col.x0 + CIMES.col.x1) >> 1, Y_CIMES + 4];
      J.x = col[0] * TS + 8; J.y = col[1] * TS + 8; J.z = Etg(col[0], col[1]) * EH;
      etat = 'jeu'; await dort(400);
      etat = 'carte'; await dort(200);
      const auCol = releve(2);
      /* 6 repères + la pastille de la légende « FLEUR », de la même teinte. */
      out.repFleursAuCol = compte(auCol, REPS.fleur);
      out.repClochesAuCol = compte(auCol, REPS.cloche);
      out.partExploreeCimes = +(Array.from(vu.slice(Y_CIMES * MW, Y_LAGON * MW))
        .reduce((a, b) => a + b, 0) / ((Y_LAGON - Y_CIMES) * MW) * 100).toFixed(1);

      X.fillRect = vraiFill;
      etat = 'jeu';

      /* ---- le halo : sans lui, blanc sur neige, terre cuite sur sable ---- */
      const halo = async type => {
        const b = butins.find(o => o.type === type);
        if (!b) return null;
        J.x = b.x; J.y = b.y + 2 * TS; J.z = 0; ennemis.length = 0; boss = null;
        await dort(220);
        /* On ne compte QUE le halo de ce butin-là : d'autres objets auréolés
           traînent à l'écran, et un décompte global reste vert sans lui. */
        let n = 0;
        const vraiDraw = X.drawImage.bind(X);
        X.drawImage = (img, ...a) => {
          if (img === glowCV && Math.abs(a[0] - (b.x - 20)) < 2 && Math.abs(a[1] - (b.y - b.z - 28)) < 2) n++;
          return vraiDraw(img, ...a);
        };
        rendreMonde();
        X.drawImage = vraiDraw;
        return n;
      };
      out.halo = {};
      for (const t of ['fleurgivre', 'perle2', 'fresque']) out.halo[t] = await halo(t);
      return out;
    });

    v('les six fleurs de givre sont posées, dans les Cimes',
      r.nb.fleur === 6 && r.fleursDansLesCimes, JSON.stringify(r.nb));
    v('CHAQUE FLEUR DE GIVRE A SON REPÈRE SUR LA CARTE',
      r.repFleurs === 6, `${r.repFleurs} repère(s) pour 6 fleurs`);
    v('contrôle à blanc : les cloches, elles, en avaient déjà',
      r.repCloches === 3, `${r.repCloches} cloche(s)`);
    v('AU COL, SOUS LE VRAI BROUILLARD : LES SIX FLEURS SE VOIENT',
      r.repFleursAuCol === 7,        // 6 repères + la pastille de la légende
      `${r.repFleursAuCol} rectangle(s) pour 6 fleurs + 1 pastille` +
      ` — ${r.partExploreeCimes} % des Cimes exploré`);
    v('témoin : les cloches, elles, restent sous le brouillard',
      r.repClochesAuCol === 0, `${r.repClochesAuCol} cloche(s) au col`);
    v('le papillon de la vallée a le sien aussi',
      r.repPapillonVallee === 1, `${r.repPapillonVallee}`);
    v('fleur, perle et fresque s\'auréolent au sol',
      Object.values(r.halo).every(n => n >= 1), JSON.stringify(r.halo));

    await page.context().close();
  },
};
