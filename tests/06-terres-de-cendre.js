'use strict';
/* CORRECTIFS.md § 7 — la seconde région : génération, et l'aventure entière
   depuis le portail verrouillé jusqu'à la victoire. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Terres de Cendre',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      out.MH = MH; out.Y = Y_CENDRE; out.coffres = coffres.length;

      // sols du biome
      const c = {};
      for (let y = Y_CENDRE; y < MH; y++) for (let x = 0; x < MW; x++) { const s = Sol(x, y); c[s] = (c[s] || 0) + 1; }
      out.sols = [c[S.CENDRE] || 0, c[S.LAVE] || 0, c[S.BRAISE] || 0, c[S.BASALTE] || 0];

      // faune propre à la région
      const t = {};
      for (const e of ennemis) t[e.type] = (t[e.type] || 0) + 1;
      out.faune = [t.braise | 0, t.golem | 0, t.spectre | 0];
      out.enVallee = ennemis.filter(e => e.y < Y_CENDRE * TS).length;

      // parcours avec les vraies règles de collision
      const joignable = () => {
        const passable = (x, y) => {
          if (!dansCarte(x, y)) return false;
          const s = Sol(x, y);
          if (s === S.EAU || s === S.LAVE) return false;
          const o = Obj(x, y);
          if (o === O.PORTAIL) return !!Q.portailOuvert;
          if (o === O.ROCNOIR) return false;              // il faut le marteau
          if (o && DUR_O[o] && !FRANCH_O[o]) return false;
          return true;
        };
        const lien = (ax, ay, bx, by) => Etg(bx, by) <= Etg(ax, ay)
          || Sol(bx, by) === S.RAMPE || Sol(ax, ay) === S.RAMPE;
        const sx = Math.floor(J.x / TS), sy = Math.floor(J.y / TS);
        const vus = new Uint8Array(MW * MH), f = [[sx, sy]];
        vus[sy * MW + sx] = 1;
        while (f.length) { const [x, y] = f.pop();
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x+dx, ny = y+dy;
            if (!dansCarte(nx,ny) || vus[ny*MW+nx] || !passable(nx,ny) || !lien(x,y,nx,ny)) continue;
            vus[ny*MW+nx]=1; f.push([nx,ny]); } }
        return vus;
      };
      const atteint = (vus, co) => !!vus[Math.floor(co.y/TS)*MW + Math.floor(co.x/TS)];

      /* On doit tomber sur la Forge en marchant droit devant : elle était
         auparavant à l'écart, dans une étendue de cendre sans repère, et
         restait introuvable. */
      {
        const g = CENDRE.gorge, f = CENDRE.forge;
        const cxGorge = (g.x0 + g.x1) >> 1, cxForge = f.x0 + (f.w >> 1);
        out.alignee = cxForge >= g.x0 && cxForge <= g.x1;
        let y = Y_CENDRE, pas = 0, bloque = false;
        while (y < f.y0 && pas < 40) {
          y++; pas++;
          const o = Obj(cxGorge, y);
          if (Sol(cxGorge, y) === S.LAVE || (o && DUR_O[o] && o !== O.PORTAIL)) { bloque = true; break; }
        }
        out.marcheDroit = !bloque && y === f.y0;
        out.pasJusquALaForge = pas;
      }

      let a = joignable();
      out.cendresFermees = !atteint(a, coffres[3]);
      out.valleeOk = !!a[14*MW+15] && !!a[45*MW+30];   // bois du nord et village

      // les trois étoiles ouvrent le portail
      J.fragments = 2; ouvrirCoffre(coffres[2]); await dort(1700);
      out.portail = !!Q.portailOuvert; out.etoiles = J.fragments;

      a = joignable();
      out.forgeOk = atteint(a, coffres[3]);
      out.falaisesBloquees = !atteint(a, coffres[4]);

      // marteau -> on brise la roche noire qui bouche la brèche.
      // Le joueur arrive ici avec l'arc et les bombes : le marteau se range
      // donc APRÈS eux, et sans équipement automatique il resterait invisible.
      J.objets = ['arc', 'bombe']; J.objSel = 0;
      ouvrirCoffre(coffres[3]); await dort(200);
      out.marteau = J.objets.includes('marteau'); out.braises1 = Q.braises;
      // il doit être ÉQUIPÉ, sinon la boîte d'objet montre encore l'arc et on
      // repart du coffre en croyant n'avoir rien reçu
      out.marteauEquipe = J.objets[J.objSel] === 'marteau';

      /* La boîte d'objet doit MONTRER l'objet tenu. Elle affichait en dur la
         flèche dès que l'objet n'était pas une bombe : le marteau y était
         pixel pour pixel identique à l'arc, munitions comprises, et on croyait
         ne l'avoir jamais reçu. */
      {
        /* On ne lit que l'ICÔNE, pas toute la boîte : le compte de munitions
           suffisait à rendre les images différentes, et le contrôle restait
           vert alors que les deux dessins étaient les mêmes. */
        const lireBoite = async i => {
          J.objSel = i; await dort(120);
          const c = document.createElement('canvas'); c.width = 14; c.height = 14;
          c.getContext('2d').drawImage(CV, 8, H - 20, 14, 14, 0, 0, 14, 14);
          return c.toDataURL();
        };
        const vues = [];
        for (let i = 0; i < J.objets.length; i++) vues.push(await lireBoite(i));
        // contrôle à blanc : relire la même case doit redonner exactement la
        // même image, sinon « toutes distinctes » ne prouverait rien
        out.boiteStable = (await lireBoite(0)) === vues[0];
        out.boitesDistinctes = new Set(vues).size === J.objets.length;
        out.boiteObjets = J.objets.slice();
        J.objSel = J.objets.indexOf('marteau');
      }
      const cf = CENDRE.falaises, cx = cf.x0 + (cf.w >> 1);
      for (let k = -1; k <= 1; k++) putO(cx + k, cf.y0, O.RIEN);
      out.falaisesOuvertes = atteint(joignable(), coffres[4]);

      // bottes
      ouvrirCoffre(coffres[4]); await dort(200);
      out.bottes = !!Q.bottes; out.braises2 = Q.braises;
      // le journal doit montrer marteau et bottes, sinon rien ne prouve au
      // joueur qu'il les possède (les bottes ne s'affichent nulle part ailleurs)
      journal = true;
      const lignes = lignesJournal ? lignesJournal() : null;
      out.journal = JSON.stringify(lignes || []);
      journal = false;
      // la mini-carte doit distinguer les Terres de Cendre de la prairie
      const g2 = miniCV.getContext('2d');
      const px = (x, y) => { const d = g2.getImageData(x, y, 1, 1).data; return `${d[0]},${d[1]},${d[2]}`; };
      out.couleurVallee = px(35, 45);
      out.couleurCendre = px(10, 120);

      // un coffre ne se rouvre pas
      ouvrirCoffre(coffres[4]); await dort(100);
      out.pasDeDoublon = Q.braises === 2;

      // l'Antre réveille le Cœur de Cendre
      const ar = CENDRE.arene;
      J.x = (ar.x0 + (ar.w >> 1)) * TS + 8; J.y = (ar.y0 + 4) * TS + 8; J.invuln = 9999;
      await dort(300);
      out.bossReveille = !!(boss && boss.type === 'coeur') && !!coffres[5].verrou;
      if (boss) boss.pv = 0;
      await dort(300);
      out.bossVaincu = !boss && !coffres[5].verrou && !!Q.coeurTue;

      ouvrirCoffre(coffres[5]); await dort(1700);
      out.braises3 = Q.braises; out.etat = etat;

      /* Une partie d'AVANT les Terres de Cendre : elle a déjà ses trois
         étoiles, mais le drapeau du portail n'existait pas encore. Sans
         rattrapage au chargement, elle resterait devant un portail clos. */
      for (let i = 0; i < NB_SLOTS; i++) await stockEffacer(i);
      nouvellePartie('ANCIENNE', 0); await dort(300);
      J.fragments = 3; await sauver(true); await dort(200);
      const brut = JSON.parse(localStorage.getItem('kaze-partie-1'));
      delete brut.Q.portailOuvert;          // comme dans une sauvegarde d'époque
      delete brut.Q.braises; delete brut.Q.bottes; delete brut.Q.coeurTue;
      localStorage.setItem('kaze-partie-1', JSON.stringify(brut));
      await charger(0); await dort(500);
      out.ancienneEtoiles = J.fragments;
      out.anciennePortail = !!Q.portailOuvert;
      const gg = CENDRE.gorge;
      let yp = -1;
      for (let y = Y_CENDRE - 12; y < Y_CENDRE; y++) if (Obj(gg.x0, y) === O.PORTAIL) { yp = y; break; }
      out.anciennePassage = yp >= 0 && !solide(gg.x0 * TS + 8, yp * TS + 8, 0);
      return out;
    });

    v('la carte compte huit régions', r.MH === 640 && r.Y === 80, `${r.MH}/${r.Y}`);
    v('six coffres au total', r.coffres === 6, r.coffres);
    v('les quatre sols du biome existent',
      r.sols.every(n => n > 100), `cendre/lave/braise/basalte = ${r.sols.join('/')}`);
    v('les trois nouveaux monstres peuplent la région',
      r.faune.every(n => n > 0), `braise/golem/spectre = ${r.faune.join('/')}`);
    v('la vallée garde sa faune d\'origine', r.enVallee > 20, r.enVallee);
    v('les Cendres sont fermées tant que le portail l\'est', r.cendresFermees, 'déjà ouvertes');
    v('la vallée reste parcourable', r.valleeOk, 'village ou bois injoignables');
    v('les trois étoiles ouvrent le portail', r.portail && r.etoiles === 3,
      `ouvert=${r.portail} étoiles=${r.etoiles}`);
    v('la Forge Noire est atteignable', r.forgeOk, 'injoignable');
    v('la Forge est alignée sur le défilé', r.alignee, 'décalée : on peut la manquer');
    v('ON TOMBE SUR LA FORGE EN MARCHANT DROIT DEVANT',
      r.marcheDroit, 'le chemin tout droit ne mène pas à sa porte');
    v('elle est proche du portail', r.pasJusquALaForge <= 12, `${r.pasJusquALaForge} tuiles`);
    v('la roche noire ne se contourne pas', r.falaisesBloquees, 'passage libre');
    v('le marteau est obtenu', r.marteau && r.braises1 === 1, `${r.marteau}/${r.braises1}`);
    v('le marteau ouvre les Falaises', r.falaisesOuvertes, 'toujours bloqué');
    v('les bottes sont obtenues', r.bottes && r.braises2 === 2, `${r.bottes}/${r.braises2}`);
    v('LE MARTEAU EST ÉQUIPÉ DÈS QU\'ON LE TROUVE',
      r.marteauEquipe, 'la boîte d\'objet montre encore autre chose');
    v('la lecture de la boîte d\'objet est stable', r.boiteStable,
      'la boîte scintille : la mesure ne prouverait rien');
    v('LA BOÎTE D\'OBJET MONTRE VRAIMENT L\'OBJET TENU',
      r.boitesDistinctes, `${(r.boiteObjets || []).join(' / ')} : deux cases identiques`);
    v('le journal montre marteau et bottes',
      /MARTEAU/.test(r.journal) && /BOTTES/.test(r.journal), r.journal.slice(0, 120));
    v('la mini-carte distingue les Cendres de la prairie',
      r.couleurVallee !== r.couleurCendre,
      `vallée ${r.couleurVallee} / cendre ${r.couleurCendre}`);
    v('un coffre ne se rouvre pas', r.pasDeDoublon, 'contenu redonné');
    v('entrer dans l\'Antre réveille le Cœur', r.bossReveille, 'pas de boss');
    v('vaincre le Cœur descelle le coffre', r.bossVaincu, 'coffre verrouillé');
    /* Les trois braises n'achèvent plus l'aventure : six mondes suivent. Elles
       ouvrent la route des Cimes, et la partie continue. */
    v('LA DERNIÈRE BRAISE OUVRE LA ROUTE DES CIMES, ELLE NE FINIT PLUS LE JEU',
      r.braises3 === 3 && r.etat === 'jeu', `braises=${r.braises3} état=${r.etat}`);
    v('une partie d\'avant la région garde ses trois étoiles',
      r.ancienneEtoiles === 3, r.ancienneEtoiles);
    v('UNE PARTIE D\'AVANT LA RÉGION TROUVE LE PORTAIL OUVERT',
      r.anciennePortail, 'portail resté clos');
    v('et peut réellement le franchir', r.anciennePassage, 'passage encore bloqué');
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
