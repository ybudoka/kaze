'use strict';
/* CORRECTIFS.md § 42 — l'écran de fin se recouvrait lui-même.

   Même maladie que l'écran-titre au § 39, et jamais soignée ici : le bilan
   descendait du HAUT (`H*.30`, puis des décalages fixes) tandis que le menu
   montait du BAS (`H-32-n*14`). Aucun des deux ne connaissait l'autre. Dès que
   la hauteur interne tombe sous ~300 px — un téléphone COUCHÉ donne 620×180 —
   ils se traversaient : « REPRENDRE LA SAUVEGARDE » s'imprimait par-dessus
   « PARTIE : … », « CHOISIR UN EMPLACEMENT » par-dessus la ligne des pierres,
   et « START POUR CHOISIR » par-dessus « PROGRESSION CONSERVÉE ».

   On ne teste pas la formule de mise en page : on RELÈVE ce qui est réellement
   dessiné pendant une image d'écran de fin, on en fait des boîtes, et on mesure
   l'aire d'intersection. Une future mise en page qui recouvrirait autrement
   rougira tout autant. */
const { pageDeJeu } = require('./outils');

/* Résolutions internes à balayer. `redim()` borne la largeur à 200..620 et la
   hauteur à 168..420 : on prend les bords et ce qu'il y a entre.
   168 et 180 sont le budget vertical d'un téléphone en paysage — le cas qui a
   cassé ; 280 celui d'un téléphone en portrait. */
const LARGEURS = [200, 240, 300, 346, 420, 620];
const HAUTEURS = [168, 180, 200, 240, 280, 340, 398, 420];

/* Fenêtres réelles, pour vérifier que le balayage ci-dessus couvre bien ce que
   le vrai jeu produit — et non des résolutions imaginaires. */
const FENETRES = [
  { nom: '414×900 (téléphone portrait)', l: 414, h: 900 },
  { nom: '900×400 (téléphone paysage)', l: 900, h: 400 },
  { nom: '844×390 (téléphone paysage)', l: 844, h: 390 },
  { nom: '1512×760 (écran large et bas)', l: 1512, h: 760 },
  { nom: '320×480 (petit écran)', l: 320, h: 480 },
];

const RE_SOUS = /^(LA VALLÉE|LES TROIS)/;
const RE_BILAN = /^(PARTIE|PIERRES|LUCIOLES|TEMPS|RUBIS|PROGRESSION)/;
const RE_MENU = /^(REPRENDRE|CHOISIR|REJOUER|NOUVELLE)/;
const RE_LEGENDE = /^START POUR/;

const aire = (a, b) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const recouvrement = (as, bs) =>
  as.reduce((s, a) => s + bs.reduce((t, b) => t + aire(a, b), 0), 0);

/* Relève d'UNE image d'écran de fin. `texte`, `panneau`, `fillRect` et
   `drawImage` sont détournés le temps d'un appel à `ecranFin()`, puis rendus.
   `ecranFin` commence par redessiner le monde : le dernier remplissage plein
   écran est le voile, tout ce qui suit appartient à la surcouche. On remet donc
   la relève à zéro à chaque remplissage plein écran. */
