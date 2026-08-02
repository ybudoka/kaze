'use strict';
/* CORRECTIFS.md § 21 — les manettes Bluetooth (API Gamepad).

   Une manette appairée n'envoie ni touche ni contact : sans le relevé de
   l'API Gamepad, elle ne fait RIEN. Ce que l'on vérifie ici, c'est le jeu
   réel — le héros bouge, l'épée sort, l'objet change — piloté par une manette
   simulée au seul endroit où le navigateur nous parle d'elle :
   `navigator.getGamepads()` et les deux événements de branchement.

   Les deux pièges qui coûtent le plus cher :
   - interroger l'API à chaque image ALORS QU'IL N'Y A PAS DE MANETTE : chaque
     appel rend un tableau neuf, donc des déchets à chaque image (§ 17) ;
   - relever un bouton sans mémoire de l'image précédente : maintenu, il
     vaudrait cent appuis. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Manettes Bluetooth',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    /* Une manette simulée : on ne remplace que ce que le navigateur fournit,
       jamais un rouage du jeu. */
    await page.evaluate(() => {
      window.__pads = [];
      window.__appels = 0;
      navigator.getGamepads = function () { window.__appels++; return window.__pads; };
      window.__brancher = (nbBoutons = 17, nbAxes = 4, mapping = 'standard') => {
        const p = {
          id: 'Manette de test', index: window.__pads.length, connected: true, mapping,
          axes: new Array(nbAxes).fill(0),
          buttons: Array.from({ length: nbBoutons }, () => ({ pressed: false, value: 0 })),
        };
        window.__pads.push(p);
        dispatchEvent(new Event('gamepadconnected'));
        return p.index;
      };
      window.__debrancher = () => {
        window.__pads = [];
        dispatchEvent(new Event('gamepaddisconnected'));
      };
      window.__b = (i, k, on) => { window.__pads[i].buttons[k] = { pressed: !!on, value: on ? 1 : 0 }; };
      window.__a = (i, k, val) => { window.__pads[i].axes[k] = val; };
      window.__relacher = () => {
        for (const p of window.__pads) {
          for (let k = 0; k < p.buttons.length; k++) p.buttons[k] = { pressed: false, value: 0 };
          for (let k = 0; k < p.axes.length; k++) p.axes[k] = 0;
        }
      };
    });

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};

      /* ---------- 1. Sans manette, l'API n'est pas interrogée ----------
         `getGamepads()` rend un tableau neuf à chaque appel : l'interroger
         sans manette, c'est jeter un objet par image pour rien. */
      const av = window.__appels;
      await dort(320);
      out.appelsSansManette = window.__appels - av;

      /* ---------- terrain dégagé, pour mesurer un déplacement ---------- */
      const cx = Math.floor(J.x / TS), cy = Math.floor(J.y / TS);
      for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 8; x <= cx + 8; x++) {
        putO(x, y, O.RIEN); putE(x, y, 0); putS(x, y, S.HERBE);
      }
      prerendreSol(); pnjs.length = 0; structures.length = 0; ennemis.length = 0;
      const px = J.x, py = J.y;
      const replacer = () => {
        J.x = px; J.y = py; J.z = 0; J.kx = 0; J.ky = 0;
        J.atk = 0; J.spin = 0; J.slam = 0; J.invuln = 9999;
      };

      /* Tient l'entrée pendant `ms`, puis relâche, et rend le déplacement. */
      const bouger = async (poser, ms = 300) => {
        replacer(); await dort(60); replacer();
        poser();
        await dort(ms);
        const d = { dx: J.x - px, dy: J.y - py };
        window.__relacher(); await dort(90);
        return d;
      };

      /* ---------- 2. branchée, elle est relevée ---------- */
      window.__brancher();
      const av2 = window.__appels;
      await dort(200);
      out.appelsAvecManette = window.__appels - av2;
      out.padRange = document.body.classList.contains('sanspad');

      /* ---------- 3. le bouton du bas sort l'épée ----------
         Le coup ne dure que 14 images : le guetter d'un seul coup d'œil, c'est
         le manquer une fois sur deux (et d'autant plus quand la machine peine).
         On échantillonne pendant tout l'appui. */
      replacer();
      window.__b(0, 0, true);
      out.epee = false;
      for (let i = 0; i < 40 && !out.epee; i++) { await dort(8); if (J.atk > 0) out.epee = true; }
      window.__relacher();
      await dort(300);

      /* ---------- 4. maintenu, un bouton vaut UN appui ----------
         L'objet ne doit changer qu'une fois, pas à chaque image. */
      J.objets.length = 0; J.objets.push('arc', 'bombe', 'grappin'); J.objSel = 0;
      let changements = 0, dernier = J.objSel;
      const guet = setInterval(() => {
        if (J.objSel !== dernier) { changements++; dernier = J.objSel; }
      }, 8);
      window.__b(0, 5, true);            // R : objet suivant, maintenu
      await dort(500);
      window.__relacher();
      await dort(120);
      clearInterval(guet);
      out.changementsObjet = changements;
      out.objSel = J.objSel;

      /* ---------- 5. la croix directionnelle déplace le héros ---------- */
      out.croixDroite = await bouger(() => window.__b(0, 15, true));
      out.croixHaut   = await bouger(() => window.__b(0, 12, true));

      /* ---------- 6. le stick dose la vitesse ---------- */
      out.stickDoux = await bouger(() => window.__a(0, 0, .45));
      out.stickFond = await bouger(() => window.__a(0, 0, 1));

      /* ---------- 7. la zone morte ignore la dérive ---------- */
      out.derive = await bouger(() => window.__a(0, 0, .18));

      /* ---------- 8. deux manettes valent une ---------- */
      window.__brancher();
      out.deuxieme = await bouger(() => window.__b(1, 15, true));

      /* ---------- 9. débrancher relâche tout ---------- */
      replacer();
      window.__b(0, 0, true);
      await dort(120);
      out.tenuAvant = BTN.B;
      window.__debrancher();
      await dort(120);
      out.tenuApres = BTN.B;

      /* ---------- 10. manette NON standard : la croix sur l'axe chapeau ----
         Beaucoup de manettes Bluetooth n'annoncent pas « standard » : pas de
         boutons 12-15, la croix arrive sur `axes[9]`. Et un axe inutilisé
         resté à 0 ne doit surtout pas passer pour un « bas » permanent. */
      window.__brancher(12, 10, '');
      out.chapeauZero  = await bouger(() => window.__a(0, 9, 0));
      out.chapeauRepos = await bouger(() => window.__a(0, 9, 1.2857));
      out.chapeauHaut  = await bouger(() => window.__a(0, 9, -1));
      out.chapeauDroite = await bouger(() => window.__a(0, 9, -0.4285));
      out.chapeauBas   = await bouger(() => window.__a(0, 9, 0.1428));

      window.__debrancher();
      return out;
    });

    const dist = d => Math.hypot(d.dx, d.dy);

    v('SANS MANETTE, LE JEU N\'INTERROGE PAS L\'API GAMEPAD',
      r.appelsSansManette === 0,
      `${r.appelsSansManette} appels en ~19 images (un tableau neuf à chaque fois)`);
    v('branchée, elle est relevée à chaque image',
      r.appelsAvecManette > 5, `${r.appelsAvecManette} appels en ~12 images`);
    v('la manette à l\'écran s\'efface quand une vraie se branche',
      r.padRange, 'le pavé tactile occupe encore la moitié de l\'écran');

    v('LE BOUTON DU BAS SORT L\'ÉPÉE', r.epee, 'aucun coup d\'épée');
    v('UN BOUTON MAINTENU VAUT UN APPUI, PAS CENT',
      r.changementsObjet === 1 && r.objSel === 1,
      `${r.changementsObjet} changements d'objet, sélection ${r.objSel}`);

    v('LA CROIX DIRECTIONNELLE DÉPLACE LE HÉROS',
      r.croixDroite.dx > 8 && Math.abs(r.croixDroite.dy) < 4
      && r.croixHaut.dy < -8 && Math.abs(r.croixHaut.dx) < 4,
      `droite ${JSON.stringify(r.croixDroite)} · haut ${JSON.stringify(r.croixHaut)}`);

    v('LE STICK DOSE LA VITESSE (poussé à fond ≫ effleuré)',
      dist(r.stickDoux) > 2 && dist(r.stickFond) > dist(r.stickDoux) * 1.5,
      `doux ${dist(r.stickDoux).toFixed(1)} px, à fond ${dist(r.stickFond).toFixed(1)} px`);
    v('LA ZONE MORTE IGNORE LA DÉRIVE D\'UN STICK USÉ',
      dist(r.derive) < 1, `${dist(r.derive).toFixed(1)} px de dérive`);

    v('une deuxième manette joue aussi', r.deuxieme.dx > 8, JSON.stringify(r.deuxieme));
    v('DÉBRANCHER LA MANETTE RELÂCHE CE QU\'ELLE TENAIT',
      r.tenuAvant === 1 && r.tenuApres === 0,
      `avant ${r.tenuAvant}, après ${r.tenuApres}`);

    v('MANETTE NON STANDARD : LA CROIX EST LUE SUR L\'AXE CHAPEAU',
      r.chapeauHaut.dy < -8 && r.chapeauDroite.dx > 8 && r.chapeauBas.dy > 8,
      `haut ${JSON.stringify(r.chapeauHaut)} · droite ${JSON.stringify(r.chapeauDroite)}`
      + ` · bas ${JSON.stringify(r.chapeauBas)}`);
    v('UN AXE CHAPEAU AU REPOS NE VAUT AUCUNE DIRECTION',
      dist(r.chapeauZero) < 1 && dist(r.chapeauRepos) < 1,
      `à 0 : ${dist(r.chapeauZero).toFixed(1)} px · au repos : ${dist(r.chapeauRepos).toFixed(1)} px`);

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
