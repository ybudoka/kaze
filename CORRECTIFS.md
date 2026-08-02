# Kaze & les Trois Étoiles — journal des correctifs

Le jeu tient en un seul fichier, `index.html` (HTML + CSS + JS, sans dépendance).
Il est publié sur **GitHub Pages depuis la branche `main`** : tout push sur `main`
met le site à jour en 1–2 minutes.

👉 <https://ybudoka.github.io/kaze/>

Ce document retrace chaque problème rencontré, sa **cause réelle** (souvent
différente du symptôme), le correctif et la façon dont il a été vérifié.

---

## 1. Mise en ligne

| | |
|---|---|
| **Symptôme** | Le jeu n'était pas publié. |
| **Cause** | Dépôt privé, et GitHub Pages non activé. |
| **Correctif** | Dépôt passé en public, source Pages réglée sur « Deploy from a branch » → `main` / `/ (root)`. |

Un workflow GitHub Actions avait d'abord été ajouté, puis **retiré** (`429f82f`) :
il échouait faute de droits, et le site étant un unique fichier statique, servir
directement depuis la branche est plus simple et plus fiable.

⚠️ **Limite de l'environnement** : ni l'activation de Pages, ni le changement de
visibilité, ni la suppression d'une branche distante ne sont possibles depuis
l'agent (le proxy bloque l'écriture des réglages du dépôt). Ces gestes sont
manuels.

---

## 2. Affichage mobile

### 2.1 La manette débordait de l'écran — `d7d318b`

- **Cause** : dimensions fixes (pavé 134 px, boutons 136 px, marges) dépassant la
  largeur d'un téléphone étroit. Les boutons étaient rognés et la page paraissait
  « zoomée et bloquée » dès le chargement.
- **Correctif** : `redim()` mesure l'**étendue réelle** des enfants du pavé (les
  boutons sont en position absolue, donc `scrollWidth` les sous-estime) et met la
  manette à l'échelle d'un bloc, d'après le côté le plus éloigné du centre.
- **Vérifié** : aucun débordement horizontal de 320 à 414 px.

### 2.2 Zoom bloqué sur iOS — `f96a572`, `71069d7`, `9227ff1`

- **Cause principale** : en tapant **B** plusieurs fois pour faire défiler un
  dialogue, iOS y voyait un **double-tap** et zoomait. L'ancien garde-fou ne
  bloquait que dans une fenêtre de 330 ms, remise à zéro par *tous* les contacts
  (y compris les glissements du stick) : le 2ᵉ appui passait au travers.
- **Correctif** : sur la manette, le comportement par défaut du navigateur est
  **toujours annulé** (`touchend`). Plus : remise à 1 du zoom au chargement,
  garde-fou sur les contacts à 2 doigts hors manette.
- **Vérifié** : les deux appuis d'un double-tap rapide sur B sont neutralisés, et
  le jeu enregistre toujours les 2 appuis.

> 🔎 **Cause externe à retenir** : Safari mémorise un **zoom par site** (bouton
> `aA` de la barre d'adresse). Aucun code de la page ne peut l'annuler. Si la page
> s'ouvre agrandie, c'est le premier réflexe à vérifier.

### 2.3 Les gâchettes L/R s'accrochaient

- **Cause** : `.bumper::after` élargissait la zone tactile de 9 px **dans toutes
  les directions, vers le bas comprise** — donc par-dessus le stick et les
  boutons de façade. Mesuré : jusqu'à **813 px² de recouvrement**.
- **Correctif** : gâchettes remontées de 5 px, et marge tactile qui ne déborde
  plus que vers le haut et les côtés.
- **Vérifié** : 0 px² de recouvrement avec le stick et les boutons, de 320 à
  414 px, la cible restant confortable (≥ 18 px de haut).

### 2.4 Les boutons masquaient le HUD — `7fe404f`

- **Cause** : `#outils` (PLEIN ÉCRAN / MANETTE) était en `position:fixed` en haut
  à droite — exactement là où le jeu dessine les rubis et les 3 étoiles.
  **68 % du HUD recouvert** en 414 px de large.
- **Correctif** : boutons remis dans le flux, au-dessus de la zone de jeu (ils
  restent superposés en plein écran) ; leur hauteur est déduite du calcul du
  canvas.
- **Vérifié** : 0 % de recouvrement à 360, 390 et 414 px.

---

## 3. Sauvegardes

### 3.1 Trois emplacements nommés — `8fced76`

Remplacement de la sauvegarde unique par **3 emplacements**, chacun avec un nom
choisi par le joueur et ses statistiques (étoiles, lucioles, temps).

- Clés `kaze-partie-1/2/3` ; l'ancienne clé `kaze-partie` est **reprise** dans
  l'emplacement 1 au premier lancement.
- Écran-titre : liste des 3 emplacements ; un emplacement vide ouvre la **saisie
  du nom** à la manette (directions, **B** ajouter, **Y** effacer, **START**
  valider, **X** retour) ; un emplacement occupé se charge.
- Sous-menu « EFFACER UNE PARTIE » pour supprimer un seul emplacement.

### 3.2 ⚠️ La reprise détruisait la partie — `f0c7c8b`

- **Cause — bug introduit par le point 3.1** : l'ancienne clé était effacée
  **immédiatement après la copie**, sans vérifier qu'elle avait atteint le disque.
  Si l'écriture échouait (stockage refusé ou plein), la partie était **perdue
  définitivement**.
- **Correctif** : l'original n'est effacé qu'après **relecture** de la copie.

### 3.3 Les sauvegardes disparaissaient — `f0c7c8b`

- **Cause** : le stockage navigateur n'est pas durable. Il part avec le vidage des
  « Données de site web », et **iOS purge de lui-même le stockage d'un site après
  7 jours sans visite**.
- **Correctif** : bouton **SAUVEGARDES** → exporte les 3 emplacements en un code,
  le **copie**, le **télécharge en fichier**, et **restaure** depuis un code collé
  ou un fichier. Plus : demande de stockage persistant, et balises rendant le jeu
  installable sur l'écran d'accueil.
- **Vérifié** : export → **effacement total du stockage** → restauration : les
  parties reviennent complètes et jouables. Un code invalide ne détruit rien.

> 💡 **La vraie protection** : ajouter le jeu à l'**écran d'accueil** (Partager →
> « Sur l'écran d'accueil »). iOS cesse alors de purger le stockage.
> ⚠️ **Ne jamais conseiller de vider les « Données de site web »** : cela efface
> les sauvegardes. Un simple rechargement suffit presque toujours.

### 3.4 Mourir faisait perdre la progression — `19fed13`

- **Cause** : la sauvegarde automatique ne passait qu'une fois par minute (30 s au
  village), **jamais pendant un combat de gardien** (`!boss`) ni pendant
  l'invulnérabilité — et **mourir n'écrivait rien**. Un combat de boss entier
  pouvait donc être perdu.
- **Correctif** : la mort écrit un **point de reprise** conservant tout (quêtes,
  objets, étoiles, lucioles, rubis, coffres, carte explorée) et replace seulement
  le héros vivant au village. L'écran affiche « PROGRESSION CONSERVÉE ». Ramasser
  une luciole déclenche aussi une sauvegarde.

---

## 4. Écran de fin

### 4.1 B relançait une partie par accident — `47e2ba7`

- **Cause** : le jeu **met les appuis en tampon 11 images** (`TAMPON`) pour ne
  jamais perdre une action. Or on meurt presque toujours **en plein coup
  d'épée** : ce B en attente validait le menu instantanément.
- **Correctif** : validation par **START seul** (`naviguerMenu` accepte une liste
  de touches) ; le tampon est **vidé** à la mort ; verrou d'entrée de ~0,9 s
  pendant l'animation d'ouverture.
- **Bonus** : écran repensé (fondu, titre qui se pose, bilan de partie).

### 4.2 ⚠️ « NOUVELLE PARTIE » écrasait la sauvegarde — `0d00b5f`

- **Cause — bug introduit par le point 3.1** : `nouvellePartie()` sauvegarde
  aussitôt pour occuper l'emplacement. Choisir « NOUVELLE PARTIE » après une mort
  écrasait donc la partie sur place. *Reproduit : 2 étoiles → 0.*
- **Correctif** : tant que l'emplacement contient une sauvegarde, l'écran de fin
  propose « CHOISIR UN EMPLACEMENT » (retour au titre) au lieu de repartir sur
  place. Écraser exige désormais de passer volontairement par « EFFACER UNE
  PARTIE ».

---

## 5. Rendu et jouabilité

### 5.1 Menu d'accueil qui se chevauchait — `d8561fd`

- **Cause** : `dessinerMenu` positionnait chaque entrée avec `index × hauteur`,
  sans tenir compte de la sous-ligne de « CONTINUER ».
- **Correctif** : cumul de la hauteur réelle (20 px avec sous-ligne, 14 sans).

### 5.2 Lucioles invisibles — `23d44e8`

- **Cause** : seule la tuile centrale était dégagée ; le décor généré pouvait
  entasser jusqu'à **10 obstacles sur 25** autour d'une luciole.
- **Correctif** : clairière 5×5 (obstacles retirés, eau → sable, fleurs gardées) et
  deux torches en repère.
- **Vérifié** : 0 obstacle autour des 8 lucioles sur 6 mondes générés ; et
  **accessibilité** confirmée sur 30 mondes par un parcours appliquant les règles
  de collision (eau et obstacles pleins bloquants, montée d'étage par rampe
  seulement). Le test rejette bien l'intérieur du sanctuaire verrouillé — donc il
  a du mordant.

### 5.3 Monstres visibles à travers le relief — `dc2a097`

- **Cause** : `prerendreSol()` cuit **tout le sol, faces de falaise comprises**,
  dans une image posée **avant** toutes les entités. Un monstre en contrebas était
  donc dessiné par-dessus le terrain censé le cacher (**192 px sur 298**).
- **Correctif** : `reliefRangee()` réapplique le sol en relief **rangée par
  rangée**, juste avant le décor et les entités de cette rangée.
- **Vérifié** : falaise 192 → **0** ; monstre **sur** un plateau intact (298 px) ;
  monstre en contrebas **devant** la falaise toujours visible (273 px) ; rendu
  d'une scène normale **pixel pour pixel identique** (0 / 52 600).

### 5.4 Monstres visibles dans une salle fermée — `d1c3f7d`

- **Cause** : ce n'était **pas** un défaut de tri. Mesuré sur la vraie ruine, le
  mur sud occulte correctement (**0 px**). En vue de dessus, un monstre plus au
  fond se **projette au-dessus** du mur : il est à côté à l'écran, pas derrière.
- **Correctif** : les occupants d'une **salle close** (ruine du lac, arène du
  gardien — voir `SALLES`) ne sont dessinés qu'une fois le héros entré.
- **Connu et laissé tel quel** : à l'intérieur, un monstre collé au mur sud n'a que
  la tête qui dépasse — `murTuile` dessine 36 px de haut. Comportement d'origine.

### 5.5 L'épée ne touchait qu'au bout — `16f0dac`

