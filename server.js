'use strict';
// =====================================================================
//  L'ARÈNE DES ARTEFACTS — serveur de jeu (Node.js, aucune dépendance)
// =====================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const MAX_PLAYERS = 6;
const TICK = 60;            // simulations par seconde
const SEND_EVERY = 3;       // => 20 envois par seconde
const DT = 1 / TICK;
// options de test (laisser vides en production)
const TEST_ARTS = +process.env.TEST_ARTS || 0, TEST_DURATION = +process.env.TEST_DURATION || 0, TEST_WAVE = +process.env.TEST_WAVE || 0;

// ---------------------------------------------------------------- HTTP
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};
const server = http.createServer((req, res) => {
  let u = '/';
  try { u = decodeURIComponent(req.url.split('?')[0]); } catch (e) {}
  if (u === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (u === '/api/rooms') {
    const list = [...rooms.values()].map(r => {
      const host = r.players.get(r.host);
      return {
        code: r.id, host: host ? host.name : '?', players: r.players.size, max: MAX_PLAYERS,
        state: r.state, map: r.cfg.map, teams: r.cfg.teams, duration: r.cfg.duration, survival: r.cfg.survival, lives: r.cfg.lives,
        wave: r.state === 'playing' && r.cfg.survival ? r.wave : null,
        left: r.state === 'playing' && !r.cfg.survival ? Math.max(0, Math.ceil(r.endAt - r.t)) : null
      };
    }).sort((a, b) => (a.state === 'lobby' ? 0 : 1) - (b.state === 'lobby' ? 0 : 1) || b.players - a.players);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(list));
  }
  if (u === '/') u = '/index.html';
  const f = path.normalize(path.join(PUB, u));
  if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ----------------------------------------------------------- WebSocket
class Conn {
  constructor(sock) {
    this.s = sock; this.buf = Buffer.alloc(0); this.frag = []; this.open = true; this.alive = true;
    sock.on('data', d => { this.buf = Buffer.concat([this.buf, d]); this.parse(); });
    sock.on('close', () => this.close());
    sock.on('error', () => this.close());
  }
  parse() {
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 65536) { this.close(); return; }
      const ml = masked ? 4 : 0;
      if (this.buf.length < off + ml + len) return;
      let payload = Buffer.from(this.buf.subarray(off + ml, off + ml + len));
      if (masked) { const m = this.buf.subarray(off, off + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      this.buf = this.buf.subarray(off + ml + len);
      this.alive = true;
      if (op === 8) { this.close(); return; }
      if (op === 9) { this.frame(10, payload); continue; }
      if (op === 10) continue;
      this.frag.push(payload);
      if (fin) {
        const msg = Buffer.concat(this.frag).toString('utf8'); this.frag = [];
        if (this.onmsg) { try { this.onmsg(msg); } catch (e) { console.error('Erreur message :', e); } }
      }
    }
  }
  frame(op, data) {
    if (!this.open) return;
    const len = data.length; let h;
    if (len < 126) h = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); }
    else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); }
    try { this.s.write(Buffer.concat([h, data])); } catch (e) {}
  }
  send(o) { this.frame(1, Buffer.from(JSON.stringify(o))); }
  sendRaw(buf) { if (this.s.writableLength < 512 * 1024) this.frame(1, buf); }
  close() {
    if (!this.open) return; this.open = false;
    try { this.s.end(); this.s.destroy(); } catch (e) {}
    if (this.onclose) this.onclose();
  }
}
const conns = new Set();
server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const c = new Conn(sock); conns.add(c);
  onConnect(c);
});
// battement de cœur : coupe les connexions mortes
setInterval(() => {
  for (const c of conns) {
    if (!c.open) { conns.delete(c); continue; }
    if (!c.alive) { c.close(); conns.delete(c); continue; }
    c.alive = false; c.frame(9, Buffer.alloc(0));
  }
}, 25000);

// --------------------------------------------------------------- Outils
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const r0 = Math.round;
const r2 = v => Math.round(v * 100) / 100;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let uid = 1;     // identifiants des personnages (joueurs + PNJ)
let pid = 1;     // identifiants des projectiles / artefacts

// --------------------------------------------------------- Personnages
const CLS = {
  mage:      { hp: 90,  spd: 215, r: 18, item: 'ice' },
  barbare:   { hp: 150, spd: 195, r: 20, item: 'barr' },
  ninja:     { hp: 105, spd: 245, r: 17, item: 'mine' },
  archer:    { hp: 85,  spd: 235, r: 17, item: 'trap' },
  paladin:   { hp: 140, spd: 200, r: 19, item: 'gpotion' },
  ingenieur: { hp: 95,  spd: 210, r: 18, item: 'elec' },
  druide:    { hp: 110, spd: 205, r: 18, item: 'shroom' },
  vampire:   { hp: 105, spd: 225, r: 18, item: 'vial' }
};
// deux évolutions au choix par classe
const EVO = {
  mage: ['liche', 'elementaire'], barbare: ['golem', 'minotaure'], ninja: ['serpent', 'kitsune'],
  archer: ['phenix', 'sylphe'], paladin: ['archange', 'noir'], ingenieur: ['mecha', 'essaim'],
  druide: ['ent', 'loupgarou'], vampire: ['seigneur', 'gargouille']
};
const FORM_SPD = { golem: 0.88, ent: 0.85, mecha: 0.85, minotaure: 0.95, sylphe: 1.12, loupgarou: 1.15, kitsune: 1.05 };
const ITEM_MAX = 3, ITEM_CD = 12;
const BONUS = ['mine', 'barr', 'potion', 'bomb', 'haste', 'armor'];
const EVO_HP = 1.5, EVO_DMG = 1.3, EVO_AT = 10;
// évolution ultime
const ULT_AT = 50, ULT_HP = 2.0, ULT_DMG = 1.6, ULT_REGEN = 0.01;

const MOBS = {
  gladiateur: { hp: 70, spd: 120, r: 18, dmg: 10, range: 48,  cd: 1.0, melee: true },
  lion:       { hp: 50, spd: 175, r: 17, dmg: 8,  range: 44,  cd: 0.8, melee: true },
  jaguar:     { hp: 50, spd: 180, r: 16, dmg: 8,  range: 44,  cd: 0.8, melee: true },
  guerrier:   { hp: 60, spd: 110, r: 17, dmg: 9,  range: 380, cd: 1.6, melee: false, proj: 'spear' },
  voyou:      { hp: 60, spd: 130, r: 17, dmg: 9,  range: 46,  cd: 0.9, melee: true },
  drone:      { hp: 40, spd: 150, r: 14, dmg: 7,  range: 400, cd: 1.3, melee: false, proj: 'laser' },
  squelette:  { hp: 35, spd: 175, r: 15, dmg: 8,  range: 44,  cd: 0.8, melee: true },
  tourelle:   { hp: 70, spd: 0,   r: 16, dmg: 8,  range: 460, cd: 0.55, melee: false, proj: 'rivet' },
  minidrone:  { hp: 30, spd: 190, r: 12, dmg: 7,  range: 380, cd: 0.8, melee: false, proj: 'laser' },
  clone:      { hp: 40, spd: 230, r: 16, dmg: 11, range: 46,  cd: 0.5, melee: true },
  scorpion:   { hp: 55, spd: 150, r: 16, dmg: 9,  range: 44,  cd: 0.9, melee: true },
  nomade:     { hp: 55, spd: 115, r: 17, dmg: 8,  range: 380, cd: 1.5, melee: false, proj: 'arrow' },
  alien:      { hp: 55, spd: 165, r: 16, dmg: 9,  range: 44,  cd: 0.85, melee: true },
  sentinelle: { hp: 50, spd: 120, r: 15, dmg: 8,  range: 420, cd: 1.4, melee: false, proj: 'plasma' },
  loup:       { hp: 50, spd: 185, r: 16, dmg: 8,  range: 44,  cd: 0.8, melee: true },
  yeti:       { hp: 110, spd: 100, r: 24, dmg: 16, range: 54, cd: 1.4, melee: true },
  raptor:     { hp: 45,  spd: 200, r: 15, dmg: 8,  range: 44,  cd: 0.7, melee: true },
  dilopho:    { hp: 55,  spd: 120, r: 17, dmg: 8,  range: 360, cd: 1.5, melee: false, proj: 'acid' },
  trex:       { hp: 160, spd: 105, r: 30, dmg: 20, range: 66,  cd: 1.6, melee: true },
  zombie:     { hp: 60,  spd: 85,  r: 16, dmg: 10, range: 44,  cd: 1.1, melee: true },
  coureur:    { hp: 35,  spd: 195, r: 15, dmg: 7,  range: 42,  cd: 0.7, melee: true },
  tank:       { hp: 170, spd: 70,  r: 27, dmg: 18, range: 60,  cd: 1.6, melee: true }
};

