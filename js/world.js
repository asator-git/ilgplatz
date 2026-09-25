// ---------------------------------------------------------------
// world.js – Hauptszene: Karte, Spieler, Kamera, Uhr, Spielschleife
// ---------------------------------------------------------------
'use strict';

class WorldScene extends Phaser.Scene {
  constructor() { super('World'); }

  init(data) {
    this.figur = (data && data.figur) || 'hubi';
  }

  create() {
    const fig = this.figur;
    const rivalId = fig === 'hubi' ? 'andi' : 'hubi';
    const startMin = parseClock(URLP.start, parseClock(B('zeit.start', '08:00'), 480));
    G = {
      scene: this,
      figur: fig,
      rivalId,
      rivalName: T('figuren.' + rivalId + '.name', null, rivalId === 'hubi' ? 'Hubi' : 'Andi'),
      minute: startMin,
      startMinute: parseClock(B('zeit.start', '08:00'), 480),
      endMinute: parseClock(B('zeit.ende', '23:00'), 1380),
      realMs: 0,
      paused: false,
      ended: false,
      rep: B('spieler.startAnsehen', 0),
      money: B('spieler.startGeld', 40),
      inv: {},
      rivalAdj: 0,
      rivalRep: B('rivale.start', 150),
      hunger: fig === 'andi' ? 100 : null,
      flags: {},
      talkHour: {},
      questsDone: 0,
      priceMods: { hackUntil: 0 },
      freeCoffee: fig === 'juliette' ? 1 : 0,
      speed: parseFloat(URLP.speed) || 1,
      onDialogClosed: () => this.onDialogClosed()
    };
    TEXT_VARS.spieler = T('figuren.' + fig + '.name', null, fig);
    TEXT_VARS.rivale = G.rivalName;
    TEXT_VARS.preis = () => euro(this.price('americano'));

    this.grid = buildGrid();
    renderMap(this, this.grid);
    this.objs = placeObjects(this, this.grid);
    this.fountainT = 0;
    this.hudT = 0;
    this.targetT = 0;
    this.target = null;
    this.bubbles = [];

    // Spieler
    const st = LOC.start;
    this.player = new Actor(this, fig, { kind: 'player', pos: { x: st.x * TILE + 8, y: st.y * TILE + 14 }, speed: B('spieler.tempo', 72), labelColor: '#ffd166' });
    this.player.isPlayer = true;

    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
    this.applyZoom();
    this.cameras.main.setRoundPixels(true);

    // Nacht-Overlay
    this.night = this.add.rectangle(0, 0, MAP_W * TILE, MAP_H * TILE, 0x0b1030, 0).setOrigin(0, 0).setDepth(20000);
    this.glows = this.objs.lanterns.map(l => this.add.image(l.x, l.y - 26, 'glow').setDepth(20001).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.9));

    this.npcs = [];
    this.actors = {};
    this.interactables = [];
    if (typeof Abilities !== 'undefined') Abilities.reset();
    if (typeof NPCs !== 'undefined' && NPCs.init) NPCs.init(this);
    if (typeof Enemies !== 'undefined' && Enemies.init) Enemies.init(this);
    if (typeof Quests !== 'undefined' && Quests.init) Quests.init(this);
    if (typeof Events !== 'undefined' && Events.init) Events.init(this);

