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
      /* L'arc est CENTRÉ sur la tête : la matrice ne fait plus que le tourner et
         le poser à hauteur des yeux, la distance est portée par les sommets. */
      xrAncre.pose = false; suivreTete(pose(0, 0, 1.5, 0));
      out.ancreEcran = { x: +_mod[12].toFixed(2), y: +_mod[13].toFixed(2), z: +_mod[14].toFixed(2) };
      // le point central de l'arc, passé par la matrice : droit devant, à XR_DIST
      const parMod = (x, y, z) => ({
        x: +(_mod[0] * x + _mod[4] * y + _mod[8] * z + _mod[12]).toFixed(2),
        y: +(_mod[1] * x + _mod[5] * y + _mod[9] * z + _mod[13]).toFixed(2),
        z: +(_mod[2] * x + _mod[6] * y + _mod[10] * z + _mod[14]).toFixed(2) });
      out.centreEcran = parMod(0, 0, -XR_DIST);

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
      /* Une manette qui VISE : la maquette porte sa pose sur son propre
         `targetRaySpace`, et `getPose` la rend — comme le fait un vrai casque. */
      /* On vise une DIRECTION, et l'on en déduit le quaternion en inversant la
         formule que le jeu applique (`dx=-sin(cap)cos(incl)`, `dy=sin(incl)`).
         Le contrôle ne recopie donc pas l'intersection qu'il mesure — seulement
         la façon de tenir la manette. */
      const versQuat = (dx, dy, dz) => {
        const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
        const inc = Math.asin(dy), cap = Math.atan2(-dx, -dz);
        const sy = Math.sin(cap / 2), cy = Math.cos(cap / 2);
        const sp = Math.sin(inc / 2), cp = Math.cos(inc / 2);
        return { x: cy * sp, y: sy * cp, z: -sy * sp, w: cy * cp };
      };
      const viseur = (x, y, z, dir) => ({
        __pose: { transform: { position: { x, y, z },
                               orientation: versQuat(dir[0], dir[1], dir[2]) } } });
      // la direction, depuis l'ancre, vers un point (px,py) de la toile
      const versToile = (px, py) => {
        const ang = (px / CV.width - 0.5) * xrArc(), hh = xrDemiHaut();
        return [Math.sin(ang) * XR_DIST, (0.5 - py / CV.height) * 2 * hh, -Math.cos(ang) * XR_DIST];
      };
      const fauxFrame = { getViewerPose: () => faussePose,
                          getPose: (espace) => (espace && espace.__pose) || null };
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

      /* ---- LA GÉOMÉTRIE : un ARC, pas un rectangle ----
         Sur un plan de trois mètres, les bords sont plus loin que le centre et
         l'œil doit accommoder autrement. On mesure la distance de CHAQUE sommet
         de l'écran au centre de l'arc : elle doit être constante. */
      {
        const som = xrSommets, n = xrNbEcran, R = XR_DIST;
        let mini = 1e9, maxi = -1e9;
        for (let i = 0; i < n; i++) {
          const x = som[i * 5], z = som[i * 5 + 2];
          const d = Math.hypot(x, z);
          if (d < mini) mini = d; if (d > maxi) maxi = d;
        }
        out.arcMini = +mini.toFixed(4); out.arcMaxi = +maxi.toFixed(4); out.arcR = R;
        out.arcColonnes = n / 2;
        // ce que donnerait un écran PLAT de même largeur : le coin est plus loin
        const t = xrTaille();
        out.platCoin = +Math.hypot(R, t.w / 2).toFixed(4);
        out.taille = { l: +t.w.toFixed(2), h: +t.h.toFixed(2) };
        // le cadre : plus grand et légèrement en retrait
        let hEcran = 0, hCadre = 0, zEcran = 0, zCadre = 0;
        for (let i = 0; i < n; i++) hEcran = Math.max(hEcran, Math.abs(som[i * 5 + 1]));
        for (let i = xrDebCadre; i < xrDebCadre + n; i++) {
          hCadre = Math.max(hCadre, Math.abs(som[i * 5 + 1]));
          zCadre = Math.min(zCadre, som[i * 5 + 2]);
        }
        for (let i = 0; i < n; i++) zEcran = Math.min(zEcran, som[i * 5 + 2]);
        out.cadre = { hEcran: +hEcran.toFixed(3), hCadre: +hCadre.toFixed(3),
                      zEcran: +zEcran.toFixed(3), zCadre: +zCadre.toFixed(3) };
      }

      /* ---- LA VOÛTE : elle doit ENVELOPPER le joueur ----
         Un ciel qui ne l'entoure pas laisse voir le vide par-dessous ; un ciel
         qui suit le cap de l'écran donne le tournis. On vérifie les deux. */
      {
        const som = xrSommets;
        let mini = 1e9, maxi = -1e9, bas = 1e9, haut = -1e9;
        for (let i = xrDebCiel; i < xrDebCiel + xrNbCiel; i++) {
          const x = som[i * 5], y = som[i * 5 + 1], z = som[i * 5 + 2];
          const d = Math.hypot(x, y, z);
          if (d < mini) mini = d; if (d > maxi) maxi = d;
          if (y < bas) bas = y; if (y > haut) haut = y;
        }
        out.ciel = { mini: +mini.toFixed(1), maxi: +maxi.toFixed(1), bas, haut,
                     faces: xrNbCiel / 6, ecran: XR_DIST };
        /* L'ancre suit la tête en douceur (6 % par image) : une seule passe ne
           la déplace que de 6 cm. On laisse converger. */
        for (let i = 0; i < 200; i++) suivreTete(pose(1.2, 0.3, 1.6, -0.4));
        out.cielSuitLaTete = { x: +_cielM[12].toFixed(2), y: +_cielM[13].toFixed(2),
                               z: +_cielM[14].toFixed(2),
                               tourne: +_cielM[0].toFixed(3) };   // 1 = aucune rotation
      }

      /* ---- VISER, ET APPUYER SUR UN BOUTON ---- */
      xrAncre.pose = false; suivreTete(pose(0, 0, 1.6, 0));
      const gachette = (p, presse) => { const src = { handedness: 'right', targetRaySpace: p,
        gamepad: { mapping: 'xr-standard',
          buttons: Array.from({ length: 6 }, (_, i) => ({ pressed: i === 0 && presse, value: 0 })),
          axes: [0, 0, 0, 0] } };
        fausseSession.inputSources = [src]; };

      const centreDe = b => [b.x + b.w / 2, b.y + b.h / 2];
      const razBoutons = () => { for (const k in BTN) BTN[k] = 0;
        for (const k in padAvant) { padAvant[k] = 0; padMaint[k] = 0; } };

      // droit devant : le viseur tombe au centre de la toile, sur aucun bouton
      gachette(viseur(0, 1.6, 0, versToile(CV.width / 2, CV.height / 2)), false);
      majViseurVR(fauxFrame);
      out.viseCentre = { actif: vrViseur.actif, x: Math.round(vrViseur.x), y: Math.round(vrViseur.y),
                         bouton: vrViseur.bouton, milieuX: Math.round(CV.width / 2) };

      // sur le premier bouton
      const bo = boiteVR(0);
      gachette(viseur(0, 1.6, 0, versToile(...centreDe(bo))), false);
      majViseurVR(fauxFrame);
      out.viseBas = { actif: vrViseur.actif, bouton: vrViseur.bouton,
                      x: Math.round(vrViseur.x), y: Math.round(vrViseur.y),
                      boite: bo };

      // la gâchette, en visant un bouton, ne doit PAS donner de coup d'épée
      razBoutons();
      gachette(viseur(0, 1.6, 0, versToile(...centreDe(bo))), true);
      majViseurVR(fauxFrame); majManetteXR();
      out.epeeNeutralisee = BTN.B === 0;
      // ... alors qu'elle frappe bien quand on ne vise aucun bouton
      razBoutons();
      gachette(viseur(0, 1.6, 0, versToile(CV.width / 2, CV.height / 2)), true);
      majViseurVR(fauxFrame); majManetteXR();
      out.epeeQuandOnNeVisePas = BTN.B === 1;
      razBoutons();

      /* ---- LA PASTILLE EST DISCRÈTE ----
         Elle ne doit pas manger le jeu : le viseur ne se montre que dans la
         bande basse, là où il a quelque chose à désigner. On compte les traits
         que l'interface pose, selon l'endroit visé. */
      const traitsInterface = () => {
        let n = 0; const vrai = X.fillRect.bind(X);
        X.fillRect = (...a) => { n++; return vrai(...a); };
        dessinerInterfaceVR();
        X.fillRect = vrai; return n;
      };
      out.unSeulBouton = VR_BOUTONS.length;
      gachette(viseur(0, 1.6, 0, versToile(CV.width / 2, CV.height / 2)), false);
      majViseurVR(fauxFrame);
      out.traitsLoin = traitsInterface();            // au repos : la pastille seule
      gachette(viseur(0, 1.6, 0, versToile(...centreDe(bo))), false);
      majViseurVR(fauxFrame);
      out.traitsPres = traitsInterface();            // + le viseur, en approche
      out.pastilleADroite = { x: bo.x, w: bo.w, W: CV.width, y: bo.y, H: CV.height };

      /* ---- ON QUITTE LA VR EN VISANT LA PASTILLE, AU RELÂCHEMENT ---- */
      vrGachettePrec = false;
      gachette(viseur(0, 1.6, 0, versToile(...centreDe(bo))), true);
      majViseurVR(fauxFrame);
      out.boutonVise = vrViseur.bouton;
      out.pasEncore = xrSession !== null;            // rien tant qu'on n'a pas relâché
      gachette(viseur(0, 1.6, 0, versToile(...centreDe(bo))), false);
      majViseurVR(fauxFrame);
      out.sortieParLaPastille = xrSession === null;
      fausseSession.inputSources = [];
      // on y retourne pour la suite des mesures
      out.retourEnVR = await entrerVR();

      /* ---- SORTIR DU CASQUE SANS LE MENU SYSTÈME ----
         La barre d'outils est en HTML : une fois le casque sur les yeux, le
         bouton « QUITTER LA VR » est invisible. Les deux poignées tenues
         ensemble doivent donc suffire. Une seule ne doit rien faire — sinon on
         quitterait la partie en attrapant son fauteuil. */
      fausseSession.inputSources = [touch('right', { 1: 1 })];
      // `cb` peut manquer si la session se ferme : on s'arrête proprement, sinon
      // la réinjection « une seule poignée suffit » plante au lieu de rapporter
      for (let i = 0; i < 90; i++) { const cb = rafCb; rafCb = null; if (!cb) break; cb(0, fauxFrame); }
      out.uneSeulePoignee = xrSession === fausseSession;      // toujours en casque
      fausseSession.inputSources = [touch('right', { 1: 1 }), touch('left', { 1: 1 })];
      let images = 0;
      for (let i = 0; i < 200 && xrSession; i++) { const cb = rafCb; rafCb = null; if (!cb) break; images++; cb(0, fauxFrame); }
      out.sortiePoignees = xrSession === null;
      out.imagesAvantSortie = images;                          // ~60 : une seconde
      fausseSession.inputSources = [];

      /* Le panneau de sauvegarde est en HTML : invisible sous le casque. Il ne
         doit jamais rester ouvert derrière une session. */
      out.entree2 = await entrerVR();
      await ouvrirCoffreFort();
      out.coffreFermeParLaVR = document.getElementById('coffreFort').hidden;
      out.vrQuitteeParLeCoffre = xrSession === null;
      fermerCoffre();
      if (!xrSession) out.entree3 = await entrerVR();
      out.coffreFermeALEntree = document.getElementById('coffreFort').hidden;

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
      Math.abs(r.centreEcran.x) < 0.01 && Math.abs(r.centreEcran.z + 2.6) < 0.01
      && Math.abs(r.centreEcran.y - 1.5) < 0.01, JSON.stringify(r.centreEcran));
    v('CONTRÔLE À BLANC : le produit de matrices sait rendre l\'identité',
      r.matIdentite && r.matTranslations.join(',') === '2,4,6',
      `identité=${r.matIdentite} translations=${r.matTranslations.join(',')}`);

    v('LA SESSION VR S\'OUVRE ET PREND SON REPÈRE',
      r.entree === true && r.sessionOuverte && r.repereObtenu,
      `entrée=${r.entree} session=${r.sessionOuverte} repère=${r.repereObtenu}`);
    v('le bouton propose alors de quitter', /QUITTER/.test(r.libelleBouton), r.libelleBouton);
    v('EN CASQUE, LA BOUCLE DE PAGE NE FAIT PLUS TOURNER LE JEU',
      r.pageNeJouePlus, 'le jeu tourne deux fois par image');
    /* Quatre couches par œil : la voûte, le sol, le cadre, puis l'écran. */
    v('C\'EST LA SESSION QUI CADENCE, ET ELLE DESSINE LES DEUX YEUX',
      r.sessionJoue === 3 && r.yeuxDessines === 3 * 2 * 4 && r.replanifie,
      `images=${r.sessionJoue} dessins=${r.yeuxDessines} replanifiée=${r.replanifie}`);
    v('LES MANETTES DE LA SESSION ARRIVENT DANS LE JEU',
      r.manetteEnSession, 'la gâchette ne frappe pas');
    v('L\'ÉCRAN EST UN ARC : TOUS SES POINTS SONT À LA MÊME DISTANCE',
      Math.abs(r.arcMini - r.arcR) < 0.002 && Math.abs(r.arcMaxi - r.arcR) < 0.002,
      `de ${r.arcMini} à ${r.arcMaxi} m pour un rayon de ${r.arcR}`);
    v('CONTRÔLE À BLANC : un écran PLAT aurait des coins plus loin',
      r.platCoin > r.arcR + 0.05, `coin plat à ${r.platCoin} m contre ${r.arcR}`);
    v('l\'arc est assez découpé pour ne pas se voir', r.arcColonnes >= 20,
      `${r.arcColonnes} colonnes`);
    v('L\'ÉCRAN TIENT DANS SA BOÎTE, MÊME AVEC UNE TOILE EN PORTRAIT',
      r.taille.l <= 3.01 && r.taille.h <= 2.01 && r.taille.h > 0.5,
      `${r.taille.l} m x ${r.taille.h} m`);
    v('le cadre entoure l\'écran et se tient derrière',
      r.cadre.hCadre > r.cadre.hEcran && r.cadre.zCadre < r.cadre.zEcran,
      JSON.stringify(r.cadre));

    v('LA VOÛTE ENVELOPPE LE JOUEUR, ÉCRAN ET SOL COMPRIS',
      r.ciel.mini > r.ciel.ecran + 5 && r.ciel.bas < 0 && r.ciel.haut > 0 && r.ciel.faces === 6,
      JSON.stringify(r.ciel));
    v('LES ÉTOILES SUIVENT LA TÊTE MAIS NE TOURNENT PAS AVEC L\'ÉCRAN',
      // pose(cap, x, y, z) : la tête est en (0.3, 1.6, -0.4), cap 1.2 rad
      Math.abs(r.cielSuitLaTete.x - 0.3) < 0.02 && Math.abs(r.cielSuitLaTete.y - 1.6) < 0.02
      && Math.abs(r.cielSuitLaTete.z + 0.4) < 0.02 && r.cielSuitLaTete.tourne === 1,
      JSON.stringify(r.cielSuitLaTete));

    v('VISER DROIT DEVANT TOMBE AU CENTRE DE LA TOILE',
      r.viseCentre.actif && Math.abs(r.viseCentre.x - r.viseCentre.milieuX) <= 1
      && r.viseCentre.bouton === -1, JSON.stringify(r.viseCentre));
    v('VISER EN BAS ATTEINT LE PREMIER BOUTON',
      r.viseBas.actif && r.viseBas.bouton === 0, JSON.stringify(r.viseBas));
    v('LA GÂCHETTE NE FRAPPE PAS QUAND ELLE VISE UN BOUTON',
      r.epeeNeutralisee === true && r.epeeQuandOnNeVisePas === true,
      `sur bouton=${r.epeeNeutralisee} ailleurs=${r.epeeQuandOnNeVisePas}`);
    v('UNE SEULE PASTILLE, EN BAS À DROITE, HORS DU CHAMP DE JEU',
      r.unSeulBouton === 1
      && r.pastilleADroite.x + r.pastilleADroite.w >= r.pastilleADroite.W - 6
      && r.pastilleADroite.y > r.pastilleADroite.H * 0.85,
      JSON.stringify(r.pastilleADroite));
    v('LE VISEUR NE SE MONTRE QU\'EN APPROCHANT DE LA PASTILLE',
      r.traitsPres > r.traitsLoin,
      `loin ${r.traitsLoin} traits, près ${r.traitsPres}`);
    v('ON QUITTE LA VR EN LA VISANT, ET AU RELÂCHEMENT',
      r.boutonVise === 0 && r.pasEncore === true && r.sortieParLaPastille === true,
      `visé=${r.boutonVise} tenu=${r.pasEncore} sortie=${r.sortieParLaPastille}`);

    v('UNE SEULE POIGNÉE NE FAIT PAS QUITTER LE CASQUE',
      r.uneSeulePoignee === true, 'sortie sur une poignée');
    v('LES DEUX POIGNÉES TENUES ENSEMBLE FONT SORTIR DU CASQUE',
      r.sortiePoignees === true && r.imagesAvantSortie >= 55 && r.imagesAvantSortie <= 75,
      `sortie=${r.sortiePoignees} après ${r.imagesAvantSortie} images`);
    v('LE PANNEAU DE SAUVEGARDE NE RESTE JAMAIS OUVERT DERRIÈRE LE CASQUE',
      r.vrQuitteeParLeCoffre === true && r.coffreFermeALEntree === true,
      `VR quittée=${r.vrQuitteeParLeCoffre} refermé à l'entrée=${r.coffreFermeALEntree}`);
    v('EN SORTANT, TOUT SE DÉFAIT ET LA PAGE REPREND LA MAIN',
      r.sessionFermee && r.pageReprend && !/QUITTER/.test(r.libelleRendu),
      `fermée=${r.sessionFermee} reprend=${r.pageReprend} bouton=${r.libelleRendu}`);

    v('aucune erreur JS', page.erreursJS.length === 0, page.erreursJS[0]);
    await page.context().close();
  },
};
