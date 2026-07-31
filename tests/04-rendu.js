'use strict';
/* CORRECTIFS.md § 5.3 et 5.4 — on ne doit pas voir un monstre à travers le
   relief, ni voir les occupants d'une salle close depuis l'extérieur.
   Méthode : on rend la scène avec et sans le monstre, et on compte les pixels
   qui changent dans la zone censée le masquer. Un contrôle à blanc garantit
   d'abord que deux rendus identiques ne diffèrent pas (la caméra suit le héros
   en douceur et fausse la mesure si elle n'a pas convergé). */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Rendu et occlusion',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(() => {
      const ctx = CV.getContext('2d');
      const snap = () => { tick = 1000; secousse = 0; rendreMonde();
                           return ctx.getImageData(0, 0, CV.width, CV.height).data; };
      const diff = (a, b, zone) => {
        let dans = 0, total = 0;
        for (let py = 0; py < CV.height; py++) for (let px = 0; px < CV.width; px++) {
          const i = (py * CV.width + px) * 4;
          if (a[i] !== b[i] || a[i+1] !== b[i+1] || a[i+2] !== b[i+2]) {
            total++;
            if (zone && px >= zone.x0 && px < zone.x1 && py >= zone.y0 && py < zone.y1) dans++;
          }
        }
        return { dans, total };
      };
      const poser = (nom, tx, ty) => { ennemis.length = 0; pondre(nom, tx, ty); };
      const stabiliser = () => { for (let i = 0; i < 200; i++) rendreMonde(); };
      const out = {};

      // terrain d'essai autour du héros
      const cx = Math.floor(J.x / TS), cy = Math.floor(J.y / TS);
      const neutre = () => {
        for (let y = cy - 9; y <= cy + 4; y++) for (let x = cx - 7; x <= cx + 7; x++) {
          putO(x, y, O.RIEN); putE(x, y, 0); putS(x, y, S.HERBE);
        }
        pnjs.length = 0; structures.length = 0; butins.length = 0; ennemis.length = 0; boss = null;
      };
      J.invuln = 99999;

      // contrôle à blanc
      neutre(); prerendreSol(); stabiliser();
      { const a = snap(), b = snap(); out.stable = diff(a, b).total; }

      // § 5.3 — derrière une falaise
      neutre();
      for (let y = cy - 2; y <= cy + 4; y++) for (let x = cx - 7; x <= cx + 7; x++) { putE(x, y, 1); putS(x, y, S.TERRE); }
      prerendreSol(); stabiliser();
      { const sans = snap(); poser('gluant', cx, cy - 3); const avec = snap();
        const zone = { x0: (cx - 1) * TS - cam.x, y0: (cy - 2) * TS - EH - cam.y,
                       x1: (cx + 2) * TS - cam.x, y1: (cy - 2) * TS - cam.y };
        out.falaise = diff(sans, avec, zone).dans; ennemis.length = 0; }

      // le monstre perché sur le plateau doit rester entier
      neutre();
      for (let y = cy - 9; y <= cy + 4; y++) for (let x = cx - 7; x <= cx + 7; x++) { putE(x, y, 1); putS(x, y, S.TERRE); }
      prerendreSol(); stabiliser();
      { const sans = snap(); poser('gluant', cx, cy - 4); ennemis[0].z = EH; const avec = snap();
        out.surPlateau = diff(sans, avec).total; ennemis.length = 0; }

      // témoin : à découvert, il se voit
      neutre(); prerendreSol(); stabiliser();
      { const sans = snap(); poser('gluant', cx, cy - 4); const avec = snap();
        out.aDecouvert = diff(sans, avec).total; ennemis.length = 0; }

      // § 5.4 — salle close : la ruine du lac, vue du dehors puis du dedans
      const placer = (tx, ty) => { J.x = tx * TS + 8; J.y = ty * TS + 8; J.z = 0;
                                   ennemis.length = 0; boss = null; stabiliser(); };
      const visible = (tx, ty) => { ennemis.length = 0; const a = snap();
        pondre('gluant', tx, ty); const b = snap(); ennemis.length = 0; return diff(a, b).total; };
      placer(17, 75);
      out.dehors = [visible(17, 69), visible(15, 70), visible(15, 71)];
      placer(17, 69);
      out.dedans = visible(15, 70);
      placer(35, 45);
      out.horsSalle = visible(34, 44);
      return out;
    });

    v('mesure fiable : deux rendus identiques ne diffèrent pas', r.stable === 0, `${r.stable}px`);
    v('un monstre derrière une falaise est masqué', r.falaise === 0, `${r.falaise}px visibles`);
    v('un monstre sur un plateau reste entier',
      r.surPlateau > 200 && Math.abs(r.surPlateau - r.aDecouvert) < 40,
      `${r.surPlateau}px contre ${r.aDecouvert}px à découvert`);
    v('salle close : invisible du dehors',
      r.dehors.every(n => n === 0), r.dehors.join(','));
    v('salle close : visible une fois entré', r.dedans > 100, `${r.dedans}px`);
    v('hors salle, rien ne change', r.horsSalle > 100, `${r.horsSalle}px`);
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
