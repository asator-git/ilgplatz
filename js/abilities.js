// ---------------------------------------------------------------
// abilities.js – Stärken (Taste E) und Schwächen der Spielfiguren
// ---------------------------------------------------------------
'use strict';

const Abilities = {
  cd: 0,              // Cooldown-Ende (realMs)
  lastLoss: 0,        // Carla: letzte Verlust-Minute
  grantigAcc: 0,      // Andi: aufgelaufene Minuten grantig
  termCd: {},         // Markus: Terminal-Cooldowns
  hacked: {},         // Markus: gehackte Terminals
  stoneRescueAt: 0,

  reset() {
    this.cd = 0; this.lastLoss = G.minute; this.grantigAcc = 0; this.termCd = {}; this.hacked = {}; this.stoneRescueAt = 0;
  },

  // Ist Mascha gerade bei der Spielfigur (Hubi selbst oder Hubi als Begleiter)?
  maschaWithPlayer(scene) {
    const m = scene.actors.mascha;
    if (!m || !m.present) return false;
    const p = scene.player;
    if (G.figur === 'hubi') return m.follow === p && dist(m.x, m.y, p.x, p.y) < 60;
    return !!G.companion && scene.actors.hubi.follow === p && dist(m.x, m.y, p.x, p.y) < 70;
  },

  nearestActor(scene, r, filter) {
    const p = scene.player;
    let best = null, bd = r;
    for (const a of scene.npcs) {
      if (!a.present || a === p || a.isDog) continue;
      if (filter && !filter(a)) continue;
      const d = dist(p.x, p.y, a.x, a.y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  },

  // Mascha kuschelt: heilt versteinert / grantig / niedergequasselt
  heal(scene, target) {
    const m = scene.actors.mascha;
    const wasConcert = target.data.konzertOpfer;
    const wasHungry = target.id === 'andi' && target.state === 'grantig';
    target.clearState();
    target.data.konzertOpfer = false;
    if (m) {
      m.path = null;
      scene.tweens.add({ targets: m, x: target.x + 8, y: target.y, duration: 250, yoyo: true, hold: 500 });
    }
    target.extraIcon = 'ic_heart';
    target.data.heartUntil = G.realMs + 2500;
    Sfx.play('bark');
    scene.say(target, T('mascha.geheilt', { name: target.name }, 'Oh, Mascha! Danke!'));
    if (wasConcert) scene.addRep(B('events.konzertRettung', 10), T('mascha.rettungKonzert', null, 'Konzert-Opfer gerettet'), { quest: true });
    else scene.addRep(B('ansehen.maschaRettet', 5), T('mascha.rettung', null, 'Mascha hilft'));
    if (wasHungry && typeof Quests !== 'undefined' && Quests.onAndiCalmed) Quests.onAndiCalmed(scene);
  },

  special(scene) {
    const p = scene.player;
    if (UI.isBlocking() || G.ended || G.paused) return;
    const now = G.realMs;
    // Mascha rettet die versteinerte Spielfigur
    if (p.state === 'stone' && this.maschaWithPlayer(scene)) {
      p.clearState(); Sfx.play('bark');
      scene.say(p, T('mascha.selbst', null, 'Mascha schleckt dich ab. Du bist wieder da!'));
      return;
    }
    if (p.isImmobile()) return;
    // Mascha (auch als Begleiter) heilt zuerst
    if (this.maschaWithPlayer(scene)) {
      const t = this.nearestActor(scene, B('figuren.hubi.kuschelRadius', 30), a => a.isHealable());
      if (t) { this.heal(scene, t); return; }
    }
    if (now < this.cd) { UI.toast(T('spezialText.warten', null, 'Moment, gleich wieder…'), ''); return; }
    switch (G.figur) {
      case 'hubi': return this.bark(scene);
      case 'andi': return this.eat(scene);
      case 'carla': return this.talkDown(scene);
      case 'juliette': return this.bisou(scene);
      case 'markus': return this.hack(scene);
      case 'jewi': return this.photo(scene);
    }
  },

  bark(scene) {
    const p = scene.player;
    if (!this.maschaWithPlayer(scene)) { UI.toast(T('spezialText.keineMascha', null, 'Mascha is grad ned bei dir!'), 'bad'); return; }
    this.cd = G.realMs + B('figuren.hubi.bellenCooldownSek', 6) * 1000;
    Sfx.play('bark');
    const m = scene.actors.mascha;
    scene.say(m, T('mascha.bellen', null, 'WUFF! WUFF!'), 1200);
    scene.cameras.main.shake(120, 0.002);
    let n = 0;
    for (const a of scene.npcs) {
      if (!a.present || !a.isEx) continue;
      if (dist(a.x, a.y, p.x, p.y) < B('figuren.hubi.bellenRadius', 80)) {
        a.data.fleeUntil = G.realMs + B('figuren.hubi.bellenFliehenSek', 20) * 1000;
        a.path = null;
        n++;
      }
    }
    if (n) UI.toast(T('spezialText.exenFliehen', { n }, '{n} Ex(en) ergreifen die Flucht!'), 'good');
  },

  eat(scene, fromShop) {
    const p = scene.player;
    const food = FOOD_ITEMS.find(k => scene.hasItem(k));
    if (!food) { UI.toast(T('spezialText.nixZumEssen', null, 'Nix zum Jausnen dabei. Ab zum Deewan!'), 'bad'); return false; }
    scene.takeItem(food);
    this.feedAndi(scene, food === 'kipferl' ? B('figuren.andi.kipferlSaettigung', 60) : 100);
    return true;
  },

  feedAndi(scene, amount) {
    const p = scene.player;
    G.hunger = clamp((G.hunger || 0) + amount, 0, 100);
    if (p.state === 'grantig') p.clearState();
    this.grantigAcc = 0;
    Sfx.play('eat');
    scene.say(p, T('spezialText.mampf', null, 'Mampf. Jetzt bin i wieder a Mensch.'));
    if (typeof Quests !== 'undefined' && Quests.onAndiFed) Quests.onAndiFed(scene);
  },

  talkDown(scene) {
    const t = this.nearestActor(scene, B('figuren.carla.quasselRadius', 26), a => !a.isImmobile() && !a.noQuassel);
    if (!t) { UI.toast(T('spezialText.niemandDa', null, 'Da is niemand zum Anquasseln.'), ''); return; }
    this.cd = G.realMs + B('figuren.carla.quasselCooldownSek', 8) * 1000;
    t.setState('talked', 0, B('figuren.carla.quasselSek', 30) * 1000);
    scene.say(scene.player, T('spezialText.quasseln', null, 'Und dann in Graz, da hab ich, also eigentlich die Tante, und das Rad…'), 2500);
    Sfx.play('type');
    if (typeof Quests !== 'undefined' && Quests.onTalkedDown) Quests.onTalkedDown(scene, t);
  },

  bisou(scene) {
    const t = this.nearestActor(scene, 26, a => a.state === 'normal');
    this.cd = G.realMs + 3000;
    if (!t) { scene.say(scene.player, T('spezialText.bisouLeer', null, 'Bisou… an niemanden. Tant pis.')); return; }
    scene.say(scene.player, T('spezialText.bisou', { name: t.name }, 'Bisou, bisou, {name}!'));
    scene.say(t, T('spezialText.bisouAntwort', null, 'Oh là là!'));
    t.extraIcon = 'ic_heart'; t.data.heartUntil = G.realMs + 2000;
    Sfx.play('blip');
  },

  nearTerminal(scene, r) {
    const p = scene.player;
    let best = null, bd = r;
    for (const t of scene.objs.terminals) {
      const d = dist(p.x, p.y - 4, t.x, t.y - 4);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  },

  hack(scene) {
    const t = this.nearTerminal(scene, B('figuren.markus.terminalRadius', 20) + 6);
    if (!t) { UI.toast(T('spezialText.keinTerminal', null, 'Kein Terminal in der Nähe. Die sind neben den Läden.'), ''); return; }
    if (this.hacked[t.shopId]) { UI.toast(T('spezialText.schonGehackt', null, 'Das Terminal hast schon gehackt.'), ''); return; }
    this.cd = G.realMs + 2000;
    UI.minigameHack((ok) => {
      if (!ok) { UI.toast(T('spezialText.hackFail', null, 'ACCESS DENIED. Nochmal probieren.'), 'bad'); return; }
      this.hacked[t.shopId] = true;
      if (t.shopId === 'cafe') {
        G.priceMods.hackUntil = G.minute + B('preise.hackDauerMin', 60);
        UI.banner(T('spezialText.hackCafe', null, 'GEHACKT! Daniels Preise sind eine Stunde lang halbiert.'), 4000, 'info');
        scene.addRep(5, T('spezialText.hackKurz', null, 'Hack'));
      } else {
        scene.addMoney(B('figuren.markus.hackBonusGeld', 10), T('spezialText.hackKurz', null, 'Hack'));
        scene.addRep(B('figuren.markus.hackBonusAnsehen', 10), T('spezialText.hackLaden', { laden: T('orte.' + t.shopId, null, t.shopId) }, 'Laden gehackt: {laden}'));
      }
    });
  },

  photo(scene) {
    const p = scene.player;
    const t = this.nearestActor(scene, B('figuren.jewi.fotoRadius', 70), a => !a.isImmobile() && (a.isEnemy || a.id === 'schlosser'));
    this.cd = G.realMs + B('figuren.jewi.fotoCooldownSek', 5) * 1000;
    Sfx.play('photo');
    scene.cameras.main.flash(120, 255, 255, 255);
    if (!t) { UI.toast(T('spezialText.fotoLeer', null, 'Schönes Foto vom Ilgplatz. Leider ohne Sinn.'), ''); return; }
    t.setState('frozen', 0, B('figuren.jewi.fotoEinfrierenSek', 8) * 1000);
    scene.say(t, T('spezialText.fotoOpfer', null, 'He! Ka Foto!'), 1800);
    if (t.id === 'schlosser' && typeof Quests !== 'undefined' && Quests.onSchlosserPhoto) Quests.onSchlosserPhoto(scene, t);
  },

  // Zusätzliche Gesprächsoptionen (Hubi holen)
  optionsFor(scene, a) {
    const opts = [];
    if (a.id === 'hubi' && G.figur !== 'hubi' && a.present && a.state === 'normal') {
      if (G.companion) {
        opts.push({ label: T('begleiter.entlassen', null, 'Danke, Hubi. Du kannst gehen.'), fn: () => this.endCompanion(scene) });
      } else if (!a.data.gassi) {
        const cost = B('ansehen.hubiHolenKosten', 5);
        opts.push({ label: T('begleiter.holen', { n: cost }, 'Hubi, kumm mit – mit Mascha! (−{n} Ansehen)'), fn: () => this.startCompanion(scene, true) });
      }
    }
    return opts;
  },

  startCompanion(scene, paid) {
    const h = scene.actors.hubi;
    // Läuft Hubi gerade Gassi? Dann bricht er den Spaziergang ab.
    if (h.data.gassi) { h.data.gassi = false; if (typeof Events !== 'undefined') Events.hubiGassiState = null; }
    if (paid) scene.addRep(-B('ansehen.hubiHolenKosten', 5), T('begleiter.gefallen', null, 'Gefallen'));
    G.companion = { until: G.minute + B('ansehen.hubiBegleitungMin', 60) };
    h.follow = scene.player; h.followDist = 20; h.override = null; h.path = null;
    scene.say(h, T('begleiter.ja', null, 'Passt. Mascha, bei Fuß!'));
    UI.setSpecialLabel(T('spezial.mascha', null, 'Mascha'));
  },

  endCompanion(scene) {
    const h = scene.actors.hubi;
    G.companion = null;
    if (h && h.follow === scene.player) { h.follow = null; h.path = null; h.idleUntil = 0; }
    UI.setSpecialLabel(T('spezial.' + G.figur, null, 'E'));
  },

  update(scene, dt) {
    const p = scene.player;
    const dMin = dt / (B('zeit.sekundenProStunde', 240) * 1000 / 60) * G.speed;
    // Herz-Symbol wieder weg
    for (const a of scene.npcs) if (a.extraIcon === 'ic_heart' && G.realMs > (a.data.heartUntil || 0)) a.extraIcon = null;
    if (p.extraIcon === 'ic_heart' && G.realMs > (p.data.heartUntil || 0)) p.extraIcon = null;

    // Begleiter-Hubi läuft ab
    if (G.companion && G.minute >= G.companion.until) {
      scene.say(scene.actors.hubi, T('begleiter.ende', null, 'I muss weiter. Mascha will hoam.'));
      this.endCompanion(scene);
    }
    // Versteinert + Mascha als Begleiter → automatisch gerettet
    if (p.state === 'stone' && G.figur !== 'hubi' && this.maschaWithPlayer(scene)) {
      if (!this.stoneRescueAt) this.stoneRescueAt = G.realMs + 2000;
      if (G.realMs > this.stoneRescueAt) { this.stoneRescueAt = 0; p.clearState(); Sfx.play('bark'); scene.say(p, T('mascha.selbst', null, 'Mascha schleckt dich ab. Du bist wieder da!')); }
    } else this.stoneRescueAt = 0;

    if (G.ended) return;
    // Andi: Hunger
    if (G.figur === 'andi') {
      const drain = 100 / (B('figuren.andi.hungerStunden', 3) * 60);
      G.hunger = Math.max(0, G.hunger - drain * dMin);
      if (G.hunger <= 0) {
        if (p.state === 'normal' || p.state === 'wet') {
          p.setState('grantig');
          UI.banner(T('spezialText.andiGrantig', null, 'Andi ist GRANTIG! Iss was (E), sonst verlierst du jede Minute Ansehen!'), 4000);
          Sfx.play('bad');
        }
        if (p.state === 'grantig') {
          this.grantigAcc += dMin;
          if (this.grantigAcc >= 1) {
            const n = Math.floor(this.grantigAcc);
            this.grantigAcc -= n;
            scene.addRep(-B('figuren.andi.grantigVerlustProMin', 5) * n, T('spezialText.grantigKurz', null, 'grantig'), { silent: G.rep <= 0 });
          }
        }
      }
    }
    // Carla: verliert Sachen
    if (G.figur === 'carla' && G.minute - this.lastLoss >= B('figuren.carla.verliertAlleMin', 45)) {
      this.lastLoss = G.minute;
      const keys = Object.keys(G.inv).filter(k => G.inv[k] > 0);
      if (keys.length) {
        const k = pick(keys);
        scene.takeItem(k);
        UI.banner(T('spezialText.carlaVerliert', { item: T('items.' + k, null, k) }, 'Hoppala! Carla hat was verloren: {item}'), 3500, 'info');
        Sfx.play('bad');
        if (typeof Quests !== 'undefined' && Quests.onItemLost) Quests.onItemLost(scene, k);
      }
    }
    // Markus: bleibt an Terminals hängen
    if (G.figur === 'markus' && p.state === 'normal' && p.moving && !UI.isBlocking()) {
      const t = this.nearTerminal(scene, 18);
      if (t && G.realMs > (this.termCd[t.shopId] || 0)) {
        this.termCd[t.shopId] = G.realMs + B('figuren.markus.terminalCooldownSek', 45) * 1000;
        p.setState('frozen', 0, B('figuren.markus.einfrierenSek', 5) * 1000);
        scene.say(p, T('spezialText.nurKurz', null, 'Nur kurz was checken…'), 4500);
        Sfx.play('type');
      }
    }
  }
};
