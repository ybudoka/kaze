'use strict';
/* CORRECTIFS.md § 57 — la magie, la baguette, et la fée enfin utile.

   La baguette est le seul outil du jeu qui serve DEUX FOIS : c'est une arme à
   distance, et c'est la clé de deux choses qu'aucune lame ne touche — les
   RUNES de la crypte, et les MURS ILLUSOIRES qui cachent son trésor.

   Ce qui se mesure : la fée la donne pour de vrai (dialogue déroulé), le trait
   part et coûte, il frappe là où l'épée ricoche, il allume une rune, il dissipe
   un mur, les quatre runes ouvrent la porte — et l'on vérifie l'inverse à
   chaque fois, sinon « ça marche » ne prouverait rien. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'La magie et la baguette de la fée',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};

      /* ---- 1) AU DÉPART, PAS DE MAGIE ----
         Une jauge visible dès la première minute annoncerait un objet qu'on n'a
         pas encore : c'est le défaut corrigé au § 45 pour les étoiles. */
      out.debut = { magiemax: J.magiemax, baguette: !!Q.baguette,
                    hauteurATH: hauteurATH(), sacContient: J.objets.includes('baguette') };

      /* ---- 2) LA FÉE LA DONNE, une fois l'épée forgée ---- */
      const parlerA = (id) => {
        const p = pnjs.find(x => x.id === id); if (!p) return false;
        dial = null; dialoguePNJ(p);
        if (!dial) return false;
        while (dial) { dial.p++;
          if (dial.p >= dial.pages.length) { const f = dial.apres; dial = null; if (f) f(); } }
        return true;
      };
      Q.epeeLongue = false; Q.lucioles = 0;
      parlerA('fee');
      out.rienSansEpee = !Q.baguette;                 // elle ne la donne pas d'emblée
      Q.epeeLongue = true;
      out.feeParle = parlerA('fee');
      out.apresFee = { baguette: !!Q.baguette, magiemax: J.magiemax, magie: J.magie,
                       equipee: outilDe('Y') === 'baguette' || outilDe('X') === 'baguette' };
      out.athGrandit = hauteurATH() > out.debut.hauteurATH;

      /* ---- 3) LE TRAIT : il part, il coûte, et il s'épuise ---- */
      tirs.length = 0; J.dir = 3; J.magie = 2;
      traitDeMagie();
      out.tirParti = tirs.filter(t => t.magie).length;
      out.coutUnPoint = J.magie === 1;
      traitDeMagie(); J.magie = 0; tirs.length = 0;
      traitDeMagie();
      out.sansMagieRienNePart = tirs.filter(t => t.magie).length === 0;
      J.magie = J.magiemax; tirs.length = 0;

      /* ---- 4) COMME ARME : elle passe là où l'épée ricoche ----
         Le squelette pare les coups d'épée reçus DE FACE. La magie, non. */
      {
        ennemis.length = 0;
        pondre('squel', Math.floor(J.x / TS) + 2, Math.floor(J.y / TS));
        const e = ennemis[0];
        e.x = J.x + 30; e.y = J.y; e.z = J.z; e.dir = 1;   // il regarde vers le héros
        const pv0 = e.pv; e.flash = 0;
        out.epeeRicoche = frapper(e, 2, J.x, J.y, 'epee') === false && e.pv === pv0;
        e.flash = 0;
        out.magiePasse = frapper(e, 3, J.x, J.y, 'magie') === true && e.pv < pv0;
        // mais elle ne remplace pas l'outil d'un gardien cuirassé
        e.type = 'colosse'; e.pv = 8; e.flash = 0;
        out.magieNePerceParLeColosse = frapper(e, 3, J.x, J.y, 'magie') === false;
        ennemis.length = 0;
      }

      /* ---- 5) COMME OUTIL, PREMIER USAGE : LES RUNES ---- */
      Q.runes = 0; Q.cryptOuverte = false;
      for (const [rx, ry] of RUNES_POS) putO(rx, ry, O.RUNE);
      for (const x of CRYPTE_PORTE.x) putO(x, CRYPTE_PORTE.y, O.PORTEP);
      const [r0x, r0y] = RUNES_POS[0];
      out.runePosee = Obj(r0x, r0y) === O.RUNE;
      // l'épée n'y peut rien : on frappe la case, la rune reste éteinte
      J.x = r0x * TS + 8; J.y = (r0y + 1) * TS + 8; J.z = Etg(r0x, r0y) * EH; J.dir = 0;
      zoneDegats(J.x, J.y - 19, 32, 38, 1, 'epee');
      out.epeeNAllumeRien = Obj(r0x, r0y) === O.RUNE && Q.runes === 0;
      // le trait, lui, l'allume
      out.magieAllume = magieTouche(r0x, r0y) && Obj(r0x, r0y) === O.RUNEVIVE && Q.runes === 1;
      // et pas deux fois
      out.pasDeDoublon = magieTouche(r0x, r0y) === false && Q.runes === 1;
      // les trois autres : la porte s'ouvre à la quatrième
      out.porteAvant = Obj(CRYPTE_PORTE.x[0], CRYPTE_PORTE.y) === O.PORTEP;
      for (let i = 1; i < RUNES_POS.length; i++) magieTouche(RUNES_POS[i][0], RUNES_POS[i][1]);
      out.runesFinales = Q.runes;
      out.porteApres = Obj(CRYPTE_PORTE.x[0], CRYPTE_PORTE.y);
      out.crypteOuverte = !!Q.cryptOuverte;

      /* ---- 6) COMME OUTIL, SECOND USAGE : LES MURS ILLUSOIRES ---- */
      const [mx, my] = MURS_ILLUSOIRES[0];
      putO(mx, my, O.MURILL);
      out.murSolide = solide(mx * TS + 8, my * TS + 8, Etg(mx, my) * EH);
      out.murPasseAuMarteau = (() => { const av = Obj(mx, my);
        J.x = mx * TS + 8; J.y = (my + 1) * TS + 8; J.dir = 0; slamMarteau();
        return Obj(mx, my) === av; })();                      // le marteau n'y peut rien
      out.murDissipe = magieTouche(mx, my) && Obj(mx, my) === O.RIEN;
      out.murPlusSolide = !solide(mx * TS + 8, my * TS + 8, Etg(mx, my) * EH);

      /* ---- 7) les éclats de magie refont la jauge ---- */
      J.magie = 0;
      out.eclatDonne = (() => { ramasserButin({ x: J.x, y: J.y, z: 0, type: 'eclatMagie' });
        return J.magie; })();
      J.magie = J.magiemax;
      ramasserButin({ x: J.x, y: J.y, z: 0, type: 'eclatMagie' });
      out.eclatNeDeborde = J.magie === J.magiemax;

      /* ---- 8) rien ne se perd au rechargement ---- */
      Q.runes = 2; J.magie = 5;
      await sauver(true); await dort(250);
      Q.baguette = false; J.magiemax = 0; J.magie = 0; Q.runes = 0;
      await charger(emplacement); await dort(350);
      out.recharge = { baguette: !!Q.baguette, magiemax: J.magiemax, runes: Q.runes,
                       dansLeSac: J.objets.includes('baguette') };
      return out;
    });

    v('AU DÉPART, NI BAGUETTE NI JAUGE',
      r.debut.magiemax === 0 && !r.debut.baguette && !r.debut.sacContient,
      JSON.stringify(r.debut));
    v('la fée ne la donne pas avant d\'avoir forgé la lame',
      r.rienSansEpee, 'donnée trop tôt');
    v('LA FÉE DONNE LA BAGUETTE ET OUVRE LA JAUGE',
      r.feeParle && r.apresFee.baguette && r.apresFee.magiemax === 12
      && r.apresFee.magie === 12 && r.apresFee.equipee, JSON.stringify(r.apresFee));
    v('la jauge apparaît alors dans l\'ATH', r.athGrandit, 'l\'ATH n\'a pas grandi');

    v('LE TRAIT PART ET COÛTE UN POINT',
      r.tirParti === 1 && r.coutUnPoint, `${r.tirParti} tir, coût ok=${r.coutUnPoint}`);
    v('SANS MAGIE, RIEN NE PART', r.sansMagieRienNePart, 'un tir gratuit');

    v('COMME ARME : ELLE PASSE LÀ OÙ L\'ÉPÉE RICOCHE',
      r.epeeRicoche && r.magiePasse,
      `épée parée=${r.epeeRicoche} magie passe=${r.magiePasse}`);
    v('mais elle ne remplace pas l\'outil d\'un gardien cuirassé',
      r.magieNePerceParLeColosse, 'la magie perce le Colosse');

    v('CONTRÔLE À BLANC : L\'ÉPÉE N\'ALLUME AUCUNE RUNE',
      r.runePosee && r.epeeNAllumeRien, 'l\'épée suffit');
    v('COMME OUTIL : LE TRAIT ALLUME UNE RUNE',
      r.magieAllume, 'la rune reste éteinte');
    v('une rune déjà éveillée ne se rallume pas', r.pasDeDoublon, 'comptée deux fois');
    v('LES QUATRE RUNES OUVRENT LA PORTE DE LA CRYPTE',
      r.porteAvant && r.runesFinales === 4 && r.porteApres === 0 && r.crypteOuverte,
      `runes=${r.runesFinales} porte=${r.porteApres} ouverte=${r.crypteOuverte}`);

    v('CONTRÔLE À BLANC : LE MARTEAU NE PEUT RIEN SUR UN MUR ILLUSOIRE',
      r.murSolide && r.murPasseAuMarteau, 'le marteau le brise');
    v('SECOND USAGE : LE TRAIT DISSIPE LE MUR ILLUSOIRE',
      r.murDissipe && r.murPlusSolide,
      `dissipé=${r.murDissipe} traversable=${r.murPlusSolide}`);

    v('un éclat de magie rend deux points, sans déborder',
      r.eclatDonne === 2 && r.eclatNeDeborde, `+${r.eclatDonne}`);
    v('RIEN NE SE PERD AU RECHARGEMENT',
      r.recharge.baguette && r.recharge.magiemax === 12 && r.recharge.runes === 2
      && r.recharge.dansLeSac, JSON.stringify(r.recharge));
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
