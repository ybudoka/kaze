'use strict';
/* CORRECTIFS.md § 2.1 et 2.3 — la manette débordait des écrans étroits,
   et les boutons d'outils recouvraient le HUD. */
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

      v(`${largeur}px : aucune erreur JS`, page.erreursJS.length === 0, page.erreursJS[0]);
      await page.context().close();
    }
  },
};
