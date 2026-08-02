'use strict';
/* CORRECTIFS.md § 40 — les frontières, et les créatures enfoncées dans le sol.

   Les huit mondes étaient enclos du MÊME rectangle de mur gris, épais de trois
   cases, tiré au cordeau : on lisait le bord d'une feuille, pas un accident du
   terrain. Chaque région a maintenant sa pierre, son profil dentelé et sa
   lisière — sans qu'aucun passage ne se ferme.

   Et une créature pondue sur un plateau gardait `z=0` : elle était dessinée
   seize pixels SOUS la surface, enfoncée jusqu'à la taille, tant qu'elle
   n'avait pas vu le héros. */
const { pageDeJeu, nouvellePartie } = require('./outils');

const Y_REG = [0, 80, 160, 240, 320, 400, 480, 560];
const NOMS = ['vallée', 'Cendres', 'Cimes', 'Lagon', 'Sables', 'Marais', 'Nues', 'Faille'];

module.exports = {
  nom: 'Les frontières, et les créatures au sol',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 700 });
    await nouvellePartie(page);

    const r = await page.evaluate(async ([Y, N]) => {
      const out = {};

      /* ---------- 1. LA PIERRE DE CHAQUE RÉGION ----------
         On fait dessiner à `murTuile` une tuile de chaque région, hors écran,
         et on relève la couleur de son dessus. */
      const cv = document.createElement('canvas'); cv.width = cv.height = 32;
      const g = cv.getContext('2d');
      out.pierres = N.map((n, i) => {
        g.clearRect(0, 0, 32, 32);
        const tx = 1, ty = Y[i] + 30;
        g.save(); g.translate(-tx * TS + 8, -ty * TS + 20); murTuile(g, tx, ty); g.restore();
        const d = g.getImageData(10, 4, 1, 1).data;
        return `${d[0]},${d[1]},${d[2]}`;
      });

      /* ---------- 2. LE PROFIL : le mur avance et recule ----------
         On mesure les QUATRE bords : un flanc dentelé ne dit rien du bord nord,
         et c'est en retirant la seule falaise nord de la vallée qu'on l'a vu —
         le contrôle restait vert. */
      const varie = ep => [...new Set(ep.filter(e => e > 0))].length;
      out.profils = N.map((n, i) => {
        const y0 = Y[i], y1 = Y[i + 1] || MH;
        const O_ = [], E_ = [], No = [], Su = [];
        for (let y = y0 + 12; y < y1 - 12; y++) {
          let e = 0; while (e < 9 && Obj(e, y) === O.MUR) e++; O_.push(e);
          let d = 0; while (d < 9 && Obj(MW - 1 - d, y) === O.MUR) d++; E_.push(d);
        }
        /* On cherche le PIED de la falaise avant de la mesurer : celle qui ferme
           la vallée est en 77-78, pas en 79, et la mesurer à ras du bord la
           donnait pour absente. */
        const bande = (x, y, dir) => { let k = 0;
          while (k < 6 && Obj(x, y + dir * k) !== O.MUR) k++;
          if (k >= 6) return 0;
          let n = 0; while (n < 9 && Obj(x, y + dir * (k + n)) === O.MUR) n++;
          return n; };
        for (let x = 6; x < MW - 6; x++) {
          No.push(bande(x, y0, 1)); Su.push(bande(x, y1 - 1, -1));
        }
        return { epaisseurs: [...new Set(O_)].sort((a, b) => a - b), min: Math.min(...O_),
                 varie: { O: varie(O_), E: varie(E_), N: varie(No), S: varie(Su) } };
      });

      /* ---------- 3. LA LISIÈRE : le décor de la région, devant la roche ---------- */
      const nomO = Object.fromEntries(Object.entries(O).map(([k, v]) => [v, k]));
      out.lisieres = N.map((n, i) => {
        const y0 = Y[i], y1 = Y[i + 1] || MH, c = {};
        for (let y = y0; y < y1; y++) for (const x of [3, 4, 5, 6, MW - 7, MW - 6, MW - 5, MW - 4]) {
          const o = Obj(x, y); if (o && o !== O.MUR) c[nomO[o]] = (c[nomO[o]] || 0) + 1;
        }
        return c;
      });

      /* ---------- 4. LE CADRE DU MONDE RESTE INFRANCHISSABLE ---------- */
      Object.assign(Q, { palmes: true, portailOuvert: true, bottes: true });
      let fuites = 0;
      for (let y = 3; y < MH - 3; y++) for (const x of [0, 1, 2, MW - 3, MW - 2, MW - 1])
        if (!solide(x * TS + 8, y * TS + 8, 0)) fuites++;
      for (const y of [0, 1, 2, MH - 3, MH - 2, MH - 1]) for (let x = 0; x < MW; x++)
        if (!solide(x * TS + 8, y * TS + 8, 0)) fuites++;
      out.fuites = fuites;

      /* ---------- 5. LES CLAIRIÈRES DES LUCIOLES SONT INTACTES ----------
         C'est la falaise sud de la vallée qui avait enseveli la luciole d'or. */
      out.luciolesEncombrees = lucioles.filter(l => {
        const tx = Math.floor(l.x / TS), ty = Math.floor(l.y / TS);
        for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++)
          if (DUR_O[Obj(x, y)] && Obj(x, y) !== O.TORCHE) return true;
        return false;
      }).length;

      /* ---------- 6. LES CRÉATURES SE TIENNENT SUR LEUR SOL ---------- */
      const enfoncees = () => ennemis.filter(e => Math.abs(e.z - baseSol(e.x, e.y)) > 1);
      out.total = ennemis.length;
      out.enfoncees = enfoncees().length;
      out.exemples = enfoncees().slice(0, 4).map(e =>
        [e.type, Math.floor(e.x / TS), Math.floor(e.y / TS), Math.round(e.z), Math.round(baseSol(e.x, e.y))]);
      // sur un plateau, là où le défaut se voyait : y a-t-il seulement des bêtes ?
      out.surPlateau = ennemis.filter(e => Etg(Math.floor(e.x / TS), Math.floor(e.y / TS)) > 0).length;
      // contrôle à blanc : le contrôle sait-il dire non ?
      if (ennemis.length) { const e0 = ennemis[0], z0 = e0.z; e0.z = z0 - 16;
        out.saitDireNon = enfoncees().length > 0; e0.z = z0; }

      return out;
    }, [Y_REG, NOMS]);

    v('les huit régions ont huit pierres différentes',
      new Set(r.pierres).size === 8, r.pierres.join(' | '));
    v('la vallée, le désert et la Faille ne se ferment plus sur le même gris',
      r.pierres[0] !== r.pierres[4] && r.pierres[4] !== r.pierres[7], r.pierres.join(' | '));

    /* Trois bords n'existent pas : les Cendres n'ont pas de falaise nord (c'est
       celle de la vallée qui les ferme), les Nues pas de bord sud (on y tombe
       dans la Faille), et le Marais pas davantage — son `Y1` vaut MH, reliquat
       du temps où il fermait le monde, et c'est le bord nord des Nues qui le
       clôt. */
    const SANS = { 1: 'N', 5: 'S', 6: 'S' };
    const plats = [];
    r.profils.forEach((p, i) => { for (const c of ['O', 'E', 'N', 'S'])
      if (SANS[i] !== c && p.varie[c] < 2) plats.push(`${NOMS[i]}/${c}`); });
    v('AUCUN DES QUATRE BORDS N\'EST PLUS UN TRAIT : la falaise avance et recule',
      plats.length === 0, `plat(s) : ${plats.join(', ')}`);
    v('et elle reste épaisse d\'au moins trois cases partout',
      r.profils.every(p => p.min >= 3), JSON.stringify(r.profils.map(p => p.min)));

    /* Le comptage porte sur les colonnes du bord, où traîne aussi le décor
       ordinaire de la région : on ne demande donc pas que la lisière soit SEULE,
       mais qu'elle soit BIEN LÀ, et qu'aucune autre région n'y ait déteint. */
    const attendu = [['ARBRE', 'BUISSON'], ['ROCNOIR', 'PILIER'], ['SAPIN', 'CAIRN'],
                     ['CORAILO'], ['CACTUS', 'OBELISQUE'], ['SAULE', 'SOUCHE'], null, ['ROCNOIR']];
    const compte = (i, l) => l.reduce((n, o) => n + (r.lisieres[i][o] || 0), 0);
    const maigres = attendu.map((l, i) => [NOMS[i], l && compte(i, l)])
                           .filter(e => e[1] !== null && e[1] < 8);
    v('chaque lisière porte le décor de SA région',
      maigres.length === 0, maigres.map(e => `${e[0]}: ${e[1]}`).join(' | '));
    /* Signatures exclusives : un sapin dans le désert dirait que la lisière a
       été posée sans regarder où elle poussait. */
    const SIGNE = { SAPIN: 2, CORAILO: 3, CACTUS: 4, SAULE: 5 };
    const deteint = [];
    for (const [o, reg] of Object.entries(SIGNE))
      r.lisieres.forEach((c, i) => { if (i !== reg && c[o]) deteint.push(`${o} en ${NOMS[i]}`); });
    v('et aucune n\'a déteint sur sa voisine', deteint.length === 0, deteint.join(', '));
    v('sur le vide des Nues, la falaise de marbre est nue',
      ['ARBRE', 'SAPIN', 'SAULE', 'CACTUS', 'CORAILO', 'ROC'].every(o => !r.lisieres[6][o]),
      JSON.stringify(r.lisieres[6]));

    v('LE CADRE DU MONDE RESTE INFRANCHISSABLE', r.fuites === 0, `${r.fuites} case(s) franchissables`);
    v('les clairières des lucioles restent dégagées',
      r.luciolesEncombrees === 0, `${r.luciolesEncombrees} encombrée(s)`);

    v('AUCUNE CRÉATURE N\'EST ENFONCÉE DANS LE SOL',
      r.enfoncees === 0, `${r.enfoncees} sur ${r.total} : ${JSON.stringify(r.exemples)}`);
    v('et il y en a bien sur les plateaux, là où le défaut se voyait',
      r.surPlateau > 0, `${r.surPlateau} créature(s) en étage`);
    v('contrôle à blanc : le contrôle sait dire non', r.saitDireNon === true);

    await page.context().close();
  },
};
