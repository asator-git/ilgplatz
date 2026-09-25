// ---------------------------------------------------------------
// textures.js – alle Grafiken werden hier als Pixelart erzeugt
// ---------------------------------------------------------------
'use strict';

const OUTLINE = '#16161d';

// Kachel-Indizes im Tileset
const TI = {
  GRASS: 0, GRASS2: 1, PLATE: 2, ROAD: 3, ZEBRA: 4, SIDEWALK: 5, FLOOR: 6, DOOR: 7,
  ROOF: 8,   // 8..11
  WALL: 12,  // 12..15
  SHOPDOOR: 16, STERN: 17, INWALL: 18, FLOWERS: 19, ZEBRA_H: 20
};
const TILE_COUNT = 21;

// Aussehen aller Figuren
const CHAR_STYLES = {
  hubi:     { skin: '#f1c27d', hair: '#6b3e1e', hairStyle: 'short', beard: '#6b3e1e', shirt: '#1f9e89', pants: '#27325a', shoes: '#3b2416', glasses: 'sun' },
  andi:     { skin: '#f3c99b', hair: '#2b2b2b', hairStyle: 'short', shirt: '#d7263d', pants: '#1b1b1b', shoes: '#111', extra: ['mayorchain'] },
  carla:    { skin: '#ffd9b3', hair: '#e2641a', hairStyle: 'long', shirt: '#ffd23f', pants: '#7b2cbf', shoes: '#5a189a', dress: true },
  juliette: { skin: '#f7d2b0', hair: '#141414', hairStyle: 'beret', beret: '#c1121f', shirt: '#1d3557', stripes: '#f1faee', pants: '#222', shoes: '#c1121f' },
  markus:   { skin: '#f5cfa6', hair: '#e9c46a', hairStyle: 'short', shirt: '#2d6a4f', pants: '#495057', shoes: '#222', glasses: 'nerd', extra: ['laptop'] },
  jewi:     { skin: '#e8b98f', hair: '#1a1a1a', hairStyle: 'ponytail', shirt: '#9b5de5', pants: '#22223b', shoes: '#f15bb5', extra: ['camera'] },
  daniel:   { skin: '#f1c9a5', hair: '#3d2b1f', hairStyle: 'short', shirt: '#f8f9fa', pants: '#343a40', shoes: '#111', extra: ['apron'], apron: '#6f4518' },
  lena:     { skin: '#ffe0bd', hair: '#f4d35e', hairStyle: 'bun', shirt: '#ffffff', pants: '#343a40', shoes: '#111', extra: ['apron', 'tears'], apron: '#6f4518' },
  didi:     { skin: '#f0c090', hair: '#8d5524', hairStyle: 'cap', cap: '#e63946', shirt: '#457b9d', pants: '#1d3557', shoes: '#111', overall: true, extra: ['wrench'] },
  schlosser:{ skin: '#e0ac69', hair: '#999', hairStyle: 'bald', mustache: '#555', shirt: '#6c757d', pants: '#495057', shoes: '#222', overall: true },
  michi:    { skin: '#ffffff', hair: '#ff006e', hairStyle: 'clown', shirt: '#ffbe0b', stripes: '#3a86ff', pants: '#8338ec', shoes: '#ff006e', extra: ['clownnose'] },
  koch:     { skin: '#a86b3c', hair: '#111', hairStyle: 'chef', beard: '#111', shirt: '#f8f9fa', pants: '#2b2d42', shoes: '#111', extra: ['apron'], apron: '#2a9d8f' },
  wirt:     { skin: '#e8b88a', hair: '#222', hairStyle: 'hood', hood: '#3c096c', shirt: '#3c096c', pants: '#111', shoes: '#111' },
  sandra:   { skin: '#ffd6b0', hair: '#ffe066', hairStyle: 'long', shirt: '#ff4d9d', pants: '#3a0ca3', shoes: '#fff', dress: true },
  bianca:   { skin: '#f2c49b', hair: '#101010', hairStyle: 'long', shirt: '#00c2d1', pants: '#222', shoes: '#00c2d1' },
  kathi:    { skin: '#ffdcb5', hair: '#7f4f24', hairStyle: 'ponytail', shirt: '#ff8c00', pants: '#2f3e46', shoes: '#fff' },
  melli:    { skin: '#f7c8a0', hair: '#b5179e', hairStyle: 'bun', shirt: '#9ef01a', pants: '#333', shoes: '#b5179e', dress: true },
  nadja:    { skin: '#f5d0b0', hair: '#0b0b0b', hairStyle: 'long', shirt: '#9d0208', pants: '#370617', shoes: '#000', dress: true, glasses: 'sun' },
  erwin:    { skin: '#e9c29b', hair: '#b0b0b0', hairStyle: 'hat', hat: '#5c3d2e', beard: '#b0b0b0', shirt: '#7f5539', pants: '#3d405b', shoes: '#222', extra: ['guitar'] },
  marco:    { skin: '#e6b48a', hair: '#777', hairStyle: 'bald', shirt: '#111111', pants: '#111111', shoes: '#eee', fat: true, extra: ['goldchain', 'tracksuit'] },
  kiwara:   { skin: '#f1c9a5', hair: '#333', hairStyle: 'police', shirt: '#1b263b', pants: '#0d1b2a', shoes: '#000', extra: ['badge'] },
  sterntyp: { skin: '#d9a066', hair: '#111', hairStyle: 'hood', hood: '#2b2b2b', shirt: '#2b2b2b', pants: '#555', shoes: '#eee' },
  zuhaelter:{ skin: '#e3b47f', hair: '#1a1a1a', hairStyle: 'short', shirt: '#0a0a0a', pants: '#2a2a2a', shoes: '#000', glasses: 'sun', extra: ['goldchain', 'chains'] },
  doppler:  { skin: '#f4b6a0', hair: '#c9c9c9', hairStyle: 'curly', shirt: '#ff85a1', pants: '#6d597a', shoes: '#333', extra: ['bottle'] },
  rasiererin:{ skin: '#d9b08c', hair: '#8e8e8e', hairStyle: 'long', shirt: '#6b4f3a', pants: '#4a3b2d', shoes: '#222', dress: true, extra: ['razor'] },
  opa:      { skin: '#f0c8a0', hair: '#dddddd', hairStyle: 'short', shirt: '#c2a878', pants: '#6b705c', shoes: '#333', extra: ['cane'] },
  fremder:  { skin: '#f0c8a0', hair: '#4a3000', hairStyle: 'short', shirt: '#8ecae6', pants: '#023047', shoes: '#111' }
};