async function relever(page, cas) {
  return page.evaluate(async ({ w, h, gagne, occupe }) => {
    for (let i = 0; i < NB_SLOTS; i++)
      resumes[i] = (occupe && i === emplacement)
        ? { nom: 'LEA', temps: 3600, fragments: 2, lucioles: 6 } : null;
    nomPartie = 'LEA';
    etat = gagne ? 'victoire' : 'mort';
    finT = VERROU_FIN + 10;      // titre posé, bilan et menu affichés
    tick = 0;                    // la légende clignote : on la force visible
    menuSel = 0;
    if (w) setRes(w, h, 1);

    const b = [];
    let releve = false;
    const vTexte = window.texte, vPanneau = window.panneau;
    const vFill = X.fillRect.bind(X), vDraw = X.drawImage.bind(X);
    window.texte = (g, s, x, y, ...a) => {
      if (releve && g === X)
        b.push({ tag: 'texte', s: String(s), x, y, w: largeurTexte(s), h: 8 });
      return vTexte(g, s, x, y, ...a);
    };
    window.panneau = (g, x, y, lw, lh) => {
      if (releve && g === X) b.push({ tag: 'panneau', s: 'panneau', x, y, w: lw, h: lh });
      return vPanneau(g, x, y, lw, lh);
    };
    X.fillRect = (x, y, lw, lh) => {
      if (lw >= W - 1 && lh >= H - 1) { releve = true; b.length = 0; }   // le voile
      else if (releve && /40, ?52, ?92/.test(String(X.fillStyle)))
        b.push({ tag: 'surbrillance', s: 'surbrillance', x, y, w: lw, h: lh });
      return vFill(x, y, lw, lh);
    };
    X.drawImage = (...a) => {
      // les lettres du titre : des glyphes 5×7 redimensionnés
      if (a.length === 5 && a[0] && a[0].width === 5 && a[0].height === 7)
        b.push({ tag: 'titre', s: 'titre', x: a[1], y: a[2], w: a[3], h: a[4] });
      // la ronde d'étoiles de la victoire
      if (a.length === 5 && a[0] === SPR.etoile)
        b.push({ tag: 'etoile', s: 'etoile', x: a[1], y: a[2], w: a[3], h: a[4] });
      return vDraw(...a);
    };
    try { ecranFin(gagne); }
    finally {
      window.texte = vTexte; window.panneau = vPanneau;
      X.fillRect = vFill; X.drawImage = vDraw;
    }
    return { W, H, boites: b };
  }, cas);
}

/* Les contrôles appliqués à une relève. Renvoie la liste des reproches. */
function verifier(r) {
  const B = r.boites;
  const titre = B.filter(b => b.tag === 'titre');
  const etoiles = B.filter(b => b.tag === 'etoile');
  const sous = B.filter(b => b.tag === 'texte' && RE_SOUS.test(b.s));
  const bilan = B.filter(b => b.tag === 'texte' && RE_BILAN.test(b.s));
  const menu = B.filter(b => b.tag === 'texte' && RE_MENU.test(b.s));
  const legende = B.filter(b => b.tag === 'texte' && RE_LEGENDE.test(b.s));
  const pan = B.filter(b => b.tag === 'panneau');
  const surbril = B.filter(b => b.tag === 'surbrillance');

  const reproches = [];
  const dit = (quoi, as, bs) => {
    const n = Math.round(recouvrement(as, bs));
    if (n > 0) reproches.push(`${quoi} : ${n} px²`);
  };
  const haut = [...titre, ...sous, ...bilan];
  const bas = [...menu, ...legende, ...surbril];
  dit('le menu recouvre le bilan', haut, bas);
  dit('le menu recouvre le panneau du bilan', pan, bas);
  dit('le titre recouvre le bilan', titre, [...sous, ...bilan, ...pan]);
  dit('les étoiles recouvrent le titre', etoiles, titre);
  dit('la légende recouvre le menu', legende, [...menu, ...surbril]);

  // rien ne doit sortir du canevas
  const hors = [...titre, ...etoiles, ...sous, ...bilan, ...menu, ...legende, ...pan]
    .filter(b => b.x < -0.5 || b.x + b.w > r.W + 0.5 || b.y < 0 || b.y + b.h > r.H);
  if (hors.length) reproches.push('hors canevas : ' +
    hors.map(b => `${b.s} en ${Math.round(b.x)},${Math.round(b.y)}`).join(', '));

  // le bilan doit tenir DANS son panneau : une ligne orpheline sous la boîte se
  // lit comme un débordement (« PROGRESSION CONSERVÉE » l'était)
  if (pan.length && bilan.length) {
    const p = pan[0];
    const debord = bilan.filter(b =>
      b.x < p.x + 4 || b.x + b.w > p.x + p.w - 4 || b.y < p.y + 2 || b.y + b.h > p.y + p.h);
    if (debord.length) reproches.push('hors du panneau : ' +
      debord.map(b => b.s).join(', '));
  }

  // le titre et le menu doivent être là : un contrôle vert sur un écran vide
  // ne vaut rien
  if (!titre.length) reproches.push('aucun titre dessiné');
  if (!menu.length) reproches.push('aucune entrée de menu dessinée');
  if (!pan.length) reproches.push('aucun panneau de bilan dessiné');
  return reproches;
}

