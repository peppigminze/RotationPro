// Feld: Aufstellung planen, rotieren, Phasen ansehen, Überlappung prüfen
import { t, addStrings } from '../i18n.js';
import { h, clear, segmented, toast, haptic, toggle, select } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { Court } from '../ui/court.js';
import { state, persist, activeTeam, activeLineup, playersMap, currentLineup, setCurrentLineup, systemById, myPlayerId, effectiveRules } from '../ui/store.js';
import { applyLibero, liberoViolations, mixedWarnings, ZONE_XY, rotate } from '../engine/core.js';
import { computeFormation, overlapForPhase, PHASES } from '../engine/formation.js';
import { rotationOf } from '../engine/systems.js';
import { formationPlayers, overlapMessages, runArrows, playerShort, playerName, systemInfo } from '../ui/render.js';

addStrings({
  de: {
    rotate: 'Rotieren', rotateBack: 'Zurück', resetRot: 'Reset', weServe: 'Wir schlagen auf', liberoAuto: 'Libero automatisch',
    bench: 'Bank', benchEmpty: 'Alle Spieler stehen auf dem Feld.', tapHint: 'Spieler antippen, dann Position antippen – oder ziehen.',
    freeHint: 'Ziehe Spieler frei auf dem Feld. Der Überlappungs-Checker prüft live.', resetPos: 'Positionen zurücksetzen',
    showRuns: 'Laufwege', incomplete: 'Stelle 6 Spieler auf, um Phasen zu sehen.', liberoIsAuto: 'Der Libero wird automatisch eingewechselt – lege Liberos im Kader fest.',
    rotationOf: 'Rotation', noRotation: 'Eigene Ordnung', squadLink: 'Kader bearbeiten', export: 'Als Bild teilen', tacticsLink: 'Taktiktafel',
    'phaseInfo.base': 'Rotationsordnung: So stehen die Spieler beim Pfiff auf den Positionen 1–6.',
    'phaseInfo.serve': 'Eigener Aufschlag: Der Spieler auf Pos. 1 schlägt auf. Alle anderen müssen beim Aufschlag die Rotationsordnung einhalten.',
    'phaseInfo.receive': 'Annahme: Die Annehmenden bilden den Riegel, der Zuspieler läuft so nah wie erlaubt zum Netz. Überlappung wird geprüft.',
    'phaseInfo.attack': 'Angriff: Nach dem Aufschlag dürfen alle frei laufen. Aussen links, Mitte zentral, Diagonal rechts; der Zuspieler steht am Zuspielpunkt zwischen Pos. 2 und 3.',
    'phaseInfo.block': 'Block gegen einen Angriff über Pos. 4 des Gegners: Doppelblock rechts, der linke Blocker löst sich, die Hinterreihe verteidigt.',
    'phaseInfo.defense': 'Abwehr-Grundstellung: Vorderreihe am Netz, Hinterreihe verteilt sich – bereit, den Angriff zu lesen.',
    legalOk: 'Regelkonform', placed: '{name} auf Pos. {z}', toBench: '{name} auf die Bank',
  },
  en: {
    rotate: 'Rotate', rotateBack: 'Back', resetRot: 'Reset', weServe: 'We serve', liberoAuto: 'Auto libero',
    bench: 'Bench', benchEmpty: 'Every player is on court.', tapHint: 'Tap a player, then a position – or drag.',
    freeHint: 'Drag players anywhere. The overlap checker updates live.', resetPos: 'Reset positions',
    showRuns: 'Runs', incomplete: 'Place 6 players to see the phases.', liberoIsAuto: 'The libero comes on automatically – set liberos in the squad.',
    rotationOf: 'Rotation', noRotation: 'Custom order', squadLink: 'Edit squad', export: 'Share as image', tacticsLink: 'Tactics board',
    'phaseInfo.base': 'Rotation order: where everyone stands in positions 1–6 at the whistle.',
    'phaseInfo.serve': 'Your serve: the player in pos. 1 serves. Everyone else must keep the rotation order at the moment of service.',
    'phaseInfo.receive': 'Serve receive: passers form the line, the setter moves as close to the net as the rules allow. Overlap is checked.',
    'phaseInfo.attack': 'Attack: after the serve everyone moves freely. Outside left, middle centre, opposite right; the setter is at the setting spot between pos. 2 and 3.',
    'phaseInfo.block': 'Blocking an attack from the opponent\'s pos. 4: double block on the right, the left blocker drops off, the back row defends.',
    'phaseInfo.defense': 'Base defense: front row at the net, back row spread out – ready to read the attack.',
    legalOk: 'Legal', placed: '{name} to pos. {z}', toBench: '{name} to the bench',
  },
});

