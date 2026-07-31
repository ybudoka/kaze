'use strict';
/* CORRECTIFS.md § 3.4, 4.1 et 4.2 — mourir ne doit rien coûter, B ne doit pas
   relancer une partie par accident, et l'écran de fin ne doit pas écraser la
   sauvegarde en cours. */
const { pageDeJeu } = require('./outils');

module.exports = {
  nom: 'Mort et écran de fin',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      // vrai appui : il faut relâcher avant, sinon le tampon ne s'arme pas
      const tape = b => { BTN[b] = 0; enfoncer(b); };
      const lire = () => JSON.parse(localStorage.getItem('kaze-partie-1'));
      const out = {};

      for (let i = 0; i < NB_SLOTS; i++) await stockEffacer(i);
      nouvellePartie('LEA', 0); await dort(300);

      // § 3.4 — progression volontairement NON sauvegardée, comme pendant un
      // combat de gardien où la sauvegarde automatique est justement bloquée
      J.fragments = 2; Q.lucioles = 6; J.rubis = 240; J.bombes = 7;
      J.objets = ['arc']; Q.epeeLongue = true;
      coffres[0].ouvert = true; lucioles[0].pris = true;
      dernierAuto = tempsJeu;
      out.avantMort = [lire().J.fragments, lire().Q.lucioles, lire().J.rubis];

      // § 4.1 — on meurt en plein coup d'épée : le B en tampon ne doit pas valider
      tape('B');
      out.tamponArme = (buf['B'] | 0) > 0;
      Q.potions = 0; J.pv = 0; mourir(); await dort(400);
      out.tamponVide = (buf['B'] | 0) === 0;

      const s = lire();
      out.apresMort = [s.J.fragments, s.Q.lucioles, s.J.rubis, s.J.bombes];
      out.acquis = JSON.stringify(s.J.objets) === '["arc"]' && s.Q.epeeLongue === true
                && s.coffres[0][0] === 1 && s.lucioles[0] === 1;
      out.vivant = s.J.pv === s.J.pvmax;
      out.auVillage = Math.abs(s.J.x - (35 * TS + 8)) < 1 && Math.abs(s.J.y - (45 * TS + 8)) < 1;

      // § 4.1 — ni B ni A ne valident l'écran de fin ; START seul le fait
      while (finT <= VERROU_FIN + 5) await dort(60);
      viderTampon(); tape('B'); await dort(120); out.BsansEffet = etat === 'mort';
      viderTampon(); tape('A'); await dort(120); out.AsansEffet = etat === 'mort';

      // § 4.2 — l'écran de fin ne propose plus de repartir sur place
      out.options = optionsFin(false).map(o => o.id);
      const i = out.options.findIndex(o => o !== 'continuer');
      menuSel = i; viderTampon(); tape('Start'); await dort(300);
      out.versTitre = etat === 'titre';
      out.sauvegardePreservee = lire().J.fragments === 2;

      // reprendre fonctionne toujours
      etat = 'mort'; finT = VERROU_FIN + 10;
      menuSel = optionsFin(false).findIndex(o => o.id === 'continuer');
      viderTampon(); tape('Start'); await dort(500);
      out.reprise = etat === 'jeu' && J.fragments === 2 && Q.lucioles === 6;

      // sur un emplacement vide, une partie neuve reste offerte
      await stockEffacer(2); resumes[2] = null; emplacement = 2;
      out.optionsVide = optionsFin(false).map(o => o.id);
      return out;
    });

    v('la progression n\'était pas encore sauvegardée',
      JSON.stringify(r.avantMort) === '[0,0,0]', JSON.stringify(r.avantMort));
    v('le tampon contenait bien un appui B', r.tamponArme, 'non armé');
    v('mourir vide le tampon d\'entrées', r.tamponVide, 'le B hérité est resté');
    v('MOURIR NE COÛTE AUCUNE PROGRESSION',
      JSON.stringify(r.apresMort) === '[2,6,240,7]', JSON.stringify(r.apresMort));
    v('objets, améliorations et coffres restent acquis', r.acquis, 'perdus');
    v('on repart vivant', r.vivant, 'pv non restaurés');
    v('on repart au village', r.auVillage, 'position inattendue');
    v('B ne valide pas l\'écran de fin', r.BsansEffet, 'B a relancé une partie');
    v('A ne valide pas l\'écran de fin', r.AsansEffet, 'A a relancé une partie');
    v('plus de partie neuve sur un emplacement occupé',
      !r.options.includes('nouvelle'), r.options.join(','));
    v('START renvoie au titre', r.versTitre, 'resté sur l\'écran de fin');
    v('LA SAUVEGARDE N\'EST PAS ÉCRASÉE', r.sauvegardePreservee, 'remise à zéro');
    v('reprendre la sauvegarde fonctionne', r.reprise, 'reprise cassée');
    v('sur un emplacement vide, partie neuve possible',
      r.optionsVide.includes('nouvelle'), r.optionsVide.join(','));
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
