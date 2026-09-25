// ---------------------------------------------------------------
// actors.js – Figuren (Spieler + NPCs): Bewegung, Zustände, Anzeige
// ---------------------------------------------------------------
'use strict';

const LABEL_STYLE = {
  fontFamily: '"Press Start 2P", monospace', fontSize: '4px', color: '#ffffff',
  stroke: '#000000', strokeThickness: 1.5
};

// Zustände, in denen man sich nicht bewegen kann
const IMMOBILE = { stone: 1, talked: 1, down: 1, held: 1, frozen: 1, slipped: 1, glued: 1, hospital: 1, sitting: 0 };
// Zustände, die Mascha heilen kann
const HEALABLE = { stone: 1, talked: 1, grantig: 1 };

const STATE_ICON = { stone: 'ic_stone', talked: 'ic_swirl', grantig: 'ic_angry', wet: 'ic_drop', laughing: 'ic_laugh', down: 'ic_zzz', flee: 'ic_fear', frozen: 'ic_camera', held: 'ic_swirl', panic: 'ic_fear' };

class Actor {
  constructor(scene, id, opts) {
    opts = opts || {};
    this.scene = scene;
    this.id = id;
    this.kind = opts.kind || 'npc';
    this.name = opts.name || T('npc.' + id + '.name', null, T('figuren.' + id + '.name', null, id));
    this.texKey = opts.tex ? 'ch_' + opts.tex : ('ch_' + id);
    if (opts.dog) this.texKey = 'mascha';
    this.isDog = !!opts.dog;
    const p = opts.pos || { x: 20 * TILE, y: 20 * TILE };
    this.x = p.x; this.y = p.y;
    this.homeX = this.x; this.homeY = this.y;
    this.speed = opts.speed || 36;
    this.baseSpeed = this.speed;
    this.sprite = scene.add.sprite(this.x, this.y, this.texKey, 0).setOrigin(0.5, 1);
    const zoom = (scene.cameras && scene.cameras.main) ? scene.cameras.main.zoom : 4;
    this.label = scene.add.text(this.x, this.y - 25, opts.noLabel ? '' : this.name, LABEL_STYLE).setOrigin(0.5, 1).setResolution(Math.max(2, zoom));
    if (opts.labelColor) this.label.setColor(opts.labelColor);
    this.icon = scene.add.image(this.x, this.y - 32, 'ic_excl').setVisible(false).setOrigin(0.5, 1);
    this.state = 'normal';
    this.stateUntilMin = 0;
    this.stateUntilMs = 0;
    this.path = null;
    this.idleUntil = 0;
    this.animT = Math.random() * 1000;
    this.moving = false;
    this.facing = 1;
    this.stoneBar = 0;
    this.talkIdx = Math.floor(Math.random() * 4);
    this.lastTalkHour = -1;
    this.present = true;
    this.routine = opts.routine || null;
    this.data = {};
    this.override = null;   // {tx,ty,until(min)} – Event-Vorgabe
    this.follow = null;     // Actor, dem gefolgt wird
    this.followDist = 18;
    this.questIcon = null;  // 'ic_excl' | 'ic_quest'
    this.solidForPlayer = false;
    this.bob = 0;
    this.extraIcon = null;
  }

  get tx() { return Math.floor(this.x / TILE); }
  get ty() { return Math.floor(this.y / TILE); }

  setPos(x, y) { this.x = x; this.y = y; this.path = null; this.sync(); }
  setTile(tx, ty) { this.setPos(tx * TILE + TILE / 2, ty * TILE + TILE - 2); }

  setPresent(v) {
    this.present = v;
    this.sprite.setVisible(v); this.label.setVisible(v);
    if (!v) this.icon.setVisible(false);
  }

