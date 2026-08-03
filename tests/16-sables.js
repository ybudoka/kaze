'use strict';
/* CORRECTIFS.md § 15 — la cinquième région : les Sables du Mirage. Désert,
   ruines de grès, champs de sables mouvants. Le BRACELET DE FORCE soulève et
   jette les blocs lourds (pour combler les sables mouvants et renvoyer ses
   propres blocs au Colosse de Grès). Tout est mesuré sur le vrai jeu :
   atteignabilité avec les vraies collisions, énigme résoluble, rechargement. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Sables du Mirage',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};

      out.MH = MH; out.bornes = [Y_CENDRE, Y_CIMES, Y_LAGON, Y_SABLES];
      out.regions = [regionDe(Y_LAGON * TS), regionDe(Y_SABLES * TS)];

      const cnt = (y0, y1) => { const c = {}; for (let y = y0; y < y1; y++) for (let x = 0; x < MW; x++) { const s = Sol(x, y); c[s] = (c[s] || 0) + 1; } return c; };
      const s = cnt(Y_SABLES, Y_MARAIS);
      out.sols = [s[S.DESERT] || 0, s[S.SABLEMOU] || 0, s[S.DALLE] || 0];

      const t = {}; for (const e of ennemis) t[e.type] = (t[e.type] || 0) + 1;
      out.faune = [t.scarabee | 0, t.lancier | 0, t.djinn | 0];

      // ---- parcours : l'arène n'est atteignable qu'en comblant les sables mouvants ----
      const passable = (x, y, fill) => {
        if (!dansCarte(x, y)) return false;
        const s = Sol(x, y);
        if (s === S.LAVE) return false;
        if (s === S.SABLEMOU && !fill) return false;
        if ((s === S.EAU || s === S.EAUPROF) && !Q.palmes) return false;
        const o = Obj(x, y);
        if (o === O.PORTAIL) return !!Q.portailOuvert;
        // le sceau d'une région : il ne cède qu'à la chute de son gardien
        if (o === O.SCEAUMONDE) return verrouOuvert(regionIdx(y));
        if (o === O.BLOCLOURD || o === O.ROCNOIR || o === O.GLACON || o === O.CAISSE || o === O.ANCRE || o === O.PORTEP) return false;
        if (o && DUR_O[o] && !FRANCH_O[o]) return false;
        return true;
      };
      const flood = (sx, sy, fill) => {
        const vus = new Uint8Array(MW * MH), f = [[sx, sy]]; vus[sy * MW + sx] = 1;
        while (f.length) { const [x, y] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx] || !passable(nx, ny, fill)) continue;
            const lien = Etg(nx, ny) <= Etg(x, y) || Sol(nx, ny) === S.RAMPE || Sol(x, y) === S.RAMPE;
            if (!lien) continue;
            vus[ny * MW + nx] = 1; f.push([nx, ny]); } }
        return vus;
      };
      const near = (v, x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => dansCarte(x + dx, y + dy) && v[(y + dy) * MW + x + dx]);
      /* Les gardiens du nord sont abattus : depuis les verrous de région
         (31-verrous.js), ce sont eux qui descellent la route jusqu'à l'oued.
         Sans cela on mesurerait les sceaux au lieu de mesurer le désert. */
      Q.portailOuvert = true; Q.palmes = true;
      Q.coeurTue = true; Q.yetiTue = true; Q.leviathanTue = true;
      const wx = (SABLES.wadi.x0 + SABLES.wadi.x1) >> 1, wy = Y_SABLES + 3;
      const areneCentre = [SABLES.arene.x0 + (SABLES.arene.w >> 1), SABLES.arene.y0 + 3];
      let vv = flood(wx, wy, false);
      out.templeReach = near(vv, SABLES.temple.x0 + 2, SABLES.temple.y0 + 2);
      out.braceletReach = near(vv, BRACELET_POS[0], BRACELET_POS[1]);
      out.areneBlockedNoFill = !near(vv, areneCentre[0], areneCentre[1]);
      out.fresquesReach = FRESQUES_POS.every(([x, y]) => near(vv, x, y));
      out.areneReachAfterFill = near(flood(wx, wy, true), areneCentre[0], areneCentre[1]);
      out.wadiFromLagon = near(flood(LAGON.large.x0 + (LAGON.large.w >> 1), LAGON.large.y0 + 3, false), wx, wy);
      /* Bornée aux SABLES, et non au bas de la carte : la Faille rejoue
         l'épreuve du bloc lourd, et ses blocs se comptaient ici. */
      /* La réserve DE LA VANNE, et elle seule : la Citerne en a désormais
         quatre autres, et compter tout le désert mélangeait les deux. */
      out.blocsLourds = (() => { let n = 0;
        const cx = SABLES.arene.x0 + (SABLES.arene.w >> 1), yTop = SABLES.vanne.y0 - 3;
        for (let y = yTop - 3; y <= yTop + 1; y++) for (let dx = -2; dx <= 2; dx++)
          if (Obj(cx + dx, y) === O.BLOCLOURD) n++;
        return n; })();

      // ---- le bracelet : ramassé, il soulève et jette un bloc ----
      out.braceletButin = butins.some(b => b.type === 'bracelet');
      J.x = BRACELET_POS[0] * TS + 8; J.y = BRACELET_POS[1] * TS + 8; J.z = Etg(BRACELET_POS[0], BRACELET_POS[1]) * EH; J.invuln = 99999;
      await dort(150);
      out.braceletPris = Q.bracelet && J.objets.includes('bracelet');
      out.braceletEquipe = J.objets[J.objSel] === 'bracelet';

      // un banc d'essai propre : un sable mouvant avec du désert au-dessus, un bloc à côté
      const qx = 45, qy = Y_SABLES + 20;
      putS(qx, qy, S.SABLEMOU); putO(qx, qy, O.RIEN);
      putS(qx, qy - 1, S.DESERT); putO(qx, qy - 1, O.RIEN);
      putS(qx, qy - 2, S.DESERT); putO(qx, qy - 2, O.BLOCLOURD);
      // soulever le bloc au-dessus
      J.x = qx * TS + 8; J.y = (qy - 1) * TS + 8; J.z = 0; J.dir = 0; J.objSel = J.objets.indexOf('bracelet'); J.porte = null;
      brasBracelet();
      out.souleve = J.porte === 'lourd' && Obj(qx, qy - 2) === O.RIEN;
      // se placer au-dessus du sable mouvant et le jeter dedans
      J.x = qx * TS + 8; J.y = (qy - 2) * TS + 8; J.dir = 2; J.porte = 'lourd';
      brasBracelet();
      out.blocJete = tirs.some(p => p.lourd);
      for (let i = 0; i < 40; i++) { majDivers(); if (Sol(qx, qy) !== S.SABLEMOU) break; }
      out.sableComble = Sol(qx, qy) === S.DESERT;
      out.combleFranchissable = !solide(qx * TS + 8, qy * TS + 8, 0);

      // un bloc jeté sur un sol sec s'y POSE (récupérable), il ne se perd pas :
      // un mur l'arrête, il retombe sur la dernière case sèche
      const dx2 = 50, dy2 = Y_SABLES + 24;
      /* On vide la zone : un monstre de passage encaisserait le bloc, qui
         éclaterait au lieu de se poser — le contrôle porte sur le sol, pas
         sur le combat. */
      ennemis.length = 0;
      for (let k = 0; k <= 3; k++) { putS(dx2 + k, dy2, S.DESERT); putO(dx2 + k, dy2, O.RIEN); }
      putO(dx2 + 4, dy2, O.MUR);
      J.x = dx2 * TS + 8; J.y = dy2 * TS + 8; J.dir = 3; J.porte = 'lourd';
      brasBracelet();
      for (let i = 0; i < 60 && tirs.some(p => p.lourd); i++) majDivers();
      out.blocRepose = (() => { for (let k = 1; k <= 3; k++) if (Obj(dx2 + k, dy2) === O.BLOCLOURD) return true; return false; })();

      // ---- le Colosse de Grès : cuirassé sauf à ses propres blocs, il tombe ----
      Q.bracelet = true;
      J.x = (SABLES.arene.x0 + (SABLES.arene.w >> 1)) * TS + 8; J.y = (SABLES.arene.y0 + 4) * TS + 8; J.z = 0; J.invuln = 99999;
      await dort(250);
      out.colosseReveil = !!(boss && boss.type === 'colosse');
      if (boss) { const pv0 = boss.pv; frapper(boss, 3, J.x, J.y, 'epee'); out.armorEpee = boss.pv === pv0;
        frapper(boss, 3, J.x, J.y, 'lourd'); out.cedeAuBloc = boss.pv < pv0; boss.pv = 0; }
      await dort(250);
      out.colosseTombe = !boss && !!Q.colosseTue;
      out.colosseRecompense = J.pvmax > 6 || butins.some(b => b.type === 'coeurmax');

      // ---- l'archéologue et la quête des fresques ----
      out.archeoExiste = pnjs.some(p => p.id === 'archeo');
      out.fresqueButins = butins.filter(b => b.type === 'fresque').length;

      // ---- musique : la région et son gardien ont leur morceau ----
      out.themes = Object.keys(MUSIQUES);
      etat = 'jeu';
      boss = null; J.x = (SABLES.wadi.x0) * TS + 8; J.y = (Y_SABLES + 30) * TS + 8; out.themeSables = themeVoulu();
      boss = { type: 'colosse' }; out.themeColosse = themeVoulu(); boss = null;

      // ---- le journal montre la quête ----
      journal = true; out.journal = JSON.stringify(lignesJournal ? lignesJournal() : []); journal = false;

      // ---- la mini-carte distingue le désert ----
      const g2 = miniCV.getContext('2d');
      const px = (x, y) => { const d = g2.getImageData(x, y, 1, 1).data; return `${d[0]},${d[1]},${d[2]}`; };
      out.couleurSables = px(SABLES.wadi.x0, Y_SABLES + 20);
      out.couleurVallee = px(35, 45);

      // ---- rien ne se perd au rechargement ----
      Q.bracelet = true; Q.fresques = 2; Q.inter = [0, 0, 0, 0, 1];
      if (!J.objets.includes('bracelet')) J.objets.push('bracelet');
      await sauver(true); await dort(250);
      await charger(0); await dort(500);
      out.apresChargement = { bracelet: !!Q.bracelet, fresques: Q.fresques, inter4: etatInter(Y_SABLES),
        objetsBracelet: J.objets.includes('bracelet'), colosse: !!Q.colosseTue,
        braceletButinRepose: !butins.some(b => b.type === 'bracelet'),
        fresquesReposees: butins.filter(b => b.type === 'fresque').length };

      // ---- une partie neuve repart de zéro ----
      nouvellePartie('NEUVE', 1); await dort(350);
      out.neuve = { bracelet: !!Q.bracelet, fresques: Q.fresques,
        braceletButin: butins.some(b => b.type === 'bracelet') };

      return out;
    });

    v('huit régions, les Sables en cinquième', r.MH === 640
      && r.bornes.join() === '80,160,240,320' && r.regions.join() === 'lagon,sables',
      `${r.MH} / ${r.bornes.join()} / ${r.regions.join()}`);
    v('les sols du désert existent', r.sols.every(n => n > 80),
      `désert/sables-mouvants/dalle = ${r.sols.join('/')}`);
    v('les trois monstres des Sables peuplent le désert',
      r.faune.every(n => n > 0), `scarabée/lancier/djinn = ${r.faune.join('/')}`);
    v('le Temple du Bracelet et le bracelet sont atteignables', r.templeReach && r.braceletReach, 'injoignable');
    v('L\'ARÈNE EST BLOQUÉE PAR LES SABLES MOUVANTS', r.areneBlockedNoFill, 'on y accède sans combler');
    v('combler les sables ouvre l\'arène', r.areneReachAfterFill, 'toujours bloqué');
    v('les cinq fresques sont atteignables', r.fresquesReach, 'une fresque injoignable');
    v('l\'oued relie le Lagon aux Sables', r.wadiFromLagon, 'oued bouché');
    v('quatre blocs lourds sont en réserve', r.blocsLourds === 4, `${r.blocsLourds}`);
    v('LE BRACELET EST ÉQUIPÉ DÈS QU\'ON LE TROUVE', r.braceletPris && r.braceletEquipe, 'pas équipé');
    v('LE BRACELET SOULÈVE UN BLOC LOURD', r.souleve, 'rien de soulevé');
    v('UN BLOC JETÉ COMBLE LES SABLES MOUVANTS',
      r.blocJete && r.sableComble && r.combleFranchissable,
      `jeté=${r.blocJete} comblé=${r.sableComble} franchissable=${r.combleFranchissable}`);
    v('un bloc jeté sur le sable sec se pose et se récupère', r.blocRepose, 'bloc perdu');
    v('entrer dans l\'arène réveille le Colosse', r.colosseReveil, 'pas de boss');
    v('LE COLOSSE EST CUIRASSÉ SAUF À SES PROPRES BLOCS',
      r.armorEpee && r.cedeAuBloc, `épée=${r.armorEpee} bloc=${r.cedeAuBloc}`);
    v('vaincre le Colosse donne sa récompense', r.colosseTombe && r.colosseRecompense, 'pas de récompense');
    v('l\'archéologue est présente', r.archeoExiste, 'absente');
    v('la région et son gardien ont leur morceau',
      r.themes.includes('sables') && r.themes.includes('colosseBoss')
      && r.themeSables === 'sables' && r.themeColosse === 'colosseBoss',
      `${r.themeSables}/${r.themeColosse}`);
    v('le journal montre la quête des Sables',
      /BRACELET/.test(r.journal) && /COLOSSE/.test(r.journal) && /FRESQUES/.test(r.journal), r.journal.slice(0, 160));
    v('la mini-carte distingue le désert', r.couleurSables !== r.couleurVallee,
      `sables ${r.couleurSables} / vallée ${r.couleurVallee}`);
    const ac = r.apresChargement;
    v('RIEN NE SE PERD AU RECHARGEMENT',
      ac.bracelet && ac.fresques === 2 && ac.inter4 === 1 && ac.objetsBracelet && ac.braceletButinRepose && ac.fresquesReposees === 3,
      JSON.stringify(ac));
    v('une partie neuve repart de zéro',
      !r.neuve.bracelet && r.neuve.fresques === 0 && r.neuve.braceletButin, JSON.stringify(r.neuve));
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
