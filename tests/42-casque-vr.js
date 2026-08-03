'use strict';
/* CORRECTIFS.md § 23 — manettes physiques et casque VR.

   Sur un Quest, le jeu s'ouvrait déjà dans le panneau plat du navigateur et les
   boutons à l'écran répondaient au laser : tout passe par des événements
   `pointer`. Ce qui manquait, ce sont les JOYSTICKS — hors session immersive,
   le casque ne livre pas ses manettes à la page.

   Ce qui se mesure ici, et ce qui ne peut pas l'être : il n'y a pas de casque
   au bout de ce test. On remplace donc l'API WebXR par une maquette FIDÈLE —
   session, repère, couche, poses, manettes — et l'on vérifie que le VRAI code
   du jeu la pilote correctement : la session s'ouvre, la boucle change de
   cadence, les deux yeux sont dessinés, les manettes arrivent dans le tampon
   d'entrées, et tout se défait proprement à la sortie. Ce qu'on ne saura pas
   d'ici : le confort, la lisibilité du pixel art à 2,60 m, la latence. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Manettes et casque VR',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 414, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};

      /* ---------- la manette au repos ne doit rien éteindre ----------
         `26-manette.js` couvre déjà la manette branchée. Ce qui n'était couvert
         nulle part, et qui était FAUX : relâcher un bouton de manette éteignait
         la touche du clavier tenue au même instant. Le cas du doigt sur l'écran
         était gardé, le cas identique du clavier ne l'était pas. */
      const pad = (btns, axes) => ({
        connected: true, mapping: 'standard',
        buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!btns[i], value: btns[i] ? 1 : 0 })),
        axes: axes || [0, 0, 0, 0]
      });
      let branchee = pad({});
      navigator.getGamepads = () => (branchee ? [branchee] : []);
      dispatchEvent(new Event('gamepadconnected'));
      branchee = pad({ 0: 1 }); majEntrees();        // la manette frappe
      branchee = pad({});       majEntrees();        // puis relâche
      viderTampon(); BTN.B = 0;
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }));
      branchee = pad({ 0: 1 }); majEntrees();
      branchee = pad({});
      for (let i = 0; i < 5; i++) majEntrees();
      out.clavierSurvit = BTN.B === 1;
      dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ' }));
      branchee = null; majEntrees();

      /* ---------- les manettes Touch d'un casque ---------- */
      const touch = (main, btns, axes) => ({
        handedness: main,
        gamepad: {
          mapping: 'xr-standard',
          buttons: Array.from({ length: 6 }, (_, i) => ({ pressed: !!btns[i], value: btns[i] ? 1 : 0 })),
          axes: axes || [0, 0, 0, 0]
        }
      });
      const essaiXR = (sources) => {
        xrSession = { inputSources: [] }; majEntrees();      // relâché
        xrSession = { inputSources: sources }; majEntrees();
        const b = Object.keys(BTN).filter(k => BTN[k]);
        const a = { x: +axe.x.toFixed(2), y: +axe.y.toFixed(2) };
        xrSession = null; majEntrees();
        return { b: b.join(','), a };
      };
      out.xrGachetteDroite = essaiXR([touch('right', { 0: 1 })]).b;
      out.xrPoigneeDroite = essaiXR([touch('right', { 1: 1 })]).b;
      out.xrBoutonsDroite = [essaiXR([touch('right', { 4: 1 })]).b, essaiXR([touch('right', { 5: 1 })]).b];
      out.xrBoutonsGauche = [essaiXR([touch('left', { 4: 1 })]).b, essaiXR([touch('left', { 5: 1 })]).b];
      out.xrGachetteGauche = essaiXR([touch('left', { 0: 1 })]).b;
      out.xrClics = [essaiXR([touch('right', { 3: 1 })]).b, essaiXR([touch('left', { 3: 1 })]).b];
      /* Sur une Touch, le joystick est sur les axes 2/3 — 0/1 sont le pavé
         tactile, resté à zéro. Lire naïvement 0/1 donnait un héros immobile. */
      out.xrJoystick = essaiXR([touch('left', {}, [0, 0, -1, 0])]).a;

      /* ---------- le bouton n'apparaît que si le casque existe ---------- */
      const bt = document.getElementById('btVR');
      out.cacheSansCasque = !!bt.hidden;
      Object.defineProperty(navigator, 'xr', {
        configurable: true,
        value: { isSessionSupported: () => Promise.resolve(true) }
      });
      await detecterVR();
      out.montreAvecCasque = !bt.hidden;

      /* ---------- le rendu : les shaders compilent vraiment ---------- */
      {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl');
        try { const rr = batirRenduVR(gl); out.renduBati = !!(rr.prog && rr.tex && rr.umvp); }
        catch (e) { out.renduBati = 'ERREUR: ' + e.message; }
      }

      /* ---------- l'écran suit la tête, avec une zone morte ---------- */
      const pose = (yaw, x, y, z) => ({
        transform: {
          position: { x: x || 0, y: y === undefined ? 1.5 : y, z: z || 0 },
          orientation: { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }
        }
      });
      out.cap = [0, 1, -1].map(a => +capDe(pose(a).transform.orientation).toFixed(3));
      xrAncre.pose = false;
      suivreTete(pose(0));
      const yaw0 = xrAncre.yaw;
      for (let i = 0; i < 60; i++) suivreTete(pose(0.3));       // petit coup d'œil
      out.ignorePetitMouvement = Math.abs(xrAncre.yaw - yaw0) < 0.02;
      for (let i = 0; i < 240; i++) suivreTete(pose(1.6));      // on pivote franchement
      out.rattrapeGrandMouvement = Math.abs(xrAncre.yaw - 1.6) < 0.15;
      // l'écran est bien DEVANT, à la bonne distance
      xrAncre.pose = false; suivreTete(pose(0, 0, 1.5, 0));
      out.ecranDevant = { x: +_mod[12].toFixed(2), y: +_mod[13].toFixed(2), z: +_mod[14].toFixed(2) };

      /* ---------- le produit de matrices, contrôlé à blanc ---------- */
      const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      const A = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const o = new Float32Array(16);
      mat4Mul(o, I, A); out.matIdentite = Array.from(o).every((x, i) => x === A[i]);
      // translation de (1,2,3) appliquée à un point, via la matrice
      const T = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]);
      mat4Mul(o, T, T); out.matTranslations = [o[12], o[13], o[14]];  // deux fois = double

      /* ---------- la session complète, sur une maquette de l'API ---------- */
      let rafCb = null, finies = 0, dessins = 0;
      const fauxLayer = { framebuffer: null, getViewport: () => ({ x: 0, y: 0, width: 256, height: 256 }) };
      const M = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      const faussePose = {
        transform: { position: { x: 0, y: 1.6, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
        views: [
          { transform: { inverse: { matrix: M } }, projectionMatrix: M },
          { transform: { inverse: { matrix: M } }, projectionMatrix: M }
        ]
      };
      const fauxFrame = { getViewerPose: () => faussePose };
      const fins = [];
      const fausseSession = {
        renderState: { baseLayer: null },
        inputSources: [],
        updateRenderState(s) { this.renderState.baseLayer = s.baseLayer; },
        requestReferenceSpace: t => t === 'local-floor' ? Promise.resolve({}) : Promise.reject(new Error('non')),
        requestAnimationFrame(cb) { rafCb = cb; return 1; },
        addEventListener(t, f) { if (t === 'end') fins.push(f); },
        end() { finies++; for (const f of fins) f(); return Promise.resolve(); }
      };
      window.XRWebGLLayer = function () { return fauxLayer; };
      WebGLRenderingContext.prototype.makeXRCompatible = function () { return Promise.resolve(); };
      Object.defineProperty(navigator, 'xr', {
        configurable: true,
        value: {
          isSessionSupported: () => Promise.resolve(true),
          requestSession: () => Promise.resolve(fausseSession)
        }
      });

      const tickAvant = tick;
      out.entree = await entrerVR();
      out.sessionOuverte = xrSession === fausseSession;
      out.repereObtenu = !!xrRef;
      out.libelleBouton = document.getElementById('btVR').textContent;

      /* La boucle de page ne doit PLUS faire tourner le jeu : sinon il tourne
         deux fois par image, une fois par chemin. */
      const tickApresPage = tick;
      boucle();
      out.pageNeJouePlus = tick === tickApresPage;

      /* La session, elle, fait tourner le jeu ET dessine les deux yeux. */
      if (!xrGL) { out.sessionJoue = -1; out.yeuxDessines = -1; return out; }
      const vraiDraw = xrGL.drawArrays.bind(xrGL);
      xrGL.drawArrays = function () { dessins++; return vraiDraw.apply(null, arguments); };
      const t0 = tick;
      for (let i = 0; i < 3; i++) { const cb = rafCb; rafCb = null; cb(0, fauxFrame); }
      out.sessionJoue = tick - t0;
      out.yeuxDessines = dessins;                    // 2 par image
      out.replanifie = !!rafCb;

      /* Les manettes de la session arrivent bien dans le tampon. */
      fausseSession.inputSources = [touch('right', { 0: 1 })];
      { const cb = rafCb; rafCb = null; cb(0, fauxFrame); }
      out.manetteEnSession = BTN.B === 1;
      fausseSession.inputSources = [];
      { const cb = rafCb; rafCb = null; cb(0, fauxFrame); }

      /* Sortie : tout se défait, la page reprend la main. */
      await fausseSession.end();
      out.sessionFermee = xrSession === null && xrGL === null && xrRef === null;
      out.libelleRendu = document.getElementById('btVR').textContent;
      const t1 = tick; boucle(); await dort(60);
      out.pageReprend = tick > t1;
      out.tickTotal = tick > tickAvant;
      return out;
    });

    
    v('UNE MANETTE AU REPOS N\'ÉTEINT PAS UNE TOUCHE DU CLAVIER',
      r.clavierSurvit, 'la manette a coupé le clavier');

    v('LA GÂCHETTE DROITE FRAPPE, LA POIGNÉE SAUTE',
      r.xrGachetteDroite === 'B' && r.xrPoigneeDroite === 'A',
      `${r.xrGachetteDroite} / ${r.xrPoigneeDroite}`);
    /* Le héros porte DEUX outils à la fois (fentes Y et X). Les deux pouces
       doivent donc tomber sur les deux fentes, pas sur une seule. */
    v('les boutons du pouce droit donnent le saut et la seconde fente',
      r.xrBoutonsDroite.join('|') === 'A|X', r.xrBoutonsDroite.join('|'));
    v('LA GÂCHETTE GAUCHE SERT LA PREMIÈRE FENTE D\'OUTIL',
      r.xrGachetteGauche === 'Y', r.xrGachetteGauche);
    v('et les boutons du pouce gauche font défiler le sac',
      r.xrBoutonsGauche.join('|') === 'L|R', r.xrBoutonsGauche.join('|'));
    v('les clics de joystick ouvrent carte et journal',
      r.xrClics.join('|') === 'Start|Select', r.xrClics.join('|'));
    v('LE JOYSTICK D\'UNE TOUCH EST SUR LES AXES 2/3, PAS 0/1',
      r.xrJoystick.x === -1 && r.xrJoystick.y === 0, JSON.stringify(r.xrJoystick));

    v('SANS CASQUE, LE BOUTON VR RESTE CACHÉ', r.cacheSansCasque, 'bouton affiché à tort');
    v('avec un casque, il apparaît', r.montreAvecCasque, 'bouton resté caché');

    v('LES SHADERS DE L\'ÉCRAN VR COMPILENT ET SE LIENT',
      r.renduBati === true, String(r.renduBati));

    v('le cap est lu correctement du quaternion',
      Math.abs(r.cap[0]) < 0.001 && Math.abs(r.cap[1] - 1) < 0.001 && Math.abs(r.cap[2] + 1) < 0.001,
      r.cap.join(' '));
    v('L\'ÉCRAN IGNORE UN COUP D\'ŒIL ET SUIT UN VRAI PIVOT',
      r.ignorePetitMouvement && r.rattrapeGrandMouvement,
      `petit=${r.ignorePetitMouvement} grand=${r.rattrapeGrandMouvement}`);
    v('il se pose devant le joueur, à hauteur des yeux',
      Math.abs(r.ecranDevant.x) < 0.01 && Math.abs(r.ecranDevant.z + 2.6) < 0.01
      && Math.abs(r.ecranDevant.y - 1.5) < 0.01, JSON.stringify(r.ecranDevant));
    v('CONTRÔLE À BLANC : le produit de matrices sait rendre l\'identité',
      r.matIdentite && r.matTranslations.join(',') === '2,4,6',
      `identité=${r.matIdentite} translations=${r.matTranslations.join(',')}`);

    v('LA SESSION VR S\'OUVRE ET PREND SON REPÈRE',
      r.entree === true && r.sessionOuverte && r.repereObtenu,
      `entrée=${r.entree} session=${r.sessionOuverte} repère=${r.repereObtenu}`);
    v('le bouton propose alors de quitter', /QUITTER/.test(r.libelleBouton), r.libelleBouton);
    v('EN CASQUE, LA BOUCLE DE PAGE NE FAIT PLUS TOURNER LE JEU',
      r.pageNeJouePlus, 'le jeu tourne deux fois par image');
    v('C\'EST LA SESSION QUI CADENCE, ET ELLE DESSINE LES DEUX YEUX',
      r.sessionJoue === 3 && r.yeuxDessines === 6 && r.replanifie,
      `images=${r.sessionJoue} dessins=${r.yeuxDessines} replanifiée=${r.replanifie}`);
    v('LES MANETTES DE LA SESSION ARRIVENT DANS LE JEU',
      r.manetteEnSession, 'la gâchette ne frappe pas');
    v('EN SORTANT, TOUT SE DÉFAIT ET LA PAGE REPREND LA MAIN',
      r.sessionFermee && r.pageReprend && !/QUITTER/.test(r.libelleRendu),
      `fermée=${r.sessionFermee} reprend=${r.pageReprend} bouton=${r.libelleRendu}`);

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