    Input.handlers.world = (ev, arg) => this.onInput(ev, arg);
    UI.showHUD(true);
    UI.setSpecialLabel(T('spezial.' + fig, null, 'E'));
    this.events.once('shutdown', () => this.cleanup());
    window.WORLD = this;
  }

  cleanup() {
    Input.handlers.world = null;
    UI.closeAllDialogs();
    UI.unfade();
    if (window.WORLD === this) window.WORLD = null;
  }

  applyZoom() {
    const cam = this.cameras.main;
    const w = this.scale.gameSize.width, h = this.scale.gameSize.height;
    const z = Math.max(2, Math.round(Math.min(w, h) / (TILE * B('kamera.kachelnSichtbar', 12))));
    cam.setZoom(z);
    this.zoom = z;
  }

  // ---------------------------------------------------------------
  // Eingabe
  onInput(ev) {
    if (G.ended) return;
    if (ev === 'pause') { this.togglePause(); return; }
    if (G.paused) return;
    // Festgequatscht: Ausreden erfinden verkürzt das Gespräch
    const p = this.player;
    if (p.state === 'held' && (ev === 'action' || ev === 'special') && !UI.isBlocking()) {
      p.stateUntilMin -= B('gegner.ausredeMin', 1.5);
      Sfx.play('blip');
      const a = p.data.heldBy;
      if (a) this.say(a, TN('npc.' + a.id + '.fang', (a.talkIdx++)), 1500);
      this.say(p, T('warten.ausreden', null, 'Äh… i muss… mei Hund…'), 900);
      if (p.state === 'held' && G.minute >= p.stateUntilMin) p.updateState();
      return;
    }
    if (ev === 'action') this.doAction();
    if (ev === 'special') this.doSpecial();
  }

  togglePause() {
    if (G.ended) return;
    if (G.paused) return;
    G.paused = true;
    this.tweens.pauseAll();
    UI.showPause(() => { G.paused = false; this.tweens.resumeAll(); }, () => { G.paused = false; backToTitle(); });
  }

  playerCanAct() {
    const p = this.player;
    return !UI.isBlocking() && !p.isImmobile() && !G.ended && !G.paused;
  }

  doAction() {
    if (!this.playerCanAct()) return;
    const t = this.findTarget();
    if (!t) { Sfx.play('blip'); return; }
    Sfx.play('action');
    if (t.fn) { t.fn(); return; }
    if (t.actor) this.interactActor(t.actor);
  }

  doSpecial() {
    if (typeof Abilities !== 'undefined') Abilities.special(this);
  }

  // ---------------------------------------------------------------
  // Interaktion
  findTarget() {
    const p = this.player;
    const px = p.x, py = p.y - 6;
    let best = null, bd = 1e9;
    const R = B('spieler.aktionsRadius', 22);
    for (const a of this.npcs) {
      if (!a.present || a === p) continue;
      if (a.noInteract) continue;
      if (a.id === 'mascha' && (a.follow === p || G.figur === 'hubi')) continue;
      let d = dist(px, py, a.x, a.y - 6);
      if (a.follow === p || (a.follow && a.follow.follow === p)) d += 12; // Begleiter nachrangig
      if (d < R && d < bd) { bd = d; best = { actor: a, label: this.actorPrompt(a) }; }
    }
    const extra = (typeof Quests !== 'undefined' && Quests.interactables) ? Quests.interactables(this) : [];
    for (const it of this.interactables.concat(extra)) {
      if (!it || (it.visible && !it.visible())) continue;
      const d = dist(px, py, it.x, it.y);
      if (d < (it.r || R) && d + (it.prio || 0) < bd) { bd = d; best = { fn: it.fn, label: typeof it.label === 'function' ? it.label() : it.label }; }
    }
    return best;
  }

  actorPrompt(a) {
    if (typeof Quests !== 'undefined' && Quests.promptFor) {
      const q = Quests.promptFor(a);
      if (q) return q;
    }
    return T('ui.reden', { name: a.name }, 'Reden: {name}');
  }

  interactActor(a) {
    if (typeof Quests !== 'undefined' && Quests.onInteract && Quests.onInteract(a)) return;
    if (typeof NPCs !== 'undefined' && NPCs.talk) NPCs.talk(this, a);
  }

  onDialogClosed() {
    // Gespräche kosten Spielzeit
    let cost = B('zeit.gespraechMin', 1);
    if (G.figur === 'juliette') cost *= B('figuren.juliette.dialogFaktor', 2);
    G.minute += cost;
  }

  // ---------------------------------------------------------------
  // Wirtschaft & Ansehen
  price(item) {
    const hours = Math.max(0, (G.minute - G.startMinute) / 60);
    const steps = Math.floor(hours / B('preise.steigerungAlleStunden', 2));
    let base;
    if (item === 'americano') base = B('preise.americano', 4.8);
    else if (item === 'kipferl') base = B('preise.americano', 4.8) * B('preise.kipferlFaktor', 0.6);
    else base = B('preise.' + item, 5);
    if (item === 'americano' || item === 'kipferl') {
      base *= Math.pow(1 + B('preise.steigerungProzent', 20) / 100, steps);
      if (G.figur === 'jewi') base *= B('preise.jewiFaktor', 1.5);
      if (G.flags.dopplerImCafe) base *= B('preise.dopplerFaktor', 1.5);
      if (G.flags.derb) base *= B('preise.derbFaktor', 1.3);
      if (G.minute < G.priceMods.hackUntil) base *= B('preise.hackFaktor', 0.5);
    }
    return Math.round(base * 10) / 10;
  }

  addRep(n, reason, opts) {
    opts = opts || {};
    if (!n) return 0;
    let v = n;
    if (v > 0 && opts.quest && G.figur === 'juliette') v *= B('figuren.juliette.auftragFaktor', 1.25);
    if (v > 0 && opts.talk && G.figur === 'andi') v *= B('figuren.andi.gespraechFaktor', 1.5);
    v = Math.round(v);
    const before = G.rep;
    G.rep = Math.max(0, G.rep + v);
    const real = G.rep - before;
    if (!opts.silent) {
      const txt = (v > 0 ? '+' : '') + v + ' ' + T('ui.ansehenKurz', null, 'Ansehen') + (reason ? ' – ' + reason : '');
      UI.toast(txt, v > 0 ? 'good' : 'bad');
      this.floatText(this.player.x, this.player.y - 30, (v > 0 ? '+' : '') + v, v > 0 ? '#06d6a0' : '#ef476f');
      if (Math.abs(v) >= 5) UI.pop((v > 0 ? '+' : '') + v + ' ' + T('ui.ansehenKurz', null, 'Ansehen') + (v > 0 ? '!' : ''), v > 0 ? 'good' : 'bad');
      if (v > 0 && !opts.quiet) Sfx.play(v >= 25 ? 'good' : 'coin'); else if (v < 0) Sfx.play('bad');
    }
    return real;
  }

  addMoney(n, reason) {
    G.money = Math.max(0, Math.round((G.money + n) * 100) / 100);
    if (n) UI.toast((n > 0 ? '+' : '−') + euro(Math.abs(n)) + (reason ? ' – ' + reason : ''), 'money');
    if (n > 0) Sfx.play('coin');
  }

  pay(amount, what) {
    if (G.money + 1e-6 < amount) { UI.toast(T('ui.zuWenigGeld', { preis: euro(amount) }, 'Zu wenig Geld ({preis})!'), 'bad'); Sfx.play('bad'); return false; }
    this.addMoney(-amount, what);
    return true;
  }

  hasItem(k) { return (G.inv[k] || 0) > 0; }
  giveItem(k, n) { G.inv[k] = (G.inv[k] || 0) + (n || 1); UI.toast(T('ui.bekommen', { item: T('items.' + k, null, k) }, '+ {item}'), 'good'); }
  takeItem(k, n) { if (!G.inv[k]) return false; G.inv[k] = Math.max(0, G.inv[k] - (n || 1)); if (!G.inv[k]) delete G.inv[k]; return true; }

  // ---------------------------------------------------------------
  // Anzeige-Helfer
  floatText(x, y, text, color) {
    const t = this.add.text(x, y, text, { fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: color || '#fff', stroke: '#000', strokeThickness: 2 })
      .setOrigin(0.5, 1).setDepth(30000).setResolution(this.zoom || 4);
    this.tweens.add({ targets: t, y: y - 16, alpha: 0, duration: 1400, onComplete: () => t.destroy() });
  }

  // Sprechblase über einer Figur
  say(actor, text, ms) {
    if (!actor || !actor.present) return;
    if (actor.bubble) { actor.bubble.destroy(); actor.bubble = null; }
    const t = this.add.text(actor.x, actor.y - 30, text, {
      fontFamily: '"Press Start 2P", monospace', fontSize: '4px', color: '#111', backgroundColor: '#fff8e7',
      padding: { x: 2, y: 2 }, wordWrap: { width: 90 }, align: 'center'
    }).setOrigin(0.5, 1).setDepth(29000).setResolution(this.zoom || 4);
    actor.bubble = t;
    t.owner = actor;
    t.until = G.realMs + (ms || 2600);
    this.bubbles.push(t);
  }

  updateBubbles() {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (!b.active) { this.bubbles.splice(i, 1); continue; }
      if (G.realMs > b.until || !b.owner.present) {
        if (b.owner.bubble === b) b.owner.bubble = null;
        b.destroy(); this.bubbles.splice(i, 1); continue;
      }
      const top = b.owner.y - (b.owner.isDog ? 18 : 30);
      b.setPosition(Math.round(b.owner.x), Math.round(top));
    }
  }

  // ---------------------------------------------------------------
  // Spielschleife
  update(time, delta) {
    if (!G || G.paused) return;
    const dt = Math.min(delta, 50);
    G.realMs += dt;

    if (!G.ended) this.advanceClock(dt);

    this.updatePlayer(dt);
    for (const a of this.npcs) a.update(dt);
    if (typeof Abilities !== 'undefined' && Abilities.update) Abilities.update(this, dt);
    if (typeof Enemies !== 'undefined' && Enemies.update) Enemies.update(this, dt);
    if (typeof Quests !== 'undefined' && Quests.update) Quests.update(this, dt);
    if (typeof Events !== 'undefined' && Events.update) Events.update(this, dt);
    this.updateBubbles();
    this.updateWait();

    // Brunnen-Animation
    this.fountainT += dt;
    if (this.fountainT > 400) { this.fountainT = 0; this.objs.fountain.setFrame(this.objs.fountain.frame.name === 0 ? 1 : 0); }

    this.updateNight();

    this.targetT -= dt;
    if (this.targetT <= 0) {
      this.targetT = 120;
      const t = this.playerCanAct() ? this.findTarget() : null;
      const key = Input.touchUsed ? 'A' : T('ui.leertaste', null, 'Leertaste');
      UI.setPrompt(t ? key + ': ' + t.label : null);
    }
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 200; this.refreshHUD(); }

    if (!G.ended && G.minute >= G.endMinute) this.endDay();
  }

  advanceClock(dt) {
    const msPerMin = B('zeit.sekundenProStunde', 240) * 1000 / 60;
    let mult = G.speed;
    const p = this.player;
    if (p.isImmobile() && ['held', 'stone', 'hospital', 'glued', 'down'].includes(p.state)) mult *= B('zeit.warteTurbo', 5);
    if (UI.isDialogOpen() && G.figur === 'juliette') mult *= B('figuren.juliette.dialogFaktor', 2);
    G.minute += dt / msPerMin * mult;
    const hours = (G.minute - G.startMinute) / 60;
    G.rivalRep = Math.max(0, B('rivale.start', 150) + B('rivale.proStunde', 10) * hours + G.rivalAdj);
  }

  updateNight() {
    const m = G.minute;
    let a = 0;
    const dusk = parseClock(B('nacht.daemmerung', '19:00'), 1140), night = parseClock(B('nacht.nacht', '21:00'), 1260);
    if (m >= night) a = B('nacht.dunkel', 0.55);
    else if (m >= dusk) a = (m - dusk) / (night - dusk) * B('nacht.daemmerungDunkel', 0.3);
    this.night.setAlpha(a);
    const ga = m >= dusk ? clamp((m - dusk) / 60, 0, 1) * 0.8 : 0;
    for (const g of this.glows) g.setAlpha(ga * (0.9 + Math.sin(G.realMs / 300 + g.x) * 0.1));
  }

  // Warte-Anzeige: zeigt klar, was los ist, wie lange es dauert und was man tun kann
  updateWait() {
    const p = this.player;
    const st = p.state;
    const WAIT = { held: 1, stone: 1, hospital: 1, glued: 1, frozen: 1 };
    if (!WAIT[st] || G.ended) { if (this.waitState) { this.waitState = null; UI.hideWait(); } return; }
    if (this.waitState !== st) {
      this.waitState = st;
      this.waitStartMin = G.minute; this.waitStartMs = G.realMs;
      const who = p.data.heldBy ? p.data.heldBy.name : '';
      let hint = T('warten.' + st + '.hinweis', { name: who }, '');
      if (st === 'stone') hint = (G.figur === 'hubi' && typeof Abilities !== 'undefined' && Abilities.maschaWithPlayer(this))
        ? T('warten.stone.hinweisHubi', null, 'Drück E – Mascha schleckt dich wach!') : T('warten.stone.hinweis', null, 'Die Zeit läuft im Zeitraffer weiter.');
      UI.showWait({ title: T('warten.' + st + '.titel', { name: who }, st), text: T('warten.' + st + '.text', { name: who }, ''), hint, dark: st === 'hospital' });
    }
    let frac;
    if (p.stateUntilMin) frac = (p.stateUntilMin - G.minute) / Math.max(0.01, p.stateUntilMin - this.waitStartMin);
    else if (p.stateUntilMs) frac = (p.stateUntilMs - G.realMs) / Math.max(1, p.stateUntilMs - this.waitStartMs);
    else frac = 1;
    let text;
    if (st === 'held' && p.data.heldBy && Math.floor(G.realMs / 1800) !== this.waitLineIdx) {
      this.waitLineIdx = Math.floor(G.realMs / 1800);
      text = '„' + TN('npc.' + p.data.heldBy.id + '.fang', this.waitLineIdx) + '“';
    }
    UI.updateWait(frac, text);
  }

  refreshHUD() {
    const p = this.player;
    let status = '';
    const stTxt = { stone: 'versteinert', talked: 'benommen', grantig: 'grantig', wet: 'nass', held: 'festgequatscht', frozen: 'eingefroren', slipped: 'ausgerutscht', glued: 'angepickt', hospital: 'Krankenhaus', laughing: 'lacht' };
    if (p.state !== 'normal') status = T('zustaende.' + p.state, null, stTxt[p.state] || p.state);
    if (p.stoneBar > 0.02 && p.state !== 'stone') status = T('ui.versteinerung', { n: Math.round(p.stoneBar * 100) }, 'Versteinerung {n}%');
    // Nächster Rang
    let nextRank = '';
    const ranks = B('raenge', []);
    if (Array.isArray(ranks)) { const n = ranks.find(r => r.ab > G.rep); if (n) nextRank = T('ui.naechsterRang', { rang: T('raenge.' + n.id, null, n.id), n: n.ab }, '{rang} ab {n}'); }
    // Nächstes Tages-Event
    let nextEvent = '';
    if (typeof Events !== 'undefined' && Events.list) {
      const e = Events.list.find(x => !x.fired && !x.silent && x.t > G.minute);
      if (e) nextEvent = T('ui.naechstesEvent', { zeit: clockStr(e.t), name: T('events.' + e.id + '.name', null, e.id) }, 'Um {zeit}: {name}');
    }
    UI.updateHUD({ minute: G.minute, startMinute: G.startMinute, endMinute: G.endMinute, rep: G.rep, money: G.money, rivalName: G.rivalName, rivalRep: G.rivalRep, hunger: G.hunger, inv: G.inv, status, nextRank, nextEvent });
    if (typeof Quests !== 'undefined' && Quests.hudList) UI.setQuests(Quests.hudList(this));
  }

  // ---------------------------------------------------------------
  // Spielerbewegung mit Kachel-Kollision
  playerBlocked(px, py) {
    const g = this.grid;
    const hw = 4.5, top = 6;
    if (isSolidPx(g, px - hw, py - top) || isSolidPx(g, px + hw, py - top) ||
      isSolidPx(g, px - hw, py - 1) || isSolidPx(g, px + hw, py - 1)) return true;
    for (const a of this.npcs) {
      if (!a.present || !a.solidForPlayer || !a.solidForPlayer()) continue;
      if (Math.abs(a.x - px) < 9 && Math.abs(a.y - py) < 6) {
        // Nur blockieren, wenn man sich nicht schon überlappt (sonst festkleben)
        if (Math.abs(a.x - this.player.x) < 9 && Math.abs(a.y - this.player.y) < 6) continue;
        a._bumped = true;
        return true;
      }
    }
    return false;
  }

  updatePlayer(dt) {
    const p = this.player;
    p.updateState();
    p.moving = false;
    if (!UI.isBlocking() && !p.isImmobile() && !G.ended) {
      const a = Input.axis();
      if (a.x || a.y) {
        const sp = p.curSpeed() * dt / 1000;
        const nx = p.x + a.x * sp, ny = p.y + a.y * sp;
        if (!this.playerBlocked(nx, p.y)) p.x = nx;
        else if (a.x && Math.abs(a.y) < 0.3) this.nudge(p, 'y', a.x * sp);
        if (!this.playerBlocked(p.x, ny)) p.y = ny;
        else if (a.y && Math.abs(a.x) < 0.3) this.nudge(p, 'x', a.y * sp);
        if (Math.abs(a.x) > 0.1) p.facing = a.x < 0 ? -1 : 1;
        p.moving = true;
      }
    }
    p.sync(dt);
  }

  // An Ecken vorbeirutschen
  nudge(p, axis, amount) {
    for (let o = 1; o <= 6; o++) {
      for (const s of [-1, 1]) {
        if (axis === 'y') {
          if (!this.playerBlocked(p.x + amount, p.y + s * o) && !this.playerBlocked(p.x, p.y + s)) { p.y += s; return; }
        } else {
          if (!this.playerBlocked(p.x + s * o, p.y + amount) && !this.playerBlocked(p.x + s, p.y)) { p.x += s; return; }
        }
      }
    }
  }

  // Spieler wegschieben (Marco, Zuhälter): tiles Kacheln weg von (fx,fy)
  pushPlayer(fx, fy, tiles) {
    const p = this.player;
    let dx = p.x - fx, dy = p.y - fy;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const total = (tiles || 3) * TILE;
    let tx = p.x, ty = p.y;
    for (let s = 0; s < total; s += 2) {
      const nx = tx + dx * 2, ny = ty + dy * 2;
      if (this.playerBlocked(nx, ny)) break;
      tx = nx; ty = ny;
    }
    this.tweens.add({ targets: p, x: tx, y: ty, duration: 260, ease: 'Quad.easeOut' });
    this.cameras.main.shake(150, 0.004);
    Sfx.play('punch');
  }

  // Spieler an eine freie Stelle setzen
  teleportPlayer(tx, ty) {
    const f = randomWalkableNear(this.grid, tx, ty, 0);
    this.player.setPos(f.x * TILE + 8, f.y * TILE + 14);
    this.cameras.main.centerOn(this.player.x, this.player.y);
  }

  // Tagesende
  endDay() {
    G.ended = true;
    G.minute = G.endMinute;
    if (typeof Events !== 'undefined' && Events.finale) Events.finale(this);
  }
}
