'use strict';
/* CORRECTIFS.md § 29, § 30, § 32 et § 33 — la troisième région, les icônes
   de butin, le journal qui n'affichait qu'un tiers, et la difficulté.

   Mesuré avant correctif : les Cimes Gelées étaient la région la PLUS VASTE du
   jeu (5 954 cases praticables) et la plus vide — 6,2 créatures pour mille
   cases contre 12,9 dans la vallée, aucun personnage à qui parler, aucun
   coffre, une seule chose à ramasser. On y marchait des minutes sans rien
   rencontrer.

   Et neuf butins de quête — dont le BOOMERANG, le trésor de cette région-là —
   étaient dessinés au sol avec le sprite de la FLÈCHE. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Cimes enrichies, et les icônes de butin',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};

      /* ---------- densité : la montagne au niveau de ses voisines ---------- */
      const densite = (y0, y1) => {
        let sol = 0;
        for (let y = y0; y < y1; y++) for (let x = 0; x < MW; x++) if (libre(x, y)) sol++;
        const n = ennemis.filter(e => e.y >= y0 * TS && e.y < y1 * TS).length;
        return { sol, n, d: +(n / (sol / 1000)).toFixed(2) };
      };
      out.cimes = densite(Y_CIMES, Y_LAGON);
      out.vallee = densite(0, Y_CENDRE);
      out.marais = densite(Y_MARAIS, Y_NUES);
      out.sables = densite(Y_SABLES, Y_MARAIS);

      /* ---------- la faune de chaque région reste chez elle ----------
         Le tirage du Marais couvrait 240 rangées au lieu de 80 : follets,
         crapauds et ombres naissaient jusque dans la Faille. */
      const FAUNE = { cimes: ['loup', 'piquier', 'harpie'],
                      marais: ['follet', 'crapaud', 'ombre'],
                      nues: ['aigle', 'tourbillon', 'golemnuage'],
                      faille: ['echo', 'echonoir'] };
      out.egares = {};
      for (const [reg, types] of Object.entries(FAUNE))
        out.egares[reg] = ennemis.filter(e => types.includes(e.type) && regionDe(e.y) !== reg).length;

      /* ---------- le Refuge du Col et Borve ---------- */
      const borve = pnjs.find(p => p.id === 'guide');
      out.borveExiste = !!borve;
      out.borveDansLesCimes = borve ? regionDe(borve.y) === 'cimes' : false;
      out.borveEnPaix = borve ? !!dansRefuge(borve.x, borve.y) : false;
      out.refugeCabane = structures.some(s => s.spr === 'refugecol');
      // on doit pouvoir se tenir devant lui : rien de dur sur les cases voisines
      if (borve) {
        const bx = Math.floor(borve.x / TS), by = Math.floor(borve.y / TS);
        let durs = 0;
        for (let y = by - 1; y <= by + 1; y++) for (let x = bx - 1; x <= bx + 1; x++) {
          const o = Obj(x, y);
          if (o && DUR_O[o] && !FRANCH_O[o]) durs++;
        }
        out.autourDeBorve = durs;
      }

      /* ---------- les six fleurs de givre ---------- */
      const fleurs = () => butins.filter(b => b.type === 'fleurgivre');
      out.nbFleurs = fleurs().length;
      out.fleursDansLesCimes = fleurs().every(f => regionDe(f.y) === 'cimes');
      out.fleursSurSolLibre = fleurs().every(f =>
        libre(Math.floor(f.x / TS), Math.floor(f.y / TS)));

      /* ---------- la Crevasse : l'énigme de la région ---------- */
      const c = CIMES.crevasse;
      out.crevasseEstUneSalle = !!salleDe((c.x0 + 2) * TS, (c.y0 + 5) * TS);
      // le trésor est bien dans l'alcôve, et il existe tant qu'on ne l'a pas
      out.tresorPose = butins.some(b => b.type === 'coeurmax'
        && Math.floor(b.x / TS) === TRESOR_CIMES[0] && Math.floor(b.y / TS) === TRESOR_CIMES[1]);
      // une barrière de blocs bleus ferme l'alcôve, un interrupteur l'ouvre
      let blocs = 0, inters = 0, glacons = 0, vide = 0;
      for (let y = c.y0; y < c.y0 + c.h; y++) for (let x = c.x0; x < c.x0 + c.w; x++) {
        const o = Obj(x, y);
        if (o === O.BLOCB) blocs++;
        if (o === O.INTER) inters++;
        if (o === O.GLACON) glacons++;
        if (Sol(x, y) === S.VIDE) vide++;
      }
      out.crevasse = { blocs, inters, glacons, vide };

      /* L'ÉNIGME TIENT-ELLE, ET SE RÉSOUT-ELLE ?
         Un premier jet ne vérifiait que « le cristal est hors d'atteinte » —
         et restait VERT même la crevasse comblée, parce que les glaçons
         suffisaient à eux seuls. On sépare donc les deux rôles, et surtout on
         va jusqu'au bout : la salle doit être FRANCHISSABLE, sinon le cœur de
         cristal était posé là sans que personne puisse jamais le prendre. */
      /* On interroge la collision DU JEU (`solide`), pas une table : les blocs
         à bascule ne sont pas durs dans `DUR_O`, leur solidité se décide à la
         volée selon l'interrupteur. Un premier jet réimplémentait la règle et
         traversait donc allègrement la barrière bleue. */
      const marcheDepuis = (sx, sy) => {
        const passable = (x, y) => {
          if (x < c.x0 || x >= c.x0 + c.w || y < c.y0 || y >= c.y0 + c.h) return false;
          if (Sol(x, y) === S.VIDE) return false;
          return !solide(x * TS + 8, y * TS + 8, 0);
        };
        const vus = new Set([sy * MW + sx]); const f = [[sx, sy]];
        while (f.length) {
          const [x, y] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy, k = ny * MW + nx;
            if (vus.has(k) || !passable(nx, ny)) continue;
            vus.add(k); f.push([nx, ny]);
          }
        }
        return vus;
      };
      const ENTREE = [c.x0 + 2, c.y0 + c.h - 2];
      const caseInter = () => {
        for (let y = c.y0; y < c.y0 + c.h; y++) for (let x = c.x0; x < c.x0 + c.w; x++)
          if (Obj(x, y) === O.INTER) return [x, y];
        return null;
      };
      const jointDepuis = (vus, [x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .some(([dx, dy]) => vus.has((y + dy) * MW + x + dx));
      {
        const vus = marcheDepuis(ENTREE[0], ENTREE[1]);
        // 1. la crevasse coupe : la rive lointaine est hors d'atteinte à pied
        out.riveInaccessible = ![...Array(c.w - 2).keys()]
          .some(i => vus.has((c.y0 + 4) * MW + c.x0 + 1 + i));
        /* 2. et le trésor aussi — mais mesuré depuis l'entrée, ce contrôle est
           vrai à cause de la seule crevasse : il restait VERT la barrière bleue
           retirée. C'est donc DEPUIS LA RIVE LOINTAINE qu'il faut regarder, là
           où la barrière est la seule chose qui reste entre le cœur et soi. */
        out.tresorFermeDepuisRive =
          !marcheDepuis(c.x0 + 6, c.y0 + 5).has(TRESOR_CIMES[1] * MW + TRESOR_CIMES[0]);
        // 3. une ancre attend sur la rive lointaine, pour le grappin
        out.ancreRiveLointaine = Obj(c.x0 + 6, c.y0 + 4) === O.ANCRE;
        out.ancreRetour = Obj(c.x0 + 1, c.y0 + 9) === O.ANCRE;
      }
      {
        /* 4. UNE FOIS PASSÉ au grappin, l'interrupteur reste emmuré : c'est la
           glace, et elle seule, qui oblige au boomerang. */
        const vusRive = marcheDepuis(c.x0 + 6, c.y0 + 5);
        out.interEmmureMemeApresPassage = !jointDepuis(vusRive, caseInter());
      }
      {
        /* 5. LA SALLE SE TERMINE. On rejoue la solution : le boomerang brise
           les glaçons, bascule le cristal, la barrière tombe — et depuis la
           rive lointaine on atteint le cœur, puis l'ancre du retour. */
        const [ix, iy] = caseInter();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (Obj(ix + dx, iy + dy) === O.GLACON) { putO(ix + dx, iy + dy, O.RIEN); }
        }
        basculerInter(ix, iy);
        const vusRive = marcheDepuis(c.x0 + 6, c.y0 + 5);
        out.tresorAtteintApresBascule = vusRive.has(TRESOR_CIMES[1] * MW + TRESOR_CIMES[0]);
        basculerInter(ix, iy);       // on remet la salle comme on l'a trouvée
      }
      {
        /* 6. ON TRAVERSE VRAIMENT — au grappin, dans le vrai jeu. On ne
           regarde pas si l'ancre existe : on lance le grappin et on regarde où
           le héros ATTERRIT. Marcher jusqu'à l'ancre serait impossible, c'est
           bien pour cela qu'il y a un grappin. */
        Q.grappin = true;
        if (!J.objets.includes('grappin')) J.objets.push('grappin');
        const yRive = c.y0 + 4, yBord = c.y0 + 7;
        const tirer = (tx, ty, dir) => {
          J.x = tx * TS + 8; J.y = ty * TS + 8; J.z = 0; J.vz = 0;
          J.dir = dir; J.grap = null; J.invuln = 9999; J.pv = J.pvmax;
          lancerGrappin();
          if (!J.grap) return null;
          for (let i = 0; i < 120 && J.grap; i++) majJoueur();
          return [Math.floor(J.x / TS), Math.floor(J.y / TS)];
        };
        // depuis la rive proche, face au nord : on doit finir sur la rive lointaine
        const aller = tirer(c.x0 + 6, yBord + 1, 0);
        out.grappinTraverse = !!aller && aller[1] <= yRive + 1 && aller[1] >= c.y0 + 1;
        out.ouArrive = aller ? aller.join(',') : 'raté';
        // depuis la rive lointaine, face au sud : on doit revenir
        const retour = tirer(c.x0 + 1, yRive + 1, 2);
        out.grappinRamene = !!retour && retour[1] >= yBord;
        out.ouRevient = retour ? retour.join(',') : 'raté';
      }

      /* ---------- la glace glisse ----------
         On pousse le héros vers l'est pendant un moment sur de la glace, puis
         on LÂCHE tout : sur la neige il s'arrête net, sur la glace il continue.
         On mesure les deux, sinon « il a bougé » ne prouve rien. */
      const glisser = async (sol) => {
        // une piste bien plate de 12 cases
        const y = Y_CIMES + 40, x0 = 20;
        for (let x = x0 - 2; x < x0 + 14; x++) for (let dy = -1; dy <= 1; dy++) {
          putS(x, y + dy, sol); putO(x, y + dy, O.RIEN); putE(x, y + dy, 0);
        }
        prerendreSol();
        ennemis.length = 0; tirs.length = 0;
        J.x = x0 * TS + 8; J.y = y * TS + 8; J.z = 0; J.vz = 0;
        J.gx = 0; J.gy = 0; J.kx = 0; J.ky = 0; J.invuln = 9999; J.pv = J.pvmax;
        // on pousse plein est pendant 40 images
        for (let i = 0; i < 40; i++) { axe.x = 1; axe.y = 0; majJoueur(); }
        const xLache = J.x;
        // puis plus rien pendant 40 images
        for (let i = 0; i < 40; i++) { axe.x = 0; axe.y = 0; majJoueur(); }
        axe.x = 0; axe.y = 0;
        return +(J.x - xLache).toFixed(2);
      };
      out.derapeSurGlace = await glisser(S.GLACE);
      out.sarreteSurNeige = await glisser(S.NEIGE);

      /* ---------- les icônes de butin ----------
         On rejoue le choix de sprite de la boucle de rendu, pour tous les
         types de butin que le jeu sait poser. Aucun ne doit retomber sur
         'fleche' — et aucun ne doit viser un sprite absent. */
      const typesPoses = ['boomerang', 'palmes', 'grappin', 'bracelet', 'fanal', 'cape',
        'fresque', 'perle2', 'coeurmax', 'filet', 'fleurgivre', 'cle', 'coeur',
        'bombe', 'champi', 'eclat', 'fleche'];
      out.enFleche = typesPoses.filter(t => t !== 'fleche' && (SPR_BUTIN[t] || 'fleche') === 'fleche');
      out.sansSprite = typesPoses.filter(t => !SPR[SPR_BUTIN[t] || 'fleche']);
      out.papillonsOntUnSprite = [0, 1, 2, 3, 4, 5, 6, 7].every(i => !!SPR['papillon' + i]);

      /* ---------- LE JOURNAL DIT-IL VRAIMENT TOUT ? ----------
         Mesuré sur un canevas de téléphone, une partie avancée écrivait 69
         lignes dont 21 seulement tenaient à l'écran : 48 perdues, en silence.
         On exige donc que CHAQUE quête ait sa ligne, et que le défilement
         permette de descendre jusqu'à la dernière. */
      {
        const tout = {};
        for (const k of Object.keys(Q)) {
          const v0 = Q[k];
          tout[k] = typeof v0 === 'boolean' ? true : typeof v0 === 'number' ? 9
                  : Array.isArray(v0) ? v0.map(() => 1) : v0;
        }
        razQuetes(); Object.assign(Q, tout);
        J.objets = ['arc', 'bombe', 'marteau', 'boomerang', 'grappin', 'bracelet',
                    'fanal', 'cape', 'filet'];
        const texte = lignesJournal().map(l => l[0]).join(' | ');
        out.journalCouvre = ['CABINET DES HUIT', 'FLEURS DE BORVE', 'CREVASSE',
          'CŒURS DE CRISTAL', 'FILET', 'CLOCHES DE GIVRE', 'VEILLEUSES',
          'CARILLONS', 'PERLES', 'FRESQUES', 'LUCIOLES', 'BRASIERS', 'SCEAUX']
          .filter(m => !texte.includes(m));

        /* on pilote le VRAI écran : SELECT ouvre, BAS descend */
        journal = true; journalDefil = 0;
        ecranJournal();
        const hautDebut = journalDefil;
        for (let i = 0; i < 400; i++) { journalDefil += 2.2; ecranJournal(); }
        out.defileVersLeBas = journalDefil > hautDebut;
        const fond = journalDefil;
        for (let i = 0; i < 400; i++) { journalDefil += 2.2; ecranJournal(); }
        out.defilementBorne = Math.abs(journalDefil - fond) < 0.01;
        // et l'on remonte
        for (let i = 0; i < 900; i++) { journalDefil -= 2.2; ecranJournal(); }
        out.remonteAZero = journalDefil === 0;
        journal = false; journalDefil = 0;
      }

      /* ---------- le bilan de fin compte les Cimes ----------
         `Q.cloches>=5` ne pouvait jamais être vrai : elles sont trois. */
      razQuetes();
      const vide0 = bilanComplétion();
      Object.assign(Q, { cloches: 3 });
      const avecCloches = bilanComplétion();
      const ligne = b => b.find(l => l[0] === 'QUÊTES ANNEXES')[1];
      out.bilanSansCloches = ligne(vide0);
      out.bilanAvecCloches = ligne(avecCloches);
      out.bilanAOutils = bilanComplétion().some(l => l[0] === 'ARMES ET OUTILS');
      out.bilanAPapillons = bilanComplétion().some(l => l[0] === 'PAPILLONS');
      return out;
    });

    v('LA MONTAGNE N\'EST PLUS LA RÉGION VIDE DU JEU',
      r.cimes.d >= 10, `${r.cimes.n} créatures sur ${r.cimes.sol} cases = ${r.cimes.d}/1000`);
    v('elle soutient la comparaison avec la vallée',
      r.cimes.d >= r.vallee.d * 0.7, `cimes ${r.cimes.d} vs vallée ${r.vallee.d}`);
    v('le Marais et les Sables ne sont plus des déserts',
      r.marais.d >= 9 && r.sables.d >= 9, `marais ${r.marais.d}, sables ${r.sables.d}`);
    v('CHAQUE FAUNE RESTE DANS SA RÉGION',
      Object.values(r.egares).every(n => n === 0), JSON.stringify(r.egares));

    v('BORVE TIENT LE REFUGE DU COL',
      r.borveExiste && r.borveDansLesCimes, 'absent des Cimes');
    v('le refuge est une zone de paix', r.borveEnPaix);
    v('et la cabane se voit', r.refugeCabane);
    v('on peut se planter devant lui', r.autourDeBorve === 0, 'obstacles : ' + r.autourDeBorve);

    v('SIX FLEURS DE GIVRE SONT POSÉES', r.nbFleurs === 6, 'trouvées : ' + r.nbFleurs);
    v('toutes dans les Cimes, sur du sol franc',
      r.fleursDansLesCimes && r.fleursSurSolLibre);

    v('LA CREVASSE EST UNE SALLE CLOSE', r.crevasseEstUneSalle);
    /* Trois glaçons, et non quatre : le quatrième côté du cristal est la
       barrière bleue elle-même. C'est la mesure qui l'a dit. */
    v('elle a sa barrière, son cristal, sa glace et son vide',
      r.crevasse.blocs > 5 && r.crevasse.inters === 1
      && r.crevasse.glacons === 3 && r.crevasse.vide > 5, JSON.stringify(r.crevasse));
    v('LA CREVASSE COUPE VRAIMENT LA SALLE EN DEUX',
      r.riveInaccessible, 'on passe à pied : la crevasse ne sert à rien');
    v('MÊME SUR LA RIVE LOINTAINE, LA BARRIÈRE TIENT LE CŒUR ENFERMÉ',
      r.tresorFermeDepuisRive, 'l\'alcôve est ouverte : la barrière ne sert à rien');
    v('une ancre attend sur la rive lointaine, et une pour revenir',
      r.ancreRiveLointaine && r.ancreRetour,
      `aller ${r.ancreRiveLointaine}, retour ${r.ancreRetour}`);
    v('MÊME PASSÉ, LE CRISTAL RESTE EMMURÉ DE GLACE (d\'où le boomerang)',
      r.interEmmureMemeApresPassage, 'la glace ne protège rien');
    v('LA CREVASSE SE TERMINE : LE CŒUR EST ATTEIGNABLE',
      r.tresorAtteintApresBascule, 'trésor injoignable — posé pour personne');
    v('LE GRAPPIN FAIT VRAIMENT TRAVERSER', r.grappinTraverse, 'arrivé en ' + r.ouArrive);
    v('ET IL RAMÈNE (sinon on reste scellé de l\'autre côté)',
      r.grappinRamene, 'revenu en ' + r.ouRevient);
    v('le cœur de cristal de la Crevasse est bien posé', r.tresorPose);

    v('LA GLACE FAIT DÉRAPER', r.derapeSurGlace > 4,
      `glissade après relâchement : ${r.derapeSurGlace} px`);
    v('LA NEIGE, NON', r.sarreteSurNeige < 1.5,
      `sur neige : ${r.sarreteSurNeige} px`);

    v('PLUS AUCUN BUTIN N\'EST DESSINÉ EN FLÈCHE',
      r.enFleche.length === 0, 'encore en flèche : ' + r.enFleche.join(', '));
    v('chaque butin vise un sprite qui existe',
      r.sansSprite.length === 0, 'sprite absent : ' + r.sansSprite.join(', '));
    v('les huit papillons ont le leur', r.papillonsOntUnSprite);

    v('LE JOURNAL A UNE LIGNE POUR CHAQUE QUÊTE',
      r.journalCouvre.length === 0, 'rien sur : ' + r.journalCouvre.join(', '));
    v('IL DÉFILE (sinon la moitié est illisible sur un téléphone)', r.defileVersLeBas);
    v('et il s\'arrête au bas du texte', r.defilementBorne, 'on défile dans le vide');
    v('on remonte jusqu\'en haut', r.remonteAZero);

    v('LE BILAN DE FIN COMPTE ENFIN LES CLOCHES',
      r.bilanSansCloches !== r.bilanAvecCloches,
      `sans : ${r.bilanSansCloches}, avec : ${r.bilanAvecCloches}`);
    v('et il montre les outils et les papillons',
      r.bilanAOutils && r.bilanAPapillons);

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS.join(' | '));
    await page.context().close();
  },
};
