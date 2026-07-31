'use strict';
/* La musique : elle démarre, suit la situation (titre, vallée, Cendres,
   gardien), se coupe et se rallume, et la préférence survit au rechargement.
   Le navigateur de test est lancé sans politique d'autoplay pour pouvoir
   créer le contexte audio sans clic. */
const { pageDeJeu, nouvellePartie, dort } = require('./outils');

module.exports = {
  nom: 'Musique',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur);
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      initSon();
      out.contexte = !!AC;

      // les morceaux existent et sont bien formés
      out.themes = Object.keys(MUSIQUES);
      out.pistesValides = Object.values(MUSIQUES).every(m =>
        m.bpm > 0 && m.pistes.length > 0 &&
        m.pistes.every(pi => pi.n.length > 0 &&
          pi.n.every(n => n === '-' || n === '=' || hauteur(n) > 0)));

      // chaque note nommée doit donner une fréquence audible
      out.la4 = Math.round(hauteur('A4'));
      out.do3 = Math.round(hauteur('C3'));

      // le thème suit la situation
      etat = 'titre'; out.auTitre = themeVoulu();
      etat = 'jeu'; boss = null;
      J.y = 45 * TS; out.enVallee = themeVoulu();
      J.y = (Y_CENDRE + 20) * TS; out.enCendre = themeVoulu();
      boss = { type: 'coeur' }; out.avecBoss = themeVoulu();
      boss = null; J.y = 45 * TS;

      // le séquenceur programme réellement des notes
      let jouees = 0;
      const vrai = AC.createOscillator.bind(AC);
      AC.createOscillator = () => { jouees++; return vrai(); };
      musiqueOn = true; volumeMusique();
      lancerMusique('vallee');
      await dort(700);
      out.notesJouees = jouees;
      out.themeCourant = themeMus;
      out.volumeAllume = gainMus ? gainMus.gain.value : null;

      // couper la musique met le volume à zéro
      basculerMusique();
      out.apresCoupure = { actif: musiqueOn, volume: gainMus.gain.value,
                           stocke: localStorage.getItem('kaze-musique') };
      basculerMusique();
      out.apresRallumage = { actif: musiqueOn, volume: gainMus.gain.value };
      AC.createOscillator = vrai;
      return out;
    });

    v('le contexte audio existe', r.contexte, 'absent');
    v('les quatre morceaux sont définis',
      r.themes.length === 4 && r.themes.includes('vallee') && r.themes.includes('cendre')
      && r.themes.includes('boss') && r.themes.includes('titre'), r.themes.join(','));
    v('toutes les notes des partitions sont valides', r.pistesValides,
      'une piste contient une note inconnue');
    v('les hauteurs sont justes', r.la4 === 440 && r.do3 === 131, `A4=${r.la4} C3=${r.do3}`);
    v('l\'écran-titre a son thème', r.auTitre === 'titre', r.auTitre);
    v('la vallée a le sien', r.enVallee === 'vallee', r.enVallee);
    v('les Terres de Cendre changent de morceau', r.enCendre === 'cendre', r.enCendre);
    v('un gardien impose son thème', r.avecBoss === 'boss', r.avecBoss);
    v('LE SÉQUENCEUR JOUE VRAIMENT DES NOTES', r.notesJouees > 0, `${r.notesJouees} notes`);
    v('le morceau en cours est celui demandé', r.themeCourant === 'vallee', r.themeCourant);
    v('la musique sort par son propre volume', r.volumeAllume > 0, r.volumeAllume);
    v('la couper met le volume à zéro et retient le choix',
      r.apresCoupure.actif === false && r.apresCoupure.volume === 0 && r.apresCoupure.stocke === '0',
      JSON.stringify(r.apresCoupure));
    v('la rallumer la ramène', r.apresRallumage.actif === true && r.apresRallumage.volume > 0,
      JSON.stringify(r.apresRallumage));
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
