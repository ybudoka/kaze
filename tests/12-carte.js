'use strict';
/* CORRECTIFS.md § 11 — l'écran de carte.
   Le pied de page était calé sous la carte, elle-même dimensionnée sur
   `H - 62` : selon les proportions de l'écran, « Y SAUVEGARDER » et
   « DERNIÈRE : … » se superposaient et la ligne du stockage passait sous le
   bord. On mesure ici des rectangles de texte réels, pas des intentions. */
const { pageDeJeu, nouvellePartie } = require('./outils');

const TAILLES = [[320, 700], [360, 780], [390, 844], [414, 900], [414, 1180]];

module.exports = {
  nom: 'Écran de carte',
  async executer({ navigateur, v }) {
    for (const [largeur, hauteur] of TAILLES) {
      const page = await pageDeJeu(navigateur, { largeur, hauteur });
      await nouvellePartie(page);

      const r = await page.evaluate(async () => {
        const dort = ms => new Promise(r => setTimeout(r, ms));
        /* Une partie bien avancée : c'est là que le pied de page est le plus
           chargé (toutes les statistiques, et une légende bien remplie). */
        J.fragments = 3; Q.lucioles = 3; J.bombes = 12; J.fleches = 54; J.rubis = 40;
        Q.portailOuvert = true; Q.lanterne = 1; Q.chefTue = false;
        J.x = 36 * TS; J.y = (Y_CENDRE + 20) * TS;
        for (let i = 0; i < vu.length; i++) vu[i] = 1;

        /* On intercepte le tracé pour relever chaque rectangle réellement
           dessiné : textes, panneau de la carte, pastilles de légende. */
        const boites = []; const out = {};
        const vraiTexte = window.texte, vraiDraw = X.drawImage.bind(X), vraiFill = X.fillRect.bind(X);
        let capture = false;
        window.texte = (g, s, x, y, ...r) => {
          if (capture && g === X && String(s).length)
            boites.push({ t: 'texte', s: String(s), x, y, w: largeurTexte(s), h: 7 });
          return vraiTexte(g, s, x, y, ...r);
        };
        /* Tous les tracés de la mini-carte sont relevés : la GRANDE carte comme
           les VIGNETTES. Ne retenir que la plus grande laissait le texte d'aide
           recouvrir la bande de vignettes sans que rien ne le signale. */
        X.drawImage = (img, ...a) => {
          if (capture && img === miniCV) {
            const r = a.length >= 8 ? a.slice(4) : a;
            // la SOURCE compte autant que la destination : c'est elle qui dit
            // si l'on montre UNE région ou le monde entier écrasé dedans
            const src = a.length >= 8 ? a.slice(0, 4) : null;
            boites.push({ t: 'carte', x: r[0], y: r[1], w: r[2], h: r[3],
                          srcH: src ? src[3] : null });
          }
          return vraiDraw(img, ...a);
        };
        /* On ne relève qu'UNE SEULE image : la boucle de rendu rappelle
           `ecranCarte()` soixante fois par seconde, et laisser la capture
           ouverte pendant l'attente faisait « se recouvrir » chaque texte avec
           lui-même, d'une image à l'autre. */
        etat = 'carte';
        await dort(260);
        capture = true;
        ecranCarte();
        capture = false;

        /* Deuxième passe, témoin de sauvegarde affiché : posé dans son propre
           cadre en bas de l'écran, il recouvrait la légende — et c'est
           précisément ici qu'on appuie sur Y pour sauvegarder. */
        const boitesSansTemoin = boites.length;
        sauveEtat = 'PARTIE SAUVEGARDÉE'; sauveEtatT = 100;
        capture = true;
        ecranCarte();
        capture = false;
        sauveEtatT = 0;
        const avecTemoin = boites.splice(boitesSansTemoin);
        window.texte = vraiTexte; X.drawImage = vraiDraw; X.fillRect = vraiFill;

        const chev = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
                             * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        const textes = boites.filter(b => b.t === 'texte');
        /* Le plus grand des tracés de `miniCV` : le mini-plan du coin de l'écran
           est dessiné avec la même image, et le prendre pour la carte donnait
           une surface ridicule. */
        const cartes = boites.filter(b => b.t === 'carte')
          .sort((a, b) => b.w * b.h - a.w * a.h);
        const carte = cartes[0];                 // la grande
        out.nbVignettes = cartes.length - 1;

        // 1) rien ne dépasse du canvas
        const dehors = boites.filter(b => b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h > H)
          .map(b => `${b.s || b.t}@${Math.round(b.x)},${Math.round(b.y)}`);

        // 2) deux textes ne se recouvrent jamais
        const collisions = [];
        for (let i = 0; i < textes.length; i++) for (let j = i + 1; j < textes.length; j++)
          if (chev(textes[i], textes[j]) > 0)
            collisions.push(`${textes[i].s} × ${textes[j].s}`);

        // 3) aucun texte ne mord sur la carte
        // aucun texte ne mord sur la grande carte NI sur une vignette
        const surCarte = carte
          ? textes.filter(t => cartes.some(c => chev(t, c) > 0)).map(t => t.s)
          : ['carte absente'];

        // 4) la carte reste lisible : elle remplit la hauteur disponible.
        //    On mesure la part de la HAUTEUR, pas de la surface : avec six
        //    régions empilées (88×480), la carte est haute et fine, sa largeur
        //    est bridée par la hauteur, et une part de surface ne mesurerait
        //    plus que ses proportions. La hauteur, elle, doit rester pleine.
        const partCarte = carte ? carte.h / H : 0;
        const partLargeur = carte ? carte.w / W : 0;
        // rapport entre la grande carte et une vignette : c'est LUI qui dit que
        // l'active est montrée en grand et les autres en petit
        const vign = cartes[1];
        const rapport = (carte && vign) ? (carte.w * carte.h) / (vign.w * vign.h) : 0;
        const rangeesSource = carte ? carte.srcH : null;   // doit valoir UNE région

        // le témoin ne doit rien recouvrir non plus, ni sortir de l'écran
        const tT = avecTemoin.filter(b => b.t === 'texte');
        const temoinCollisions = [];
        for (let i = 0; i < tT.length; i++) for (let j = i + 1; j < tT.length; j++)
          if (chev(tT[i], tT[j]) > 0) temoinCollisions.push(`${tT[i].s} × ${tT[j].s}`);
        const temoinDehors = tT.filter(b => b.x < 0 || b.x + b.w > W || b.y + b.h > H).map(b => b.s);
        const temoinVu = tT.some(b => b.s === 'PARTIE SAUVEGARDÉE');

        return { W, H, dehors, collisions, surCarte, partCarte, partLargeur, rapport,
                 rangeesSource, rangeesRegion: Math.floor(MH / NB_REGIONS), rangeesMonde: MH,
                 nbVignettes: out.nbVignettes,
                 temoinCollisions, temoinDehors, temoinVu,
                 textes: textes.map(t => t.s) };
      });

      const nom = `${largeur}×${hauteur} (canvas ${r.W}×${r.H})`;
      v(`${nom} : rien ne dépasse de l'écran`,
        r.dehors.length === 0, r.dehors.join(' · '));
      v(`${nom} : AUCUN TEXTE N'EN RECOUVRE UN AUTRE`,
        r.collisions.length === 0, r.collisions.join(' · '));
      v(`${nom} : aucun texte ne mord sur la carte`,
        r.surCarte.length === 0, r.surCarte.join(' · '));
      /* La carte montrée est UNE région (88×80 tuiles), presque carrée : elle
         ne peut plus remplir la hauteur d'un écran allongé sans déborder en
         largeur. On vérifie donc qu'elle remplit bien l'axe qui la contraint,
         et non une hauteur qu'elle n'a aucune raison d'occuper. */
      v(`${nom} : la carte remplit l'espace qu'on lui laisse`,
        r.partLargeur > 0.7 || r.partCarte > 0.55,
        `${(r.partLargeur * 100).toFixed(0)} % de la largeur, ${(r.partCarte * 100).toFixed(0)} % de la hauteur`);
      v(`${nom} : LA GRANDE CARTE MONTRE UNE SEULE RÉGION, PAS LE MONDE ENTIER`,
        r.rangeesSource === r.rangeesRegion,
        `${r.rangeesSource} rangées lues (une région = ${r.rangeesRegion}, le monde = ${r.rangeesMonde})`);
      v(`${nom} : LA RÉGION ACTIVE EST EN GRAND, LES HUIT EN VIGNETTES`,
        r.nbVignettes === 8 && r.rapport > 12,
        `${r.nbVignettes} vignettes, la grande n'est que ${r.rapport.toFixed(0)}× une vignette`);
      v(`${nom} : les statistiques sont toutes là`,
        ['ÉTOILES', 'RUBIS', 'BOMBES', 'FLÈCHES', 'LUCIOLES']
          .every(m => r.textes.some(t => t.startsWith(m))),
        r.textes.join(' | '));
      v(`${nom} : la légende explique les repères`,
        ['TOI', 'AMI', 'COFFRE'].every(m => r.textes.includes(m)),
        r.textes.join(' | '));
      v(`${nom} : le témoin de sauvegarde s'affiche`, r.temoinVu, 'absent');
      v(`${nom} : LE TÉMOIN NE RECOUVRE RIEN`,
        r.temoinCollisions.length === 0 && r.temoinDehors.length === 0,
        [...r.temoinCollisions, ...r.temoinDehors].join(' · '));
      v(`${nom} : aucune erreur JS`, page.erreursJS.length === 0, page.erreursJS[0]);
      await page.context().close();
    }

    /* La légende ne doit annoncer que ce qui est effectivement sur la carte :
       une luciole déjà prise ou un brasier déjà allumé n'y ont plus leur place. */
    {
      const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
      await nouvellePartie(page);
      const r = await page.evaluate(async () => {
        const dort = ms => new Promise(r => setTimeout(r, ms));
        const lire = async () => {
          const vus = [];
          const vrai = window.texte;
          window.texte = (g, s, ...a) => { vus.push(String(s)); return vrai(g, s, ...a); };
          ecranCarte(); await dort(20);
          window.texte = vrai;
          return vus;
        };
        etat = 'carte'; await dort(200);
        Q.lucioles = 3; Q.chefTue = false; Q.lanterne = 1; Q.portailOuvert = true;
        const avant = await lire();
        Q.lucioles = 8; Q.chefTue = true; Q.lanterne = 3;
        for (const [x, y] of BRASIERS_POS) putO(x, y, O.BRASIERVIF);
        const apres = await lire();
        return { avant, apres };
      });
      v('la légende annonce ce qui reste à trouver',
        ['LUCIOLE', 'CHEF', 'LANTERNE', 'BRASIER'].every(m => r.avant.includes(m)),
        r.avant.join(' | '));
      v('ELLE SE TAIT SUR CE QUI EST DÉJÀ FAIT',
        !['LUCIOLE', 'CHEF', 'LANTERNE', 'BRASIER'].some(m => r.apres.includes(m)),
        r.apres.join(' | '));
      v('mais garde les repères permanents',
        r.apres.includes('TOI') && r.apres.includes('AMI'), r.apres.join(' | '));
      v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
      await page.context().close();
    }
  },
};
