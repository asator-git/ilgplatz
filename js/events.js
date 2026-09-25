// ---------------------------------------------------------------
// events.js – fixe Tages-Events, Erdbeben, Finale, Abrechnung
// ---------------------------------------------------------------
'use strict';

const Events = {
  init(scene) {
    this.scene = scene;
    const C = (k, d) => parseClock(B(k, d), 0);
    this.list = [
      { id: 'americano', t: C('auftraege.americanoStart', '10:40') },
      { id: 'andi', t: C('auftraege.andiHunger', '12:30') },
      { id: 'nadja', t: C('gegner.nadjaAb', '14:00') },
      { id: 'konzertVor', t: C('events.konzertStart', '15:00') - 10, silent: true },
      { id: 'konzert', t: C('events.konzertStart', '15:00') },
      { id: 'konzertEnde', t: C('events.konzertStart', '15:00') + B('events.konzertMin', 30), silent: true },
      { id: 'doppler', t: C('events.dopplerStart', '17:00') },
      { id: 'dopplerEnde', t: C('events.dopplerEnde', '19:30'), silent: true },
      { id: 'zuhaelter', t: C('events.zuhaelterStart', '19:00') },
      { id: 'zuhaelterEnde', t: C('events.zuhaelterStart', '19:00') + B('events.zuhaelterMin', 30), silent: true },
      { id: 'nacht', t: C('events.nachtStart', '21:00') },
      { id: 'finale', t: C('events.finaleStart', '22:00') },
      { id: 'abrechnung', t: G.endMinute, noFire: true }
    ];
    const pre = B('zeit.ankuendigungVorlaufMin', 20);
    for (const e of this.list) {
      e.fired = false; e.announced = !!e.silent;
      // Debug-Start später am Tag: vergangene Events überspringen
      if (e.t < G.minute - 0.5) { e.fired = true; e.announced = true; }
      else if (e.t - pre < G.minute) e.announced = true;
    }
    this.spray = null;
    this.hubiGassiState = null;
    // Intro
    if (G.minute <= G.startMinute + 1) {
      scene.time.delayedCall(400, () => {
        const rivalInfo = T('rivalInfo.' + G.rivalId, null, '');
        UI.dialog(TL('intro', ['Es ist 8 Uhr früh am Ilgplatz.']).map(t => ({ who: '', text: fmt(t, { rivalInfo }) })), {
          onClose: () => UI.toast(T('figurTipp.' + G.figur, null, ''), '')
        });
      });
    }
  },

  E(k, v, fb) { return T('events.' + k, v, fb); },

  update(scene, dt) {
    if (G.ended) return;
    const m = G.minute;
    const pre = B('zeit.ankuendigungVorlaufMin', 20);
    for (const e of this.list) {
      if (!e.announced && m >= e.t - pre) {
        e.announced = true;
        const txt = this.E(e.id + '.ankuendigung', { zeit: clockStr(e.t) }, '');
        if (txt) { UI.banner(txt, 5000, 'info'); Sfx.play('announce'); }
      }
      if (!e.fired && !e.noFire && m >= e.t) { e.fired = true; this.fire(scene, e.id); }
    }
    this.updateHubiGassi(scene);
    this.updateDoppler(scene);
    this.updatePanic(scene);
    // Quelle spritzt nach dem Erdbeben
    if (G.flags.spritzenBis && m < G.flags.spritzenBis) {
      const f = FOUNTAIN_PX();
      for (const a of [scene.player].concat(scene.npcs)) {
        if (!a.present || a.isDog) continue;
        if (['normal', 'panic', 'laughing'].includes(a.state) && dist(a.x, a.y, f.x, f.y) < 42) {
          a.setState('wet', B('spieler.nassMin', 12));
          if (a === scene.player) { UI.toast(this.E('nass', null, 'Waschelnass! Halbe Geschwindigkeit.'), 'bad'); Sfx.play('splash'); }
        }
      }
    } else if (this.spray) { this.spray.stop(); this.spray = null; }
    // Opa-Spruch beim Zuhälter-Event
    const opa = scene.actors.opa;
    opa.lineOverride = G.flags.zuhaelter ? () => T('events.zuhaelter.zuschauer', null, 'Früher war das da alles Rotlicht. Jetzt kommen die Bobos und trinken 6-Euro-Kaffee.') : null;
    const s1 = scene.actors.stern1, wirt = scene.actors.wirt;
    const night = m >= parseClock(B('events.nachtStart', '21:00'), 1260);
    s1.lineOverride = night ? () => TN('npc.stern1.nacht', s1.talkIdx++) : null;
    wirt.lineOverride = night ? () => TN('npc.wirt.offen', wirt.talkIdx++) : null;
  },

  fire(scene, id) {
    const b = (k, ms, cls) => { const t = this.E(k, null, ''); if (t) UI.banner(t, ms || 5000, cls); };
    switch (id) {
      case 'americano':
        Quests.start('americano');
        b(G.figur === 'hubi' ? 'americano.startHubi' : 'americano.start', 6000);
        Sfx.play('siren');
        break;
      case 'andi':
        Quests.start('andi');
        b(G.figur === 'andi' ? 'andi.startSelbst' : 'andi.start', 5000);
        break;
      case 'nadja':
        b(G.figur === 'hubi' ? 'nadja.startHubi' : 'nadja.start', 5000);
        Sfx.play('siren');
        break;
      case 'konzertVor': {
        // Freunde sammeln sich auf der Wiese
        const spots = shuffle(LOC.meadow);
        let i = 0;
        for (const fid of FRIENDS) {
          const a = scene.actors[fid];
          if (!a || a === scene.player || fid === 'hubi' || a.follow) continue;
          const s = spots[i++ % spots.length];
          a.override = { tx: s.x, ty: s.y, until: parseClock(B('events.konzertStart', '15:00'), 900) + B('events.konzertMin', 30) + 5 };
          a.path = null;
        }
        break;
      }
      case 'konzert': {
        G.flags.konzert = true;
        const e = scene.actors.erwin;
        if (Quests.isActive('erwin')) { QDEF.erwin.onEnd(scene); Quests.complete('erwin', B('auftraege.erwinAblenken', 30), 0, this.E('konzert.erwinWeg', null, 'Erwin ist zum Konzert abgerauscht – Auftrag erledigt!')); }
        e.customUpdate = null;
        e.override = { tx: LOC.concert.x, ty: LOC.concert.y, until: parseClock(B('events.konzertStart', '15:00'), 900) + B('events.konzertMin', 30) };
        e.path = null; e.talkIdx = 0;
        b('konzert.start', 6000);
        Sfx.play('guitar');
        break;
      }
      case 'konzertEnde':
        G.flags.konzert = false;
        b('konzert.ende', 4000, 'info');
        break;
      case 'doppler': {
        const d = scene.actors.doppler;
        d.setPresent(true); d.setTile(37, 20);
        d.data.nextPuke = G.minute + 1; d.data.led = false; d.data.done = false;
        G.flags.doppler = true;
        b('doppler.start', 5000);
        break;
      }
      case 'dopplerEnde': {
        G.flags.doppler = false;
        const d = scene.actors.doppler;
        if (!d.data.done) { d.follow = null; d.setPresent(false); }
        break;
      }
      case 'zuhaelter': {
        G.flags.zuhaelter = true;
        for (let i = 1; i <= 4; i++) { const z = scene.actors['zuh' + i]; z.setPresent(true); z.setTile(LOC.fightZone.x + (i % 2 ? -1 : 1), LOC.fightZone.y + (i > 2 ? 1 : 0)); }
        const opa = scene.actors.opa;
        opa.override = { tx: LOC.opaSpot.x, ty: LOC.opaSpot.y, until: G.minute + B('events.zuhaelterMin', 30) + 15 };
        b('zuhaelter.start', 6000);
        Sfx.play('punch');
        break;
      }
      case 'zuhaelterEnde':
        G.flags.zuhaelter = false;
        for (let i = 1; i <= 4; i++) scene.actors['zuh' + i].setPresent(false);
        b('zuhaelter.ende', 3500, 'info');
        break;
      case 'nacht': {
        const r = scene.actors.rasiererin;
        r.setPresent(true); r.setTile(18, 21); r.homeX = r.x; r.homeY = r.y;
        b('nacht.start', 5000, 'info');
        UI.dialog(TL('events.nacht.zitat', ['Im Stuwerviertel in da Nocht.']).map(t => ({ who: T('events.nacht.zitatWer', null, 'Nino aus Wien'), text: t })));
        break;
      }
      case 'finale':
        b(G.rep >= B('events.kleberAb', 450) ? 'finale.startGut' : 'finale.startSchwach', 6500);
        Sfx.play('announce');
        break;
    }
  },

  // ---- Erdbeben (Americano verpasst) ----
  earthquake(scene) {
    const secs = B('auftraege.erdbebenSek', 5);
    scene.cameras.main.shake(secs * 1000, 0.012);
    Sfx.play('rumble');
    UI.banner(this.E('erdbeben.text', null, 'ERDBEBEN! Hubi ohne Kaffee ist eine Naturgewalt.'), 5000);
    scene.addRep(-B('auftraege.erdbebenVerlust', 40), this.E('erdbeben.kurz', null, 'Erdbeben'));
    // Bänke fliegen um
    for (const bnc of scene.objs.benches) {
      scene.tweens.add({ targets: bnc, angle: rnd(-100, 100), x: bnc.x + rnd(-6, 6), y: bnc.y + rnd(-4, 4), duration: 600, ease: 'Bounce.easeOut' });
    }
    // Panik
    for (const a of scene.npcs) {
      if (!a.present || a.isDog || a.isImmobile() || a.kind === 'shop') continue;
      a.setState('panic', 0, 10000);
      a.path = null;
    }
    // Quelle spritzt
    G.flags.spritzenBis = G.minute + B('auftraege.quelleSpritztMin', 5);
    const f = FOUNTAIN_PX();
    try {
      this.spray = scene.add.particles(f.x, f.y - 10, 'px', {
        speed: { min: 30, max: 90 }, angle: { min: 0, max: 360 }, lifespan: 700, scale: { start: 1, end: 0.3 },
        tint: [0x4cc9f0, 0x90e0ef, 0xcaf0f8], frequency: 30, quantity: 3, gravityY: 80
      }).setDepth(9000);
    } catch (e) { this.spray = null; }
    // Hubi ist grantig
    const h = scene.actors.hubi;
    if (h !== scene.player && h.present) { h.setState('grantig', 30); scene.say(h, this.E('erdbeben.hubi', null, 'KA KAFFEE! KA GNADE!'), 3000); }
  },

  updatePanic(scene) {
    for (const a of scene.npcs) {
      if (a.state !== 'panic' || a.path) continue;
      const f = randomWalkableNear(scene.grid, a.tx, a.ty, 4);
      a.goToTile(f.x, f.y);
    }
  },

  // ---- Hubi geht Gassi ----
  hubiGassi(scene) {
    const h = scene.actors.hubi;
    if (h === scene.player) return;
    if (G.companion) Abilities.endCompanion(scene);
    h.data.gassi = true;
    h.override = { tx: 19, ty: 1, until: 99999 };
    h.path = null;
    this.hubiGassiState = { phase: 'weg', back: G.minute + 60 };
  },

  updateHubiGassi(scene) {
    const s = this.hubiGassiState;
    if (!s) return;
    const h = scene.actors.hubi, m = scene.actors.mascha;
    if (s.phase === 'weg' && h.atTile(19, 1, 1)) { h.setPresent(false); m.setPresent(false); s.phase = 'aus'; }
    if (s.phase === 'aus' && G.minute >= s.back) {
      h.setPresent(true); m.setPresent(true);
      h.setTile(19, 1); m.setTile(20, 1);
      h.override = null; h.data.gassi = false; h.idleUntil = 0;
      this.hubiGassiState = null;
    }
  },

  // ---- Doppler-Frau ----
  optionsFor(scene, a) {
    if (a.id === 'schlosser') return this.kleberOption(scene);
    if (a.id === 'doppler' && !a.data.led && !a.data.done) {
      return [{ label: this.E('doppler.fuehren', null, 'Komm, i bring di wohin.'), fn: () => {
        a.data.led = true; a.follow = scene.player; a.followDist = 16; a.path = null;
        scene.say(a, this.E('doppler.jaa', null, 'Oh, a Kavalier! *hicks*'), 2500);
        UI.toast(this.E('doppler.hinweis', null, 'Führ sie zu einer Bank (+25) oder ins Café (+40, aber Daniel wird sauer).'), '');
      } }];
    }
    return [];
  },

  updateDoppler(scene) {
    const d = scene.actors.doppler;
    if (!d.present || !d.data.led || d.data.done) return;
    if (isCafeFloor(d.x, d.y) && tileAt(scene.grid, d.x, d.y) !== TI.DOOR) {
      d.data.done = true; d.follow = null; d.path = null; d.routine = null;
      d.setState('sitting');
      G.flags.dopplerImCafe = true;
      scene.addRep(B('events.dopplerCafe', 40), this.E('doppler.cafeKurz', null, 'Doppler-Frau im Café'), { quest: true });
      scene.say(scene.actors.daniel, this.E('doppler.daniel', null, 'DIE da? In MEINER Society?! Für euch kostet heute alles mehr!'), 4000);
      UI.toast(this.E('doppler.teurer', null, 'Daniel ist sauer: Preise +50 % für den Rest des Tages.'), 'bad');
      G.questsDone++;
      return;
    }
    for (let i = 0; i < LOC.benches.length; i++) {
      const c = benchPx(i);
      if (dist(d.x, d.y, c.x, c.y) < 26) {
        d.data.done = true; d.follow = null; d.path = null; d.routine = null;
        d.setPos(c.x, c.y - 2);
        d.setState('sitting');
        scene.addRep(B('events.dopplerBank', 25), this.E('doppler.bankKurz', null, 'Doppler-Frau aufs Bankerl'), { quest: true });
        scene.say(d, this.E('doppler.bankDanke', null, 'A Bankerl! Du bist a Schatz! *schnarch*'), 3500);
        G.questsDone++;
        return;
      }
    }
  },

  // ---- Finale: Kleber & Tesla-Reifen ----
  interactables(scene) {
    const l = [];
    const m = G.minute;
    if (m < parseClock(B('events.finaleStart', '22:00'), 1320) || G.ended) return l;
    if (scene.hasItem('kleber') && !G.flags.geklebt) {
      const g = LOC.glue;
      l.push({ x: g.x * TILE + 8, y: g.y * TILE + 10, r: 24, prio: -10, label: this.E('finale.kleben', null, 'An den Boden picken!'), fn: () => this.glue(scene) });
    }
    if (G.marcoHired && !G.flags.reifen) {
      const t = LOC.tesla;
      l.push({ x: (t.x + 1) * TILE, y: (t.y + 0.5) * TILE, r: 34, prio: -30, label: this.E('finale.reifen', null, 'Tesla-Reifen aufstechen'), fn: () => this.tires(scene) });
    }
    return l;
  },

  kleberOption(scene) {
    const m = G.minute;
    if (m < parseClock(B('events.finaleStart', '22:00'), 1320) || G.flags.geklebt || scene.hasItem('kleber')) return [];
    const need = B('events.kleberAb', 450);
    const c = B('preise.kleber', 30);
    return [{ label: this.E('finale.kleberKaufen', { preis: euro(c), n: need }, 'Kleber kaufen ({preis})'), disabled: G.rep < need, why: this.E('finale.kleberZuWenig', { n: need }, 'Kleber gibt\'s erst ab {n} Ansehen.'), fn: () => {
      if (!scene.pay(c, this.E('finale.kleberKurz', null, 'Kleber'))) return;
      scene.giveItem('kleber');
      UI.dialog([{ who: scene.actors.schlosser.name, text: this.E('finale.kleberText', null, 'Superkleber. Hält ewig. Frag ned, wofür i den brauch.') }]);
    } }];
  },

  glue(scene) {
    const p = scene.player;
    scene.takeItem('kleber');
    G.flags.geklebt = true;
    p.setState('glued', Math.max(1, G.endMinute - G.minute));
    Sfx.play('cheer');
    scene.addRep(B('events.kleberAnsehen', 100), this.E('finale.klebenKurz', null, 'Am Boden angepickt'), { quest: true });
    G.questsDone++;
    UI.sms(scene.actors.daniel.name, this.E('finale.sms', null, 'Hiermit kündige ich den Boden. Fristlos. LG Daniel'), 6000);
    Sfx.play('sms');
    for (const a of scene.npcs) if (a.present && !a.isDog && isCafeFloor(a.x, a.y) && a.id !== 'daniel') { a.setState('laughing', 0, 8000); scene.say(a, this.E('finale.jubel', null, 'BRAVO!'), 3000); }
    UI.banner(this.E('finale.klebenBanner', null, 'Du klebst am Boden! Das ganze Café jubelt!'), 6000, 'info');
  },

  tires(scene) {
    G.flags.reifen = true;
    Sfx.play('punch');
    scene.addRep(B('events.reifenAnsehen', 80), this.E('finale.reifenKurz', null, 'Tesla-Reifen'), { quest: true });
    G.questsDone++;
    scene.say(scene.actors.marco, this.E('finale.marcoWache', null, 'Ich pass auf.'), 2500);
    if (Math.random() < B('events.reifenKiwaraChance', 0.5)) {
      scene.time.delayedCall(1800, () => {
        Sfx.play('siren');
        scene.addRep(-B('events.reifenKiwaraVerlust', 60), this.E('finale.kiwaraKurz', null, 'Kiwara beim Tesla'));
        UI.dialog([{ who: T('npc.kiwara.name', null, 'Kiwara'), text: this.E('finale.kiwara', null, 'Halt! Sachbeschädigung! Das gibt a Anzeige!') }]);
      });
    } else UI.banner(this.E('finale.reifenGlueck', null, 'Pssssst… Keiner hat was gesehen. Der Tesla steht schief.'), 4000, 'info');
  },

  // ---- 23:00 Abrechnung ----
  finale(scene) {
    const p = scene.player;
    UI.closeAllDialogs();
    UI.hideOverlay();
    UI.unfade();
    p.onStateEnd = null;
    if (p.state === 'hospital') { p.sprite.setVisible(true); p.label.setVisible(true); }
    p.setState('normal');
    UI.setPrompt(null);
    const win = G.rep > G.rivalRep;
    Sfx.play(win ? 'cheer' : 'bad');
    UI.fade(this.E('abrechnung.text', null, '23:00 – Abrechnung am Ilgplatz.\nDas Grätzl zählt…'));
    scene.cameras.main.pan(MCX * TILE, MCY * TILE, 1500, 'Sine.easeInOut');
    if (win) this.confetti(scene);
    scene.time.delayedCall(2600, () => {
      UI.unfade();
      const rank = rankFor(G.rep);
      let artHtml;
      const fig = G.figur;
      if (win) {
        makeCharacter(scene, 'ch_mayor', Object.assign({}, CHAR_STYLES[fig], { extra: (CHAR_STYLES[fig].extra || []).filter(x => x !== 'mayorchain').concat(['mayorchain']) }));
        artHtml = `<img src="${textureDataURL(scene, 'ch_mayor', 0, 6)}" style="height:144px;image-rendering:pixelated">`;
      } else {
        artHtml = `<img src="${textureDataURL(scene, 'ch_' + G.rivalId, 0, 6)}" style="height:144px;image-rendering:pixelated"><img src="${textureDataURL(scene, 'item_americano', undefined, 5)}" style="height:80px;image-rendering:pixelated;vertical-align:top">`;
      }
      UI.showEnd({
        win, rep: G.rep, rivalRep: G.rivalRep, rivalName: G.rivalName, rank, figur: fig,
        questsDone: G.questsDone,
        text: win ? T('ende.siegText', { rivale: G.rivalName }, 'Du bist Bürgermeister vom Stuwerviertel!') : T('ende.niederlageText', { rivale: G.rivalName }, '{rivale} hebt grinsend den Americano.'),
        defaultName: T('figuren.' + fig + '.name', null, fig),
        artHtml
      }, () => backToTitle());
    });
  },

  confetti(scene) {
    try {
      const cam = scene.cameras.main;
      const w = cam.width, h = cam.height, z = cam.zoom;
      const e = scene.add.particles(0, 0, 'px', {
        x: { min: w / 2 - w / (2 * z), max: w / 2 + w / (2 * z) }, y: h / 2 - h / (2 * z) - 6,
        speedY: { min: 30, max: 90 }, speedX: { min: -30, max: 30 }, lifespan: 5000,
        tint: [0xffd166, 0xef476f, 0x06d6a0, 0x118ab2, 0xffffff], scale: { min: 0.6, max: 1.4 },
        rotate: { min: 0, max: 360 }, frequency: 25, quantity: 3
      }).setScrollFactor(0).setDepth(40000);
      scene.time.delayedCall(9000, () => e.stop());
    } catch (err) { /* egal */ }
  }
};