// ---- Grundfunktionen ----------------------------------------------------
function makeCanvasTex(scene, key, w, h, drawFn, outline) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  const p = (x, y, ww, hh, c) => { if (!c) return; ctx.fillStyle = c; ctx.fillRect(x, y, ww, hh); };
  drawFn(p, ctx);
  if (outline) addOutline(ctx, w, h, outline === true ? OUTLINE : outline);
  tex.refresh();
  return tex;
}

function addOutline(ctx, w, h, color) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const mark = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) mark.push([x, y]);
  }
  ctx.fillStyle = color;
  for (const [x, y] of mark) ctx.fillRect(x, y, 1, 1);
}

function shade(hex, f) {
  // hex heller (f>0) / dunkler (f<0)
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}

// ---- Figuren --------------------------------------------------------------
function drawPerson(p, s, frame, ox) {
  const P = (x, y, w, h, c) => p(ox + x, y, w, h, c);
  const fat = !!s.fat;
  const bx0 = fat ? 2 : 4, bx1 = fat ? 13 : 11;
  const eye = '#1a1a1a';
  const skinD = shade(s.skin, -0.25);
  // Beine
  const lx = fat ? 4 : 5, rx = fat ? 9 : 8;
  let lLen = 5, rLen = 5;
  if (frame === 1) lLen = 4;
  if (frame === 2) rLen = 4;
  P(lx, 17, 3, lLen, s.pants); P(rx, 17, 3, rLen, s.pants);
  P(lx, 17 + lLen, 3, 2, s.shoes); P(rx, 17 + rLen, 3, 2, s.shoes);
  // Körper
  P(bx0, 11, bx1 - bx0 + 1, 6, s.shirt);
  if (s.stripes) { for (let y = 12; y <= 16; y += 2) P(bx0, y, bx1 - bx0 + 1, 1, s.stripes); }
  if (s.overall) { P(bx0 + 1, 11, 1, 6, s.pants); P(bx1 - 1, 11, 1, 6, s.pants); P(bx0 + 1, 14, bx1 - bx0 - 1, 3, s.pants); }
  if (s.dress) { P(bx0 - 1, 15, bx1 - bx0 + 3, 4, s.shirt); P(bx0 - 1, 18, bx1 - bx0 + 3, 1, shade(s.shirt, -0.25)); }
  if (fat) { P(bx0 + 1, 15, bx1 - bx0 - 1, 2, shade(s.shirt, 0.12)); }
  // Arme (schwingen beim Gehen)
  const la = frame === 1 ? 1 : 0, ra = frame === 2 ? 1 : 0;
  const sleeve = s.sleeve || s.shirt;
  P(bx0 - 1, 11 + la, 1, 5, sleeve); P(bx1 + 1, 11 + ra, 1, 5, sleeve);
  P(bx0 - 1, 16 + la, 1, 1, s.skin); P(bx1 + 1, 16 + ra, 1, 1, s.skin);
  // Hals + Kopf
  P(7, 10, 2, 1, skinD);
  P(5, 3, 6, 7, s.skin);
  P(6, 6, 1, 1, eye); P(9, 6, 1, 1, eye);
  P(7, 8, 2, 1, shade(s.skin, -0.4));
  // Haare / Kopfbedeckung
  const h = s.hair;
  switch (s.hairStyle) {
    case 'short': P(5, 2, 6, 2, h); P(4, 3, 1, 3, h); P(11, 3, 1, 3, h); break;
    case 'long': P(5, 2, 6, 2, h); P(4, 3, 1, 10, h); P(11, 3, 1, 10, h); P(5, 3, 1, 2, h); P(10, 3, 1, 2, h); break;
    case 'bun': P(5, 2, 6, 2, h); P(4, 3, 1, 3, h); P(11, 3, 1, 3, h); P(6, 0, 4, 2, h); break;
    case 'ponytail': P(5, 2, 6, 2, h); P(4, 3, 1, 3, h); P(11, 3, 1, 2, h); P(12, 3, 2, 7, h); break;
    case 'curly': P(4, 1, 8, 3, h); P(3, 2, 1, 6, h); P(12, 2, 1, 6, h); P(5, 0, 2, 1, h); P(9, 0, 2, 1, h); break;
    case 'bald': P(5, 3, 6, 1, shade(s.skin, 0.2)); P(4, 5, 1, 2, h); P(11, 5, 1, 2, h); break;
    case 'beret': P(5, 3, 6, 1, h); P(4, 3, 1, 4, h); P(11, 3, 1, 4, h); P(4, 1, 8, 2, s.beret); P(6, 0, 2, 1, s.beret); break;
    case 'cap': P(5, 3, 6, 1, h); P(4, 1, 8, 3, s.cap); P(4, 4, 9, 1, shade(s.cap, -0.35)); break;
    case 'police': P(4, 1, 8, 3, '#1b263b'); P(7, 2, 2, 1, '#ffd166'); P(4, 4, 8, 1, '#000'); break;
    case 'hat': P(4, 3, 1, 5, h); P(11, 3, 1, 5, h); P(3, 2, 10, 1, s.hat); P(5, 0, 6, 2, s.hat); P(5, 1, 6, 1, shade(s.hat, 0.3)); break;
    case 'clown': P(2, 2, 3, 4, '#ff006e'); P(11, 2, 3, 4, '#3a86ff'); P(3, 6, 2, 2, '#ffbe0b'); P(11, 6, 2, 2, '#8ac926'); P(6, 2, 4, 1, '#ff006e'); break;
    case 'chef': P(4, 3, 1, 2, h); P(11, 3, 1, 2, h); P(5, 0, 6, 3, '#ffffff'); P(4, 0, 1, 2, '#ffffff'); P(11, 0, 1, 2, '#ffffff'); break;
    case 'hood': P(4, 2, 8, 2, s.hood); P(4, 4, 1, 7, s.hood); P(11, 4, 1, 7, s.hood); P(5, 3, 6, 1, shade(s.hood, -0.3)); break;
    default: break;
  }
  if (s.beard) { P(5, 8, 6, 2, s.beard); P(7, 8, 2, 1, shade(s.skin, -0.4)); }
  if (s.mustache) P(6, 8, 4, 1, s.mustache);
  if (s.glasses === 'sun') { P(5, 6, 6, 1, '#000'); P(5, 5, 2, 1, '#000'); P(9, 5, 2, 1, '#000'); }
  if (s.glasses === 'nerd') { P(5, 6, 6, 1, '#222'); P(6, 6, 1, 1, '#9bd1ff'); P(9, 6, 1, 1, '#9bd1ff'); }
  const ex = s.extra || [];
  if (ex.includes('apron')) { P(bx0 + 1, 13, bx1 - bx0 - 1, 5, s.apron || '#6f4518'); P(bx0 + 1, 12, 1, 1, s.apron); P(bx1 - 1, 12, 1, 1, s.apron); }
  if (ex.includes('tears')) { P(6, 7, 1, 2, '#4cc9f0'); P(9, 7, 1, 2, '#4cc9f0'); }
  if (ex.includes('mayorchain')) { P(5, 11, 1, 1, '#ffd166'); P(6, 12, 1, 1, '#ffd166'); P(7, 13, 2, 1, '#ffd166'); P(9, 12, 1, 1, '#ffd166'); P(10, 11, 1, 1, '#ffd166'); P(7, 14, 2, 2, '#ffb703'); }
  if (ex.includes('goldchain')) { P(bx0 + 2, 11, 1, 1, '#ffd166'); P(bx0 + 3, 12, bx1 - bx0 - 5, 1, '#ffd166'); P(bx1 - 2, 11, 1, 1, '#ffd166'); }
  if (ex.includes('tracksuit')) { P(bx0 - 1, 11 + la, 1, 5, '#ffffff'); P(bx1 + 1, 11 + ra, 1, 5, '#ffffff'); P(lx + 1, 17, 1, lLen, '#fff'); P(rx + 1, 17, 1, rLen, '#fff'); }
  if (ex.includes('camera')) { P(6, 13, 4, 3, '#222'); P(7, 14, 2, 1, '#48cae4'); P(6, 11, 1, 2, '#222'); P(9, 11, 1, 2, '#222'); }
  if (ex.includes('laptop')) { P(12, 14, 3, 4, '#adb5bd'); P(12, 14, 3, 1, '#48cae4'); }
  if (ex.includes('guitar')) { P(8, 13, 6, 4, '#b5651d'); P(9, 14, 4, 2, '#8b4513'); P(10, 14, 1, 1, '#000'); P(2, 12, 7, 1, '#5a2d0c'); P(1, 11, 2, 2, '#5a2d0c'); }
  if (ex.includes('clownnose')) { P(7, 7, 2, 2, '#ff0000'); }
  if (ex.includes('badge')) { P(9, 12, 2, 2, '#ffd166'); P(5, 16, 6, 1, '#000'); }
  if (ex.includes('chains')) { P(bx1 + 1, 17, 1, 1, '#adb5bd'); P(bx1 + 2, 18, 1, 1, '#ced4da'); P(bx1 + 1, 19, 1, 1, '#adb5bd'); P(bx1 + 2, 20, 1, 1, '#ced4da'); }
  if (ex.includes('bottle')) { P(12, 11, 2, 1, '#ddd'); P(12, 12, 3, 6, '#2d6a4f'); P(12, 14, 3, 2, '#f1faee'); }
  if (ex.includes('wrench')) { P(12, 15, 1, 4, '#adb5bd'); P(11, 19, 3, 1, '#adb5bd'); }
  if (ex.includes('cane')) { P(13, 15, 1, 9, '#6b4423'); P(12, 15, 1, 1, '#6b4423'); }
  if (ex.includes('razor')) { P(12, 16, 1, 3, '#e0e0e0'); P(12, 15, 2, 1, '#48cae4'); }
}

