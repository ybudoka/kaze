'use strict';
/* Outils partagés par les tests.
   Les tests pilotent le vrai jeu dans un navigateur : ils mesurent des pixels
   et de l'état de jeu, jamais des détails d'implémentation. */
const path = require('path');
const fs = require('fs');

/* Playwright peut être installé localement (npm i -D playwright) ou
   globalement selon la machine : on essaie les emplacements courants. */
function chargerPlaywright() {
  const candidats = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    '/opt/node22/lib/node_modules/playwright',
    '/usr/lib/node_modules/playwright',
  ].filter(Boolean);
  for (const c of candidats) { try { return require(c); } catch (e) {} }
  throw new Error(
    'Playwright introuvable.\n' +
    '  npm i -D playwright   (puis npx playwright install chromium)\n' +
    '  ou renseigne PLAYWRIGHT_MODULE=/chemin/vers/playwright');
}

async function ouvrirNavigateur() {
  const { chromium } = chargerPlaywright();
  // Playwright trouve seul son Chromium ; CHROMIUM_PATH permet de le forcer.
  const opts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  return chromium.launch(opts);
}

const urlJeu = () => 'file://' + path.resolve(__dirname, '..', 'index.html');

/* Une page de jeu prête à l'emploi. Les erreurs JS sont collectées : un test
   qui passe alors que la console hurle n'est pas un test qui passe. */
async function pageDeJeu(navigateur, { largeur = 414, hauteur = 900, mobile = false } = {}) {
  const ctx = await navigateur.newContext({
    viewport: { width: largeur, height: hauteur },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile, hasTouch: mobile,
  });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(urlJeu(), { waitUntil: 'load' });
  await page.waitForTimeout(600);
  page.erreursJS = erreurs;
  return page;
}

/* Démarre une partie neuve et laisse le monde se construire. */
async function nouvellePartie(page, nom = 'TEST', slot = 0) {
  await page.evaluate(async ([n, s]) => {
    for (let i = 0; i < NB_SLOTS; i++) await stockEffacer(i);
    nouvellePartie(n, s);
    await new Promise(r => setTimeout(r, 350));
  }, [nom, slot]);
  await page.waitForTimeout(250);
}

const dort = ms => new Promise(r => setTimeout(r, ms));

/* Petit serveur statique : un service worker ne s'enregistre qu'en http(s),
   impossible donc de le tester en file://. `marqueur` permet de modifier à
   chaud ce que renvoie le serveur, pour vérifier qu'une nouvelle version
   parvient bien au joueur. */
function serveurStatique(racine = path.resolve(__dirname, '..')) {
  const http = require('http');
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
                  '.svg': 'image/svg+xml', '.png': 'image/png',
                  '.webmanifest': 'application/manifest+json' };
  const etat = { marqueur: '' };
  const serveur = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/' ) rel = '/index.html';
    const f = path.join(racine, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404); res.end('absent'); return; }
      const ext = path.extname(f);
      let corps = buf;
      if (ext === '.html' && etat.marqueur)
        corps = Buffer.from(buf.toString('utf8').replace('</head>', `<meta name="marqueur" content="${etat.marqueur}"></head>`));
      res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream',
                           'Cache-Control': 'no-store' });
      res.end(corps);
    });
  });
  return new Promise(res => {
    serveur.listen(0, '127.0.0.1', () => res({
      url: `http://127.0.0.1:${serveur.address().port}/`,
      marquer: m => { etat.marqueur = m; },
      fermer: () => new Promise(r => serveur.close(r)),
    }));
  });
}

module.exports = { ouvrirNavigateur, pageDeJeu, nouvellePartie, urlJeu, dort, serveurStatique };
