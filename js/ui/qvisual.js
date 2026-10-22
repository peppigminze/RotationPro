// Darstellung einer generierten Frage auf dem Spielfeld (Quiz + Minigame)
import { getSystem, demoSquad } from '../engine/systems.js';
import { lineupAtRotation } from '../engine/core.js';
import { computeFormation } from '../engine/formation.js';
import { formationPlayers } from './render.js';
import { s } from './dom.js';

export function questionScene(v) {
  const sys = getSystem(v.systemId);
  const sq = demoSquad(sys);
  const f = computeFormation({ sys, lineup: lineupAtRotation(sq.lineup, v.rot), players: sq.players, liberos: v.noLibero ? [] : sq.liberos, phase: v.phase });
  if (v.positions) f.entries.forEach((e) => { if (v.positions[e.zone]) Object.assign(e, v.positions[e.zone]); });
  return { sys, sq, f };
}

/** Zeichnet Frage q auf court. reveal: {chosenId} nach Antwort */
export function drawQuestion(court, q, { reveal = null, onMarker } = {}) {
  const v = q.visual;
  if (!v) return false;
  const { sq, f } = questionScene(v);
  const mineId = v.mineRole ? (sq.list.find((p) => p.role === v.mineRole && p.idx === (v.mineIdx || 1)) || {}).id : null;
  const hide = v.hideId && !reveal ? [v.hideId] : [];
  const errZ = reveal && q.errorZones ? q.errorZones : [];
  let players = formationPlayers(f, sq.players, { mineId, hideIds: hide.concat(v.hideId && reveal ? [v.hideId] : []), errorZones: errZ });
  court.highlightZones(v.highlight || [], 'hl');
  court.setOverlay([]);
  if (v.markers) {
    const ms = q.options.filter((o) => o.pt).map((o) => ({
      id: o.id, x: o.pt.x, y: o.pt.y, label: o.label.de,
      cls: reveal ? (o.correct ? 'right' : o.id === reveal.chosenId ? 'wrong' : '') : '',
    }));
    court.setMarkers(ms, reveal ? null : onMarker);
    if (reveal && v.hideId) {
      const ans = q.options.find((o) => o.correct && o.pt);
      const p = sq.players[v.hideId];
      if (ans) players = players.concat([{ id: v.hideId, x: ans.pt.x, y: ans.pt.y, number: p.number, role: p.role, label: '', mine: true, ok: true }]);
    }
  } else court.setMarkers([]);
  court.setPlayers(players, { animate: false });
  return true;
}

export const tapDot = (x, y) => s('circle', { cx: x, cy: y, r: 0.25, class: 'tap-dot' });
