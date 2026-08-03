'use strict';
/* CORRECTIFS.md § 2.1 et 2.3 — la manette débordait des écrans étroits,
   et les boutons d'outils recouvraient le HUD. */
const fs = require('fs');
const path = require('path');
const { pageDeJeu } = require('./outils');

module.exports = {
  nom: 'Affichage mobile',
  async executer({ navigateur, v }) {
    for (const largeur of [320, 360, 375, 390, 414]) {
      const page = await pageDeJeu(navigateur, { largeur, hauteur: 780, mobile: true });

      // § 2.1 — rien ne doit dépasser horizontalement
      const m = await page.evaluate(() => {
        const pad = document.getElementById('pad');
        let lo = Infinity, hi = -Infinity;
        for (const el of pad.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width && r.height) { lo = Math.min(lo, r.left); hi = Math.max(hi, r.right); }
        }
        return { innerW: window.innerWidth, lo, hi };
      });
      v(`${largeur}px : la manette tient dans l'écran`,
        m.lo >= -0.5 && m.hi <= m.innerW + 0.5, `[${m.lo.toFixed(1)}..${m.hi.toFixed(1)}] pour ${m.innerW}px`);

      // § 2.3 — les boutons ne doivent pas mordre sur le HUD (rubis + étoiles)
      const h = await page.evaluate(() => {
        const st = document.getElementById('stage').getBoundingClientRect();
        const ou = document.getElementById('outils').getBoundingClientRect();
        const ech = st.width / W;
        const hud = { x: st.left + (W - 92) * ech, y: st.top + 2 * ech, w: 92 * ech, h: 18 * ech };
        const inter = Math.max(0, Math.min(hud.x + hud.w, ou.right) - Math.max(hud.x, ou.left))
                    * Math.max(0, Math.min(hud.y + hud.h, ou.bottom) - Math.max(hud.y, ou.top));
        return Math.round(inter);
      });
      v(`${largeur}px : les boutons ne couvrent pas le HUD`, h === 0, `${h}px² recouverts`);

      /* Les gâchettes L/R s'accrochaient : leur marge tactile mordait sur le
         stick et les boutons de façade. On mesure les rectangles réellement
         sensibles (le pseudo-élément ::after), pas les boutons visibles. */
      const zones = await page.evaluate(() => {
        const marge = el => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el, '::after');
          const px = v => parseFloat(v) || 0;
          return { haut: r.top - px(s.top) * 0, // les insets sont relatifs à l'élément
                   t: r.top + px(s.top), b: r.bottom - px(s.bottom),
                   g: r.left + px(s.left), d: r.right - px(s.right) };
        };
        const chevauche = (a, b) =>
          Math.max(0, Math.min(a.d, b.d) - Math.max(a.g, b.g)) *
          Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
        const L = marge(document.getElementById('bL'));
        const R = marge(document.getElementById('bR'));
        const stick = document.getElementById('stickZone').getBoundingClientRect();
        const zs = { t: stick.top, b: stick.bottom, g: stick.left, d: stick.right };
        const faces = [...document.querySelectorAll('.fb')].map(marge);
        return {
          surStick: Math.round(chevauche(L, zs) + chevauche(R, zs)),
          surBoutons: Math.round(faces.reduce((n, f) => n + chevauche(L, f) + chevauche(R, f), 0)),
          hauteurL: Math.round(L.b - L.t),
        };
      });
      v(`${largeur}px : L/R ne mordent pas sur le stick`,
        zones.surStick === 0, `${zones.surStick}px² de recouvrement`);
      v(`${largeur}px : L/R ne mordent pas sur les boutons`,
        zones.surBoutons === 0, `${zones.surBoutons}px² de recouvrement`);
      v(`${largeur}px : L/R restent confortables à toucher`,
        zones.hauteurL >= 18, `${zones.hauteurL}px de haut`);

      v(`${largeur}px : aucune erreur JS`, page.erreursJS.length === 0, page.erreursJS[0]);
      await page.context().close();
    }

    /* Icône : déclarée, et surtout réellement chargeable. Une balise qui pointe
       vers un fichier absent laisse l'onglet sans icône sans rien signaler. */
    {
      const page = await pageDeJeu(navigateur);
      const liens = await page.evaluate(() =>
        [...document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"],link[rel="manifest"]')]
          .map(l => ({ rel: l.getAttribute('rel'), href: l.getAttribute('href') })));
      v('l\'icône est déclarée', liens.some(l => /icon/.test(l.rel)), JSON.stringify(liens));
      v('l\'icône d\'écran d\'accueil est déclarée',
        liens.some(l => l.rel === 'apple-touch-icon'), 'absente');

      /* Chaque fichier référencé doit exister sur le disque. On le vérifie ici
         plutôt que par fetch() : la page est ouverte en file://, où le
         navigateur refuse les requêtes. */
      for (const l of liens) {
        const f = path.resolve(__dirname, '..', l.href);
        const existe = fs.existsSync(f) && fs.statSync(f).size > 0;
        v(`${l.href} existe`, existe, 'fichier absent ou vide');
      }
      // le manifeste doit être un JSON valide et pointer des icônes existantes
      try {
        const m = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'manifest.webmanifest'), 'utf8'));
        const toutes = (m.icons || []).every(i => fs.existsSync(path.resolve(__dirname, '..', i.src)));
        v('le manifeste est valide et ses icônes existent',
          !!m.name && (m.icons || []).length > 0 && toutes, JSON.stringify(m.icons));
      } catch (e) { v('le manifeste est valide et ses icônes existent', false, e.message); }

      // l'image doit vraiment se décoder (un SVG malformé ne lèverait rien ici)
      const dessinable = await page.evaluate(() => new Promise(res => {
        const i = new Image();
        i.onload = () => res(i.width > 0 && i.height > 0);
        i.onerror = () => res(false);
        i.src = 'icone.svg';
      }));
      v('l\'icône se décode comme image', dessinable, 'illisible');

      /* ---------- § 62 : le README des tests dit-il la vérité ? ----------
         Il annonce « ce que couvre chaque fichier ». Onze fichiers n'y
         figuraient pas — ajoutés au fil des livraisons, jamais inscrits. Un
         sommaire incomplet est pire qu'absent : on le croit. */
      const dossier = path.resolve(__dirname);
      const fichiers = fs.readdirSync(dossier)
        .filter(f => /^\d\d-.*\.js$/.test(f)).sort();
      const readme = fs.readFileSync(path.join(dossier, 'README.md'), 'utf8');
      const listes = [...readme.matchAll(/^\| `([0-9a-z-]+\.js)`/gm)].map(m => m[1]);
      const absents = fichiers.filter(f => !listes.includes(f));
      const orphelines = listes.filter(f => !fichiers.includes(f));
      v('CHAQUE FICHIER DE TEST FIGURE DANS LE README',
        absents.length === 0, `absents : ${absents.join(', ')}`);
      v('et le README ne décrit aucun fichier disparu',
        orphelines.length === 0, `orphelines : ${orphelines.join(', ')}`);
      v('les lignes du sommaire sont dans l\'ordre des numéros',
        listes.every((f, i) => i === 0 || parseInt(f) >= parseInt(listes[i - 1])),
        listes.join(' '));
      await page.context().close();
    }
  },
};
