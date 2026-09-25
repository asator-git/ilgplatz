// ---------------------------------------------------------------
// map.js – Karte Ilgplatz (40×40 Kacheln), Kollision, Wegfindung
// ---------------------------------------------------------------
'use strict';

const MAP_W = 40, MAP_H = 40, MCX = 20, MCY = 20;
const R_ISLAND = 6.6, R_ROAD = 10, R_WALK = 13.2;

// Orte in Kachel-Koordinaten
const LOC = {
  fountain: { x: 19, y: 19, w: 2, h: 2 },
  cafeRoom: { x0: 25, y0: 3, x1: 32, y1: 8 },
  cafeDoorCols: [28, 29],
  cafeZone: { x0: 25, y0: 3, x1: 32, y1: 11 },
  counter: { x: 26, y: 4, w: 5 },
  daniel: { x: 28, y: 3 },
  lena: { x: 32, y: 4 },
  glue: { x: 28, y: 6 },
  cafeSeats: [{ x: 25, y: 6 }, { x: 26, y: 8 }, { x: 31, y: 7 }, { x: 32, y: 6 }, { x: 30, y: 8 }, { x: 25, y: 8 }, { x: 27, y: 7 }],
  cafeTables: [{ x: 26, y: 7 }, { x: 31, y: 6 }],
  cafeFront: { x: 27, y: 11 },
  tesla: { x: 29, y: 13 },
  marcoHome: { x: 30, y: 14 },
  benches: [{ x: 16, y: 15 }, { x: 21, y: 24 }, { x: 2, y: 23 }],
  hubiWait: { x: 16, y: 21 },
  meadow: [{ x: 15, y: 18 }, { x: 17, y: 16 }, { x: 23, y: 17 }, { x: 24, y: 21 }, { x: 18, y: 24 }, { x: 22, y: 22 }, { x: 16, y: 22 }, { x: 20, y: 16 }],
  concert: { x: 21, y: 17 },
  shops: {
    radbande:   { door: { x: 10, y: 10 }, keeper: 'didi',      name: 'Radbande' },
    schlosserei:{ door: { x: 29, y: 29 }, keeper: 'schlosser', name: 'Schlosserei' },
    museum:     { door: { x: 10, y: 29 }, keeper: 'michi',     name: 'Zirkus & Clown Museum' },
    deewan:     { door: { x: 24, y: 34 }, keeper: 'koch',      name: 'Deewan' },
    dezentral:  { door: { x: 34, y: 15 }, keeper: 'wirt',      name: 'Dezentral' },
    cafe:       { door: { x: 28, y: 9 }, keeper: 'daniel',    name: 'The Good Coffee Society' }
  },
  stern: { x0: 0, y0: 16, x1: 7, y1: 23 },
  sternSpots: [{ x: 3, y: 17 }, { x: 6, y: 22 }],
  bikeSpot: { x: 1, y: 17 },
  socket: { x: 11, y: 30 },
  fightZone: { x: 27, y: 26, r: 2.6 },
  opaSpot: { x: 31, y: 24 },
  spawnMeadow: { x: 17, y: 20 },
  start: { x: 26, y: 11 },
  lanterns: [], // wird berechnet
  plums: [{ x: 15, y: 17 }, { x: 24, y: 16 }, { x: 16, y: 23 }, { x: 23, y: 23 }],
  greens: [{ x: 19, y: 14 }, { x: 14, y: 20 }, { x: 25, y: 20 }, { x: 20, y: 25 }],
  mapEdgeSpots: [{ x: 19, y: 1 }, { x: 38, y: 19 }, { x: 20, y: 38 }, { x: 1, y: 20 }]
};

function isBuildingQuadrant(x, y) {
  const inV = x >= 16 && x <= 23, inH = y >= 16 && y <= 23;
  return !inV && !inH;
}

function quadrantOf(x, y) { return (x < MCX ? 0 : 1) + (y < MCY ? 0 : 2); }

