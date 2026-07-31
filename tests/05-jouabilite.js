'use strict';
/* CORRECTIFS.md § 5.5 et 5.2 — l'épée doit toucher sur toute sa lame, et les
   huit lucioles d'or doivent rester dégagées et atteignables. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Jouabilité',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    /* ---- § 5.5 : portée de l'épée ---- */
    const epee = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const cx = Math.floor(J.x / TS), cy = Math.floor(J.y / TS);
      for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 6; x <= cx + 6; x++) {
        putO(x, y, O.RIEN); putE(x, y, 0); putS(x, y, S.HERBE);
      }
      prerendreSol(); pnjs.length = 0; structures.length = 0;
      const px = J.x, py = J.y;
      const touche = async (dir, dx, dy) => {
        ennemis.length = 0; butins.length = 0;
        J.x = px; J.y = py; J.z = 0; J.dir = dir; J.atk = 0; J.spin = 0; J.invuln = 9999;
        pondre('gluant', 0, 0);
        const e = ennemis[0]; e.x = px + dx; e.y = py + dy; e.z = 0;
        const pv0 = e.pv; J.atk = 12;
        for (let f = 0; f < 8; f++) await dort(18);
        return ennemis.length === 0 || ennemis[0].pv < pv0;
      };
      return {
        corpsACorps: await touche(3, -7, 0),      // monstre collé au héros
        aPortee:     await touche(3, 21, 0),
        surLeCote:   await touche(3, 14, 21),     // dans l'arc du balayage
        pointe:      await touche(3, 35, 0),
        horsPortee:  await touche(3, 56, 0),      // doit rater
        haut:        await touche(0, 0, -20), gauche: await touche(1, -20, 0),
        bas:         await touche(2, 0, 20),  droite: await touche(3, 20, 0),
      };
    });

    v('l\'épée touche un monstre collé au héros', epee.corpsACorps, 'raté');
    v('l\'épée touche à portée normale', epee.aPortee, 'raté');
    v('l\'épée touche sur le côté (arc du balayage)', epee.surLeCote, 'raté');
    v('l\'épée touche jusqu\'à la pointe', epee.pointe, 'raté');
    v('l\'épée ne touche pas hors de portée', !epee.horsPortee, 'touche trop loin');
    v('les quatre directions frappent',
      epee.haut && epee.gauche && epee.bas && epee.droite,
      `${epee.haut}/${epee.gauche}/${epee.bas}/${epee.droite}`);

    /* ---- § 5.2 : lucioles dégagées et atteignables ---- */
    const luc = await page.evaluate(() => {
      const bilan = { encombrees: [], inatteignables: [] };
      for (let essai = 0; essai < 5; essai++) {
        nouvellePartie('T', 0);
        // dégagement : aucun obstacle bloquant dans la clairière (torches exclues)
        lucioles.forEach((l, i) => {
          const tx = Math.floor(l.x / TS), ty = Math.floor(l.y / TS);
          let n = 0;
          for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) {
            const o = Obj(x, y);
            if ((DUR_O[o] && o !== O.TORCHE) || Sol(x, y) === S.EAU) n++;
          }
          if (n && !bilan.encombrees.includes(i)) bilan.encombrees.push(i);
        });
        // accessibilité : parcours avec les vraies règles de collision
        const passable = (x, y) => {
          if (!dansCarte(x, y)) return false;
          const s = Sol(x, y);
          if (s === S.EAU || s === S.LAVE) return false;
          const o = Obj(x, y);
          if (o === O.PORTAIL) return !!Q.portailOuvert;
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
        lucioles.forEach((l, i) => {
          const tx = Math.floor(l.x / TS), ty = Math.floor(l.y / TS);
          if (!vus[ty * MW + tx] && !bilan.inatteignables.includes(i)) bilan.inatteignables.push(i);
        });
        // le test doit savoir dire non : le sanctuaire verrouillé reste fermé
        bilan.sanctuaireFerme = !vus[18 * MW + 63];
        bilan.couverture = Math.round(vus.reduce((a, b) => a + b, 0) / (MW * MH) * 100);
      }
      return bilan;
    });

    v('les huit lucioles sont dégagées', luc.encombrees.length === 0, `n° ${luc.encombrees.join(',')}`);
    v('les huit lucioles sont atteignables', luc.inatteignables.length === 0, `n° ${luc.inatteignables.join(',')}`);
    v('le test sait dire non (sanctuaire verrouillé fermé)', luc.sanctuaireFerme, 'atteint à tort');
    v('le parcours reste restrictif', luc.couverture < 80, `${luc.couverture}% de la carte`);
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
