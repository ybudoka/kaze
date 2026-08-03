'use strict';
/* LA CAPE SE PORTE, ELLE NE SE TIENT PAS.

   Équipée, la cape était dessinée par `dessinerArmeMain` comme un marteau ou
   une bombe : l'icône de 14 px flottait à hauteur de hanche, du côté du regard,
   sans toucher le héros. Une cape se porte DANS LE DOS.

   Ce qu'on mesure — jamais « il y a du bleu quelque part » :
     1. les pixels que la cape AJOUTE au héros, et où ils tombent ;
     2. s'ils tombent DANS la silhouette du corps ou À CÔTÉ — c'est là que se
        joue « dans le dos » : de face et de profil le corps doit la MASQUER,
        de dos c'est elle qui doit recouvrir le corps ;
     3. qu'elle reste accrochée aux épaules pendant les quatre images de marche.

   Chaque contrôle a été vérifié par RÉINJECTION du défaut (cape remise au poing,
   appels à `dessinerCape` retirés) : les quatre directions rougissent. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'La cape se porte dans le dos',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const out = {};
      const T = 72, HX = T / 2, HY = T / 2 + 16;

      const poser = (dir, etat) => {
        etat = etat || {};
        ennemis.length = 0; tirs.length = 0; boss = null;
        J.nage = false; J.invuln = 0; J.bouclier = false; J.degatFlash = 0;
        J.charge = 0; J.slam = 0; J.porte = null; J.grap = null; J.filetT = 0;
        J.atk = etat.atk || 0; J.spin = etat.spin || 0;
        J.enAir = !!etat.enAir; J.plane = etat.plane || 0;
        J.z = 0; J.dir = dir; J.animF = etat.animF || 0;
        J.x = HX; J.y = HY;
      };
      const toile = () => {
        const c = document.createElement('canvas'); c.width = T; c.height = T;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        return g;
      };
      /* La silhouette du CORPS SEUL, à la pose courante. Prendre pour masque
         « tout ce qui est rendu sans la cape » serait faux : `dessinerJoueur`
         commence par l'OMBRE PORTÉE, et les pixels de cape posés dessus
         passeraient pour des pixels de corps recouverts. */
      const masqueCorps = () => {
        const g = toile();
        g.drawImage(SPR[sprHeros()], Math.round(J.x) - 20, Math.round(J.y - J.z) - 33);
        return g.getImageData(0, 0, T, T).data;
      };
      /* Rend le héros SANS puis AVEC la cape équipée, et rapporte :
         - la boîte et le nombre des pixels ajoutés (la cape, et rien d'autre :
           sans autre outil, l'épée reste au poing dans les deux rendus) ;
         - combien de ces pixels tombent DANS la silhouette du corps. */
      const mesurer = (dir, etat) => {
        const rendre = (avecCape) => {
          poser(dir, etat);
          J.objets = []; J.equipe = { Y: null, X: null };
          if (avecCape) equiper('cape');
          const g = toile(); dessinerJoueur(g);
          return g.getImageData(0, 0, T, T).data;
        };
        const sans = rendre(false), avec = rendre(true);
        poser(dir, etat); J.objets = []; J.equipe = { Y: null, X: null };
        const corps = masqueCorps();
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0, dedans = 0;
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
          const i = (y * T + x) * 4;
          if (sans[i] === avec[i] && sans[i + 1] === avec[i + 1]
              && sans[i + 2] === avec[i + 2] && sans[i + 3] === avec[i + 3]) continue;
          n++;
          if (corps[i + 3] > 8) dedans++;             // le pixel appartenait au corps
          const dx = x - HX, dy = y - HY;
          if (dx < x0) x0 = dx; if (dx > x1) x1 = dx;
          if (dy < y0) y0 = dy; if (dy > y1) y1 = dy;
        }
        return { n, dedans, x0, x1, y0, y1 };
      };

      // ---- 1) la cape n'est plus au poing ----
      poser(2);
      J.objets = []; J.equipe = { Y: null, X: null }; equiper('cape');
      out.capeSeule = armeAuPoing();                  // l'épée, donc null
      equiper('marteau');                             // la cape reste en main mais ne se tient pas
      out.avecMarteau = armeAuPoing();
      out.capeToujoursEquipee = J.equipe.Y === 'cape' || J.equipe.X === 'cape';

      // ---- 2) où tombe la cape, direction par direction ----
      out.dirs = [0, 1, 2, 3].map(d => mesurer(d));

      // ---- 3) elle suit le corps pendant la marche ----
      out.marche = [0, 1, 2, 3].map(f => {
        const m = mesurer(3, { animF: f });
        // le haut du CORPS seul, pour la même image
        poser(3, { animF: f });
        J.objets = []; J.equipe = { Y: null, X: null };
        const g = toile();
        g.drawImage(SPR[sprHeros()], Math.round(J.x) - 20, Math.round(J.y - J.z) - 33);
        const px = g.getImageData(0, 0, T, T).data;
        let hautCorps = 1e9;
        for (let y = 0; y < T && hautCorps === 1e9; y++)
          for (let x = 0; x < T; x++)
            if (px[(y * T + x) * 4 + 3] > 8) { hautCorps = y - HY; break; }
        return { capeY0: m.y0, hautCorps, ecart: m.y0 - hautCorps };
      });

      // ---- 4) elle se déploie quand on plane ----
      const auSol = mesurer(2), enVol = mesurer(2, { enAir: true, plane: 60 });
      out.largeurSol = auSol.x1 - auSol.x0;
      out.largeurVol = enVol.x1 - enVol.x0;

      /* ---- 5) LE TOURBILLON : le corps tourne sans que `J.dir` bouge ----
         À `spin = 24`, la planche dessine un héros tourné vers la DROITE — la
         cape doit donc traîner à GAUCHE. Si elle lisait `J.dir` (ici la
         gauche), elle partirait à droite, du mauvais côté. */
      out.spinDir = (() => { J.spin = 24; return dirHeros(); })();
      out.tourbillon = mesurer(1, { spin: 24 });
      J.spin = 0;

      // ---- 6) rien de tout cela quand la cape n'est pas équipée ----
      out.sansCape = (() => {
        poser(2);
        const rendre = (objets) => {
          poser(2); J.objets = []; J.equipe = { Y: null, X: null };
          for (const o of objets) equiper(o);
          const g = toile(); dessinerJoueur(g);
          return g.getImageData(0, 0, T, T).data;
        };
        const a = rendre([]), b = rendre([]);
        let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
        return n;                                     // contrôle à blanc : 0
      })();

      return out;
    });

    const noms = ['haut (de dos)', 'gauche', 'bas (de face)', 'droite'];
    const [dos, gauche, face, droite] = r.dirs;

    // le contrôle à blanc, d'abord : la comparaison sait dire « identiques »
    v('contrôle à blanc : deux rendus sans cape sont identiques',
      r.sansCape === 0, `${r.sansCape} octets d'écart`);

    v('LA CAPE N\'EST PLUS TENUE AU POING',
      r.capeSeule === null && r.avecMarteau === 'marteauItem' && r.capeToujoursEquipee,
      `cape seule → ${r.capeSeule}, avec marteau → ${r.avecMarteau}`);

    v('ELLE EST DESSINÉE DANS LES QUATRE DIRECTIONS',
      r.dirs.every(b => b.n > 60), r.dirs.map((b, i) => `${noms[i]}:${b.n}px`).join(' '));

    // ---- le placement vertical : des épaules aux bottes, jamais ailleurs ----
    v('ELLE PEND DES ÉPAULES ET S\'ARRÊTE AU-DESSUS DES BOTTES',
      r.dirs.every(b => b.y0 >= -18 && b.y1 <= -3),
      r.dirs.map((b, i) => `${noms[i]}:y ${b.y0}..${b.y1}`).join('  '));

    // ---- le placement horizontal : DERRIÈRE, donc à l'opposé du regard ----
    v('IL VA À DROITE : LA CAPE TRAÎNE À GAUCHE',
      droite.x1 <= 0 && droite.x0 < -6, `x ${droite.x0}..${droite.x1}`);
    v('IL VA À GAUCHE : LA CAPE TRAÎNE À DROITE',
      gauche.x0 >= 0 && gauche.x1 > 6, `x ${gauche.x0}..${gauche.x1}`);
    v('DE FACE, ELLE DÉPASSE DES DEUX CÔTÉS',
      face.x0 < -6 && face.x1 > 6, `x ${face.x0}..${face.x1}`);
    v('DE DOS, ELLE COUVRE L\'AXE DU CORPS',
      dos.x0 < -4 && dos.x1 > 4, `x ${dos.x0}..${dos.x1}`);

    /* ---- le cœur du correctif : DERRIÈRE le corps, pas à côté ni devant ----
       De face et de profil, le corps masque la cape : pas un pixel du héros ne
       doit changer. De dos, c'est l'inverse — c'est elle qu'on voit. */
    v('DE FACE ET DE PROFIL, LE CORPS PASSE DEVANT LA CAPE',
      [gauche, face, droite].every(b => b.dedans === 0),
      `pixels du corps modifiés : ${[gauche, face, droite].map(b => b.dedans).join(',')}`);
    v('DE DOS, C\'EST LA CAPE QUI RECOUVRE LE CORPS',
      dos.dedans / dos.n > 0.7,
      `${dos.dedans}/${dos.n} pixels ajoutés tombent sur le corps`);

    // ---- accrochée aux épaules, image de marche après image de marche ----
    const ecarts = new Set(r.marche.map(m => m.ecart));
    v('ELLE RESTE ACCROCHÉE AUX ÉPAULES PENDANT LA MARCHE',
      ecarts.size === 1,
      r.marche.map((m, f) => `f${f}: cape ${m.capeY0} / corps ${m.hautCorps}`).join('  '));

    v('ELLE SE DÉPLOIE QUAND ON PLANE',
      r.largeurVol > r.largeurSol + 3, `au sol ${r.largeurSol}px, en vol ${r.largeurVol}px`);

    /* Le tourbillon fait tourner le CORPS sans toucher à `J.dir` : la cape doit
       suivre ce qui est dessiné, pas l'intention du joueur. On ne demande pas
       que RIEN ne dépasse à droite — l'élan du coup pousse tout le buste de
       trois pixels de ce côté — mais que la masse parte franchement à gauche. */
    v('PENDANT LE TOURBILLON, ELLE SUIT LE CORPS QUI TOURNE',
      r.spinDir === 3 && r.tourbillon.x0 < -10 && -r.tourbillon.x0 > r.tourbillon.x1,
      `corps tourné vers ${r.spinDir}, cape en x ${r.tourbillon.x0}..${r.tourbillon.x1}`);

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