function makeCharacter(scene, key, style) {
  const tex = makeCanvasTex(scene, key, 16 * 3, 24, (p) => {
    for (let f = 0; f < 3; f++) drawPerson(p, style, f, f * 16);
  }, false);
  // Umriss pro Frame getrennt zeichnen
  const ctx = tex.getContext();
  for (let f = 0; f < 3; f++) {
    const img = ctx.getImageData(f * 16, 0, 16, 24);
    const c2 = document.createElement('canvas'); c2.width = 16; c2.height = 24;
    const cx2 = c2.getContext('2d'); cx2.putImageData(img, 0, 0);
    addOutline(cx2, 16, 24, OUTLINE);
    ctx.clearRect(f * 16, 0, 16, 24);
    ctx.drawImage(c2, f * 16, 0);
  }
  tex.refresh();
  for (let f = 0; f < 3; f++) tex.add(f, 0, f * 16, 0, 16, 24);
}

function makeDog(scene) {
  const tex = makeCanvasTex(scene, 'mascha', 48, 16, (p) => {
    for (let f = 0; f < 3; f++) {
      const o = f * 16;
      const fur = '#f2e8cf', dark = '#8c5a3c';
      p(o + 3, 7, 9, 4, fur);                    // Körper
      p(o + 4, 7, 4, 2, dark);                   // Fleck
      p(o + 10, 4, 5, 5, fur);                   // Kopf
      p(o + 10, 3, 2, 3, dark); p(o + 14, 3, 1, 3, dark); // Ohren
      p(o + 14, 7, 2, 2, '#fff');                // Schnauze
      p(o + 15, 7, 1, 1, '#111');                // Nase
      p(o + 12, 5, 1, 1, '#111');                // Auge
      p(o + 10, 9, 3, 1, '#e63946');             // Halsband
      p(o + 1, 5, 2, 2, fur);                    // Schwanz
      const a = f === 1 ? 1 : 0, b = f === 2 ? 1 : 0;
      p(o + 3 + a, 11, 2, 3, fur); p(o + 9 - b, 11, 2, 3, fur);
      p(o + 5 - a, 11, 1, 2, dark); p(o + 11 + b, 11, 1, 2, dark);
    }
  }, false);
  const ctx = tex.getContext();
  for (let f = 0; f < 3; f++) {
    const img = ctx.getImageData(f * 16, 0, 16, 16);
    const c2 = document.createElement('canvas'); c2.width = 16; c2.height = 16;
    const cx2 = c2.getContext('2d'); cx2.putImageData(img, 0, 0);
    addOutline(cx2, 16, 16, OUTLINE);
    ctx.clearRect(f * 16, 0, 16, 16); ctx.drawImage(c2, f * 16, 0);
  }
  tex.refresh();
  for (let f = 0; f < 3; f++) tex.add(f, 0, f * 16, 0, 16, 16);
}