  // Zustand setzen: durMin = Spielminuten, durMs = Echtzeit
  setState(name, durMin, durMs) {
    this.state = name;
    this.stateUntilMin = durMin ? G.minute + durMin : 0;
    this.stateUntilMs = durMs ? G.realMs + durMs : 0;
    if (IMMOBILE[name]) this.path = null;
    this.stoneBar = 0;
    this.sprite.setRotation(0);
    if (name === 'down' || name === 'slipped') this.sprite.setRotation(Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1));
  }
  clearState() { this.setState('normal'); }
  isImmobile() { return !!IMMOBILE[this.state]; }
  isHealable() { return !!HEALABLE[this.state]; }

  updateState() {
    if (this.state === 'normal') return;
    const doneMin = this.stateUntilMin && G.minute >= this.stateUntilMin;
    const doneMs = this.stateUntilMs && G.realMs >= this.stateUntilMs;
    if (doneMin || doneMs) {
      const old = this.state;
      this.clearState();
      if (this.onStateEnd) this.onStateEnd(old);
    }
  }

  goToTile(tx, ty) {
    if (!this.scene.grid) return;
    const path = findPath(this.scene.grid, this.tx, this.ty, tx, ty);
    this.path = path && path.length ? path : null;
    this.pathGoal = { x: tx, y: ty };
  }
  goToPx(x, y) { this.goToTile(Math.floor(x / TILE), Math.floor(y / TILE)); }
  atTile(tx, ty, r) { return Math.abs(this.tx - tx) <= (r || 0) && Math.abs(this.ty - ty) <= (r || 0); }

  // Schritt entlang des Pfads; true wenn bewegt
  stepPath(dt) {
    if (!this.path || !this.path.length) { this.path = null; return false; }
    const n = this.path[0];
    const tx = n.x * TILE + TILE / 2, ty = n.y * TILE + TILE - 3;
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const sp = this.curSpeed() * dt / 1000;
    if (d <= sp || d < 0.5) {
      this.x = tx; this.y = ty; this.path.shift();
      if (!this.path.length) this.path = null;
    } else {
      this.x += dx / d * sp; this.y += dy / d * sp;
      if (Math.abs(dx) > 0.3) this.facing = dx < 0 ? -1 : 1;
    }
    return true;
  }

  // Direkt auf einen Punkt zu (ohne Pfad), mit einfacher Kollision
  stepToward(px, py, dt, speedMul) {
    const dx = px - this.x, dy = py - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return false;
    const sp = this.curSpeed() * (speedMul || 1) * dt / 1000;
    const nx = this.x + dx / d * Math.min(sp, d), ny = this.y + dy / d * Math.min(sp, d);
    const g = this.scene.grid;
    if (!isSolidPx(g, nx, this.y - 2)) this.x = nx;
    if (!isSolidPx(g, this.x, ny - 2)) this.y = ny;
    if (Math.abs(dx) > 0.3) this.facing = dx < 0 ? -1 : 1;
    return true;
  }

  curSpeed() {
    let s = this.speed;
    if (this.state === 'wet') s *= 0.5;
    if (this.state === 'panic' || this.state === 'flee') s *= 1.6;
    return s;
  }

  // Standard-Update für NPCs
  update(dt) {
    this.updateState();
    if (!this.present) return;
    this.moving = false;
    if (!this.isImmobile() && this.state !== 'sitting') {
      if (this.customUpdate && this.customUpdate(dt)) {
        // eigene Logik hat übernommen
      } else if (this.follow) {
        const f = this.follow;
        const d = dist(this.x, this.y, f.x, f.y);
        if (d > 140) { this.setPos(f.x - 8, f.y); }
        else if (d > this.followDist) {
          if (!this.path || G.realMs - (this._lastFollowPath || 0) > 700) {
            this._lastFollowPath = G.realMs;
            if (d < 40 && lineOfSight(this.scene.grid, this.x, this.y - 4, f.x, f.y - 4)) this.path = null;
            else this.goToPx(f.x, f.y - 4);
          }
          if (this.path) this.moving = this.stepPath(dt);
          else this.moving = this.stepToward(f.x, f.y, dt, d > 50 ? 1.4 : 1);
        } else this.path = null;
      } else if (this.override) {
        const o = this.override;
        if (o.until && G.minute >= o.until) { this.override = null; }
        else if (!this.atTile(o.tx, o.ty)) {
          if (!this.path || !this.pathGoal || this.pathGoal.x !== o.tx || this.pathGoal.y !== o.ty) this.goToTile(o.tx, o.ty);
          if (this.path) this.moving = this.stepPath(dt);
          else this.setTile(o.tx, o.ty);
        }
      } else if (this.path) {
        this.moving = this.stepPath(dt);
      } else if (this.routine && G.realMs >= this.idleUntil) {
        this.routine(this);
      }
    }
    this.sync(dt);
  }

  sync(dt) {
    dt = dt || 0;
    if (this.moving) this.animT += dt; else this.animT = 0;
    let frame = 0;
    if (this.moving) frame = 1 + (Math.floor(this.animT / 140) % 2);
    if (this.state === 'panic' || this.state === 'flee') frame = 1 + (Math.floor(G.realMs / 80) % 2);
    this.sprite.setFrame(frame);
    this.sprite.setFlipX(this.facing < 0);
    let yOff = 0;
    if (this.state === 'laughing') yOff = -Math.abs(Math.sin(G.realMs / 90)) * 2;
    if (this.state === 'talked') this.sprite.setRotation(Math.sin(G.realMs / 150) * 0.15);
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y + yOff));
    this.sprite.setDepth(this.y);
    // Färbung je Zustand
    if (this.state === 'stone') this.sprite.setTint(0x9a9a9a);
    else if (this.state === 'wet') this.sprite.setTint(0x9ad0ff);
    else if (this.state === 'grantig') this.sprite.setTint(0xffa0a0);
    else if (this.state === 'frozen') this.sprite.setTint(0xe0e0ff);
    else if (this.flash && G.realMs < this.flash) this.sprite.setTint(0xffffaa);
    else this.sprite.clearTint();
    const h = this.isDog ? 16 : 24;
    const lying = this.state === 'down' || this.state === 'slipped';
    const top = lying ? this.y - 10 : this.y - h;
    this.label.setPosition(Math.round(this.x), Math.round(top - 1));
    this.label.setDepth(9000 + this.y);
    const ic = STATE_ICON[this.state] || this.extraIcon || this.questIcon;
    if (ic && this.present) {
      this.icon.setTexture(ic).setVisible(true);
      this.icon.setPosition(Math.round(this.x), Math.round(top - 7 + Math.sin(G.realMs / 200) * 1));
      this.icon.setDepth(9500 + this.y);
    } else this.icon.setVisible(false);
  }

  destroy() {
    this.sprite.destroy(); this.label.destroy(); this.icon.destroy();
  }
}