// ---------------------------------------------------------------- Cartes
const MAP_W = 2200, MAP_H = 1500;
const MAP_MOBS = {
  colisee: ['gladiateur', 'lion'], jungle: ['jaguar', 'guerrier'], urbain: ['voyou', 'drone'],
  desert: ['scorpion', 'nomade'], espace: ['alien', 'sentinelle'], glace: ['loup', 'yeti'],
  dinos: ['raptor', 'raptor', 'dilopho', 'trex'], apo: ['zombie', 'zombie', 'coureur', 'tank']
};
const MAP_KEYS = Object.keys(MAP_MOBS);
function buildMap(key) {
  const W = MAP_W, H = MAP_H, R = seeded({ colisee: 3, jungle: 7, urbain: 13, desert: 21, espace: 34, glace: 55, dinos: 89, apo: 144 }[key] || 1), obs = [], haz = [];
  const hazFree = (x, y, r) => haz.every(h => Math.hypot(h.x - x, h.y - y) > h.r + r + 60) && !blocked({ w: W, h: H, obs }, x, y, r * 0.6);
  const okFar = (x, y, r, gap) => obs.every(o => o.t === 'c' ? Math.hypot(o.x - x, o.y - y) > o.r + r + gap
    : !(x > o.x - r - gap && x < o.x + o.w + r + gap && y > o.y - r - gap && y < o.y + o.h + r + gap));
  if (key === 'colisee') {
    const cx = W / 2, cy = H / 2;
    // gradins dans les coins (forme ovale de l'arène)
    obs.push({ t: 'r', x: 0, y: 0, w: 330, h: 230 }, { t: 'r', x: W - 330, y: 0, w: 330, h: 230 },
      { t: 'r', x: 0, y: H - 230, w: 330, h: 230 }, { t: 'r', x: W - 330, y: H - 230, w: 330, h: 230 });
    obs.push({ t: 'c', x: cx, y: cy, r: 72 });  // statue centrale
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; obs.push({ t: 'c', x: cx + Math.cos(a) * 790, y: cy + Math.sin(a) * 530, r: 36 }); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5; obs.push({ t: 'c', x: cx + Math.cos(a) * 410, y: cy + Math.sin(a) * 280, r: 28 }); }
    obs.push({ t: 'r', x: cx - 260, y: cy - 440, w: 170, h: 28 }, { t: 'r', x: cx + 90, y: cy + 412, w: 170, h: 28 },
      { t: 'r', x: cx - 590, y: cy + 50, w: 28, h: 160 }, { t: 'r', x: cx + 562, y: cy - 210, w: 28, h: 160 });
  } else if (key === 'jungle') {
    for (let i = 0, n = 0; i < 600 && n < 7; i++) {
      const w = 60 + R() * 70, h = 50 + R() * 50, x = 100 + R() * (W - 300), y = 100 + R() * (H - 250);
      if (okFar(x + w / 2, y + h / 2, Math.max(w, h) / 2, 140)) { obs.push({ t: 'r', x, y, w, h }); n++; }
    }
    for (let i = 0, n = 0; i < 3000 && n < 48; i++) {
      const r = 28 + R() * 28, x = 60 + R() * (W - 120), y = 60 + R() * (H - 120);
      if (okFar(x, y, r, 85)) { obs.push({ t: 'c', x, y, r }); n++; }
    }
  } else if (key === 'desert') {
    // mesas de grès
    for (let i = 0, n = 0; i < 800 && n < 8; i++) {
      const w = 110 + R() * 120, h = 80 + R() * 90, x = 80 + R() * (W - 330), y = 80 + R() * (H - 260);
      if (okFar(x + w / 2, y + h / 2, Math.max(w, h) / 2, 150)) { obs.push({ t: 'r', x, y, w, h, mesa: 1 }); n++; }
    }
    // cactus
    for (let i = 0, n = 0; i < 3000 && n < 24; i++) {
      const r = 14 + R() * 6, x = 60 + R() * (W - 120), y = 60 + R() * (H - 120);
      if (okFar(x, y, r, 110)) { obs.push({ t: 'c', x, y, r, cactus: 1 }); n++; }
    }
    // sables mouvants (ralentissent)
    for (let i = 0, n = 0; i < 3000 && n < 8; i++) {
      const r = 85 + R() * 70, x = 150 + R() * (W - 300), y = 150 + R() * (H - 300);
      if (hazFree(x, y, r)) { haz.push({ t: 'sand', x: Math.round(x), y: Math.round(y), r: Math.round(r) }); n++; }
    }
  } else if (key === 'espace') {
    // modules de station
    const mods = [[260, 220, 260, 120], [W - 520, 230, 260, 120], [260, H - 340, 120, 220], [W - 380, H - 420, 120, 240], [W / 2 - 150, H / 2 - 60, 300, 120]];
    for (const [x, y, w, h] of mods) obs.push({ t: 'r', x, y, w, h, mod: 1 });
    // astéroïdes
    for (let i = 0, n = 0; i < 3000 && n < 30; i++) {
      const r = 24 + R() * 40, x = 60 + R() * (W - 120), y = 60 + R() * (H - 120);
      if (okFar(x, y, r, 95)) { obs.push({ t: 'c', x, y, r, rock: 1 }); n++; }
    }
  } else if (key === 'glace') {
    // blocs de glace
    for (let i = 0, n = 0; i < 800 && n < 9; i++) {
      const w = 80 + R() * 90, h = 60 + R() * 70, x = 80 + R() * (W - 260), y = 80 + R() * (H - 220);
      if (okFar(x + w / 2, y + h / 2, Math.max(w, h) / 2, 140)) { obs.push({ t: 'r', x, y, w, h, ice: 1 }); n++; }
    }
    // sapins enneigés
    for (let i = 0, n = 0; i < 3000 && n < 30; i++) {
      const r = 24 + R() * 18, x = 60 + R() * (W - 120), y = 60 + R() * (H - 120);
      if (okFar(x, y, r, 90)) { obs.push({ t: 'c', x, y, r, pine: 1 }); n++; }
    }
    // geysers (blessent quand ils jaillissent)
    for (let i = 0, n = 0; i < 3000 && n < 9; i++) {
      const r = 62, x = 150 + R() * (W - 300), y = 150 + R() * (H - 300);
      if (hazFree(x, y, r)) { haz.push({ t: 'geyser', x: Math.round(x), y: Math.round(y), r, ph: Math.round(R() * 50) / 10 }); n++; }
    }
  } else if (key === 'dinos') {
    // gros rochers volcaniques
    for (let i = 0, n = 0; i < 3000 && n < 14; i++) {
      const r = 40 + R() * 40, x = 80 + R() * (W - 160), y = 80 + R() * (H - 160);
      if (okFar(x, y, r, 130)) { obs.push({ t: 'c', x, y, r, boulder: 1 }); n++; }
    }
    // fougères géantes
    for (let i = 0, n = 0; i < 3000 && n < 30; i++) {
      const r = 22 + R() * 22, x = 60 + R() * (W - 120), y = 60 + R() * (H - 120);
      if (okFar(x, y, r, 85)) { obs.push({ t: 'c', x, y, r, fern: 1 }); n++; }
    }
    // squelette de dino géant
    if (okFar(W / 2, H / 2, 140, 20)) obs.push({ t: 'r', x: W / 2 - 130, y: H / 2 - 20, w: 260, h: 40, bones: 1 });
  } else if (key === 'apo') {
    // immeubles en ruine
    for (let i = 0, n = 0; i < 800 && n < 9; i++) {
      const w = 130 + R() * 130, h = 110 + R() * 110, x = 80 + R() * (W - 360), y = 80 + R() * (H - 300);
      if (okFar(x + w / 2, y + h / 2, Math.max(w, h) / 2, 150)) { obs.push({ t: 'r', x, y, w, h, ruin: 1, seed: n }); n++; }
    }
    // épaves de voitures
    for (let i = 0, n = 0; i < 2000 && n < 12; i++) {
      const hor = R() < 0.5, w = hor ? 78 : 38, h = hor ? 38 : 78, x = 40 + R() * (W - 120), y = 40 + R() * (H - 120);
      if (okFar(x + w / 2, y + h / 2, 42, 50)) { obs.push({ t: 'r', x, y, w, h, wreck: 1 }); n++; }
    }
    // barils
    for (let i = 0, n = 0; i < 2000 && n < 14; i++) {
      const r = 15, x = 60 + R() * (W - 120), y = 60 + R() * (H - 120);
      if (okFar(x, y, r, 80)) { obs.push({ t: 'c', x, y, r, barrel: 1 }); n++; }
    }
  } else { // urbain
    const st = 180, bw = (W - 5 * st) / 4, bh = (H - 4 * st) / 3;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const x = st + i * (bw + st), y = st + j * (bh + st);
      if ((i + j) % 2 === 0) { obs.push({ t: 'r', x, y, w: bw, h: bh }); }
      else { const g = 60, a = (bw - g) / 2; obs.push({ t: 'r', x, y, w: a, h: bh }, { t: 'r', x: x + a + g, y, w: a, h: bh }); }
    }
    for (let i = 0, n = 0; i < 2000 && n < 16; i++) {
      const hor = R() < 0.5, w = hor ? 76 : 36, h = hor ? 36 : 76, x = 40 + R() * (W - 120), y = 40 + R() * (H - 120);
      if (okFar(x + w / 2, y + h / 2, 40, 45)) { obs.push({ t: 'r', x, y, w, h, car: 1 + (n % 5) }); n++; }
    }
  }
  return { key, w: W, h: H, obs, haz };
}
function blocked(map, x, y, r) {
  if (x < r || y < r || x > map.w - r || y > map.h - r) return true;
  for (const o of map.obs) {
    if (o.t === 'c') { if (Math.hypot(x - o.x, y - o.y) < o.r + r) return true; }
    else if (x > o.x - r && x < o.x + o.w + r && y > o.y - r && y < o.y + o.h + r) {
      const nx = clamp(x, o.x, o.x + o.w), ny = clamp(y, o.y, o.y + o.h);
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
    }
  }
  return false;
}
function collide(e, map) {
  for (const o of map.obs) {
    if (o.t === 'c') {
      const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), m = e.r + o.r;
      if (d < m) { if (d < 0.01) { e.x += m; } else { e.x = o.x + dx / d * m; e.y = o.y + dy / d * m; } }
    } else {
      const nx = clamp(e.x, o.x, o.x + o.w), ny = clamp(e.y, o.y, o.y + o.h);
      const dx = e.x - nx, dy = e.y - ny, d2 = dx * dx + dy * dy;
      if (d2 < e.r * e.r) {
        if (d2 > 0.0001) { const d = Math.sqrt(d2); e.x = nx + dx / d * e.r; e.y = ny + dy / d * e.r; }
        else {
          const l = e.x - o.x, rr = o.x + o.w - e.x, t = e.y - o.y, b = o.y + o.h - e.y, m = Math.min(l, rr, t, b);
          if (m === l) e.x = o.x - e.r; else if (m === rr) e.x = o.x + o.w + e.r; else if (m === t) e.y = o.y - e.r; else e.y = o.y + o.h + e.r;
        }
      }
    }
  }
  e.x = clamp(e.x, e.r, map.w - e.r); e.y = clamp(e.y, e.r, map.h - e.r);
}
function freeSpot(map, r, accept) {
  for (let i = 0; i < 300; i++) {
    const x = rnd(r + 20, map.w - r - 20), y = rnd(r + 20, map.h - r - 20);
    if (!blocked(map, x, y, r + 6) && (!accept || i > 220 || accept(x, y))) return { x, y };
  }
  return { x: map.w / 2, y: map.h / 2 - 150 };
}

const GEYSER = { isMob: true, type: 'geyser', owner: null, dead: false, hp: null };

// ---------------------------------------------------------------- Salons
const rooms = new Map();
function roomCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s;
  do { s = ''; for (let i = 0; i < 5; i++) s += A[Math.random() * A.length | 0]; } while (rooms.has(s));
  return s;
}
function cleanCfg(c, prev) {
  c = c || {}; const p = prev || { map: 'colisee', duration: 10, score: 0, teams: false, survival: false, lives: 3 };
  const o = {
    map: MAP_KEYS.includes(c.map) ? c.map : p.map,
    duration: [3, 5, 10, 15].includes(+c.duration) ? +c.duration : p.duration,
    score: [0, 10, 20, 30].includes(+c.score) ? +c.score : p.score,
    teams: typeof c.teams === 'boolean' ? c.teams : p.teams,
    survival: typeof c.survival === 'boolean' ? c.survival : !!p.survival,
    lives: [1, 3, 5, 10].includes(+c.lives) ? +c.lives : (p.lives || 3)
  };
  if (o.survival) o.teams = false;
  return o;
}
const cleanName = n => (String(n || '').replace(/[<>]/g, '').trim().slice(0, 14)) || 'Joueur';
const cleanCls = c => Object.prototype.hasOwnProperty.call(CLS, c) ? c : 'mage';
// distance d'un point à un segment
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
  const k = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1), cx = x1 + dx * k, cy = y1 + dy * k;
  return { d: Math.hypot(px - cx, py - cy), cx, cy };
}

