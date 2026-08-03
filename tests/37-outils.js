'use strict';
/* DEUX OUTILS EN MAIN, et le bouclier qui se lève tout seul.

   Le sac comptait neuf outils sur un seul cycle L/R : jusqu'à QUATRE pressions
   pour en atteindre un, en plein combat. Le code compensait déjà par sept
   endroits qui forçaient la sélection à la place du joueur — l'auto-sélection
   était le symptôme, pas la solution.

   Désormais deux emplacements, `Y` et `X`, rangés par IDENTIFIANT et non par
   indice (l'ordre du sac change quand on ramasse : un indice sauvegardé
   désignait alors un autre objet, et il fallait le borner deux fois au
   chargement). `X` se libère parce que le bouclier devient automatique.

   Le bouclier automatique est le point à équilibrer, et c'est ce que ce
   fichier mesure le plus sévèrement : il ne pare que de FACE, et il tombe
   pendant une fenêtre de RÉCUPÉRATION après chaque parade. Sans cette fenêtre,
   une garde permanente rendrait le héros intouchable de face — et annulerait
   la montée des dégâts du sud (cf. `blesser`). */
const { pageDeJeu, nouvellePartie, dort } = require('./outils');

module.exports = {
  nom: 'Deux outils en main & bouclier automatique',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const out = {};
      /* Un coin de prairie dégagé, sans rien qui rôde : on mesure le héros,
         pas ses rencontres. */
      const poser = () => {
        ennemis.length = 0; tirs.length = 0; butins.length = 0; boss = null;
        J.x = 35 * TS + 8; J.y = 45 * TS + 8; J.z = 0; J.vz = 0;
        J.kx = J.ky = J.gx = J.gy = 0; J.atk = 0; J.spin = 0; J.slam = 0;
        J.porte = null; J.grap = null; J.plane = 0; J.parRecup = 0;
        J.pv = J.pvmax = 24; J.invuln = 0;
      };

      // ---- 1) les deux emplacements existent et se remplissent ----
      poser();
      J.objets = []; J.equipe = { Y: null, X: null };
      equiper('arc'); equiper('bombe');
      out.deuxRemplis = J.equipe.Y === 'arc' && J.equipe.X === 'bombe';
      // un troisième va en Y (le plus à portée du pouce), sans doublon
      equiper('marteau');
      out.troisiemeEnY = J.equipe.Y === 'marteau' && J.equipe.X === 'bombe';
      out.pasDeDoublon = J.objets.filter(o => o === 'marteau').length === 1;
      // ré-équiper ce qu'on a déjà en main ne déplace rien
      const avant = JSON.stringify(J.equipe);
      equiper('bombe');
      out.dejaEnMainNeBougePas = JSON.stringify(J.equipe) === avant;

      // ---- 2) Y et X déclenchent CHACUN leur outil ----
      poser();
      J.objets = ['arc', 'bombe']; J.equipe = { Y: 'arc', X: 'bombe' };
      J.fleches = 5; J.bombes = 5;
      const flechesAvant = J.fleches, bombesAvant = J.bombes;
      /* `BTN` seul ne suffit pas : l'action lit `appui()`, donc le TAMPON.
         `enfoncer` remplit les deux, comme le ferait un vrai doigt. */
      const presser = b => { BTN[b] = 0; enfoncer(b); majJoueur(); viderTampon(); BTN[b] = 0; };
      presser('Y');
      out.yTire = J.fleches === flechesAvant - 1 && tirs.some(t => t.spr === 'fleche');
      presser('X');
      out.xPose = J.bombes === bombesAvant - 1 && bombes.length > 0;

      // ---- 3) le sac survit à la sauvegarde et au rechargement ----
      poser();
      J.objets = ['arc', 'bombe', 'boomerang']; J.equipe = { Y: 'boomerang', X: 'arc' };
      Q.boomerang = true;
      await sauver(true); await new Promise(r => setTimeout(r, 250));
      await charger(emplacement); await new Promise(r => setTimeout(r, 450));
      out.equipeRechargee = J.equipe.Y === 'boomerang' && J.equipe.X === 'arc';

      /* ---- 4) LE BOUCLIER AUTOMATIQUE ----
         Il se lève sans qu'on tienne rien. */
      poser();
      J.dir = 0;                                    // le héros regarde au NORD
      majJoueur();
      out.gardeLevee = J.bouclier === true;

      // il pare ce qui vient d'en FACE, sans qu'on touche à un bouton
      poser(); J.dir = 0; majJoueur();
      let pv0 = J.pv;
      blesser(2, J.x, J.y - 40);                    // le coup vient du nord
      out.pareDeFace = J.pv === pv0;

      // ... et pas ce qui vient de DOS
      poser(); J.dir = 0; majJoueur();
      pv0 = J.pv;
      blesser(2, J.x, J.y + 40);                    // le coup vient du sud
      out.neParePasDeDos = J.pv < pv0;

      /* ---- 5) LA FENÊTRE DE RÉCUPÉRATION ----
         Une parade baisse la garde quelques images : sans cela, le héros de
         face serait intouchable et la montée des dégâts du sud ne vaudrait
         plus rien. */
      poser(); J.dir = 0; majJoueur();
      pv0 = J.pv;
      blesser(2, J.x, J.y - 40);                    // paré
      out.premierPare = J.pv === pv0;
      out.recupEnCours = J.parRecup > 0;
      J.invuln = 0;                                 // l'invincibilité ne doit rien masquer
      blesser(2, J.x, J.y - 40);                    // le suivant passe
      out.secondPasse = J.pv < pv0;

      // un FLUX de coups traverse : on n'encaisse pas indéfiniment
      poser(); J.dir = 0;
      pv0 = J.pv;
      for (let f = 0; f < 600; f++) { majJoueur(); blesser(1, J.x, J.y - 40); }
      out.fluxTraverse = pv0 - J.pv;

      // ---- 6) une attaque imparable blesse toujours ----
      poser(); J.dir = 0; majJoueur();
      pv0 = J.pv;
      blesser(2, J.x, J.y - 40, false);
      out.imparableBlesse = J.pv < pv0;

      /* ---- 7) LA PÉNALITÉ DE VITESSE A DISPARU ----
         Le bouclier coûtait 15 % de vitesse tant qu'on le tenait. Toujours
         levé, il aurait condamné le héros à marcher au ralenti pour toujours.
         Base mesurée : 1,55 px/image, soit 93 px en 60 images. */
      poser();
      const x0 = J.x;
      for (let f = 0; f < 60; f++) { axe.x = 1; axe.y = 0; majJoueur(); }
      axe.x = 0;
      out.parcouru = Math.round(J.x - x0);
      out.gardeLeveePendant = J.bouclier === true;

      // ---- 8) la page des outils : grille 2D, et pas d'outil qu'on n'a pas ----
      poser();
      J.objets = ['arc', 'bombe']; J.equipe = { Y: 'arc', X: 'bombe' };
      etat = 'outils'; outilCx = 0; outilCy = 0;
      const dep = [outilCx, outilCy];
      axe.x = 1; axe.y = 0; grilleTempo = 0; naviguerOutils();
      const bougeX = outilCx !== dep[0];
      axe.x = 0; axe.y = 1; grilleTempo = 0; naviguerOutils();
      const bougeY = outilCy !== dep[1];
      axe.x = 0; axe.y = 0;
      out.grille2D = bougeX && bougeY;
      // viser un outil NON possédé et tenter de l'équiper : refusé
      const iAbsent = OBJETS.findIndex(o => !J.objets.includes(o.id));
      outilCx = iAbsent % COLS_OUTILS; outilCy = (iAbsent / COLS_OUTILS) | 0;
      const equipeAvant = JSON.stringify(J.equipe);
      viderTampon(); BTN.B = 0; enfoncer('B'); naviguerOutils(); viderTampon(); BTN.B = 0;
      out.refuseNonPossede = JSON.stringify(J.equipe) === equipeAvant;
      etat = 'jeu';

      return out;
    });

    v('les deux emplacements se remplissent dans l\'ordre', r.deuxRemplis, `${JSON.stringify(r)}`);
    v('un troisième outil prend la place de Y, sans doublon',
      r.troisiemeEnY && r.pasDeDoublon, 'emplacements ou sac incohérents');
    v('ré-équiper ce qu\'on a déjà en main ne déplace rien', r.dejaEnMainNeBougePas, 'les mains ont changé');
    v('Y DÉCLENCHE L\'OUTIL DE Y', r.yTire, 'la flèche n\'est pas partie');
    v('X DÉCLENCHE L\'OUTIL DE X', r.xPose, 'la bombe n\'est pas posée');
    v('LES DEUX EMPLACEMENTS SURVIVENT AU RECHARGEMENT', r.equipeRechargee, 'mains perdues');

    v('LE BOUCLIER SE LÈVE TOUT SEUL', r.gardeLevee, 'garde baissée sans raison');
    v('il pare ce qui vient de face', r.pareDeFace, 'le coup de face est passé');
    v('IL NE PARE PAS DANS LE DOS', r.neParePasDeDos, 'le coup de dos a été paré');
    v('une attaque imparable blesse toujours', r.imparableBlesse, 'l\'imparable a été parée');

    v('LA PARADE OUVRE UNE FENÊTRE DE RÉCUPÉRATION',
      r.premierPare && r.recupEnCours && r.secondPasse,
      `paré=${r.premierPare} recup=${r.recupEnCours} suivant passe=${r.secondPasse}`);
    v('UN FLUX DE COUPS TRAVERSE LA GARDE', r.fluxTraverse > 0,
      `0 dégât encaissé en 600 images : la garde est imprenable`);

    v('LA PÉNALITÉ DE VITESSE A DISPARU', r.parcouru >= 88 && r.gardeLeveePendant,
      `${r.parcouru}px en 60 images (attendu ≈93, 79 avec l'ancienne pénalité)`);

    v('la page des outils navigue en deux dimensions', r.grille2D, 'le curseur ne bouge pas');
    v('ELLE REFUSE UN OUTIL QU\'ON NE POSSÈDE PAS', r.refuseNonPossede, 'outil fantôme équipé');

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