module.exports = {
  nom: 'Écran de fin : rien ne recouvre rien',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await page.evaluate(async () => {
      for (let i = 0; i < NB_SLOTS; i++) await stockEffacer(i);
      nouvellePartie('LEA', 0);
      await new Promise(r => setTimeout(r, 350));
      J.fragments = 2; Q.lucioles = 6; J.rubis = 240;
    });

    /* ---- contrôle à blanc : la mesure sait-elle dire « ça se recouvre » ? ----
       On superpose deux boîtes connues et on vérifie que l'aire n'est pas nulle.
       Sans cela, un `recouvrement()` qui renverrait toujours 0 rendrait TOUS les
       contrôles ci-dessous verts. */
    v('la mesure sait détecter un recouvrement',
      recouvrement([{ x: 0, y: 0, w: 10, h: 10 }], [{ x: 5, y: 5, w: 10, h: 10 }]) === 25,
      'la comparaison est aveugle');
    v('la mesure sait détecter une absence de recouvrement',
      recouvrement([{ x: 0, y: 0, w: 10, h: 10 }], [{ x: 20, y: 20, w: 10, h: 10 }]) === 0,
      'la comparaison voit des recouvrements partout');

    /* ---- balayage de toutes les résolutions internes possibles ---- */
    let pires = [];
    let n = 0;
    for (const w of LARGEURS) for (const h of HAUTEURS)
      for (const gagne of [false, true]) for (const occupe of [true, false]) {
        const r = await relever(page, { w, h, gagne, occupe });
        n++;
        const rep = verifier(r);
        if (rep.length) pires.push(
          `${w}×${h} ${gagne ? 'VICTOIRE' : 'GAME OVER'}, ` +
          `${occupe ? '2' : '1'} entrée(s) : ${rep.join(' | ')}`);
      }
    v(`AUCUN RECOUVREMENT SUR LES ${n} MISES EN PAGE POSSIBLES`,
      pires.length === 0, pires.slice(0, 6).join('\n      → ') +
      (pires.length > 6 ? `\n      → (+${pires.length - 6} autres)` : ''));
    await page.context().close();

    /* ---- et sur de vraies fenêtres, pour ancrer le balayage au réel ---- */
    for (const f of FENETRES) {
      const p = await pageDeJeu(navigateur, { largeur: f.l, hauteur: f.h });
      await p.evaluate(async () => {
        for (let i = 0; i < NB_SLOTS; i++) await stockEffacer(i);
        nouvellePartie('LEA', 0);
        await new Promise(r => setTimeout(r, 350));
        J.fragments = 2; Q.lucioles = 6; J.rubis = 240;
      });
      for (const gagne of [false, true]) {
        const r = await relever(p, { w: 0, h: 0, gagne, occupe: true });
        const rep = verifier(r);
        v(`${f.nom} → ${r.W}×${r.H} — ${gagne ? 'VICTOIRE' : 'GAME OVER'} lisible`,
          rep.length === 0, rep.join(' | '));
      }
      v(`${f.nom} — aucune erreur JS`, p.erreursJS.length === 0, p.erreursJS[0]);
      await p.context().close();
    }
  },
};
