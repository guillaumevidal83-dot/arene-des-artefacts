(() => {
'use strict';
// =====================================================================
//  L'ARÈNE DES ARTEFACTS — client (rendu canvas + contrôles mobile/PC)
// =====================================================================
const $ = s => document.querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d');
const isTouch = matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
const INTERP = 0.1; // retard d'interpolation (secondes)

const CLASSES = {
  mage:    { n: 'Mage',    evo: 'Liche',         ico: '🔮', col: '#8b5cf6', r: 18, sk: ['Boule de feu', 'Téléportation'], esk: ["Nuée d'âmes", 'Squelettes'] },
  barbare: { n: 'Barbare', evo: 'Golem',         ico: '🪓', col: '#e0483e', r: 20, sk: ['Charge', 'Tourbillon'],          esk: ['Séisme', 'Carapace'] },
  ninja:   { n: 'Ninja',   evo: 'Serpent géant', ico: '🥷', col: '#3b4160', r: 17, sk: ['Shurikens', 'Invisibilité'],     esk: ['Morsure', 'Constriction'] }
};
const SK_ICO = { 'Boule de feu': '🔥', 'Téléportation': '✨', "Nuée d'âmes": '👻', 'Squelettes': '💀', 'Charge': '🐂', 'Tourbillon': '🌀',
  'Séisme': '💥', 'Carapace': '🛡️', 'Shurikens': '✴️', 'Invisibilité': '🌫️', 'Morsure': '🐍', 'Constriction': '⛓️' };
const MAPS = { colisee: { n: 'Colisée romain', ico: '🏛️' }, jungle: { n: 'Jungle amazonienne', ico: '🌴' }, urbain: { n: 'Zone urbaine', ico: '🏙️' } };
const MOBN = { gladiateur: 'Gladiateur', lion: 'Lion', jaguar: 'Jaguar', guerrier: 'Guerrier', voyou: 'Voyou', drone: 'Drone', squelette: 'Squelette' };
const TEAMC = ['#ff5a5a', '#4da3ff'], TEAMN = ['Rouge', 'Bleue'];

const store = { get(k) { try { return localStorage.getItem('arene_' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('arene_' + k, v); } catch (e) {} } };

// ----------------------------------------------------------------- État
let ws = null, myId = null, roomId = null, hostId = null, screen = 'home', cfg = null, roster = [], teamScore = [0, 0];
let map = null, decor = [], snaps = [], clockOff = null, fx = [], floats = [], feed = [], banner = null, trails = new Map();
let myName = store.get('name') || '', myCls = store.get('cls') || 'mage';
if (!CLASSES[myCls]) myCls = 'mage';
const joinCode = (new URLSearchParams(location.search).get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
let shake = 0, lastHp = null, wasAlive = true;

// ------------------------------------------------------------ Interface
function show(id) {
  for (const s of ['sHome', 'sLobby', 'sEnd', 'sLost']) $('#' + s).classList.toggle('hidden', s !== id);
  const playing = id === null;
  document.body.classList.toggle('playing', playing);
  $('#touch').classList.toggle('hidden', !(playing && isTouch));
}
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }

function classCards(el, onPick) {
  el.innerHTML = '';
  for (const k in CLASSES) {
    const c = CLASSES[k], b = document.createElement('button');
    b.className = 'cls' + (k === myCls ? ' on' : ''); b.dataset.k = k;
    b.innerHTML = `<div class="ico">${c.ico}</div><div class="nm">${c.n}</div><div class="ev">→ ${c.evo}</div><div class="sk">${c.sk.join('<br>')}</div>`;
    b.onclick = () => { myCls = k; store.set('cls', k); document.querySelectorAll('.cls').forEach(x => x.classList.toggle('on', x.dataset.k === k)); onPick && onPick(k); };
    el.appendChild(b);
  }
}
classCards($('#homeClasses'));
classCards($('#lobbyClasses'), k => send({ t: 'cls', cls: k }));
$('#name').value = myName;
$('#pcHint').classList.toggle('hidden', isTouch);
if (joinCode) { $('#btnJoin').textContent = 'Rejoindre la partie ' + joinCode; $('#btnCreate').classList.add('ghost'); $('#btnCreate').textContent = 'Créer ma propre partie'; }
else $('#btnJoin').classList.add('hidden');

function readName() {
  const n = $('#name').value.trim().slice(0, 14);
  if (!n) { toast('Choisis un pseudo 🙂'); $('#name').focus(); return null; }
  myName = n; store.set('name', n); return n;
}
$('#btnCreate').onclick = () => { const n = readName(); if (!n) return; connect(() => send({ t: 'create', name: n, cls: myCls, cfg: { map: 'colisee', duration: 10, score: 0, teams: false } })); };
$('#btnJoin').onclick = () => { const n = readName(); if (!n) return; connect(() => send({ t: 'join', room: joinCode, name: n, cls: myCls })); };
$('#btnStart').onclick = () => { send({ t: 'start' }); goFullscreen(); };
$('#btnAgain').onclick = () => send({ t: 'again' });
$('#btnShare').onclick = async () => {
  const url = location.origin + '/?r=' + roomId;
  if (navigator.share) { try { await navigator.share({ title: "L'Arène des Artefacts", text: 'Rejoins ma partie !', url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('Lien copié ! Envoie-le à tes amis.'); }
  catch (e) { prompt('Copie ce lien et envoie-le :', url); }
};

// réglages du salon
function chipRow(el, items, key) {
  el.innerHTML = '';
  for (const [v, label] of items) {
    const b = document.createElement('button'); b.className = 'chip'; b.textContent = label; b.dataset.v = v;
    b.onclick = () => { if (hostId !== myId) return; send({ t: 'cfg', cfg: { [key]: typeof v === 'boolean' ? v : (key === 'map' ? v : +v) } }); };
    el.appendChild(b);
  }
}
(function buildCfg() {
  const m = $('#cfgMap'); m.innerHTML = '';
  for (const k in MAPS) {
    const b = document.createElement('button'); b.className = 'map m-' + k; b.dataset.v = k;
    b.innerHTML = `<span class="ico">${MAPS[k].ico}</span>${MAPS[k].n}`;
    b.onclick = () => { if (hostId === myId) send({ t: 'cfg', cfg: { map: k } }); };
    m.appendChild(b);
  }
  chipRow($('#cfgDur'), [[3, '3 min'], [5, '5 min'], [10, '10 min'], [15, '15 min']], 'duration');
  chipRow($('#cfgScore'), [[0, 'Aucun (chrono)'], [10, '10'], [20, '20'], [30, '30']], 'score');
  chipRow($('#cfgTeams'), [[false, 'Chacun pour soi'], [true, '2 équipes']], 'teams');
})();
function renderLobby() {
  if (!cfg) return;
  const isHost = hostId === myId;
  $('#lCode').textContent = roomId;
  $('#cfgWho').textContent = isHost ? '(tu es l’hôte)' : '(choisis par l’hôte)';
  document.querySelectorAll('#cfgMap .map').forEach(b => { b.classList.toggle('on', b.dataset.v === cfg.map); b.disabled = !isHost; });
  document.querySelectorAll('#cfgDur .chip').forEach(b => { b.classList.toggle('on', +b.dataset.v === cfg.duration); b.disabled = !isHost; });
  document.querySelectorAll('#cfgScore .chip').forEach(b => { b.classList.toggle('on', +b.dataset.v === cfg.score); b.disabled = !isHost; });
  document.querySelectorAll('#cfgTeams .chip').forEach(b => { b.classList.toggle('on', (b.dataset.v === 'true') === cfg.teams); b.disabled = !isHost; });
  $('#pCount').textContent = `(${roster.length}/6)`;
  $('#pList').innerHTML = roster.map(p => `<div class="pl ${cfg.teams ? 't' + p.team : ''}"><span class="ico">${CLASSES[p.cls].ico}</span><span class="n">${esc(p.name)}${p.id === myId ? ' (toi)' : ''}</span>${p.id === hostId ? '<span class="b">HÔTE</span>' : ''}</div>`).join('');
  const tp = $('#teamPick');
  if (cfg.teams) {
    const me = roster.find(p => p.id === myId);
    tp.innerHTML = `<span class="small">Ton équipe :</span>` + [0, 1].map(t => `<button class="chip ${me && me.team === t ? 'on' : ''}" data-t="${t}" style="border-color:${TEAMC[t]}">Équipe ${TEAMN[t]}</button>`).join('');
    tp.querySelectorAll('button').forEach(b => b.onclick = () => send({ t: 'team', team: +b.dataset.t }));
  } else tp.innerHTML = '';
  $('#btnStart').classList.toggle('hidden', !isHost);
  $('#waitHost').classList.toggle('hidden', isHost);
  const me = roster.find(p => p.id === myId);
  if (me && me.cls !== myCls) { myCls = me.cls; }
  document.querySelectorAll('#lobbyClasses .cls').forEach(x => x.classList.toggle('on', x.dataset.k === myCls));
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderEnd(m) {
  const lead = m.ranking[0], second = m.ranking[1];
  const soloWin = !m.teams && lead && lead.kills > 0 && !(second && second.kills === lead.kills && second.deaths === lead.deaths);
  const rows = m.ranking.map((p, i) => `<tr><td>${i === 0 && soloWin ? '🏆' : (m.teams && m.ts[0] !== m.ts[1] && p.team === (m.ts[0] > m.ts[1] ? 0 : 1) ? '🏆' : i + 1)}</td><td>${CLASSES[p.cls].ico} <b style="${m.teams ? 'color:' + TEAMC[p.team] : ''}">${esc(p.name)}</b>${p.id === myId ? ' <span class="small">(toi)</span>' : ''}</td><td class="num">${p.kills}</td><td class="num">${p.deaths}</td></tr>`).join('');
  $('#endRows').innerHTML = rows;
  let w;
  if (m.teams) { w = m.ts[0] === m.ts[1] ? `Égalité ${m.ts[0]} – ${m.ts[1]} !` : `🏆 Équipe ${TEAMN[m.ts[0] > m.ts[1] ? 0 : 1]} gagne ${Math.max(...m.ts)} – ${Math.min(...m.ts)} !`; }
  else w = soloWin ? `🏆 ${esc(lead.name)} gagne !` : 'Égalité !';
  $('#endWin').innerHTML = w;
  const isHost = hostId === myId;
  $('#btnAgain').classList.toggle('hidden', !isHost); $('#waitAgain').classList.toggle('hidden', isHost);
}

function goFullscreen() {
  if (!isTouch) return;
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
  } catch (e) {}
}

// --------------------------------------------------------------- Réseau
function connect(onOpen) {
  if (ws) { if (ws.readyState === 1) onOpen(); return; }
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = onOpen;
  ws.onmessage = e => onMsg(JSON.parse(e.data));
  ws.onclose = () => { ws = null; if (roomId) show('sLost'); else toast('Impossible de joindre le serveur.'); };
}
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

function onMsg(m) {
  switch (m.t) {
    case 'joined':
      myId = m.id; roomId = m.room; hostId = m.host; cfg = m.cfg;
      history.replaceState(null, '', '?r=' + roomId);
      if (m.state !== 'playing') { screen = 'lobby'; show('sLobby'); }
      break;
    case 'roster': {
      roster = m.players; hostId = m.host; cfg = m.cfg; teamScore = m.ts;
      if (m.state === 'lobby' && screen !== 'lobby') { screen = 'lobby'; show('sLobby'); }
      if (screen === 'lobby') renderLobby();
      if (screen === 'end') { $('#btnAgain').classList.toggle('hidden', hostId !== myId); $('#waitAgain').classList.toggle('hidden', hostId === myId); }
      break;
    }
    case 'start':
      map = m.map; cfg = m.cfg; buildDecor(); snaps = []; clockOff = null; fx = []; floats = []; feed = []; trails.clear(); banner = null;
      lastHp = null; wasAlive = true; screen = 'game'; show(null); setupSkillButtons(false);
      banner = { text: MAPS[map.key].n, sub: 'Collecte 10 artefacts pour évoluer !', t: performance.now(), d: 2600 };
      break;
    case 's': onSnap(m); break;
    case 'end': screen = 'end'; show('sEnd'); renderEnd(m); resetInput(); break;
    case 'err': toast(m.msg); break;
  }
}

// ------------------------------------------------------ Instantanés
function onSnap(m) {
  const now = performance.now() / 1000;
  const off = now - m.n;
  clockOff = clockOff == null ? off : Math.min(off, clockOff + 0.003);
  const s = { n: m.n, tl: m.tl, ts: m.ts, P: new Map(), M: new Map(), R: new Map(), A: m.a };
  for (const p of m.p) s.P.set(p[0], { id: p[0], x: p[1], y: p[2], f: p[3], hp: p[4], mhp: p[5], fl: p[6], art: p[7], cd: [p[8], p[9], p[10]], ra: p[11] });
  for (const x of m.m) s.M.set(x[0], { id: x[0], type: x[1], x: x[2], y: x[3], f: x[4], hp: x[5], mhp: x[6], own: x[7], fl: x[8] });
  for (const x of m.pr) s.R.set(x[0], { id: x[0], k: x[1], x: x[2], y: x[3] });
  snaps.push(s); if (snaps.length > 40) snaps.shift();
  teamScore = m.ts;
  for (const e of m.e) onEvent(e);
  const me = s.P.get(myId);
  if (me) {
    if (lastHp != null && me.hp < lastHp && (me.fl & 1)) { shake = Math.min(10, shake + 4); vibrate(25); }
    lastHp = me.hp;
    if (!!(me.fl & 2) !== curEvo) setupSkillButtons(!!(me.fl & 2));
  }
}
function vibrate(ms) { try { if (isTouch && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
const nameOf = id => { const p = roster.find(q => q.id === id); return p ? p.name : '?'; };
const clsOf = id => { const p = roster.find(q => q.id === id); return p ? p.cls : 'mage'; };
const teamOf = id => { const p = roster.find(q => q.id === id); return p ? p.team : 0; };
const isAlly = id => id === myId || (cfg && cfg.teams && teamOf(id) === teamOf(myId));

function onEvent(e) {
  const t = performance.now();
  switch (e.k) {
    case 'hit': floats.push({ x: e.x + (Math.random() * 16 - 8), y: e.y, text: e.d, col: e.i === myId ? '#ff6b6b' : '#fff', t, d: 700 }); break;
    case 'slash': fx.push({ k: 'slash', ...e, t, d: 160 }); break;
    case 'bite': fx.push({ k: 'slash', x: e.x, y: e.y, a: e.a, r: 40, arc: 1.2, f: 'mob', t, d: 140 }); break;
    case 'boom': fx.push({ k: 'boom', ...e, t, d: 380 }); shakeNear(e.x, e.y, 5); break;
    case 'quake': fx.push({ k: 'quake', ...e, t, d: 600 }); shakeNear(e.x, e.y, 9); break;
    case 'blink': fx.push({ k: 'poof', x: e.x1, y: e.y1, c: '#b48bff', t, d: 400 }, { k: 'poof', x: e.x2, y: e.y2, c: '#e2d2ff', t, d: 400 }); break;
    case 'smoke': fx.push({ k: 'poof', x: e.x, y: e.y, c: '#9aa0b5', t, d: 600, big: 1 }); break;
    case 'summon': fx.push({ k: 'poof', x: e.x, y: e.y, c: '#7dffb2', t, d: 500 }); break;
    case 'grab': fx.push({ k: 'grab', ...e, t, d: 450 }); break;
    case 'puff': fx.push({ k: 'puff', ...e, t, d: 220 }); break;
    case 'die': fx.push({ k: 'burst', x: e.x, y: e.y, c: '#c9b28a', t, d: 500 }); break;
    case 'pick': fx.push({ k: 'spark', x: e.x, y: e.y, t, d: 450 }); if (e.i === myId) vibrate(15); break;
    case 'spawn': fx.push({ k: 'ring', x: e.x, y: e.y, c: '#fff', t, d: 500 }); break;
    case 'evo': {
      fx.push({ k: 'evo', x: e.x, y: e.y, on: e.on, t, d: 1000 });
      const c = CLASSES[clsOf(e.i)];
      if (e.i === myId) { banner = e.on ? { text: 'ÉVOLUTION !', sub: 'Tu deviens ' + c.evo + ' : +50 % vie, +30 % dégâts', t, d: 2600, gold: 1 } : { text: 'Évolution perdue', sub: 'Moins de 10 artefacts…', t, d: 2000 }; vibrate(e.on ? [60, 40, 120] : 80); shake = 10; }
      else if (e.on) addFeed(`${nameOf(e.i)} est devenu ${c.evo} !`, '#ffd98a');
      break;
    }
    case 'kill': {
      const kn = e.ak >= 0 ? e.a : (MOBN[e.a] || 'la chute');
      addFeed(`${kn} ⚔️ ${e.b}`, e.bk === myId ? '#ff7b7b' : e.ak === myId ? '#8dff9e' : '#fff');
      fx.push({ k: 'burst', x: e.x, y: e.y, c: '#ff6b4b', t, d: 650, big: 1 });
      if (e.bk === myId) { vibrate(150); shake = 12; }
      if (e.ak === myId) floats.push({ x: e.x, y: e.y - 40, text: '+1 élimination', col: '#8dff9e', t, d: 1300, big: 1 });
      break;
    }
    case 'left': addFeed(`${e.n} a quitté la partie`, '#b5a48d'); break;
  }
}
function addFeed(text, col) { feed.push({ text, col, t: performance.now() }); if (feed.length > 5) feed.shift(); }
function shakeNear(x, y, amt) { const me = curMe; if (me && Math.hypot(me.x - x, me.y - y) < 450) shake = Math.min(12, shake + amt); }

// interpolation entre deux instantanés
const lerp = (a, b, k) => a + (b - a) * k;
function lerpA(a, b, k) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; }
let curMe = null;
function renderState() {
  if (!snaps.length) return null;
  const rt = performance.now() / 1000 - clockOff - INTERP;
  let a = snaps[0], b = snaps[0];
  for (let i = snaps.length - 1; i >= 0; i--) { if (snaps[i].n <= rt) { a = snaps[i]; b = snaps[i + 1] || snaps[i]; break; } }
  const k = b === a ? 0 : Math.max(0, Math.min(1, (rt - a.n) / (b.n - a.n)));
  const P = [], M = [], R = [];
  for (const pb of b.P.values()) {
    const pa = a.P.get(pb.id) || pb;
    const jump = Math.hypot(pb.x - pa.x, pb.y - pa.y) > 160;
    P.push({ ...pb, x: jump ? pb.x : lerp(pa.x, pb.x, k), y: jump ? pb.y : lerp(pa.y, pb.y, k), f: lerpA(pa.f, pb.f, k), fl: k < 0.5 ? pa.fl : pb.fl });
  }
  for (const mb of b.M.values()) { const ma = a.M.get(mb.id) || mb; M.push({ ...mb, x: lerp(ma.x, mb.x, k), y: lerp(ma.y, mb.y, k), f: lerpA(ma.f, mb.f, k) }); }
  for (const rb of b.R.values()) {
    const ra = a.R.get(rb.id);
    if (!ra) continue;
    R.push({ ...rb, x: lerp(ra.x, rb.x, k), y: lerp(ra.y, rb.y, k), a: Math.atan2(rb.y - ra.y, rb.x - ra.x) });
  }
  return { P, M, R, A: b.A, latest: snaps[snaps.length - 1], serverNow: performance.now() / 1000 - clockOff };
}

// ---------------------------------------------------------------- Entrées
const input = { mx: 0, my: 0, b: 0, aim: null };
const keys = new Set();
let mouse = { x: 0, y: 0, in: false, down: false };
function resetInput() { input.mx = input.my = input.b = 0; keys.clear(); mouse.down = false; joy.id = null; $('#joy').classList.add('hidden'); document.querySelectorAll('.tb').forEach(b => b.classList.remove('down')); }
addEventListener('keydown', e => {
  if (screen !== 'game') return;
  const k = e.key.toLowerCase(); keys.add(k);
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => resetInput());
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true; });
cv.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());

// joystick virtuel
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const jz = $('#joyZone'), joyEl = $('#joy'), knob = $('#knob');
jz.addEventListener('pointerdown', e => {
  e.preventDefault(); goFullscreen();
  if (joy.id != null) return;
  joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
  try { jz.setPointerCapture(e.pointerId); } catch (er) {}
  joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.classList.remove('hidden'); knob.style.transform = '';
});
jz.addEventListener('pointermove', e => {
  if (e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const d = Math.hypot(dx, dy), R = 55;
  if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  joy.x = dx / R; joy.y = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`;
});
const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; joyEl.classList.add('hidden'); };
jz.addEventListener('pointerup', joyEnd); jz.addEventListener('pointercancel', joyEnd);
// boutons
const btnBits = { bAtk: 1, bS1: 2, bS2: 4 };
let touchB = 0;
for (const id in btnBits) {
  const el = $('#' + id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); goFullscreen(); try { el.setPointerCapture(e.pointerId); } catch (er) {} touchB |= btnBits[id]; el.classList.add('down'); });
  const up = e => { touchB &= ~btnBits[id]; el.classList.remove('down'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
}
let curEvo = null;
function setupSkillButtons(evo) {
  curEvo = evo;
  const c = CLASSES[myClsInGame()], sk = evo ? c.esk : c.sk;
  [['bS1', 0], ['bS2', 1]].forEach(([id, i]) => { const el = $('#' + id); el.querySelector('.e').textContent = SK_ICO[sk[i]] || '✦'; el.querySelector('.s').textContent = sk[i] === 'Téléportation' ? 'Téléport' : sk[i]; });
}
function myClsInGame() { const p = roster.find(q => q.id === myId); return p ? p.cls : myCls; }

let lastSent = '', lastSentT = 0;
setInterval(() => {
  if (screen !== 'game') return;
  let mx = 0, my = 0;
  if (keys.has('z') || keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  if (keys.has('q') || keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (mx || my) { const d = Math.hypot(mx, my); mx /= d; my /= d; }
  if (joy.id != null) { mx = joy.x; my = joy.y; }
  let b = touchB;
  if (mouse.down || keys.has(' ')) b |= 1;
  if (keys.has('e') || keys.has('1') || keys.has('shift')) b |= 2;
  if (keys.has('r') || keys.has('2') || keys.has('f')) b |= 4;
  let a = null;
  if (!isTouch && mouse.in) a = Math.round(Math.atan2(mouse.y - innerHeight / 2, mouse.x - innerWidth / 2) * 100) / 100;
  const msg = { t: 'in', mx: Math.round(mx * 100) / 100, my: Math.round(my * 100) / 100, a, b };
  const s = JSON.stringify(msg), now = performance.now();
  if (s !== lastSent || now - lastSentT > 250) { send(msg); lastSent = s; lastSentT = now; }
}, 33);

// --------------------------------------------------------- Décor des cartes
function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const THEME = {
  colisee: { out: '#5a4127', ground: '#d6ad74', ground2: '#caa066' },
  jungle:  { out: '#0f2412', ground: '#3f6d34', ground2: '#386230' },
  urbain:  { out: '#1b1c20', ground: '#3a3c42', ground2: '#34363b' }
};
function buildDecor() {
  const R = seeded(99), W = map.w, H = map.h; decor = [];
  const n = map.key === 'urbain' ? 120 : 380;
  for (let i = 0; i < n; i++) decor.push({ x: R() * W, y: R() * H, s: R(), r: R() });
}

// ----------------------------------------------------------------- Rendu
let W = 0, H = 0, DPR = 1, SC = 1;
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  SC = Math.min(W / 1000, H / 560);
  if (isTouch) SC = Math.min(W / 1050, H / 520);
  SC = Math.max(0.45, SC);
}
addEventListener('resize', resize); resize();

let cam = { x: 0, y: 0 };
function frame() {
  requestAnimationFrame(frame);
  if (screen !== 'game' || !map) { if (screen !== 'game') { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); } return; }
  const rs = renderState();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = THEME[map.key].out; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!rs) return;
  const now = performance.now();
  const me = rs.P.find(p => p.id === myId);
  curMe = me;
  if (me) { cam.x = me.x; cam.y = me.y; }
  shake *= 0.88; if (shake < 0.2) shake = 0;
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  const s = SC * DPR;
  ctx.setTransform(s, 0, 0, s, (W / 2 + sx) * DPR - cam.x * s, (H / 2 + sy) * DPR - cam.y * s);
  const view = { x0: cam.x - W / 2 / SC - 80, x1: cam.x + W / 2 / SC + 80, y0: cam.y - H / 2 / SC - 80, y1: cam.y + H / 2 / SC + 80 };
  const vis = (x, y, r = 0) => x + r > view.x0 && x - r < view.x1 && y + r > view.y0 && y - r < view.y1;

  drawGround(vis, now);
  // artefacts
  for (const a of rs.A) if (vis(a[1], a[2])) drawArtifact(a[1], a[2], now + a[0] * 300);
  drawObstacles(vis);
  // effets au sol
  for (const f of fx) if (f.k === 'quake' || f.k === 'ring' || f.k === 'evo') drawFx(f, now);
  // PNJ
  for (const m of rs.M) if (vis(m.x, m.y, 40)) drawMob(m, now);
  // héros
  for (const p of rs.P) {
    if (!(p.fl & 1)) { trails.delete(p.id); continue; }
    updTrail(p);
    if ((p.fl & 4) && !isAlly(p.id)) continue; // invisible pour les ennemis
    if (vis(p.x, p.y, 120)) drawHero(p, now);
  }
  // projectiles
  for (const r of rs.R) if (vis(r.x, r.y)) drawProj(r, now);
  // effets
  for (const f of fx) if (!(f.k === 'quake' || f.k === 'ring' || f.k === 'evo')) drawFx(f, now);
  fx = fx.filter(f => now - f.t < f.d);
  // barres de vie & noms
  for (const m of rs.M) if (vis(m.x, m.y, 40) && m.hp < m.mhp) bar(m.x, m.y - m.r - 10, 34, 5, m.hp / m.mhp, m.own === -1 ? '#e8a54a' : (isAlly(m.own) ? '#7dffb2' : '#ff8a5a'));
  for (const p of rs.P) {
    if (!(p.fl & 1) || ((p.fl & 4) && !isAlly(p.id)) || !vis(p.x, p.y, 120)) continue;
    const r = heroR(p);
    const col = p.id === myId ? '#6fdc8c' : (isAlly(p.id) ? '#4da3ff' : '#ff5a5a');
    bar(p.x, p.y - r - 14, p.fl & 2 ? 58 : 46, 7, p.hp / p.mhp, col);
    label(p.x, p.y - r - 22, (p.fl & 2 ? '★ ' : '') + nameOf(p.id) + '  ◆' + p.art, p.id === myId ? '#fff' : (isAlly(p.id) ? '#bfe0ff' : '#ffd0d0'));
  }
  // nombres flottants
  ctx.textAlign = 'center';
  for (const f of floats) {
    const k = (now - f.t) / f.d; if (k > 1) continue;
    ctx.globalAlpha = 1 - k * k;
    ctx.font = `800 ${f.big ? 22 : 17}px Rubik,sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = '#000a'; ctx.strokeText(f.text, f.x, f.y - k * 40);
    ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y - k * 40);
  }
  ctx.globalAlpha = 1;
  floats = floats.filter(f => now - f.t < f.d);

  drawHud(rs, me, now);
}
requestAnimationFrame(frame);

// ---------- sol
function drawGround(vis, now) {
  const th = THEME[map.key];
  ctx.fillStyle = th.ground; ctx.fillRect(0, 0, map.w, map.h);
  if (map.key === 'colisee') {
    ctx.fillStyle = th.ground2;
    for (const d of decor) if (vis(d.x, d.y)) { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(d.x, d.y, 2 + d.s * 5, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(120,80,40,.35)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(map.w / 2, map.h / 2, 900, 620, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(map.w / 2, map.h / 2, 240, 165, 0, 0, 7); ctx.stroke();
  } else if (map.key === 'jungle') {
    for (const d of decor) {
      if (!vis(d.x, d.y)) continue;
      if (d.r < 0.18) { ctx.fillStyle = 'rgba(90,60,30,.35)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, 30 + d.s * 40, 18 + d.s * 20, d.s * 3, 0, 7); ctx.fill(); }
      else { ctx.strokeStyle = d.r < 0.6 ? '#5a8f45' : '#2f5626'; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let k = -1; k <= 1; k++) { ctx.moveTo(d.x + k * 4, d.y); ctx.lineTo(d.x + k * 7, d.y - 8 - d.s * 6); } ctx.stroke(); }
    }
  } else {
    // trottoirs + marquages au sol
    const st = 180, bw = (map.w - 5 * st) / 4, bh = (map.h - 4 * st) / 3;
    ctx.fillStyle = '#56585e';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const x = st + i * (bw + st), y = st + j * (bh + st); ctx.fillRect(x - 22, y - 22, bw + 44, bh + 44); }
    ctx.strokeStyle = 'rgba(255,220,120,.55)'; ctx.lineWidth = 5; ctx.setLineDash([34, 30]);
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) { const x = st / 2 + i * (bw + st); ctx.moveTo(x, 0); ctx.lineTo(x, map.h); }
    for (let j = 0; j <= 3; j++) { const y = st / 2 + j * (bh + st); ctx.moveTo(0, y); ctx.lineTo(map.w, y); }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (const d of decor) if (vis(d.x, d.y)) { ctx.beginPath(); ctx.ellipse(d.x, d.y, 10 + d.s * 22, 6 + d.s * 10, d.r * 3, 0, 7); ctx.fill(); }
  }
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 10; ctx.strokeRect(-5, -5, map.w + 10, map.h + 10);
}
// ---------- obstacles
function drawObstacles(vis) {
  const k = map.key;
  for (const o of map.obs) {
    const cx = o.t === 'c' ? o.x : o.x + o.w / 2, cy = o.t === 'c' ? o.y : o.y + o.h / 2, rr = o.t === 'c' ? o.r : Math.max(o.w, o.h);
    if (!vis(cx, cy, rr)) continue;
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    if (o.t === 'c') { ctx.beginPath(); ctx.arc(o.x + 7, o.y + 9, o.r, 0, 7); ctx.fill(); }
    else { rrect(o.x + 7, o.y + 9, o.w, o.h, 6); ctx.fill(); }
    if (k === 'colisee') {
      if (o.t === 'c') {
        ctx.fillStyle = '#b8ab95'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
        ctx.fillStyle = '#d9cfbd'; ctx.beginPath(); ctx.arc(o.x - o.r * .15, o.y - o.r * .15, o.r * .72, 0, 7); ctx.fill();
        ctx.strokeStyle = '#8f8270'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.stroke();
        if (o.r > 60) { ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(o.x, o.y, 22, 0, 7); ctx.fill(); }
      } else if (o.w > 200) {
        ctx.fillStyle = '#8a6a4a'; ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = '#6e5238'; ctx.lineWidth = 4;
        for (let y = o.y + 18; y < o.y + o.h; y += 26) { ctx.beginPath(); ctx.moveTo(o.x, y); ctx.lineTo(o.x + o.w, y); ctx.stroke(); }
        ctx.strokeStyle = '#4e3826'; ctx.lineWidth = 6; ctx.strokeRect(o.x, o.y, o.w, o.h);
      } else { ctx.fillStyle = '#a99a82'; rrect(o.x, o.y, o.w, o.h, 4); ctx.fill(); ctx.strokeStyle = '#7e705c'; ctx.lineWidth = 3; ctx.stroke(); }
    } else if (k === 'jungle') {
      if (o.t === 'c') {
        ctx.fillStyle = '#5b3a1e'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * .35, 0, 7); ctx.fill();
        ctx.fillStyle = '#1d4a20'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
        ctx.fillStyle = '#2b6a2c'; ctx.beginPath(); ctx.arc(o.x - o.r * .2, o.y - o.r * .2, o.r * .7, 0, 7); ctx.fill();
        ctx.fillStyle = '#3f8a3a'; ctx.beginPath(); ctx.arc(o.x - o.r * .35, o.y - o.r * .35, o.r * .35, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = '#6d6f66'; rrect(o.x, o.y, o.w, o.h, 16); ctx.fill();
        ctx.fillStyle = '#878a7f'; rrect(o.x + 6, o.y + 5, o.w - 18, o.h - 16, 12); ctx.fill();
        ctx.fillStyle = 'rgba(70,120,50,.6)'; ctx.beginPath(); ctx.arc(o.x + o.w * .7, o.y + o.h * .3, 12, 0, 7); ctx.fill();
      }
    } else {
      if (o.car) {
        const cols = ['#c0392b', '#2e86de', '#f1c40f', '#ecf0f1', '#27ae60'];
        ctx.fillStyle = cols[(o.car - 1) % 5]; rrect(o.x, o.y, o.w, o.h, 8); ctx.fill();
        ctx.fillStyle = 'rgba(20,30,45,.75)';
        if (o.w > o.h) { ctx.fillRect(o.x + o.w * .22, o.y + 5, o.w * .18, o.h - 10); ctx.fillRect(o.x + o.w * .62, o.y + 5, o.w * .14, o.h - 10); }
        else { ctx.fillRect(o.x + 5, o.y + o.h * .22, o.w - 10, o.h * .18); ctx.fillRect(o.x + 5, o.y + o.h * .62, o.w - 10, o.h * .14); }
      } else {
        ctx.fillStyle = '#5c616e'; ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = '#6f7584'; ctx.fillRect(o.x + 10, o.y + 10, o.w - 20, o.h - 20);
        ctx.fillStyle = '#545967';
        const R = seeded(Math.round(o.x * 7 + o.y));
        for (let i = 0; i < 3; i++) ctx.fillRect(o.x + 20 + R() * (o.w - 70), o.y + 20 + R() * (o.h - 70), 26 + R() * 20, 18 + R() * 14);
        ctx.strokeStyle = '#3e424c'; ctx.lineWidth = 5; ctx.strokeRect(o.x, o.y, o.w, o.h);
      }
    }
  }
}
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// ---------- artefact
function drawArtifact(x, y, now) {
  const b = Math.sin(now / 300) * 3, g = 0.6 + Math.sin(now / 200) * 0.25;
  ctx.fillStyle = `rgba(80,240,255,${0.18 * g})`; ctx.beginPath(); ctx.arc(x, y, 24, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 9, 4, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(x, y - 4 + b);
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 0); ctx.lineTo(0, 14); ctx.lineTo(-10, 0); ctx.closePath();
  const gr = ctx.createLinearGradient(-10, -14, 10, 14); gr.addColorStop(0, '#d8fbff'); gr.addColorStop(.5, '#36d6f5'); gr.addColorStop(1, '#1673c9');
  ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}
// ---------- héros
function heroR(p) { return CLASSES[clsOf(p.id)].r + (p.fl & 2 ? 8 : 0); }
function updTrail(p) {
  let t = trails.get(p.id); if (!t) { t = [{ x: p.x, y: p.y }]; trails.set(p.id, t); }
  const l = t[0]; if (Math.hypot(l.x - p.x, l.y - p.y) > 9) { t.unshift({ x: p.x, y: p.y }); if (t.length > 14) t.pop(); }
}
function drawHero(p, now) {
  const cls = clsOf(p.id), evo = !!(p.fl & 2), r = heroR(p), a = p.f, c = CLASSES[cls];
  ctx.save();
  if (p.fl & 4) ctx.globalAlpha = 0.35;
  if ((p.fl & 128) && Math.floor(now / 90) % 2) ctx.globalAlpha *= 0.5;
  // marque au sol
  const ring = p.id === myId ? '#fff' : (cfg && cfg.teams ? TEAMC[teamOf(p.id)] : 'rgba(0,0,0,0)');
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + r * .55, r * 1.05, r * .55, 0, 0, 7); ctx.fill();
  if (cfg && cfg.teams || p.id === myId) { ctx.strokeStyle = ring; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y + r * .5, r + 6, (r + 6) * .55, 0, 0, 7); ctx.stroke(); }
  if (evo) { ctx.fillStyle = 'rgba(255,215,110,.16)'; ctx.beginPath(); ctx.arc(p.x, p.y, r + 14 + Math.sin(now / 180) * 3, 0, 7); ctx.fill(); }
  if (p.fl & 256) { // tourbillon
    ctx.strokeStyle = 'rgba(255,240,220,.7)'; ctx.lineWidth = 6;
    for (let i = 0; i < 3; i++) { const s = now / 70 + i * 2.1; ctx.beginPath(); ctx.arc(p.x, p.y, 80, s, s + 0.9); ctx.stroke(); }
  }
  if (p.fl & 512) { ctx.fillStyle = 'rgba(255,200,150,.25)'; ctx.beginPath(); ctx.arc(p.x - Math.cos(a) * 20, p.y - Math.sin(a) * 20, r, 0, 7); ctx.fill(); }

  ctx.translate(p.x, p.y);
  if (cls === 'mage' && !evo) drawMage(r, a, now);
  else if (cls === 'mage') drawLiche(r, a, now);
  else if (cls === 'barbare' && !evo) drawBarb(r, a);
  else if (cls === 'barbare') drawGolem(r, a);
  else if (!evo) drawNinja(r, a, now);
  else { ctx.translate(-p.x, -p.y); drawSerpent(p, r, a, now); ctx.translate(p.x, p.y); }
  // statuts
  if (p.fl & 8) { ctx.strokeStyle = 'rgba(120,220,255,.9)'; ctx.lineWidth = 4; hexa(r + 10); ctx.stroke(); ctx.fillStyle = 'rgba(120,220,255,.15)'; ctx.fill(); }
  statusFx(p.fl, r, now);
  ctx.restore();
}
function statusFx(fl, r, now) {
  if (fl & 16) { ctx.fillStyle = '#ffe14d'; for (let i = 0; i < 3; i++) { const s = now / 200 + i * 2.1; star(Math.cos(s) * r * .8, -r - 6 + Math.sin(s) * 4, 5); } }
  if (fl & 32) { ctx.strokeStyle = '#3c8c3a'; ctx.lineWidth = 5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, -r * .4 + i * r * .45, r + 4, r * .35, 0, 0, 7); ctx.stroke(); } }
  if (fl & 64) { ctx.fillStyle = 'rgba(120,255,90,.75)'; for (let i = 0; i < 3; i++) { const k = ((now / 600) + i / 3) % 1; ctx.beginPath(); ctx.arc((i - 1) * r * .5, -r * k * 1.4, 3.5 * (1 - k) + 1, 0, 7); ctx.fill(); } }
}
function hexa(R) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(t) * R, Math.sin(t) * R); } ctx.closePath(); }
function star(x, y, s) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const t = i / 10 * Math.PI * 2, rr = i % 2 ? s * .45 : s; ctx.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); } ctx.closePath(); ctx.fill(); }
function body(r, col, edge) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 3; ctx.stroke(); }
function eyes(r, a, col) { ctx.fillStyle = col; for (const s of [-1, 1]) { const t = a + s * 0.45; ctx.beginPath(); ctx.arc(Math.cos(t) * r * .55, Math.sin(t) * r * .55, r * .13, 0, 7); ctx.fill(); } }
function drawMage(r, a, now) {
  // bâton + orbe
  const hx = Math.cos(a + 0.9) * r, hy = Math.sin(a + 0.9) * r;
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hx - Math.cos(a) * 8, hy - Math.sin(a) * 8); ctx.lineTo(hx + Math.cos(a) * 22, hy + Math.sin(a) * 22); ctx.stroke();
  ctx.fillStyle = '#d3b8ff'; ctx.shadowColor = '#a46bff'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(hx + Math.cos(a) * 24, hy + Math.sin(a) * 24, 5 + Math.sin(now / 150), 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  body(r, '#7d4fe6', '#3e2386');
  // chapeau pointu (vue de dessus : étoile)
  ctx.fillStyle = '#5b33b8'; ctx.beginPath(); for (let i = 0; i < 5; i++) { const t = a + i / 5 * Math.PI * 2; ctx.lineTo(Math.cos(t) * r * .75, Math.sin(t) * r * .75); ctx.lineTo(Math.cos(t + .63) * r * .35, Math.sin(t + .63) * r * .35); } ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(0, 0, r * .16, 0, 7); ctx.fill();
}
function drawLiche(r, a, now) {
  ctx.fillStyle = 'rgba(80,255,170,.18)'; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, 7); ctx.fill();
  for (let i = 0; i < 3; i++) { const t = now / 400 + i * 2.1; ctx.fillStyle = 'rgba(130,255,200,.7)'; ctx.beginPath(); ctx.arc(Math.cos(t) * r * 1.4, Math.sin(t) * r * 1.4, 4, 0, 7); ctx.fill(); }
  body(r, '#2c3a3a', '#7dffc4');
  ctx.fillStyle = '#e8f3e6'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .15, Math.sin(a) * r * .15, r * .62, 0, 7); ctx.fill();
  eyes(r * .9, a, '#12ff8e');
  ctx.fillStyle = '#d6b44a'; for (let i = 0; i < 5; i++) { const t = a + Math.PI + (i - 2) * 0.42; ctx.beginPath(); ctx.moveTo(Math.cos(t - .15) * r * .7, Math.sin(t - .15) * r * .7); ctx.lineTo(Math.cos(t) * r * 1.15, Math.sin(t) * r * 1.15); ctx.lineTo(Math.cos(t + .15) * r * .7, Math.sin(t + .15) * r * .7); ctx.fill(); }
}
function drawBarb(r, a) {
  // hache
  const hx = Math.cos(a + 0.8) * r, hy = Math.sin(a + 0.8) * r;
  ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * 26, hy + Math.sin(a) * 26); ctx.stroke();
  ctx.save(); ctx.translate(hx + Math.cos(a) * 24, hy + Math.sin(a) * 24); ctx.rotate(a);
  ctx.fillStyle = '#d7dde3'; ctx.beginPath(); ctx.moveTo(-4, -2); ctx.quadraticCurveTo(6, -14, 12, -12); ctx.lineTo(10, 2); ctx.closePath(); ctx.fill(); ctx.restore();
  body(r, '#d9443a', '#7d1a14');
  ctx.fillStyle = '#e9c09a'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .2, Math.sin(a) * r * .2, r * .55, 0, 7); ctx.fill();
  // cornes
  ctx.fillStyle = '#f2ead8';
  for (const s of [-1, 1]) { const t = a + s * 1.25; ctx.beginPath(); ctx.moveTo(Math.cos(t - .25) * r * .8, Math.sin(t - .25) * r * .8); ctx.lineTo(Math.cos(t + s * .2) * r * 1.45, Math.sin(t + s * .2) * r * 1.45); ctx.lineTo(Math.cos(t + .25) * r * .8, Math.sin(t + .25) * r * .8); ctx.fill(); }
  ctx.fillStyle = '#a5532a'; ctx.beginPath(); ctx.arc(-Math.cos(a) * r * .3, -Math.sin(a) * r * .3, r * .35, 0, 7); ctx.fill();
}
function drawGolem(r, a) {
  ctx.save(); ctx.rotate(a);
  ctx.fillStyle = '#6e655b'; for (const s of [-1, 1]) { rrect(r * .2, s * r * .95 - r * .32, r * .9, r * .64, 6); ctx.fill(); }
  ctx.fillStyle = '#857a6c'; rrect(-r, -r, r * 2, r * 2, r * .45); ctx.fill(); ctx.strokeStyle = '#4b433a'; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = '#5c5349'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * .6, -r * .2); ctx.lineTo(0, r * .1); ctx.lineTo(-r * .2, r * .7); ctx.moveTo(r * .1, -r * .8); ctx.lineTo(r * .3, -r * .3); ctx.stroke();
  ctx.fillStyle = '#ffb347'; ctx.shadowColor = '#ff8a00'; ctx.shadowBlur = 10;
  ctx.fillRect(r * .45, -r * .4, r * .25, r * .18); ctx.fillRect(r * .45, r * .22, r * .25, r * .18); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(120,200,90,.6)'; ctx.beginPath(); ctx.arc(-r * .5, -r * .55, r * .2, 0, 7); ctx.fill();
  ctx.restore();
}
function drawNinja(r, a, now) {
  // bandeau qui flotte
  ctx.strokeStyle = '#e02b2b'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  const bx = -Math.cos(a) * r, by = -Math.sin(a) * r, w = Math.sin(now / 120) * 6;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx - Math.cos(a) * 12 - Math.sin(a) * w, by - Math.sin(a) * 12 + Math.cos(a) * w, bx - Math.cos(a) * 22, by - Math.sin(a) * 22); ctx.stroke();
  // katana
  const hx = Math.cos(a + 1) * r, hy = Math.sin(a + 1) * r;
  ctx.strokeStyle = '#dfe6ee'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a - .2) * 28, hy + Math.sin(a - .2) * 28); ctx.stroke(); ctx.lineCap = 'butt';
  body(r, '#2b2f45', '#0f1120');
  ctx.fillStyle = '#e02b2b'; ctx.beginPath(); ctx.arc(0, 0, r * .78, a - 1.9, a + 1.9); ctx.arc(0, 0, r * .55, a + 1.9, a - 1.9, true); ctx.fill();
  ctx.fillStyle = '#f0d2b0'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * .55, Math.sin(a) * r * .55, r * .2, r * .38, a, 0, 7); ctx.fill();
  eyes(r * .85, a, '#111');
}
function drawSerpent(p, r, a, now) {
  const t = trails.get(p.id) || [{ x: p.x, y: p.y }];
  const seg = [];
  // chaîne de segments espacés le long de la trace
  let need = 0, px = p.x, py = p.y;
  seg.push({ x: px, y: py });
  for (const q of t) {
    let d = Math.hypot(q.x - px, q.y - py);
    while (d >= r * .8 && seg.length < 7) { const k = r * .8 / d; px += (q.x - px) * k; py += (q.y - py) * k; seg.push({ x: px, y: py }); d = Math.hypot(q.x - px, q.y - py); }
  }
  while (seg.length < 7) { const l = seg[seg.length - 1]; seg.push({ x: l.x - Math.cos(a) * r * .8, y: l.y - Math.sin(a) * r * .8 }); }
  for (let i = seg.length - 1; i >= 1; i--) {
    const s = seg[i], rr = r * (1 - i * 0.09);
    ctx.fillStyle = i % 2 ? '#2f8f3e' : '#3faa4c'; ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8d36a'; ctx.beginPath(); ctx.arc(s.x, s.y, rr * .35, 0, 7); ctx.fill();
  }
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
  ctx.fillStyle = '#2a7a37'; ctx.beginPath(); ctx.ellipse(r * .1, 0, r * 1.15, r * .9, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#174d20'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#ffde3a'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(r * .55, s * r * .45, r * .2, r * .13, 0, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#111'; for (const s of [-1, 1]) { ctx.fillRect(r * .52, s * r * .45 - r * .1, r * .06, r * .2); }
  if (Math.floor(now / 250) % 3 === 0) { ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(r * 1.2, 0); ctx.lineTo(r * 1.6, 0); ctx.lineTo(r * 1.8, -4); ctx.moveTo(r * 1.6, 0); ctx.lineTo(r * 1.8, 4); ctx.stroke(); }
  ctx.restore();
}
// ---------- PNJ
function drawMob(m, now) {
  const r = { gladiateur: 18, lion: 17, jaguar: 16, guerrier: 17, voyou: 17, drone: 14, squelette: 15 }[m.type] || 16, a = m.f;
  ctx.save(); ctx.translate(m.x, m.y);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, r * .55, r, r * .5, 0, 0, 7); ctx.fill();
  if (m.own !== -1) { ctx.strokeStyle = isAlly(m.own) ? '#7dffb2' : '#ff7a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, r * .5, r + 4, (r + 4) * .55, 0, 0, 7); ctx.stroke(); }
  switch (m.type) {
    case 'gladiateur':
      body(r, '#b4875a', '#5e4127');
      ctx.fillStyle = '#c9c9c9'; ctx.beginPath(); ctx.arc(0, 0, r * .65, 0, 7); ctx.fill();
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * r * .6, -Math.sin(a) * r * .6); ctx.lineTo(Math.cos(a) * r * .6, Math.sin(a) * r * .6); ctx.stroke();
      ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.arc(Math.cos(a - 1.3) * r, Math.sin(a - 1.3) * r, r * .5, 0, 7); ctx.fill();
      break;
    case 'lion': case 'jaguar': {
      const main = m.type === 'lion' ? '#d9a441' : '#e0b04a';
      if (m.type === 'lion') { ctx.fillStyle = '#8a4f1d'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .3, Math.sin(a) * r * .3, r * .95, 0, 7); ctx.fill(); }
      ctx.save(); ctx.rotate(a); ctx.fillStyle = main; ctx.beginPath(); ctx.ellipse(-r * .2, 0, r * 1.15, r * .75, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(r * .75, 0, r * .5, 0, 7); ctx.fill();
      if (m.type === 'jaguar') { ctx.fillStyle = '#3b2a12'; for (const [x, y] of [[-.6, -.3], [-.2, .35], [.1, -.35], [-.8, .2], [.3, .1]]) { ctx.beginPath(); ctx.arc(x * r, y * r, r * .12, 0, 7); ctx.fill(); } }
      ctx.strokeStyle = main; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 1.2, 0); ctx.quadraticCurveTo(-r * 1.7, Math.sin(now / 150) * 6, -r * 2, 4); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(r * .95, -r * .2, 2, 0, 7); ctx.arc(r * .95, r * .2, 2, 0, 7); ctx.fill();
      ctx.restore(); break;
    }
    case 'guerrier':
      ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r); ctx.lineTo(Math.cos(a) * r * 1.9, Math.sin(a) * r * 1.9); ctx.stroke();
      body(r, '#a0562b', '#4f2711');
      ctx.fillStyle = '#e8c640'; for (let i = 0; i < 5; i++) { const t = a + Math.PI + (i - 2) * .4; ctx.beginPath(); ctx.arc(Math.cos(t) * r * .9, Math.sin(t) * r * .9, 4, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#c0392b'; ctx.fillRect(-3, -r * .6, 6, r * 1.2);
      break;
    case 'voyou':
      body(r, '#3d4f7a', '#1a2440');
      ctx.fillStyle = '#d24b2a'; ctx.beginPath(); ctx.arc(0, 0, r * .6, a - 2, a + 2); ctx.lineTo(0, 0); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * .65, Math.sin(a) * r * .65, r * .35, r * .2, a, 0, 7); ctx.fill();
      ctx.strokeStyle = '#999'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(Math.cos(a + .9) * r, Math.sin(a + .9) * r); ctx.lineTo(Math.cos(a + .5) * r * 1.8, Math.sin(a + .5) * r * 1.8); ctx.stroke();
      break;
    case 'drone':
      ctx.save(); ctx.rotate(now / 600);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke();
      for (const [x, y] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) { ctx.fillStyle = 'rgba(200,220,255,.45)'; ctx.beginPath(); ctx.arc(x * r, y * r, r * .5, 0, 7); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#4a4f5a'; rrect(-r * .55, -r * .55, r * 1.1, r * 1.1, 4); ctx.fill();
      ctx.fillStyle = Math.floor(now / 300) % 2 ? '#ff2a2a' : '#8a1010'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .3, Math.sin(a) * r * .3, 4, 0, 7); ctx.fill();
      break;
    case 'squelette':
      body(r, '#e9e4d6', '#8a8576');
      ctx.fillStyle = '#222'; for (const s of [-1, 1]) { const t = a + s * .5; ctx.beginPath(); ctx.arc(Math.cos(t) * r * .5, Math.sin(t) * r * .5, r * .2, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#5aff9e'; for (const s of [-1, 1]) { const t = a + s * .5; ctx.beginPath(); ctx.arc(Math.cos(t) * r * .5, Math.sin(t) * r * .5, r * .08, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#bbb5a5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(Math.cos(a + 1) * r, Math.sin(a + 1) * r); ctx.lineTo(Math.cos(a + .6) * r * 1.8, Math.sin(a + .6) * r * 1.8); ctx.stroke();
      break;
  }
  statusFx(m.fl, r, now);
  ctx.restore();
}
// ---------- projectiles
function drawProj(p, now) {
  ctx.save(); ctx.translate(p.x, p.y); const a = p.a || 0;
  switch (p.k) {
    case 'bolt': case 'bolt2': {
      const c = p.k === 'bolt' ? ['#e6d3ff', '#9b5cff'] : ['#d6ffe9', '#26e58a'];
      ctx.fillStyle = c[1]; ctx.globalAlpha = .35; ctx.beginPath(); ctx.ellipse(-Math.cos(a) * 9, -Math.sin(a) * 9, 13, 6, a, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      ctx.shadowColor = c[1]; ctx.shadowBlur = 14; ctx.fillStyle = c[0]; ctx.beginPath(); ctx.arc(0, 0, p.k === 'bolt' ? 6 : 9, 0, 7); ctx.fill(); break;
    }
    case 'fire':
      ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 20;
      for (let i = 3; i >= 1; i--) { ctx.fillStyle = ['#ffe58a', '#ffae3b', '#ff5a1f'][i - 1]; ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(-Math.cos(a) * i * 6, -Math.sin(a) * i * 6, 15 - i * 2 + Math.random() * 2, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill(); break;
    case 'soul':
      ctx.shadowColor = '#5affc0'; ctx.shadowBlur = 12; ctx.fillStyle = 'rgba(160,255,220,.9)';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill(); ctx.globalAlpha = .4; ctx.beginPath(); ctx.ellipse(-Math.cos(a) * 12, -Math.sin(a) * 12, 12, 5, a, 0, 7); ctx.fill(); break;
    case 'shuri':
      ctx.rotate(now / 40); ctx.fillStyle = '#d5dbe3'; ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2, rr = i % 2 ? 3 : 10; ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'spear':
      ctx.rotate(a); ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = '#cfd5da'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(4, -5); ctx.lineTo(4, 5); ctx.fill(); break;
    case 'laser':
      ctx.rotate(a); ctx.shadowColor = '#ff2a2a'; ctx.shadowBlur = 10; ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(8, 0); ctx.stroke(); break;
  }
  ctx.restore();
}
// ---------- effets
const SLASHC = { mage: '#c9a6ff', liche: '#7dffc4', barbare: '#fff1dc', golem: '#d8c5a8', ninja: '#e8f0ff', serpent: '#9dff6a', mob: '#ffd2b0' };
function drawFx(f, now) {
  const k = Math.min(1, (now - f.t) / f.d), inv = 1 - k;
  ctx.save();
  switch (f.k) {
    case 'slash':
      ctx.globalAlpha = .55 * inv; ctx.fillStyle = SLASHC[f.f] || '#fff';
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, f.r + 6, f.a - f.arc / 2, f.a + f.arc / 2); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = inv; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 6, f.a - f.arc / 2 + k * f.arc * .5, f.a + f.arc / 2); ctx.stroke(); break;
    case 'boom':
      ctx.globalAlpha = inv * .8; ctx.fillStyle = '#ff9a2e'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (.4 + k * .7), 0, 7); ctx.fill();
      ctx.globalAlpha = inv; ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * .35 * inv, 0, 7); ctx.fill(); break;
    case 'quake':
      ctx.globalAlpha = inv; ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = 10 * inv + 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (.3 + k * .8), 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(110,80,40,.25)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#4b3520'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2 + .3; ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(t) * f.r * .9, f.y + Math.sin(t) * f.r * .9); } ctx.stroke(); break;
    case 'poof':
      ctx.fillStyle = f.c;
      for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; ctx.globalAlpha = inv * .7; ctx.beginPath(); ctx.arc(f.x + Math.cos(t) * k * (f.big ? 50 : 30), f.y + Math.sin(t) * k * (f.big ? 50 : 30), (f.big ? 16 : 9) * inv + 2, 0, 7); ctx.fill(); } break;
    case 'grab':
      ctx.globalAlpha = inv; ctx.strokeStyle = '#3faa4c'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke(); break;
    case 'puff':
      ctx.globalAlpha = inv * .8; ctx.fillStyle = { bolt: '#c9a6ff', bolt2: '#7dffc4', soul: '#a0ffe0', shuri: '#ddd', spear: '#c9b28a', laser: '#ff6060' }[f.c] || '#fff';
      ctx.beginPath(); ctx.arc(f.x, f.y, 6 + k * 12, 0, 7); ctx.fill(); break;
    case 'burst':
      ctx.fillStyle = f.c;
      for (let i = 0; i < 10; i++) { const t = i / 10 * Math.PI * 2 + i; ctx.globalAlpha = inv; ctx.beginPath(); ctx.arc(f.x + Math.cos(t) * k * (f.big ? 60 : 36), f.y + Math.sin(t) * k * (f.big ? 60 : 36), 5 * inv + 1, 0, 7); ctx.fill(); } break;
    case 'spark':
      ctx.strokeStyle = '#7ff3ff'; ctx.lineWidth = 3; ctx.globalAlpha = inv;
      for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(t) * k * 10, f.y + Math.sin(t) * k * 10); ctx.lineTo(f.x + Math.cos(t) * (k * 30 + 6), f.y + Math.sin(t) * (k * 30 + 6)); ctx.stroke(); } break;
    case 'ring':
      ctx.globalAlpha = inv; ctx.strokeStyle = f.c; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, 20 + k * 40, 0, 7); ctx.stroke(); break;
    case 'evo':
      ctx.globalAlpha = inv; ctx.strokeStyle = f.on ? '#ffd76a' : '#888'; ctx.lineWidth = 10 * inv + 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, 20 + k * 160, 0, 7); ctx.stroke();
      if (f.on) { ctx.fillStyle = 'rgba(255,220,120,.25)'; ctx.beginPath(); ctx.arc(f.x, f.y, 20 + k * 120, 0, 7); ctx.fill(); } break;
  }
  ctx.restore();
}
function bar(x, y, w, h, v, col) {
  v = Math.max(0, Math.min(1, v));
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2 - 1.5, y - 1.5, w + 3, h + 3);
  ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * v, h);
}
function label(x, y, t, col) {
  ctx.font = '700 13px Rubik,sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(t, x, y);
  ctx.fillStyle = col; ctx.fillText(t, x, y);
}

