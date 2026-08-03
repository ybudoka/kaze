'use strict';
/* Les VERROUS DE RÉGION — on ne descend pas d'un monde au suivant sans avoir
   abattu son gardien.

   Le jeu n'en avait qu'UN sur sept : le portail de Cendre. Les six autres
   frontières — le col des Cimes, la descente du Lagon, l'oued des Sables, le
   marécage du Marais, la tour des Nues, la bouche de la Faille — étaient
   percées et rien ne s'y trouvait. `Q.failleOuverte` était même calculé,
   sauvegardé, et lu NULLE PART pour bloquer quoi que ce soit.

   On mesure deux choses sur le vrai jeu, jamais sur une copie des règles :

   1. CE QUI EST ATTEIGNABLE À PIED. Un remplissage par diffusion depuis le
      village, dont la seule règle de passage est le VRAI `solide()` du jeu —
      pas un miroir qui dériverait. En ouvrant les verrous un à un, la région
      la plus au sud atteinte doit avancer d'exactement un cran à chaque fois.
   2. QUE LE HÉROS BUTE VRAIMENT. On le pose dans chaque corridor et on le
      pousse plein sud pendant 400 images : il ne doit pas franchir la rangée
      de la frontière tant que le gardien tient debout, et la franchir dès
      qu'il tombe.

   Plus deux filets : un sceau ouvert ne se referme jamais, et une sauvegarde
   déjà faite au sud d'un verrou fermé doit être LIBÉRÉE au chargement — sans
   quoi la mise à jour murerait les parties en cours. */
const { pageDeJeu, nouvellePartie } = require('./outils');

/* Le drapeau qui ouvre l'entrée de chaque région, du nord au sud.
   L'indice est celui de `regionIdx` : 0 la Vallée, 7 la Faille. */
const VERROUS = [null, 'portailOuvert', 'coeurTue', 'yetiTue', 'leviathanTue',
                 'colosseTue', 'reineTue', 'failleOuverte'];
const NOMS = ['VALLÉE', 'CENDRE', 'CIMES', 'LAGON', 'SABLES', 'MARAIS', 'NUES', 'FAILLE'];

