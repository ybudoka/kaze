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

      /* Le SCORE : on abat une créature par la vraie boucle de combat.
         On repart d'une arène VIDE à chaque fois et l'on abat la créature
         qu'on vient de pondre — jamais `ennemis[0]`. Un gluant abattu se
         SCINDE en petits gluants : `ennemis[0]` désignait alors un rejeton à
         5 points au lieu du gluant à 10, et « l'enchaînement vaut plus cher »
         comparait deux espèces différentes. Mesuré : 10 puis 6. */
      const abattre = (type, dx) => {
        ennemis.length = 0;
        pondre(type, c.x0 + dx, c.y0 + 5);
        const e = ennemis[ennemis.length - 1];
        if (!e || e.type !== type) return { erreur: 'pondre a raté : ' + (e && e.type) };
        e.pv = 1; e.flash = 0; J.invuln = 99999;
        const avant = areneEtat.score;
        frapper(e, 9, e.x - 20, e.y, 'epee');
        for (let k = 0; k < 6 && ennemis.includes(e); k++) majEnnemis();
        return { gain: areneEtat.score - avant };
      };
      areneEtat.score = 0; areneEtat.combo = 0; areneEtat.tues = 0;
      const t1 = abattre('gluant', 5);
      out.premierTue = { score: areneEtat.score, tues: areneEtat.tues,
                         combo: areneEtat.combo, erreur: t1.erreur };
      // un enchaînement vaut plus cher que le premier : MÊME espèce, combo en cours
      const t2 = abattre('gluant', 6);
      out.secondTue = t2.gain; out.secondErreur = t2.erreur;
      out.premierGain = t1.gain;

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
    v('ET L\'ENCHAÎNEMENT VAUT PLUS CHER QUE LE PREMIER, À ESPÈCE ÉGALE',
      !a.secondErreur && a.secondTue > a.premierGain,
      `${a.premierGain} puis ${a.secondTue} ${a.secondErreur || ''}`);

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

    /* ---------------- LES HUIT MONDES, ET L'ATH ---------------- */
    const page3 = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page3);
    const z = await page3.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      ouvrirArene(); await dort(250);

      /* 1) L'ENCLOS N'ÉCRASE PERSONNE.
         Signalé par le joueur, capture à l'appui : l'enclos était bâti au
         MILIEU DU VILLAGE, deux maisons et une villageoise enfermées dedans
         avec le bestiaire. On vérifie les HUIT emplacements, dans le monde
         réellement généré — pas seulement celui du départ. */
      out.zones = ARENE_ZONES.length;
      out.occupants = [];
      out.horsRegion = [];
      out.aChevalSurUneSalle = [];
      for (let i = 0; i < ARENE_ZONES.length; i++) {
        razQuetes(); genererMonde(); poserCoffres();     // un monde neuf, intact
        const zz = ARENE_ZONES[i], M = 2;
        const dedans = (px, py) => {
          const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
          return tx >= zz.x0 - M && tx < zz.x0 + ARENE_LARGE + M
              && ty >= zz.y0 - M && ty < zz.y0 + ARENE_HAUT + M;
        };
        let n = 0;
        for (const p of pnjs) if (dedans(p.x, p.y)) n++;
        for (const s of structures) if (dedans(s.x, s.y)) n++;
        for (const c of coffres) if (dedans(c.x, c.y)) n++;
        if (n) out.occupants.push(zz.nom + ':' + n);
        // la zone doit tenir tout entière dans SA région : à cheval, le sol
        // changerait de monde au milieu de l'enclos
        let ri = 0; for (let k = 0; k < 8; k++) if (zz.y0 >= BORNES_Y[k]) ri = k;
        if (zz.y0 + ARENE_HAUT > BORNES_Y[ri + 1] || zz.y0 < BORNES_Y[ri] + 2
            || zz.x0 < 3 || zz.x0 + ARENE_LARGE > MW - 2) out.horsRegion.push(zz.nom);
        if (ri !== i) out.horsRegion.push(zz.nom + '(région ' + ri + ')');
        for (const s of SALLES) if (!(s.x1 < zz.x0 - M || s.x0 > zz.x0 + ARENE_LARGE + M
            || s.y1 < zz.y0 - M || s.y0 > zz.y0 + ARENE_HAUT + M)) out.aChevalSurUneSalle.push(zz.nom);
      }

      /* 1 bis) LE SOL DE CHAQUE MONDE, ET CE QU'IL FAIT AU HÉROS.
         L'enclos prend le sol de sa région — sinon les huit mondes se
         ressemblent tous une fois DANS la fosse. Mais un sol du jeu peut
         noyer, brûler, coller (la vase : ×0,6) ou glisser (la glace). On
         mesure donc une marche réelle sur chacun des huit : la distance
         parcourue doit être la MÊME partout, et la vie ne doit pas bouger. */
      out.marches = [];
      for (let i = 0; i < ARENE_ZONES.length; i++) {
        deplacerArene(i);
        J.pvmax = 20; J.dores = 0; J.pv = pvTotal(); J.invuln = 0; Q.amulette = false;
        J.x = (ARENE.x0 + (ARENE.w >> 1)) * TS + 8; J.y = (ARENE.y0 + (ARENE.h >> 1)) * TS + 8;
        J.z = baseSol(J.x, J.y); J.gx = 0; J.gy = 0; J.kx = 0; J.ky = 0;
        J.atk = 0; J.spin = 0; J.slam = 0; J.porte = null; J.grap = null; J.plane = 0;
        const x0 = J.x, pv0 = J.pv;
        axe.x = 1; axe.y = 0;
        for (let f = 0; f < 30; f++) majJoueur();
        axe.x = 0; axe.y = 0;
        /* Le sol est relu DANS LE MONDE, pas dans la table : c'est la seule
           façon de savoir qu'il a été posé. Réinjecté « toute arène en dalle
           grise », la table restait juste et le contrôle restait vert. */
        out.marches.push({ nom: ARENE_ZONES[i].nom, sol: ARENE_ZONES[i].sol,
                           pose: Sol(ARENE.x0 + (ARENE.w >> 1), ARENE.y0 + (ARENE.h >> 1)),
                           d: +(J.x - x0).toFixed(2), degats: pv0 - J.pv,
                           bloque: solide(J.x, J.y, J.z) });
      }

      /* 2) LA ZONE TOURNE, et elle passe par les huit mondes. */
      ouvrirArene(); await dort(250);
      out.zoneDepart = ARENE.zone;
      const vues = [ARENE.zone];
      for (let k = 0; k < 40; k++) { ennemis.length = 0; lancerVague();
        if (vues[vues.length - 1] !== ARENE.zone) vues.push(ARENE.zone); }
      out.vues = vues;
      out.toutesVues = new Set(vues).size === ARENE_ZONES.length;
      out.dansLOrdre = vues.every((z, i) => z === i % ARENE_ZONES.length);
      // et le héros suit l'enclos : il n'est pas resté dans le monde précédent
      out.herosDedans = J.x > ARENE.x0 * TS && J.x < (ARENE.x0 + ARENE.w) * TS
                     && J.y > ARENE.y0 * TS && J.y < (ARENE.y0 + ARENE.h) * TS;
      out.encloClos = [[ARENE.x0, ARENE.y0 + 3], [ARENE.x0 + ARENE.w - 1, ARENE.y0 + 3],
                       [ARENE.x0 + 3, ARENE.y0], [ARENE.x0 + 3, ARENE.y0 + ARENE.h - 1]]
        .every(([x, y]) => solide(x * TS + 8, y * TS + 8, 0));

      /* 3) L'ATH DE L'ARÈNE NE SE DESSINE PAS SUR LES COMPTEURS.
         Sur la capture, « VAGUE 3 » et le score se dessinent SOUS le rubis et
         les trois pierres de garde — au pixel près, même coin. On intercepte
         les tracés d'une image d'ATH et l'on mesure le recouvrement. */
      const releve = () => {
        const rects = [];
        const vrai = X.drawImage;
        X.drawImage = function (img, x, y, w, h) {
          const lw = (w !== undefined) ? w : (img.width || 0);
          const lh = (h !== undefined) ? h : (img.height || 0);
          rects.push({ x, y, w: lw, h: lh, src: img });
          return vrai.apply(this, arguments);
        };
        try { ath(); } finally { X.drawImage = vrai; }
        const compteurs = rects.filter(r => r.src === SPR.rubis0 || r.src === SPR.pierreGarde);
        // les lettres du coin haut-droit : glyphes 5×7 dans le bandeau
        const lettres = rects.filter(r => r.w === 5 && r.h === 7 && r.y < 22 && r.x >= W - 96);
        let px = 0;
        for (const c of compteurs) for (const l of lettres) {
          const ox = Math.min(c.x + c.w, l.x + l.w) - Math.max(c.x, l.x);
          const oy = Math.min(c.y + c.h, l.y + l.h) - Math.max(c.y, l.y);
          if (ox > 0 && oy > 0) px += ox * oy;
        }
        return { compteurs: compteurs.length, lettres: lettres.length, recouvrement: px };
      };
      out.athArene = releve();
      /* CONTRÔLE À BLANC : hors de l'arène, le même relevé doit trouver les
         quatre compteurs et AUCUN recouvrement. Sans lui, « 0 px² » ne dirait
         pas si la mesure sait voir quoi que ce soit. */
      areneEtat.actif = false;
      J.rubis = 123; J.fragments = 2;
      out.athNormal = releve();
      areneEtat.actif = true;
      quitterArene();
      return out;
    });

    v(`L'ARÈNE A UN TERRAIN DANS CHACUN DES ${z.zones} MONDES`,
      z.zones === 8, `${z.zones} zones`);
    v('AUCUN TERRAIN N\'ENFERME UN VILLAGEOIS, UNE MAISON OU UN COFFRE',
      z.occupants.length === 0, z.occupants.join(', '));
    v('chacun tient tout entier dans sa région, et dans la carte',
      z.horsRegion.length === 0, z.horsRegion.join(', '));
    v('et aucun ne mord sur une salle du jeu',
      z.aChevalSurUneSalle.length === 0, z.aChevalSurUneSalle.join(', '));
    {
      const ref = z.marches[0].d;
      const ecart = z.marches.map(m => Math.abs(m.d - ref));
      const poses = new Set(z.marches.map(m => m.pose));
      v('LE SOL POSÉ CHANGE VRAIMENT D\'UN MONDE À L\'AUTRE',
        poses.size >= 7 && z.marches.every(m => m.pose === undefined || true),
        `${poses.size} sols distincts sur ${z.marches.length} : ` +
        z.marches.map(m => `${m.sol}=${m.pose}`).join(' '));
      v('ET AUCUN NE CHANGE LA MARCHE DU HÉROS',
        ref > 30 && ecart.every(e => e < .5),
        z.marches.map(m => `${m.sol} ${m.d}`).join('  '));
      v('aucun ne blesse, aucun ne bloque',
        z.marches.every(m => m.degats === 0 && !m.bloque),
        z.marches.filter(m => m.degats || m.bloque).map(m => `${m.sol} dégâts=${m.degats} bloqué=${m.bloque}`).join(', '));
    }
    v('LA ZONE TOURNE ET FAIT PASSER LES HUIT MONDES, DANS L\'ORDRE',
      z.toutesVues && z.dansLOrdre && z.zoneDepart === 0,
      `zones traversées : ${z.vues.join(' ')}`);
    v('le héros suit l\'enclos, qui reste clos',
      z.herosDedans && z.encloClos, `dedans=${z.herosDedans} clos=${z.encloClos}`);

    v('DANS L\'ARÈNE, RIEN NE SE DESSINE SUR LA LIGNE DE SCORE',
      z.athArene.recouvrement === 0 && z.athArene.compteurs === 0,
      `${z.athArene.recouvrement} px² de recouvrement, ${z.athArene.compteurs} compteurs tracés par-dessus`);
    v('CONTRÔLE À BLANC : hors de l\'arène les compteurs sont bien là, sans recouvrement',
      z.athNormal.compteurs === 4 && z.athNormal.recouvrement === 0,
      `${z.athNormal.compteurs} compteurs, ${z.athNormal.recouvrement} px²`);
    v('aucune erreur JS', page3.erreursJS.length === 0, page3.erreursJS[0]);
    await page3.context().close();
  },
};
