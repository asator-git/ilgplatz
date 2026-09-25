// ---------------------------------------------------------------
// world.js – Hauptszene: Karte, Spieler, Kamera, Spielschleife
// ---------------------------------------------------------------
'use strict';

class WorldScene extends Phaser.Scene {
  constructor() { super('World'); }

  init(data) {
    this.figur = (data && data.figur) || 'hubi';
  }

  create() {
    G = {
      figur: this.figur,
      minute: 8 * 60,
      realMs: 0,
      paused: false
    };
    this.grid = buildGrid();
    renderMap(this, this.grid);
    this.objs = placeObjects(this, this.grid);
    this.fountainT = 0;

    // Spieler
    const st = LOC.start;
    this.player = new Actor(this, this.figur, { kind: 'player', pos: { x: st.x * TILE + 8, y: st.y * TILE + 14 }, speed: B('spieler.tempo', 72), labelColor: '#ffd166' });

    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
    this.applyZoom();
    this.cameras.main.setRoundPixels(true);
  }

  applyZoom() {
    const cam = this.cameras.main;
    const w = this.scale.gameSize.width, h = this.scale.gameSize.height;
    const z = Math.max(2, Math.round(Math.min(w, h) / (TILE * B('kamera.kachelnSichtbar', 12))));
    cam.setZoom(z);
    this.zoom = z;
  }

  update(time, delta) {
    const dt = Math.min(delta, 50);
    G.realMs += dt;
    this.updatePlayer(dt);
    // Brunnen-Animation
    this.fountainT += dt;
    if (this.fountainT > 400) { this.fountainT = 0; this.objs.fountain.setFrame(this.objs.fountain.frame.name === 0 ? 1 : 0); }
  }

  // ---- Spielerbewegung mit Kachel-Kollision ----
  playerBlocked(px, py) {
    const g = this.grid;
    const hw = 4.5, top = 6;
    return isSolidPx(g, px - hw, py - top) || isSolidPx(g, px + hw, py - top) ||
      isSolidPx(g, px - hw, py - 1) || isSolidPx(g, px + hw, py - 1);
  }

  updatePlayer(dt) {
    const p = this.player;
    p.updateState();
    p.moving = false;
    const a = Input.axis();
    if (a.x || a.y) {
      const sp = p.curSpeed() * dt / 1000;
      const nx = p.x + a.x * sp, ny = p.y + a.y * sp;
      if (!this.playerBlocked(nx, p.y)) p.x = nx;
      else if (a.x && !a.y) this.nudge(p, 'y', a.x * sp);
      if (!this.playerBlocked(p.x, ny)) p.y = ny;
      else if (a.y && !a.x) this.nudge(p, 'x', a.y * sp);
      if (Math.abs(a.x) > 0.1) p.facing = a.x < 0 ? -1 : 1;
      p.moving = true;
    }
    p.sync(dt);
  }

  // An Ecken vorbeirutschen
  nudge(p, axis, amount) {
    for (let o = 1; o <= 6; o++) {
      for (const s of [-1, 1]) {
        if (axis === 'y') {
          if (!this.playerBlocked(p.x + amount, p.y + s * o) && !this.playerBlocked(p.x, p.y + s * Math.min(o, 1))) { p.y += s * Math.min(1, o); return; }
        } else {
          if (!this.playerBlocked(p.x + s * o, p.y + amount) && !this.playerBlocked(p.x + s * Math.min(o, 1), p.y)) { p.x += s * Math.min(1, o); return; }
        }
      }
    }
  }
}
