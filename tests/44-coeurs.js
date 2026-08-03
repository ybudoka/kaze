'use strict';
/* CORRECTIFS.md § 53 — les cœurs : l'offre, le plafond, et l'ATH.

   Trois défauts mesurés ensemble, parce qu'ils se tiennent :

   1. L'OFFRE était absurde — 21 conteneurs pour 7 places utiles. Six coffres
      dans les deux premières régions suffisaient à plafonner ; après quoi les
      sept trésors d'énigme et les cinq cœurs des gardiens ne faisaient rien.
   2. LE PLAFOND était double — 20 pour tout ce que le monde donne, 24 pour la
      boutique et la perle.
   3. L'ATH ne savait pas dessiner le second plafond : à la largeur interne
      minimale, douze cœurs recouvraient le compteur de rubis.

   Ce qui se mesure ici : on ramasse RÉELLEMENT tout ce que le monde contient,
   on abat RÉELLEMENT les gardiens, et l'on regarde où la jauge s'arrête. Elle
   doit tomber pile sur le plafond — pas un conteneur gaspillé, pas un manquant. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Les cœurs : offre, plafond et ATH',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      out.PVMAX = PVMAX;
      out.depart = J.pvmax;

      /* ---- un coffre soigne, mais n'agrandit plus la jauge ---- */
      {
        const c = coffres.find(x => !x.ouvert);
        J.pvmax = 12; J.pv = 4;
        const av = J.pvmax;
        ouvrirCoffre(c);
        out.coffreJauge = J.pvmax - av;          // doit être 0
        out.coffreSoigne = J.pv === J.pvmax;     // mais il remet à plein
      }

      /* ---- on ramasse TOUT ce que le monde pose ---- */
      J.pvmax = 6; J.pv = 6; J.invuln = 999999;
      let contenants = 0;
      const avaler = () => { let n = 0;
        for (let i = butins.length - 1; i >= 0; i--) if (butins[i].type === 'coeurmax') {
          ramasserButin(butins[i]); butins.splice(i, 1); n++; }
        contenants += n; return n; };
      out.posesDansLeMonde = avaler();
      out.apresLeMonde = J.pvmax;

      /* ---- on abat les six gardiens, et l'on prend ce qu'ils lâchent ---- */
      const GARDIENS = [
        ['coeur', reveillerCoeur], ['yeti', reveillerYeti], ['kraken', reveillerLeviathan],
        ['colosse', reveillerColosse], ['reine', reveillerReine], ['sentinelle', reveillerSentinelle]
      ];
      out.parGardien = {};
      for (const [nom, reveiller] of GARDIENS) {
        boss = null; reveiller();
        if (!boss) { out.parGardien[nom] = 'pas éveillé'; continue; }
        boss.pv = 0;
        await dort(220);                          // la vraie boucle traite la mort
        out.parGardien[nom] = avaler();
      }
      out.apresLesGardiens = J.pvmax;

      /* ---- les deux récompenses de dialogue, jouées pour de vrai ---- */
      /* On ouvre le VRAI dialogue du personnage, puis on le déroule jusqu'au
         bout : c'est la dernière page qui déclenche la récompense (`dial.apres`).
         Se placer devant lui et appuyer sur B ne suffisait pas ici — le héros a
         été téléporté aux quatre coins de la carte par les mesures précédentes. */
      const parlerA = (id) => {
        const p = pnjs.find(x => x.id === id); if (!p) return false;
        dial = null; dialoguePNJ(p);
        if (!dial) return false;
        while (dial) { dial.p++;
          if (dial.p >= dial.pages.length) { const f = dial.apres; dial = null; if (f) f(); } }
        return true;
      };
      // la perle rendue à la doyenne : le cœur de cristal
      const avPerle = J.pvmax;
      Q.perle = true; Q.coeurCristal = false; Q.parleDoyenne = true; J.fragments = 0;
      out.doyenneTrouvee = parlerA('doyenne');
      out.gainPerle = J.pvmax - avPerle;
      // le cabinet de papillons complété
      const avPap = J.pvmax;
      Q.papillonsPris = [1, 1, 1, 1, 1, 1, 1, 1]; Q.papillonsRendus = false;
      Q.naturalisteParle = true; Q.filet = true;
      out.cabinetTrouve = parlerA('naturaliste');
      out.gainPapillons = J.pvmax - avPap;

      out.contenants = contenants;
      out.total = J.pvmax;

      /* ---- le dernier cœur s'achète : c'est ce qui donne un sens au
             « CŒUR SUPPLÉMENTAIRE » de la colporteuse. Il ne doit être ni
             redondant (le monde s'arrête juste en dessous) ni sans fin. ---- */
      {
        const art = articlesItinerants().find(a => a.id === 'coeur');
        out.articleExiste = !!art;
        out.achatPossible = art ? !!art.ok() : false;
        if (art && art.ok()) art.effet();
        out.apresAchat = J.pvmax;
        const art2 = articlesItinerants().find(a => a.id === 'coeur');
        out.rachatRefuse = art2 ? !art2.ok() : false;
      }

      /* ---- rien ne dépasse le plafond : au-delà, le cœur SE DORE ----
         Un conteneur de plus n'est plus perdu — il gagne un cœur doré, qui
         tient deux fois et redevient rouge avant de tomber. */
      J.pvmax = PVMAX; J.dores = 0; J.pv = pvTotal();
      ramasserButin({ x: J.x, y: J.y, z: 0, type: 'coeurmax' });
      out.debordeButin = J.pvmax;                 // le plafond ne bouge pas
      out.premierDore = J.dores;                  // mais un cœur s'est doré
      out.viePlusGrande = J.pv === PVMAX + 2 && pvTotal() === PVMAX + 2;

      /* Un cœur doré encaisse DEUX FOIS, et repasse au rouge entre les deux :
         c'est tout l'objet — on voit venir sa perte. On lit ce que l'ATH
         dessine réellement pour le premier cœur, doré, au fil des dégâts. */
      J.dores = 1; J.pv = pvTotal();
      /* On lit l'état que l'ATH DONNE réellement au premier cœur, en
         interceptant `coeurATH`. Une première version recalculait la règle
         dans le contrôle : casser la règle dans `ath()` laissait donc le
         contrôle vert — il mesurait sa propre copie. */
      const etatCoeur = (i) => {
        let vu = null; const vrai = window.coeurATH; let k = 0;
        window.coeurATH = function (g, x, y, val) { if (k++ === i) vu = val; return vrai(g, x, y, val); };
        ath();
        window.coeurATH = vrai; return vu;
      };
      /* Le cœur doré est le plus À GAUCHE, donc le DERNIER touché : il ne change
         d'aspect qu'une fois toute la jauge vidée jusqu'à lui. Une première
         version retirait un point à une jauge pleine de 42 et lisait le cœur 0 :
         il restait doré, forcément, et le contrôle ne mesurait rien. */
      const suite = [];
      for (const pv of [4, 3, 2, 1, 0]) { J.pv = pv; suite.push(etatCoeur(0)); }
      out.suiteDore = suite;                      // or, rouge, rouge, demi, vide

      // et l'on ne dore pas au-delà du nombre de cœurs
      J.dores = doresMax();
      out.doreMaxRefuse = dorerUnCoeur() === false && J.dores === doresMax();
      J.dores = 0; J.pv = pvTotal();
      return out;
    });

    v('le plafond est unique et nommé', r.PVMAX === 40, `PVMAX=${r.PVMAX}`);
    v('LE COFFRE NE DONNE PLUS DE CŒUR (il soigne encore)',
      r.coffreJauge === 0 && r.coffreSoigne, `jauge +${r.coffreJauge} soigne=${r.coffreSoigne}`);

    v('le monde pose bien ses conteneurs', r.posesDansLeMonde >= 7,
      `${r.posesDansLeMonde} posés`);
    v('CHAQUE GARDIEN LAISSE SON CŒUR',
      Object.values(r.parGardien).every(n => n === 1),
      JSON.stringify(r.parGardien));
    v('les deux récompenses de dialogue tombent',
      r.gainPerle === 4 && r.gainPapillons === 2,
      `perle +${r.gainPerle} papillons +${r.gainPapillons}`);

    /* Le monde s'arrête à UN cœur du plafond, et pas davantage : aucun
       conteneur gaspillé (c'était le défaut : 21 conteneurs pour 7 places),
       et le dernier reste à acheter. */
    v('TOUT RAMASSÉ, LE MONDE DONNE EXACTEMENT UN CŒUR DE MOINS QUE LE PLAFOND',
      r.total === r.PVMAX - 2,
      `${r.total} points pour un plafond de ${r.PVMAX} (${r.contenants} conteneurs ramassés)`);
    v('AUCUN CONTENEUR N\'EST GASPILLÉ', r.total <= r.PVMAX,
      `${r.total} > ${r.PVMAX} : ${(r.total - r.PVMAX) / 2} cœurs perdus`);
    v('LE CŒUR DE LA COLPORTEUSE COMPLÈTE LA JAUGE',
      r.articleExiste && r.achatPossible && r.apresAchat === r.PVMAX,
      `possible=${r.achatPossible} après=${r.apresAchat}`);
    v('rien ne dépasse le plafond', r.debordeButin === r.PVMAX, r.debordeButin);
    v('AU-DELÀ DU PLAFOND, LE CONTENEUR DORE UN CŒUR AU LIEU D\'ÊTRE PERDU',
      r.premierDore === 1 && r.viePlusGrande,
      `dorés=${r.premierDore} vie plus grande=${r.viePlusGrande}`);
    v('UN CŒUR DORÉ REDEVIENT ROUGE AVANT D\'ÊTRE PERDU',
      r.suiteDore.join(',') === '3,2,2,1,0',
      `de 4 à 0 points restants : ${r.suiteDore.join(',')} (3=or, 2=rouge plein)`);
    v('on ne dore pas plus de cœurs qu\'il n\'y en a', r.doreMaxRefuse,
      'la dorure déborde');
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();

    /* ---------- l'ATH tient-il, à pleine jauge, sur tous les écrans ? ---------- */
    for (const [larg, haut] of [[240, 520], [280, 560], [320, 600], [414, 900], [820, 500]]) {
      const p2 = await pageDeJeu(navigateur, { largeur: larg, hauteur: haut });
      await nouvellePartie(p2);
      const m = await p2.evaluate(() => {
        J.pvmax = PVMAX; J.pv = PVMAX;
        /* On intercepte `coeurATH` lui-même : c'est LUI qui place chaque cœur.
           Une première version relevait les `drawImage` de l'ATH et gardait
           ceux dont x < W/2, pour les distinguer des rubis — mais ce filtre
           écartait précisément les cœurs qui DÉBORDENT. Le contrôle restait
           vert quand on supprimait le passage à la ligne. */
        const places = [];
        const vraiCoeur = window.coeurATH;
        window.coeurATH = function (g, x, y, v) { places.push({ x, y }); return vraiCoeur(g, x, y, v); };
        ath();
        window.coeurATH = vraiCoeur;
        const LARG = 8;                                  // largeur dessinée d'un cœur
        const droite = Math.max(...places.map(d => d.x + LARG));
        const bas = Math.max(...places.map(d => d.y + 7));
        return { W, H, hauteurATH: hauteurATH(), rangees: rangeesCoeurs(),
                 nbCoeurs: places.length, borddroit: droite, basCoeurs: bas, rubis: W - 92,
                 basATH: 2 + hauteurATH(), debugY: hauteurATH() + 2,
                 debordeEnBas: 2 + hauteurATH() > H };
      });
      v(`${larg}px : LES CŒURS NE TOUCHENT PAS LES RUBIS (W=${m.W}, ${m.rangees} rangées)`,
        m.borddroit <= m.rubis, `cœurs jusqu'à ${m.borddroit}, rubis à ${m.rubis}`);
      v(`${larg}px : les vingt cœurs sont bien tous dessinés`,
        m.nbCoeurs === 20, `${m.nbCoeurs} cœurs`);
      v(`${larg}px : le cadre de l'ATH contient les cœurs et tient dans l'écran`,
        m.hauteurATH >= 20 && !m.debordeEnBas && m.basCoeurs <= m.basATH,
        `haut=${m.hauteurATH} cœurs jusqu'à ${m.basCoeurs}, cadre finit à ${m.basATH}/${m.H}`);
      v(`${larg}px : le panneau de débug se pose SOUS l'ATH`,
        m.debugY >= m.basATH - 1, `débug à ${m.debugY}, ATH finit à ${m.basATH}`);
      v(`${larg}px : aucune erreur JS`, p2.erreursJS.length === 0, p2.erreursJS[0]);
      await p2.context().close();
    }
  },
};
