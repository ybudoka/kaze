'use strict';
/* CORRECTIFS.md § 7 — la seconde région : génération, et l'aventure entière
   depuis le portail verrouillé jusqu'à la victoire. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Terres de Cendre',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      out.MH = MH; out.Y = Y_CENDRE; out.coffres = coffres.length;

      // sols du biome
      const c = {};
      for (let y = Y_CENDRE; y < MH; y++) for (let x = 0; x < MW; x++) { const s = Sol(x, y); c[s] = (c[s] || 0) + 1; }
      out.sols = [c[S.CENDRE] || 0, c[S.LAVE] || 0, c[S.BRAISE] || 0, c[S.BASALTE] || 0];

      // faune propre à la région
      const t = {};
      for (const e of ennemis) t[e.type] = (t[e.type] || 0) + 1;
      out.faune = [t.braise | 0, t.golem | 0, t.spectre | 0];
      out.enVallee = ennemis.filter(e => e.y < Y_CENDRE * TS).length;

      // parcours avec les vraies règles de collision
      const joignable = () => {
        const passable = (x, y) => {
          if (!dansCarte(x, y)) return false;
          const s = Sol(x, y);
          if (s === S.EAU || s === S.LAVE) return false;
          const o = Obj(x, y);
          if (o === O.PORTAIL) return !!Q.portailOuvert;
          if (o === O.ROCNOIR) return false;              // il faut le marteau
          if (o && DUR_O[o] && !FRANCH_O[o]) return false;
          return true;
        };
        const lien = (ax, ay, bx, by) => Etg(bx, by) <= Etg(ax, ay)
          || Sol(bx, by) === S.RAMPE || Sol(ax, ay) === S.RAMPE;
        const sx = Math.floor(J.x / TS), sy = Math.floor(J.y / TS);
        const vus = new Uint8Array(MW * MH), f = [[sx, sy]];
        vus[sy * MW + sx] = 1;
        while (f.length) { const [x, y] = f.pop();
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x+dx, ny = y+dy;
            if (!dansCarte(nx,ny) || vus[ny*MW+nx] || !passable(nx,ny) || !lien(x,y,nx,ny)) continue;
            vus[ny*MW+nx]=1; f.push([nx,ny]); } }
        return vus;
      };
      const atteint = (vus, co) => !!vus[Math.floor(co.y/TS)*MW + Math.floor(co.x/TS)];

      let a = joignable();
      out.cendresFermees = !atteint(a, coffres[3]);
      out.valleeOk = !!a[14*MW+15] && !!a[45*MW+30];   // bois du nord et village

      // les trois étoiles ouvrent le portail
      J.fragments = 2; ouvrirCoffre(coffres[2]); await dort(1700);
      out.portail = !!Q.portailOuvert; out.etoiles = J.fragments;

      a = joignable();
      out.forgeOk = atteint(a, coffres[3]);
      out.falaisesBloquees = !atteint(a, coffres[4]);

      // marteau -> on brise la roche noire qui bouche la brèche
      ouvrirCoffre(coffres[3]); await dort(200);
      out.marteau = J.objets.includes('marteau'); out.braises1 = Q.braises;
      const cf = CENDRE.falaises, cx = cf.x0 + (cf.w >> 1);
      for (let k = -1; k <= 1; k++) putO(cx + k, cf.y0, O.RIEN);
      out.falaisesOuvertes = atteint(joignable(), coffres[4]);

      // bottes
      ouvrirCoffre(coffres[4]); await dort(200);
      out.bottes = !!Q.bottes; out.braises2 = Q.braises;

      // un coffre ne se rouvre pas
      ouvrirCoffre(coffres[4]); await dort(100);
      out.pasDeDoublon = Q.braises === 2;

      // l'Antre réveille le Cœur de Cendre
      const ar = CENDRE.arene;
      J.x = (ar.x0 + (ar.w >> 1)) * TS + 8; J.y = (ar.y0 + 4) * TS + 8; J.invuln = 9999;
      await dort(300);
      out.bossReveille = !!(boss && boss.type === 'coeur') && !!coffres[5].verrou;
      if (boss) boss.pv = 0;
      await dort(300);
      out.bossVaincu = !boss && !coffres[5].verrou && !!Q.coeurTue;

      ouvrirCoffre(coffres[5]); await dort(1700);
      out.braises3 = Q.braises; out.etat = etat;

      /* Une partie d'AVANT les Terres de Cendre : elle a déjà ses trois
         étoiles, mais le drapeau du portail n'existait pas encore. Sans
         rattrapage au chargement, elle resterait devant un portail clos. */
      for (let i = 0; i < NB_SLOTS; i++) await stockEffacer(i);
      nouvellePartie('ANCIENNE', 0); await dort(300);
      J.fragments = 3; await sauver(true); await dort(200);
      const brut = JSON.parse(localStorage.getItem('kaze-partie-1'));
      delete brut.Q.portailOuvert;          // comme dans une sauvegarde d'époque
      delete brut.Q.braises; delete brut.Q.bottes; delete brut.Q.coeurTue;
      localStorage.setItem('kaze-partie-1', JSON.stringify(brut));
      await charger(0); await dort(500);
      out.ancienneEtoiles = J.fragments;
      out.anciennePortail = !!Q.portailOuvert;
      const gg = CENDRE.gorge;
      let yp = -1;
      for (let y = Y_CENDRE - 12; y < Y_CENDRE; y++) if (Obj(gg.x0, y) === O.PORTAIL) { yp = y; break; }
      out.anciennePassage = yp >= 0 && !solide(gg.x0 * TS + 8, yp * TS + 8, 0);
      return out;
    });

    v('la carte est doublée', r.MH === 160 && r.Y === 80, `${r.MH}/${r.Y}`);
    v('six coffres au total', r.coffres === 6, r.coffres);
    v('les quatre sols du biome existent',
      r.sols.every(n => n > 100), `cendre/lave/braise/basalte = ${r.sols.join('/')}`);
    v('les trois nouveaux monstres peuplent la région',
      r.faune.every(n => n > 0), `braise/golem/spectre = ${r.faune.join('/')}`);
    v('la vallée garde sa faune d\'origine', r.enVallee > 20, r.enVallee);
    v('les Cendres sont fermées tant que le portail l\'est', r.cendresFermees, 'déjà ouvertes');
    v('la vallée reste parcourable', r.valleeOk, 'village ou bois injoignables');
    v('les trois étoiles ouvrent le portail', r.portail && r.etoiles === 3,
      `ouvert=${r.portail} étoiles=${r.etoiles}`);
    v('la Forge Noire est atteignable', r.forgeOk, 'injoignable');
    v('la roche noire ne se contourne pas', r.falaisesBloquees, 'passage libre');
    v('le marteau est obtenu', r.marteau && r.braises1 === 1, `${r.marteau}/${r.braises1}`);
    v('le marteau ouvre les Falaises', r.falaisesOuvertes, 'toujours bloqué');
    v('les bottes sont obtenues', r.bottes && r.braises2 === 2, `${r.bottes}/${r.braises2}`);
    v('un coffre ne se rouvre pas', r.pasDeDoublon, 'contenu redonné');
    v('entrer dans l\'Antre réveille le Cœur', r.bossReveille, 'pas de boss');
    v('vaincre le Cœur descelle le coffre', r.bossVaincu, 'coffre verrouillé');
    v('la dernière braise donne la victoire',
      r.braises3 === 3 && r.etat === 'victoire', `braises=${r.braises3} état=${r.etat}`);
    v('une partie d\'avant la région garde ses trois étoiles',
      r.ancienneEtoiles === 3, r.ancienneEtoiles);
    v('UNE PARTIE D\'AVANT LA RÉGION TROUVE LE PORTAIL OUVERT',
      r.anciennePortail, 'portail resté clos');
    v('et peut réellement le franchir', r.anciennePassage, 'passage encore bloqué');
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
