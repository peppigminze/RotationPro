// Kader: Teams, Spieler, gespeicherte Aufstellungen, Liberos
import { t, addStrings } from '../i18n.js';
import { h, clear, modal, segmented, toast, confirmDialog, field, select, uid, haptic } from '../ui/dom.js';
import { state, persist, activeTeam, activeLineup, systemById, newLineup, createDemoTeam, myPlayerId } from '../ui/store.js';
import { PRESET_SYSTEMS, autoLineup } from '../engine/systems.js';
import { PLAYABLE_ROLES } from '../engine/core.js';

addStrings({
  de: {
    'sq.title': 'Kader', 'sq.team': 'Team', 'sq.newTeam': 'Neues Team', 'sq.teamName': 'Teamname', 'sq.system': 'System', 'sq.players': 'Spieler',
    'sq.addPlayer': 'Spieler hinzufügen', 'sq.editPlayer': 'Spieler bearbeiten', 'sq.name': 'Name', 'sq.number': 'Nummer', 'sq.role': 'Rolle', 'sq.gender': 'Geschlecht (für Mixed)',
    'sq.g.none': 'keine Angabe', 'sq.g.f': 'Frau', 'sq.g.m': 'Mann', 'sq.isMe': 'Das bin ich', 'sq.me': 'Du',
    'sq.lineups': 'Aufstellungen', 'sq.newLineup': 'Neue Aufstellung', 'sq.lineupName': 'Name der Aufstellung', 'sq.auto': 'Automatisch aufstellen',
    'sq.autoDone': 'Nach Systemrollen aufgestellt', 'sq.liberos': 'Liberos in dieser Aufstellung', 'sq.liberoMode': 'Wechsel-Logik bei 2 Liberos',
    'sq.lm.single': 'Nur Libero 1', 'sq.lm.perMiddle': 'Je ein Libero pro Mitte', 'sq.lm.receiveServe': 'L1 Annahme, L2 eigener Aufschlag',
    'sq.lm.help': 'Es steht immer nur ein Libero auf dem Feld. Die Logik legt fest, welcher gerade einwechselt.',
    'sq.noLibero': 'Keine Liberos im Kader. Lege einen Spieler mit Rolle Libero an.', 'sq.active': 'aktiv', 'sq.open': 'Auf dem Feld öffnen',
    'sq.dupNumber': 'Die Nummer {n} ist schon vergeben.', 'sq.rename': 'Umbenennen', 'sq.duplicate': 'Duplizieren', 'sq.demo': 'Demo-Team anlegen',
    'sq.lastTeam': 'Das letzte Team kann nicht gelöscht werden.', 'sq.lastLineup': 'Die letzte Aufstellung kann nicht gelöscht werden.', 'sq.copy': 'Kopie',
    'sq.empty': 'Noch keine Spieler. Füge dein Team hinzu.',
  },
  en: {
    'sq.title': 'Squad', 'sq.team': 'Team', 'sq.newTeam': 'New team', 'sq.teamName': 'Team name', 'sq.system': 'System', 'sq.players': 'Players',
    'sq.addPlayer': 'Add player', 'sq.editPlayer': 'Edit player', 'sq.name': 'Name', 'sq.number': 'Number', 'sq.role': 'Role', 'sq.gender': 'Gender (for mixed)',
    'sq.g.none': 'not set', 'sq.g.f': 'Woman', 'sq.g.m': 'Man', 'sq.isMe': 'This is me', 'sq.me': 'You',
    'sq.lineups': 'Lineups', 'sq.newLineup': 'New lineup', 'sq.lineupName': 'Lineup name', 'sq.auto': 'Auto-assign',
    'sq.autoDone': 'Assigned by system roles', 'sq.liberos': 'Liberos in this lineup', 'sq.liberoMode': 'Switching with 2 liberos',
    'sq.lm.single': 'Libero 1 only', 'sq.lm.perMiddle': 'One libero per middle', 'sq.lm.receiveServe': 'L1 receive, L2 own serve',
    'sq.lm.help': 'Only one libero is on court at a time. This decides which one comes on.',
    'sq.noLibero': 'No liberos in the squad. Add a player with the libero role.', 'sq.active': 'active', 'sq.open': 'Open on court',
    'sq.dupNumber': 'Number {n} is already taken.', 'sq.rename': 'Rename', 'sq.duplicate': 'Duplicate', 'sq.demo': 'Create demo team',
    'sq.lastTeam': 'The last team cannot be deleted.', 'sq.lastLineup': 'The last lineup cannot be deleted.', 'sq.copy': 'copy',
    'sq.empty': 'No players yet. Add your team.',
  },
});

