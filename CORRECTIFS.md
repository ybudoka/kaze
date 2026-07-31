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

### 2.3 Les boutons masquaient le HUD — `7fe404f`

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
