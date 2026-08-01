# Tests — chaque correctif est vérifiable

Ces tests pilotent le **vrai jeu** dans un navigateur : ils mesurent des pixels
et de l'état de jeu, jamais des détails d'implémentation. Chaque contrôle
correspond à un correctif documenté dans [`../CORRECTIFS.md`](../CORRECTIFS.md).

## Lancer

```bash
node tests/lancer.js              # toute la suite (~11 s)
node tests/lancer.js sauvegardes  # seulement les fichiers dont le nom contient « sauvegardes »
```

Sortie **0** si tout passe, **1** au moindre échec — utilisable en intégration
continue.

## Installation

Il faut Node et Playwright avec Chromium :

```bash
npm i -D playwright && npx playwright install chromium
```

Si Playwright est installé ailleurs, ou pour forcer un navigateur précis :

```bash
PLAYWRIGHT_MODULE=/chemin/vers/playwright CHROMIUM_PATH=/chemin/vers/chrome node tests/lancer.js
```

## Ce que couvre chaque fichier

| Fichier | Correctifs vérifiés |
|---|---|
| `01-affichage.js` | § 2.1 la manette tient dans l'écran (320 → 414 px) · § 2.3 les boutons ne couvrent plus le HUD |
| `02-sauvegardes.js` | § 3.1 trois emplacements nommés et isolés · § 3.2 l'ancienne partie n'est effacée qu'après relecture de sa copie · § 3.3 export → purge totale → restauration |
| `03-mort.js` | § 3.4 mourir ne coûte aucune progression · § 4.1 B et A ne relancent pas la partie, START seul valide · § 4.2 l'écran de fin n'écrase pas la sauvegarde |
| `04-rendu.js` | § 5.3 rien ne se voit à travers le relief · § 5.4 une salle close garde ses occupants invisibles du dehors |
| `05-jouabilite.js` | § 5.5 l'épée touche sur toute sa lame, dans les 4 directions · § 5.2 les 8 lucioles restent dégagées et atteignables |
| `06-terres-de-cendre.js` | § 7 génération du biome, et l'aventure entière du portail verrouillé jusqu'à la victoire |
| `10-colporteuse.js` | La marchande itinérante : elle s'installe sur une case libre à portée, ne vend que ce que Bran n'a pas, ses capacités survivent au rechargement — et tous les libellés des boutiques sont affichables par la police pixel. |
| `09-gemmes.js` | Les trois gemmes : valeurs (1 / 5 / 20), teintes distinctes, ramassage, rareté croissante — et **frapper un butin le ramasse**, dans les quatre directions, sans l'attraper de trop loin. |
| `08-musique.js` | La musique démarre, suit le lieu (village, salle close, vallée, Cendres) et la situation (titre, victoire, silence à la mort, un thème par gardien), se coupe et se rallume, et la préférence est retenue. Le séquenceur doit réellement émettre des notes. |
| `07-hors-ligne.js` | Le jeu s'installe et démarre **hors ligne**, et reçoit quand même la dernière version dès qu'il y a du réseau (pas de cache figé). Tourne sur un vrai serveur HTTP : un service worker refuse de s'enregistrer en `file://`. |
| `12-carte.js` | § 11 l'écran de carte, mesuré sur les **rectangles réellement dessinés** à cinq tailles d'écran : rien hors du canvas, aucun texte sur un autre (le pied de page se chevauchait), aucun texte sur la carte, et la carte garde une vraie part de l'écran. La légende n'annonce que ce qui reste à trouver. |
| `13-police.js` | § 12 tout ce que le jeu sait écrire — dialogues de chaque personnage dans 28 états de partie, journal, objectif, boutiques, panneaux, messages des coffres — doit être **dessinable par la police pixel**, qui remplace en silence par « ? » ce qu'elle ne connaît pas. |
| `11-quetes.js` | § 9 les deux quêtes annexes ajoutées après la région : la chaîne de la lanterne (pêcheur → clairière → Durn → golems → épée de Cendre) et les trois brasiers. Objets réellement posés, clairières dégagées, atteignables **à pied** avec les vraies collisions, récompenses mesurées sur la vraie boucle de combat, et rien de perdu au rechargement. |
| `14-cimes-lagon.js` | § 13 les deux régions ajoutées au sud : **Cimes Gelées** et **Lagon d'Azur**. Génération des biomes (neige/glace/roche, eau profonde/corail/sable), les six monstres armés, le **boomerang** (part et revient, brise la glace, sonne les cloches, perce le crabe cuirassé), les **palmes** (l'eau profonde ne se nage qu'avec elles), les deux gardiens (Roi Yéti scellé derrière la glace, Léviathan cerné d'eau), les quêtes annexes, la musique, la mini-carte, et rien de perdu au rechargement. Tout est mesuré sur le vrai jeu, atteignabilité **à pied** ou **à la nage** avec les vraies collisions. |
| `15-enigmes.js` | § 14 les **énigmes** réutilisables et le nouvel outil. Caisse poussée sur une plaque → porte qui s'ouvre ; **deux plaques** aux Cendres (une seule ne suffit pas) ; interrupteur qui abaisse/relève les blocs bleus/orange, réversible ; le **grappin** qui tire le héros par-dessus une douve **infranchissable à pied** ; le **marteau** qui déclenche un *slam* vertical (`J.slam`) et non le coup d'épée (`J.atk`), et brise la roche noire à l'impact. Résolutions rejouées sur les vraies collisions, et rien de perdu au rechargement (caisses posées, interrupteurs, trésors uniques, outils équipés). |
| `16-sables.js` | § 15 la cinquième région : les **Sables du Mirage**. Génération du désert (dunes, sables mouvants, ruines), les trois monstres armés, le **bracelet de force** (soulève un bloc, le jette : comble les sables mouvants, se pose sur le sec, entame le Colosse), l'**arène bloquée par les sables mouvants** tant qu'on ne les comble pas, le **Colosse de Grès** (cuirassé sauf à ses propres blocs), la quête des fresques, la musique, la mini-carte, et rien de perdu au rechargement. Atteignabilité mesurée sur les vraies collisions. |
| `17-compat.js` | § 16 la **compatibilité des sauvegardes** : une partie enregistrée **avant** l'ajout d'un niveau ou d'une fonctionnalité se recharge sans crash, sans piéger le héros, sans rien perdre. Trois sauvegardes « d'époque » (avant les Cendres, ère « quatre régions », position au bord) fabriquées à la main, rechargées sur la carte actuelle : nouveaux champs par défaut, `Q.inter` complété sans réinitialisation, outils rééquipés, portail rattrapé, héros dégagé, et la suite du monde **reste atteignable** (flood-fill à pied/à la nage). |
| `18-marais.js` | § 17 la sixième région : le **Marais des Murmures**. Génération de la tourbe (vase, eau croupie, ronces, saules), les trois créatures armées, le **fanal** (éclaire, **brûle les ronces**, **rallume les veilleuses**), le **voile de nuit**, l'**arène barrée par le rideau de ronces** tant qu'on ne le brûle pas, l'**ombre touchable seulement dans la lumière**, la **Reine des Lucioles Noires** (elle éteint le fanal), la quête des sept veilleuses, la musique, la mini-carte, et rien de perdu au rechargement. Atteignabilité mesurée sur les vraies collisions. |

