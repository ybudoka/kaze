'use strict';
/* CORRECTIFS.md § 65 — la manière dont les gardiens attaquent.

   MESURE AVANT REFONTE, en dépouillant les sept fonctions `maj*` :

     7/7  marchaient droit sur le héros
     6/7  lâchaient la MÊME gerbe radiale (N tirs en rond, angle de départ tiré
          au hasard)
     5/7  chargeaient en ligne droite
     3/7  appelaient « 2 sbires à 30 px, direction au hasard »
     0/7  occupaient plus d'une tuile, 0/7 volaient vraiment (deux flottaient de
          dix pixels, ce qui ne change rien à ce qu'on fait pour les éviter)

   Sept gardiens, donc, mais un seul répertoire. Ce contrôle mesure ce qu'un
   joueur voit : COMMENT chacun se déplace, et à QUOI ressemble ce qu'il jette.
   Pas les noms de phases — la façon dont les pixels bougent.

   Chaque affirmation est mesurée à l'endroit où elle peut être fausse, et les
   deux briques nouvelles (la brèche d'une onde, le tir qui poursuit) ont leur
   contrôle à blanc : sans lui, « la brèche protège » ne prouverait rien, un
   anneau qui ne blesse jamais donnerait le même vert. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Les gestes des gardiens : un répertoire par gardien',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    /* ============ A. LE DÉPLACEMENT ============
       Chaque gardien est laissé libre 1200 images, le héros immobile et
       invulnérable, et l'on relève ce qui se voit : où il passe, à quelle
       hauteur, par quels à-coups. */
    const A = await page.evaluate(() => {
      const REV = { coeur: reveillerCoeur, yeti: reveillerYeti, kraken: reveillerLeviathan,
                    colosse: reveillerColosse, reine: reveillerReine,
                    sentinelle: reveillerSentinelle, rongeur: reveillerRongeur };
      const out = {};
      for (const id of Object.keys(REV)) {
        _s = 20260803;                       // le tirage est reproductible : même course à chaque fois
        boss = null; ennemis.length = 0; tirs.length = 0; ondes.length = 0;
        REV[id]();
        const B = boss;
        B.pv = 999999; B.pvmax = 999999;     // il ne doit pas mourir pendant la mesure
        /* Le héros est posé EN BIAIS, jamais sur la même ligne que le gardien.
           Aligné, un gardien qui marcherait droit sur lui se déplacerait sur un
           axe : le contrôle « la Sentinelle ne va que sur un axe » serait alors
           vert pour tout le monde. Mesuré : réinjecté avec le héros aligné, un
           déplacement diagonal restait vert ; en biais, il rougit. */
        J.x = B.x + 70; J.y = B.y + 46; J.z = baseSol(J.x, J.y);
        const m = { vmax: 0, lents: 0, images: 0, hautMax: -999, basMin: 999,
                    tuiles: new Set(), poingLoin: 0, sauts: 0,
                    axiales: 0, diagonales: 0, tourne: 0, distMin: 1e9, distMax: 0,
                    corpsTuiles: 0, phases: {} };
        let px = B.x, py = B.y, angPrec = null, cumul = 0;
        for (let f = 0; f < 1200; f++) {
          J.invuln = 99999; J.pv = pvTotal();
          majBoss();
          const dxp = B.x - px, dyp = B.y - py, pas = Math.hypot(dxp, dyp);
          px = B.x; py = B.y;
          m.images++;
          m.vmax = Math.max(m.vmax, pas);
          if (pas < .35) m.lents++;
          if (pas > 24) m.sauts++;                        // un déplacement de plus d'une tuile et demie en une image
          const sol = baseSol(B.x, B.y);
          m.hautMax = Math.max(m.hautMax, B.z - sol);
          m.basMin = Math.min(m.basMin, B.z - sol);
          m.tuiles.add(Math.floor(B.x / TS) + ',' + Math.floor(B.y / TS));
          m.phases[B.phase] = 1;
          // en marche : sur un axe, ou en diagonale ?
          if (pas > .3 && pas < 24) { if (Math.abs(dxp) < .02 || Math.abs(dyp) < .02) m.axiales++; else m.diagonales++; }
          // tourne-t-il AUTOUR du héros ? on cumule l'angle balayé
          const ang = Math.atan2(B.y - J.y, B.x - J.x);
          if (angPrec !== null) { let d = ang - angPrec;
            while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; cumul += d; }
          angPrec = ang;
          const dd = Math.hypot(B.x - J.x, B.y - J.y);
          m.distMin = Math.min(m.distMin, dd); m.distMax = Math.max(m.distMax, dd);
          if (B.poing && Math.hypot(B.poing.x - B.x, B.poing.y - B.y) > 50) m.poingLoin++;
          if (B.serp) { const t = new Set();
            t.add(Math.floor(B.x / TS) + ',' + Math.floor(B.y / TS));
            for (const s of B.serp.anneaux) t.add(Math.floor(s.x / TS) + ',' + Math.floor(s.y / TS));
            m.corpsTuiles = Math.max(m.corpsTuiles, t.size); }
        }
        m.tourne = Math.abs(cumul);
        m.tuiles = m.tuiles.size;
        m.phases = Object.keys(m.phases).sort();
        m.fracLents = +(m.lents / m.images).toFixed(2);
        out[id] = m;
      }
      boss = null; ennemis.length = 0;
      return out;
    });

    const d = A;
    v('LE CŒUR NE MARCHE PLUS : IL BAT — des à-coups séparés de longs repos',
      d.coeur.fracLents > .5 && d.coeur.vmax > 1.6,
      `${Math.round(d.coeur.fracLents * 100)} % d'images quasi immobiles, pointe à ${d.coeur.vmax.toFixed(1)} px/img`);
    v('LE YÉTI QUITTE LE SOL : il bondit', d.yeti.hautMax > 28,
      `il monte à ${d.yeti.hautMax.toFixed(0)} px du sol`);
    v('LE LÉVIATHAN EST UN SERPENT : SON CORPS REMPLIT PLUSIEURS TUILES',
      d.kraken.corpsTuiles >= 5, `${d.kraken.corpsTuiles} tuiles occupées au plus large`);
    v('LE COLOSSE PASSE SOUS LE SABLE', d.colosse.basMin < -10,
      `il descend à ${d.colosse.basMin.toFixed(0)} px sous le sol`);
    v('ET IL EST EN DEUX MORCEAUX : SON POING PART SEUL',
      d.colosse.poingLoin > 20, `${d.colosse.poingLoin} images le poing détaché à plus de 50 px`);
    v('LA REINE VOLE ET TOURNE AUTOUR DU HÉROS, ELLE NE VIENT JAMAIS DROIT',
      d.reine.basMin > 3 && d.reine.tourne > 6.2832,
      `jamais moins de ${d.reine.basMin.toFixed(0)} px du sol, ${(d.reine.tourne / 6.2832).toFixed(1)} tours balayés`);
    v('LA SENTINELLE EST UNE MACHINE : ELLE NE SE DÉPLACE QUE SUR UN AXE',
      d.sentinelle.axiales > 40 && d.sentinelle.diagonales === 0,
      `${d.sentinelle.axiales} images sur un axe, ${d.sentinelle.diagonales} en diagonale`);
    v('LE RONGEUR NE TRAVERSE PAS L\'ESPACE : IL CLIGNOTE',
      d.rongeur.sauts > 0, `${d.rongeur.sauts} téléportations mesurées`);

    /* Et surtout : deux gardiens n'ont pas le même répertoire. C'est ce
       contrôle-là qui empêche de retomber sur sept variantes d'un seul. */
    const rep = Object.keys(d).map(id => ({ id, r: d[id].phases.filter(p => p !== 'attente').join('+') }));
    const doublons = [];
    for (let i = 0; i < rep.length; i++) for (let j = i + 1; j < rep.length; j++)
      if (rep[i].r && rep[i].r === rep[j].r) doublons.push(`${rep[i].id}=${rep[j].id}`);
    v('AUCUN GARDIEN N\'A LE MÊME RÉPERTOIRE QU\'UN AUTRE',
      doublons.length === 0, doublons.join(' ') || rep.map(x => `${x.id}:${x.r}`).join('  '));

    /* ============ B. LA FORME DE CE QU'ILS JETTENT ============
       Avant refonte, six gerbes sur sept étaient le même objet : N tirs en
       rond, angle de départ au hasard. On mesure ici la GÉOMÉTRIE de chaque
       salve — c'est elle qui dicte ce que le joueur doit faire. */
    const B = await page.evaluate(() => {
      const out = {};
      const ecart = (a, b) => { let x = a - b; while (x > Math.PI) x -= 6.2832; while (x < -Math.PI) x += 6.2832; return x; };
      /* On force une phase, on tourne, on ramasse les tirs nés. `salve` rend
         leurs angles et leurs points de départ : rien d'autre n'est lu. */
      const salve = (rev, phase, cd, images, avant) => {
        _s = 4242; boss = null; tirs.length = 0; ondes.length = 0;
        rev(); const B = boss; B.pv = 999999; B.pvmax = 999999;
        J.x = B.x + 70; J.y = B.y; J.z = baseSol(J.x, J.y); J.invuln = 99999;
        if (avant) avant(B);
        B.phase = phase; B.cd = cd;
        const paquets = [];
        for (let f = 0; f < images; f++) {
          const n0 = tirs.length;
          J.invuln = 99999; majBoss();
          if (tirs.length > n0) paquets.push(tirs.slice(n0).map(t => ({
            a: Math.atan2(t.vy, t.vx), x: t.x, y: t.y, hom: t.hom || 0 })));
        }
        const tous = paquets.flat();
        boss = null; tirs.length = 0;
        return { paquets, tous, n: tous.length };
      };

      /* -- LE CŒUR, l'anneau troué : beaucoup de tirs d'un coup, et un secteur
            vide assez large pour qu'on y passe. -- */
      { const s = salve(reveillerCoeur, 'anneau', 43, 6);
        const plusGrosse = s.paquets.reduce((m, p) => p.length > m.length ? p : m, []);
        const angs = plusGrosse.map(p => p.a).sort((a, b) => a - b);
        let trou = 0;
        for (let k = 0; k < angs.length; k++) {
          const suiv = (k + 1 < angs.length) ? angs[k + 1] : angs[0] + 6.2832;
          trou = Math.max(trou, suiv - angs[k]);
        }
        out.anneau = { n: plusGrosse.length, trou: +trou.toFixed(2) }; }

      /* -- LE CŒUR, la spirale : les tirs sortent par paquets et l'angle
            TOURNE toujours dans le même sens. -- */
      { const s = salve(reveillerCoeur, 'spirale', 95, 90);
        let mono = 0, total = 0;
        for (let k = 1; k < s.paquets.length; k++) {
          const e = ecart(s.paquets[k][0].a, s.paquets[k - 1][0].a);
          total++; if (e > .05) mono++;
        }
        out.spirale = { paquets: s.paquets.length, tournants: mono, total }; }

      /* -- LE YÉTI, l'avalanche : un MUR. Tous les tirs dans la même
            direction, alignés, et une brèche dans l'alignement. -- */
      { const s = salve(reveillerYeti, 'avalanche', 79, 4);
        const a0 = s.tous.length ? s.tous[0].a : 0;
        const ouverture = s.tous.reduce((m, p) => Math.max(m, Math.abs(ecart(p.a, a0))), 0);
        // étendue perpendiculaire à la marche du mur, et plus grand intervalle entre voisins
        const perp = s.tous.map(p => Math.abs(Math.cos(a0)) > .5 ? p.y : p.x).sort((x, y) => x - y);
        const pas = [];
        for (let k = 1; k < perp.length; k++) pas.push(perp[k] - perp[k - 1]);
        pas.sort((x, y) => x - y);
        const median = pas.length ? pas[pas.length >> 1] : 0;
        out.avalanche = { n: s.tous.length, ouverture: +ouverture.toFixed(3),
                          etendue: perp.length ? +(perp[perp.length - 1] - perp[0]).toFixed(0) : 0,
                          plusGrandPas: pas.length ? +pas[pas.length - 1].toFixed(0) : 0,
                          pasMedian: +median.toFixed(0) }; }

      /* -- LE LÉVIATHAN, la lame : un éventail DEVANT lui, pas un rond. -- */
      { const s = salve(reveillerLeviathan, 'lame', 35, 3);
        const moy = s.tous.length ? Math.atan2(
          s.tous.reduce((t, p) => t + Math.sin(p.a), 0), s.tous.reduce((t, p) => t + Math.cos(p.a), 0)) : 0;
        const ouverture = s.tous.reduce((m, p) => Math.max(m, Math.abs(ecart(p.a, moy))), 0) * 2;
        out.lame = { n: s.tous.length, ouverture: +ouverture.toFixed(2) }; }

      /* -- LA REINE, l'essaim : ses tirs POURSUIVENT. Personne d'autre. -- */
      { const s = salve(reveillerReine, 'essaim', 99, 100);
        out.essaim = { n: s.n, poursuivants: s.tous.filter(p => p.hom > 0).length }; }

      /* -- LA SENTINELLE, la grille : des angles de MACHINE. Jamais un tirage
            au hasard — donc on peut se placer à l'avance. -- */
      { const s = salve(reveillerSentinelle, 'grille', 79, 60);
        const surGrille = s.tous.filter(p => {
          const k = p.a / .7854;                       // multiple de 45° ?
          return Math.abs(k - Math.round(k)) < .01;
        }).length;
        out.grille = { n: s.n, surGrille }; }

      /* -- LA SENTINELLE, le rayon : AUCUN tir, et pourtant ça blesse. C'est
            la seule attaque du jeu qui ne lance rien. -- */
      { _s = 77; boss = null; tirs.length = 0; reveillerSentinelle();
        const S = boss; S.pv = 999999; S.pvmax = 999999;
        S.phase = 'rayon'; S.cd = 189; S.rayon = 1; S.sens = 1; S.ray = 0;
        J.pvmax = 40; J.dores = 0; J.pv = pvTotal(); J.invuln = 0; Q.amulette = false;
        // DANS l'axe du rayon, à portée : on est touché
        J.x = S.x + 90; J.y = S.y; J.z = baseSol(J.x, J.y);
        const pv0 = J.pv; majBoss();
        const dansLAxe = pv0 - J.pv;
        // À CÔTÉ de l'axe, même distance : rien. Sans ce second relevé,
        // « le rayon blesse » ne dirait pas que c'est le rayon.
        J.invuln = 0; J.pv = pvTotal(); S.ray = 0; S.cd = 150;
        J.x = S.x; J.y = S.y + 90;
        const pv1 = J.pv; majBoss();
        const aCote = pv1 - J.pv;
        out.rayon = { tirs: tirs.length, dansLAxe, aCote };
        boss = null; tirs.length = 0; }
      return out;
    });

    v('L\'ANNEAU DU CŒUR EST DENSE, ET IL A UNE BRÈCHE',
      B.anneau.n >= 15 && B.anneau.trou > .9,
      `${B.anneau.n} braises, plus grand vide ${B.anneau.trou} rad`);
    v('SA SPIRALE TOURNE TOUJOURS DANS LE MÊME SENS',
      B.spirale.total > 8 && B.spirale.tournants === B.spirale.total,
      `${B.spirale.tournants}/${B.spirale.total} paquets tournants sur ${B.spirale.paquets}`);
    v('L\'AVALANCHE DU YÉTI EST UN MUR, PAS UNE GERBE : TOUT PART DU MÊME CÔTÉ',
      B.avalanche.n >= 8 && B.avalanche.ouverture < .01 && B.avalanche.etendue > 100,
      `${B.avalanche.n} congères, ouverture ${B.avalanche.ouverture} rad, front de ${B.avalanche.etendue} px`);
    v('et le mur a une brèche', B.avalanche.plusGrandPas >= B.avalanche.pasMedian * 1.8,
      `plus grand intervalle ${B.avalanche.plusGrandPas} px contre ${B.avalanche.pasMedian} px de pas courant`);
    v('LA LAME DU LÉVIATHAN EST UN ÉVENTAIL DEVANT LUI',
      B.lame.n >= 5 && B.lame.ouverture < 1.2,
      `${B.lame.n} lames sur ${B.lame.ouverture} rad d'ouverture`);
    v('LES LUCIOLES DE LA REINE POURSUIVENT LE HÉROS',
      B.essaim.n > 0 && B.essaim.poursuivants === B.essaim.n,
      `${B.essaim.poursuivants}/${B.essaim.n} tirs à tête chercheuse`);
    v('LA GRILLE DE LA SENTINELLE EST TOUJOURS ALIGNÉE SUR LES AXES DU MONDE',
      B.grille.n >= 8 && B.grille.surGrille === B.grille.n,
      `${B.grille.surGrille}/${B.grille.n} tirs sur un multiple de 45°`);
    v('SON RAYON NE LANCE RIEN, ET NE BLESSE QUE DANS SON AXE',
      B.rayon.tirs === 0 && B.rayon.dansLAxe > 0 && B.rayon.aCote === 0,
      `${B.rayon.tirs} tirs, dans l'axe ${B.rayon.dansLAxe} de dégâts, à côté ${B.rayon.aCote}`);

    /* ============ C. LES DEUX BRIQUES NOUVELLES ============ */
    const C = await page.evaluate(() => {
      const out = {};
      boss = null; tirs.length = 0; ondes.length = 0;
      J.pvmax = 40; J.dores = 0; Q.amulette = false;
      /* -- L'ONDE DE CHOC ET SA BRÈCHE.
         Trois relevés, dont un à blanc : au bon rayon HORS de la brèche ça
         doit blesser (sinon l'anneau ne sert à rien et les deux autres
         relevés seraient verts pour rien), au bon rayon DANS la brèche non,
         et loin du rayon non plus. */
      const relever = (angle) => {
        ondes.length = 0; J.invuln = 0; J.pv = pvTotal();
        const x0 = J.x, y0 = J.y;
        onde(x0 - Math.cos(angle) * 60, y0 - Math.sin(angle) * 60, J.z, '#fff', 2, 0, 400, 0);
        ondes[0].r = 60;                     // le front est pile sur le héros
        const pv0 = J.pv; majOndes(); return pv0 - J.pv;
      };
      out.horsBreche = relever(Math.PI);     // le héros est à l'opposé de la brèche (brèche en 0)
      out.dansBreche = relever(0);           // le héros est DANS la brèche
      { ondes.length = 0; J.invuln = 0; J.pv = pvTotal();
        onde(J.x - 60, J.y, J.z, '#fff', 2, 0, 400, 0);
        ondes[0].r = 140;                    // le front est encore loin
        const pv0 = J.pv; majOndes(); out.loin = pv0 - J.pv; }
      ondes.length = 0;

      /* -- LE TIR QUI POURSUIT, et son contrôle à blanc : le même tir sans
         `hom` doit filer tout droit. Sinon « il poursuit » ne dirait rien. */
      const courber = (hom) => {
        tirs.length = 0; J.invuln = 99999;
        // lancé à 90° du héros : s'il ne tourne pas, il ne s'en approchera jamais
        tirs.push({ x: J.x - 90, y: J.y - 90, z: J.z, vx: 2, vy: 0, vie: 300, ami: 0, spr: 'venin', hom });
        const t = tirs[0]; const a0 = Math.atan2(t.vy, t.vx);
        let d0 = Math.hypot(t.x - J.x, t.y - J.y);
        for (let f = 0; f < 30 && tirs.length; f++) majDivers();
        if (!tirs.length) return null;
        const a1 = Math.atan2(tirs[0].vy, tirs[0].vx);
        return { vire: +Math.abs(a1 - a0).toFixed(3),
                 rapproche: +(d0 - Math.hypot(tirs[0].x - J.x, tirs[0].y - J.y)).toFixed(0) };
      };
      out.poursuit = courber(.05);
      out.droit = courber(0);
      tirs.length = 0;
      return out;
    });

    v('UNE ONDE DE CHOC BLESSE QUAND SON FRONT VOUS ATTEINT',
      C.horsBreche > 0, `${C.horsBreche} de dégâts`);
    v('MAIS PAS DANS SA BRÈCHE — c\'est là toute la parade',
      C.dansBreche === 0, `${C.dansBreche} de dégâts alors qu'on est dans le trou`);
    v('CONTRÔLE À BLANC : un front encore loin ne blesse pas',
      C.loin === 0, `${C.loin} de dégâts à 140 px du front`);
    v('UN TIR À TÊTE CHERCHEUSE VIRE ET SE RAPPROCHE',
      C.poursuit && C.poursuit.vire > .5 && C.poursuit.rapproche > 0,
      JSON.stringify(C.poursuit));
    v('CONTRÔLE À BLANC : le même tir sans poursuite file tout droit',
      C.droit && C.droit.vire === 0, JSON.stringify(C.droit));

    /* ============ D. TOUT CELA SE VOIT-IL ? ============
       Un corps de serpent, un poing détaché, un rayon : rien de tout cela ne
       tient dans le sprite du gardien, tout est dessiné à la main autour. Ce
       dépôt a déjà livré sept tuiles qui occupaient une case sans poser un
       pixel (§ 58) — un danger qui blesse sans se voir serait pire. On compte
       donc les pixels posés LOIN du sprite, et à chaque fois on compare au
       même gardien privé de son extension : c'est le contrôle à blanc. */
    const D = await page.evaluate(() => {
      const out = {};
      /* On dessine par le VRAI `dessinerEnnemi`, sur une toile vide, avec le
         gardien recentré : on ne compte que ce qui déborde d'un rectangle
         large comme son sprite. */
      const compter = (B, rayonExclu) => {
        const c = document.createElement('canvas'); c.width = 320; c.height = 320;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        const ax = B.x, ay = B.y;
        g.save(); g.translate(160 - ax, 190 - ay + B.z);
        dessinerEnnemi(g, B);
        g.restore();
        const d = g.getImageData(0, 0, 320, 320).data;
        let n = 0;
        for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) {
          if (Math.abs(x - 160) < rayonExclu && Math.abs(y - 190 + 26) < rayonExclu) continue;
          if (d[(y * 320 + x) * 4 + 3] > 8) n++;
        }
        return n;
      };
      /* -- le corps du Léviathan -- */
      { _s = 5; boss = null; reveillerLeviathan(); const B = boss;
        B.pv = 99999; B.pvmax = 99999; J.x = B.x + 70; J.y = B.y + 46; J.invuln = 99999;
        for (let f = 0; f < 120; f++) majBoss();      // il faut du passé pour que le corps s'étale
        out.corps = compter(B, 40);
        const garde = B.serp; B.serp = null;          // à blanc : le même, sans corps
        out.corpsSans = compter(B, 40); B.serp = garde;
        boss = null; }
      /* -- le poing du Colosse -- */
      { _s = 5; boss = null; reveillerColosse(); const B = boss;
        B.pv = 99999; B.pvmax = 99999; J.x = B.x + 120; J.y = B.y; J.invuln = 99999;
        B.phase = 'poing'; B.cd = 57;
        for (let f = 0; f < 22; f++) majBoss();
        out.poingLoin = Math.round(Math.hypot(B.poing.x - B.x, B.poing.y - B.y));
        out.poing = compter(B, 40);
        const garde = B.poing; B.poing = null;
        out.poingSans = compter(B, 40); B.poing = garde;
        boss = null; }
      /* -- le rayon de la Sentinelle -- */
      { _s = 5; boss = null; reveillerSentinelle(); const B = boss;
        B.pv = 99999; B.pvmax = 99999; J.x = B.x + 70; J.y = B.y + 46; J.invuln = 99999;
        B.rayon = 1; B.ray = 0;
        out.rayon = compter(B, 40);
        B.rayon = 0;
        out.rayonSans = compter(B, 40);
        boss = null; }
      /* -- l'essaim de la Reine -- */
      { _s = 5; boss = null; reveillerReine(); const B = boss;
        B.pv = 99999; B.pvmax = 99999; J.x = B.x + 70; J.y = B.y + 46; J.invuln = 99999;
        out.essaim = compter(B, 18);
        for (const s of B.essaim) s.vivant = 0;
        out.essaimSans = compter(B, 18);
        boss = null; }
      /* -- une onde de choc -- */
      { ondes.length = 0; onde(0, 0, 0, '#ffffff', 2, 0, 400, 0); ondes[0].r = 70;
        const c = document.createElement('canvas'); c.width = 240; c.height = 240;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        g.save(); g.translate(120, 120); dessinerOnde(g, ondes[0]); g.restore();
        const d = g.getImageData(0, 0, 240, 240).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
        out.onde = n;
        // à blanc : une toile où l'on ne dessine rien
        const c2 = document.createElement('canvas'); c2.width = 240; c2.height = 240;
        const d2 = c2.getContext('2d').getImageData(0, 0, 240, 240).data;
        let n2 = 0; for (let i = 3; i < d2.length; i += 4) if (d2[i] > 8) n2++;
        out.ondeSans = n2; ondes.length = 0; }
      return out;
    });

    v('LE CORPS DU SERPENT SE VOIT', D.corps - D.corpsSans > 400,
      `${D.corps} pixels avec le corps, ${D.corpsSans} sans`);
    /* La BORNE HAUTE n'est pas une coquetterie : c'est elle qui a trouvé le
       défaut. Le poing part collé au tronc — mais il n'était placé qu'à la FIN
       de la mise à jour, donc après le tir : lancé à la première image, il
       partait de (0,0), à 6 111 px de son gardien, et volait vers l'arène
       depuis le coin du monde. « Il est loin » seul aurait applaudi. */
    v('LE POING DÉTACHÉ SE VOIT, LÀ OÙ IL EST — ET IL PART DU TRONC',
      D.poingLoin > 40 && D.poingLoin < 220 && D.poing - D.poingSans > 60,
      `poing à ${D.poingLoin} px du tronc, ${D.poing} pixels contre ${D.poingSans} sans lui`);
    v('LE RAYON SE VOIT', D.rayon - D.rayonSans > 400,
      `${D.rayon} pixels avec le rayon, ${D.rayonSans} sans`);
    v('L\'ESSAIM EN ORBITE SE VOIT', D.essaim - D.essaimSans > 60,
      `${D.essaim} pixels essaim plein, ${D.essaimSans} essaim vide`);
    v('L\'ONDE DE CHOC SE VOIT', D.onde > 300 && D.ondeSans === 0,
      `${D.onde} pixels, toile vide ${D.ondeSans}`);

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