// ---- Kacheln ----------------------------------------------------------------
function makeTiles(scene) {
  const roofs = ['#8d3b2f', '#5c677d', '#7a4e2d', '#6b3f69'];
  const walls = ['#f4e1c1', '#e9c46a', '#cfe1f2', '#f5c6c6'];
  makeCanvasTex(scene, 'tiles', 16 * TILE_COUNT, 16, (p) => {
    const T0 = (i) => i * 16;
    const speck = (o, base, c, n, seed) => {
      let s = seed;
      p(o, 0, 16, 16, base);
      for (let i = 0; i < n; i++) {
        s = (s * 9301 + 49297) % 233280;
        const x = s % 16; s = (s * 9301 + 49297) % 233280;
        const y = s % 16;
        p(o + x, y, 1, 1, c);
      }
    };
    // Gras
    speck(T0(TI.GRASS), '#5cb85c', '#4ea24e', 14, 7);
    p(T0(TI.GRASS) + 3, 4, 1, 2, '#6fd06f'); p(T0(TI.GRASS) + 11, 10, 1, 2, '#6fd06f');
    speck(T0(TI.GRASS2), '#55ad55', '#469446', 18, 13);
    p(T0(TI.GRASS2) + 7, 7, 1, 2, '#72d272');
    // Blumen
    speck(T0(TI.FLOWERS), '#5cb85c', '#4ea24e', 10, 3);
    [[3, 3, '#ffd6ff'], [10, 5, '#fff275'], [6, 11, '#ff99c8'], [13, 12, '#ffffff']].forEach(([x, y, c]) => { p(T0(TI.FLOWERS) + x, y, 2, 2, c); });
    // Steinplatte (rund)
    speck(T0(TI.PLATE), '#5cb85c', '#4ea24e', 8, 21);
    { const o = T0(TI.PLATE); p(o + 4, 2, 8, 12, '#b8b8aa'); p(o + 2, 4, 12, 8, '#b8b8aa'); p(o + 3, 3, 10, 10, '#b8b8aa'); p(o + 5, 4, 5, 2, '#d2d2c4'); p(o + 4, 11, 8, 1, '#9a9a8e'); }
    // Straße
    speck(T0(TI.ROAD), '#4a4e57', '#555a64', 20, 5);
    speck(T0(TI.ZEBRA), '#4a4e57', '#555a64', 10, 9);
    for (let i = 0; i < 16; i += 4) p(T0(TI.ZEBRA) + i, 0, 2, 16, '#f1f1f1');
    speck(T0(TI.ZEBRA_H), '#4a4e57', '#555a64', 10, 11);
    for (let i = 0; i < 16; i += 4) p(T0(TI.ZEBRA_H), i, 16, 2, '#f1f1f1');
    // Gehsteig
    { const o = T0(TI.SIDEWALK); p(o, 0, 16, 16, '#b9b4a8'); p(o, 0, 16, 1, '#a39e92'); p(o, 8, 16, 1, '#a39e92'); p(o, 0, 1, 8, '#a39e92'); p(o + 8, 8, 1, 8, '#a39e92'); }
    { const o = T0(TI.STERN); speck(o, '#8f8a7e', '#6f6a5f', 26, 17); p(o + 3, 10, 3, 1, '#5b5040'); p(o + 11, 4, 2, 2, '#e9e3cc'); }
    // Boden Café (Holz)
    { const o = T0(TI.FLOOR); p(o, 0, 16, 16, '#b07d4f'); for (let y = 0; y < 16; y += 4) p(o, y, 16, 1, '#8f6038'); p(o + 5, 1, 1, 3, '#8f6038'); p(o + 12, 5, 1, 3, '#8f6038'); p(o + 3, 9, 1, 3, '#8f6038'); p(o + 10, 13, 1, 3, '#8f6038'); }
    // Tür (offen, betretbar)
    { const o = T0(TI.DOOR); p(o, 0, 16, 16, '#b07d4f'); p(o, 0, 16, 2, '#3d2b1f'); p(o + 1, 12, 14, 3, '#9e2a2b'); p(o + 1, 13, 14, 1, '#c44536'); }
    // Dächer
    roofs.forEach((c, i) => {
      const o = T0(TI.ROOF + i);
      p(o, 0, 16, 16, c);
      for (let y = 3; y < 16; y += 4) p(o, y, 16, 1, shade(c, -0.25));
      for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < 16; x += 8) p(o + x, y, 1, 3, shade(c, -0.18));
    });
    // Fassaden mit Fenster
    walls.forEach((c, i) => {
      const o = T0(TI.WALL + i);
      p(o, 0, 16, 16, c);
      p(o, 0, 16, 2, shade(c, -0.3));
      p(o + 3, 4, 10, 8, '#33415c'); p(o + 4, 5, 8, 6, '#7fb3d5'); p(o + 8, 5, 1, 6, '#33415c'); p(o + 4, 8, 8, 1, '#33415c');
      p(o + 2, 12, 12, 1, shade(c, -0.2)); p(o, 15, 16, 1, shade(c, -0.35));
    });
    // Ladentür (geschlossen)
    { const o = T0(TI.SHOPDOOR); p(o, 0, 16, 16, '#f4e1c1'); p(o, 0, 16, 2, '#8a6f4d'); p(o + 3, 3, 10, 13, '#5a3825'); p(o + 4, 4, 8, 5, '#9fd3f5'); p(o + 10, 10, 1, 2, '#ffd166'); }
    // Innenwand Café
    { const o = T0(TI.INWALL); p(o, 0, 16, 16, '#5b3a29'); p(o, 12, 16, 4, '#3d2517'); p(o + 2, 3, 5, 6, '#e9c46a'); p(o + 3, 4, 3, 4, '#f4a261'); p(o + 10, 4, 4, 4, '#2a9d8f'); }
  }, false);
}

