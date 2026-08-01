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

