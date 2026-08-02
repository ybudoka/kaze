'use strict';
/* CORRECTIFS.md § 34 à 37 — le désert, les étoiles, et la caisse perdue.

   Quatre défauts, tous mesurés dans le vrai jeu :
     - l'Arène du Colosse était à ZÉRO case atteignable, et l'unique gué qui y
       mène pouvait être coupé par une mare de sables mouvants tirée au hasard ;
     - `tresorSables`, `tresorMarais` et `tresorNues` étaient comptés au bilan
       de fin sans être posés nulle part : trois « énigmes » sur huit étaient
       impossibles ;
     - les trois étoiles se ramassaient dès le PREMIER monde, alors que le
       Rongeur est censé les avoir dévorées — et celles qu'il lâchait en
       mourant étaient dessinées en flèche et ne faisaient rien ;
     - une caisse poussée dans un coin condamnait son énigme pour toujours. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Le désert, les étoiles, et la caisse perdue',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const out = {};
      /* Parcours à pied avec la collision DU JEU. Les sables mouvants sont
         « solides » : c'est bien pour cela qu'il faut les combler. */
      const marche = (sx, sy) => {
        const v = new Uint8Array(MW * MH), f = [[sx, sy]];
        v[sy * MW + sx] = 1;
        while (f.length) {
          const [x, y] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || v[ny * MW + nx]) continue;
            if (solide(nx * TS + 8, ny * TS + 8, 0)) continue;
            if (Etg(nx, ny) > Etg(x, y) && Sol(nx, ny) !== S.RAMPE && Sol(x, y) !== S.RAMPE) continue;
            v[ny * MW + nx] = 1; f.push([nx, ny]);
          }
        }
        return v;
      };
      const entreeDesert = () => {
        const x = (SABLES.wadi.x0 + SABLES.wadi.x1) >> 1;
        let y = Y_SABLES + 2;
        while (y < Y_SABLES + 20 && solide(x * TS + 8, y * TS + 8, 0)) y++;
        return [x, y];
      };
      const casesDe = (v, z) => {
        let n = 0;
        for (let y = z.y0; y < z.y0 + z.h; y++) for (let x = z.x0; x < z.x0 + z.w; x++)
          if (v[y * MW + x]) n++;
        return n;
      };

      Object.assign(Q, { palmes: true, bottes: true, portailOuvert: true, bracelet: true,
                         boomerang: true, grappin: true, fanal: true, cape: true });
      if (!J.objets.includes('bracelet')) J.objets.push('bracelet');

      /* ---------- 1. LE CHEMIN DU COLOSSE ---------- */
      const [ex, ey] = entreeDesert();
      {
        const v = marche(ex, ey);
        out.areneAvant = casesDe(v, SABLES.arene);        // doit rester 0 : le gué barre
        const cx = SABLES.arene.x0 + (SABLES.arene.w >> 1);
        const yTop = SABLES.vanne.y0 - 3;
        // la réserve de blocs et l'allée d'accès doivent être atteignables
        out.reserveAtteinte = [yTop - 2, yTop - 1, yTop].filter(y => v[y * MW + cx]).length;
        out.alleeAtteinte = [yTop - 6, yTop - 5, yTop - 4].filter(y => v[y * MW + cx]).length;
        let blocs = 0, dispo = 0;
        for (let y = yTop - 3; y <= yTop + 1; y++) for (let dx = -2; dx <= 2; dx++)
          if (Obj(cx + dx, y) === O.BLOCLOURD) {
            blocs++;
            if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => v[(y + b) * MW + cx + dx + a])) dispo++;
          }
        out.blocs = blocs; out.blocsAtteignables = dispo;
        // les repères posés à l'entrée du couloir
        let obelisques = 0;
        for (let y = yTop - 6; y <= yTop; y++) for (let dx = -2; dx <= 2; dx++)
          if (Obj(cx + dx, y) === O.OBELISQUE) obelisques++;
        out.obelisques = obelisques;
        out.panneauPorte = panneaux.some(p => /COLOSSE/.test(p.txt)
          && Math.abs(p.x / TS - cx) < 4 && p.y / TS > Y_SABLES);
      }
      /* ---------- 2. ON JOUE LA SOLUTION, POUR DE VRAI ---------- */
      {
        const cx = SABLES.arene.x0 + (SABLES.arene.w >> 1);
        const va = SABLES.vanne, yTop = va.y0 - 3;
        let comblees = 0;
        for (let essai = 0; essai < 6; essai++) {
          let bloc = null;
          for (let y = yTop - 3; y <= yTop + 1 && !bloc; y++) for (let dx = -2; dx <= 2; dx++)
            if (Obj(cx + dx, y) === O.BLOCLOURD) { bloc = [cx + dx, y]; break; }
          if (!bloc) break;
          J.x = cx * TS + 8; J.y = bloc[1] * TS + 8; J.z = 0; J.invuln = 9999; J.pv = J.pvmax;
          J.dir = bloc[0] < cx ? 1 : 3; J.porte = null;
          brasBracelet();                                   // soulever
          if (!J.porte) break;
          let yc = va.y0;
          while (yc <= va.y1 && Sol(cx, yc) !== S.SABLEMOU) yc++;
          if (yc > va.y1) break;
          J.x = cx * TS + 8; J.y = (yc - 1) * TS + 8; J.dir = 2;
          brasBracelet();                                   // jeter
          for (let i = 0; i < 60; i++) majDivers();
          if (Sol(cx, yc) !== S.SABLEMOU) comblees++;
        }
        out.comblees = comblees;
        out.areneApres = casesDe(marche(ex, ey), SABLES.arene);
      }

      /* ---------- 3. LA CITERNE : l'énigme qui manquait ---------- */
      {
        const c = CITERNE;
        out.citerneEstUneSalle = !!salleDe((c.x0 + 2) * TS, (c.y0 + c.h - 2) * TS);
        let gue = 0, blocs = 0;
        for (let y = c.y0; y < c.y0 + c.h; y++) for (let x = c.x0; x < c.x0 + c.w; x++) {
          if (Sol(x, y) === S.SABLEMOU) gue++;
          if (Obj(x, y) === O.BLOCLOURD) blocs++;
        }
        out.citerne = { gue, blocs };
        // le gué coupe la salle : le trésor est hors d'atteinte au départ
        const dep = [c.x0 + 2, c.y0 + c.h - 2];
        const v = marche(dep[0], dep[1]);
        out.tresorSablesFerme = !v[TRESOR_SABLES[1] * MW + TRESOR_SABLES[0]];
        // et il y a plus de blocs que de rangées à combler : on ne peut pas se bloquer
        out.assezDeBlocs = blocs > 2;
      }
      /* ---------- 4. LES TROIS TRÉSORS FANTÔMES SONT POSÉS ---------- */
      {
        const pose = p => butins.some(b => b.type === 'coeurmax'
          && Math.floor(b.x / TS) === p[0] && Math.floor(b.y / TS) === p[1]);
        out.tresorsPoses = { sables: pose(TRESOR_SABLES), marais: pose(TRESOR_MARAIS),
                             nues: pose(TRESOR_NUES) };
        // celui du Marais est bien cerné de ronces : sans le fanal, rien à faire
        let ronces = 0;
        for (let y = TRESOR_MARAIS[1] - 1; y <= TRESOR_MARAIS[1] + 1; y++)
          for (let x = TRESOR_MARAIS[0] - 1; x <= TRESOR_MARAIS[0] + 1; x++)
            if (Obj(x, y) === O.RONCE) ronces++;
        out.roncesAutourDuMarais = ronces;
      }

      /* ---------- 5. LE PREMIER MONDE NE DONNE PLUS D'ÉTOILES ---------- */
      {
        razQuetes();
        const textes = [];
        const vraiDire = window.dire;
        window.dire = (t, d) => { textes.push(String(t)); return vraiDire(t, d); };
        poserCoffres();
        for (const c of coffres.slice(0, 3)) { c.ouvert = false; c.verrou = false; ouvrirCoffre(c); }
        window.dire = vraiDire;
        out.textesCoffres = textes.join(' | ');
        out.coffresParlentDePierres = textes.every(t => !/ÉTOILE/.test(t));
        out.etoilesTouours0 = Q.etoiles === 0;
      }
      /* ---------- 6. LES ÉTOILES SE REPRENNENT AU RONGEUR ---------- */
      {
        razQuetes();
        butins.length = 0;
        butins.push({ x: J.x + 30, y: J.y, z: 0, vz: 0, type: 'etoileVolee', t: 0 });
        out.etoileSpriteOK = (SPR_BUTIN['etoileVolee'] || 'fleche') !== 'fleche'
          && !!SPR[SPR_BUTIN['etoileVolee']];
        // elle vient au héros toute seule, puis se ramasse
        J.invuln = 9999;
        for (let i = 0; i < 200 && butins.length; i++) { majDivers(); majJoueur(); }
        out.etoilePrise = Q.etoiles === 1;
        // l'épilogue ne peut pas commencer avec des étoiles perdues
        razQuetes(); Q.etoiles = 0;
        lancerEpilogue();
        out.epilogueGarantit = Q.etoiles === 3;
        etat = 'jeu';
      }

      /* ---------- 7. LA CAISSE POUSSÉE DANS UN COIN REVIENT ---------- */
      {
        razQuetes();
        const pz = PUZZLES.find(p => p.caisses && p.caisses.length === 1);
        out.puzzleConnaitSesCaisses = !!pz;
        const [cx, cy] = pz.caisses[0];
        const s = pz.salle;
        // on entre dans la salle, on pousse la caisse dans un coin perdu
        J.x = (s.x0 + 2) * TS + 8; J.y = (s.y0 + s.h - 2) * TS + 8; J.z = 0;
        majPuzzles();
        putO(cx, cy, O.RIEN);
        const coin = [s.x0 + 1, s.y0 + s.h - 2];
        putO(coin[0], coin[1], O.CAISSE);
        rafraichirTuile(cx, cy); rafraichirTuile(coin[0], coin[1]);
        out.caisseDeplacee = Obj(cx, cy) !== O.CAISSE && Obj(coin[0], coin[1]) === O.CAISSE;
        // tant qu'on est DANS la salle, rien ne bouge sous nos yeux
        majPuzzles();
        out.rienNeBougeDedans = Obj(coin[0], coin[1]) === O.CAISSE;
        // on sort : elle doit revenir à sa case de départ
        J.x = 35 * TS; J.y = 45 * TS;
        majPuzzles();
        out.caisseRevenue = Obj(cx, cy) === O.CAISSE && Obj(coin[0], coin[1]) !== O.CAISSE;
        // et une énigme déjà résolue ne se remet pas en place
        pz.fini = true;
        putO(cx, cy, O.RIEN); rafraichirTuile(cx, cy);
        majPuzzles();
        out.pasDeRetourSiFini = Obj(cx, cy) !== O.CAISSE;
        pz.fini = false; putO(cx, cy, O.CAISSE);
      }

      /* ---------- 8. LE CACTUS VIVANT ---------- */
      {
        const cact = ennemis.filter(e => e.type === 'cactus');
        out.nbCactus = cact.length;
        out.cactusAuDesert = cact.every(e => regionDe(e.y) === 'sables');
        out.cactusSprites = ['cactus0', 'cactus1', 'epine'].filter(n => !SPR[n]);
        // planté : il ne poursuit pas, et il tire une couronne d'épines
        const e = { type: 'cactus', x: 44 * TS, y: (Y_SABLES + 30) * TS, z: 0, vz: 0, r: 8,
                    dir: 2, pv: 7, pvmax: 7, t: 0, cd: 0, flash: 0, kx: 0, ky: 0, hx: 0, hy: 0,
                    anim: 0, stun: 0, gonfle: 0 };
        ennemis.length = 0; tirs.length = 0; ennemis.push(e);
        J.x = e.x + 40; J.y = e.y; J.z = 0; J.invuln = 9999; J.pv = J.pvmax;
        const x0 = e.x, y0 = e.y;
        let gonfleVu = false;
        for (let i = 0; i < 260; i++) { majEnnemis(); if (e.gonfle > 0) gonfleVu = true; }
        out.cactusResteEnPlace = Math.abs(e.x - x0) < 2 && Math.abs(e.y - y0) < 2;
        out.cactusGonfle = gonfleVu;
        out.epinesTirees = tirs.filter(t => t.spr === 'epine').length;
        out.epinesEnCouronne = new Set(tirs.filter(t => t.spr === 'epine')
          .map(t => (Math.round(Math.atan2(t.vy, t.vx) * 4 / Math.PI) + 8) % 8)).size;
        // hors de portée, il ne gaspille pas ses épines
        ennemis.length = 0; tirs.length = 0;
        e.cd = 0; e.gonfle = 0; ennemis.push(e);
        J.x = e.x + 400;
        for (let i = 0; i < 260; i++) majEnnemis();
        out.epinesDeLoin = tirs.filter(t => t.spr === 'epine').length;
      }
      return out;
    });

    v('SANS COMBLER LE GUÉ, L\'ARÈNE DU COLOSSE EST CLOSE',
      r.areneAvant === 0, `${r.areneAvant} cases déjà accessibles`);
    v('LA RÉSERVE DE BLOCS EST ATTEIGNABLE', r.reserveAtteinte === 3,
      `${r.reserveAtteinte}/3 — le gué serait injouable`);
    v('ET L\'ALLÉE QUI Y MÈNE AUSSI (elle pouvait être noyée de sable)',
      r.alleeAtteinte === 3, `${r.alleeAtteinte}/3`);
    v('les quatre blocs sont à portée de main',
      r.blocs === 4 && r.blocsAtteignables === 4, `${r.blocsAtteignables}/${r.blocs}`);
    v('deux obélisques et un panneau marquent la porte',
      r.obelisques === 2 && r.panneauPorte, `obélisques ${r.obelisques}`);
    v('TROIS BLOCS JETÉS COMBLENT LE GUÉ', r.comblees === 3, 'comblées : ' + r.comblees);
    v('ET L\'ARÈNE S\'OUVRE ALORS VRAIMENT', r.areneApres > 300, r.areneApres + ' cases');

    v('LA CITERNE EST UNE SALLE CLOSE', r.citerneEstUneSalle);
    v('elle a son gué et sa réserve', r.citerne.gue >= 10 && r.citerne.blocs === 4,
      JSON.stringify(r.citerne));
    v('son trésor est enfermé tant qu\'on n\'a pas comblé', r.tresorSablesFerme);
    v('et il y a plus de blocs qu\'il n\'en faut (on ne peut pas s\'y bloquer)', r.assezDeBlocs);

    v('LES TROIS TRÉSORS FANTÔMES EXISTENT ENFIN',
      r.tresorsPoses.sables && r.tresorsPoses.marais && r.tresorsPoses.nues,
      JSON.stringify(r.tresorsPoses));
    v('celui du Marais est cerné de ronces (il faut le fanal)',
      r.roncesAutourDuMarais === 8, 'ronces : ' + r.roncesAutourDuMarais);

    v('LE PREMIER MONDE NE DONNE PLUS D\'ÉTOILES',
      r.coffresParlentDePierres && r.etoilesTouours0, r.textesCoffres);
    v('l\'étoile reprise a son icône (elle était dessinée en FLÈCHE)', r.etoileSpriteOK);
    v('ELLE VIENT AU HÉROS ET SE RAMASSE', r.etoilePrise);
    v('l\'épilogue ne peut pas commencer sans les trois', r.epilogueGarantit);

    v('CHAQUE ÉNIGME CONNAÎT LA CASE DE DÉPART DE SES CAISSES', r.puzzleConnaitSesCaisses);
    v('rien ne se replace tant qu\'on est dans la salle', r.rienNeBougeDedans);
    v('UNE CAISSE POUSSÉE DANS UN COIN REVIENT QUAND ON SORT',
      r.caisseDeplacee && r.caisseRevenue, 'déplacée ' + r.caisseDeplacee + ', revenue ' + r.caisseRevenue);
    v('une énigme déjà résolue ne rejoue pas ses caisses', r.pasDeRetourSiFini);

    v('DES CACTUS VIVANTS PEUPLENT LE DÉSERT',
      r.nbCactus >= 5 && r.cactusAuDesert, `${r.nbCactus} cactus`);
    v('ils ont leurs sprites', r.cactusSprites.length === 0, r.cactusSprites.join(','));
    v('LE CACTUS NE POURSUIT PAS : IL EST PLANTÉ', r.cactusResteEnPlace);
    v('il gonfle avant de tirer (le seul avertissement)', r.cactusGonfle);
    v('IL LÂCHE UNE COURONNE D\'ÉPINES, PAS UN TIR',
      r.epinesTirees >= 8 && r.epinesEnCouronne >= 6,
      `${r.epinesTirees} épines, ${r.epinesEnCouronne} directions`);
    v('de loin, il n\'arrose pas le désert pour rien', r.epinesDeLoin === 0,
      r.epinesDeLoin + ' épines tirées de loin');

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS.join(' | '));
    await page.context().close();
  },
};