// ---- Routinen ----------------------------------------------------------------

// Freunde: Café, Bänke, Wiese, Läden
function routineFriend(a) {
  const hour = G.minute / 60;
  let spot;
  const r = Math.random();
  const cafeBias = hour >= 10 ? B('npc.cafeAnteilAb10', 0.55) : 0.2;
  if (r < cafeBias) spot = pick(LOC.cafeSeats);
  else if (r < cafeBias + 0.25) { const b = pick(LOC.benches.slice(0, 2)); spot = { x: b.x + rndInt(0, 2), y: b.y + 1 }; }
  else if (r < cafeBias + 0.4) spot = pick(LOC.meadow);
  else { const s = LOC.shops[pick(Object.keys(LOC.shops))]; spot = s.front || { x: s.door.x, y: s.door.y + 1 }; }
  const free = randomWalkableNear(a.scene.grid, spot.x, spot.y, 0);
  a.goToTile(free.x, free.y);
  a.idleUntil = G.realMs + rnd(B('npc.pauseMin', 8), B('npc.pauseMax', 25)) * 1000;
}

// Herumwandern über den ganzen Platz (nicht ins Café)
function routineWander(a) {
  const spots = [].concat(LOC.meadow, LOC.wander);
  const s = pick(spots);
  const free = randomWalkableNear(a.scene.grid, s.x, s.y, 1);
  if (isCafeFloorTile(a.scene.grid, free.x, free.y)) return;
  a.goToTile(free.x, free.y);
  a.idleUntil = G.realMs + rnd(3, 12) * 1000;
}

// Stehen bleiben / kleine Schritte um den Heimatpunkt
function routineHome(a) {
  if (dist(a.x, a.y, a.homeX, a.homeY) > 6) { a.goToPx(a.homeX, a.homeY); }
  a.idleUntil = G.realMs + rnd(4, 10) * 1000;
}

// Hausmasta: ganz langsam zur nächsten Bank, hinsetzen, essen, weiter
function routineHausmasta(a) {
  const seats = LOC.benchSeats || [];
  if (!seats.length) return routineWander(a);
  if (a.data.seat && a.atTile(a.data.seat.front.x, a.data.seat.front.y)) {
    const s = a.data.seat;
    a.data.seat = null;
    a.data.sitUntil = G.realMs + rnd(B('npc.hausmastaSitzenMin', 25), B('npc.hausmastaSitzenMax', 50)) * 1000;
    a.data.standUp = s.front;
    a.setPos(s.px, s.py + 1);
    a.setState('sitting');
    a.data.sitting = true;
    return;
  }
  const s = pick(seats);
  a.data.seat = s;
  a.goToTile(s.front.x, s.front.y);
  a.idleUntil = G.realMs + 500;
}

function isCafeFloorTile(grid, tx, ty) {
  const t = grid.ground[ty] && grid.ground[ty][tx];
  return t === TI.FLOOR || t === TI.DOOR;
}