class Room {
  constructor(cfg) {
    this.id = roomCode(); this.cfg = cleanCfg(cfg); this.players = new Map();
    this.state = 'lobby'; this.host = null; this.events = []; this.tick = 0;
    rooms.set(this.id, this);
  }
  // ---------- réseau
  broadcast(o) { const b = Buffer.from(JSON.stringify(o)); for (const p of this.players.values()) p.conn.sendRaw(b); }
  roster() {
    this.broadcast({
      t: 'roster', host: this.host, state: this.state, cfg: this.cfg, ts: this.teamScore || [0, 0],
      players: [...this.players.values()].map(p => ({ id: p.id, name: p.name, cls: p.cls, team: p.team, kills: p.kills, deaths: p.deaths, dc: p.disconnected ? 1 : 0 }))
    });
    this.rosterDirty = false;
  }
  ev(e) { this.events.push(e); }
  mapInfo() { return { key: this.map.key, w: this.map.w, h: this.map.h, obs: this.map.obs, haz: this.map.haz }; }
  welcome(p) {
    const c = p.conn;
    c.send({ t: 'joined', id: p.id, room: this.id, host: this.host, state: this.state, cfg: this.cfg, token: p.token });
    if (this.state === 'playing') c.send({ t: 'start', map: this.mapInfo(), cfg: this.cfg });
    if (this.state === 'ended' && this.lastEnd) c.send(this.lastEnd);
    if (this.paused) c.send({ t: 'pause', on: 1 });
  }
  // connexion coupée (appli en arrière-plan, partage du lien…) : on garde la place 45 s
  setPause(on) {
    on = !!on && this.state === 'playing';
    if (on === !!this.paused) return;
    this.paused = on; this.broadcast({ t: 'pause', on: on ? 1 : 0 });
  }
  disconnect(p) {
    if (p.id === this.host) this.setPause(false);
    if (!this.players.has(p.id)) return;
    p.disconnected = true; p.in = { mx: 0, my: 0, a: null, b: 0 };
    clearTimeout(p.dropTimer);
    p.dropTimer = setTimeout(() => { if (p.disconnected && this.players.get(p.id) === p) this.removePlayer(p); }, 45000);
    this.roster();
  }
  resume(p, conn) {
    if (p.conn && p.conn !== conn) { p.conn.onclose = null; p.conn.close(); }
    clearTimeout(p.dropTimer); p.disconnected = false;
    p.conn = conn; conn.room = this; conn.p = p;
    this.welcome(p); this.roster();
  }

  // ---------- joueurs
  addPlayer(conn, name, cls) {
    const p = {
      id: uid++, name: cleanName(name), cls: cleanCls(cls), conn, team: 0, kills: 0, deaths: 0, artifacts: 0,
      evolved: false, alive: false, x: 0, y: 0, r: 18, face: 0, hp: 1, maxHp: 1, cd: [0, 0, 0],
      in: { mx: 0, my: 0, a: null, b: 0 }, respawnAt: 0, token: crypto.randomBytes(12).toString('hex')
    };
    p.team = this.smallerTeam(p);
    this.players.set(p.id, p);
    if (this.host == null) this.host = p.id;
    conn.room = this; conn.p = p;
    if (this.state === 'playing') { this.resetHero(p); p.lives = this.cfg.lives; this.spawnPlayer(p); }
    this.welcome(p);
    this.roster();
  }
  removePlayer(p) {
    clearTimeout(p.dropTimer);
    if (p.id === this.host) this.setPause(false);
    if (!this.players.has(p.id)) return;
    this.players.delete(p.id);
    if (this.players.size === 0) { rooms.delete(this.id); return; }
    if (this.host === p.id) {
      const next = [...this.players.values()].find(q => !q.disconnected) || this.players.values().next().value;
      this.host = next.id;
    }
    if (this.mobs) this.mobs = this.mobs.filter(m => m.owner !== p.id);
    if (this.traps) this.traps = this.traps.filter(x => x.owner !== p.id);
    if (this.walls) this.walls = this.walls.filter(x => x.owner !== p.id);
    this.ev({ k: 'left', n: p.name });
    this.roster();
  }
  smallerTeam(except) {
    if (!this.cfg.teams) return 0;
    const c = [0, 0]; for (const q of this.players.values()) if (q !== except) c[q.team]++;
    return c[0] <= c[1] ? 0 : 1;
  }
  teamKey(e) {
    if (e.isMob) return e.tk;
    if (this.cfg.survival) return 'coop';
    return this.cfg.teams ? 't' + e.team : 'p' + e.id;
  }
  form(p) { return p.evolved ? EVO[p.cls][p.evoPick] : p.cls; }
  resetHero(p) {
    const c = CLS[p.cls];
    p.artifacts = TEST_ARTS; p.evolved = false; p.ultimate = false; p.evoPick = null; p.needPick = false;
    p.r = c.r; p.maxHp = c.hp; p.hp = c.hp; p.cd = [0, 0, 0];
    p.items = ITEM_MAX; p.itemNext = 0; p.bonus = null;
    this.clearBuffs(p);
  }
  clearBuffs(p) {
    p.invisUntil = p.shieldUntil = p.stunUntil = p.rootUntil = p.invulnUntil = 0;
    p.hasteUntil = p.rageUntil = p.armorUntil = p.rebirthUntil = 0;
    p.poison = p.constrict = p.dash = p.whirl = null;
  }
  spawnPlayer(p) {
    let s;
    if (this.cfg.survival) {
      // en survie : réapparition près d'un coéquipier, loin des monstres
      const mate = [...this.players.values()].find(q => q !== p && q.alive);
      const mobs = this.mobs || [];
      s = freeSpot(this.map, p.r, (x, y) => mobs.every(m => Math.hypot(m.x - x, m.y - y) > 380) && (!mate || Math.hypot(mate.x - x, mate.y - y) < 500));
    } else {
      const others = [...this.players.values()].filter(q => q !== p && q.alive && this.teamKey(q) !== this.teamKey(p));
      s = freeSpot(this.map, p.r, (x, y) => others.every(q => Math.hypot(q.x - x, q.y - y) > 450));
    }
    p.x = s.x; p.y = s.y; p.alive = true; p.hp = p.maxHp;
    this.clearBuffs(p); p.invulnUntil = this.t + 1.5; p.lastHit = null;
    this.ev({ k: 'spawn', i: p.id, x: r0(p.x), y: r0(p.y) });
  }
  updEvo(p) {
    p.needPick = p.artifacts >= EVO_AT && p.evoPick == null;
    const evo = p.artifacts >= EVO_AT && p.evoPick != null, ult = evo && p.artifacts >= ULT_AT;
    if (evo === p.evolved && ult === !!p.ultimate) return;
    const c = CLS[p.cls], wasEvo = p.evolved, wasUlt = !!p.ultimate;
    p.evolved = evo; p.ultimate = ult;
    p.maxHp = Math.round(c.hp * (ult ? ULT_HP : evo ? EVO_HP : 1));
    p.r = c.r + (ult ? 14 : evo ? 8 : 0);
    if ((evo && !wasEvo) || (ult && !wasUlt)) p.hp = p.maxHp; else p.hp = Math.min(p.hp, p.maxHp);
    if (p.alive) collide(p, this.map);
    if (evo !== wasEvo) this.ev({ k: 'evo', i: p.id, on: evo ? 1 : 0, f: EVO[p.cls][p.evoPick] || '', x: r0(p.x), y: r0(p.y) });
    if (ult !== wasUlt) this.ev({ k: 'ult', i: p.id, on: ult ? 1 : 0, x: r0(p.x), y: r0(p.y) });
  }

