'use strict';
/* CORRECTIFS.md § 38 — trois culs-de-sac silencieux, tous mesurés dans le vrai
   jeu :

     - le SOL n'était pas sauvegardé. Le bloc lourd jeté dans les sables
       mouvants disparaissait pour de bon (décor, conservé), mais le gué qu'il
       avait comblé se rouvrait au rechargement (sol, non conservé) : quatre
       blocs dépensés, une sauvegarde, et l'Arène du Colosse devenait
       inatteignable POUR TOUJOURS ;
     - trente-trois panneaux sur trente-quatre étaient INVISIBLES — une zone de
       lecture sans poteau. Celui qui explique l'énigme du désert (« LA PORTE
       DU COLOSSE ») ne pouvait se lire que par hasard ;
     - on ressuscitait toujours à Val-des-Saules, région 1 sur 8, et le point de
       reprise ÉCRASE la sauvegarde : mourir dans la Faille renvoyait à six
       mondes de là, définitivement. */
const { pageDeJeu, nouvellePartie } = require('./outils');

module.exports = {
  nom: 'Le gué, les panneaux et le point de reprise',
  async executer({ navigateur, v }) {
    const page = await pageDeJeu(navigateur, { largeur: 420, hauteur: 900 });
    await nouvellePartie(page);

    const r = await page.evaluate(async () => {
      const dort = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      const vanne = () => {
        const va = SABLES.vanne, x = SABLES.arene.x0 + (SABLES.arene.w >> 1);
        return { x, va, yTop: va.y0 - 3,
                 blocs: [[x - 1, va.y0 - 4], [x + 1, va.y0 - 4], [x - 1, va.y0 - 3], [x + 1, va.y0 - 3]] };
      };
      const gueComble = () => { const { x, va } = vanne();
        for (let y = va.y0; y <= va.y1; y++) if (Sol(x, y) === S.SABLEMOU) return false; return true; };
      const nbBlocs = () => vanne().blocs.filter(([x, y]) => Obj(x, y) === O.BLOCLOURD).length;

      /* ---------- 1. LE GUÉ COMBLÉ SURVIT À LA SAUVEGARDE ----------
         On joue la solution pour de vrai : soulever un bloc, descendre d'une
         case, le jeter dans le gué. Trois fois. */
      Q.bracelet = true; if (!J.objets.includes('bracelet')) J.objets.push('bracelet');
      ennemis.length = 0; boss = null;
      out.blocsAuDepart = nbBlocs();
      {
        const { x, va, blocs } = vanne();
        for (let n = 0; n < 3; n++) {
          const b = blocs.find(([bx, by]) => Obj(bx, by) === O.BLOCLOURD);
          J.x = x * TS + 8; J.y = b[1] * TS + 8; J.z = 0;               // dans le couloir
          J.dir = b[0] < x ? 1 : 3;                                     // face au bloc
          brasBracelet();                                               // soulever
          let y = va.y0 - 1;                                            // se poster au bord du gué
          while (y < va.y1 && Sol(x, y + 1) !== S.SABLEMOU) y++;
          J.y = y * TS + 8; J.dir = 2;                                 // face au sud
          brasBracelet();                                              // jeter
          for (let i = 0; i < 60 && tirs.some(p => p.lourd); i++) majDivers();
        }
        out.combleEnJouant = gueComble();
        out.blocsRestants = nbBlocs();
      }
      await sauver(true); await dort(250);
      await charger(0); await dort(500);
      out.combleApresChargement = gueComble();
      out.blocsApresChargement = nbBlocs();

      /* ---------- 2. UN GUÉ NON COMBLÉ RETROUVE SES BLOCS ----------
         Une vieille partie (sans `diffS`) a pu dépenser ses quatre blocs alors
         que le gué se rouvrait : elle serait restée devant un couloir muré. */
      {
        const { x, va, blocs } = vanne();
        for (const [bx, by] of blocs) putO(bx, by, O.RIEN);
        for (let y = va.y0; y <= va.y1; y++) putS(x, y, S.SABLEMOU);
        await sauver(true); await dort(250);
        await charger(0); await dort(500);
        out.blocsRendus = nbBlocs();
      }

      /* ---------- 3. ... ET SANS MÊME RECHARGER, EN SORTANT DE LA ZONE ---- */
      {
        const { x, va, blocs } = vanne();
        for (const [bx, by] of blocs) putO(bx, by, O.RIEN);
        for (let y = va.y0; y <= va.y1; y++) putS(x, y, S.SABLEMOU);
        J.x = x * TS + 8; J.y = (va.y0 - 4) * TS + 8;   // dedans : on ne touche à rien
        majPuzzles();
        out.rienSousLesYeux = nbBlocs();
        J.x = 10 * TS + 8; J.y = (Y_SABLES + 6) * TS + 8;   // sorti de la zone
        majPuzzles();
        out.rearmeEnSortant = nbBlocs();
      }

      /* ---------- 4. UN GUÉ DÉJÀ COMBLÉ NE REPOUSSE RIEN ---------- */
      {
        const { x, va, blocs } = vanne();
        for (const [bx, by] of blocs) putO(bx, by, O.RIEN);
        for (let y = va.y0; y <= va.y1; y++) putS(x, y, S.DESERT);
        J.x = x * TS + 8; J.y = (va.y0 - 4) * TS + 8; majPuzzles();
        J.x = 10 * TS + 8; J.y = (Y_SABLES + 6) * TS + 8; majPuzzles();
        out.pasDeRepousse = nbBlocs();
      }

      /* ---------- 5. L'ARÈNE S'OUVRE VRAIMENT UNE FOIS LE GUÉ COMBLÉ ------- */
      {
        const { x, va } = vanne();
        for (let y = va.y0; y <= va.y1; y++) putS(x, y, S.DESERT);
        const vus = new Uint8Array(MW * MH);
        const depart = [x, va.y0 - 4];
        const f = [depart]; vus[depart[1] * MW + depart[0]] = 1;
        while (f.length) { const [cx, cy] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx]) continue;
            if (solide(nx * TS + 8, ny * TS + 8, 0)) continue;
            vus[ny * MW + nx] = 1; f.push([nx, ny]); } }
        const a = SABLES.arene;
        let n = 0;
        for (let y = a.y0; y < a.y0 + a.h; y++) for (let cx = a.x0; cx < a.x0 + a.w; cx++)
          if (vus[y * MW + cx]) n++;
        out.areneAtteignable = n;
      }

      /* ---------- 6. CHAQUE PANNEAU A SON POTEAU ---------- */
      await charger(0); await dort(500);
      out.nbPanneaux = panneaux.length;
      out.sansPoteau = panneaux
        .filter(s => Obj(Math.floor(s.x / TS), Math.floor(s.y / TS)) !== O.PANNEAU)
        .map(s => s.txt.slice(0, 30));
      // et le panneau qui explique l'énigme du désert se lit AVANT le couloir
      {
        const p = panneaux.find(s => s.txt.indexOf('PORTE DU COLOSSE') >= 0);
        out.panneauColosse = !!p;
        if (p) { const px = Math.floor(p.x / TS), py = Math.floor(p.y / TS);
          out.panneauColosseVisible = Obj(px, py) === O.PANNEAU;
          out.panneauColosseAvant = py < SABLES.vanne.y0 - 3; }
      }

      /* ---------- 7. UN POTEAU NE BOUCHE AUCUN PASSAGE ----------
         On compte les cases atteignables avec les poteaux, puis SANS eux : la
         différence ne peut être que les poteaux eux-mêmes. */
      Object.assign(Q, { palmes: true, portailOuvert: true, bracelet: true,
                         boomerang: true, grappin: true, fanal: true, cape: true, bottes: true });
      const flood = () => {
        const vus = new Uint8Array(MW * MH), f = [[35, 45]]; vus[45 * MW + 35] = 1; let n = 1;
        while (f.length) { const [x, y] = f.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!dansCarte(nx, ny) || vus[ny * MW + nx]) continue;
            if (solide(nx * TS + 8, ny * TS + 8, 0)) continue;
            if (Etg(nx, ny) > Etg(x, y) && Sol(nx, ny) !== S.RAMPE && Sol(x, y) !== S.RAMPE) continue;
            vus[ny * MW + nx] = 1; n++; f.push([nx, ny]); } }
        return n;
      };
      const avec = flood();
      const poteaux = [];
      for (const s of panneaux) { const x = Math.floor(s.x / TS), y = Math.floor(s.y / TS);
        if (Obj(x, y) === O.PANNEAU) { poteaux.push([x, y]); putO(x, y, O.RIEN); } }
      const sans = flood();
      for (const [x, y] of poteaux) putO(x, y, O.PANNEAU);
      out.poteauxCoupent = sans - avec - poteaux.length;   // 0 ou moins : rien de coupé

      /* ---------- 8. ON NE RESSUSCITE PAS AU VILLAGE ---------- */
      await charger(0); await dort(400);
      out.reprises = [];
      for (let i = 0; i < 8; i++) {
        const [tx, ty] = caseDeReprise(REPRISE_POS[i]);
        out.reprises.push({ i, region: regionIdx(ty), ferme: !solide(tx * TS + 8, ty * TS + 8, 0),
          sol: Sol(tx, ty), village: tx === 35 && ty === 45 });
      }
      // mourir dans le désert ramène à l'oued, pas dans la vallée
      J.x = 40 * TS + 8; J.y = (Y_SABLES + 40) * TS + 8; J.pv = 1;
      Q.fioleFee = false; Q.potions = 0;
      mourir(); await dort(300);
      await charger(0); await dort(500);
      out.apresMortDesert = { region: regionDe(J.y), y: Math.floor(J.y / TS), pv: J.pv };

      return out;
    });

    v('le gué se comble en jouant la solution', r.combleEnJouant === true,
      `blocs au départ = ${r.blocsAuDepart}, restants = ${r.blocsRestants}`);
    v('le gué comblé SURVIT au rechargement', r.combleApresChargement === true,
      'le sol repasse en sables mouvants au chargement');
    v('un gué non comblé retrouve ses quatre blocs au chargement',
      r.blocsRendus === 4, `${r.blocsRendus} bloc(s)`);
    v('rien ne se replace sous les yeux du joueur', r.rienSousLesYeux === 0,
      `${r.rienSousLesYeux} bloc(s) réapparus dans la zone`);
    v('la réserve se refait dès qu\'on sort de la zone', r.rearmeEnSortant === 4,
      `${r.rearmeEnSortant} bloc(s)`);
    v('un gué déjà comblé ne fait repousser aucun bloc', r.pasDeRepousse === 0,
      `${r.pasDeRepousse} bloc(s)`);
    v('le gué comblé ouvre bien l\'arène', r.areneAtteignable > 200,
      `${r.areneAtteignable} cases de l'arène atteignables`);

    v('les trente-quatre panneaux ont un poteau', r.sansPoteau.length === 0,
      `${r.sansPoteau.length} sans poteau : ${r.sansPoteau.join(' | ')}`);
    v('le panneau du Colosse se voit, et avant le couloir',
      r.panneauColosse && r.panneauColosseVisible && r.panneauColosseAvant,
      JSON.stringify([r.panneauColosse, r.panneauColosseVisible, r.panneauColosseAvant]));
    v('aucun poteau ne bouche un passage', r.poteauxCoupent <= 0,
      `${r.poteauxCoupent} case(s) perdues en plus des poteaux`);

    v('les huit points de reprise sont fermes et dans leur région',
      r.reprises.every(p => p.ferme && p.region === p.i),
      JSON.stringify(r.reprises.filter(p => !p.ferme || p.region !== p.i)));
    v('un seul point de reprise est le village',
      r.reprises.filter(p => p.village).length === 1,
      `${r.reprises.filter(p => p.village).length}`);
    v('mourir dans le désert ne renvoie pas au village',
      r.apresMortDesert.region === 'sables' && r.apresMortDesert.pv > 1,
      JSON.stringify(r.apresMortDesert));

    await page.context().close();
  },
};
