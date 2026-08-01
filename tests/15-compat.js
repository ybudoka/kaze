'use strict';
/* CORRECTIFS.md § 14 — compatibilité des sauvegardes. Une partie enregistrée
   AVANT l'ajout d'un niveau ou d'une fonctionnalité doit se recharger sans
   crash, sans piéger le héros, et sans rien perdre de sa progression. On
   fabrique des sauvegardes « d'époque » (peu de champs, pas de brouillard, peu
   de coffres) et on vérifie qu'elles restent JOUABLES sur la carte actuelle. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Compatibilité des sauvegardes',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};

      // flood-fill à pied, vraies collisions (pour prouver qu'on n'est pas bloqué)
      const passable = (x, y) => {
        if (!dansCarte(x, y)) return false;
        const s = Sol(x, y);
        if (s === S.LAVE || s === S.SABLEMOU) return false;
        if ((s === S.EAU || s === S.EAUPROF) && !Q.palmes) return false;
        const o = Obj(x, y);
        if (o === O.PORTAIL) return !!Q.portailOuvert;
        if (o === O.BLOCB) return etatInter(y) !== 0;
        if (o === O.BLOCO) return etatInter(y) !== 1;
        if (o === O.ROCNOIR || o === O.GLACON || o === O.CAISSE || o === O.ANCRE || o === O.PORTEP || o === O.BLOCLOURD) return false;
        if (o && DUR_O[o] && !FRANCH_O[o]) return false;
        return true;
      };
      const reachable = (fromx, fromy, tox, toy) => {
        const vus = new Uint8Array(MW * MH), f = [[fromx, fromy]]; vus[fromy * MW + fromx] = 1;
        while (f.length) { const [x, y] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx] || !passable(nx, ny)) continue;
            const lien = Etg(nx, ny) <= Etg(x, y) || Sol(nx, ny) === S.RAMPE || Sol(x, y) === S.RAMPE;
            if (!lien) continue;
            vus[ny * MW + nx] = 1; f.push([nx, ny]); } }
        return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => dansCarte(tox + dx, toy + dy) && vus[(toy + dy) * MW + tox + dx]);
      };
      const poser = obj => { for (let i = 0; i < NB_SLOTS; i++) localStorage.removeItem('kaze-partie-' + (i + 1));
        localStorage.setItem('kaze-partie-1', JSON.stringify(obj)); };

      /* ---- 1) une TRÈS vieille partie : d'avant les Terres de Cendre ----
         Peu de champs de quête, trois coffres seulement, pas de brouillard,
         trois étoiles déjà réunies (mais le drapeau du portail n'existait pas). */
      poser({
        v: VERSION_SAUVE, date: 1, temps: 1200, nom: 'ANCIENNE',
        Q: { parleDoyenne: true, porteOuverte: true, cle: false, lucioles: 5, prime: 8 },
        J: { x: 35 * TS, y: 45 * TS, z: 0, dir: 2, pv: 6, pvmax: 6, rubis: 77,
             bombes: 4, fleches: 12, fragments: 3, objets: ['arc', 'bombe'], objSel: 1 },
        coffres: [[1, 0], [1, 0], [1, 0]],           // seulement 3 coffres à l'époque
        lucioles: [1, 1, 1, 1, 1, 0, 0, 0],
        diff: [], vu: ''                              // pas de brouillard enregistré
      });
      out.oldLoad = await charger(0); await dort(400);
      out.old = {
        fragments: J.fragments, rubis: J.rubis, objets: J.objets.slice(),
        parle: !!Q.parleDoyenne, lucioles: Q.lucioles,
        interLen: Array.isArray(Q.inter) ? Q.inter.length : -1,
        bracelet: !!Q.bracelet, palmes: !!Q.palmes, grappin: !!Q.grappin,
        pasCoince: !solide(J.x, J.y, J.z),
        portailRattrape: !!Q.portailOuvert,          // 3 étoiles -> portail ouvert
        coffresTotal: coffres.length,
        // le héros peut atteindre le portail de Cendre (donc progresser)
        atteintPortail: reachable(Math.floor(J.x / TS), Math.floor(J.y / TS),
          (CENDRE.gorge.x0 + CENDRE.gorge.x1) >> 1, Y_CENDRE - 4),
      };

      /* ---- 2) une partie INTERMÉDIAIRE : ère « quatre régions » ----
         Elle a les palmes et le boomerang, mais aucun champ des Sables ni du
         bracelet. Les outils doivent rester équipés, les nouveaux champs par
         défaut, et l'oued des Sables joignable à la nage. */
      poser({
        v: VERSION_SAUVE, date: 1, temps: 5000, nom: 'INTER',
        Q: { parleDoyenne: true, porteOuverte: true, portailOuvert: true, coeurTue: true,
             braises: 3, boomerang: true, palmes: true, grappin: true, inter: [1, 0, 0, 0], lucioles: 8 },
        J: { x: (LAGON.greve.x0 + 2) * TS, y: (LAGON.greve.y0 + 2) * TS, z: 0, dir: 2,
             pv: 10, pvmax: 10, rubis: 300, bombes: 8, fleches: 20, fragments: 3,
             objets: ['arc', 'bombe', 'marteau', 'boomerang'], objSel: 0 },   // grappin pas dans le sac !
        coffres: [[1, 0], [1, 0], [1, 0], [1, 0], [1, 0], [1, 0]],
        lucioles: [1, 1, 1, 1, 1, 1, 1, 1],
        diff: [], vu: ''
      });
      out.interLoad = await charger(0); await dort(400);
      out.inter = {
        palmes: !!Q.palmes, boomerang: !!Q.boomerang,
        objetsGrappin: J.objets.includes('grappin'),      // rééquipé par le rattrapage
        objetsBoomerang: J.objets.includes('boomerang'),
        interLen: Array.isArray(Q.inter) ? Q.inter.length : -1,
        interPreserve: etatInter(0) === 1,                 // la bascule d'époque est gardée
        bracelet: !!Q.bracelet, fresques: Q.fresques, colosse: !!Q.colosseTue,
        pasCoince: !solide(J.x, J.y, J.z),
        // à la nage, on atteint l'oued qui descend vers les Sables
        atteintOued: reachable(Math.floor(J.x / TS), Math.floor(J.y / TS),
          (SABLES.wadi.x0 + SABLES.wadi.x1) >> 1, Y_SABLES + 3),
      };

      /* ---- 3) une position héritée d'une carte plus petite ne piège pas ----
         Un vieux point de sauvegarde tombé là où le décor a changé : le héros
         doit être dégagé sur une case libre, jamais coincé dans un mur. */
      poser({
        v: VERSION_SAUVE, date: 1, temps: 10, nom: 'BORD',
        Q: { parleDoyenne: true }, J: { x: 3 * TS, y: 3 * TS, z: 0, dir: 2, pv: 6, pvmax: 6,
             rubis: 0, bombes: 0, fleches: 0, fragments: 0, objets: [], objSel: 0 },
        coffres: [], lucioles: [], diff: [], vu: ''
      });
      out.bordLoad = await charger(0); await dort(300);
      out.bordPasCoince = !solide(J.x, J.y, J.z);
      out.bordDansCarte = J.x > 0 && J.y > 0 && J.x < MW * TS && J.y < MH * TS;

      return out;
    });

    v('une très vieille partie se recharge', r.oldLoad === true, 'chargement refusé');
    v('elle garde ses trois étoiles et ses rubis',
      r.old.fragments === 3 && r.old.rubis === 77, `étoiles=${r.old.fragments} rubis=${r.old.rubis}`);
    v('elle garde son inventaire et sa progression',
      r.old.objets.join() === 'arc,bombe' && r.old.parle && r.old.lucioles === 5,
      `${r.old.objets.join()} parle=${r.old.parle}`);
    v('les nouveaux champs prennent des valeurs sûres',
      r.old.interLen === 6 && !r.old.bracelet && !r.old.palmes && !r.old.grappin,
      `inter=${r.old.interLen} bracelet=${r.old.bracelet}`);
    v('les six coffres existent même avec un vieux tableau de trois',
      r.old.coffresTotal === 6, `${r.old.coffresTotal}`);
    v('LE HÉROS N\'EST JAMAIS COINCÉ APRÈS CHARGEMENT', r.old.pasCoince, 'coincé dans un obstacle');
    v('LE PORTAIL EST RATTRAPÉ POUR UNE PARTIE À TROIS ÉTOILES', r.old.portailRattrape, 'portail resté clos');
    v('LE HÉROS PEUT ENCORE PROGRESSER (atteint le portail)', r.old.atteintPortail, 'portail injoignable');

    v('une partie « quatre régions » se recharge', r.interLoad === true, 'chargement refusé');
    v('ses outils restent équipés (grappin réajouté au sac)',
      r.inter.objetsGrappin && r.inter.objetsBoomerang && r.inter.palmes,
      `grappin=${r.inter.objetsGrappin} boomerang=${r.inter.objetsBoomerang}`);
    v('son interrupteur d\'époque est complété à six sans être perdu',
      r.inter.interLen === 6 && r.inter.interPreserve, `len=${r.inter.interLen} garde=${r.inter.interPreserve}`);
    v('les champs des Sables sont par défaut',
      !r.inter.bracelet && r.inter.fresques === 0 && !r.inter.colosse, 'champs Sables hérités à tort');
    v('elle atteint l\'oued vers les Sables (à la nage)', r.inter.atteintOued && r.inter.pasCoince, 'oued injoignable');

    v('une position au bord est chargée sans crash', r.bordLoad === true, 'chargement refusé');
    v('UNE POSITION HÉRITÉE NE PIÈGE PAS LE HÉROS', r.bordPasCoince && r.bordDansCarte, 'coincé ou hors carte');
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
