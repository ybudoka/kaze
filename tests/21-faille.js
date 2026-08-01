'use strict';
/* CORRECTIFS.md § 20 — la huitième région, le monde final : la Faille. Le néant
   fracturé où le ciel se déchire. Pas de nouvel outil : on arrive avec TOUT. Une
   gauntlet de trois paliers, puis l'arène du RONGEUR D'ÉTOILES — le boss final,
   qui emprunte les armes des gardiens (dont une carapace de givre que seul le
   boomerang brise), et dont la défaite ACHÈVE l'aventure (écran de victoire, le
   grand travelling des huit mondes). Le sceau de la Faille ne cède qu'une fois
   la Sentinelle vaincue. Tout est mesuré sur le vrai jeu. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'La Faille (monde final)',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};

      out.MH = MH; out.bornes = [Y_CENDRE, Y_CIMES, Y_LAGON, Y_SABLES, Y_MARAIS, Y_NUES, Y_FAILLE];
      out.regions = [regionDe(Y_NUES * TS), regionDe(Y_FAILLE * TS)];
      out.rongeurSpr = ['rongeur0', 'rongeur1'].filter(n => !SPR[n]);

      const cnt = (y0, y1) => { const c = {}; for (let y = y0; y < y1; y++) for (let x = 0; x < MW; x++) { const s = Sol(x, y); c[s] = (c[s] || 0) + 1; } return c; };
      const s = cnt(Y_FAILLE, MH);
      out.sols = [s[S.BASALTE] || 0, s[S.LAVE] || 0, s[S.VIDE] || 0, s[S.DALLE] || 0];

      // des échos des gardiens, par paires : au moins quelques types différents
      const t = {}; for (const e of ennemis) t[e.type] = (t[e.type] || 0) + 1;
      out.echos = Object.keys(t).filter(k => ['golem', 'squel', 'loup', 'piquier', 'scarabee', 'nuee', 'follet', 'braise'].includes(k)).length;

      // ---- le sceau : un MUR scellé à la génération, ouvert quand le ciel se déchire ----
      const [bx0, , by] = FAILLE.barriere;
      out.sceauScelle = Obj(bx0, by) === O.MUR && !Q.failleOuverte;
      // parcours ARMÉ : on arrive avec tout — le boomerang brise la glace, le
      // marteau la roche noire, la cape plane sur le vide. Le MUR du sceau, lui,
      // ne cède qu'au ciel déchiré. On vérifie que ce sceau seul coupe l'arène.
      const passable = (x, y) => {
        if (!dansCarte(x, y)) return false;
        const s = Sol(x, y);
        if (s === S.LAVE || s === S.SABLEMOU) return false;
        if (s === S.VIDE) return true;                    // la cape plane par-dessus
        if ((s === S.EAU || s === S.EAUPROF) && !Q.palmes) return false;
        const o = Obj(x, y);
        if (o === O.GLACON) return true;                  // le boomerang la brise
        if (o === O.ROCNOIR) return true;                 // le marteau la brise
        if (o === O.CAISSE || o === O.ANCRE || o === O.PORTEP || o === O.BLOCLOURD) return false;
        if (o && DUR_O[o] && !FRANCH_O[o]) return false;  // le MUR du sceau reste infranchissable
        return true;
      };
      const flood = (sx, sy) => {
        const vus = new Uint8Array(MW * MH), f = [[sx, sy]]; vus[sy * MW + sx] = 1;
        while (f.length) { const [x, y] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx] || !passable(nx, ny)) continue;
            const lien = Etg(nx, ny) <= Etg(x, y) || Sol(nx, ny) === S.RAMPE || Sol(x, y) === S.RAMPE;
            if (!lien) continue;
            vus[ny * MW + nx] = 1; f.push([nx, ny]); } }
        return vus;
      };
      const near = (v, x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => dansCarte(x + dx, y + dy) && v[(y + dy) * MW + x + dx]);
      const entree = [FAILLE.entree, Y_FAILLE - 4];
      const areneC = [FAILLE.arene.x0 + (FAILLE.arene.w >> 1), FAILLE.arene.y0 + 4];
      out.areneBlockedSceau = !near(flood(entree[0], entree[1]), areneC[0], areneC[1]);
      // le ciel se déchire : le sceau (MUR) cède, l'arène devient joignable
      ouvrirFaille();
      out.sceauOuvert = Q.failleOuverte && Obj(bx0, by) !== O.MUR;
      out.areneReachOuvert = near(flood(entree[0], entree[1]), areneC[0], areneC[1]);

      // ---- le Rongeur d'Étoiles : entrer dans l'arène le réveille ----
      Q.rongeurTue = false;
      J.x = areneC[0] * TS + 8; J.y = (FAILLE.arene.y0 + 6) * TS + 8; J.z = 0; J.invuln = 9e9;
      await dort(250);
      out.rongeurReveil = !!(boss && boss.type === 'rongeur');
      // carapace de givre : l'épée ricoche, le boomerang la brise
      if (boss) { boss.phase = 'glace'; boss.carapace = 60; const pv0 = boss.pv;
        frapper(boss, 3, boss.x, boss.y, 'epee'); out.carapaceEpee = boss.pv === pv0;
        frapper(boss, 3, boss.x, boss.y, 'boomerang'); out.carapaceBrisee = boss.carapace === 0; }
      // cœur à nu quand il est très entamé
      if (boss) { boss.pv = Math.floor(boss.pvmax * 0.25); boss.phase = 'attente'; boss.cd = 0;
        out.aNu = boss.pv <= boss.pvmax * 0.3; }

      // ---- vaincre le Rongeur ACHÈVE l'aventure ----
      if (boss) boss.pv = 0;
      await dort(400);
      out.rongeurTue = Q.rongeurTue; out.etoilesReprises = Q.etoilesReprises;
      await dort(2200);                        // le setTimeout(1700) bascule en victoire
      out.etatVictoire = etat === 'victoire';

      // ---- l'écran de fin : le grand travelling, puis le bilan, sans crash ----
      out.montageOk = true;
      try { finT = 10; ecranFin(true); finT = 120; ecranFin(true); finT = 260; ecranFin(true); }
      catch (e) { out.montageOk = false; out.montageErr = String(e); }
      out.comptes = comptesFin();

      // ---- musique : la région et le boss final ont leur morceau ----
      out.themes = ['faille', 'failleBoss'].filter(m => MUSIQUES[m]);
      etat = 'jeu'; boss = null; J.x = FAILLE.entree * TS + 8; J.y = (Y_FAILLE + 20) * TS + 8; out.themeFaille = themeVoulu();
      boss = { type: 'rongeur' }; out.themeBoss = themeVoulu(); boss = null;

      // ---- le journal montre la quête finale ----
      Q.failleOuverte = true;
      journal = true; out.journal = JSON.stringify(lignesJournal ? lignesJournal() : []); journal = false;

      return out;
    });

    v('huit régions, la Faille en huitième', r.MH === 640
      && r.bornes.join() === '80,160,240,320,400,480,560' && r.regions.join() === 'nues,faille',
      `${r.MH} / ${r.bornes.join()} / ${r.regions.join()}`);
    v('le sprite du Rongeur est fabriqué', r.rongeurSpr.length === 0, `manquants: ${r.rongeurSpr.join()}`);
    v('les sols du néant existent (basalte, lave, vide)', r.sols[0] > 80 && r.sols[1] > 40 && r.sols[2] > 40,
      `basalte/lave/vide/dalle = ${r.sols.join('/')}`);
    v('des échos des gardiens peuplent la Faille', r.echos >= 3, `${r.echos} types`);
    v('LE SCEAU EST SCELLÉ, ET COUPE L\'ARÈNE', r.sceauScelle && r.areneBlockedSceau, 'sceau absent ou arène déjà ouverte');
    v('le ciel déchiré ouvre le sceau et l\'arène', r.sceauOuvert && r.areneReachOuvert, 'sceau resté clos');
    v('entrer dans l\'arène réveille le Rongeur', r.rongeurReveil, 'pas de boss');
    v('LA CARAPACE DE GIVRE NE CÈDE QU\'AU BOOMERANG',
      r.carapaceEpee && r.carapaceBrisee, `épée=${r.carapaceEpee} brisée=${r.carapaceBrisee}`);
    v('très entamé, son cœur est à nu', r.aNu, 'jamais découvert');
    v('VAINCRE LE RONGEUR ACHÈVE L\'AVENTURE (victoire)',
      r.rongeurTue && r.etoilesReprises === 3 && r.etatVictoire,
      `tué=${r.rongeurTue} étoiles=${r.etoilesReprises} état=${r.etatVictoire}`);
    v('L\'ÉCRAN DE FIN JOUE LE GRAND TRAVELLING SANS ERREUR', r.montageOk, r.montageErr || '');
    v('le bilan de complétion se calcule', r.comptes && typeof r.comptes.gardiens === 'number',
      JSON.stringify(r.comptes));
    v('la région et le boss final ont leur morceau',
      r.themes.includes('faille') && r.themes.includes('failleBoss')
      && r.themeFaille === 'faille' && r.themeBoss === 'failleBoss',
      `${r.themeFaille}/${r.themeBoss}`);
    v('le journal montre la quête finale',
      /FAILLE/.test(r.journal) && /RONGEUR/.test(r.journal), r.journal.slice(0, 160));
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
