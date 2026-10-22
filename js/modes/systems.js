// Systeme: Presets erklären, eigene Systeme bauen
import { t, addStrings, getLang } from '../i18n.js';
import { h, clear, modal, segmented, toggle, toast, confirmDialog, field, select } from '../ui/dom.js';
import { Court } from '../ui/court.js';
import { state, persist, activeTeam } from '../ui/store.js';
import { PRESET_SYSTEMS, createCustomSystem, normalizeSystem, validateSystem } from '../engine/systems.js';
import { ZONE_XY } from '../engine/core.js';
import { systemInfo } from '../ui/render.js';

addStrings({
  de: {
    'sysv.title': 'Systeme', 'sysv.presets': 'Vorlagen', 'sysv.custom': 'Eigene Systeme', 'sysv.new': 'Neues System', 'sysv.edit': 'System bearbeiten',
    'sysv.use': 'Für mein Team verwenden', 'sysv.used': 'Team nutzt jetzt {name}', 'sysv.name': 'Name', 'sysv.players': 'Spieler im Kader', 'sysv.setters': 'Zuspieler',
    'sysv.liberos': 'Liberos', 'sysv.setterRule': 'Wer spielt zu?', 'sysv.ruleFront': 'Der vordere (wie 4-2)', 'sysv.ruleBack': 'Der hintere (wie 6-2)',
    'sysv.setterZone': 'Zuspiel von Position', 'sysv.roles': 'Rollen in Rotation 1 (Pos. 1 = Aufschlag)', 'sysv.hobby': 'Hobby-Optionen',
    'sysv.mixed': 'Gemischtes Team (Hinweise zur Mixed-Aufstellung)', 'sysv.simplified': 'Vereinfachte Regeln (Libero darf vorne spielen und aufschlagen)',
    'sysv.liberoOptional': 'Libero optional', 'sysv.texts': 'Erklärung', 'sysv.summary': 'Kurz erklärt', 'sysv.pros': 'Vorteile', 'sysv.cons': 'Nachteile', 'sysv.when': 'Wann sinnvoll',
    'sysv.none': 'Noch keine eigenen Systeme. Kopiere eine Vorlage oder baue eines von Grund auf.', 'sysv.copy': 'Als Vorlage kopieren', 'sysv.active': 'Aktiv im Team',
    sysNoLiberoInRotation: 'Der Libero gehört nicht in die Rotationsordnung – stelle ihn unter „Liberos" ein.',
    sysSetterCount: 'Die Anzahl Zuspieler in den Rollen passt nicht zur Einstellung „Zuspieler".',
    sysTooFewPlayers: 'Zu wenige Spieler für 6 Feldspieler plus Libero.',
    sysSettersOpposite: 'Zwei Zuspieler sollten sich gegenüberstehen (Pos. 1 und 4, 2 und 5 oder 3 und 6).',
    'sysv.valid': 'System ist gültig.',
  },
  en: {
    'sysv.title': 'Systems', 'sysv.presets': 'Templates', 'sysv.custom': 'Custom systems', 'sysv.new': 'New system', 'sysv.edit': 'Edit system',
    'sysv.use': 'Use for my team', 'sysv.used': 'Team now uses {name}', 'sysv.name': 'Name', 'sysv.players': 'Players in squad', 'sysv.setters': 'Setters',
    'sysv.liberos': 'Liberos', 'sysv.setterRule': 'Who sets?', 'sysv.ruleFront': 'The front-row one (like 4-2)', 'sysv.ruleBack': 'The back-row one (like 6-2)',
    'sysv.setterZone': 'Setter comes from position', 'sysv.roles': 'Roles in rotation 1 (pos. 1 = server)', 'sysv.hobby': 'Recreational options',
    'sysv.mixed': 'Mixed team (hints for mixed lineups)', 'sysv.simplified': 'Simplified rules (libero may play front row and serve)',
    'sysv.liberoOptional': 'Libero optional', 'sysv.texts': 'Explanation', 'sysv.summary': 'In short', 'sysv.pros': 'Pros', 'sysv.cons': 'Cons', 'sysv.when': 'When it fits',
    'sysv.none': 'No custom systems yet. Copy a template or build one from scratch.', 'sysv.copy': 'Copy as template', 'sysv.active': 'Active in team',
    sysNoLiberoInRotation: 'The libero is not part of the rotation order – set it under "Liberos".',
    sysSetterCount: 'The number of setters in the roles does not match the "Setters" setting.',
    sysTooFewPlayers: 'Not enough players for 6 on court plus libero.',
    sysSettersOpposite: 'Two setters should stand opposite each other (pos. 1 & 4, 2 & 5 or 3 & 6).',
    'sysv.valid': 'System is valid.',
  },
});

