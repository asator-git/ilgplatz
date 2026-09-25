// ---------------------------------------------------------------
// audio.js – Soundeffekte, per Web Audio API synthetisiert
// ---------------------------------------------------------------
'use strict';

const Sfx = {
  ctx: null,
  master: null,
  muted: false,
  last: {},

  init() {
    try { this.muted = window.localStorage.getItem('ilgplatz_mute') === '1'; } catch (e) { /* egal */ }
  },

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },

  toggleMute() {
    this.muted = !this.muted;
    try { window.localStorage.setItem('ilgplatz_mute', this.muted ? '1' : '0'); } catch (e) { /* egal */ }
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
  },

  tone(freq, dur, type, vol, slide, delay) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },

  noise(dur, filterFreq, vol, type, delay, q) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = filterFreq || 800; f.Q.value = q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
    return f;
  },

  play(name) {
    if (!this.ctx || this.muted) return;
    // Nicht zu oft denselben Sound
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 60) return;
    this.last[name] = now;
    try {
      switch (name) {
        case 'blip': this.tone(880, 0.05, 'square', 0.06); break;
        case 'type': this.tone(1200 + Math.random() * 400, 0.03, 'square', 0.05); break;
        case 'action': this.tone(660, 0.07, 'square', 0.12); this.tone(990, 0.07, 'square', 0.1, 0, 0.06); break;
        case 'good': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'square', 0.1, 0, i * 0.07)); break;
        case 'bad': this.tone(300, 0.25, 'sawtooth', 0.12, 120); break;
        case 'coin': this.tone(988, 0.06, 'square', 0.1); this.tone(1319, 0.18, 'square', 0.1, 0, 0.06); break;
        case 'bark':
          this.noise(0.09, 900, 0.5, 'bandpass', 0, 3); this.tone(420, 0.08, 'sawtooth', 0.15, 250);
          this.noise(0.09, 1000, 0.45, 'bandpass', 0.16, 3); this.tone(460, 0.08, 'sawtooth', 0.13, 260, 0.16);
          break;
        case 'rumble': {
          this.noise(3.5, 120, 0.9, 'lowpass', 0, 1);
          this.tone(45, 3.5, 'sawtooth', 0.25, 30);
          break;
        }
        case 'cheer': {
          const f = this.noise(1.6, 1800, 0.35, 'bandpass', 0, 0.7);
          [392, 494, 587, 784].forEach((fr, i) => this.tone(fr, 0.35, 'triangle', 0.08, 0, 0.1 + i * 0.12));
          if (f) { f.frequency.setValueAtTime(900, this.ctx.currentTime); f.frequency.linearRampToValueAtTime(2400, this.ctx.currentTime + 1.2); }
          break;
        }
        case 'hurt': this.noise(0.2, 400, 0.5); this.tone(200, 0.2, 'square', 0.12, 80); break;
        case 'photo': this.noise(0.05, 4000, 0.4, 'highpass'); this.tone(2000, 0.04, 'square', 0.06, 0, 0.05); break;
        case 'splash': this.noise(0.5, 2500, 0.3, 'bandpass', 0, 0.8); break;
        case 'stone': this.tone(150, 0.4, 'triangle', 0.2, 60); this.noise(0.3, 300, 0.3); break;
        case 'car': this.tone(90, 0.4, 'sawtooth', 0.12, 140); this.tone(700, 0.25, 'square', 0.08, 0, 0.05); break;
        case 'slip': this.tone(600, 0.25, 'sine', 0.15, 150); break;
        case 'laugh': [0, 0.12, 0.24].forEach(d => this.tone(500 + Math.random() * 80, 0.08, 'triangle', 0.12, 350, d)); break;
        case 'guitar': [196, 247, 294, 392].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.06, 0, i * 0.05)); break;
        case 'sms': this.tone(1568, 0.08, 'sine', 0.12); this.tone(1568, 0.08, 'sine', 0.12, 0, 0.14); break;
        case 'announce': this.tone(784, 0.12, 'square', 0.1); this.tone(659, 0.12, 'square', 0.1, 0, 0.13); this.tone(523, 0.2, 'square', 0.1, 0, 0.26); break;
        case 'siren': for (let i = 0; i < 3; i++) { this.tone(700, 0.25, 'square', 0.07, 950, i * 0.5); this.tone(950, 0.25, 'square', 0.07, 700, i * 0.5 + 0.25); } break;
        case 'punch': this.noise(0.12, 600, 0.5); this.tone(120, 0.12, 'square', 0.15, 60); break;
        case 'eat': this.noise(0.06, 1500, 0.2, 'bandpass'); this.noise(0.06, 1500, 0.2, 'bandpass', 0.12); break;
        default: this.tone(440, 0.05, 'square', 0.05);
      }
    } catch (e) { /* Audio egal */ }
  }
};
Sfx.init();