let ui = {};

function render(root) {
  const team = activeTeam();
  const lu = activeLineup(team);
  ui = { root, phase: ui.phase || 'base', serving: ui.serving ?? false, liberoAuto: ui.liberoAuto ?? true, overrides: {}, selected: null, runs: ui.runs ?? true };
  const head = h('div', { class: 'field-head' });
  const phaseBar = h('div', { class: 'phase-bar' });
  const courtWrap = h('div', { class: 'court-wrap' });
  const controls = h('div', { class: 'controls' });
  const msgs = h('div', { class: 'msgs', 'aria-live': 'polite' });
  const benchEl = h('div', { class: 'bench', 'data-drop': 'bench' });
  root.append(head, phaseBar, courtWrap, controls, msgs, benchEl);
  Object.assign(ui, { head, phaseBar, courtWrap, controls, msgs, benchEl, team, lu });

  ui.court = new Court({
    mode: 'zones', oppLabel: '',
    onPlayerTap: (id) => onPlayerTap(id),
    onZoneTap: (z) => onZoneTap(z),
    onDrop: (id, target) => onDrop(id, target),
    onMove: (id, x, y) => { ui.overrides[id] = { x, y }; draw(false); },
  });
  courtWrap.append(ui.court.el);
  drawHead(); drawPhaseBar(); drawControls(); draw(false);
}

function sys() { return systemById(ui.lu.systemId || ui.team.systemId); }

function drawHead() {
  const { team, lu } = ui;
  clear(ui.head);
  const teamSel = select(state.teams.map((x) => ({ value: x.id, label: x.name })), team.id, (v) => { state.activeTeam = v; persist('activeTeam'); render(clear(ui.root)); }, { 'aria-label': 'Team', class: 'sel-team' });
  const luSel = select(team.lineups.map((l) => ({ value: l.id, label: l.name })), lu.id, (v) => { team.activeLineup = v; persist('teams'); render(clear(ui.root)); }, { 'aria-label': 'Aufstellung', class: 'sel-lineup' });
  const S = sys();
  ui.rotBadge = h('div', { class: 'rot-badge', 'aria-live': 'polite' });
  ui.head.append(
    h('div', { class: 'head-sel' }, teamSel, luSel),
    h('div', { class: 'head-meta' },
      h('button', { class: 'chip sys-chip', onclick: () => systemInfo(S), 'aria-label': t('sys.title', { name: S.name }) }, icon('info', 16), S.name),
      ui.rotBadge),
  );
}

function drawPhaseBar() {
  clear(ui.phaseBar);
  ui.phaseBar.append(segmented(PHASES.map((p) => ({ value: p, label: t('phase.' + p) })), ui.phase, (v) => {
    ui.phase = v; ui.overrides = {}; ui.selected = null; drawControls(); draw(true);
  }, 'scroll'));
}

function drawControls() {
  clear(ui.controls);
  const rotRow = h('div', { class: 'rot-row' },
    h('button', { class: 'btn ghost', onclick: () => doRotate(-1), 'aria-label': t('rotateBack') }, icon('rotateBack'), h('span', {}, t('rotateBack'))),
    h('button', { class: 'btn primary big', onclick: () => doRotate(1) }, icon('rotate'), h('span', {}, t('rotate'))),
    h('button', { class: 'btn ghost', onclick: () => { ui.lu.rot = 0; ui.overrides = {}; persist('teams'); haptic(15); draw(true); } }, icon('reset'), h('span', {}, t('resetRot'))),
  );
  const opts = h('div', { class: 'opt-row' });
  if (ui.phase === 'base') {
    opts.append(
      toggle(t('weServe'), ui.serving, (v) => { ui.serving = v; draw(true); }),
      toggle(t('liberoAuto'), ui.liberoAuto, (v) => { ui.liberoAuto = v; draw(true); }),
    );
  } else {
    opts.append(
      toggle(t('showRuns'), ui.runs, (v) => { ui.runs = v; draw(false); }),
      h('button', { class: 'btn small ghost', onclick: () => { ui.overrides = {}; draw(true); } }, t('resetPos')),
    );
  }
  opts.append(
    h('button', { class: 'btn small ghost', onclick: () => shareImage() }, icon('share', 18), t('export')),
    h('a', { class: 'btn small ghost', href: '#/tactics' }, icon('pen', 18), t('tacticsLink')),
  );
  ui.controls.append(rotRow, opts);
}