function rolesCourt(sys) {
  const c = new Court({ interactive: false, small: true });
  c.setPlayers(sys.roles.map((r, i) => ({ id: 'z' + i, x: ZONE_XY[i + 1].x, y: ZONE_XY[i + 1].y, number: t('roleShort.' + r), role: r, label: t('role.' + r) })), { animate: false });
  return c.el;
}

function card(sys, root) {
  const team = activeTeam();
  const L = getLang();
  const active = team.systemId === sys.id;
  return h('article', { class: 'card sys-card' },
    h('div', { class: 'sys-card-head' }, h('h2', {}, sys.name), active ? h('span', { class: 'chip on-chip' }, t('sysv.active')) : null),
    h('p', {}, sys.info?.[L]?.summary || sys.info?.de?.summary || ''),
    h('div', { class: 'sys-roles' }, sys.roles.map((r, i) => h('span', { class: 'mini-role r-' + r }, `${i + 1}: ${t('roleShort.' + r)}`)),
      sys.liberos ? h('span', { class: 'mini-role r-L' }, `+ ${sys.liberos} L`) : null),
    h('div', { class: 'btn-row', style: { marginTop: '12px' } },
      h('button', { class: 'btn small', onclick: () => systemInfo(sys) }, t('sys.summary')),
      sys.preset
        ? h('button', { class: 'btn small', onclick: () => editor(createCustomSystem({ ...structuredClone(sys), id: undefined, preset: false, name: sys.name + ' (eigen)' }), root, true) }, t('sysv.copy'))
        : h('button', { class: 'btn small', onclick: () => editor(structuredClone(sys), root) }, t('edit')),
      !active ? h('button', { class: 'btn small primary', onclick: () => { team.systemId = sys.id; persist('teams'); toast(t('sysv.used', { name: sys.name }), 'ok'); draw(root); } }, t('sysv.use')) : null,
    ));
}

function draw(root) {
  clear(root);
  root.append(h('h1', {}, t('sysv.title')), h('div', { class: 'section-title' }, h('h2', {}, t('sysv.presets'))));
  PRESET_SYSTEMS.forEach((s2) => root.append(card(s2, root)));
  root.append(h('div', { class: 'section-title' }, h('h2', {}, t('sysv.custom')),
    h('button', { class: 'btn small primary', onclick: () => editor(createCustomSystem({ name: t('sysv.new') }), root, true) }, t('sysv.new'))));
  if (!state.customSystems.length) root.append(h('p', { class: 'empty' }, t('sysv.none')));
  state.customSystems.forEach((s2) => root.append(card(s2, root)));
}

