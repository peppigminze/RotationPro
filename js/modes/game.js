// Minigame „Match-Stress": Ich-Perspektive, Team-Perspektive, Schiri-Blitz, Rotations-Rush
import { t, addStrings, getLang } from '../i18n.js';
import { h, clear, segmented, haptic, sound, toast } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { Court } from '../ui/court.js';
import { state, persist } from '../ui/store.js';
import { getSystem, demoSquad } from '../engine/systems.js';
import { lineupAtRotation, applyLibero, rotate, ZONE_XY } from '../engine/core.js';
import { computeFormation, taskOf, TASKS } from '../engine/formation.js';
import { systemFor, nextQuestion, generate, randomParams } from '../engine/questions.js';
import { rng, hash } from '../engine/rng.js';
import { formationPlayers, playerShort } from '../ui/render.js';
import { drawQuestion } from '../ui/qvisual.js';
import { logEvent } from './quiz.js';

addStrings({
  de: {
    'gm.title': 'Match-Stress', 'gm.me': 'Ich-Perspektive', 'gm.team': 'Team-Perspektive', 'gm.ref': 'Schiri-Blitz', 'gm.rush': 'Rotations-Rush',
    'gm.me.d': 'Du steuerst nur dich: Wo stehst du nach dem Punkt, und was ist deine Aufgabe?', 'gm.team.d': 'Stell das ganze Team nach jedem Punkt richtig auf: Rotation und Libero-Wechsel.',
    'gm.ref.d': 'Die Aufstellung blitzt kurz auf. Überlappung oder korrekt?', 'gm.rush.d': 'Rotationsfragen im Sekundentakt.',
    'gm.play': 'Anpfiff', 'gm.lives': 'Leben', 'gm.level': 'Level {n}', 'gm.streak': 'Serie {n}', 'gm.xp': '{n} XP', 'gm.best': 'Bestwert {n}',
    'gm.daily': 'Tages-Challenge', 'gm.dailyDone': 'Geschafft!', 'gm.c.score': '{target} Punkte in {mode}', 'gm.c.streak': 'Serie von {target} in {mode}',
    'gm.highscores': 'Highscores', 'gm.none': 'Noch keine Spiele.', 'gm.us': 'Wir', 'gm.them': 'Gegner', 'gm.serve': 'Wir schlagen auf', 'gm.recv': 'Gegner schlägt auf',
    'gm.wePoint': 'Punkt für uns', 'gm.theyPoint': 'Punkt für den Gegner', 'gm.sideout': 'Side-out! Ihr holt euch den Aufschlag – rotieren!', 'gm.keep': 'Ihr behaltet den Aufschlag.',
    'gm.lost': 'Aufschlag verloren.', 'gm.start': 'Start: R1, ihr schlagt auf.', 'gm.youPlay': 'Du spielst: {role}', 'gm.tapWhere': 'Tippe, wo du jetzt stehst.',
    'gm.offCourt': 'Ich bin draussen', 'gm.task': 'Deine Aufgabe?', 'gm.ready': 'Bereit!', 'gm.rotate': 'Rotieren', 'gm.teamHint': 'Tippe zwei Spieler an, um sie zu tauschen (auch mit der Bank).',
    'gm.legal': 'Korrekt', 'gm.fault': 'Fehler', 'gm.timeout': 'Timeout', 'gm.timeoutOn': 'Timeout – durchatmen!', 'gm.crunch': 'Crunch Time!', 'gm.time': 'Zeit abgelaufen',
    'gm.over': 'Spiel vorbei', 'gm.score': 'Punkte', 'gm.newBest': 'Neuer Bestwert!', 'gm.again': 'Nochmal', 'gm.home': 'Zur Auswahl', 'gm.levelUp': 'Level {n} – schneller!',
    'gm.set': 'Satz {n}', 'gm.right': 'Richtig', 'gm.wrongPos': 'Falsche Position', 'gm.wrongTask': 'Falsche Aufgabe', 'gm.mult': '×{n}',
    'gm.bench': 'Bank', 'gm.teamFocus': 'In der Team-Perspektive spielst du alle Rollen – dein Spieler ist markiert.', 'gm.playerLevel': 'Spieler-Level {n}',
  },
  en: {
    'gm.title': 'Match stress', 'gm.me': 'First person', 'gm.team': 'Team view', 'gm.ref': 'Ref flash', 'gm.rush': 'Rotation rush',
    'gm.me.d': 'You only control yourself: where are you after the point, and what is your job?', 'gm.team.d': 'Set up the whole team after every point: rotation and libero swaps.',
    'gm.ref.d': 'The lineup flashes briefly. Overlap or legal?', 'gm.rush.d': 'Rotation questions every few seconds.',
    'gm.play': 'Start', 'gm.lives': 'Lives', 'gm.level': 'Level {n}', 'gm.streak': 'Streak {n}', 'gm.xp': '{n} XP', 'gm.best': 'Best {n}',
    'gm.daily': 'Daily challenge', 'gm.dailyDone': 'Done!', 'gm.c.score': '{target} points in {mode}', 'gm.c.streak': 'Streak of {target} in {mode}',
    'gm.highscores': 'High scores', 'gm.none': 'No games yet.', 'gm.us': 'Us', 'gm.them': 'Them', 'gm.serve': 'We serve', 'gm.recv': 'They serve',
    'gm.wePoint': 'Our point', 'gm.theyPoint': 'Their point', 'gm.sideout': 'Side-out! You win the serve – rotate!', 'gm.keep': 'You keep the serve.',
    'gm.lost': 'Serve lost.', 'gm.start': 'Start: R1, you serve.', 'gm.youPlay': 'You play: {role}', 'gm.tapWhere': 'Tap where you stand now.',
    'gm.offCourt': 'I am off court', 'gm.task': 'Your job?', 'gm.ready': 'Ready!', 'gm.rotate': 'Rotate', 'gm.teamHint': 'Tap two players to swap them (bench included).',
    'gm.legal': 'Legal', 'gm.fault': 'Fault', 'gm.timeout': 'Time-out', 'gm.timeoutOn': 'Time-out – breathe!', 'gm.crunch': 'Crunch time!', 'gm.time': 'Time is up',
    'gm.over': 'Game over', 'gm.score': 'Points', 'gm.newBest': 'New best!', 'gm.again': 'Play again', 'gm.home': 'Back to modes', 'gm.levelUp': 'Level {n} – faster!',
    'gm.set': 'Set {n}', 'gm.right': 'Correct', 'gm.wrongPos': 'Wrong position', 'gm.wrongTask': 'Wrong job', 'gm.mult': '×{n}',
    'gm.bench': 'Bench', 'gm.teamFocus': 'In team view you play every role – your player is marked.', 'gm.playerLevel': 'Player level {n}',
  },
});

