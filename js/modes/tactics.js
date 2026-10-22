// Taktiktafel: Laufwege und Pfeile zeichnen, Spieler frei verschieben, speichern, teilen
import { t, addStrings } from '../i18n.js';
import { h, s, clear, segmented, haptic, toast, modal, field, confirmDialog, uid } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { Court, arrow } from '../ui/court.js';
import { state, persist, activeTeam, activeLineup, playersMap, currentLineup, systemById, effectiveRules, myPlayerId } from '../ui/store.js';
import { computeFormation, PHASES } from '../engine/formation.js';
import { playerShort } from '../ui/render.js';

addStrings({
  de: {
    'tc.title': 'Taktiktafel', 'tc.arrow': 'Pfeil', 'tc.pen': 'Laufweg', 'tc.move': 'Spieler', 'tc.erase': 'Radierer', 'tc.undo': 'Rückgängig', 'tc.clear': 'Alles löschen',
    'tc.save': 'Speichern', 'tc.saved': 'Taktik gespeichert', 'tc.name': 'Name der Taktik', 'tc.list': 'Gespeicherte Taktiken', 'tc.none': 'Noch keine Taktiken gespeichert.',
    'tc.load': 'Laden', 'tc.share': 'Als Bild teilen', 'tc.from': 'Startaufstellung', 'tc.hint': 'Ziehe auf dem Feld, um zu zeichnen. Mit „Spieler" verschiebst du Spieler.',
    'tc.new': 'Neue Tafel',
  },
  en: {
    'tc.title': 'Tactics board', 'tc.arrow': 'Arrow', 'tc.pen': 'Run', 'tc.move': 'Players', 'tc.erase': 'Eraser', 'tc.undo': 'Undo', 'tc.clear': 'Clear all',
    'tc.save': 'Save', 'tc.saved': 'Tactic saved', 'tc.name': 'Tactic name', 'tc.list': 'Saved tactics', 'tc.none': 'No saved tactics yet.',
    'tc.load': 'Load', 'tc.share': 'Share as image', 'tc.from': 'Starting setup', 'tc.hint': 'Drag on the court to draw. Use "Players" to move players.',
    'tc.new': 'New board',
  },
});

const COLORS = ['#F5C518', '#FFFFFF', '#FF5A5A', '#5AA9FF'];
let root, B, court, tool = 'arrow', color = COLORS[0], history = [];

function fromLineup(phase = 'base') {
  const team = activeTeam(), lu = activeLineup(team), players = playersMap(team);
  const cur = currentLineup(lu);
  if (!cur.every((id) => id && players[id])) return [];
  const sys = systemById(lu.systemId || team.systemId);
  const f = computeFormation({ sys, lineup: cur, players, liberos: lu.liberos || [], liberoMode: lu.liberoMode, phase, rules: effectiveRules(sys) });
  const mine = myPlayerId(team, lu);
  return f.entries.map((e) => ({ id: e.id, x: e.x, y: e.y, number: players[e.id].number, role: players[e.id].role, label: playerShort(players[e.id]), libero: e.libero, mine: e.id === mine }));
}

function newBoard(phase = 'base') { return { id: uid('b'), name: '', phase, players: fromLineup(phase), drawings: [] }; }

function snapshot() { history.push(JSON.stringify({ p: B.players, d: B.drawings })); if (history.length > 50) history.shift(); }

function drawShape(d, i) {
  const g = d.type === 'arrow' ? arrow(d.pts[0], d.pts[1], 'arrow draw', 0) : s('g', { class: 'arrow draw' },
    s('path', { d: 'M' + d.pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L') }),
    ...(d.pts.length > 3 ? [arrow(d.pts[Math.max(0, d.pts.length - 5)], d.pts[d.pts.length - 1], 'arrow draw head', 0)] : []));
  g.setAttribute('style', `--dc:${d.color}`);
  g.dataset.idx = i;
  return g;
}

function render() {
  court.setPlayers(B.players);
  court.setOverlay(B.drawings.map(drawShape));
}

function bindDrawing() {
  let cur = null, preview = null;
  court.el.addEventListener('pointerdown', (e) => {
    if (tool === 'move') return;
    const p = court.toCourt(e.clientX, e.clientY);
    if (tool === 'erase') {
      const g = e.target.closest('.arrow.draw');
      const top = g?.closest('[data-idx]');
      if (top) { snapshot(); B.drawings.splice(+top.dataset.idx, 1); haptic(10); render(); }
      return;
    }
    try { court.el.setPointerCapture(e.pointerId); } catch { /* ok */ }
    cur = { type: tool === 'pen' ? 'path' : 'arrow', color, pts: [p, p] };
    e.preventDefault();
  });
  court.el.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const p = court.toCourt(e.clientX, e.clientY);
    if (cur.type === 'arrow') cur.pts[1] = p;
    else { const last = cur.pts[cur.pts.length - 1]; if (Math.hypot(last.x - p.x, last.y - p.y) > 0.15) cur.pts.push(p); }
    preview?.remove();
    preview = drawShape(cur, -1);
    court.topLayer.append(preview);
  });
  const end = () => {
    if (!cur) return;
    preview?.remove(); preview = null;
    const len = cur.type === 'arrow' ? Math.hypot(cur.pts[0].x - cur.pts[1].x, cur.pts[0].y - cur.pts[1].y) : cur.pts.length;
    if ((cur.type === 'arrow' && len > 0.6) || (cur.type === 'path' && len > 4)) {
      snapshot();
      if (cur.type === 'path') cur.pts = cur.pts.slice(1);
      B.drawings.push(cur); haptic(8);
    }
    cur = null; render();
  };
  court.el.addEventListener('pointerup', end);
  court.el.addEventListener('pointercancel', end);
}

