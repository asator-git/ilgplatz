// ---------------------------------------------------------------
// input.js – Tastatur + virtueller Joystick (DOM, Multi-Touch)
// ---------------------------------------------------------------
'use strict';

const Input = {
  keys: {},
  joy: { active: false, id: null, x: 0, y: 0, cx: 0, cy: 0 },
  pressed: { action: false, special: false, pause: false, up: false, down: false, left: false, right: false, confirm: false },
  touchUsed: false,
  handlers: { ui: null, world: null },

  init() {
    const down = (e) => {
      const k = e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(k)) {
        // Nicht scrollen – außer beim Tippen in Eingabefeldern
        if (!(e.target && e.target.tagName === 'INPUT')) e.preventDefault();
      }
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.repeat) { this.keys[k.toLowerCase()] = true; return; }
      this.keys[k.toLowerCase()] = true;
      const kl = k.toLowerCase();
      if (kl === ' ' || kl === 'spacebar') this.fire('action');
      if (kl === 'enter') this.fire('confirm');
      if (kl === 'e') this.fire('special');
      if (kl === 'escape' || kl === 'p') this.fire('pause');
      if (kl === 'arrowup' || kl === 'w') this.fire('up');
      if (kl === 'arrowdown' || kl === 's') this.fire('down');
      if (kl === 'arrowleft' || kl === 'a') this.fire('left');
      if (kl === 'arrowright' || kl === 'd') this.fire('right');
      if (/^[1-9]$/.test(kl)) this.fire('num', parseInt(kl, 10));
    };
    const up = (e) => { this.keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up);
    window.addEventListener('blur', () => { this.keys = {}; this.joyReset(); });

    // Touch-Steuerung
    const zone = document.getElementById('joyzone');
    const knob = document.getElementById('joyknob');
    const base = document.getElementById('joybase');
    if (zone && knob && base) {
      const start = (e) => {
        this.touchUsed = true;
        document.body.classList.add('touch');
        for (const t of e.changedTouches) {
          if (this.joy.active) break;
          const r = zone.getBoundingClientRect();
          this.joy.active = true; this.joy.id = t.identifier;
          this.joy.cx = t.clientX; this.joy.cy = t.clientY;
          base.style.left = (t.clientX - r.left) + 'px'; base.style.top = (t.clientY - r.top) + 'px';
          base.classList.add('on');
          this.joyMove(t.clientX, t.clientY, knob);
        }
        e.preventDefault();
      };
      const move = (e) => {
        for (const t of e.changedTouches) if (t.identifier === this.joy.id) this.joyMove(t.clientX, t.clientY, knob);
        e.preventDefault();
      };
      const end = (e) => {
        for (const t of e.changedTouches) if (t.identifier === this.joy.id) { this.joyReset(); base.classList.remove('on'); knob.style.transform = 'translate(-50%,-50%)'; }
        e.preventDefault();
      };
      zone.addEventListener('touchstart', start, { passive: false });
      zone.addEventListener('touchmove', move, { passive: false });
      zone.addEventListener('touchend', end, { passive: false });
      zone.addEventListener('touchcancel', end, { passive: false });
    }
    const btn = (id, ev) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.touchUsed = true; document.body.classList.add('touch'); el.classList.add('down'); this.fire(ev); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); el.classList.remove('down'); }, { passive: false });
      el.addEventListener('mousedown', (e) => { e.preventDefault(); this.fire(ev); });
    };
    btn('btnA', 'action');
    btn('btnE', 'special');
    btn('btnPause', 'pause');
    // Erstes Touch-Event irgendwo → Touch-Modus
    window.addEventListener('touchstart', () => { this.touchUsed = true; document.body.classList.add('touch'); }, { passive: true });
    // Kein Doppeltipp-Zoom / Scrollen
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
  },

  joyMove(x, y, knob) {
    const max = 44;
    let dx = x - this.joy.cx, dy = y - this.joy.cy;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    const dead = 9;
    const m = Math.hypot(dx, dy);
    if (m < dead) { this.joy.x = 0; this.joy.y = 0; }
    else { const s = (m - dead) / (max - dead); this.joy.x = dx / m * s; this.joy.y = dy / m * s; }
    if (knob) knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  },
  joyReset() { this.joy.active = false; this.joy.id = null; this.joy.x = 0; this.joy.y = 0; },

  // Ereignis: zuerst UI (Dialoge/Menüs), dann Welt
  fire(ev, arg) {
    try { if (typeof Sfx !== 'undefined') Sfx.unlock(); } catch (e) { /* egal */ }
    try {
      if (this.handlers.ui && this.handlers.ui(ev, arg) === true) return;
      if (this.handlers.world) this.handlers.world(ev, arg);
    } catch (e) { console.error(e); }
  },

  // Bewegungsvektor (-1..1)
  axis() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k['arrowleft'] || k['a']) x -= 1;
    if (k['arrowright'] || k['d']) x += 1;
    if (k['arrowup'] || k['w']) y -= 1;
    if (k['arrowdown'] || k['s']) y += 1;
    if (x || y) { const m = Math.hypot(x, y); return { x: x / m, y: y / m }; }
    if (this.joy.active) return { x: this.joy.x, y: this.joy.y };
    return { x: 0, y: 0 };
  }
};