  // ---------- partie
  start() {
    this.state = 'playing'; this.map = buildMap(this.cfg.map); this.t = 0;
    this.endAt = this.cfg.survival ? Infinity : (TEST_DURATION || this.cfg.duration * 60);
    this.wave = TEST_WAVE; this.waveState = 'break'; this.nextWaveAt = 4; this.waveQueue = 0; this.waveSpawnAt = 0; this.bossDone = true;
    this.mobs = []; this.proj = []; this.arts = []; this.events = []; this.teamScore = [0, 0];
    this.zones = []; this.traps = []; this.walls = []; this.crates = []; this.crateTimer = 12;
    this.artTimer = 0; this.mobRespawn = []; this.tick = 0;
    const list = [...this.players.values()];
    // équipes : on garde le choix des joueurs, sauf si une équipe est vide
    if (this.cfg.teams && list.length > 1 && (list.every(p => p.team === 0) || list.every(p => p.team === 1))) {
      list.sort(() => Math.random() - 0.5).forEach((p, i) => { p.team = i % 2; });
    }
    list.forEach(p => { if (!this.cfg.teams) p.team = 0; p.kills = 0; p.deaths = 0; p.lives = this.cfg.lives; this.resetHero(p); });
    for (const p of list) { this.spawnPlayer(p); this.updEvo(p); }
    if (!this.cfg.survival) for (let i = 0; i < 9; i++) this.spawnMob();
    for (let i = 0; i < 3; i++) this.spawnArt();
    this.broadcast({ t: 'start', map: this.mapInfo(), cfg: this.cfg });
    this.roster();
  }
  end() {
    this.paused = false;
    this.state = 'ended';
    const ranking = [...this.players.values()].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
      .map(p => ({ id: p.id, name: p.name, cls: p.cls, team: p.team, kills: p.kills, deaths: p.deaths }));
    this.lastEnd = { t: 'end', ranking, ts: this.teamScore, teams: this.cfg.teams, survival: this.cfg.survival, wave: this.wave };
    this.broadcast(this.lastEnd);
    this.roster();
  }
  backToLobby() {
    this.state = 'lobby'; this.mobs = []; this.proj = []; this.arts = []; this.zones = []; this.traps = []; this.walls = []; this.crates = [];
    for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; p.alive = false; }
    this.roster();
  }
  spawnMob(owner, x, y, wave, otype) {
    let type, d;
    if (owner) { type = otype || 'squelette'; }
    else { const l = MAP_MOBS[this.map.key]; type = l[Math.random() * l.length | 0]; }
    d = MOBS[type];
    let pos;
    if (owner) pos = { x, y };
    else {
      const pl = [...this.players.values()].filter(p => p.alive);
      // les vagues arrivent par les bords de la carte
      const edge = wave ? (px, py) => (px < 260 || py < 260 || px > this.map.w - 260 || py > this.map.h - 260) : () => true;
      pos = freeSpot(this.map, d.r * (wave && wave.boss ? 1.6 : 1), (px, py) => edge(px, py) && pl.every(p => Math.hypot(p.x - px, p.y - py) > 500));
    }
    const m = {
      id: uid++, isMob: true, type, x: pos.x, y: pos.y, r: d.r, hp: d.hp, maxHp: d.hp, face: rnd(-3, 3), cd: 0,
      owner: owner ? owner.id : null, tk: owner ? this.teamKey(owner) : 'mob', expire: owner ? this.t + ({ tourelle: 15, minidrone: 10, clone: 8 }[type] || 12) : 0,
      home: { x: pos.x, y: pos.y }, think: 0, tgt: null, wp: null, wpT: 0, stunUntil: 0, rootUntil: 0, poison: null, constrict: null
    };
    if (wave) {
      const n = wave.n, hpM = 1 + 0.15 * (n - 1), dmgM = 1 + 0.08 * (n - 1);
      m.hunt = true; m.waveMob = true; m.dmgMul = dmgM * (wave.boss ? 1.8 : 1);
      m.hp = m.maxHp = Math.round(d.hp * hpM * (wave.boss ? 7 : 1));
      if (wave.boss) { m.boss = true; m.r = Math.round(d.r * 1.6); }
    }
    collide(m, this.map);
    this.mobs.push(m);
    return m;
  }
  summon(p, type, n, max, m) {
    const mine = this.mobs.filter(x => x.owner === p.id && x.type === type && !x.dead);
    while (mine.length > max - n) { const o = mine.shift(); o.dead = true; }
    for (let k = 0; k < n; k++) {
      const a = p.face + (n === 1 ? 0 : (k / (n - 1) - 0.5) * 2.4), dist = type === 'tourelle' ? 45 : 50;
      const s = this.spawnMob(p, p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist, null, type); s.dmgMul = m;
      this.ev({ k: 'summon', x: r0(s.x), y: r0(s.y) });
    }
  }
  // ---------- mode survie
  waveStep(t) {
    const stillIn = [...this.players.values()].filter(p => p.alive || p.lives > 0);
    if (!stillIn.length) { this.endSoon = true; return; }
    const waveMobs = this.mobs.filter(m => m.waveMob && !m.dead).length;
    if (this.waveState === 'break') {
      if (t >= this.nextWaveAt) {
        this.wave++; this.waveState = 'fight';
        const mult = 1 + 0.4 * (this.players.size - 1);
        this.waveQueue = Math.round((3 + this.wave * 2) * mult);
        this.bossDone = this.wave % 5 !== 0;
        this.ev({ k: 'wave', st: 'start', n: this.wave, boss: this.wave % 5 === 0 ? 1 : 0 });
      }
      return;
    }
    if (this.waveQueue > 0 && t >= this.waveSpawnAt && waveMobs < 24) {
      this.waveSpawnAt = t + 0.6; this.waveQueue--;
      this.spawnMob(null, 0, 0, { n: this.wave });
    }
    if (!this.bossDone && this.waveQueue <= 0) { this.bossDone = true; this.spawnMob(null, 0, 0, { n: this.wave, boss: true }); this.ev({ k: 'boss' }); }
    if (this.waveQueue <= 0 && this.bossDone && waveMobs === 0) {
      this.waveState = 'break'; this.nextWaveAt = t + 6;
      // récompense : soin de 25 % pour les survivants
      for (const p of this.players.values()) if (p.alive) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
      this.ev({ k: 'wave', st: 'clear', n: this.wave });
    }
  }
  spawnArt() { const s = freeSpot(this.map, 22); this.arts.push({ id: pid++, x: s.x, y: s.y, at: this.t }); }
  dropArt(x, y) { this.arts.push({ id: pid++, x, y, at: this.t }); }

  targets() {
    const out = [];
    for (const p of this.players.values()) if (p.alive) out.push(p);
    for (const m of this.mobs) if (!m.dead) out.push(m);
    return out;
  }
  isEnemy(a, b) { return a !== b && this.teamKey(a) !== this.teamKey(b); }
  hidden(e) { return !e.isMob && e.invisUntil > this.t; }
  nearestEnemy(from, range) {
    let best = null, bd = 1e9;
    for (const e of this.targets()) {
      if (!this.isEnemy(from, e) || this.hidden(e)) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y) - e.r;
      if (d < range && d < bd) { bd = d; best = e; }
    }
    return best;
  }
  aim(p, range) {
    let a;
    if (p.in.a != null) a = p.in.a;
    else { const tg = this.nearestEnemy(p, range); a = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : p.face; }
    p.face = a; return a;
  }
  hard(e) { return !e.isMob && (e.shieldUntil > this.t || e.armorUntil > this.t); } // insensible au contrôle
  stun(e, d) { if (!this.hard(e)) e.stunUntil = Math.max(e.stunUntil || 0, this.t + d); }
  slow(e) {
    let k = 1;
    for (const h of this.map.haz) if (h.t === 'sand' && Math.hypot(e.x - h.x, e.y - h.y) < h.r) k = 0.45;
    for (const z of this.zones) if (z.slow && this.teamKey(e) !== z.tk && this.inZone(z, e)) k = Math.min(k, z.slow);
    return k;
  }
  mult(p) { let m = p.ultimate ? ULT_DMG : p.evolved ? EVO_DMG : 1; if (p.invisUntil > this.t) m *= 1.5; if (p.rageUntil > this.t) m *= 1.35; return m; }
  heal(e, amt) {
    if (e.isMob ? e.dead : !e.alive) return 0;
    const g = Math.max(0, Math.min(e.maxHp - e.hp, Math.round(amt)));
    if (g >= 1) { e.hp += g; this.ev({ k: 'heal', i: e.id, x: r0(e.x), y: r0(e.y - e.r), h: g }); }
    return g;
  }
  allies(p, rad, x = p.x, y = p.y) { return this.targets().filter(e => this.teamKey(e) === this.teamKey(p) && Math.hypot(e.x - x, e.y - y) <= rad + e.r); }
  inZone(z, e) { return z.x2 != null ? segDist(e.x, e.y, z.x, z.y, z.x2, z.y2).d < z.r + e.r * 0.5 : Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r * 0.5; }
  // point visé : ennemi le plus proche à portée, sinon droit devant
  spot(p, range, ahead) {
    const tg = p.in.a == null ? this.nearestEnemy(p, range) : null;
    if (tg) { p.face = Math.atan2(tg.y - p.y, tg.x - p.x); return { x: tg.x, y: tg.y }; }
    const a = p.in.a != null ? p.in.a : p.face; p.face = a;
    return { x: clamp(p.x + Math.cos(a) * ahead, 20, this.map.w - 20), y: clamp(p.y + Math.sin(a) * ahead, 20, this.map.h - 20) };
  }
  zone(o) { const z = Object.assign({ id: pid++, next: this.t + (o.delay || 0), every: 0.5 }, o); this.zones.push(z); return z; }

  damage(tg, amt, src, reflected) {
    if (tg.isMob ? tg.dead : !tg.alive) return 0;
    if (!tg.isMob) {
      if (this.t < tg.invulnUntil) return 0;
      if (this.t < tg.armorUntil) amt *= 0.5;
      if (this.t < tg.shieldUntil) {
        // carapace : -70 % de dégâts et 30 % renvoyés à l'attaquant
        if (src && !reflected && src !== tg && (src.isMob ? !src.dead : src.alive) && src.hp != null) this.damage(src, amt * 0.3, tg, true);
        amt *= 0.3;
      }
    }
    amt = Math.max(1, Math.round(amt));
    tg.hp -= amt;
    if (src) tg.lastHit = (src.isMob && src.owner != null) ? (this.players.get(src.owner) || src) : src;
    this.ev({ k: 'hit', i: tg.id, x: r0(tg.x), y: r0(tg.y - tg.r), d: amt });
    if (tg.hp <= 0) this.kill(tg, tg.lastHit);
    return amt;
  }
  kill(tg, killer) {
    if (tg.isMob) {
      tg.dead = true; tg.hp = 0;
      if (tg.owner == null) {
        if (Math.random() < (tg.boss ? 1 : this.cfg.survival ? 0.25 : 0.35)) this.dropArt(tg.x, tg.y);
        if (tg.boss) { this.dropArt(tg.x + 25, tg.y); this.dropArt(tg.x - 25, tg.y); }
        if (!tg.waveMob) this.mobRespawn.push(this.t + 10);
        // en survie, chaque monstre abattu compte
        if (this.cfg.survival && killer && !killer.isMob && this.players.has(killer.id)) { killer.kills++; this.rosterDirty = true; }
      }
      this.ev({ k: 'die', x: r0(tg.x), y: r0(tg.y), m: tg.type });
      return;
    }
    if (tg.rebirthUntil > this.t) {
      tg.rebirthUntil = 0; tg.hp = Math.round(tg.maxHp * 0.5); tg.invulnUntil = this.t + 1.5;
      tg.poison = tg.constrict = null;
      this.ev({ k: 'rebirth', i: tg.id, x: r0(tg.x), y: r0(tg.y) });
      return;
    }
    tg.alive = false; tg.hp = 0; tg.deaths++; tg.respawnAt = this.t + 3;
    if (this.cfg.survival) { tg.lives = Math.max(0, (tg.lives || 0) - 1); tg.respawnAt = tg.lives > 0 ? this.t + 4 : Infinity; }
    tg.poison = tg.constrict = tg.dash = tg.whirl = null;
    if (tg.artifacts > 0) { tg.artifacts--; this.dropArt(tg.x, tg.y); }
    this.updEvo(tg);
    let kn = '', ak = -1;
    if (killer && !killer.isMob && killer !== tg && this.players.has(killer.id) && this.isEnemy(killer, tg)) {
      killer.kills++; ak = killer.id; kn = killer.name;
      if (this.cfg.teams) this.teamScore[killer.team]++;
    } else if (killer && killer.isMob) kn = killer.type;
    this.ev({ k: 'kill', a: kn, ak, b: tg.name, bk: tg.id, x: r0(tg.x), y: r0(tg.y) });
    this.rosterDirty = true;
    const goal = this.cfg.score;
    if (goal > 0 && !this.cfg.survival) {
      if (this.cfg.teams ? Math.max(...this.teamScore) >= goal : [...this.players.values()].some(p => p.kills >= goal)) this.endSoon = true;
    }
  }

  shoot(src, a, o) {
    const off = src.r + 6;
    this.proj.push({
      id: pid++, kind: o.kind, x: src.x + Math.cos(a) * off, y: src.y + Math.sin(a) * off,
      vx: Math.cos(a) * o.spd, vy: Math.sin(a) * o.spd, dmg: o.dmg, r: o.r || 7, life: o.life || 1,
      aoe: o.aoe || 0, stun: o.stun || 0, src, tk: this.teamKey(src),
      pierce: o.pierce ? new Set() : null, home: !!o.home, ls: o.ls || 0, spd: o.spd
    });
  }
  explode(x, y, rad, dmg, src, tk, stun) {
    for (const e of this.targets()) {
      if (this.teamKey(e) === tk) continue;
      if (Math.hypot(e.x - x, e.y - y) <= rad + e.r) { this.damage(e, dmg, src); if (stun) this.stun(e, stun); }
    }
    for (const w of this.walls) if (w.tk !== tk && segDist(x, y, w.x1, w.y1, w.x2, w.y2).d < rad + 12) this.hitWall(w, dmg);
  }
  melee(p, a, range, arc, dmg, onHit, ls) {
    for (const e of this.targets()) {
      if (!this.isEnemy(p, e)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > range + e.r) continue;
      if (d > p.r + e.r + 4 && angDiff(Math.atan2(e.y - p.y, e.x - p.x), a) > arc / 2) continue;
      const got = this.damage(e, dmg, p); if (ls && got) this.heal(p, got * ls);
      if (onHit && !(e.isMob ? e.dead : !e.alive)) onHit(e);
    }
    const tip = { x: p.x + Math.cos(a) * range * 0.7, y: p.y + Math.sin(a) * range * 0.7 };
    for (const w of this.walls) if (w.tk !== this.teamKey(p) && segDist(tip.x, tip.y, w.x1, w.y1, w.x2, w.y2).d < range * 0.6 + 12) this.hitWall(w, dmg);
    this.ev({ k: 'slash', x: r0(p.x), y: r0(p.y), a: r2(a), r: range, arc: r2(arc), f: this.form(p) });
  }

  basic(p) {
    const f = this.form(p), m = this.mult(p), t = this.t;
    p.invisUntil = 0;
    const B = {
      mage:        { pr: { kind: 'bolt', spd: 650, dmg: 12, r: 7, life: 1.0 }, cd: 0.45 },
      liche:       { pr: { kind: 'bolt2', spd: 650, dmg: 12, r: 10, life: 1.0 }, cd: 0.45 },
      elementaire: { pr: { kind: 'bolt3', spd: 620, dmg: 13, r: 9, life: 1.0, aoe: 45 }, cd: 0.5 },
      barbare:     { me: [76, 1.8, 18], cd: 0.6 },
      golem:       { me: [92, 1.8, 18], cd: 0.7 },
      minotaure:   { me: [88, 2.0, 22], cd: 0.65 },
      ninja:       { me: [62, 1.5, 13], cd: 0.33 },
      serpent:     { me: [82, 1.5, 13], cd: 0.4 },
      kitsune:     { pr: { kind: 'foxfire', spd: 700, dmg: 13, r: 8, life: 0.8 }, cd: 0.35 },
      archer:      { pr: { kind: 'arrow2', spd: 820, dmg: 11, r: 6, life: 0.85 }, cd: 0.42 },
      phenix:      { pr: { kind: 'firearrow', spd: 820, dmg: 13, r: 7, life: 0.85, aoe: 45 }, cd: 0.42 },
      sylphe:      { pr: { kind: 'arrowh', spd: 780, dmg: 10, r: 6, life: 0.9, home: 1 }, cd: 0.25 },
      paladin:     { me: [70, 1.6, 15], cd: 0.55 },
      archange:    { me: [80, 1.8, 17], cd: 0.55 },
      noir:        { me: [78, 1.8, 17, 0.3], cd: 0.55 },
      ingenieur:   { pr: { kind: 'rivet', spd: 720, dmg: 9, r: 5, life: 0.75 }, cd: 0.3 },
      mecha:       { pr: { kind: 'rivet', spd: 760, dmg: 8, r: 5, life: 0.75 }, cd: 0.14, spread: 0.12 },
      essaim:      { pr: { kind: 'plasmab', spd: 640, dmg: 11, r: 6, life: 0.9, home: 1 }, cd: 0.35 },
      druide:      { pr: { kind: 'thorn', spd: 620, dmg: 11, r: 6, life: 0.9 }, cd: 0.45 },
      ent:         { me: [92, 1.8, 20], cd: 0.65 },
      loupgarou:   { me: [60, 1.6, 12], cd: 0.22 },
      vampire:     { me: [62, 1.5, 12, 0.5], cd: 0.4 },
      seigneur:    { me: [70, 1.6, 16, 0.5], cd: 0.38 },
      gargouille:  { me: [72, 1.7, 18], cd: 0.5 }
    }[f];
    if (!B) return;
    if (B.pr) {
      let a = this.aim(p, 620);
      if (B.spread) a += (Math.random() - 0.5) * B.spread;
      this.shoot(p, a, Object.assign({}, B.pr, { dmg: B.pr.dmg * m }));
    } else {
      const [rg, arc, dmg, ls] = B.me, a = this.aim(p, rg + 80);
      this.melee(p, a, rg, arc, dmg * m, null, ls);
    }
    p.cd[0] = t + B.cd;
  }
  dashTo(p, a, spd, dur, dmg, stun, endBlast) {
    p.dash = { vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, until: this.t + dur, hit: new Set(), dmg, stun, endBlast };
  }
  skill(p, i) {
    const f = this.form(p), m = this.mult(p), t = this.t, tk = this.teamKey(p);
    const key = p.ultimate ? 'ultime' + i : f + i;
    if (key !== 'ninja1') p.invisUntil = 0;
    const cd = v => { p.cd[i + 1] = t + v; };
    switch (key) {
      // ----- Évolution ultime (toutes classes)
      case 'ultime0': this.zone({ k: 'inferno', x: p.x, y: p.y, r: 160, dmg: 12 * m, every: 0.5, until: t + 6, follow: p, src: p, tk }); this.ev({ k: 'roar', x: r0(p.x), y: r0(p.y), r: 160 }); cd(10); break;
      case 'ultime1': {
        // chaîne d'éclairs : rebondit sur 6 ennemis maximum
        let cur = this.nearestEnemy(p, 420);
        if (!cur) { p.cd[2] = t + 0.5; break; }
        const hit = new Set(), pts = [[r0(p.x), r0(p.y)]];
        let dmg = 40 * m;
        for (let j = 0; j < 6 && cur; j++) {
          hit.add(cur.id); pts.push([r0(cur.x), r0(cur.y)]);
          this.damage(cur, dmg, p); this.stun(cur, 0.3);
          dmg *= 0.85;
          let next = null, bd = 230;
          for (const e of this.targets()) { if (!this.isEnemy(p, e) || hit.has(e.id) || this.hidden(e)) continue; const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd) { bd = d; next = e; } }
          cur = next;
        }
        this.ev({ k: 'chain', pts }); cd(6); break;
      }
      // ----- Mage / Liche / Élémentaire
      case 'mage0': this.shoot(p, this.aim(p, 600), { kind: 'fire', spd: 520, dmg: 30 * m, r: 13, life: 1.3, aoe: 85 }); cd(4); break;
      case 'mage1': {
        const mv = Math.hypot(p.in.mx, p.in.my) > 0.2;
        const a = mv ? Math.atan2(p.in.my, p.in.mx) : p.face;
        let bx = p.x, by = p.y;
        for (let s = 10; s <= 240; s += 10) {
          const nx = p.x + Math.cos(a) * s, ny = p.y + Math.sin(a) * s;
          if (!blocked(this.map, nx, ny, p.r)) { bx = nx; by = ny; }
        }
        this.ev({ k: 'blink', x1: r0(p.x), y1: r0(p.y), x2: r0(bx), y2: r0(by) });
        p.x = bx; p.y = by; cd(6); break;
      }
      case 'liche0': { const a = this.aim(p, 600); for (let k = 0; k < 7; k++) this.shoot(p, a + (k - 3) * 0.16, { kind: 'soul', spd: 560, dmg: 15 * m, r: 8, life: 1.1 }); cd(5); break; }
      case 'liche1': this.summon(p, 'squelette', 2, 2, m); cd(12); break;
      case 'elementaire0': { const s = this.spot(p, 520, 260); this.zone({ k: 'blast', x: s.x, y: s.y, r: 140, at: t + 0.8, until: t + 0.8, dmg: 45 * m, stun: 0.6, src: p, tk }); cd(6); break; }
      case 'elementaire1': this.zone({ k: 'flame', x: p.x, y: p.y, r: 115, dmg: 8 * m, every: 0.5, until: t + 5, follow: p, src: p, tk }); cd(10); break;
      // ----- Barbare / Golem / Minotaure
      case 'barbare0': this.dashTo(p, this.aim(p, 340), 1100, 0.28, 22 * m, 0.5); cd(5); break;
      case 'barbare1': p.whirl = { until: t + 1.0, next: t, dmg: 11 * m }; cd(7); break;
      case 'golem0': this.explode(p.x, p.y, 170, 26 * m, p, tk, 1.2); this.ev({ k: 'quake', x: r0(p.x), y: r0(p.y), r: 170 }); cd(7); break;
      case 'golem1': p.shieldUntil = t + 6; p.stunUntil = p.rootUntil = 0; p.constrict = null; this.ev({ k: 'shield', i: p.id, x: r0(p.x), y: r0(p.y) }); cd(10); break;
      case 'minotaure0': this.dashTo(p, this.aim(p, 400), 1500, 0.35, 35 * m, 1.0); cd(5); break;
      case 'minotaure1': this.explode(p.x, p.y, 180, 15 * m, p, tk, 1.5); p.rageUntil = t + 5; this.ev({ k: 'roar', x: r0(p.x), y: r0(p.y), r: 180 }); cd(10); break;
      // ----- Ninja / Serpent / Kitsune
      case 'ninja0': { const a = this.aim(p, 560); for (let k = -1; k <= 1; k++) this.shoot(p, a + k * 0.18, { kind: 'shuri', spd: 760, dmg: 14 * m, r: 7, life: 0.8 }); cd(3); break; }
      case 'ninja1': p.invisUntil = t + 5; this.ev({ k: 'smoke', x: r0(p.x), y: r0(p.y) }); cd(10); break;
      case 'serpent0': { const a = this.aim(p, 180), dps = 6 * m; this.melee(p, a, 100, 1.9, 22 * m, e => { e.poison = { dps, until: t + 4, next: t + 0.5, src: p }; }); cd(4); break; }
      case 'serpent1': {
        const tg = this.nearestEnemy(p, 150);
        if (!tg) { p.cd[2] = t + 0.5; break; }
        if (!this.hard(tg)) tg.rootUntil = t + 2; tg.constrict = { until: t + 2, next: t + 0.5, dmg: 8 * m, src: p };
        p.face = Math.atan2(tg.y - p.y, tg.x - p.x);
        this.ev({ k: 'grab', x1: r0(p.x), y1: r0(p.y), x2: r0(tg.x), y2: r0(tg.y), i: tg.id });
        cd(9); break;
      }
      case 'kitsune0': this.summon(p, 'clone', 2, 2, m); this.ev({ k: 'smoke', x: r0(p.x), y: r0(p.y) }); cd(10); break;
      case 'kitsune1': for (let k = 0; k < 10; k++) this.shoot(p, k / 10 * Math.PI * 2, { kind: 'foxfire', spd: 520, dmg: 14 * m, r: 8, life: 1.2, home: 1 }); cd(7); break;
      // ----- Archer / Phénix / Sylphe
      case 'archer0': this.shoot(p, this.aim(p, 700), { kind: 'bigarrow', spd: 950, dmg: 26 * m, r: 9, life: 1.0, pierce: 1 }); cd(4); break;
      case 'archer1': { const s = this.spot(p, 520, 260); this.zone({ k: 'rain', x: s.x, y: s.y, r: 115, dmg: 11 * m, every: 0.3, delay: 0.3, until: t + 1.6, src: p, tk }); cd(7); break; }
      case 'phenix0': { const s = this.spot(p, 520, 260); this.zone({ k: 'firerain', x: s.x, y: s.y, r: 140, dmg: 16 * m, every: 0.3, delay: 0.3, until: t + 1.9, src: p, tk }); cd(7); break; }
      case 'phenix1': p.rebirthUntil = t + 12; this.ev({ k: 'shield', i: p.id, x: r0(p.x), y: r0(p.y) }); cd(22); break;
      case 'sylphe0': { const a = this.aim(p, 600); for (let k = -2; k <= 2; k++) this.shoot(p, a + k * 0.25, { kind: 'arrowh', spd: 760, dmg: 12 * m, r: 6, life: 1.1, home: 1 }); cd(4); break; }
      case 'sylphe1': {
        p.hasteUntil = t + 4;
        for (const e of this.targets()) {
          if (!this.isEnemy(p, e)) continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < 150 + e.r && d > 0.1 && !this.hard(e)) { e.x += (e.x - p.x) / d * 100; e.y += (e.y - p.y) / d * 100; collide(e, this.map); }
        }
        this.ev({ k: 'gust', x: r0(p.x), y: r0(p.y) }); cd(9); break;
      }
      // ----- Paladin / Archange / Chevalier noir
      case 'paladin0': this.melee(p, this.aim(p, 160), 80, 1.6, 18 * m, e => this.stun(e, 1.0)); cd(5); break;
      case 'paladin1':
        for (const e of this.allies(p, 200)) this.heal(e, 15);
        this.zone({ k: 'regen', x: p.x, y: p.y, r: 200, heal: 5, every: 0.5, delay: 0.5, until: t + 4, follow: p, src: p, tk }); cd(11); break;
      case 'archange0':
        this.explode(p.x, p.y, 170, 25 * m, p, tk);
        for (const e of this.allies(p, 170)) this.heal(e, 25);
        this.ev({ k: 'holy', x: r0(p.x), y: r0(p.y), r: 170 }); cd(6); break;
      case 'archange1':
        for (const e of this.allies(p, 260)) { if (!e.isMob) e.invulnUntil = Math.max(e.invulnUntil, t + 2); this.heal(e, 40); }
        this.ev({ k: 'holy', x: r0(p.x), y: r0(p.y), r: 260 }); cd(16); break;
      case 'noir0': this.melee(p, this.aim(p, 180), 95, 2.2, 30 * m, null, 1); cd(5); break;
      case 'noir1': this.zone({ k: 'dark', x: p.x, y: p.y, r: 130, dmg: 7 * m, ls: 1, every: 0.5, until: t + 5, follow: p, src: p, tk }); cd(10); break;
      // ----- Ingénieur / Mécha / Essaim
      case 'ingenieur0': this.summon(p, 'tourelle', 1, 2, m); cd(9); break;
      case 'ingenieur1': this.shoot(p, this.aim(p, 500), { kind: 'grenade', spd: 480, dmg: 28 * m, r: 9, life: 1.0, aoe: 90 }); cd(5); break;
      case 'mecha0': { const a = this.aim(p, 600); for (let k = 0; k < 4; k++) this.shoot(p, a + (k - 1.5) * 0.15, { kind: 'rocket', spd: 560, dmg: 16 * m, r: 8, life: 1.2, aoe: 60, home: 1 }); cd(5); break; }
      case 'mecha1': p.armorUntil = t + 5; p.stunUntil = p.rootUntil = 0; this.ev({ k: 'shield', i: p.id, x: r0(p.x), y: r0(p.y) }); cd(11); break;
      case 'essaim0': this.summon(p, 'minidrone', 3, 4, m); cd(10); break;
      case 'essaim1': {
        const s = this.spot(p, 520, 220);
        for (let k = 0; k < 6; k++) { const a = rnd(0, 6.28), d = rnd(0, 110); this.zone({ k: 'blast', x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d, r: 70, at: t + 0.5 + k * 0.2, until: t + 0.5 + k * 0.2, dmg: 22 * m, src: p, tk }); }
        cd(8); break;
      }
      // ----- Druide / Ent / Loup-garou
      case 'druide0': { const s = this.spot(p, 480, 240); this.zone({ k: 'roots', x: s.x, y: s.y, r: 105, dmg: 6 * m, root: 1.6, every: 0.5, until: t + 2.0, src: p, tk }); cd(7); break; }
      case 'druide1': this.zone({ k: 'regen', x: p.x, y: p.y, r: 200, heal: 6, every: 0.5, until: t + 4, follow: p, src: p, tk }); cd(11); break;
      case 'ent0': this.zone({ k: 'roots', x: p.x, y: p.y, r: 210, dmg: 8 * m, root: 2.0, every: 0.5, until: t + 2.5, src: p, tk }); cd(9); break;
      case 'ent1': p.armorUntil = t + 5; this.heal(p, 40); this.ev({ k: 'shield', i: p.id, x: r0(p.x), y: r0(p.y) }); cd(12); break;
      case 'loupgarou0': this.dashTo(p, this.aim(p, 320), 1300, 0.3, 25 * m, 0); cd(4); break;
      case 'loupgarou1': p.hasteUntil = t + 5; p.rageUntil = t + 5; this.ev({ k: 'roar', x: r0(p.x), y: r0(p.y), r: 120 }); cd(12); break;
      // ----- Vampire / Seigneur / Gargouille
      case 'vampire0': this.melee(p, this.aim(p, 160), 75, 1.4, 22 * m, null, 1); cd(4); break;
      case 'vampire1': { const a = this.aim(p, 550); for (let k = -2; k <= 2; k++) this.shoot(p, a + k * 0.22, { kind: 'bat', spd: 520, dmg: 9 * m, r: 8, life: 1.2, home: 1, ls: 0.5 }); cd(7); break; }
      case 'seigneur0': {
        const tg = this.nearestEnemy(p, 280);
        if (!tg) { p.cd[1] = t + 0.5; break; }
        const got = this.damage(tg, 30 * m, p); this.heal(p, got);
        this.ev({ k: 'drain', x1: r0(p.x), y1: r0(p.y), x2: r0(tg.x), y2: r0(tg.y) }); cd(5); break;
      }
      case 'seigneur1': for (let k = 0; k < 10; k++) this.shoot(p, k / 10 * Math.PI * 2, { kind: 'bat', spd: 500, dmg: 11 * m, r: 8, life: 1.3, home: 1, ls: 0.5 }); cd(8); break;
      case 'gargouille0': this.dashTo(p, this.aim(p, 360), 1200, 0.3, 20 * m, 0, { r: 120, dmg: 15 * m, stun: 1.0 }); cd(6); break;
      case 'gargouille1': p.shieldUntil = t + 4; p.stunUntil = p.rootUntil = 0; p.constrict = null; this.ev({ k: 'shield', i: p.id, x: r0(p.x), y: r0(p.y) }); cd(12); break;
    }
  }
  // ---------------------------------------------------------- objets
  useItem(p) {
    const t = this.t;
    let kind;
    if (p.bonus) { kind = p.bonus; p.bonus = null; }
    else if (p.items > 0) { kind = CLS[p.cls].item; p.items--; if (p.itemNext <= t) p.itemNext = t + ITEM_CD; }
    else return;
    const tk = this.teamKey(p), m = this.mult(p), a = p.face, ca = Math.cos(a), sa = Math.sin(a);
    const ahead = d => ({ x: clamp(p.x + ca * d, 20, this.map.w - 20), y: clamp(p.y + sa * d, 20, this.map.h - 20) });
    const keep = (list, k, max) => { const mine = list.filter(x => x.owner === p.id && x.k === k); while (mine.length >= max) { const o = mine.shift(); o.dead = true; } };
    switch (kind) {
      case 'mine': case 'trap': case 'shroom': {
        keep(this.traps, kind, 4);
        const s = kind === 'shroom' ? ahead(40) : { x: p.x, y: p.y };
        this.traps.push({ id: pid++, k: kind, x: s.x, y: s.y, owner: p.id, tk, armAt: t + 0.8, until: t + 45, dmg: (kind === 'mine' ? 40 : 15) * m });
        break;
      }
      case 'barr': {
        keep(this.walls, 'barr', 2);
        const c = ahead(48), px = -sa, py = ca, L = 58;
        this.walls.push({ id: pid++, k: 'barr', x1: c.x - px * L, y1: c.y - py * L, x2: c.x + px * L, y2: c.y + py * L, hp: 200, max: 200, owner: p.id, tk, until: t + 45 });
        break;
      }
      case 'ice': this.zone({ k: 'ice', x: p.x, y: p.y, r: 160, slow: 0.5, every: 9, until: t + 7, src: p, tk }); break;
      case 'elec': {
        const c = ahead(60), px = -sa, py = ca, L = 100;
        this.zone({ k: 'elec', x: c.x - px * L, y: c.y - py * L, x2: c.x + px * L, y2: c.y + py * L, r: 18, dmg: 6 * m, slow: 0.6, every: 0.4, until: t + 10, src: p, tk });
        break;
      }
      case 'gpotion': for (const e of this.allies(p, 260)) this.heal(e, e.maxHp * 0.3); this.ev({ k: 'holy', x: r0(p.x), y: r0(p.y), r: 260 }); break;
      case 'vial': this.heal(p, p.maxHp * 0.4); break;
      case 'potion': this.heal(p, p.maxHp * 0.35); break;
      case 'bomb': this.explode(p.x, p.y, 140, 35 * m, p, tk, 0.5); this.ev({ k: 'boom', x: r0(p.x), y: r0(p.y), r: 140 }); break;
      case 'haste': p.hasteUntil = t + 5; this.ev({ k: 'gust', x: r0(p.x), y: r0(p.y) }); break;
      case 'armor': p.armorUntil = t + 5; this.ev({ k: 'shield', i: p.id, x: r0(p.x), y: r0(p.y) }); break;
    }
    this.ev({ k: 'item', i: p.id, it: kind, x: r0(p.x), y: r0(p.y) });
  }
  hitWall(w, dmg) {
    if (w.dead) return;
    w.hp -= dmg;
    if (w.hp <= 0) { w.dead = true; this.ev({ k: 'die', x: r0((w.x1 + w.x2) / 2), y: r0((w.y1 + w.y2) / 2), m: 'barr' }); }
  }
  wallCol(e) {
    for (const w of this.walls) {
      if (w.dead) continue;
      const q = segDist(e.x, e.y, w.x1, w.y1, w.x2, w.y2), m = e.r + 12;
      if (q.d < m) {
        if (q.d > 0.01) { e.x = q.cx + (e.x - q.cx) / q.d * m; e.y = q.cy + (e.y - q.cy) / q.d * m; }
        else { e.x += m; }
      }
    }
  }
  tickWorld(t) {
    // zones (pluie de flèches, ronces, soins, auras, totem, clôture…)
    for (const z of this.zones) {
      if (z.dead) continue;
      if (z.follow) { if (z.follow.alive) { z.x = z.follow.x; z.y = z.follow.y; } else { z.dead = true; continue; } }
      if (z.k === 'blast') {
        if (t >= z.at) { z.dead = true; this.explode(z.x, z.y, z.r, z.dmg, z.src, z.tk, z.stun); this.ev({ k: 'boom', x: r0(z.x), y: r0(z.y), r: z.r }); }
        continue;
      }
      if (t >= z.next) {
        z.next += z.every;
        for (const e of this.targets()) {
          if (!this.inZone(z, e)) continue;
          if (this.teamKey(e) !== z.tk) {
            if (z.dmg) { const got = this.damage(e, z.dmg, z.src); if (z.ls && got) this.heal(z.src, got * z.ls); }
            if (z.root && !this.hard(e) && !(e.isMob ? e.dead : !e.alive)) e.rootUntil = Math.max(e.rootUntil || 0, t + Math.min(z.root, z.until - t + 0.2));
          } else if (z.heal) this.heal(e, z.heal);
        }
      }
      if (t >= z.until) z.dead = true;
    }
    this.zones = this.zones.filter(z => !z.dead);
    // pièges : mines, pièges à loup, champignons
    for (const tr of this.traps) {
      if (tr.dead) continue;
      if (t >= tr.until) { tr.dead = true; continue; }
      if (t < tr.armAt) continue;
      const owner = this.players.get(tr.owner) || null;
      for (const e of this.targets()) {
        if (Math.hypot(e.x - tr.x, e.y - tr.y) > 26 + e.r) continue;
        if (tr.k === 'shroom') {
          if (e.isMob || this.teamKey(e) !== tr.tk || e.hp >= e.maxHp) continue;
          this.heal(e, 35); tr.dead = true; this.ev({ k: 'spark', x: r0(tr.x), y: r0(tr.y) }); break;
        }
        if (this.teamKey(e) === tr.tk) continue;
        tr.dead = true;
        if (tr.k === 'mine') { this.explode(tr.x, tr.y, 95, tr.dmg, owner || { isMob: true, type: 'mine', owner: null, hp: null }, tr.tk); this.ev({ k: 'boom', x: r0(tr.x), y: r0(tr.y), r: 95 }); }
        else { this.damage(e, tr.dmg, owner); if (!this.hard(e)) e.rootUntil = Math.max(e.rootUntil || 0, t + 2.5); this.ev({ k: 'snap', x: r0(tr.x), y: r0(tr.y) }); }
        break;
      }
    }
    this.traps = this.traps.filter(x => !x.dead);
    // barricades
    for (const w of this.walls) if (t >= w.until) w.dead = true;
    this.walls = this.walls.filter(w => !w.dead);
    // caisses de ravitaillement
    this.crateTimer -= DT;
    if (this.crateTimer <= 0) {
      this.crateTimer = this.cfg.survival ? 20 : 35;
      if (this.crates.length < (this.cfg.survival ? 2 : 1)) { const c = freeSpot(this.map, 24); this.crates.push({ id: pid++, x: c.x, y: c.y }); }
    }
    for (const c of this.crates) {
      for (const p of this.players.values()) {
        if (!p.alive || p.bonus || c.taken || Math.hypot(c.x - p.x, c.y - p.y) > p.r + 24) continue;
        c.taken = true; p.bonus = BONUS[Math.random() * BONUS.length | 0];
        this.ev({ k: 'crate', i: p.id, it: p.bonus, x: r0(c.x), y: r0(c.y) });
      }
    }
    this.crates = this.crates.filter(c => !c.taken);
  }
  statusTick(e) {
    const t = this.t;
    if (e.poison) { if (t >= e.poison.next) { e.poison.next += 0.5; this.damage(e, e.poison.dps * 0.5, e.poison.src); } if (e.poison && t >= e.poison.until) e.poison = null; }
    if (e.constrict) { if (t >= e.constrict.next) { e.constrict.next += 0.5; this.damage(e, e.constrict.dmg, e.constrict.src); } if (e.constrict && t >= e.constrict.until) e.constrict = null; }
  }

  step() {
    const t = (this.t += DT);
    // --- joueurs
    for (const p of this.players.values()) {
      if (!p.alive) { if (t >= p.respawnAt) this.spawnPlayer(p); continue; }
      const stunned = t < p.stunUntil, rooted = stunned || t < p.rootUntil;
      const mx = p.in.mx, my = p.in.my, mag = Math.hypot(mx, my);
      if (p.dash) {
        p.x += p.dash.vx * DT; p.y += p.dash.vy * DT;
        for (const e of this.targets()) {
          if (!this.isEnemy(p, e) || p.dash.hit.has(e.id)) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < p.r + e.r + 6) {
            p.dash.hit.add(e.id); this.damage(e, p.dash.dmg, p);
            const sp = Math.hypot(p.dash.vx, p.dash.vy);
            if (!this.hard(e)) { e.x += p.dash.vx / sp * 70; e.y += p.dash.vy / sp * 70; collide(e, this.map); }
            if (p.dash.stun) this.stun(e, p.dash.stun);
          }
        }
        if (t >= p.dash.until || stunned) {
          const eb = p.dash.endBlast; p.dash = null;
          if (eb) { this.explode(p.x, p.y, eb.r, eb.dmg, p, this.teamKey(p), eb.stun); this.ev({ k: 'quake', x: r0(p.x), y: r0(p.y), r: eb.r }); }
        }
      } else if (!rooted && mag > 0.05) {
        const f = this.form(p), sp = CLS[p.cls].spd * (FORM_SPD[f] || 1) * (p.hasteUntil > t ? 1.5 : 1) * this.slow(p);
        const k = Math.min(1, mag) / mag;
        p.x += mx * k * sp * DT; p.y += my * k * sp * DT;
      }
      collide(p, this.map); this.wallCol(p);
      if (p.in.a != null) p.face = p.in.a; else if (mag > 0.2 && !p.dash) p.face = Math.atan2(my, mx);
      if (!stunned && !p.dash) {
        if ((p.in.b & 1) && t >= p.cd[0]) this.basic(p);
        if (p.alive && (p.in.b & 2) && t >= p.cd[1]) this.skill(p, 0);
        if (p.alive && (p.in.b & 4) && t >= p.cd[2]) this.skill(p, 1);
        if (p.alive && (p.in.b & 8) && !p.itemHeld) this.useItem(p);
      }
      p.itemHeld = !!(p.in.b & 8);
      if (p.items < ITEM_MAX && t >= p.itemNext) { p.items++; p.itemNext = p.items < ITEM_MAX ? t + ITEM_CD : 0; }
      if (p.whirl) {
        if (t >= p.whirl.next) { p.whirl.next += 0.25; this.explode(p.x, p.y, 95, p.whirl.dmg, p, this.teamKey(p)); }
        if (p.whirl && t >= p.whirl.until) p.whirl = null;
      }
      if (p.alive) this.statusTick(p);
      if (p.alive && p.ultimate && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * ULT_REGEN * DT);
    }
    // --- PNJ
    for (const m of this.mobs) {
      if (m.dead) continue;
      if (m.owner != null && t >= m.expire) { m.dead = true; this.ev({ k: 'die', x: r0(m.x), y: r0(m.y), m: m.type }); continue; }
      this.statusTick(m); if (m.dead) continue;
      if (t < m.stunUntil) continue;
      const d = MOBS[m.type];
      if (t >= m.think) {
        m.think = t + 0.3;
        m.tgt = this.nearestEnemy(m, m.hunt ? 6000 : m.owner != null ? 520 : 320);
      }
      let tg = m.tgt;
      if (tg && ((tg.isMob ? tg.dead : !tg.alive) || this.hidden(tg) || (!m.hunt && Math.hypot(tg.x - m.x, tg.y - m.y) > 650))) { tg = m.tgt = null; }
      let mx = 0, my = 0, spd = d.spd;
      if (tg) {
        const dx = tg.x - m.x, dy = tg.y - m.y, dist = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        m.face = a;
        const want = d.melee ? tg.r + m.r + 2 : d.range * 0.7;
        if (dist > want) { mx = dx / dist; my = dy / dist; }
        else if (!d.melee && dist < d.range * 0.4) { mx = -dx / dist; my = -dy / dist; spd *= 0.6; }
        const wall = d.melee && this.walls.find(w => w.tk !== m.tk && segDist(m.x, m.y, w.x1, w.y1, w.x2, w.y2).d < m.r + 24);
        if (wall && t >= m.cd && dist > d.range + tg.r) {
          m.cd = t + d.cd; this.hitWall(wall, d.dmg * (m.dmgMul || 1) * 1.5); this.ev({ k: 'bite', x: r0(m.x), y: r0(m.y), a: r2(a) });
        } else if (t >= m.cd && dist <= d.range + tg.r) {
          m.cd = t + d.cd;
          const dmg = d.dmg * (m.dmgMul || 1);
          if (d.melee) { this.damage(tg, dmg, m); this.ev({ k: 'bite', x: r0(m.x), y: r0(m.y), a: r2(a) }); }
          else this.shoot(m, a, { kind: d.proj, spd: 480, dmg, r: 6, life: d.range / 480 + 0.15 });
        }
      } else if (m.owner != null) {
        const o = this.players.get(m.owner);
        if (o && o.alive) { const dx = o.x - m.x, dy = o.y - m.y, dist = Math.hypot(dx, dy); if (dist > 90) { mx = dx / dist; my = dy / dist; m.face = Math.atan2(dy, dx); } }
      } else {
        if (!m.wp || t > m.wpT || Math.hypot(m.wp.x - m.x, m.wp.y - m.y) < 20) {
          const a = rnd(0, 6.28), r = rnd(40, 260);
          m.wp = { x: clamp(m.home.x + Math.cos(a) * r, 40, this.map.w - 40), y: clamp(m.home.y + Math.sin(a) * r, 40, this.map.h - 40) };
          m.wpT = t + rnd(2, 5);
        }
        const dx = m.wp.x - m.x, dy = m.wp.y - m.y, dist = Math.hypot(dx, dy);
        if (dist > 5) { mx = dx / dist; my = dy / dist; spd *= 0.45; m.face = Math.atan2(dy, dx); }
      }
      if (m.detourUntil > t) { const a = Math.atan2(my, mx) + m.detourDir; mx = Math.cos(a); my = Math.sin(a); }
      const ox = m.x, oy = m.y;
      if (t >= m.rootUntil) { const sl = this.slow(m); m.x += mx * spd * sl * DT; m.y += my * spd * sl * DT; }
      collide(m, this.map); this.wallCol(m);
      // coincé contre un obstacle : on le contourne
      if (m.hunt && (mx || my) && t >= m.rootUntil) {
        const moved = Math.hypot(m.x - ox, m.y - oy);
        m.stuck = moved < spd * DT * 0.3 ? (m.stuck || 0) + DT : 0;
        if (m.stuck > 0.4) { m.stuck = 0; m.detourUntil = t + 0.7; m.detourDir = Math.random() < 0.5 ? 1.3 : -1.3; }
      }
    }
    // --- geysers
    if (this.map.haz.length && t >= (this.hazNext || 0)) {
      this.hazNext = t + 0.4;
      for (const h of this.map.haz) {
        if (h.t !== 'geyser' || ((t + h.ph) % 5) < 3.8) continue;
        for (const e of this.targets()) if (Math.hypot(e.x - h.x, e.y - h.y) < h.r + e.r * 0.5) this.damage(e, 7, GEYSER);
      }
    }
    // --- séparation des corps
    const bodies = this.targets();
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d < m && d > 0.01) { const push = (m - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
    }
    for (const b of bodies) { collide(b, this.map); this.wallCol(b); }
    this.tickWorld(t);
    // --- projectiles
    for (const pr of this.proj) {
      if (pr.dead) continue;
      if (pr.home) {
        // tête chercheuse
        let best = null, bd = 340;
        for (const e of this.targets()) { if (this.teamKey(e) === pr.tk || this.hidden(e)) continue; const d = Math.hypot(e.x - pr.x, e.y - pr.y); if (d < bd) { bd = d; best = e; } }
        if (best) {
          const cur = Math.atan2(pr.vy, pr.vx), want = Math.atan2(best.y - pr.y, best.x - pr.x);
          let dA = want - cur; while (dA > Math.PI) dA -= 2 * Math.PI; while (dA < -Math.PI) dA += 2 * Math.PI;
          const na = cur + clamp(dA, -7 * DT, 7 * DT); pr.vx = Math.cos(na) * pr.spd; pr.vy = Math.sin(na) * pr.spd;
        }
      }
      for (let s = 0; s < 2 && !pr.dead; s++) {
        pr.x += pr.vx * DT / 2; pr.y += pr.vy * DT / 2;
        const w = this.walls.find(w => w.tk !== pr.tk && !w.dead && segDist(pr.x, pr.y, w.x1, w.y1, w.x2, w.y2).d < 12 + pr.r);
        if (w) {
          pr.dead = true;
          if (pr.aoe) { this.explode(pr.x, pr.y, pr.aoe, pr.dmg, pr.src, pr.tk); this.ev({ k: 'boom', x: r0(pr.x), y: r0(pr.y), r: pr.aoe }); }
          else { this.hitWall(w, pr.dmg); this.ev({ k: 'puff', x: r0(pr.x), y: r0(pr.y), c: pr.kind }); }
          break;
        }
        if (blocked(this.map, pr.x, pr.y, 2)) {
          pr.dead = true;
          if (pr.aoe) { this.explode(pr.x, pr.y, pr.aoe, pr.dmg, pr.src, pr.tk); this.ev({ k: 'boom', x: r0(pr.x), y: r0(pr.y), r: pr.aoe }); }
          else this.ev({ k: 'puff', x: r0(pr.x), y: r0(pr.y), c: pr.kind });
          break;
        }
        for (const e of this.targets()) {
          if (this.teamKey(e) === pr.tk) continue;
          if (pr.pierce && pr.pierce.has(e.id)) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + pr.r) {
            if (pr.pierce) { pr.pierce.add(e.id); this.damage(e, pr.dmg, pr.src); this.ev({ k: 'puff', x: r0(pr.x), y: r0(pr.y), c: pr.kind }); continue; }
            pr.dead = true;
            if (pr.aoe) { this.explode(pr.x, pr.y, pr.aoe, pr.dmg, pr.src, pr.tk); this.ev({ k: 'boom', x: r0(pr.x), y: r0(pr.y), r: pr.aoe }); }
            else {
              const got = this.damage(e, pr.dmg, pr.src);
              if (pr.ls && got && pr.src && !pr.src.isMob) this.heal(pr.src, got * pr.ls);
              this.ev({ k: 'puff', x: r0(pr.x), y: r0(pr.y), c: pr.kind });
            }
            break;
          }
        }
      }
      pr.life -= DT;
      if (pr.life <= 0 && !pr.dead) {
        pr.dead = true;
        if (pr.aoe) { this.explode(pr.x, pr.y, pr.aoe, pr.dmg, pr.src, pr.tk); this.ev({ k: 'boom', x: r0(pr.x), y: r0(pr.y), r: pr.aoe }); }
      }
    }
    this.proj = this.proj.filter(p => !p.dead);
    this.mobs = this.mobs.filter(m => !m.dead);
    // --- artefacts
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      for (const a of this.arts) {
        if (!a.taken && t - a.at > 0.4 && Math.hypot(a.x - p.x, a.y - p.y) < p.r + 18) {
          a.taken = true; p.artifacts++;
          const heal = Math.min(p.maxHp - p.hp, Math.round(p.maxHp * 0.05));
          p.hp += heal;
          this.ev({ k: 'pick', i: p.id, x: r0(a.x), y: r0(a.y), h: heal }); this.updEvo(p);
        }
      }
    }
    this.arts = this.arts.filter(a => !a.taken);
    this.artTimer -= DT;
    if (this.artTimer <= 0) { this.artTimer = 8; if (this.arts.length < 3 + Math.floor(this.players.size / 2)) this.spawnArt(); }
    if (this.cfg.survival) this.waveStep(t);
    // --- réapparition des PNJ
    if (this.mobRespawn.length && t >= this.mobRespawn[0]) { this.mobRespawn.shift(); this.spawnMob(); }
    // --- fin
    if (this.endSoon || t >= this.endAt) { this.endSoon = false; this.sendSnapshot(); this.end(); return; }
    if (++this.tick % SEND_EVERY === 0) this.sendSnapshot();
    if (this.rosterDirty) this.roster();
  }
  sendSnapshot() {
    const t = this.t;
    const pl = [];
    for (const p of this.players.values()) {
      let f = 0;
      if (p.alive) f |= 1; if (p.evolved) f |= 2; if (p.invisUntil > t) f |= 4; if (p.shieldUntil > t) f |= 8;
      if (p.stunUntil > t) f |= 16; if (p.rootUntil > t) f |= 32; if (p.poison) f |= 64; if (p.invulnUntil > t) f |= 128;
      if (p.whirl) f |= 256; if (p.dash) f |= 512; if (p.needPick) f |= 1024; if (p.hasteUntil > t) f |= 2048;
      if (p.rageUntil > t) f |= 4096; if (p.armorUntil > t) f |= 8192; if (p.rebirthUntil > t) f |= 16384; if (p.ultimate) f |= 32768;
      pl.push([p.id, r0(p.x), r0(p.y), r2(p.face), Math.max(0, r0(p.hp)), p.maxHp, f, p.artifacts, r2(p.cd[0]), r2(p.cd[1]), r2(p.cd[2]),
        isFinite(p.respawnAt) ? r2(p.respawnAt) : -1, this.cfg.survival ? p.lives : -1, p.evoPick == null ? -1 : p.evoPick, p.items, p.bonus || 0, r2(p.itemNext)]);
    }
    const mb = this.mobs.map(m => {
      let f = 0; if (m.stunUntil > t) f |= 16; if (m.rootUntil > t) f |= 32; if (m.poison) f |= 64; if (m.boss) f |= 128;
      return [m.id, m.type, r0(m.x), r0(m.y), r2(m.face), Math.max(0, r0(m.hp)), m.maxHp, m.owner == null ? -1 : m.owner, f];
    });
    const msg = {
      t: 's', n: r2(t), tl: isFinite(this.endAt) ? Math.max(0, Math.ceil(this.endAt - t)) : r0(t), ts: this.teamScore,
      sv: this.cfg.survival ? [this.wave, this.waveState === 'fight' ? 1 : 0, this.mobs.filter(m => m.waveMob).length + this.waveQueue + (this.bossDone ? 0 : 1), Math.max(0, Math.ceil(this.nextWaveAt - t))] : 0,
      p: pl, m: mb, pr: this.proj.map(p => [p.id, p.kind, r0(p.x), r0(p.y)]), a: this.arts.map(a => [a.id, r0(a.x), r0(a.y)]),
      w: this.walls.map(w => [w.id, r0(w.x1), r0(w.y1), r0(w.x2), r0(w.y2), Math.max(0, r0(w.hp)), w.max, w.owner]),
      tr: this.traps.map(x => [x.id, x.k, r0(x.x), r0(x.y), x.owner]),
      z: this.zones.map(z => [z.id, z.k, r0(z.x), r0(z.y), z.r, z.x2 == null ? 0 : r0(z.x2), z.y2 == null ? 0 : r0(z.y2), r2(z.k === 'blast' ? z.at : z.until)]),
      c: this.crates.map(c => [c.id, r0(c.x), r0(c.y)]),
      e: this.events
    };
    this.events = [];
    const b = Buffer.from(JSON.stringify(msg));
    for (const p of this.players.values()) p.conn.sendRaw(b);
  }
}