const MODES = ['me', 'team', 'ref', 'rush'];
const TIME = { me: [11, 0.7], team: [16, 0.9], ref: [4.5, 0.25], rush: [7, 0.45] };
export const playerLevel = (xp) => Math.floor(Math.sqrt((xp || 0) / 100)) + 1;
const today = () => new Date().toISOString().slice(0, 10);

export function dailyChallenge(date = today()) {
  const r = rng('daily-' + date);
  const mode = r.pick(MODES);
  const goal = r.pick(['score', 'streak']);
  const target = goal === 'score' ? r.pick([1500, 2000, 2500, 3000]) : r.pick([5, 6, 8, 10]);
  return { date, mode, goal, target };
}

let root, G = null, raf = 0;
const stopLoop = () => { cancelAnimationFrame(raf); raf = 0; };

function home() {
  stopLoop(); G = null;
  clear(root);
  const S = state.settings, g = state.game;
  const lvl = playerLevel(g.xp);
  const next = lvl * lvl * 100, prev = (lvl - 1) * (lvl - 1) * 100;
  const dc = dailyChallenge();
  const dDone = g.daily?.[dc.date];
  root.append(
    h('h1', {}, t('gm.title')),
    h('div', { class: 'card xp-card' },
      h('div', { class: 'xp-row' }, h('strong', {}, t('gm.playerLevel', { n: lvl })), h('span', { class: 'muted' }, t('gm.xp', { n: g.xp || 0 }))),
      h('div', { class: 'progress' }, h('span', { style: { width: Math.min(100, ((g.xp - prev) / (next - prev)) * 100) + '%' } })),
      h('div', { class: 'daily' + (dDone ? ' done' : '') }, h('span', {}, t('gm.daily') + ': '),
        h('strong', {}, t('gm.c.' + dc.goal, { target: dc.target, mode: t('gm.' + dc.mode) })), dDone ? h('span', { class: 'chip on-chip' }, t('gm.dailyDone')) : null)),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('qz.focus')),
      segmented(['mine', 'all', 'mixed'].map((f) => ({ value: f, label: t('focus.' + f) })), S.focus, (v) => {
        if (v === 'mine' && !S.myRole) { window.RP.rolePicker(home); return; }
        S.focus = v; persist('settings');
      })),
  );
  const grid = h('div', { class: 'mode-grid' });
  for (const m of MODES) {
    const best = (g.highscores?.[m] || [])[0]?.score;
    grid.append(h('button', { class: 'mode-card m-' + m + (dc.mode === m && !dDone ? ' daily-mode' : ''), onclick: () => start(m) },
      h('span', { class: 'mode-name' }, t('gm.' + m)), h('span', { class: 'mode-desc' }, t('gm.' + m + '.d')),
      best ? h('span', { class: 'mode-best' }, t('gm.best', { n: best })) : null));
  }
  root.append(grid);
  root.append(h('div', { class: 'section-title' }, h('h2', {}, t('gm.highscores'))));
  const hs = h('div', { class: 'list' });
  let any = false;
  for (const m of MODES) for (const e of (g.highscores?.[m] || []).slice(0, 3)) {
    any = true;
    hs.append(h('div', { class: 'row-item' }, h('span', { class: 'grow' }, h('span', { class: 'title' }, t('gm.' + m)), h('span', { class: 'sub' }, ' ' + e.date + ' – ' + t('gm.level', { n: e.level }))), h('strong', { class: 'hs-score' }, e.score)));
  }
  if (!any) hs.append(h('p', { class: 'empty' }, t('gm.none')));
  root.append(hs);
}

