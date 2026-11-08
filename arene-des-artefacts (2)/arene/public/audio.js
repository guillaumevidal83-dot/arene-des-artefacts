// =====================================================================
//  L'ARÈNE DES ARTEFACTS — sons et musiques (générés, aucun fichier)
// =====================================================================
(() => {
'use strict';
const S = { music: true, sfx: true, vib: true, vol: 0.8 };
try { Object.assign(S, JSON.parse(localStorage.getItem('arene_set') || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem('arene_set', JSON.stringify(S)); } catch (e) {} };

let ac = null, master, sfxBus, musBus, noiseBuf;
function ctx() {
  if (ac) return ac;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  try { ac = new C(); } catch (e) { return null; }
  master = ac.createGain(); master.connect(ac.destination);
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6; comp.connect(master);
  sfxBus = ac.createGain(); sfxBus.connect(comp);
  musBus = ac.createGain(); musBus.connect(comp);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  apply();
  return ac;
}
function apply() {
  if (!ac) return;
  master.gain.value = S.vol;
  sfxBus.gain.value = S.sfx ? 0.9 : 0;
  musBus.gain.value = S.music ? 0.32 : 0;
}
// les navigateurs mobiles exigent un geste de l'utilisateur pour démarrer le son
function unlock() { const c = ctx(); if (c && c.state === 'suspended') c.resume(); }
['pointerdown', 'keydown', 'touchend'].forEach(ev => addEventListener(ev, unlock, { passive: true }));
document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });

// ---------------------------------------------------------- briques
function tone(f, d, o = {}) {
  const t = o.t != null ? o.t : ac.currentTime + (o.at || 0), osc = ac.createOscillator(), g = ac.createGain(), v = o.vol || 0.3;
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + d);
  if (o.det) osc.detune.value = o.det;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + (o.atk || 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  let out = g;
  if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; g.connect(fl); out = fl; }
  osc.connect(g); out.connect(o.bus || sfxBus);
  osc.start(t); osc.stop(t + d + 0.05);
}
function noise(d, o = {}) {
  const t = o.t != null ? o.t : ac.currentTime + (o.at || 0), src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(), v = o.vol || 0.3;
  src.buffer = noiseBuf;
  fl.type = o.ft || 'lowpass'; fl.frequency.setValueAtTime(o.f || 1200, t); fl.Q.value = o.q || 0.8;
  if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + (o.atk || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(fl); fl.connect(g); g.connect(o.bus || sfxBus);
  src.start(t, Math.random() * 0.5); src.stop(t + d + 0.05);
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------- effets sonores
const FX = {
  click: v => tone(900, 0.05, { type: 'square', vol: 0.08 * v, lp: 3000 }),
  swing: v => noise(0.14, { ft: 'bandpass', f: 2600, to: 500, q: 1.5, vol: 0.35 * v }),
  heavy: v => { noise(0.2, { ft: 'bandpass', f: 1400, to: 250, q: 1.2, vol: 0.45 * v }); tone(140, 0.15, { to: 60, vol: 0.25 * v }); },
  magic: v => { tone(620, 0.18, { to: 1300, type: 'triangle', vol: 0.12 * v }); tone(930, 0.14, { to: 1800, vol: 0.06 * v, at: 0.02 }); },
  fire: v => { noise(0.3, { f: 900, to: 300, vol: 0.3 * v }); tone(220, 0.25, { to: 90, type: 'sawtooth', vol: 0.06 * v, lp: 900 }); },
  arrow: v => { noise(0.08, { ft: 'highpass', f: 3000, vol: 0.18 * v }); tone(1400, 0.05, { to: 700, type: 'triangle', vol: 0.06 * v }); },
  gun: v => { noise(0.05, { ft: 'bandpass', f: 1800, q: 2, vol: 0.2 * v }); tone(300, 0.04, { type: 'square', vol: 0.05 * v, lp: 1500 }); },
  shuri: v => tone(2400, 0.1, { to: 1600, type: 'triangle', vol: 0.08 * v }),
  launch: v => { noise(0.35, { ft: 'bandpass', f: 600, to: 2400, q: 1, vol: 0.25 * v }); },
  bat: v => { tone(1800, 0.06, { to: 2600, type: 'square', vol: 0.04 * v, lp: 3500 }); tone(2100, 0.05, { to: 3000, type: 'square', vol: 0.03 * v, at: 0.07, lp: 3500 }); },
  spit: v => noise(0.15, { ft: 'bandpass', f: 1200, to: 400, q: 3, vol: 0.2 * v }),
  boom: v => { noise(0.7, { f: 1800, to: 80, vol: 0.6 * v }); tone(90, 0.5, { to: 35, vol: 0.5 * v }); },
  hit: v => { tone(180, 0.12, { to: 70, type: 'square', vol: 0.18 * v, lp: 800 }); noise(0.08, { f: 1500, vol: 0.2 * v }); },
  tick: v => noise(0.04, { ft: 'bandpass', f: 2000, q: 2, vol: 0.12 * v }),
  pick: v => { [0, 4, 7].forEach((n, i) => tone(mtof(84 + n), 0.18, { type: 'triangle', vol: 0.12 * v, at: i * 0.05 })); },
  crate: v => { [0, 7, 12, 16].forEach((n, i) => tone(mtof(79 + n), 0.22, { type: 'sine', vol: 0.12 * v, at: i * 0.06 })); },
  item: v => { tone(500, 0.08, { to: 900, type: 'triangle', vol: 0.12 * v }); noise(0.05, { ft: 'highpass', f: 2500, vol: 0.06 * v }); },
  heal: v => { tone(mtof(76), 0.35, { vol: 0.08 * v, atk: 0.04 }); tone(mtof(83), 0.4, { vol: 0.06 * v, atk: 0.06, at: 0.08 }); },
  shield: v => { tone(300, 0.4, { to: 600, type: 'triangle', vol: 0.12 * v }); tone(900, 0.3, { vol: 0.05 * v, at: 0.1 }); },
  whoosh: v => noise(0.35, { ft: 'bandpass', f: 400, to: 3000, q: 0.7, vol: 0.22 * v }),
  summon: v => { noise(0.4, { ft: 'bandpass', f: 300, to: 1200, vol: 0.18 * v }); tone(110, 0.4, { to: 220, type: 'sawtooth', vol: 0.05 * v, lp: 700 }); },
  roar: v => { noise(0.6, { f: 500, to: 150, vol: 0.45 * v }); tone(90, 0.5, { to: 60, type: 'sawtooth', vol: 0.12 * v, lp: 400 }); },
  zap: v => { for (let i = 0; i < 5; i++) noise(0.05, { ft: 'highpass', f: 2500 + Math.random() * 3000, vol: 0.25 * v, at: i * 0.04 }); tone(120, 0.3, { type: 'sawtooth', vol: 0.08 * v, lp: 2500 }); },
  chime: v => { [0, 4, 7, 12].forEach((n, i) => tone(mtof(81 + n), 0.5, { vol: 0.07 * v, at: i * 0.04 })); },
  snap: v => { noise(0.06, { ft: 'highpass', f: 3500, vol: 0.3 * v }); tone(200, 0.06, { type: 'square', vol: 0.1 * v }); },
  die: v => noise(0.25, { f: 800, to: 200, vol: 0.18 * v }),
  kill: v => { [0, 4, 7, 12].forEach((n, i) => tone(mtof(72 + n), 0.16, { type: 'square', vol: 0.06 * v, at: i * 0.07, lp: 2500 })); },
  death: v => { tone(400, 0.9, { to: 80, type: 'sawtooth', vol: 0.12 * v, lp: 1200 }); noise(0.5, { f: 600, to: 100, vol: 0.2 * v }); },
  spawn: v => tone(300, 0.3, { to: 900, type: 'triangle', vol: 0.1 * v }),
  evo: v => { [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(mtof(60 + n), 0.5, { type: 'triangle', vol: 0.1 * v, at: i * 0.07 })); noise(0.8, { ft: 'bandpass', f: 300, to: 5000, vol: 0.12 * v }); },
  ult: v => { [0, 7, 12, 19, 24, 31, 36].forEach((n, i) => tone(mtof(48 + n), 0.8, { type: 'sawtooth', vol: 0.06 * v, at: i * 0.08, lp: 3000 })); FX.zap(v); FX.boom(v * 0.6); },
  wave: v => { tone(mtof(55), 0.5, { type: 'sawtooth', vol: 0.12 * v, lp: 1200, atk: 0.05 }); tone(mtof(62), 0.7, { type: 'sawtooth', vol: 0.12 * v, lp: 1200, atk: 0.05, at: 0.35 }); },
  boss: v => { for (let i = 0; i < 3; i++) tone(70, 0.4, { to: 40, vol: 0.5 * v, at: i * 0.35 }); tone(mtof(43), 1.4, { type: 'sawtooth', vol: 0.12 * v, lp: 600, atk: 0.2 }); },
  win: v => { [0, 4, 7, 12].forEach((n, i) => tone(mtof(67 + n), 0.3, { type: 'triangle', vol: 0.12 * v, at: i * 0.1 })); tone(mtof(79), 0.8, { type: 'triangle', vol: 0.12 * v, at: 0.45 }); },
  lose: v => { [7, 3, 0, -5].forEach((n, i) => tone(mtof(60 + n), 0.4, { type: 'triangle', vol: 0.12 * v, at: i * 0.18 })); },
  start: v => { FX.wave(v); }
};
const last = {};
function play(name, v = 1) {
  if (!S.sfx || !FX[name] || v <= 0.02) return;
  const c = ctx(); if (!c || c.state !== 'running') return;
  const now = c.currentTime;
  if (last[name] && now - last[name] < 0.045) return; // évite les sons empilés
  last[name] = now;
  try { FX[name](Math.min(1, v)); } catch (e) {}
}

// ---------------------------------------------------------- musiques
// pas = croche ; 8 pas par mesure ; progression sur 4 mesures
const SC = { minP: [0, 3, 5, 7, 10], majP: [0, 2, 4, 7, 9], dor: [0, 2, 3, 5, 7, 9, 10], min: [0, 2, 3, 5, 7, 8, 10], hij: [0, 1, 4, 5, 7, 8, 10], whole: [0, 2, 4, 6, 8, 10], lyd: [0, 2, 4, 6, 7, 9, 11], phr: [0, 1, 3, 5, 7, 8, 10] };
const THEMES = {
  menu:    { bpm: 84,  root: 57, sc: SC.minP, prog: [0, 3, 2, 4], bass: [0, null, null, 0, null, null, 2, null], arp: [0, 2, 4, 5, 4, 2, 1, 2], lead: 'triangle', kick: 'x...x...', hat: '..x...x.', pad: 1 },
  colisee: { bpm: 112, root: 50, sc: SC.dor,  prog: [0, 3, 4, 0], bass: [0, null, 0, null, 0, 0, null, 4], arp: [7, null, 4, null, 7, 9, 7, 4], lead: 'sawtooth', kick: 'x..x..x.', snare: '....x..x', hat: 'x.x.x.x.' },
  jungle:  { bpm: 104, root: 52, sc: SC.majP, prog: [0, 3, 1, 4], bass: [0, null, null, 2, null, 0, null, null], arp: [5, 7, 6, 5, 7, 8, 7, 5], lead: 'sine', short: 1, kick: 'x..x.x..', snare: '......x.', hat: 'x.xxx.xx' },
  urbain:  { bpm: 120, root: 45, sc: SC.min,  prog: [0, 5, 3, 6], bass: [0, 0, null, 0, null, 0, 7, null], arp: [7, null, 9, 7, null, 11, 9, null], lead: 'square', kick: 'x...x...', snare: '....x...', hat: 'xxxxxxxx' },
  desert:  { bpm: 96,  root: 50, sc: SC.hij,  prog: [0, 0, 1, 0], bass: [0, null, null, 0, 0, null, null, null], arp: [7, 8, 9, 8, 7, null, 6, 5], lead: 'triangle', kick: 'x..x..x.', snare: '...x....', hat: '..x..x..' },
  espace:  { bpm: 72,  root: 48, sc: SC.whole, prog: [0, 1, 2, 1], bass: [0, null, null, null, null, null, null, null], arp: [6, null, 8, null, 7, null, 9, null], lead: 'sine', kick: 'x.......', pad: 1 },
  glace:   { bpm: 80,  root: 60, sc: SC.lyd,  prog: [0, 1, 0, 4], bass: [0, null, null, null, 4, null, null, null], arp: [7, 11, 9, 14, 11, 9, 7, null], lead: 'sine', short: 1, hat: '....x...', pad: 1 },
  dinos:   { bpm: 100, root: 43, sc: SC.minP, prog: [0, 0, 3, 2], bass: [0, null, 0, null, null, 0, null, 3], arp: [5, null, null, 7, null, 6, null, null], lead: 'sawtooth', kick: 'x.x..x..', snare: '....x..x', hat: 'x..x..x.' },
  apo:     { bpm: 88,  root: 45, sc: SC.phr,  prog: [0, 1, 0, 5], bass: [0, null, null, null, 0, null, 1, null], arp: [7, null, 8, null, 7, null, 5, null], lead: 'triangle', kick: 'x.....x.', snare: '....x...', hat: '..x...x.', pad: 1 }
};
let cur = null, step = 0, nextT = 0, timer = null;
const note = (th, deg) => { const n = th.sc.length; return th.root + th.sc[((deg % n) + n) % n] + 12 * Math.floor(deg / n); };
function playStep(th, st, t) {
  const sd = 60 / th.bpm / 2, bar = Math.floor(st / 8) % 4, s8 = st % 8, sh = th.prog[bar], bus = musBus;
  const b = th.bass[s8]; if (b != null) tone(mtof(note(th, sh + b) - 12), sd * 1.7, { type: 'triangle', vol: 0.16, t, bus, lp: 700 });
  const a = th.arp[s8]; if (a != null) tone(mtof(note(th, sh + a)), sd * (th.short ? 0.6 : 0.95), { type: th.lead, vol: th.lead === 'sine' ? 0.08 : 0.045, t, bus, lp: 2600, atk: 0.01 });
  if (th.pad && s8 === 0) [0, 2, 4].forEach(k => tone(mtof(note(th, sh + k)), sd * 8, { type: 'sine', vol: 0.025, t, bus, atk: 0.4 }));
  if (th.kick && th.kick[s8] === 'x') tone(120, 0.2, { to: 42, vol: 0.32, t, bus });
  if (th.snare && th.snare[s8] === 'x') noise(0.14, { ft: 'bandpass', f: 1800, q: 0.7, vol: 0.1, t, bus });
  if (th.hat && th.hat[s8] === 'x') noise(0.03, { ft: 'highpass', f: 7000, vol: 0.04, t, bus });
}
function tick() {
  if (!ac || !cur || !S.music || ac.state !== 'running') return;
  const th = THEMES[cur]; if (!th) return;
  const sd = 60 / th.bpm / 2;
  if (nextT < ac.currentTime - 0.3) nextT = ac.currentTime + 0.05;
  while (nextT < ac.currentTime + 0.25) { playStep(th, step, nextT); nextT += sd; step++; }
}
function music(name) {
  if (cur === name) return;
  cur = name; step = 0; nextT = 0;
  if (!timer) timer = setInterval(tick, 40);
}

// ---------------------------------------------------------- vibrations + réglages
function vib(p) { try { if (S.vib && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
function set(k, v) { S[k] = v; save(); ctx(); apply(); }

window.SND = { play, music, vib, set, settings: S };
})();
