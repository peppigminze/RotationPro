// Gemeinsame Darstellungs-Helfer für Feld, Lernmodus, Quiz und Minigame
import { t, getLang } from '../i18n.js';
import { h, modal } from './dom.js';
import { ZONE_XY } from '../engine/core.js';
import { arrow } from './court.js';

export function playerName(p) {
  if (!p) return '–';
  if (p.name) return p.name;
  return t('role.' + p.role) + (p.idx > 1 ? ' ' + p.idx : '');
}
export const playerShort = (p) => (p ? (p.name ? p.name.split(' ')[0].slice(0, 9) : t('roleShort.' + p.role) + (p.idx > 1 ? p.idx : '')) : '');

/** Formation → Court-Spielerliste */
export function formationPlayers(f, players, { mineId, errorZones = [], overrides = {}, hideIds = [], showRoleLabel = false, okIds = [] } = {}) {
  return f.entries.filter((e) => e.id && !hideIds.includes(e.id)).map((e) => {
    const p = players[e.id] || {};
    const pos = overrides[e.id] || e;
    return {
      id: e.id, x: pos.x, y: pos.y, number: p.number, role: p.role === 'L' ? 'L' : p.role,
      label: showRoleLabel ? t('roleShort.' + (e.role || p.role)) + ' · ' + playerShort(p) : playerShort(p),
      libero: e.libero, mine: e.id === mineId, error: errorZones.includes(e.zone), setter: e.setter, server: e.server, ok: okIds.includes(e.id),
    };
  });
}

export function overlapMessages(errs, entries, players) {
  const at = (z) => entries.find((e) => e.zone === z);
  return errs.map((e) => {
    const A = at(e.a), B = at(e.b);
    return t('ov.' + e.type, { a: playerName(players[A?.id]), b: playerName(players[B?.id]), za: e.a, zb: e.b });
  });
}

/** Laufweg-Pfeile von der Rotationsposition zur Phasenposition */
export function runArrows(f, { onlyId } = {}) {
  const out = [];
  for (const e of f.entries) {
    if (onlyId && e.id !== onlyId) continue;
    const from = ZONE_XY[e.zone];
    if (Math.hypot(from.x - e.x, from.y - e.y) > 1.2) out.push(arrow(from, e, 'arrow run' + (onlyId ? ' mine' : '')));
  }
  return out;
}

export function systemInfo(sys) {
  const L = getLang();
  const info = sys.info?.[L] || sys.info?.de || {};
  const row = (k, v) => (v ? h('div', { class: 'info-row' }, h('h3', {}, t('sys.' + k)), h('p', {}, v)) : null);
  modal({
    title: t('sys.title', { name: sys.name }),
    body: h('div', { class: 'sys-info' }, info.summary ? h('p', { class: 'lead' }, info.summary) : null, row('pros', info.pros), row('cons', info.cons), row('when', info.when),
      h('div', { class: 'sys-roles' }, sys.roles.map((r, i) => h('span', { class: 'mini-role r-' + r }, `${i + 1}: ${t('roleShort.' + r)}`)))),
    actions: [{ label: t('close'), kind: 'primary' }],
  });
}
