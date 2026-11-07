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
const TEST_ARTS = +process.env.TEST_ARTS || 0, TEST_DURATION = +process.env.TEST_DURATION || 0;

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
        state: r.state, map: r.cfg.map, teams: r.cfg.teams, duration: r.cfg.duration,
        left: r.state === 'playing' ? Math.max(0, Math.ceil(r.endAt - r.t)) : null
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
  mage:    { hp: 90,  spd: 215, r: 18 },
  barbare: { hp: 150, spd: 195, r: 20 },
  ninja:   { hp: 105, spd: 245, r: 17 }
};
const EVO = { mage: 'liche', barbare: 'golem', ninja: 'serpent' };
const EVO_HP = 1.5, EVO_DMG = 1.3, EVO_AT = 10;

const MOBS = {
  gladiateur: { hp: 70, spd: 120, r: 18, dmg: 10, range: 48,  cd: 1.0, melee: true },
  lion:       { hp: 50, spd: 175, r: 17, dmg: 8,  range: 44,  cd: 0.8, melee: true },
  jaguar:     { hp: 50, spd: 180, r: 16, dmg: 8,  range: 44,  cd: 0.8, melee: true },
  guerrier:   { hp: 60, spd: 110, r: 17, dmg: 9,  range: 380, cd: 1.6, melee: false, proj: 'spear' },
  voyou:      { hp: 60, spd: 130, r: 17, dmg: 9,  range: 46,  cd: 0.9, melee: true },
  drone:      { hp: 40, spd: 150, r: 14, dmg: 7,  range: 400, cd: 1.3, melee: false, proj: 'laser' },
  squelette:  { hp: 35, spd: 175, r: 15, dmg: 8,  range: 44,  cd: 0.8, melee: true }
};