- **Cause** : la zone de dégâts était **un petit carré centré 15 px devant** le
  héros. Cartographie des impacts : **rien à `dx=-14` ni `-7`** (un monstre collé
  n'était pas touché) et portée latérale limitée à `±14` alors que l'animation
  balaie bien plus large. L'**épaisseur de l'ennemi** n'était pas comptée non plus.
- **Correctif** : zone couvrant **toute la lame** (de 8 px derrière le héros
  jusqu'à la pointe, élargie sur les côtés) ; `zoneDegats` ajoute le rayon de
  l'ennemi.
- **Vérifié** : zone pleine de `dx=-7` à `+35`, `dy=±21` (`+42` avec l'épée
  longue) ; les 4 directions touchent à distance **et** au corps à corps ; les
  buissons se taillent toujours.

---

## 6. Méthode de vérification

Les correctifs ont été validés par des scripts Playwright pilotant le jeu réel
(Chromium préinstallé, `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`),
plutôt qu'à l'œil. Environ **53 contrôles**. Trois principes utiles :

1. **Mesurer avant de corriger.** Le bug d'écrasement (2 étoiles → 0), les 192 px
   qui traversaient la falaise, les 10 obstacles autour d'une luciole : tous
   chiffrés d'abord, ce qui a évité de « corriger » au jugé.
2. **Vérifier qu'un test sait dire non.** Le test d'accessibilité rejette le
   sanctuaire verrouillé et n'atteint que 73 % de la carte ; sans ce contrôle, un
   « tout va bien » ne prouverait rien.
3. **Contrôle à blanc et non-régression.** Le rendu est comparé à lui-même (doit
   donner 0) avant toute mesure de pixels — la caméra suit le héros en douceur et
   fausse deux rendus successifs si elle n'a pas convergé. La correction du relief
   a aussi été comparée à l'état antérieur sur une scène normale : 0 différence.

La suite vit désormais dans **[`tests/`](tests/)** et se relance d'une commande :

```bash
node tests/lancer.js              # ~30 s, sortie 0 si tout passe, 1 sinon
node tests/lancer.js sauvegardes  # un sous-ensemble
```

Chaque contrôle renvoie à une section de ce document — voir le tableau de
correspondance dans [`tests/README.md`](tests/README.md).

---

## 7. Les Terres de Cendre (seconde région)

La carte est passée de 80 à **160 rangées**. La nouvelle région occupe les
rangées 80-159 et s'ouvre une fois les **trois étoiles** réunies.

- **Compatibilité des sauvegardes** : la région est ajoutée **en dessous**, donc
  les index de tuiles de la vallée (`y*MW+x`) restent valables et les parties
  existantes se rechargent sans conversion.
- **Progression** : portail (3 étoiles) → Forge Noire (**marteau**, brise la
  roche noire) → Falaises Ardentes (**bottes**, les braises ne brûlent plus) →
  Antre (**Cœur de Cendre**) → dernière braise → victoire.
- **Lisibilité du parcours** : la Forge était à cinq tuiles à l'ouest et neuf au
  sud du portail, au milieu d'une étendue de cendre sans repère — **introuvable
  en pratique**. Elle est désormais **alignée sur le défilé et posée à sa
  sortie** : on entre dedans en marchant droit devant. Le défilé est bordé de
  torches, des panneaux annoncent chaque étape, et des jalons lumineux mènent
  aux deux salles suivantes. Les objectifs affichés donnent la direction
  (« FRANCHIS LE PORTAIL : LA FORGE EST DROIT DEVANT », « À L'EST… », « PLEIN
  SUD… »). Un contrôle vérifie qu'on atteint sa porte en marchant tout droit.
- **Nouveaux monstres** : `braise` (bondissant), `golem` (n'est entamé que par le
  marteau), `spectre` (traverse les murs, ne se touche que matérialisé).
- Le sol `BRAISE` blesse tant qu'on n'a pas les bottes ; `LAVE` bloque comme
  l'eau.

### ⚠️ Bug livré et corrigé à cette occasion

Le panneau des sauvegardes définissait une fonction nommée **`ouvrirCoffre`** —
exactement le nom de la fonction qui ouvre les coffres du jeu. La déclaration la
plus tardive écrasant l'autre, **ouvrir un coffre affichait le panneau des
sauvegardes** au lieu de donner l'objet. Renommée en `ouvrirCoffreFort`.
Au passage, `ouvrirCoffre` refuse désormais de rouvrir un coffre déjà ouvert
(il redonnait son contenu à chaque appel).

### ⚠️ Le portail restait clos pour les parties antérieures

`Q.portailOuvert` n'était mis qu'**au moment** de ramasser la troisième étoile.
Une partie qui les avait déjà toutes avant l'ajout de la région ne repassait
jamais par là : le portail restait verrouillé **définitivement**, sans aucun
moyen de le déverrouiller. Le chargement rattrape désormais le cas
(`chargerInterne`) : trois étoiles ⇒ portail ouvert.

Leçon plus générale : **un drapeau posé au passage d'un événement ne rattrape
pas les parties qui ont déjà passé cet événement.** Toute nouvelle condition de
progression doit être dérivable de l'état sauvegardé, ou rattrapée au
chargement.

Autres pièges rencontrés en construisant la région :

- `hash()` est **dégénéré** sur des entrées régulières (ses valeurs plafonnaient
  à 0,5) : inutilisable comme bruit de terrain. La génération utilise une grille
  tirée de `rnd()`.
- `bruit()` est une fonction **sonore**, pas un bruit de Perlin.
- Un obstacle posé *devant* une porte se contourne : la roche noire devait
  boucher **la brèche elle-même**.
- La falaise séparant les deux régions recouvrait la clairière d'une luciole et
  la rendait inaccessible — d'où son déplacement en (9,72).

---

## 8. Pièges à ne pas réintroduire

- **Ne jamais supprimer une donnée avant d'avoir relu sa copie** (cf. 3.2).
- **`nouvellePartie()` écrit immédiatement** dans l'emplacement : tout chemin qui
  l'appelle doit s'assurer qu'il ne détruit pas une partie (cf. 4.2).
- **Le tampon d'entrées survit aux changements d'écran** : le vider en arrivant sur
  un écran qui attend une confirmation (cf. 4.1).
- **`prerendreSol()` est posé avant les entités** : tout ce qui doit masquer un
  personnage ne peut pas vivre uniquement dans ce pré-rendu (cf. 5.3).
- **Le canvas descend jusqu'à 200 px de large** : vérifier chaque nouveau texte à
  cette largeur (les lignes de stats ont dû être raccourcies).
- **Tout est dans une seule portée JavaScript** : deux `function` de même nom
  s'écrasent silencieusement, la dernière l'emportant (cf. `ouvrirCoffre`).
  Vérifier qu'un nouveau nom de fonction est libre avant de l'employer.
- **Ne jamais pré-rendre à la taille du monde** : un canvas de la taille de la
  carte gèle le chargement et dépasse la limite des navigateurs mobiles (~16 Mpx
  sur iOS). Découper, construire à la demande, recycler (cf. 15).
- **Les listes construites une fois à la génération ne suivent pas les tuiles
  modifiées** : `torches` (l'éclairage) doit être refaite à chaque changement de
  décor **et après application des différences au chargement** (cf. 9.3). Même
  raisonnement pour toute liste future dérivée de `objs`.
- **Ce qui change à l'exécution doit être sauvegardé** : `objs` l'était, `sol` ne
  l'était pas, et un seul `putS` de jeu (le gué comblé au bracelet) fermait un
  monde pour toujours. Toute écriture dans `sol` hors génération exige un
  contrôle de rechargement (cf. 38).
- **`panneaux.push` ne dessine rien** : c'est une zone de lecture, pas un
  panneau. Ce qui se lit doit se voir — un poteau, et qui ne bouche aucun
  passage (cf. 38).
- **Un ramassage de quête sans repère de carte ne se trouve pas**, surtout peint
  de la couleur de son décor. Quand il n'a pas de table de positions, le repère
  se lit dans `butins` (cf. 38).
- **Une mécanique qui se consomme doit se réarmer** : caisse acculée (cf. 36),
  bloc lourd gâché, gué manqué (cf. 38). Jamais sous les yeux du joueur.
- **Un décor de bordure qui n'est pas du `O.MUR` se fait percer** : `voie()` et
  `chemin()` épargnent le mur, et lui seul (cf. 40).
- **Toute entité posée sur la carte naît à la hauteur de SON sol** : `pondre()`
  l'ignorait, et 39 créatures sur 374 étaient dessinées sous le plancher (cf. 40).
- **`chemin()` ne perce que la lave et la roche noire, jamais les murs** : un
  point d'intérêt placé derrière une salle des Cendres reste injoignable, même
  si l'appel « trace » un chemin jusqu'à lui (cf. 9.2).
- **Un test ne doit pas recalculer ce qu'il mesure** : passer par la vraie boucle
  de jeu, pas par un appel direct avec la valeur attendue en argument (cf. 9.4).
  Et toujours **réinjecter le bug** pour voir le contrôle rougir.
- **Une comparaison d'images doit cadrer sur ce qu'elle prétend comparer** : un
  chiffre voisin suffit à faire différer deux captures et à laisser passer deux
  dessins identiques (cf. 10).
- **Un nouvel objet doit être ajouté partout où les objets se dessinent**, pas
  seulement là où ils agissent : la table `OBJETS` existait mais le HUD choisissait
  son image en dur, et le marteau était affiché en arc (cf. 10).
- **Un écran se compose du texte vers l'image, jamais l'inverse** : mesurer le
  pied de page d'abord et donner le reste au contenu rend le débordement
  impossible par construction (cf. 11.1).
- **La police pixel avale en silence ce qu'elle ne sait pas dessiner** : tout
  nouveau texte affiché doit passer par `13-police.js` (cf. 12). `Œ` **existe
  désormais** : la règle « écrire COEUR » est caduque, et c'est voulu — une règle
  qu'il faut se rappeler finit par être oubliée (cf. 12.2).
- **Un balayage écrit à la main vieillit** : énumérer les drapeaux de `Q` plutôt
  que lister les états de partie, sans quoi le contenu ajouté ensuite n'est
  jamais relu (cf. 12.2).
- **Une assertion doit pouvoir être fausse** : `largeurTexte(c) === 0` ne l'est
  jamais. Après avoir écrit un contrôle, lui donner exprès une entrée fautive
  et vérifier qu'il la refuse (cf. 12).
- **Un séquenceur ne se règle pas sur une avance fixe** : elle doit couvrir le
  pire battement de l'horloge du navigateur, laquelle ne dépend pas du jeu
  (recopie AirPlay, page cachée bridée à 1 Hz, machine chargée). Quand seule la
  musique déraille et que les bruitages vont bien, c'est l'ordonnancement, pas
  la sortie audio (cf. 23).
- **Un niveau sonore se chiffre en dBFS par un rendu hors ligne** : « ça
  s'entend chez moi » dépend du casque et de la distance ; −38 dBFS de rms, non.
  Et rien sous **30 Hz** : aucun haut-parleur d'ordinateur, de téléphone ou de
  téléviseur ne le restitue (cf. 23).

---

## 9. Les deux quêtes annexes (lanterne, brasiers)

Deux quêtes ajoutées après coup : **la lanterne du pêcheur**, une chaîne en
cinq étapes qui traverse les deux régions, et **les brasiers éteints**, propre
aux Cendres. Vérifiées par `tests/11-quetes.js`.

### 9.1 Un objet de quête posé dans le décor doit être *trouvable*

Même piège que les lucioles (§ 5.2) : une tuile posée au hasard dans un bois
généré se retrouve cernée d'arbres et devient invisible. La lanterne et les
trois brasiers ont donc chacun **leur clairière franche de 5×5**, deux torches
en diagonale, un panneau, et un **repère clignotant sur la carte**. Un contrôle
compte les obstacles collés à chacun — il doit trouver **zéro**.

Vérifié en déplaçant la lanterne au cœur d'un bosquet sans clairière : le
contrôle passe au rouge (4 obstacles collés).

### 9.2 Et *atteignable* — mesuré, pas supposé

Un parcours en largeur rejoue les vraies règles de collision (lave, eau, roche
noire, braises sans les bottes, murs, dénivelés) et exige qu'une case **voisine**
de chaque objet soit atteinte : un brasier est un obstacle dur, on le frappe
depuis à côté.

Piège rencontré : le traceur de chemins des Cendres (`chemin()`) ne dégage que
la **lave et la roche noire** — il ne perce **pas les murs**. Un brasier posé au
nord de la Forge aurait vu son chemin tracé *au travers* de la salle, sans rien
ouvrir. Les trois brasiers sont donc tous **au sud de la Forge**. Vérifié en
enfermant un brasier dans l'Antre : le contrôle tombe à 2/3.

### 9.3 Une tuile modifiée doit refaire l'inventaire des lumières

La lanterne et les brasiers **éclairent**. L'inventaire des sources de lumière
était construit une seule fois à la génération du monde : un brasier rallumé
s'affichait en feu **sans rien éclairer**, et un rechargement rendait la lumière
définitivement perdue (les différences de décor restituent bien la tuile, pas la
liste des torches). D'où `inventorierTorches()`, appelée à chaque changement
**et après application des différences au chargement**.

### 9.4 Ne pas mesurer sa propre arithmétique

Premier jet du contrôle « l'épée de Cendre frappe plus fort » :

```js
zoneDegats(x, y, w, h, (Q.epeeLongue?2:1) + (Q.epeeCendre?1:0), 'epee');
```

Le test **recalculait lui-même** le dégât au lieu de laisser le jeu le faire :
supprimer le bonus dans `index.html` le laissait **vert**. Il passe désormais par
la vraie boucle du héros (`J.atk=13` puis `majJoueur()`, qui ne laisse passer
qu'une seule frappe) et mesure les points de vie réellement perdus. Injection
refaite : rouge, `1 -> 1`.

### 9.5 Une quête ne doit jamais pouvoir se bloquer

La lanterne se ramasse **même sans avoir parlé au pêcheur** : elle est en plein
bois du nord, on peut tomber dessus le premier jour. Le pêcheur l'accepte alors
directement. Un contrôle rejoue exactement ce cas.

Autres verrous du même ordre : les éclats d'obsidienne ne tombent que des
golems, jamais plus de trois à la fois (**les éclats déjà au sol sont comptés**,
sinon trois golems tués coup sur coup en laissaient six), et un brasier déjà
allumé ne se recompte ni ne repaie.

---

## 10. ⚠️ Le marteau était invisible dans la boîte d'objet

| | |
|---|---|
| **Symptôme** | « Je ne vois pas le marteau dans mes armes. » |
| **Cause** | La boîte d'objet du HUD choisissait son image **en dur** : `SPR[o==='bombe'?'bombeItem':'fleche']`, et affichait `J.fleches` comme compte. Tout objet qui n'était pas une bombe était donc dessiné **en arc, munitions comprises**. |
| **Mesuré** | La case du marteau et celle de l'arc étaient **rigoureusement identiques, pixel pour pixel**. |
| **Correctif** | La boîte lit la table `OBJETS` (`id`, `nom`, `spr`), qui existait déjà mais n'était utilisée nulle part. Seuls les objets à munitions affichent un compte ; le marteau montre **Y**, la touche qui s'en sert. |

Vérifié dans `06-terres-de-cendre.js` : les icônes des trois objets doivent être
**deux à deux différentes**, avec un contrôle à blanc (relire la même case
redonne exactement la même image) pour que « toutes distinctes » veuille dire
quelque chose.

> Le premier jet du contrôle lisait **toute la boîte** : le compte de munitions
> suffisait à faire différer les images, et le contrôle restait vert alors que
> les deux dessins étaient identiques. Il ne lit désormais que **l'icône**.
> Réinjection du bug d'origine : rouge.

---

## 11. L'écran de carte

### 11.1 ⚠️ Le pied de page se chevauchait et débordait

| | |
|---|---|
| **Symptôme** | « Y SAUVEGARDDERNIÈRE : 13:28 » sur une seule ligne, et une ligne coupée sous le bord de l'écran. |
| **Cause** | La carte était dimensionnée sur `H - 62`, puis les textes calés **sous elle** (`bas = my + MH*sc + 10`) tandis que la ligne des commandes était en absolu (`H - 12`). Selon les proportions de l'écran, `bas + 20` tombait exactement sur `H - 12`, et `bas + 30` passait hors champ. |
| **Correctif** | Le pied de page est **mesuré et posé à partir du bas** ; la carte prend ce qui reste. Un débordement devient impossible par construction. |

### 11.2 La carte s'effondrait sur les écrans hauts

Six pixels de marge de trop suffisaient à faire retomber la carte de l'échelle 2
à l'échelle 1 (elle est en 88×160 tuiles, l'échelle est entière) : elle
n'occupait plus qu'un sixième de l'écran. Le pied a été resserré au pixel.

### 11.3 Ce qui a été ajouté

- Une **légende** : les pastilles de couleur ne voulaient rien dire. Elle
  n'annonce que ce qui est réellement sur la carte — une luciole déjà prise ou
  un brasier déjà allumé en disparaissent — et se répartit sur autant de lignes
  qu'il faut, **avant** que la carte soit dimensionnée.
- Deux colonnes au lieu de trois : le canvas descend à 200 px de large, où
  « LUCIOLES 8/8 » débordait de la troisième.
- Le **témoin de sauvegarde** prend la place de la ligne des commandes le temps
  de s'afficher, au lieu de recouvrir la légende dans son propre cadre — or
  c'est justement sur cet écran qu'on appuie sur Y.
- « STOCKAGE : OK » n'occupe plus une ligne à chaque ouverture : le stockage
  n'est signalé que lorsqu'il pose problème.

`12-carte.js` intercepte le tracé et mesure les **rectangles réellement
dessinés** à cinq tailles d'écran : rien hors du canvas, aucun texte sur un
autre, aucun texte sur la carte, et la carte garde une vraie part de l'écran.

> Deux défauts du contrôle lui-même, trouvés en le réinjectant : il capturait
> **plusieurs images** de la boucle de rendu (chaque texte « se recouvrait »
> lui-même d'une image à l'autre), et il prenait le **mini-plan du HUD** pour la
> carte (dessiné avec la même image) — d'où une surface ridicule. Il ne capture
> plus qu'une image, et retient le plus grand des deux tracés.

---

## 12. ⚠️ La police remplaçait des caractères par « ? » sans rien dire

`glyphe()` fait `GLYPHES[ch] || GLYPHES['?']` : un caractère absent de la table
est dessiné en **point d'interrogation**, sans erreur ni avertissement.

Deux textes livrés en souffraient depuis des versions :

- le **journal** affichait `?X? PARLER À LA DOYENNE` : la table n'avait ni `[`
  ni `]` ;
- le garde Tomas disait « LA ROUTE EST PLUS SÛRE **GR?CE** À TOI » : pas de `Â`.

Glyphes ajoutés : `[ ] ; Â Ù Ä Ë Ï Ö Ü`. `Œ` reste absent — « COEUR » est écrit
en toutes lettres dans les boutiques, et le piège est consigné ci-dessous.

`13-police.js` parcourt **tout ce que le jeu sait écrire** — dialogues de chaque
personnage dans 28 états de partie, journal, objectif courant, étiquettes des
deux boutiques, panneaux, noms d'objets, messages et bandeaux des coffres — et
exige que chaque caractère soit dessinable. Plus un contrôle à blanc (on lui
donne un `Ω` : il doit le voir) et une couverture du français majuscule.

> ⚠️ Le contrôle qui existait pour cela dans `11-quetes.js` était **vide de
> sens** : il testait `largeurTexte(c) === 0`, or `largeurTexte` renvoie
> `longueur*6-1` — jamais 0 pour un caractère. Il passait quoi qu'on lui donne.
> Il interroge maintenant la table `GLYPHES`, comme le faisait déjà
> `10-colporteuse.js`.

### 12.1 Vérifier qu'un glyphe existe ne dit pas qu'il se voit

Les glyphes ajoutés ci-dessus avaient été écrits à la main **sans jamais être
regardés**. Ils ont donc été rendus à l'écran, agrandis, et quatre propriétés
ont été ajoutées au contrôle :

- chaque glyphe est **bien formé** : 7 lignes de 5, sans caractère étranger ;
- aucun glyphe n'est **vide** (il serait invisible sans rien signaler) ;
- aucun caractère n'en **copie** un autre ;
- chaque accentuée se **dessine différemment** de sa lettre nue, et les accents
  d'une même lettre se distinguent entre eux — comparaison des **images
  rendues**, pas des chaînes de la table.

Ce contrôle a trouvé un défaut resté dans la police depuis le début : le glyphe
du **cœur** contenait un `//`. La ligne vide décalait le dessin d'une rangée vers
le bas et lui coupait la pointe. Corrigé.

> Note sur la lisibilité : la cellule fait 5×7 pixels. Un accent ne peut pas se
> poser *au-dessus* d'une capitale pleine hauteur — il occupe la première rangée
> et le corps de la lettre se décale. C'est net sur E, I, O, C ; plus discret sur
> A et U, dont le sommet est déjà chargé. Les trois accents d'une même lettre
> restent distincts, ce que le contrôle vérifie.

### 12.2 Le piège du `Œ` s'est retendu — et le glyphe a fini par être écrit

La règle « écrire COEUR, pas CŒUR » a tenu le temps d'être oubliée : les
régions ajoutées ensuite ont ramené **sept textes affichés** contenant `Œ` —
journal, objectifs, messages, et le **nom du gardien sur sa barre de vie**
(`CŒUR DE CENDRE`, lu « C?UR DE CENDRE »).

Un contournement qu'il faut se rappeler n'en est pas un : **le glyphe `Œ` a été
ajouté**, la règle disparaît avec lui.

Deux failles du contrôle, découvertes à cette occasion :

- **Les états de partie étaient écrits à la main.** La liste ignorait les
  drapeaux des régions ajoutées après elle, donc aussi les dialogues qu'ils
  débloquent. Le balayage **énumère maintenant les clés de `Q`** (booléens,
  nombres, tableaux) et suit le contenu tout seul — plus un état « tout
  achevé ». Un contrôle vérifie que ce balayage ne s'effondre pas.
- **Il ne voyait que ce qu'il savait appeler.** `CŒUR DE CENDRE` vit dans une
  table de noms de gardiens, affichée par le HUD : aucun appel à parcourir. Un
  second balayage lit donc les **littéraux de la source** et retient ceux qui
  sont en capitales — ce qui distingue le texte affiché des commentaires et des
  identifiants.

---

## 13. Les Cimes Gelées et le Lagon d'Azur (deux régions de plus)

Le monde passe de deux régions à **quatre**, empilées du nord au sud : vallée,
Terres de Cendre, **Cimes Gelées** (rangées 160-239), **Lagon d'Azur**
(rangées 240-319). `MH` passe de 160 à 320. Comme pour les Cendres, chaque
région est ajoutée **en dessous** : les index de tuiles des régions du haut ne
bougent pas, et une sauvegarde d'avant l'ajout retrouve sa vallée et ses Cendres
intactes (les nouveaux champs de quête prennent leur valeur par défaut, le
brouillard des nouvelles rangées reste noir).

### 13.1 Une région bornée à sa bande, pas à `MH`

`genererCendres()` remplissait « du haut de la région jusqu'à `MH` ». Avec deux
régions de plus, ce `MH` recouvrait les Cimes et le Lagon de cendre et de lave.
Chaque génération, chaque peuplement, chaque révélation de carte est désormais
**bornée à sa propre bande** (`Y_CENDRE`→`Y_CIMES`, etc.), et `enCendre()` ne
répond vrai que **dans** les Cendres — plus « partout au sud ».

### 13.2 Atteignable à pied, à la nage — mesuré, jamais supposé

Comme au § 9, un parcours à blanc rejoue les **vraies collisions** :

- le **col** des Cendres descend bien dans les Cimes, la **Grève aux Palmes** et
  le boomerang s'atteignent **à pied** ;
- l'**Arène du Sommet** reste **scellée par des blocs de glace** tant qu'on n'a
  pas le boomerang pour les briser ;
- le **Large** et le **Temple Englouti** sont **cernés d'eau profonde** :
  injoignables sans les palmes, joignables avec.

> Piège évité : le traceur de sentier rouvrait la grille de glaçons du Sommet
> qu'on venait de poser (il dégageait la tuile de la brèche). On pose donc les
> **grilles après** les sentiers, et le sentier s'arrête une tuile avant le mur.

### 13.3 Le boomerang, une arme qui revient

Nouvelle arme (`Y`) : un projectile qui part droit devant, **ralentit, revient**
vers le héros et se range dans sa main ; en chemin il frappe les ennemis (une
fois chacun), **brise les blocs de glace**, **sonne les cloches de givre**,
déclenche l'œil de pierre et **ramasse les butins**. Un seul en vol à la fois.
C'est la clé du **crabe cuirassé**, sur qui l'épée ricoche : le boomerang (ou une
bombe) le **sonne**, et l'épée porte alors.

### 13.4 Les palmes, ou nager sans casser les tests

Les palmes rendent l'eau franchissable — `solide()` ne bloque plus `EAU`/
`EAUPROF` **si `Q.palmes`**. Comme aucun test n'accorde les palmes par défaut,
le comportement historique (le lac de la vallée reste infranchissable) est
**inchangé**, et les parcours à blanc des autres tests le vérifient encore.

### 13.5 Les objets de quête sont des butins persistants

Boomerang, palmes et les cinq perles sont des **butins reposés par `peupler()`**
tant que le drapeau de quête correspondant est faux — exactement comme la clé de
pierre. Ils réapparaissent à la même place au rechargement, jusqu'à ce qu'on les
ramasse ; les perles déjà prises ne reviennent pas. Les blocs de glace brisés et
les cloches sonnées sont des **tuiles** : ils survivent par les différences de
décor, sans champ de sauvegarde supplémentaire.

Tout est vérifié dans `14-cimes-lagon.js` : biomes, six monstres armés, boomerang
(vol/retour, glace, crabe), palmes (nage), les deux gardiens (Roi Yéti scellé,
Léviathan cerné d'eau), quêtes annexes, musique, mini-carte, et rien de perdu au
rechargement — le tout mesuré sur le vrai jeu.

---

## 14. Énigmes, grappin et un nouveau marteau

### 14.1 Des briques d'énigme réutilisables

Cinq pièces, posées d'un monde à l'autre, décrites en données (`PUZZLES`,
`poserEnigmes`) et résolues par `majPuzzles` :

- **`CAISSE`** — se pousse en avançant dans sa direction (`pousserCaisse`), si la
  case au-delà est un sol libre ;
- **`PLAQUE`** — une **dalle de pression** (un *sol*, pas un objet, pour qu'une
  caisse puisse s'y poser) ; couverte par une caisse **ou** par le héros ;
- **`PORTEP`** — une porte à mécanisme, ouverte quand **toutes** les plaques de
  son énigme sont couvertes ;
- **`INTER`** + **`BLOCB`/`BLOCO`** — un interrupteur frappé (épée, flèche,
  boomerang) **bascule sa région** : les blocs bleus s'abaissent, les orange se
  lèvent, et inversement. L'état vit dans `Q.inter[region]`, la solidité est
  dynamique (`solide`), le rendu suit.

La vallée **enseigne** chaque mécanique isolément ; les Cendres **combinent**
(deux plaques à couvrir *en même temps* — une seule caisse ne suffit plus).

> Pourquoi c'est robuste au rechargement : une caisse déplacée et une porte
> ouverte sont des **changements de décor** (tableau `objs`), déjà sauvegardés
> par les différences. Aucun champ de sauvegarde en plus. Les récompenses
> uniques (grappin, cœurs de cristal) sont des **butins reposés par `peupler`**
> tant qu'un drapeau `Q` dit qu'on ne les a pas — comme la clé de pierre.

### 14.2 Le grappin, mesuré comme une vraie traversée

Le **grappin** (`lancerGrappin`) accroche une **`ANCRE`** dans la direction du
regard et tire le héros jusqu'à la case d'avant, **par-dessus l'eau** — un mur
plein arrête la chaîne. La salle du gouffre le prouve : sa douve barre **toute**
la hauteur intérieure, si bien qu'un parcours à blanc (vraies collisions) trouve
le trésor **injoignable à pied** et **joignable au grappin**.

> Piège évité : la première douve ne couvrait que le centre de la salle ; on la
> contournait par la rangée du haut. Un test de reachability l'a chiffré, pas
> supposé — la douve va maintenant d'un mur à l'autre.

> Autre piège : les salles d'énigme, posées **après** le village, recouvraient
> les clairières de deux lucioles d'or (n° 4 et 7) de leurs murs. Elles ont été
> déplacées dans des poches vides ; le contrôle des lucioles (test 05) le
> garantit.

### 14.3 Le marteau ne balaie plus comme l'épée

| | |
|---|---|
| **Avant** | Le marteau réutilisait l'animation du coup d'épée (`J.atk`) : même arc horizontal, on ne distinguait pas les deux armes. |
| **Après** | Le marteau a son propre état (`J.slam`) : il **se lève au-dessus de la tête et s'abat** droit devant (`dessinerMarteau`), avec une **onde de choc** au sol et une secousse plus lourde. Le coup lui-même (`slamMarteau`) part **à l'impact** (`SLAM_IMPACT`), pas au déclenchement. |

Vérifié dans `15-enigmes.js` : appuyer sur **Y** avec le marteau met `J.slam > 0`
et **laisse `J.atk` à zéro** (c'est un *slam*, pas un coup d'épée), et la roche
noire ne cède qu'**à l'impact**.

---

## 15. Les Sables du Mirage (cinquième région) et le bracelet de force

Le monde passe de quatre régions à **cinq** : les Sables du Mirage occupent les
rangées 320 à 399, `MH` passe de 320 à 400. Comme les précédentes, la région est
ajoutée **en dessous** — les index de tuiles du haut ne bougent pas, les
sauvegardes restent valables. Tous les bornages `Y_LAGON..MH` (fin de la
génération du Lagon, faune, révélation de carte) ont été ramenés à `Y_SABLES`,
et `enLagon()` ne répond plus vrai que **dans** le Lagon.

### 15.1 Le bracelet de force : soulever, jeter, combler

Nouvel outil (`Y`) : `brasBracelet` **soulève** le `BLOCLOURD` posé devant soi
(`J.porte='lourd'`), puis, pressé de nouveau, le **jette** (`majBlocLourd`). Le
bloc jeté :

- **comble** une mare de `SABLEMOU` (elle redevient du désert ferme) ;
- sinon se **pose** sur la dernière case sèche et libre — donc **récupérable**,
  jamais perdu sur un raté ;
- frappe au passage ce qu'il touche.

Les bras chargés, on ralentit, on ne saute pas, on n'attaque pas et on ne change
pas d'objet — comme il se doit.

### 15.2 L'arène gardée par les sables mouvants — mesuré, pas supposé

L'unique accès à l'Arène du Colosse est un **couloir d'une case**, muré des deux
côtés, barré de trois `SABLEMOU`, avec quatre blocs lourds en réserve juste
avant. Un parcours à blanc (vraies collisions) trouve l'arène **injoignable**
tant qu'on ne comble pas le gué, et **joignable** une fois comblé.

> Deux pièges chiffrés puis corrigés :
> - le couloir laissait un **détour** par le désert ouvert : il est désormais
>   entièrement muré, aligné sur l'unique brèche de l'arène ;
> - un **fragment de fresque** posé contre le mur sud de l'arène y perçait un
>   trou (le dégagement de sa clairière effaçait la muraille) : les fragments
>   ont été éloignés des salles ;
> - le traceur de sentier **vidait** la réserve de blocs et le gué : la vanne
>   est posée **en dernier**, après toutes les voies.

### 15.3 Le Colosse de Grès : on lui renvoie ses propres blocs

Le Colosse est **cuirassé** : `frapper` renvoie tout, sauf un bloc lourd
(`'lourd'`) ou une bombe (`'explosion'`). Il **jette** des blocs qui atterrissent
en `BLOCLOURD` près du héros ; ramassés au bracelet et **renvoyés**, ils
l'entament. Vérifié dans `16-sables.js` : l'épée ricoche, le bloc porte.

### 15.4 Les trois monstres armés

- le **scarabée-bombe** roule vers le héros et **explose** de près — et explose
  aussi quand on l'abat (`scarabeeBoom`, avec un garde anti-double `e.boomed`) ;
- le **lancier d'os** lance son **javelot** à distance ;
- le **djinn de sable** dérive, traverse tout et **s'efface** par intermittence
  (on ne le touche que matérialisé, comme le spectre et la méduse).

### 15.5 Compatibilité des sauvegardes

`Q.inter` (l'état des interrupteurs à bascule) passe de quatre à **cinq**
entrées. Au chargement, une vieille sauvegarde est **complétée** sans être
réinitialisée (`while(Q.inter.length<5) Q.inter.push(0)`) : on ne perd pas les
bascules déjà actionnées. Les outils gagnés (`Q.bracelet`) sont **rééquipés** au
chargement s'ils manquent du sac.

---

## 16. Compatibilité des sauvegardes (aucun bloquant après un ajout)

Chaque niveau ou fonctionnalité est ajouté **sans jamais casser une partie déjà
enregistrée**. Le contrat, vérifié par `17-compat.js` sur de vraies sauvegardes
d'époque :

- **On ne change pas `VERSION_SAUVE`** tant que l'ancien format reste lisible.
  Le monde est déterministe et régénéré au chargement ; on ne conserve que
  l'état du héros, les drapeaux de quête, les différences de décor (`diff`,
  indexées par `y*MW+x` — et **`MW` ne change jamais**), les coffres, les
  lucioles et le brouillard.
- **Les nouveaux drapeaux de quête** prennent leur valeur par défaut :
  `razQuetes()` les pose tous *avant* `Object.assign(Q, d.Q)`, si bien qu'une
  vieille sauvegarde qui les ignore les laisse à zéro.
- **`Q.inter`** (bascules) est **complété** à une entrée par région sans être
  réinitialisé (`while(Q.inter.length<6) push(0)`) — on ne perd pas les bascules
  d'époque.
- **Les outils gagnés** (`Q.boomerang`/`grappin`/`bracelet`) sont **rééquipés**
  au chargement s'ils manquent du sac.
- **Le brouillard** trop court est complété par des zéros (zones neuves = non
  explorées) sans erreur ; un **tableau de coffres** trop court laisse les
  coffres neufs fermés ; une **position héritée** d'une carte plus petite est
  bornée puis `degager()` la sort de tout obstacle.
- **Le rattrapage du portail** reste : une partie à trois étoiles d'avant les
  Cendres trouve le portail ouvert.

Le test recharge trois sauvegardes — une d'avant les Cendres (trois coffres,
pas de brouillard), une de l'ère « quatre régions » (palmes et boomerang, aucun
champ des Sables), une posée au bord — et prouve à chaque fois : **pas de crash,
héros jamais coincé, progression intacte, et la suite du monde reste
atteignable** (le portail, puis l'oued des Sables).

---

## 17. Le Marais des Murmures (sixième région)

Une sixième bande de 80 rangées s'ajoute **sous** les Sables (`MH` passe de 400
à 480, `Y_MARAIS = 400`). Comme toujours, on n'ajoute qu'en dessous : les
indices de tuiles des régions existantes ne bougent pas, et une vieille
sauvegarde reste lisible (voir § 16).

- **Un nouvel outil, le fanal.** Ramassé au Bosquet du Fanal, il s'équipe seul
  (`Q.fanal`, ajouté au sac et sélectionné). Il **éclaire** la nuit du marais,
  **brûle les trois ronces** d'un rideau (`O.RONCE`, infranchissable autrement)
  et **rallume les veilleuses** (`O.VEILLEUSE → O.VEILLEUSEVIVE`, une lumière de
  plus).
- **Une nuit qui se voit.** `voileMarais()` peint un voile sombre
  (`darkCV`, composé en `destination-out`) percé de trous de lumière autour du
  fanal, des veilleuses vives, des torches et des follets. Le voile se lève le
  temps que la Reine éteint le fanal — c'est là tout le danger.
- **Trois créatures armées.** Le **follet** (harcèle en essaim), le
  **crapaud-catapulte** (crache des billes de venin), et l'**ombre** : elle
  **n'est touchable que dans la lumière** (`e.fondu` converge vers 1 dans le
  noir → coups renvoyés), mais **blesse même dans le noir**.
- **La gardienne : la Reine des Lucioles Noires.** Entrer dans le Cœur du Marais
  (l'arène, gardée par le rideau de ronces) la réveille (`boss.type==='reine'`,
  32 pv, phases *attente / voile / gerbe / appel* — la phase *voile* éteint le
  fanal et fait le noir). Vaincue, elle **révèle la carte** du marais et laisse
  un **cœur maximum**.
- **Une énigme de progression.** Le Cœur du Marais n'est atteignable qu'en
  **brûlant le rideau de ronces** — corridor d'une case, muré, barré de trois
  `O.RONCE` qui ne cèdent qu'au fanal. La quête annexe des **sept veilleuses**
  (rallumées) ouvre la carte et dépose un cœur au Bosquet.
- **Compatibilité.** `razQuetes()` pose `fanal:false, veilleuses:0,
  reineTue:false` (et `Q.inter` gagne une sixième bascule) *avant*
  `Object.assign(Q, d.Q)` : une sauvegarde d'avant le Marais les laisse à zéro,
  le fanal est rééquipé s'il manque du sac, et `17-compat.js` prouve qu'aucune
  vieille partie n'est bloquée. `18-marais.js` mesure sur le vrai jeu :
  atteignabilité (fanal, veilleuses, arène barrée puis ouverte par le feu),
  immunité de l'ombre hors lumière, réveil et chute de la Reine, journal,
  mini-carte, et rechargement sans perte.

---

## 18. Les monstres restent dans leur région

| | |
|---|---|
| **Symptôme** | Un monstre suivait le héros d'une région à l'autre par les passages (le col des Cendres, l'oued des Sables, le marécage), et se retrouvait à errer dans un biome qui n'est pas le sien. |
| **Cause** | Chaque branche d'IA bornait la position de l'ennemi aux **bords de la carte entière** (`clamp(e.y, TS*3, (MH-3)*TS)`), jamais à sa région. Rien ne l'empêchait de traverser une frontière en poursuivant le héros. |
| **Correctif** | Au premier réveil, l'ennemi retient sa **région d'origine** (`e.rIdx = regionIdx(⌊e.y/TS⌋)`, fixée une fois). Après le déplacement de chaque image, son **centre est confiné à la bande de cette région** (`BORNES_Y[e.rIdx]` → `BORNES_Y[e.rIdx+1]`, avec une demi-tuile de marge pour que le sprite ne déborde pas la frontière). |

Le confinement **ne touche qu'à l'axe vertical** (les régions sont des bandes
horizontales) et **ne casse pas la chasse** : dans sa propre région, l'ennemi se
rapproche toujours du héros ; il ne bute que sur la frontière. Les gardiens
restent, eux, tenus par leur arène.

Vérifié dans `19-frontieres.js` : sur chaque frontière interne, un ennemi placé
juste à côté avec le héros de l'autre côté ne la franchit **jamais** (poursuite
vers le bas comme vers le haut, créatures au sol comme volantes), tout en
continuant d'avancer vers le héros tant qu'ils partagent une région.

---

## 14. Les mondes 7 et 8, et la fin

Le plan des huit mondes est achevé : **la Cité des Nues** (rangées 480-559) et
**la Faille** (560-639). `MH` passe de 480 à 640.

### 14.1 ⚠️ Agrandir la carte repeignait les régions déjà écrites

C'est le défaut le plus grave rencontré ici, et il était **latent depuis les
Cimes**.

| | |
|---|---|
| **Symptôme** | En ajoutant deux régions, les brasiers des Terres de Cendre et l'atelier de Durn devenaient injoignables. |
| **Cause** | Deux boucles de décor de la vallée tiraient leur rangée sur `MH` : `y = 3 + rnd()*(MH-6)`. Une carte plus haute les diluait, donc **moins de tirages tombaient sur l'herbe** — or le tirage de forme (`rnd()<.4?ROC:BUISSON`) n'était fait qu'en cas de succès. Le nombre d'appels à `rnd()` changeait, et tout le générateur se décalait derrière. |
| **Mesuré** | La sortie sud de la Forge Noire passait de la cendre (`S.CENDRE`) aux braises (`S.BRAISE`) : infranchissable sans les bottes, alors qu'elle se traverse bien avant de les avoir. |

Correctif en deux temps :

1. les deux boucles sont **bornées à la vallée**, et le tirage de forme est fait
   **dans tous les cas** — le flux ne dépend plus des tuiles touchées ;
2. surtout, **chaque région reçoit sa propre graine** (`_s=…` en tête de chaque
   `genererXXX()`). Un monde ne peut plus être repeint par ce qui se passe
   ailleurs dans la génération. C'est l'invariant qui manquait : les index de
   tuiles étaient protégés, le *terrain* ne l'était pas.

> À retenir : une génération déterministe ne suffit pas. Si le **nombre** de
> tirages dépend d'une donnée globale, tout ce qui suit bouge. Isoler la graine
> par région coûte une ligne et supprime la classe entière de bugs.

### 14.2 Cité des Nues — le vide, la cape, les colonnes

Rien ne s'y traverse à pied : la région est du **vide** semé d'îles. Le vide
n'est pas un mur, on y entre et **on tombe** — un cœur perdu, retour au dernier
sol ferme foulé (mémorisé en continu ; sans lui, une chute au milieu d'un grand
vide renverrait n'importe où, voire dans le vide à nouveau).

La **cape des courants** (touche Y) fait planer : la chute est freinée et le
vide ne reprend pas. Les **colonnes d'air** relancent le vol — mais seulement
pour qui a la cape, sans quoi la Cité resterait franchissable sans elle.

Le **Parvis des Vents**, où dort la cape, se gagne **à pied** : on ne peut pas
enfermer un outil derrière lui-même. Le Belvédère, lui, est de l'autre côté du
vide. Les deux sont mesurés.

Quête annexe : les **huit carillons du vent**, suspendus au-dessus du vide, que
seul le **boomerang** fait sonner — pas l'épée.

### 14.3 La Faille — trois paliers, une salle finale, cinq phases

Pas de nouvel outil : on arrive avec tout. Trois paliers rejouent chacun
l'épreuve d'un monde traversé (glace/boomerang, bloc lourd/bracelet,
ronces/fanal), chacun gardant un **sceau**. Les trois brisés effacent les éclats
noirs qui ferment la **salle finale**, où les quatre mécaniques s'enchaînent.

Le **Rongeur d'Étoiles** emprunte, par tranches de points de vie, les armes des
gardiens qu'il a dévorés : charge, gerbe, glace, plongée, puis **le cœur à nu**.

Deux défauts de conception trouvés par le contrôle d'atteignabilité, et non à
l'œil :

- **on contournait les trois barrières** : elles laissaient deux colonnes libres
  contre les murs. Elles courent maintenant de mur à mur.
- **on entrait dans la salle finale par en dessous**, sans avoir brisé un seul
  sceau : le couloir qui descend vers l'arène débouchait en plein néant, or le
  néant se marche. Le couloir est désormais muré sur ses flancs. Et le chemin
  qui mène à la salle finale **contourne les paliers** : tracé tout droit, il
  perçait la barrière de blocs lourds du deuxième.

### 14.4 La fin

Ce n'est pas un écran mais un **état de jeu** (`epilogue`) : les trois étoiles
reprises s'élèvent, puis la caméra remonte **les huit mondes d'un seul
mouvement**, chacun ramenant son propre morceau, jusqu'au village. Puis le
bilan : armes, gardiens, quêtes, énigmes, cœurs, lucioles, rubis, temps.

Au passage, un reliquat corrigé : **la victoire se déclenchait encore à la fin
du monde 2** (trois braises), alors que six régions suivaient. Les braises
ouvrent maintenant la route des Cimes, et la fin attend le Rongeur.

`20-nues-faille.js` et `21-fin.js` mesurent tout cela sur le vrai jeu : chute et
vol plané, colonnes avec et sans cape, carillons à l'épée puis au boomerang,
sceaux, paliers du Rongeur, parcours réel de la caméra et morceaux traversés.

---

## 15. ⚠️ Performance : le sol pré-rendu d'un seul bloc

| | |
|---|---|
| **Symptôme** | « Il y a des gros problèmes de performance. » |
| **Cause** | Le sol était pré-rendu sur **un seul canvas de la taille du monde** : `MW*TS × MH*TS`, soit **1408 × 10240 px — 14,4 Mpx, ~55 Mo**. Il était reconstruit intégralement à chaque génération **et à chaque chargement de partie**. |
| **Mesuré** | `prerendreSol()` : **720 ms de gel**. En marchant à travers les régions : **58 images sur 419 au-dessus de 20 ms**, la pire à **103 ms**. |

Ce n'était pas seulement lent : **iOS refuse les canvas au-delà d'environ
16 Mpx**. À 14,4 Mpx, une région de plus et le jeu ne s'affichait plus du tout.

### Le correctif : des bandes construites en chemin

Le sol est découpé en **bandes d'une région** (80 rangées), chacune
1408 × 1312 px (1,8 Mpx), avec une marge haute et basse pour le relief — une
tuile surélevée déborde vers le haut, une face de falaise vers le bas.

- **Chargement** : seule la bande où se tient le héros est bâtie. Les autres
  attendent.
- **En jeu** : `majBandes()` avance la construction d'un nombre **plafonné** de
  rangées par image. Jamais de bloc, donc jamais d'à-coup.
- **Anticipation** : dès que le héros s'approche à moins de 24 rangées d'une
  frontière, la bande suivante se prépare — elle est prête avant qu'il n'y
  arrive.
- **Recyclage** : au plus quatre bandes en mémoire, et les toiles évincées
  repartent dans un **pot commun**. En créer une et la laisser au ramasse-miettes
  coûtait jusqu'à 40 ms.

### Résultat mesuré

| | avant | après |
|---|---|---|
| Pré-rendu au chargement | 720 ms | **91 ms** |
| Mémoire de sol | 55 Mo | **7 Mo** (14 Mo au plus) |
| Plus grande toile | 14,4 Mpx | **1,8 Mpx** |
| Images > 20 ms (traversée des 8 régions) | 58 / 419 | **1 / 419** |
| Pire image | 103 ms | **35 ms** |
| p99 | 28,5 ms | **17,8 ms** |

### Vérifié

Le rendu du sol a été comparé **pixel à pixel** avec l'ancien, sur onze lieux
répartis dans les huit régions : **identique partout**.

> Le premier essai comparait 9 lieux sur 11 seulement. Les deux qui différaient
> — les Sables et le Marais — n'étaient pas des bugs : le pré-rendu **fige les
> sols animés** (sables mouvants, vase) à l'instant de la cuisson, et les deux
> versions ne cuisaient pas à la même image. En fixant `tick`, l'égalité est
> parfaite. Une différence d'image n'est pas toujours une régression.

`22-performance.js` garde ces gains. Il ne mesure pas « c'est rapide » — une
machine d'intégration n'est pas un téléphone — mais des propriétés
**structurelles** : taille des toiles, nombre bâti au chargement, plafond réel
par image, recyclage effectif, et le fait que traverser les huit régions
**n'alloue plus rien**.

> Piège du contrôle lui-même : la première version mesurait `batirBande()`
> appelée à la main, et restait verte alors qu'on avait retiré le plafond de
> `majBandes()` — c'est-à-dire de ce qu'une image fait réellement. Elle mesure
> désormais `majBandes()`, et la médiane des images de construction plutôt que
> la première, qui paie seule l'achat de la toile.

---

## 16. La carte : une région en grand, les huit en vignettes

| | |
|---|---|
| **Symptôme** | « Je vois toujours juste la carte en 8 carrés un par-dessus l'autre. » |
| **Cause** | L'écran de carte montrait le monde ENTIER — 88 × 640 tuiles depuis le huitième monde. Une bande haute et fine, réduite à l'échelle pour tenir : huit petits carrés illisibles. |

L'écran montre désormais la **région active en grand**, et les huit régions en
**vignettes fixes** sur le côté (ou en bande sous la carte quand l'écran est
trop étroit — c'est la disposition qui laisse la plus grande carte qui gagne).
**L/R** passent d'une région à l'autre ; la carte s'ouvre toujours sur celle où
l'on se trouve, et un point vert rappelle où l'on est vraiment. Une région
jamais visitée reste un « ? ».

Deux détails qui comptent :

- **L'échelle est fractionnaire, et c'est assumé.** À l'entier, une carte qui
  tenait à 1,9 retombait à 1 : 88 px de large sur un écran de 200. La mini-carte
  est déjà une image d'un pixel par tuile que l'on agrandit ; mieux vaut des
  tuiles d'inégale largeur qu'un timbre-poste.
- **La ligne d'aide « L/R » est comptée dans la mise en page.** Posée après coup
  sous la carte, elle retombait en plein sur la bande de vignettes.

### Le contrôle ne voyait pas le défaut qu'il devait voir

`12-carte.js` relevait les tracés de la mini-carte mais **ne gardait que le plus
grand**, et ne notait que le rectangle de DESTINATION. Deux angles morts :

1. le texte d'aide pouvait recouvrir une vignette sans que rien ne le signale —
   c'est précisément le défaut trouvé à l'œil sur écran étroit ;
2. surtout, **réinjecter le bug d'origine** (dessiner le monde entier au lieu
   d'une région) laissait le contrôle **vert** : la destination est la même, seule
   la source change.

Il relève maintenant **tous** les tracés, vignettes comprises, et **la hauteur
de la source** : la grande carte doit lire exactement une région (80 rangées) et
non le monde (640). Réinjection faite : rouge.

> Leçon : un `drawImage` a deux rectangles. N'en mesurer qu'un, c'est ne mesurer
> que la moitié de ce qu'on croit vérifier.

---

## 17. Saccade : ce qui est jeté à chaque image

| | |
|---|---|
| **Symptôme** | « C'est encore lent. Saccadé. » — après le découpage du sol en bandes. |
| **Cause** | La boucle de rendu **allouait à chaque image** : une `Map`, un tableau par rangée de profondeur, et **un objet enveloppe par entité**. Et elle les créait pour les **332 entités des huit régions**, alors qu'une vingtaine seulement est à l'écran. |
| **Mesuré** | 332 entités triées par image contre **9 à 23 réellement visibles**. Le temps médian d'une image restait sous la milliseconde, mais le **p95 montait à 16,7 ms** sans qu'aucune phase mesurée ne l'explique : la signature d'un ramasse-miettes. |

Sur une machine de bureau, vingt mille objets éphémères par seconde ne se voient
pas. Sur un téléphone, ils saccadent.

Correctif :

- **On écarte le hors-champ AVANT d'allouer** : une entité dont la rangée sort
  du cadre n'est plus enveloppée ni triée. 332 → 9-23 par image.
- **Bacs et enveloppes sont réutilisés** d'une image à l'autre. 23 enveloppes
  sont créées une fois pour toutes, et resservent indéfiniment.
- `libererBandesLointaines()` faisait `map + filter + sort` **à chaque image**,
  soit trois tableaux jetés soixante fois par seconde. Réécrite sans allocation.

> Le premier réflexe avait été d'espacer ce ménage (une image sur trente-deux).
> C'était traiter le symptôme : le pot de toiles s'en trouvait affamé, et une
> nouvelle toile était allouée en chemin — ce que `22-performance.js` a
> immédiatement signalé. La bonne réponse était de rendre la fonction gratuite,
> pas de l'appeler moins souvent.

### Le contrôle mesurait la mauvaise chose

Première version de l'assertion : le pot d'enveloppes ne doit pas grossir. Or
réallouer `_env[i] = {…}` à chaque image **laisse sa longueur inchangée** — le
contrôle restait vert avec le défaut réinjecté. Il compare désormais
l'**identité** des objets : ce doivent être les mêmes qui resservent.

---

## 18. La version affichée vieillissait en silence

Elle est restée à **« V0.6 — 6 des 8 mondes »** pendant que les huit mondes
étaient en ligne. Depuis un téléphone, ce numéro est le **seul** moyen de savoir
quelle version on a réellement sous les yeux.

- La version est montée à **V1.1**, et `package.json` avec elle.
- La règle est consignée dans **`CLAUDE.md`**, à faire à chaque livraison.
- `23-version.js` vérifie ce qui est vérifiable : que la version existe, qu'elle
  est **réellement dessinée** sur l'écran-titre (une constante définie mais
  jamais affichée n'apprendrait rien au joueur), et qu'elle **ne diverge pas de
  `package.json`** — monter l'une oblige à monter l'autre.

> Aucun test ne peut vérifier qu'un humain a pensé à monter un numéro. Il peut
> en revanche rendre l'oubli bruyant.

---

## 19. Un panneau de débug, pour diagnostiquer là où ça se passe

Les mesures de performance de ce journal ont toutes été prises sur une machine
de développement — c'est-à-dire **pas là où la saccade se produit**. D'où un
bouton **DÉBUG** dans la barre d'outils, qui affiche à l'écran :

- **IPS**, durée moyenne d'une image, et surtout **la pire** — c'est elle qui
  dit l'à-coup, la moyenne le cache ;
- le nombre d'**images longues** (> 20 ms) sur les deux dernières secondes, et
  le temps de **travail** de la boucle (hors attente d'affichage) ;
- la **région**, la position, le nombre d'ennemis, d'entités **triées** et de
  particules ;
- les **bandes de sol** en mémoire, les toiles en réserve, la mémoire JS ;
- la taille du canvas et son facteur d'agrandissement.

La première ligne passe au **rouge** dès qu'une image dépasse 32 ms.

### L'instrument doit être gratuit

Un panneau qui alloue à chaque image mesurerait ses propres déchets, et le
diagnostic serait faux. Donc : **tampons circulaires préalloués** (`Float64Array`
de taille fixe), aucun objet créé par image, aucun tri — moyenne, pire et
comptage se calculent en une passe. Éteint, il ne mesure ni ne dessine rien.

Deux détails corrigés à l'œil : le panneau était d'abord **collé en haut, à demi
transparent** — les cœurs, les rubis et les étoiles transparaissaient à travers
les chiffres et l'on ne lisait plus ni l'un ni l'autre. Il est posé **sous le
HUD**, sur fond opaque. Et ses lignes **débordaient à droite** sur un canvas de
200 px (« MEM 10 MO » rogné) : elles sont compactées, et tronquées en dernier
recours.

### Deux contrôles verts pour de mauvaises raisons

- « éteint, il ne dessine rien » appelait `boucleCorps()` à la main. Or le
  panneau est dessiné par `boucle()`, qui l'enveloppe : le contrôle restait vert
  même en le dessinant sans arrêt. Il compte désormais les appels que fait la
  **vraie** boucle.
- « aucune ligne ne déborde » ne débordait jamais, les lignes étant déjà courtes.
  Un second contrôle **force un nom de région absurdement long** et vérifie que
  la troncature s'applique.

---

## 20. L'arme au poing ne suivait pas la direction — elle n'existait pas

| | |
|---|---|
| **Symptôme** | « Quand le personnage change de direction, il faut que l'épée ou l'outil change aussi de direction. » |
| **Cause réelle** | Au repos et en marche, le héros ne portait **rien**. L'épée n'était dessinée que pendant une attaque (les planches `h{dir}a{f}`, elles, correctement orientées), et l'outil sélectionné n'apparaissait nulle part — sauf dans la petite boîte du HUD. Tourner ne changeait donc rien à l'écran : il n'y avait rien à tourner. |

Vérifié à l'œil avant de corriger : une planche du héros dans les quatre
directions, au repos, montre quatre silhouettes **les mains vides**.

**Correctif** : le héros tient désormais son **outil sélectionné** — son **épée**
s'il n'en a aucun — et l'arme est placée selon `J.dir`. De dos, elle passe
**derrière** le corps, comme le bouclier. Elle n'est pas dessinée pendant une
attaque, un tourbillon, un coup de marteau, un portage ou un vol de grappin :
ces gestes dessinent déjà l'arme, et autrement — on aurait vu deux lames.

Bénéfice de côté : on voit enfin **quel outil est équipé** sans regarder le HUD.

### Le contrôle mesure les pixels que l'arme AJOUTE

`25-arme-main.js` ne cherche pas « une épée quelque part ». Il dessine le héros
**deux fois** — avec et sans son arme au poing — et isole les pixels qui
diffèrent. Il obtient ainsi la boîte réelle de l'arme, et vérifie qu'elle passe
**à gauche quand on va à gauche, à droite quand on va à droite**, que les quatre
directions donnent quatre placements distincts, et qu'aucune seconde lame
n'apparaît pendant une attaque.

> Encore un contrôle vert pour une mauvaise raison, et **la même erreur que pour
> le panneau de débug** : il appelait `dessinerArmeMain()` à la main. Retirer ses
> appels de `dessinerJoueur()` — c'est-à-dire remettre exactement le défaut
> d'origine — le laissait vert. Il passe désormais par `dessinerJoueur()`, en
> neutralisant l'arme pour la seconde passe. Réinjection : rouge.
>
> À retenir : **tester la fonction, ce n'est pas tester qu'elle est appelée.**


---

## 21. Les manettes Bluetooth ne faisaient rien du tout

### Le symptôme, et la vraie cause

Une manette appairée au téléphone (ou branchée à l'ordinateur) laissait le jeu
de marbre. Le réflexe est d'aller chercher un mauvais code de touche ; la cause
était plus radicale : **le jeu n'a jamais lu l'API Gamepad**. Il n'écoutait que
`keydown`/`keyup` et les pointeurs. Or une manette n'envoie **ni touche ni
contact** : elle n'existe que si on la *relève*, image par image, dans
`navigator.getGamepads()`. Il n'y avait donc rien à corriger — tout à écrire.

### Ce qui coûte cher quand on l'écrit naïvement

**`getGamepads()` rend un tableau NEUF à chaque appel.** L'interroger à chaque
image, c'est jeter un objet par image — exactement ce que § 17 avait chassé de
la boucle. D'où la règle retenue : on n'interroge l'API **que si une manette
s'est annoncée** (`gamepadconnected`), et l'on retombe à zéro appel dès qu'il
n'en reste plus. Mesuré : sans manette, **0 appel** en 19 images ; le garde-fou
retiré, **38**.

**Les boutons sont relevés, pas événementiels.** Sans mémoire de l'image
précédente, un bouton maintenu vaut un appui **par image**. Mesuré en tenant
la tranche droite : **59 changements d'objet** au lieu d'un seul. On ne
déclenche donc que sur le front montant, et l'on compare par *nom* de bouton —
les gâchettes 6/7 doublant les tranches 4/5, relever l'index n'aurait pas
suffi.

**Toutes les manettes n'annoncent pas la disposition « standard ».** Beaucoup de
manettes Bluetooth n'ont pas de boutons 12-15 : la croix arrive sur l'axe
chapeau `axes[9]`, codé de −1 (haut) à 1 (haut-gauche), au repos **hors** de
cet intervalle. Piège dans le piège : `Math.round((0+1)*3.5) === 4`, donc un
axe simplement **inutilisé, resté à 0**, se lit « bas » — le héros descendait
tout seul. Mesuré : **55,8 px** de dérive vers le bas. Comme 0 n'est jamais une
direction valide de ce codage, on l'exclut.

**Un stick usé dérive.** Zone morte à 0,22, puis **remise à l'échelle** du reste
de la course : sans elle, le dosage s'écrase (le héros va presque aussi vite
effleuré qu'à fond — 41,6 px contre 55,8, au lieu de 26,5 contre 55,8).

**Un appui manette n'est pas un « geste de l'utilisateur ».** Le contexte audio
créé là naît *suspendu*, et `if(!AC) initSon()` ne réessayait jamais : le jeu
restait muet pour toujours. D'où `reveillerSon()`, qui crée **ou relance** le
contexte, appelé à chaque occasion — le premier vrai geste le réveille.

### Vérifié

`26-manette.js` pilote le **vrai jeu** avec une manette simulée au seul endroit
où le navigateur nous parle d'elle : `navigator.getGamepads()` et les deux
événements de branchement. Rien du jeu n'est remplacé. Le héros se déplace,
l'épée sort, l'objet change — et l'on mesure des pixels.

Les six défauts ont été **réinjectés** un à un ; les chiffres ci-dessus en
viennent. Retirer `majManette()` de la boucle fait tomber **8 contrôles sur 13**.

> Un contrôle a d'abord été vert pour une mauvaise raison, puis rouge par
> hasard : il lisait `J.atk` **une seule fois**, 120 ms après l'appui — or le
> coup d'épée ne dure que 14 images (~117 ms à 120 Hz). Il tombait donc au
> hasard du planning, et n'a rougi qu'en suite complète. Il échantillonne
> désormais pendant tout l'appui.
>
> À retenir : **guetter d'un seul coup d'œil un état qui ne dure que quelques
> images, c'est tirer à pile ou face.**

### À ne pas réintroduire

- **Ne jamais appeler `navigator.getGamepads()` sans manette annoncée** : c'est
  un tableau jeté par image.
- **Un bouton relevé n'est pas un événement** : sans mémoire de l'image
  précédente, il se répète soixante fois par seconde.
- **`Math.round((0+1)*3.5)` vaut 4** : un axe chapeau inutilisé se lit « bas »
  si l'on ne refuse pas explicitement la valeur 0.
- **Le son ne démarre pas sur un appui manette** : passer par `reveillerSon()`,
  jamais par `if(!AC) initSon()`.

---

## 22. La rive lointaine du gouffre se refermait sur le héros

### Le symptôme, et la vraie cause

« Je peux passer avec le grappin, mais pas revenir. » Signalé depuis la salle du
gouffre de la vallée (`ENIG.gouffre`, x 3-11 / y 28-36) : le héros y traverse la
douve au grappin, prend le trésor… et n'en ressort jamais.

La cause n'est pas dans le grappin, qui fonctionne. Elle est dans la
**géométrie** : la douve barre toute la hauteur intérieure — c'est voulu, « aucun
détour à pied » — mais elle la barre **dans les deux sens**, et il n'y avait
qu'**une seule ancre**, posée sur la rive lointaine. Aller : on vise l'ancre
depuis l'entrée. Retour : rien à viser. Or la seule porte de la salle est en bas,
**du côté de l'entrée**.

Mesuré, flood-fill sur les vraies collisions avec la règle du grappin :

```
        ancres de la salle : [[9,32]]        ← une seule, à l'est
        entrée → trésor    : OUI  (58 cases)
        trésor → entrée    : NON  (19 cases) ← la poche scellée
```

Dix-neuf cases : la rive est tout entière, torche et ancre déduites. Le héros y
était enfermé pour de bon — l'eau n'est franchissable qu'avec les palmes, qui
sont dans un monde que l'on ne peut plus atteindre.

### Le correctif

Une seconde ancre, **en miroir**, contre le mur ouest (`s.x0+1, s.y0+4`). Elle
ne gêne aucun passage : la colonne x=4 porte déjà une torche, et l'on entre par
les colonnes 5 et 6. Après correctif, **57 cases des deux côtés**.

```
28 #########      28 #########
29 #i..~..i#      29 #i..~..i#
30 #...~..T#      30 #...~..T#
32 #...~.A.#  →   32 #A..~.A.#
36 ##E.#####      36 ##E.#####
```

**Les parties déjà piégées se rattrapent toutes seules.** L'ancre vient de la
génération, rejouée à chaque chargement, et le joueur n'a jamais modifié cette
case : aucune différence sauvegardée ne la recouvre. Vérifié en sauvant sur le
trésor puis en rechargeant — le héros revient en x=5, rive ouest. **Personne
n'a à recommencer.**

### Ce que le contrôle ne regardait pas

`15-enigmes.js` mesurait déjà « LE GOUFFRE EST INFRANCHISSABLE À PIED » et
« LE GRAPPIN TIRE LE HÉROS PAR-DESSUS L'EAU ». Les deux étaient verts, et le
sont restés pendant tout le temps où la salle était un cul-de-sac : **ils
mesuraient l'aller**. Un franchissement ne se teste pas dans un sens.

Le nouveau contrôle rejoue le retour sur le vrai `lancerGrappin()` — au bord de
l'eau, face à l'ouest — puis vérifie que l'entrée se rejoint **à pied** depuis
le point de chute. Réinjection (ancre de retour retirée) : rouge, et lui seul.

Les quatre salles d'énigme ont été repassées au même crible — depuis **chaque**
case atteignable, l'entrée doit rester joignable : `caisse`, `inter`, `gouffre`,
`cendre`, retour possible partout.

> Le gouffre de la Faille (`FAILLE.finale`) a bien son ancre du même côté que le
> héros, mais son vide se franchit à la cape, que l'on possède forcément là-bas —
> la salle reste traversable, et `21-fin.js` le mesure déjà. À revoir un jour
> pour l'intention (l'épreuve annoncée « grappin » se résout à la cape), pas
> pour un blocage.

### À ne pas réintroduire

- **Un obstacle qui barre toute une hauteur la barre dans les deux sens** : tout
  franchissement à sens unique (ancre, colonne d'air, bloc à combler) doit avoir
  son pendant au retour, ou une seconde issue.
- **Tester un franchissement dans un seul sens ne prouve rien** : mesurer aussi
  le retour, et l'atteignabilité de l'entrée depuis le fond de la salle.

---

## 23. La musique se hachait dès qu'on renvoyait le jeu sur le téléviseur

**Symptôme rapporté** : « la musique, surtout sur l'ordi » — puis, précision
décisive du joueur : *« je pense que ce n'est que quand j'AirPlay le jeu sur la
TV »*. Les bruitages, eux, ne posaient aucun problème.

### La cause réelle

Ce n'est pas la sortie audio, c'est **l'horloge du navigateur**. En recopie
AirPlay, le Mac encode et diffuse la vidéo en continu : `setInterval` arrive
quand il peut, avec des retards de plusieurs centaines de millisecondes. Or le
séquenceur ne programmait la musique que **250 ms à l'avance**. Un seul
battement en retard suffisait à vider la file ; la garde
`if(tempsMus<AC.currentTime) tempsMus=AC.currentTime+.05` remettait alors
l'horloge à zéro — trou, **et tempo reparti n'importe où**.

**Pourquoi la musique seule cassait** : un bruitage est un coup isolé, programmé
à `currentTime+delai`. Qu'il parte 300 ms trop tard ne s'entend pas. La musique,
elle, est un flux : elle exige d'avoir toujours de l'avance en réserve.

Mesuré, horloge bridée à 1 Hz (le cas limite : ce que font aussi les navigateurs
de bureau sur une page cachée), morceau « boss », pas de 200 ms :

```
                        avant            après
  notes sur 4 s          8               44   (≈ 40 attendues)
  trous > 1,6 pas        3                0
  silence cumulé      2,22 s sur 4     0,00 s
```

### Trois autres défauts trouvés au passage, tous mesurés

| Défaut | Mesure |
|---|---|
| **La musique sortait 12 dB trop bas** | crête **−30,1 dBFS**, rms −38,4 — soit 30 dB de marge inutilisée. Collée à l'oreille sur un téléphone on l'entendait ; à un mètre d'un ordinateur, ou renvoyée sur les enceintes d'un téléviseur, elle disparaissait sous les bruitages. |
| **`victoire` : deux voix de longueurs différentes** | mélodie **36 pas**, basse **33**. La boucle tournant sur la plus longue, la basse se relançait en plein milieu, décalée. |
| **Deux basses sous le seuil audible** | `faille` **23 Hz**, `rongeurBoss` **28 Hz**. Rien n'en sortait d'un haut-parleur d'ordinateur ou de téléviseur ; au casque, un simple battement sourd. Ces lignes de basse n'existaient tout simplement pas. |

### Les correctifs

- **Avance de programmation adaptative** (`AVANCE_MUS_MIN=1.2` s,
  `AVANCE_MUS_MAX=2.5` s). `tickMusique` mesure le **pire battement récent**
  (`pireBatMus`, qui retombe doucement au calme) et programme 2,5 fois plus
  loin. Une horloge lente élargit l'avance d'elle-même ; le calme la resserre.
- **Les notes à venir sont coupées au changement de morceau**
  (`couperNotesAVenir`), sinon l'ancien morceau déborderait sur le nouveau
  pendant toute l'avance. `stop` à un instant antérieur au départ garantit que
  la note ne sonnera jamais : aucun clic. Celles qui sonnent déjà finissent leur
  enveloppe — c'est un enchaînement naturel. **C'est ce correctif qui rend
  l'avance large gratuite** : la réactivité est intacte.
- La liste `notesMus` est **compactée sur place** à chaque battement : elle ne
  peut pas enfler, et rien n'est alloué par image (cf. § 8).
- **Volume maître `.5` → `2`** (`VOL_MAITRE`) : +12 dB. Musique à **−18,1 dBFS**
  de crête, −26,4 de rms. Les deux bus passant par le maître, **l'équilibre
  voulu est conservé** : la musique reste 5,1 dB sous les bruitages (4,7 avant).
- **`AC.onstatechange`** relance le contexte quand il n'est plus `running` :
  changer de sortie en cours de route (casque, AirPlay) peut le suspendre, et
  personne ne touchera forcément une touche ensuite. Idem au retour de
  visibilité.
- Basse de `victoire` portée à **36 pas**, basses de `faille` et `rongeurBoss`
  **remontées d'une octave** (23 → 46 Hz, 28 → 55 Hz). Mêmes lignes, enfin
  audibles.

### Vérification

Quatre nouveaux contrôles dans `08-musique.js`, tous sur le vrai jeu :
le séquenceur avec **horloge bridée à 1 Hz** (aucun trou), l'**égalité des
longueurs** de pistes, l'**absence de note sous 30 Hz**, et le **niveau de
sortie** rendu hors ligne par la vraie chaîne (`noteMus → gainMus → maitre`).

Réinjection des quatre bugs, un par un : chacun rougit **son** contrôle et lui
seul, avec le bon chiffre (`4 trou(s), pire écart 0.961s` ; `victoire (36/33)` ;
`faille (23 Hz)` ; `crête -30.1 dBFS`). Suite complète : **507 contrôles verts**.

### À ne pas réintroduire

- **Un séquenceur ne se règle pas sur une avance fixe.** L'avance doit couvrir
  le pire battement de l'horloge, et l'horloge ne dépend pas du jeu : recopie
  AirPlay, page cachée (bridage à 1 Hz), machine chargée. La mesurer, pas la
  supposer.
- **Un flux et un coup isolé ne cassent pas pareil.** Quand seule la musique
  déraille et que les bruitages vont bien, chercher du côté de l'ordonnancement,
  pas de la sortie audio.
- **Chiffrer le niveau, en dBFS, par un rendu hors ligne.** « Ça s'entend chez
  moi » dépend du casque, de l'appareil et de la distance ; −38 dBFS de rms, non.
- **Deux pistes d'un même morceau doivent avoir la même longueur**, sinon la
  plus courte se déphase à chaque tour de boucle.
- **Rien sous 30 Hz** : une basse écrite trop bas ne s'entend sur aucun
  haut-parleur d'ordinateur, de téléphone ou de téléviseur.

---

## 24. La colporteuse : une silhouette floue, deux annonces, et trop de passages

### Le symptôme, et ce qu'on a mesuré

Trois défauts distincts, tous visibles manette en main :

1. **On ne voyait pas ce qu'elle était.** Son sprite tenait en 22 × 30 px de
   violet presque uniforme : capuche, cape et ballot partageaient deux teintes
   (`#4a3a6a` / `#6a56a0`), les yeux faisaient 1 px de large, et rien à l'écran
   ne disait « marchande ». Posée dans l'herbe, elle se lisait comme un buisson.
2. **Deux annonces pour un seul événement.** `poserMarchand()` appelait
   `annonce()` *et* `dire()` : un bandeau en plein milieu de l'écran **et** une
   boîte de dialogue en bas, simultanément. Compté depuis le jeu : **2 messages**.
3. **Elle passait toutes les minutes.** Après son départ, le délai de retour
   valait `3600 + rnd()*3600` images, soit **60 à 120 secondes**. Une visite par
   minute : ce n'était plus un événement, c'était un distributeur au coin de la
   carte. Et ses tarifs ne bougeaient jamais d'une visite à l'autre.

### Les correctifs

**Elle a un kiosque, et il est en deux pièces.** Un seul sprite posé derrière
elle l'aurait laissée *collée* à son décor. `kiosqueFond` (montants, auvent
rayé, toile de fond, marchandise suspendue) est dessiné **avant** elle ;
`kiosqueEtal` (planche, nappe, étoffes, cageot, jarres) est dessiné **après**,
décalé de 4 px vers l'avant. Le comptoir lui passe donc devant les jambes :
elle se tient *dans* sa boutique.

La toile de fond est **sable** (`#b09068`) et non violette : en violet, sa cape
s'y fondait et elle disparaissait dans son propre kiosque.

**Elle a une besace, et une silhouette.** 22 × 32 px : capuche à bords
retombants, visage dans l'ombre avec deux yeux d'or de 2 × 2 (comme tous les
PNJ du jeu), écharpe verte, sacoche de cuir à rabat et boucle de laiton pendue
à la hanche par une bandoulière qui barre la poitrine, bâton à pommeau d'ambre.

**Un seul message**, celui du bas — le bandeau plein écran gênait la vue en
pleine partie pour dire la même chose.

**Elle se fait désirer** : `COLPORTEUSE_ATTENTE` = 10 800 images (~3 min) avant
la première tournée, puis `colporteuseDelai()` = 18 000 à 28 800 images, soit
**5 à 8 minutes** entre deux passages.

**Ses prix montent à chaque vente conclue chez elle** : `Q.achatsColporteuse`
compte les achats, `prixItinerant()` majore de 40 % du tarif de départ par
achat, arrondi à cinq rubis. Le compteur est **dans `Q`**, donc sauvegardé —
hors de `Q`, il aurait suffi de recharger pour retrouver les tarifs du premier
jour. Et elle le dit (« LE RESTE MONTE, TU T'EN DOUTES ») : sans cela, la ligne
suivante coûte plus cher sans raison apparente, et ça passe pour un défaut.

### Le contrôle ne pouvait pas chercher les couleurs des sprites

Premier jet du contrôle visuel : compter à l'écran les pixels exactement égaux
à `#B8384A` (le rouge de l'auvent). **Zéro**, alors que le kiosque était bel et
bien dessiné. Le rendu passe par une teinte d'ambiance : `#B8384A` arrive à
l'écran en **(143, 48, 66)**.

Compter les pixels « qui changent » ne marchait pas davantage : la lueur chaude
qui l'entoure barbouille déjà un carré de **66 × 66 px**, bien plus large que le
kiosque.

Le contrôle rend donc la scène **sans elle puis avec elle** sur un terrain
aplani, écarte les écarts faibles (< 60 sur la somme RVB, c'est la lueur), et
**classe par teinte** ce qui reste — ce que l'ambiance ne renverse pas. Deux
mesures visent en plus des **boîtes en pixels d'écran** autour de sa tête et de
ses yeux : un total global serait resté vert alors qu'elle était noyée dans son
propre décor.

Mesures obtenues : empreinte **44 × 52 px** (contre 22 × 30 pour elle seule),
264 px de rouge d'auvent, 487 px de bois, 118 px de capuche au-dessus du
comptoir, 8 px d'or dans les yeux.

### Vérification

Neuf nouveaux contrôles dans `10-colporteuse.js`, tous sur le vrai jeu, avec
contrôle à blanc (deux rendus identiques ne diffèrent d'aucun pixel).

Réinjection, une par une, de **sept** régressions : chacune rougit **ses**
contrôles et eux seuls, avec le bon chiffre —

- kiosque retiré du rendu → `34 x 39 px`, `0 px de rouge`, `81 px de bois` ;
- fond dessiné **devant** elle → `0 px de cape`, `0 px d'or dans les yeux` ;
- étal remonté de 20 px → `21 px de cape`, `0 px d'or dans les yeux` ;
- `annonce()` remis → `2 messages` ;
- majoration annulée → `potion 40 -> 40` ;
- délai ramené à une minute → `70 s` ;
- compteur retiré de la sauvegarde → `{"achats":0,"potion":40,"attendu":90}`.

Suite complète : **523 contrôles verts**.

### À ne pas réintroduire

- **Un décor qui entoure un personnage se dessine en deux pièces**, pas en une.
  Le fond avant lui, l'avant-plan après : sans quoi il est *collé* à son décor
  au lieu d'être dedans.
- **Ne jamais chercher la couleur d'un sprite dans les pixels de l'écran.** Le
  rendu passe par une teinte d'ambiance. Classer par teinte, jamais par égalité.
- **Un total global ne dit pas si un personnage est visible.** Il faut viser la
  boîte en pixels d'écran où sa tête et ses yeux doivent apparaître — sinon le
  contrôle reste vert alors que le décor l'a avalé.
- **Un décor et le personnage devant lui ne doivent pas partager leur teinte.**
  Cape violette sur toile violette : la silhouette s'efface.
- **Un compteur qui doit survivre au rechargement vit dans `Q`.** Ailleurs, il
  repart à zéro à la lecture de la sauvegarde, sans que rien ne le signale.
- **Un prix qui change sans être annoncé passe pour un bug.** Le dire.
- **Un événement, un message.** Un bandeau *et* une boîte de dialogue pour la
  même chose, c'est deux fois trop.

---

## 25. La carte : tout se ressemblait, et tout clignotait pareil

**Demande du joueur** : « améliore les couleurs sur la mini-carte et varie les
clignotements pour mieux différencier les choses. »

### Ce qu'on a mesuré d'abord

Deux mesures, sur la vraie carte du vrai jeu.

**Les couleurs**, en écart perceptif ΔE\*ab entre les teintes qui se côtoient
dans une même région (sous 10, deux teintes ne se séparent plus sur un pixel) :

```
  mur #767b8b × roche des Cimes #6a7183 ....... ΔE 4,3   (12,8 % × 18,5 %)
  néant #0b0713 × vide #0a0d1c ................ ΔE 4,8
  eau profonde #164a9e × eau #24509c .......... ΔE 6,0   (44,5 % × 3,9 %)
  mur #767b8b × dalle #8c90a4 ................. ΔE 8,6   (dans les HUIT régions)
  caisse #8a6238 × bloc lourd #8a6030 ......... ΔE 2,0
  marais × cité des nues, en vignette ......... ΔE 14,0
```

Le mur, à lui seul, couvrait **de 10 à 18 % de chaque région** en un gris qui se
fondait dans la roche, la dalle et la cendre. La carte ne disait plus l'essentiel :
où l'on peut marcher.

**Les clignotements** : dix-huit repères, **un seul motif** — le carré à 50 % —
décliné en périodes 20, 30, 36 et 40. Quatre vitesses trop voisines pour se
départager d'un coup d'œil — deux d'entre elles indiscernables deux à deux
(30 ≈ 36, 36 ≈ 40) : un coffre, une luciole et un sceau battaient de la même
façon.

### La cause réelle

Ni la palette ni les rythmes n'avaient été *conçus* : ils s'étaient accumulés,
teinte par teinte et `tick%36<18` par `tick%36<18`, à mesure que les huit
mondes arrivaient. Une chaîne de trente ternaires et vingt appels à `rep2`, où
personne ne pouvait voir l'ensemble — donc personne ne pouvait voir les
collisions.

### Les correctifs

- **Deux tables indexées** (`COUL_SOL`, `COUL_OBJ`) remplacent la chaîne de
  ternaires : l'ensemble tient sous les yeux, donc il se mesure.
- **Trois familles, trois langages** : *ardoise sombre* = ça ferme le passage,
  *ambre* = ça s'ouvre (porte, grille, portail), *teinte vive* = ça s'active ou
  se ramasse. L'ardoise est posée à partir de `DUR_O`/`FRANCH_O` et non d'une
  liste à la main : un obstacle ajouté demain apparaîtra sur la carte sans
  qu'on y pense.
- **Chaque région repeinte** pour se reconnaître en vignette, et **chaque
  collision corrigée** — basalte, néant, colonne d'air, bloc de glace, caisse
  contre bloc lourd, corail-obstacle contre sol de corail.
- **Sept rythmes de clignotement** qui diffèrent par la **forme**, pas
  seulement par la vitesse : `fixe` (l'ami), `cœur` deux battements puis
  souffle (toi), `alarme` trois éclats nerveux (le chef), `pressé` le plus
  rapide (la colporteuse, elle s'en va), `trésor` lent et égal (les coffres),
  `phare` un éclat rare (la pièce unique), `braise` presque toujours allumé (ce
  qui se ramasse en série).
- **La légende bat le rythme de ses repères** : la pastille de « LUCIOLE »
  clignote exactement comme les lucioles sur la carte. On l'apprend sans la
  lire. Une entrée « COLPORTEUSE » apparaît quand elle est de passage.

```
                                   avant          après
  pire écart dans une région      ΔE  4,3        ΔE 15,2
  paires sous ΔE 10 (≥ 0,2 %)          4              0
  régions les plus proches        ΔE 14,0        ΔE 18,2
  motifs de clignotement               4              6
  rythmes indiscernables               2              0
```

### Vérification

Cinq contrôles dans `12-carte.js`, tous sur le vrai jeu : l'écart minimal dans
une région, l'écart entre les huit vignettes, **ce qui barre le passage contre
le sol qu'il touche**, le nombre de rythmes distincts, et leur séparation deux
à deux (période d'un quart, ou taux d'allumage de 15 points, ou nombre de
fronts). Le pied de page est en outre mesuré **avec** la colporteuse en
légende, à cinq tailles d'écran.

Réinjection, un bug à la fois : l'ancienne palette rougit les deux contrôles de
couleur avec le bon chiffre (`CIMES GELÉES : #767b8b (13,2 %) × #6a7183
(18,5 %) — ΔE 4,3`) ; le marais repeint aux couleurs de la vallée rougit le
contrôle des vignettes (`ΔE 4,6`) ; les trois carrés à 50 % d'autrefois
rougissent les deux contrôles de rythme (`30/50%/2f ≈ 36/50%/2f`).

**Contrôle à blanc** : la roche peinte *exactement* de la teinte du mur. Le
relevé par histogramme reste **vert** — deux choses peintes pareil ne font plus
qu'une seule teinte, la collision disparaît du compte. C'est ce qui a justifié
le contrôle « ce qui barre le passage », qui repart de l'**état du jeu** et va
lire la couleur dessinée : il rougit, lui, à `ΔE 0,0`.

### À ne pas réintroduire

- **Une palette ne s'écrit pas en chaîne de ternaires.** Trente branches, c'est
  trente teintes que personne ne compare jamais. En table indexée, elles se
  mesurent.
- **Un histogramme de couleurs a un angle mort** : ce qui est peint à
  l'identique n'y figure qu'une fois. Pour vraiment vérifier que deux choses
  se distinguent, partir de l'**état du jeu**, pas des pixels seuls.
- **Varier la vitesse ne suffit pas à varier un clignotement.** À deux pixels,
  30 pas et 36 pas se ressemblent comme deux gouttes d'eau. C'est la forme —
  double battement, éclat rare, presque toujours allumé — qui se reconnaît.
- **La légende doit MONTRER le repère, pas le décrire.** Une pastille fixe
  n'apprend pas à reconnaître un clignotement.
- **Le sens d'abord, la couleur locale ensuite** : ce qui ferme le passage doit
  se voir comme tel dans les huit régions, sinon la carte n'est qu'une jolie
  image.

---

## 26. Cinq objets montraient le dessin d'un autre

### Le symptôme, et la vraie cause

Dans les deux boutiques et dans la boîte d'objet, plusieurs articles portaient
la vignette de leur voisin :

| objet | ce qu'il montrait |
|---|---|
| ARC | une **flèche** |
| CARQUOIS DE CUIR | une **flèche** |
| GRAND SAC | une **bombe** |
| BOUCLIER RENFORCÉ | un **cœur** |
| COEUR SUPPLÉMENTAIRE | le cœur qu'on **ramasse par terre** |

La cause est banale et c'est ce qui la rend coûteuse : `spr:'fleche'` est du
code parfaitement valide. Rien ne prévient — ni erreur, ni avertissement.
Chaque icône avait été posée en attendant, et personne n'y est revenu.

### Le correctif

Cinq dessins neufs : `arcItem` (le bois et la corde, sans flèche encochée —
c'est justement ce qu'il fallait cesser de montrer), `carquoisItem` (deux
hampes empennées qui dépassent d'un étui de cuir sanglé), `sacItem` (une
besace dont sort une bombe mèche allumée), `bouclierItem` (l'écu d'or et sa
croix, dans la palette du bouclier renforcé que porte le héros) et
`coeurMaxItem` (le même cœur, mais **serti d'or** : un réceptacle, pas un soin).

### Le contrôle ne compare pas les noms

Comparer `spr` d'un objet à `spr` d'un autre resterait vert le jour où deux
noms distincts porteraient le même dessin. `27-icones.js` compare donc les
**images rendues**, normalisées au centre d'une case commune — c'est ce que
le joueur voit qui compte.

Il a fallu **deux** filets, et la réinjection l'a montré :

1. *Doublon dans la liste.* Attrape ARC = 10 FLÈCHES, CARQUOIS = 10 FLÈCHES,
   GRAND SAC = BOMBE. Deux entrées qui désignent **la même chose** (les bombes
   de Bran et la bombe du sac, la potion vendue dans les deux boutiques) sont
   nommées une fois pour toutes, pour que toute autre coïncidence reste une faute.
2. *Emprunt à ce qui n'est pas un objet.* Le premier filet ne voyait **pas**
   `BOUCLIER RENFORCÉ → coeur` : le cœur ramassé au sol n'est dans aucune
   boutique, donc dans aucune liste. On nomme donc les dessins qui appartiennent
   à autre chose (`coeur`, `cle`, `eclat`, gemmes, personnages, coffre) et on
   interdit aux vignettes de pointer dessus. `fleche` et `bombeItem` n'y sont
   pas : ils servent légitimement de vignette **et** de butin — c'est le même objet.

S'y ajoutent deux garde-fous : aucune vignette sous douze pixels visibles, et
aucun rapport largeur/hauteur hors de [0,6 ; 1,7] — la boutique les dessine
dans un carré de 11 px et un sprite trop allongé s'y écrase.

### Vérification

Réinjection des cinq emprunts, un par un : chacun rougit, avec le nom de
l'objet et celui du dessin volé (`CARQUOIS DE CUIR = 10 FLÈCHES`,
`BOUCLIER RENFORCÉ montre « coeur »`). Contrôle à blanc dans les deux sens :
la comparaison sait dire « identiques » **et** « différents ».

### À ne pas réintroduire

- **Une icône posée « en attendant » ne se voit jamais dans le code.**
  `spr:'fleche'` compile, s'affiche, et ne se signale nulle part.
- **Comparer des noms de sprite ne prouve rien.** Comparer les images rendues.
- **Un doublon ne se voit que si les deux objets sont dans la liste comparée.**
  Il faut aussi nommer les dessins qui appartiennent à autre chose.

---

## 27. La colporteuse tient parfois une pièce rare

### Ce qui manquait

Son ballot ne contenait que des capacités attendues — carquois, sac, cœur,
potion — toujours les mêmes, dans le même ordre. Rien ne récompensait le fait
de la guetter : la trouver ou la manquer revenait au même.

### Ce qui a été ajouté

Trois pièces, une par axe de jeu, qu'aucune autre boutique ni aucun coffre ne
donne. Elle n'en sort **qu'une à la fois**, et **une fois sur trois** environ,
tirée parmi celles qu'on n'a pas encore :

| pièce | prix | effet |
|---|---|---|
| AMULETTE DE GARDE | 220 | encaisse la moitié des dégâts (jamais jusqu'à zéro) |
| FIOLE DE FÉE | 260 | relève une fois au lieu de laisser mourir, puis se consomme |
| RUNE DE TRANCHANT | 300 | +1 dégât à chaque coup d'épée, coup tournoyant compris |

Le tirage se refait à **chaque fois qu'elle s'installe**, et la pièce n'est pas
sauvegardée — pas plus qu'elle. Sans cela il aurait suffi de recharger en
boucle jusqu'à tomber sur la bonne. Les trois drapeaux, eux, vivent dans `Q` :
ce sont les achats qui restent acquis.

Le message d'arrivée change de fin (« ELLE TIENT UNE PIÈCE RARE. ») — toujours
**un seul** message. Dans l'étal, la pièce passe en tête, porte un liseré d'or
clignotant et son nom en doré. À l'achat : fanfare, secousse, bandeau, et une
phrase qui dit ce que la pièce **fait** — sinon rien à l'écran ne l'expliquerait.

### Le panneau de boutique était taillé pour quatre lignes

La cinquième ligne — la pièce rare — passait **par-dessus** le compte de rubis
et « B ACHAT  X SORTIE » : `panneau(X,bx,by,bw,104)` était écrit en dur. La
hauteur suit désormais la liste (`36 + n*17`, ce qui redonne exactement 104 à
quatre lignes), et le pied de page se cale sur le bas du cadre.

Le contrôle n'inspecte pas la formule : il **intercepte** `texte` et `panneau`
pendant un vrai rendu, relève les rectangles réellement écrits, et exige que
rien ne déborde du cadre ni ne recouvre autre chose. Réinjecté à hauteur fixe,
il rougit en nommant les collisions :
`« POTION ROUGE » sur « B ACHAT  X SORTIE »`.

### Les effets sont mesurés, pas supposés

Un drapeau posé dans `Q` ne prouve rien tant que le jeu ne s'en sert pas. Les
trois passent par le vrai jeu : `blesser()` pour l'amulette (4 → 2 points
perdus) et pour la fiole (le héros est debout, pv au maximum, drapeau
consommé, et la fois suivante il meurt), la boucle du héros pour la rune
(`J.atk=13` ne laisse passer qu'une frappe, `frapper` refusant tant que
`e.flash` n'est pas retombé : 1 → 2 points de dégât).

Le tirage lui-même est mesuré sur **600 passages** : entre 20 % et 50 % en
sortent une, les trois peuvent sortir, aucune déjà acquise ne ressort, et les
trois acquises elle n'a plus rien de rare.

### Vérification

Vingt-et-un nouveaux contrôles dans `10-colporteuse.js`. Réinjection de onze
régressions, une par une — chacune rougit **les siennes** avec le bon chiffre :
rare à tous les coups (`100 % des passages`), jamais de rare (`0 %`), pièce
acquise qui ressort, amulette sans effet (`4 -> 4`), amulette jusqu'à zéro,
fiole sans effet, fiole jamais consommée, rune sans effet (`1 -> 1`), pièce
laissée grisée à l'étal, pièce absente de l'étal, pièce sauvegardée
(`rare=rune`), marque d'or retirée (`0 pixels la distinguent`), panneau à
hauteur fixe. Suite complète : **556 contrôles verts**.

### À ne pas réintroduire

- **Un objet rare tiré au sort ne se sauvegarde pas.** Sinon on recharge en
  boucle jusqu'à tomber sur celui qu'on veut, et le hasard ne veut plus rien dire.
- **Un panneau taillé en dur pour N lignes casse à N+1.** Faire suivre la
  hauteur à la liste, et mesurer les rectangles réellement écrits.
- **Un drapeau dans `Q` n'est pas un effet.** Le contrôle doit passer par
  `blesser()` et par la boucle du héros, jamais par sa propre arithmétique.
- **Un objet dont l'effet est invisible doit se raconter à l'achat.** Une
  amulette qui n'annonce rien ne se distingue pas d'un achat raté.
- **Le journal ne défile pas** : sur un écran court, la section ÉQUIPEMENT —
  et donc la ligne des pièces rares — est déjà tronquée. Défaut préexistant,
  non corrigé ici.

---

## 28. Dans l'eau on marchait, et les monstres voyaient à travers la pierre

Quatre règles, toutes sur ce que l'on voit et sur ce que les créatures voient.

### 1. On traversait l'eau debout

Les palmes trouvées, l'eau devenait franchissable — et le héros la traversait
**entier**, bottes comprises, comme on traverse une prairie. Rien ne disait
qu'on nageait.

Il s'enfonce désormais de **neuf pixels** et tout ce qui passe sous la ligne
d'eau est coupé net. Deux bras brassent à la surface, en opposition, et l'écume
file derrière lui.

Le chiffre a été **mesuré, pas deviné** : à quinze pixels d'enfoncement la tête
passait sous la surface et il ne restait qu'un bout de bonnet vert à l'écran.
Neuf place la ligne d'eau sous le menton — le visage sort, les épaules affleurent.

On ne redessine PAS un corps immergé pour chacune des vingt poses : ce sont les
sprites existants, enfoncés et découpés. L'épée, elle, est dessinée *dans* le
sprite d'attaque — elle sort donc bien de l'eau. Bouclier et outil au poing
disparaissent : on a les mains prises.

### 2. Un mur ne cachait rien

Les créatures suivaient le héros à travers la pierre. Elles savent maintenant
qu'un obstacle coupe le regard s'il est **dur** et **assez haut pour masquer**
— exactement comme il arrête une flèche. Mêmes tables (`DUR_O`, `HAUT_O`, le
relief), même modèle : ce qu'une flèche ne traverse pas, un regard ne le
traverse pas non plus.

Le spectre et l'ombre font exception : ils traversent les murs, il serait
absurde qu'un mur les aveugle.

La ligne de vue coûte une douzaine de lectures de tuile ; elle est refaite **une
image sur six**. Et une créature **en plein bond** garde sa cible : sans cela
elle restait figée en l'air, ce qui se voit.

Les projectiles, eux, mouraient **déjà** sur les murs (`majDivers`, le test
d'entrée de boucle). Vérifié plutôt que supposé : un caillou lancé droit sur le
héros à travers un mur ne lui coûte rien, alors qu'à découvert il coûte un point.

### 3. Près d'un personnage, on est à couvert

Un halo de 54 px autour de chaque personnage : tant qu'on s'y tient, les
créatures ne voient plus le héros du tout. C'est un refuge portatif, cousin des
zones de paix déjà posées sur le village et la grève.

Le cercle est **tracé au sol**, et il s'éclaire quand on entre dedans — sans lui,
rien à l'écran ne dirait que la zone existe. Il est dessiné **après** toutes les
rangées : tracé dans la rangée du personnage, le terrain des rangées suivantes
en aurait effacé la moitié basse.

### 4. Un panneau se lisait sous le nez d'un monstre

La boîte de dialogue fige le héros. Un panneau planté près d'une créature
devenait donc un piège : on lisait, et on prenait des coups sans pouvoir rien
faire. À moins de 86 px d'un monstre, le panneau ne s'ouvre plus et le jeu dit
pourquoi. Les personnages, eux, restent accessibles — leur halo a déjà chassé
ce qui rôdait.

### Le contrôle mesurait le refuge, pas la vue

Premier jet du contrôle : poser une créature à sept tuiles et compter de combien
elle se rapproche. Elle **s'éloignait de 106 px**. Le village est un
`refuge` : les créatures en sont repoussées et les projectiles ennemis y
meurent. La mesure ne parlait pas de la vue du tout. `refuges.length = 0` dans
le terrain d'essai, et le chiffre est redevenu lisible.

Pour le nageur, `dessinerJoueur` est appelé **pour de vrai** dans un carré à
part, recentré sur le héros : c'est le dessin du jeu qu'on mesure, pas une
reconstitution. Corps et écume sont distingués **par leur couleur** (le carré
est hors du monde, sans teinte d'ambiance, donc les teintes y sont exactes) — un
simple compte de pixels sous la ligne d'eau serait resté vert avec de l'écume
seule. Et les bras sont relevés **par leur position**, pas par leur nombre : deux
bras figés donnent le même compte à chaque image, et c'est précisément la
régression qu'un premier contrôle avait laissée passer.

### Vérification

Vingt-deux contrôles dans `29-nage-et-vue.js`. Réinjection de onze régressions,
une par une, chacune rougissant **les siennes** :

- nageur non dessiné → `35 px -> 35 px` ;
- enfoncement supprimé → `35 px -> 32 px` ;
- coupe à la ligne d'eau supprimée → `291 px de corps sous la ligne` ;
- bras supprimés → `0 pixels de bras` ;
- bras figés → `bras figés (13 px, position 25755)` ;
- écume supprimée → `0 px d'écume` ;
- abri du personnage annulé → `elle a encore gagné 97 px` ;
- vue toujours libre → `elle a encore gagné 33 px` ;
- obstacles ignorés dans le tracé → `elle voit à travers` ;
- lecture autorisée en combat → `{"pris":true,"ouvert":true}` ;
- mur ignoré par les projectiles → `pv=19`.

Plus un **témoin** : une modification qui ne change rien laisse tout vert.

### À ne pas réintroduire

- **Un terrain d'essai posé dans le village mesure le refuge, pas la règle.**
  Vider `refuges` avant toute mesure de poursuite ou de projectile.
- **Ne pas couper la poursuite d'une créature en plein bond** : elle resterait
  figée en l'air. On attend qu'elle retombe.
- **Compter des pixels sous une ligne d'eau ne dit pas ce qui reste** : il faut
  séparer le corps de l'écume par la couleur.
- **Compter des pixels de bras ne dit pas qu'ils bougent** : relever leur
  position.
- **Un dialogue fige le héros.** Tout ce qui ouvre une boîte de texte doit se
  demander si quelque chose peut frapper pendant ce temps.

---

## 29. Neuf butins de quête étaient dessinés en FLÈCHE, par terre

### Le symptôme, et ce qu'on a mesuré

Le boomerang qui dort au fond du Temple de Givre — le trésor de tout un monde —
est posé au sol comme un objet à ramasser. À l'écran, c'était **une flèche**.

Le choix du sprite d'un butin posé n'était pas une table mais une suite de
`?:` traitant cinq cas, avec un fourre-tout final :

```js
const nom = VALEUR_GEMME[o.type] ? … : o.type==='eclat' ? 'eclat' : 'fleche';
```

Tout ce qui n'était pas une gemme, un cœur, une bombe, un champignon, la clé ou
un éclat retombait donc sur `'fleche'`. Relevé depuis le jeu, la liste des
laissés-pour-compte : **boomerang, palmes, grappin, bracelet, fanal, cape,
fragments de fresque, perles du Lagon, et TOUS les cœurs de cristal** — neuf
types, dont six avaient pourtant déjà leur icône cuite (`boomerangItem`,
`grappinItem`, `braceletItem`, `fanalItem`, `capeItem`, `coeurMaxItem`).

C'est exactement le défaut du § 26 (« Cinq objets montraient le dessin d'un
autre »), mais **au sol** au lieu de la boîte d'objet — corrigé d'un côté,
laissé intact de l'autre.

### Le correctif

Une **table** (`SPR_BUTIN`), et trois icônes qui manquaient encore
(`palmesItem`, `perleItem`, `fresqueItem`). Une table se relit : ajouter un
butin sans son icône se voit du premier coup d'œil, là où une chaîne de `?:`
absorbait le nouveau venu en silence.

`LUEUR_BUTIN` dit à part ce qui s'auréole — la clé, les outils, les cœurs.

### Le contrôle

`28-cimes-enrichies.js` rejoue le calcul de sprite de la boucle de rendu pour
**tous** les types que le jeu sait poser, et exige qu'aucun ne retombe sur
`'fleche'` ni ne vise un sprite absent. Réinjection : `boomerang:` retiré de la
table → **rouge**.

---

## 30. La troisième région était la plus VASTE du jeu, et la plus vide

### Ce qu'on a mesuré

En créatures pour mille cases praticables, région par région :

| région | cases | créatures | densité |
|---|---|---|---|
| vallée | 4 357 | 56 | **12,9** |
| Cendres | 3 756 | 44 | 11,7 |
| **Cimes Gelées** | **5 954** | **37** | **6,2** |
| Lagon | 2 606 | 32 | 12,3 |
| Sables | 5 039 | 33 | 6,6 |
| Marais | 5 230 | 22 | **4,2** |
| Nues | 1 996 | 36 | 18,0 |
| Faille | 2 938 | 24 | 8,2 |

Les Cimes : **le plus grand terrain du jeu, la moitié moins peuplé que le
premier pré**. Et rien d'autre à y faire — **0 personnage** à qui parler,
**0 coffre**, **1 seul butin** (le boomerang), contre 1 PNJ et 6 butins au
Lagon comme aux Sables. Sa seule quête annexe comptait trois cloches, quand le
Marais en demandait sept et les Nues huit.

Pire : le bilan de fin exigeait `Q.cloches>=5` alors que `sonnerCloche`
plafonne à **trois**. La condition ne pouvait jamais être vraie — les Cimes
étaient la seule région dont la quête annexe ne comptait pas dans le bilan.
Le contrôle de fin, lui, se donnait `cloches: 5` : **faux des deux côtés à la
fois**, donc vert.

### Les correctifs

- **La glace glisse.** Elle couvre un sixième du sol de la région et se
  traversait comme une prairie. Le pouce ne fixe plus la vitesse, il la
  *pousse* (`J.gx`, `J.gy`, retour lent) : on dérape, on rate son virage. Le
  sol ferme est inchangé au pixel près — `J.gx` y vaut l'ancienne valeur.
- **Le Refuge du Col**, une cabane de rondins, zone de paix, et **Borve le
  guide** : la région a enfin un visage. Manteau rouge brique — la robe verte
  du pêcheur, essayée d'abord, disparaissait dans la neige et se confondait
  avec la tunique de Kaze.
- **Les six fleurs de givre**, sa quête annexe, du même calibre que les perles
  du naufragé et les fresques de Nefa.
- **La Crevasse**, son énigme (voir plus bas), et son cœur de cristal.
- **64 créatures au lieu de 34** : densité 6,2 → 11,4.

### La Crevasse : une énigme qui ne se terminait pas

Premier jet : une crevasse en travers de la salle, l'interrupteur emmuré de
glaçons sur l'autre rive, le trésor derrière une barrière bleue. Le contrôle
passait au vert.

**La réinjection l'a démasqué.** En comblant la crevasse, le contrôle « le
cristal est hors d'atteinte à pied » **restait vert** : les glaçons suffisaient
à eux seuls, la crevasse ne prouvait rien. Et en poussant la vérification
jusqu'au bout — *le cœur est-il ATTEIGNABLE ?* — la réponse était **non** :
rien ne permettait de traverser. Le cœur de cristal était posé là pour
personne.

La salle a donc été refaite : **ancre de grappin sur la rive lointaine**, et
**une seconde pour revenir** (la leçon du § 22, la douve qui scellait le héros
sur l'autre bord). On passe au grappin, on brise la glace au boomerang, on
bascule le cristal, la barrière tombe. Deux outils, deux mondes.

### Ce que le contrôle a appris à faire

- **Interroger la collision DU JEU** (`solide`), pas une table. Les blocs à
  bascule ne sont pas durs dans `DUR_O` : leur solidité se décide à la volée
  selon l'interrupteur. Le premier parcours réimplémentait la règle et
  traversait donc allègrement la barrière bleue.
- **Piloter le vrai grappin** : on ne vérifie pas que l'ancre existe, on lance
  le grappin et l'on regarde **où le héros atterrit**, à l'aller et au retour.
- **Mesurer depuis le bon endroit** : « le trésor est enfermé » était vrai
  depuis l'entrée à cause de la seule crevasse, et restait vert la barrière
  retirée. C'est **depuis la rive lointaine** qu'il fallait regarder.

---

## 31. Le cabinet des huit, et le filet à papillons

Une quête qui traverse les **huit tableaux** : un papillon par région, et un
filet pour les prendre. Orla la naturaliste le donne au village, dès le début —
placée dans une région tardive, elle aurait obligé à refaire le monde à
l'envers.

**Le filet est un outil, pas un jeton.** Il cueille les papillons, et il
**renvoie au vol ce qu'on lui jette** : un javelot de lancier, un éclat de
harpie, une boule de venin repartent vers celui qui les a lancés et le
frappent. Sans ce second usage, il n'aurait servi qu'une fois par région.

**Le papillon fuit.** Il volette autour de son perchoir et s'écarte dès qu'on
approche — sans quoi on l'aurait cueilli du bout de l'épée comme le reste, et
le filet n'aurait servi à rien. Les **trois** chemins de ramassage (le pas, le
coup d'épée, le boomerang) l'excluent nommément.

**`papillonsPris` est un tableau de huit, pas un compteur.** Un compteur aurait
laissé repousser dans la vallée celui de la Faille.

### Le perchoir : mesuré, puis corrigé

On ne fige pas la case d'un papillon — le terrain de chaque région est tiré au
sort. On donne un **point d'ancre**, et l'on cherche autour la première case
libre, en carrés concentriques.

Le contrôle a rougi du premier coup : le papillon de la Cité des Nues s'était
posé sur un **îlot de 5 cases** perdu au-dessus du vide. `perchoirLibre` exige
désormais une poche d'au moins 240 cases (remplissage avec arrêt anticipé).

---

## 32. Le journal n'affichait qu'un tiers de ce qu'il écrivait

### Ce qu'on a mesuré

Le journal ne défilait pas : il écrivait jusqu'en bas de l'écran, puis
`break`. Sur un canevas de téléphone (200 × 280), une partie avancée produit
**69 lignes dont 21 tenaient** : **48 perdues, en silence**. Tout le bas —
l'équipement, les pièces rares de la colporteuse — n'a jamais été lisible.

### Les correctifs

Le journal **défile** (haut/bas, L/R par pages), avec une barre qui dit qu'il
reste à lire, et un défilement **borné** — sans borne on défilait dans le vide
et l'on croyait le journal terminé. Titre et pied sont écrits par-dessus deux
bandeaux opaques : le texte passe dessous au lieu de les chevaucher.

Et il dit enfin **tout** : le cabinet des huit avec la liste des pays faits
(`★ ★ ★ 4 ★ 6 7 8` — un compteur seul laisse chercher les manquants dans tout
le monde), les fleurs de Borve, la Crevasse, les **sept cœurs de cristal des
énigmes** (rien ne disait, une fois la salle quittée, si on les avait pris),
les outils un par un — la liste en affichait deux fois « BRACELET - FANAL » et
taisait le filet.

### La police a encore remplacé en silence

`SELECT = RETOUR` s'est affiché **`SELECT ? RETOUR`** : la police n'a pas de
signe égal (§ 12).

Le balayage de `13-police.js` ne l'a pas vu, et la raison est instructive : son
tamis exigeait que la chaîne ne contienne **que** des caractères d'une liste
permise. Une chaîne portant un signe inconnu échouait au test et se trouvait
donc **écartée** — alors que ce signe inconnu était exactement ce qu'on
cherchait. **Le filtre protégeait le bug.**

Il retient maintenant tout ce qui *ressemble* à du texte de jeu (des capitales,
aucune minuscule, aucune syntaxe de code), puis inspecte chaque caractère. Au
premier essai il a trouvé **deux tirets cadratins** de plus, dont un vieux de
plusieurs versions (« LES QUATRE RÉGIONS SONT LIBÉRÉES — LA PERLE… »).

Les pieds de page sont sortis de la fonction de dessin (`PIEDS_JOURNAL`) pour
que le balayage puisse les relire.

---

## 33. Les régions TARDIVES étaient les plus désertes

Le jeu devenait plus facile à mesure qu'on avançait, et c'est mesurable :
Marais 4,2 · Nues… mais surtout, **un loup des Cimes, un djinn des Sables et un
écho de la Faille enlevaient tous UN cœur**, exactement comme le premier gluant
du premier pré — alors qu'entre-temps le héros a gagné jusqu'à quatorze cœurs,
une épée double et un bouclier renforcé. La courbe montait d'un côté et pas de
l'autre.

- **Le sud frappe plus fort** : +1 à partir des Sables, +2 dans les Nues et la
  Faille. Bouclier, bouclier renforcé et amulette amortissent toujours tout —
  qui se défend ne subit pas la montée.
- **L'invincibilité après un coup passe de 76 à 60 images** (1,27 s → 1,0 s) :
  encore le temps de se dégager, plus celui de traverser un groupe entier à
  l'aveugle. Mesuré, planté au milieu d'un groupe : 3,4 s → 2,7 s.
- **Les quatre régions creuses** (Cimes, Sables, Marais, Faille) reviennent
  autour de 11 pour mille. Sans coût par image : au-delà de 210 px, une
  créature est déjà sautée.

### La faune du Marais courait dans deux autres mondes

Toutes les régions bornent leur tirage à leur propre frontière. Une seule ne le
faisait pas :

```js
y = Y_MARAIS + 4 + rnd()*(MH - Y_MARAIS - 9)     // 240 rangées au lieu de 80
```

Mesuré : **23 des 59 créatures du marais (39 %)** naissaient hors du marais —
follets, crapauds et ombres jusque dans la Cité des Nues et la Faille. Le
marais s'en trouvait dépeuplé et les deux derniers mondes brouillés. Après
correctif : **0**.

### À ne pas réintroduire

- **Une suite de `?:` avec un fourre-tout final absorbe les nouveaux venus en
  silence.** Table, et contrôle qui énumère.
- **Un contrôle qui dit « c'est inaccessible » ne dit pas « c'est jouable ».**
  Vérifier aussi qu'on peut atteindre la récompense, et **revenir**.
- **Deux bornes fausses à la fois font un contrôle vert** (`cloches>=5` d'un
  côté, `cloches: 5` de l'autre). Ne pas figer un total dans un contrôle : le
  comparer à lui-même.
- **Un tamis par liste permise protège précisément ce qu'il devrait attraper.**

---

## 34. Le nom du jeu était faux, et son sous-titre illisible

Le jeu s'appelait « Kaze & les Trois Étoiles ». Il compte huit mondes, huit
gardiens, et les trois étoiles ne sont plus qu'un fil parmi d'autres : c'est le
RONGEUR D'ÉTOILES qui les a dévorées, et c'est lui qu'on va chercher, huit
régions plus bas. Le jeu s'appelle donc **Kaze et le Rongeur d'Étoiles**.

Et le sous-titre ne s'était jamais affiché correctement : la police pixel n'a
pas d'esperluette, si bien que l'écran d'accueil annonçait, depuis toujours,
**« ? LES TROIS ÉTOILES »**.

### Le balayage de police protégeait le coupable

Le contrôle de police (§ 12, § 32) balaie les chaînes de la source et vérifie
chaque caractère. Il ne retenait que celles qui *ressemblaient* à du texte de
jeu — et son tamis excluait `&` comme « syntaxe de code ». Une chaîne portant
une esperluette n'était donc **même pas examinée**.

C'est la **deuxième fois** que ce piège se referme : au § 32, c'était une liste
de caractères *permis* qui écartait `=`. Ici, une liste de caractères *interdits*
qui écarte `&`. Une liste, dans les deux sens, finit par protéger exactement ce
qu'on cherche. `&` est retiré du tamis, et la réinjection du vieux sous-titre le
fait rougir sur-le-champ.

### L'écran d'accueil ne montrait rien du jeu

Une lune, un ciel étoilé, un sol qui défile. Il montre maintenant **le Rongeur
en entier** : il occupe la moitié haute du ciel quelle que soit la taille de
l'écran, ses yeux brillent, et les trois étoiles avalées battent dans son
ventre. Kaze fait douze pixels en contrebas — c'est l'échelle qui raconte.

Le titre est passé **sous** la bête : posé par-dessus, il lui couvrait
exactement la gueule et les trois étoiles, c'est-à-dire tout le sujet. Et
l'aide du bas, qui débordait des deux côtés sous 236 px de canevas (« EPEE  A
SAUT  Y OBJET  X BOUCLI »), a désormais une version courte.

---

## 35. On ramassait les trois étoiles dans le PREMIER monde

Le Rongeur les a dévorées : on ne pouvait pas les avoir dès la première heure.
Les trois coffres de la vallée donnaient pourtant « FRAGMENT D'ÉTOILE 1/3 », la
barre de vie affichait trois étoiles dès le départ, et le récit de la doyenne
disait « elles sont tombées » sans dire devant qui.

- Les trois coffres donnent maintenant les **PIERRES DE GARDE** : les socles
  que les étoiles occupaient, restés éteints. Elles ouvrent le portail du sud,
  exactement comme avant — seul le récit change, et il tient debout.
- La doyenne nomme la bête : « TROIS ÉTOILES GARDAIENT LA VALLÉE. UNE BÊTE LES
  A DÉVORÉES. ELLE A FUI PAR LE SUD. »
- La barre de vie, la carte, le journal et l'écran de sauvegarde disent
  « PIERRES », et montrent un socle de pierre, pas une étoile.

### Les vraies étoiles gisaient par terre sous la forme d'une flèche

Le Rongeur abattu lâchait déjà trois butins `etoileVolee`. Mais ce type
n'existait ni dans la table des sprites ni dans `ramasserButin` : **la
récompense de tout le jeu était dessinée en FLÈCHE, et marcher dessus ne
faisait rien.** C'est le dixième cas du défaut du § 29, et le plus cher.

Elles ont leur icône, elles **viennent au héros** toutes seules (l'épilogue
part 1,8 s après la chute : il fallait courir sur trois butins avant le fondu),
et `lancerEpilogue` garantit `Q.etoiles=3` — l'épilogue les montre s'élever, il
ne peut pas commencer en ayant perdu une en route.

---

## 36. Une caisse poussée dans un coin condamnait la partie

Une caisse ne se pousse que **devant soi**. Acculée contre un mur, il n'y a plus
moyen de se placer derrière : l'énigme était perdue **pour toujours**. Dans la
vallée, celle qui garde le GRAPPIN — donc aussi le trésor du gouffre, et la
Crevasse des Cimes. Rien ne le signalait, rien ne le rattrapait : il fallait
recommencer la partie.

Les caisses **reviennent à leur case de départ dès qu'on sort de la salle** sans
avoir résolu l'énigme : la convention du genre, et la seule qui ne demande rien
au joueur. On ne touche à rien tant qu'il est dedans — une caisse qui se replace
sous les yeux passerait pour un défaut. Une énigme déjà résolue ne rejoue rien.

---

## 37. Le cinquième monde : un boss inatteignable et trois trésors fantômes

### L'Arène du Colosse : zéro case atteignable

Mesuré depuis l'entrée du désert, avec la collision du jeu et tout
l'équipement : **0 case de l'arène accessible**. C'est voulu — un gué de trois
sables mouvants barre l'unique couloir, et il faut le combler au bracelet. Mais
rien ne le disait :

- le désert compte **646 mares de sables mouvants tirées au hasard**, dans
  lesquelles le gué de trois cases, lui *voulu*, se noyait complètement ;
- le couloir fait **une case de large** dans une région de 5 137 cases ;
- le panneau était planté **à côté** de l'entrée, pas devant.

L'entrée est désormais marquée : une allée de dalles de trois cases de large,
**deux obélisques**, deux torches, et un panneau qui se lit avant d'y entrer —
« LA PORTE DU COLOSSE ». Et la voie qui y mène est tracée par `voie()`, qui
écarte les sables mouvants : l'allée ne débouche plus sur du terrain tiré au
sort.

Le contrôle joue la solution **pour de vrai** — soulever un bloc, descendre, le
jeter dans le gué, trois fois — et exige qu'après cela l'arène s'ouvre.

### Trois « énigmes » du bilan de fin étaient impossibles

`Q.tresorSables`, `Q.tresorMarais` et `Q.tresorNues` étaient comptés dans
« ÉNIGMES x/8 » du bilan de fin. Aucun n'était posé nulle part, et aucune
position n'existait pour eux : **trois des huit étaient inatteignables**, et le
bilan ne pouvait jamais afficher le plein. C'est le journal refondu au § 32, qui
les liste une par une, qui a rendu le mensonge visible.

- **Les Sables** ont enfin leur salle d'énigme, **LA CITERNE ENSABLÉE** : un gué
  de deux rangées, quatre blocs lourds en réserve (deux de plus qu'il n'en
  faut : on ne peut pas s'y bloquer), le cœur de cristal sur l'autre rive. Elle
  est **sur le chemin de l'arène**, et exprès : elle apprend à combler un gué là
  où c'est sans risque, avant que la vanne l'exige sans plus rien expliquer.
- **Le Marais** : son cœur de cristal est cerné d'un rideau de ronces que seul
  le fanal brûle.
- **Les Nues** : le sien est sur l'îlot le plus à l'écart — on n'y arrive qu'en
  planant.

### Le cactus vivant

Le désert n'avait que trois créatures, toutes mobiles. Le **CACTUS VIVANT** est
planté : il ne poursuit pas, il ne recule pas. Il gonfle une seconde — le seul
avertissement, et c'est pour cela que son sprite suit le gonflement et non le
temps qui passe — puis lâche **huit épines en couronne**. On ne s'en tire donc
pas en tournant autour comme du lancier : il faut sortir de sa portée, ou
l'abattre avant la salve. Hors de portée, il ne tire pas : un cactus au loin
n'arrose pas le désert pour rien.

### À ne pas réintroduire

- **Un tamis qui écarte les chaînes « bizarres » écarte les bugs.** Deux fois :
  `=` par une liste de permis, `&` par une liste d'interdits.
- **Un couloir d'une case dans une région de cinq mille ne se trouve pas.**
  Ce qui est voulu doit se distinguer de ce qui est tiré au hasard.
- **Compter au bilan ce qui n'est posé nulle part.** Si un drapeau est compté,
  un contrôle doit vérifier qu'on peut réellement le lever.
- **Une mécanique qui ne pardonne pas doit se réarmer** : caisse dans un coin,
  bloc gâché, gué manqué.

---

## 38. Quatre culs-de-sac silencieux, tous dans le même désert

Une capture d'écran : Kaze dans un couloir d'une case, muré des deux côtés, trois
sables mouvants juste devant. « Je ne vois pas comment passer. » Puis : « Il n'y
a pas de bloc lourd. » Puis : « On ne voit pas le panneau à l'entrée non plus. »
Puis : « Reprendre la sauvegarde ne devrait pas repartir du village. » Quatre
défauts distincts, dont trois se conjuguaient pour rendre la partie **définitivement
bloquée**, sans rien pour le dire ni le défaire.

### Le sol n'était pas sauvegardé

`construireSauve()` conservait les différences du **décor** (`objs`) et rien
d'autre. Or le bloc lourd jeté dans le gué fait DEUX choses : il disparaît de la
carte (décor, conservé) et il change le sol en désert (sol, **non conservé**).

Mesuré, à la case près :

| | gué (3 cases) | réserve (4 blocs) |
|---|---|---|
| après avoir joué l'énigme | comblé, comblé, comblé | vide, vide, vide, vide |
| après rechargement | **SABLEMOU, SABLEMOU, SABLEMOU** | vide, vide, vide, vide |

Les blocs étaient dépensés, le gué rouvert : le couloir de l'Arène du Colosse
— son unique porte — restait muré pour toujours. Une sauvegarde automatique se
déclenche toutes les trois secondes ; il n'y avait aucun moyen de l'éviter.

Le sol est désormais sauvegardé comme le décor (`diffS`, en regard de `solRef`).

### Le bloc lourd se consomme, et rien ne le réarmait

Même en conservant le sol, quatre blocs **gâchés** (jetés à côté, éclatés contre
un obstacle) ferment le monde aussi sûrement. Le § 37 posait pourtant la règle —
« une mécanique qui ne pardonne pas doit se réarmer » — et ne l'appliquait qu'aux
caisses.

L'invariant est maintenant tenu pour les deux gués du désert (la vanne du Colosse
et la Citerne ensablée) : **tant qu'un gué n'est pas franchissable, sa réserve est
pleine**. Il se refait au chargement, et en cours de partie dès qu'on **sort** de
la zone — jamais sous les yeux du joueur, exactement comme les caisses. Un gué
déjà comblé, lui, ne fait repousser aucun bloc.

### Trente-trois panneaux sur trente-quatre étaient invisibles

`panneaux.push({x, y, txt})` ne pose **qu'une zone de lecture**. Un seul panneau
du jeu avait aussi un poteau : celui du village (`putO(27,44,O.PANNEAU)`). Les
trente-trois autres étaient des carrés de sol identiques à leurs voisins, sur
lesquels il fallait deviner qu'on avait quelque chose à lire — dont « LA PORTE DU
COLOSSE. UN BLOC LOURD JETÉ DANS LE SABLE MOUVANT LE COMBLE. », c'est-à-dire la
seule explication de l'énigme du cinquième monde. Le § 37 avait planté deux
obélisques et une allée de dalles pour qu'on trouve cette entrée, et l'écriteau
qui l'explique n'a jamais été visible.

`planterPanneaux()` plante un poteau sur chaque zone de lecture, et la zone suit
le poteau. Un poteau est **plein** : il ne doit couper aucun passage. La case
retenue est donc celle dont les voisines libres restent **reliées entre elles sans
passer par elle** (vérifié dans un voisinage de 5 × 5 : si l'on contourne
localement, retirer la case ne coupe rien globalement). À candidats également
valables on retient celui qui a le **moins** de voisines libres — le bas-côté :
un poteau au centre d'une entrée de région se prend dans les jambes.

Mesuré : 41 060 cases atteignables sans les poteaux, 41 027 avec, pour 33 poteaux
posés sur des cases atteignables. **La différence est exactement les poteaux
eux-mêmes** : aucun passage perdu.

Le panneau du Temple Englouti, lui, était planté **derrière le temple, en pleine
eau profonde** — aucun poteau ne peut s'y tenir et personne n'allait l'y lire. Il
est passé à l'intérieur, sur la dalle, à droite en entrant.

### On ressuscitait toujours à Val-des-Saules

`sauverPointDeReprise()` réécrivait la sauvegarde avec `d.J.x=35*TS+8;
d.J.y=45*TS+8` — le village de départ, **région 1 sur 8**, d'où que l'on soit
tombé. Et comme ce point de reprise **écrase** l'emplacement, « REPRENDRE »
repartait ensuite du village lui aussi, même après avoir quitté le jeu : mourir
dans la Faille coûtait la traversée de six mondes, à chaque fois.

On revient désormais à l'entrée de **sa propre** région — le défilé, le col, la
cascade, l'oued, le marécage, la tour, la déchirure (`REPRISE_POS`). Le décor
étant semé après le percement des entrées, la case visée peut avoir un saule
dessus : `caseDeReprise()` cherche la case **ferme** la plus proche dans la même
région — ni vide, ni eau, ni lave, ni sables mouvants. Ressusciter au-dessus du
gouffre des Nues serait pire que le village.

### Les fleurs de givre ne se voyaient pas

Six fleurs **blanches** posées sur la **neige** d'une région de 6 400 cases, sans
halo et **sans repère sur la carte**. La cause est structurelle : perles, fresques,
cloches, carillons, veilleuses, sceaux ont tous une table de positions
(`PERLES_POS`, `FRESQUES_POS`…) que l'écran de carte relit ; les fleurs et les
papillons, eux, sont posés à la volée par `perchoirLibre()` et n'existent que
dans `butins`. Ils étaient donc les **seuls** ramassages de quête sans repère —
mesuré : 6 fleurs posées, **0 repère**, contre 3 repères pour les 3 cloches.

La carte lit maintenant les butins eux-mêmes (ce qui a l'avantage de suivre le
papillon, qui volette), avec deux entrées de `REPS` choisies pour ne se confondre
avec aucun voisin de leur région — la cloche des Cimes bat en « braise » bleu
pâle, la fleur bat en « phare » lilas — et la légende les nomme dès que leur quête
est ouverte : un repère qu'on ne sait pas nommer ne renseigne personne.

Fleur de givre, perle et fragment de fresque s'auréolent en outre au sol, comme
les outils : chacun est peint de la couleur de son propre décor (blanc sur la
neige, nacre sous l'eau, terre cuite sur le sable).

### Vérification

`tests/31-gue-panneaux-reprise.js` (13 contrôles) et
`tests/32-reperes-de-quete.js` (5 contrôles). Le premier **joue la solution pour
de vrai** — soulever un bloc, descendre, le jeter, trois fois — puis sauvegarde,
recharge et exige que le gué soit encore comblé et l'arène ouverte.

Les six défauts ont été **réinjectés un par un** ; chacun fait rougir son
contrôle, et lui seul :

| réinjection | contrôle qui rougit |
|---|---|
| `diffS` retiré de la sauvegarde | le gué comblé SURVIT au rechargement |
| `planterPanneaux()` retiré | les trente-quatre panneaux ont un poteau *(33 sans poteau)* |
| `garantirReserves()` vidé | un gué non comblé retrouve ses quatre blocs |
| `majReserves()` court-circuité | la réserve se refait dès qu'on sort de la zone |
| reprise forcée au village | mourir dans le désert ne renvoie pas au village |
| repère des fleurs retiré | chaque fleur de givre a son repère *(0 pour 6)* |
| halo retiré | fleur, perle et fresque s'auréolent au sol |

### À ne pas réintroduire

- **Ce qui change à l'exécution doit être sauvegardé.** `objs` l'était, `sol` ne
  l'était pas : une seule ligne de jeu (`putS` dans `majBlocLourd`) suffisait à
  fermer un monde. Toute nouvelle écriture dans `sol` hors génération doit
  s'accompagner d'un contrôle de rechargement.
- **Une zone de lecture n'est pas un panneau.** `panneaux.push` ne dessine rien ;
  ce qui se lit doit se voir.
- **Un ramassage de quête sans repère ne se trouve pas** — surtout peint de la
  couleur de son décor. Le repère se lit dans la source de vérité (`butins`)
  quand il n'y a pas de table de positions.
- **Un point de reprise unique pour huit mondes** : le progrès de déplacement
  fait partie du progrès.

## 39. L'écran-titre se recouvrait lui-même

Une capture, et six mots : « c'est pas super beau et clair ». Sur la copie, le
panneau des emplacements de sauvegarde tombait **exactement** sur le logo
« KAZE » et sur le sous-titre, le résumé de la partie touchait les deux bords du
panneau, le numéro de version se lisait par-dessus la lune, et les étoiles du
ciel dessinaient des diagonales régulières.

### Ce qui se recouvrait, en px²

Le bloc-titre grandit avec la **largeur** (le logo suit `W` : `sc` va de 3 à 6),
le menu grandit avec le **nombre d'emplacements occupés** (20 px par emplacement
avec résumé, 14 sans), et tous deux étaient posés à partir du seul horizon, sans
jamais se connaître. Mesuré en détournant `texte`, `fillRect` et `drawImage` le
temps d'une image, puis en croisant les boîtes :

| fenêtre | interne | recouvrement titre × menu |
|---|---|---|
| 1512×760, 1 emplacement occupé | 620×240 | **4 696 px²** |
| 1512×760, 3 emplacements | 620×240 | **7 576 px²** |
| 1512×760, aucune partie | 620×240 | 744 px² |
| 900×400 (paysage), 3 emplacements | 620×180 | **11 792 px²** |
| 320×480, 3 emplacements | 306×266 | 959 px² |

L'écran du joueur — un portable, donc **large et bas** — est le pire cas
réaliste : 620×240 en interne, dont 110 px de ciel pour loger une bête, un titre
haut de 70 px, un menu de 72 px et deux lignes d'aide.

### La cause : deux mises en page qui s'ignorent, et un `clamp` inversé

```js
const yT = Math.round(hor*.60);                             // le titre
const yM = clamp(hor+Math.round((H-hor)*.22), hor+10, H-52-hMenu);   // le menu
```

Aucune des deux expressions ne connaît l'autre. Pire, la seconde se retourne :
`clamp(v, lo, hi)` vaut `Math.min(Math.max(v,lo),hi)`, donc **quand la borne
haute passe sous la borne basse, c'est la borne haute qui gagne**. Sur 620×240
avec un emplacement occupé, `H-52-hMenu` = 116 alors que `hor+10` = 120 : le
menu remontait au-dessus de son propre plancher, en silence, et allait se poser
sur le titre.

### Le correctif : empiler avant de dessiner

`ecranTitre()` calcule maintenant toute sa mise en page **en tête de fonction**,
de bas en haut — aide, menu, titre, bête — puis dessine. Ce qui manque de place
est pris au logo, puis à la bête, puis au héros ; jamais au recouvrement.

- Le menu est ancré au-dessus de l'aide, sa largeur suit **sa ligne la plus
  longue** (« PIERRES 3/3   LUCIOLES 8/8   209:00 » fait 209 px et le panneau
  était figé à 212 : le résumé ne débordait pas, il *touchait* les deux bords).
  Il est tracé par `panneau()`, cadre compris, au lieu d'un voile à 55 % — il se
  lit sur un sol qui défile en permanence.
- Le titre se pose juste au-dessus du menu, et recule de 42 px — l'emprise
  réelle du héros, ombre comprise — **si la bête garde malgré tout ses deux
  cinquièmes de ciel**. Entre le héros et la bête, la bête gagne.
- La bête prend tout le ciel resté libre au-dessus du titre, plafonnée à 62 % de
  sa hauteur. Sous 20 px elle ne raconte plus rien : elle s'efface plutôt que de
  passer sur le titre (cas du paysage 620×180).
- Le héros n'est dessiné que si la bande entre le sous-titre et le menu peut le
  contenir. Ailleurs il disparaissait **derrière** le panneau.
- L'aide tient sur **une seule ligne** dès que `W ≥ 460` : les deux lignes
  coûtaient 12 px de ciel à un écran qui n'en a que 110. Sur 620×240, la bête
  passe ainsi de 40 à 52 px sans que le logo rétrécisse.
- La lune passe dans le coin **droit** : à gauche elle croisait le numéro de
  version sur 80 px², et « V2.2 » devenait illisible.

### Le ciel : un treillis, pas des étoiles

Les 110 étoiles étaient posées en `(i*79)%W, (i*47)%(hor-14)`. Deux modulos de
pas constant : d'une étoile à la suivante, le déplacement est **toujours le même
vecteur**. Sur un écran large cela se lit comme des arcs et une rangée
horizontale nette en haut du ciel.

Premier remède, `hash(i,17)` — **pire que le mal**. `hash` multiplie sans
`Math.imul`, dépasse 2^53 et perd ses bits de poids faible ; pour de petites
entrées (i de 0 à 109) il ne rend que la moitié basse de sa plage. Mesuré, les
110 étoiles se tassaient dans le quart **haut-gauche** :

| répartition par quart | x | y |
|---|---|---|
| `(i*79)%W` / `(i*47)%(hor-14)` | 27/28/27/28 | 25/31/24/30 |
| `hash(i,17)` / `hash(i,29)` | **53/57/0/0** | **56/54/0/0** |
| mélange `Math.imul` | 23/31/27/29 | 25/34/26/25 |

Le mélange entier retenu est local à l'écran-titre : **on ne touche pas à
`hash()`**, qui ensemence le terrain des huit régions.

### Ce qui le vérifie

`tests/33-ecran-titre.js` relève ce qui est **réellement dessiné** pendant une
image d'écran-titre — `texte`, `fillRect`, `drawImage` et `arc` détournés — en
fait des boîtes, et mesure les aires d'intersection sur huit combinaisons de
taille d'écran et de remplissage d'emplacements. Il ne connaît aucune formule de
mise en page : une future mise en page qui recouvrirait autrement rougira tout
autant.

| réinjection | contrôle qui rougit |
|---|---|
| `yT = hor*.60` (titre à l'ancienne place) | le menu ne recouvre pas le titre *(137 puis 3 256 px²)* |
| + logo jamais réduit, + `yM` à l'ancien `clamp` | le menu ne recouvre pas le titre *(**4 696** et **11 792 px²**)* |
| lune remise dans le coin gauche | la version ne recouvre pas la lune *(80 px²)* |
| largeur de panneau figée à 212 px | le menu respire dans son panneau *(1 px de marge, 6 attendus)* |
| étoiles remises en `(i*79)%W` | les étoiles ne suivent pas un pas constant *(109 écarts sur 109)* |
| étoiles posées par `hash()` | les étoiles occupent toute la largeur / la hauteur *(53/57/0/0)* |

Deux de ces contrôles ont d'abord été **verts pour de mauvaises raisons**, et ne
l'ont montré qu'à la réinjection :

- *la version ne recouvre pas la lune* calculait la boîte de la lune à partir
  d'une position codée en dur dans le test. Remettre `lx=22` ne la déplaçait pas
  aux yeux du contrôle. Il relève maintenant l'appel à `arc()`.
- *aucune rangée d'étoiles alignées* et *les étoiles occupent les quatre quarts*
  passaient tous deux avec le motif d'origine : `79` et `47` sont premiers avec
  leurs modulos, donc le treillis remplit uniformément et ne répète aucune
  ordonnée. Il fallait mesurer le **pas** lui-même, pas l'occupation.

### À ne pas réintroduire

- **Deux blocs qui se placent chacun de leur côté finiront par se rencontrer.**
  Dès que deux éléments d'un même écran ont des tailles variables, la mise en
  page se calcule **une fois, en entier, avant de dessiner** — et l'on décide
  explicitement qui cède.
- **`clamp(v, lo, hi)` ment quand `hi < lo`** : il renvoie `hi`, donc une valeur
  sous le plancher qu'on croyait garantir. Quand les deux bornes sont calculées,
  vérifier laquelle peut passer sous l'autre.
- **`hash()` est biaisé pour de petites entrées** (il multiplie sans
  `Math.imul`). Il convient aux coordonnées de tuiles, pas à un compteur de 0 à
  110. Ne pas le corriger sans mesurer ce que cela repeint : il ensemence les
  huit régions.
- **Un motif « aléatoire » à pas constant est un treillis.** Une répartition
  uniforme par quadrant ne le détecte pas ; l'écart entre deux points
  consécutifs, si.
- **Un élément qu'on ne peut pas placer se retire.** Une bête de 4 px ou un héros
  à moitié caché derrière un panneau ne racontent rien — mieux vaut ne pas les
  dessiner.

---

## 40. Les huit mondes se fermaient sur la même muraille, et les créatures s'enfonçaient dans le sol

### Un seul mur gris pour huit régions

Chaque région était enclose du **même rectangle** : trois cases de `O.MUR`, la
même pierre grise, tirée au cordeau sur les quatre côtés. La vallée, le désert
et la Faille se fermaient sur la même muraille, et l'on ne lisait pas un
accident du terrain mais **le bord d'une feuille**.

Deux choses font désormais une frontière.

**Sa pierre.** `murTuile` lit `PIERRES[regionIdx(y)]` : neuf teintes par région
— flanc, pied, assises, dessus, arêtes, veine, bords. Mesuré, la couleur du
dessus de la falaise, région par région :

| | vallée | Cendres | Cimes | Lagon | Sables | Marais | Nues | Faille |
|---|---|---|---|---|---|---|---|---|
| **avant** | 141,146,162 | 141,146,162 | 141,146,162 | 141,146,162 | 141,146,162 | 141,146,162 | 141,146,162 | 141,146,162 |
| **après** | 138,148,132 | 77,68,80 | 127,157,178 | 203,185,154 | 200,161,101 | 93,107,82 | 207,214,232 | 74,58,94 |

Les **salles** sont bâties du même objet : un temple du désert est donc en grès,
un temple des Cimes en glace bleue. C'est voulu.

**Son profil.** `falaise()` ajoute au mur plein des **dents** — par pans de trois
à six cases, une à deux cases de profondeur — puis une **lisière** du décor de la
région, devant la roche. Mesuré, l'épaisseur du bord ouest passe de « 3 partout »
à « 3, 4 ou 5 » dans les huit régions ; et la lisière relevée sur les colonnes du
bord :

| région | ce qui pousse devant sa falaise |
|---|---|
| vallée | chênes, buissons, rochers |
| Terres de Cendre | roche noire, piliers |
| Cimes Gelées | sapins, cairns |
| Lagon d'Azur | récifs de corail |
| Sables du Mirage | cactus, obélisques |
| Marais des Murmures | saules, souches |
| Cité des Nues | rien — on ne plante pas sur le vide |
| la Faille | roche noire |

### Trois règles tiennent la sûreté du monde

- **Les dents sont du MUR**, comme le cœur qu'on vient de poser. C'est la seule
  chose que `voie()` et `chemin()` n'effacent pas : une dent en roche noire dans
  les Cendres, et `chemin()` l'aurait percée (§ 8). Mesuré : **zéro case
  franchissable** sur tout le cadre du monde.
- **Elles n'ensevelissent rien.** Une dent ne se pose que sur une case vide, et
  jamais à moins de deux cases d'une luciole. Sans cette seconde garde, la
  falaise sud de la vallée refermait **la clairière de la luciole n° 6** — très
  exactement la faute du § 9, à deux rangées près. Le contrôle l'a attrapée du
  premier coup.
- **Le hasard est LOCAL.** `falaise()` a son propre générateur, semé sur ses
  coordonnées : il ne consomme rien de `rnd()`. Un seul tirage de plus dans une
  région décalerait tous les suivants et repeindrait son terrain (§ 14) — le
  monde d'avant est intact, aux falaises près.

La lisière, elle, est du décor ordinaire : un traceur de sentier a le droit de
l'écarter, et les entrées de région, percées **après**, la traversent.

Trois bords n'existent pas, et le contrôle le sait : les Cendres n'ont pas de
falaise nord (celle de la vallée les ferme), les Nues pas de bord sud (on y
tombe dans la Faille), et le Marais pas davantage — son `Y1` vaut `MH`, reliquat
du temps où il fermait le monde.

### Les créatures s'enfonçaient dans le sol

Une capture d'écran : une bête au milieu d'une plaque de glace, **coupée net à la
taille**, le décor par-dessus.

`pondre()` posait toute créature à `z:0`. Sur un plateau — étage 1, seize pixels
— elle était donc dessinée **seize pixels sous la surface**. Sa mise à jour
aurait bien corrigé sa hauteur (`e.z=baseSol(e.x,e.y)`), mais celle-ci est
court-circuitée tant que la bête n'a pas vu le héros :

```js
if(d>210||(!e.vz&&!e.voit)){ e.kx*=.8; e.ky*=.8; continue; }
```

— et c'est justement dans cet état qu'on la découvre, de loin, immobile. Mesuré
sur une partie neuve : **39 créatures sur 374**, dont tout le plateau nord de la
vallée. Elles naissent désormais à `Etg(tx,ty)*EH`. Après correctif : **0 sur
374**, et 0 encore après un tour de boucle.

### Vérification

`tests/34-frontieres.js`, douze contrôles. Les quatre bords de chaque région sont
mesurés séparément : le premier jet ne mesurait que les flancs, et **retirer la
falaise nord de la vallée le laissait vert**. Le contrôle du pied de falaise a dû
apprendre à chercher la roche : celle qui ferme la vallée est en 77-78, pas en
79, et la mesurer à ras du bord la donnait pour absente.

Réinjections, une par une — chacune fait rougir son contrôle, et lui seul :

| réinjection | contrôle qui rougit |
|---|---|
| une seule pierre pour les huit régions | les huit régions ont huit pierres différentes |
| falaise nord de la vallée retirée | aucun des quatre bords n'est plus un trait *(vallée/N)* |
| falaise sud des Cendres retirée | idem *(Cendres/S)* |
| falaise nord des Cimes retirée | idem *(Cimes/N)* |
| falaise ouest des Sables retirée | idem *(Sables/O)* |
| garde des clairières retirée | les clairières des lucioles restent dégagées |
| créatures pondues à `z:0` | aucune créature n'est enfoncée dans le sol *(42 sur 374)* |

### À ne pas réintroduire

- **Un décor de bordure qui n'est pas du MUR se fait percer** : `voie()` et
  `chemin()` épargnent le mur, et lui seul.
- **Tout ce qui grossit une bordure peut ensevelir ce qui est derrière.** Deux
  fois maintenant, sur la même falaise (§ 9, puis ici).
- **Un contrôle de bordure doit mesurer les QUATRE côtés.** Un flanc dentelé ne
  dit rien du bord nord.
- **Toute entité posée sur la carte doit naître à la hauteur de son sol.**
  `pondre()` l'ignorait ; les butins, les coffres et les lucioles, eux, portaient
  déjà leur étage.
