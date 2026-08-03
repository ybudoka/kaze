'use strict';
/* UN PANNEAU NE DOIT JAMAIS DÉSARMER LE HÉROS.

   Symptôme rapporté : « je me fais tuer en lisant le panneau ». La cause est
   ailleurs — on ne lit rien du tout. Debout près d'un panneau avec quelque
   chose qui rôde, `tenterInteraction()` refusait la lecture en renvoyant
   `true`, et l'appelant y lisait « l'interaction a consommé l'appui » :

     if(appui('B') && … && tenterInteraction()){ pris('B'); … return; }

   Résultat mesuré : **0 coup d'épée sur 60 pressions de B**. Le panneau ne
   s'ouvrait pas, l'épée ne sortait pas, et l'on mourait le pouce sur le bouton
   d'attaque.

   La lecture doit donc être COMPLÈTEMENT annulée quand un ennemi approche : le
   panneau devient inerte, et l'appui repart à l'épée. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Les panneaux ne désarment pas',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const out = {};
      const s = panneaux[0];

      /* Le héros contre le panneau ; `dist` place un gluant à cette distance
         en pixels, ou aucun si null. */
      const poser = dist => {
        ennemis.length = 0; tirs.length = 0; boss = null; dial = null;
        J.x = s.x; J.y = s.y + 10; J.z = 0;
        J.atk = 0; J.spin = 0; J.charge = 0; J.slam = 0;
        J.porte = null; J.grap = null;
        J.pv = J.pvmax; J.invuln = 9e9;              // on mesure l'épée, pas les dégâts
        message = ''; msgT = 0; viderTampon(); BTN.B = 0;
        if (dist !== null)
          pondre('gluant', Math.round(J.x / TS) + Math.round(dist / TS), Math.round(J.y / TS));
      };
      /* Une pression de B, et ce qu'elle a produit. */
      const presserB = () => {
        BTN.B = 0; enfoncer('B'); majJoueur();
        const atk = J.atk; viderTampon(); BTN.B = 0; return atk;
      };

      // ---- 1) rien ne rôde : le panneau se lit ----
      poser(null); presserB();
      out.litAuCalme = !!dial;
      out.texteLu = dial ? dial.nom : null;
      dial = null;

      // ---- 2) quelque chose rôde : L'ÉPÉE SORT ----
      poser(60);
      const atk = presserB();
      out.epeeSort = atk > 0;
      out.panneauInerte = !dial;

      // ---- 3) et elle sort À CHAQUE FOIS ----
      poser(60);
      let coups = 0;
      for (let i = 0; i < 60; i++) { if (presserB() > 0) coups++; J.atk = 0; J.charge = 0; }
      out.coupsSur60 = coups;

      // ---- 4) le danger écarté, le panneau se lit de nouveau ----
      poser(60);
      ennemis.length = 0;                            // le gluant est abattu
      presserB();
      out.relitUneFoisSeul = !!dial;
      dial = null;

      // ---- 5) le rayon de refus n'est pas nul (sinon rien n'est protégé) ----
      out.rayon = LECTURE_SUR;

      return out;
    });

    v('un panneau se lit quand rien ne rôde', r.litAuCalme && r.texteLu === 'PANNEAU',
      `dial=${r.texteLu}`);
    v('UN PANNEAU NE MANGE PAS LE COUP D\'ÉPÉE', r.epeeSort,
      'B ne sort pas l\'épée près d\'un panneau avec un monstre à portée');
    v('QUELQUE CHOSE RÔDE : LE PANNEAU EST INERTE', r.panneauInerte,
      'la boîte de dialogue s\'est ouverte malgré le danger');
    v('L\'ÉPÉE SORT À CHAQUE PRESSION, PAS UNE FOIS SUR DEUX', r.coupsSur60 === 60,
      `${r.coupsSur60} coups sur 60 pressions`);
    v('le danger écarté, le panneau se relit', r.relitUneFoisSeul, 'panneau resté muet');
    v('le rayon de garde est non nul', r.rayon > 0, `LECTURE_SUR = ${r.rayon}`);

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