// Reiner Karten-Aufbau (ohne Phaser) → { ground, solid, cost }
function buildGrid() {
  const ground = [], solid = [];
  for (let y = 0; y < MAP_H; y++) {
    ground.push(new Array(MAP_W).fill(0));
    solid.push(new Array(MAP_W).fill(false));
  }
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const dx = x + 0.5 - MCX, dy = y + 0.5 - MCY, d = Math.hypot(dx, dy);
    const inV = x >= 16 && x <= 23, inH = y >= 16 && y <= 23;
    let t;
    if (d <= R_ISLAND) {
      const n = (x * 7 + y * 13) % 11;
      t = n === 0 ? TI.FLOWERS : (n < 4 ? TI.GRASS2 : TI.GRASS);
      const ring = Math.abs(d - 3.6) < 0.55;
      if (ring && (x + y) % 2 === 0) t = TI.PLATE;
    } else if (d <= R_ROAD) {
      t = Math.abs(dx) < 1.1 ? TI.ZEBRA_H : (Math.abs(dy) < 1.1 ? TI.ZEBRA : TI.ROAD);
    } else if (inV || inH) {
      const roadV = inV && x >= 18 && x <= 21 && (y < 16 || y > 23);
      const roadH = inH && y >= 18 && y <= 21 && (x < 16 || x > 23);
      t = (roadV || roadH) ? TI.ROAD : TI.SIDEWALK;
      if (inH && x <= LOC.stern.x1 && !roadH) t = TI.STERN;
    } else if (d <= R_WALK) {
      t = TI.SIDEWALK;
    } else {
      t = TI.ROOF + quadrantOf(x, y);
      solid[y][x] = true;
    }
    ground[y][x] = t;
  }
  // Café-Raum ausschneiden
  const cr = LOC.cafeRoom;
  for (let y = cr.y0; y <= cr.y1; y++) for (let x = cr.x0; x <= cr.x1; x++) { ground[y][x] = TI.FLOOR; solid[y][x] = false; }
  // Rahmen um das Café erzwingen (Wände), Tür unten
  for (let y = cr.y0 - 1; y <= cr.y1 + 1; y++) for (let x = cr.x0 - 1; x <= cr.x1 + 1; x++) {
    if (x >= cr.x0 && x <= cr.x1 && y >= cr.y0 && y <= cr.y1) continue;
    solid[y][x] = true; ground[y][x] = TI.ROOF + 1;
  }
  for (const cx of LOC.cafeDoorCols) {
    ground[cr.y1 + 1][cx] = TI.DOOR; solid[cr.y1 + 1][cx] = false;
    let y = cr.y1 + 2;
    while (y < MAP_H && solid[y][cx]) { ground[y][cx] = TI.SIDEWALK; solid[y][cx] = false; y++; }
  }
  // Fassaden: Gebäude neben begehbarer Fläche
  const walk = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && !solid[y][x];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!solid[y][x]) continue;
    const inCafe = x >= cr.x0 - 1 && x <= cr.x1 + 1 && y >= cr.y0 - 1 && y <= cr.y1 + 1;
    if (walk(x, y + 1)) {
      ground[y][x] = (inCafe && walk(x, y + 1) && ground[y + 1][x] === TI.FLOOR) ? TI.INWALL : TI.WALL + quadrantOf(x, y);
    } else if (walk(x, y - 1) || walk(x - 1, y) || walk(x + 1, y)) {
      ground[y][x] = TI.WALL + quadrantOf(x, y);
    }
  }
  // Ladentüren (nicht betretbar, nur Deko + Interaktion)
  for (const id in LOC.shops) {
    if (id === 'cafe') continue;
    const d = LOC.shops[id].door;
    if (solid[d.y] && solid[d.y][d.x]) ground[d.y][d.x] = TI.SHOPDOOR;
  }
  // Wegkosten (NPCs meiden Straße, nehmen Zebrastreifen)
  const cost = [];
  for (let y = 0; y < MAP_H; y++) {
    cost.push([]);
    for (let x = 0; x < MAP_W; x++) cost[y].push(ground[y][x] === TI.ROAD ? 6 : 1);
  }
  return { ground, solid, cost };
}

// Laternen auf dem Gehsteig-Ring
(function () {
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) * Math.PI / 4;
    LOC.lanterns.push({ x: Math.round(MCX + Math.cos(a) * 11.4 - 0.5), y: Math.round(MCY + Math.sin(a) * 11.4 - 0.5) });
  }
})();

