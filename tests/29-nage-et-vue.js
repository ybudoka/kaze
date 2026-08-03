'use strict';
/* CORRECTIFS.md § 28 — quatre règles qui touchent à ce qu'on VOIT et à ce que
   les monstres voient :

   1. dans l'eau, seuls la tête, les épaules et les bras dépassent ;
   2. un mur coupe le regard des créatures, et arrête leurs projectiles ;
   3. près d'un personnage, on est à couvert ;
   4. un panneau ne se lit pas sous le nez d'un monstre.

   Tout se mesure sur le vrai jeu : des pixels pour le nageur, des distances
   parcourues et des points de vie pour les monstres. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'La nage, la vue des monstres et les panneaux',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    /* ==================== 1. LA NAGE ==================== */
    const nage = await page.evaluate(() => {
      const cx = Math.floor(J.x / TS), cy = Math.floor(J.y / TS);
      // un plan d'eau autour du héros, et de la terre ferme à côté pour comparer
      for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 8; x <= cx + 8; x++) {
        putO(x, y, O.RIEN); putE(x, y, 0);
        putS(x, y, x >= cx ? S.EAU : S.HERBE);
      }
      prerendreSol();
      pnjs.length = 0; ennemis.length = 0; boss = null;
      Q.palmes = true; J.objets = [];
      J.z = 0; J.vz = 0; J.enAir = false; J.dir = 2; J.atk = 0; J.spin = 0;
      J.slam = 0; J.invuln = 0; J.animF = 0; J.grap = null; J.porte = null;

      /* On appelle le VRAI `dessinerJoueur` dans un carré à part, recentré sur
         lui : c'est le dessin du jeu qu'on mesure, pas une reconstitution. Les
         pieds tombent sur la ligne 56. */
      const PIED = 56;
      const rendu = () => {
        const c = document.createElement('canvas');
        c.width = 80; c.height = 80;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.translate(40 - Math.round(J.x), PIED - Math.round(J.y));
        dessinerJoueur(g);
        return g.getImageData(0, 0, 80, 80).data;
      };
      /* On distingue le CORPS de l'ÉCUME : sous la ligne d'eau il ne doit
         rester que des remous. Le dessin est fait hors du monde, sans la teinte
         d'ambiance, donc les couleurs y sont exactes. */
      const ECUME = ['#eaf6ff', '#a9d6ee'].map(h =>
        [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
      const mesure = d => {
        let haut = 1e9, bas = -1, sous = 0, ecume = 0, total = 0;
        for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) {
          const i = (y * 80 + x) * 4;
          if (d[i + 3] < 40) continue;
          total++;
          if (y < haut) haut = y;
          if (y > bas) bas = y;
          if (y <= PIED - 5) continue;                       // au-dessus de la ligne d'eau
          if (ECUME.some(c => c[0] === d[i] && c[1] === d[i+1] && c[2] === d[i+2])) ecume++;
          else sous++;                                       // du CORPS, sous l'eau
        }
        return { haut, bas, sous, ecume, total, hauteur: bas - haut + 1 };
      };

      /* Les BRAS, et rien qu'eux : de la peau ou de la tunique, à hauteur de
         la ligne d'eau, et assez loin de l'axe pour ne pas être le corps. On
         relève leur position, pas seulement leur nombre — deux bras figés
         donneraient le même compte à chaque image. */
      const CHAIR = ['#2fae57', '#ffd2a6'].map(h =>
        [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
      const bras = d => {
        let n = 0, somme = 0;
        for (let y = PIED - 10; y < PIED; y++) for (let x = 0; x < 80; x++) {
          if (Math.abs(x - 40) <= 8) continue;
          const i = (y * 80 + x) * 4;
          if (d[i + 3] < 40) continue;
          if (!CHAIR.some(c => c[0] === d[i] && c[1] === d[i+1] && c[2] === d[i+2])) continue;
          n++; somme += x * (y + 1);
        }
        return { n, somme };
      };

      const out = {};
      // --- à pied sec ---
      J.x = (cx - 4) * TS + 8; J.y = cy * TS + 8;
      majJoueur(); J.animF = 0;
      out.terreNage = J.nage;
      tick = 100; const t1 = rendu();
      tick = 130; const t2 = rendu();
      out.terre = mesure(t1);
      out.brasTerre = bras(t1);
      // contrôle à blanc : à pied, pose figée, deux images identiques
      out.terreFige = (() => { let n = 0;
        for (let i = 0; i < t1.length; i += 4) if (t1[i] !== t2[i] || t1[i+3] !== t2[i+3]) n++;
        return n; })();

      // --- dans l'eau ---
      J.x = (cx + 4) * TS + 8; J.y = cy * TS + 8;
      majJoueur(); J.animF = 0;
      out.eauNage = J.nage;
      tick = 100; const e1 = rendu();
      tick = 130; const e2 = rendu();
      out.eau = mesure(e1);
      out.brasEau = bras(e1); out.brasEau2 = bras(e2);
      // les bras brassent : deux images séparées ne se ressemblent pas
      out.eauBouge = (() => { let n = 0;
        for (let i = 0; i < e1.length; i += 4) if (e1[i] !== e2[i] || e1[i+3] !== e2[i+3]) n++;
        return n; })();

      // et il redevient entier en sortant de l'eau
      J.x = (cx - 4) * TS + 8; majJoueur();
      out.ressorti = !J.nage;
      return out;
    });

    v('à pied sec, il ne nage pas', nage.terreNage === false && nage.ressorti,
      `terre=${nage.terreNage} ressorti=${nage.ressorti}`);
    v('DANS L EAU, IL NAGE', nage.eauNage === true, 'il marche toujours');
    v('contrôle à blanc : à pied, pose figée, deux images sont identiques',
      nage.terreFige === 0, `${nage.terreFige} pixels bougent tout seuls`);
    v('À PIED, ON LE VOIT EN ENTIER', nage.terre.hauteur >= 30,
      `${nage.terre.hauteur} px de haut`);
    v('DANS L EAU, SEUL LE HAUT DU CORPS DÉPASSE',
      nage.eau.hauteur >= 8 && nage.eau.hauteur <= nage.terre.hauteur * 0.7,
      `${nage.terre.hauteur} px -> ${nage.eau.hauteur} px`);
    v('ET IL NE RESTE RIEN DE LUI SOUS LA LIGNE D EAU',
      nage.eau.sous === 0 && nage.terre.sous > 60,
      `${nage.terre.sous} px de corps sous la ligne à pied, ${nage.eau.sous} à la nage`);
    v('rien que de l écume, qui elle est bien là',
      nage.eau.ecume > 12 && nage.terre.ecume === 0,
      `${nage.eau.ecume} px d'écume à la nage, ${nage.terre.ecume} à pied`);
    v('contrôle à blanc : à pied, rien de tel à hauteur de la ligne d eau',
      nage.brasTerre.n === 0, `${nage.brasTerre.n} pixels de chair`);
    v('IL A DES BRAS QUI SORTENT DE L EAU',
      nage.brasEau.n >= 10, `${nage.brasEau.n} pixels de bras`);
    v('ET CES BRAS BRASSENT : ILS NE SONT PAS AU MÊME ENDROIT D UN INSTANT À L AUTRE',
      nage.brasEau.somme !== nage.brasEau2.somme,
      `bras figés (${nage.brasEau.n} px, position ${nage.brasEau.somme})`);

    /* ============ 2 et 3. CE QUE LES MONSTRES VOIENT ============ */
    const vue = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const cx = Math.floor(J.x / TS), cy = Math.floor(J.y / TS);
      const plat = () => {
        for (let y = cy - 10; y <= cy + 10; y++) for (let x = cx - 12; x <= cx + 12; x++) {
          putO(x, y, O.RIEN); putE(x, y, 0); putS(x, y, S.HERBE);
        }
        prerendreSol();
        /* Le village est un REFUGE : les créatures en sont repoussées et les
           projectiles ennemis y meurent. On mesure la vue, pas le refuge. */
        refuges.length = 0;
        pnjs.length = 0; ennemis.length = 0; butins.length = 0; tirs.length = 0; boss = null;
        J.x = cx * TS + 8; J.y = cy * TS + 8; J.z = 0; J.vz = 0; J.enAir = false;
        J.pv = J.pvmax = 20; J.invuln = 0; J.nage = false;
      };
      /* Une créature posée à sept tuiles à l'est, et on regarde de combien elle
         se rapproche en cent images. C'est la seule mesure qui compte : « voit »
         est une intention, « il a parcouru trois pixels » est un fait. */
      const approche = async (avecMur, avecPNJ) => {
        plat();
        if (avecMur) for (let y = cy - 3; y <= cy + 3; y++) putO(cx + 4, y, O.MUR);
        if (avecPNJ) pnjs.push({ id: 'essai', x: J.x + 10, y: J.y, spr: 'pnj0',
                                 nom: 'ESSAI', anim: 0, dir: 2 });
        prerendreSol();
        pondre('gluant', cx + 7, cy);
        const e = ennemis[0];
        e.x = (cx + 7) * TS + 8; e.y = cy * TS + 8; e.z = 0; e.pv = 99; e.voit = undefined;
        const d0 = Math.hypot(e.x - J.x, e.y - J.y);
        for (let f = 0; f < 300; f++) { majEnnemis(); }
        const d1 = ennemis.length ? Math.hypot(ennemis[0].x - J.x, ennemis[0].y - J.y) : d0;
        return Math.round(d0 - d1);           // de combien il s'est rapproché
      };
      const out = {};
      out.libre = await approche(false, false);
      out.mur = await approche(true, false);
      out.abri = await approche(false, true);

      /* La vue elle-même, à la source : elle doit dire oui à découvert et non
         derrière un mur — sinon la mesure ci-dessus pourrait être verte pour
         une tout autre raison. */
      plat();
      const oeil = (mur) => {
        plat();
        if (mur) for (let y = cy - 3; y <= cy + 3; y++) putO(cx + 4, y, O.MUR);
        return vueLibre((cx + 7) * TS + 8, cy * TS + 8, 8, J.x, J.y, 14);
      };
      out.vueDecouvert = oeil(false);
      out.vueDerriereMur = oeil(true);

      /* Un projectile ne passe pas le mur : on en lance un droit sur le héros
         depuis l'autre côté, et on compte ses points de vie. */
      const tirTravers = (mur) => {
        plat();
        if (mur) for (let y = cy - 3; y <= cy + 3; y++) putO(cx + 4, y, O.MUR);
        tirs.push({ x: (cx + 7) * TS + 8, y: cy * TS + 8, z: 10,
                    vx: -2.6, vy: 0, vie: 200, ami: 0, spr: 'caillou' });
        for (let f = 0; f < 120 && tirs.length; f++) majDivers();
        return { pv: J.pv, restant: tirs.length };
      };
      out.tirLibre = tirTravers(false);
      out.tirMur = tirTravers(true);

      // et l'abri suit le héros : il en sort, on le revoit
      plat();
      pnjs.push({ id: 'essai', x: J.x + 10, y: J.y, spr: 'pnj0', nom: 'ESSAI', anim: 0, dir: 2 });
      out.abriteDedans = !!abriDUnPNJ(J.x, J.y);
      out.abriteDehors = !!abriDUnPNJ(J.x + 200, J.y);
      pnjs.length = 0;
      await dort(1);
      return out;
    });

    v('à découvert, la créature voit le héros et fond sur lui',
      vue.vueDecouvert === true && vue.libre > 60,
      `vue=${vue.vueDecouvert}, elle a gagné ${vue.libre} px`);
    v('UN MUR LUI COUPE LE REGARD', vue.vueDerriereMur === false, 'elle voit à travers');
    v('ET ELLE CESSE DE POURSUIVRE À TRAVERS LA PIERRE',
      vue.mur < 8, `elle a encore gagné ${vue.mur} px`);
    v('PRÈS D UN PERSONNAGE, LE HÉROS EST À COUVERT',
      vue.abri < 8, `elle a encore gagné ${vue.abri} px`);
    v('l abri suit le héros : il en sort, on le revoit',
      vue.abriteDedans && !vue.abriteDehors,
      `dedans=${vue.abriteDedans} dehors=${vue.abriteDehors}`);
    v('contrôle à blanc : sans mur, le projectile touche bel et bien',
      vue.tirLibre.pv < 20, `${vue.tirLibre.pv} points de vie, intacts`);
    v('UN PROJECTILE NE TRAVERSE PAS LE MUR',
      vue.tirMur.pv === 20 && vue.tirMur.restant === 0,
      `pv=${vue.tirMur.pv}, ${vue.tirMur.restant} projectile(s) encore en vol`);

    /* ==================== 4. LES PANNEAUX ==================== */
    const pan = await page.evaluate(() => {
      const cx = Math.floor(J.x / TS), cy = Math.floor(J.y / TS);
      for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 8; x <= cx + 8; x++) {
        putO(x, y, O.RIEN); putE(x, y, 0); putS(x, y, S.HERBE);
      }
      prerendreSol();
      pnjs.length = 0; ennemis.length = 0; boss = null; tirs.length = 0;
      J.x = cx * TS + 8; J.y = cy * TS + 8; J.z = 0; J.nage = false;
      panneaux.length = 0;
      panneaux.push({ x: J.x + 12, y: J.y, txt: "UN PANNEAU DE CONTRÔLE." });

      const lire = () => { dial = null; message = ''; msgT = 0;
                           const pris = tenterInteraction();
                           return { pris, ouvert: !!dial, msg: message }; };
      const out = {};
      out.auCalme = lire();
      // une créature à portée de coup, juste à côté
      pondre('gluant', cx + 2, cy);
      ennemis[0].x = J.x + 40; ennemis[0].y = J.y; ennemis[0].z = 0;
      out.sousLeNez = lire();
      // elle s'éloigne : on peut relire
      ennemis[0].x = J.x + 300;
      out.apresFuite = lire();
      dial = null; ennemis.length = 0; panneaux.length = 0;
      return out;
    });

    v('au calme, le panneau se lit',
      pan.auCalme.pris && pan.auCalme.ouvert, JSON.stringify(pan.auCalme));
    v('UNE CRÉATURE À PORTÉE, LE PANNEAU NE S OUVRE PLUS',
      !pan.sousLeNez.ouvert, JSON.stringify(pan.sousLeNez));
    /* Et le refus est TOTAL : `tenterInteraction` rend `false`, donc l'appui
       repart à l'épée. Il rendait `true` — l'appelant y lisait « appui
       consommé » et sortait : B ne sortait plus jamais l'épée près d'un
       panneau (0 coup sur 60 pressions). Voir 39-panneaux.js. */
    v('IL NE MANGE PAS L\'APPUI : L\'ÉPÉE REPREND LA MAIN',
      pan.sousLeNez.pris === false, JSON.stringify(pan.sousLeNez));
    v('la créature partie, on relit', pan.apresFuite.ouvert, JSON.stringify(pan.apresFuite));
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
