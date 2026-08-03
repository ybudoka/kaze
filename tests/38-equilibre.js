'use strict';
/* LA RAMPE DU SUD TIENT-ELLE ENCORE ?

   `blesser` porte un commentaire qui est un avertissement : « Le bouclier, le
   bouclier renforcé et l'amulette continuent de tout amortir — celui qui se
   défend ne subit pas la montée. » Les dégâts montent de +1 à partir des
   Sables et de +2 dans les Nues et la Faille ; un bouclier TOUJOURS levé
   effacerait cette courbe d'un trait, et le sud redeviendrait aussi tendre que
   le premier pré.

   On mesure donc ce qui compte vraiment : sous une pression identique et de
   FACE — le cas où la garde automatique aide le plus —, combien de cœurs le
   héros perd-il, région par région. La courbe doit rester croissante.

   Contrôle à blanc : supprimer la fenêtre de récupération (PAR_RECUP = 0) doit
   faire tomber les dégâts à ZÉRO partout, et rougir ce fichier. */
const { pageDeJeu, nouvellePartie } = require('./outils');

const REGIONS = [['VALLÉE', 35, 45], ['SABLES', 40, 350], ['FAILLE', 44, 578]];

module.exports = {
  nom: 'La rampe de difficulté du sud',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async (REGIONS) => {
      const out = { pression: [], dos: [] };

      /* Une pression IDENTIQUE partout : un coup d'un dégât par image, venu du
         nord, le héros lui faisant face. Seuls changent la région et donc la
         majoration de `blesser`. */
      const souffrir = (tx, ty, deFace) => {
        ennemis.length = 0; tirs.length = 0; boss = null;
        J.x = tx * TS + 8; J.y = ty * TS + 8; J.z = 0; J.vz = 0;
        J.kx = J.ky = J.gx = J.gy = 0; J.atk = 0; J.spin = 0; J.slam = 0;
        J.porte = null; J.grap = null; J.plane = 0; J.parRecup = 0;
        J.pvmax = 200; J.pv = 200; J.invuln = 0;
        J.dir = 0;                                  // le héros regarde au nord
        for (let f = 0; f < 900; f++) {
          majJoueur();
          // de face : depuis le nord. de dos : depuis le sud.
          blesser(1, J.x, J.y + (deFace ? -40 : 40));
        }
        return 200 - J.pv;
      };

      for (const [nom, tx, ty] of REGIONS) {
        out.pression.push({ nom, degats: souffrir(tx, ty, true) });
        out.dos.push({ nom, degats: souffrir(tx, ty, false) });
      }
      out.parRecup = typeof PAR_RECUP === 'number' ? PAR_RECUP : -1;
      return out;
    }, REGIONS);

    const face = r.pression.map(p => p.degats);
    const dos = r.dos.map(p => p.degats);
    const dit = t => t.map((d, i) => `${REGIONS[i][0]} ${d}`).join('  ');

    v('LA GARDE AUTOMATIQUE N\'EST PAS UNE INVINCIBILITÉ',
      face.every(d => d > 0),
      `dégâts encaissés de face : ${dit(face)} — un zéro veut dire garde imprenable`);

    v('LA RAMPE DU SUD TIENT ENCORE, GARDE LEVÉE',
      face[0] < face[1] && face[1] < face[2],
      `de face : ${dit(face)} — la courbe doit croître du nord au sud`);

    v('elle tient aussi sans garde (référence, dans le dos)',
      dos[0] < dos[1] && dos[1] < dos[2], `de dos : ${dit(dos)}`);

    v('SE DÉFENDRE PAIE ENCORE',
      face.every((d, i) => d < dos[i]),
      `de face ${dit(face)} devrait rester sous de dos ${dit(dos)}`);

    v('la fenêtre de récupération est bien réglée', r.parRecup > 0,
      `PAR_RECUP = ${r.parRecup}`);

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
