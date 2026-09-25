// ---------------------------------------------------------------
// map.js – Karte Ilgplatz (40×40 Kacheln), Kollision, Wegfindung
// ---------------------------------------------------------------
'use strict';

const MAP_W = 40, MAP_H = 40, MCX = 20, MCY = 20;
const R_ISLAND = 6.6, R_ROAD = 10, R_WALK = 13.2;

// Echte Lage am Ilgplatz (laut OpenStreetMap), Kompass-Grad: 0 = Nord, 90 = Ost
const STREETS = [
  { id: 'hiller', name: 'Hillerstraße', ang: 45 },
  { id: 'feuerbach', name: 'Feuerbachstraße', ang: 315 },
  { id: 'obermuellner', name: 'Obermüllnerstraße', ang: 270 },   // → Praterstern (weit weg)
  { id: 'schrotzberg', name: 'Schrotzbergstraße', ang: 180 }
];
const ROAD_HALF = 2.0, WALK_HALF = 3.6;

function dirOf(ang) { const r = ang * Math.PI / 180; return { x: Math.sin(r), y: -Math.cos(r) }; }
// Punkt (Kachel) in Richtung ang mit Abstand r von der Platzmitte
function ringTile(ang, r) { const u = dirOf(ang); return { x: Math.floor(MCX + u.x * r), y: Math.floor(MCY + u.y * r) }; }

// Orte in Kachel-Koordinaten (Türen etc. werden in buildGrid() aus den Winkeln berechnet)
const LOC = {
  fountain: { x: 19, y: 19, w: 2, h: 2 },
  // Café liegt im Osten (Ilgplatz 6), Tür nach Westen zum Platz
  cafeRoom: { x0: 33, y0: 13, x1: 38, y1: 18 },
  cafeDoor: [{ x: 32, y: 15 }, { x: 32, y: 16 }],
  cafeZone: { x0: 32, y0: 13, x1: 38, y1: 18 },
  counter: { x: 34, y: 14, w: 5 },
  daniel: { x: 36, y: 13 },
  lena: { x: 38, y: 15 },
  glue: { x: 36, y: 16 },
  cafeSeats: [{ x: 34, y: 17 }, { x: 36, y: 18 }, { x: 38, y: 17 }, { x: 37, y: 15 }, { x: 33, y: 18 }, { x: 34, y: 15 }, { x: 37, y: 18 }],
  cafeTables: [{ x: 35, y: 17 }, { x: 38, y: 16 }],
  cafeFront: { x: 30, y: 15 },
  tesla: { x: 30, y: 19 },
  marcoHome: { x: 30, y: 20 },
  benches: [{ x: 16, y: 15 }, { x: 21, y: 24 }, { x: 2, y: 23 }],
  hubiWait: { x: 16, y: 21 },
  meadow: [{ x: 15, y: 18 }, { x: 17, y: 16 }, { x: 23, y: 17 }, { x: 24, y: 21 }, { x: 18, y: 24 }, { x: 22, y: 22 }, { x: 16, y: 22 }, { x: 20, y: 16 }],
  concert: { x: 21, y: 17 },
  // Winkel = echte Richtung vom Platz aus
  shops: {
    dezentral:   { ang: 13,  keeper: 'wirt',      name: 'Dezentral' },          // Ilgplatz 5, Nord
    museum:      { ang: 106, keeper: 'michi',     name: 'Zirkus & Clown Museum' }, // Ilgplatz 7, Ost-Südost
    schlosserei: { ang: 236, keeper: 'schlosser', name: 'Schlosserei' },         // Ilgplatz 1, neben Radbande
    radbande:    { ang: 252, keeper: 'didi',      name: 'Radbande' },            // Ilgplatz 2, West-Südwest
    deewan:      { street: 'hiller', along: 18, side: 1, keeper: 'koch', name: 'Deewan' }, // Hillerstraße 4
    cafe:        { door: { x: 32, y: 15 }, keeper: 'daniel', name: 'The Good Coffee Society' }
  },
  stern: { x0: 0, y0: 16, x1: 7, y1: 23 },     // Richtung Praterstern (weit weg im Westen)
  sternSpots: [{ x: 3, y: 17 }, { x: 6, y: 22 }],
  bikeSpot: { x: 1, y: 17 },
  socket: { x: 0, y: 0 },
  fightZone: { x: 0, y: 0, r: 2.6 },
  opaSpot: { x: 0, y: 0 },
  spawnMeadow: { x: 17, y: 20 },
  start: { x: 30, y: 16 },
  lanterns: [],
  plums: [{ x: 15, y: 17 }, { x: 24, y: 16 }, { x: 16, y: 23 }, { x: 23, y: 23 }],
  greens: [{ x: 19, y: 14 }, { x: 14, y: 20 }, { x: 25, y: 20 }, { x: 20, y: 25 }],
  mapEdgeSpots: [],
  wander: [],
  spawns: {}
};