// ---------------------------------------------------------------- Cartes
const MAP_W = 2200, MAP_H = 1500;
const MAP_MOBS = { colisee: ['gladiateur', 'lion'], jungle: ['jaguar', 'guerrier'], urbain: ['voyou', 'drone'] };
function buildMap(key) {
  const W = MAP_W, H = MAP_H, R = seeded(key === 'jungle' ? 7 : key === 'urbain' ? 13 : 3), obs = [];
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
  return { key, w: W, h: H, obs };
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

// ---------------------------------------------------------------- Salons
const rooms = new Map();
function roomCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s;
  do { s = ''; for (let i = 0; i < 5; i++) s += A[Math.random() * A.length | 0]; } while (rooms.has(s));
  return s;
}
function cleanCfg(c, prev) {
  c = c || {}; const p = prev || { map: 'colisee', duration: 10, score: 0, teams: false };
  return {
    map: ['colisee', 'jungle', 'urbain'].includes(c.map) ? c.map : p.map,
    duration: [3, 5, 10, 15].includes(+c.duration) ? +c.duration : p.duration,
    score: [0, 10, 20, 30].includes(+c.score) ? +c.score : p.score,
    teams: typeof c.teams === 'boolean' ? c.teams : p.teams
  };
}
const cleanName = n => (String(n || '').replace(/[<>]/g, '').trim().slice(0, 14)) || 'Joueur';
const cleanCls = c => CLS[c] ? c : 'mage';

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
      players: [...this.players.values()].map(p => ({ id: p.id, name: p.name, cls: p.cls, team: p.team, kills: p.kills, deaths: p.deaths }))
    });
    this.rosterDirty = false;
  }
  ev(e) { this.events.push(e); }
  mapInfo() { return { key: this.map.key, w: this.map.w, h: this.map.h, obs: this.map.obs }; }

  // ---------- joueurs
  addPlayer(conn, name, cls) {
    const p = {
      id: uid++, name: cleanName(name), cls: cleanCls(cls), conn, team: 0, kills: 0, deaths: 0, artifacts: 0,
      evolved: false, alive: false, x: 0, y: 0, r: 18, face: 0, hp: 1, maxHp: 1, cd: [0, 0, 0],
      in: { mx: 0, my: 0, a: null, b: 0 }, respawnAt: 0
    };
    p.team = this.smallerTeam(p);
    this.players.set(p.id, p);
    if (this.host == null) this.host = p.id;
    conn.room = this; conn.p = p;
    conn.send({ t: 'joined', id: p.id, room: this.id, host: this.host, state: this.state, cfg: this.cfg });
    if (this.state === 'playing') {
      this.resetHero(p); this.spawnPlayer(p);
      conn.send({ t: 'start', map: this.mapInfo(), cfg: this.cfg });
    }
    this.roster();
  }
  removePlayer(p) {
    this.players.delete(p.id);
    if (this.players.size === 0) { rooms.delete(this.id); return; }
    if (this.host === p.id) this.host = this.players.keys().next().value;
    if (this.mobs) this.mobs = this.mobs.filter(m => m.owner !== p.id);
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
    return this.cfg.teams ? 't' + e.team : 'p' + e.id;
  }
  form(p) { return p.evolved ? EVO[p.cls] : p.cls; }
  resetHero(p) {
    const c = CLS[p.cls];
    p.artifacts = TEST_ARTS; p.evolved = false; p.r = c.r; p.maxHp = c.hp; p.hp = c.hp; p.cd = [0, 0, 0];
    p.invisUntil = p.shieldUntil = p.stunUntil = p.rootUntil = p.invulnUntil = 0;
    p.poison = p.constrict = p.dash = p.whirl = null;
  }
  spawnPlayer(p) {
    const others = [...this.players.values()].filter(q => q !== p && q.alive && this.teamKey(q) !== this.teamKey(p));
    const s = freeSpot(this.map, p.r, (x, y) => others.every(q => Math.hypot(q.x - x, q.y - y) > 450));
    p.x = s.x; p.y = s.y; p.alive = true; p.hp = p.maxHp; p.invulnUntil = this.t + 1.5;
    p.stunUntil = p.rootUntil = p.invisUntil = p.shieldUntil = 0;
    p.poison = p.constrict = p.dash = p.whirl = null; p.lastHit = null;
    this.ev({ k: 'spawn', i: p.id, x: r0(p.x), y: r0(p.y) });
  }
  updEvo(p) {
    const should = p.artifacts >= EVO_AT;
    if (should === p.evolved) return;
    const c = CLS[p.cls];
    p.evolved = should;
    p.maxHp = Math.round(c.hp * (should ? EVO_HP : 1));
    p.r = c.r + (should ? 8 : 0);
    if (should) p.hp = p.maxHp; else p.hp = Math.min(p.hp, p.maxHp);
    if (p.alive) collide(p, this.map);
    this.ev({ k: 'evo', i: p.id, on: should ? 1 : 0, x: r0(p.x), y: r0(p.y) });
  }

  // ---------- partie
  start() {
    this.state = 'playing'; this.map = buildMap(this.cfg.map); this.t = 0; this.endAt = TEST_DURATION || this.cfg.duration * 60;
    this.mobs = []; this.proj = []; this.arts = []; this.events = []; this.teamScore = [0, 0];
    this.artTimer = 0; this.mobRespawn = []; this.tick = 0;
    const list = [...this.players.values()];
    // équipes : on garde le choix des joueurs, sauf si une équipe est vide
    if (this.cfg.teams && list.length > 1 && (list.every(p => p.team === 0) || list.every(p => p.team === 1))) {
      list.sort(() => Math.random() - 0.5).forEach((p, i) => { p.team = i % 2; });
    }
    list.forEach(p => { if (!this.cfg.teams) p.team = 0; p.kills = 0; p.deaths = 0; this.resetHero(p); });
    for (const p of list) { this.spawnPlayer(p); this.updEvo(p); }
    for (let i = 0; i < 9; i++) this.spawnMob();
    for (let i = 0; i < 7; i++) this.spawnArt();
    this.broadcast({ t: 'start', map: this.mapInfo(), cfg: this.cfg });
    this.roster();
  }
  end() {
    this.state = 'ended';
    const ranking = [...this.players.values()].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
      .map(p => ({ id: p.id, name: p.name, cls: p.cls, team: p.team, kills: p.kills, deaths: p.deaths }));
    this.broadcast({ t: 'end', ranking, ts: this.teamScore, teams: this.cfg.teams });
    this.roster();
  }
  backToLobby() {
    this.state = 'lobby'; this.mobs = []; this.proj = []; this.arts = [];
    for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; p.alive = false; }
    this.roster();
  }
  spawnMob(owner, x, y) {
    let type, d;
    if (owner) { type = 'squelette'; }
    else { const l = MAP_MOBS[this.map.key]; type = l[Math.random() * l.length | 0]; }
    d = MOBS[type];
    let pos;
    if (owner) pos = { x, y };
    else {
      const pl = [...this.players.values()].filter(p => p.alive);
      pos = freeSpot(this.map, d.r, (px, py) => pl.every(p => Math.hypot(p.x - px, p.y - py) > 500));
    }
    const m = {
      id: uid++, isMob: true, type, x: pos.x, y: pos.y, r: d.r, hp: d.hp, maxHp: d.hp, face: rnd(-3, 3), cd: 0,
      owner: owner ? owner.id : null, tk: owner ? this.teamKey(owner) : 'mob', expire: owner ? this.t + 12 : 0,
      home: { x: pos.x, y: pos.y }, think: 0, tgt: null, wp: null, wpT: 0, stunUntil: 0, rootUntil: 0, poison: null, constrict: null
    };
    collide(m, this.map);
    this.mobs.push(m);
    return m;
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
  mult(p) { let m = p.evolved ? EVO_DMG : 1; if (p.invisUntil > this.t) m *= 1.5; return m; }

  damage(tg, amt, src) {
    if (tg.isMob ? tg.dead : !tg.alive) return;
    if (!tg.isMob) {
      if (this.t < tg.invulnUntil) return;
      if (this.t < tg.shieldUntil) amt *= 0.5;
    }
    amt = Math.max(1, Math.round(amt));
    tg.hp -= amt;
    if (src) tg.lastHit = (src.isMob && src.owner != null) ? (this.players.get(src.owner) || src) : src;
    this.ev({ k: 'hit', i: tg.id, x: r0(tg.x), y: r0(tg.y - tg.r), d: amt });
    if (tg.hp <= 0) this.kill(tg, tg.lastHit);
  }
  kill(tg, killer) {
    if (tg.isMob) {
      tg.dead = true; tg.hp = 0;
      if (tg.owner == null) { if (Math.random() < 0.7) this.dropArt(tg.x, tg.y); this.mobRespawn.push(this.t + 10); }
      this.ev({ k: 'die', x: r0(tg.x), y: r0(tg.y), m: tg.type });
      return;
    }
    tg.alive = false; tg.hp = 0; tg.deaths++; tg.respawnAt = this.t + 3;
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
    if (goal > 0) {
      if (this.cfg.teams ? Math.max(...this.teamScore) >= goal : [...this.players.values()].some(p => p.kills >= goal)) this.endSoon = true;
    }
  }

  shoot(src, a, o) {
    const off = src.r + 6;
    this.proj.push({
      id: pid++, kind: o.kind, x: src.x + Math.cos(a) * off, y: src.y + Math.sin(a) * off,
      vx: Math.cos(a) * o.spd, vy: Math.sin(a) * o.spd, dmg: o.dmg, r: o.r || 7, life: o.life || 1,
      aoe: o.aoe || 0, stun: o.stun || 0, src, tk: this.teamKey(src)
    });
  }
  explode(x, y, rad, dmg, src, tk, stun) {
    for (const e of this.targets()) {
      if (this.teamKey(e) === tk) continue;
      if (Math.hypot(e.x - x, e.y - y) <= rad + e.r) { this.damage(e, dmg, src); if (stun) e.stunUntil = Math.max(e.stunUntil || 0, this.t + stun); }
    }
  }
  melee(p, a, range, arc, dmg, onHit) {
    for (const e of this.targets()) {
      if (!this.isEnemy(p, e)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > range + e.r) continue;
      if (d > p.r + e.r + 4 && angDiff(Math.atan2(e.y - p.y, e.x - p.x), a) > arc / 2) continue;
      this.damage(e, dmg, p); if (onHit && !(e.isMob ? e.dead : !e.alive)) onHit(e);
    }
    this.ev({ k: 'slash', x: r0(p.x), y: r0(p.y), a: r2(a), r: range, arc: r2(arc), f: this.form(p) });
  }

  basic(p) {
    const f = this.form(p), m = this.mult(p), t = this.t;
    p.invisUntil = 0;
    if (p.cls === 'mage') {
      const a = this.aim(p, 640);
      this.shoot(p, a, { kind: f === 'liche' ? 'bolt2' : 'bolt', spd: 650, dmg: 12 * m, r: f === 'liche' ? 10 : 7, life: 1.0 });
      p.cd[0] = t + 0.45;
    } else if (p.cls === 'barbare') {
      const rg = f === 'golem' ? 92 : 76, a = this.aim(p, rg + 80);
      this.melee(p, a, rg, 1.8, 18 * m); p.cd[0] = t + (f === 'golem' ? 0.7 : 0.6);
    } else {
      const rg = f === 'serpent' ? 82 : 62, a = this.aim(p, rg + 80);
      this.melee(p, a, rg, 1.5, 13 * m); p.cd[0] = t + (f === 'serpent' ? 0.4 : 0.33);
    }
  }
  skill(p, i) {
    const f = this.form(p), m = this.mult(p), t = this.t;
    const key = f + i;
    if (key !== 'ninja1') p.invisUntil = 0;
    switch (key) {
      case 'mage0': {
        const a = this.aim(p, 600);
        this.shoot(p, a, { kind: 'fire', spd: 520, dmg: 30 * m, r: 13, life: 1.3, aoe: 85 });
        p.cd[1] = t + 4; break;
      }
      case 'mage1': {
        const mv = Math.hypot(p.in.mx, p.in.my) > 0.2;
        const a = mv ? Math.atan2(p.in.my, p.in.mx) : p.face;
        let bx = p.x, by = p.y;
        for (let s = 10; s <= 240; s += 10) {
          const nx = p.x + Math.cos(a) * s, ny = p.y + Math.sin(a) * s;
          if (!blocked(this.map, nx, ny, p.r)) { bx = nx; by = ny; }
        }
        this.ev({ k: 'blink', x1: r0(p.x), y1: r0(p.y), x2: r0(bx), y2: r0(by) });
        p.x = bx; p.y = by; p.cd[2] = t + 6; break;
      }
      case 'liche0': {
        const a = this.aim(p, 600);
        for (let k = 0; k < 7; k++) this.shoot(p, a + (k - 3) * 0.16, { kind: 'soul', spd: 560, dmg: 15 * m, r: 8, life: 1.1 });
        p.cd[1] = t + 5; break;
      }
      case 'liche1': {
        const mine = this.mobs.filter(x => x.owner === p.id && !x.dead);
        while (mine.length > 2) { const o = mine.shift(); o.dead = true; }
        for (let k = 0; k < 2; k++) {
          const a = p.face + (k ? 1.2 : -1.2), x = p.x + Math.cos(a) * 50, y = p.y + Math.sin(a) * 50;
          const s = this.spawnMob(p, x, y); s.dmgMul = m;
          this.ev({ k: 'summon', x: r0(s.x), y: r0(s.y) });
        }
        p.cd[2] = t + 12; break;
      }
      case 'barbare0': {
        const a = this.aim(p, 340);
        p.dash = { vx: Math.cos(a) * 1100, vy: Math.sin(a) * 1100, until: t + 0.28, hit: new Set(), dmg: 22 * m };
        p.cd[1] = t + 5; break;
      }
      case 'barbare1': p.whirl = { until: t + 1.0, next: t, dmg: 11 * m }; p.cd[2] = t + 7; break;
      case 'golem0':
        this.explode(p.x, p.y, 170, 26 * m, p, this.teamKey(p), 1.2);
        this.ev({ k: 'quake', x: r0(p.x), y: r0(p.y), r: 170 }); p.cd[1] = t + 7; break;
      case 'golem1': p.shieldUntil = t + 4; p.cd[2] = t + 11; break;
      case 'ninja0': {
        const a = this.aim(p, 560);
        for (let k = -1; k <= 1; k++) this.shoot(p, a + k * 0.18, { kind: 'shuri', spd: 760, dmg: 14 * m, r: 7, life: 0.8 });
        p.cd[1] = t + 3; break;
      }
      case 'ninja1': p.invisUntil = t + 3; this.ev({ k: 'smoke', x: r0(p.x), y: r0(p.y) }); p.cd[2] = t + 8; break;
      case 'serpent0': {
        const a = this.aim(p, 180);
        const dps = 6 * m;
        this.melee(p, a, 100, 1.9, 22 * m, e => { e.poison = { dps, until: t + 4, next: t + 0.5, src: p }; });
        p.cd[1] = t + 4; break;
      }
      case 'serpent1': {
        const tg = this.nearestEnemy(p, 150);
        if (!tg) { p.cd[2] = t + 0.5; break; }
        tg.rootUntil = t + 2; tg.constrict = { until: t + 2, next: t + 0.5, dmg: 8 * m, src: p };
        p.face = Math.atan2(tg.y - p.y, tg.x - p.x);
        this.ev({ k: 'grab', x1: r0(p.x), y1: r0(p.y), x2: r0(tg.x), y2: r0(tg.y), i: tg.id });
        p.cd[2] = t + 9; break;
      }
    }
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
            e.x += p.dash.vx / sp * 70; e.y += p.dash.vy / sp * 70; collide(e, this.map);
            e.stunUntil = Math.max(e.stunUntil || 0, t + 0.5);
          }
        }
        if (t >= p.dash.until || stunned) p.dash = null;
      } else if (!rooted && mag > 0.05) {
        const f = this.form(p), sp = CLS[p.cls].spd * (f === 'golem' ? 0.88 : 1);
        const k = Math.min(1, mag) / mag;
        p.x += mx * k * sp * DT; p.y += my * k * sp * DT;
      }
      collide(p, this.map);
      if (p.in.a != null) p.face = p.in.a; else if (mag > 0.2 && !p.dash) p.face = Math.atan2(my, mx);
      if (!stunned && !p.dash) {
        if ((p.in.b & 1) && t >= p.cd[0]) this.basic(p);
        if (p.alive && (p.in.b & 2) && t >= p.cd[1]) this.skill(p, 0);
        if (p.alive && (p.in.b & 4) && t >= p.cd[2]) this.skill(p, 1);
      }
      if (p.whirl) {
        if (t >= p.whirl.next) { p.whirl.next += 0.25; this.explode(p.x, p.y, 95, p.whirl.dmg, p, this.teamKey(p)); }
        if (p.whirl && t >= p.whirl.until) p.whirl = null;
      }
      if (p.alive) this.statusTick(p);
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
        m.tgt = this.nearestEnemy(m, m.owner != null ? 520 : 320);
      }
      let tg = m.tgt;
      if (tg && ((tg.isMob ? tg.dead : !tg.alive) || this.hidden(tg) || Math.hypot(tg.x - m.x, tg.y - m.y) > 650)) { tg = m.tgt = null; }
      let mx = 0, my = 0, spd = d.spd;
      if (tg) {
        const dx = tg.x - m.x, dy = tg.y - m.y, dist = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        m.face = a;
        const want = d.melee ? tg.r + m.r + 2 : d.range * 0.7;
        if (dist > want) { mx = dx / dist; my = dy / dist; }
        else if (!d.melee && dist < d.range * 0.4) { mx = -dx / dist; my = -dy / dist; spd *= 0.6; }
        if (t >= m.cd && dist <= d.range + tg.r) {
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
      if (t >= m.rootUntil) { m.x += mx * spd * DT; m.y += my * spd * DT; }
      collide(m, this.map);
    }
    // --- séparation des corps
    const bodies = this.targets();
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d < m && d > 0.01) { const push = (m - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
    }
    for (const b of bodies) collide(b, this.map);
    // --- projectiles
    for (const pr of this.proj) {
      if (pr.dead) continue;
      for (let s = 0; s < 2 && !pr.dead; s++) {
        pr.x += pr.vx * DT / 2; pr.y += pr.vy * DT / 2;
        if (blocked(this.map, pr.x, pr.y, 2)) {
          pr.dead = true;
          if (pr.aoe) { this.explode(pr.x, pr.y, pr.aoe, pr.dmg, pr.src, pr.tk); this.ev({ k: 'boom', x: r0(pr.x), y: r0(pr.y), r: pr.aoe }); }
          else this.ev({ k: 'puff', x: r0(pr.x), y: r0(pr.y), c: pr.kind });
          break;
        }
        for (const e of this.targets()) {
          if (this.teamKey(e) === pr.tk) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + pr.r) {
            pr.dead = true;
            if (pr.aoe) { this.explode(pr.x, pr.y, pr.aoe, pr.dmg, pr.src, pr.tk); this.ev({ k: 'boom', x: r0(pr.x), y: r0(pr.y), r: pr.aoe }); }
            else { this.damage(e, pr.dmg, pr.src); this.ev({ k: 'puff', x: r0(pr.x), y: r0(pr.y), c: pr.kind }); }
            break;
          }
        }
      }
      pr.life -= DT; if (pr.life <= 0) pr.dead = true;
    }
    this.proj = this.proj.filter(p => !p.dead);
    this.mobs = this.mobs.filter(m => !m.dead);
    // --- artefacts
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      for (const a of this.arts) {
        if (!a.taken && t - a.at > 0.4 && Math.hypot(a.x - p.x, a.y - p.y) < p.r + 18) {
          a.taken = true; p.artifacts++; this.ev({ k: 'pick', i: p.id, x: r0(a.x), y: r0(a.y) }); this.updEvo(p);
        }
      }
    }
    this.arts = this.arts.filter(a => !a.taken);
    this.artTimer -= DT;
    if (this.artTimer <= 0) { this.artTimer = 3; if (this.arts.length < 6 + this.players.size) this.spawnArt(); }
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
      if (p.whirl) f |= 256; if (p.dash) f |= 512;
      pl.push([p.id, r0(p.x), r0(p.y), r2(p.face), Math.max(0, r0(p.hp)), p.maxHp, f, p.artifacts, r2(p.cd[0]), r2(p.cd[1]), r2(p.cd[2]), r2(p.respawnAt)]);
    }
    const mb = this.mobs.map(m => {
      let f = 0; if (m.stunUntil > t) f |= 16; if (m.rootUntil > t) f |= 32; if (m.poison) f |= 64;
      return [m.id, m.type, r0(m.x), r0(m.y), r2(m.face), Math.max(0, r0(m.hp)), m.maxHp, m.owner == null ? -1 : m.owner, f];
    });
    const msg = {
      t: 's', n: r2(t), tl: Math.max(0, Math.ceil(this.endAt - t)), ts: this.teamScore,
      p: pl, m: mb, pr: this.proj.map(p => [p.id, p.kind, r0(p.x), r0(p.y)]), a: this.arts.map(a => [a.id, r0(a.x), r0(a.y)]),
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
      case 'again':
        if (!room || room.host !== p.id || room.state !== 'ended') return;
        room.backToLobby(); break;
      case 'in':
        if (!p) return;
        p.in.mx = clamp(+m.mx || 0, -1, 1); p.in.my = clamp(+m.my || 0, -1, 1);
        p.in.a = (typeof m.a === 'number' && isFinite(m.a)) ? m.a : null;
        p.in.b = (m.b | 0) & 7;
        break;
    }
  };
  c.onclose = () => { conns.delete(c); if (c.room && c.p) c.room.removePlayer(c.p); c.room = null; };
}

// ---------------------------------------------------------- Boucle de jeu
let last = process.hrtime.bigint(), acc = 0;
setInterval(() => {
  const now = process.hrtime.bigint();
  acc += Number(now - last) / 1e9; last = now;
  let steps = 0;
  while (acc >= DT && steps < 6) {
    acc -= DT; steps++;
    for (const r of rooms.values()) if (r.state === 'playing') r.step();
  }
  if (steps >= 6) acc = 0;
}, 1000 / TICK);

server.listen(PORT, () => console.log(`L'Arène des Artefacts tourne sur http://localhost:${PORT}`));
