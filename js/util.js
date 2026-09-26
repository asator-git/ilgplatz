// ---------------------------------------------------------------
// util.js – Texte, Balance-Werte, Helfer, globaler Zustand
// ---------------------------------------------------------------
'use strict';

const DATA = { dialoge: {}, balance: {}, texte: { de: {}, en: {} } };

// Sprache: Deutsch ist Standard, Englisch wählbar (gemerkt im localStorage)
const Lang = {
  cur: 'de',
  init() {
    let l = null;
    try { l = window.localStorage.getItem('ilgplatz_lang'); } catch (e) { /* egal */ }
    if (URLP.lang) l = URLP.lang;
    this.set(l === 'en' ? 'en' : 'de', true);
  },
  set(l, silent) {
    this.cur = (l === 'en' && DATA.texte.en && DATA.texte.en.ui) ? 'en' : 'de';
    DATA.dialoge = DATA.texte[this.cur] && Object.keys(DATA.texte[this.cur]).length ? DATA.texte[this.cur] : DATA.texte.de;
    try { document.documentElement.lang = this.cur; } catch (e) { /* egal */ }
    if (!silent) { try { window.localStorage.setItem('ilgplatz_lang', this.cur); } catch (e) { /* egal */ } }
  }
};
const TILE = 16;
const IS_ANDROID = /Android/i.test((typeof navigator !== 'undefined' && navigator.userAgent) || '');
const TEXT_RES = IS_ANDROID ? 3 : 6; // Auflösung von Schildern/Texten (Android: sparsamer)

// URL-Parameter (Debug): ?figur=hubi&speed=20&start=14:00
const URLP = (() => {
  const p = {};
  try {
    new URLSearchParams(window.location.search).forEach((v, k) => { p[k] = v; });
  } catch (e) { /* egal */ }
  return p;
})();

function getPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = String(path).split('.');
  let o = obj;
  for (const k of parts) {
    if (o === null || o === undefined || typeof o !== 'object') return undefined;
    o = o[k];
  }
  return o;
}

// Globale Platzhalter (werden bei jedem T() ergänzt)
const TEXT_VARS = {};

function fmt(s, vars) {
  if (typeof s !== 'string') return '';
  return s.replace(/\{(\w+)\}/g, (m, k) => {
    if (vars && vars[k] !== undefined) return vars[k];
    if (TEXT_VARS[k] !== undefined) return typeof TEXT_VARS[k] === 'function' ? TEXT_VARS[k]() : TEXT_VARS[k];
    return m;
  });
}

// Text holen. Arrays → zufälliger Eintrag. Fehlt → Fallback.
function T(path, vars, fallback) {
  let v = getPath(DATA.dialoge, path);
  if (Array.isArray(v)) v = v.length ? v[Math.floor(Math.random() * v.length)] : undefined;
  if (typeof v !== 'string') v = (fallback !== undefined) ? fallback : '…';
  return fmt(v, vars);
}

// Liste holen (immer ein Array von Strings)
function TL(path, fallback) {
  const v = getPath(DATA.dialoge, path);
  if (Array.isArray(v) && v.length) return v.filter(x => typeof x === 'string');
  if (typeof v === 'string') return [v];
  return fallback || ['…'];
}

// n-ter Eintrag einer Liste (rotierend)
function TN(path, n, vars, fallback) {
  const list = TL(path, fallback ? [fallback] : undefined);
  return fmt(list[((n % list.length) + list.length) % list.length], vars);
}

// Balance-Wert holen
function B(path, def) {
  const v = getPath(DATA.balance, path);
  if (v === undefined || v === null) return def;
  if (typeof def === 'number' && typeof v !== 'number') return def;
  return v;
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function rndInt(a, b) { return Math.floor(rnd(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function euro(x) { const v = (Math.round(x * 100) / 100).toFixed(2); return Lang.cur === 'en' ? '€' + v : v.replace('.', ',') + ' €'; }
function clockStr(min) {
  const m = Math.max(0, Math.floor(min));
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
function parseClock(s, def) {
  if (typeof s === 'number') return s;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
  if (!m) return def;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function tileCenter(tx, ty) { return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }; }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Highscores (nur das wird gespeichert)
const Highscore = {
  KEY: 'ilgplatz_highscores_v1',
  load() {
    try {
      const raw = window.localStorage.getItem(this.KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  },
  add(entry) {
    const list = this.load();
    list.push(entry);
    list.sort((a, b) => (b.ansehen || 0) - (a.ansehen || 0));
    const top = list.slice(0, 10);
    try { window.localStorage.setItem(this.KEY, JSON.stringify(top)); } catch (e) { /* egal */ }
    return top;
  }
};

// Rang aus Ansehen
function rankFor(rep) {
  const r = B('raenge', null);
  const list = Array.isArray(r) && r.length ? r : [
    { ab: 0, id: 'zuagraster' }, { ab: 200, id: 'stammgast' },
    { ab: 450, id: 'graetzlkaiser' }, { ab: 750, id: 'anwaerter' }
  ];
  let best = list[0];
  for (const e of list) if (rep >= e.ab) best = e;
  return T('raenge.' + best.id, null, best.id);
}

// Globaler Zustand eines Durchgangs (wird von WorldScene neu gesetzt)
let G = null;
