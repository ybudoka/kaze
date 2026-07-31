'use strict';
/* Lance toute la suite : node tests/lancer.js
   Un filtre optionnel ne garde que les tests dont le nom de fichier correspond :
     node tests/lancer.js sauvegardes
   Sort en code 1 si le moindre contrôle échoue — utilisable en intégration. */
const fs = require('fs');
const path = require('path');
const { ouvrirNavigateur } = require('./outils');

const VERT = '\x1b[32m', ROUGE = '\x1b[31m', GRIS = '\x1b[90m', GRAS = '\x1b[1m', RAZ = '\x1b[0m';

(async () => {
  const filtre = process.argv[2] || '';
  const fichiers = fs.readdirSync(__dirname)
    .filter(f => /^\d\d-.*\.js$/.test(f))
    .filter(f => !filtre || f.includes(filtre))
    .sort();

  if (!fichiers.length) { console.error(`Aucun test ne correspond à « ${filtre} »`); process.exit(1); }

  let navigateur;
  try { navigateur = await ouvrirNavigateur(); }
  catch (e) { console.error(ROUGE + e.message + RAZ); process.exit(1); }

  let totalOK = 0, totalKO = 0;
  const debut = Date.now();

  /* Les fichiers tournent en parallèle : chacun a ses propres contextes de
     navigateur, et l'essentiel de leur durée est de l'attente (animations,
     temporisations du jeu) — la mener de front divise le temps total.
     La sortie est mise de côté puis affichée fichier par fichier, sinon les
     lignes s'entremêleraient. */
  const LOT = Math.min(4, fichiers.length);
  const resultats = new Map();
  let suivant = 0;
  const ouvrier = async () => {
    while (suivant < fichiers.length) {
      const f = fichiers[suivant++];
      const test = require(path.join(__dirname, f));
      const ok = [], ko = [];
      const v = (nom, cond, detail) => (cond ? ok : ko).push({ nom, detail });
      const t0 = Date.now();
      try { await test.executer({ navigateur, v }); }
      catch (e) { ko.push({ nom: 'le test lui-même a échoué', detail: e.message }); }
      resultats.set(f, { nom: test.nom, ok, ko, duree: Date.now() - t0 });
    }
  };
  await Promise.all(Array.from({ length: LOT }, ouvrier));

  for (const f of fichiers) {
    const r = resultats.get(f);
    if (!r) continue;
    console.log(`${GRAS}${r.nom}${RAZ} ${GRIS}(${f}, ${(r.duree / 1000).toFixed(1)}s)${RAZ}`);
    for (const t of r.ok) console.log(`  ${VERT}✓${RAZ} ${t.nom}`);
    for (const t of r.ko) console.log(`  ${ROUGE}✗ ${t.nom}${RAZ}${t.detail ? GRIS + '  → ' + t.detail + RAZ : ''}`);
    totalOK += r.ok.length; totalKO += r.ko.length;
    console.log('');
  }

  await navigateur.close();
  const duree = ((Date.now() - debut) / 1000).toFixed(1);
  const couleur = totalKO ? ROUGE : VERT;
  console.log(`${couleur}${GRAS}${totalOK} contrôles réussis, ${totalKO} échec(s)${RAZ} en ${duree}s`);
  process.exit(totalKO ? 1 : 0);
})();
