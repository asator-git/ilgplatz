// ---------------------------------------------------------------
// npcs.js – Freunde, Ladenbesitzer, Statisten + Gesprächssystem
// ---------------------------------------------------------------
'use strict';

const FRIENDS = ['hubi', 'andi', 'carla', 'juliette', 'markus', 'jewi'];

// Zustand → Schlüssel in dialoge.json
const STATE_KEY = { stone: 'versteinert', talked: 'niedergequasselt', grantig: 'grantig', wet: 'nass', laughing: 'lachend', down: 'erledigt', panic: 'panik', flee: 'panik' };

const NPCs = {
  init(scene) {
    const px = (t) => ({ x: t.x * TILE + 8, y: t.y * TILE + 13 });
    const add = (id, opts) => {
      const a = new Actor(scene, id, opts);
      scene.npcs.push(a);
      scene.actors[id] = a;
      return a;
    };
    // Freunde (alle außer der Spielfigur)
    const spawn = {
      hubi: LOC.meadow[0], andi: LOC.cafeSeats[0], carla: { x: 17, y: 16 },
      juliette: LOC.cafeSeats[2], markus: LOC.spawns.markus, jewi: LOC.cafeSeats[3]
    };
    for (const id of FRIENDS) {
      if (id === G.figur) { scene.actors[id] = scene.player; continue; }
      const a = add(id, { kind: 'friend', pos: px(spawn[id]), speed: B('npc.tempoFreunde', 34), routine: routineFriend });
      a.idleUntil = rnd(2, 12) * 1000;
    }
    // Mascha folgt immer Hubi
    const hubi = scene.actors.hubi;
    const m = add('mascha', { kind: 'dog', dog: true, pos: { x: hubi.x - 12, y: hubi.y }, speed: 60 });
    m.follow = hubi; m.followDist = 14;
    m.noInteractWhenPlayerHubi = true;

    // Ladenbesitzer vor ihren Türen
    const home = (id, t) => {
      const a = add(id, { kind: 'shop', pos: px(t), speed: 24, routine: routineHome });
      return a;
    };
    home('daniel', LOC.daniel);
    const lena = home('lena', LOC.lena);
    lena.data.crying = true;
    for (const sid in LOC.shops) {
      const sh = LOC.shops[sid];
      if (sid === 'cafe') continue;
      const t = this.doorFront(scene.grid, sh.door);
      const a = home(sh.keeper, t);
      a.shopId = sid;
      scene.interactables.push({
        x: (sh.door.x + 0.5) * TILE, y: (sh.door.y + 0.5) * TILE + 6, r: 18, prio: 6,
        label: () => T('ui.reden', { name: a.name }),
        fn: () => scene.interactActor(a)
      });
    }
    scene.actors.daniel.shopId = 'cafe';
    // Daniel ist unfreundlich zu Jewi (und nach der Doppler-Aktion zu allen)
    const dan = scene.actors.daniel;
    dan.lineOverride = () => (dan.state === 'normal' && (G.figur === 'jewi' || G.flags.dopplerImCafe || G.flags.derb)) ? TN('npc.daniel.unfreundlich', dan.talkIdx++) : null;
    // Über die Theke mit Daniel reden
    const c = LOC.counter;
    scene.interactables.push({
      x: (c.x + c.w / 2) * TILE, y: (c.y + 1) * TILE + 6, r: 34, prio: 4,
      label: () => T('ui.reden', { name: scene.actors.daniel.name }),
      fn: () => scene.interactActor(scene.actors.daniel)
    });
    // Stern-Typen
    add('stern1', { kind: 'extra', tex: 'sterntyp', pos: px(LOC.sternSpots[0]), speed: 20, routine: routineHome });
    add('stern2', { kind: 'extra', tex: 'sterntyp', pos: px(LOC.sternSpots[1]), speed: 20, routine: routineHome });
    // Statisten
    // Bobos (drei Stück) – „Das ist jetzt unser Viertel“
    ['bobo', 'bobo2', 'bobo3'].forEach((id, i) => {
      const b = add(id, { kind: 'extra', tex: 'bobo' + (i + 1), pos: px(LOC.wander[(i * 5) % LOC.wander.length]), speed: 30, routine: routineWander, name: T('npc.bobo.name', null, 'Bobo') });
      b.dialogId = 'bobo'; b.isBobo = true;
    });
    // Sexarbeiterinnen, die von den Bobos verjagt werden
    LOC.swSpots.forEach((spot, i) => {
      const w = add('sw' + (i + 1), { kind: 'extra', tex: 'sw' + (i + 1), pos: px(spot), speed: 28, routine: routineHome, name: T('npc.sw.name', null, 'Sexarbeiterin') });
      w.dialogId = 'sw'; w.talkRep = true; w.data.spot = spot;
    });
    add('hausmasta', { kind: 'extra', pos: px(LOC.spawns.hausmasta), speed: B('npc.hausmastaTempo', 9), routine: routineHausmasta });
    // Ulli (Erwins Ex – oder doch nicht?)
    const ulli = add('ulli', { kind: 'extra', pos: px(LOC.spawns.bobo), speed: 30, routine: routineWander, labelColor: '#ff70a6' });
    ulli.stoneImmune = true;
    // Café-Gäste, die aufs Klo wollen
    for (let i = 1; i <= 3; i++) {
      const g = add('gast' + i, { kind: 'extra', tex: 'bobo' + i, pos: px(LOC.cafeSeats[i]), speed: 30, name: T('npc.bobo.name', null, 'Bobo') });
      g.dialogId = 'gast'; g.setPresent(false); g.talkRep = false;
    }
    // willhaben-Verkäufer (nur während Ullis Auftrag)
    for (let i = 1; i <= 3; i++) {
      const v = add('verk' + i, { kind: 'extra', tex: 'bobo' + i, pos: px(LOC.spawns.markus), speed: 10, routine: routineHome, name: T('npc.verkaeufer.name', null, 'Bobo (willhaben)') });
      v.dialogId = 'verkaeufer'; v.setPresent(false); v.talkRep = false;
    }
    // Hubis Büro und das echte Klo
    const off = LOC.office, wc = LOC.wc;
    scene.interactables.push({ x: off.x * TILE - 2, y: (off.y + 0.5) * TILE, r: 18, prio: 8, label: () => T('ui.buero', null, 'Hubis Büro'),
      fn: () => UI.dialog(TL('buero.tuer', ['Hubis Büro. Zutritt verboten.']).map(t => ({ who: '', text: t }))) });
    scene.interactables.push({ x: wc.x * TILE - 2, y: (wc.y + 0.5) * TILE, r: 18, prio: 8, label: () => T('ui.wc', null, 'WC'),
      fn: () => UI.dialog([{ who: '', text: T('buero.wc', null, 'Das echte Klo. Sauberer als erwartet.') }]) });
  },

  // Begehbare Kachel vor einer Tür
  doorFront(grid, d) {
    const cand = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dx, dy] of cand) {
      const x = d.x + dx, y = d.y + dy;
      if (grid.solid[y] && grid.solid[y][x] === false) return { x, y };
    }
    return { x: d.x, y: d.y + 1 };
  },

  // Aktuelle Gesprächszeile für eine Figur
  lineFor(a) {
    if (a.lineOverride) { const t = a.lineOverride(); if (t) return t; }
    const id = a.dialogId || a.id;
    const sk = STATE_KEY[a.state];
    if (sk) {
      const own = getPath(DATA.dialoge, 'npc.' + id + '.' + sk);
      if (own) return TN('npc.' + id + '.' + sk, a.talkIdx++);
      return TN('allgemein.' + sk, a.talkIdx++, null, '…');
    }
    if (a.data.crying) return TN('npc.lena.weinend', a.talkIdx++);
    return TN('npc.' + id + '.normal', a.talkIdx++, null, T('allgemein.smalltalk'));
  },

  // Andi grantig in der Nähe? → Gespräche scheitern
  grantigBlock(scene, a) {
    const p = scene.player;
    if (G.figur === 'andi' && p.state === 'grantig') return true;
    const andi = scene.actors.andi;
    if (andi && andi !== p && andi.state === 'grantig' && andi !== a) {
      if (dist(andi.x, andi.y, p.x, p.y) < B('figuren.andi.grantigRadius', 48)) return true;
    }
    return false;
  },

  talk(scene, a) {
    const p = scene.player;
    // Optionen sammeln (Aufträge, Läden, Fähigkeiten)
    let options = [];
    if (typeof Quests !== 'undefined' && Quests.optionsFor) options = options.concat(Quests.optionsFor(scene, a) || []);
    if (typeof Shops !== 'undefined' && Shops.optionsFor) options = options.concat(Shops.optionsFor(scene, a) || []);
    if (typeof Abilities !== 'undefined' && Abilities.optionsFor) options = options.concat(Abilities.optionsFor(scene, a) || []);
    if (typeof Events !== 'undefined' && Events.optionsFor) options = options.concat(Events.optionsFor(scene, a) || []);
    if (typeof Specials !== 'undefined' && Specials.optionsFor) options = options.concat(Specials.optionsFor(scene, a) || []);

    let text;
    let rep = 0;
    const blocked = this.grantigBlock(scene, a) && a.kind !== 'dog';
    if (blocked) {
      text = T('allgemein.grantigGespraech', null, 'Geh, lass mi in Ruh.');
    } else {
      text = (typeof Specials !== 'undefined' && Specials.isLoverTalk(a) && a.state === 'normal') ? TN('npc.' + a.id + '.verliebt', a.talkIdx++) : this.lineFor(a);
      if (typeof Specials !== 'undefined' && Specials.isLoverTalk(a)) Specials.kiss(scene, a);
      // +2 Ansehen, einmal pro Spielstunde pro NPC
      const hour = Math.floor(G.minute / 60);
      const canRep = a.state === 'normal' && a.talkRep !== false && ['friend', 'shop', 'extra', 'dog'].includes(a.kind);
      if (canRep && G.talkHour[a.id] !== hour) { G.talkHour[a.id] = hour; rep = B('ansehen.gespraech', 2); }
    }
    // Carla glaubt falschen Hinweisen
    let wrongHint = null;
    if (G.figur === 'carla' && !blocked && a.kind === 'friend' && Math.random() < B('npc.hinweisFalschChance', 0.25)) {
      wrongHint = T('carla.falscheHinweise', { name: a.name }, 'Da hinten hab i was gsehn!');
    }
    const pages = [{ who: a.name, text }];
    if (wrongHint) pages.push({ who: a.name, text: wrongHint });
    const done = () => {
      if (rep) scene.addRep(rep, T('ui.tratsch', null, 'Tratsch'), { talk: true, quiet: true });
      if (wrongHint) {
        const m = B('npc.hinweisFalschMin', 6);
        G.minute += m;
        UI.toast(T('carla.falschGelaufen', { n: m }, 'Umsonst herumgerannt: −{n} Min.'), 'bad');
      }
      if (a.onTalked) a.onTalked();
    };
    if (options.length) {
      options.push({ label: T('ui.tschuess', null, 'Pfiat di.'), fn: () => {} });
      UI.dialog(pages, { options, onClose: done });
    } else {
      UI.dialog(pages, { onClose: done });
    }
    // Die Figur schaut den Spieler an
    if (!a.isImmobile()) { a.facing = p.x < a.x ? -1 : 1; if (!a.follow) { a.path = null; a.idleUntil = Math.max(a.idleUntil, G.realMs + 4000); } }
  }
};
