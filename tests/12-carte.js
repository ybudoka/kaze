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
        /* La colporteuse est de passage : elle ajoute une entrée à la légende,
           et c'est l'entrée la plus large. Le pied de page doit tenir AVEC. */
        marchand.actif = true; marchand.x = 36 * TS; marchand.y = (Y_CENDRE + 22) * TS;

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

    /* ================== LISIBILITÉ : LES COULEURS ==========================
       Une carte se lit d'un coup d'œil ou ne se lit pas. On mesure l'écart
       perceptif (ΔE*ab, sur les vraies teintes de `miniCV`) entre toutes les
       teintes qui SE CÔTOIENT dans une même région : sous ΔE 10, deux couleurs
       voisines ne se distinguent plus sur un pixel. L'ancienne palette
       descendait à 4,3 — le mur gris se fondait dans la roche des Cimes, et il
       couvrait 10 à 18 % de chaque région. */
    {
      const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
      await nouvellePartie(page);
      const r = await page.evaluate(() => {
        const lin = u => (u <= .04045 ? u / 12.92 : Math.pow((u + .055) / 1.055, 2.4));
        const f = t => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116));
        const lab = (R, G, B) => {
          const r = lin(R / 255), g = lin(G / 255), b = lin(B / 255);
          const X = (r * .4124 + g * .3576 + b * .1805) / .95047;
          const Y = (r * .2126 + g * .7152 + b * .0722);
          const Z = (r * .0193 + g * .1192 + b * .9505) / 1.08883;
          return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
        };
        const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        const hex = c => '#' + c.toString(16).padStart(6, '0');

        const HR = Math.floor(MH / NB_REGIONS);
        const img = miniCV.getContext('2d', { willReadFrequently: true })
                          .getImageData(0, 0, MW, MH).data;
        const coul = (x, y) => { const k = (y * MW + x) * 4;
          return { hex: hex((img[k] << 16) | (img[k + 1] << 8) | img[k + 2]),
                   lab: lab(img[k], img[k + 1], img[k + 2]) }; };
        let pireInterne = null, pireRegions = null, pireBarrage = null;
        const moyennes = [];
        for (let i = 0; i < NB_REGIONS; i++) {
          const cpt = new Map(); let R = 0, G = 0, B = 0;
          for (let y = i * HR; y < (i + 1) * HR; y++) for (let x = 0; x < MW; x++) {
            const k = (y * MW + x) * 4;
            R += img[k]; G += img[k + 1]; B += img[k + 2];
            const c = (img[k] << 16) | (img[k + 1] << 8) | img[k + 2];
            cpt.set(c, (cpt.get(c) || 0) + 1);
          }
          const tot = HR * MW;
          moyennes.push({ nom: NOMS_REGION[i], lab: lab(R / tot, G / tot, B / tot) });
          // on ne compare que ce qui pèse : une teinte à trois tuiles ne gêne personne
          const cols = [...cpt.entries()].filter(([, n]) => n / tot >= 0.002)
            .map(([c, n]) => ({ hex: hex(c), part: n / tot,
                                lab: lab((c >> 16) & 255, (c >> 8) & 255, c & 255) }));
          for (let a = 0; a < cols.length; a++) for (let b = a + 1; b < cols.length; b++) {
            const d = dE(cols[a].lab, cols[b].lab);
            if (!pireInterne || d < pireInterne.d) pireInterne = { d, region: NOMS_REGION[i],
              a: cols[a].hex, b: cols[b].hex, pa: cols[a].part, pb: cols[b].part };
          }

          /* Le compte des teintes ci-dessus a un angle mort : deux choses
             peintes EXACTEMENT pareil ne font plus qu'une seule teinte, et la
             collision disparaît du relevé. On repart donc de l'ÉTAT DU JEU —
             ce qui barre le passage d'un côté, le sol où l'on marche de
             l'autre — pour aller lire la couleur réellement dessinée de
             chacun. C'est le cas qui comptait : un mur qui se fond dans la
             roche efface la seule chose que la carte doive dire. */
          const barre = new Map(), marche = new Map();
          for (let y = i * HR; y < (i + 1) * HR; y++) for (let x = 0; x < MW; x++) {
            const o = objs[y * MW + x];
            const cible = (DUR_O[o] && !FRANCH_O[o]) ? barre : marche;
            const c = coul(x, y);
            const e = cible.get(c.hex) || { n: 0, lab: c.lab };
            e.n++; cible.set(c.hex, e);
          }
          for (const [hb, eb] of barre) { if (eb.n / tot < 0.005) continue;
            for (const [hm, em] of marche) { if (em.n / tot < 0.01) continue;
              const d = dE(eb.lab, em.lab);
              if (!pireBarrage || d < pireBarrage.d) pireBarrage = { d, region: NOMS_REGION[i],
                bloc: hb, sol: hm, pb: eb.n / tot, pm: em.n / tot };
            } }
        }
        for (let a = 0; a < NB_REGIONS; a++) for (let b = a + 1; b < NB_REGIONS; b++) {
          const d = dE(moyennes[a].lab, moyennes[b].lab);
          if (!pireRegions || d < pireRegions.d)
            pireRegions = { d, a: moyennes[a].nom, b: moyennes[b].nom };
        }
        return { pireInterne, pireRegions, pireBarrage };
      });

      const pi = r.pireInterne;
      v('AUCUNE TEINTE DE LA CARTE N\'EN IMITE UNE AUTRE DANS SA RÉGION',
        pi.d >= 12,
        `${pi.region} : ${pi.a} (${(pi.pa * 100).toFixed(1)} %) × ${pi.b} `
        + `(${(pi.pb * 100).toFixed(1)} %) — ΔE ${pi.d.toFixed(1)}, il en faut 12`);
      const pb = r.pireBarrage;
      v('CE QUI BARRE LE PASSAGE NE SE CONFOND AVEC AUCUN SOL',
        pb.d >= 12,
        `${pb.region} : obstacle ${pb.bloc} (${(pb.pb * 100).toFixed(1)} %) × sol `
        + `${pb.sol} (${(pb.pm * 100).toFixed(1)} %) — ΔE ${pb.d.toFixed(1)}, il en faut 12`);
      v('les huit régions ne se ressemblent pas en vignette',
        r.pireRegions.d >= 15,
        `${r.pireRegions.a} × ${r.pireRegions.b} — ΔE ${r.pireRegions.d.toFixed(1)}`);
      v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
      await page.context().close();
    }

    /* ================== LISIBILITÉ : LES CLIGNOTEMENTS =====================
       Un repère fait deux pixels : sa teinte ne suffit pas à dire ce que c'est.
       On relève le clignotement RÉELLEMENT dessiné, région par région, et on
       vérifie que les familles se distinguent par la FORME du battement — pas
       seulement par sa vitesse. L'ancienne carte n'avait qu'un motif, le carré
       à 50 %, décliné en périodes 20, 30, 36 et 40 : quatre vitesses trop
       voisines pour se départager d'un coup d'œil. */
    {
      const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
      await nouvellePartie(page);
      const r = await page.evaluate(async () => {
        /* Tout est à trouver : c'est le cas où la carte porte le plus de
           familles de repères à la fois. */
        for (let i = 0; i < vu.length; i++) vu[i] = 1;
        Q.lucioles = 0; Q.chefTue = false; Q.lanterne = 1; Q.portailOuvert = true;
        Q.boomerang = false; Q.palmes = false; Q.bracelet = false; Q.fanal = false;
        Q.cape = false; Q.perles = 0; Q.fresques = 0;
        marchand.actif = true; marchand.x = 20 * TS; marchand.y = 20 * TS;
        etat = 'carte';

        /* Le décor passe DERRIÈRE le voile de la carte, et ses torches ont leur
           propre scintillement : le neutraliser, sinon on compterait le monde
           parmi les repères. */
        const vraiMonde = window.rendreMonde, vraiFill = X.fillRect.bind(X);
        window.rendreMonde = () => {};
        const suites = new Map();
        let cap = false;
        X.fillRect = function (x, y, w, h) {
          if (cap && w <= 8 && h <= 8) {
            const k = Math.round(x) + ',' + Math.round(y);
            if (!suites.has(k)) suites.set(k, []);
            suites.get(k).push(String(X.fillStyle));
          }
          return vraiFill(x, y, w, h);
        };
        const N = 240, T0 = tick;
        // les familles sont réparties sur les huit régions : on les visite toutes
        for (let reg = 0; reg < NB_REGIONS; reg++) {
          carteRegion = reg;
          for (let t = 0; t < N; t++) { tick = T0 + t; cap = true; ecranCarte(); cap = false; }
        }
        window.rendreMonde = vraiMonde; X.fillRect = vraiFill;

        /* Une suite de couleurs alternées = un motif. On en tire la période, le
           taux d'allumage et le nombre de fronts : trois grandeurs que l'œil
           sait comparer, et qui ne dépendent pas de la phase du relevé. */
        const motifs = new Map();
        for (const s of suites.values()) {
          if (s.length < N) continue;
          const uniq = [...new Set(s.slice(0, N))];
          if (uniq.length !== 2) continue;                 // ni fixe, ni dégradé
          const m = s.slice(0, N).map(c => (c === uniq[0] ? '1' : '0')).join('');
          let p = N;
          for (let q = 2; q <= 120; q++) { let ok = true;
            for (let i = 0; i + q < N; i++) if (m[i] !== m[i + q]) { ok = false; break; }
            if (ok) { p = q; break; } }
          const un = m.slice(0, p).split('').filter(c => c === '1').length;
          let fronts = 0;
          for (let i = 0; i < p; i++) if (m[i] !== m[(i + 1) % p]) fronts++;
          // le « vif » et le « terne » dépendent de l'ordre de première apparition
          const duty = Math.max(un, p - un) / p;
          motifs.set(`${p}/${duty.toFixed(3)}/${fronts}`, { p, duty, fronts });
        }
        const liste = [...motifs.values()].sort((a, b) => a.p - b.p);

        /* Deux rythmes se distinguent si leur période varie d'un quart, ou leur
           taux d'allumage de 15 points, ou leur nombre de fronts. */
        const trop = [];
        for (let a = 0; a < liste.length; a++) for (let b = a + 1; b < liste.length; b++) {
          const A = liste[a], B = liste[b];
          const dP = Math.abs(A.p - B.p) / Math.max(A.p, B.p);
          if (dP < .25 && Math.abs(A.duty - B.duty) < .15 && A.fronts === B.fronts)
            trop.push(`${A.p}/${(A.duty * 100).toFixed(0)}%/${A.fronts}f ≈ `
                    + `${B.p}/${(B.duty * 100).toFixed(0)}%/${B.fronts}f`);
        }
        return { liste, trop };
      });

      const resume = r.liste.map(m => `${m.p} pas ${(m.duty * 100).toFixed(0)} % ${m.fronts}f`).join(' · ');
      v('CHAQUE FAMILLE DE REPÈRES A SON PROPRE RYTHME',
        r.liste.length >= 6, `${r.liste.length} motifs distincts : ${resume}`);
      v('DEUX RYTHMES NE SE RESSEMBLENT JAMAIS',
        r.trop.length === 0, r.trop.join(' · ') + '  (' + resume + ')');
      v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
      await page.context().close();
    }
  },
};