// ---- Objekte ----------------------------------------------------------------
function makeObjects(scene) {
  // Bäume 32x32
  const tree = (key, c1, c2, c3) => makeCanvasTex(scene, key, 32, 32, (p) => {
    p(14, 22, 4, 9, '#5a3825'); p(13, 29, 6, 2, '#4a2c1d');
    p(6, 4, 20, 18, c1); p(4, 8, 24, 11, c1); p(9, 2, 14, 22, c1);
    p(8, 6, 8, 6, c2); p(18, 12, 6, 5, c2); p(6, 14, 5, 4, c2);
    p(11, 4, 4, 2, c3); p(20, 8, 3, 2, c3); p(9, 10, 2, 2, c3);
    p(6, 19, 20, 3, shade(c1, -0.3));
  }, true);
  tree('tree_plum', '#7b1e3a', '#a4264d', '#d45079');
  tree('tree_green', '#7ac74f', '#a1e06a', '#c9f59b');
  // Bank 48x14
  makeCanvasTex(scene, 'bench', 48, 14, (p) => {
    p(1, 1, 46, 3, '#9c6b3c'); p(1, 5, 46, 3, '#b07d4f'); p(1, 9, 46, 2, '#8a5a2e');
    p(3, 11, 3, 3, '#333'); p(42, 11, 3, 3, '#333'); p(22, 11, 3, 3, '#333');
    p(1, 4, 46, 1, '#6b4423'); p(1, 8, 46, 1, '#6b4423');
  }, true);
  // Quelle 32x32, 2 Frames
  const ftex = makeCanvasTex(scene, 'fountain', 64, 32, (p) => {
    for (let f = 0; f < 2; f++) {
      const o = f * 32;
      p(o + 8, 4, 16, 24, '#8d99ae'); p(o + 4, 8, 24, 16, '#8d99ae'); p(o + 6, 6, 20, 20, '#8d99ae');
      p(o + 8, 7, 16, 18, '#3a86ff'); p(o + 7, 9, 18, 14, '#3a86ff'); p(o + 10, 6, 12, 20, '#3a86ff');
      p(o + 14, 12, 4, 8, '#dee2e6'); p(o + 15, 10, 2, 2, '#adb5bd');
      const s = f === 0 ? [[11, 10], [20, 18], [12, 20], [21, 11]] : [[13, 9], [18, 20], [10, 16], [22, 14]];
      s.forEach(([x, y]) => p(o + x, y, 2, 1, '#caf0f8'));
      p(o + 15, 8 + f, 2, 2, '#90e0ef');
    }
  }, false);
  ftex.add(0, 0, 0, 0, 32, 32); ftex.add(1, 0, 32, 0, 32, 32);
  // Laterne 16x32
  makeCanvasTex(scene, 'lantern', 12, 32, (p) => {
    p(5, 8, 2, 23, '#343a40'); p(3, 30, 6, 2, '#212529');
    p(2, 2, 8, 7, '#212529'); p(3, 3, 6, 5, '#ffe8a3'); p(4, 0, 4, 2, '#212529');
  }, true);
  // Lichtschein
  {
    if (scene.textures.exists('glow')) scene.textures.remove('glow');
    const t = scene.textures.createCanvas('glow', 96, 96);
    const ctx = t.getContext();
    const g = ctx.createRadialGradient(48, 48, 2, 48, 48, 48);
    g.addColorStop(0, 'rgba(255,230,160,0.9)'); g.addColorStop(0.4, 'rgba(255,210,120,0.35)'); g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 96, 96); t.refresh();
  }
  // Radständer, Mistkübel
  makeCanvasTex(scene, 'bikerack', 32, 14, (p) => {
    for (let i = 0; i < 4; i++) { p(2 + i * 8, 2, 1, 10, '#adb5bd'); p(6 + i * 8, 2, 1, 10, '#adb5bd'); p(2 + i * 8, 2, 5, 1, '#adb5bd'); }
    p(0, 12, 32, 2, '#6c757d');
  }, true);
  makeCanvasTex(scene, 'bin', 12, 14, (p) => { p(1, 3, 10, 11, '#2b9348'); p(0, 1, 12, 3, '#1f6f35'); p(3, 6, 1, 6, '#1f6f35'); p(7, 6, 1, 6, '#1f6f35'); }, true);
  // Tesla (schwarz) 36x18
  makeCanvasTex(scene, 'tesla', 36, 18, (p) => {
    p(2, 5, 32, 10, '#111418'); p(4, 3, 28, 13, '#111418');
    p(10, 4, 14, 3, '#5e7ce2'); p(10, 12, 14, 2, '#2d3a66'); p(12, 7, 10, 5, '#1c2128');
    p(4, 15, 6, 3, '#000'); p(26, 15, 6, 3, '#000'); p(4, 1, 6, 3, '#000'); p(26, 1, 6, 3, '#000');
    p(33, 6, 2, 2, '#fff3b0'); p(33, 11, 2, 2, '#fff3b0'); p(1, 6, 1, 2, '#e63946'); p(1, 11, 1, 2, '#e63946');
    p(15, 8, 4, 1, '#c0c0c0');
  }, true);
  // Autos
  const car = (key, c) => makeCanvasTex(scene, key, 28, 16, (p) => {
    p(2, 3, 24, 10, c); p(4, 2, 20, 12, c);
    p(15, 3, 5, 10, '#9bd1ff'); p(6, 4, 4, 8, shade(c, -0.3));
    p(3, 0, 5, 2, '#111'); p(20, 0, 5, 2, '#111'); p(3, 14, 5, 2, '#111'); p(20, 14, 5, 2, '#111');
    p(26, 4, 1, 2, '#fff3b0'); p(26, 10, 1, 2, '#fff3b0');
  }, true);
  car('car_red', '#e63946'); car('car_yellow', '#ffb703'); car('car_blue', '#3a86ff');
  // Café-Theke 80x18
  makeCanvasTex(scene, 'counter', 80, 20, (p) => {
    p(0, 4, 80, 16, '#6f4518'); p(0, 2, 80, 4, '#d4a373'); p(0, 10, 80, 1, '#5a3810');
    p(8, 0, 10, 5, '#adb5bd'); p(10, 1, 6, 2, '#343a40'); p(40, 0, 6, 3, '#f8f9fa'); p(60, 0, 4, 3, '#f1c27d'); p(65, 0, 4, 3, '#f1c27d');
    p(30, 12, 20, 6, '#3d2517'); p(33, 13, 14, 1, '#ffd166');
  }, true);
  makeCanvasTex(scene, 'table', 14, 14, (p) => { p(1, 1, 12, 9, '#e9c46a'); p(2, 2, 10, 7, '#f4d58d'); p(6, 10, 2, 4, '#5a3825'); p(4, 3, 3, 2, '#fff'); }, true);
  // Terminal (Markus)
  makeCanvasTex(scene, 'terminal', 12, 20, (p) => {
    p(0, 0, 12, 10, '#212529'); p(1, 1, 10, 7, '#06d6a0'); p(2, 2, 6, 1, '#073b4c'); p(2, 4, 4, 1, '#073b4c'); p(2, 6, 7, 1, '#073b4c');
    p(5, 10, 2, 8, '#495057'); p(3, 18, 6, 2, '#343a40');
  }, true);
  // Steckdose
  makeCanvasTex(scene, 'socket', 10, 10, (p) => { p(0, 0, 10, 10, '#f8f9fa'); p(2, 2, 6, 6, '#dee2e6'); p(3, 4, 1, 2, '#333'); p(6, 4, 1, 2, '#333'); }, true);
  // Carlas Rad
  makeCanvasTex(scene, 'bike', 22, 14, (p) => {
    p(1, 7, 6, 6, '#222'); p(2, 8, 4, 4, '#b9b4a8'); p(15, 7, 6, 6, '#222'); p(16, 8, 4, 4, '#b9b4a8');
    p(4, 6, 12, 2, '#06d6a0'); p(8, 3, 2, 5, '#06d6a0'); p(6, 2, 5, 2, '#222'); p(15, 2, 2, 6, '#06d6a0'); p(14, 1, 4, 1, '#222');
  }, true);
  // Pfütze (Doppler), Kiste
  makeCanvasTex(scene, 'puddle', 18, 10, (p) => { p(2, 2, 14, 6, '#c9d65b'); p(0, 4, 18, 3, '#c9d65b'); p(4, 3, 4, 1, '#eef59b'); p(10, 6, 3, 1, '#a0ab3c'); }, false);
  makeCanvasTex(scene, 'crate', 12, 12, (p) => { p(0, 0, 12, 12, '#a47148'); p(0, 5, 12, 2, '#6f4518'); p(5, 0, 2, 12, '#6f4518'); p(1, 1, 3, 1, '#c89f7a'); }, true);
  // Transparent (über dem Kopf)
  makeCanvasTex(scene, 'banner_sign', 26, 18, (p) => {
    p(12, 10, 2, 8, '#6b4423'); p(0, 0, 26, 11, '#fdfcdc'); p(2, 2, 22, 2, '#d62828'); p(2, 6, 16, 2, '#d62828'); p(20, 6, 3, 2, '#003049');
  }, true);
  // Pixel für Partikel, Staubwolke
  makeCanvasTex(scene, 'px', 3, 3, (p) => { p(0, 0, 3, 3, '#ffffff'); }, false);
  makeCanvasTex(scene, 'dust', 40, 28, (p) => {
    p(6, 6, 28, 18, '#d6ccc2'); p(2, 10, 36, 10, '#d6ccc2'); p(10, 2, 20, 24, '#d6ccc2');
    p(8, 8, 8, 6, '#f5ebe0'); p(22, 14, 8, 6, '#f5ebe0'); p(14, 18, 4, 4, '#adb5bd'); p(26, 6, 5, 3, '#adb5bd');
  }, true);
  // Pfeil (Auftragsrichtung)
  makeCanvasTex(scene, 'arrow', 12, 12, (p) => { p(0, 4, 7, 4, '#ffd166'); p(6, 1, 2, 10, '#ffd166'); p(8, 2, 1, 8, '#ffd166'); p(9, 3, 1, 6, '#ffd166'); p(10, 4, 1, 4, '#ffd166'); p(11, 5, 1, 2, '#ffd166'); }, true);
  // Kleber-Fleck
  makeCanvasTex(scene, 'gluespot', 16, 10, (p) => { p(2, 2, 12, 6, '#fff3b0'); p(0, 4, 16, 2, '#fff3b0'); p(4, 3, 3, 1, '#fff'); }, false);
  // Clownnase am Spieler
  makeCanvasTex(scene, 'nose', 2, 2, (p) => { p(0, 0, 2, 2, '#ff0000'); }, false);
  // Schild-Brett
  makeCanvasTex(scene, 'marker', 16, 16, (p) => { p(3, 3, 10, 10, '#ffd166'); p(5, 5, 6, 6, '#f77f00'); }, true);
}