async function shareImage() {
  const mod = await import('../ui/share.js');
  mod.shareCourt(ui.court.el, `${ui.team.name} – ${ui.lu.name} (${t('phase.' + ui.phase)})`);
}

function doRotate(dir) {
  ui.lu.rot = (((ui.lu.rot || 0) + dir) % 6 + 6) % 6;
  ui.overrides = {}; ui.selected = null;
  persist('teams');
  haptic(dir > 0 ? [10, 30, 10] : 10);
  ui.rotBadge.classList.remove('spin'); void ui.rotBadge.offsetWidth; ui.rotBadge.classList.add(dir > 0 ? 'spin' : 'spin-back');
  draw(true);
}

function libCfg(serving) {
  return { liberos: ui.lu.liberos || [], mode: ui.lu.liberoMode || 'single', serving, rules: effectiveRules(sys()) };
}

function draw(animate = true) {
  const players = playersMap(ui.team);
  const cur = currentLineup(ui.lu);
  const S = sys();
  const mine = myPlayerId(ui.team, ui.lu);
  const r = rotationOf(cur, players, S);
  ui.rotBadge.textContent = r ? t('rot', { r }) : t('noRotation');
  const complete = cur.every((id) => id && players[id]);
  const messages = [];
  let courtPlayers = [];
  let benchIds = [];
  ui.court.setOverlay([]);

  if (ui.phase === 'base' || !complete) {
    ui.court.setMode('zones');
    const lib = ui.liberoAuto && complete ? applyLibero(cur, players, libCfg(ui.serving)) : { court: cur, swaps: [] };
    const court = lib.court;
    courtPlayers = court.map((id, i) => {
      if (!id || !players[id]) return null;
      const p = players[id];
      return { id, x: ZONE_XY[i + 1].x, y: ZONE_XY[i + 1].y, number: p.number, role: p.role, label: playerShort(p), libero: p.role === 'L', mine: id === mine, selected: id === ui.selected, server: ui.serving && i === 0 };
    }).filter(Boolean);
    const libErr = liberoViolations(court, players, { serving: ui.serving, rules: effectiveRules(sys()) });
    libErr.forEach((e) => { messages.push({ kind: 'err', text: t('lib.' + e.type) }); courtPlayers.forEach((cp) => { if (e.zones.includes(court.indexOf(cp.id) + 1)) cp.error = true; }); });
    lib.swaps.forEach((sw) => messages.push({ kind: 'info lib', text: t('lib.replaces', { name: playerName(players[sw.out]) }) + ` (${t('pos', { z: sw.zone })})` }));
    if (S.hobby?.mixed) mixedWarnings(court, players).forEach((w) => messages.push({ kind: 'warn', text: t('mixed.' + w.type, { ...w, a: w.zones?.[0], b: w.zones?.[1] }) }));
    if (!complete && ui.phase !== 'base') messages.push({ kind: 'warn', text: t('incomplete') });
    messages.push({ kind: 'hint', text: t('tapHint') });
    benchIds = ui.team.players.map((p) => p.id).filter((id) => !court.includes(id));
    ui.court.highlightZones(ui.selected ? [1, 2, 3, 4, 5, 6] : [], 'target');
  } else {
    ui.court.setMode('free');
    ui.court.highlightZones([], 'target');
    const f = computeFormation({ sys: S, lineup: cur, players, liberos: ui.lu.liberos || [], liberoMode: ui.lu.liberoMode, phase: ui.phase, rules: effectiveRules(sys()) });
    const entries = f.entries.map((e) => ({ ...e, ...(ui.overrides[e.id] || {}) }));
    const errs = state.settings.rules.overlap === false ? [] : overlapForPhase(entries, ui.phase);
    const errZones = [...new Set(errs.flatMap((e) => [e.a, e.b]))];
    courtPlayers = formationPlayers({ entries }, players, { mineId: mine, errorZones: errZones });
    if (ui.runs) ui.court.setOverlay(runArrows(f));
    messages.push({ kind: 'info', text: t('phaseInfo.' + ui.phase) });
    if (ui.phase === 'serve' || ui.phase === 'receive') {
      if (errs.length) overlapMessages(errs, entries, players).forEach((m) => messages.push({ kind: 'err', text: m }));
      else messages.push({ kind: 'ok', text: t('ov.none') });
      if (ui.phase === 'serve') messages.push({ kind: 'hint', text: t('ov.serverFree') });
    }
    f.swaps.forEach((sw) => messages.push({ kind: 'info lib', text: t('lib.replaces', { name: playerName(players[sw.out]) }) }));
    messages.push({ kind: 'hint', text: t('freeHint') });
    benchIds = ui.team.players.map((p) => p.id).filter((id) => !f.court.includes(id));
  }
  ui.court.setPlayers(courtPlayers, { animate });
  drawMsgs(messages);
  drawBench(benchIds, players);
}