let root;
const sysOptions = () => [...PRESET_SYSTEMS, ...state.customSystems].map((s2) => ({ value: s2.id, label: s2.name }));

function draw() {
  clear(root);
  const team = activeTeam();
  const lu = activeLineup(team);
  root.append(h('h1', {}, t('sq.title')));

  // Team
  root.append(h('section', { class: 'card' },
    h('div', { class: 'row-split' },
      field(t('sq.team'), select(state.teams.map((x) => ({ value: x.id, label: x.name })), team.id, (v) => { state.activeTeam = v; persist('activeTeam'); draw(); })),
      field(t('sq.system'), select(sysOptions(), team.systemId, (v) => { team.systemId = v; persist('teams'); draw(); }))),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn small', onclick: () => nameDialog(t('sq.rename'), team.name, (n) => { team.name = n; persist('teams'); draw(); }) }, t('sq.rename')),
      h('button', { class: 'btn small', onclick: () => nameDialog(t('sq.newTeam'), '', (n) => {
        const tm = { id: uid('t'), name: n, systemId: state.settings.mySystem || '5-1', players: [], lineups: [] };
        tm.lineups.push({ id: uid('l'), name: 'Start', systemId: tm.systemId, start: [null, null, null, null, null, null], liberos: [], liberoMode: 'single', rot: 0 });
        tm.activeLineup = tm.lineups[0].id;
        state.teams.push(tm); state.activeTeam = tm.id; persist('teams'); persist('activeTeam'); draw();
      }) }, t('sq.newTeam')),
      h('button', { class: 'btn small', onclick: () => { const tm = createDemoTeam(team.systemId, 'Demo ' + systemById(team.systemId).name); state.teams.push(tm); state.activeTeam = tm.id; persist('teams'); persist('activeTeam'); draw(); } }, t('sq.demo')),
      h('button', { class: 'btn small danger', onclick: () => {
        if (state.teams.length < 2) return toast(t('sq.lastTeam'), 'err');
        confirmDialog(t('confirmDelete', { name: team.name }), () => { state.teams = state.teams.filter((x) => x.id !== team.id); state.activeTeam = state.teams[0].id; persist('teams'); persist('activeTeam'); draw(); });
      } }, t('del')))));

  // Spieler
  const mine = myPlayerId(team, lu);
  root.append(h('div', { class: 'section-title' }, h('h2', {}, `${t('sq.players')} (${team.players.length})`),
    h('button', { class: 'btn small primary', onclick: () => playerDialog(team) }, t('sq.addPlayer'))));
  const list = h('div', { class: 'list' });
  if (!team.players.length) list.append(h('p', { class: 'empty' }, t('sq.empty')));
  const order = { S: 0, OH: 1, MB: 2, OPP: 3, L: 4, U: 5 };
  team.players.slice().sort((a, b) => order[a.role] - order[b.role] || (a.number || 0) - (b.number || 0)).forEach((p) => {
    list.append(h('button', { class: 'row-item player-row r-' + p.role, onclick: () => playerDialog(team, p) },
      h('span', { class: 'num-badge r-' + p.role }, p.number ?? '–'),
      h('span', { class: 'grow' }, h('span', { class: 'title' }, p.name || '—'), h('span', { class: 'sub' }, ' ' + t('role.' + p.role) + (p.gender ? ` · ${t('sq.g.' + p.gender)}` : ''))),
      p.id === mine ? h('span', { class: 'chip me-chip' }, t('sq.me')) : null));
  });
  root.append(list);

  // Aufstellungen
  root.append(h('div', { class: 'section-title' }, h('h2', {}, t('sq.lineups')),
    h('button', { class: 'btn small primary', onclick: () => nameDialog(t('sq.newLineup'), '', (n) => { newLineup(team, n, team.systemId); persist('teams'); draw(); }) }, t('sq.newLineup'))));
  const ll = h('div', { class: 'list' });
  team.lineups.forEach((l) => {
    const on = l.id === team.activeLineup;
    ll.append(h('div', { class: 'row-item' + (on ? ' on' : '') },
      h('button', { class: 'grow plain', onclick: () => { team.activeLineup = l.id; persist('teams'); draw(); } },
        h('span', { class: 'title' }, l.name), h('span', { class: 'sub' }, ' ' + systemById(l.systemId).name + (on ? ' – ' + t('sq.active') : ''))),
      h('button', { class: 'btn small ghost', onclick: () => { team.activeLineup = l.id; persist('teams'); location.hash = '#/field'; } }, t('sq.open'))));
  });
  root.append(ll);

  // Aktive Aufstellung bearbeiten
  const libs = team.players.filter((p) => p.role === 'L');
  const libBox = h('div', { class: 'lib-box' });
  if (!libs.length) libBox.append(h('p', { class: 'muted' }, t('sq.noLibero')));
  libs.forEach((p) => {
    const checked = (lu.liberos || []).includes(p.id);
    libBox.append(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked, onchange: (e) => {
      let ls = (lu.liberos || []).filter((x) => x !== p.id);
      if (e.target.checked) ls.push(p.id);
      if (ls.length > 2) ls = ls.slice(-2);
      lu.liberos = ls; persist('teams'); draw();
    } }), h('span', { class: 'num-badge r-L small' }, p.number ?? ''), ` ${p.name} ${(lu.liberos || []).indexOf(p.id) >= 0 ? '(L' + ((lu.liberos || []).indexOf(p.id) + 1) + ')' : ''}`));
  });
  root.append(h('section', { class: 'card' },
    h('h2', {}, lu.name),
    h('div', { class: 'row-split' },
      field(t('sq.system'), select(sysOptions(), lu.systemId, (v) => { lu.systemId = v; persist('teams'); draw(); })),
      field(t('sq.lineupName'), h('input', { type: 'text', value: lu.name, maxlength: 30, onchange: (e) => { lu.name = e.target.value || lu.name; persist('teams'); draw(); } }))),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('sq.liberos')), libBox),
    (lu.liberos || []).length === 2 ? h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('sq.liberoMode')),
      segmented(['single', 'perMiddle', 'receiveServe'].map((m) => ({ value: m, label: t('sq.lm.' + m) })), lu.liberoMode || 'single', (v) => { lu.liberoMode = v; persist('teams'); }, 'wrap'),
      h('span', { class: 'field-hint' }, t('sq.lm.help'))) : null,
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn small', onclick: () => {
        const r = autoLineup(team.players, systemById(lu.systemId));
        lu.start = r.lineup; lu.rot = 0; if (!(lu.liberos || []).length) lu.liberos = r.liberos;
        persist('teams'); toast(t('sq.autoDone'), 'ok'); draw();
      } }, t('sq.auto')),
      h('button', { class: 'btn small', onclick: () => {
        const c = { ...structuredClone(lu), id: uid('l'), name: lu.name + ' ' + t('sq.copy') };
        team.lineups.push(c); team.activeLineup = c.id; persist('teams'); draw();
      } }, t('sq.duplicate')),
      h('button', { class: 'btn small danger', onclick: () => {
        if (team.lineups.length < 2) return toast(t('sq.lastLineup'), 'err');
        confirmDialog(t('confirmDelete', { name: lu.name }), () => { team.lineups = team.lineups.filter((x) => x.id !== lu.id); team.activeLineup = team.lineups[0].id; persist('teams'); draw(); });
      } }, t('del')))));
}

