'use strict';
/* CORRECTIFS.md § 52 — un bouton ne se presse qu'ENFONCÉ, jamais au survol.

   Signalé depuis un casque Quest, en navigateur plat : « dès que le pointeur
   passe dessus, ça clique ». Le laser d'une manette Touch émet des
   `pointermove` de type « touch » SANS que la gâchette soit pressée. La règle
   d'avant — « c'est un contact tactile, donc c'est un appui » — pressait donc
   le bouton au simple survol : impossible de traverser la manette à l'écran
   sans déclencher trois attaques.

   Ce que l'on mesure : l'état RÉEL des boutons (`BTN`) après des événements
   pointeur fabriqués à la main, avec les mêmes champs que le casque envoie.
   Et l'inverse aussi — glisser d'un bouton à l'autre, doigt enfoncé, doit
   continuer de marcher : c'est pour ça que la règle trop large existait. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Le pointeur ne presse qu\'enfoncé',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(() => {
      const out = {};
      const centre = id => { const e = document.getElementById(id).getBoundingClientRect();
        return { x: e.left + e.width / 2, y: e.top + e.height / 2, w: e.width }; };
      const B = centre('btB'), A = centre('btA');
      out.boutonsVisibles = B.w > 0 && A.w > 0;

      const ev = (type, p) => document.dispatchEvent(new PointerEvent(type, Object.assign(
        { bubbles: true, cancelable: true, pointerId: 7 }, p)));
      const presses = () => Object.keys(BTN).filter(k => BTN[k]).join(',');
      const raz = () => { ev('pointerup', { pointerType: 'touch', buttons: 0, clientX: 0, clientY: 0 });
        for (const k in BTN) BTN[k] = 0; for (const k in compte) compte[k] = 0;
        for (const k in doigts) delete doigts[k]; };

      /* 1) LE SURVOL — exactement ce qu'émet le laser du casque : un
            `pointermove` de type « touch », aucun bouton enfoncé. */
      raz();
      ev('pointermove', { pointerType: 'touch', buttons: 0, clientX: B.x, clientY: B.y });
      out.survolTouch = presses();
      raz();
      ev('pointermove', { pointerType: 'mouse', buttons: 0, clientX: B.x, clientY: B.y });
      out.survolSouris = presses();
      raz();
      // et le survol répété ne finit pas par passer
      for (let i = 0; i < 20; i++)
        ev('pointermove', { pointerType: 'touch', buttons: 0, clientX: B.x + (i % 3), clientY: B.y });
      out.survolRepete = presses();

      /* 2) L'APPUI, lui, doit marcher — sinon le correctif casse le jeu. */
      raz();
      ev('pointerdown', { pointerType: 'touch', buttons: 1, clientX: B.x, clientY: B.y });
      out.appui = presses();

      /* 3) GLISSER d'un bouton à l'autre sans relever : la raison d'être de la
            règle trop large. Elle doit survivre au correctif. */
      ev('pointermove', { pointerType: 'touch', buttons: 1, clientX: A.x, clientY: A.y });
      out.glisse = presses();
      ev('pointerup', { pointerType: 'touch', buttons: 0, clientX: A.x, clientY: A.y });
      out.apresRelache = presses();

      /* 4) ENTRER sur un bouton depuis le vide, doigt déjà posé ailleurs :
            le `pointerdown` n'a touché aucun bouton, il n'y a donc pas d'entrée
            dans `doigts` — c'est le cas que seul le suivi des pointeurs
            enfoncés rattrape. */
      raz();
      ev('pointerdown', { pointerType: 'touch', buttons: 1, clientX: 5, clientY: 5 });
      out.videAuDepart = presses();
      ev('pointermove', { pointerType: 'touch', buttons: 1, clientX: B.x, clientY: B.y });
      out.entreeDepuisLeVide = presses();
      raz();

      /* 5) Un pointeur relâché HORS de la page (le `pointerup` s'est perdu)
            ne doit pas rester à presser au survol suivant. */
      ev('pointerdown', { pointerType: 'touch', buttons: 1, clientX: B.x, clientY: B.y });
      ev('pointercancel', { pointerType: 'touch', buttons: 0, clientX: B.x, clientY: B.y });
      ev('pointermove', { pointerType: 'touch', buttons: 0, clientX: B.x, clientY: B.y });
      out.apresAnnulation = presses();
      raz();

      out.suiviExiste = (typeof pointeursBas !== 'undefined') && pointeursBas.size === 0;
      return out;
    });

    v('la manette à l\'écran est bien visible', r.boutonsVisibles, 'boutons de taille nulle');

    v('LE SURVOL D\'UN LASER NE PRESSE RIEN',
      r.survolTouch === '', `pressés : ${r.survolTouch}`);
    v('le survol souris non plus', r.survolSouris === '', `pressés : ${r.survolSouris}`);
    v('vingt survols de suite ne finissent pas par passer',
      r.survolRepete === '', `pressés : ${r.survolRepete}`);

    v('CONTRÔLE À BLANC : UN VRAI APPUI, LUI, PRESSE',
      r.appui === 'B', `pressés : ${r.appui}`);
    v('GLISSER D\'UN BOUTON À L\'AUTRE MARCHE ENCORE',
      r.glisse === 'A', `pressés : ${r.glisse}`);
    v('et relever le doigt relâche', r.apresRelache === '', `pressés : ${r.apresRelache}`);

    v('ENTRER SUR UN BOUTON DOIGT DÉJÀ POSÉ MARCHE ENCORE',
      r.videAuDepart === '' && r.entreeDepuisLeVide === 'B',
      `départ:${r.videAuDepart} entrée:${r.entreeDepuisLeVide}`);

    v('un pointeur annulé ne reste pas à presser',
      r.apresAnnulation === '', `pressés : ${r.apresAnnulation}`);
    v('le suivi des pointeurs enfoncés se vide', r.suiviExiste, 'des pointeurs restent enfoncés');

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();

    /* ---------- § 54 : le coffre-fort se ferme AU DOIGT ----------
       Le verrouillage tactile annulait `touchstart` partout hors de la manette.
       Or annuler `touchstart` empêche le navigateur de synthétiser le `click` :
       les boutons du panneau de sauvegarde ne répondaient à AUCUN toucher.
       Signalé depuis un casque — dont le laser se présente comme un contact
       tactile — mais c'était vrai sur n'importe quel téléphone.
       On tape pour de VRAI : `page.touchscreen.tap` produit la vraie séquence
       tactile du navigateur, seule capable de montrer le clic qui ne vient pas. */
    const tel = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900, mobile: true });
    await nouvellePartie(tel);
    await tel.evaluate(() => ouvrirCoffreFort());
    await tel.waitForTimeout(250);
    const ouvert = await tel.evaluate(() => !document.getElementById('coffreFort').hidden);
    v('le coffre-fort s\'ouvre', ouvert, 'panneau resté caché');

    /* Chaque bouton est éprouvé sur un panneau FRAÎCHEMENT ouvert : « COPIER »
       sélectionne la zone de texte et déplace ce qui suit, si bien qu'enchaîner
       les deux tapes mesurait la mise en page, pas le clic. */
    const taper = async id => {
      const b = await tel.evaluate(i => { const r = document.getElementById(i).getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
      await tel.touchscreen.tap(b.x, b.y);
      await tel.waitForTimeout(250);
    };
    await taper('cfFermer');
    const encore = await tel.evaluate(() => !document.getElementById('coffreFort').hidden);
    v('LE COFFRE-FORT SE FERME AU DOIGT, PAS SEULEMENT À LA SOURIS',
      !encore, 'le panneau reste ouvert : on ne peut plus en sortir');

    await tel.evaluate(() => { document.getElementById('cfEtat').textContent = ''; return ouvrirCoffreFort(); });
    await tel.waitForTimeout(250);
    await taper('cfCopier');
    const etatCopier = await tel.evaluate(() => document.getElementById('cfEtat').textContent);
    v('UN AUTRE BOUTON DU PANNEAU RÉPOND AUSSI AU DOIGT',
      etatCopier !== '' && !/Lecture/.test(etatCopier), `état : « ${etatCopier} »`);
    await tel.evaluate(() => fermerCoffre());

    /* Et le verrouillage doit tenir PARTOUT AILLEURS : sans ce contrôle, on
       pourrait « corriger » en supprimant l'annulation, et la page se mettrait
       à défiler sous le doigt pendant qu'on joue. */
    const bloque = await tel.evaluate(() => {
      const ev = new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [] });
      document.getElementById('c').dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    v('AILLEURS, LE VERROUILLAGE TACTILE TIENT TOUJOURS', bloque,
      'la page peut défiler sous le doigt');
    v('aucune erreur JS (téléphone)', tel.erreursJS.length === 0, tel.erreursJS[0]);
    await tel.context().close();
  },
};
