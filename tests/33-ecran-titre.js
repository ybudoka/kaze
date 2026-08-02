'use strict';
/* CORRECTIFS.md § 39 — l'écran-titre se recouvrait lui-même.

   Le bloc-titre grandit avec la LARGEUR (le logo suit W), le menu grandit avec
   le nombre d'emplacements occupés, et tous deux étaient posés à partir du seul
   horizon, sans jamais se connaître. Sur 1512×760 — 620×240 en interne — le
   panneau du menu tombait pile sur « KAZE » et sur le sous-titre : 4 696 px² de
   recouvrement, 11 792 px² en paysage.

   On ne teste pas la formule de mise en page : on RELÈVE ce qui est réellement
   dessiné pendant une image d'écran-titre, on en fait des boîtes, et on mesure
   l'aire d'intersection. Une future mise en page qui recouvrirait autrement
   rougira tout autant. */
const { pageDeJeu } = require('./outils');

/* Les tailles de fenêtre, et ce qu'elles donnent en résolution interne :
     1512×760 → 620×240 (le Mac, écran large et BAS : le cas qui a cassé)
      414×900 → 200×280 (téléphone en portrait)
      360×640 → 346×398
      900×400 → 620×180 (téléphone en paysage : le pire budget vertical)
      320×480 → 306×266 (petit écran) */
const CAS = [
  { nom: '1512×760, 1 emplacement occupé', l: 1512, h: 760, slots: [1, 0, 0] },
  { nom: '1512×760, 3 emplacements',       l: 1512, h: 760, slots: [1, 1, 1] },
  { nom: '1512×760, aucune partie',        l: 1512, h: 760, slots: [0, 0, 0] },
  { nom: '414×900, 1 emplacement',         l: 414,  h: 900, slots: [1, 0, 0] },
  { nom: '414×900, 3 emplacements',        l: 414,  h: 900, slots: [1, 1, 1] },
  { nom: '360×640, 3 emplacements',        l: 360,  h: 640, slots: [1, 1, 1] },
  { nom: '900×400 (paysage), 3 emplac.',   l: 900,  h: 400, slots: [1, 1, 1] },
  { nom: '320×480, 3 emplacements',        l: 320,  h: 480, slots: [1, 1, 1] },
];

/* Relève d'une image d'écran-titre : chaque tracé devient une boîte étiquetée.
   `texte`, `fillRect` et `drawImage` sont détournés le temps d'un appel à
   `ecranTitre()`, puis rendus. */
async function releverBoites(page, slots) {
  return page.evaluate(async (slots) => {
    for (let i = 0; i < NB_SLOTS; i++)
      resumes[i] = slots[i] ? { nom: 'KAZE', temps: 209 * 3600, fragments: 3, lucioles: 8 } : null;
    etat = 'titre'; modeEffacer = false; menuSel = 0;
    await new Promise(r => setTimeout(r, 60));

    const b = [];
    const vTexte = window.texte, vFill = X.fillRect.bind(X), vDraw = X.drawImage.bind(X);
    /* La lune est un `arc()` : on relève sa position RÉELLE plutôt que de la
       recalculer ici. Une boîte codée en dur dans le test resterait vraie même
       si la lune retournait dans le coin gauche — et le contrôle serait vert
       pour une mauvaise raison (vérifié en réinjectant `lx=22`). */
    const vArc = X.arc.bind(X);
    X.arc = (cx, cy, ra, ...a) => {
      if (ra >= 6) b.push({ tag: 'lune', s: 'lune', x: cx - ra, y: cy - ra, w: ra * 2, h: ra * 2 });
      return vArc(cx, cy, ra, ...a);
    };
    window.texte = (g, s, x, y, ...a) => {
      if (g === X) b.push({ tag: 'texte', s: String(s).toUpperCase(), x, y, w: String(s).length * 6 - 1, h: 8 });
      return vTexte(g, s, x, y, ...a);
    };
    X.fillRect = (x, y, w, h) => { b.push({ tag: 'fill', s: String(X.fillStyle), x, y, w, h }); return vFill(x, y, w, h); };
    X.drawImage = (...a) => {
      // le logo : des glyphes 5×7 redimensionnés
      if (a.length === 5 && a[0] && a[0].width === 5 && a[0].height === 7)
        b.push({ tag: 'logo', s: 'logo', x: a[1], y: a[2], w: a[3], h: a[4] });
      // le héros : sprite 40×40 à taille native, dont 31 px peints (hy-32..hy-1)
      if (a.length === 3 && a[0] && a[0].width === 40 && a[0].height === 40)
        b.push({ tag: 'heros', s: 'heros', x: a[1] + 11, y: a[2] + 1, w: 17, h: 31 });
      if (a[0] && (a[0] === SPR.rongeur0 || a[0] === SPR.rongeur1))
        b.push({ tag: 'bete', s: 'bete', x: a[1], y: a[2], w: a[3], h: a[4] });
      return vDraw(...a);
    };
    try { ecranTitre(); }
    finally { window.texte = vTexte; X.fillRect = vFill; X.drawImage = vDraw; X.arc = vArc; }
    return { W, H, hor: Math.round(H * 0.46), boites: b };
  }, slots);
}

