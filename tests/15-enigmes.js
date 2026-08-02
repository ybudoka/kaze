'use strict';
/* CORRECTIFS.md § 14 — les énigmes réutilisables (caisse, plaque, porte à
   mécanisme, interrupteur à bascule), le nouvel outil GRAPPIN, et la nouvelle
   animation du marteau (une chute verticale, pas un balayage). On mesure tout
   sur le vrai jeu : géométrie posée, énigmes résolubles avec les vraies
   collisions, rien de perdu au rechargement. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Énigmes, grappin & marteau',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};

      // ---- les nouvelles briques existent ----
      out.tiles = { PLAQUE: S.PLAQUE, CAISSE: O.CAISSE, INTER: O.INTER,
        BLOCB: O.BLOCB, BLOCO: O.BLOCO, ANCRE: O.ANCRE, PORTEP: O.PORTEP };

      // ---- parcours à pied, vraies collisions, sans outils ----
      const passable = (x, y, tools) => {
        if (!dansCarte(x, y)) return false;
        const s = Sol(x, y);
        if (s === S.LAVE) return false;
        if ((s === S.EAU || s === S.EAUPROF) && !tools.palmes) return false;
        const o = Obj(x, y);
        if (o === O.PORTAIL) return !!Q.portailOuvert;
        if (o === O.BLOCB) return etatInter(y) !== 0;
        if (o === O.BLOCO) return etatInter(y) !== 1;
        if (o === O.ROCNOIR || o === O.GLACON || o === O.CAISSE || o === O.ANCRE || o === O.PORTEP) return false;
        if (o && DUR_O[o] && !FRANCH_O[o]) return false;
        return true;
      };
      const flood = (sx, sy, tools) => {
        const vus = new Uint8Array(MW * MH), f = [[sx, sy]]; vus[sy * MW + sx] = 1;
        while (f.length) { const [x, y] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx] || !passable(nx, ny, tools)) continue;
            const lien = Etg(nx, ny) <= Etg(x, y) || Sol(nx, ny) === S.RAMPE || Sol(x, y) === S.RAMPE;
            if (!lien) continue;
            vus[ny * MW + nx] = 1; f.push([nx, ny]); } }
        return vus;
      };
      const pres = (v, x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
        dansCarte(x + dx, y + dy) && v[(y + dy) * MW + x + dx]);
      const sx = Math.floor(J.x / TS), sy = Math.floor(J.y / TS);

      // ======== ÉNIGME 1 (vallée) : caisse → plaque → grappin ========
      const A = ENIG.caisse, cxA = A.x0 + 3;
      out.A_plaque = Sol(cxA, A.y0 + 7) === S.PLAQUE;
      out.A_caisse = Obj(cxA, A.y0 + 6) === O.CAISSE;
      out.A_porte = Obj(cxA, A.y0 + 3) === O.PORTEP;
      out.A_grappinButin = butins.some(b => b.type === 'grappin');
      let a = flood(sx, sy, {});
      out.A_salleAtteignable = pres(a, cxA, A.y0 + A.h - 2);
      // pousser la caisse sur la plaque ouvre la porte
      putO(cxA, A.y0 + 6, O.RIEN); putO(cxA, A.y0 + 7, O.CAISSE); majPuzzles();
      out.A_porteOuverte = Obj(cxA, A.y0 + 3) === O.RIEN;

      // ======== ÉNIGME 2 (vallée) : interrupteur à bascule ========
      const C = ENIG.inter;
      out.C_bloc = Obj(C.x0 + 1, C.y0 + 4) === O.BLOCB;
      out.C_inter = Obj(C.x0 + 1, C.y0 + C.h - 2) === O.INTER;
      out.C_pleinAvant = solide((C.x0 + 1) * TS + 8, (C.y0 + 4) * TS + 8, 0);
      basculerInter(C.x0 + 1, C.y0 + C.h - 2);       // frappe l'interrupteur
      out.C_abaisseApres = !solide((C.x0 + 1) * TS + 8, (C.y0 + 4) * TS + 8, 0);
      out.C_etatInter = etatInter(C.y0) === 1;
      basculerInter(C.x0 + 1, C.y0 + C.h - 2);       // re-bascule
      out.C_reversible = etatInter(C.y0) === 0;

      // ======== ÉNIGME 3 (vallée) : le gouffre au grappin ========
      const G = ENIG.gouffre;
      out.G_ancre = Obj(G.x0 + 6, G.y0 + 4) === O.ANCRE;
      out.G_eau = Sol(G.x0 + 4, G.y0 + 3) === S.EAU;
      a = flood(sx, sy, {});
      out.G_loinBloque = !pres(a, TRESOR_GOUFFRE[0], TRESOR_GOUFFRE[1]);   // injoignable à pied
      out.G_pretBloque = pres(a, G.x0 + 2, G.y0 + G.h - 2);                // le bord accessible

      // le grappin traverse : on l'équipe et on tire
      Q.grappin = true; if (!J.objets.includes('grappin')) J.objets.push('grappin');
      J.x = (G.x0 + 2) * TS + 8; J.y = (G.y0 + 4) * TS + 8; J.z = 0; J.dir = 3; J.grap = null;
      lancerGrappin();
      out.G_grapLance = !!J.grap;
      for (let i = 0; i < 40 && J.grap; i++) majJoueur();
      out.G_grapArrive = Math.floor(J.x / TS) === G.x0 + 5;                 // case avant l'ancre
      out.G_tresorRejoint = pres(flood(Math.floor(J.x / TS), Math.floor(J.y / TS), {}),
        TRESOR_GOUFFRE[0], TRESOR_GOUFFRE[1]);

      /* ---- LE RETOUR ---- le contrôle qui manquait, et par où le bug est
         passé : traverser ne prouve rien si l'on ne peut pas revenir. La douve
         barre TOUTE la hauteur — dans les deux sens. Sans ancre sur la rive
         d'entrée, on prenait le trésor et l'on restait scellé pour toujours
         dans une poche de 19 cases. */
      out.G_ancreRetour = Obj(G.x0 + 1, G.y0 + 4) === O.ANCRE;
      // depuis la rive lointaine : on se met au bord de l'eau et l'on vise l'ouest
      J.x = (G.x0 + 5) * TS + 8; J.y = (G.y0 + 4) * TS + 8; J.z = 0; J.dir = 1; J.grap = null;
      lancerGrappin();
      out.G_retourLance = !!J.grap;
      for (let i = 0; i < 40 && J.grap; i++) majJoueur();
      out.G_retourArrive = Math.floor(J.x / TS) === G.x0 + 2;      // reposé sur la rive d'entrée
      // et de là, l'entrée de la salle se rejoint à pied
      out.G_entreeRejointe = pres(flood(Math.floor(J.x / TS), Math.floor(J.y / TS), {}),
        G.x0 + 2, G.y0 + G.h - 1);

      // ======== ÉNIGME 4 (Cendres) : deux caisses, deux plaques ========
      const D = ENIG.cendre;
      out.D_deuxPlaques = Sol(D.x0 + 2, D.y0 + 7) === S.PLAQUE && Sol(D.x0 + 8, D.y0 + 7) === S.PLAQUE;
      // une seule plaque couverte ne suffit pas
      putO(D.x0 + 2, D.y0 + 6, O.RIEN); putO(D.x0 + 2, D.y0 + 7, O.CAISSE); majPuzzles();
      out.D_uneInsuffisante = Obj(D.x0 + 5, D.y0 + 3) === O.PORTEP;
      // les deux couvertes ouvrent la porte
      putO(D.x0 + 8, D.y0 + 6, O.RIEN); putO(D.x0 + 8, D.y0 + 7, O.CAISSE); majPuzzles();
      out.D_deuxOuvrent = Obj(D.x0 + 5, D.y0 + 3) === O.RIEN;

      // ======== le MARTEAU : une chute verticale, pas un balayage ========
      // on place le héros devant un mur de roche noire et on arme le marteau
      etat = 'jeu';
      const rx = 40, ry = Y_CENDRE + 20;
      putS(rx, ry, S.CENDRE); putO(rx, ry, O.RIEN);
      putO(rx, ry - 1, O.ROCNOIR);                    // la roche à briser, au nord
      J.objets = ['marteau']; J.objSel = 0;
      J.x = rx * TS + 8; J.y = ry * TS + 8; J.z = 0; J.dir = 0; J.atk = 0; J.slam = 0; J.spin = 0;
      J.invuln = 99999;
      enfoncer('Y'); await dort(60); BTN['Y'] = 0;     // on déclenche le marteau
      out.M_slamPasEpee = J.slam > 0 && J.atk === 0;   // c'est un SLAM, pas un coup d'épée
      // on laisse l'animation aller jusqu'à l'impact
      let brise = false;
      for (let i = 0; i < 30; i++) { await dort(20); if (Obj(rx, ry - 1) === O.RIEN) { brise = true; break; } }
      out.M_briseRoche = brise;                        // l'impact casse la roche noire
      out.M_dureeSlam = SLAM_DUR > 0 && SLAM_IMPACT > 0 && SLAM_IMPACT < SLAM_DUR;

      // ======== rien ne se perd au rechargement ========
      // on ramasse le grappin, on bascule un interrupteur, on prend un trésor
      Q.grappin = true; Q.inter = [1, 0, 0, 0]; Q.tresorGouffre = true;
      if (!J.objets.includes('grappin')) J.objets.push('grappin');
      const cxA2 = ENIG.caisse.x0 + 3;                 // laisser une caisse sur sa plaque
      putO(cxA2, ENIG.caisse.y0 + 6, O.RIEN); putO(cxA2, ENIG.caisse.y0 + 7, O.CAISSE);
      await sauver(true); await dort(250);
      await charger(0); await dort(500);
      out.apresChargement = {
        grappin: !!Q.grappin, inter0: etatInter(0), tresorGouffre: !!Q.tresorGouffre,
        objetsGrappin: J.objets.includes('grappin'),
        caisseSurPlaque: Obj(cxA2, ENIG.caisse.y0 + 7) === O.CAISSE,
        grappinButinRepose: !butins.some(b => b.type === 'grappin'),   // déjà pris : ne repousse plus
        /* L'ancre de retour vient de la GÉNÉRATION, rejouée à chaque
           chargement : une partie sauvée avant qu'elle existe — sur la rive
           lointaine, donc scellée — la retrouve, et se rattrape sans
           recommencer. */
        ancreRetour: Obj(ENIG.gouffre.x0 + 1, ENIG.gouffre.y0 + 4) === O.ANCRE,
      };

      // ======== une partie neuve repart de zéro ========
      nouvellePartie('NEUVE', 1); await dort(350);
      out.neuve = { grappin: !!Q.grappin, inter0: etatInter(0),
        grappinButin: butins.some(b => b.type === 'grappin'),
        caisseAuDepart: Obj(ENIG.caisse.x0 + 3, ENIG.caisse.y0 + 6) === O.CAISSE };

      return out;
    });

    v('les briques d\'énigme existent',
      r.tiles.CAISSE && r.tiles.INTER && r.tiles.ANCRE && r.tiles.PORTEP && r.tiles.PLAQUE,
      JSON.stringify(r.tiles));
    v('la salle de la caisse est posée et atteignable',
      r.A_plaque && r.A_caisse && r.A_porte && r.A_salleAtteignable, 'salle incomplète');
    v('le grappin attend derrière l\'énigme', r.A_grappinButin, 'pas de grappin');
    v('POUSSER LA CAISSE SUR LA PLAQUE OUVRE LA PORTE', r.A_porteOuverte, 'porte close');
    v('l\'interrupteur abaisse les blocs bleus',
      r.C_bloc && r.C_inter && r.C_pleinAvant && r.C_abaisseApres && r.C_etatInter,
      `plein=${r.C_pleinAvant} abaisse=${r.C_abaisseApres}`);
    v('l\'interrupteur est réversible', r.C_reversible, 'bascule à sens unique');
    v('LE GOUFFRE EST INFRANCHISSABLE À PIED', r.G_loinBloque && r.G_pretBloque,
      `loin=${r.G_loinBloque} bord=${r.G_pretBloque}`);
    v('LE GRAPPIN TIRE LE HÉROS PAR-DESSUS L\'EAU',
      r.G_grapLance && r.G_grapArrive && r.G_tresorRejoint,
      `lance=${r.G_grapLance} arrive=${r.G_grapArrive} tresor=${r.G_tresorRejoint}`);
    v('LA RIVE LOINTAINE NE SE REFERME PAS SUR LE HÉROS',
      r.G_ancreRetour && r.G_retourLance && r.G_retourArrive && r.G_entreeRejointe,
      `ancre de retour=${r.G_ancreRetour} lance=${r.G_retourLance}`
      + ` revenu=${r.G_retourArrive} entrée=${r.G_entreeRejointe}`);
    v('DEUX PLAQUES : UNE SEULE NE SUFFIT PAS', r.D_deuxPlaques && r.D_uneInsuffisante, 'porte cédée trop tôt');
    v('les deux caisses ensemble ouvrent la porte', r.D_deuxOuvrent, 'porte close');
    v('LE MARTEAU EST UN SLAM, PAS UN COUP D\'ÉPÉE', r.M_slamPasEpee,
      'le marteau déclenche encore l\'animation d\'épée');
    v('le marteau brise la roche noire à l\'impact', r.M_briseRoche, 'roche intacte');
    v('l\'animation du marteau a un temps d\'impact', r.M_dureeSlam, `${r.M_dureeSlam}`);
    const ac = r.apresChargement;
    v('RIEN NE SE PERD AU RECHARGEMENT',
      ac.grappin && ac.inter0 === 1 && ac.tresorGouffre && ac.objetsGrappin
      && ac.caisseSurPlaque && ac.grappinButinRepose, JSON.stringify(ac));
    v('UNE PARTIE DÉJÀ PIÉGÉE SE RATTRAPE AU RECHARGEMENT',
      ac.ancreRetour, "l'ancre de retour manque après chargement");
    v('une partie neuve repart de zéro',
      !r.neuve.grappin && r.neuve.inter0 === 0 && r.neuve.grappinButin && r.neuve.caisseAuDepart,
      JSON.stringify(r.neuve));
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