function drawMsgs(list) {
  clear(ui.msgs);
  for (const m of list) ui.msgs.append(h('div', { class: 'msg ' + m.kind }, m.text));
}

function drawBench(ids, players) {
  clear(ui.benchEl);
  ui.benchEl.append(h('div', { class: 'bench-head' }, h('h2', {}, t('bench')), h('a', { href: '#/squad', class: 'link' }, t('squadLink'))));
  const list = h('div', { class: 'bench-list' });
  if (!ids.length) list.append(h('p', { class: 'muted' }, t('benchEmpty')));
  const mine = myPlayerId(ui.team, ui.lu);
  for (const id of ids) {
    const p = players[id];
    const chip = h('button', { class: `pchip r-${p.role}` + (ui.selected === id ? ' sel' : '') + (id === mine ? ' mine' : ''), 'data-id': id, onclick: () => { if (chip._suppressClick) return; onPlayerTap(id); } },
      h('span', { class: 'pchip-num' }, p.number ?? ''), h('span', { class: 'pchip-name' }, playerShort(p)), h('span', { class: 'pchip-role' }, t('roleShort.' + p.role)));
    if (ui.phase === 'base') ui.court.attachExternalDrag(chip, id, `${p.number ?? ''} ${playerShort(p)}`);
    list.append(chip);
  }
  ui.benchEl.append(list);
}

function onPlayerTap(id) {
  if (ui.phase !== 'base') return;
  const players = playersMap(ui.team);
  if (ui.selected && ui.selected !== id) {
    const cur = currentLineup(ui.lu);
    const a = cur.indexOf(ui.selected), b = cur.indexOf(id);
    if (b >= 0) return place(ui.selected, b + 1);
    if (a >= 0 && players[id]?.role !== 'L') return place(id, a + 1);
  }
  if (players[id]?.role === 'L' && !currentLineup(ui.lu).includes(id)) { toast(t('liberoIsAuto')); }
  ui.selected = ui.selected === id ? null : id;
  draw(false);
}

function onZoneTap(z) {
  if (ui.phase !== 'base' || !ui.selected) return;
  place(ui.selected, z);
}

function onDrop(id, target) {
  if (ui.phase !== 'base') return false;
  if (target.bench) {
    const cur = currentLineup(ui.lu);
    const i = cur.indexOf(id);
    if (i < 0) return false;
    cur[i] = null; setCurrentLineup(ui.lu, cur); persist('teams');
    toast(t('toBench', { name: playerShort(playersMap(ui.team)[id]) }));
    ui.selected = null; draw(true); return true;
  }
  if (target.zone) { place(id, target.zone); return true; }
  return false;
}

function place(id, zone) {
  const players = playersMap(ui.team);
  if (players[id]?.role === 'L') { toast(t('liberoIsAuto')); ui.selected = null; draw(false); return; }
  const cur = currentLineup(ui.lu);
  const from = cur.indexOf(id);
  const prev = cur[zone - 1];
  if (from >= 0) { cur[from] = prev ?? null; }
  cur[zone - 1] = id;
  setCurrentLineup(ui.lu, cur);
  persist('teams');
  haptic(12);
  ui.selected = null;
  draw(true);
}

export default {
  render,
  destroy() { ui.court = null; },
  // für Tests/Lernmodus
  _rotate: rotate,
};
