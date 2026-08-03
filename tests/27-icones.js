'use strict';
/* CORRECTIFS.md § 25 — chaque objet doit avoir SON dessin.
   L'arc et le carquois affichaient une FLÈCHE, le grand sac une bombe, le
   bouclier renforcé un cœur, et le réceptacle de cœur celui qu'on ramasse par
   terre. Rien ne le signalait : `spr:'fleche'` est du code parfaitement valide.

   On ne compare donc pas les NOMS de sprite — deux noms différents pourraient
   très bien porter le même dessin. On compare les IMAGES RENDUES, normalisées
   sur une même case : c'est ce que le joueur voit qui compte. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Chaque objet a son dessin',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(() => {
      /* Le même dessin posé au centre d'une case commune : deux sprites de
         tailles différentes ne doivent pas passer pour distincts à cause de
         leur seule taille, et deux dessins identiques doivent se reconnaître. */
      const rendu = nom => {
        const s = SPR[nom];
        if (!s) return null;
        const c = document.createElement('canvas');
        c.width = c.height = 28;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(s, Math.round((28 - s.width) / 2), Math.round((28 - s.height) / 2));
        return c.toDataURL();
      };

      /* TOUT ce que le jeu affiche avec une vignette d'objet. On force chacune
         des pièces rares dans l'étal : sans cela, celles qu'elle ne tient pas
         ce jour-là échapperaient au contrôle. */
      const vus = [];
      for (const o of OBJETS) vus.push({ ou: 'sac', id: o.id, nom: o.nom, spr: o.spr });
      for (const a of articles()) vus.push({ ou: 'bran', id: a.id, nom: a.nom, spr: a.spr });
      const rareAvant = marchand.rare;
      for (const rare of [null, ...RARES.map(x => x.id)]) {
        marchand.rare = rare;
        for (const a of articlesItinerants())
          if (!vus.some(x => x.ou === 'colp' && x.id === a.id))
            vus.push({ ou: 'colp', id: a.id, nom: a.nom, spr: a.spr });
      }
      marchand.rare = rareAvant;

      const out = { nbObjets: vus.length };
      out.sansSprite = vus.filter(x => !SPR[x.spr]).map(x => `${x.nom} -> ${x.spr}`);

      /* Contrôle à blanc : la comparaison sait-elle dire « identiques » ?
         Et sait-elle dire « différents » ? Sans les deux, elle ne dit rien. */
      out.saitDireIdentiques = rendu('fleche') === rendu('fleche');
      out.saitDireDifferents = rendu('fleche') !== rendu('coeur');

      /* Deux entrées portent légitimement la même image quand elles désignent
         LA MÊME CHOSE : les bombes vendues chez Bran et la bombe du sac, la
         potion vendue dans les deux boutiques. On les nomme ici, une fois,
         pour que toute AUTRE coïncidence reste une faute. */
      const CHOSE = { bombes: 'bombe', bombe: 'bombe', fleches: 'fleche' };
      const chose = x => CHOSE[x.id] || x.id;

      // deux objets DIFFÉRENTS ne doivent jamais montrer la même image
      const parImage = new Map(), doublons = [];
      for (const x of vus) {
        const im = rendu(x.spr);
        if (!im) continue;
        const vu = parImage.get(im);
        if (!vu) parImage.set(im, x);
        else if (chose(vu) !== chose(x)) doublons.push(`${x.nom} = ${vu.nom}`);
      }
      out.doublons = doublons;

      /* Second filet, et c'est le plus important : le doublon ne se voit que si
         les DEUX objets sont dans la liste. Le BOUCLIER RENFORCÉ montrait le
         cœur qu'on ramasse par terre — un dessin qui n'est dans aucune boutique,
         donc invisible au contrôle précédent. On nomme donc les dessins qui
         appartiennent à AUTRE CHOSE qu'un objet de boutique, et on interdit aux
         vignettes de pointer dessus. `fleche` et `bombeItem` n'y sont pas : ils
         servent légitimement de vignette ET de butin, c'est le même objet. */
      const AILLEURS = ['coeur', 'cle', 'eclat', 'champi', 'perle', 'tarte', 'luciole',
                        'coeurCristal', 'etoile', 'etoileVolee', 'bombeVive', 'lanterne',
                        'rubis0', 'saphir0', 'grenat0', 'pnj0', 'pnj1', 'fee', 'coffre'];
      const imagesAilleurs = new Map();
      for (const n of AILLEURS) { const im = rendu(n); if (im) imagesAilleurs.set(im, n); }
      out.empruntsAilleurs = vus.filter(x => imagesAilleurs.has(rendu(x.spr)))
        .map(x => `${x.nom} montre « ${imagesAilleurs.get(rendu(x.spr))} »`);

      // et aucune vignette ne doit être vide : un dessin invisible n'en est pas un
      out.vides = vus.filter(x => {
        const s = SPR[x.spr]; if (!s) return false;
        const g = s.getContext('2d');
        const d = g.getImageData(0, 0, s.width, s.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return n < 12;                       // moins de douze pixels : illisible
      }).map(x => x.nom);

      /* La boutique et la boîte d'objet dessinent la vignette dans un carré :
         un sprite trop allongé s'y écrase. On borne le rapport. */
      out.deformes = vus.filter(x => {
        const s = SPR[x.spr]; if (!s) return false;
        const r = s.width / s.height;
        return r < 0.6 || r > 1.7;
      }).map(x => `${x.nom} ${SPR[x.spr].width}x${SPR[x.spr].height}`);
      return out;
    });

    v('le contrôle voit bien tous les objets affichés', r.nbObjets >= 14, `${r.nbObjets} objets`);
    v('contrôle à blanc : deux fois le même dessin se reconnaissent',
      r.saitDireIdentiques, 'la comparaison ne sait pas dire « identiques »');
    v('contrôle à blanc : deux dessins distincts se distinguent',
      r.saitDireDifferents, 'la comparaison ne sait pas dire « différents »');
    v('chaque objet pointe vers un sprite qui existe',
      r.sansSprite.length === 0, r.sansSprite.join(' | '));
    v('AUCUN OBJET N EMPRUNTE LE DESSIN D UN AUTRE',
      r.doublons.length === 0, r.doublons.join(' | '));
    v('AUCUNE VIGNETTE NE MONTRE UN DESSIN QUI APPARTIENT À AUTRE CHOSE',
      r.empruntsAilleurs.length === 0, r.empruntsAilleurs.join(' | '));
    v('aucune vignette n est vide ou illisible', r.vides.length === 0, r.vides.join(' '));
    v('aucune vignette ne s écrasera dans son carré',
      r.deformes.length === 0, r.deformes.join(' | '));
    /* ---------- § 61 : une icône ne doit pas être ÉPARSE ----------
       AVERTISSEMENT, écrit après coup : ce contrôle N'AURAIT PAS attrapé le
       défaut qui l'a motivé. Le filet lisait comme un miroir posé à côté d'un
       bâton et la baguette comme un domino surmonté d'une fleur — mais mesuré,
       les deux anciens dessins étaient connexes à 100 %. Leurs morceaux SE
       TOUCHAIENT ; ils composaient mal. La lisibilité d'un pixel art se juge à
       l'œil sur l'image rendue, et je n'ai pas trouvé de nombre qui la capture.

       Ce qui reste ici est une garantie plus faible, mais vraie : aucune icône
       n'est faite de taches franchement séparées. Elle est gardée pour ce
       qu'elle est, pas pour ce qu'on aurait aimé qu'elle soit. */
    const cx = await page.evaluate(() => {
      const part = (nom) => {
        const s = SPR[nom]; if (!s) return null;
        const c = document.createElement('canvas'); c.width = s.width; c.height = s.height;
        const g = c.getContext('2d'); g.drawImage(s, 0, 0);
        const d = g.getImageData(0, 0, s.width, s.height).data, W = s.width, H = s.height;
        const op = new Uint8Array(W * H); let tot = 0;
        for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 24) { op[i] = 1; tot++; }
        if (!tot) return { tot: 0, frac: 0 };
        const vus = new Uint8Array(W * H); let best = 0;
        for (let i = 0; i < W * H; i++) {
          if (!op[i] || vus[i]) continue;
          let n = 0; const f = [i]; vus[i] = 1;
          while (f.length) {
            const p = f.pop(); n++; const x = p % W, y = (p / W) | 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              const q = ny * W + nx; if (op[q] && !vus[q]) { vus[q] = 1; f.push(q); }
            }
          }
          if (n > best) best = n;
        }
        return { tot, best, frac: best / tot };
      };
      const out = { eparses: [], mesurees: 0, filet: 0, baguette: 0 };
      for (const o of OBJETS) {
        const m = part(o.spr); if (!m) continue;
        out.mesurees++;
        if (m.frac < 0.9) out.eparses.push(`${o.spr} ${Math.round(m.frac * 100)}%`);
        if (o.spr === 'filetItem') out.filet = m.frac;
        if (o.spr === 'baguetteItem') out.baguette = m.frac;
      }
      /* Contrôle à blanc : deux taches franchement séparées doivent être vues
         comme éparses, sinon la mesure dirait « tout va bien » de n'importe quoi. */
      const c = document.createElement('canvas'); c.width = 14; c.height = 14;
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 4, 4); g.fillRect(10, 10, 4, 4);
      SPR.__essai = c;
      out.blanc = part('__essai').frac;
      delete SPR.__essai;
      return out;
    });
    v('CONTRÔLE À BLANC : DEUX TACHES SÉPARÉES SONT VUES COMME ÉPARSES',
      cx.blanc <= 0.6, `plus grosse composante : ${Math.round(cx.blanc * 100)} %`);
    v(`les ${cx.mesurees} icônes d'objet ont été mesurées`, cx.mesurees >= 9, cx.mesurees);
    v('aucune icône n\'est faite de taches franchement séparées',
      cx.eparses.length === 0, cx.eparses.join(' · '));

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
