'use strict';
/* La colporteuse itinérante : elle s'installe au hasard, ne vend que ce que
   Bran n'a pas, repart au bout d'un moment — et ses achats, eux, restent. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Colporteuse itinérante',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      J.invuln = 99999;

      // au départ elle n'est pas là
      out.absenteAuDebut = !marchand.actif;

      // elle finit par s'installer, quelque part autour du héros
      out.pose = poserMarchand();
      out.actif = marchand.actif;
      const d = Math.hypot(marchand.x - J.x, marchand.y - J.y) / TS;
      out.distance = Math.round(d);
      out.dansSalle = !!salleDe(marchand.x, marchand.y);
      out.surTuileLibre = libre(Math.floor(marchand.x / TS), Math.floor(marchand.y / TS));
      out.memeRegion = enCendre(marchand.y) === enCendre(J.y);

      /* Un SEUL message à son arrivée : le bandeau et la boîte de dialogue se
         marchaient dessus, deux annonces pour un seul événement. On recompte
         en repiégeant les deux sorties de texte pendant une nouvelle pose. */
      {
        const vraiDire = window.dire, vraiAnnonce = window.annonce;
        let n = 0;
        window.dire = (t, d) => { n++; return vraiDire(t, d); };
        window.annonce = t => { n++; return vraiAnnonce(t); };
        marchand.actif = false; poserMarchand();
        window.dire = vraiDire; window.annonce = vraiAnnonce;
        out.messagesArrivee = n;
      }

      // elle vend autre chose que Bran
      const sien = articlesItinerants().map(a => a.id);
      const bran = articles().map(a => a.id);
      out.exclusifs = sien.filter(i => !bran.includes(i));
      out.communs = sien.filter(i => bran.includes(i));

      /* SES PRIX MONTENT À CHAQUE VENTE. On relève le tarif d'un article que
         l'on n'achète PAS (la potion) : s'il ne bougeait pas, c'est que la
         hausse ne touche que l'article acheté, ou rien du tout. */
      Q.achatsColporteuse = 0;
      out.prixDepart = articlesItinerants().find(a => a.id === 'potion').prix;

      // acheter chez elle : capacités augmentées
      J.objets = ['arc', 'bombe']; J.rubis = 500; J.pvmax = 6; J.pv = 6;
      out.avant = { fleches: maxFleches(), bombes: maxBombes(), pvmax: J.pvmax };
      ouvrirBoutique('itinerant');
      out.qui = boutique.qui;
      const acheterId = id => { boutique.sel = boutique.liste.findIndex(a => a.id === id); acheter(); };
      acheterId('carquois'); acheterId('sac'); acheterId('coeur');
      out.apres = { fleches: maxFleches(), bombes: maxBombes(), pvmax: J.pvmax, rubis: J.rubis };
      out.achats = Q.achatsColporteuse;
      out.prixApres = articlesItinerants().find(a => a.id === 'potion').prix;
      // et chez Bran, rien ne bouge : la hausse est la sienne, pas celle du jeu
      out.prixBran = articles().find(a => a.id === 'potion').prix;
      // un article déjà acquis ne se rachète pas — et ne fait pas monter les prix
      const avantRubis = J.rubis, avantAchats = Q.achatsColporteuse;
      acheterId('carquois');
      out.pasDeRachat = J.rubis === avantRubis && Q.achatsColporteuse === avantAchats;
      boutique = null;

      // elle finit par plier bagage
      marchand.reste = 1; tempsJeu = 100;
      majMarchand(); majMarchand();
      out.repartie = !marchand.actif;
      out.reviendra = marchand.prochain > tempsJeu;
      /* ELLE SE FAIT DÉSIRER : à une visite par minute elle n'était plus un
         événement. On veut au moins quatre minutes d'attente (60 images/s). */
      out.attente = marchand.prochain - tempsJeu;

      // ses achats survivent à une sauvegarde/rechargement
      await sauver(true); await dort(250);
      await charger(0); await dort(400);
      out.apresRechargement = { carquois: !!Q.carquois, sac: !!Q.grandSac,
                                fleches: maxFleches(), bombes: maxBombes(),
                                achats: Q.achatsColporteuse,
                                potion: articlesItinerants().find(a => a.id === 'potion').prix };
      out.absenteApresChargement = !marchand.actif;
      return out;
    });

    v('elle n\'est pas là au départ', r.absenteAuDebut, 'déjà présente');
    v('elle s\'installe', r.pose && r.actif, 'aucun emplacement trouvé');
    v('à portée de marche, sans être sur le héros',
      r.distance >= 10 && r.distance <= 30, `${r.distance} tuiles`);
    v('sur une case libre, jamais dans une salle close',
      r.surTuileLibre && !r.dansSalle, `libre=${r.surTuileLibre} salle=${r.dansSalle}`);
    v('elle reste dans ta région', r.memeRegion, 'autre région');
    v('ELLE NE VEND QUE CE QUE BRAN N\'A PAS',
      r.exclusifs.length >= 3 && r.communs.length <= 1,
      `exclusifs ${r.exclusifs.join(',')} / communs ${r.communs.join(',')}`);
    v('c\'est bien elle qui tient boutique', r.qui === 'LA COLPORTEUSE', r.qui);
    v('LE CARQUOIS AUGMENTE LA RÉSERVE DE FLÈCHES',
      r.apres.fleches > r.avant.fleches, `${r.avant.fleches} -> ${r.apres.fleches}`);
    v('LE GRAND SAC AUGMENTE CELLE DE BOMBES',
      r.apres.bombes > r.avant.bombes, `${r.avant.bombes} -> ${r.apres.bombes}`);
    v('le cœur supplémentaire ajoute de la vie',
      r.apres.pvmax > r.avant.pvmax, `${r.avant.pvmax} -> ${r.apres.pvmax}`);
    v('un article acquis ne se rachète pas', r.pasDeRachat, 'racheté et repayé');
    v('UN SEUL MESSAGE ANNONCE SON ARRIVÉE',
      r.messagesArrivee === 1, `${r.messagesArrivee} messages`);
    v('SES PRIX MONTENT À CHAQUE ACHAT CONCLU CHEZ ELLE',
      r.achats === 3 && r.prixApres > r.prixDepart,
      `${r.achats} achats, potion ${r.prixDepart} -> ${r.prixApres}`);
    v('ceux de Bran, eux, ne bougent pas', r.prixBran === 35, r.prixBran);
    v('elle finit par plier bagage et reviendra',
      r.repartie && r.reviendra, `repartie=${r.repartie} reviendra=${r.reviendra}`);
    v('ELLE SE FAIT DÉSIRER : PLUS DE QUATRE MINUTES ENTRE DEUX PASSAGES',
      r.attente > 14400, `${Math.round(r.attente / 60)} s`);
    v('SES ACHATS SURVIVENT AU RECHARGEMENT',
      r.apresRechargement.carquois && r.apresRechargement.sac
      && r.apresRechargement.fleches === 99 && r.apresRechargement.bombes === 40,
      JSON.stringify(r.apresRechargement));
    v('elle-même n\'est pas sauvegardée', r.absenteApresChargement, 'ressuscitée au chargement');
    /* Sans cela, il suffirait de recharger pour retrouver les tarifs du premier
       jour : la hausse ne tiendrait pas une sauvegarde. */
    v('LA HAUSSE DE SES PRIX SURVIT AU RECHARGEMENT',
      r.apresRechargement.achats === 3 && r.apresRechargement.potion === r.prixApres,
      JSON.stringify({ achats: r.apresRechargement.achats,
                       potion: r.apresRechargement.potion, attendu: r.prixApres }));

    /* ---------- SON KIOSQUE EST-IL VRAIMENT À L'ÉCRAN ? ----------
       On rend la scène sans elle puis avec elle, sur un terrain aplani, et on
       trie les pixels qui ont changé. On ne peut PAS chercher les couleurs
       exactes des sprites : le rendu passe par une teinte d'ambiance, et
       #B8384A arrive à l'écran en (143,48,66). On classe donc par teinte, ce
       que l'ambiance ne renverse pas. Les écarts faibles (< 60) sont écartés :
       la lueur chaude qui l'entoure barbouille déjà un carré de 66 px. */
    const vue = await page.evaluate(() => {
      const ctx = CV.getContext('2d');
      const cx = Math.floor(J.x / TS), cy = Math.floor(J.y / TS);
      // terrain plat et vide : le décor ne doit pas peser dans la mesure
      for (let y = cy - 9; y <= cy + 4; y++) for (let x = cx - 7; x <= cx + 7; x++) {
        putO(x, y, O.RIEN); putE(x, y, 0); putS(x, y, S.HERBE);
      }
      pnjs.length = 0; structures.length = 0; butins.length = 0;
      ennemis.length = 0; boss = null; lucioles.length = 0;
      prerendreSol();
      const snap = () => { tick = 1000; secousse = 0; rendreMonde();
                           return ctx.getImageData(0, 0, CV.width, CV.height).data; };
      marchand.actif = false;
      for (let i = 0; i < 200; i++) rendreMonde();      // la caméra doit converger
      // contrôle à blanc : la comparaison sait-elle dire « identiques » ?
      const a = snap(), b = snap();
      let stable = 0;
      for (let i = 0; i < a.length; i += 4)
        if (a[i] !== b[i] || a[i+1] !== b[i+1] || a[i+2] !== b[i+2]) stable++;
      /* Quatre tuiles au nord : assez loin pour que le repère clignotant
         (jaune, comme ses yeux) ne se déclenche pas et ne fausse pas le compte. */
      marchand.actif = true; marchand.anim = 0;
      marchand.x = cx * TS + 8; marchand.y = (cy - 4) * TS + 8;
      const avec = snap();
      const out = { stable, rouge: 0, bois: 0, yeux: 0, tete: 0 };
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      /* Repères, en pixels d'écran : le haut de son comptoir, et la fente de
         ses yeux. C'est là qu'on vérifie qu'elle n'est pas noyée dans son
         propre décor — un simple total, lui, resterait vert. */
      const px = Math.round(marchand.x - cam.x), py = Math.round(marchand.y - cam.y);
      for (let y = 0; y < CV.height; y++) for (let x = 0; x < CV.width; x++) {
        const i = (y * CV.width + x) * 4;
        const d = Math.abs(b[i] - avec[i]) + Math.abs(b[i+1] - avec[i+1])
                + Math.abs(b[i+2] - avec[i+2]);
        if (d <= 60) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        const R = avec[i], G = avec[i+1], B = avec[i+2];
        if (R > 100 && R > G * 1.8 && R > B * 1.5) out.rouge++;          // rayures de l'auvent
        if (R > 90 && R > G * 1.2 && G > B * 1.15 && B < 90) out.bois++; // montants, comptoir
        const violet = B > 60 && B > G * 1.25 && R > G;
        if (violet && y >= py - 32 && y < py - 16) out.tete++;            // capuche et épaules
        if (R > 180 && G > 140 && B < 130
            && y >= py - 26 && y < py - 21 && Math.abs(x - px) <= 4) out.yeux++;
      }
      out.largeur = x1 - x0 + 1; out.hauteur = y1 - y0 + 1;
      marchand.actif = false;
      return out;
    });
    v('contrôle à blanc : deux rendus identiques ne diffèrent pas',
      vue.stable === 0, `${vue.stable} pixels bougent tout seuls`);
    /* Seule, elle ne mesurait que 22 x 30. Si l'empreinte y retombe, c'est que
       le kiosque n'est plus dessiné. */
    v('ELLE OCCUPE LA PLACE D UN KIOSQUE, PAS D UNE SILHOUETTE',
      vue.largeur >= 40 && vue.hauteur >= 44, `${vue.largeur} x ${vue.hauteur} px`);
    v('L AUVENT RAYÉ EST À L ÉCRAN', vue.rouge > 120, `${vue.rouge} px de rouge`);
    v('LES MONTANTS ET LE COMPTOIR AUSSI', vue.bois > 200, `${vue.bois} px de bois`);
    /* Ces deux-là ne regardent QUE ce qui dépasse au-dessus du comptoir :
       c'est le seul moyen de voir qu'elle n'est pas noyée dans son décor. */
    v('SA CAPUCHE DÉPASSE DE SON COMPTOIR', vue.tete > 90, `${vue.tete} px de cape`);
    v('ET SON REGARD RESTE VISIBLE', vue.yeux >= 8, `${vue.yeux} px d'or dans les yeux`);

    /* ================= LA PIÈCE RARE DU BALLOT =================
       Elle sort de temps en temps une pièce que rien d'autre ne vend. On mesure
       le tirage, ce qu'elle met en rayon, et surtout les EFFETS : un drapeau
       posé dans `Q` ne prouve rien tant que le jeu ne s'en sert pas. */
    {
      const p2 = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
      await nouvellePartie(p2);
      const q = await p2.evaluate(() => {
        const out = {};
        razQuetes();

        // --- le tirage : ni jamais, ni à tous les coups ---
        let rares = 0, vus = new Set();
        for (let i = 0; i < 600; i++) { const r = tirerRare(); if (r) { rares++; vus.add(r); } }
        out.part = rares / 600;
        out.varietes = [...vus].sort();
        out.tousConnus = out.varietes.every(id => RARES.some(a => a.id === id));

        // une pièce déjà acquise ne ressort jamais
        Q.amulette = true;
        out.apresAchat = new Set(Array.from({ length: 600 }, () => tirerRare()).filter(Boolean));
        out.pasDeDoublon = !out.apresAchat.has('amulette');
        out.apresAchat = [...out.apresAchat].sort();
        // les trois acquises : elle n'a plus rien de rare à sortir
        Q.fioleFee = true; Q.rune = true;
        out.plusRien = Array.from({ length: 200 }, () => tirerRare()).every(r => r === null);
        razQuetes();

        // --- ce qu'elle met en rayon ---
        marchand.rare = 'rune';
        const liste = articlesItinerants();
        out.enTete = liste[0].id === 'rune' && liste[0].rare === true;
        out.laPlusChere = liste[0].prix > Math.max(...liste.slice(1).map(a => a.prix));
        out.dansLaListe = liste.length === articlesItinerants().length;
        // acquise, elle quitte l'étal au lieu d'y rester grisée
        Q.rune = true;
        out.retireeUneFoisAcquise = !articlesItinerants().some(a => a.id === 'rune');
        Q.rune = false;

        // --- l'achat ---
        J.rubis = 900; Q.achatsColporteuse = 0;
        ouvrirBoutique('itinerant');
        const i = boutique.liste.findIndex(a => a.id === 'rune');
        const avant = J.rubis;
        // absente de l'étal : on le dit, plutôt que de planter sur `liste[-1]`
        if (i < 0) { out.achetee = out.payee = out.partieDeLEtal = false; }
        else {
          boutique.sel = i; acheter();
          out.achetee = Q.rune === true;
          out.payee = avant - J.rubis === 300;
          out.partieDeLEtal = !boutique.liste.some(a => a.id === 'rune');
        }
        Q.rune = false;
        boutique = null;

        /* --- LES EFFETS, mesurés sur le vrai jeu ---
           On passe par `blesser` et par la boucle du héros, jamais par
           l'arithmétique du test : sinon il resterait vert même si la pièce
           n'agissait plus. */
        razQuetes();
        const encaisser = () => {
          J.pvmax = 20; J.pv = 20; J.invuln = 0; J.bouclier = false;
          blesser(4, J.x + 30, J.y, false);
          const perdu = 20 - J.pv; J.invuln = 0; return perdu;
        };
        out.degatsNus = encaisser();
        Q.amulette = true;
        out.degatsAmulette = encaisser();
        // jamais jusqu'à zéro : un coup d'un point doit toujours coûter un point
        J.pvmax = 20; J.pv = 20; J.invuln = 0;
        blesser(1, J.x + 30, J.y, false);
        out.jamaisZero = 20 - J.pv === 1;
        razQuetes();

        // la fiole relève, une seule fois, et se consomme
        J.pvmax = 12; J.pv = 2; J.invuln = 0; Q.potions = 0; Q.fioleFee = true;
        blesser(9, J.x + 30, J.y, false);
        out.releve = etat === 'jeu' && J.pv === J.pvmax;
        out.fioleConsommee = Q.fioleFee === false;
        J.invuln = 0; J.pv = 2;
        blesser(9, J.x + 30, J.y, false);
        out.deuxiemeFoisOnMeurt = etat === 'mort';
        etat = 'jeu'; J.pv = J.pvmax; J.invuln = 9999;
        razQuetes();

        /* la rune mord plus profond. J.atk=13 ne laisse passer qu'une frappe :
           `frapper` refuse tant que `e.flash` n'est pas retombé. */
        const degatsEpee = () => {
          ennemis.length = 0; butins.length = 0;
          ennemis.push({ type: 'braise', x: J.x + 20, y: J.y, z: J.z, vz: 0, r: 6, dir: 2,
                         pv: 99, pvmax: 99, t: 0, cd: 0, flash: 0, kx: 0, ky: 0,
                         hx: 0, hy: 0, anim: 0, stun: 0 });
          J.dir = 3; J.spin = 0; J.atk = 13;
          majJoueur();
          J.atk = 0;
          const perdu = 99 - ennemis[0].pv;
          ennemis.length = 0;
          return perdu;
        };
        out.lameNue = degatsEpee();
        Q.rune = true;
        out.lameRunee = degatsEpee();
        razQuetes();

        // --- un seul message, même quand elle tient une pièce rare ---
        {
          const vraiDire = window.dire, vraiAnnonce = window.annonce;
          let n = 0, texte = '';
          window.dire = (t, d) => { n++; texte = t; return vraiDire(t, d); };
          window.annonce = t => { n++; return vraiAnnonce(t); };
          marchand.actif = false;
          /* On force le tirage : on veut la branche « pièce rare » du message,
             pas celle qui sort une fois sur trois. */
          const vraiTirage = window.tirerRare;
          window.tirerRare = () => 'amulette';
          poserMarchand();
          window.tirerRare = vraiTirage;
          window.dire = vraiDire; window.annonce = vraiAnnonce;
          out.messagesRare = n;
          out.messageDitRare = /RARE/.test(texte);
        }

        // --- et tout cela survit au rechargement ---
        Q.amulette = true; Q.fioleFee = true; Q.rune = true;
        return out;
      });
      const dort2 = ms => new Promise(r => setTimeout(r, ms));
      await p2.evaluate(async () => { await sauver(true); });
      await dort2(300);
      const apres = await p2.evaluate(async () => {
        await charger(0);
        await new Promise(r => setTimeout(r, 350));
        return { amulette: Q.amulette, fiole: Q.fioleFee, rune: Q.rune, rare: marchand.rare };
      });

      v('ELLE NE SORT UNE PIÈCE RARE QU UNE FOIS SUR TROIS ENVIRON',
        q.part > 0.2 && q.part < 0.5, `${Math.round(q.part * 100)} % des passages`);
      v('les trois pièces peuvent sortir, et rien d autre',
        q.varietes.length === 3 && q.tousConnus, q.varietes.join(','));
      v('UNE PIÈCE DÉJÀ ACQUISE NE RESSORT PLUS',
        q.pasDeDoublon && q.apresAchat.length === 2, q.apresAchat.join(','));
      v('les trois acquises, elle n a plus rien de rare', q.plusRien, 'elle en sort encore');
      v('LA PIÈCE RARE EST EN TÊTE D ÉTAL, ET C EST LA PLUS CHÈRE',
        q.enTete && q.laPlusChere, `enTete=${q.enTete} plusChere=${q.laPlusChere}`);
      v('acquise, elle quitte l étal', q.retireeUneFoisAcquise, 'elle y reste grisée');
      v('on peut l acheter, et elle se paie', q.achetee && q.payee && q.partieDeLEtal,
        `acquise=${q.achetee} payée=${q.payee} retirée=${q.partieDeLEtal}`);
      v('L AMULETTE ENCAISSE LA MOITIÉ DES DÉGÂTS',
        q.degatsAmulette * 2 === q.degatsNus, `${q.degatsNus} -> ${q.degatsAmulette}`);
      v('mais jamais jusqu à zéro', q.jamaisZero, 'un coup d un point ne coûtait plus rien');
      v('LA FIOLE DE FÉE RELÈVE AU LIEU DE LAISSER MOURIR',
        q.releve, 'le héros est mort quand même');
      v('elle se consomme, et la fois d après on meurt',
        q.fioleConsommee && q.deuxiemeFoisOnMeurt,
        `consommée=${q.fioleConsommee} mort=${q.deuxiemeFoisOnMeurt}`);
      v('LA RUNE DE TRANCHANT AJOUTE UN POINT À CHAQUE COUP D ÉPÉE',
        q.lameRunee === q.lameNue + 1, `${q.lameNue} -> ${q.lameRunee}`);
      v('UN SEUL MESSAGE, MÊME QUAND ELLE TIENT UNE PIÈCE RARE',
        q.messagesRare === 1 && q.messageDitRare,
        `${q.messagesRare} messages, dit la pièce rare : ${q.messageDitRare}`);
      v('LES TROIS PIÈCES SURVIVENT AU RECHARGEMENT',
        apres.amulette && apres.fiole && apres.rune, JSON.stringify(apres));
      v('la pièce en rayon, elle, ne se sauvegarde pas',
        apres.rare === null, `rare=${apres.rare}`);
      /* ---------- LA PIÈCE RARE SE VOIT-ELLE DANS L'ÉTAL ? ----------
         Noyée dans la liste, on passait devant sans la remarquer. Compter l'or
         ne dit rien : les vignettes elles-mêmes en portent, et le carquois a
         une boucle de laiton. On rend donc DEUX FOIS la même boutique — la
         pièce marquée, puis dépouillée de sa marque — et on compte les pixels
         qui changent SUR SA LIGNE. */
      const etal = await p2.evaluate(() => {
        const ctx = CV.getContext('2d');
        razQuetes(); J.rubis = 900; J.objets = ['arc', 'bombe'];
        marchand.rare = 'amulette';
        ouvrirBoutique('itinerant');
        const bw = Math.min(CV.width - 20, 186), bx = Math.round(CV.width / 2 - bw / 2);
        const by = Math.round(CV.height / 2 - 52);
        /* `rendreMonde()` ne dessine PAS la boutique : elle est dans `ath()`.
           Sans lui, la comparaison portait sur du décor et ne bougeait jamais.

           Figer `tick` et `secousse` ne suffit pas : la VRAIE boucle continue de
           tourner entre deux clichés, et tout ce que l'ATH affiche en temps
           limité s'éteint pendant ce temps-là. Mesuré : un bandeau d'annonce qui
           expire entre les deux change **2 700 pixels** sur la ligne suivante —
           bien plus que la marque cherchée (une centaine). Ce contrôle rougissait
           donc une fois sur deux, selon la charge de la machine. On éteint tout
           ce qui est temporaire, et la comparaison ne porte plus que sur l'étal. */
        const snap = () => { tick = 1000; secousse = 0;
                             bandeauT = 0; msgT = 0; sauveEtatT = 0;
                             rendreMonde(); ath();
                             return ctx.getImageData(0, 0, CV.width, CV.height).data; };
        const changes = (a, b, ligne) => {
          const y0 = by + 18 + ligne * 17;
          let n = 0;
          for (let y = y0; y < Math.min(CV.height, y0 + 16); y++)
            for (let x = bx; x < Math.min(CV.width, bx + bw); x++) {
              const i = (y * CV.width + x) * 4;
              if (a[i] !== b[i] || a[i+1] !== b[i+1] || a[i+2] !== b[i+2]) n++;
            }
          return n;
        };
        /* On déclenche exprès un bandeau, et on le fait expirer entre les deux
           clichés : c'est LA situation qui rendait ce contrôle intermittent.
           Reproduite ici à la main, elle devient un contrôle de non-régression
           au lieu d'un caprice de charge. */
        annonce('UN BANDEAU QUI VA EXPIRER');
        const marquee = snap();
        // contrôle à blanc : deux rendus identiques ne doivent RIEN changer
        const out = { stable: changes(marquee, snap(), 0) };
        bandeauT = 0;                                   // le bandeau s'éteint
        boutique.liste[0].rare = false;                 // on lui retire sa marque
        const nue = snap();
        out.surSaLigne = changes(marquee, nue, 0);
        out.surLaSuivante = changes(marquee, nue, 1);   // les autres ne bougent pas
        boutique = null; marchand.rare = null; razQuetes();
        return out;
      });
      v('contrôle à blanc : deux rendus de boutique identiques ne diffèrent pas',
        etal.stable === 0, `${etal.stable} pixels bougent tout seuls`);
      v('LA PIÈCE RARE EST MARQUÉE DANS L ÉTAL',
        etal.surSaLigne > 60, `${etal.surSaLigne} pixels la distinguent`);
      v('et sa marque ne déborde pas sur les autres lignes',
        etal.surLaSuivante === 0, `${etal.surLaSuivante} pixels changent en dessous`);

      /* ---------- CINQ LIGNES TIENNENT-ELLES DANS LE PANNEAU ? ----------
         Le panneau de boutique était taillé EN DUR pour quatre lignes (104 px).
         La cinquième — la pièce rare — passait par-dessus le compte de rubis et
         « B ACHAT  X SORTIE ». On relève ici les rectangles RÉELLEMENT écrits,
         en interceptant `texte` et `panneau`, et on exige que rien ne déborde
         ni ne se chevauche. */
      const mise = await p2.evaluate(() => {
        razQuetes(); J.rubis = 900; J.objets = ['arc', 'bombe'];
        marchand.rare = 'amulette';
        const releve = () => {
          ouvrirBoutique('itinerant');
          const vraiTexte = window.texte, vraiPanneau = window.panneau;
          const textes = [], cadres = [];
          window.texte = (g, s, x, y, c, o) => {
            textes.push({ s: String(s), x, y, w: largeurTexte(s), h: 7 });
            return vraiTexte(g, s, x, y, c, o);
          };
          window.panneau = (g, x, y, w, h) => {
            cadres.push({ x, y, w, h }); return vraiPanneau(g, x, y, w, h);
          };
          // ni bandeau ni message en travers : on mesure la boutique, pas eux
          tick = 1000; secousse = 0; msgT = 0; bandeauT = 0;
          rendreMonde(); ath();
          window.texte = vraiTexte; window.panneau = vraiPanneau;
          const n = boutique.liste.length;
          boutique = null;
          // le plus grand cadre est celui de la boutique
          const p = cadres.sort((a, b) => b.w * b.h - a.w * a.h)[0];
          const dans = textes.filter(t => t.x >= p.x - 2 && t.x + t.w <= p.x + p.w + 2
                                       && t.y >= p.y - 2 && t.y + t.h <= p.y + p.h + 2);
          const hors = textes.filter(t => t.x + t.w > p.x && t.x < p.x + p.w
                                       && t.y + t.h > p.y && t.y < p.y + p.h
                                       && !dans.includes(t));
          const chevauche = [];
          for (let i = 0; i < dans.length; i++) for (let j = i + 1; j < dans.length; j++) {
            const a = dans[i], b = dans[j];
            if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
              chevauche.push(`« ${a.s} » sur « ${b.s} »`);
          }
          return { lignes: n, dedans: dans.length, hors: hors.map(t => t.s), chevauche };
        };
        const avecRare = releve();
        marchand.rare = null;
        const sansRare = releve();
        razQuetes();
        return { avecRare, sansRare };
      });
      v('la pièce rare fait bien une cinquième ligne',
        mise.avecRare.lignes === 5 && mise.sansRare.lignes === 4,
        `${mise.sansRare.lignes} -> ${mise.avecRare.lignes}`);
      v('RIEN NE DÉBORDE DU PANNEAU DE LA BOUTIQUE, À CINQ LIGNES COMME À QUATRE',
        mise.avecRare.hors.length === 0 && mise.sansRare.hors.length === 0,
        `déborde : ${mise.avecRare.hors.concat(mise.sansRare.hors).join(' / ')}`);
      v('ET AUCUNE LIGNE N EN RECOUVRE UNE AUTRE',
        mise.avecRare.chevauche.length === 0 && mise.sansRare.chevauche.length === 0,
        mise.avecRare.chevauche.concat(mise.sansRare.chevauche).join(' | '));

      v('aucune erreur JS (pièce rare)', p2.erreursJS.length === 0, p2.erreursJS[0]);
      await p2.context().close();
    }

    /* La police pixel ne connaît qu'un jeu de caractères réduit : tout signe
       absent s'affiche en « ? ». On vérifie les libellés des deux boutiques et
       le titre affiché — le Œ de « CŒUR » y était passé inaperçu. */
    const police = await page.evaluate(() => {
      const inconnu = s => [...s].filter(c => !GLYPHES[c]);
      const textes = [...articles(), ...articlesItinerants()].map(a => a.nom)
        .concat(['ÉCHOPPE DE BRAN', 'LE BALLOT DE LA COLPORTEUSE', 'B ACHAT   X SORTIE']);
      return textes.map(t => ({ t, mauvais: inconnu(t) })).filter(x => x.mauvais.length);
    });
    v('tous les libellés des boutiques sont affichables',
      police.length === 0, JSON.stringify(police));
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
