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
  mage:      { n: 'Mage',      ico: '🔮', r: 18, evos: ['liche', 'elementaire'], item: 'ice' },
  barbare:   { n: 'Barbare',   ico: '🪓', r: 20, evos: ['golem', 'minotaure'], item: 'barr' },
  ninja:     { n: 'Ninja',     ico: '🥷', r: 17, evos: ['serpent', 'kitsune'], item: 'mine' },
  archer:    { n: 'Archer',    ico: '🏹', r: 17, evos: ['phenix', 'sylphe'], item: 'trap' },
  paladin:   { n: 'Paladin',   ico: '🛡️', r: 19, evos: ['archange', 'noir'], item: 'banner' },
  ingenieur: { n: 'Ingénieur', ico: '🔧', r: 18, evos: ['mecha', 'essaim'], item: 'elec' },
  druide:    { n: 'Druide',    ico: '🌿', r: 18, evos: ['ent', 'loupgarou'], item: 'seed' },
  vampire:   { n: 'Vampire',   ico: '🦇', r: 18, evos: ['seigneur', 'gargouille'], item: 'vial' }
};
// toutes les formes : classes de départ + évolutions
const FORMS = {
  mage: { n: 'Mage', sk: ['Boule de feu', 'Téléportation'] },
  liche: { n: 'Liche', ico: '💀', sk: ["Nuée d'âmes", 'Squelettes'] },
  elementaire: { n: 'Élémentaire de feu', ico: '🔥', sk: ['Météore', 'Aura de flammes'] },
  barbare: { n: 'Barbare', sk: ['Charge', 'Tourbillon'] },
  golem: { n: 'Golem', ico: '🗿', sk: ['Séisme', 'Carapace'] },
  minotaure: { n: 'Minotaure', ico: '🐂', sk: ['Charge dévastatrice', 'Rugissement'] },
  ninja: { n: 'Ninja', sk: ['Shurikens', 'Invisibilité'] },
  serpent: { n: 'Serpent géant', ico: '🐍', sk: ['Morsure', 'Constriction'] },
  kitsune: { n: 'Kitsune', ico: '🦊', sk: ['Clones', 'Feux follets'] },
  archer: { n: 'Archer', sk: ['Flèche perçante', 'Pluie de flèches'] },
  phenix: { n: 'Phénix', ico: '🔥', sk: ['Pluie de feu', 'Renaissance'] },
  sylphe: { n: 'Sylphe', ico: '🍃', sk: ['Tempête', 'Rafale'] },
  paladin: { n: 'Paladin', sk: ['Coup de bouclier', 'Aura de soin'] },
  archange: { n: 'Archange', ico: '😇', sk: ['Lumière divine', 'Bénédiction'] },
  noir: { n: 'Chevalier noir', ico: '⚫', sk: ['Frappe des ténèbres', 'Aura vampirique'] },
  ingenieur: { n: 'Ingénieur', sk: ['Tourelle', 'Grenade'] },
  mecha: { n: 'Mécha', ico: '🤖', sk: ['Missiles', 'Blindage'] },
  essaim: { n: 'Essaim', ico: '🛸', sk: ['Drones', 'Bombardement'] },
  druide: { n: 'Druide', sk: ['Ronces', 'Régénération'] },
  ent: { n: 'Ent', ico: '🌳', sk: ['Racines', 'Écorce'] },
  loupgarou: { n: 'Loup-garou', ico: '🐺', sk: ['Bond', 'Frénésie'] },
  vampire: { n: 'Vampire', sk: ['Morsure', 'Nuée de chauves-souris'] },
  seigneur: { n: 'Seigneur vampire', ico: '🧛', sk: ['Drain', 'Nuée sanglante'] },
  gargouille: { n: 'Gargouille', ico: '🗿', sk: ['Plongeon', 'Pétrification'] }
};
const ITEMS = {
  ice: { n: 'Totem de glace', ico: '❄️' }, barr: { n: 'Barricade', ico: '🧱' }, mine: { n: 'Mine', ico: '💣' }, trap: { n: 'Piège à loup', ico: '🪤' },
  gpotion: { n: 'Potion de groupe', ico: '🧪' }, elec: { n: 'Clôture électrique', ico: '⚡' }, shroom: { n: 'Champignon', ico: '🍄' }, vial: { n: 'Fiole de sang', ico: '🩸' },
  banner: { n: 'Étendard (−30 % dégâts)', ico: '🚩' }, seed: { n: 'Graine empoisonnée', ico: '🌰' },
  potion: { n: 'Potion', ico: '❤️' }, bomb: { n: 'Bombe', ico: '💥' }, haste: { n: 'Bottes de vitesse', ico: '👟' }, armor: { n: 'Armure', ico: '🛡️' }
};
const SK_ICO = { 'Boule de feu': '🔥', 'Téléportation': '✨', "Nuée d'âmes": '👻', 'Squelettes': '💀', 'Charge': '🐂', 'Tourbillon': '🌀',
  'Séisme': '💥', 'Carapace': '🛡️', 'Shurikens': '✴️', 'Invisibilité': '🌫️', 'Morsure': '🦷', 'Constriction': '⛓️',
  'Météore': '☄️', 'Aura de flammes': '🔥', 'Charge dévastatrice': '🐂', 'Rugissement': '📢', 'Clones': '👥', 'Feux follets': '🦊',
  'Flèche perçante': '🎯', 'Pluie de flèches': '🌧️', 'Pluie de feu': '☄️', 'Renaissance': '🪶', 'Tempête': '🌪️', 'Rafale': '💨',
  'Coup de bouclier': '🛡️', 'Aura de soin': '💚', 'Lumière divine': '✨', 'Bénédiction': '🙏', 'Frappe des ténèbres': '🗡️', 'Aura vampirique': '🩸',
  'Tourelle': '🔫', 'Grenade': '💣', 'Missiles': '🚀', 'Blindage': '🛡️', 'Drones': '🛸', 'Bombardement': '💥',
  'Ronces': '🌿', 'Régénération': '💚', 'Racines': '🌱', 'Écorce': '🪵', 'Bond': '🐾', 'Frénésie': '😡',
  'Nuée de chauves-souris': '🦇', 'Bouclier divin': '✨', 'Forme de brume': '🌫️', 'Tempête ultime': '⚡', 'Drain': '🩸', 'Nuée sanglante': '🦇', 'Plongeon': '⬇️', 'Pétrification': '🗿' };
// compétence ajoutée par l'évolution (3e) et par l'ultime (4e)
const EVO_ADD = { liche: 'Squelettes', elementaire: 'Météore', golem: 'Carapace', minotaure: 'Rugissement', serpent: 'Constriction', kitsune: 'Clones',
  phenix: 'Renaissance', sylphe: 'Rafale', archange: 'Bouclier divin', noir: 'Aura vampirique', mecha: 'Missiles', essaim: 'Bombardement',
  ent: 'Écorce', loupgarou: 'Frénésie', seigneur: 'Forme de brume', gargouille: 'Pétrification' };
const ULT_ADD = 'Tempête ultime';
const isUlt = p => !!(p.fl & 32768);
const skillsOf = p => { const f = formOf(p), l = [...FORMS[clsOf(p.id)].sk]; if (EVO_ADD[f]) l.push(EVO_ADD[f]); if (isUlt(p)) l.push(ULT_ADD); return l; };
const shortSk = n => ({ 'Tempête ultime': 'Ultime', 'Bouclier divin': 'Protection', 'Forme de brume': 'Brume', 'Aura vampirique': 'Aura', 'Téléportation': 'Téléport', 'Nuée de chauves-souris': 'Chauves-souris', 'Charge dévastatrice': 'Charge', 'Frappe des ténèbres': 'Ténèbres',
  'Aura vampirique': 'Aura', 'Aura de flammes': 'Flammes', 'Coup de bouclier': 'Bouclier', 'Pluie de flèches': 'Pluie', 'Flèche perçante': 'Perçante' }[n] || n);
const MAPS = {
  colisee: { n: 'Colisée romain', ico: '🏛️' }, jungle: { n: 'Jungle amazonienne', ico: '🌴' }, urbain: { n: 'Zone urbaine', ico: '🏙️' },
  desert: { n: 'Désert', ico: '🏜️', tip: 'Attention aux sables mouvants : ils ralentissent !' },
  espace: { n: 'Planète spatiale', ico: '🪐' },
  glace: { n: 'Désert glacé', ico: '🧊', tip: 'Fuis les geysers quand ils bouillonnent !' },
  dinos: { n: 'Monde des dinosaures', ico: '🦖', tip: 'Gare au T-Rex !' },
  apo: { n: 'Zone post-apo', ico: '☣️', tip: 'Les zombies rôdent…' }
};
const MOBN = { gladiateur: 'Gladiateur', lion: 'Lion', jaguar: 'Jaguar', guerrier: 'Guerrier', voyou: 'Voyou', drone: 'Drone', squelette: 'Squelette',
  scorpion: 'Scorpion', nomade: 'Nomade', alien: 'Alien', sentinelle: 'Sentinelle', loup: 'Loup des glaces', yeti: 'Yéti', geyser: 'Un geyser',
  raptor: 'Raptor', dilopho: 'Dilophosaure', trex: 'T-Rex', zombie: 'Zombie', coureur: 'Zombie coureur', tank: 'Gros zombie' };
const MOBR = { tourelle: 16, minidrone: 12, clone: 16, gladiateur: 18, lion: 17, jaguar: 16, guerrier: 17, voyou: 17, drone: 14, squelette: 15, scorpion: 16, nomade: 17, alien: 16, sentinelle: 15, loup: 16, yeti: 24,
  raptor: 15, dilopho: 17, trex: 30, zombie: 16, coureur: 15, tank: 27 };
const mobR = m => (MOBR[m.type] || 16) * (m.fl & 128 ? 1.6 : 1);
const TEAMC = ['#ff5a5a', '#4da3ff'], TEAMN = ['Rouge', 'Bleue'];