function pickRole(sysRoles) {
  const S = state.settings;
  const roles = sysRoles;
  if (S.focus === 'mine' && S.myRole && roles.includes(S.myRole)) return S.myRole;
  if (S.focus === 'mixed' && S.myRole && roles.includes(S.myRole) && Math.random() < S.mix / 100) return S.myRole;
  if (S.focus === 'mixed' && S.myRole) { const o = roles.filter((x) => x !== S.myRole); return o[Math.floor(Math.random() * o.length)]; }
  return roles[Math.floor(Math.random() * roles.length)];
}

function start(mode) {
  const S = state.settings;
  const sys = getSystem(systemFor(S.myRole || 'OH', S.mySystem));
  const sq = demoSquad(sys);
  const roles = [...new Set(sq.list.map((p) => p.role))];
  G = { mode, sys, sq, roles, lives: 3, score: 0, streak: 0, bestStreak: 0, level: 1, correct: 0, timeouts: 1, us: 0, them: 0, set: 1, rot: 1, serving: true, prevRot: 1, prevServing: true, first: true, msg: t('gm.start') };
  clear(root);
  const hud = h('div', { class: 'hud' });
  const timer = h('div', { class: 'timer' }, h('span'));
  const banner = h('div', { class: 'banner', 'aria-live': 'assertive' });
  const prompt = h('div', { class: 'g-prompt' });
  const court = new Court({ mode: mode === 'team' ? 'zones' : 'static', draggable: false });
  court.o.mode = mode === 'team' ? 'zones' : 'static';
  const courtBox = h('div', { class: 'court-wrap g-court' }, court.el);
  const area = h('div', { class: 'g-area' });
  root.append(hud, timer, banner, prompt, courtBox, area);
  Object.assign(G, { hud, timer, banner, prompt, court, courtBox, area });
  round();
}

