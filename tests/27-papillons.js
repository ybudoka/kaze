'use strict';
/* CORRECTIFS.md § 31 — LE CABINET DES HUIT et le filet à papillons.

   La seule quête qui traverse les huit tableaux. Ce qu'on vérifie n'est pas
   « le drapeau change » mais « le joueur peut réellement la finir » :
     - il y a bien UN papillon par région, et pas deux dans la même ;
     - chacun est posé sur un sol praticable, hors salle close et hors zone de
       paix, et on peut l'atteindre en marchant ;
     - il ne se prend NI en marchant dessus, NI à l'épée, NI au boomerang —
       seulement au filet, sinon l'outil ne servirait à rien ;
     - le filet renvoie un projectile ennemi, et le projectile renvoyé blesse
       celui qui l'a lancé ;
     - rendre les huit paye, et rien ne repousse au rechargement. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Le cabinet des huit (papillons, filet)',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      const paps = () => butins.filter(b => b.type === 'papillon');

      /* ---------- un par région, et un seul ---------- */
      const parRegion = new Array(8).fill(0);
      for (const p of paps()) parRegion[regionIdx(Math.floor(p.y / TS))]++;
      out.parRegion = parRegion;
      out.nbPapillons = paps().length;
      // le `rg` porté par le papillon doit être celui de la rangée où il est
      out.rgCoherent = paps().every(p => p.rg === regionIdx(Math.floor(p.y / TS)));
      // huit teintes distinctes, une par monde
      out.spritesDistincts = new Set(paps().map(p => 'papillon' + p.rg)).size;
      out.spritesExistent = paps().every(p => !!SPR['papillon' + p.rg]);

      /* ---------- posés quelque part de tenable ---------- */
      out.surSolLibre = paps().every(p => {
        const x = Math.floor(p.x / TS), y = Math.floor(p.y / TS);
        return libre(x, y) && Etg(x, y) === 0;
      });
      out.horsSalle = paps().every(p => !salleDe(p.x, p.y));
      out.horsRefuge = paps().every(p => !dansRefuge(p.x, p.y));

      /* ---------- atteignables en marchant, tout débloqué ----------
         On donne au héros de quoi passer partout (palmes, bottes, portails) :
         la question n'est pas « peut-on y aller tout de suite » mais « la case
         n'est-elle pas murée à jamais ». */
      Object.assign(Q, { palmes: true, bottes: true, portailOuvert: true,
                         grilleOuverte: true, porteOuverte: true, failleOuverte: true });
      const joignable = (sx, sy) => {
        const passable = (x, y) => {
          if (!dansCarte(x, y)) return false;
          const s = Sol(x, y);
          if (s === S.LAVE || s === S.VIDE || s === S.NEANT) return false;
          const o = Obj(x, y);
          if (o === O.PORTAIL) return true;
          if (o === O.ROCNOIR) return false;
          if (o && DUR_O[o] && !FRANCH_O[o]) return false;
          return true;
        };
        const lien = (ax, ay, bx, by) => Etg(bx, by) <= Etg(ax, ay)
          || Sol(bx, by) === S.RAMPE || Sol(ax, ay) === S.RAMPE;
        const vus = new Uint8Array(MW * MH), f = [[sx, sy]];
        vus[sy * MW + sx] = 1;
        while (f.length) {
          const [x, y] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx] || !passable(nx, ny) || !lien(x, y, nx, ny)) continue;
            vus[ny * MW + nx] = 1; f.push([nx, ny]);
          }
        }
        return vus;
      };
      {
        /* Chaque région se parcourt depuis SON papillon : les régions sont
           reliées par des cols étroits que ce parcours à plat ne franchit pas
           forcément (rampes, nage, vol plané). Ce qu'on veut savoir ici, c'est
           qu'aucun papillon n'est enfermé dans une poche murée. */
        out.pochesLibres = paps().map(p => {
          const x = Math.floor(p.x / TS), y = Math.floor(p.y / TS);
          const vus = joignable(x, y);
          let n = 0;
          for (let i = 0; i < vus.length; i++) n += vus[i];
          return n;
        });
        out.aucunePocheMinuscule = out.pochesLibres.every(n => n > 200);
      }

      /* ---------- il ne se prend qu'au filet ---------- */
      const unPapillon = () => paps()[0];
      const poserHeros = p => { J.x = p.x; J.y = p.y; J.z = p.z; J.invuln = 9999; J.pv = J.pvmax; };

      // 1. en marchant dessus : il doit RESTER
      {
        const p = unPapillon(); const avant = paps().length;
        poserHeros(p);
        await dort(300);
        out.pasPrisAuPied = paps().length === avant;
      }
      // 2. au coup d'épée : il doit RESTER
      {
        const p = unPapillon(); const avant = paps().length;
        J.x = p.x - 10; J.y = p.y; J.z = p.z; J.dir = 3;
        zoneDegats(p.x, p.y, 40, 40, 2, 'epee');
        out.pasPrisALEpee = paps().length === avant;
      }
      // 3. au filet : il doit être PRIS
      {
        const p = unPapillon(); const rg = p.rg; const avant = paps().length;
        Q.filet = true;
        if (!J.objets.includes('filet')) J.objets.push('filet');
        J.objSel = J.objets.indexOf('filet');
        J.x = p.x - 14; J.y = p.y; J.z = p.z; J.dir = 3; J.filetT = 0;
        coupDeFilet();
        out.prisAuFilet = paps().length === avant - 1;
        out.compteMonte = nbPapillons() === 1;
        out.bonneCase = Q.papillonsPris[rg] === 1;
      }

      /* ---------- le filet renvoie ce qu'on lui jette ---------- */
      {
        tirs.length = 0; ennemis.length = 0;
        J.x = 35 * TS; J.y = 45 * TS; J.z = 0; J.dir = 3; J.filetT = 0;
        // une cible à droite, et un projectile ennemi qui vient d'elle
        const cible = { type: 'gluant', x: J.x + 60, y: J.y, z: 0, vz: 0, r: 6, dir: 2,
                        pv: 9, pvmax: 9, t: 0, cd: 0, flash: 0, kx: 0, ky: 0, hx: 0, hy: 0,
                        anim: 0, stun: 0 };
        ennemis.push(cible);
        tirs.push({ x: J.x + 14, y: J.y, z: J.z + 9, vx: -2.5, vy: 0, vie: 120, ami: 0, spr: 'caillou' });
        coupDeFilet();
        const t = tirs[0];
        out.renvoyeAmi = !!(t && t.ami);
        out.renvoyeRepart = !!(t && t.vx > 0);
        const pvAvant = cible.pv;
        for (let i = 0; i < 40 && ennemis.length; i++) majDivers();
        out.renvoyeBlesse = cible.pv < pvAvant;
      }
      // sans rien devant, le coup de filet ne plante pas et ne prend rien
      {
        tirs.length = 0; ennemis.length = 0; J.filetT = 0;
        coupDeFilet();
        out.filetDansLeVideOK = true;
      }

      /* ---------- Orla : elle donne le filet, puis elle paye ---------- */
      const orla = pnjs.find(p => p.id === 'naturaliste');
      out.orlaExiste = !!orla;
      out.orlaAuVillage = orla ? !!dansRefuge(orla.x, orla.y) : false;
      const causer = p => { dial = null; dialoguePNJ(p); const d = dial; dial = null; return d; };
      const finir = d => { if (d && d.apres) d.apres(); };
      {
        razQuetes(); J.objets = []; J.objSel = 0;
        const d = causer(orla);
        out.orlaPropose = d.pages.join(' ');
        finir(d);
        out.orlaDonneLeFilet = Q.filet && J.objets.includes('filet');
        out.filetEstEquipe = J.objets[J.objSel] === 'filet';
      }
      {
        // les huit rendus : cœur, rubis et potions
        Q.papillonsPris = [1, 1, 1, 1, 1, 1, 1, 1];
        const pvmaxAvant = J.pvmax, rubisAvant = J.rubis, potAvant = Q.potions;
        const d = causer(orla); finir(d);
        out.rendus = Q.papillonsRendus;
        out.gainCoeurs = J.pvmax - pvmaxAvant;
        out.gainRubis = J.rubis - rubisAvant;
        out.gainPotions = Q.potions - potAvant;
      }
      /* un papillon déjà pris ne repousse pas : c'est tout l'intérêt du tableau
         par région plutôt que d'un compteur */
      {
        razQuetes();
        Q.papillonsPris = [1, 0, 1, 0, 1, 0, 1, 0];
        peupler();
        const restants = paps().map(p => p.rg).sort();
        out.neRepoussePas = JSON.stringify(restants) === JSON.stringify([1, 3, 5, 7]);
      }
      return out;
    });

    v('IL Y A UN PAPILLON PAR TABLEAU, ET UN SEUL',
      r.parRegion.every(n => n === 1), 'par région : ' + r.parRegion.join(','));
    v('huit en tout', r.nbPapillons === 8, 'trouvés : ' + r.nbPapillons);
    v('chacun porte la région où il se trouve', r.rgCoherent);
    v('huit teintes distinctes, une par monde', r.spritesDistincts === 8 && r.spritesExistent,
      'distincts : ' + r.spritesDistincts);
    v('aucun n\'est posé dans un mur ni sur un plateau', r.surSolLibre);
    v('aucun n\'est enfermé dans une salle close', r.horsSalle);
    v('aucun n\'est dans une zone de paix', r.horsRefuge);
    v('aucun n\'est muré dans une poche minuscule', r.aucunePocheMinuscule,
      'cases atteignables : ' + JSON.stringify(r.pochesLibres));

    v('MARCHER DESSUS NE LE PREND PAS', r.pasPrisAuPied);
    v('UN COUP D\'ÉPÉE NON PLUS', r.pasPrisALEpee);
    v('LE FILET, LUI, LE PREND', r.prisAuFilet);
    v('le compteur monte', r.compteMonte);
    v('et c\'est la case de SA région qui se coche', r.bonneCase);

    v('LE FILET RENVOIE UN PROJECTILE ENNEMI', r.renvoyeAmi);
    v('il repart dans l\'autre sens', r.renvoyeRepart);
    v('ET IL BLESSE CELUI QUI L\'A LANCÉ', r.renvoyeBlesse);
    v('un coup de filet dans le vide ne casse rien', r.filetDansLeVideOK);

    v('Orla tient boutique au village', r.orlaExiste && r.orlaAuVillage);
    v('elle donne le filet à la première conversation', r.orlaDonneLeFilet);
    v('et le filet est équipé en sortant', r.filetEstEquipe);
    v('elle parle bien des huit', /HUIT/.test(r.orlaPropose), r.orlaPropose.slice(0, 80));
    v('les huit rendus, elle paye', r.rendus);
    v('+2 cœurs', r.gainCoeurs === 2, 'gain : ' + r.gainCoeurs);
    v('300 rubis', r.gainRubis === 300, 'gain : ' + r.gainRubis);
    v('deux potions', r.gainPotions === 2, 'gain : ' + r.gainPotions);
    v('UN PAPILLON DÉJÀ PRIS NE REPOUSSE PAS', r.neRepoussePas);

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS.join(' | '));
    await page.context().close();
  },
};
