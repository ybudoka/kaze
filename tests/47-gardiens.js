'use strict';
/* CORRECTIFS.md § 63 — les sept gardiens : une règle chacun, et une escalade.

   Mesuré avant refonte, en coups d'épée nue : 17, 15, 19, —, 16, 18, 30. Le
   DEUXIÈME gardien était plus facile que le premier et les cinq du milieu se
   valaient à un coup près. Il n'y avait pas de courbe, juste sept sacs de
   points de vie, dont un seul (le Colosse) imposait quoi que ce soit.

   Deux choses se mesurent ici, et la seconde est la plus importante :

   1. l'ESCALADE — l'indice de difficulté croît STRICTEMENT, gardien après
      gardien ; sans ce contrôle on y retombe en trois livraisons ;
   2. la RÈGLE de chacun — et chaque fois son inverse, sinon « il encaisse »
      ne prouverait rien. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Les sept gardiens : règles et escalade',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(() => {
      const out = {};
      const ORDRE = ['coeur', 'yeti', 'kraken', 'colosse', 'reine', 'sentinelle', 'rongeur'];

      /* ---- 1) L'ESCALADE ---- */
      out.table = ORDRE.map(id => ({ id, ...GARDIENS[id], indice: indiceGardien(GARDIENS[id]) }));
      out.croissante = out.table.every((g, i) => i === 0 || g.indice > out.table[i - 1].indice);
      out.numerotation = out.table.every((g, i) => g.n === i + 1);
      // les trois composantes ne doivent jamais reculer non plus
      out.coupsCroissants = out.table.every((g, i) => i === 0 || g.coups >= out.table[i - 1].coups
                                                     || g.regles > out.table[i - 1].regles);
      out.deg = out.table.map(g => g.deg);
      out.regles = out.table.map(g => g.regles);

      /* ---- les points de vie SUIVENT la table, ils ne sont plus écrits à la main ---- */
      const REV = { coeur: reveillerCoeur, yeti: reveillerYeti, kraken: reveillerLeviathan,
                    colosse: reveillerColosse, reine: reveillerReine,
                    sentinelle: reveillerSentinelle, rongeur: reveillerRongeur };
      out.pv = {};
      for (const id of ORDRE) { boss = null; REV[id]();
        out.pv[id] = boss ? [boss.pvmax, pvGardien(id)] : null; boss = null; }

      /* ---- 2) LE CŒUR : chaque coup le chauffe, chaud il est impénétrable ---- */
      boss = null; reveillerCoeur();
      {
        const B = boss;
        // vie imprenable : sinon le martelage l'abat et la mesure suivante lit
        // un boss disparu au lieu d'un boss fermé
        B.pv = 9999; B.pvmax = 9999;
        B.chaleur = 0; B.flash = 0;
        out.coeurFroidEncaisse = frapper(B, 2, B.x - 20, B.y, 'epee') === true;
        // on le martèle : il doit finir par se fermer tout seul
        let coups = 0;
        for (let k = 0; k < 12 && B.chaleur < COEUR_SEUIL; k++) { B.flash = 0; frapper(B, 2, B.x - 20, B.y, 'epee'); coups++; }
        out.coupsAvantFermeture = coups;
        B.flash = 0;
        out.coeurChaudRefuse = frapper(B, 2, B.x - 20, B.y, 'epee') === false;
        // il refroidit tout seul
        const c0 = B.chaleur;
        for (let k = 0; k < 200; k++) majCoeur();
        out.coeurRefroidit = B.chaleur < c0;
        B.chaleur = 0; B.flash = 0;
        out.coeurRouvert = frapper(B, 2, B.x - 20, B.y, 'epee') === true;
        // et il brûle deux fois plus au contact quand il est chaud
        const degats = (chaud) => { B.chaleur = chaud ? 99 : 0; J.pvmax = 40; J.pv = 40; J.invuln = 0;
          J.x = B.x + 10; J.y = B.y; J.z = B.z; B.stun = 0; B.phase = 'attente';
          majCoeur(); return 40 - J.pv; };
        out.degatFroid = degats(false); out.degatChaud = degats(true);
        boss = null;
      }

      /* ---- 3) LE YÉTI : le blizzard le dérobe, sauf en pleine charge ---- */
      boss = null; reveillerYeti();
      {
        const B = boss; B.stun = 0;
        B.phase = 'attente'; B.flash = 0;
        out.yetiCache = frapper(B, 2, B.x - 20, B.y, 'epee') === false;
        B.phase = 'charge'; B.flash = 0;
        out.yetiEnCharge = frapper(B, 2, B.x - 20, B.y, 'epee') === true;
        B.phase = 'attente'; B.stun = 40; B.flash = 0;
        out.yetiSonne = frapper(B, 2, B.x - 20, B.y, 'epee') === true;
        boss = null;
      }

      /* ---- 4) LE LÉVIATHAN : seulement à la résurgence ---- */
      boss = null; reveillerLeviathan();
      {
        const B = boss; B.stun = 0; B.invincible = 0;
        B.surface = 0; B.flash = 0;
        out.krakenSousLEau = frapper(B, 2, B.x - 20, B.y, 'epee') === false;
        B.surface = 60; B.flash = 0;
        out.krakenEnSurface = frapper(B, 2, B.x - 20, B.y, 'epee') === true;
        // la fenêtre se referme d'elle-même
        B.surface = 3; B.invincible = 0; B.phase = 'attente';
        for (let k = 0; k < 10; k++) majKraken();
        out.fenetreSeReferme = !(B.surface > 0);
        boss = null;
      }

      /* ---- 5) LE RONGEUR : il dévore un outil par palier, et rend tout ---- */
      boss = null; reveillerRongeur();
      {
        const B = boss;
        J.objets = ['arc', 'bombe', 'marteau', 'boomerang']; J.equipe = { Y: 'arc', X: 'bombe' };
        const av = J.objets.length;
        /* On FRANCHIT les paliers pour de vrai, en baissant sa vie et en
           laissant `majRongeur()` faire son travail. Une première version
           appelait `devorerUnOutil()` à la main : retirer son appel du
           franchissement — c'est-à-dire supprimer la règle — laissait le
           contrôle vert. */
        const auPalier = (frac) => { B.pv = Math.max(1, Math.round(B.pvmax * frac)); majRongeur(); };
        J.invuln = 99999;
        auPalier(1);                                  // on note le palier de départ
        auPalier(.70);                                // palier 2 : il prend
        out.volPremier = { avant: av, apres: J.objets.length, ventre: (B.vole || []).length };
        auPalier(.50); auPalier(.30);                 // paliers 3 et 4 : il reprend
        out.volTrois = { restant: J.objets.length, ventre: (B.vole || []).length };
        // aucune fente ne pointe sur un outil disparu
        out.fentesPropres = FENTES.every(f => !J.equipe[f] || J.objets.includes(J.equipe[f]));
        auPalier(.10);                                // palier 5 : il recrache tout
        out.toutRendu = J.objets.length === av && (B.vole || []).length === 0;
        // ... et il ne peut pas prendre l'épée : elle n'est pas dans le sac
        J.objets = []; if (B.vole) B.vole.length = 0; devorerUnOutil(B);
        out.epeeIntouchable = (B.vole || []).length === 0;
        boss = null;
      }
      return out;
    });

    const noms = r.table.map(g => `${g.n}.${g.id} ${g.indice}`).join('  ');
    v('LES SEPT GARDIENS SONT NUMÉROTÉS DE 1 À 7', r.numerotation, noms);
    v('L\'INDICE DE DIFFICULTÉ CROÎT STRICTEMENT, GARDIEN APRÈS GARDIEN',
      r.croissante, noms);
    v('les dégâts ne reculent jamais',
      r.deg.every((d, i) => i === 0 || d >= r.deg[i - 1]), r.deg.join(' '));
    v('le nombre de RÈGLES ne recule jamais non plus',
      r.regles.every((x, i) => i === 0 || x >= r.regles[i - 1]), r.regles.join(' '));
    v('les points de vie suivent la table, ils ne sont plus écrits à la main',
      Object.values(r.pv).every(p => p && p[0] === p[1]), JSON.stringify(r.pv));

    v('LE CŒUR ENCAISSE À FROID',
      r.coeurFroidEncaisse, 'il refuse même froid');
    v('LE MARTELER LE FERME : CHAQUE COUP LE CHAUFFE',
      r.coupsAvantFermeture >= 2 && r.coupsAvantFermeture <= 6 && r.coeurChaudRefuse,
      `${r.coupsAvantFermeture} coups avant fermeture, refuse=${r.coeurChaudRefuse}`);
    v('il refroidit tout seul, et se rouvre',
      r.coeurRefroidit && r.coeurRouvert,
      `refroidit=${r.coeurRefroidit} rouvert=${r.coeurRouvert}`);
    v('ET IL BRÛLE DEUX FOIS PLUS QUAND IL EST CHAUD',
      r.degatChaud === r.degatFroid * 2 && r.degatFroid > 0,
      `froid ${r.degatFroid} → chaud ${r.degatChaud}`);

    v('LE BLIZZARD DÉROBE LE YÉTI',
      r.yetiCache, 'on le touche à travers la neige');
    v('IL NE S\'OFFRE QU\'EN PLEINE CHARGE, OU SONNÉ',
      r.yetiEnCharge && r.yetiSonne,
      `charge=${r.yetiEnCharge} sonné=${r.yetiSonne}`);

    v('LE LÉVIATHAN NE SE TOUCHE PAS SOUS L\'EAU', r.krakenSousLEau, 'touché à tout moment');
    v('IL NE S\'OFFRE QU\'À LA RÉSURGENCE', r.krakenEnSurface, 'même à la résurgence, rien');
    v('et la fenêtre se referme d\'elle-même', r.fenetreSeReferme, 'elle reste ouverte');

    v('LE RONGEUR DÉVORE UN OUTIL PAR PALIER',
      r.volPremier.apres === r.volPremier.avant - 1 && r.volPremier.ventre === 1,
      JSON.stringify(r.volPremier));
    v('au quatrième palier il ne reste presque rien',
      r.volTrois.restant === 1 && r.volTrois.ventre === 3, JSON.stringify(r.volTrois));
    v('aucune fente ne pointe sur un outil disparu', r.fentesPropres, 'une fente garde un fantôme');
    v('ET IL REND TOUT AU DERNIER PALIER', r.toutRendu, 'le sac ne revient pas');
    v('il ne peut pas prendre l\'épée', r.epeeIntouchable, 'il a mangé la lame');
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
