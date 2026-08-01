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
Elle change selon l'endroit — village, salle close, vallée, Terres de Cendre,
Cimes Gelées, Lagon d'Azur — et chaque gardien a son thème.

Au clavier : flèches/WASD · J=B · K=A · U=Y · I=X · Q/E=L/R · Entrée=Start.

## L'aventure

Le monde compte **quatre régions superposées**, chacune plus au sud que la
précédente : la vallée, les Terres de Cendre, les Cimes Gelées, le Lagon d'Azur.

**La vallée** — réunis les **trois étoiles** (sanctuaire, ruine du lac, arène du
gardien). Les huit **lucioles d'or** rapportées à la fée du bosquet allongent
ton épée.

**Les Terres de Cendre** — les trois étoiles ouvrent le portail du sud. Marteau,
bottes de cendre, et le Cœur de Cendre au bout. Un **col** descend ensuite vers
la montagne.

**Les Cimes Gelées** — neige, lacs de glace et arêtes de granit. Le **boomerang**
dort au fond du **Temple de Givre** : lancé avec **Y**, il part droit devant,
ralentit, revient dans ta main, **brise la glace** et ramasse au passage. Il faut
en briser les blocs qui scellent l'**Arène du Sommet** pour y défier le **Roi
Yéti**. **Harpies**, **piquiers de givre** et **loups des neiges** te barrent la
route.

**Le Lagon d'Azur** — la mer : grèves, hauts-fonds, récifs de corail et eau
profonde. Chausse les **palmes** trouvées sur la **Grève aux Palmes** pour
**nager** au large, plonger au **Temple Englouti** et affronter le **Léviathan**.
Attention aux **crabes cuirassés** (l'épée ricoche, le boomerang les sonne), aux
**tritons** qui lancent leur trident et aux **méduses** qui s'effacent.

## Quêtes annexes

Sept quêtes se mènent en parallèle de l'aventure. Le **journal** (SELECT) donne
l'état de chacune ; les objets à trouver clignotent sur la carte.

| Quête | Où | Récompense |
| --- | --- | --- |
| Les huit lucioles d'or | toute la vallée | épée longue (portée et dégâts doublés) |
| La tarte de Mira | village → lac → doyenne | cœur de cristal (+2 cœurs) |
| La prime de la garde | quinze monstres | 60 rubis et 5 bombes |
| **La lanterne du pêcheur** | vallée **puis** Terres de Cendre | **épée de Cendre** (+1 dégât) |
| **Les brasiers éteints** | Terres de Cendre | carte des Cendres révélée, 120 rubis |
| **Les cloches de givre** | Cimes Gelées | carte des Cimes révélée, cœur de cristal |
| **Les perles du naufragé** | Lagon d'Azur | 150 rubis et une potion |

**La lanterne du pêcheur** est une chaîne qui traverse les deux régions. Une
fois sa tarte mangée, le vieux pêcheur parle de la lanterne qu'il a perdue dans
la **clairière aux pins**, au bois du nord ; sa flamme ne s'éteint pas, on la
voit de loin. Rapportée, elle mène à **Durn**, son frère forgeron, installé sous
la Forge Noire. Durn réclame **trois éclats d'obsidienne** — seuls les golems de
basalte en portent — et forge l'**épée de Cendre**, qui ajoute un point de dégât
à chaque coup et fait traîner du feu derrière la lame.

**Les brasiers éteints** — trois brasiers balisaient la route des Cendres. Un
coup d'épée y fait jaillir l'étincelle. Les trois rallumés, la région entière
apparaît sur la carte et Durn paie 120 rubis.

**Les cloches de givre** — trois cloches de glace pendent aux parvis des Cimes.
**Seul le boomerang** les fait sonner. Les trois sonnées, la carte des Cimes se
révèle et un cœur de cristal apparaît au Temple de Givre.

**Les perles du naufragé** — échoué sur la grève, un naufragé a perdu sa bourse
de **cinq perles**, éparpillées dans les coraux du Lagon. Ramène-les-lui, palmes
aux pieds, contre 150 rubis et une potion.

## Énigmes

Des **énigmes** parsèment les régions, de plus en plus retorses. La vallée les
**enseigne** une à une ; les régions suivantes les **combinent**.

- **La caisse et la plaque** — pousse une **caisse** (avance dans sa direction)
  sur une **dalle de pression** pour ouvrir une porte à mécanisme. Aux Cendres,
  il faut couvrir **deux dalles à la fois** : une seule caisse ne suffit plus.
- **L'interrupteur** — frappe le **cristal** (épée, flèche ou boomerang) pour
  **abaisser les blocs bleus** et lever les orange, et inversement.
- **Le grappin** — vise une **ancre** et appuie sur **Y** : il t'y tire, par-dessus
  l'eau ou un gouffre qu'aucune autre traversée ne franchit. On le gagne dans la
  première salle d'énigme de la vallée.

Le **marteau** ne balaie plus comme l'épée : il se **lève au-dessus de la tête
et s'abat** droit devant, avec une onde de choc au sol.

Voir [`PLAN.md`](PLAN.md) pour la feuille de route des **8 mondes** — les quatre
en jeu et les quatre à venir, jusqu'au boss final et à sa fin.

## Gemmes

Un **coup d'épée ramasse** ce qu'il touche — inutile de marcher pile dessus.
Les monstres et les buissons lâchent trois pierres : **rubis vert** (1),
**saphir bleu** (5) et **grenat rouge** (20). Le grenat est rare — et les régions
du sud, plus dures (Cendres, Cimes, Lagon), en lâchent davantage.

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
npm test                          # 259 contrôles, ~19 s
node tests/lancer.js sauvegardes  # un sous-ensemble
```

- [`CORRECTIFS.md`](CORRECTIFS.md) — chaque problème rencontré, sa cause réelle,
  le correctif et sa vérification.
- [`tests/README.md`](tests/README.md) — ce que couvre chaque test, et la
  correspondance avec les correctifs.