function drawHud() {
  const crunch = isCrunch();
  clear(G.hud).append(
    h('span', { class: 'lives', 'aria-label': t('gm.lives') }, [0, 1, 2].map((i) => h('span', { class: 'heart' + (i < G.lives ? ' on' : '') }, icon('heart', 18)))),
    (G.mode === 'me' || G.mode === 'team') ? h('span', { class: 'score-board' + (crunch ? ' crunch' : '') }, `${G.us}:${G.them}`) : h('span', { class: 'score-board' }, t('gm.level', { n: G.level })),
    h('span', { class: 'pts' }, G.score, h('small', {}, ' ' + t('gm.mult', { n: mult() }))),
    h('button', { class: 'icon-btn', disabled: !G.timeouts || G.paused, onclick: timeout, 'aria-label': t('gm.timeout') }, 'T'),
  );
  G.hud.classList.toggle('crunch', crunch);
}
const mult = () => Math.min(4, 1 + Math.floor(G.streak / 3) * 0.5);
const isCrunch = () => (G.mode === 'me' || G.mode === 'team') && Math.max(G.us, G.them) >= 20 && Math.abs(G.us - G.them) <= 2;

function timeout() {
  if (!G.timeouts || G.paused) return;
  G.timeouts--; G.paused = true; G.pauseLeft = 8000;
  sound.whistle(); haptic(40);
  showBanner(t('gm.timeoutOn'), 'info');
  drawHud();
}

function showBanner(text, kind = '') { G.banner.textContent = text; G.banner.className = 'banner show ' + kind; }

function startTimer(onTimeout) {
  const [base, step] = TIME[G.mode];
  let limit = Math.max(G.mode === 'ref' ? 1.8 : 3.5, base - (G.level - 1) * step) * 1000;
  if (isCrunch()) { limit *= 0.75; showBanner(t('gm.crunch'), 'crunch'); }
  G.limit = limit; G.left = limit; G.t0 = performance.now();
  let last = performance.now(), lastTick = 99;
  const bar = G.timer.firstChild;
  const loop = (now) => {
    const dt = now - last; last = now;
    if (G.paused) { G.pauseLeft -= dt; if (G.pauseLeft <= 0) { G.paused = false; G.banner.className = 'banner'; drawHud(); } }
    else G.left -= dt;
    const frac = Math.max(0, G.left / G.limit);
    bar.style.width = frac * 100 + '%';
    G.timer.classList.toggle('low', frac < 0.3);
    const secs = Math.ceil(G.left / 1000);
    if (secs <= 3 && secs !== lastTick && !G.paused && secs > 0) { lastTick = secs; sound.tick(); haptic(5); }
    if (G.left <= 0) { raf = 0; onTimeout(); return; }
    raf = requestAnimationFrame(loop);
  };
  stopLoop();
  raf = requestAnimationFrame(loop);
}
const elapsed = () => Math.round(G.limit - G.left);

function simulateRally() {
  G.prevRot = G.rot; G.prevServing = G.serving;
  const weWin = Math.random() < 0.52;
  if (weWin) {
    G.us++;
    if (!G.serving) { G.rot = (G.rot % 6) + 1; G.serving = true; G.msg = t('gm.wePoint') + ' – ' + t('gm.sideout'); }
    else G.msg = t('gm.wePoint') + ' – ' + t('gm.keep');
  } else { G.them++; G.msg = t('gm.theyPoint') + (G.serving ? ' – ' + t('gm.lost') : ''); G.serving = false; }
  if ((G.us >= 25 || G.them >= 25) && Math.abs(G.us - G.them) >= 2) { G.set++; G.msg += ' ' + t('gm.set', { n: G.set }); G.us = 0; G.them = 0; }
}

function round() {
  if (!G) return;
  if (G.mode === 'me' || G.mode === 'team') { if (!G.first) simulateRally(); else showBanner(G.msg); G.first = false; }
  drawHud();
  clear(G.area); G.court.setMarkers([]); G.court.setOverlay([]); G.court.highlightZones([]);
  if (G.mode !== 'me' && G.mode !== 'team') G.banner.className = 'banner';
  else { showBanner(G.msg); sound.whistle(); }
  ({ me: roundMe, team: roundTeam, ref: roundRef, rush: roundRush })[G.mode]();
}

