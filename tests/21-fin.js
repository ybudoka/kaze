'use strict';
/* CORRECTIFS.md § 14.3 — la fin, et l'atteignabilité des deux derniers mondes.

   La fin n'est pas un écran : c'est un état de jeu qui remonte les huit mondes
   à la caméra, chacun avec son morceau, puis pose le bilan. On mesure le
   parcours réel de la caméra, les morceaux traversés, et le compte final.

   On mesure aussi qu'aucun des deux mondes ne se traverse SANS son outil et
   se traverse AVEC — c'est la règle d'or du plan : toute énigme est mesurée. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'La fin et les derniers verrous',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};

      /* ---------- atteignabilité, avec les vraies règles de collision ---------- */
      const joignable = (sx, sy) => {
        const passable = (x, y) => {
          if (!dansCarte(x, y)) return false;
          const s = Sol(x, y);
          if (s === S.EAU || s === S.EAUPROF) return !!Q.palmes;
          if (s === S.LAVE || s === S.SABLEMOU) return false;
          if (s === S.BRAISE && !Q.bottes) return false;
          if (s === S.VIDE) return !!Q.cape;        // le vide ne se franchit qu'en planant
          const o = Obj(x, y);
          if (o === O.PORTAIL) return !!Q.portailOuvert;
          if (o === O.ROCNOIR || o === O.GLACON || o === O.BLOCLOURD || o === O.RONCE) return false;
          if (o === O.ECLATNOIR) return !!Q.epreuveFinale;
          if (o && DUR_O[o] && !FRANCH_O[o]) return false;
          return true;
        };
        const vus = new Uint8Array(MW * MH), f = [[sx, sy]];
        vus[sy * MW + sx] = 1;
        while (f.length) { const [x, y] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx] || !passable(nx, ny)) continue;
            if (!(Etg(nx, ny) <= Etg(x, y) || Sol(nx, ny) === S.RAMPE || Sol(x, y) === S.RAMPE)) continue;
            vus[ny * MW + nx] = 1; f.push([nx, ny]); } }
        return vus;
      };
      const accostable = (vus, [x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .some(([dx, dy]) => dansCarte(x + dx, y + dy) && !!vus[(y + dy) * MW + x + dx]);

      // départ : la sortie de la tour, dans les Nues
      const dep = [(NUES.tour.x0 + NUES.tour.x1) >> 1, Y_NUES + 3];
      Q.palmes = true; Q.bottes = true; Q.portailOuvert = true;

      // 1) le Parvis des Vents se gagne À PIED : la cape y est, on ne peut pas
      //    exiger de l'avoir déjà pour l'atteindre.
      Q.cape = false;
      let a = joignable(dep[0], dep[1]);
      out.parvisSansCape = accostable(a, CAPE_POS);
      // 2) mais le Belvédère, lui, est de l'autre côté du vide
      const ar = NUES.arene, cxA = ar.x0 + (ar.w >> 1);
      out.belvedereSansCape = accostable(a, [cxA, ar.y0]);
      Q.cape = true;
      a = joignable(dep[0], dep[1]);
      out.belvedereAvecCape = accostable(a, [cxA, ar.y0]);
      out.carillonsAtteignables = CARILLONS_POS.filter(p => accostable(a, p)).length;

      // 3) la Faille : les trois sceaux sont derrière l'outil de leur monde
      Q.epreuveFinale = false;
      const dep2 = [(FAILLE.bouche.x0 + FAILLE.bouche.x1) >> 1, Y_FAILLE + 4];
      const b = joignable(dep2[0], dep2[1]);
      out.sceauxBloques = SCEAUX_POS.filter(p => accostable(b, p)).length;   // doit être 0
      // avec les outils, les obstacles tombent : on les retire comme le ferait
      // le boomerang, le bracelet et le fanal, puis on remesure
      for (let y = Y_FAILLE; y < MH; y++) for (let x = 0; x < MW; x++) {
        const o = Obj(x, y);
        if (o === O.GLACON || o === O.BLOCLOURD || o === O.RONCE) putO(x, y, O.RIEN);
      }
      const c = joignable(dep2[0], dep2[1]);
      out.sceauxOuverts = SCEAUX_POS.filter(p => accostable(c, p)).length;   // doit être 3
      // et la salle finale reste close tant que les sceaux tiennent
      const fi = FAILLE.finale, cxF = fi.x0 + (fi.w >> 1);
      out.finaleClose = !accostable(c, [cxF, fi.y0 + 2]);
      Q.epreuveFinale = true;
      for (let y = Y_FAILLE; y < MH; y++) for (let x = 0; x < MW; x++)
        if (Obj(x, y) === O.ECLATNOIR) putO(x, y, O.RIEN);
      const d2 = joignable(dep2[0], dep2[1]);
      out.finaleOuverte = accostable(d2, [cxF, fi.y0 + 2]);
      // l'arène du Rongeur, au bout
      const ra = FAILLE.arene;
      out.areneAtteignable = accostable(d2, [ra.x0 + (ra.w >> 1), ra.y0]);

      /* ---------- l'épilogue ---------- */
      // on se donne une partie complète, pour que le bilan ait quelque chose à dire
      J.objets = ['arc', 'bombe', 'marteau', 'boomerang', 'grappin', 'bracelet', 'fanal',
                  'cape', 'filet'];
      /* `cloches: 5` ne prouvait rien : elles sont TROIS, et le bilan exigeait
         `>=5` — la ligne était donc fausse des deux côtés à la fois, et le
         contrôle passait. On met le vrai compte. */
      Object.assign(Q, { chefTue: true, coeurTue: true, yetiTue: true, leviathanTue: true,
        colosseTue: true, reineTue: true, sentinelleTue: true, rongeurTue: true,
        epeeLongue: true, coeurCristal: true, primeRendue: true, lanterne: 3, brasiers: 3,
        cloches: 3, fleursRendues: true, perlesRendues: true, fresquesRendues: true,
        veilleuses: 7, carillons: 8, lucioles: 8,
        papillonsPris: [1, 1, 1, 1, 1, 1, 1, 1], papillonsRendus: true });
      J.pvmax = 20; J.rubis = 421;
      out.bilan = bilanComplétion();

      lancerEpilogue();
      out.etatEpilogue = etat;
      const camY = [], themes = [];
      for (let f = 0; f < 1500; f++) {
        majEpilogue();
        /* Relevé serré : à un échantillon toutes les 60 images, une région
           entière pouvait passer entre deux mesures. */
        if (f % 20 === 0) { camY.push(Math.round(epiY / TS)); themes.push(themeVoulu()); }
      }
      out.premiereRangee = Math.round(camY[0]);
      out.derniereRangee = Math.round(epiY / TS);
      out.monteToujours = camY.every((y, i) => i === 0 || y <= camY[i - 1] + 1);
      out.themesTraverses = [...new Set(themes)];
      out.pauseFinale = epiPause === 1;
      // START ne doit rien faire tant que le bilan n'est pas posé
      etat = 'epilogue'; epiPause = 0;
      out.pasEcourtable = epiPause === 0;
      return out;
    });

    v('LE PARVIS DES VENTS SE GAGNE À PIED (la cape y est)',
      r.parvisSansCape, 'la cape est enfermée derrière elle-même');
    v('LE BELVÉDÈRE EST INATTEIGNABLE SANS LA CAPE',
      !r.belvedereSansCape, 'on y va à pied : le vide ne barre rien');
    v('et atteignable avec elle', r.belvedereAvecCape, 'toujours bloqué');
    v('les huit carillons sont atteignables en planant',
      r.carillonsAtteignables === 8, `${r.carillonsAtteignables}/8`);

    v('LES TROIS SCEAUX SONT BARRÉS PAR L\'OUTIL DE LEUR MONDE',
      r.sceauxBloques === 0, `${r.sceauxBloques}/3 déjà accessibles`);
    v('et accessibles une fois les obstacles levés',
      r.sceauxOuverts === 3, `${r.sceauxOuverts}/3`);
    v('LA SALLE FINALE RESTE CLOSE TANT QUE LES SCEAUX TIENNENT',
      r.finaleClose, 'elle est déjà ouverte');
    v('les sceaux brisés l\'ouvrent', r.finaleOuverte, 'toujours close');
    v('l\'arène du Rongeur est au bout', r.areneAtteignable, 'injoignable');

    v('l\'épilogue est un état de jeu', r.etatEpilogue === 'epilogue', r.etatEpilogue);
    v('LA CAMÉRA REMONTE DU FOND DE LA FAILLE JUSQU\'AU VILLAGE',
      r.premiereRangee > 600 && r.derniereRangee < 60,
      `de la rangée ${r.premiereRangee} à ${r.derniereRangee}`);
    v('elle ne redescend jamais', r.monteToujours, 'le travelling recule');
    v('CHAQUE MONDE TRAVERSÉ RAMÈNE SON PROPRE MORCEAU',
      ['faille', 'nues', 'marais', 'sables', 'lagon', 'cimes', 'cendre', 'vallee']
        .every(t => r.themesTraverses.includes(t)),
      r.themesTraverses.join(','));
    v('le voyage se termine sur le thème de la victoire',
      r.themesTraverses.includes('victoire'), r.themesTraverses.join(','));
    v('le bilan s\'ouvre à la fin', r.pauseFinale, 'jamais posé');
    /* Une partie où TOUT est fait doit afficher le plein partout. On ne fige
       plus les totaux (« 8/8 », « 10/10 ») : ils changent dès qu'on ajoute un
       outil ou une quête, et le contrôle se mettait alors à mentir sur l'un
       pendant qu'il vérifiait l'autre. On exige simplement que les deux
       nombres de chaque ligne soient égaux. */
    {
      const plein = nom => {
        const l = r.bilan.find(x => x[0] === nom);
        if (!l) return false;
        const m = /^(\d+)\/(\d+)$/.exec(l[1]);
        return !!m && m[1] === m[2];
      };
      v('LE BILAN AFFICHE LE PLEIN QUAND TOUT EST FAIT',
        ['ARMES ET OUTILS', 'GARDIENS ABATTUS', 'QUÊTES ANNEXES', 'PAPILLONS']
          .every(plein), JSON.stringify(r.bilan));
    }
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
