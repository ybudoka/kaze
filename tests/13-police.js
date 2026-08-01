'use strict';
/* CORRECTIFS.md § 12 — la police pixel.
   Un caractère absent de `GLYPHES` est silencieusement remplacé par « ? ».
   Rien ne le signale : ni erreur, ni avertissement. Le journal a donc affiché
   « ?X? » au lieu de « [X] », et Tomas « GR?CE À TOI », pendant des versions.
   On parcourt ici TOUT ce que le jeu sait écrire, dans un éventail d'états de
   partie, et on exige que chaque caractère soit dessinable. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Police pixel',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const out = {};
      const recolte = new Map();          // caractère -> exemple de texte fautif
      const ajouter = (txt, source) => {
        for (const c of String(txt).toUpperCase())
          if (c !== ' ' && c !== '\n' && !GLYPHES[c] && !recolte.has(c))
            recolte.set(c, `${source} : ${String(txt).slice(0, 50)}`);
      };

      /* Un éventail d'états de partie : chaque personnage change de discours
         selon l'avancement, et c'est dans les branches rares que dorment les
         textes jamais relus. */
      const etats = [
        {},
        { parleDoyenne: true },
        { parleDoyenne: true, cle: true },
        { parleDoyenne: true, porteOuverte: true },
        { champignons: 4 }, { tarte: true }, { perle: true }, { coeurCristal: true },
        { coeurCristal: true, lanterne: 1 }, { coeurCristal: true, lanterne: 2 },
        { lanterne: 3, eclats: 0 }, { lanterne: 3, eclats: 3 },
        { lanterne: 3, epeeCendre: true },
        { lucioles: 4 }, { lucioles: 8 }, { epeeLongue: true },
        { prime: 7 }, { prime: 15 }, { primeRendue: true },
        { chefTue: true }, { grilleOuverte: true }, { fissureOuverte: true },
        { portailOuvert: true }, { portailOuvert: true, braises: 1, bottes: true },
        { portailOuvert: true, braises: 3, coeurTue: true },
        { portailOuvert: true, brasiers: 1 }, { portailOuvert: true, brasiers: 3 },
        { carquois: true, grandSac: true, bouclierFort: true, potions: 2 },
      ];

      const dialAvant = dial;
      for (const e of etats) {
        razQuetes(); Object.assign(Q, e);
        // dialogues de tous les personnages, y compris la colporteuse
        for (const p of pnjs) {
          dial = null; dialoguePNJ(p);
          ajouter(p.nom, 'nom');
          if (dial) dial.pages.forEach(pg => ajouter(pg, `dialogue ${p.id}`));
        }
        dial = null;
        // journal, objectif courant
        lignesJournal().forEach(l => ajouter(l[0], 'journal'));
        ajouter(objectifCourant(), 'objectif');
        // étiquettes des deux boutiques
        for (const a of articles()) { ajouter(a.nom, 'boutique Bran'); }
        for (const a of articlesItinerants()) { ajouter(a.nom, 'boutique colporteuse'); }
      }
      razQuetes(); dial = dialAvant;

      // panneaux plantés dans le monde
      for (const s of panneaux) ajouter(s.txt, 'panneau');
      // noms des objets tenus en main
      for (const o of OBJETS) ajouter(o.nom, 'objet');
      // et les messages du coffre, qui ne s'écrivent qu'à l'ouverture
      {
        const vraiDire = window.dire, vraiAnnonce = window.annonce;
        window.dire = (t, d) => { ajouter(t, 'message'); return vraiDire(t, d); };
        window.annonce = t => { ajouter(t, 'bandeau'); return vraiAnnonce(t); };
        for (const c of coffres) { c.ouvert = false; c.verrou = false; ouvrirCoffre(c); }
        ajouter(sauveEtat, 'témoin');
        window.dire = vraiDire; window.annonce = vraiAnnonce;
      }

      out.manquants = [...recolte.entries()].map(([c, ex]) => `${c} (${ex})`);
      out.nbGlyphes = Object.keys(GLYPHES).length;

      /* Contrôle à blanc : la détection doit réellement mordre. On lui donne un
         caractère qu'aucune police pixel du jeu ne contient. */
      recolte.clear(); ajouter('UN TEXTE AVEC UN Ω DEDANS', 'essai');
      out.detecteBien = recolte.size === 1;

      /* Les caractères du français majuscule que le jeu peut légitimement
         croiser doivent tous exister — c'est le filet pour les textes à venir. */
      out.francais = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ÀÂÇÉÈÊËÎÏÔÖÙÛÜ.,:;!?\'()[]/-'].
        filter(c => !GLYPHES[c]).join('');
      return out;
    });

    v('la table de glyphes est fournie', r.nbGlyphes > 60, r.nbGlyphes);
    v('la détection attrape bien un caractère absent', r.detecteBien, 'elle ne voit rien');
    v('AUCUN TEXTE DU JEU N\'EST INDESSINABLE',
      r.manquants.length === 0, r.manquants.join(' | '));
    v('LA POLICE COUVRE LE FRANÇAIS MAJUSCULE ET SA PONCTUATION',
      r.francais === '', `absents : ${r.francais}`);
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