function result(ok, info = {}) {
  stopLoop();
  if (!G) return;
  if (ok) {
    G.streak++; G.correct++; G.bestStreak = Math.max(G.bestStreak, G.streak);
    const gain = Math.round((100 + Math.max(0, G.left) / 100) * mult());
    G.score += gain;
    sound.ok(); haptic(15);
    if (G.correct % 5 === 0) { G.level++; sound.level(); toast(t('gm.levelUp', { n: G.level }), 'ok'); }
  } else {
    G.streak = 0; G.lives--; sound.fail(); haptic([40, 50, 40]);
    G.root?.classList?.add('shake');
  }
  if (info.event) logEvent(info.event.q, ok, elapsed(), 'game', info.event.chosen);
  drawHud();
  G.courtBox.classList.remove('flash-ok', 'flash-err'); void G.courtBox.offsetWidth;
  G.courtBox.classList.add(ok ? 'flash-ok' : 'flash-err');
  setTimeout(() => { if (!G) return; if (G.lives <= 0) gameOver(); else round(); }, ok ? 650 : 1500);
}

// ---------- Ich-Perspektive ----------
function roundMe() {
  const role = pickRole(G.roles);
  const { sys, sq } = G;
  const phase = G.serving ? 'serve' : 'receive';
  const f = computeFormation({ sys, lineup: lineupAtRotation(sq.lineup, G.rot), players: sq.players, liberos: sq.liberos, phase });
  const me = role === 'L' ? sq.players[sq.liberos[0]] : sq.list.find((p) => p.role === role);
  const e = f.entries.find((x) => x.id === me.id);
  const task = taskOf(me.id, f);
  G.prompt.textContent = t('gm.youPlay', { role: t('role.' + role) }) + ' – ' + t('gm.tapWhere');
  G.court.setPlayers(formationPlayers(f, sq.players, { hideIds: [me.id] }), { animate: false });
  let stage = 'pos', posOk = false;
  const q = { type: 'myPos', options: [], tags: { roles: [role], rot: G.rot, phase }, focusRole: role, isMine: role === state.settings.myRole };
  const reveal = () => {
    if (e) G.court.setPlayers(formationPlayers(f, sq.players, { mineId: me.id, okIds: [me.id] }), { animate: false });
  };
  const toTask = () => {
    stage = 'task';
    G.prompt.textContent = t('gm.task');
    const r = rng(Date.now());
    const wrong = r.shuffle(TASKS.filter((x) => x !== task && !(x === 'bench' && task !== 'bench' && role !== 'MB' && role !== 'L'))).slice(0, 2);
    clear(G.area).append(h('div', { class: 'q-opts' }, r.shuffle([task, ...wrong]).map((k) => h('button', { class: 'btn q-opt', onclick: () => {
      if (stage !== 'task') return; stage = 'done';
      const ok = k === task;
      if (!ok) showBanner(t('gm.wrongTask') + ': ' + t('task.' + task), 'err'); else showBanner(t('gm.right'), 'ok');
      result(ok, { event: { q, chosen: null } });
    } }, t('task.' + k)))));
  };
  const judgePos = (onBench, x, y) => {
    if (stage !== 'pos') return;
    posOk = onBench ? !e : !!e && Math.hypot(e.x - x, e.y - y) <= 1.5;
    if (!onBench) G.court.setTop([h('span')].length ? [] : []);
    reveal();
    if (!posOk) { stage = 'done'; showBanner(t('gm.wrongPos') + (e ? ` (${t('pos', { z: e.zone })})` : ' – ' + t('task.bench')), 'err'); result(false, { event: { q, chosen: null } }); return; }
    haptic(10); toTask();
  };
  G.court.o.onCourtTap = (x, y) => judgePos(false, x, y);
  G.court.o.onPlayerTap = null;
  clear(G.area).append(h('button', { class: 'btn bench-btn', onclick: () => judgePos(true) }, t('gm.offCourt')));
  startTimer(() => { if (stage === 'done') return; stage = 'done'; reveal(); showBanner(t('gm.time'), 'err'); result(false, { event: { q, chosen: null } }); });
}