// ---- Status-Symbole 9x9 -----------------------------------------------------
function makeIcons(scene) {
  const ic = (key, fn) => makeCanvasTex(scene, key, 9, 9, fn, true);
  ic('ic_excl', (p) => { p(3, 0, 3, 6, '#ffd166'); p(3, 7, 3, 2, '#ffd166'); });
  ic('ic_quest', (p) => { p(1, 0, 7, 2, '#06d6a0'); p(6, 2, 2, 2, '#06d6a0'); p(3, 4, 3, 2, '#06d6a0'); p(3, 7, 3, 2, '#06d6a0'); });
  ic('ic_stone', (p) => { p(1, 2, 7, 6, '#adb5bd'); p(2, 1, 5, 1, '#adb5bd'); p(3, 3, 2, 1, '#e9ecef'); p(5, 5, 2, 1, '#6c757d'); });
  ic('ic_angry', (p) => { p(1, 1, 2, 2, '#e63946'); p(6, 1, 2, 2, '#e63946'); p(1, 6, 2, 2, '#e63946'); p(6, 6, 2, 2, '#e63946'); p(3, 3, 3, 3, '#e63946'); });
  ic('ic_swirl', (p) => { p(1, 1, 7, 1, '#ffd6ff'); p(7, 1, 1, 7, '#ffd6ff'); p(1, 7, 7, 1, '#ffd6ff'); p(1, 3, 1, 5, '#ffd6ff'); p(3, 3, 3, 1, '#ffd6ff'); p(3, 3, 1, 3, '#ffd6ff'); });
  ic('ic_drop', (p) => { p(4, 0, 1, 2, '#4cc9f0'); p(3, 2, 3, 2, '#4cc9f0'); p(2, 4, 5, 4, '#4cc9f0'); p(3, 5, 1, 2, '#caf0f8'); });
  ic('ic_note', (p) => { p(5, 0, 1, 7, '#ffd166'); p(5, 0, 3, 2, '#ffd166'); p(2, 6, 4, 3, '#ffd166'); });
  ic('ic_heart', (p) => { p(1, 1, 3, 3, '#ff4d6d'); p(5, 1, 3, 3, '#ff4d6d'); p(1, 3, 7, 2, '#ff4d6d'); p(2, 5, 5, 2, '#ff4d6d'); p(3, 7, 3, 1, '#ff4d6d'); p(2, 1, 1, 1, '#ffb3c1'); });
  ic('ic_laugh', (p) => { p(1, 1, 7, 7, '#ffd166'); p(2, 3, 1, 1, '#333'); p(6, 3, 1, 1, '#333'); p(2, 5, 5, 2, '#9d0208'); });
  ic('ic_zzz', (p) => { p(1, 1, 5, 1, '#e0e1dd'); p(4, 2, 1, 1, '#e0e1dd'); p(3, 3, 1, 1, '#e0e1dd'); p(1, 4, 5, 1, '#e0e1dd'); p(6, 6, 3, 1, '#e0e1dd'); p(7, 7, 1, 1, '#e0e1dd'); p(6, 8, 3, 1, '#e0e1dd'); });
  ic('ic_fear', (p) => { p(3, 0, 3, 6, '#90e0ef'); p(3, 7, 3, 2, '#90e0ef'); });
  ic('ic_camera', (p) => { p(0, 2, 9, 6, '#222'); p(3, 3, 3, 3, '#48cae4'); p(1, 1, 3, 1, '#222'); });
}

