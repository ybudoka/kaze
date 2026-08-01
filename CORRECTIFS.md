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

## 11. Les Cimes Gelées et le Lagon d'Azur (deux régions de plus)

Le monde passe de deux régions à **quatre**, empilées du nord au sud : vallée,
Terres de Cendre, **Cimes Gelées** (rangées 160-239), **Lagon d'Azur**
(rangées 240-319). `MH` passe de 160 à 320. Comme pour les Cendres, chaque
région est ajoutée **en dessous** : les index de tuiles des régions du haut ne
bougent pas, et une sauvegarde d'avant l'ajout retrouve sa vallée et ses Cendres
intactes (les nouveaux champs de quête prennent leur valeur par défaut, le
brouillard des nouvelles rangées reste noir).

### 11.1 Une région bornée à sa bande, pas à `MH`

`genererCendres()` remplissait « du haut de la région jusqu'à `MH` ». Avec deux
régions de plus, ce `MH` recouvrait les Cimes et le Lagon de cendre et de lave.
Chaque génération, chaque peuplement, chaque révélation de carte est désormais
**bornée à sa propre bande** (`Y_CENDRE`→`Y_CIMES`, etc.), et `enCendre()` ne
répond vrai que **dans** les Cendres — plus « partout au sud ».

### 11.2 Atteignable à pied, à la nage — mesuré, jamais supposé

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

### 11.3 Le boomerang, une arme qui revient

Nouvelle arme (`Y`) : un projectile qui part droit devant, **ralentit, revient**
vers le héros et se range dans sa main ; en chemin il frappe les ennemis (une
fois chacun), **brise les blocs de glace**, **sonne les cloches de givre**,
déclenche l'œil de pierre et **ramasse les butins**. Un seul en vol à la fois.
C'est la clé du **crabe cuirassé**, sur qui l'épée ricoche : le boomerang (ou une
bombe) le **sonne**, et l'épée porte alors.

### 11.4 Les palmes, ou nager sans casser les tests

Les palmes rendent l'eau franchissable — `solide()` ne bloque plus `EAU`/
`EAUPROF` **si `Q.palmes`**. Comme aucun test n'accorde les palmes par défaut,
le comportement historique (le lac de la vallée reste infranchissable) est
**inchangé**, et les parcours à blanc des autres tests le vérifient encore.

### 11.5 Les objets de quête sont des butins persistants

Boomerang, palmes et les cinq perles sont des **butins reposés par `peupler()`**
tant que le drapeau de quête correspondant est faux — exactement comme la clé de
pierre. Ils réapparaissent à la même place au rechargement, jusqu'à ce qu'on les
ramasse ; les perles déjà prises ne reviennent pas. Les blocs de glace brisés et
les cloches sonnées sont des **tuiles** : ils survivent par les différences de
décor, sans champ de sauvegarde supplémentaire.

Tout est vérifié dans `12-cimes-lagon.js` : biomes, six monstres armés, boomerang
(vol/retour, glace, crabe), palmes (nage), les deux gardiens (Roi Yéti scellé,
Léviathan cerné d'eau), quêtes annexes, musique, mini-carte, et rien de perdu au
rechargement — le tout mesuré sur le vrai jeu.

---

## 12. Énigmes, grappin et un nouveau marteau

### 12.1 Des briques d'énigme réutilisables

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

### 12.2 Le grappin, mesuré comme une vraie traversée

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

### 12.3 Le marteau ne balaie plus comme l'épée

| | |
|---|---|
| **Avant** | Le marteau réutilisait l'animation du coup d'épée (`J.atk`) : même arc horizontal, on ne distinguait pas les deux armes. |
| **Après** | Le marteau a son propre état (`J.slam`) : il **se lève au-dessus de la tête et s'abat** droit devant (`dessinerMarteau`), avec une **onde de choc** au sol et une secousse plus lourde. Le coup lui-même (`slamMarteau`) part **à l'impact** (`SLAM_IMPACT`), pas au déclenchement. |

Vérifié dans `13-enigmes.js` : appuyer sur **Y** avec le marteau met `J.slam > 0`
et **laisse `J.atk` à zéro** (c'est un *slam*, pas un coup d'épée), et la roche
noire ne cède qu'**à l'impact**.
