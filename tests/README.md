# Tests — chaque correctif est vérifiable

Ces tests pilotent le **vrai jeu** dans un navigateur : ils mesurent des pixels
et de l'état de jeu, jamais des détails d'implémentation. Chaque contrôle
correspond à un correctif documenté dans [`../CORRECTIFS.md`](../CORRECTIFS.md).

## Lancer

```bash
node tests/lancer.js              # toute la suite (~30 s)
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
3. **Contrôle à blanc.** `04-rendu.js` compare d'abord le rendu à lui-même (il
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