// ---- Wegfindung (A*, 8 Richtungen, keine Ecken schneiden) ----------------
function findPath(grid, sx, sy, tx, ty, maxIter) {
  const W = MAP_W, H = MAP_H;
  const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !grid.solid[y][x];
  if (!ok(tx, ty)) {
    // nächstgelegene freie Kachel
    let best = null, bd = 1e9;
    for (let y = Math.max(0, ty - 3); y <= Math.min(H - 1, ty + 3); y++)
      for (let x = Math.max(0, tx - 3); x <= Math.min(W - 1, tx + 3); x++)
        if (ok(x, y)) { const d = Math.abs(x - tx) + Math.abs(y - ty); if (d < bd) { bd = d; best = { x, y }; } }
    if (!best) return null;
    tx = best.x; ty = best.y;
  }
  if (!ok(sx, sy)) return [{ x: tx, y: ty }];
  const idx = (x, y) => y * W + x;
  const g = new Float32Array(W * H).fill(Infinity);
  const from = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);
  const open = [];
  const h = (x, y) => Math.hypot(x - tx, y - ty);
  g[idx(sx, sy)] = 0;
  open.push({ x: sx, y: sy, f: h(sx, sy) });
  let iter = 0;
  const lim = maxIter || 4000;
  while (open.length && iter++ < lim) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open[bi]; open.splice(bi, 1);
    const ci = idx(cur.x, cur.y);
    if (closed[ci]) continue;
    closed[ci] = 1;
    if (cur.x === tx && cur.y === ty) {
      const path = [];
      let i = ci;
      while (i !== -1 && i !== idx(sx, sy)) { path.push({ x: i % W, y: Math.floor(i / W) }); i = from[i]; }
      return path.reverse();
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!ok(nx, ny)) continue;
      if (dx && dy && (!ok(cur.x + dx, cur.y) || !ok(cur.x, cur.y + dy))) continue;
      const ni = idx(nx, ny);
      if (closed[ni]) continue;
      const step = (dx && dy ? 1.414 : 1) * grid.cost[ny][nx];
      const ng = g[ci] + step;
      if (ng < g[ni]) { g[ni] = ng; from[ni] = ci; open.push({ x: nx, y: ny, f: ng + h(nx, ny) }); }
    }
  }
  return null;
}

// Sichtlinie (Bresenham über Kacheln)
function lineOfSight(grid, x0, y0, x1, y1) {
  let tx0 = Math.floor(x0 / TILE), ty0 = Math.floor(y0 / TILE);
  const tx1 = Math.floor(x1 / TILE), ty1 = Math.floor(y1 / TILE);
  const dx = Math.abs(tx1 - tx0), dy = Math.abs(ty1 - ty0);
  const sx = tx0 < tx1 ? 1 : -1, sy = ty0 < ty1 ? 1 : -1;
  let err = dx - dy, n = 0;
  while (n++ < 100) {
    if (grid.solid[ty0] && grid.solid[ty0][tx0] && !(tx0 === tx1 && ty0 === ty1)) return false;
    if (tx0 === tx1 && ty0 === ty1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; tx0 += sx; }
    if (e2 < dx) { err += dx; ty0 += sy; }
  }
  return true;
}

function inRect(tx, ty, r) { return tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1; }
function inCafe(px, py) { return inRect(Math.floor(px / TILE), Math.floor(py / TILE), LOC.cafeZone) && Math.floor(py / TILE) <= LOC.cafeRoom.y1 + 2 && isCafeFloor(px, py); }
let _gridRef = null;
function isCafeFloor(px, py) {
  if (!_gridRef) return false;
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  const t = _gridRef.ground[ty] && _gridRef.ground[ty][tx];
  return t === TI.FLOOR || t === TI.DOOR;
}
function tileAt(grid, px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return grid.ground[ty] ? grid.ground[ty][tx] : -1;
}
function isSolidPx(grid, px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  return grid.solid[ty][tx];
}
function randomWalkableNear(grid, tx, ty, r) {
  for (let i = 0; i < 30; i++) {
    const x = tx + rndInt(-r, r), y = ty + rndInt(-r, r);
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && !grid.solid[y][x] && grid.ground[y][x] !== TI.ROAD) return { x, y };
  }
  return { x: tx, y: ty };
}
function isRoadPx(grid, px, py) {
  const t = tileAt(grid, px, py);
  return t === TI.ROAD || t === TI.ZEBRA || t === TI.ZEBRA_H;
}

// ---- Rendering in Phaser ----------------------------------------------------
function renderMap(scene, grid) {
  _gridRef = grid;
  const map = scene.make.tilemap({ data: grid.ground, tileWidth: TILE, tileHeight: TILE });
  const ts = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
  const layer = map.createLayer(0, ts, 0, 0);
  layer.setDepth(-1000);
  return { map, layer };
}

