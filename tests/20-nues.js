'use strict';
/* CORRECTIFS.md § 19 — la septième région : la Cité des Nues. Des ruines
   flottantes séparées par le VIDE bleu du ciel. La CAPE DES COURANTS fait
   PLANER par-dessus le vide, d'une île à l'autre, jusqu'à l'arène de la
   Sentinelle du Ciel — cernée de vide et qu'on ne rejoint qu'en planant depuis
   un pas de vent. Tout est mesuré sur le vrai jeu : atteignabilité avec les
   vraies collisions, énigme résoluble (le vide gate l'arène), rechargement. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Cité des Nues',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};

      out.MH = MH; out.bornes = [Y_CENDRE, Y_CIMES, Y_LAGON, Y_SABLES, Y_MARAIS, Y_NUES];
      out.regions = [regionDe(Y_MARAIS * TS), regionDe(Y_NUES * TS)];
      out.spritesManquants = ['capeItem', 'foudre', 'tourbillon0', 'aigle0', 'nuee0', 'sentinelle0'].filter(n => !SPR[n]);

      const cnt = (y0, y1) => { const c = {}; for (let y = y0; y < y1; y++) for (let x = 0; x < MW; x++) { const s = Sol(x, y); c[s] = (c[s] || 0) + 1; } return c; };
      const s = cnt(Y_NUES, MH);
      out.sols = [s[S.NUAGE] || 0, s[S.VIDE] || 0, s[S.VENT] || 0];

      const t = {}; for (const e of ennemis) t[e.type] = (t[e.type] || 0) + 1;
      out.faune = [t.tourbillon | 0, t.aigle | 0, t.nuee | 0];

      // ---- parcours : l'arène n'est atteignable qu'en PLANANT par-dessus le vide ----
      const passable = (x, y, glide) => {
        if (!dansCarte(x, y)) return false;
        const s = Sol(x, y);
        if (s === S.LAVE || s === S.SABLEMOU) return false;
        if (s === S.VIDE) return !!glide;                 // le vide ne se franchit qu'en planant
        if ((s === S.EAU || s === S.EAUPROF) && !Q.palmes) return false;
        const o = Obj(x, y);
        if (o === O.ROCNOIR || o === O.GLACON || o === O.CAISSE || o === O.ANCRE || o === O.PORTEP || o === O.BLOCLOURD) return false;
        if (o && DUR_O[o] && !FRANCH_O[o]) return false;
        return true;
      };
      const flood = (sx, sy, glide) => {
        const vus = new Uint8Array(MW * MH), f = [[sx, sy]]; vus[sy * MW + sx] = 1;
        while (f.length) { const [x, y] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx] || !passable(nx, ny, glide)) continue;
            const lien = Etg(nx, ny) <= Etg(x, y) || Sol(nx, ny) === S.RAMPE || Sol(x, y) === S.RAMPE;
            if (!lien) continue;
            vus[ny * MW + nx] = 1; f.push([nx, ny]); } }
        return vus;
      };
      const near = (v, x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => dansCarte(x + dx, y + dy) && v[(y + dy) * MW + x + dx]);
      Q.palmes = true;
      const sx = NUES.entree, sy = Y_NUES + 4;
      const areneC = [NUES.arene.x0 + 2, NUES.arene.y0 + 4];
      let vv = flood(sx, sy, false);
      out.capeReach = near(vv, CAPE_POS[0], CAPE_POS[1]);
      out.carillonsReach = CARILLONS_POS.every(([x, y]) => near(vv, x, y));
      out.areneBlockedNoGlide = !near(vv, areneC[0], areneC[1]);
      out.areneReachGlide = near(flood(sx, sy, true), areneC[0], areneC[1]);
      out.nuesFromMarais = near(flood(MARAIS.arene.x0 + 2, MARAIS.arene.y0 - 8, false), sx, sy)
        || near(flood(NUES.entree, Y_MARAIS + 30, false), sx, sy);
      out.huitCarillons = CARILLONS_POS.length;

      // ---- la cape : ramassée, elle s'équipe ----
      out.capeButin = butins.some(b => b.type === 'cape');
      J.x = CAPE_POS[0] * TS + 8; J.y = CAPE_POS[1] * TS + 8; J.z = 0; J.invuln = 9e9;
      await dort(150);
      out.capePris = Q.cape && J.objets.includes('cape');
      out.capeEquipe = J.objets[J.objSel] === 'cape';

      // ---- le boomerang fait TINTER un carillon (et le compte) ----
      const [cx, cy] = CARILLONS_POS[0];
      out.carillonLa = Obj(cx, cy) === O.CARILLON;
      tinterCarillon(cx, cy);
      out.carillonTinte = Q.carillons === 1 && Obj(cx, cy) !== O.CARILLON;

      // ---- la cape PLANE par-dessus le vide : du pas de vent à l'arène ----
      const [lx, ly] = NUES.lancement;
      J.x = lx * TS + 8; J.y = ly * TS + 8; J.z = 0; J.dir = 3; J.objSel = J.objets.indexOf('cape'); J.glide = null;
      capeAction();
      out.glideStarted = !!J.glide;
      for (let f = 0; f < 40 && J.glide; f++) {          // avance le planeur scripté
        const g = J.glide; g.t++; const u = Math.min(1, g.t / g.dur);
        J.x = g.sx + (g.ex - g.sx) * u; J.y = g.sy + (g.ey - g.sy) * u; if (u >= 1) J.glide = null;
      }
      out.glideLanded = Math.floor(J.x / TS) >= NUES.arene.x0;
      // sans vide en face, la cape refuse (on ne plane pas sur la terre ferme)
      J.x = CAPE_POS[0] * TS + 8; J.y = CAPE_POS[1] * TS + 8; J.dir = 2; J.glide = null;
      capeAction();
      out.glideRefusSansVide = !J.glide;

      // ---- le tremplin renvoie en l'air ----
      const trem = (() => { for (let y = Y_NUES; y < MH; y++) for (let x = 0; x < MW; x++) if (Obj(x, y) === O.TREMPLIN) return [x, y]; return null; })();
      out.tremplinExiste = !!trem;
      if (trem) { J.x = trem[0] * TS + 8; J.y = trem[1] * TS + 8; J.z = baseSol(J.x, J.y); J.vz = 0; J.enAir = false; J.glide = null;
        majJoueur(); out.tremplinRebond = J.vz > 2 && J.enAir; }

      // ---- le golem-nuage ne cède qu'au marteau ----
      { ennemis.length = 0; pondre('nuee', 44, Y_NUES + 30);
        const nu = ennemis[0]; nu.x = 44 * TS + 8; nu.y = (Y_NUES + 30) * TS + 8; nu.z = 0; nu.stun = 0;
        const pv0 = nu.pv; frapper(nu, 3, nu.x - 20, nu.y, 'epee'); out.nueeArmureEpee = nu.pv === pv0;
        frapper(nu, 3, nu.x - 20, nu.y, 'marteau'); out.nueeCedeMarteau = nu.pv < pv0;
        ennemis.length = 0; }

      // ---- la Sentinelle du Ciel : entrer dans l'arène la réveille ----
      Q.sentinelleTue = false;
      J.x = (NUES.arene.x0 + (NUES.arene.w >> 1)) * TS + 8; J.y = (NUES.arene.y0 + 4) * TS + 8; J.z = 0; J.invuln = 9e9;
      await dort(250);
      out.sentReveil = !!(boss && boss.type === 'sentinelle');
      // pendant une rafale, elle est intouchable
      if (boss) { boss.phase = 'rafale'; boss.invincible = 30; const pv0 = boss.pv;
        frapper(boss, 3, boss.x, boss.y, 'epee'); out.sentRafaleIntouchable = boss.pv === pv0;
        boss.invincible = 0; frapper(boss, 3, boss.x, boss.y, 'epee'); out.sentTouchableEntre = boss.pv < pv0;
        boss.pv = 0; }
      await dort(300);
      out.sentTombe = !boss && !!Q.sentinelleTue;
      out.sentRecompense = butins.some(b => b.type === 'coeurmax');

      // ---- musique : la région et sa gardienne ont leur morceau ----
      out.themes = Object.keys(MUSIQUES);
      etat = 'jeu';
      boss = null; J.x = NUES.entree * TS + 8; J.y = (Y_NUES + 30) * TS + 8; out.themeNues = themeVoulu();
      boss = { type: 'sentinelle' }; out.themeSent = themeVoulu(); boss = null;

      // ---- le journal montre la quête des Nues ----
      journal = true; out.journal = JSON.stringify(lignesJournal ? lignesJournal() : []); journal = false;

      // ---- la mini-carte distingue la cité ----
      const g2 = miniCV.getContext('2d');
      const px2 = (x, y) => { const d = g2.getImageData(x, y, 1, 1).data; return `${d[0]},${d[1]},${d[2]}`; };
      out.couleurNues = px2(sx, Y_NUES + 20);
      out.couleurVallee = px2(35, 45);

      // ---- rien ne se perd au rechargement ----
      Q.cape = true; Q.carillons = 3; Q.sentinelleTue = true; Q.inter = [0, 0, 0, 0, 0, 0, 1];
      if (!J.objets.includes('cape')) J.objets.push('cape');
      await sauver(true); await dort(250);
      await charger(0); await dort(500);
      out.apresChargement = { cape: !!Q.cape, carillons: Q.carillons, sentinelle: !!Q.sentinelleTue,
        objetsCape: J.objets.includes('cape'), capeButinRepose: !butins.some(b => b.type === 'cape'),
        inter7: etatInter(Y_NUES) === 1 };

      // ---- une partie neuve repart de zéro ----
      nouvellePartie('NEUVE', 1); await dort(350);
      out.neuve = { cape: !!Q.cape, carillons: Q.carillons, sentinelle: !!Q.sentinelleTue,
        capeButin: butins.some(b => b.type === 'cape') };

      return out;
    });

    v('sept régions, la Cité des Nues en septième', r.MH === 560
      && r.bornes.join() === '80,160,240,320,400,480' && r.regions.join() === 'marais,nues',
      `${r.MH} / ${r.bornes.join()} / ${r.regions.join()}`);
    v('les sprites de la Cité sont fabriqués', r.spritesManquants.length === 0, `manquants: ${r.spritesManquants.join()}`);
    v('les sols du ciel existent (nuage, vide, vent)', r.sols[0] > 80 && r.sols[1] > 80 && r.sols[2] > 0,
      `nuage/vide/vent = ${r.sols.join('/')}`);
    v('les trois créatures des Nues la peuplent', r.faune.every(n => n > 0),
      `tourbillon/aigle/golem = ${r.faune.join('/')}`);
    v('le socle de la cape et la cape sont atteignables', r.capeReach, 'injoignable');
    v('les huit carillons sont atteignables', r.carillonsReach && r.huitCarillons === 8, 'un carillon injoignable');
    v('L\'ARÈNE EST CERNÉE DE VIDE (inatteignable à pied)', r.areneBlockedNoGlide, 'on y accède sans planer');
    v('planer par-dessus le vide ouvre l\'arène', r.areneReachGlide, 'toujours coupée');
    v('la tour relie le Marais à la Cité des Nues', r.nuesFromMarais, 'tour bouchée');
    v('LA CAPE EST ÉQUIPÉE DÈS QU\'ON LA TROUVE', r.capePris && r.capeEquipe, 'pas équipée');
    v('LE BOOMERANG FAIT TINTER LES CARILLONS (comptés)', r.carillonLa && r.carillonTinte,
      `carillon=${r.carillonLa} tinté=${r.carillonTinte}`);
    v('LA CAPE PLANE PAR-DESSUS LE VIDE JUSQU\'À L\'ÎLE',
      r.glideStarted && r.glideLanded, `parti=${r.glideStarted} posé=${r.glideLanded}`);
    v('la cape refuse de planer sans vide à franchir', r.glideRefusSansVide, 'a plané sur la terre ferme');
    v('le tremplin renvoie en l\'air', r.tremplinExiste && r.tremplinRebond, 'pas de rebond');
    v('LE GOLEM-NUAGE NE CÈDE QU\'AU MARTEAU',
      r.nueeArmureEpee && r.nueeCedeMarteau, `épée=${r.nueeArmureEpee} marteau=${r.nueeCedeMarteau}`);
    v('entrer dans l\'arène réveille la Sentinelle', r.sentReveil, 'pas de boss');
    v('LA SENTINELLE EST INTOUCHABLE EN RAFALE, VULNÉRABLE ENTRE DEUX',
      r.sentRafaleIntouchable && r.sentTouchableEntre, `rafale=${r.sentRafaleIntouchable} entre=${r.sentTouchableEntre}`);
    v('vaincre la Sentinelle donne son cœur', r.sentTombe && r.sentRecompense, 'pas de récompense');
    v('la région et sa gardienne ont leur morceau',
      r.themes.includes('nues') && r.themes.includes('sentinelleBoss')
      && r.themeNues === 'nues' && r.themeSent === 'sentinelleBoss',
      `${r.themeNues}/${r.themeSent}`);
    v('le journal montre la quête des Nues',
      /CAPE/.test(r.journal) && /SENTINELLE/.test(r.journal) && /CARILLONS/.test(r.journal), r.journal.slice(0, 160));
    v('la mini-carte distingue la cité', r.couleurNues !== r.couleurVallee,
      `nues ${r.couleurNues} / vallée ${r.couleurVallee}`);
    const ac = r.apresChargement;
    v('RIEN NE SE PERD AU RECHARGEMENT',
      ac.cape && ac.carillons === 3 && ac.sentinelle && ac.objetsCape && ac.capeButinRepose && ac.inter7,
      JSON.stringify(ac));
    v('une partie neuve repart de zéro',
      !r.neuve.cape && r.neuve.carillons === 0 && !r.neuve.sentinelle && r.neuve.capeButin, JSON.stringify(r.neuve));
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
