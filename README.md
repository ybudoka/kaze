# Kaze & les Trois Étoiles

[![Tests](https://github.com/ybudoka/kaze/actions/workflows/tests.yml/badge.svg)](https://github.com/ybudoka/kaze/actions/workflows/tests.yml)

Jeu d'action-aventure 16 bits, **en un seul fichier HTML**, sans dépendance.

### ▶️ Jouer : **<https://ybudoka.github.io/kaze/>**

Sur téléphone, ajoute-le à ton **écran d'accueil** (Partager → « Sur l'écran
d'accueil ») : le jeu s'ouvre en plein écran, se joue **hors ligne**, et le
navigateur cesse d'effacer tes sauvegardes au bout de sept jours.

> Le jeu reste servi en « réseau d'abord » : tant qu'il y a de la connexion, tu
> reçois toujours la dernière version. Le cache n'est qu'un filet hors ligne —
> jamais une raison de rester bloqué sur une version périmée.

## Manette

| | |
|---|---|
| **B** épée (maintenir = tourbillon) · **A** saut | **Y** objet · **X** bouclier |
| **L/R** changer d'objet | **START** carte · **SELECT** journal |

Le bouton **MUSIQUE** coupe ou rallume la bande-son ; le choix est retenu.
Elle change selon l'endroit — village, salle close, vallée, Terres de Cendre —
et chaque gardien a son thème.

Au clavier : flèches/WASD · J=B · K=A · U=Y · I=X · Q/E=L/R · Entrée=Start.

## L'aventure

**La vallée** — réunis les **trois étoiles** (sanctuaire, ruine du lac, arène du
gardien). Les huit **lucioles d'or** rapportées à la fée du bosquet allongent
ton épée.

**Les Terres de Cendre** — les trois étoiles ouvrent le portail du sud. Marteau,
bottes de cendre, et le Cœur de Cendre au bout.

## Gemmes

Les monstres et les buissons lâchent trois pierres : **rubis vert** (1),
**saphir bleu** (5) et **grenat rouge** (20). Le grenat est rare — et les
Terres de Cendre, plus dures, en lâchent davantage.

## La colporteuse

Une marchande ambulante s'installe de temps à autre près de toi, puis repart.
Elle ne vend pas ce que Bran propose : **carquois de cuir**, **grand sac**,
**cœur supplémentaire**, potions supplémentaires. Elle clignote sur la carte.

## Sauvegardes

Trois emplacements nommés. Le bouton **SAUVEGARDES** exporte les trois en un
code (copie ou fichier) et les restaure : le stockage d'un navigateur n'est
jamais définitif, une copie hors ligne l'est.

## Développement

Tout tient dans [`index.html`](index.html). Le site est publié par GitHub Pages
depuis `main` : tout push met le jeu à jour en une à deux minutes.

```bash
npm install && npx playwright install chromium
npm test                          # 154 contrôles, ~11 s
node tests/lancer.js sauvegardes  # un sous-ensemble
```

- [`CORRECTIFS.md`](CORRECTIFS.md) — chaque problème rencontré, sa cause réelle,
  le correctif et sa vérification.
- [`tests/README.md`](tests/README.md) — ce que couvre chaque test, et la
  correspondance avec les correctifs.
