'use strict';
/* CORRECTIFS.md § 20 — l'arme au poing.

   Au repos et en marche, le héros ne portait RIEN : l'épée n'apparaissait qu'au
   moment de frapper. Tourner ne changeait donc rien à l'écran.

   On ne mesure pas « il y a une épée quelque part » : on isole les pixels que
   l'arme AJOUTE au corps du héros, et on regarde où ils tombent. C'est la seule
   façon de prouver qu'elle suit la direction. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'L\'arme au poing suit la direction',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const out = {};
      const T = 64;                              // toile d'essai
      /* Dessine le héros seul, avec ou sans son arme au poing, et rend la boîte
         des pixels que l'arme ajoute. */
      const boiteArme = (dir, objets, atk) => {
        J.objets = objets.slice(); J.objSel = 0;
        J.dir = dir; J.atk = atk || 0; J.slam = 0;
        J.porte = null; J.grap = null; J.z = 0; J.animF = 0;
        J.x = T / 2; J.y = T / 2 + 12;
        /* On passe par le VRAI dessin du héros. Une première version appelait
           `dessinerArmeMain()` à la main : retirer ses appels de
           `dessinerJoueur()` — c'est-à-dire remettre le défaut d'origine —
           laissait le contrôle vert. */
        J.invuln = 0; J.bouclier = false; J.degatFlash = 0; J.charge = 0;
        const rendre = (avecArme) => {
          const c = document.createElement('canvas'); c.width = T; c.height = T;
          const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
          const vrai = window.dessinerArmeMain;
          if (!avecArme) window.dessinerArmeMain = () => {};
          dessinerJoueur(g);
          window.dessinerArmeMain = vrai;
          return g.getImageData(0, 0, T, T).data;
        };
        const a = rendre(true), b = rendre(false);
        let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, n = 0;
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
          const i = (y * T + x) * 4;
          if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) {
            n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
        return { n, cx: n ? (x0 + x1) / 2 : null, cy: n ? (y0 + y1) / 2 : null };
      };

      // 1) l'épée nue, dans les quatre directions
      J.spin = 0;
      out.epee = [0, 1, 2, 3].map(d => boiteArme(d, [], 0));
      // 2) un outil équipé : c'est LUI qui doit être en main
      out.marteau = [0, 1, 2, 3].map(d => boiteArme(d, ['marteau'], 0));
      // 3) pendant une attaque, l'arme au poing ne doit RIEN ajouter :
      //    la planche d'attaque dessine déjà l'épée, on aurait deux lames
      out.pendantAttaque = [0, 1, 2, 3].map(d => boiteArme(d, [], 9).n);
      // idem pendant le tourbillon et le coup de marteau
      J.objets = []; J.dir = 2; J.atk = 0;
      J.spin = 10;
      out.pendantTourbillon = boiteArme(2, [], 0).n;   // boiteArme remet atk à 0, pas spin
      J.spin = 0;

      // 4) l'outil tenu change bien avec la sélection
      J.objets = ['marteau', 'boomerang']; J.dir = 3; J.atk = 0;
      J.objSel = 0; out.spr0 = armeAuPoing();
      J.objSel = 1; out.spr1 = armeAuPoing();
      J.objets = []; out.sprEpee = armeAuPoing();
      return out;
    });

    const noms = ['haut', 'gauche', 'bas', 'droite'];
    // l'arme est bien dessinée, dans chaque direction
    v('L\'ÉPÉE EST VISIBLE AU REPOS, DANS LES QUATRE DIRECTIONS',
      r.epee.every(b => b.n > 20),
      r.epee.map((b, i) => `${noms[i]}:${b.n}px`).join(' '));
    v('l\'outil équipé est visible lui aussi',
      r.marteau.every(b => b.n > 20),
      r.marteau.map((b, i) => `${noms[i]}:${b.n}px`).join(' '));

    // et elle CHANGE DE CÔTÉ avec la direction
    const g = r.epee[1], d = r.epee[3];
    v('ELLE PASSE À GAUCHE QUAND ON VA À GAUCHE, À DROITE QUAND ON VA À DROITE',
      g.cx < 32 && d.cx > 32 && d.cx - g.cx > 10,
      `gauche cx=${g.cx} droite cx=${d.cx}`);
    v('les quatre directions donnent quatre placements distincts',
      new Set(r.epee.map(b => `${b.cx},${b.cy}`)).size === 4,
      r.epee.map((b, i) => `${noms[i]}:${b.cx},${b.cy}`).join(' '));
    v('l\'outil suit la même règle',
      r.marteau[1].cx < 32 && r.marteau[3].cx > 32,
      `gauche ${r.marteau[1].cx} droite ${r.marteau[3].cx}`);

    // pas deux épées à la fois
    v('PENDANT UNE ATTAQUE, PAS DE SECONDE LAME',
      r.pendantAttaque.every(n => n === 0), r.pendantAttaque.join(','));
    v('ni pendant le tourbillon', r.pendantTourbillon === 0, r.pendantTourbillon);

    v('l\'outil tenu suit la sélection L/R',
      r.spr0 === 'marteauItem' && r.spr1 === 'boomerangItem' && r.sprEpee === null,
      `${r.spr0} / ${r.spr1} / épée=${r.sprEpee}`);
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