// ---------- Team-Perspektive ----------
function roundTeam() {
  const { sys, sq } = G;
  const rules = state.settings.rules;
  const prevCourt = applyLibero(lineupAtRotation(sq.lineup, G.prevRot), sq.players, { liberos: sq.liberos, serving: G.prevServing, rules }).court;
  const want = applyLibero(lineupAtRotation(sq.lineup, G.rot), sq.players, { liberos: sq.liberos, serving: G.serving, rules }).court;
  let cur = prevCourt.slice();
  const all = sq.list.map((p) => p.id);
  let sel = null;
  const mine = state.settings.myRole ? (state.settings.myRole === 'L' ? sq.liberos[0] : sq.list.find((p) => p.role === state.settings.myRole)?.id) : null;
  G.prompt.textContent = (G.serving ? t('gm.serve') : t('gm.recv')) + ' – ' + t('gm.teamHint');
  const benchEl = h('div', { class: 'bench-list g-bench' });
  const draw = () => {
    G.court.setPlayers(cur.map((id, i) => ({ id, x: ZONE_XY[i + 1].x, y: ZONE_XY[i + 1].y, number: sq.players[id].number, role: sq.players[id].role, label: playerShort(sq.players[id]), libero: sq.players[id].role === 'L', selected: sel === id, mine: id === mine })));
    clear(benchEl);
    for (const id of all.filter((x) => !cur.includes(x))) {
      const p = sq.players[id];
      benchEl.append(h('button', { class: `pchip r-${p.role}` + (sel === id ? ' sel' : ''), onclick: () => tap(id) }, h('span', { class: 'pchip-num' }, p.number), h('span', { class: 'pchip-name' }, playerShort(p))));
    }
  };
  const tap = (id) => {
    if (!sel) { sel = id; haptic(6); draw(); return; }
    if (sel === id) { sel = null; draw(); return; }
    const a = cur.indexOf(sel), b = cur.indexOf(id);
    if (a >= 0 && b >= 0) { [cur[a], cur[b]] = [cur[b], cur[a]]; }
    else if (a >= 0) cur[a] = id; else if (b >= 0) cur[b] = sel;
    sel = null; haptic(10); draw();
  };
  G.court.o.onPlayerTap = tap;
  G.court.o.onCourtTap = null;
  G.court.o.onDrop = () => false;
  const q = { type: 'team', options: [], tags: { roles: ['U'], rot: G.rot, phase: G.serving ? 'serve' : 'receive' }, focusRole: null };
  let done = false;
  const submit = () => {
    if (done) return; done = true;
    const ok = cur.every((id, i) => id === want[i]);
    if (!ok) {
      cur = want.slice(); sel = null; draw();
      G.court.highlightZones(want.map((id, i) => (prevCourt[i] !== id ? i + 1 : 0)).filter(Boolean), 'hl');
      showBanner(t('gm.wrongPos'), 'err');
    } else showBanner(t('gm.right'), 'ok');
    result(ok, { event: { q, chosen: null } });
  };
  clear(G.area).append(benchEl, h('div', { class: 'rot-row' },
    h('button', { class: 'btn ghost', onclick: () => { cur = rotate(cur, -1); draw(); } }, icon('rotateBack'), t('rotateBack')),
    h('button', { class: 'btn ghost', onclick: () => { cur = rotate(cur, 1); haptic(10); draw(); } }, icon('rotate'), t('gm.rotate')),
    h('button', { class: 'btn primary big', onclick: submit }, t('gm.ready'))));
  draw();
  startTimer(() => submit());
}

// ---------- Schiri-Blitz ----------
function roundRef() {
  const S = state.settings;
  const r = rng(Date.now());
  const role = pickRole(['S', 'OH', 'MB', 'OPP', 'L']);
  const params = randomParams('overlap', r, { role, difficulty: G.level > 4 ? 'hard' : 'medium', systemId: S.mySystem });
  params.fault = r.chance(0.5) ? params.fault || { kind: 'frontBack', pair: [3, 6], delta: 0.4 } : null;
  const q = generate('overlap', params);
  q.focusRole = role;
  const legal = q.options.find((o) => o.correct).value === 'none';
  G.prompt.textContent = q.prompt[getLang()];
  drawQuestion(G.court, q);
  const flash = Math.max(500, 1700 - (G.level - 1) * 130);
  let done = false;
  const hideT = setTimeout(() => { if (!done) G.court.setPlayers([], { animate: false }); }, flash);
  const answer = (sayLegal) => {
    if (done) return; done = true; clearTimeout(hideT);
    drawQuestion(G.court, q, { reveal: { chosenId: null } });
    const ok = sayLegal === legal;
    showBanner((ok ? t('gm.right') : t('qz.wrong')) + ' ' + q.explanation[getLang()], ok ? 'ok' : 'err');
    result(ok, { event: { q, chosen: q.options.find((o) => (o.value === 'none') === sayLegal)?.id } });
  };
  clear(G.area).append(h('div', { class: 'q-opts' },
    h('button', { class: 'btn q-opt ok', onclick: () => answer(true) }, t('gm.legal')),
    h('button', { class: 'btn q-opt danger', onclick: () => answer(false) }, t('gm.fault'))));
  startTimer(() => { if (!done) { showBanner(t('gm.time'), 'err'); done = true; result(false, { event: { q, chosen: null } }); } });
}

