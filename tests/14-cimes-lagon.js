'use strict';
/* CORRECTIFS.md § 13 — les deux nouvelles régions : les Cimes Gelées (montagne,
   neige et glace, le boomerang, le Roi Yéti) et le Lagon d'Azur (mer, palmes,
   le Léviathan). Génération, monstres armés, objets, quêtes principales et
   annexes, et rien de perdu au rechargement. Comme les autres, ce test pilote
   le vrai jeu et mesure de l'état de jeu, jamais des détails d'implémentation. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Cimes Gelées & Lagon d\'Azur',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};

      // ---- quatre régions, chacune de 80 rangées ----
      out.MH = MH; out.bornes = [Y_CENDRE, Y_CIMES, Y_LAGON];
      out.regions = [regionDe(0), regionDe(Y_CENDRE * TS), regionDe(Y_CIMES * TS), regionDe(Y_LAGON * TS)];

      // ---- les sols propres à chaque biome ----
      const cnt = (y0, y1) => { const c = {}; for (let y = y0; y < y1; y++) for (let x = 0; x < MW; x++) { const s = Sol(x, y); c[s] = (c[s] || 0) + 1; } return c; };
      const sc = cnt(Y_CIMES, Y_LAGON), sl = cnt(Y_LAGON, Y_SABLES);
      out.solsCimes = [sc[S.NEIGE] || 0, sc[S.GLACE] || 0, sc[S.ROCHE] || 0];
      out.solsLagon = [sl[S.EAUPROF] || 0, sl[S.CORAIL] || 0, sl[S.SABLE] || 0];

      // ---- les six monstres armés peuplent leurs régions ----
      const t = {}; for (const e of ennemis) t[e.type] = (t[e.type] || 0) + 1;
      out.fauneCimes = [t.harpie | 0, t.piquier | 0, t.loup | 0];
      out.fauneLagon = [t.crabe | 0, t.triton | 0, t.meduse | 0];

      // ---- parcours avec les vraies règles de collision ----
      const joignable = (sx, sy) => {
        const passable = (x, y) => {
          if (!dansCarte(x, y)) return false;
          const s = Sol(x, y);
          if (s === S.LAVE) return false;
          if ((s === S.EAU || s === S.EAUPROF) && !Q.palmes) return false;
          const o = Obj(x, y);
          if (o === O.PORTAIL) return !!Q.portailOuvert;
          if (o === O.ROCNOIR || o === O.GLACON) return false;   // marteau / boomerang
          if (o && DUR_O[o] && !FRANCH_O[o]) return false;
          return true;
        };
        const lien = (ax, ay, bx, by) => Etg(bx, by) <= Etg(ax, ay) || Sol(bx, by) === S.RAMPE || Sol(ax, ay) === S.RAMPE;
        const vus = new Uint8Array(MW * MH), f = [[sx, sy]];
        vus[sy * MW + sx] = 1;
        while (f.length) { const [x, y] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx] || !passable(nx, ny) || !lien(x, y, nx, ny)) continue;
            vus[ny * MW + nx] = 1; f.push([nx, ny]); } }
        return vus;
      };
      const at = (vus, x, y) => !!vus[y * MW + x];
      const pres = (vus, x, y) => at(vus, x, y) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(vus, x + dx, y + dy));

      // depuis le col des Cendres, portail ouvert, SANS palmes ni boomerang
      Q.portailOuvert = true;
      const sx = (CENDRE.col.x0 + CENDRE.col.x1) >> 1, sy = Y_CENDRE + 6;
      let a = joignable(sx, sy);
      out.colVersCimes = at(a, (CIMES.col.x0 + CIMES.col.x1) >> 1, Y_CIMES + 3);
      out.templeGivreOk = pres(a, BOOMERANG_POS[0], BOOMERANG_POS[1]);
      out.clochesOk = CLOCHES_POS.every(([x, y]) => pres(a, x, y));
      // l'arène du Sommet reste scellée par les glaçons tant qu'on n'a pas le boomerang
      out.sommetScelle = !at(a, CIMES.sommet.x0 + (CIMES.sommet.w >> 1), CIMES.sommet.y0 + 3);
      // on descend au Lagon et l'on atteint la grève et les palmes à pied
      out.greveOk = at(a, LAGON.greve.x0 + 2, LAGON.greve.y0 + 2);
      out.palmesOk = pres(a, PALMES_POS[0], PALMES_POS[1]);
      out.naufrageOk = pres(a, NAUFRAGE_POS[0], NAUFRAGE_POS[1]);
      // le Large et le Temple Englouti sont cernés d'eau profonde : injoignables sans palmes
      out.largeSansPalmes = !at(a, LAGON.large.x0 + (LAGON.large.w >> 1), LAGON.large.y0 + 3);
      out.templeSansPalmes = !at(a, LAGON.temple.x0 + 2, LAGON.temple.y0 + 2);
      // palmes chaussées : on nage jusqu'au Large, au Temple et aux perles
      Q.palmes = true; a = joignable(sx, sy);
      out.largeAvecPalmes = at(a, LAGON.large.x0 + (LAGON.large.w >> 1), LAGON.large.y0 + 3);
      out.templeAvecPalmes = at(a, LAGON.temple.x0 + 2, LAGON.temple.y0 + 2);
      out.perlesAvecPalmes = PERLES_POS.every(([x, y]) => pres(a, x, y));
      Q.palmes = false;

      // ---- l'eau profonde ne se nage qu'avec les palmes ----
      const wx = LAGON.large.x0 + 3, wy = LAGON.large.y0 + 3;
      out.eauProfonde = Sol(wx, wy) === S.EAUPROF;
      out.bloqueSansPalmes = solide(wx * TS + 8, wy * TS + 8, 0);
      Q.palmes = true; out.nageAvecPalmes = !solide(wx * TS + 8, wy * TS + 8, 0); Q.palmes = false;

      // ---- le boomerang : ramassé, équipé, il vole et revient ----
      J.x = BOOMERANG_POS[0] * TS + 8; J.y = BOOMERANG_POS[1] * TS + 8;
      J.z = Etg(BOOMERANG_POS[0], BOOMERANG_POS[1]) * EH; J.invuln = 99999;
      await dort(150);
      out.boomerangPris = Q.boomerang && J.objets.includes('boomerang');
      out.boomerangEquipe = J.objets[J.objSel] === 'boomerang';
      J.dir = 3;
      const vd = [[0, -1], [-1, 0], [0, 1], [1, 0]][J.dir];
      tirs.push({ x: J.x + vd[0] * 8, y: J.y + vd[1] * 8 - 2, z: J.z + 10, vx: vd[0] * 4.2, vy: vd[1] * 4.2, vie: 160, ami: 1, spr: 'boomerang', boom: 1, phase: 'aller', ang: 0, frappes: new Set() });
      let loin = false;
      for (let i = 0; i < 220; i++) { majDivers(); const b = tirs.find(t => t.boom); if (b && Math.hypot(b.x - J.x, b.y - J.y) > 30) loin = true; if (!b) break; }
      out.boomerangRevient = loin && !tirs.some(t => t.boom);

      // ---- le boomerang brise un bloc de glace ----
      const gx = Math.floor(J.x / TS) + 4, gy = Math.floor(J.y / TS); putO(gx, gy, O.GLACON);
      tirs.push({ x: J.x + 8, y: J.y - 2, z: J.z + 10, vx: 4.2, vy: 0, vie: 160, ami: 1, spr: 'boomerang', boom: 1, phase: 'aller', ang: 0, frappes: new Set() });
      for (let i = 0; i < 50; i++) { majDivers(); if (Obj(gx, gy) !== O.GLACON) break; }
      out.boomerangBriseGlace = Obj(gx, gy) !== O.GLACON;
      tirs.length = 0;

      // ---- le crabe cuirassé : l'épée ricoche, le boomerang le sonne ----
      const cb = { type: 'crabe', x: J.x + 30, y: J.y, z: J.z, r: 8, dir: 1, pv: 6, pvmax: 6, flash: 0, stun: 0, kx: 0, ky: 0, anim: 0 };
      ennemis.length = 0; ennemis.push(cb);
      const pvAvantEpee = cb.pv; frapper(cb, 2, J.x, J.y, 'epee');
      out.crabeParmuraille = cb.pv === pvAvantEpee;                 // l'épée n'a rien fait
      frapper(cb, 1, J.x, J.y, 'boomerang');
      out.crabeSonne = cb.pv < pvAvantEpee && cb.stun > 0;          // le boomerang perce et sonne
      ennemis.length = 0;

      // ---- quête annexe des Cimes : les cloches de givre ----
      const nb0 = Q.cloches;
      out.clocheEstLa = Obj(CLOCHES_POS[0][0], CLOCHES_POS[0][1]) === O.CLOCHE;
      sonnerCloche(CLOCHES_POS[0][0], CLOCHES_POS[0][1]);
      out.clocheSonne = Q.cloches === nb0 + 1 && Obj(CLOCHES_POS[0][0], CLOCHES_POS[0][1]) !== O.CLOCHE;

      // ---- gardien : le Roi Yéti s'éveille dans l'Arène du Sommet et tombe ----
      Q.boomerang = true;
      J.x = (CIMES.sommet.x0 + (CIMES.sommet.w >> 1)) * TS + 8; J.y = (CIMES.sommet.y0 + 4) * TS + 8; J.z = 0; J.invuln = 99999;
      await dort(250);
      out.yetiEveille = !!(boss && boss.type === 'yeti');
      if (boss) boss.pv = 0; await dort(250);
      out.yetiTombe = !boss && !!Q.yetiTue;
      out.yetiRecompense = J.pvmax > 6 || butins.some(b => b.type === 'coeurmax');

      // ---- quête annexe du Lagon : le naufragé et les cinq perles ----
      const nauf = pnjs.find(p => p.id === 'naufrage');
      out.naufrageExiste = !!nauf;

      // ---- gardien : le Léviathan s'éveille au Large et tombe ----
      Q.palmes = true;
      J.x = (LAGON.large.x0 + (LAGON.large.w >> 1)) * TS + 8; J.y = (LAGON.large.y0 + (LAGON.large.h >> 1)) * TS + 8; J.invuln = 99999;
      await dort(250);
      out.krakenEveille = !!(boss && boss.type === 'kraken');
      if (boss) boss.pv = 0; await dort(250);
      out.krakenTombe = !boss && !!Q.leviathanTue;

      // ---- musique : les deux régions et leurs gardiens ont leur morceau ----
      out.themes = Object.keys(MUSIQUES);
      const au = (x, y) => { boss = null; J.x = x * TS + 8; J.y = y * TS + 8; return themeVoulu(); };
      etat = 'jeu';
      out.themeCimes = au(CIMES.col.x0, Y_CIMES + 30);
      out.themeLagon = au(LAGON.greve.x0 - 4, Y_LAGON + 34);
      boss = { type: 'yeti' }; out.themeYeti = themeVoulu();
      boss = { type: 'kraken' }; out.themeKraken = themeVoulu();
      boss = null;

      // ---- le journal montre les quêtes des deux régions ----
      journal = true;
      out.journal = JSON.stringify(lignesJournal ? lignesJournal() : []);
      journal = false;

      // ---- la mini-carte distingue les nouveaux biomes ----
      const g2 = miniCV.getContext('2d');
      const px = (x, y) => { const d = g2.getImageData(x, y, 1, 1).data; return `${d[0]},${d[1]},${d[2]}`; };
      out.couleurCimes = px(CIMES.col.x0, Y_CIMES + 20);
      out.couleurLagon = px(LAGON.large.x0 + 4, LAGON.large.y0 + 4);
      out.couleurVallee = px(35, 45);

      // ---- rien ne se perd au rechargement ----
      Q.cloches = 2; Q.perles = 3;
      await sauver(true); await dort(250);
      await charger(0); await dort(500);
      out.apresChargement = {
        boomerang: !!Q.boomerang, palmes: !!Q.palmes, cloches: Q.cloches, perles: Q.perles,
        yeti: !!Q.yetiTue, leviathan: !!Q.leviathanTue,
        objetsBoomerang: J.objets.includes('boomerang'),
        clocheBrisee: Obj(CLOCHES_POS[0][0], CLOCHES_POS[0][1]) !== O.CLOCHE,
        perlesReposees: butins.filter(b => b.type === 'perle2').length,   // 5 - 3 = 2
      };

      // ---- une partie neuve repart de zéro ----
      nouvellePartie('NEUVE', 1); await dort(350);
      out.neuve = { boomerang: !!Q.boomerang, palmes: !!Q.palmes, cloches: Q.cloches, perles: Q.perles,
        boomerangTuile: butins.some(b => b.type === 'boomerang'),
        palmesTuile: butins.some(b => b.type === 'palmes') };

      return out;
    });

    v('sept régions de 80 rangées', r.MH === 560
      && r.bornes.join() === '80,160,240', `${r.MH} / ${r.bornes.join()}`);
    v('chaque bande a sa région', r.regions.join() === 'vallee,cendre,cimes,lagon', r.regions.join());
    v('les trois sols des Cimes existent',
      r.solsCimes.every(n => n > 100), `neige/glace/roche = ${r.solsCimes.join('/')}`);
    v('les trois sols du Lagon existent',
      r.solsLagon.every(n => n > 100), `eauprof/corail/sable = ${r.solsLagon.join('/')}`);
    v('les trois monstres des Cimes peuplent la montagne',
      r.fauneCimes.every(n => n > 0), `harpie/piquier/loup = ${r.fauneCimes.join('/')}`);
    v('les trois monstres du Lagon peuplent la mer',
      r.fauneLagon.every(n => n > 0), `crabe/triton/méduse = ${r.fauneLagon.join('/')}`);
    v('le col des Cendres descend dans les Cimes', r.colVersCimes, 'col bouché');
    v('le Temple de Givre et le boomerang sont atteignables', r.templeGivreOk, 'injoignable');
    v('les trois cloches de givre sont atteignables', r.clochesOk, 'une cloche injoignable');
    v('L\'ARÈNE DU SOMMET RESTE SCELLÉE SANS LE BOOMERANG', r.sommetScelle, 'entrée déjà libre');
    v('la Grève aux Palmes s\'atteint à pied', r.greveOk && r.palmesOk && r.naufrageOk, 'grève injoignable');
    v('LE LARGE EST INJOIGNABLE SANS LES PALMES',
      r.largeSansPalmes && r.templeSansPalmes, 'on y accède sans nager');
    v('les palmes ouvrent le Large, le Temple et les perles',
      r.largeAvecPalmes && r.templeAvecPalmes && r.perlesAvecPalmes, 'toujours bloqué');
    v('l\'eau profonde ne se nage qu\'avec les palmes',
      r.eauProfonde && r.bloqueSansPalmes && r.nageAvecPalmes,
      `prof=${r.eauProfonde} bloque=${r.bloqueSansPalmes} nage=${r.nageAvecPalmes}`);
    v('LE BOOMERANG EST ÉQUIPÉ DÈS QU\'ON LE TROUVE', r.boomerangPris && r.boomerangEquipe, 'pas équipé');
    v('LE BOOMERANG PART ET REVIENT', r.boomerangRevient, 'il ne revient pas');
    v('le boomerang brise un bloc de glace', r.boomerangBriseGlace, 'la glace tient');
    v('LE CRABE CUIRASSÉ RÉSISTE À L\'ÉPÉE, CÈDE AU BOOMERANG',
      r.crabeParmuraille && r.crabeSonne, `épée=${r.crabeParmuraille} boomerang=${r.crabeSonne}`);
    v('une cloche de givre sonne au boomerang', r.clocheEstLa && r.clocheSonne, 'muette');
    v('entrer dans l\'Arène du Sommet éveille le Roi Yéti', r.yetiEveille, 'pas de boss');
    v('vaincre le Roi Yéti donne sa récompense', r.yetiTombe && r.yetiRecompense, 'pas de récompense');
    v('le naufragé du Lagon est présent', r.naufrageExiste, 'absent');
    v('nager jusqu\'au Large éveille le Léviathan', r.krakenEveille, 'pas de boss');
    v('vaincre le Léviathan libère le Lagon', r.krakenTombe, 'toujours vivant');
    v('les deux régions et leurs gardiens ont leur morceau',
      ['cimes', 'lagon', 'givreBoss', 'abysseBoss'].every(m => r.themes.includes(m)), r.themes.join(','));
    v('la musique suit les Cimes et le Lagon',
      r.themeCimes === 'cimes' && r.themeLagon === 'lagon', `${r.themeCimes}/${r.themeLagon}`);
    v('chaque gardien a son thème',
      r.themeYeti === 'givreBoss' && r.themeKraken === 'abysseBoss', `${r.themeYeti}/${r.themeKraken}`);
    v('le journal montre les quêtes des deux régions',
      /BOOMERANG/.test(r.journal) && /ROI YÉTI/.test(r.journal)
      && /PALMES/.test(r.journal) && /LÉVIATHAN/.test(r.journal), r.journal.slice(0, 140));
    v('la mini-carte distingue les Cimes et le Lagon',
      r.couleurCimes !== r.couleurVallee && r.couleurLagon !== r.couleurVallee
      && r.couleurCimes !== r.couleurLagon,
      `cimes ${r.couleurCimes} / lagon ${r.couleurLagon} / vallée ${r.couleurVallee}`);
    const ac = r.apresChargement;
    v('RIEN NE SE PERD AU RECHARGEMENT',
      ac.boomerang && ac.palmes && ac.cloches === 2 && ac.perles === 3
      && ac.yeti && ac.leviathan && ac.objetsBoomerang && ac.clocheBrisee && ac.perlesReposees === 2,
      JSON.stringify(ac));
    v('une partie neuve repart de zéro',
      !r.neuve.boomerang && !r.neuve.palmes && r.neuve.cloches === 0 && r.neuve.perles === 0
      && r.neuve.boomerangTuile && r.neuve.palmesTuile, JSON.stringify(r.neuve));
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
