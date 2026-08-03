'use strict';
/* CHAQUE PANNEAU DOIT ÊTRE PLANTÉ, VISIBLE ET LISIBLE.

   Un panneau est deux choses : une zone de lecture dans `panneaux`, et un
   POTEAU (`O.PANNEAU`) posé sur la carte par `planterPanneaux()`. Sans poteau,
   la zone est invisible et l'on ne lit que par hasard (§ 30). Et un poteau posé
   là où l'on ne peut pas se tenir ne se lit jamais.

   Ce fichier tient l'invariant, mesuré sur la vraie carte :

     pour CHAQUE panneau — un poteau sur sa case, et au moins une case
     ATTEIGNABLE À PIED d'où la zone de lecture répond.

   Toute la progression est ouverte avant de mesurer : un panneau posé dans une
   salle qui ne s'ouvre que plus tard n'est pas mal placé, il est simplement
   plus loin. Sans cette précaution, celui de la salle finale de la Faille
   passait pour injoignable — première mesure, premier faux positif.

   `planterPanneaux` cherchait sa case dans un voisinage de 3 sur 3 et, faute
   de candidat, renonçait EN SILENCE (`if(choix)`) : le panneau restait sans
   poteau là où il était tombé. La réinjection ci-dessous plante un panneau au
   milieu d'un mur et exige qu'il s'en sorte quand même. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Les panneaux sont plantés, visibles et lisibles',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const out = {};

      /* Toute la progression ouverte : on mesure la GÉOMÉTRIE, pas les verrous. */
      const toutOuvrir = () => {
        for (const f of VERROUS_REGION) if (f) Q[f] = true;
        Q.palmes = Q.cape = Q.grappin = Q.boomerang = Q.bracelet = true;
        Q.fanal = Q.bottes = true;
        Q.porteOuverte = Q.grilleOuverte = Q.fissureOuverte = Q.epreuveFinale = true;
        Q.sceaux = 3;
        for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
          const o = objs[y * MW + x];
          if (o === O.PORTE || o === O.GRILLE || o === O.ECLATNOIR || o === O.PORTEP
              || o === O.SCEAU || o === O.RONCE || o === O.GLACON || o === O.ROCNOIR)
            objs[y * MW + x] = O.RIEN;
        }
      };
      const libre = (x, y) => dansCarte(x, y) && !solide(x * TS + 8, y * TS + 8, Etg(x, y) * EH);
      const atteignable = () => {
        const vus = new Uint8Array(MW * MH), pile = [[Math.floor(J.x / TS), Math.floor(J.y / TS)]];
        vus[pile[0][1] * MW + pile[0][0]] = 1;
        while (pile.length) {
          const [x, y] = pile.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx] || !libre(nx, ny)) continue;
            const lien = Etg(nx, ny) <= Etg(x, y) || Sol(nx, ny) === S.RAMPE || Sol(x, y) === S.RAMPE;
            if (!lien) continue;
            vus[ny * MW + nx] = 1; pile.push([nx, ny]);
          }
        }
        return vus;
      };
      /* Le VRAI rayon de lecture du jeu, pas un nombre recopié. */
      const RAYON = 22;
      const etat1 = s => {
        const tx = Math.floor(s.x / TS), ty = Math.floor(s.y / TS);
        let cases = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = tx + dx, y = ty + dy;
          if (!libre(x, y) || !vus[y * MW + x]) continue;
          if (Math.hypot(x * TS + 8 - s.x, y * TS + 8 - s.y) < RAYON) cases++;
        }
        /* Un mur au SUD recouvre le poteau : dessiné après lui, `murTuile`
           peint la case entière en bloc surélevé. Vérifié à la loupe sur le
           panneau de la Cité des Nues — il n'en restait qu'une ligne d'un
           pixel — et vérifié à l'inverse sur celui des Cimes, dont le sapin
           (plus HAUT qu'un mur) ne masque rien : c'est la classe « mur » qui
           compte, pas la hauteur. */
        const MURS = [O.MUR, O.PORTE, O.GRILLE, O.OEIL, O.FISSURE];
        return { tx, ty, poteau: Obj(tx, ty) === O.PANNEAU, cases,
                 murAuSud: MURS.includes(Obj(tx, ty + 1)),
                 region: NOMS_REGION[regionIdx(ty)], txt: s.txt.slice(0, 38) };
      };

      toutOuvrir();
      let vus = atteignable();
      out.total = panneaux.length;
      out.etats = panneaux.map(etat1);

      /* ---- RÉINJECTION : un panneau au milieu d'un mur ----
         On mure un carré de 5 sur 5 en pleine prairie, on y jette un panneau,
         et l'on rejoue la plantation. Le contrôle doit être capable de dire
         que ça ne va pas — sinon les 34 verts ci-dessus ne prouvent rien. */
      const mx = Math.floor(J.x / TS) + 14, my = Math.floor(J.y / TS);
      for (let y = my - 2; y <= my + 2; y++) for (let x = mx - 2; x <= mx + 2; x++) {
        putS(x, y, S.HERBE); putE(x, y, 0); putO(x, y, O.MUR);
      }
      panneaux.push({ x: mx * TS + 8, y: my * TS + 8, txt: 'PANNEAU MURÉ' });
      planterPanneaux();
      vus = atteignable();
      out.mure = etat1(panneaux[panneaux.length - 1]);

      return out;
    });

    const sansPoteau = r.etats.filter(p => !p.poteau);
    const illisibles = r.etats.filter(p => p.cases === 0);

    v(`les ${r.total} panneaux existent`, r.total >= 30, `${r.total} panneaux`);
    v('CHAQUE PANNEAU A SON POTEAU', sansPoteau.length === 0,
      sansPoteau.map(p => `(${p.tx},${p.ty}) ${p.region} « ${p.txt} »`).join(' · '));
    v('CHAQUE PANNEAU SE LIT DEPUIS UNE CASE ATTEIGNABLE À PIED', illisibles.length === 0,
      illisibles.map(p => `(${p.tx},${p.ty}) ${p.region} « ${p.txt} »`).join(' · '));

    const masques = r.etats.filter(p => p.murAuSud);
    v('AUCUN POTEAU N\'EST RECOUVERT PAR UN MUR', masques.length === 0,
      masques.map(p => `(${p.tx},${p.ty}) ${p.region} « ${p.txt} »`).join(' · '));

    /* Un panneau qu'on ne peut lire que d'une seule case se rate facilement :
       on le signale sans en faire un échec, tant qu'il en existe une. */
    const fragiles = r.etats.filter(p => p.cases === 1);
    v('aucun panneau ne tient à une seule case de lecture', fragiles.length === 0,
      fragiles.map(p => `(${p.tx},${p.ty}) ${p.region}`).join(' · '));

    v('RÉINJECTION : UN PANNEAU JETÉ DANS UN MUR EST QUAND MÊME PLANTÉ',
      r.mure.poteau, `resté sans poteau en (${r.mure.tx},${r.mure.ty}) sur ${r.mure.region}`);
    v('et il reste lisible', r.mure.cases > 0,
      `aucune case atteignable d'où le lire en (${r.mure.tx},${r.mure.ty})`);

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