function setTool(v) {
  tool = v;
  court.o.draggable = v === 'move';
  court.setMode(v === 'move' ? 'free' : 'static');
  court.o.mode = v === 'move' ? 'free' : 'static';
  court.el.classList.toggle('drawing', v !== 'move');
}

function draw() {
  clear(root);
  court = new Court({
    mode: 'free', oppLabel: '',
    onMove: (id, x, y, done) => { const p = B.players.find((q) => q.id === id); if (!p) return; if (done) snapshot(); p.x = x; p.y = y; if (done) render(); },
  });
  bindDrawing();
  const colorRow = h('div', { class: 'color-row', role: 'radiogroup' }, COLORS.map((c) => h('button', {
    class: 'swatch' + (c === color ? ' on' : ''), style: { background: c }, role: 'radio', 'aria-checked': String(c === color), 'aria-label': c,
    onclick: (e) => { color = c; colorRow.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); },
  })));
  root.append(
    h('h1', {}, t('tc.title')),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('tc.from')),
      segmented(PHASES.map((p) => ({ value: p, label: t('phase.' + p) })), B.phase || 'base', (v) => { snapshot(); B.phase = v; B.players = fromLineup(v); render(); }, 'scroll')),
    segmented([['arrow', t('tc.arrow')], ['pen', t('tc.pen')], ['move', t('tc.move')], ['erase', t('tc.erase')]].map(([value, label]) => ({ value, label })), tool, setTool),
    colorRow,
    h('div', { class: 'court-wrap tactics-court' }, court.el),
    h('p', { class: 'muted small' }, t('tc.hint')),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn small', onclick: () => { const last = history.pop(); if (!last) return; const o = JSON.parse(last); B.players = o.p; B.drawings = o.d; render(); } }, icon('undo', 18), t('tc.undo')),
      h('button', { class: 'btn small', onclick: () => { snapshot(); B.drawings = []; render(); } }, icon('trash', 18), t('tc.clear')),
      h('button', { class: 'btn small', onclick: async () => { const m = await import('../ui/share.js'); m.shareCourt(court.el, B.name || t('tc.title')); } }, icon('share', 18), t('tc.share')),
      h('button', { class: 'btn small primary', onclick: save }, t('tc.save'))),
  );
  setTool(tool);
  render();
  const list = h('div', { class: 'list' });
  if (!state.boards.length) list.append(h('p', { class: 'muted' }, t('tc.none')));
  for (const b of state.boards.slice().reverse()) {
    list.append(h('div', { class: 'row-item' + (b.id === B.id ? ' on' : '') },
      h('span', { class: 'grow' }, h('span', { class: 'title' }, b.name), h('span', { class: 'sub' }, ' ' + new Date(b.date).toLocaleDateString())),
      h('button', { class: 'btn small', onclick: () => { B = structuredClone(b); history = []; draw(); } }, t('tc.load')),
      h('button', { class: 'btn small danger', 'aria-label': t('del'), onclick: () => confirmDialog(t('confirmDelete', { name: b.name }), () => { state.boards = state.boards.filter((x) => x.id !== b.id); persist('boards'); draw(); }) }, icon('trash', 18))));
  }
  root.append(h('div', { class: 'section-title' }, h('h2', {}, t('tc.list')), h('button', { class: 'btn small', onclick: () => { B = newBoard(); history = []; draw(); } }, t('tc.new'))), list);
}

function save() {
  const input = h('input', { type: 'text', value: B.name || '', maxlength: 40 });
  modal({ title: t('tc.save'), body: field(t('tc.name'), input), actions: [{ label: t('cancel') }, { label: t('save'), kind: 'primary', onClick: () => {
    const name = input.value.trim(); if (!name) return false;
    B.name = name; B.date = Date.now();
    const i = state.boards.findIndex((x) => x.id === B.id);
    const copy = structuredClone(B);
    if (i >= 0) state.boards[i] = copy; else state.boards.push(copy);
    persist('boards'); toast(t('tc.saved'), 'ok'); draw();
    return true;
  } }] });
}

export default { render(r) { root = r; if (!B) B = newBoard(); history = []; draw(); } };