// Objekte platzieren & Kollision setzen. Gibt Liste interaktiver Objekte zurück.
function placeObjects(scene, grid) {
  const objs = {};
  const setSolid = (x, y) => { if (grid.solid[y]) grid.solid[y][x] = true; };
  const img = (key, px, py, ox, oy) => {
    const s = scene.add.image(px, py, key).setOrigin(ox === undefined ? 0.5 : ox, oy === undefined ? 1 : oy);
    s.setDepth(py);
    return s;
  };
  // Quelle
  const f = LOC.fountain;
  objs.fountain = scene.add.sprite((f.x + 1) * TILE, (f.y + 1) * TILE, 'fountain', 0).setDepth((f.y + 2) * TILE - 4);
  for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) setSolid(x, y);
  // Bänke
  objs.benches = LOC.benches.map((b) => {
    const s = img('bench', (b.x + 1.5) * TILE, (b.y + 1) * TILE - 1);
    for (let i = 0; i < 3; i++) setSolid(b.x + i, b.y);
    s.homeX = s.x; s.homeY = s.y;
    return s;
  });
  // Bäume
  objs.trees = [];
  LOC.plums.forEach(t => { objs.trees.push(Object.assign(img('tree_plum', (t.x + 0.5) * TILE, (t.y + 1) * TILE + 1), { kind: 'plum', tx: t.x, ty: t.y })); setSolid(t.x, t.y); });
  LOC.greens.forEach(t => { objs.trees.push(Object.assign(img('tree_green', (t.x + 0.5) * TILE, (t.y + 1) * TILE + 1), { kind: 'green', tx: t.x, ty: t.y })); setSolid(t.x, t.y); });
  // Laternen
  objs.lanterns = LOC.lanterns.map(l => {
    if (grid.solid[l.y][l.x]) return null;
    const s = img('lantern', (l.x + 0.5) * TILE, (l.y + 1) * TILE);
    setSolid(l.x, l.y);
    return s;
  }).filter(Boolean);
  // Tesla
  const t = LOC.tesla;
  objs.tesla = img('tesla', (t.x + 1) * TILE, (t.y + 1) * TILE);
  setSolid(t.x, t.y); setSolid(t.x + 1, t.y);
  // Café-Einrichtung
  const c = LOC.counter;
  objs.counter = img('counter', (c.x + c.w / 2) * TILE, (c.y + 1) * TILE + 2);
  for (let i = 0; i < c.w; i++) setSolid(c.x + i, c.y);
  objs.tables = LOC.cafeTables.map(tb => { setSolid(tb.x, tb.y); return img('table', (tb.x + 0.5) * TILE, (tb.y + 1) * TILE - 1); });
  // Radständer, Mistkübel
  img('bikerack', 13 * TILE, 12 * TILE);
  [{ x: 13, y: 26 }, { x: 26, y: 26 }, { x: 13, y: 13 }, { x: 22, y: 31 }].forEach(b => { if (!grid.solid[b.y][b.x]) { img('bin', (b.x + 0.5) * TILE, (b.y + 1) * TILE); setSolid(b.x, b.y); } });
  // Steckdose am Museum
  objs.socket = img('socket', (LOC.socket.x + 0.5) * TILE, LOC.socket.y * TILE + 10);
  objs.socket.setDepth(LOC.socket.y * TILE + 20);
  // Terminals neben den Läden
  objs.terminals = [];
  const termSpots = {
    cafe: { x: 32, y: 3 }, radbande: { x: 12, y: 12 }, schlosserei: { x: 27, y: 28 },
    museum: { x: 9, y: 27 }, deewan: { x: 23, y: 36 }, dezentral: { x: 36, y: 16 }
  };
  for (const id in termSpots) {
    const p = termSpots[id];
    if (grid.solid[p.y][p.x]) continue;
    const s = img('terminal', (p.x + 0.5) * TILE, (p.y + 1) * TILE - 1);
    s.shopId = id; s.tx = p.x; s.ty = p.y;
    setSolid(p.x, p.y);
    objs.terminals.push(s);
  }
  // Ladenschilder
  objs.signs = [];
  for (const id in LOC.shops) {
    const sh = LOC.shops[id];
    const label = T('orte.' + id, null, sh.name);
    const isCafe = id === 'cafe';
    const tx = scene.add.text((sh.door.x + (isCafe ? 1 : 0.5)) * TILE, sh.door.y * TILE + (isCafe ? 1 : -2), label, {
      fontFamily: '"Press Start 2P", monospace', fontSize: isCafe ? '5px' : '6px', color: isCafe ? '#ffd166' : '#fff8e7',
      backgroundColor: isCafe ? '#1b1b2fdd' : '#3d2b1fcc', padding: { x: 2, y: 2 }
    }).setOrigin(0.5, isCafe ? 0 : 1).setDepth(isCafe ? (sh.door.y + 1) * TILE + 1 : 5000).setResolution(6);
    objs.signs.push(tx);
  }
  const stern = scene.add.text(3.5 * TILE, 16 * TILE - 2, T('orte.stern', null, 'Stern'), {
    fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#ffd166', backgroundColor: '#000000aa', padding: { x: 2, y: 2 }
  }).setOrigin(0.5, 1).setDepth(5000).setResolution(4);
  objs.signs.push(stern);
  return objs;
}

// Node-Export für Tests
if (typeof module !== 'undefined') module.exports = { buildGrid, findPath, LOC, MAP_W, MAP_H };