// ---- Inventar-Symbole (für HUD, 16x16) -------------------------------------
function makeItems(scene) {
  const it = (key, fn) => makeCanvasTex(scene, 'item_' + key, 16, 16, fn, true);
  it('americano', (p) => { p(4, 5, 8, 9, '#f8f9fa'); p(5, 6, 6, 2, '#6f4518'); p(12, 7, 2, 4, '#f8f9fa'); p(5, 2, 1, 2, '#ced4da'); p(8, 1, 1, 3, '#ced4da'); });
  it('essen', (p) => { p(2, 7, 12, 6, '#ffffff'); p(3, 5, 10, 3, '#f4a261'); p(5, 4, 3, 2, '#e76f51'); p(9, 4, 2, 2, '#2a9d8f'); p(1, 12, 14, 2, '#e9ecef'); });
  it('kipferl', (p) => { p(3, 7, 10, 4, '#e9a44c'); p(2, 9, 3, 3, '#e9a44c'); p(11, 9, 3, 3, '#e9a44c'); p(5, 7, 1, 3, '#c07d27'); p(9, 7, 1, 3, '#c07d27'); });
  it('paket', (p) => { p(2, 3, 12, 11, '#a47148'); p(2, 8, 12, 1, '#6f4518'); p(7, 3, 2, 11, '#6f4518'); p(4, 5, 2, 1, '#e63946'); });
  it('nase', (p) => { p(4, 4, 8, 8, '#ff0000'); p(5, 5, 2, 2, '#ff9999'); });
  it('kamera', (p) => { p(1, 4, 14, 9, '#222'); p(5, 5, 6, 6, '#48cae4'); p(6, 6, 3, 3, '#023e8a'); p(2, 2, 4, 2, '#222'); });
  it('karton', (p) => { p(1, 3, 14, 10, '#c89f7a'); p(1, 3, 14, 2, '#a47148'); });
  it('stift', (p) => { p(3, 11, 2, 2, '#333'); p(4, 9, 3, 3, '#e63946'); p(6, 4, 3, 6, '#e63946'); p(8, 2, 3, 3, '#f8f9fa'); });
  it('transparent', (p) => { p(1, 2, 14, 9, '#fdfcdc'); p(2, 4, 12, 2, '#d62828'); p(2, 7, 9, 1, '#003049'); p(7, 11, 2, 5, '#6b4423'); });
  it('kleber', (p) => { p(5, 2, 6, 12, '#ffd166'); p(6, 0, 4, 2, '#333'); p(6, 6, 4, 4, '#e63946'); });
  it('shit', (p) => { p(4, 5, 8, 7, '#6a994e'); p(5, 3, 6, 2, '#386641'); p(6, 7, 4, 3, '#a7c957'); });
  it('rad', (p) => { p(0, 8, 6, 6, '#222'); p(10, 8, 6, 6, '#222'); p(3, 7, 10, 2, '#06d6a0'); p(7, 3, 2, 5, '#06d6a0'); });
  it('beweisfoto', (p) => { p(2, 2, 12, 12, '#f8f9fa'); p(3, 3, 10, 8, '#6c757d'); p(6, 5, 3, 3, '#a47148'); p(10, 7, 2, 4, '#495057'); });
  it('lieferung', (p) => { p(2, 7, 12, 6, '#ffffff'); p(3, 5, 10, 3, '#f4a261'); p(4, 1, 2, 3, '#adb5bd'); p(9, 2, 2, 3, '#adb5bd'); });
  it('laptop', (p) => { p(2, 3, 12, 8, '#495057'); p(3, 4, 10, 6, '#48cae4'); p(1, 11, 14, 2, '#adb5bd'); });
}

function generateAllTextures(scene) {
  makeTiles(scene);
  for (const id in CHAR_STYLES) makeCharacter(scene, 'ch_' + id, CHAR_STYLES[id]);
  makeDog(scene);
  makeObjects(scene);
  makeIcons(scene);
  makeItems(scene);
}

// Portrait als Data-URL (für Menüs)
function textureDataURL(scene, key, frame, scale) {
  try {
    const tex = scene.textures.get(key);
    const fr = tex.get(frame !== undefined ? frame : 0);
    const src = tex.getSourceImage();
    const s = scale || 4;
    const c = document.createElement('canvas');
    c.width = fr.cutWidth * s; c.height = fr.cutHeight * s;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, c.width, c.height);
    return c.toDataURL();
  } catch (e) { return ''; }
}
