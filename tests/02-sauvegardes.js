'use strict';
/* CORRECTIFS.md § 3 — trois emplacements nommés, reprise de l'ancienne
   sauvegarde sans la détruire, et copie de secours exportable/restaurable. */
const { pageDeJeu, dort } = require('./outils');

module.exports = {
  nom: 'Sauvegardes',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      for (let i = 0; i < NB_SLOTS; i++) await stockEffacer(i);
      await effacerCle(CLE_ANCIENNE);
      await verifierSauves();
      out.vides = resumes.filter(x => x === null).length;

      // § 3.1 — chaque partie va dans son emplacement, avec son nom
      nouvellePartie('LEA', 1); await dort(250);
      J.fragments = 2; Q.lucioles = 5; J.rubis = 240; J.objets = ['arc'];
      await sauver(true); await dort(200);
      out.slot2 = !!localStorage.getItem('kaze-partie-2');
      out.slot1Vide = !localStorage.getItem('kaze-partie-1');
      out.nom = resumes[1] && resumes[1].nom;
      out.stats = resumes[1] && [resumes[1].fragments, resumes[1].lucioles];

      nouvellePartie('BOB', 0); await dort(250);
      out.coexistent = resumes[0].nom === 'BOB' && resumes[1].nom === 'LEA';

      // charger l'un ne doit pas abîmer l'autre
      await charger(1); await dort(300);
      out.rechargee = [nomPartie, emplacement, J.fragments];
      out.autreIntacte = resumes[0].nom === 'BOB';

      // effacer un seul emplacement
      await stockEffacer(0); resumes[0] = null;
      out.effaceCible = !localStorage.getItem('kaze-partie-1') && !!localStorage.getItem('kaze-partie-2');

      // § 3.3 — copie de secours : export, purge totale, restauration
      const code = await construireCode();
      out.codeLisible = !!lireCode(code);
      localStorage.clear();
      for (const k in memoire) delete memoire[k];
      await verifierSauves();
      out.apresPurge = resumes.filter(Boolean).length;

      document.getElementById('cfCode').value = code;
      await restaurerCode(); await dort(300);
      const s = JSON.parse(localStorage.getItem('kaze-partie-2'));
      out.restauree = { nom: s.nom, frag: s.J.fragments, luc: s.Q.lucioles, rubis: s.J.rubis };
      await charger(1); await dort(400);
      out.rejouable = etat === 'jeu' && J.fragments === 2 && J.rubis === 240;
      out.apresRestauration = resumes.filter(Boolean).length;

      // un code invalide ne doit rien détruire : on compare à l'état d'avant
      document.getElementById('cfCode').value = 'nimportequoi!!';
      await restaurerCode(); await dort(200);
      out.apresCodeInvalide = resumes.filter(Boolean).length;

      // § 3.2 — la reprise d'une ancienne partie ne supprime l'original
      //         qu'après avoir relu la copie
      for (let i = 0; i < NB_SLOTS; i++) await stockEffacer(i);
      localStorage.setItem('kaze-partie', JSON.stringify({
        v: VERSION_SAUVE, date: 1, temps: 1800, Q: { lucioles: 3 }, J: { fragments: 1 } }));
      await verifierSauves();
      out.reprise = resumes[0] && [resumes[0].nom, resumes[0].fragments, resumes[0].lucioles];
      out.ancienneNettoyee = !localStorage.getItem('kaze-partie');
      return out;
    });

    v('trois emplacements vides au départ', r.vides === 3, r.vides);
    v('la partie va dans l\'emplacement choisi', r.slot2 && r.slot1Vide, `${r.slot2}/${r.slot1Vide}`);
    v('le nom et les stats sont conservés',
      r.nom === 'LEA' && JSON.stringify(r.stats) === '[2,5]', `${r.nom} ${JSON.stringify(r.stats)}`);
    v('deux parties coexistent', r.coexistent, 'écrasement');
    v('recharger vise le bon emplacement',
      JSON.stringify(r.rechargee) === '["LEA",1,2]', JSON.stringify(r.rechargee));
    v('l\'autre partie reste intacte', r.autreIntacte, 'abîmée');
    v('effacer n\'atteint qu\'un emplacement', r.effaceCible, 'les deux ont sauté');
    v('le code de secours est relisible', r.codeLisible, 'illisible');
    v('la purge du navigateur efface bien tout', r.apresPurge === 0, r.apresPurge);
    v('la restauration ramène la partie complète',
      r.restauree.nom === 'LEA' && r.restauree.frag === 2 && r.restauree.luc === 5 && r.restauree.rubis === 240,
      JSON.stringify(r.restauree));
    v('la partie restaurée se rejoue', r.rejouable, 'injouable');
    v('la restauration remet bien les parties en place', r.apresRestauration > 0, r.apresRestauration);
    v('un code invalide ne détruit rien',
      r.apresCodeInvalide === r.apresRestauration,
      `${r.apresRestauration} avant, ${r.apresCodeInvalide} après`);
    v('l\'ancienne sauvegarde est reprise',
      JSON.stringify(r.reprise) === '["KAZE",1,3]', JSON.stringify(r.reprise));
    v('l\'ancienne clé n\'est retirée qu\'après relecture', r.ancienneNettoyee, 'restée');
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
