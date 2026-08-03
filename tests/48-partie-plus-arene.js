'use strict';
/* CORRECTIFS.md § 64 — la partie+ et l'arène infinie.

   Deux modes ajoutés après la fin du jeu. Ce qui se mesure n'est pas « le
   drapeau change » mais ce qui compte pour le joueur :

   - la PARTIE + garde ce qui s'est GAGNÉ (outils, cœurs, magie, collections
     rendues) et remet à zéro ce qui se REJOUE (gardiens, verrous, coffres).
     Se tromper de côté est la seule vraie façon de la rater : garder les
     gardiens morts la rend vide, effacer les outils en fait une partie neuve ;
   - l'ARÈNE convoque le bestiaire par vagues, compte les points, et ne touche
     à AUCUNE sauvegarde — c'est sa promesse. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'La partie + et l\'arène infinie',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    /* ---------------- LA PARTIE + ---------------- */
    const p = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      out.cycleNeuf = cycle();
      out.multiplesNeutres = [mulPV(), mulDegats()];   // le premier tour ne change rien

      // un héros de fin de partie : tout gagné, tous les gardiens abattus
      Q.baguette = true; J.magiemax = 12; Q.filet = true; Q.papillonsRendus = true;
      Q.perlesRendues = true; Q.fresquesRendues = true; Q.epeeLongue = true;
      J.objets = ['arc', 'bombe', 'marteau', 'boomerang', 'grappin', 'bracelet', 'fanal', 'cape', 'baguette'];
      J.pvmax = 40; J.dores = 2; J.pv = pvTotal();
      for (const d of ['coeurTue', 'yetiTue', 'leviathanTue', 'colosseTue',
                       'reineTue', 'sentinelleTue', 'rongeurTue', 'portailOuvert',
                       'porteOuverte', 'cryptOuverte']) Q[d] = true;
      Q.runes = 4; Q.braises = 3; J.fragments = 3;
      const av = { objets: J.objets.slice(), pvmax: J.pvmax, dores: J.dores,
                   magiemax: J.magiemax, papillons: Q.papillonsRendus,
                   perles: Q.perlesRendues, epee: Q.epeeLongue };

      ouvrirPartiePlus();
      await dort(200);
      out.cycle = cycle();
      out.garde = { objets: J.objets.slice().sort().join(), pvmax: J.pvmax, dores: J.dores,
                    magiemax: J.magiemax, papillons: !!Q.papillonsRendus,
                    perles: !!Q.perlesRendues, epee: !!Q.epeeLongue };
      out.attendu = { objets: av.objets.slice().sort().join(), pvmax: av.pvmax, dores: av.dores,
                      magiemax: av.magiemax, papillons: av.papillons,
                      perles: av.perles, epee: av.epee };
      out.remisAZero = { coeur: !!Q.coeurTue, rongeur: !!Q.rongeurTue,
                         portail: !!Q.portailOuvert, crypte: !!Q.cryptOuverte,
                         runes: Q.runes | 0, braises: Q.braises | 0, pierres: J.fragments | 0 };
      out.enJeu = etat === 'jeu';
      out.viePleine = J.pv === pvTotal();

      // le monde MONTE d'un cran : gardiens et créatures
      out.mult = [+mulPV().toFixed(2), +mulDegats().toFixed(2)];
      boss = null; reveillerCoeur();
      out.pvCoeurPlus = boss ? boss.pvmax : 0;
      out.pvCoeurBase = GARDIENS.coeur.coups * 2;
      boss = null;
      // les dégâts reçus aussi
      J.pvmax = 40; J.pv = 40; J.invuln = 0; Q.amulette = false;
      blesser(2, J.x + 30, J.y, false);
      out.degatsPlus = 40 - J.pv;

      // et le cycle survit au rechargement
      await sauver(true); await dort(250);
      Q.cycle = 0;
      await charger(emplacement); await dort(300);
      out.cycleRecharge = cycle();
      return out;
    });

    v('UNE PREMIÈRE PARTIE N\'EST PAS TOUCHÉE PAR LA FORMULE',
      p.cycleNeuf === 0 && p.multiplesNeutres[0] === 1 && p.multiplesNeutres[1] === 1,
      `cycle ${p.cycleNeuf}, multiplicateurs ${p.multiplesNeutres.join(' / ')}`);
    v('LA PARTIE + GARDE TOUT CE QUI A ÉTÉ GAGNÉ',
      JSON.stringify(p.garde) === JSON.stringify(p.attendu),
      `${JSON.stringify(p.garde)} contre ${JSON.stringify(p.attendu)}`);
    v('ET REMET À ZÉRO TOUT CE QUI SE REJOUE',
      !p.remisAZero.coeur && !p.remisAZero.rongeur && !p.remisAZero.portail
      && !p.remisAZero.crypte && p.remisAZero.runes === 0
      && p.remisAZero.braises === 0 && p.remisAZero.pierres === 0,
      JSON.stringify(p.remisAZero));
    v('elle rend la main au jeu, vie pleine', p.enJeu && p.viePleine,
      `état=${p.enJeu} vie=${p.viePleine}`);
    v('LE MONDE MONTE D\'UN CRAN : LES GARDIENS ONT PLUS DE VIE',
      p.pvCoeurPlus > p.pvCoeurBase,
      `${p.pvCoeurBase} → ${p.pvCoeurPlus} (×${p.mult[0]})`);
    v('et les coups reçus font plus mal', p.degatsPlus > 2,
      `2 → ${p.degatsPlus} (×${p.mult[1]})`);
    v('LE TOUR SURVIT AU RECHARGEMENT', p.cycleRecharge === p.cycle,
      `${p.cycle} → ${p.cycleRecharge}`);
    await page.context().close();

    /* ---------------- L'ARÈNE ---------------- */
    const page2 = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page2);
    const a = await page2.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      // une sauvegarde en place : l'arène ne doit pas y toucher
      Q.coeurTue = true; J.rubis = 555;
      await sauver(true); await dort(250);
      const avant = localStorage.getItem('kaze-partie-' + (emplacement + 1));

      out.dansLeMenu = optionsEcranTitre().some(o => o.id === 'arene');
      ouvrirArene();
      await dort(250);
      out.ouverte = areneEtat.actif && etat === 'jeu';
      out.vague = areneEtat.vague;
      out.creatures = ennemis.length;
      out.outille = ['boomerang', 'bracelet', 'fanal', 'cape', 'baguette']
        .every(o => J.objets.includes(o));
      // l'enclos : on ne s'en échappe pas
      const c = ARENE;
      out.enclos = [[c.x0, c.y0 + 3], [c.x0 + c.w - 1, c.y0 + 3],
                    [c.x0 + 3, c.y0], [c.x0 + 3, c.y0 + c.h - 1]]
        .every(([x, y]) => solide(x * TS + 8, y * TS + 8, 0));
      out.dedans = J.x > c.x0 * TS && J.x < (c.x0 + c.w) * TS;

      /* Le SCORE : on abat une créature par la vraie boucle de combat. */
      areneEtat.score = 0; areneEtat.combo = 0; areneEtat.tues = 0;
      ennemis.length = 0; pondre('gluant', c.x0 + 5, c.y0 + 5);
      const e = ennemis[0]; e.pv = 1; e.flash = 0; J.invuln = 99999;
      frapper(e, 9, e.x - 20, e.y, 'epee');
      for (let k = 0; k < 6 && ennemis.length; k++) majEnnemis();
      out.premierTue = { score: areneEtat.score, tues: areneEtat.tues, combo: areneEtat.combo };
      // un enchaînement vaut plus cher que le premier
      pondre('gluant', c.x0 + 6, c.y0 + 5);
      const e2 = ennemis[0]; e2.pv = 1; e2.flash = 0;
      const s1 = areneEtat.score;
      frapper(e2, 9, e2.x - 20, e2.y, 'epee');
      for (let k = 0; k < 6 && ennemis.length; k++) majEnnemis();
      out.secondTue = areneEtat.score - s1;
      out.premierGain = out.premierTue.score;

      /* Les vagues se durcissent : plus d'espèces, et plus de bêtes. */
      const c1 = compositionVague(1), c10 = compositionVague(10), c25 = compositionVague(25);
      out.tailles = [c1.length, c10.length, c25.length];
      out.especes = [new Set(c1).size, new Set(c10).size, new Set(c25).size];
      out.bestiaire = ARENE_BESTIAIRE.length;

      /* La vague suivante part quand l'arène est vide. */
      ennemis.length = 0; areneEtat.repos = 0;
      const vagueAvant = areneEtat.vague;
      for (let k = 0; k < 200 && areneEtat.vague === vagueAvant; k++) majArene();
      out.vagueSuivante = areneEtat.vague > vagueAvant && ennemis.length > 0;

      /* Mourir termine la manche, garde le record, et ne touche à RIEN. */
      localStorage.removeItem('kaze-arene');
      areneEtat.score = 4242;
      J.invuln = 0; J.pv = 1;
      blesser(99, J.x + 20, J.y, false);
      await dort(150);
      out.finDeManche = !areneEtat.actif && etat === 'titre';
      out.record = parseInt(localStorage.getItem('kaze-arene') || '0', 10);
      out.sauvegardeIntacte = localStorage.getItem('kaze-partie-' + (emplacement + 1)) === avant;
      return out;
    });

    v('L\'ARÈNE S\'OUVRE DEPUIS L\'ÉCRAN-TITRE', a.dansLeMenu, 'absente du menu');
    v('elle démarre sur sa première vague, peuplée',
      a.ouverte && a.vague === 1 && a.creatures > 0,
      `vague ${a.vague}, ${a.creatures} créatures`);
    v('ON Y ENTRE ÉQUIPÉ : SANS LES OUTILS, LA MOITIÉ DU BESTIAIRE EST INTOUCHABLE',
      a.outille, 'sac incomplet');
    v('L\'ENCLOS EST CLOS, ET LE HÉROS DEDANS', a.enclos && a.dedans,
      `murs=${a.enclos} dedans=${a.dedans}`);

    v('ABATTRE UNE CRÉATURE MARQUE DES POINTS',
      a.premierTue.score > 0 && a.premierTue.tues === 1, JSON.stringify(a.premierTue));
    v('ET L\'ENCHAÎNEMENT VAUT PLUS CHER QUE LE PREMIER',
      a.secondTue > a.premierGain, `${a.premierGain} puis ${a.secondTue}`);

    v('LES VAGUES GROSSISSENT, EN NOMBRE ET EN ESPÈCES',
      a.tailles[0] < a.tailles[1] && a.tailles[1] <= a.tailles[2]
      && a.especes[0] <= a.especes[1] && a.especes[1] <= a.especes[2],
      `tailles ${a.tailles.join('/')} espèces ${a.especes.join('/')}`);
    v('tout le bestiaire y passe', a.bestiaire >= 24, `${a.bestiaire} espèces`);
    v('l\'arène vidée, la vague suivante part', a.vagueSuivante, 'plus rien ne vient');

    v('MOURIR TERMINE LA MANCHE ET GARDE LE RECORD',
      a.finDeManche && a.record === 4242, `fin=${a.finDeManche} record=${a.record}`);
    v('L\'ARÈNE NE TOUCHE À AUCUNE SAUVEGARDE',
      a.sauvegardeIntacte, 'la partie a été écrasée');
    v('aucune erreur JS', page2.erreursJS.length === 0, page2.erreursJS[0]);
    await page2.context().close();
  },
};