// ---------- Rotations-Rush ----------
function roundRush() {
  const S = state.settings;
  const q = nextQuestion({ focus: S.focus, myRole: S.myRole, mix: S.mix, difficulty: G.level > 5 ? 'hard' : G.level > 2 ? 'medium' : 'easy', systemId: S.mySystem, types: ['rotWhere', 'rotWho'] });
  const L = getLang();
  G.prompt.textContent = q.prompt[L];
  drawQuestion(G.court, q);
  let done = false;
  const answer = (id) => {
    if (done) return; done = true;
    const ok = !!q.options.find((o) => o.id === id)?.correct;
    G.area.querySelectorAll('.q-opt').forEach((b) => { const o = q.options.find((x) => x.id === b.dataset.oid); if (o.correct) b.classList.add('right'); else if (o.id === id) b.classList.add('wrong'); b.disabled = true; });
    showBanner(ok ? t('gm.right') : q.explanation[L], ok ? 'ok' : 'err');
    result(ok, { event: { q, chosen: id } });
  };
  clear(G.area).append(h('div', { class: 'q-opts' }, q.options.map((o) => h('button', { class: 'btn q-opt', 'data-oid': o.id, onclick: () => answer(o.id) }, o.label[L]))));
  startTimer(() => { if (!done) { done = true; showBanner(t('gm.time'), 'err'); result(false, { event: { q, chosen: null } }); } });
}

function gameOver() {
  stopLoop();
  const g = state.game;
  const mode = G.mode;
  const entry = { score: G.score, level: G.level, streak: G.bestStreak, date: today() };
  const list = (g.highscores[mode] = g.highscores[mode] || []);
  const isBest = !list.length || G.score > list[0].score;
  list.push(entry); list.sort((a, b) => b.score - a.score); g.highscores[mode] = list.slice(0, 10);
  const xpGain = Math.round(G.score / 10);
  g.xp = (g.xp || 0) + xpGain; g.played = (g.played || 0) + 1; g.bestStreak = Math.max(g.bestStreak || 0, G.bestStreak);
  const dc = dailyChallenge();
  g.daily = g.daily || {};
  let dailyNow = false;
  if (!g.daily[dc.date] && dc.mode === mode && ((dc.goal === 'score' && G.score >= dc.target) || (dc.goal === 'streak' && G.bestStreak >= dc.target))) { g.daily[dc.date] = true; g.xp += 200; dailyNow = true; }
  persist('game');
  sound.whistle();
  const m = G.mode;
  G = null;
  clear(root).append(h('div', { class: 'card result-card' },
    h('h1', {}, t('gm.over')),
    h('div', { class: 'big-score' }, entry.score),
    isBest ? h('p', { class: 'new-best' }, t('gm.newBest')) : null,
    h('p', {}, `${t('gm.level', { n: entry.level })} – ${t('gm.streak', { n: entry.streak })} – +${xpGain} XP`),
    dailyNow ? h('div', { class: 'msg ok' }, t('gm.daily') + ': ' + t('gm.dailyDone') + ' +200 XP') : null,
    h('div', { class: 'btn-row', style: { marginTop: '12px' } },
      h('button', { class: 'btn', onclick: home }, t('gm.home')),
      h('button', { class: 'btn primary', onclick: () => start(m) }, t('gm.again')))));
}

export default { render(r) { root = r; home(); }, destroy() { stopLoop(); G = null; } };
