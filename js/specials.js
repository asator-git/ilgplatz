// ---------------------------------------------------------------
// specials.js – Bernd (Dezentral-Drache), Marcos Bier-Ausraster,
// Geschosse, Hausmasta
// ---------------------------------------------------------------
'use strict';

const FOOD_ITEMS = ['essen', 'kipferl', 'pizza', 'wings', 'semmel'];

const Specials = {
  shots: [],

  init(scene) {
    this.scene = scene;
    this.shots = [];
    this.invulnUntil = 0;
    this.waterCd = 0;
    // Marco dreht einmal am Tag durch – irgendwann am späten Nachmittag
    const a = parseClock(B('marco.wildFrueh', '17:00'), 1020), b = parseClock(B('marco.wildSpaet', '20:30'), 1230);
    G.flags.marcoWildAt = rnd(a, b);
    // Bernd
    const bernd = scene.actors.bernd;
    if (bernd) {
      bernd.isEnemy = true;
      bernd.talkRep = false;
      bernd.data.anger = 0;
      bernd.data.nextRage = 0;
      bernd.onTalked = () => this.annoyBernd(scene, 1, 'reden');
      bernd.lineOverride = () => {
        if (bernd.state !== 'normal') return null;
        const night = G.minute >= parseClock(B('events.nachtStart', '21:00'), 1260);
        return TN('npc.bernd.' + (night ? 'offen' : 'normal'), bernd.talkIdx++);
      };
    }
    // Hausmasta grüßt alle und isst
    const h = scene.actors.hausmasta;
    if (h) {
      h.data.nextGreet = 0;
      h.customUpdate = () => { this.hausmastaGreets(scene, h); return false; };
    }
  },

  // ---- Geschosse ----
  shoot(x, y, tx, ty, opts) {
    const d = Math.hypot(tx - x, ty - y) || 1;
    const sp = opts.speed || 90;
    const s = this.scene.add.image(x, y, opts.key).setDepth(29500);
    this.shots.push({ s, x, y, vx: (tx - x) / d * sp, vy: (ty - y) / d * sp, until: G.realMs + (opts.life || 2500), opts });
  },

  updateShots(scene, dt) {
    const p = scene.player;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const sh = this.shots[i];
      sh.x += sh.vx * dt / 1000; sh.y += sh.vy * dt / 1000;
      sh.s.setPosition(Math.round(sh.x), Math.round(sh.y)).setRotation(sh.s.rotation + dt / 120);
      let hit = false;
      if (G.realMs > sh.until || isSolidPx(scene.grid, sh.x, sh.y)) hit = true;
      else if (sh.opts.hitsPlayer && G.realMs > this.invulnUntil && ['normal', 'wet', 'laughing'].includes(p.state) && !UI.isBlocking()
        && !isCafeFloor(p.x, p.y) && dist(sh.x, sh.y, p.x, p.y - 8) < 9) { hit = true; if (sh.opts.onHit) sh.opts.onHit(); }
      else if (sh.opts.target && sh.opts.target.present && dist(sh.x, sh.y, sh.opts.target.x, sh.opts.target.y - 10) < 11) { hit = true; if (sh.opts.onHit) sh.opts.onHit(); }
      if (hit) { sh.s.destroy(); this.shots.splice(i, 1); }
    }
  },

  playerHit(scene, loss, reason, fromX, fromY) {
    this.invulnUntil = G.realMs + 1000;
    scene.addRep(-loss, reason);
    scene.pushPlayer(fromX, fromY, 1);
    scene.player.flash = G.realMs + 400;
    scene.cameras.main.shake(180, 0.006);
    Sfx.play('hurt');
  },

  // ---- Bernd, der Dezentral-Drache ----
  annoyBernd(scene, n, why) {
    const b = scene.actors.bernd;
    if (!b || G.ended || G.flags.berndWut || G.minute < b.data.nextRage) return;
    b.data.anger += n;
    const max = B('bernd.wutGrenze', 3);
    if (b.data.anger >= max) { this.startBernd(scene); return; }
    scene.say(b, TN('npc.bernd.gereizt', b.data.anger - 1), 2500);
    UI.toast(T('bernd.wirdGrantiger', { n: b.data.anger, max }, 'Bernd wird grantiger ({n}/{max})'), 'bad');
  },

  startBernd(scene) {
    const b = scene.actors.bernd;
    b.data.anger = 0;
    G.flags.berndWut = { until: G.realMs + B('bernd.dauerSek', 30) * 1000, hits: 0, nextFire: G.realMs + 1200 };
    b.clearState();
    b.speed = B('bernd.tempo', 50);
    b.path = null;
    b.customUpdate = (dt) => this.berndRage(scene, b, dt);
    Quests.start('bernd');
    UI.banner(T('bernd.start', null, 'BERND IST TODESGRANTIG! Er speit Feuer – weich aus!'), 4000);
    Sfx.play('siren');
    scene.say(b, T('bernd.brueller', null, 'RAAAAH!'), 2000);
  },

  berndRage(scene, b, dt) {
    const w = G.flags.berndWut;
    const p = scene.player;
    b.extraIcon = 'ic_fire';
    if (!w || G.realMs >= w.until || G.ended) { this.endBernd(scene); return true; }
    const d = dist(b.x, b.y, p.x, p.y);
    const safe = isCafeFloor(p.x, p.y);
    if (!safe && d > 18) {
      if (d < 50) { b.path = null; b.moving = b.stepToward(p.x, p.y, dt); }
      else {
        if (!b.path || G.realMs - (b.data.lastPath || 0) > 600) { b.data.lastPath = G.realMs; b.goToPx(p.x, p.y); }
        b.moving = b.stepPath(dt) || b.stepToward(p.x, p.y, dt);
      }
    }
    if (G.realMs >= w.nextFire && d < 160 && !safe && lineOfSight(scene.grid, b.x, b.y - 8, p.x, p.y - 8)) {
      w.nextFire = G.realMs + B('bernd.feuerAlleMs', 1100);
      // Leicht vorhalten, damit man sich bewegen muss
      const a = Input.axis();
      const lead = B('bernd.vorhalten', 14);
      this.shoot(b.x, b.y - 10, p.x + a.x * lead, p.y - 8 + a.y * lead, {
        key: 'fireball', speed: B('bernd.feuerTempo', 100), life: 2200, hitsPlayer: true,
        onHit: () => { w.hits++; this.playerHit(scene, B('bernd.trefferVerlust', 8), T('bernd.getroffen', null, 'Angekokelt'), b.x, b.y); }
      });
      Sfx.play('punch');
      if (Math.random() < 0.35) scene.say(b, TN('npc.bernd.wut', b.talkIdx++), 1500);
    }
    return true;
  },

  endBernd(scene) {
    const b = scene.actors.bernd;
    const w = G.flags.berndWut;
    G.flags.berndWut = null;
    b.customUpdate = null; b.extraIcon = null; b.speed = 24; b.path = null; b.idleUntil = 0;
    b.data.nextRage = G.minute + B('bernd.pauseMin', 45);
    if (!w) return;
    scene.say(b, T('bernd.ende', null, 'Pfff. Geh ma aus da Sonn.'), 3000);
    if (Quests.isActive('bernd')) {
      const good = w.hits <= B('bernd.maxTrefferFuerBonus', 2);
      Quests.complete('bernd', good ? B('bernd.ueberlebt', 20) : B('bernd.ueberlebtSchlecht', 5), 0,
        good ? T('bernd.gut', null, 'Bernd überlebt! Kaum angekokelt.') : T('bernd.schlecht', { n: w.hits }, 'Überlebt – aber {n}× angekokelt.'));
    }
  },

  updateBernd(scene, dt) {
    const b = scene.actors.bernd, p = scene.player;
    if (!b || !b.present || G.flags.berndWut || G.ended || G.minute < b.data.nextRage) return;
    const d = dist(b.x, b.y, p.x, p.y);
    // Zu oft an ihm vorbeigehen nervt
    if (d < 22 && p.moving && G.realMs > (b.data.passCd || 0) && !UI.isBlocking()) {
      b.data.passCd = G.realMs + B('bernd.vorbeiCooldownSek', 8) * 1000;
      this.annoyBernd(scene, 1, 'vorbei');
    }
    // Manchmal rennt er einem einfach so nach
    if (d < 80 && !UI.isBlocking() && Math.random() < dt / 1000 * B('bernd.zufallProSek', 0.012)) this.startBernd(scene);
    // Wut verraucht langsam
    if (b.data.anger > 0 && G.minute - (b.data.lastCool || G.minute) > 30) { b.data.anger--; b.data.lastCool = G.minute; }
    if (!b.data.lastCool) b.data.lastCool = G.minute;
  },

  // ---- Marco beim Buffalo, Bier-Ausraster ----
  marcoAtBar() {
    const h = Math.floor(G.minute / 60);
    return h >= 11 && h <= 21 && h % 2 === 1;
  },

  startMarcoWild(scene) {
    const m = scene.actors.marco;
    G.flags.marcoWildDone = true;
    G.flags.marcoWild = { until: G.minute + B('marco.wildMin', 45), hits: 0, nextThrow: G.realMs + 1500 };
    m.clearState(); m.follow = null; m.path = null; m.speed = B('marco.wildTempo', 55);
    Quests.start('marcoWild');
    UI.banner(T('marco.start', null, 'MARCO HAT ZU VIEL BIER! Er schmeißt beim Buffalo mit Flaschen – die Kiwara rücken an!'), 5000);
    Sfx.play('siren');
    scene.say(m, T('marco.brueller', null, 'ICH HAB SCHON MAL…!'), 2500);
    // Zwei Kiwara kommen zum Einsatz
    for (const id of ['kiwara1', 'kiwara2']) {
      const k = scene.actors[id];
      if (!k.present) { k.setPresent(true); const e = LOC.streetEnds.schrotzberg; k.setTile(e.x, e.y); }
      k.data.eventCop = true;
    }
    for (const a of scene.npcs) if (a.present && !a.isDog && a.kind !== 'shop' && !a.isKiwara && a !== m && dist(a.x, a.y, m.x, m.y) < 80) { a.setState('panic', 0, 8000); a.path = null; }
  },

  marcoRage(scene, m, dt) {
    const w = G.flags.marcoWild;
    const p = scene.player;
    m.extraIcon = 'ic_beer';
    const c = LOC.marcoBar;
    const cx = c.x * TILE + 8, cy = c.y * TILE + 12;
    if (!m.data.goal || G.realMs > m.data.goalT || dist(m.x, m.y, m.data.goal.x, m.data.goal.y) < 3) {
      const f = randomWalkableNear(scene.grid, c.x, c.y, 4);
      m.data.goal = { x: f.x * TILE + 8, y: f.y * TILE + 13 }; m.data.goalT = G.realMs + 1500;
    }
    m.moving = m.stepToward(m.data.goal.x, m.data.goal.y, dt);
    if (G.realMs >= w.nextThrow) {
      w.nextThrow = G.realMs + B('marco.wurfAlleMs', 1300);
      const d = dist(m.x, m.y, p.x, p.y);
      if (d < 150 && !isCafeFloor(p.x, p.y)) {
        this.shoot(m.x, m.y - 14, p.x, p.y - 8, {
          key: 'bottle', speed: B('marco.flaschenTempo', 95), life: 2000, hitsPlayer: true,
          onHit: () => this.playerHit(scene, B('marco.flascheVerlust', 5), T('marco.getroffen', null, 'Bierflasche'), m.x, m.y)
        });
      } else {
        const a = Math.random() * Math.PI * 2;
        this.shoot(m.x, m.y - 14, m.x + Math.cos(a) * 60, m.y + Math.sin(a) * 60, { key: 'bottle', speed: 80, life: 900 });
      }
      if (Math.random() < 0.3) scene.say(m, TN('npc.marco.wild', m.talkIdx++), 1500);
    }
    void cx; void cy;
    return true;
  },

  // Spieler spritzt mit Eiswasser
  shootWater(scene) {
    const m = scene.actors.marco, p = scene.player;
    const w = G.flags.marcoWild;
    if (!w || G.realMs < this.waterCd) return true;
    const d = dist(m.x, m.y, p.x, p.y);
    if (d > B('marco.wasserReichweite', 140)) { UI.toast(T('marco.zuWeit', null, 'Zu weit weg – geh näher an Marco ran!'), ''); this.waterCd = G.realMs + 500; return true; }
    this.waterCd = G.realMs + B('marco.wasserCooldownMs', 450);
    Sfx.play('splash');
    // Etwas Streuung – je weiter weg, desto ungenauer
    const spread = B('marco.streuung', 0.18) * (0.5 + d / 140);
    const ang = Math.atan2(m.y - p.y, m.x - p.x) + rnd(-spread, spread);
    this.shoot(p.x, p.y - 10, p.x + Math.cos(ang) * 100, p.y - 10 + Math.sin(ang) * 100, {
      key: 'waterdrop', speed: B('marco.wasserTempo', 170), life: 1200, target: m,
      onHit: () => {
        if (!G.flags.marcoWild) return;
        w.hits++;
        m.flash = G.realMs + 300;
        scene.say(m, TN('npc.marco.nass', m.talkIdx++), 1200);
        if (w.hits >= B('marco.wasserTreffer', 6)) this.endMarcoWild(scene, true);
      }
    });
    return true;
  },

  endMarcoWild(scene, success) {
    const m = scene.actors.marco;
    G.flags.marcoWild = null;
    m.customUpdate = (dt) => Enemies.marcoUpdate(m, dt);
    m.extraIcon = null; m.speed = B('gegner.marcoTempo', 22);
    while (scene.takeItem('wasserpistole')) { /* zurück an die Kiwara */ }
    m.setState('down', 3);
    G.flags.marcoWegBis = G.minute + B('marco.ausnuechternMin', 120);
    scene.time.delayedCall(2500, () => { if (G.flags.marcoWegBis && G.minute < G.flags.marcoWegBis) m.setPresent(false); });
    for (const id of ['kiwara1', 'kiwara2']) {
      const k = scene.actors[id]; k.data.eventCop = false;
      if (G.minute < parseClock(B('gegner.kiwaraAb', '19:00'), 1140)) k.setPresent(false);
    }
    if (success) Quests.complete('marcoWild', B('marco.belohnung', 40), 0, T('marco.erfolg', null, 'Marco ist abgekühlt und schläft seinen Rausch aus. Die Kiwara sagen Danke!'));
    else Quests.fail('marcoWild', T('marco.verpasst', null, 'Die Kiwara haben Marco selbst eingefangen – ohne dich.'));
  },

  updateMarco(scene, dt) {
    const m = scene.actors.marco, p = scene.player;
    if (G.ended) return;
    if (G.flags.marcoWegBis && G.minute >= G.flags.marcoWegBis) {
      G.flags.marcoWegBis = 0;
      m.setPresent(true); m.clearState(); m.setTile(LOC.marcoHome.x, LOC.marcoHome.y);
    }
    const w = G.flags.marcoWild;
    if (w) {
      if (G.minute >= w.until) { this.endMarcoWild(scene, false); return; }
      // Kiwara geben die Wasserpistole
      if (!scene.hasItem('wasserpistole')) {
        for (const id of ['kiwara1', 'kiwara2']) {
          const k = scene.actors[id];
          if (k.present && dist(k.x, k.y, p.x, p.y) < 30 && !UI.isBlocking()) {
            scene.giveItem('wasserpistole');
            UI.dialog([{ who: k.name, text: T('marco.kiwaraHilfe', null, 'Sie da! Helfen S\' uns! Da, a Wasserpistole mit Eiswasser – kühlen S\' den Herrn ab! Leertaste zum Spritzen.') }]);
            break;
          }
        }
      }
      return;
    }
    if (!G.flags.marcoWildDone && !G.marcoHired && m.present && !m.isImmobile() && G.minute >= G.flags.marcoWildAt && this.marcoAtBar() && m.atTile(LOC.marcoBar.x, LOC.marcoBar.y, 1)) this.startMarcoWild(scene);
  },

  // Kiwara beim Marco-Einsatz: umkreisen ihn
  copDuty(k, dt) {
    const m = this.scene.actors.marco;
    const d = dist(k.x, k.y, m.x, m.y);
    if (d > 55) {
      if (!k.path || G.realMs - (k.data.lastPath || 0) > 800) { k.data.lastPath = G.realMs; k.goToPx(m.x, m.y); }
      k.moving = k.stepPath(dt) || k.stepToward(m.x, m.y, dt);
    } else if (d < 35) {
      k.moving = k.stepToward(k.x + (k.x - m.x), k.y + (k.y - m.y), dt);
    }
    k.extraIcon = 'ic_excl';
    return true;
  },

  // ---- Hausmasta ----
  hausmastaGreets(scene, h) {
    if (G.realMs < h.data.nextGreet || h.bubble) return;
    let near = null;
    for (const a of [scene.player].concat(scene.npcs)) {
      if (a === h || !a.present || a.isDog) continue;
      if (dist(a.x, a.y, h.x, h.y) < 30) { near = a; break; }
    }
    if (near && near.id !== h.data.lastGreeted) {
      h.data.lastGreeted = near.id;
      scene.say(h, T('npc.hausmasta.gruss', { name: near.name }, 'Grüß Gott, {name}!'), 2200);
      h.data.nextGreet = G.realMs + 3500;
    } else {
      if (Math.random() < 0.5) scene.say(h, T('npc.hausmasta.mampf', null, '*mampf*'), 1500);
      h.data.nextGreet = G.realMs + rnd(4000, 8000);
    }
  },

  // ---- Ulli & Erwin: Beziehungsdrama im Stundentakt ----
  updateUlli(scene) {
    const u = scene.actors.ulli, e = scene.actors.erwin;
    if (!u || !e) return;
    if (!G.flags.ulliNext) { G.flags.ulliNext = G.minute + rnd(60, 120); G.flags.ulliZusammen = true; }
    if (G.minute >= G.flags.ulliNext) {
      G.flags.ulliNext = G.minute + rnd(B('ulli.dramaMinMin', 90), B('ulli.dramaMaxMin', 180));
      G.flags.ulliZusammen = !G.flags.ulliZusammen;
      const k = G.flags.ulliZusammen ? 'wiederZusammen' : 'getrennt';
      UI.toast(T('ulli.' + k, null, k), '');
      scene.say(u, TN('npc.ulli.' + k, u.talkIdx++), 3000);
      scene.say(e, TN('npc.erwin.' + k, e.talkIdx), 3000);
    }
    const together = G.flags.ulliZusammen && !G.flags.konzert && !(Quests.isActive('ulli') || Quests.isActive('erwin'));
    if (together && e.present && !u.follow) { u.follow = e; u.followDist = 16; u.path = null; }
    if (!together && u.follow) { u.follow = null; u.path = null; u.idleUntil = 0; }
    // Sie liest ihm ChatGPT-Feedback vor, er redet übers Auto …
    if (u.present && !u.bubble && Math.random() < 1 / 400) {
      if (u.follow === e) { scene.say(u, TN('npc.ulli.chatgpt', u.talkIdx++), 3500); scene.time.delayedCall(3600, () => scene.say(e, TN('npc.erwin.antwortUlli', e.talkIdx++), 3000)); }
      else scene.say(u, TN('npc.ulli.allein', u.talkIdx++), 3000);
    }
  },

  // ---- Café-Gäste wollen in Hubis Büro aufs Klo ----
  updateKlo(scene) {
    if (G.ended) return;
    if (!G.flags.kloNext) G.flags.kloNext = Math.max(G.minute + 20, parseClock('09:00', 540));
    const off = LOC.office;
    const front = { x: off.x - 1, y: off.y };
    if (G.minute >= G.flags.kloNext) {
      G.flags.kloNext = G.minute + rnd(B('klo.alleMinMin', 30), B('klo.alleMinMax', 50));
      const g = ['gast1', 'gast2', 'gast3'].map(id => scene.actors[id]).find(a => !a.present);
      if (g) {
        g.setPresent(true); g.clearState();
        g.setTile(LOC.cafeFront.x, LOC.cafeFront.y);
        g.data.kloPhase = 'hin'; g.data.giveUp = G.minute + B('klo.wartenMin', 12);
        g.override = { tx: front.x, ty: front.y, until: 99999 };
        g.extraIcon = 'ic_excl';
      }
    }
    for (const id of ['gast1', 'gast2', 'gast3']) {
      const g = scene.actors[id];
      if (!g.present) continue;
      if (g.data.kloPhase === 'hin' && g.atTile(front.x, front.y)) {
        g.data.kloPhase = 'wartet';
        scene.say(g, TN('npc.gast.klo', g.talkIdx++), 3000);
        const h = scene.actors.hubi;
        if (h && h.present && h !== scene.player) scene.say(h, TN('npc.hubi.buero', h.talkIdx++), 3000);
        else if (G.figur === 'hubi') UI.toast(T('klo.hubiSelbst', null, 'Scho wieder wer vor deinem Büro, der aufs Klo will!'), 'bad');
      }
      if (g.data.kloPhase === 'wartet' && G.minute >= g.data.giveUp) {
        g.data.kloPhase = 'weg'; g.extraIcon = null;
        g.override = { tx: LOC.cafeFront.x, ty: LOC.cafeFront.y, until: 99999 };
        scene.say(g, T('npc.gast.aufgeben', null, 'Dann halt ned…'), 2500);
      }
      if ((g.data.kloPhase === 'weg' && g.atTile(LOC.cafeFront.x, LOC.cafeFront.y, 1)) || (g.data.kloPhase === 'klo' && g.atTile(LOC.wc.x - 1, LOC.wc.y))) {
        g.setPresent(false); g.override = null; g.data.kloPhase = null; g.extraIcon = null;
      }
    }
  },

  kloOptions(scene, a) {
    if (!/^gast\d$/.test(a.id) || !['hin', 'wartet'].includes(a.data.kloPhase)) return [];
    return [{ label: T('klo.zeigen', null, 'Des echte Klo is glei daneben, in der Ecke!'), fn: () => {
      a.data.kloPhase = 'klo'; a.extraIcon = null;
      a.override = { tx: LOC.wc.x - 1, ty: LOC.wc.y, until: 99999 };
      scene.say(a, T('npc.gast.danke', null, 'Ah! Danke! Dringend!'), 2000);
      G.flags.kloGeholfen = (G.flags.kloGeholfen || 0) + 1;
      const h = scene.actors.hubi;
      if (G.figur === 'hubi') { scene.addRep(B('klo.ansehenHubi', 3), T('klo.kurzHubi', null, 'Ruhe im Büro')); return; }
      scene.addRep(B('klo.ansehen', 10), T('klo.kurz', null, 'Klo gezeigt'));
      scene.addRep(B('klo.hubiDank', 5), T('klo.dankKurz', null, 'Hubi ist dir dankbar'), { quiet: true });
      if (h && h.present) { scene.say(h, TN('npc.hubi.dankbar', h.talkIdx++), 3500); h.extraIcon = 'ic_heart'; h.data.heartUntil = G.realMs + 3000; }
      if (G.flags.kloGeholfen === B('klo.bonusAb', 3)) {
        scene.addRep(B('klo.bonus', 15), T('klo.bonusKurz', null, 'Hubis ewige Dankbarkeit'));
        UI.banner(T('klo.bonusBanner', null, 'Hubi ist dir SUPER dankbar: „Du bist mei Klo-Held!“'), 4000, 'info');
      }
    } }];
  },

  // Hausmasta steht nach der Jause wieder auf
  updateHausmasta(scene) {
    const h = scene.actors.hausmasta;
    if (!h || !h.data.sitting) return;
    if (G.flags.zuhaelter) { h.data.sitting = false; h.clearState(); if (h.data.standUp) h.setTile(h.data.standUp.x, h.data.standUp.y); return; }
    if (!h.bubble && Math.random() < 1 / 300) scene.say(h, TN('npc.hausmasta.mampf', h.talkIdx++), 1800);
    if (G.realMs > h.data.sitUntil) { h.data.sitting = false; h.clearState(); if (h.data.standUp) h.setTile(h.data.standUp.x, h.data.standUp.y); h.idleUntil = G.realMs + 1000; }
  },

  // Bobos verjagen die Sexarbeiterinnen („Des is jetzt unser Viertel!“) – die kommen aber immer wieder
  updateBobos(scene) {
    if (G.ended) return;
    if (!G.flags.boboNext) G.flags.boboNext = G.minute + rnd(20, 40);
    for (const id of ['sw1', 'sw2']) {
      const w = scene.actors[id];
      if (!w) continue;
      const d = w.data;
      if (d.phase === 'geht' && w.atTile(d.exit.x, d.exit.y, 1)) { w.setPresent(false); w.override = null; d.phase = 'weg'; d.back = G.minute + rnd(B('bobos.zurueckMinMin', 60), B('bobos.zurueckMinMax', 120)); }
      if (d.phase === 'weg' && G.minute >= d.back) { w.setPresent(true); w.clearState(); w.setTile(d.exit.x, d.exit.y); w.override = { tx: d.spot.x, ty: d.spot.y, until: G.minute + 30 }; d.phase = null; scene.say(w, TN('npc.sw.zurueck', w.talkIdx++), 3000); }
    }
    // Ein Bobo macht sich auf den Weg
    if (G.minute >= G.flags.boboNext) {
      G.flags.boboNext = G.minute + rnd(B('bobos.alleMinMin', 35), B('bobos.alleMinMax', 70));
      const w = ['sw1', 'sw2'].map(i => scene.actors[i]).find(x => x.present && !x.data.phase && x.state === 'normal');
      const bobos = ['bobo', 'bobo2', 'bobo3'].map(i => scene.actors[i]).filter(b => b.present && b.state === 'normal' && !b.data.target);
      if (w && bobos.length) { const b = pick(bobos); b.data.target = w; w.data.phase = 'ziel'; }
    }
    for (const id of ['bobo', 'bobo2', 'bobo3']) {
      const b = scene.actors[id];
      const w = b && b.data.target;
      if (!w) continue;
      if (!w.present || b.isImmobile()) { b.data.target = null; b.override = null; if (w.data.phase === 'ziel') w.data.phase = null; continue; }
      if (dist(b.x, b.y, w.x, w.y) > 20) { b.override = { tx: w.tx, ty: w.ty + 1, until: G.minute + 30 }; continue; }
      // Verjagen
      b.override = null; b.data.target = null;
      scene.say(b, TN('npc.bobo.verjagen', b.talkIdx++), 3000);
      scene.time.delayedCall(1500, () => scene.say(w, TN('npc.sw.antwort', w.talkIdx++), 3200));
      const exits = [LOC.streetEnds.feuerbach, LOC.streetEnds.obermuellner];
      w.data.exit = exits.reduce((a, c) => dist(w.tx, w.ty, c.x, c.y) < dist(w.tx, w.ty, a.x, a.y) ? c : a);
      w.data.phase = 'geht';
      scene.time.delayedCall(2600, () => { if (w.data.phase === 'geht') w.override = { tx: w.data.exit.x, ty: w.data.exit.y, until: 99999 }; });
      scene.time.delayedCall(4000, () => scene.say(b, TN('npc.bobo.danach', b.talkIdx++), 2800));
    }
  },

  // Jewi geht vor der Therapie ins Café (nur wenn sie NPC ist)
  updateJewi(scene) {
    const j = scene.actors.jewi;
    if (!j || j === scene.player || G.ended) return;
    const m = G.minute, ph = G.flags.jewiPhase || 'frei';
    const cafeAt = parseClock(B('jewi.cafeAb', '15:40'), 940), goAt = parseClock(B('jewi.therapieAb', '16:10'), 970), backAt = parseClock(B('jewi.zurueckAb', '17:20'), 1040);
    if (ph === 'frei' && m >= cafeAt && m < goAt && j.state === 'normal') {
      G.flags.jewiPhase = 'cafe';
      const seat = LOC.cafeSeats[4];
      j.override = { tx: seat.x, ty: seat.y, until: goAt }; j.path = null;
      scene.say(j, TN('npc.jewi.vorTherapie', j.talkIdx++), 3000);
    } else if ((ph === 'cafe' || ph === 'frei') && m >= goAt && m < backAt && j.state === 'normal') {
      G.flags.jewiPhase = 'geht';
      const e = LOC.streetEnds.feuerbach;
      j.override = { tx: e.x, ty: e.y, until: backAt }; j.path = null;
      scene.say(j, T('npc.jewi.gehtTherapie', null, 'So, Therapie. Bis später!'), 2500);
    } else if (ph === 'geht' && j.atTile(LOC.streetEnds.feuerbach.x, LOC.streetEnds.feuerbach.y, 1)) {
      G.flags.jewiPhase = 'weg'; j.setPresent(false);
    } else if ((ph === 'weg' || ph === 'geht') && m >= backAt) {
      G.flags.jewiPhase = 'fertig'; j.setPresent(true); j.override = null; j.clearState();
      if (ph === 'weg') j.setTile(LOC.streetEnds.feuerbach.x, LOC.streetEnds.feuerbach.y);
      scene.say(j, T('npc.jewi.nachTherapie', null, 'Therapie war… intensiv. Jetzt brauch ich Licht und Motive.'), 3000);
    }
  },

  update(scene, dt) {
    this.updateHausmasta(scene);
    this.updateBobos(scene);
    this.updateJewi(scene);
    this.updateUlli(scene);
    this.updateKlo(scene);
    this.updateShots(scene, dt);
    this.updateBernd(scene, dt);
    this.updateMarco(scene, dt);
  },

  optionsFor(scene, a) {
    const o = this.kloOptions(scene, a);
    const S = (k, v, fb) => T('shops.' + k, v, fb);
    const buy = (item, preis, what) => () => { if (scene.pay(preis, what)) { scene.giveItem(item); if (G.figur === 'andi') UI.toast(S('andiHinweis', null, 'Tipp: E drücken = jausnen'), ''); } };
    switch (a.id) {
      case 'pizzaiolo': { const pr = B('preise.pizza', 6); o.push({ label: S('pizza', { preis: euro(pr) }, 'Pizza Maradona ({preis})'), fn: buy('pizza', pr, S('pizzaKurz', null, 'Pizza')) }); break; }
      case 'wingswirt': {
        const pr = B('preise.wings', 7), bier = B('preise.bier', 3.5);
        o.push({ label: S('wings', { preis: euro(pr) }, 'Buffalo Wings ({preis})'), fn: buy('wings', pr, S('wingsKurz', null, 'Wings')) });
        o.push({ label: S('bier', { preis: euro(bier) }, 'A Bier ({preis})'), fn: () => { if (scene.pay(bier, S('bierKurz', null, 'Bier'))) { scene.say(scene.player, S('prost', null, 'Prost! *hicks*'), 2000); const h = Math.floor(G.minute / 60); if (G.flags.bierHour !== h) { G.flags.bierHour = h; scene.addRep(B('ansehen.bier', 3), S('bierAnsehen', null, 'Runde mit den Stammgästen'), { talk: true }); } } } });
        break;
      }
      case 'hausmasta': {
        const h = Math.floor(G.minute / 120);
        if (G.flags.semmelSlot !== h) o.push({ label: S('semmel', null, 'Hast was zum Essen für mi?'), fn: () => { G.flags.semmelSlot = h; scene.giveItem('semmel'); scene.say(a, S('semmelText', null, 'Na freilich! A Wurstsemmel. I hab eh drei.'), 2500); } });
        break;
      }
    }
    return o;
  }
};