function quadrantOf(x, y) { return (x < MCX ? 0 : 1) + (y < MCY ? 0 : 2); }

// Abstand einer Kachelmitte zu einer Straße (entlang / quer)
function streetMetrics(x, y, st) {
  const u = dirOf(st.ang);
  const dx = x + 0.5 - MCX, dy = y + 0.5 - MCY;
  return { along: dx * u.x + dy * u.y, perp: Math.abs(dx * u.y - dy * u.x) };
}

// Reiner Karten-Aufbau (ohne Phaser) → { ground, solid, cost }; berechnet auch Türen & Orte in LOC
function buildGrid() {
  const ground = [], solid = [];
  for (let y = 0; y < MAP_H; y++) {
    ground.push(new Array(MAP_W).fill(0));
    solid.push(new Array(MAP_W).fill(false));
  }
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const dx = x + 0.5 - MCX, dy = y + 0.5 - MCY, d = Math.hypot(dx, dy);
    let t, road = false, walk = false, zebra = null;
    for (const st of STREETS) {
      const m = streetMetrics(x, y, st);
      if (m.along <= 0) continue;
      if (m.perp <= ROAD_HALF) road = true;
      else if (m.perp <= WALK_HALF) walk = true;
      if (d > R_ISLAND && d <= R_ROAD && m.perp < 1.3) zebra = st.ang % 180 === 90 ? TI.ZEBRA : TI.ZEBRA_H;
    }
    if (d <= R_ISLAND) {
      const n = (x * 7 + y * 13) % 11;
      t = n === 0 ? TI.FLOWERS : (n < 4 ? TI.GRASS2 : TI.GRASS);
      if (Math.abs(d - 3.6) < 0.55 && (x + y) % 2 === 0) t = TI.PLATE;
    } else if (d <= R_ROAD) {
      t = zebra !== null ? zebra : TI.ROAD;
    } else if (road) {
      t = TI.ROAD;
    } else if (walk || d <= R_WALK) {
      t = TI.SIDEWALK;
      if (x <= LOC.stern.x1 && y >= LOC.stern.y0 && y <= LOC.stern.y1) t = TI.STERN;
    } else {
      t = TI.ROOF + quadrantOf(x, y);
      solid[y][x] = true;
    }
    ground[y][x] = t;
  }
  // Café-Raum ausschneiden, Rahmen erzwingen, Tür nach Westen
  const cr = LOC.cafeRoom;
  for (let y = cr.y0 - 1; y <= cr.y1 + 1; y++) for (let x = cr.x0 - 1; x <= cr.x1 + 1; x++) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
    const inside = x >= cr.x0 && x <= cr.x1 && y >= cr.y0 && y <= cr.y1;
    solid[y][x] = !inside; ground[y][x] = inside ? TI.FLOOR : TI.ROOF + 1;
  }
  for (const c of LOC.cafeDoor) {
    ground[c.y][c.x] = TI.DOOR; solid[c.y][c.x] = false;
    let x = c.x - 1;
    while (x >= 0 && solid[c.y][x]) { ground[c.y][x] = TI.SIDEWALK; solid[c.y][x] = false; x--; }
  }
  // Fassaden: Gebäude neben begehbarer Fläche
  const walkable = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && !solid[y][x];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!solid[y][x]) continue;
    if (walkable(x, y + 1)) ground[y][x] = ground[y + 1][x] === TI.FLOOR ? TI.INWALL : TI.WALL + quadrantOf(x, y);
    else if (walkable(x, y - 1) || walkable(x - 1, y) || walkable(x + 1, y)) ground[y][x] = TI.WALL + quadrantOf(x, y);
  }
  computeLocations(ground, solid);
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