// ------------------------------------------------- Messages des joueurs
function onConnect(c) {
  c.onmsg = raw => {
    if (raw.length > 4000) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    const room = c.room, p = c.p;
    switch (m.t) {
      case 'create':
        if (room) return;
        new Room(m.cfg).addPlayer(c, m.name, m.cls);
        break;
      case 'join': {
        if (room) return;
        const r = rooms.get(String(m.room || '').toUpperCase());
        if (!r) return c.send({ t: 'err', msg: 'Partie introuvable. Le lien a peut-être expiré.' });
        if (r.players.size >= MAX_PLAYERS) return c.send({ t: 'err', msg: 'Partie complète (6 joueurs maximum).' });
        r.addPlayer(c, m.name, m.cls);
        break;
      }
      case 'resume': {
        if (room) return;
        const r = rooms.get(String(m.room || '').toUpperCase());
        const q = r && [...r.players.values()].find(x => x.token === m.token);
        if (!q) return c.send({ t: 'resumeFail' });
        r.resume(q, c);
        break;
      }
      case 'leave':
        if (!room) return;
        room.removePlayer(p); c.room = null; c.p = null;
        c.send({ t: 'left' });
        break;
      case 'cls':
        if (!room || room.state === 'playing') return;
        p.cls = cleanCls(m.cls); room.roster(); break;
      case 'team':
        if (!room || room.state === 'playing' || !room.cfg.teams) return;
        p.team = m.team ? 1 : 0; room.roster(); break;
      case 'cfg':
        if (!room || room.host !== p.id || room.state !== 'lobby') return;
      {
        const wasTeams = room.cfg.teams;
        room.cfg = cleanCfg(m.cfg, room.cfg);
        if (room.cfg.teams && !wasTeams) [...room.players.values()].forEach((q, i) => { q.team = i % 2; });
        room.roster(); break;
      }
      case 'start':
        if (!room || room.host !== p.id || room.state !== 'lobby') return;
        room.start(); break;
      case 'pause':
        if (!room || room.host !== p.id) return;
        room.setPause(m.on); break;
      case 'again':
        if (!room || room.host !== p.id || room.state !== 'ended') return;
        room.backToLobby(); break;
      case 'evo':
        if (!room || !p || room.state !== 'playing' || p.evoPick != null) return;
        p.evoPick = m.k ? 1 : 0; room.updEvo(p); break;
      case 'in':
        if (!p) return;
        p.in.mx = clamp(+m.mx || 0, -1, 1); p.in.my = clamp(+m.my || 0, -1, 1);
        p.in.a = (typeof m.a === 'number' && isFinite(m.a)) ? m.a : null;
        p.in.b = (m.b | 0) & 15;
        break;
    }
  };
  c.onclose = () => { conns.delete(c); if (c.room && c.p && c.p.conn === c) c.room.disconnect(c.p); c.room = null; };
}

// ---------------------------------------------------------- Boucle de jeu
let last = process.hrtime.bigint(), acc = 0;
setInterval(() => {
  const now = process.hrtime.bigint();
  acc += Number(now - last) / 1e9; last = now;
  let steps = 0;
  while (acc >= DT && steps < 6) {
    acc -= DT; steps++;
    for (const r of rooms.values()) if (r.state === 'playing' && !r.paused) r.step();
  }
  if (steps >= 6) acc = 0;
}, 1000 / TICK);

server.listen(PORT, () => console.log(`L'Arène des Artefacts tourne sur http://localhost:${PORT}`));