const aire = (a, b) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const recouvrement = (as, bs) =>
  as.reduce((s, a) => s + bs.reduce((t, b) => t + aire(a, b), 0), 0);

/* Les libellés du titre et de l'aide, pour trier les textes relevés. */
const RE_TITRE = /^(LA LÉGENDE DE|ET LE RONGEUR)/;
const RE_AIDE = /^(B EPEE|START CARTE|SAUVEGARDE NON)/;
const RE_VERSION = /^V\d/;

module.exports = {
  nom: 'Écran-titre : rien ne recouvre rien',
  async executer({ navigateur, v }) {
    for (const cas of CAS) {
      const page = await pageDeJeu(navigateur, { largeur: cas.l, hauteur: cas.h });
      const r = await releverBoites(page, cas.slots);
      const B = r.boites;

      const titre = B.filter(b => (b.tag === 'texte' && RE_TITRE.test(b.s)) || b.tag === 'logo');
      const aide = B.filter(b => b.tag === 'texte' && RE_AIDE.test(b.s));
      const version = B.filter(b => b.tag === 'texte' && RE_VERSION.test(b.s));
      const heros = B.filter(b => b.tag === 'heros');
      const bete = B.filter(b => b.tag === 'bete');
      const menuTxt = B.filter(b => b.tag === 'texte' &&
        !RE_TITRE.test(b.s) && !RE_AIDE.test(b.s) && !RE_VERSION.test(b.s));
      // le panneau du menu : le plus grand rectangle de la teinte de `panneau()`
      const pan = B.filter(b => b.tag === 'fill' && /12, 14, 28/.test(b.s))
                   .sort((a, b) => b.w * b.h - a.w * a.h)[0];
      const lune = B.filter(b => b.tag === 'lune');

      const ctx = `${r.W}×${r.H} interne`;
      v(`${cas.nom} — un panneau de menu est bien dessiné`, !!pan, ctx);
      if (!pan) { await page.context().close(); continue; }

      const paires = [
        ['le menu ne recouvre pas le titre', titre, [pan]],
        ['la bête ne recouvre pas le titre', titre, bete],
        ['le menu ne recouvre pas le héros', heros, [pan]],
        ['le titre ne recouvre pas le héros', heros, titre],
        ['le menu ne recouvre pas l\'aide du bas', aide, [pan]],
        ['le titre ne recouvre pas l\'aide du bas', aide, [...titre, ...bete]],
        ['la version ne recouvre pas la lune', version, lune],
      ];
      for (const [quoi, as, bs] of paires) {
        const n = Math.round(recouvrement(as, bs));
        v(`${cas.nom} — ${quoi}`, n === 0, `${n} px² de recouvrement (${ctx})`);
      }

      /* Le texte du menu doit tenir DANS son panneau, et avec de l'air : la
         largeur était figée à 212 px alors que « PIERRES 3/3   LUCIOLES 8/8
         209:00 » en fait 209 — le résumé ne débordait pas, il TOUCHAIT les deux
         bords, ce qui se lit comme un débordement. On exige 6 px de marge. */
      const marge = Math.min(...menuTxt.map(b =>
        Math.min(b.x - pan.x, (pan.x + pan.w) - (b.x + b.w))));
      v(`${cas.nom} — le menu respire dans son panneau`, marge >= 6,
        `${marge} px de marge, 6 attendus (${ctx})`);

      /* Tout doit rester dans le canevas : un titre trop large déborderait. */
      const hors = [...titre, ...aide, ...menuTxt, ...version]
        .filter(b => b.x < 0 || b.x + b.w > r.W || b.y < 0 || b.y + b.h > r.H);
      v(`${cas.nom} — rien ne sort du canevas`, hors.length === 0,
        hors.map(b => `${b.s} en ${b.x},${b.y}`).join(' | ') + ` (${ctx})`);

      v(`${cas.nom} — aucune erreur JS`, page.erreursJS.length === 0, page.erreursJS[0]);
      await page.context().close();
    }

    /* --------- LE CIEL : des étoiles dispersées, pas des rangées ---------
       Elles étaient posées en `(i*79)%W, (i*47)%(hor-14)` : deux modulos de pas
       constant, donc des arcs et une rangée horizontale bien visible. Le
       premier remède — `hash()` — était pire : il ne rend que la moitié basse
       de sa plage pour de petites entrées, et les 110 étoiles se tassaient dans
       le quart haut-gauche. On mesure donc l'occupation des quatre quarts. */
    {
      const page = await pageDeJeu(navigateur, { largeur: 1512, hauteur: 760 });
      const r = await releverBoites(page, [1, 0, 0]);
      const ciel = r.hor - 14;
      const etoiles = r.boites.filter(b => b.tag === 'fill' && /^rgba\((210|255)/.test(b.s));
      v('le ciel a bien ses étoiles', etoiles.length >= 100, String(etoiles.length));
      const quarts = (vals, max) => {
        const c = [0, 0, 0, 0];
        vals.forEach(x => c[Math.min(3, Math.floor(x / max * 4))]++);
        return c;
      };
      const qx = quarts(etoiles.map(b => b.x), r.W);
      const qy = quarts(etoiles.map(b => b.y), ciel);
      const mini = Math.round(etoiles.length / 4 * 0.5);   // au moins la moitié de l'attendu
      v('LES ÉTOILES OCCUPENT TOUTE LA LARGEUR DU CIEL',
        Math.min(...qx) >= mini, `quarts en x : ${qx.join('/')} (attendu ≥ ${mini} chacun)`);
      v('LES ÉTOILES OCCUPENT TOUTE LA HAUTEUR DU CIEL',
        Math.min(...qy) >= mini, `quarts en y : ${qy.join('/')} (attendu ≥ ${mini} chacun)`);
      /* Une rangée parfaitement horizontale est le symptôme visible : aucune
         ordonnée ne doit rassembler plus d'un dixième des étoiles. */
      const parY = new Map();
      etoiles.forEach(b => parY.set(b.y, (parY.get(b.y) || 0) + 1));
      const pire = Math.max(...parY.values());
      v('AUCUNE RANGÉE D\'ÉTOILES ALIGNÉES',
        pire <= Math.ceil(etoiles.length / 10),
        `${pire} étoiles sur la même ligne (max toléré ${Math.ceil(etoiles.length / 10)})`);

      /* Les deux contrôles ci-dessus restaient VERTS avec le motif d'origine :
         `(i*79)%W` et `(i*47)%(hor-14)` ont des pas premiers avec leur modulo,
         donc ils remplissent uniformément les quatre quarts et ne répètent
         aucune ordonnée. Ce qu'ils dessinent, c'est un TREILLIS : d'une étoile à
         la suivante, le déplacement est toujours le même vecteur — ce sont ces
         arcs et ces diagonales qu'on voyait. On mesure donc le pas lui-même. */
      const pas = new Map();
      for (let i = 1; i < etoiles.length; i++) {
        const k = ((etoiles[i].x - etoiles[i - 1].x + r.W) % r.W) + ':' +
                  ((etoiles[i].y - etoiles[i - 1].y + ciel) % ciel);
        pas.set(k, (pas.get(k) || 0) + 1);
      }
      const pasDominant = Math.max(...pas.values());
      v('LES ÉTOILES NE SUIVENT PAS UN PAS CONSTANT',
        pasDominant <= Math.ceil(etoiles.length / 10),
        `${pasDominant} des ${etoiles.length - 1} écarts sont le même vecteur ` +
        `(max toléré ${Math.ceil(etoiles.length / 10)}) — c'est un treillis, pas un ciel`);
      await page.context().close();
    }
  },
};
