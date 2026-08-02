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

      // le thème suit la situation, du plus impérieux au plus général
      const au = (x, y) => { J.x = x * TS + 8; J.y = y * TS + 8; return themeVoulu(); };
      etat = 'titre'; out.auTitre = themeVoulu();
      etat = 'victoire'; out.aLaVictoire = themeVoulu();
      etat = 'mort'; out.aLaMort = themeVoulu();
      etat = 'jeu'; boss = null;

      out.enVallee = au(50, 30);                    // pleine campagne
      out.auVillage = au(35, 45);                   // refuge
      out.dansLaRuine = au(17, 69);                 // salle close
      // en plein air dans les Cendres : hors de la Forge (30-44 × 90-100),
      // des Falaises et de l'Antre — sinon on obtiendrait « donjon »
      out.enCendre = au(20, Y_CENDRE + 38);
      out.enCendreHorsSalle = !salleDe(20 * TS + 8, (Y_CENDRE + 38) * TS + 8);
      out.dansLaForge = au(CENDRE.forge.x0 + 5, CENDRE.forge.y0 + 5);
      au(50, 30);
      boss = { type: 'boss' }; out.gardienDePierre = themeVoulu();
      boss = { type: 'coeur' }; out.coeurDeCendre = themeVoulu();
      // un gardien l'emporte même sur un lieu particulier
      au(17, 69); out.bossPrimeSurLeLieu = themeVoulu();
      boss = null; au(50, 30);

      // le silence de la mort coupe réellement la musique
      lancerMusique('vallee');
      etat = 'mort'; majMusique();
      out.silenceALaMort = themeMus === null;
      etat = 'jeu'; majMusique();
      out.reprendApres = themeMus;

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
    v('tous les morceaux sont définis',
      ['vallee', 'cendre', 'boss', 'titre', 'village', 'donjon', 'coeurBoss', 'victoire']
        .every(t => r.themes.includes(t)), r.themes.join(','));
    v('toutes les notes des partitions sont valides', r.pistesValides,
      'une piste contient une note inconnue');
    v('les hauteurs sont justes', r.la4 === 440 && r.do3 === 131, `A4=${r.la4} C3=${r.do3}`);
    v('l\'écran-titre a son thème', r.auTitre === 'titre', r.auTitre);
    v('la victoire a le sien', r.aLaVictoire === 'victoire', r.aLaVictoire);
    v('la mort se joue en silence', r.aLaMort === null, r.aLaMort);
    v('la vallée a son morceau', r.enVallee === 'vallee', r.enVallee);
    v('LE VILLAGE EN A UN AUTRE', r.auVillage === 'village', r.auVillage);
    v('UNE SALLE CLOSE EN A UN AUTRE', r.dansLaRuine === 'donjon', r.dansLaRuine);
    v('le point d\'essai des Cendres est bien en plein air', r.enCendreHorsSalle, 'dans une salle');
    v('les Terres de Cendre changent de morceau', r.enCendre === 'cendre', r.enCendre);
    v('une salle des Cendres bascule aussi', r.dansLaForge === 'donjon', r.dansLaForge);
    v('LES DEUX GARDIENS ONT CHACUN LE LEUR',
      r.gardienDePierre === 'boss' && r.coeurDeCendre === 'coeurBoss',
      `${r.gardienDePierre} / ${r.coeurDeCendre}`);
    v('un gardien l\'emporte sur le lieu', r.bossPrimeSurLeLieu === 'coeurBoss', r.bossPrimeSurLeLieu);
    v('la musique se tait vraiment à la mort', r.silenceALaMort, 'elle continue');
    v('et repart ensuite', r.reprendApres === 'vallee', r.reprendApres);
    v('LE SÉQUENCEUR JOUE VRAIMENT DES NOTES', r.notesJouees > 0, `${r.notesJouees} notes`);
    v('le morceau en cours est celui demandé', r.themeCourant === 'vallee', r.themeCourant);
    v('la musique sort par son propre volume', r.volumeAllume > 0, r.volumeAllume);
    v('la couper met le volume à zéro et retient le choix',
      r.apresCoupure.actif === false && r.apresCoupure.volume === 0 && r.apresCoupure.stocke === '0',
      JSON.stringify(r.apresCoupure));
    v('la rallumer la ramène', r.apresRallumage.actif === true && r.apresRallumage.volume > 0,
      JSON.stringify(r.apresRallumage));
    /* ---- Le séquenceur doit survivre à une horloge qui bat en retard ----
       C'est le cas de la recopie AirPlay vers un téléviseur : le Mac encode la
       vidéo en continu et `setInterval` arrive quand il peut. Avec 250 ms
       d'avance, la file se vidait entre deux battements — 2,22 s de silence sur
       4, et le tempo repartait n'importe où. Les bruitages, eux, sont des coups
       isolés : c'est pourquoi seule la musique cassait. */
    const t = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      majMusique = () => {};                    // la boucle du jeu ne s'en mêle pas
      const departs = [];
      const vraiOsc = AC.createOscillator.bind(AC);
      AC.createOscillator = () => {
        const o = vraiOsc();
        const vraiStart = o.start.bind(o);
        o.start = q => { departs.push(q); return vraiStart(q); };
        return o;
      };
      if (horlogeMus) { clearInterval(horlogeMus); horlogeMus = null; }
      themeMus = null; lancerMusique('boss');
      // on bride le battement à 1 Hz, comme une machine qui diffuse sur la TV
      clearInterval(horlogeMus); horlogeMus = setInterval(tickMusique, 1000);
      await dort(4200);
      clearInterval(horlogeMus); horlogeMus = null;
      AC.createOscillator = vraiOsc;
      arreterMusique();
      const d = [...new Set(departs.map(q => +q.toFixed(4)))].sort((a, b) => a - b);
      const ecarts = [];
      for (let i = 1; i < d.length; i++) ecarts.push(d[i] - d[i - 1]);
      const pas = 60 / MUSIQUES.boss.bpm / 2;
      return { pas, nb: departs.length,
               pireEcart: ecarts.length ? Math.max(...ecarts) : 0,
               trous: ecarts.filter(x => x > pas * 1.6).length };
    });
    v('LE SÉQUENCEUR NE TOMBE PAS À SEC QUAND L\'HORLOGE BAT EN RETARD',
      t.trous === 0, `${t.trous} trou(s), pire écart ${t.pireEcart.toFixed(3)}s pour un pas de ${t.pas.toFixed(3)}s`);
    v('et il programme bien tout le morceau', t.nb >= 2 * Math.floor(4 / t.pas) * 0.8,
      `${t.nb} notes pour ~${2 * Math.round(4 / t.pas)} attendues`);

    /* ---- Les partitions elles-mêmes ---- */
    const part = await page.evaluate(() => {
      const boiteux = [], sourds = [];
      for (const [nom, m] of Object.entries(MUSIQUES)) {
        const L = m.pistes.map(pi => pi.n.length);
        if (L.some(x => x !== L[0])) boiteux.push(`${nom} (${L.join('/')})`);
        const f = Math.min(...m.pistes.flatMap(pi =>
          pi.n.filter(n => n !== '-' && n !== '=').map(hauteur)));
        if (f < 30) sourds.push(`${nom} (${Math.round(f)} Hz)`);
      }
      return { boiteux, sourds };
    });
    v('LES DEUX VOIX D\'UN MORCEAU ONT LA MÊME LONGUEUR',
      part.boiteux.length === 0, part.boiteux.join(', ') + ' : la boucle tourne sur la plus longue, l\'autre se déphase');
    v('AUCUNE BASSE SOUS LE SEUIL AUDIBLE (30 Hz)',
      part.sourds.length === 0, part.sourds.join(', '));

    /* ---- Le niveau de sortie ----
       Rendu hors ligne de la vraie chaîne (noteMus → gainMus → maitre). À
       -30 dBFS de crête, la musique s'entendait collée à l'oreille sur un
       téléphone et disparaissait sur un ordinateur ou un téléviseur. */
    const niv = await page.evaluate(async () => {
      const dB = x => x > 0 ? 20 * Math.log10(x) : -Infinity;
      const rendre = async (nom, sfx) => {
        const sauve = { AC, maitre, gainMus, themeMus, pasMus, tempsMus };
        const off = new OfflineAudioContext(1, 44100 * 6, 44100);
        AC = off;
        maitre = off.createGain(); maitre.gain.value = VOL_MAITRE; maitre.connect(off.destination);
        gainMus = off.createGain(); gainMus.gain.value = .5; gainMus.connect(maitre);
        if (sfx) SFX[nom]();
        else { themeMus = nom; pasMus = 0; tempsMus = .02; while (tempsMus < 5.5) programmerPas(); }
        const buf = await off.startRendering();
        AC = sauve.AC; maitre = sauve.maitre; gainMus = sauve.gainMus;
        themeMus = sauve.themeMus; pasMus = sauve.pasMus; tempsMus = sauve.tempsMus;
        const d = buf.getChannelData(0);
        let pic = 0, somme = 0;
        for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pic) pic = a; somme += d[i] * d[i]; }
        return { pic: dB(pic), rms: dB(Math.sqrt(somme / d.length)) };
      };
      const m = await rendre('vallee', false);
      const s = await rendre('bombe', true);
      return { musPic: m.pic, musRms: m.rms, sfxPic: s.pic };
    });
    v('LA MUSIQUE SORT À UN NIVEAU AUDIBLE (crête > -24 dBFS)',
      niv.musPic > -24, `crête ${niv.musPic.toFixed(1)} dBFS, rms ${niv.musRms.toFixed(1)} dBFS`);
    v('sans saturer', niv.musPic < -6 && niv.sfxPic < -6,
      `musique ${niv.musPic.toFixed(1)}, bruitage ${niv.sfxPic.toFixed(1)} dBFS`);
    v('et reste sous les bruitages', niv.sfxPic > niv.musPic,
      `musique ${niv.musPic.toFixed(1)} vs bruitage ${niv.sfxPic.toFixed(1)} dBFS`);

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