module.exports = {
  nom: 'Verrous de région',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async (VERROUS) => {
      const out = {};

      /* --- le remplissage, dont la seule règle est le vrai `solide()` --- */
      const marchable = (x, y) =>
        dansCarte(x, y) && !solide(x * TS + 8, y * TS + 8, Etg(x, y) * EH);
      const diffuser = (sx, sy) => {
        const vus = new Uint8Array(MW * MH), pile = [[sx, sy]];
        vus[sy * MW + sx] = 1;
        while (pile.length) {
          const [x, y] = pile.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx] || !marchable(nx, ny)) continue;
            // un étage ne se monte que par une rampe
            const lien = Etg(nx, ny) <= Etg(x, y) || Sol(nx, ny) === S.RAMPE || Sol(x, y) === S.RAMPE;
            if (!lien) continue;
            vus[ny * MW + nx] = 1; pile.push([nx, ny]);
          }
        }
        return vus;
      };
      const regionLaPlusAuSud = vus => {
        let max = 0;
        for (let y = MH - 1; y >= 0; y--)
          for (let x = 0; x < MW; x++)
            if (vus[y * MW + x]) { max = regionIdx(y); y = -1; break; }
        return max;
      };

      /* Ferme tout, puis rouvre les `n` premiers verrous. L'eau n'est pas le
         sujet : on chausse les palmes pour qu'aucun lac ne vienne fausser la
         mesure d'un verrou. */
      const ouvrirJusqua = n => {
        for (const f of VERROUS) if (f) Q[f] = false;
        for (let i = 1; i <= n; i++) Q[VERROUS[i]] = true;
        Q.palmes = true;
      };

      const depart = [Math.floor(J.x / TS), Math.floor(J.y / TS)];
      out.diffusion = [];
      for (let n = 0; n <= 7; n++) {
        ouvrirJusqua(n);
        out.diffusion.push(regionLaPlusAuSud(diffuser(depart[0], depart[1])));
      }

      /* --- le héros pousse vers le sud dans chaque corridor --- */
      /* On ne code pas les corridors en dur, et on ne devine pas non plus : le
         VRAI passage est celui que le remplissage emprunte, verrou ouvert. On
         le remonte de cinq rangées en restant dans l'atteignable, et c'est de
         là qu'on pousse. Un trou ailleurs dans le mur serait trouvé de même. */
      const passageDe = i => {
        ouvrirJusqua(i);
        const vus = diffuser(depart[0], depart[1]);
        const ty = BORNES_Y[i];
        for (let x = 0; x < MW; x++) {
          if (!vus[ty * MW + x]) continue;
          let y = ty, ok = true;
          for (let k = 0; k < 5; k++) { if (!vus[(y - 1) * MW + x]) { ok = false; break; } y--; }
          if (ok) return { x, y };
        }
        return null;
      };

      const pousserAuSud = (i, depuis, ouvert) => {
        ouvrirJusqua(ouvert ? i : i - 1);
        const ty = BORNES_Y[i];
        if (!depuis) return { pasDeCorridor: true };
        const cx = depuis.x;
        ennemis.length = 0; tirs.length = 0; boss = null;
        J.x = cx * TS + 8; J.y = depuis.y * TS + 8; J.z = Etg(cx, depuis.y) * EH;
        J.vz = 0; J.kx = 0; J.ky = 0; J.gx = 0; J.gy = 0;
        J.pv = J.pvmax; J.invuln = 9e9; J.grap = null; J.porte = null; J.plane = 0;
        let maxY = J.y;
        for (let f = 0; f < 400; f++) {
          axe.x = 0; axe.y = 1; majJoueur();
          if (J.y > maxY) maxY = J.y;
        }
        axe.x = 0; axe.y = 0;
        return { franchi: maxY >= ty * TS, marge: Math.round(ty * TS - maxY), cx };
      };

      out.marche = [];
      for (let i = 1; i <= 7; i++) {
        const p = passageDe(i);
        out.marche.push({ i, passage: p && `x=${p.x}`,
                          ferme: pousserAuSud(i, p, false),
                          ouvert: pousserAuSud(i, p, true) });
      }

      /* --- il DIT ce qui tient encore debout --- */
      /* Un mur qui refuse sans rien dire se lit comme un bug : c'est le message
         qui fait la différence entre un verrou et un cul-de-sac. */
      ouvrirJusqua(2);                       // le sceau des Cimes est clos
      const p3 = passageDe(3); ouvrirJusqua(2);
      ennemis.length = 0; boss = null;
      J.x = p3.x * TS + 8; J.y = p3.y * TS + 8; J.z = Etg(p3.x, p3.y) * EH;
      J.pv = J.pvmax; J.invuln = 9e9;
      message = ''; msgT = 0;
      for (let f = 0; f < 200 && !message; f++) { axe.x = 0; axe.y = 1; majJoueur(); }
      axe.x = 0; axe.y = 0;
      out.message = message;

      /* --- un sceau ouvert ne se referme jamais --- */
      ouvrirJusqua(7);
      out.pasDeRetourEnArriere = regionLaPlusAuSud(diffuser(depart[0], depart[1])) === 7;

      return out;
    }, VERROUS);

    /* 1. la diffusion avance d'exactement un cran par verrou ouvert */
    for (let n = 0; n <= 7; n++)
      v(`${n} verrou(x) ouvert(s) → on n'atteint pas plus loin que ${NOMS[n]}`,
        r.diffusion[n] === n,
        `atteint ${NOMS[r.diffusion[n]]} (indice ${r.diffusion[n]}) au lieu de ${NOMS[n]}`);

    /* 2. le héros bute vraiment sur chaque frontière */
    for (const m of r.marche) {
      if (m.ferme.pasDeCorridor) { v(`frontière ${NOMS[m.i]} : corridor trouvé`, false, 'aucune ouverture'); continue; }
      v(`LE SCEAU DE ${NOMS[m.i]} ARRÊTE LE HÉROS`, !m.ferme.franchi,
        `franchie (dépassement de ${-m.ferme.marge}px, corridor ${m.passage})`);
      v(`le gardien abattu, ${NOMS[m.i]} s'ouvre`, m.ouvert.franchi,
        `toujours bloqué (marge ${m.ouvert.marge}px)`);
    }

    v('LE SCEAU DIT CE QUI TIENT ENCORE DEBOUT',
      /^SCEAU CLOS\. LE ROI YÉTI TIENT ENCORE DEBOUT\.$/.test(r.message),
      `message affiché : « ${r.message} »`);
    v('un sceau ouvert ne se referme pas', r.pasDeRetourEnArriere, 'la Faille est redevenue inatteignable');

    /* 3. une partie déjà au sud d'un verrou fermé est libérée au chargement */
    const mig = await page.evaluate(async () => {
      for (const f of ['portailOuvert', 'coeurTue', 'yetiTue', 'leviathanTue',
                       'colosseTue', 'reineTue', 'failleOuverte']) Q[f] = false;
      J.x = 44 * TS + 8; J.y = (Y_MARAIS + 10) * TS + 8; J.z = 0;   // muré dans le Marais
      await sauver(true);
      await new Promise(r => setTimeout(r, 250));
      await charger(emplacement);
      await new Promise(r => setTimeout(r, 500));
      const rg = regionIdx(Math.floor(J.y / TS));
      return { region: rg,
               /* on interroge le JEU, pas les drapeaux : c'est `verrouOuvert`
                  qui décide si l'on passe */
               ouverts: [1, 2, 3, 4, 5].map(i => verrouOuvert(i)),
               /* et l'on vérifie qu'aucun gardien n'a été faussement coché */
               gardiens: ['coeurTue', 'yetiTue', 'leviathanTue', 'colosseTue'].map(f => !!Q[f]) };
    });
    v('UNE PARTIE DÉJÀ AU SUD D UN VERROU FERMÉ EST LIBÉRÉE',
      mig.ouverts.every(Boolean),
      `verrous au nord du héros encore fermés : ${mig.ouverts.join()} (région ${mig.region})`);
    v('la libération NE COCHE AUCUN GARDIEN qu\'on n\'a pas abattu',
      mig.gardiens.every(g => g === false), `gardiens faussement vaincus : ${mig.gardiens.join()}`);

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