// ---------------------------------------------------------------- HUD
function drawHud(rs, me, now) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const L = 12, T = 10, sm = W < 700;
  const latest = rs.latest;
  // chrono
  const tl = latest.tl, mm = Math.floor(tl / 60), ss = tl % 60;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,.45)'; rrect(W / 2 - 58, T - 2, 116, 36, 10); ctx.fill();
  ctx.font = `800 ${sm ? 22 : 26}px Rubik,sans-serif`; ctx.fillStyle = tl <= 30 ? '#ff6b6b' : '#fff';
  ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, W / 2, T + 25);
  ctx.font = '700 13px Rubik,sans-serif';
  if (cfg.teams) {
    ctx.fillStyle = TEAMC[0]; ctx.textAlign = 'right'; ctx.fillText(`Rouge ${teamScore[0]}`, W / 2 - 8, T + 52);
    ctx.fillStyle = TEAMC[1]; ctx.textAlign = 'left'; ctx.fillText(`${teamScore[1]} Bleue`, W / 2 + 8, T + 52);
    ctx.textAlign = 'center';
    if (cfg.score) { ctx.fillStyle = '#ddd'; ctx.fillText(`objectif ${cfg.score}`, W / 2, T + 68); }
  } else if (cfg.score) { ctx.fillStyle = '#ddd'; ctx.fillText(`Objectif : ${cfg.score} élim.`, W / 2, T + 52); }

  // artefacts + stats du joueur
  if (me) {
    const evo = !!(me.fl & 2), cls = clsOf(myId), c = CLASSES[cls];
    ctx.fillStyle = 'rgba(0,0,0,.45)'; rrect(L - 4, T - 2, sm ? 196 : 232, sm ? 70 : 78, 10); ctx.fill();
    ctx.textAlign = 'left'; ctx.font = `800 ${sm ? 13 : 14}px Rubik,sans-serif`;
    ctx.fillStyle = evo ? '#ffd76a' : '#fff';
    ctx.fillText(evo ? `★ ${c.evo.toUpperCase()}` : `${c.n} — artefacts ${Math.min(me.art, 10)}/10`, L + 4, T + 16);
    const gs = sm ? 16 : 19;
    for (let i = 0; i < 10; i++) {
      const x = L + 6 + i * gs, y = T + 32, on = i < me.art;
      ctx.beginPath(); ctx.moveTo(x + 6, y - 9); ctx.lineTo(x + 12, y); ctx.lineTo(x + 6, y + 9); ctx.lineTo(x, y); ctx.closePath();
      ctx.fillStyle = on ? (evo ? '#ffd76a' : '#36d6f5') : 'rgba(255,255,255,.15)'; ctx.fill();
    }
    if (me.art > 10) { ctx.fillStyle = '#ffd76a'; ctx.font = '800 12px Rubik,sans-serif'; ctx.fillText('+' + (me.art - 10), L + 8 + 10 * gs, T + 37); }
    const mine = roster.find(p => p.id === myId) || { kills: 0, deaths: 0 };
    ctx.font = `700 ${sm ? 12 : 13}px Rubik,sans-serif`; ctx.fillStyle = '#ddd';
    ctx.fillText(`⚔️ ${mine.kills}   ☠️ ${mine.deaths}   ❤️ ${me.hp}/${me.mhp}`, L + 4, T + (sm ? 60 : 64));
  }
  // fil des éliminations
  ctx.textAlign = 'left'; ctx.font = `600 ${sm ? 12 : 13}px Rubik,sans-serif`;
  let fy = T + (sm ? 92 : 102);
  for (const f of feed) {
    const age = now - f.t; if (age > 6000) continue;
    ctx.globalAlpha = age > 5000 ? 1 - (age - 5000) / 1000 : 1;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(f.text, L, fy); ctx.fillStyle = f.col; ctx.fillText(f.text, L, fy); fy += 17;
  }
  ctx.globalAlpha = 1;
  // mini-carte + classement
  const mw = sm ? 120 : 160, mh = mw * map.h / map.w, mx = W - mw - L, my = T;
  ctx.fillStyle = 'rgba(0,0,0,.5)'; rrect(mx - 3, my - 3, mw + 6, mh + 6, 6); ctx.fill();
  ctx.fillStyle = THEME[map.key].ground; ctx.globalAlpha = .55; ctx.fillRect(mx, my, mw, mh); ctx.globalAlpha = 1;
  const ms = mw / map.w;
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  for (const o of map.obs) { if (o.t === 'c') { ctx.beginPath(); ctx.arc(mx + o.x * ms, my + o.y * ms, Math.max(1, o.r * ms), 0, 7); ctx.fill(); } else ctx.fillRect(mx + o.x * ms, my + o.y * ms, o.w * ms, o.h * ms); }
  ctx.fillStyle = '#4ff0ff'; for (const a of rs.A) { ctx.fillRect(mx + a[1] * ms - 1.5, my + a[2] * ms - 1.5, 3, 3); }
  for (const p of rs.P) {
    if (!(p.fl & 1) || ((p.fl & 4) && !isAlly(p.id))) continue;
    ctx.fillStyle = p.id === myId ? '#fff' : (isAlly(p.id) ? '#4da3ff' : '#ff4d4d');
    ctx.beginPath(); ctx.arc(mx + p.x * ms, my + p.y * ms, p.id === myId ? 3.5 : 3, 0, 7); ctx.fill();
  }
  if (!sm || true) {
    const top = [...roster].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).slice(0, sm ? 3 : 4);
    ctx.font = `700 ${sm ? 11 : 12}px Rubik,sans-serif`; ctx.textAlign = 'right';
    let ty = my + mh + 18;
    top.forEach((p, i) => {
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
      const txt = `${i + 1}. ${p.name}  ${p.kills}`;
      ctx.strokeText(txt, W - L, ty); ctx.fillStyle = p.id === myId ? '#ffd76a' : (cfg.teams ? TEAMC[p.team] : '#fff'); ctx.fillText(txt, W - L, ty); ty += 16;
    });
  }
  // boutons PC (barre des compétences)
  if (me) {
    const evo = !!(me.fl & 2), c = CLASSES[clsOf(myId)], sk = evo ? c.esk : c.sk, sn = rs.serverNow;
    if (isTouch) {
      updBtn('bAtk', me.cd[0], sn);
      updBtn('bS1', me.cd[1], sn);
      updBtn('bS2', me.cd[2], sn);
    } else {
      const items = [['Clic', 'Attaque', me.cd[0]], ['E', sk[0], me.cd[1]], ['R', sk[1], me.cd[2]]];
      const bw = 110, gap = 10, x0 = W / 2 - (items.length * bw + (items.length - 1) * gap) / 2, y0 = H - 62;
      items.forEach(([key, nm, cd], i) => {
        const x = x0 + i * (bw + gap), left = cd - sn;
        ctx.fillStyle = 'rgba(0,0,0,.55)'; rrect(x, y0, bw, 50, 10); ctx.fill();
        ctx.strokeStyle = left > 0 ? 'rgba(255,255,255,.2)' : '#ffd76a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.textAlign = 'center'; ctx.font = '800 12px Rubik,sans-serif'; ctx.fillStyle = '#ffd76a'; ctx.fillText(key, x + bw / 2, y0 + 17);
        ctx.font = '700 13px Rubik,sans-serif'; ctx.fillStyle = left > 0 ? '#888' : '#fff'; ctx.fillText((SK_ICO[nm] || '⚔️') + ' ' + nm, x + bw / 2, y0 + 37);
        if (left > 0.05) { ctx.font = '800 15px Rubik,sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(left.toFixed(1), x + bw - 18, y0 + 17); }
      });
    }
  }
  // mort / réapparition
  if (me && !(me.fl & 1)) {
    ctx.fillStyle = 'rgba(40,0,0,.45)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `800 ${sm ? 26 : 34}px Rubik,sans-serif`;
    ctx.fillText('Tu as été éliminé', W / 2, H / 2 - 10);
    ctx.font = '600 17px Rubik,sans-serif'; ctx.fillStyle = '#ffd0c0';
    ctx.fillText(`Réapparition dans ${Math.max(0, Math.ceil(me.ra - rs.serverNow))}…  (−1 artefact)`, W / 2, H / 2 + 22);
  }
  // bannière
  if (banner) {
    const age = now - banner.t;
    if (age > banner.d) banner = null;
    else {
      const a = age < 200 ? age / 200 : age > banner.d - 500 ? (banner.d - age) / 500 : 1, sc = 1 + Math.max(0, 1 - age / 250) * .3;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, H * .3); ctx.scale(sc, sc); ctx.textAlign = 'center';
      ctx.font = `400 ${sm ? 30 : 42}px Bungee,Rubik,sans-serif`; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(banner.text, 0, 0); ctx.fillStyle = banner.gold ? '#ffd76a' : '#fff'; ctx.fillText(banner.text, 0, 0);
      if (banner.sub) { ctx.font = `700 ${sm ? 14 : 17}px Rubik,sans-serif`; ctx.lineWidth = 4; ctx.strokeText(banner.sub, 0, 30); ctx.fillStyle = '#fff'; ctx.fillText(banner.sub, 0, 30); }
      ctx.restore();
    }
  }
}
const btnCache = {};
function updBtn(id, ready, sn) {
  const el = btnCache[id] || (btnCache[id] = { el: $('#' + id), cd: $('#' + id + ' .cd'), cn: $('#' + id + ' .cn'), last: '', ready: 0, total: 1 });
  if (ready !== el.ready) { el.ready = ready; el.total = Math.max(0.2, ready - sn); }
  const left = ready - sn;
  const p = left > 0.05 ? Math.min(1, left / el.total) : 0, key = p.toFixed(2) + (left > 0.05 ? Math.ceil(left) : '');
  if (key === el.last) return; el.last = key;
  el.cd.style.setProperty('--p', p);
  if (el.cn) el.cn.textContent = left > 0.95 ? Math.ceil(left) : '';
}

// ------------------------------------------------------------- Démarrage
show('sHome');
if (joinCode && myName) $('#btnJoin').focus();
})();
