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
| `12-carte.js` | § 11 et § 16 l'écran de carte, mesuré sur les **rectangles réellement dessinés** (source ET destination : la grande carte doit lire une seule région, et huit vignettes doivent l'accompagner) à cinq tailles d'écran : rien hors du canvas, aucun texte sur un autre (le pied de page se chevauchait), aucun texte sur la carte, et la carte garde une vraie part de l'écran. La légende n'annonce que ce qui reste à trouver. |
| `13-police.js` | § 12 tout ce que le jeu sait écrire — dialogues de chaque personnage dans 28 états de partie, journal, objectif, boutiques, panneaux, messages des coffres — doit être **dessinable par la police pixel**, qui remplace en silence par « ? » ce qu'elle ne connaît pas. § 12.1 chaque glyphe doit être bien formé, non vide, unique, et **chaque accent doit se voir** : les images rendues d'une accentuée et de sa lettre nue doivent différer. § 12.2 les états de partie sont **déduits des drapeaux de `Q`**, et un second balayage lit les littéraux en capitales de la source — sans quoi le texte affiché ailleurs que dans un appel connu (nom de gardien sur sa barre de vie) échappait au contrôle. |
| `26-manette.js` | § 21 les **manettes Bluetooth** : le jeu ne lisait pas l'API Gamepad. Une manette simulée au seul point de contact du navigateur (`navigator.getGamepads()` et les deux événements de branchement) pilote le vrai jeu — le héros se déplace à la croix comme au stick (qui **dose** la vitesse), l'épée sort, l'objet change **une fois** et non à chaque image. Sans manette, **aucun appel** à l'API (un tableau neuf par image, cf. § 17) ; la zone morte ignore un stick usé ; débrancher relâche ce qui était tenu ; et les manettes non standard sont lues sur l'axe chapeau — sans qu'un axe inutilisé resté à 0 passe pour un « bas » permanent. |
| `25-arme-main.js` | § 20 l'arme au poing : le héros tient son outil (ou son épée), et elle **suit sa direction**. Mesuré sur les pixels que l'arme ajoute au corps, en passant par le vrai `dessinerJoueur()` — pas de seconde lame pendant une attaque. |
| `24-debug.js` | § 19 le panneau de débug : le bouton bascule et retient le choix, le panneau est réellement dessiné, ne recouvre pas le HUD, ne déborde pas (même avec une ligne forcée trop longue), **n'alloue pas ce qu'il mesure** (tampons préalloués, jamais recréés, jamais triés), et éteint la boucle cesse de l'appeler. |
| `23-version.js` | § 18 la version affichée : elle existe, elle est **réellement dessinée** sur l'écran-titre, et elle ne diverge pas de `package.json`. |
| `22-performance.js` | § 15 le sol en bandes, § 17 les allocations par image (seules les entités à l'écran sont triées ; les enveloppes sont les MÊMES d'une image à l'autre) : aucune toile au-delà de la limite mobile, une seule bande bâtie au chargement, travail plafonné par image, toiles recyclées, et traverser les huit régions n'alloue rien. |
| `20-nues-faille.js` | § 14.2 et 14.3 les mondes 7 et 8 : le vide fait tomber, la cape fait planer, une colonne d'air ne porte que qui a la cape ; les carillons ne sonnent qu'au boomerang ; les trois sceaux ouvrent la salle finale ; le Rongeur traverse ses cinq paliers dans l'ordre. |
| `21-fin.js` | § 14.3 et 14.4 l'atteignabilité mesurée (le Parvis à pied, le Belvédère seulement en planant, chaque sceau derrière l'outil de son monde, la salle finale close puis ouverte) et la fin : parcours réel de la caméra sur les huit mondes, morceau par région, bilan de complétion. |
| `11-quetes.js` | § 9 les deux quêtes annexes ajoutées après la région : la chaîne de la lanterne (pêcheur → clairière → Durn → golems → épée de Cendre) et les trois brasiers. Objets réellement posés, clairières dégagées, atteignables **à pied** avec les vraies collisions, récompenses mesurées sur la vraie boucle de combat, et rien de perdu au rechargement. |
| `14-cimes-lagon.js` | § 13 les deux régions ajoutées au sud : **Cimes Gelées** et **Lagon d'Azur**. Génération des biomes (neige/glace/roche, eau profonde/corail/sable), les six monstres armés, le **boomerang** (part et revient, brise la glace, sonne les cloches, perce le crabe cuirassé), les **palmes** (l'eau profonde ne se nage qu'avec elles), les deux gardiens (Roi Yéti scellé derrière la glace, Léviathan cerné d'eau), les quêtes annexes, la musique, la mini-carte, et rien de perdu au rechargement. Tout est mesuré sur le vrai jeu, atteignabilité **à pied** ou **à la nage** avec les vraies collisions. |
| `15-enigmes.js` | § 14 les **énigmes** réutilisables et le nouvel outil. Caisse poussée sur une plaque → porte qui s'ouvre ; **deux plaques** aux Cendres (une seule ne suffit pas) ; interrupteur qui abaisse/relève les blocs bleus/orange, réversible ; le **grappin** qui tire le héros par-dessus une douve **infranchissable à pied** ; le **marteau** qui déclenche un *slam* vertical (`J.slam`) et non le coup d'épée (`J.atk`), et brise la roche noire à l'impact. Résolutions rejouées sur les vraies collisions, et rien de perdu au rechargement (caisses posées, interrupteurs, trésors uniques, outils équipés). § 22 la RIVE LOINTAINE du gouffre ne se referme pas : le retour est rejoué sur le vrai `lancerGrappin()`, et une partie sauvée alors qu'elle était scellée se rattrape au rechargement. |
| `16-sables.js` | § 15 la cinquième région : les **Sables du Mirage**. Génération du désert (dunes, sables mouvants, ruines), les trois monstres armés, le **bracelet de force** (soulève un bloc, le jette : comble les sables mouvants, se pose sur le sec, entame le Colosse), l'**arène bloquée par les sables mouvants** tant qu'on ne les comble pas, le **Colosse de Grès** (cuirassé sauf à ses propres blocs), la quête des fresques, la musique, la mini-carte, et rien de perdu au rechargement. Atteignabilité mesurée sur les vraies collisions. |
| `17-compat.js` | § 16 la **compatibilité des sauvegardes** : une partie enregistrée **avant** l'ajout d'un niveau ou d'une fonctionnalité se recharge sans crash, sans piéger le héros, sans rien perdre. Trois sauvegardes « d'époque » (avant les Cendres, ère « quatre régions », position au bord) fabriquées à la main, rechargées sur la carte actuelle : nouveaux champs par défaut, `Q.inter` complété sans réinitialisation, outils rééquipés, portail rattrapé, héros dégagé, et la suite du monde **reste atteignable** (flood-fill à pied/à la nage). |
| `18-marais.js` | § 17 la sixième région : le **Marais des Murmures**. Génération de la tourbe (vase, eau croupie, ronces, saules), les trois créatures armées, le **fanal** (éclaire, **brûle les ronces**, **rallume les veilleuses**), le **voile de nuit**, l'**arène barrée par le rideau de ronces** tant qu'on ne le brûle pas, l'**ombre touchable seulement dans la lumière**, la **Reine des Lucioles Noires** (elle éteint le fanal), la quête des sept veilleuses, la musique, la mini-carte, et rien de perdu au rechargement. Atteignabilité mesurée sur les vraies collisions. |
| `19-frontieres.js` | § 18 les **monstres restent dans leur région** : sur chaque frontière interne, un ennemi placé juste à côté avec le héros de l'autre côté ne la franchit jamais (poursuite vers le bas comme vers le haut, créatures au sol comme volantes), tout en continuant d'avancer vers le héros tant qu'ils partagent une région. |
| `36-verrous.js` | § 43 les **verrous de région** : on ne descend pas d'un monde au suivant sans avoir abattu son gardien. Deux mesures indépendantes — un **remplissage par diffusion** dont la seule règle de passage est le vrai `solide()` (la région la plus au sud atteinte avance d'exactement un cran par verrou ouvert), et le **héros poussé plein sud 400 images** dans chaque corridor, trouvé par le remplissage lui-même plutôt que codé en dur. Plus : le sceau **nomme** ce qui tient debout, il ne se referme jamais, et une partie placée au sud d'un verrou clos est libérée au chargement **sans cocher de gardien**. |
| `37-outils.js` | § 44.2 et 44.3 les **deux emplacements d'outil** (`Y` et `X`) rangés par identifiant : ils se remplissent dans l'ordre, survivent au rechargement, et chaque touche déclenche le sien. Le **bouclier automatique** : il se lève seul, ne pare que de face, jamais dans le dos, laisse passer l'imparable, ouvre une **fenêtre de récupération** après chaque parade (un flux de coups traverse), et **la pénalité de vitesse a disparu** (93 px en 60 images). La page des outils navigue en 2D et refuse ce qu'on ne possède pas. |
| `38-equilibre.js` | § 44.3 **la rampe de difficulté du sud tient-elle encore ?** Sous une pression identique et de face — le cas où la garde automatique aide le plus —, les dégâts subis doivent rester croissants du nord au sud (12 / 24 / 36), rester **strictement sous** ceux encaissés de dos (15 / 30 / 45), et n'être jamais nuls. Contrôle à blanc : supprimer la fenêtre de récupération fait tomber les trois à zéro. |
| `39-panneaux.js` | § 44.1 **un panneau ne désarme pas le héros.** Au calme il se lit ; une créature à portée, il devient inerte et **l'épée sort — 60 fois sur 60 pressions** ; le danger écarté, il se relit. Le refus doit être TOTAL : `tenterInteraction` rend `false`, sinon l'appelant y lit « appui consommé » et B ne sort plus jamais l'épée. |
| `40-panneaux-plantes.js` | § 45 **chaque panneau est planté, visible et lisible** : sur la vraie carte, toute la progression ouverte, chacun des 34 a son poteau (`O.PANNEAU`) et se lit depuis au moins une case atteignable **à pied**. Réinjection : un panneau jeté au milieu d'un mur de 5 sur 5 doit quand même être planté — avant correctif, `planterPanneaux` renonçait en silence au-delà de son 3 sur 3. |

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
