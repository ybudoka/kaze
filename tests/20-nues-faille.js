'use strict';
/* CORRECTIFS.md § 14 — les mondes 7 et 8, et la fin.

   Cité des Nues : rien ne se traverse à pied. Le vide fait tomber, la cape
   fait planer, les colonnes d'air rallongent le vol. On le mesure sur le vrai
   jeu : sans la cape le vide reprend, avec elle il ne reprend pas.

   La Faille : trois paliers rejouant chacun l'outil d'un monde traversé, une
   salle finale scellée tant que les trois sceaux tiennent, et le Rongeur. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Cité des Nues & la Faille',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      out.MH = MH;
      out.bornes = [Y_CENDRE, Y_CIMES, Y_LAGON, Y_SABLES, Y_MARAIS, Y_NUES, Y_FAILLE];
      out.regions = [regionDe((Y_NUES + 10) * TS), regionDe((Y_FAILLE + 10) * TS)];

      /* ---------- le décor des deux régions existe ---------- */
      const compteS = (y0, y1, s) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < MW; x++) if (Sol(x, y) === s) n++; return n; };
      const compteO = (y0, y1, o) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < MW; x++) if (Obj(x, y) === o) n++; return n; };
      out.vide = compteS(Y_NUES, Y_FAILLE, S.VIDE);
      out.pierreCiel = compteS(Y_NUES, Y_FAILLE, S.PIERRECIEL);
      out.colonnes = compteO(Y_NUES, Y_FAILLE, O.COLONNE);
      out.carillons = compteO(Y_NUES, Y_FAILLE, O.CARILLON);
      out.sceaux = compteO(Y_FAILLE, MH, O.SCEAU);
      out.eclatsNoirs = compteO(Y_FAILLE, MH, O.ECLATNOIR);
      // les épreuves de la Faille rejouent bien les outils des mondes traversés
      out.faillePieces = {
        glacons: compteO(FAILLE.palier1.y0, FAILLE.palier1.y0 + FAILLE.palier1.h, O.GLACON),
        blocs:   compteO(FAILLE.palier2.y0, FAILLE.palier2.y0 + FAILLE.palier2.h, O.BLOCLOURD),
        ronces:  compteO(FAILLE.palier3.y0, FAILLE.palier3.y0 + FAILLE.palier3.h, O.RONCE)
      };

      /* ---------- LE VIDE : il reprend, et la cape l'en empêche ---------- */
      const posVide = (() => {
        for (let y = Y_NUES + 20; y < Y_NUES + 60; y++) for (let x = 10; x < MW - 10; x++)
          if (Sol(x, y) === S.VIDE && Obj(x, y) === O.RIEN
              && Sol(x, y - 3) === S.PIERRECIEL) return [x, y];
        return null;
      })();
      out.trouveVide = !!posVide;
      const poser = (tx, ty) => { J.x = tx * TS + 8; J.y = ty * TS + 8; J.z = 0; J.vz = 0;
        J.enAir = false; J.kx = 0; J.ky = 0; J.invuln = 0; J.plane = 0; };
      if (posVide) {
        const [vx, vy] = posVide;
        // 1) sans la cape : on tombe, on perd un cœur, on revient au sol ferme
        Q.cape = false; J.objets = []; J.objSel = 0;
        J.pv = J.pvmax = 12;
        poser(vx, vy - 3); await dort(120);            // un pas de sol ferme d'abord
        const solX = J.solX, solY = J.solY, pv0 = J.pv;
        poser(vx, vy); J.solX = solX; J.solY = solY;   // puis on entre dans le vide
        await dort(220);
        out.chute = { pvPerdu: pv0 - J.pv, revenu: Math.hypot(J.x - solX, J.y - solY) < 4,
                      surLeVide: Sol(Math.floor(J.x / TS), Math.floor(J.y / TS)) === S.VIDE };
        // 2) avec la cape et en plein vol : le vide ne reprend pas
        Q.cape = true; J.objets = ['cape']; J.objSel = 0;
        J.pv = J.pvmax; poser(vx, vy - 3); await dort(90);
        J.invuln = 99999;
        capeAction();                                   // on ouvre la cape
        poser2: { }
        J.x = vx * TS + 8; J.y = vy * TS + 8;            // et on entre dans le vide
        const pv1 = J.pv;
        await dort(150);
        out.plane = { encoreSurLeVide: Sol(Math.floor(J.x / TS), Math.floor(J.y / TS)) === S.VIDE,
                      pvPerdu: pv1 - J.pv, planeRestant: J.plane };
      }

      /* ---------- une colonne d'air relance le vol, mais seulement avec la cape ---------- */
      const posCol = (() => { for (let y = Y_NUES + 4; y < Y_FAILLE - 4; y++) for (let x = 4; x < MW - 4; x++)
        if (Obj(x, y) === O.COLONNE) return [x, y]; return null; })();
      out.trouveColonne = !!posCol;
      if (posCol) {
        const [cx, cy] = posCol;
        Q.cape = false; J.plane = 0; J.invuln = 99999;
        J.x = cx * TS + 8; J.y = cy * TS + 8; J.z = 0; J.vz = 0;
        majVol();
        out.colonneSansCape = J.plane;                  // doit rester 0
        /* Sans la cape, la passe précédente a fait tomber le héros : le vide
           l'a renvoyé au sol ferme. Il faut donc le REMETTRE sur la colonne
           avant de réessayer, sinon la seconde mesure ne mesure rien. */
        Q.cape = true; J.plane = 0; J.vz = 0;
        J.x = cx * TS + 8; J.y = cy * TS + 8; J.z = 0;
        out.colonneEstDansLeVide = Sol(cx, cy) === S.VIDE;
        majVol();
        out.colonneAvecCape = J.plane;                  // doit porter
      }

      /* ---------- LA CAPE : elle est bien dans le monde, et s'équipe ---------- */
      out.capeEnPlace = butins.some(b => b.type === 'cape');
      J.objets = []; Q.cape = false; J.objSel = 0;
      ramasserButin({ x: J.x, y: J.y, z: 0, type: 'cape' });
      out.capeRecue = Q.cape && J.objets.includes('cape') && J.objets[J.objSel] === 'cape';

      /* ---------- les carillons : au boomerang, pas à l'épée ---------- */
      Q.carillons = 0;
      const [kx, ky] = CARILLONS_POS[0];
      J.x = kx * TS + 8; J.y = (ky + 1) * TS + 8; J.z = 0; J.dir = 0; J.invuln = 99999;
      zoneDegats(J.x, J.y - 19, 32, 38, 1, 'epee');
      out.carillonEpee = Q.carillons;                   // l'épée ne doit rien faire
      sonnerCarillon(kx, ky);
      out.carillonBoomerang = Q.carillons;
      out.carillonTuile = Obj(kx, ky) === O.CARILLONVIF;
      sonnerCarillon(kx, ky);
      out.carillonPasDeDoublon = Q.carillons === 1;

      /* ---------- les sceaux ouvrent la salle finale ---------- */
      Q.sceaux = 0; Q.epreuveFinale = false;
      for (const [sx, sy] of SCEAUX_POS) {
        J.x = sx * TS + 8; J.y = sy * TS + 8; J.z = Etg(sx, sy) * EH;
        briserSceau();
      }
      out.sceauxBrises = Q.sceaux;
      out.epreuveOuverte = Q.epreuveFinale;
      out.eclatsRestants = compteO(Y_FAILLE, MH, O.ECLATNOIR);

      /* ---------- les deux gardiens ---------- */
      boss = null; Q.sentinelleTue = false; Q.failleOuverte = false;
      const ar = NUES.arene;
      J.x = (ar.x0 + (ar.w >> 1)) * TS + 8; J.y = (ar.y0 + 4) * TS + 8; J.z = 0; J.invuln = 99999;
      await dort(280);
      out.sentinelleReveil = !!(boss && boss.type === 'sentinelle');
      if (boss) boss.pv = 0;
      await dort(280);
      out.sentinelleTombe = !boss && !!Q.sentinelleTue;
      out.failleOuverteParLaSentinelle = !!Q.failleOuverte;

      boss = null; Q.rongeurTue = false;
      const ra = FAILLE.arene;
      J.x = (ra.x0 + (ra.w >> 1)) * TS + 8; J.y = (ra.y0 + 4) * TS + 8; J.z = 0; J.invuln = 99999;
      await dort(280);
      out.rongeurReveil = !!(boss && boss.type === 'rongeur');
      // les cinq paliers doivent se suivre dans l'ordre, sans trou
      if (boss) {
        const vus = [];
        for (const p of [1, .75, .55, .35, .15]) { boss.pv = boss.pvmax * p; vus.push(palierRongeur(boss)); }
        out.paliers = vus.join();
        boss.pv = 0;
      }
      await dort(300);
      out.rongeurTombe = !boss && !!Q.rongeurTue;
      out.etoilesRendues = butins.filter(b => b.type === 'etoileVolee').length;
      return out;
    });

    v('la carte compte huit régions',
      r.MH === 640 && r.bornes.join() === '80,160,240,320,400,480,560', `${r.MH} / ${r.bornes.join()}`);
    v('les deux nouvelles bandes ont leur région',
      r.regions.join() === 'nues,faille', r.regions.join());
    v('la Cité des Nues est faite de vide et d\'îles',
      r.vide > 3000 && r.pierreCiel > 800, `vide=${r.vide} pierre=${r.pierreCiel}`);
    v('les colonnes d\'air et les huit carillons sont posés',
      r.colonnes > 30 && r.carillons === 8, `colonnes=${r.colonnes} carillons=${r.carillons}`);
    v('la Faille a ses trois sceaux et sa porte scellée',
      r.sceaux === 3 && r.eclatsNoirs === 3, `sceaux=${r.sceaux} éclats=${r.eclatsNoirs}`);
    v('LES TROIS PALIERS REJOUENT LES OUTILS DES MONDES TRAVERSÉS',
      r.faillePieces.glacons > 0 && r.faillePieces.blocs > 0 && r.faillePieces.ronces > 0,
      JSON.stringify(r.faillePieces));

    v('on trouve du vide bordé d\'île pour l\'essai', r.trouveVide, 'aucun vide utilisable');
    v('SANS LA CAPE, LE VIDE REPREND ET RAMÈNE AU SOL FERME',
      r.chute && r.chute.pvPerdu > 0 && r.chute.revenu && !r.chute.surLeVide,
      JSON.stringify(r.chute));
    v('AVEC LA CAPE, ON PLANE AU-DESSUS DU VIDE SANS TOMBER',
      r.plane && r.plane.encoreSurLeVide && r.plane.pvPerdu === 0 && r.plane.planeRestant > 0,
      JSON.stringify(r.plane));
    v('une colonne d\'air est trouvée', r.trouveColonne, 'aucune colonne');
    v('une colonne d\'air se dresse bien au-dessus du vide', r.colonneEstDansLeVide,
      'elle est posée sur une île : elle ne prouverait rien');
    v('LA COLONNE D\'AIR NE PORTE QUE QUI A LA CAPE',
      r.colonneSansCape === 0 && r.colonneAvecCape > 0,
      `sans=${r.colonneSansCape} avec=${r.colonneAvecCape}`);
    v('la cape est posée dans le monde', r.capeEnPlace, 'absente');
    v('la ramasser l\'équipe aussitôt', r.capeRecue, 'reçue mais pas en main');

    v('L\'ÉPÉE NE FAIT PAS SONNER UN CARILLON', r.carillonEpee === 0, r.carillonEpee);
    v('le boomerang, si', r.carillonBoomerang === 1 && r.carillonTuile,
      `${r.carillonBoomerang} / tuile=${r.carillonTuile}`);
    v('un carillon sonné ne se recompte pas', r.carillonPasDeDoublon, 'compté deux fois');

    v('les trois sceaux se brisent', r.sceauxBrises === 3, r.sceauxBrises);
    v('ILS OUVRENT LA SALLE FINALE',
      r.epreuveOuverte && r.eclatsRestants === 0,
      `ouverte=${r.epreuveOuverte} éclats restants=${r.eclatsRestants}`);

    v('entrer au Belvédère réveille la Sentinelle', r.sentinelleReveil, 'pas de gardien');
    v('la vaincre ouvre la Faille',
      r.sentinelleTombe && r.failleOuverteParLaSentinelle,
      `tombée=${r.sentinelleTombe} faille=${r.failleOuverteParLaSentinelle}`);
    v('entrer dans l\'arène réveille le Rongeur', r.rongeurReveil, 'pas de gardien');
    v('LE RONGEUR TRAVERSE SES CINQ PALIERS DANS L\'ORDRE',
      r.paliers === '0,1,2,3,4', r.paliers);
    v('le vaincre rend les trois étoiles',
      r.rongeurTombe && r.etoilesRendues === 3,
      `tombé=${r.rongeurTombe} étoiles=${r.etoilesRendues}`);
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