const store = { get(k) { try { return localStorage.getItem('arene_' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('arene_' + k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem('arene_' + k); } catch (e) {} } };
const getSess = () => { try { return JSON.parse(store.get('sess') || 'null'); } catch (e) { return null; } };

// ----------------------------------------------------------------- État
let ws = null, myId = null, roomId = null, hostId = null, screen = 'home', cfg = null, roster = [], teamScore = [0, 0];
let map = null, decor = [], snaps = [], clockOff = null, fx = [], floats = [], feed = [], banner = null, trails = new Map();
let myName = store.get('name') || '', myCls = store.get('cls') || 'mage';
if (!CLASSES[myCls]) myCls = 'mage';
const joinCode = (new URLSearchParams(location.search).get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
let shake = 0, lastHp = null, wasAlive = true;

// ------------------------------------------------------------ Interface
function show(id) {
  if (window.SND) SND.music(id === null ? (map ? map.key : 'menu') : 'menu');
  for (const s of ['sHome', 'sLobby', 'sEnd', 'sLost']) $('#' + s).classList.toggle('hidden', s !== id);
  const playing = id === null;
  document.body.classList.toggle('playing', playing);
  $('#touch').classList.toggle('hidden', !(playing && isTouch));
  $('#gameBar').classList.toggle('hidden', !playing);
  if (!playing) { $('#quitBox').classList.add('hidden'); $('#pauseBox').classList.add('hidden'); }
  if (roomId) $('#gameCode').textContent = roomId;
}
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }

function classCards(el, onPick) {
  el.innerHTML = '';
  for (const k in CLASSES) {
    const c = CLASSES[k], b = document.createElement('button');
    b.className = 'cls' + (k === myCls ? ' on' : ''); b.dataset.k = k;
    b.innerHTML = `<div class="ico">${c.ico}</div><div class="nm">${c.n}</div><div class="ev">→ ${FORMS[c.evos[0]].n} / ${FORMS[c.evos[1]].n}</div><div class="sk">${FORMS[k].sk.join(' · ')}<br>${ITEMS[c.item].ico} ${ITEMS[c.item].n}</div>`;
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
function joinRoom(code) { const n = readName(); if (!n) return; connect(() => send({ t: 'join', room: code, name: n, cls: myCls })); }
$('#btnJoin').onclick = () => joinRoom(joinCode);
$('#btnCode').onclick = () => {
  const c = $('#codeIn').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length < 4) { toast('Entre le code de la partie (5 caractères).'); $('#codeIn').focus(); return; }
  joinRoom(c);
};
$('#codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnCode').click(); });
document.querySelectorAll('.btnLeave').forEach(b => b.onclick = () => { leaving = true; send({ t: 'leave' }); store.del('sess'); setTimeout(() => { location.href = '/'; }, 150); });

// ---- liste des parties en cours (accueil)
const STATE_TXT = { lobby: 'Salon ouvert', playing: 'En cours', ended: 'Terminée' };
async function refreshRooms() {
  if (screen !== 'home' || document.hidden) return;
  let list;
  try { const r = await fetch('/api/rooms', { cache: 'no-store' }); list = await r.json(); }
  catch (e) { $('#roomList').innerHTML = '<div class="wait">Impossible de charger la liste.</div>'; return; }
  $('#roomsInfo').textContent = list.length ? `(${list.length})` : '';
  if (!list.length) { $('#roomList').innerHTML = '<div class="wait">Aucune partie pour l’instant. Crée la première !</div>'; return; }
  $('#roomList').innerHTML = list.map(r => {
    const full = r.players >= r.max;
    const t = r.survival ? (r.wave != null ? ` · vague ${r.wave}` : ` · ${r.lives} vie${r.lives > 1 ? 's' : ''}`)
      : r.left != null ? ` · ${Math.floor(r.left / 60)}:${String(r.left % 60).padStart(2, '0')} restantes` : ` · ${r.duration} min`;
    return `<div class="room m-${r.map}"><span class="ri">${MAPS[r.map].ico}</span><div class="rt">
      <div class="rh">Partie de ${esc(r.host)}</div>
      <div class="rs"><span class="st ${r.state}" style="margin:0 4px 0 0">${STATE_TXT[r.state] || r.state}</span>${MAPS[r.map].n} · ${r.survival ? '🛡️ Survie' : r.teams ? '2 équipes' : 'Chacun pour soi'} · 👥 ${r.players}/${r.max}${t}</div></div>
      <button class="btn" data-code="${r.code}" ${full ? 'disabled' : ''}>${full ? 'Complète' : 'Rejoindre'}</button></div>`;
  }).join('');
  $('#roomList').querySelectorAll('button[data-code]').forEach(b => b.onclick = () => joinRoom(b.dataset.code));
}
refreshRooms(); setInterval(refreshRooms, 3000);
$('#btnStart').onclick = () => { send({ t: 'start' }); goFullscreen(); };
$('#btnAgain').onclick = () => send({ t: 'again' });
document.querySelectorAll('#gameBar button, .modal').forEach(b => b.addEventListener('pointerdown', e => e.stopPropagation()));
// quitter / pause
let paused = false;
function quitGame() { leaving = true; send({ t: 'leave' }); store.del('sess'); setTimeout(() => { location.href = '/'; }, 150); }
$('#btnQuit').onclick = () => { resetInput(); $('#quitBox').classList.remove('hidden'); };
$('#quitNo').onclick = () => $('#quitBox').classList.add('hidden');
$('#quitYes').onclick = quitGame;
$('#pauseQuit').onclick = quitGame;
$('#btnPause').onclick = () => send({ t: 'pause', on: 1 });
$('#btnResume').onclick = () => send({ t: 'pause', on: 0 });
function setPaused(on) {
  paused = on; resetInput();
  const host = hostId === myId;
  $('#pauseBox').classList.toggle('hidden', !on);
  $('#btnResume').classList.toggle('hidden', !host);
  $('#pauseMsg').textContent = host ? 'La partie est en pause pour tout le monde.' : "L'hôte a mis la partie en pause.";
  if (!on) { snaps = []; clockOff = null; }
}
function updPauseBtn() { $('#btnPause').classList.toggle('hidden', hostId !== myId); if (paused) setPaused(true); }
$('#gameInvite').onclick = () => shareLink();
$('#btnShare').onclick = () => shareLink();
async function shareLink() {
  const url = location.origin + '/?r=' + roomId;
  if (navigator.share) { try { await navigator.share({ title: "L'Arène des Artefacts", text: 'Rejoins ma partie !', url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('Lien copié ! Envoie-le à tes amis.'); }
  catch (e) { prompt('Copie ce lien et envoie-le :', url); }
}

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
  const mode = $('#cfgMode'); mode.innerHTML = '';
  for (const [v, label] of [['ffa', '⚔️ Chacun pour soi'], ['teams', '🔴🔵 2 équipes'], ['surv', '🛡️ Survie (coop)']]) {
    const b = document.createElement('button'); b.className = 'chip'; b.textContent = label; b.dataset.v = v;
    b.onclick = () => { if (hostId === myId) send({ t: 'cfg', cfg: { teams: v === 'teams', survival: v === 'surv' } }); };
    mode.appendChild(b);
  }
  chipRow($('#cfgLives'), [[1, '1 vie'], [3, '3 vies'], [5, '5 vies'], [10, '10 vies']], 'lives');
})();
$('#botAdd').onclick = () => send({ t: 'bot', op: 'add' });
$('#botDel').onclick = () => send({ t: 'bot', op: 'del' });
(() => { const el = $('#botLvl'); for (const [v, l] of [['facile', '😊 Facile'], ['normal', '😐 Normal'], ['difficile', '😈 Difficile']]) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.v = v; b.textContent = l; b.onclick = () => send({ t: 'cfg', cfg: { bots: v } }); el.appendChild(b); } })();
function renderLobby() {
  if (!cfg) return;
  const isHost = hostId === myId;
  $('#lCode').textContent = roomId;
  $('#cfgWho').textContent = isHost ? '(tu es l’hôte)' : '(choisis par l’hôte)';
  document.querySelectorAll('#cfgMap .map').forEach(b => { b.classList.toggle('on', b.dataset.v === cfg.map); b.disabled = !isHost; });
  document.querySelectorAll('#cfgDur .chip').forEach(b => { b.classList.toggle('on', +b.dataset.v === cfg.duration); b.disabled = !isHost; });
  document.querySelectorAll('#cfgScore .chip').forEach(b => { b.classList.toggle('on', +b.dataset.v === cfg.score); b.disabled = !isHost; });
  const curMode = cfg.survival ? 'surv' : cfg.teams ? 'teams' : 'ffa';
  document.querySelectorAll('#cfgMode .chip').forEach(b => { b.classList.toggle('on', b.dataset.v === curMode); b.disabled = !isHost; });
  document.querySelectorAll('#cfgLives .chip').forEach(b => { b.classList.toggle('on', +b.dataset.v === cfg.lives); b.disabled = !isHost; });
  $('#cfgPvp').classList.toggle('hidden', !!cfg.survival); $('#cfgSurv').classList.toggle('hidden', !cfg.survival);
  $('#pCount').textContent = `(${roster.length}/6)`;
  $('#pList').innerHTML = roster.map(p => `<div class="pl ${cfg.teams ? 't' + p.team : ''} ${p.dc ? 'dc' : ''}"><span class="ico">${CLASSES[p.cls].ico}</span><span class="n">${esc(p.name)}${p.id === myId ? ' (toi)' : ''}</span>${p.bot ? '<span class="small">bot</span>' : ''}${p.dc ? '<span class="small">reconnexion…</span>' : ''}${p.id === hostId ? '<span class="b">HÔTE</span>' : ''}</div>`).join('');
  const tp = $('#teamPick');
  if (cfg.teams) {
    const me = roster.find(p => p.id === myId);
    tp.innerHTML = `<span class="small">Ton équipe :</span>` + [0, 1].map(t => `<button class="chip ${me && me.team === t ? 'on' : ''}" data-t="${t}" style="border-color:${TEAMC[t]}">Équipe ${TEAMN[t]}</button>`).join('');
    tp.querySelectorAll('button').forEach(b => b.onclick = () => send({ t: 'team', team: +b.dataset.t }));
  } else tp.innerHTML = '';
  $('#botBox').classList.toggle('hidden', !isHost);
  $('#botAdd').disabled = roster.length >= 6; $('#botDel').disabled = !roster.some(p => p.bot);
  document.querySelectorAll('#botLvl .chip').forEach(b => b.classList.toggle('on', b.dataset.v === (cfg.bots || 'normal')));
  $('#btnStart').classList.toggle('hidden', !isHost);
  $('#waitHost').classList.toggle('hidden', isHost);
  const me = roster.find(p => p.id === myId);
  if (me && me.cls !== myCls) { myCls = me.cls; }
  document.querySelectorAll('#lobbyClasses .cls').forEach(x => x.classList.toggle('on', x.dataset.k === myCls));
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderEnd(m) {
  if (m.survival) {
    const rows = m.ranking.map((p, i) => `<tr><td>${i === 0 && p.kills > 0 ? '⭐' : i + 1}</td><td>${CLASSES[p.cls].ico} <b>${esc(p.name)}</b>${p.id === myId ? ' <span class="small">(toi)</span>' : ''}</td><td class="num">${p.kills}</td><td class="num">${p.deaths}</td></tr>`).join('');
    $('#endRows').innerHTML = rows;
    $('#endWin').innerHTML = `🛡️ Vous avez tenu jusqu'à la vague ${m.wave} !`;
    const isHost = hostId === myId;
    $('#btnAgain').classList.toggle('hidden', !isHost); $('#waitAgain').classList.toggle('hidden', isHost);
    return;
  }
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
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(() => { try { window.screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
  } catch (e) {}
}

// --------------------------------------------------------------- Réseau
let leaving = false, retries = 0, retryT = 0;
function connect(onOpen) {
  if (ws) { if (ws.readyState === 1) onOpen(); else ws._pending = onOpen; return; }
  const sock = ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  sock.onopen = () => { retries = 0; (sock._pending || onOpen)(); };
  sock.onmessage = e => onMsg(JSON.parse(e.data));
  sock.onclose = () => {
    if (ws === sock) ws = null;
    if (leaving) return;
    if (roomId) scheduleReconnect();
    else toast('Impossible de joindre le serveur. Réessaie dans quelques secondes.');
  };
}
// le téléphone coupe la connexion quand on quitte l'appli (partage du lien…) : on se reconnecte tout seul
function scheduleReconnect() {
  clearTimeout(retryT);
  if (retries++ > 20) { $('#lostMsg').textContent = 'Le serveur ne répond plus.'; show('sLost'); return; }
  if (retries > 1) toast('Reconnexion…');
  retryT = setTimeout(resumeNow, retries === 1 ? 100 : 1500);
}
function resumeNow() {
  const s = getSess();
  if (!s || ws) return;
  connect(() => send({ t: 'resume', room: s.room, token: s.token }));
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && roomId && !ws && !leaving) { retries = 0; resumeNow(); } });
addEventListener('pageshow', () => { if (roomId && !ws && !leaving) { retries = 0; resumeNow(); } });
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

function onMsg(m) {
  switch (m.t) {
    case 'joined':
      myId = m.id; roomId = m.room; hostId = m.host; cfg = m.cfg;
      store.set('sess', JSON.stringify({ room: m.room, token: m.token }));
      history.replaceState(null, '', '?r=' + roomId);
      if (m.state === 'lobby') { screen = 'lobby'; show('sLobby'); }
      break;
    case 'resumeFail':
      store.del('sess');
      if (roomId) { $('#lostMsg').textContent = 'Cette partie est terminée ou n’existe plus.'; show('sLost'); roomId = null; }
      else { screen = 'home'; show('sHome'); }
      break;
    case 'left': break;
    case 'roster': {
      roster = m.players; hostId = m.host; cfg = m.cfg; teamScore = m.ts;
      if (m.state === 'lobby' && screen !== 'lobby') { screen = 'lobby'; show('sLobby'); }
      if (screen === 'lobby') renderLobby();
      if (screen === 'game') updPauseBtn();
      if (screen === 'end') { $('#btnAgain').classList.toggle('hidden', hostId !== myId); $('#waitAgain').classList.toggle('hidden', hostId === myId); }
      break;
    }
    case 'start':
      map = m.map; cfg = m.cfg; seenProj = new Set(); if (window.SND) SND.play('start'); buildDecor(); snaps = []; clockOff = null; fx = []; floats = []; feed = []; trails.clear(); banner = null;
      lastHp = null; wasAlive = true; screen = 'game'; show(null); paused = false; updPauseBtn(); setupSkillButtons(null); itemKey = ''; evoShown = false; $('#evoPick').classList.add('hidden');
      banner = { text: MAPS[map.key].n, sub: MAPS[map.key].tip || 'Collecte 10 artefacts pour évoluer !', t: performance.now(), d: 3000 };
      break;
    case 's': onSnap(m); break;
    case 'pause': setPaused(!!m.on); break;
    case 'end': screen = 'end'; paused = false; show('sEnd'); renderEnd(m);
      if (window.SND) { const first = m.ranking[0]; SND.play(m.survival || (first && first.id === myId) || (m.teams && m.ts[teamOf(myId)] > m.ts[1 - teamOf(myId)]) ? 'win' : 'lose'); } resetInput(); evoShown = false; $('#evoPick').classList.add('hidden'); break;
    case 'err': toast(m.msg); break;
  }
}

// ------------------------------------------------------ Instantanés
function onSnap(m) {
  const now = performance.now() / 1000;
  const off = now - m.n;
  clockOff = clockOff == null ? off : Math.min(off, clockOff + 0.003);
  const s = { n: m.n, tl: m.tl, ts: m.ts, sv: m.sv, P: new Map(), M: new Map(), R: new Map(), A: m.a, Wl: m.w || [], TR: m.tr || [], Z: m.z || [], C: m.c || [] };
  for (const p of m.p) s.P.set(p[0], { id: p[0], x: p[1], y: p[2], f: p[3], hp: p[4], mhp: p[5], fl: p[6], art: p[7], cd: [p[8], p[9], p[10], p[17] || 0, p[18] || 0], ra: p[11], lv: p[12], ev: p[13], it: p[14], bo: p[15], inx: p[16] });
  for (const x of m.m) s.M.set(x[0], { id: x[0], type: x[1], x: x[2], y: x[3], f: x[4], hp: x[5], mhp: x[6], own: x[7], fl: x[8] });
  const nowSeen = new Set();
  for (const x of m.pr) {
    s.R.set(x[0], { id: x[0], k: x[1], x: x[2], y: x[3] });
    nowSeen.add(x[0]);
    if (!seenProj.has(x[0]) && PROJ_SND[x[1]]) sfx(PROJ_SND[x[1]], x[2], x[3], 0.8);
  }
  seenProj = nowSeen;
  snaps.push(s); if (snaps.length > 40) snaps.shift();
  teamScore = m.ts;
  for (const e of m.e) onEvent(e);
  const me = s.P.get(myId);
  if (me) {
    if (lastHp != null && me.hp < lastHp && (me.fl & 1)) { shake = Math.min(10, shake + 4); vibrate(25); }
    lastHp = me.hp;
    const f = formOf(me) + (isUlt(me) ? '+' : '');
    if (f !== curForm) setupSkillButtons(f);
    updItemBtn(me);
    showEvoPick(!!(me.fl & 1024) && (me.fl & 1));
  }
}
function vibrate(ms) { if (isTouch && window.SND) SND.vib(ms); }
// ---------- sons : volume selon la distance à la caméra
function sfx(name, x, y, boost = 1) {
  if (!window.SND) return;
  let v = boost;
  if (x != null && cam) { const d = Math.hypot(x - cam.x, y - cam.y); v *= Math.max(0, 1 - d / 900); }
  SND.play(name, v);
}
const PROJ_SND = { bolt: 'magic', bolt2: 'magic', bolt3: 'fire', soul: 'magic', foxfire: 'magic', plasmab: 'magic', plasma: 'magic', fire: 'fire', firearrow: 'fire',
  arrow: 'arrow', arrow2: 'arrow', arrowh: 'arrow', bigarrow: 'arrow', spear: 'arrow', thorn: 'arrow', rivet: 'gun', laser: 'gun', shuri: 'shuri',
  grenade: 'launch', rocket: 'launch', bat: 'bat', acid: 'spit' };
let seenProj = new Set();
function eventSound(e) {
  const me = e.i === myId;
  switch (e.k) {
    case 'hit': if (me) sfx('hit'); else sfx('tick', e.x, e.y, 0.6); break;
    case 'slash': sfx(e.f === 'golem' || e.f === 'minotaure' || e.f === 'ent' || e.f === 'barbare' ? 'heavy' : 'swing', e.x, e.y); break;
    case 'bite': sfx('swing', e.x, e.y, 0.5); break;
    case 'boom': case 'quake': sfx('boom', e.x, e.y); break;
    case 'blink': sfx('magic', e.x1, e.y1); break;
    case 'smoke': case 'gust': case 'grab': sfx('whoosh', e.x || e.x1, e.y || e.y1); break;
    case 'summon': sfx('summon', e.x, e.y); break;
    case 'shield': sfx('shield', e.x, e.y); break;
    case 'roar': sfx('roar', e.x, e.y); break;
    case 'holy': sfx('chime', e.x, e.y); break;
    case 'drain': sfx('magic', e.x1, e.y1); break;
    case 'chain': sfx('zap', e.pts[0][0], e.pts[0][1]); break;
    case 'snap': sfx('snap', e.x, e.y); break;
    case 'die': sfx('die', e.x, e.y, 0.7); break;
    case 'pick': if (me) sfx('pick'); break;
    case 'crate': if (me) sfx('crate'); break;
    case 'item': if (me) sfx('item'); break;
    case 'heal': if (me && e.h >= 3) sfx('heal'); break;
    case 'spawn': if (me) sfx('spawn'); break;
    case 'evo': if (me) sfx(e.on ? 'evo' : 'lose'); break;
    case 'rebirth': sfx('evo', e.x, e.y); break;
    case 'ult': if (e.on) sfx('ult', e.x, e.y, me ? 1.3 : 1); break;
    case 'kill': if (e.ak === myId) sfx('kill'); else if (e.bk === myId) sfx('death'); break;
    case 'wave': sfx(e.st === 'start' ? 'wave' : 'win'); break;
    case 'boss': sfx('boss'); break;
  }
}
const nameOf = id => { const p = roster.find(q => q.id === id); return p ? p.name : '?'; };
const clsOf = id => { const p = roster.find(q => q.id === id); return p ? p.cls : 'mage'; };
const teamOf = id => { const p = roster.find(q => q.id === id); return p ? p.team : 0; };
const isAlly = id => id === myId || !!(cfg && (cfg.survival || (cfg.teams && teamOf(id) === teamOf(myId))));
const formOf = p => (p.fl & 2) && p.ev >= 0 ? CLASSES[clsOf(p.id)].evos[p.ev] : clsOf(p.id);

function onEvent(e) {
  eventSound(e);
  const t = performance.now();
  switch (e.k) {
    case 'hit': floats.push({ x: e.x + (Math.random() * 16 - 8), y: e.y, text: e.d, col: e.i === myId ? '#ff6b6b' : '#fff', t, d: 700 }); break;
    case 'slash': fx.push({ k: 'slash', ...e, t, d: 160 }); break;
    case 'bite': fx.push({ k: 'slash', x: e.x, y: e.y, a: e.a, r: 40, arc: 1.2, f: 'mob', t, d: 140 }); break;
    case 'boom': fx.push({ k: 'boom', ...e, t, d: 380 }); shakeNear(e.x, e.y, 5); break;
    case 'quake': fx.push({ k: 'quake', ...e, t, d: 600 }); shakeNear(e.x, e.y, 9); break;
    case 'blink': fx.push({ k: 'poof', x: e.x1, y: e.y1, c: '#b48bff', t, d: 400 }, { k: 'poof', x: e.x2, y: e.y2, c: '#e2d2ff', t, d: 400 }); break;
    case 'shield': fx.push({ k: 'ring', x: e.x, y: e.y, c: '#7fe0ff', t, d: 600 }); break;
    case 'smoke': fx.push({ k: 'poof', x: e.x, y: e.y, c: '#9aa0b5', t, d: 600, big: 1 }); break;
    case 'summon': fx.push({ k: 'poof', x: e.x, y: e.y, c: '#7dffb2', t, d: 500 }); break;
    case 'grab': fx.push({ k: 'grab', ...e, t, d: 450 }); break;
    case 'puff': fx.push({ k: 'puff', ...e, t, d: 220 }); break;
    case 'die': fx.push({ k: 'burst', x: e.x, y: e.y, c: '#c9b28a', t, d: 500 }); break;
    case 'pick':
      fx.push({ k: 'spark', x: e.x, y: e.y, t, d: 450 });
      if (e.i === myId) { vibrate(15); if (e.h > 0) floats.push({ x: e.x, y: e.y - 20, text: '+' + e.h + ' PV', col: '#6fdc8c', t, d: 900 }); }
      break;
    case 'wave':
      if (e.st === 'start') { banner = { text: 'VAGUE ' + e.n, sub: e.boss ? '⚠️ Un boss approche !' : 'Les ennemis arrivent…', t, d: 2400, gold: e.boss ? 1 : 0 }; vibrate(40); }
      else { banner = { text: 'Vague ' + e.n + ' repoussée !', sub: '+25 % de vie · prochaine vague dans 6 s', t, d: 2600, gold: 1 }; }
      break;
    case 'boss': addFeed('⚠️ Le BOSS est arrivé !', '#ffb347'); shake = 8; break;
    case 'spawn': fx.push({ k: 'ring', x: e.x, y: e.y, c: '#fff', t, d: 500 }); break;
    case 'evo': {
      fx.push({ k: 'evo', x: e.x, y: e.y, on: e.on, t, d: 1000 });
      const fn = (FORMS[e.f] || { n: '?' }).n;
      if (e.i === myId) { banner = e.on ? { text: 'ÉVOLUTION !', sub: fn + ' : +50 % vie, +30 % dégâts, + ' + (EVO_ADD[e.f] || ''), t, d: 2800, gold: 1 } : { text: 'Évolution perdue', sub: 'Moins de 10 artefacts…', t, d: 2000 }; vibrate(e.on ? [60, 40, 120] : 80); shake = 10; }
      else if (e.on) addFeed(`${nameOf(e.i)} est devenu ${fn} !`, '#ffd98a');
      break;
    }
    case 'ult':
      fx.push({ k: 'evo', x: e.x, y: e.y, on: 1, t, d: 1400 }, { k: 'ring', x: e.x, y: e.y, c: '#7fe8ff', t, d: 900 });
      if (e.i === myId) { banner = e.on ? { text: 'ÉVOLUTION ULTIME !', sub: 'Vie ×2, dégâts +60 %, régénération + Tempête ultime', t, d: 3200, gold: 1 } : { text: 'Évolution ultime perdue', sub: 'Moins de 50 artefacts…', t, d: 2000 }; vibrate(e.on ? [80, 40, 80, 40, 200] : 80); shake = 12; }
      else if (e.on) addFeed(`⚡ ${nameOf(e.i)} a atteint l'évolution ULTIME !`, '#7fe8ff');
      break;
    case 'chain': fx.push({ k: 'chain', pts: e.pts, t, d: 380 }); shakeNear(e.pts[0][0], e.pts[0][1], 4); break;
    case 'heal': if (e.h >= 3) floats.push({ x: e.x + (Math.random() * 16 - 8), y: e.y, text: '+' + e.h, col: '#6fdc8c', t, d: 800 }); break;
    case 'rebirth': fx.push({ k: 'evo', x: e.x, y: e.y, on: 1, t, d: 900 }); if (e.i === myId) banner = { text: 'RENAISSANCE !', sub: 'Le phénix renaît de ses cendres', t, d: 2000, gold: 1 }; else addFeed(`${nameOf(e.i)} renaît de ses cendres !`, '#ffb347'); break;
    case 'holy': fx.push({ k: 'holy', x: e.x, y: e.y, r: e.r, t, d: 600 }); break;
    case 'roar': fx.push({ k: 'ring', x: e.x, y: e.y, c: '#ff8a4a', t, d: 600 }); shakeNear(e.x, e.y, 6); break;
    case 'gust': fx.push({ k: 'poof', x: e.x, y: e.y, c: '#d8fff0', t, d: 500, big: 1 }); break;
    case 'drain': fx.push({ k: 'drain', ...e, t, d: 450 }); break;
    case 'snap': fx.push({ k: 'burst', x: e.x, y: e.y, c: '#bbb', t, d: 400 }); break;
    case 'spark': fx.push({ k: 'spark', x: e.x, y: e.y, t, d: 450 }); break;
    case 'item': if (e.it === 'barr' || e.it === 'mine' || e.it === 'trap' || e.it === 'shroom') fx.push({ k: 'ring', x: e.x, y: e.y, c: '#ffd76a', t, d: 350 }); break;
    case 'crate':
      fx.push({ k: 'spark', x: e.x, y: e.y, t, d: 450 });
      if (e.i === myId) { const it = ITEMS[e.it]; floats.push({ x: e.x, y: e.y - 30, text: it.ico + ' ' + it.n, col: '#ffd76a', t, d: 1500, big: 1 }); vibrate(30); }
      break;
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
  return { P, M, R, A: b.A, Wl: b.Wl, TR: b.TR, Z: b.Z, C: b.C, latest: snaps[snaps.length - 1], serverNow: performance.now() / 1000 - clockOff };
}

// ---------------------------------------------------------------- Entrées
const input = { mx: 0, my: 0, b: 0, aim: null };
const keys = new Set();
let mouse = { x: 0, y: 0, in: false, down: false };
function resetInput() { input.mx = input.my = input.b = 0; keys.clear(); mouse.down = false; joy.id = null; $('#joy').classList.add('hidden'); document.querySelectorAll('.tb').forEach(b => b.classList.remove('down')); }
addEventListener('keydown', e => {
  if (screen !== 'game') return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (hostId === myId) send({ t: 'pause', on: paused ? 0 : 1 }); else $('#btnQuit').click(); return; }
  if (paused) return;
  keys.add(k);
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
const btnBits = { bAtk: 1, bS1: 2, bS2: 4, bItem: 8, bS3: 16, bS4: 32 };
let touchB = 0;
for (const id in btnBits) {
  const el = $('#' + id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); goFullscreen(); try { el.setPointerCapture(e.pointerId); } catch (er) {} touchB |= btnBits[id]; el.classList.add('down'); });
  const up = e => { touchB &= ~btnBits[id]; el.classList.remove('down'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
}
let curForm = null;
function setupSkillButtons(form) {
  curForm = form || myClsInGame();
  const ult = curForm.endsWith('+'), f = curForm.replace('+', ''), base = FORMS[myClsInGame()].sk;
  const set = (id, n) => { const el = $('#' + id); el.classList.toggle('hidden', !n); if (!n) return; el.querySelector('.e').textContent = SK_ICO[n] || '✦'; el.querySelector('.s').textContent = shortSk(n); };
  set('bS1', base[0]); set('bS2', base[1]); set('bS3', EVO_ADD[f] || null); set('bS4', ult ? ULT_ADD : null);
}
let itemKey = '';
function updItemBtn(me) {
  const kind = me.bo || CLASSES[clsOf(myId)].item, it = ITEMS[kind], key = kind + me.it + (me.bo ? 1 : 0);
  if (key === itemKey) return; itemKey = key;
  const el = $('#bItem');
  el.querySelector('.e').textContent = it.ico;
  el.querySelector('.s').textContent = me.bo ? 'Bonus' : 'Objet';
  el.querySelector('.cnt').textContent = me.bo ? '★' : '×' + me.it;
  el.classList.toggle('bonus', !!me.bo); el.classList.toggle('empty', !me.bo && me.it <= 0);
}
// choix de l'évolution
let evoShown = false;
function showEvoPick(on) {
  if (on === evoShown) return; evoShown = on;
  const box = $('#evoPick');
  box.classList.toggle('hidden', !on);
  if (!on) return;
  const c = CLASSES[clsOf(myId)];
  box.querySelectorAll('button').forEach((b, k) => {
    const f = FORMS[c.evos[k]];
    const add = EVO_ADD[c.evos[k]];
    b.innerHTML = `<span class="ei">${f.ico}</span><b>${f.n}</b><small>+ ${SK_ICO[add] || ''} ${add}</small>`;
  });
  vibrate([40, 30, 40]);
}
document.querySelectorAll('#evoPick button').forEach(b => {
  b.addEventListener('pointerdown', e => e.stopPropagation());
  b.onclick = () => { send({ t: 'evo', k: +b.dataset.k }); evoShown = true; $('#evoPick').classList.add('hidden'); };
});
function myClsInGame() { const p = roster.find(q => q.id === myId); return p ? p.cls : myCls; }

let lastSent = '', lastSentT = 0;
setInterval(() => {
  if (screen !== 'game' || paused) return;
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
  if (keys.has('r') || keys.has('2')) b |= 4;
  if (keys.has('f')) b |= 8;
  if (keys.has('c') || keys.has('3')) b |= 16;
  if (keys.has('v') || keys.has('4')) b |= 32;
  if (evoShown && !$('#evoPick').classList.contains('hidden')) { if (keys.has('1') || keys.has('&')) { keys.delete('1'); keys.delete('&'); $('#evoPick button[data-k="0"]').click(); } }
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
  urbain:  { out: '#1b1c20', ground: '#3a3c42', ground2: '#34363b' },
  desert:  { out: '#6b4a24', ground: '#e6c07e', ground2: '#d4a862' },
  espace:  { out: '#04030b', ground: '#2b2542', ground2: '#3a3258' },
  glace:   { out: '#2b4a5e', ground: '#e8f3f8', ground2: '#cfe3ee' },
  dinos:   { out: '#2a1a10', ground: '#7a9a45', ground2: '#6b8a3c' },
  apo:     { out: '#1c1a15', ground: '#7a7360', ground2: '#6a6452' }
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

let cam = { x: 0, y: 0 }, curSN = 0;
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
  if (me && (me.fl & 1 || me.lv !== 0)) { cam.x = me.x; cam.y = me.y; }
  else { const mate = rs.P.find(p => p.fl & 1); if (mate) { cam.x += (mate.x - cam.x) * 0.15; cam.y += (mate.y - cam.y) * 0.15; } else if (me) { cam.x = me.x; cam.y = me.y; } }
  shake *= 0.88; if (shake < 0.2) shake = 0;
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  const s = SC * DPR;
  ctx.setTransform(s, 0, 0, s, (W / 2 + sx) * DPR - cam.x * s, (H / 2 + sy) * DPR - cam.y * s);
  const view = { x0: cam.x - W / 2 / SC - 80, x1: cam.x + W / 2 / SC + 80, y0: cam.y - H / 2 / SC - 80, y1: cam.y + H / 2 / SC + 80 };
  const vis = (x, y, r = 0) => x + r > view.x0 && x - r < view.x1 && y + r > view.y0 && y - r < view.y1;

  curSN = rs.serverNow;
  drawGround(vis, now);
  // artefacts
  for (const a of rs.A) if (vis(a[1], a[2])) drawArtifact(a[1], a[2], now + a[0] * 300);
  drawZones(rs.Z, now, rs.serverNow);
  drawTraps(rs.TR, now);
  drawObstacles(vis);
  drawWalls(rs.Wl);
  drawCrates(rs.C, now);
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
  for (const m of rs.M) {
    if (!vis(m.x, m.y, 60)) continue;
    const boss = m.fl & 128, rr = mobR(m);
    if (boss) { bar(m.x, m.y - rr - 14, 90, 8, m.hp / m.mhp, '#ff3b3b'); label(m.x, m.y - rr - 20, '☠ BOSS ' + (MOBN[m.type] || ''), '#ffb347'); }
    else if (m.hp < m.mhp) bar(m.x, m.y - rr - 10, 34, 5, m.hp / m.mhp, m.own === -1 ? '#e8a54a' : (isAlly(m.own) ? '#7dffb2' : '#ff8a5a'));
  }
  for (const p of rs.P) {
    if (!(p.fl & 1) || ((p.fl & 4) && !isAlly(p.id)) || !vis(p.x, p.y, 120)) continue;
    const r = heroR(p);
    const col = p.id === myId ? '#6fdc8c' : (isAlly(p.id) ? '#4da3ff' : '#ff5a5a');
    bar(p.x, p.y - r - 14, isUlt(p) ? 70 : p.fl & 2 ? 58 : 46, 7, p.hp / p.mhp, col);
    label(p.x, p.y - r - 22, (isUlt(p) ? '★★ ' : p.fl & 2 ? '★ ' : '') + nameOf(p.id) + '  ◆' + p.art, p.id === myId ? '#fff' : (isAlly(p.id) ? '#bfe0ff' : '#ffd0d0'));
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
  } else if (map.key === 'desert') {
    for (const d of decor) {
      if (!vis(d.x, d.y)) continue;
      if (d.r < 0.35) { ctx.strokeStyle = 'rgba(170,110,50,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(d.x - 40, d.y); ctx.quadraticCurveTo(d.x, d.y - 14 - d.s * 10, d.x + 40, d.y); ctx.stroke(); }
      else if (d.r < 0.42) { ctx.fillStyle = '#f2e6cf'; ctx.beginPath(); ctx.ellipse(d.x, d.y, 9, 4, d.s * 3, 0, 7); ctx.fill(); ctx.fillRect(d.x - 2, d.y - 2, 4, 4); }
      else { ctx.fillStyle = 'rgba(160,110,60,.25)'; ctx.beginPath(); ctx.arc(d.x, d.y, 2 + d.s * 3, 0, 7); ctx.fill(); }
    }
  } else if (map.key === 'espace') {
    for (const d of decor) {
      if (!vis(d.x, d.y)) continue;
      if (d.r < 0.12) { const rr = 18 + d.s * 40; ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(d.x, d.y, rr, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(130,115,190,.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(d.x - 2, d.y - 2, rr, Math.PI, Math.PI * 1.8); ctx.stroke(); }
      else if (d.r < 0.2) { ctx.fillStyle = `rgba(120,255,220,${0.35 + 0.3 * Math.sin(now / 400 + d.s * 9)})`; ctx.beginPath(); ctx.arc(d.x, d.y, 3, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = 'rgba(200,190,255,.12)'; ctx.beginPath(); ctx.arc(d.x, d.y, 1.5 + d.s * 2, 0, 7); ctx.fill(); }
    }
  } else if (map.key === 'dinos') {
    for (const d of decor) {
      if (!vis(d.x, d.y)) continue;
      if (d.r < 0.08) { ctx.strokeStyle = `rgba(255,${90 + 40 * Math.sin(now / 300 + d.s * 7) | 0},20,.75)`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(d.x - 30, d.y); ctx.lineTo(d.x - 8, d.y + 10); ctx.lineTo(d.x + 12, d.y - 6); ctx.lineTo(d.x + 34, d.y + 4); ctx.stroke(); }
      else if (d.r < 0.25) { ctx.fillStyle = 'rgba(90,60,30,.4)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, 30 + d.s * 40, 18 + d.s * 22, d.s * 3, 0, 7); ctx.fill(); }
      else if (d.r < 0.32) { ctx.fillStyle = 'rgba(70,50,30,.35)'; for (const [ox, oy] of [[0, 0], [8, -5], [8, 5], [-6, 0]]) { ctx.beginPath(); ctx.ellipse(d.x + ox * 1.5, d.y + oy * 1.5, 4, 2.5, 0, 0, 7); ctx.fill(); } }
      else { ctx.strokeStyle = d.r < 0.7 ? '#93b85a' : '#5f7e32'; ctx.lineWidth = 2.5; ctx.beginPath(); for (let k = -1; k <= 1; k++) { ctx.moveTo(d.x + k * 4, d.y); ctx.lineTo(d.x + k * 7, d.y - 8 - d.s * 6); } ctx.stroke(); }
    }
  } else if (map.key === 'apo') {
    for (const d of decor) {
      if (!vis(d.x, d.y)) continue;
      if (d.r < 0.15) { ctx.strokeStyle = 'rgba(40,35,25,.55)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 20, d.y + 8); ctx.lineTo(d.x + 30, d.y - 6); ctx.moveTo(d.x + 20, d.y + 8); ctx.lineTo(d.x + 26, d.y + 24); ctx.stroke(); }
      else if (d.r < 0.24) { ctx.fillStyle = 'rgba(100,20,20,.35)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, 10 + d.s * 14, 6 + d.s * 8, d.s * 3, 0, 7); ctx.fill(); }
      else if (d.r < 0.3) { ctx.fillStyle = 'rgba(90,200,60,.25)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, 22 + d.s * 26, 14 + d.s * 14, d.s * 2, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = 'rgba(50,45,35,.35)'; ctx.fillRect(d.x, d.y, 3 + d.s * 6, 2 + d.s * 4); }
    }
  } else if (map.key === 'glace') {
    for (const d of decor) {
      if (!vis(d.x, d.y)) continue;
      if (d.r < 0.15) { ctx.fillStyle = 'rgba(150,200,230,.35)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, 40 + d.s * 50, 22 + d.s * 25, d.s * 3, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.stroke(); }
      else if (d.r < 0.45) { ctx.strokeStyle = 'rgba(140,175,200,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 14, d.y + 6); ctx.lineTo(d.x + 22, d.y - 4); ctx.stroke(); }
      else { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(d.x, d.y, 1.5 + d.s * 2, 0, 7); ctx.fill(); }
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
  for (const h of (map.haz || [])) if (vis(h.x, h.y, h.r)) drawHaz(h, now);
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 10; ctx.strokeRect(-5, -5, map.w + 10, map.h + 10);
}
function geyserPhase(h) { return (curSN + h.ph) % 5; } // 0-3 calme, 3-3.8 alerte, 3.8-5 jaillit
function drawHaz(h, now) {
  if (h.t === 'sand') {
    const g = ctx.createRadialGradient(h.x, h.y, 5, h.x, h.y, h.r);
    g.addColorStop(0, '#9c6a32'); g.addColorStop(.7, '#bf8a4a'); g.addColorStop(1, 'rgba(214,168,98,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(110,70,30,.45)'; ctx.lineWidth = 3;
    for (let i = 1; i <= 3; i++) { const a = now / (900 + i * 300) * (i % 2 ? 1 : -1); ctx.beginPath(); ctx.arc(h.x, h.y, h.r * i / 4, a, a + 4); ctx.stroke(); }
  } else if (h.t === 'geyser') {
    const ph = geyserPhase(h);
    ctx.fillStyle = 'rgba(120,170,200,.35)'; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * .45, 0, 7); ctx.stroke();
    ctx.fillStyle = '#3f6f8f'; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * .4, 0, 7); ctx.fill();
    if (ph >= 3 && ph < 3.8) { // alerte : ça bouillonne
      ctx.strokeStyle = `rgba(255,90,60,${0.5 + 0.5 * Math.sin(now / 60)})`; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(230,250,255,.85)';
      for (let i = 0; i < 6; i++) { const k = ((now / 300) + i / 6) % 1, a = i * 1.7; ctx.beginPath(); ctx.arc(h.x + Math.cos(a) * h.r * .25, h.y + Math.sin(a) * h.r * .25 - k * 14, 3 + k * 4, 0, 7); ctx.fill(); }
    } else if (ph >= 3.8) { // jaillissement
      ctx.fillStyle = 'rgba(255,80,60,.25)'; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.fill();
      for (let i = 0; i < 14; i++) {
        const k = ((now / 250) + i / 14) % 1, a = i * 2.4;
        ctx.fillStyle = `rgba(245,252,255,${0.9 - k * 0.6})`;
        ctx.beginPath(); ctx.arc(h.x + Math.cos(a) * h.r * .3 * k, h.y - k * 70 + Math.sin(a) * h.r * .2, 10 + k * 16, 0, 7); ctx.fill();
      }
    }
  }
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
    if (k === 'desert' || k === 'espace' || k === 'glace' || k === 'dinos' || k === 'apo') { drawObs2(o); continue; }
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
function drawObs2(o) {
  if (o.mesa) {
    ctx.fillStyle = '#b8743a'; rrect(o.x, o.y, o.w, o.h, 18); ctx.fill();
    ctx.fillStyle = '#d18c4c'; rrect(o.x + 8, o.y + 6, o.w - 20, o.h - 20, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(140,80,35,.6)'; ctx.lineWidth = 3;
    for (let y = o.y + 20; y < o.y + o.h - 12; y += 16) { ctx.beginPath(); ctx.moveTo(o.x + 14, y); ctx.lineTo(o.x + o.w - 22, y + 3); ctx.stroke(); }
  } else if (o.cactus) {
    ctx.fillStyle = '#3d8a3a'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#4fa84a'; ctx.beginPath(); ctx.arc(o.x - 3, o.y - 3, o.r * .65, 0, 7); ctx.fill();
    ctx.fillStyle = '#3d8a3a'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(o.x + s * o.r * 1.05, o.y - s * 4, o.r * .45, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ff7eb6'; ctx.beginPath(); ctx.arc(o.x + 3, o.y - 4, 3.5, 0, 7); ctx.fill();
  } else if (o.mod) {
    ctx.fillStyle = '#9aa3b5'; rrect(o.x, o.y, o.w, o.h, 14); ctx.fill();
    ctx.fillStyle = '#c3cad8'; rrect(o.x + 8, o.y + 8, o.w - 16, o.h - 16, 10); ctx.fill();
    ctx.fillStyle = '#5ac8fa';
    const hor = o.w > o.h;
    for (let i = 0; i < 4; i++) { if (hor) ctx.fillRect(o.x + 24 + i * (o.w - 48) / 3.5, o.y + o.h / 2 - 6, 18, 12); else ctx.fillRect(o.x + o.w / 2 - 6, o.y + 24 + i * (o.h - 48) / 3.5, 12, 18); }
    ctx.strokeStyle = '#5b6375'; ctx.lineWidth = 4; rrect(o.x, o.y, o.w, o.h, 14); ctx.stroke();
    ctx.fillStyle = '#ff5050'; ctx.beginPath(); ctx.arc(o.x + 14, o.y + 14, 4, 0, 7); ctx.fill();
  } else if (o.rock) {
    ctx.fillStyle = '#5d5470'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#776d8e'; ctx.beginPath(); ctx.arc(o.x - o.r * .2, o.y - o.r * .2, o.r * .7, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a4259'; ctx.beginPath(); ctx.arc(o.x + o.r * .25, o.y + o.r * .1, o.r * .22, 0, 7); ctx.arc(o.x - o.r * .3, o.y + o.r * .35, o.r * .13, 0, 7); ctx.fill();
  } else if (o.ice) {
    ctx.fillStyle = '#9fd3ea'; rrect(o.x, o.y, o.w, o.h, 8); ctx.fill();
    ctx.fillStyle = '#c9ecf8'; rrect(o.x + 6, o.y + 5, o.w - 16, o.h - 16, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(o.x + 14, o.y + 14); ctx.lineTo(o.x + o.w * .45, o.y + 14); ctx.stroke();
    ctx.strokeStyle = '#6aa8c6'; ctx.lineWidth = 3; rrect(o.x, o.y, o.w, o.h, 8); ctx.stroke();
  } else if (o.pine) {
    ctx.fillStyle = '#1f4d3a'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = i % 2 ? o.r * .7 : o.r; ctx.lineTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2f6b4f'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * .55, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(o.x - o.r * .3, o.y - o.r * .3, o.r * .3, 0, 7); ctx.arc(o.x + o.r * .35, o.y - o.r * .1, o.r * .2, 0, 7); ctx.fill();
  } else if (o.boulder) {
    ctx.fillStyle = '#3d3530'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#564b44'; ctx.beginPath(); ctx.arc(o.x - o.r * .2, o.y - o.r * .2, o.r * .72, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ff6a1f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(o.x - o.r * .5, o.y); ctx.lineTo(o.x, o.y + o.r * .2); ctx.lineTo(o.x + o.r * .3, o.y - o.r * .3); ctx.stroke();
  } else if (o.fern) {
    ctx.fillStyle = '#2f5a1f';
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; ctx.beginPath(); ctx.ellipse(o.x + Math.cos(a) * o.r * .55, o.y + Math.sin(a) * o.r * .55, o.r * .6, o.r * .22, a, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#4a8a2c'; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + .45; ctx.beginPath(); ctx.ellipse(o.x + Math.cos(a) * o.r * .4, o.y + Math.sin(a) * o.r * .4, o.r * .45, o.r * .16, a, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * .18, 0, 7); ctx.fill();
  } else if (o.bones) {
    ctx.strokeStyle = '#efe6cf'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(o.x + 10, o.y + o.h / 2); ctx.lineTo(o.x + o.w - 30, o.y + o.h / 2); ctx.stroke();
    ctx.lineWidth = 5; for (let x = o.x + 40; x < o.x + o.w - 50; x += 22) { ctx.beginPath(); ctx.moveTo(x, o.y + 2); ctx.quadraticCurveTo(x + 8, o.y + o.h / 2, x, o.y + o.h - 2); ctx.stroke(); }
    ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.ellipse(o.x + o.w - 22, o.y + o.h / 2, 24, 16, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a3020'; ctx.beginPath(); ctx.arc(o.x + o.w - 16, o.y + o.h / 2 - 5, 4, 0, 7); ctx.fill(); ctx.lineCap = 'butt';
  } else if (o.ruin) {
    ctx.fillStyle = '#5a554a'; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#6e685b'; ctx.fillRect(o.x + 10, o.y + 10, o.w - 20, o.h - 20);
    const R = seeded(o.seed * 31 + 7);
    ctx.fillStyle = '#4a463d'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(o.x + 20 + R() * (o.w - 40), o.y + 20 + R() * (o.h - 40), 6 + R() * 14, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#3a372f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(o.x + o.w * .2, o.y); ctx.lineTo(o.x + o.w * .35, o.y + o.h * .4); ctx.lineTo(o.x + o.w * .3, o.y + o.h * .7); ctx.stroke();
    ctx.strokeStyle = '#2e2b25'; ctx.lineWidth = 5; ctx.strokeRect(o.x, o.y, o.w, o.h);
  } else if (o.wreck) {
    ctx.fillStyle = '#6b4a32'; rrect(o.x, o.y, o.w, o.h, 8); ctx.fill();
    ctx.fillStyle = '#8a5a3a'; rrect(o.x + 4, o.y + 4, o.w - 8, o.h - 8, 6); ctx.fill();
    ctx.fillStyle = 'rgba(30,25,20,.7)'; if (o.w > o.h) ctx.fillRect(o.x + o.w * .3, o.y + 6, o.w * .3, o.h - 12); else ctx.fillRect(o.x + 6, o.y + o.h * .3, o.w - 12, o.h * .3);
    ctx.fillStyle = 'rgba(40,30,20,.6)'; ctx.beginPath(); ctx.arc(o.x + o.w * .7, o.y + o.h * .3, 6, 0, 7); ctx.fill();
  } else if (o.barrel) {
    ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7a6010'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * .7, 0, 7); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.font = '700 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('☢', o.x, o.y + 4);
  } else { ctx.fillStyle = '#888'; if (o.t === 'c') { ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill(); } else ctx.fillRect(o.x, o.y, o.w, o.h); }
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
function heroR(p) { return (CLASSES[clsOf(p.id)] || CLASSES.mage).r + (isUlt(p) ? 14 : p.fl & 2 ? 8 : 0); }
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
  if (isUlt(p)) {
    // aura ultime : halo doré + éclairs qui tournent
    const g = ctx.createRadialGradient(p.x, p.y, r * .6, p.x, p.y, r + 34);
    g.addColorStop(0, 'rgba(255,230,120,.45)'); g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r + 34, 0, 7); ctx.fill();
    ctx.strokeStyle = '#bff3ff'; ctx.lineWidth = 2; ctx.shadowColor = '#7fe8ff'; ctx.shadowBlur = 8;
    for (let i = 0; i < 3; i++) {
      const an = now / 260 + i * 2.1; ctx.beginPath();
      for (let j = 0; j <= 4; j++) { const aa = an + j * 0.18, rr = r + 18 + (j % 2 ? 7 : -3); ctx.lineTo(p.x + Math.cos(aa) * rr, p.y + Math.sin(aa) * rr); }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
  if (p.fl & 256) { // tourbillon
    ctx.strokeStyle = 'rgba(255,240,220,.7)'; ctx.lineWidth = 6;
    for (let i = 0; i < 3; i++) { const s = now / 70 + i * 2.1; ctx.beginPath(); ctx.arc(p.x, p.y, 80, s, s + 0.9); ctx.stroke(); }
  }
  if (p.fl & 512) { ctx.fillStyle = 'rgba(255,200,150,.25)'; ctx.beginPath(); ctx.arc(p.x - Math.cos(a) * 20, p.y - Math.sin(a) * 20, r, 0, 7); ctx.fill(); }

  if (p.fl & 2048) { ctx.strokeStyle = 'rgba(200,255,240,.6)'; ctx.lineWidth = 3; for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * (r + i * 8) - Math.sin(a) * (i - 2) * 8, p.y - Math.sin(a) * (r + i * 8) + Math.cos(a) * (i - 2) * 8); ctx.lineTo(p.x - Math.cos(a) * (r + i * 8 + 14) - Math.sin(a) * (i - 2) * 8, p.y - Math.sin(a) * (r + i * 8 + 14) + Math.cos(a) * (i - 2) * 8); ctx.stroke(); } }
  if (p.fl & 4096) { ctx.fillStyle = `rgba(255,60,30,${0.18 + 0.1 * Math.sin(now / 90)})`; ctx.beginPath(); ctx.arc(p.x, p.y, r + 10, 0, 7); ctx.fill(); }
  if (p.fl & 16384) { for (let i = 0; i < 6; i++) { const k = ((now / 500) + i / 6) % 1, an = i * 1.05; ctx.fillStyle = `rgba(255,${140 + 80 * k | 0},40,${1 - k})`; ctx.beginPath(); ctx.arc(p.x + Math.cos(an) * r * .9, p.y + Math.sin(an) * r * .9 - k * 26, 5 * (1 - k) + 2, 0, 7); ctx.fill(); } }
  ctx.translate(p.x, p.y);
  const form = formOf(p);
  if (form === 'serpent') { ctx.translate(-p.x, -p.y); drawSerpent(p, r, a, now); ctx.translate(p.x, p.y); }
  else (HERO_DRAW[form] || drawMage)(r, a, now);
  // statuts
  if (p.fl & 8192) { ctx.strokeStyle = 'rgba(210,215,225,.9)'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  if (p.fl & 8) { ctx.strokeStyle = 'rgba(120,220,255,.9)'; ctx.lineWidth = 4; hexa(r + 10); ctx.stroke(); ctx.fillStyle = 'rgba(120,220,255,.15)'; ctx.fill(); }
  statusFx(p.fl, r, now);
  ctx.restore();
}
// ---------- nouvelles formes
function cape(r, a, col, w = 1.25) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-Math.cos(a) * r * .25, -Math.sin(a) * r * .25, r * w, a + Math.PI - 1.4, a + Math.PI + 1.4); ctx.lineTo(0, 0); ctx.fill(); }
function wings(r, a, col, span, flap) {
  ctx.fillStyle = col;
  for (const sd of [-1, 1]) {
    const t2 = a + Math.PI / 2 * sd, back = a + Math.PI;
    ctx.beginPath(); ctx.moveTo(Math.cos(t2) * r * .5, Math.sin(t2) * r * .5);
    ctx.quadraticCurveTo(Math.cos(t2) * r * span + Math.cos(back) * r * .3, Math.sin(t2) * r * span + Math.sin(back) * r * .3 + flap * sd, Math.cos(t2 + sd * .5) * r * span * .8 + Math.cos(back) * r * .9, Math.sin(t2 + sd * .5) * r * span * .8 + Math.sin(back) * r * .9);
    ctx.lineTo(Math.cos(back) * r * .4, Math.sin(back) * r * .4); ctx.closePath(); ctx.fill();
  }
}
function weapon(r, a, off, len, col, w) { const hx = Math.cos(a + off) * r, hy = Math.sin(a + off) * r; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * len, hy + Math.sin(a) * len); ctx.stroke(); ctx.lineCap = 'butt'; return { x: hx + Math.cos(a) * len, y: hy + Math.sin(a) * len }; }
const HERO_DRAW = {
  mage: drawMage, liche: drawLiche, barbare: (r, a) => drawBarb(r, a), golem: (r, a) => drawGolem(r, a), ninja: drawNinja,
  elementaire(r, a, now) {
    for (let i = 3; i >= 1; i--) { ctx.fillStyle = ['#ffe58a', '#ffae3b', '#ff5a1f'][i - 1]; ctx.beginPath(); ctx.arc(-Math.cos(a) * i * 3 + Math.sin(now / 90 + i) * 2, -Math.sin(a) * i * 3, r * (0.5 + i * 0.25) + Math.sin(now / 70 + i) * 2, 0, 7); ctx.fill(); }
    for (let i = 0; i < 5; i++) { const k = ((now / 400) + i / 5) % 1, an = a + Math.PI + (i - 2) * 0.4; ctx.fillStyle = `rgba(255,${120 + 100 * k | 0},30,${1 - k})`; ctx.beginPath(); ctx.arc(Math.cos(an) * r * (0.9 + k), Math.sin(an) * r * (0.9 + k), 4 * (1 - k) + 1, 0, 7); ctx.fill(); }
    eyes(r * .8, a, '#fff6c0');
  },
  minotaure(r, a) {
    weapon(r, a, 0.9, 30, '#6b4423', 6);
    body(r, '#7a4a2a', '#3d2412');
    ctx.fillStyle = '#5a341c'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * .35, Math.sin(a) * r * .35, r * .62, r * .5, a, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2ead8';
    for (const sd of [-1, 1]) { const t2 = a + sd * 0.9; ctx.beginPath(); ctx.moveTo(Math.cos(t2 - .2) * r * .7, Math.sin(t2 - .2) * r * .7); ctx.quadraticCurveTo(Math.cos(t2 + sd * .4) * r * 1.7, Math.sin(t2 + sd * .4) * r * 1.7, Math.cos(a + sd * .25) * r * 1.6, Math.sin(a + sd * .25) * r * 1.6); ctx.lineTo(Math.cos(t2 + .2) * r * .7, Math.sin(t2 + .2) * r * .7); ctx.fill(); }
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .85, Math.sin(a) * r * .85, 4, 0, 7); ctx.stroke();
    eyes(r * .7, a, '#ff3b1f');
  },
  kitsune(r, a, now) {
    for (let i = 0; i < 9; i++) { const an = a + Math.PI + (i - 4) * 0.22 + Math.sin(now / 200 + i) * 0.05; ctx.fillStyle = i % 2 ? '#ff9a3c' : '#ffb35c'; ctx.beginPath(); ctx.ellipse(Math.cos(an) * r * 1.3, Math.sin(an) * r * 1.3, r * .75, r * .2, an, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(Math.cos(an) * r * 1.95, Math.sin(an) * r * 1.95, r * .14, 0, 7); ctx.fill(); }
    body(r, '#ff8a2a', '#a8501a');
    ctx.fillStyle = '#fff3e0'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * .5, Math.sin(a) * r * .5, r * .45, r * .32, a, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff8a2a'; for (const sd of [-1, 1]) { const t2 = a + sd * 0.75; ctx.beginPath(); ctx.moveTo(Math.cos(t2 - .25) * r * .8, Math.sin(t2 - .25) * r * .8); ctx.lineTo(Math.cos(t2) * r * 1.35, Math.sin(t2) * r * 1.35); ctx.lineTo(Math.cos(t2 + .25) * r * .8, Math.sin(t2 + .25) * r * .8); ctx.fill(); }
    eyes(r * .75, a, '#3a1a00');
  },
  archer(r, a) {
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .55, Math.sin(a) * r * .55, r * 1.05, a - 1.1, a + 1.1); ctx.stroke();
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.cos(a - 1.1) * r * 1.05 + Math.cos(a) * r * .55, Math.sin(a - 1.1) * r * 1.05 + Math.sin(a) * r * .55); ctx.lineTo(Math.cos(a + 1.1) * r * 1.05 + Math.cos(a) * r * .55, Math.sin(a + 1.1) * r * 1.05 + Math.sin(a) * r * .55); ctx.stroke();
    body(r, '#3f8f4a', '#1d4d24');
    ctx.fillStyle = '#2b6a34'; ctx.beginPath(); ctx.arc(-Math.cos(a) * r * .15, -Math.sin(a) * r * .15, r * .72, 0, 7); ctx.fill();
    ctx.fillStyle = '#f0d2b0'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .35, Math.sin(a) * r * .35, r * .38, 0, 7); ctx.fill();
    ctx.strokeStyle = '#a0522d'; ctx.lineWidth = 3; for (let i = -1; i <= 1; i++) { const an = a + Math.PI + i * 0.25; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r * .5, Math.sin(an) * r * .5); ctx.lineTo(Math.cos(an) * r * 1.25, Math.sin(an) * r * 1.25); ctx.stroke(); }
  },
  phenix(r, a, now) {
    wings(r, a, '#ff7a1a', 2.1, Math.sin(now / 110) * 8);
    ctx.globalAlpha *= 0.8; wings(r * .8, a, '#ffd23a', 1.9, Math.sin(now / 110) * 6); ctx.globalAlpha /= 0.8;
    body(r * .8, '#ff5a1f', '#a8300a');
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2); ctx.lineTo(Math.cos(a + .35) * r * .6, Math.sin(a + .35) * r * .6); ctx.lineTo(Math.cos(a - .35) * r * .6, Math.sin(a - .35) * r * .6); ctx.fill();
    eyes(r * .6, a, '#fff');
  },
  sylphe(r, a, now) {
    ctx.strokeStyle = 'rgba(190,255,235,.7)'; ctx.lineWidth = 2.5; for (let i = 0; i < 3; i++) { const s0 = now / 160 + i * 2.1; ctx.beginPath(); ctx.arc(0, 0, r * 1.45, s0, s0 + 1.2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(140,230,160,.75)'; for (const sd of [-1, 1]) { const t2 = a + Math.PI + sd * 0.9; ctx.beginPath(); ctx.ellipse(Math.cos(t2) * r * .95, Math.sin(t2) * r * .95, r * .85, r * .32, t2, 0, 7); ctx.fill(); }
    body(r, '#9ff0d8', '#3aa88a');
    ctx.fillStyle = '#e8fff6'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .3, Math.sin(a) * r * .3, r * .45, 0, 7); ctx.fill();
    eyes(r * .7, a, '#1a7a5a');
  },
  paladin(r, a) {
    weapon(r, a, 0.9, 24, '#9aa3ad', 5); const h = { x: Math.cos(a + .9) * r + Math.cos(a) * 24, y: Math.sin(a + .9) * r + Math.sin(a) * 24 };
    ctx.fillStyle = '#c9ced6'; ctx.fillRect(h.x - 6, h.y - 6, 12, 12);
    body(r, '#c9ced6', '#6e7682');
    ctx.fillStyle = '#d4af37'; ctx.fillRect(-3, -r * .6, 6, r * 1.2); ctx.fillRect(-r * .45, -3, r * .9, 6);
    const sx = Math.cos(a - 0.9) * r * 1.0, sy = Math.sin(a - 0.9) * r * 1.0;
    ctx.fillStyle = '#2e6bd1'; ctx.beginPath(); ctx.arc(sx, sy, r * .55, 0, 7); ctx.fill(); ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3; ctx.stroke();
  },
  archange(r, a, now) {
    wings(r, a, '#ffffff', 2.3, Math.sin(now / 160) * 5);
    ctx.strokeStyle = '#d9dee8'; ctx.lineWidth = 2; for (const sd of [-1, 1]) { const t2 = a + Math.PI / 2 * sd; ctx.beginPath(); ctx.moveTo(Math.cos(t2) * r * .7, Math.sin(t2) * r * .7); ctx.lineTo(Math.cos(t2) * r * 1.9, Math.sin(t2) * r * 1.9); ctx.stroke(); }
    body(r, '#fdfbf3', '#c9b26a');
    ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 3.5; ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, 0, r * .55, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
    eyes(r * .7, a, '#4da3ff');
  },
  noir(r, a) {
    cape(r, a, '#3a0d12');
    weapon(r, a, 1.0, 32, '#2a2a35', 5);
    body(r, '#2a2a35', '#0d0d12');
    ctx.fillStyle = '#44444f'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .2, Math.sin(a) * r * .2, r * .6, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff2a2a'; ctx.fillRect(Math.cos(a) * r * .55 - 2, Math.sin(a) * r * .55 - 2, 4, 4);
    eyes(r * .75, a, '#ff2a2a');
  },
  ingenieur(r, a) {
    weapon(r, a, 1.0, 20, '#8a8f99', 5);
    body(r, '#e07a1f', '#7a3d0a');
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(-Math.cos(a) * r * .1, -Math.sin(a) * r * .1, r * .7, 0, 7); ctx.fill();
    ctx.fillStyle = '#b8901a'; ctx.fillRect(-r * .7, -2, r * 1.4, 4);
    ctx.fillStyle = '#5ac8fa'; for (const sd of [-1, 1]) { const t2 = a + sd * .45; ctx.beginPath(); ctx.arc(Math.cos(t2) * r * .6, Math.sin(t2) * r * .6, r * .18, 0, 7); ctx.fill(); }
  },
  mecha(r, a) {
    ctx.save(); ctx.rotate(a);
    ctx.fillStyle = '#5b6375'; for (const sd of [-1, 1]) { rrect(r * .1, sd * r * 1.0 - r * .25, r * 1.2, r * .5, 4); ctx.fill(); ctx.fillStyle = '#2a2f3a'; ctx.fillRect(r * 1.1, sd * r * 1.0 - 4, r * .35, 8); ctx.fillStyle = '#5b6375'; }
    ctx.fillStyle = '#9aa3b5'; rrect(-r, -r * .85, r * 1.8, r * 1.7, 8); ctx.fill(); ctx.strokeStyle = '#3e4452'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#29d3ff'; rrect(r * .1, -r * .4, r * .55, r * .8, 4); ctx.fill();
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(-r * .8, -r * .7, r * .3, r * .3); ctx.restore();
  },
  essaim(r, a, now) {
    for (let i = 0; i < 4; i++) { const an = now / 300 + i * Math.PI / 2, x = Math.cos(an) * r * 1.5, y = Math.sin(an) * r * 1.5; ctx.fillStyle = '#4a4f5a'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#29d3ff'; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); }
    body(r, '#e07a1f', '#7a3d0a');
    ctx.fillStyle = '#2a2f3a'; ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, 7); ctx.fill();
    ctx.fillStyle = '#29d3ff'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .3, Math.sin(a) * r * .3, r * .25, 0, 7); ctx.fill();
  },
  druide(r, a, now) {
    weapon(r, a, 0.9, 26, '#6b4a24', 4);
    body(r, '#6b4a2a', '#3a2614');
    ctx.fillStyle = '#d9c09a'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .25, Math.sin(a) * r * .25, r * .45, 0, 7); ctx.fill();
    ctx.fillStyle = '#4fa84a'; for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2 + now / 2000; ctx.beginPath(); ctx.ellipse(Math.cos(an) * r * .7, Math.sin(an) * r * .7, r * .28, r * .13, an, 0, 7); ctx.fill(); }
  },
  ent(r, a, now) {
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; for (const sd of [-1, 1]) { const t2 = a + sd * 1.1; ctx.beginPath(); ctx.moveTo(Math.cos(t2) * r * .7, Math.sin(t2) * r * .7); ctx.lineTo(Math.cos(t2 - sd * .3) * r * 1.5, Math.sin(t2 - sd * .3) * r * 1.5); ctx.stroke(); } ctx.lineCap = 'butt';
    body(r, '#6b4a2a', '#3a2614');
    ctx.fillStyle = '#2f6b2a'; for (let i = 0; i < 7; i++) { const an = i / 7 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(an) * r * .55, Math.sin(an) * r * .55, r * .42, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#4fa84a'; ctx.beginPath(); ctx.arc(-r * .15, -r * .15, r * .45, 0, 7); ctx.fill();
    eyes(r * .85, a, '#b6ff5a');
  },
  loupgarou(r, a, now) {
    ctx.save(); ctx.rotate(a);
    ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.ellipse(-r * .1, 0, r * 1.15, r * .85, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#6e5c48'; ctx.beginPath(); ctx.moveTo(r * .4, -r * .55); ctx.lineTo(r * 1.55, 0); ctx.lineTo(r * .4, r * .55); ctx.fill();
    ctx.fillStyle = '#3e3226'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * .35, sd * r * .3); ctx.lineTo(r * .1, sd * r * .9); ctx.lineTo(r * .7, sd * r * .45); ctx.fill(); }
    ctx.strokeStyle = '#e8e2d6'; ctx.lineWidth = 2; for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(r * .6 + i * 4, sd * r * .9); ctx.lineTo(r * .9 + i * 4, sd * r * 1.05); ctx.stroke(); }
    ctx.fillStyle = '#ff3b1f'; ctx.beginPath(); ctx.arc(r * 1.0, -r * .2, 2.8, 0, 7); ctx.arc(r * 1.0, r * .2, 2.8, 0, 7); ctx.fill();
    ctx.restore();
  },
  vampire(r, a) {
    cape(r, a, '#8a0d1a');
    body(r, '#1a1a22', '#000');
    ctx.fillStyle = '#e8e0e8'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .3, Math.sin(a) * r * .3, r * .48, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.arc(-Math.cos(a) * r * .05, -Math.sin(a) * r * .05, r * .5, a + Math.PI - 1.2, a + Math.PI + 1.2); ctx.fill();
    eyes(r * .8, a, '#ff1a2a');
  },
  seigneur(r, a, now) {
    wings(r, a, '#2a0a12', 2.0, Math.sin(now / 130) * 6);
    cape(r, a, '#a8102a', 1.35);
    body(r, '#1a1a22', '#000');
    ctx.fillStyle = '#e8e0e8'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .3, Math.sin(a) * r * .3, r * .48, 0, 7); ctx.fill();
    ctx.fillStyle = '#d4af37'; for (let i = -2; i <= 2; i++) { const an = a + Math.PI + i * .35; ctx.beginPath(); ctx.moveTo(Math.cos(an - .12) * r * .55, Math.sin(an - .12) * r * .55); ctx.lineTo(Math.cos(an) * r * .85, Math.sin(an) * r * .85); ctx.lineTo(Math.cos(an + .12) * r * .55, Math.sin(an + .12) * r * .55); ctx.fill(); }
    eyes(r * .8, a, '#ff1a2a');
  },
  gargouille(r, a, now) {
    wings(r, a, '#6e6a66', 2.0, Math.sin(now / 200) * 3);
    body(r, '#8a857e', '#4a4640');
    ctx.strokeStyle = '#5c5852'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * .5, -r * .3); ctx.lineTo(0, r * .1); ctx.lineTo(r * .2, -r * .5); ctx.stroke();
    ctx.fillStyle = '#4a4640'; for (const sd of [-1, 1]) { const t2 = a + sd * .8; ctx.beginPath(); ctx.moveTo(Math.cos(t2 - .2) * r * .7, Math.sin(t2 - .2) * r * .7); ctx.lineTo(Math.cos(t2) * r * 1.35, Math.sin(t2) * r * 1.35); ctx.lineTo(Math.cos(t2 + .2) * r * .7, Math.sin(t2 + .2) * r * .7); ctx.fill(); }
    eyes(r * .75, a, '#ffb347');
  }
};
// ---------- monde : zones, pièges, barricades, caisses
function drawZones(Z, now, sn) {
  for (const [id, k, x, y, r, x2, y2, tm] of Z) {
    ctx.save();
    switch (k) {
      case 'rain': case 'firerain': {
        ctx.fillStyle = k === 'rain' ? 'rgba(180,200,220,.22)' : 'rgba(255,120,30,.25)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = k === 'rain' ? 'rgba(90,70,40,.85)' : 'rgba(255,200,60,.9)'; ctx.lineWidth = 2.5;
        for (let i = 0; i < 12; i++) { const ph = ((now / 250) + i * 0.37) % 1, an = i * 2.4, d = (i * 37 % 100) / 100 * r; const px = x + Math.cos(an) * d, py = y + Math.sin(an) * d - (1 - ph) * 40; ctx.globalAlpha = ph; ctx.beginPath(); ctx.moveTo(px, py - 12); ctx.lineTo(px, py); ctx.stroke(); }
        break;
      }
      case 'roots':
        ctx.fillStyle = 'rgba(60,120,40,.28)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = '#3c7a2a'; ctx.lineWidth = 4; for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2 + id; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(an + .5) * r * .5, y + Math.sin(an + .5) * r * .5, x + Math.cos(an) * r * .95, y + Math.sin(an) * r * .95); ctx.stroke(); }
        break;
      case 'regen':
        ctx.fillStyle = 'rgba(110,220,140,.14)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(110,220,140,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
        ctx.fillStyle = 'rgba(140,255,170,.8)'; for (let i = 0; i < 6; i++) { const ph = ((now / 900) + i / 6) % 1, an = i * 2.2; const px = x + Math.cos(an) * r * .6, py = y + Math.sin(an) * r * .6 - ph * 30; ctx.globalAlpha = 1 - ph; ctx.fillRect(px - 5, py - 1.5, 10, 3); ctx.fillRect(px - 1.5, py - 5, 3, 10); }
        break;
      case 'banner':
        ctx.fillStyle = 'rgba(255,215,110,.12)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,215,110,.6)'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#6b4a24'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x, y - 30); ctx.stroke();
        ctx.fillStyle = '#2e6bd1'; ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x + 24 + Math.sin(now / 200) * 3, y - 24); ctx.lineTo(x, y - 16); ctx.fill();
        ctx.fillStyle = '#ffd76a'; ctx.fillRect(x + 5, y - 26, 6, 6);
        break;
      case 'spore':
        for (let i = 0; i < 10; i++) { const an = i * 0.63 + now / 1500, d = (i * 29 % 100) / 100 * r * .8; ctx.fillStyle = `rgba(140,${170 + i * 5},60,${0.22 + 0.06 * Math.sin(now / 300 + i)})`; ctx.beginPath(); ctx.arc(x + Math.cos(an) * d, y + Math.sin(an) * d, r * .35, 0, 7); ctx.fill(); }
        break;
      case 'inferno': {
        const g = ctx.createRadialGradient(x, y, r * .2, x, y, r);
        g.addColorStop(0, 'rgba(255,200,60,.05)'); g.addColorStop(.7, 'rgba(255,90,20,.22)'); g.addColorStop(1, 'rgba(255,40,0,.35)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        for (let i = 0; i < 16; i++) {
          const ph = ((now / 500) + i / 16) % 1, an = i / 16 * Math.PI * 2 + now / 900;
          ctx.fillStyle = `rgba(255,${100 + 120 * ph | 0},30,${1 - ph})`; ctx.beginPath(); ctx.arc(x + Math.cos(an) * r * .92, y + Math.sin(an) * r * .92 - ph * 18, 7 * (1 - ph) + 2, 0, 7); ctx.fill();
        }
        break;
      }
      case 'flame': case 'dark':
        ctx.strokeStyle = k === 'flame' ? `rgba(255,120,30,${0.5 + 0.2 * Math.sin(now / 80)})` : `rgba(140,20,60,${0.5 + 0.2 * Math.sin(now / 120)})`; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
        ctx.fillStyle = k === 'flame' ? 'rgba(255,100,20,.12)' : 'rgba(90,10,40,.18)'; ctx.fill();
        break;
      case 'ice':
        ctx.fillStyle = 'rgba(170,225,255,.22)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(220,245,255,.8)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 10, y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        break;
      case 'elec': {
        ctx.strokeStyle = 'rgba(255,240,90,.35)'; ctx.lineWidth = r * 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); ctx.lineCap = 'butt';
        ctx.strokeStyle = '#fff36a'; ctx.lineWidth = 2.5; ctx.beginPath();
        const n = 10; for (let i = 0; i <= n; i++) { const k2 = i / n, j = (Math.random() - .5) * 12; ctx.lineTo(x + (x2 - x) * k2 - (y2 - y) / Math.hypot(x2 - x, y2 - y) * j, y + (y2 - y) * k2 + (x2 - x) / Math.hypot(x2 - x, y2 - y) * j); } ctx.stroke();
        ctx.fillStyle = '#5b6375'; for (const [px, py] of [[x, y], [x2, y2]]) { ctx.beginPath(); ctx.arc(px, py, 8, 0, 7); ctx.fill(); }
        break;
      }
      case 'blast': {
        const left = Math.max(0, tm - sn), k2 = Math.min(1, left / 0.8);
        ctx.strokeStyle = `rgba(255,60,40,${0.5 + 0.4 * Math.sin(now / 50)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
        ctx.fillStyle = 'rgba(255,80,40,.25)'; ctx.beginPath(); ctx.arc(x, y, r * (1 - k2), 0, 7); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}
function drawTraps(TR, now) {
  for (const [id, k, x, y, own] of TR) {
    if (!isAlly(own)) continue; // invisibles pour les ennemis
    ctx.save();
    if (k === 'mine') {
      ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill(); ctx.strokeStyle = '#777'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = Math.floor(now / 400 + id) % 2 ? '#ff2a2a' : '#6a1010'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill();
    } else if (k === 'seed') {
      ctx.fillStyle = '#7a4a1a'; ctx.beginPath(); ctx.ellipse(x, y, 9, 12, 0.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#9ccf4a'; ctx.beginPath(); ctx.ellipse(x + 3, y - 12, 4, 7, 0.6, 0, 7); ctx.fill();
    } else if (k === 'trap') {
      ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.stroke();
      for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * 12, y + Math.sin(an) * 12); ctx.lineTo(x + Math.cos(an) * 6, y + Math.sin(an) * 6); ctx.stroke(); }
    } else {
      ctx.fillStyle = '#f2ead8'; ctx.fillRect(x - 3, y, 6, 8);
      ctx.fillStyle = '#e03a3a'; ctx.beginPath(); ctx.arc(x, y, 11, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff'; for (const [dx, dy] of [[-5, -4], [3, -7], [5, -2]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 2, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }
}
function drawWalls(Wl) {
  for (const [id, x1, y1, x2, y2, hp, max, own] of Wl) {
    const L = Math.hypot(x2 - x1, y2 - y1), an = Math.atan2(y2 - y1, x2 - x1);
    ctx.save(); ctx.translate(x1, y1); ctx.rotate(an);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(4, -8, L, 24);
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(0, -12, L, 24);
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2; for (let x = 0; x < L; x += 16) { ctx.strokeRect(x, -12, 16, 24); }
    ctx.strokeStyle = '#4a2e14'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(L, 12); ctx.moveTo(0, 12); ctx.lineTo(L, -12); ctx.stroke();
    ctx.restore();
    if (hp < max) bar((x1 + x2) / 2, (y1 + y2) / 2 - 22, 44, 5, hp / max, isAlly(own) ? '#ffd76a' : '#ff8a5a');
  }
}
function drawCrates(C, now) {
  for (const [id, x, y] of C) {
    const b = Math.sin(now / 250 + id) * 2;
    ctx.fillStyle = `rgba(255,215,110,${0.2 + 0.1 * Math.sin(now / 200)})`; ctx.beginPath(); ctx.arc(x, y, 30, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 14 + 4, y - 14 + 6, 28, 28);
    ctx.fillStyle = '#b07a3a'; ctx.fillRect(x - 14, y - 14 + b, 28, 28);
    ctx.strokeStyle = '#6a4418'; ctx.lineWidth = 3; ctx.strokeRect(x - 14, y - 14 + b, 28, 28);
    ctx.beginPath(); ctx.moveTo(x - 14, y - 14 + b); ctx.lineTo(x + 14, y + 14 + b); ctx.stroke();
    ctx.fillStyle = '#ffd76a'; ctx.font = '800 16px Rubik,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', x, y + 6 + b);
  }
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
  const r = MOBR[m.type] || 16, a = m.f;
  ctx.save(); ctx.translate(m.x, m.y);
  if (m.fl & 128) {
    ctx.fillStyle = `rgba(255,60,40,${0.18 + 0.08 * Math.sin(now / 150)})`; ctx.beginPath(); ctx.arc(0, 0, r * 2.3, 0, 7); ctx.fill();
    ctx.scale(1.6, 1.6);
  }
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
    case 'scorpion': {
      ctx.save(); ctx.rotate(a);
      ctx.strokeStyle = '#5a3416'; ctx.lineWidth = 3;
      for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-r * .2 + i * r * .3, 0); ctx.lineTo(-r * .4 + i * r * .35, sd * r * 1.05); ctx.stroke(); }
      ctx.fillStyle = '#8a4f22'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .6, 0, 0, 7); ctx.fill();
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 1.1, sd * r * .55, r * .3, 0, 7); ctx.fill(); }
      const w = Math.sin(now / 200) * 4;
      ctx.strokeStyle = '#8a4f22'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r, 0); ctx.quadraticCurveTo(-r * 1.9, w, -r * 1.4, -r * .9); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = '#e8c040'; ctx.beginPath(); ctx.arc(-r * 1.4, -r * .9, 4, 0, 7); ctx.fill();
      ctx.restore(); break;
    }
    case 'nomade':
      ctx.strokeStyle = '#6b4a24'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .9, Math.sin(a) * r * .9, r * .8, a - 1.3, a + 1.3); ctx.stroke();
      body(r, '#e3d2b0', '#8a7350');
      ctx.fillStyle = '#2a6fa8'; ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, 7); ctx.fill();
      ctx.fillStyle = '#1d4e78'; ctx.fillRect(-r * .62, -3, r * 1.24, 6);
      break;
    case 'alien':
      body(r, '#6fdc5a', '#2d6b22');
      ctx.fillStyle = '#111'; for (const sd of [-1, 1]) { const t2 = a + sd * .45; ctx.beginPath(); ctx.ellipse(Math.cos(t2) * r * .5, Math.sin(t2) * r * .5, r * .32, r * .18, t2, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#2d6b22'; ctx.lineWidth = 2; for (const sd of [-1, 1]) { const t2 = a + Math.PI + sd * .5; ctx.beginPath(); ctx.moveTo(Math.cos(t2) * r * .8, Math.sin(t2) * r * .8); ctx.lineTo(Math.cos(t2) * r * 1.5, Math.sin(t2) * r * 1.5); ctx.stroke();
        ctx.fillStyle = '#e8ff5a'; ctx.beginPath(); ctx.arc(Math.cos(t2) * r * 1.5, Math.sin(t2) * r * 1.5, 3, 0, 7); ctx.fill(); }
      break;
    case 'sentinelle':
      ctx.fillStyle = 'rgba(120,220,255,.25)'; ctx.beginPath(); ctx.arc(0, 0, r * 1.5 + Math.sin(now / 200) * 2, 0, 7); ctx.fill();
      ctx.save(); ctx.rotate(a); ctx.fillStyle = '#c3cad8'; rrect(-r, -r * .8, r * 2, r * 1.6, 6); ctx.fill();
      ctx.fillStyle = '#5b6375'; ctx.fillRect(r * .6, -3, r * .8, 6);
      ctx.fillStyle = '#29d3ff'; ctx.beginPath(); ctx.arc(r * .1, 0, r * .35, 0, 7); ctx.fill(); ctx.restore();
      break;
    case 'loup':
      ctx.save(); ctx.rotate(a); ctx.fillStyle = '#c9d6e0'; ctx.beginPath(); ctx.ellipse(-r * .2, 0, r * 1.2, r * .7, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * .5, -r * .5); ctx.lineTo(r * 1.5, 0); ctx.lineTo(r * .5, r * .5); ctx.fill();
      ctx.fillStyle = '#8fa3b3'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * .5, sd * r * .25); ctx.lineTo(r * .3, sd * r * .75); ctx.lineTo(r * .8, sd * r * .35); ctx.fill(); }
      ctx.strokeStyle = '#c9d6e0'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 1.3, 0); ctx.lineTo(-r * 2, Math.sin(now / 160) * 5); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = '#3ad0ff'; ctx.beginPath(); ctx.arc(r * .95, -r * .18, 2.5, 0, 7); ctx.arc(r * .95, r * .18, 2.5, 0, 7); ctx.fill();
      ctx.restore(); break;
    case 'yeti':
      body(r, '#f4f8fb', '#9db3c2');
      for (const sd of [-1, 1]) { const t2 = a + sd * 1.3; ctx.fillStyle = '#e3ebf1'; ctx.beginPath(); ctx.arc(Math.cos(t2) * r * 1.05, Math.sin(t2) * r * 1.05, r * .38, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#7b8fa0'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .45, Math.sin(a) * r * .45, r * .42, 0, 7); ctx.fill();
      eyes(r * .8, a, '#4fd2ff');
      break;
    case 'raptor':
      ctx.save(); ctx.rotate(a);
      ctx.strokeStyle = '#4f7a2a'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * .8, 0); ctx.quadraticCurveTo(-r * 1.6, Math.sin(now / 120) * 6, -r * 2.2, 0); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = '#6b9a36'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .62, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#4f7a2a'; for (let i = -2; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * r * .3, 0, 3, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#7fb046'; ctx.beginPath(); ctx.ellipse(r * 1.05, 0, r * .55, r * .38, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(r * 1.15, -r * .18, 2.5, 0, 7); ctx.arc(r * 1.15, r * .18, 2.5, 0, 7); ctx.fill();
      ctx.restore(); break;
    case 'dilopho':
      ctx.save(); ctx.rotate(a);
      ctx.fillStyle = '#3f8a7a'; ctx.beginPath(); ctx.ellipse(-r * .1, 0, r * 1.05, r * .7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8b23a'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * .6, 0); ctx.arc(r * .75, 0, r * .9, sd > 0 ? 0.3 : -1.3, sd > 0 ? 1.3 : -0.3); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#56a894'; ctx.beginPath(); ctx.arc(r * .9, 0, r * .45, 0, 7); ctx.fill();
      ctx.fillStyle = '#c03030'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(r * .6, sd * r * .2, r * .25, r * .07, 0, 0, 7); ctx.fill(); }
      ctx.restore(); break;
    case 'trex':
      ctx.save(); ctx.rotate(a);
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * .8, 0); ctx.quadraticCurveTo(-r * 1.4, Math.sin(now / 200) * 8, -r * 1.9, 0); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = '#8a5f34'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .75, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6b4a2a'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * r * .28, 0, 4, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#9c6c3c'; rrect(r * .55, -r * .45, r * .95, r * .9, r * .3); ctx.fill();
      ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.fillRect(r * .9 + i * 6, -r * .47, 3, 5); ctx.fillRect(r * .9 + i * 6, r * .42, 3, 5); }
      ctx.fillStyle = '#ff3b1f'; ctx.beginPath(); ctx.arc(r * .85, -r * .25, 3.5, 0, 7); ctx.arc(r * .85, r * .25, 3.5, 0, 7); ctx.fill();
      ctx.restore(); break;
    case 'zombie': case 'coureur': case 'tank': {
      const skin = m.type === 'tank' ? '#6d8a5a' : '#8fae6c', shirt = { zombie: '#5a4a7a', coureur: '#8a3a3a', tank: '#4a4a4a' }[m.type];
      // bras tendus vers l'avant
      ctx.strokeStyle = skin; ctx.lineWidth = m.type === 'tank' ? 10 : 6; ctx.lineCap = 'round';
      for (const sd of [-1, 1]) { const t2 = a + sd * 0.7; ctx.beginPath(); ctx.moveTo(Math.cos(t2) * r * .6, Math.sin(t2) * r * .6); ctx.lineTo(Math.cos(t2) * r * .6 + Math.cos(a) * r * .9, Math.sin(t2) * r * .6 + Math.sin(a) * r * .9 + Math.sin(now / 150 + sd) * 2); ctx.stroke(); }
      ctx.lineCap = 'butt';
      body(r, shirt, '#222');
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .2, Math.sin(a) * r * .2, r * .58, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(120,20,20,.6)'; ctx.beginPath(); ctx.arc(-r * .2, r * .3, r * .18, 0, 7); ctx.fill();
      eyes(r * .85, a, m.type === 'coureur' ? '#ff3030' : '#e8ff5a');
      break;
    }
    case 'tourelle':
      ctx.fillStyle = '#5b6375'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill();
      ctx.save(); ctx.rotate(a); ctx.fillStyle = '#e07a1f'; ctx.beginPath(); ctx.arc(0, 0, r * .6, 0, 7); ctx.fill(); ctx.fillStyle = '#2a2f3a'; ctx.fillRect(0, -3, r * 1.3, 6); ctx.restore();
      break;
    case 'minidrone':
      ctx.save(); ctx.rotate(now / 100); ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#e07a1f'; ctx.beginPath(); ctx.arc(0, 0, r * .55, 0, 7); ctx.fill(); ctx.fillStyle = '#29d3ff'; ctx.beginPath(); ctx.arc(Math.cos(a) * 3, Math.sin(a) * 3, 3, 0, 7); ctx.fill();
      break;
    case 'clone':
      ctx.globalAlpha *= 0.65; HERO_DRAW.kitsune(r, a, now); break;
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
    case 'arrow':
      ctx.rotate(a); ctx.strokeStyle = '#6b4a24'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(8, 0); ctx.stroke();
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(5, -4); ctx.lineTo(5, 4); ctx.fill();
      ctx.fillStyle = '#c0392b'; ctx.fillRect(-18, -3, 5, 6); break;
    case 'plasma':
      ctx.shadowColor = '#29d3ff'; ctx.shadowBlur = 14; ctx.fillStyle = '#bff3ff'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
      ctx.globalAlpha = .4; ctx.fillStyle = '#29d3ff'; ctx.beginPath(); ctx.ellipse(-Math.cos(a) * 9, -Math.sin(a) * 9, 11, 5, a, 0, 7); ctx.fill(); break;
    case 'bolt3': case 'foxfire':
      ctx.shadowColor = p.k === 'bolt3' ? '#ff6a00' : '#ff9a3c'; ctx.shadowBlur = 14; ctx.fillStyle = p.k === 'bolt3' ? '#ffcf6a' : '#ffe0b0';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill(); ctx.globalAlpha = .5; ctx.fillStyle = p.k === 'bolt3' ? '#ff5a1f' : '#ff8a2a'; ctx.beginPath(); ctx.ellipse(-Math.cos(a) * 10, -Math.sin(a) * 10, 12, 5, a, 0, 7); ctx.fill(); break;
    case 'arrow2': case 'arrowh': case 'bigarrow': case 'firearrow': {
      const big = p.k === 'bigarrow' ? 1.5 : 1;
      ctx.rotate(a); if (p.k === 'firearrow') { ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 12; }
      if (p.k === 'arrowh') { ctx.shadowColor = '#7fffd4'; ctx.shadowBlur = 10; }
      ctx.strokeStyle = p.k === 'firearrow' ? '#ff8a2a' : '#8a5a2b'; ctx.lineWidth = 2.5 * big; ctx.beginPath(); ctx.moveTo(-18 * big, 0); ctx.lineTo(8 * big, 0); ctx.stroke();
      ctx.fillStyle = p.k === 'firearrow' ? '#ffd23a' : '#ddd'; ctx.beginPath(); ctx.moveTo(14 * big, 0); ctx.lineTo(5 * big, -4 * big); ctx.lineTo(5 * big, 4 * big); ctx.fill();
      ctx.fillStyle = p.k === 'arrowh' ? '#7fffd4' : '#3f8f4a'; ctx.fillRect(-18 * big, -3 * big, 5 * big, 6 * big); break;
    }
    case 'rivet':
      ctx.rotate(a); ctx.fillStyle = '#ffd23a'; ctx.fillRect(-6, -2, 12, 4); break;
    case 'plasmab':
      ctx.shadowColor = '#29d3ff'; ctx.shadowBlur = 12; ctx.fillStyle = '#bff3ff'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill(); break;
    case 'thorn':
      ctx.rotate(a); ctx.fillStyle = '#3c7a2a'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-8, -4); ctx.lineTo(-4, 0); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill(); break;
    case 'grenade':
      ctx.fillStyle = '#3e5a2a'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd23a'; ctx.fillRect(-2, -11, 4, 5); break;
    case 'rocket':
      ctx.rotate(a); ctx.fillStyle = '#c9ced6'; ctx.fillRect(-10, -4, 18, 8); ctx.fillStyle = '#e03a3a'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(8, -4); ctx.lineTo(8, 4); ctx.fill();
      ctx.fillStyle = `rgba(255,${150 + Math.random() * 80 | 0},40,.9)`; ctx.beginPath(); ctx.arc(-13, 0, 5 + Math.random() * 3, 0, 7); ctx.fill(); break;
    case 'bat': {
      ctx.rotate(a); const fl = Math.sin(now / 50) * 5; ctx.fillStyle = '#2a0a12';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-6, -10 - fl); ctx.lineTo(-2, -4); ctx.lineTo(4, -9 - fl); ctx.lineTo(3, 0); ctx.lineTo(4, 9 + fl); ctx.lineTo(-2, 4); ctx.lineTo(-6, 10 + fl); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff1a2a'; ctx.fillRect(2, -1.5, 2, 3); break;
    }
    case 'acid':
      ctx.fillStyle = 'rgba(160,255,60,.9)'; ctx.shadowColor = '#9eff3a'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
      ctx.globalAlpha = .45; ctx.beginPath(); ctx.ellipse(-Math.cos(a) * 9, -Math.sin(a) * 9, 10, 4, a, 0, 7); ctx.fill(); break;
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
    case 'chain': {
      ctx.globalAlpha = inv; ctx.strokeStyle = '#e8fbff'; ctx.shadowColor = '#4fd2ff'; ctx.shadowBlur = 16; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath(); ctx.moveTo(f.pts[0][0], f.pts[0][1]);
        for (let i = 1; i < f.pts.length; i++) {
          const [x0, y0] = f.pts[i - 1], [x1, y1] = f.pts[i], n = 6;
          for (let j = 1; j <= n; j++) { const k2 = j / n, jit = j === n ? 0 : (Math.random() - .5) * 22; ctx.lineTo(x0 + (x1 - x0) * k2 - (y1 - y0) / (Math.hypot(x1 - x0, y1 - y0) || 1) * jit, y0 + (y1 - y0) * k2 + (x1 - x0) / (Math.hypot(x1 - x0, y1 - y0) || 1) * jit); }
        }
        ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#7fe8ff';
      }
      ctx.fillStyle = '#fff'; for (const [x, y] of f.pts.slice(1)) { ctx.beginPath(); ctx.arc(x, y, 8 * inv + 2, 0, 7); ctx.fill(); }
      break;
    }
    case 'holy':
      ctx.globalAlpha = inv; ctx.fillStyle = 'rgba(255,240,170,.35)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + k * 0.6), 0, 7); ctx.fill();
      ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 4; ctx.stroke(); break;
    case 'drain':
      ctx.globalAlpha = inv; ctx.strokeStyle = '#d0102a'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(f.x2, f.y2);
      ctx.quadraticCurveTo((f.x1 + f.x2) / 2 + Math.sin(k * 9) * 20, (f.y1 + f.y2) / 2 + Math.cos(k * 9) * 20, f.x1, f.y1); ctx.stroke(); break;
    case 'grab':
      ctx.globalAlpha = inv; ctx.strokeStyle = '#3faa4c'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke(); break;
    case 'puff':
      ctx.globalAlpha = inv * .8; ctx.fillStyle = { bolt: '#c9a6ff', bolt2: '#7dffc4', soul: '#a0ffe0', shuri: '#ddd', spear: '#c9b28a', laser: '#ff6060', arrow: '#c9a070', plasma: '#7fe8ff', acid: '#a8ff4a', bolt3: '#ffae3b', foxfire: '#ffb35c', arrow2: '#c9a070', arrowh: '#7fffd4', bigarrow: '#c9a070', firearrow: '#ffae3b', rivet: '#ffd23a', plasmab: '#7fe8ff', thorn: '#4fa84a', bat: '#a8102a' }[f.c] || '#fff';
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
  if (cfg.survival && latest.sv) {
    const [wv, fight, left, next] = latest.sv;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; rrect(W / 2 - 80, T - 2, 160, 36, 10); ctx.fill();
    ctx.font = `800 ${sm ? 20 : 24}px Rubik,sans-serif`; ctx.fillStyle = '#ffd76a';
    ctx.fillText(wv ? `VAGUE ${wv}` : 'PRÉPAREZ-VOUS', W / 2, T + 25);
    ctx.font = '700 13px Rubik,sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
    const sub = fight ? `👾 ${left} ennemi${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}` : `Prochaine vague dans ${next} s`;
    ctx.strokeText(sub, W / 2, T + 52); ctx.fillStyle = fight ? '#ffb3a0' : '#bfffd0'; ctx.fillText(sub, W / 2, T + 52);
  } else {
  ctx.fillStyle = 'rgba(0,0,0,.45)'; rrect(W / 2 - 58, T - 2, 116, 36, 10); ctx.fill();
  ctx.font = `800 ${sm ? 22 : 26}px Rubik,sans-serif`; ctx.fillStyle = tl <= 30 ? '#ff6b6b' : '#fff';
  ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, W / 2, T + 25);
  }
  ctx.font = '700 13px Rubik,sans-serif';
  if (cfg.survival) {
  } else if (cfg.teams) {
    ctx.fillStyle = TEAMC[0]; ctx.textAlign = 'right'; ctx.fillText(`Rouge ${teamScore[0]}`, W / 2 - 8, T + 52);
    ctx.fillStyle = TEAMC[1]; ctx.textAlign = 'left'; ctx.fillText(`${teamScore[1]} Bleue`, W / 2 + 8, T + 52);
    ctx.textAlign = 'center';
    if (cfg.score) { ctx.fillStyle = '#ddd'; ctx.fillText(`objectif ${cfg.score}`, W / 2, T + 68); }
  } else if (cfg.score) { ctx.fillStyle = '#ddd'; ctx.fillText(`Objectif : ${cfg.score} élim.`, W / 2, T + 52); }

  // artefacts + stats du joueur
  if (me) {
    const evo = !!(me.fl & 2), cls = clsOf(myId), c = CLASSES[cls], fName = FORMS[formOf(me)].n;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; rrect(L - 4, T - 2, sm ? 196 : 232, sm ? 70 : 78, 10); ctx.fill();
    ctx.textAlign = 'left'; ctx.font = `800 ${sm ? 13 : 14}px Rubik,sans-serif`;
    ctx.fillStyle = evo ? '#ffd76a' : '#fff';
    ctx.fillText(isUlt(me) ? `★★ ${fName.toUpperCase()} ULTIME` : evo ? `★ ${fName.toUpperCase()} — ${me.art}/50` : (me.fl & 1024) ? `${c.n} — choisis ton évolution !` : `${c.n} — artefacts ${Math.min(me.art, 10)}/10`, L + 4, T + 16);
    const gs = sm ? 16 : 19;
    for (let i = 0; i < 10; i++) {
      const x = L + 6 + i * gs, y = T + 32, on = i < me.art;
      ctx.beginPath(); ctx.moveTo(x + 6, y - 9); ctx.lineTo(x + 12, y); ctx.lineTo(x + 6, y + 9); ctx.lineTo(x, y); ctx.closePath();
      ctx.fillStyle = on ? (evo ? '#ffd76a' : '#36d6f5') : 'rgba(255,255,255,.15)'; ctx.fill();
    }
    if (me.art > 10) { ctx.fillStyle = '#ffd76a'; ctx.font = '800 12px Rubik,sans-serif'; ctx.fillText('+' + (me.art - 10), L + 8 + 10 * gs, T + 37); }
    const mine = roster.find(p => p.id === myId) || { kills: 0, deaths: 0 };
    ctx.font = `700 ${sm ? 12 : 13}px Rubik,sans-serif`; ctx.fillStyle = '#ddd';
    ctx.fillText(cfg.survival ? `👾 ${mine.kills}   💖 ${Math.max(0, me.lv)} vie${me.lv > 1 ? 's' : ''}   ❤️ ${me.hp}/${me.mhp}` : `⚔️ ${mine.kills}   ☠️ ${mine.deaths}   ❤️ ${me.hp}/${me.mhp}`, L + 4, T + (sm ? 60 : 64));
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
  for (const h of (map.haz || [])) { ctx.fillStyle = h.t === 'sand' ? 'rgba(150,95,40,.7)' : (geyserPhase(h) >= 3 ? 'rgba(255,90,60,.9)' : 'rgba(90,150,190,.8)'); ctx.beginPath(); ctx.arc(mx + h.x * ms, my + h.y * ms, Math.max(2, h.r * ms), 0, 7); ctx.fill(); }
  ctx.fillStyle = '#ffb347'; for (const c of rs.C) ctx.fillRect(mx + c[1] * ms - 2.5, my + c[2] * ms - 2.5, 5, 5);
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
    const sk = skillsOf(me), sn = rs.serverNow;
    const ik = me.bo || CLASSES[clsOf(myId)].item, itm = ITEMS[ik];
    const itemReady = me.bo || me.it > 0 ? 0 : me.inx;
    if (isTouch) {
      updBtn('bAtk', me.cd[0], sn);
      updBtn('bS1', me.cd[1], sn);
      updBtn('bS2', me.cd[2], sn);
      updBtn('bItem', itemReady, sn);
      if (sk[2]) updBtn('bS3', me.cd[3], sn);
      if (sk[3]) updBtn('bS4', me.cd[4], sn);
    } else {
      const items = [['Clic', 'Attaque', me.cd[0]], ['E', sk[0], me.cd[1]], ['R', sk[1], me.cd[2]]];
      if (sk[2]) items.push(['C', sk[2], me.cd[3]]);
      if (sk[3]) items.push(['V', sk[3], me.cd[4]]);
      items.push(['F', (me.bo ? '★ ' : '×' + me.it + ' ') + itm.n, itemReady, itm.ico]);
      const bw = items.length > 5 ? 112 : 124, gap = 10, x0 = W / 2 - (items.length * bw + (items.length - 1) * gap) / 2, y0 = H - 62;
      items.forEach(([key, nm, cd], i) => {
        const x = x0 + i * (bw + gap), left = cd - sn;
        ctx.fillStyle = 'rgba(0,0,0,.55)'; rrect(x, y0, bw, 50, 10); ctx.fill();
        ctx.strokeStyle = left > 0 ? 'rgba(255,255,255,.2)' : '#ffd76a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.textAlign = 'center'; ctx.font = '800 12px Rubik,sans-serif'; ctx.fillStyle = '#ffd76a'; ctx.fillText(key, x + bw / 2, y0 + 17);
        ctx.font = '700 12px Rubik,sans-serif'; ctx.fillStyle = left > 0 ? '#888' : '#fff'; ctx.fillText((items[i][3] || SK_ICO[nm] || '⚔️') + ' ' + nm, x + bw / 2, y0 + 37);
        if (left > 0.05) { ctx.font = '800 15px Rubik,sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(left.toFixed(1), x + bw - 18, y0 + 17); }
      });
    }
  }
  // mort / réapparition
  if (me && !(me.fl & 1)) {
    const out = cfg.survival && me.lv === 0;
    ctx.fillStyle = out ? 'rgba(0,0,0,.25)' : 'rgba(40,0,0,.45)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `800 ${sm ? 24 : 34}px Rubik,sans-serif`;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.7)';
    const l1 = out ? 'Plus de vies !' : 'Tu as été éliminé';
    ctx.strokeText(l1, W / 2, H * .62); ctx.fillText(l1, W / 2, H * .62);
    ctx.font = '600 16px Rubik,sans-serif'; ctx.fillStyle = '#ffd0c0';
    const l2 = out ? 'Tu regardes tes coéquipiers. Tenez bon !'
      : `Réapparition dans ${Math.max(0, Math.ceil(me.ra - rs.serverNow))}…` + (cfg.survival ? `  (${me.lv} vie${me.lv > 1 ? 's' : ''} restante${me.lv > 1 ? 's' : ''})` : '  (−1 artefact)');
    ctx.lineWidth = 4; ctx.strokeText(l2, W / 2, H * .62 + 28); ctx.fillText(l2, W / 2, H * .62 + 28);
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
const sess0 = getSess();
if (sess0 && joinCode && sess0.room === joinCode) {
  show(null); document.body.classList.remove('playing'); $('#gameBar').classList.add('hidden'); $('#touch').classList.add('hidden');
  screen = 'resuming';
  connect(() => send({ t: 'resume', room: sess0.room, token: sess0.token }));
  setTimeout(() => { if (screen === 'resuming') { screen = 'home'; show('sHome'); } }, 6000);
} else show('sHome');
})();

// ---------------------------------------------------------- réglages (son, musique, vibrations)
(() => {
  const box = document.querySelector('#setBox'); if (!box || !window.SND) return;
  const S = SND.settings;
  const render = () => {
    box.querySelectorAll('[data-set]').forEach(b => { const on = !!S[b.dataset.set]; b.classList.toggle('on', on); b.querySelector('i').textContent = on ? 'Activé' : 'Désactivé'; });
    box.querySelector('#setVol').value = Math.round(S.vol * 100);
  };
  box.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { SND.set(b.dataset.set, !S[b.dataset.set]); render(); if (b.dataset.set === 'vib') SND.vib(60); SND.play('click'); });
  box.querySelector('#setVol').oninput = e => { SND.set('vol', e.target.value / 100); };
  box.querySelector('#setVol').onchange = () => SND.play('pick');
  const open = () => { render(); box.classList.remove('hidden'); };
  document.querySelectorAll('.btnSet').forEach(b => b.onclick = open);
  box.querySelector('#setClose').onclick = () => box.classList.add('hidden');
  box.addEventListener('pointerdown', e => e.stopPropagation());
  // petit clic sur les boutons des menus
  document.addEventListener('click', e => { if (e.target.closest('.btn, .chip, .cls, .map, .gb')) SND.play('click'); });
})();
