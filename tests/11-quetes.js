'use strict';
/* Les deux quêtes annexes ajoutées après les Terres de Cendre :

   « LA LANTERNE DU PÊCHEUR » — une chaîne qui traverse les deux régions :
     pêcheur -> clairière aux pins -> pêcheur -> Durn -> golems -> épée de Cendre.
   « LES BRASIERS ÉTEINTS » — trois brasiers des Cendres, rallumés à l'épée.

   Ce qu'on vérifie n'est pas « le drapeau change » mais « le joueur peut
   réellement finir » : l'objet existe dans le monde, on peut l'atteindre en
   marchant, la récompense se voit, et rien ne se perd au rechargement. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Quêtes annexes',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};

      /* ---------- le décor de quête existe vraiment ---------- */
      out.lanterneEnPlace = Obj(LANTERNE_POS[0], LANTERNE_POS[1]) === O.LANTERNE;
      out.brasiersEnPlace = BRASIERS_POS.filter(([x, y]) => Obj(x, y) === O.BRASIER).length;
      out.brasiersDansLesCendres = BRASIERS_POS.every(([, y]) => y >= Y_CENDRE);
      out.durn = pnjs.filter(p => p.id === 'forgeron').length;
      out.durnHorsSalle = !salleDe(FORGERON_POS[0] * TS + 8, FORGERON_POS[1] * TS + 8);

      /* Aucun objet de quête ne doit être noyé dans la lave ni cerné par les
         obstacles : on regarde la clairière autour de chacun. */
      const degage = (cx, cy) => {
        let n = 0;
        for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
          if (x === cx && y === cy) continue;
          const o = Obj(x, y), s = Sol(x, y);
          if (s === S.LAVE || s === S.EAU || (o && DUR_O[o] && !FRANCH_O[o])) n++;
        }
        return n;
      };
      out.obstaclesLanterne = degage(LANTERNE_POS[0], LANTERNE_POS[1]);
      out.obstaclesBrasiers = BRASIERS_POS.map(([x, y]) => degage(x, y));
      out.obstaclesDurn = degage(FORGERON_POS[0], FORGERON_POS[1]);

      /* ---------- atteignables en marchant, avec les vraies collisions ---------- */
      const joignable = (sx, sy) => {
        const passable = (x, y) => {
          if (!dansCarte(x, y)) return false;
          const s = Sol(x, y);
          if (s === S.EAU || s === S.LAVE) return false;
          if (s === S.BRAISE && !Q.bottes) return false;   // ça brûle sans les bottes
          const o = Obj(x, y);
          if (o === O.PORTAIL) return !!Q.portailOuvert;
          if (o === O.ROCNOIR) return false;
          if (o && DUR_O[o] && !FRANCH_O[o]) return false;
          return true;
        };
        const lien = (ax, ay, bx, by) => Etg(bx, by) <= Etg(ax, ay)
          || Sol(bx, by) === S.RAMPE || Sol(ax, ay) === S.RAMPE;
        const vus = new Uint8Array(MW * MH), f = [[sx, sy]];
        vus[sy * MW + sx] = 1;
        while (f.length) {
          const [x, y] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx] || !passable(nx, ny) || !lien(x, y, nx, ny)) continue;
            vus[ny * MW + nx] = 1; f.push([nx, ny]);
          }
        }
        return vus;
      };
      /* Un objet de quête n'est jamais « passable » (le brasier est dur) : on
         demande donc qu'une de ses quatre cases voisines soit atteinte, c'est
         de là qu'on le frappe. */
      const accostable = (vus, [x, y]) =>
        [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
          dansCarte(x + dx, y + dy) && !!vus[(y + dy) * MW + x + dx]);

      // depuis le village, sans rien avoir débloqué
      {
        const a = joignable(35, 45);
        out.lanterneAtteignable = accostable(a, LANTERNE_POS);
        out.contreEpreuve = accostable(a, [1, 1]);     // hors carte utile : doit être faux
      }

      /* ---------- la chaîne du pêcheur, étape par étape ---------- */
      const pecheur = pnjs.find(p => p.id === 'pecheur');
      const durn = pnjs.find(p => p.id === 'forgeron');
      const causer = p => { dial = null; dialoguePNJ(p); const d = dial; dial = null; return d; };
      const finir = d => { if (d && d.apres) d.apres(); };

      // avant la tarte, le pêcheur ne parle pas encore de sa lanterne
      out.avantTarte = causer(pecheur).pages.join(' ');
      Q.tarte = false; Q.perle = false; Q.coeurCristal = true;   // chaîne de la tarte finie
      const d1 = causer(pecheur);
      out.offreLanterne = d1.pages.join(' ');
      finir(d1);
      out.etape1 = Q.lanterne;

      // ramassage : on se met dessus et on laisse la boucle de jeu faire
      J.x = LANTERNE_POS[0] * TS + 8; J.y = LANTERNE_POS[1] * TS + 8; J.z = 0; J.invuln = 9999;
      await dort(200);
      out.etape2 = Q.lanterne;
      out.tuileVidee = Obj(LANTERNE_POS[0], LANTERNE_POS[1]) === O.RIEN;
      /* La lanterne éclaire tant qu'elle est au sol ; une fois prise, plus rien.
         On compare la tuile exacte, pas la colonne : les deux torches de la
         clairière suffiraient sinon à faire échouer le contrôle pour rien. */
      out.plusDeLumiereLanterne = !torches.some(t =>
        Math.floor(t.x / TS) === LANTERNE_POS[0]
        && Math.abs(t.y / TS - LANTERNE_POS[1]) < 1.5);

      // on la rapporte
      const rubisAvant = J.rubis;
      const d2 = causer(pecheur); finir(d2);
      out.etape3 = Q.lanterne;
      out.paiePecheur = J.rubis - rubisAvant;

      /* ---------- Durn : trois éclats d'obsidienne ---------- */
      out.durnDemande = causer(durn).pages.join(' ');
      // un éclat ne tombe que d'un golem, et pas plus de trois à la fois
      const tuer = (type, n) => {
        butins.length = 0;
        let eclats = 0;
        for (let i = 0; i < n; i++) {
          ennemis.length = 0;
          ennemis.push({ type, x: J.x + 40, y: J.y, z: 0, vz: 0, r: 9, dir: 2, pv: 0, pvmax: 1,
                         t: 0, cd: 0, flash: 0, kx: 0, ky: 0, hx: 0, hy: 0, anim: 0, stun: 0 });
          majEnnemis();
          eclats = butins.filter(b => b.type === 'eclat').length;
        }
        return eclats;
      };
      out.eclatsGolems = tuer('golem', 6);        // 6 golems -> au plus 3 éclats
      Q.eclats = 0; butins.length = 0;
      out.eclatsSpectres = tuer('spectre', 6);    // aucun autre monstre n'en porte

      // on les ramasse pour de vrai
      butins.length = 0; Q.eclats = 0;
      for (let i = 0; i < 3; i++) {
        butins.push({ x: J.x, y: J.y, z: J.z, vz: 0, type: 'eclat', t: 0 });
        await dort(60);
      }
      out.eclatsRamasses = Q.eclats;

      // et le golem cesse d'en lâcher une fois le compte fait
      butins.length = 0;
      out.plusDEclats = tuer('golem', 4) === 0;

      /* ---------- la récompense : l'épée de Cendre frappe plus fort ---------- */
      /* On passe par la vraie boucle du héros, pas par un appel direct à
         zoneDegats avec un dégât calculé ici : sinon le test mesurerait sa
         propre arithmétique et resterait vert même si l'épée de Cendre
         n'ajoutait plus rien. J.atk=13 ne laisse passer qu'une seule frappe. */
      const degatsEpee = () => {
        ennemis.length = 0; butins.length = 0;
        const e = { type: 'braise', x: J.x + 20, y: J.y, z: J.z, vz: 0, r: 6, dir: 2,
                    pv: 99, pvmax: 99, t: 0, cd: 0, flash: 0, kx: 0, ky: 0, hx: 0, hy: 0,
                    anim: 0, stun: 0 };
        ennemis.push(e);
        J.dir = 3; J.spin = 0; J.atk = 13;
        majJoueur();
        J.atk = 0;
        const perdu = 99 - e.pv;
        ennemis.length = 0;
        return perdu;
      };
      Q.epeeLongue = false;
      out.degatsAvant = degatsEpee();
      const d3 = causer(durn); finir(d3);
      out.epeeCendre = !!Q.epeeCendre;
      out.eclatsConsommes = Q.eclats;
      out.degatsApres = degatsEpee();
      // et l'épée longue s'y ajoute au lieu de s'y substituer
      Q.epeeLongue = true; out.degatsLongue = degatsEpee(); Q.epeeLongue = false;
      /* Les brasiers ne s'affichent au journal qu'une fois le portail ouvert :
         avant d'avoir vu les Cendres, on n'a pas à en entendre parler. */
      out.journalAvantPortail = JSON.stringify(lignesJournal());

      /* ---------- les brasiers ---------- */
      Q.portailOuvert = true;
      // le journal doit dire les deux quêtes, sinon rien ne prouve qu'on les a
      out.journal = JSON.stringify(lignesJournal());
      // ils sont atteignables une fois dans les Cendres
      {
        const g = CENDRE.gorge, a = joignable((g.x0 + g.x1) >> 1, Y_CENDRE + 2);
        out.brasiersAtteignables = BRASIERS_POS.filter(p => accostable(a, p)).length;
        out.durnAtteignable = accostable(a, FORGERON_POS);
      }
      // on les rallume à l'épée, depuis la case d'à côté
      Q.brasiers = 0;
      const rubisB = J.rubis;
      for (const [bx, by] of BRASIERS_POS) {
        J.x = bx * TS + 8; J.y = (by + 1) * TS + 8; J.z = Etg(bx, by) * EH; J.dir = 0;
        zoneDegats(J.x, J.y - 19, 32, 38, 1, 'epee');
      }
      out.brasiersAllumes = Q.brasiers;
      out.tuilesEnFeu = BRASIERS_POS.filter(([x, y]) => Obj(x, y) === O.BRASIERVIF).length;
      out.primeBrasiers = J.rubis - rubisB;
      // frapper un brasier déjà allumé ne doit ni recompter ni repayer
      const rubisAvantRepasse = J.rubis;
      for (const [bx, by] of BRASIERS_POS) {
        J.x = bx * TS + 8; J.y = (by + 1) * TS + 8; J.z = Etg(bx, by) * EH;
        zoneDegats(J.x, J.y - 19, 32, 38, 1, 'epee');
      }
      out.pasDeDoublon = Q.brasiers === 3 && J.rubis === rubisAvantRepasse;
      // ils éclairent réellement
      out.brasiersEclairent = BRASIERS_POS.every(([x, y]) =>
        torches.some(t => Math.floor(t.x / TS) === x && Math.abs(t.y / TS - y) < 2));
      // la carte des Cendres est révélée
      out.cendresRevelees = (() => { let n = 0;
        for (let y = Y_CENDRE; y < MH; y++) for (let x = 0; x < MW; x++) if (!vu[y * MW + x]) n++;
        return n; })();
      out.durnRemercie = causer(durn).pages.join(' ');

      /* ---------- rien ne se perd au rechargement ---------- */
      await sauver(true); await dort(250);
      await charger(0); await dort(450);
      out.apresChargement = { lanterne: Q.lanterne, epee: !!Q.epeeCendre, brasiers: Q.brasiers,
        tuiles: BRASIERS_POS.filter(([x, y]) => Obj(x, y) === O.BRASIERVIF).length,
        lanterneTuile: Obj(LANTERNE_POS[0], LANTERNE_POS[1]) === O.RIEN,
        lumiere: BRASIERS_POS.every(([x, y]) =>
          torches.some(t => Math.floor(t.x / TS) === x && Math.abs(t.y / TS - y) < 2)) };

      /* ---------- une partie neuve repart de zéro ---------- */
      nouvellePartie('NEUVE', 1); await dort(350);
      out.neuve = { lanterne: Q.lanterne, eclats: Q.eclats, epee: !!Q.epeeCendre,
        brasiers: Q.brasiers,
        tuileLanterne: Obj(LANTERNE_POS[0], LANTERNE_POS[1]) === O.LANTERNE,
        tuilesBrasiers: BRASIERS_POS.filter(([x, y]) => Obj(x, y) === O.BRASIER).length };

      /* Trouver la lanterne AVANT d'en avoir entendu parler ne doit pas mener
         à une impasse : la clairière est en plein bois du nord, on peut très
         bien tomber dessus le premier jour. */
      {
        razQuetes(); Q.lanterne = 2; J.rubis = 0;
        const d = causer(pnjs.find(p => p.id === 'pecheur'));
        out.trouveeAvantLaQuete = d.pages.join(' ');
        finir(d);
        out.rattrapage = { etape: Q.lanterne, rubis: J.rubis };
      }

      /* ---------- aucun texte imprononçable par la police du jeu ---------- */
      {
        const p = pnjs.find(x => x.id === 'forgeron');
        const pe = pnjs.find(x => x.id === 'pecheur');
        const textes = [];
        for (const etats of [
          { lanterne: 0, coeurCristal: true }, { lanterne: 1 }, { lanterne: 2 },
          { lanterne: 3, eclats: 0 }, { lanterne: 3, eclats: 3 },
          { lanterne: 3, epeeCendre: true, brasiers: 3 }]) {
          Object.assign(Q, etats);
          for (const qui of [p, pe]) { dial = null; dialoguePNJ(qui); if (dial) textes.push(...dial.pages); }
        }
        dial = null;
        textes.push(...lignesJournal().map(l => l[0]));
        /* On interroge la table des glyphes, pas `largeurTexte()` : celle-ci
           renvoie `longueur*6-1`, donc jamais 0 pour un caractère — le
           contrôle passait quoi qu'on lui donne. Un caractère absent de la
           table est dessiné en « ? ». */
        out.illisibles = [...new Set(textes.join(' '))]
          .filter(c => c !== ' ' && c !== '\n' && !GLYPHES[c]);
      }
      return out;
    });

    v('la lanterne est posée dans le monde', r.lanterneEnPlace, 'absente');
    v('les trois brasiers sont posés', r.brasiersEnPlace === 3, r.brasiersEnPlace);
    v('les brasiers sont bien dans les Cendres', r.brasiersDansLesCendres, 'un est dans la vallée');
    v('Durn le forgeron existe et se voit du dehors',
      r.durn === 1 && r.durnHorsSalle, `${r.durn} pnj / hors salle=${r.durnHorsSalle}`);
    v('LA LANTERNE EST DANS UNE VRAIE CLAIRIÈRE',
      r.obstaclesLanterne === 0, `${r.obstaclesLanterne} obstacles collés`);
    v('CHAQUE BRASIER EST DÉGAGÉ',
      r.obstaclesBrasiers.every(n => n === 0), JSON.stringify(r.obstaclesBrasiers));
    v('l\'atelier de Durn est dégagé', r.obstaclesDurn === 0, r.obstaclesDurn);
    v('ON ATTEINT LA LANTERNE EN MARCHANT DEPUIS LE VILLAGE',
      r.lanterneAtteignable, 'injoignable à pied');
    v('le parcours refuse bien un point hors du monde', !r.contreEpreuve, 'il accepte tout');

    v('le pêcheur ne parle de sa lanterne qu\'après la tarte',
      !/LANTERNE/.test(r.avantTarte), r.avantTarte.slice(0, 70));
    v('il la confie ensuite', /LANTERNE/.test(r.offreLanterne) && r.etape1 === 1,
      `${r.etape1} — ${r.offreLanterne.slice(0, 70)}`);
    v('MARCHER DESSUS LA RAMASSE', r.etape2 === 2 && r.tuileVidee,
      `étape=${r.etape2} tuile vidée=${r.tuileVidee}`);
    v('la lumière de la lanterne disparaît avec elle', r.plusDeLumiereLanterne, 'elle éclaire encore');
    v('la rapporter paie et envoie chez Durn',
      r.etape3 === 3 && r.paiePecheur === 40, `étape=${r.etape3} rubis=${r.paiePecheur}`);
    v('Durn demande trois éclats d\'obsidienne',
      /OBSIDIENNE/.test(r.durnDemande) && /GOLEM/.test(r.durnDemande), r.durnDemande.slice(0, 90));
    v('SEULS LES GOLEMS EN LÂCHENT, ET JAMAIS PLUS DE TROIS',
      r.eclatsGolems === 3 && r.eclatsSpectres === 0,
      `golems=${r.eclatsGolems} spectres=${r.eclatsSpectres}`);
    v('on les ramasse et ils comptent', r.eclatsRamasses === 3, r.eclatsRamasses);
    v('le compte fait, les golems n\'en lâchent plus', r.plusDEclats, 'ils en lâchent encore');
    v('l\'épée de Cendre est forgée et consomme les éclats',
      r.epeeCendre && r.eclatsConsommes === 0, `épée=${r.epeeCendre} reste=${r.eclatsConsommes}`);
    v('L\'ÉPÉE DE CENDRE FRAPPE PLUS FORT',
      r.degatsApres === r.degatsAvant + 1, `${r.degatsAvant} -> ${r.degatsApres}`);
    v('elle s\'ajoute à l\'épée longue au lieu de la remplacer',
      r.degatsLongue === r.degatsApres + 1, `${r.degatsApres} / longue ${r.degatsLongue}`);
    v('le journal annonce les deux quêtes',
      /LANTERNE DU P/.test(r.journal) && /BRASIERS/.test(r.journal) && /DE CENDRE/.test(r.journal),
      r.journal.slice(0, 160));
    v('les brasiers restent tus avant d\'avoir vu les Cendres',
      !/BRASIERS/.test(r.journalAvantPortail), 'annoncés trop tôt');

    v('les trois brasiers sont atteignables depuis le défilé',
      r.brasiersAtteignables === 3, `${r.brasiersAtteignables}/3`);
    v('Durn est atteignable depuis le défilé', r.durnAtteignable, 'injoignable');
    v('UN COUP D\'ÉPÉE RALLUME UN BRASIER',
      r.brasiersAllumes === 3 && r.tuilesEnFeu === 3,
      `compte=${r.brasiersAllumes} tuiles=${r.tuilesEnFeu}`);
    v('un brasier déjà allumé ne se recompte ni ne repaie', r.pasDeDoublon, 'compté deux fois');
    v('les trois feux paient 120 rubis', r.primeBrasiers === 120, r.primeBrasiers);
    v('LES BRASIERS RALLUMÉS ÉCLAIRENT VRAIMENT', r.brasiersEclairent, 'aucune lumière ajoutée');
    v('les trois feux révèlent la carte des Cendres',
      r.cendresRevelees === 0, `${r.cendresRevelees} tuiles encore dans le noir`);
    v('Durn remercie ensuite', /MERCI/.test(r.durnRemercie), r.durnRemercie.slice(0, 80));

    v('RIEN NE SE PERD AU RECHARGEMENT',
      r.apresChargement.lanterne === 3 && r.apresChargement.epee
      && r.apresChargement.brasiers === 3 && r.apresChargement.tuiles === 3
      && r.apresChargement.lanterneTuile,
      JSON.stringify(r.apresChargement));
    v('et les brasiers rechargés éclairent encore',
      r.apresChargement.lumiere, 'la lumière est perdue au chargement');
    v('une partie neuve repart de zéro',
      r.neuve.lanterne === 0 && r.neuve.eclats === 0 && !r.neuve.epee && r.neuve.brasiers === 0
      && r.neuve.tuileLanterne && r.neuve.tuilesBrasiers === 3,
      JSON.stringify(r.neuve));
    v('LA TROUVER AVANT LA QUÊTE NE MÈNE PAS À UNE IMPASSE',
      r.rattrapage.etape === 3 && r.rattrapage.rubis === 40,
      `${JSON.stringify(r.rattrapage)} — ${r.trouveeAvantLaQuete.slice(0, 60)}`);
    v('aucun caractère que la police ne sait dessiner',
      r.illisibles.length === 0, r.illisibles.join(''));
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