// Türen, Standplätze, Laternen, Spawnpunkte aus der echten Geografie ableiten
function computeLocations(ground, solid) {
  const walkable = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && !solid[y][x];
  const isWalk = (x, y) => walkable(x, y) && ![TI.ROAD, TI.ZEBRA, TI.ZEBRA_H].includes(ground[y][x]);
  // Vom Punkt p in Richtung u laufen, bis eine Wand kommt → Tür + Standplatz davor
  const march = (px, py, u) => {
    let last = null;
    for (let r = 0; r < 30; r += 0.25) {
      const x = Math.floor(px + u.x * r), y = Math.floor(py + u.y * r);
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) break;
      if (solid[y][x]) { if (last) return { door: { x, y }, front: last }; }
      else if (isWalk(x, y)) last = { x, y };
    }
    return null;
  };
  for (const id in LOC.shops) {
    const sh = LOC.shops[id];
    let res = null;
    if (id === 'cafe') { sh.front = { x: 31, y: 15 }; continue; }
    if (sh.street) {
      const st = STREETS.find(s => s.id === sh.street);
      const u = dirOf(st.ang), n = dirOf(st.ang + 90 * sh.side);
      res = march(MCX + u.x * sh.along, MCY + u.y * sh.along, n);
    } else {
      res = march(MCX, MCY, dirOf(sh.ang));
    }
    if (res) { sh.door = res.door; sh.front = res.front; }
    else { sh.door = { x: 1, y: 1 }; sh.front = { x: 1, y: 2 }; }
  }
  // Nächste begehbare Nicht-Straßen-Kachel
  const nearWalk = (t, r) => {
    for (let rr = 0; rr <= (r || 4); rr++)
      for (let y = t.y - rr; y <= t.y + rr; y++) for (let x = t.x - rr; x <= t.x + rr; x++)
        if (isWalk(x, y)) return { x, y };
    return { x: LOC.spawnMeadow.x, y: LOC.spawnMeadow.y };
  };
  // Steckdose: Wand neben der Museumstür
  const md = LOC.shops.museum.door, mf = LOC.shops.museum.front;
  const side = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([a, b]) => ({ x: md.x + a, y: md.y + b }))
    .find(t => solid[t.y] && solid[t.y][t.x] && (t.x !== md.x || t.y !== md.y) && (walkable(t.x + (mf.x - md.x), t.y + (mf.y - md.y))));
  LOC.socket = side || md;
  LOC.socketFront = { x: LOC.socket.x + (mf.x - md.x), y: LOC.socket.y + (mf.y - md.y) };
  // Zuhälter raufen vor der Schlosserei
  const sf = LOC.shops.schlosserei.front;
  const fz = ringTile(LOC.shops.schlosserei.ang, 9.6);
  LOC.fightZone = { x: fz.x, y: fz.y, r: 2.6 };
  LOC.opaSpot = nearWalk(ringTile(LOC.shops.schlosserei.ang - 30, 11.6), 3);
  // Laternen auf dem Gehsteig-Ring (nicht vor Türen)
  LOC.lanterns = [];
  for (let i = 0; i < 8; i++) {
    const t = ringTile(i * 45 + 22, 11.6);
    const busy = Object.values(LOC.shops).some(sh => sh.front && Math.abs(sh.front.x - t.x) + Math.abs(sh.front.y - t.y) < 3);
    if (isWalk(t.x, t.y) && !busy) LOC.lanterns.push(t);
  }
  // Straßenenden (Kiwara, Hubi-Gassi, Doppler)
  LOC.streetEnds = {};
  for (const st of STREETS) {
    let best = null;
    for (let r = 12; r < 30; r += 0.5) { const t = ringTile(st.ang, r); if (walkable(t.x, t.y)) best = t; }
    LOC.streetEnds[st.id] = best || { x: MCX, y: 1 };
  }
  LOC.mapEdgeSpots = STREETS.map(st => LOC.streetEnds[st.id]);
  // Spaziergänge: Punkte rund um den Platz + auf den Straßen
  LOC.wander = [];
  for (let i = 0; i < 12; i++) { const t = ringTile(i * 30 + 15, 11.6); if (isWalk(t.x, t.y)) LOC.wander.push(t); }
  for (const st of STREETS) { const u = dirOf(st.ang), n = dirOf(st.ang + 90); LOC.wander.push(nearWalk({ x: Math.floor(MCX + u.x * 16 + n.x * 3), y: Math.floor(MCY + u.y * 16 + n.y * 3) }, 3)); }
  LOC.wander.push({ x: 5, y: 22 });
  // Spawnpunkte
  const ring = (ang) => nearWalk(ringTile(ang, 11.6), 3);
  LOC.spawns = {
    ex: [ring(300), ring(150), ring(200), ring(30)],
    erwin: ring(200), bobo: ring(35), markus: ring(160),
    nadja: { x: 1, y: 22 }, opa: { x: 3, y: 22 },
    doppler: LOC.streetEnds.hiller, gassi: LOC.streetEnds.feuerbach,
    rasiererin: { x: 18, y: 21 }
  };
}

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
function inCafe(px, py) { return isCafeFloor(px, py); }
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
  { const rf = LOC.shops.radbande.front; img('bikerack', (rf.x + 0.5) * TILE, (rf.y + 2) * TILE); }
  [ringTile(80, 12.4), ringTile(170, 12.2), ringTile(290, 12.2), ringTile(20, 12.4)].forEach(b => { if (!grid.solid[b.y][b.x]) { img('bin', (b.x + 0.5) * TILE, (b.y + 1) * TILE); setSolid(b.x, b.y); } });
  // Steckdose am Museum
  objs.socket = img('socket', (LOC.socket.x + 0.5) * TILE, LOC.socket.y * TILE + 12);
  objs.socket.setDepth(LOC.socket.y * TILE + 20);
  // Terminals neben den Läden
  objs.terminals = [];
  const termSpots = { cafe: { x: 33, y: 13 } };
  for (const id in LOC.shops) {
    if (id === 'cafe') continue;
    const f = LOC.shops[id].front, d = LOC.shops[id].door;
    const cand = [[d.y - f.y, d.x - f.x], [f.y - d.y, f.x - d.x], [1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([a, b]) => ({ x: f.x + a, y: f.y + b }))
      .find(t => grid.solid[t.y] && grid.solid[t.y][t.x] === false && ![TI.ROAD, TI.ZEBRA, TI.ZEBRA_H].includes(grid.ground[t.y][t.x]));
    if (cand) termSpots[id] = cand;
  }
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
    const tx = scene.add.text((sh.door.x + 0.5) * TILE, sh.door.y * TILE - 2, label, {
      fontFamily: '"Press Start 2P", monospace', fontSize: isCafe ? '5px' : '6px', color: isCafe ? '#ffd166' : '#fff8e7',
      backgroundColor: isCafe ? '#1b1b2fdd' : '#3d2b1fcc', padding: { x: 2, y: 2 }
    }).setOrigin(0.5, 1).setDepth(5000).setResolution(6);
    objs.signs.push(tx);
  }
  const stern = scene.add.text(4 * TILE, 16 * TILE - 2, T('orte.stern', null, '← Praterstern'), {
    fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#ffd166', backgroundColor: '#000000aa', padding: { x: 2, y: 2 }
  }).setOrigin(0.5, 1).setDepth(5000).setResolution(4);
  objs.signs.push(stern);
  for (const st of STREETS) {
    if (st.id === 'obermuellner') continue; // dort hängt das Praterstern-Schild
    const t = ringTile(st.ang, 15);
    const n = dirOf(st.ang + (st.id === 'hiller' ? -90 : 90));
    const sx = (t.x + 0.5 + n.x * 4.2) * TILE, sy = (t.y + 0.5 + n.y * 4.2) * TILE;
    objs.signs.push(scene.add.text(sx, sy, T('strassen.' + st.id, null, st.name), {
      fontFamily: '"Press Start 2P", monospace', fontSize: '4px', color: '#ffffff', backgroundColor: '#1d3557dd', padding: { x: 2, y: 1 }
    }).setOrigin(0.5).setDepth(4900).setResolution(6));
  }
  return objs;
}

// Node-Export für Tests
if (typeof module !== 'undefined') module.exports = { buildGrid, findPath, LOC, MAP_W, MAP_H, STREETS };
