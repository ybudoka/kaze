'use strict';
/* CORRECTIFS.md § 15 — le sol en bandes.

   Le sol était pré-rendu d'un seul bloc : 1408 × 10240 px, 14,4 Mpx, ~55 Mo,
   et 720 ms de gel à chaque génération ET à chaque chargement. iOS refuse les
   canvas au-delà de ~16 Mpx : une région de plus et le jeu ne s'affichait plus
   du tout.

   Ces contrôles ne mesurent pas « c'est rapide » — une machine d'intégration
   n'est pas un téléphone — mais des propriétés STRUCTURELLES qui, elles, ne
   dépendent pas de la machine : la taille des toiles, leur nombre, le fait
   qu'elles soient recyclées, et le plafond de travail par image. Plus deux
   bornes de temps très larges, qui n'attrapent qu'un effondrement. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Performance et chargement graduel',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      const pixels = () => bandes.filter(Boolean).reduce((n, b) => n + b.cv.width * b.cv.height, 0);

      /* ---------- aucune toile géante ---------- */
      out.nbBandes = NB_BANDES;
      out.tailleToile = [MW * TS, HB * TS + DEBORD * 2];
      out.mpxToile = +((MW * TS) * (HB * TS + DEBORD * 2) / 1e6).toFixed(2);
      out.mpxSiMonolithe = +((MW * TS) * (MH * TS) / 1e6).toFixed(1);

      /* ---------- le chargement ne bâtit QUE la bande du héros ---------- */
      J.x = 40 * TS; J.y = 45 * TS;
      const t0 = performance.now();
      prerendreSol();
      out.msPrerendu = +(performance.now() - t0).toFixed(0);
      out.bandesApresPrerendu = bandes.filter(Boolean).length;
      out.bandeDuHerosPrete = !!(bandes[bandeDe(J.y)] && bandes[bandeDe(J.y)].pret);
      out.mpxApresPrerendu = +(pixels() / 1e6).toFixed(2);

      /* ---------- le travail par image est plafonné ---------- */
      // une bande vierge, très loin : majBandes ne doit pas la finir d'un coup
      for (let i = 0; i < NB_BANDES; i++) bandes[i] = null;
      J.x = 40 * TS; J.y = 45 * TS;
      cam.y = 0;
      batirBande(bandeDe(J.y), 1e9);            // celle du héros, pour ne rien fausser
      /* On mesure ce que fait RÉELLEMENT une image — `majBandes()` —, et non
         `batirBande()` appelée à la main : mesurer la seconde laissait passer
         un plafond retiré de la première. */
      const loin = NB_BANDES - 1;
      for (let i = 0; i < NB_BANDES; i++) bandes[i] = null;
      J.y = 45 * TS; cam.y = loin * HB * TS;
      const pret = () => !!(bandes[loin] && bandes[loin].pret);
      const temps = [];
      let tours = 0;
      while (!pret() && tours < 300) {
        const a = performance.now(); majBandes(); temps.push(performance.now() - a);
        if (tours === 0) out.trancheInachevee = !pret();   // une image ne finit pas la bande
        tours++;
      }
      out.toursPourUneBande = tours;
      /* On retient la MÉDIANE, pas la première : la toute première image d'une
         session paie l'achat de la toile (une allocation de 1,8 Mpx). Le pot
         commun fait qu'elle n'est payée qu'une fois — c'est le contrôle
         « les toiles sont recyclées » qui le vérifie. */
      temps.sort((a, b) => a - b);
      out.msUneImage = +temps[temps.length >> 1].toFixed(1);
      out.msPremiereImage = +temps[temps.length - 1].toFixed(1);

      /* ---------- les toiles sont recyclées, pas réallouées ---------- */
      out.residentes = RESIDENTES;
      // on force le remplissage puis l'éviction, et on compte les toiles créées
      const vraiCreer = document.createElement.bind(document);
      let creees = 0;
      document.createElement = (t) => { if (t === 'canvas') creees++; return vraiCreer(t); };
      for (let i = 0; i < NB_BANDES; i++) { bandes[i] = null; }
      for (let i = 0; i < NB_BANDES; i++) { batirBande(i, 4); libererBandesLointaines(); }
      out.toilesCreees1 = creees;
      creees = 0;
      for (let i = 0; i < NB_BANDES; i++) { batirBande(i, 4); libererBandesLointaines(); }
      out.toilesCreees2 = creees;               // le second tour ne doit plus rien créer
      document.createElement = vraiCreer;
      out.residentesApres = bandes.filter(Boolean).length;

      /* ---------- le sol se dessine bien, où qu'on soit ---------- */
      // on relit un pixel du sol au village : il ne doit pas rester le fond nu
      nouvellePartie('PERF', 0); await dort(400);
      J.x = 35 * TS; J.y = 45 * TS;
      cam.x = clamp(J.x - W / 2, 0, MW * TS - W); cam.y = clamp(J.y - H / 2, 0, MH * TS - H - EH);
      await dort(500);
      out.solDessine = (() => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d');
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        const yA = Math.max(0, cam.y - EH), yB = Math.min(MH * TS, cam.y + H + 4);
        g.save(); g.translate(-cam.x, -cam.y); dessinerSol(g, cam.x, yA, W, yB - yA); g.restore();
        const d = g.getImageData(0, 0, W, H).data;
        let peints = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] || d[i + 1] || d[i + 2]) peints++;
        return peints / (W * H);
      })();

      /* ---------- traverser une frontière n'alloue plus rien ---------- */
      creees = 0;
      document.createElement = (t) => { if (t === 'canvas') creees++; return vraiCreer(t); };
      const y0 = J.y;
      for (let k = 0; k < 200; k++) { J.y = y0 + k * TS * 1.5; cam.y = clamp(J.y - H / 2, 0, MH * TS - H - EH); majBandes(); }
      out.toilesEnMarchant = creees;
      document.createElement = vraiCreer;
      return out;
    });

    v('le sol est découpé en huit bandes', r.nbBandes === 8, r.nbBandes);
    v('AUCUNE TOILE NE DÉPASSE LA LIMITE DES NAVIGATEURS MOBILES',
      r.mpxToile < 4, `${r.mpxToile} Mpx par bande (monolithe : ${r.mpxSiMonolithe} Mpx)`);
    v('une seule bande est bâtie au chargement',
      r.bandesApresPrerendu === 1 && r.bandeDuHerosPrete,
      `${r.bandesApresPrerendu} bande(s), héros prêt=${r.bandeDuHerosPrete}`);
    v('LE CHARGEMENT NE GÈLE PLUS UNE SECONDE',
      r.msPrerendu < 400, `${r.msPrerendu} ms (720 ms avant)`);
    v('la mémoire de sol reste modeste au chargement',
      r.mpxApresPrerendu < 3, `${r.mpxApresPrerendu} Mpx`);

    v('LE TRAVAIL PAR IMAGE EST PLAFONNÉ',
      r.trancheInachevee && r.toursPourUneBande > 3,
      `une seule image a fini la bande (${r.toursPourUneBande} images)`);
    v('une image de construction coûte peu',
      r.msUneImage < 25, `${r.msUneImage} ms (la plus chère : ${r.msPremiereImage} ms)`);
    v('une bande se bâtit en quelques images',
      r.toursPourUneBande <= 20, `${r.toursPourUneBande} images`);

    v('LES TOILES SONT RECYCLÉES, PAS RÉALLOUÉES',
      r.toilesCreees2 === 0, `${r.toilesCreees2} toiles créées au second passage`);
    v('et il n\'en existe jamais plus qu\'il n\'en faut',
      r.toilesCreees1 <= r.residentes + 1 && r.residentesApres <= r.residentes,
      `créées=${r.toilesCreees1} résidentes=${r.residentesApres}/${r.residentes}`);
    v('MARCHER À TRAVERS LES HUIT RÉGIONS N\'ALLOUE RIEN',
      r.toilesEnMarchant === 0, `${r.toilesEnMarchant} toiles créées en chemin`);

    v('LE SOL EST BIEN DESSINÉ, PAS UN FOND NU',
      r.solDessine > 0.9, `${(r.solDessine * 100).toFixed(0)} % de l'écran peint`);
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
