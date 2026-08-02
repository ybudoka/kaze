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

      /* Les états de partie ne sont PAS écrits à la main : on énumère les
         drapeaux de quête eux-mêmes. Une liste fixe vieillit — elle ignorerait
         les drapeaux d'une région ajoutée après coup, et les dialogues qu'ils
         débloquent ne seraient jamais relus. */
      razQuetes();
      const cles = Object.keys(Q);
      const etats = [{}];
      for (const k of cles) {
        const v0 = Q[k];
        if (typeof v0 === 'boolean') etats.push({ [k]: true });
        else if (typeof v0 === 'number') for (const n of [1, 3, 8, 15]) etats.push({ [k]: n });
        else if (Array.isArray(v0)) etats.push({ [k]: v0.map(() => 1) });
      }
      // et deux états extrêmes : tout entrepris, puis tout achevé
      const tout = {};
      for (const k of cles) {
        const v0 = Q[k];
        tout[k] = typeof v0 === 'boolean' ? true
                : typeof v0 === 'number' ? 99
                : Array.isArray(v0) ? v0.map(() => 1) : v0;
      }
      etats.push(tout);
      out.nbEtats = etats.length;

      const dialAvant = dial;
      const fragAvant = J.fragments;
      for (const e of etats) {
        razQuetes(); Object.assign(Q, e);
        // l'objectif courant et la doyenne dépendent aussi des étoiles
        for (const f of [0, 1, 3]) { J.fragments = f; ajouter(objectifCourant(), 'objectif'); }
        J.fragments = 3;
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
      razQuetes(); dial = dialAvant; J.fragments = fragAvant;

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

      /* Second balayage, au niveau de la SOURCE. Le premier ne voit que ce
         qu'il sait appeler : il a laissé passer « CŒUR DE CENDRE », qui est
         écrit dans la table des noms de gardiens, affichée sur la barre de vie.
         Le texte affiché du jeu est en capitales — c'est ce qui le distingue
         des commentaires et des identifiants. */
      {
        const src = [...document.querySelectorAll('script')].map(s => s.textContent).join('\n');
        const litteraux = [...src.matchAll(/(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map(m => m[2]);
        /* On ne filtre PLUS sur une liste de caractères permis. C'était le
           défaut du tamis : une chaîne contenant un signe absent de la liste
           échouait au test et se trouvait donc ÉCARTÉE — alors que ce signe
           inconnu était exactement ce qu'on cherchait. « SELECT = RETOUR » est
           passé au travers ainsi, et s'est affiché « SELECT ? RETOUR ».
           On retient maintenant tout ce qui RESSEMBLE à du texte de jeu — des
           capitales, aucune minuscule, aucune syntaxe de code — puis on
           inspecte chacun de ses caractères. */
        /* `&` ne figure PLUS parmi les signes qui font écarter une chaîne. Il y
           était, et c'est ainsi que le sous-titre de l'écran-titre — le nom du
           jeu, la première chose qu'on lit — s'est affiché « ? LES TROIS
           ÉTOILES » pendant toutes les versions publiées : la police n'a pas
           d'esperluette, et la chaîne qui en contenait une n'était même pas
           examinée. Deux fois le même piège : une liste d'exclusion finit
           toujours par protéger le caractère qu'on cherche. */
        const ressembleAuJeu = t =>
          (t.match(/[A-ZÀ-ŸŒ]/g) || []).length >= 4
          && !/[a-zà-ÿ]/.test(t)
          && !/[<>{}$\\|_@`~^#]/.test(t);
        /* Les libellés des boutons HTML au-dessus du jeu (PLEIN ÉCRAN, MUSIQUE,
           DÉBUG…) sont écrits par le navigateur, avec SA police : ils n'ont
           jamais à passer par les glyphes pixel. Ceux-là seuls sont exemptés,
           et nommément — une exemption par motif finirait par couvrir du vrai
           texte de jeu. */
        const horsPolicePixel = new Set(['MUSIQUE ✕', 'DÉBUG ✕']);
        for (const t of litteraux) {
          if (t.length < 5 || !ressembleAuJeu(t)) continue;
          if (horsPolicePixel.has(t)) continue;
          ajouter(t, 'source');
        }
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

      /* ---------- la table est-elle bien formée ? ----------
         Une chaîne mal découpée ne lève rien : le glyphe est simplement
         dessiné de travers, ou pas du tout. */
      out.malformes = Object.entries(GLYPHES)
        .filter(([, g]) => { const r = g.split('/');
                             return r.length !== 7 || r.some(l => l.length !== 5
                                    || /[^#.]/.test(l)); })
        .map(([c]) => c);
      // un glyphe entièrement vide serait invisible à l'écran
      out.vides = Object.entries(GLYPHES)
        .filter(([c, g]) => c !== ' ' && !g.includes('#')).map(([c]) => c);
      // deux caractères ne doivent jamais partager le même dessin
      {
        const vus = new Map(), d = [];
        for (const [c, g] of Object.entries(GLYPHES)) {
          if (c === ' ') continue;
          if (vus.has(g)) d.push(`${c}=${vus.get(g)}`); else vus.set(g, c);
        }
        out.doublons = d;
      }

      /* ---------- les accents se voient-ils VRAIMENT ? ----------
         Un accent qui n'ajoute aucun pixel visible laisserait le joueur lire
         « GRACE » pour « GRÂCE ». On compare les DESSINS RENDUS, pas les
         chaînes de la table : c'est ce que l'écran montre qui compte. */
      const ACCENTS = { 'À': 'A', 'Â': 'A', 'Ä': 'A', 'Ç': 'C',
                        'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
                        'Î': 'I', 'Ï': 'I', 'Ô': 'O', 'Ö': 'O',
                        'Ù': 'U', 'Û': 'U', 'Ü': 'U' };
      const rendu = s => {
        const c = document.createElement('canvas');
        c.width = Math.max(8, largeurTexte(s) + 4); c.height = 12;
        const g = c.getContext('2d');
        texte(g, s, 2, 2, '#ffffff', null);          // sans ombre : le dessin nu
        return c.toDataURL();
      };
      out.invisibles = Object.entries(ACCENTS)
        .filter(([a, b]) => rendu(a) === rendu(b)).map(([a]) => a);
      // deux accents de la même lettre doivent aussi se distinguer l'un de l'autre
      {
        const parLettre = {}, confus = [];
        for (const [a, b] of Object.entries(ACCENTS)) (parLettre[b] = parLettre[b] || []).push(a);
        for (const groupe of Object.values(parLettre)) {
          const images = groupe.map(rendu);
          if (new Set(images).size !== groupe.length) confus.push(groupe.join(''));
        }
        out.confus = confus;
      }
      // et la différence survit dans une vraie phrase du jeu
      out.phraseAccentuee =
        rendu('LA ROUTE EST PLUS SÛRE GRÂCE À TOI.') !==
        rendu('LA ROUTE EST PLUS SURE GRACE A TOI.');
      return out;
    });

    v('la table de glyphes est fournie', r.nbGlyphes > 60, r.nbGlyphes);
    /* Le balayage se déduit des drapeaux de quête : il doit suivre le contenu
       tout seul. S'il retombe à une poignée d'états, c'est que l'énumération
       ne voit plus rien et que le contrôle ne relit plus grand-chose. */
    v('le balayage couvre tous les drapeaux de quête', r.nbEtats > 40, `${r.nbEtats} états`);
    v('la détection attrape bien un caractère absent', r.detecteBien, 'elle ne voit rien');
    v('AUCUN TEXTE DU JEU N\'EST INDESSINABLE',
      r.manquants.length === 0, r.manquants.join(' | '));
    v('LA POLICE COUVRE LE FRANÇAIS MAJUSCULE ET SA PONCTUATION',
      r.francais === '', `absents : ${r.francais}`);
    v('chaque glyphe est bien formé (7 lignes de 5)',
      r.malformes.length === 0, r.malformes.join(' '));
    v('aucun glyphe n\'est vide', r.vides.length === 0, r.vides.join(' '));
    v('aucun caractère n\'en copie un autre', r.doublons.length === 0, r.doublons.join(' '));
    v('CHAQUE ACCENT SE VOIT À L\'ÉCRAN',
      r.invisibles.length === 0, `identiques à leur lettre nue : ${r.invisibles.join(' ')}`);
    v('les accents d\'une même lettre se distinguent entre eux',
      r.confus.length === 0, r.confus.join(' '));
    v('une phrase accentuée ne se dessine pas comme sa version nue',
      r.phraseAccentuee, 'GRÂCE se dessine comme GRACE');
    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
