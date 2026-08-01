'use strict';
/* CORRECTIFS.md § 17 — la version affichée.

   Elle est restée à « V0.6 — 6 des 8 mondes » pendant que les huit mondes
   étaient en ligne. Depuis un téléphone, ce numéro est le SEUL moyen de savoir
   quelle version on a réellement : le service worker sert la page en
   « réseau d'abord », mais rien ne dit au joueur ce qu'il a sous les yeux.

   On ne peut pas vérifier par un test qu'un humain a pensé à la monter. On
   vérifie donc ce qui est vérifiable : qu'elle existe, qu'elle est RÉELLEMENT
   dessinée sur l'écran-titre, et qu'elle ne diverge pas de `package.json` —
   monter l'une oblige à monter l'autre. */
const fs = require('fs');
const path = require('path');
const { pageDeJeu } = require('./outils');

module.exports = {
  nom: 'Version affichée',
  async executer({ navigateur, v }) {
    const racine = path.resolve(__dirname, '..');
    const pkg = JSON.parse(fs.readFileSync(path.join(racine, 'package.json'), 'utf8'));

    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      etat = 'titre';
      await dort(300);
      /* On relève le texte réellement tracé pendant une image de l'écran-titre :
         une constante définie mais jamais dessinée n'apprendrait rien au joueur. */
      const vus = [];
      const vrai = window.texte;
      window.texte = (g, s, ...a) => { if (g === X) vus.push(String(s)); return vrai(g, s, ...a); };
      ecranTitre();
      window.texte = vrai;
      return { VERSION, dessinee: vus.includes(VERSION), textes: vus };
    });

    v('la version est définie', typeof r.VERSION === 'string' && /^V\d+\.\d+/.test(r.VERSION),
      String(r.VERSION));
    v('ELLE EST RÉELLEMENT DESSINÉE SUR L\'ÉCRAN-TITRE',
      r.dessinee, `« ${r.VERSION} » absente de : ${r.textes.join(' | ')}`);

    /* `V1.1` doit correspondre à `1.1.0` : on compare majeur et mineur. Le
       correctif de détail (le troisième nombre) n'a pas à s'afficher. */
    const [maj, min] = String(pkg.version).split('.');
    v('ELLE NE DIVERGE PAS DE PACKAGE.JSON',
      r.VERSION === `V${maj}.${min}`,
      `index.html dit ${r.VERSION}, package.json dit ${pkg.version}`);

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
