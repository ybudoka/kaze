'use strict';
/* CORRECTIFS.md § 58 — toute tuile posée dans le monde doit SE VOIR.

   Signalé par le joueur : « les carillons du vent sont invisibles ». Il avait
   raison, et c'était plus large : quatre tuiles de la Cité des Nues — le
   carillon, sa version sonnée, la colonne d'air et l'obélisque — n'avaient
   AUCUNE branche de dessin. Elles occupaient une case, portaient une hauteur,
   comptaient dans une quête, et ne posaient pas un pixel.

   Rien ne pouvait le voir : aucun contrôle ne regardait le décor, et sur la
   carte le carillon avait bien son repère — c'est justement ce qui rendait la
   quête faisable et le défaut invisible.

   Ce test balaie donc TOUTES les entrées de la table `O` et compte les pixels
   que chacune dessine réellement. Une tuile ajoutée demain sans son dessin
   tombera ici. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Toute tuile posée se voit',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(() => {
      /* On dessine la tuile seule, sur une toile vide, par le VRAI `decorTuile`
         — pas par une copie de son code. Puis on compte les pixels opaques. */
      const mesure = (code) => {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        const tx = 2, ty = 2, av = Obj(tx, ty);
        putO(tx, ty, code);
        g.save(); g.translate(-tx * TS + 24, -(ty * TS) + 40);
        decorTuile(g, tx, ty, ty * TS + TS);
        g.restore();
        putO(tx, ty, av);
        const d = g.getImageData(0, 0, 64, 64).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
        return n;
      };
      /* Les seules tuiles qui ont le DROIT de ne rien dessiner, et pourquoi.
         La liste est courte et justifiée : tout le reste doit se voir. */
      const MUETTES_ADMISES = { BLOC: 'emprise des maisons, dessinées comme structures' };
      const out = { muettes: [], pixels: {}, total: 0, admises: Object.keys(MUETTES_ADMISES) };
      for (const nom in O) {
        const code = O[nom];
        if (!code) continue;                       // RIEN : la case vide
        if (MUETTES_ADMISES[nom]) continue;
        out.total++;
        const n = mesure(code);
        out.pixels[nom] = n;
        if (n === 0) out.muettes.push(nom);
      }
      /* Contrôle à blanc : la case VIDE ne doit rien dessiner. Sans lui, une
         mesure qui compterait le fond donnerait « tout va bien » partout. */
      out.videEstVide = mesure(O.RIEN) === 0;
      // et quelques tuiles témoins, connues pour se voir
      out.temoins = { mur: out.pixels.MUR | 0, cloche: out.pixels.CLOCHE | 0,
                      carillon: out.pixels.CARILLON | 0, colonne: out.pixels.COLONNE | 0,
                      obelisque: out.pixels.OBELISQUE | 0 };
      return out;
    });

    v('CONTRÔLE À BLANC : UNE CASE VIDE NE DESSINE RIEN', r.videEstVide,
      'la mesure compte le fond : elle ne prouverait rien');
    v(`les ${r.total} tuiles du monde ont été mesurées`, r.total > 40, `${r.total} tuiles`);
    v('AUCUNE TUILE POSÉE DANS LE MONDE N\'EST INVISIBLE',
      r.muettes.length === 0, `muettes : ${r.muettes.join(', ')}`);
    v('et la liste des exceptions reste courte et justifiée',
      r.admises.length <= 2, `exceptions : ${r.admises.join(', ')}`);
    v('LES QUATRE TUILES DE LA CITÉ DES NUES SE VOIENT',
      r.temoins.carillon > 20 && r.temoins.colonne > 20 && r.temoins.obelisque > 20,
      JSON.stringify(r.temoins));
    v('un mur reste plus dense qu\'un carillon', r.temoins.mur > r.temoins.carillon,
      `mur ${r.temoins.mur} / carillon ${r.temoins.carillon}`);
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
