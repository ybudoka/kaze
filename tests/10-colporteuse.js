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

      // elle vend autre chose que Bran
      const sien = articlesItinerants().map(a => a.id);
      const bran = articles().map(a => a.id);
      out.exclusifs = sien.filter(i => !bran.includes(i));
      out.communs = sien.filter(i => bran.includes(i));

      // acheter chez elle : capacités augmentées
      J.objets = ['arc', 'bombe']; J.rubis = 500; J.pvmax = 6; J.pv = 6;
      out.avant = { fleches: maxFleches(), bombes: maxBombes(), pvmax: J.pvmax };
      ouvrirBoutique('itinerant');
      out.qui = boutique.qui;
      const acheterId = id => { boutique.sel = boutique.liste.findIndex(a => a.id === id); acheter(); };
      acheterId('carquois'); acheterId('sac'); acheterId('coeur');
      out.apres = { fleches: maxFleches(), bombes: maxBombes(), pvmax: J.pvmax, rubis: J.rubis };
      // un article déjà acquis ne se rachète pas
      const avantRubis = J.rubis;
      acheterId('carquois');
      out.pasDeRachat = J.rubis === avantRubis;
      boutique = null;

      // elle finit par plier bagage
      marchand.reste = 1; tempsJeu = 100;
      majMarchand(); majMarchand();
      out.repartie = !marchand.actif;
      out.reviendra = marchand.prochain > tempsJeu;

      // ses achats survivent à une sauvegarde/rechargement
      await sauver(true); await dort(250);
      await charger(0); await dort(400);
      out.apresRechargement = { carquois: !!Q.carquois, sac: !!Q.grandSac,
                                fleches: maxFleches(), bombes: maxBombes() };
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
    v('elle finit par plier bagage et reviendra',
      r.repartie && r.reviendra, `repartie=${r.repartie} reviendra=${r.reviendra}`);
    v('SES ACHATS SURVIVENT AU RECHARGEMENT',
      r.apresRechargement.carquois && r.apresRechargement.sac
      && r.apresRechargement.fleches === 99 && r.apresRechargement.bombes === 40,
      JSON.stringify(r.apresRechargement));
    v('elle-même n\'est pas sauvegardée', r.absenteApresChargement, 'ressuscitée au chargement');

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
