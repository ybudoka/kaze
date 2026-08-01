'use strict';
/* CORRECTIFS.md § 17 — la sixième région : le Marais des Murmures. Une tourbe
   noyée de nuit, où le FANAL éclaire, BRÛLE LES RONCES qui barrent les chemins,
   et RALLUME LES VEILLEUSES jusqu'au Cœur du Marais, où règne la Reine des
   Lucioles Noires (elle éteint ton fanal par vagues). Tout est mesuré sur le
   vrai jeu : atteignabilité avec les vraies collisions, énigme résoluble,
   rechargement. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Marais des Murmures',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};

      out.MH = MH; out.bornes = [Y_CENDRE, Y_CIMES, Y_LAGON, Y_SABLES, Y_MARAIS];
      out.regions = [regionDe(Y_SABLES * TS), regionDe(Y_MARAIS * TS)];
      out.spritesManquants = ['fanalItem', 'venin', 'follet0', 'crapaud0', 'ombre0', 'reine0'].filter(n => !SPR[n]);

      const cnt = (y0, y1) => { const c = {}; for (let y = y0; y < y1; y++) for (let x = 0; x < MW; x++) { const s = Sol(x, y); c[s] = (c[s] || 0) + 1; } return c; };
      const s = cnt(Y_MARAIS, MH);
      out.sols = [s[S.MARAIS] || 0, s[S.VASE] || 0];

      const t = {}; for (const e of ennemis) t[e.type] = (t[e.type] || 0) + 1;
      out.faune = [t.follet | 0, t.crapaud | 0, t.ombre | 0];

      // ---- parcours : l'arène n'est atteignable qu'en BRÛLANT les ronces ----
      const passable = (x, y, burn) => {
        if (!dansCarte(x, y)) return false;
        const s = Sol(x, y);
        if (s === S.LAVE || s === S.SABLEMOU) return false;
        if ((s === S.EAU || s === S.EAUPROF) && !Q.palmes) return false;
        const o = Obj(x, y);
        if (o === O.PORTAIL) return !!Q.portailOuvert;
        if (o === O.RONCE) return !!burn;
        if (o === O.ROCNOIR || o === O.GLACON || o === O.CAISSE || o === O.ANCRE || o === O.PORTEP || o === O.BLOCLOURD) return false;
        if (o && DUR_O[o] && !FRANCH_O[o]) return false;
        return true;
      };
      const flood = (sx, sy, burn) => {
        const vus = new Uint8Array(MW * MH), f = [[sx, sy]]; vus[sy * MW + sx] = 1;
        while (f.length) { const [x, y] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx] || !passable(nx, ny, burn)) continue;
            const lien = Etg(nx, ny) <= Etg(x, y) || Sol(nx, ny) === S.RAMPE || Sol(x, y) === S.RAMPE;
            if (!lien) continue;
            vus[ny * MW + nx] = 1; f.push([nx, ny]); } }
        return vus;
      };
      const near = (v, x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => dansCarte(x + dx, y + dy) && v[(y + dy) * MW + x + dx]);
      Q.portailOuvert = true; Q.palmes = true;
      const wx = (MARAIS.laisse.x0 + MARAIS.laisse.x1) >> 1, wy = Y_MARAIS + 3;
      const areneCentre = [MARAIS.arene.x0 + (MARAIS.arene.w >> 1), MARAIS.arene.y0 + 3];
      let vv = flood(wx, wy, false);
      out.bosquetReach = near(vv, MARAIS.bosquet.x0 + 2, MARAIS.bosquet.y0 + 2);
      out.fanalReach = near(vv, FANAL_POS[0], FANAL_POS[1]);
      out.veilleusesReach = VEILLEUSES_POS.every(([x, y]) => near(vv, x, y));
      out.areneBlockedNoBurn = !near(vv, areneCentre[0], areneCentre[1]);
      out.areneReachAfterBurn = near(flood(wx, wy, true), areneCentre[0], areneCentre[1]);
      // le marécage d'entrée est joignable depuis les Sables (par l'oued/à la nage)
      out.marecageFromSables = near(flood(SABLES.arene.x0 + 2, SABLES.arene.y0 - 8, false), wx, wy)
        || near(flood((SABLES.wadi.x0 + SABLES.wadi.x1) >> 1, Y_SABLES + 3, false), wx, wy);
      out.septVeilleuses = VEILLEUSES_POS.length;

      // ---- le fanal : ramassé, il s'équipe ----
      out.fanalButin = butins.some(b => b.type === 'fanal');
      J.x = FANAL_POS[0] * TS + 8; J.y = FANAL_POS[1] * TS + 8; J.z = 0; J.invuln = 99999;
      await dort(150);
      out.fanalPris = Q.fanal && J.objets.includes('fanal');
      out.fanalEquipe = J.objets[J.objSel] === 'fanal';

      // ---- le fanal BRÛLE une ronce du rideau ----
      const cxA = MARAIS.arene.x0 + (MARAIS.arene.w >> 1), ry = MARAIS.ronce.y0;
      out.ronceLa = Obj(cxA, ry) === O.RONCE;
      J.x = cxA * TS + 8; J.y = (ry - 1) * TS + 8; J.z = 0; J.dir = 2; J.objSel = J.objets.indexOf('fanal');
      fanalAction();
      out.ronceBrulee = Obj(cxA, ry) !== O.RONCE;

      // ---- le fanal RALLUME une veilleuse (et la compte) ----
      const [px, py] = VEILLEUSES_POS[0]; const nb = Q.veilleuses;
      out.veilleuseLa = Obj(px, py) === O.VEILLEUSE;
      J.x = px * TS + 8; J.y = (py + 1) * TS + 8; J.z = 0; J.dir = 0; fanalAction();
      out.veilleuseRallumee = Q.veilleuses === nb + 1 && Obj(px, py) === O.VEILLEUSEVIVE;
      // rallumer les sept ouvre la carte et laisse un cœur au bosquet
      for (const [x, y] of VEILLEUSES_POS) if (Obj(x, y) === O.VEILLEUSE) putO(x, y, O.VEILLEUSEVIVE);
      Q.veilleuses = 6; J.x = VEILLEUSES_POS[2][0] * TS + 8; J.y = (VEILLEUSES_POS[2][1] + 1) * TS + 8; J.dir = 0;
      putO(VEILLEUSES_POS[2][0], VEILLEUSES_POS[2][1], O.VEILLEUSE); fanalAction();
      out.septRecompense = Q.veilleuses >= 7 && butins.some(b => b.type === 'coeurmax');

      // ---- l'ombre n'est vulnérable QUE dans la lumière ----
      {
        ennemis.length = 0;
        pondre('ombre', 44, Y_MARAIS + 40);
        const om = ennemis[0]; om.x = 44 * TS + 8; om.y = (Y_MARAIS + 40) * TS + 8; om.z = 0;
        om.fondu = 1;                                      // fondue dans la nuit : intouchable
        const pv0 = om.pv; frapper(om, 3, om.x - 20, om.y, 'epee');
        out.ombreImmuniteNuit = om.pv === pv0;
        om.fondu = 0;                                      // matérialisée par la lumière
        frapper(om, 3, om.x - 20, om.y, 'epee');
        out.ombreCedeLumiere = om.pv < pv0;
        ennemis.length = 0;
      }

      // ---- la nuit du marais : un voile assombrit hors des lumières ----
      out.voileExiste = typeof voileMarais === 'function' && !!darkCV;

      // ---- la Reine des Lucioles Noires : entrer dans l'arène la réveille ----
      Q.reineTue = false;
      J.x = (MARAIS.arene.x0 + (MARAIS.arene.w >> 1)) * TS + 8; J.y = (MARAIS.arene.y0 + 4) * TS + 8; J.z = 0; J.invuln = 99999;
      await dort(250);
      out.reineReveil = !!(boss && boss.type === 'reine');
      out.reinePhases = boss ? boss.phase : null;
      if (boss) boss.pv = 0; await dort(300);
      out.reineTombe = !boss && !!Q.reineTue;
      out.reineRecompense = butins.some(b => b.type === 'coeurmax');

      // ---- musique : la région et sa gardienne ont leur morceau ----
      out.themes = Object.keys(MUSIQUES);
      etat = 'jeu';
      boss = null; J.x = MARAIS.laisse.x0 * TS + 8; J.y = (Y_MARAIS + 30) * TS + 8; out.themeMarais = themeVoulu();
      boss = { type: 'reine' }; out.themeReine = themeVoulu(); boss = null;

      // ---- le journal montre la quête du Marais ----
      journal = true; out.journal = JSON.stringify(lignesJournal ? lignesJournal() : []); journal = false;

      // ---- la mini-carte distingue le marais ----
      const g2 = miniCV.getContext('2d');
      const px2 = (x, y) => { const d = g2.getImageData(x, y, 1, 1).data; return `${d[0]},${d[1]},${d[2]}`; };
      out.couleurMarais = px2(wx, Y_MARAIS + 20);
      out.couleurVallee = px2(35, 45);

      // ---- rien ne se perd au rechargement ----
      Q.fanal = true; Q.veilleuses = 4; Q.reineTue = true;
      if (!J.objets.includes('fanal')) J.objets.push('fanal');
      await sauver(true); await dort(250);
      await charger(0); await dort(500);
      out.apresChargement = { fanal: !!Q.fanal, veilleuses: Q.veilleuses, reine: !!Q.reineTue,
        objetsFanal: J.objets.includes('fanal'), fanalButinRepose: !butins.some(b => b.type === 'fanal') };

      // ---- une partie neuve repart de zéro ----
      nouvellePartie('NEUVE', 1); await dort(350);
      out.neuve = { fanal: !!Q.fanal, veilleuses: Q.veilleuses, reine: !!Q.reineTue,
        fanalButin: butins.some(b => b.type === 'fanal') };

      return out;
    });

    v('six régions, le Marais en sixième', r.MH === 480
      && r.bornes.join() === '80,160,240,320,400' && r.regions.join() === 'sables,marais',
      `${r.MH} / ${r.bornes.join()} / ${r.regions.join()}`);
    v('les sprites du Marais sont fabriqués', r.spritesManquants.length === 0, `manquants: ${r.spritesManquants.join()}`);
    v('les sols de la tourbe existent', r.sols.every(n => n > 80),
      `marais/vase = ${r.sols.join('/')}`);
    v('les trois créatures du Marais le peuplent',
      r.faune.every(n => n > 0), `follet/crapaud/ombre = ${r.faune.join('/')}`);
    v('le Bosquet du Fanal et le fanal sont atteignables', r.bosquetReach && r.fanalReach, 'injoignable');
    v('les sept veilleuses sont atteignables', r.veilleusesReach && r.septVeilleuses === 7, 'une veilleuse injoignable');
    v('L\'ARÈNE EST BARRÉE PAR LE RIDEAU DE RONCES', r.areneBlockedNoBurn, 'on y accède sans brûler');
    v('brûler les ronces ouvre le Cœur du Marais', r.areneReachAfterBurn, 'toujours barré');
    v('le marécage relie les Sables au Marais', r.marecageFromSables, 'marécage bouché');
    v('LE FANAL EST ÉQUIPÉ DÈS QU\'ON LE TROUVE', r.fanalPris && r.fanalEquipe, 'pas équipé');
    v('LE FANAL BRÛLE LES RONCES', r.ronceLa && r.ronceBrulee, `ronce=${r.ronceLa} brûlée=${r.ronceBrulee}`);
    v('LE FANAL RALLUME LES VEILLEUSES (comptées)', r.veilleuseLa && r.veilleuseRallumee,
      `veilleuse=${r.veilleuseLa} rallumée=${r.veilleuseRallumee}`);
    v('rallumer les sept veilleuses donne une récompense', r.septRecompense, 'pas de récompense');
    v('L\'OMBRE N\'EST TOUCHABLE QUE DANS LA LUMIÈRE',
      r.ombreImmuniteNuit && r.ombreCedeLumiere, `nuit=${r.ombreImmuniteNuit} lumière=${r.ombreCedeLumiere}`);
    v('la nuit du Marais a son voile d\'ombre', r.voileExiste, 'pas de voile');
    v('entrer dans l\'arène réveille la Reine', r.reineReveil, 'pas de boss');
    v('vaincre la Reine donne son cœur', r.reineTombe && r.reineRecompense, 'pas de récompense');
    v('la région et sa gardienne ont leur morceau',
      r.themes.includes('marais') && r.themes.includes('reineBoss')
      && r.themeMarais === 'marais' && r.themeReine === 'reineBoss',
      `${r.themeMarais}/${r.themeReine}`);
    v('le journal montre la quête du Marais',
      /FANAL/.test(r.journal) && /REINE/.test(r.journal) && /VEILLEUSES/.test(r.journal), r.journal.slice(0, 160));
    v('la mini-carte distingue la tourbe', r.couleurMarais !== r.couleurVallee,
      `marais ${r.couleurMarais} / vallée ${r.couleurVallee}`);
    const ac = r.apresChargement;
    v('RIEN NE SE PERD AU RECHARGEMENT',
      ac.fanal && ac.veilleuses === 4 && ac.reine && ac.objetsFanal && ac.fanalButinRepose,
      JSON.stringify(ac));
    v('une partie neuve repart de zéro',
      !r.neuve.fanal && r.neuve.veilleuses === 0 && !r.neuve.reine && r.neuve.fanalButin, JSON.stringify(r.neuve));
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
