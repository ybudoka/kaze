'use strict';
/* Les gemmes : trois couleurs, trois valeurs. Le bleu et le rouge doivent
   exister, tomber, se ramasser pour leur valeur, et se dessiner chacun avec
   sa propre teinte — sans quoi on ne les distinguerait pas. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Gemmes',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      out.valeurs = VALEUR_GEMME;

      // chaque gemme a ses quatre images d'animation
      out.sprites = ['rubis', 'saphir', 'grenat']
        .map(n => [0, 1, 2, 3].every(f => !!SPR[n + f]));

      // les trois teintes doivent différer : on lit le pixel central
      const teinte = nom => {
        const c = document.createElement('canvas');
        c.width = SPR[nom].width; c.height = SPR[nom].height;
        const g = c.getContext('2d'); g.drawImage(SPR[nom], 0, 0);
        const d = g.getImageData(7, 6, 1, 1).data;
        return `${d[0]},${d[1]},${d[2]}`;
      };
      out.teintes = { vert: teinte('rubis0'), bleu: teinte('saphir0'), rouge: teinte('grenat0') };

      // ramassage : chaque gemme vaut son prix
      J.invuln = 99999;
      const ramasser = async (type) => {
        butins.length = 0;
        const avant = J.rubis;
        butins.push({ x: J.x, y: J.y, z: J.z, vz: 0, type, t: 0 });
        for (let f = 0; f < 10; f++) await dort(18);
        return J.rubis - avant;
      };
      J.rubis = 0;
      out.gainVert = await ramasser('rubis');
      out.gainBleu = await ramasser('saphir');
      out.gainRouge = await ramasser('grenat');

      // les chutes : on vide le hasard sur un grand nombre de tirages
      const tirer = (y, n) => {
        const compte = {};
        for (let i = 0; i < n; i++) {
          butins.length = 0;
          larguer(40 * TS, y, 0);
          for (const b of butins) compte[b.type] = (compte[b.type] || 0) + 1;
        }
        butins.length = 0;
        return compte;
      };
      out.valleeTirages = tirer(45 * TS, 3000);
      out.cendreTirages = tirer((Y_CENDRE + 20) * TS, 3000);

      /* Frapper un butin doit le ramasser : marcher pile dessus était pénible
         quand il tombait dans un recoin. */
      const cx0 = Math.floor(J.x / TS), cy0 = Math.floor(J.y / TS);
      for (let y = cy0 - 4; y <= cy0 + 4; y++) for (let x = cx0 - 4; x <= cx0 + 4; x++) {
        putO(x, y, O.RIEN); putE(x, y, 0); putS(x, y, S.HERBE);
      }
      prerendreSol();
      const px = J.x, py = J.y;
      const frapper = async (dir, dx, dy, type) => {
        butins.length = 0;
        J.x = px; J.y = py; J.z = 0; J.dir = dir; J.atk = 0; J.spin = 0; J.rubis = 0; J.pv = 2;
        butins.push({ x: px + dx, y: py + dy, z: 0, vz: 0, type, t: 0 });
        J.atk = 12;
        for (let f = 0; f < 8; f++) await dort(18);
        return butins.length === 0;
      };
      out.frappeDroite = await frapper(3, 24, 0, 'saphir');
      out.frappeHaut   = await frapper(0, 0, -24, 'rubis');
      out.frappeGauche = await frapper(1, -24, 0, 'grenat');
      out.frappeBas    = await frapper(2, 0, 24, 'coeur');
      // et le gain est bien crédité
      butins.length = 0; J.rubis = 0; J.dir = 3;
      butins.push({ x: px + 22, y: py, z: 0, vz: 0, type: 'grenat', t: 0 });
      J.atk = 12; for (let f = 0; f < 8; f++) await dort(18);
      out.gainParFrappe = J.rubis;
      // un butin hors de portée reste au sol
      out.horsPortee = !(await frapper(3, 70, 0, 'rubis'));
      butins.length = 0;
      /* ---- ce qui est POSÉ dans le monde ne s'évapore pas ----
         Les butins vieillissent et s'effacent : sans quoi le sol se couvre de
         rubis oubliés. Mais la règle était écrite à l'envers — une liste des
         RESCAPÉS — et elle avait oublié la CAPE (l'outil du monde 7) et les
         SIX FLEURS de Borve. Ils s'évaporaient 12,7 s après le chargement, ce
         que ne voyait aucun contrôle : tous mesurent dans les premières
         secondes d'une partie. On fait donc vieillir la vraie boucle. */
      const inventaire = () => { const c = {}; for (const b of butins) c[b.type] = (c[b.type] || 0) + 1; return c; };
      /* Les contrôles précédents ont ramassé et déplacé : on repeuple le monde
         pour partir de ce qu'une PARTIE FRAÎCHE contient réellement. */
      Q.cape = false; Q.fleurs = 0; Q.fleursRendues = false;
      peupler();
      out.avantAge = inventaire();
      for (const b of butins) b.t = 0;
      for (let i = 0; i < 900; i++) majDivers();       // 900 images > le seuil de 760
      out.apresAge = inventaire();

      /* Contrôle à blanc : le vieillissement DOIT effacer ce qui tombe d'un
         monstre. Sinon « rien n'a disparu » ne prouverait rien — il suffirait
         que la boucle ne vieillisse pas. */
      butins.length = 0;
      for (const t of ['rubis', 'saphir', 'grenat', 'coeur', 'bombe', 'fleche'])
        butins.push({ x: 4 * TS, y: 4 * TS, z: 0, vz: 0, type: t, t: 0 });
      J.x = 60 * TS; J.y = 60 * TS;                     // loin : pas de ramassage
      out.chuteAvant = butins.length;
      for (let i = 0; i < 900; i++) majDivers();
      out.chuteApres = butins.length;

      return out;
    });

    v('les trois valeurs sont définies',
      r.valeurs.rubis === 1 && r.valeurs.saphir === 5 && r.valeurs.grenat === 20,
      JSON.stringify(r.valeurs));
    v('chaque gemme a ses images', r.sprites.every(Boolean), JSON.stringify(r.sprites));
    v('LES TROIS COULEURS SONT DISTINCTES',
      new Set(Object.values(r.teintes)).size === 3, JSON.stringify(r.teintes));
    v('le rubis vert vaut 1', r.gainVert === 1, r.gainVert);
    v('LE SAPHIR BLEU VAUT 5', r.gainBleu === 5, r.gainBleu);
    v('LE GRENAT ROUGE VAUT 20', r.gainRouge === 20, r.gainRouge);
    v('les trois gemmes tombent dans la vallée',
      r.valleeTirages.rubis > 0 && r.valleeTirages.saphir > 0 && r.valleeTirages.grenat > 0,
      JSON.stringify(r.valleeTirages));
    v('le grenat reste rare dans la vallée',
      r.valleeTirages.grenat < r.valleeTirages.saphir
      && r.valleeTirages.saphir < r.valleeTirages.rubis,
      JSON.stringify(r.valleeTirages));
    v('les Terres de Cendre rapportent davantage',
      r.cendreTirages.grenat > r.valleeTirages.grenat
      && r.cendreTirages.saphir > r.valleeTirages.saphir,
      `vallée ${JSON.stringify(r.valleeTirages)} / cendre ${JSON.stringify(r.cendreTirages)}`);
    v('FRAPPER UN BUTIN LE RAMASSE, DANS LES 4 DIRECTIONS',
      r.frappeDroite && r.frappeHaut && r.frappeGauche && r.frappeBas,
      `droite=${r.frappeDroite} haut=${r.frappeHaut} gauche=${r.frappeGauche} bas=${r.frappeBas}`);
    v('le gain est bien crédité par la frappe', r.gainParFrappe === 20, r.gainParFrappe);
    v('un butin hors de portée reste au sol', r.horsPortee, 'ramassé de trop loin');
    const disparus = Object.keys(r.avantAge).filter(k => (r.apresAge[k] || 0) < r.avantAge[k]);
    v('CE QUI EST POSÉ DANS LE MONDE NE S\'ÉVAPORE PAS',
      disparus.length === 0,
      disparus.map(k => `${k} ${r.avantAge[k]}→${r.apresAge[k] || 0}`).join(' · '));
    v('la cape et les six fleurs de givre sont encore là',
      r.apresAge.cape === 1 && r.apresAge.fleurgivre === 6,
      `cape=${r.apresAge.cape || 0} fleurs=${r.apresAge.fleurgivre || 0}`);
    v('CONTRÔLE À BLANC : CE QUI TOMBE D\'UN MONSTRE S\'EFFACE BIEN',
      r.chuteAvant === 6 && r.chuteApres === 0,
      `${r.chuteAvant} → ${r.chuteApres}`);
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