## Trois principes suivis ici

1. **Mesurer avant de corriger.** Plusieurs bugs ont d'abord été chiffrés (2
   étoiles → 0 à l'écrasement, 192 px traversant une falaise, 10 obstacles
   autour d'une luciole) : sans cela on « corrige » au jugé.
2. **Un test doit savoir dire non.** `05-jouabilite.js` vérifie que le parcours
   refuse le sanctuaire verrouillé et n'atteint pas 80 % de la carte ; sinon un
   « tout va bien » ne prouverait rien. Pour s'en assurer, réintroduire un bug
   doit faire échouer la suite :

   ```bash
   # réduire la portée de l'épée dans index.html fait tomber 3 contrôles
   node tests/lancer.js jouabilite   # → code de sortie 1
   ```
3. **Ne pas répéter pour rien.** `genererMonde()` réamorce sa graine
   (`_s=987654321`) : le monde est **rigoureusement identique** à chaque appel.
   Le régénérer en boucle ne teste rien de plus — les tests le font une fois.
4. **Contrôle à blanc.** `04-rendu.js` compare d'abord le rendu à lui-même (il
   doit donner 0) : la caméra suit le héros en douceur et fausserait toute
   mesure de pixels si elle n'a pas convergé.

## Ajouter un test

Un fichier `NN-nom.js` exportant :

```js
module.exports = {
  nom: 'Titre affiché',
  async executer({ navigateur, v }) {
    // v(libellé, condition, détail affiché si ça échoue)
  },
};
```

`outils.js` fournit `pageDeJeu()` (page prête, erreurs JS collectées) et
`nouvellePartie()`. Toujours terminer par un contrôle
`page.erreursJS.length === 0` : un test vert alors que la console hurle n'est
pas un test vert.
