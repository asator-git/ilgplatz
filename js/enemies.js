// ---------------------------------------------------------------
// enemies.js – Exen, Nadja, Erwin, Marco, Kiwara, Autos, Event-Figuren
// ---------------------------------------------------------------
'use strict';

const EXES = ['sandra', 'bianca', 'kathi', 'melli'];

const Enemies = {
  cars: [],
  puddles: [],

  init(scene) {
    this.scene = scene;
    this.cars = [];
    this.puddles = [];
    this.pimpCd = 0; this.slipCd = 0; this.exWarnCd = 0;
    const px = (t) => ({ x: t.x * TILE + 8, y: t.y * TILE + 13 });
    const add = (id, opts) => {
      const a = new Actor(scene, id, opts);
      a.isEnemy = true;
      scene.npcs.push(a);
      scene.actors[id] = a;
      return a;
    };
    const exSpawns = LOC.spawns.ex;
    EXES.forEach((id, i) => {
      const a = add(id, { kind: 'ex', pos: px(exSpawns[i]), speed: B('gegner.exTempo', 40), routine: routineWander, labelColor: '#ff8fab' });
      a.isEx = true;
      a.idleUntil = rnd(1, 8) * 1000;
      a.solidForPlayer = () => G.figur !== 'hubi' && a.state !== 'down';
      a.customUpdate = (dt) => this.exUpdate(a, dt);
    });
    // Nadja (ab 14 Uhr)
    const n = add('nadja', { kind: 'ex', pos: px(LOC.spawns.nadja), speed: B('gegner.exTempo', 40), routine: routineWander, labelColor: '#ff4d6d' });
    n.isNadja = true;
    n.setPresent(false);
    n.data.nextAsk = 0;
    n.customUpdate = (dt) => this.nadjaUpdate(n, dt);
    n.solidForPlayer = () => false;
    // Erwin
    const e = add('erwin', { kind: 'enemy', pos: px(LOC.spawns.erwin), speed: B('gegner.erwinTempo', 16), routine: routineWander, labelColor: '#e9c46a' });
    e.talkRep = false;
    e.talkIdx = 0;
    // Erwins Monologe werden immer länger
    e.lineOverride = () => {
      if (e.state !== 'normal') return null;
      // Jedes zweite Mal: Carbon-Rad, Stimmung, Ulli, Auto im Burgenland …
      if (!G.flags.konzert && e.talkIdx % 2 === 1) { e.talkIdx++; return TN('npc.erwin.themen', Math.floor(e.talkIdx / 2)); }
      const list = TL('npc.erwin.' + (G.flags.konzert ? 'konzert' : 'normal'));
      const i = Math.min(e.talkIdx++, list.length - 1);
      return fmt(list[i]);
    };
    this.erwinRing = scene.add.graphics().setDepth(5);
    // Marco
    const m = add('marco', { kind: 'enemy', pos: px(LOC.marcoHome), speed: B('gegner.marcoTempo', 22), labelColor: '#adb5bd' });
    m.talkRep = false;
    m.customUpdate = (dt) => this.marcoUpdate(m, dt);
    m.data.nextKo = 0;
    m.lineOverride = () => (m.state !== 'normal') ? null : (G.marcoHired ? TN('npc.marco.angeheuert', m.talkIdx++) : (Specials.marcoAtBar() ? TN('npc.marco.bier', m.talkIdx++) : null));
    // Kiwara (ab 19 Uhr)
    for (let i = 1; i <= 4; i++) {
      const k = add('kiwara' + i, { kind: 'police', tex: 'kiwara', name: T('npc.kiwara.name', null, 'Kiwara'), pos: px(LOC.lanterns[(i * 2) % LOC.lanterns.length]), speed: B('gegner.kiwaraTempo', 38), labelColor: '#90e0ef' });
      k.isKiwara = true; k.talkRep = false;
      k.data.wp = (i * 2) % LOC.lanterns.length;
      k.setPresent(false);
      k.customUpdate = (dt) => this.kiwaraUpdate(k, dt);
      k.dialogId = 'kiwara';
    }
    // Zuhälter (Event 19:00)
    for (let i = 1; i <= 4; i++) {
      const z = add('zuh' + i, { kind: 'event', tex: 'zuhaelter', name: T('npc.zuhaelter.name', null, 'Zuhälter'), pos: px(LOC.fightZone), speed: 40, labelColor: '#ef476f' });
      z.setPresent(false); z.talkRep = false; z.dialogId = 'zuhaelter';
      z.data.group = i <= 2 ? 0 : 1;
      z.customUpdate = (dt) => this.pimpUpdate(z, dt);
    }
    this.dust = scene.add.image(LOC.fightZone.x * TILE + 8, LOC.fightZone.y * TILE + 8, 'dust').setDepth(LOC.fightZone.y * TILE + 20).setVisible(false);
    // Doppler-Frau (Event 17:00)
    const d = add('doppler', { kind: 'event', pos: px(LOC.spawns.doppler), speed: 22, routine: routineWander, labelColor: '#ff85a1' });
    d.setPresent(false); d.isEnemy = false; d.talkRep = false;
    d.data.nextPuke = 0;
    // Rasiererin (nachts an der Quelle)
    const r = add('rasiererin', { kind: 'event', pos: px(LOC.spawns.rasiererin), speed: 10, routine: routineHome, labelColor: '#c9c9c9' });
    r.setPresent(false); r.isEnemy = false; r.talkRep = false;
    // Autos
    const n2 = B('gegner.autoAnzahl', 2);
    const keys = ['car_red', 'car_yellow', 'car_blue'];
    for (let i = 0; i < n2; i++) {
      const s = scene.add.image(0, 0, keys[i % 3]).setDepth(100);
      this.cars.push({ sprite: s, ang: i * (Math.PI * 2 / n2) + 0.3, r: 8.3 * TILE, wait: 0, x: 0, y: 0 });
    }
    this.updateCars(0);
    if (typeof Specials !== 'undefined') Specials.init(scene);
  },

  // Kann der Spieler gerade „erwischt“ werden?
  catchable(scene) {
    const p = scene.player;
    if (G.ended || UI.isBlocking()) return false;
    if (!['normal', 'wet', 'laughing'].includes(p.state)) return false;
    if (inCafe(p.x, p.y)) return false;
    return true;
  },

  fleeFrom(a, fx, fy, dt) {
    const dx = a.x - fx, dy = a.y - fy;
    const d = Math.hypot(dx, dy) || 1;
    a.stepToward(a.x + dx / d * 30, a.y + dy / d * 30, dt, 1.5);
    a.extraIcon = 'ic_fear';
    return true;
  },

  marcoGuards(scene, a) {
    const m = scene.actors.marco;
    return G.marcoHired && m.present && dist(m.x, m.y, a.x, a.y) < B('gegner.marcoAngstRadius', 64) && !m.isImmobile();
  },

  exUpdate(a, dt) {
    const scene = this.scene, p = scene.player;
    a.extraIcon = null;
    if (G.realMs < (a.data.fleeUntil || 0)) { a.path = null; return this.fleeFrom(a, p.x, p.y, dt); }
    if (this.marcoGuards(scene, a)) { a.path = null; const m = scene.actors.marco; return this.fleeFrom(a, m.x, m.y, dt); }
    // Nicht im Café herumstehen
    if (isCafeFloor(a.x, a.y) && !a.path) { a.goToTile(LOC.cafeFront.x, LOC.cafeFront.y + 2); }
    if (G.figur !== 'hubi') return false;
    if (G.realMs < (a.data.nextChase || 0) || !this.catchable(scene)) { if (a.data.chasing) { a.data.chasing = false; a.path = null; } return false; }
    const d = dist(a.x, a.y, p.x, p.y);
    if (d < B('gegner.exJagdRadius', 70) && lineOfSight(scene.grid, a.x, a.y - 4, p.x, p.y - 4)) {
      if (!a.data.chasing) {
        // Vorwarnung, damit man versteht, was passiert
        scene.say(a, T('gegnerText.exEntdeckt', null, 'HUUUBIII!'), 1800);
        if (G.realMs > (this.exWarnCd || 0)) {
          this.exWarnCd = G.realMs + 15000;
          UI.toast(T('gegnerText.exWarnung', { name: a.name }, '{name} hat dich entdeckt! Lauf – oder E: Mascha bellt sie weg.'), 'bad');
          Sfx.play('announce');
        }
      }
      a.data.chasing = true;
      if (d < 40) { a.path = null; a.moving = a.stepToward(p.x, p.y, dt); }
      else {
        if (!a.path || G.realMs - (a.data.lastPath || 0) > 600) { a.data.lastPath = G.realMs; a.goToPx(p.x, p.y - 2); }
        a.moving = a.stepPath(dt);
      }
      a.extraIcon = 'ic_heart';
      return true;
    }
    if (a.data.chasing) { a.data.chasing = false; a.path = null; }
    return false;
  },

  // Nadja läuft NICHT hinterher: sie taucht auf, schlendert herum, und Hubi muss sich verstecken
  nadjaUpdate(n, dt) {
    const scene = this.scene, p = scene.player;
    n.extraIcon = null;
    n.speed = B('gegner.exTempo', 34);
    if (this.marcoGuards(scene, n)) { n.path = null; const m = scene.actors.marco; return this.fleeFrom(n, m.x, m.y, dt); }
    // Sie geht (Besuch vorbei)
    if (n.data.leaving) {
      const e = n.data.leaving;
      if (n.atTile(e.x, e.y, 1)) { n.setPresent(false); n.data.leaving = null; n.path = null; return true; }
      if (!n.path) n.goToTile(e.x, e.y);
      n.moving = n.stepPath(dt) || n.stepToward(e.x * TILE + 8, e.y * TILE + 8, dt);
      return true;
    }
    // Verrat: sie wartet vor dem Café auf Hubi
    if (n.data.waitCafeUntil && G.minute < n.data.waitCafeUntil) {
      const f = { x: LOC.cafeFront.x - 1, y: LOC.cafeFront.y + 1 };
      if (!n.atTile(f.x, f.y, 1)) { if (!n.path) n.goToTile(f.x, f.y); n.moving = n.stepPath(dt); }
      n.extraIcon = 'ic_angry';
      return true;
    }
    if (isCafeFloor(n.x, n.y) && !n.path) { n.goToTile(LOC.cafeFront.x - 1, LOC.cafeFront.y + 2); }
    if (G.figur === 'hubi') return false;
    // Andere Figuren: „Hast du Hubi gesehen?“
    const d = dist(n.x, n.y, p.x, p.y);
    if (G.minute >= n.data.nextAsk && d < 80 && this.catchable(scene)) {
      if (d < 16) { this.nadjaAsk(scene, n); return true; }
      n.path = null; n.moving = n.stepToward(p.x, p.y, dt);
      return true;
    }
    return false;
  },

  // Nadja kommt und geht in Wellen (ab 14 Uhr)
  updateNadjaVisits(scene) {
    const n = scene.actors.nadja;
    const m = G.minute;
    if (m < parseClock(B('gegner.nadjaAb', '14:00'), 840) || G.ended) return;
    if (!G.flags.nadjaNext) G.flags.nadjaNext = m;
    if (m < G.flags.nadjaNext) return;
    if (!n.present) {
      const ends = [LOC.streetEnds.hiller, LOC.streetEnds.feuerbach, LOC.streetEnds.schrotzberg];
      const e = pick(ends);
      n.setPresent(true); n.clearState(); n.setTile(e.x, e.y); n.data.leaving = null; n.idleUntil = 0;
      G.flags.nadjaNext = m + rnd(B('gegner.nadjaBleibtMinMin', 30), B('gegner.nadjaBleibtMinMax', 50));
      if (G.figur === 'hubi') { UI.banner(T('gegnerText.nadjaDa', null, 'NADJA ist am Platz! Versteck dich im Café, sonst kriegst du Liebeskummer!'), 4500); Sfx.play('siren'); }
      else UI.toast(T('gegnerText.nadjaDaAndere', null, 'Nadja ist am Platz. Hubi versteckt sich im Café.'), '');
    } else if (!n.data.leaving) {
      n.data.leaving = pick([LOC.streetEnds.hiller, LOC.streetEnds.feuerbach, LOC.streetEnds.schrotzberg]);
      n.path = null;
      G.flags.nadjaNext = m + rnd(B('gegner.nadjaWegMinMin', 50), B('gegner.nadjaWegMinMax', 90));
      if (G.figur === 'hubi') UI.toast(T('gegnerText.nadjaWeg', null, 'Nadja geht. Durchatmen, Hubi.'), 'good');
    }
  },

  // Liebeskummer (Hubi in Nadjas Nähe) und NPC-Hubi versteckt sich
  updateLiebeskummer(scene, dt) {
    const n = scene.actors.nadja, p = scene.player, h = scene.actors.hubi;
    const here = n.present && !n.data.leaving;
    if (G.figur === 'hubi') {
      const R = B('gegner.nadjaKummerRadius', 72);
      const near = here && !G.ended && dist(n.x, n.y, p.x, p.y) < R && !isCafeFloor(p.x, p.y) && lineOfSight(scene.grid, n.x, n.y - 4, p.x, p.y - 4);
      if (near && ['normal', 'wet', 'laughing'].includes(p.state)) {
        p.setState('liebeskummer');
        scene.addRep(-B('gegner.nadjaKummerSofort', 5), T('gegnerText.liebeskummerKurz', null, 'Liebeskummer'));
        scene.say(p, TN('npc.hubi.liebeskummer', p.talkIdx++), 2500);
        this.kummerAcc = 0;
      }
      if (p.state === 'liebeskummer') {
        if (near) {
          p.data.kummerEnd = G.realMs + B('gegner.nadjaKummerNachSek', 4) * 1000;
          this.kummerAcc = (this.kummerAcc || 0) + dt / (B('zeit.sekundenProStunde', 240) * 1000 / 60) * G.speed;
          if (this.kummerAcc >= 1) { this.kummerAcc -= 1; scene.addRep(-B('gegner.nadjaKummerProMin', 2), T('gegnerText.liebeskummerKurz', null, 'Liebeskummer'), { silent: G.rep <= 0 }); }
          if (Math.random() < dt / 3000) scene.say(p, TN('npc.hubi.liebeskummer', p.talkIdx++), 2000);
        } else if (G.realMs > (p.data.kummerEnd || 0)) { p.clearState(); UI.toast(T('gegnerText.kummerVorbei', null, 'Puh. Der Liebeskummer lässt nach.'), 'good'); }
      }
    } else if (h && h !== p && !h.follow) {
      // NPC-Hubi flüchtet ins Café, solange Nadja da ist
      if (here && !h.data.versteckt && h.state === 'normal') {
        h.data.versteckt = true;
        const seat = LOC.cafeSeats[1];
        h.override = { tx: seat.x, ty: seat.y, until: 99999 }; h.path = null;
        scene.say(h, TN('npc.hubi.verstecken', h.talkIdx++), 2500);
      }
      if (!here && h.data.versteckt) { h.data.versteckt = false; h.override = null; h.path = null; h.idleUntil = 0; }
    }
  },

  nadjaAsk(scene, n) {
    n.data.nextAsk = G.minute + B('gegner.nadjaFrageAbstandMin', 90);
    const hubiNpc = G.figur !== 'hubi';
    UI.dialog([{ who: n.name, text: T('gegnerText.nadjaFrage', null, 'Hast du Hubi gesehen?') }], {
      options: [
        { label: T('gegnerText.nadjaJa', null, '„Ja, im Café.“ (Verrat!)'), fn: () => {
          scene.addRep(B('gegner.nadjaVerratAnsehen', 20), T('gegnerText.verratKurz', null, 'Verrat bei Nadja'));
          if (G.rivalId === 'hubi') { G.rivalAdj -= B('gegner.nadjaVerratHubi', 30); UI.toast(T('gegnerText.hubiVerliert', { n: B('gegner.nadjaVerratHubi', 30) }, 'Hubi verliert {n} Ansehen!'), 'good'); }
          UI.dialog([{ who: n.name, text: T('gegnerText.nadjaDanke', null, 'Danke. Er wird sich freuen. Nicht.') }]);
          if (hubiNpc) {
            n.data.waitCafeUntil = G.minute + B('gegner.nadjaWartenMin', 25);
            const h = scene.actors.hubi;
            if (h.present && h !== scene.player) { h.setState('liebeskummer', B('gegner.nadjaKummerNpcMin', 30)); scene.say(h, TN('npc.hubi.liebeskummer', h.talkIdx++), 3000); }
          }
        } },
        { label: T('gegnerText.nadjaNein', null, '„Nein.“'), fn: () => UI.dialog([{ who: n.name, text: T('gegnerText.nadjaNeinAntwort', null, 'Hm. Ich finde ihn. Ich finde ihn immer.') }]) }
      ]
    });
  },

  marcoUpdate(m, dt) {
    const scene = this.scene, p = scene.player;
    if (G.marcoHired) {
      m.follow = p; m.followDist = 22; m.speed = 60;
      // Alle 20 Minuten „erledigt“ er wen
      if (!m.data.nextKo) m.data.nextKo = G.minute + B('gegner.marcoErledigtAlleMin', 20);
      if (G.minute >= m.data.nextKo) {
        m.data.nextKo = G.minute + B('gegner.marcoErledigtAlleMin', 20);
        const cands = scene.npcs.filter(a => a.present && a !== m && !a.isDog && !a.isKiwara && a.state === 'normal' && a.kind !== 'event' && dist(a.x, a.y, m.x, m.y) < 90);
        if (cands.length) {
          const v = pick(cands);
          v.setState('down', B('gegner.marcoErledigtMin', 10));
          scene.say(m, T('gegnerText.marcoErledigt', null, 'Ups.'), 2500);
          scene.floatText(v.x, v.y - 20, 'K.O.', '#ef476f');
          Sfx.play('punch');
          scene.addRep(-B('gegner.marcoErledigtVerlust', 15), T('gegnerText.marcoErledigtKurz', { name: v.name }, 'Marco hat {name} erledigt'));
        }
      }
      return false; // Folgen übernimmt Actor.update
    }
    m.follow = null; m.speed = B('gegner.marcoTempo', 22);
    if (G.flags.marcoWild) return Specials.marcoRage(scene, m, dt);
    // Oft sitzt er beim Buffalo auf a Bier
    m.extraIcon = null;
    if (Specials.marcoAtBar()) {
      const b = LOC.marcoBar;
      m.extraIcon = 'ic_beer';
      if (!m.atTile(b.x, b.y)) { if (!m.path) m.goToTile(b.x, b.y); m.moving = m.stepPath(dt); if (!m.path && !m.atTile(b.x, b.y)) m.setTile(b.x, b.y); }
      return true;
    }
    const tesla = { x: (LOC.tesla.x + 1) * TILE, y: (LOC.tesla.y + 1) * TILE };
    const guard = dist(p.x, p.y, tesla.x, tesla.y) < B('gegner.marcoWachRadius', 56) && p.state !== 'hospital';
    if (guard) { m.path = null; m.moving = m.stepToward(p.x, p.y, dt); return true; }
    if (dist(m.x, m.y, m.homeX, m.homeY) > 4) {
      if (!m.path) m.goToPx(m.homeX, m.homeY);
      m.moving = m.stepPath(dt) || m.stepToward(m.homeX, m.homeY, dt);
    }
    return true;
  },

  kiwaraUpdate(k, dt) {
    const scene = this.scene, p = scene.player;
    if (k.data.eventCop && G.flags.marcoWild) return Specials.copDuty(k, dt);
    const contraband = scene.hasItem('paket') || scene.hasItem('shit');
    const d = dist(k.x, k.y, p.x, p.y);
    k.extraIcon = null;
    if (contraband && this.catchable(scene) && G.realMs > (k.data.cd || 0) && d < B('gegner.kiwaraSichtRadius', 80) && lineOfSight(scene.grid, k.x, k.y - 4, p.x, p.y - 4)) {
      k.speed = B('gegner.kiwaraJagdTempo', 56);
      k.extraIcon = 'ic_excl';
      if (d < 40) { k.path = null; k.moving = k.stepToward(p.x, p.y, dt); }
      else {
        if (!k.path || G.realMs - (k.data.lastPath || 0) > 600) { k.data.lastPath = G.realMs; k.goToPx(p.x, p.y); }
        k.moving = k.stepPath(dt);
      }
      return true;
    }
    k.speed = B('gegner.kiwaraTempo', 38);
    if (!k.path) {
      k.data.wp = (k.data.wp + 1) % LOC.lanterns.length;
      const l = LOC.lanterns[k.data.wp];
      const f = randomWalkableNear(scene.grid, l.x, l.y, 1);
      k.goToTile(f.x, f.y);
    }
    k.moving = k.stepPath(dt);
    return true;
  },

  pimpUpdate(z, dt) {
    // Wildes Herumgerangel in der Zone
    const c = { x: LOC.fightZone.x * TILE + 8, y: LOC.fightZone.y * TILE + 12 };
    if (!z.data.t || G.realMs > z.data.t) {
      z.data.t = G.realMs + rnd(300, 900);
      const a = Math.random() * Math.PI * 2, r = rnd(4, 22);
      z.data.gx = c.x + Math.cos(a) * r; z.data.gy = c.y + Math.sin(a) * r * 0.6;
      if (Math.random() < 0.3) { Sfx.play('punch'); if (Math.random() < 0.3) this.scene.say(z, T('npc.zuhaelter.normal', null, 'Schleich di!'), 1200); }
    }
    z.moving = z.stepToward(z.data.gx, z.data.gy, dt, 1.2);
    return true;
  },

  // ---- Autos im Kreisverkehr (im Uhrzeigersinn) ----
  updateCars(dt) {
    const scene = this.scene, p = scene.player;
    const cx = MCX * TILE, cy = MCY * TILE;
    const v = B('gegner.autoTempo', 30);
    for (const c of this.cars) {
      // Vor Fußgängern am Zebrastreifen anhalten
      const ahead = { x: cx + Math.cos(c.ang + 0.18) * c.r, y: cy + Math.sin(c.ang + 0.18) * c.r };
      const pZebra = [TI.ZEBRA, TI.ZEBRA_H].includes(tileAt(scene.grid, p.x, p.y - 3));
      let stop = pZebra && dist(ahead.x, ahead.y, p.x, p.y - 4) < 26;
      if (!stop) c.ang += v / c.r * dt / 1000;
      if (c.ang > Math.PI * 2) c.ang -= Math.PI * 2;
      c.x = cx + Math.cos(c.ang) * c.r; c.y = cy + Math.sin(c.ang) * c.r;
      c.sprite.setPosition(Math.round(c.x), Math.round(c.y));
      c.sprite.setRotation(c.ang + Math.PI / 2);
      c.sprite.setDepth(c.y + 6);
      // Unfall?
      if (dt && !G.ended && !UI.isBlocking() && ['normal', 'wet', 'laughing', 'frozen', 'slipped'].includes(p.state) && !pZebra) {
        const dx = p.x - c.x, dy = (p.y - 4) - c.y;
        const tx = -Math.sin(c.ang), ty = Math.cos(c.ang); // Fahrtrichtung
        const along = dx * tx + dy * ty, perp = -dx * ty + dy * tx;
        if (Math.abs(along) < 14 && Math.abs(perp) < 9) this.hospital(scene);
      }
    }
  },

  hospital(scene) {
    const p = scene.player;
    Sfx.play('car'); Sfx.play('hurt');
    scene.cameras.main.shake(300, 0.01);
    p.setState('hospital', B('spieler.krankenhausMin', 30));
    p.sprite.setVisible(false); p.label.setVisible(false);
    if (scene.hasItem('paket')) { scene.takeItem('paket'); if (typeof Quests !== 'undefined' && Quests.onItemLost) Quests.onItemLost(scene, 'paket'); }

    p.onStateEnd = (old) => {
      if (old !== 'hospital') return;
      p.onStateEnd = null;
      p.sprite.setVisible(true); p.label.setVisible(true);
      scene.teleportPlayer(LOC.spawnMeadow.x, LOC.spawnMeadow.y);
      UI.toast(T('gegnerText.entlassen', null, 'Entlassen. Schau beim nächsten Mal auf die Autos!'), '');
    };
  },

  // Spieler festhalten (Ex / Nadja)
  holdPlayer(scene, a, minutes, loss) {
    const p = scene.player;
    p.setState('held', minutes);
    a.setState('held', minutes);
    a.path = null;
    a.data.chasing = false;
    a.data.nextChase = G.realMs + B('gegner.exPauseSek', 40) * 1000 + minutes / G.speed * B('zeit.sekundenProStunde', 240) * 1000 / 60 / B('zeit.warteTurbo', 5);
    scene.addRep(-loss, T('gegnerText.festgequatscht', { name: a.name }, '{name} quatscht dich fest'));
    Sfx.play('bad');
    const lines = TL('npc.' + a.id + '.fang', ['HUBI! Wir müssen reden.']);

    p.data.heldBy = a;
    p.onStateEnd = (old) => {
      if (old !== 'held') return;
      p.onStateEnd = null;
      p.data.heldBy = null;
      a.clearState();
      a.data.fleeUntil = G.realMs + 4000;
      UI.toast(T('gegnerText.frei', null, 'Endlich frei!'), 'good');
    };
  },

  update(scene, dt) {
    const p = scene.player;
    this.updateCars(dt);
    if (typeof Specials !== 'undefined') Specials.update(scene, dt);
    const m = G.minute;
    // Anwesenheit nach Uhrzeit
    this.updateNadjaVisits(scene);
    this.updateLiebeskummer(scene, dt);
    const kAb = parseClock(B('gegner.kiwaraAb', '19:00'), 1140), kV = parseClock(B('gegner.kiwaraVerstaerktAb', '21:00'), 1260);
    for (let i = 1; i <= 4; i++) {
      const k = scene.actors['kiwara' + i];
      const should = m >= (i <= 2 ? kAb : kV);
      if (should && !k.present) { k.setPresent(true); const l = LOC.mapEdgeSpots[i % 4]; k.setTile(l.x, l.y); }
    }
    // Erwin: Versteinerungsradius
    this.updateErwin(scene, dt);
    // Kontakte mit dem Spieler
    if (this.catchable(scene)) {
      for (const a of scene.npcs) {
        if (!a.present || a.isImmobile()) continue;
        const d = dist(a.x, a.y, p.x, p.y);
        if (a.isEx && !a.isNadja && G.figur === 'hubi' && d < 10 && G.realMs > (a.data.nextChase || 0) && G.realMs > (a.data.fleeUntil || 0)) {
          this.holdPlayer(scene, a, B('gegner.exFesthaltenMin', 15), B('gegner.exVerlust', 10));
          break;
        }
        if (a.isEx && !a.isNadja && G.figur !== 'hubi' && d < 14 && G.realMs > (a.data.blockTalk || 0)) {
          a.data.blockTalk = G.realMs + B('gegner.exBlockSpruchSek', 6) * 1000;
          scene.say(a, TN('npc.' + a.id + '.normal', a.talkIdx++), 2600);
        }
        if (a.id === 'marco' && !G.marcoHired && d < 13 && G.realMs > (a.data.pushCd || 0)) {
          a.data.pushCd = G.realMs + 1200;
          scene.say(a, TN('npc.marco.normal', a.talkIdx++), 1800);
          scene.pushPlayer(a.x, a.y, B('gegner.marcoSchiebKacheln', 3));
          if (typeof Quests !== 'undefined' && Quests.onMarcoPush) Quests.onMarcoPush(scene);
        }
        if (a.isKiwara && d < 12 && G.realMs > (a.data.cd || 0)) {
          a.data.cd = G.realMs + 20000;
          this.police(scene, a);
          break;
        }
      }
    }
    // Zuhälter-Zone
    if (G.flags.zuhaelter) {
      const c = { x: LOC.fightZone.x * TILE + 8, y: LOC.fightZone.y * TILE + 12 };
      this.dust.setVisible(true).setRotation(Math.sin(G.realMs / 90) * 0.2).setScale(1 + Math.sin(G.realMs / 70) * 0.08);
      if (['normal', 'wet', 'laughing'].includes(p.state) && dist(p.x, p.y, c.x, c.y) < LOC.fightZone.r * TILE && G.realMs > (this.pimpCd || 0)) {
        this.pimpCd = G.realMs + 800;
        scene.pushPlayer(c.x, c.y, B('gegner.zuhaelterWegSchleudern', 3) + 1);
        const z = scene.actors.zuh1;
        scene.say(z, T('npc.zuhaelter.normal', null, 'Schleich di!'), 1500);
      }
    } else if (this.dust.visible) this.dust.setVisible(false);
    // Pfützen (Doppler)
    this.updatePuddles(scene, dt);
  },

  police(scene, k) {
    const has = scene.hasItem('paket') ? 'paket' : (scene.hasItem('shit') ? 'shit' : null);
    if (!has) { scene.say(k, TN('npc.kiwara.normal', k.talkIdx++), 2200); return; }
    Sfx.play('siren');
    scene.takeItem(has);
    if (typeof Quests !== 'undefined' && Quests.onItemLost) Quests.onItemLost(scene, has, true);
    scene.addRep(-B('gegner.kiwaraVerlust', 30), T('gegnerText.kiwaraKurz', null, 'Kiwara-Kontrolle'));
    UI.dialog([{ who: k.name, text: T('gegnerText.kiwara_' + has, null, 'Kontrolle! Was ham ma denn da?') }]);
  },

  updateErwin(scene, dt) {
    const e = scene.actors.erwin;
    const g = this.erwinRing;
    g.clear();
    if (!e.present) return;
    const active = !e.isImmobile();
    let R = B('gegner.erwinRadius', 30);
    if (G.flags.konzert) R *= B('events.konzertRadiusFaktor', 3);
    if (active) {
      g.lineStyle(1, 0xe9c46a, 0.35 + Math.sin(G.realMs / 250) * 0.1);
      g.strokeCircle(e.x, e.y - 4, R);
      g.fillStyle(0xe9c46a, 0.06);
      g.fillCircle(e.x, e.y - 4, R);
      if (Math.random() < dt / 2500) scene.say(e, G.flags.konzert ? TN('npc.erwin.konzert', e.talkIdx) : T('npc.erwin.themenKurz', null, 'Kennst du Gipsy-Jazz?'), 2600);
      if (G.flags.konzert && Math.random() < dt / 1500) Sfx.play('guitar');
    }
    e.extraIcon = active ? 'ic_note' : null;
    const rate = dt / (B('gegner.erwinSekBisStein', 5) * 1000);
    const victims = [scene.player].concat(scene.npcs.filter(a => a.present && !a.isEnemy && !a.isDog && a.kind !== 'event' && !a.stoneImmune));
    for (const v of victims) {
      if (v === e) continue;
      const inR = active && dist(v.x, v.y, e.x, e.y) < R && !isCafeFloor(v.x, v.y);
      const can = ['normal', 'wet', 'laughing', 'sitting'].includes(v.state) && !(v === scene.player && UI.overlayMode);
      if (inR && can) {
        v.stoneBar = Math.min(1, v.stoneBar + rate);
        if (v.stoneBar >= 1) {
          v.setState('stone', B('gegner.steinMin', 20));
          if (G.flags.konzert && v !== scene.player) v.data.konzertOpfer = true;
          Sfx.play('stone');
          if (v === scene.player) {
            UI.banner(T('gegnerText.versteinert', null, 'VERSTEINERT! Erwin hat dir seine Gitarre erklärt. (20 Min.)'), 3500);
            if (scene.hasItem('lieferung') && typeof Quests !== 'undefined' && Quests.onItemLost) { /* Essen wird kalt – Quest-Timer läuft weiter */ }
          }
        }
      } else if (v.stoneBar > 0) v.stoneBar = Math.max(0, v.stoneBar - rate * 1.5);
    }
  },

  updatePuddles(scene, dt) {
    const p = scene.player;
    const d = scene.actors.doppler;
    if (d.present && G.flags.doppler && !d.data.done && G.minute >= d.data.nextPuke && !isCafeFloor(d.x, d.y)) {
      d.data.nextPuke = G.minute + B('events.dopplerKotzenAlleMin', 2);
      const s = scene.add.image(d.x + d.facing * 6, d.y + 2, 'puddle').setDepth(2);
      this.puddles.push({ s, x: s.x, y: s.y, until: G.minute + B('events.pfuetzeMin', 40) });
      scene.say(d, T('gegnerText.kotz', null, 'Hoppla… *blubb*'), 1500);
      Sfx.play('splash');
    }
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const pu = this.puddles[i];
      if (G.minute > pu.until) { pu.s.destroy(); this.puddles.splice(i, 1); continue; }
      if (['normal', 'wet', 'laughing'].includes(p.state) && G.realMs > (this.slipCd || 0) && Math.abs(p.x - pu.x) < 8 && Math.abs(p.y - pu.y) < 5) {
        this.slipCd = G.realMs + B('events.ausrutschenSek', 3) * 1000 + 2000;
        p.setState('slipped', 0, B('events.ausrutschenSek', 3) * 1000);
        Sfx.play('slip');
        scene.say(p, T('gegnerText.ausgerutscht', null, 'Uaaah! Grauslich!'), 1800);
      }
    }
  },

  clearPuddles() { for (const pu of this.puddles) pu.s.destroy(); this.puddles = []; }
};