function nameDialog(title, value, onSave) {
  const input = h('input', { type: 'text', value, maxlength: 30 });
  modal({ title, body: field(t('sq.name'), input), actions: [{ label: t('cancel') }, { label: t('save'), kind: 'primary', onClick: () => {
    const v = input.value.trim(); if (!v) return false; onSave(v); return true;
  } }] });
}

function playerDialog(team, p) {
  const isNew = !p;
  const lu = activeLineup(team);
  const d = p ? { ...p } : { id: uid('p'), name: '', number: nextNumber(team), role: state.settings.myRole && !team.players.length ? state.settings.myRole : 'OH', gender: '' };
  let isMe = !!p && myPlayerId(team, lu) === p.id && lu.myPlayer === p.id;
  const roleSeg = segmented(PLAYABLE_ROLES.map((r) => ({ value: r, label: t('role.' + r) })), d.role, (v) => { d.role = v; }, 'wrap');
  const body = h('div', {},
    field(t('sq.name'), h('input', { type: 'text', value: d.name, maxlength: 24, oninput: (e) => { d.name = e.target.value; }, autocomplete: 'off' })),
    field(t('sq.number'), h('input', { type: 'number', min: 0, max: 99, inputmode: 'numeric', value: d.number ?? '', oninput: (e) => { d.number = e.target.value === '' ? null : Math.max(0, Math.min(99, +e.target.value)); } })),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('sq.role')), roleSeg),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('sq.gender')),
      segmented(['', 'f', 'm'].map((g) => ({ value: g, label: t('sq.g.' + (g || 'none')) })), d.gender || '', (v) => { d.gender = v; })),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: isMe, onchange: (e) => { isMe = e.target.checked; } }), ' ' + t('sq.isMe')),
  );
  const actions = [{ label: t('cancel') }];
  if (!isNew) actions.push({ label: t('del'), kind: 'danger', onClick: () => {
    confirmDialog(t('confirmDelete', { name: p.name || p.number }), () => {
      team.players = team.players.filter((x) => x.id !== p.id);
      team.lineups.forEach((l) => { l.start = l.start.map((x) => (x === p.id ? null : x)); l.liberos = (l.liberos || []).filter((x) => x !== p.id); if (l.myPlayer === p.id) l.myPlayer = null; });
      persist('teams'); draw();
    });
  } });
  actions.push({ label: t('save'), kind: 'primary', onClick: () => {
    if (!d.name.trim()) d.name = t('role.' + d.role) + ' ' + (d.number ?? '');
    if (d.number != null && team.players.some((x) => x.id !== d.id && x.number === d.number)) { toast(t('sq.dupNumber', { n: d.number }), 'err'); return false; }
    if (isNew) {
      team.players.push(d);
      if (d.role === 'L') { lu.liberos = lu.liberos || []; if (lu.liberos.length < 2) lu.liberos.push(d.id); }
      else { const i = lu.start.indexOf(null); if (i >= 0) lu.start[i] = d.id; }
    } else {
      Object.assign(team.players.find((x) => x.id === d.id), d);
      if (d.role === 'L') team.lineups.forEach((l) => { l.start = l.start.map((x) => (x === d.id ? null : x)); });
      else team.lineups.forEach((l) => { l.liberos = (l.liberos || []).filter((x) => x !== d.id); });
    }
    if (isMe) { lu.myPlayer = d.id; if (state.settings.myRole !== d.role) { state.settings.myRole = d.role; persist('settings'); window.RP?.refresh?.(); } }
    else if (lu.myPlayer === d.id) lu.myPlayer = null;
    persist('teams'); haptic(10); draw();
    return true;
  } });
  modal({ title: isNew ? t('sq.addPlayer') : t('sq.editPlayer'), body, actions });
}

function nextNumber(team) { for (let n = 1; n < 100; n++) if (!team.players.some((p) => p.number === n)) return n; return null; }

export default { render(r) { root = r; draw(); } };