export function editor(sys0, root, isNew = false) {
  let sys = normalizeSystem(sys0);
  if (!sys.id) sys.id = 'sys_' + Math.random().toString(36).slice(2, 9);
  const L = getLang();
  sys.info = sys.info || { de: {}, en: {} };
  sys.info[L] = { ...(sys.info[L] || {}) };
  sys.hobby = { ...(sys.hobby || {}) };
  const body = h('div', { class: 'sys-editor' });
  const errBox = h('div', { class: 'msgs' });
  const preview = h('div', { class: 'sys-preview' });
  const num = (v, lo, hi, on) => {
    const out = h('output', { class: 'stepper-val' }, v);
    return h('div', { class: 'stepper' },
      h('button', { class: 'btn small', type: 'button', 'aria-label': '−', onclick: () => { v = Math.max(lo, v - 1); out.textContent = v; on(v); } }, '−'), out,
      h('button', { class: 'btn small', type: 'button', 'aria-label': '+', onclick: () => { v = Math.min(hi, v + 1); out.textContent = v; on(v); } }, '+'));
  };
  const ruleBox = field(t('sysv.setterRule'), segmented([{ value: 'front', label: t('sysv.ruleFront') }, { value: 'back', label: t('sysv.ruleBack') }], sys.setterRule === 'back' ? 'back' : 'front', (v) => { sys.setterRule = v; update(); }));
  const zoneBox = field(t('sysv.setterZone'), segmented([{ value: 2, label: t('pos', { z: 2 }) }, { value: 3, label: t('pos', { z: 3 }) }], sys.setterZone || 3, (v) => { sys.setterZone = v; update(); }));
  const update = () => {
    sys = normalizeSystem(sys);
    clear(errBox);
    const errs = validateSystem(sys);
    if (errs.length) errs.forEach((e) => errBox.append(h('div', { class: 'msg err' }, t(e))));
    else errBox.append(h('div', { class: 'msg ok' }, t('sysv.valid')));
    clear(preview).append(rolesCourt(sys));
    ruleBox.style.display = sys.setters === 2 ? '' : 'none';
    zoneBox.style.display = sys.setters === 0 ? '' : 'none';
  };
  const roleOpts = ['S', 'OH', 'MB', 'OPP', 'U'].map((r) => ({ value: r, label: t('role.' + r) }));
  const grid = h('div', { class: 'role-court' }, [4, 3, 2, 5, 6, 1].map((z) => h('label', { class: 'role-cell' }, h('span', {}, t('pos', { z })),
    select(roleOpts, sys.roles[z - 1], (v) => { sys.roles[z - 1] = v; update(); }))));
  const txt = (k) => h('textarea', { rows: 2, oninput: (e) => { sys.info[L][k] = e.target.value; } }, sys.info[L][k] || '');
  body.append(
    field(t('sysv.name'), h('input', { type: 'text', value: sys.name, maxlength: 24, oninput: (e) => { sys.name = e.target.value || '?'; } })),
    h('div', { class: 'grid3' },
      field(t('sysv.players'), num(sys.players, 6, 12, (v) => { sys.players = v; update(); })),
      field(t('sysv.setters'), segmented([0, 1, 2].map((n) => ({ value: n, label: String(n) })), sys.setters, (v) => { sys.setters = v; update(); })),
      field(t('sysv.liberos'), segmented([0, 1, 2].map((n) => ({ value: n, label: String(n) })), sys.liberos, (v) => { sys.liberos = v; update(); }))),
    ruleBox, zoneBox,
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('sysv.roles')), grid),
    preview,
    h('h3', {}, t('sysv.hobby')),
    h('div', { class: 'toggles' },
      toggle(t('sysv.mixed'), !!sys.hobby.mixed, (v) => { sys.hobby.mixed = v; }),
      toggle(t('sysv.simplified'), !!sys.hobby.simplified, (v) => { sys.hobby.simplified = v; }),
      toggle(t('sysv.liberoOptional'), !!sys.hobby.liberoOptional, (v) => { sys.hobby.liberoOptional = v; update(); })),
    h('h3', {}, t('sysv.texts')),
    field(t('sysv.summary'), txt('summary')), field(t('sysv.pros'), txt('pros')), field(t('sysv.cons'), txt('cons')), field(t('sysv.when'), txt('when')),
    errBox,
  );
  update();
  const actions = [{ label: t('cancel') }];
  if (!isNew) actions.push({ label: t('del'), kind: 'danger', onClick: () => { confirmDialog(t('confirmDelete', { name: sys.name }), () => {
    state.customSystems = state.customSystems.filter((x) => x.id !== sys.id);
    state.teams.forEach((tm) => { if (tm.systemId === sys.id) tm.systemId = '5-1'; tm.lineups.forEach((l) => { if (l.systemId === sys.id) l.systemId = '5-1'; }); });
    persist('customSystems'); persist('teams'); draw(root);
  }); } });
  actions.push({ label: t('save'), kind: 'primary', onClick: () => {
    const errs = validateSystem(sys);
    if (errs.length) { toast(t(errs[0]), 'err'); return false; }
    const i = state.customSystems.findIndex((x) => x.id === sys.id);
    if (i >= 0) state.customSystems[i] = sys; else state.customSystems.push(sys);
    persist('customSystems'); toast(t('saved'), 'ok'); draw(root);
    return true;
  } });
  modal({ title: isNew ? t('sysv.new') : t('sysv.edit'), body, actions, wide: true });
}

export default { render: draw };
