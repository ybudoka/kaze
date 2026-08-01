# Kaze & les Trois Étoiles — conventions du projet

Le jeu tient dans **un seul fichier**, `index.html` (HTML + CSS + JS, sans
dépendance). Il est publié par GitHub Pages depuis `main` : tout push met le
site à jour en une ou deux minutes.

## À faire à CHAQUE livraison

1. **Monter la version affichée.** `const VERSION` dans `index.html` et
   `"version"` dans `package.json` doivent être montées **ensemble** — elles
   doivent rester égales, et `23-version.js` le vérifie. Le numéro s'affiche sur
   l'écran-titre : c'est le seul moyen, depuis un téléphone, de savoir quelle
   version on a réellement.
   *Déjà oublié une fois : la version est restée à « V0.6 — 6 des 8 mondes »
   alors que les huit mondes étaient en ligne.*
2. **Lancer toute la suite** : `node tests/lancer.js` (sortie 1 au moindre
   échec).
3. **Consigner le correctif** dans `CORRECTIFS.md` : le symptôme, la **cause
   réelle** (souvent différente du symptôme), le correctif, et comment il a été
   vérifié.

## Méthode

- **Mesurer avant de corriger.** Un chiffre, pas une intuition : « 720 ms de
  gel », « 813 px² de recouvrement », « 2 étoiles → 0 ». Le symptôme décrit par
  le joueur est rarement la cause.
- **Rendre chaque correctif vérifiable.** Un test qui pilote le **vrai jeu**
  dans un navigateur, qui mesure des pixels et de l'état — jamais des détails
  d'implémentation.
- **Réinjecter le bug** après avoir écrit le contrôle, et vérifier qu'il
  rougit. Plusieurs contrôles de ce dépôt ont été verts pour de mauvaises
  raisons ; ils ne l'ont montré qu'à la réinjection.
- **Contrôle à blanc.** Quand on compare deux images ou deux états, vérifier
  d'abord que la comparaison sait dire « identiques ».

## Pièges de ce dépôt

Ils sont tous documentés dans `CORRECTIFS.md` § 8 (« Pièges à ne pas
réintroduire »). Les plus coûteux :

- **Tout est dans une seule portée JavaScript** : deux `function` de même nom
  s'écrasent en silence, la dernière l'emportant.
- **Ne jamais pré-rendre à la taille du monde** : un canvas de la taille de la
  carte gèle le chargement et dépasse la limite des navigateurs mobiles
  (~16 Mpx sur iOS). Découper, construire à la demande, recycler.
- **Rien ne doit être alloué par image** dans la boucle de rendu : les objets
  éphémères passent inaperçus sur un ordinateur et saccadent sur un téléphone.
- **Chaque région a sa graine** : sans cela, ajouter un monde repeint le terrain
  de tous les autres.
- **La police pixel remplace en silence par « ? »** ce qu'elle ne sait pas
  dessiner. Tout nouveau texte affiché doit passer par `13-police.js`.
- **Une génération déterministe ne suffit pas** : si le *nombre* de tirages
  dépend d'une donnée globale, tout ce qui suit se décale.

## Langue

Le code, les commentaires, la documentation et les libellés de test sont en
**français**. Les messages de commit sont en anglais.
