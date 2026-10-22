// Grundpositionen pro Phase – generisch aus System, Rollen und Rotation berechnet
import { ZONE_XY, isFront, isBack, applyLibero, legalize, checkOverlap, DEFAULT_RULES } from './core.js';
import { activeSetterId, effectiveRole } from './systems.js';

export const PHASES = ['base', 'serve', 'receive', 'attack', 'block', 'defense'];
export const QUIZ_PHASES = ['serve', 'receive', 'attack', 'block', 'defense'];

/** Wer hat Aufschlag in welcher Phase (Standardannahme für die Grundpositionen)? */
export function servingForPhase(phase, fallback = false) {
  if (phase === 'serve') return true;
  if (phase === 'receive' || phase === 'attack') return false;
  if (phase === 'block' || phase === 'defense') return true;
  return fallback;
}

const SLOT = {
  attackFront: { L: { x: 0.8, y: 3.4 }, M: { x: 4.4, y: 2.8 }, R: { x: 8.2, y: 3.4 } },
  attackBack: { L: { x: 1.8, y: 6.7 }, M: { x: 4.5, y: 6.9 }, R: { x: 7.5, y: 6.7 } },
  netFront: { L: { x: 1.1, y: 0.7 }, M: { x: 4.5, y: 0.7 }, R: { x: 7.9, y: 0.7 } },
  defBack: { L: { x: 1.2, y: 6.3 }, M: { x: 4.5, y: 7.9 }, R: { x: 7.8, y: 6.3 } },
  blockBack: { L: { x: 1.0, y: 5.7 }, M: { x: 4.0, y: 8.1 }, R: { x: 8.2, y: 7.0 } },
};
const SET_POINT = { x: 6.0, y: 0.8 };
const ZONE_SLOT = { 4: 'L', 3: 'M', 2: 'R', 5: 'L', 6: 'M', 1: 'R' };

const FRONT_PREF = { OH: { L: 0, R: 1, M: 2 }, MB: { M: 0, L: 2, R: 2 }, OPP: { R: 0, L: 1, M: 2 }, S: { R: 0, M: 1, L: 2 }, L: { L: 1, M: 1, R: 1 } };
const BACK_PREF = { L: { L: 0, M: 1, R: 1 }, OH: { M: 0, L: 1, R: 2 }, OPP: { R: 0, M: 1, L: 2 }, S: { R: 0, M: 1, L: 2 }, MB: { L: 0, M: 1, R: 2 } };

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  arr.forEach((v, i) => permutations(arr.slice(0, i).concat(arr.slice(i + 1))).forEach((p) => out.push([v, ...p])));
  return out;
}

/** Ordnet Reihen-Spieler Slots zu (minimaler Präferenz-Score, Tiebreak: kurze Wege). */
function assignSlots(members, slotNames, prefTable) {
  if (!members.length) return {};
  let best = null, bestScore = Infinity;
  for (const perm of permutations(slotNames)) {
    let score = 0;
    members.forEach((m, i) => {
      const s = perm[i];
      const pref = m.role === 'U' ? (ZONE_SLOT[m.zone] === s ? 0 : 1) : (prefTable[m.role]?.[s] ?? 1);
      score += pref * 10 + (ZONE_SLOT[m.zone] === s ? 0 : 0.5);
    });
    if (score < bestScore) { bestScore = score; best = perm; }
  }
  const out = {};
  members.forEach((m, i) => { out[m.id] = best[i]; });
  return out;
}

/**
 * Berechnet die Formation.
 * state: { sys, lineup, players, liberos, liberoMode, phase, serving?, rules }
 */
export function computeFormation(state) {
  const { sys, lineup, players, liberos = [], liberoMode = 'single', phase = 'base' } = state;
  const rules = { ...DEFAULT_RULES, ...(state.rules || {}) };
  const serving = state.serving ?? servingForPhase(phase);
  const lib = applyLibero(lineup, players, { liberos, mode: liberoMode, serving, rules });
  const court = lib.court;
  const setterId = activeSetterId(sys, court, players);
  const entries = court.map((id, i) => {
    const zone = i + 1;
    const baseRole = players[id]?.role || 'U';
    const role = baseRole === 'L' ? 'L' : effectiveRole(id, sys, court, players);
    return { id, zone, baseRole, role, libero: baseRole === 'L', setter: id === setterId, passer: false, server: false, x: ZONE_XY[zone].x, y: ZONE_XY[zone].y };
  });
  const byZone = Object.fromEntries(entries.map((e) => [e.zone, e]));
  const universal = sys.setterRule === 'zone' || sys.roles.every((r) => r === 'U');

  if (phase === 'serve') {
    const s = byZone[1]; s.server = true; s.x = 7.6; s.y = 9.7;
    for (const e of entries) if (isFront(e.zone)) e.y = 1.3;
  } else if (phase === 'receive') {
    receiveFormation(entries, byZone, universal, rules);
  } else if (phase === 'attack') {
    rowSlots(entries, 'attack', universal);
  } else if (phase === 'block') {
    rowSlots(entries, 'block', universal);
  } else if (phase === 'defense') {
    rowSlots(entries, 'defense', universal);
  }
  const bench = lib.swaps.map((s) => s.out);
  return { entries, court, swaps: lib.swaps, bench, serving, setterId, phase };
}

function receiveFormation(entries, byZone, universal, rules) {
  if (universal) {
    const W = { 4: { x: 1.4, y: 4.3 }, 3: { x: 4.5, y: 4.0 }, 2: { x: 7.6, y: 4.3 }, 5: { x: 1.6, y: 7.6 }, 6: { x: 4.5, y: 5.8 }, 1: { x: 7.4, y: 7.6 } };
    for (const e of entries) {
      Object.assign(e, W[e.zone]);
      if (e.setter) { e.x = isFront(e.zone) ? ZONE_XY[e.zone].x : 6.5; e.y = isFront(e.zone) ? 1.0 : 2.4; }
      else e.passer = true;
    }
    finishLegal(entries, byZone);
    return;
  }
  // Spezialisiertes System: 3er-Annahmeriegel (Libero + Aussen), Zuspieler läuft zu
  const cand = entries.filter((e) => !e.setter);
  const prio = (e) => {
    if (e.role === 'L') return 0;
    if (e.role === 'OH' && isBack(e.zone)) return 1;
    if (e.role === 'OH') return 2;
    if (isBack(e.zone) && e.role !== 'OPP') return 3;
    if (isBack(e.zone)) return 4;
    return 9;
  };
  const passers = cand.filter((e) => prio(e) < 9).sort((a, b) => prio(a) - prio(b)).slice(0, 3);
  passers.forEach((p) => { p.passer = true; });
  const lanes = [{ x: 1.6, y: 6.2 }, { x: 4.5, y: 6.5 }, { x: 7.1, y: 6.2 }];
  const sorted = passers.slice().sort((a, b) => ZONE_XY[a.zone].x - ZONE_XY[b.zone].x || ZONE_XY[a.zone].y - ZONE_XY[b.zone].y);
  const laneIdx = sorted.length === 3 ? [0, 1, 2] : sorted.length === 2 ? [0, 2] : [1];
  sorted.forEach((p, i) => Object.assign(p, lanes[laneIdx[i]]));
  for (const e of entries) {
    if (e.passer) continue;
    if (e.setter) { const bx = { 1: 8.3, 6: 6.4, 5: 4.6, 4: 3.4, 3: 6.0, 2: 7.0 }; e.x = bx[e.zone]; e.y = isFront(e.zone) ? 0.9 : 1.6; continue; }
    if (isFront(e.zone)) { e.x = ZONE_XY[e.zone].x; e.y = 1.0; }
    else { e.x = ZONE_XY[e.zone].x; e.y = 8.3; }
  }
  finishLegal(entries, byZone);
}

function finishLegal(entries, byZone) {
  const pos = {}; const weights = {};
  for (const e of entries) { pos[e.zone] = { x: e.x, y: e.y }; weights[e.zone] = e.passer ? 6 : e.setter ? 1 : 2; }
  let fixed = legalize(pos, { weights, margin: 0.5, lateralMargin: 1.3 });
  if (checkOverlap(fixed).length) fixed = legalize(pos, { weights });
  if (checkOverlap(fixed).length) fixed = Object.fromEntries(Object.entries(ZONE_XY).map(([z, v]) => [z, { ...v }]));
  for (const e of entries) { e.x = +fixed[e.zone].x.toFixed(2); e.y = +fixed[e.zone].y.toFixed(2); }
}

function rowSlots(entries, phase, universal) {
  const front = entries.filter((e) => isFront(e.zone));
  const back = entries.filter((e) => isBack(e.zone));
  const setter = entries.find((e) => e.setter);
  if (phase === 'attack') {
    const fMembers = front.filter((e) => !e.setter);
    const fSlots = fMembers.length === 3 ? ['L', 'M', 'R'] : ['L', 'M', 'R'];
    const fa = assignSlots(fMembers, fSlots.slice(0, 3), FRONT_PREF);
    const bMembers = back.filter((e) => !e.setter);
    const ba = assignSlots(bMembers, ['L', 'M', 'R'], BACK_PREF);
    if (fMembers.length < 3) {
      // Zuspieler vorne: nur zwei Angreifer vorne – nimm die zwei besten Slots
      const fa2 = bestSubset(fMembers, FRONT_PREF);
      Object.assign(fa, fa2);
    }
    if (bMembers.length < 3) Object.assign(ba, bestSubset(bMembers, BACK_PREF));
    for (const e of front) if (!e.setter) Object.assign(e, SLOT.attackFront[fa[e.id]]);
    for (const e of back) if (!e.setter) Object.assign(e, SLOT.attackBack[ba[e.id]]);
    if (setter) Object.assign(setter, universal && isFront(setter.zone) ? { x: 5.2, y: 0.8 } : SET_POINT);
    return;
  }
  // Block / Abwehr: der Zuspieler wird wie ein Diagonalspieler behandelt
  const fa = assignSlots(front.map((e) => ({ ...e, role: e.setter ? 'S' : e.role })), ['L', 'M', 'R'], FRONT_PREF);
  const ba = assignSlots(back.map((e) => ({ ...e, role: e.setter ? 'S' : e.role })), ['L', 'M', 'R'], BACK_PREF);
  for (const e of front) {
    const s = fa[e.id];
    Object.assign(e, SLOT.netFront[s]);
    if (phase === 'block') {
      if (s === 'M') { e.x = 6.5; e.y = 0.6; }
      if (s === 'R') { e.x = 8.0; e.y = 0.6; }
      if (s === 'L') { e.x = 1.6; e.y = 3.4; }
    }
  }
  for (const e of back) Object.assign(e, (phase === 'block' ? SLOT.blockBack : SLOT.defBack)[ba[e.id]]);
}

function bestSubset(members, pref) {
  let best = null, score = Infinity;
  const names = ['L', 'M', 'R'];
  for (const perm of permutations(names)) {
    let s = 0;
    members.forEach((m, i) => { s += (m.role === 'U' ? (ZONE_SLOT[m.zone] === perm[i] ? 0 : 1) : (pref[m.role]?.[perm[i]] ?? 1)) * 10 + (ZONE_SLOT[m.zone] === perm[i] ? 0 : 0.5); });
    if (s < score) { score = s; best = perm; }
  }
  const out = {};
  members.forEach((m, i) => { out[m.id] = best[i]; });
  return out;
}

/** Positionen als {zone:{x,y}} für den Überlappungs-Checker. */
export const positionsOf = (entries) => Object.fromEntries(entries.map((e) => [e.zone, { x: e.x, y: e.y }]));

/** Überlappung prüfen – nur relevant beim Aufschlag (eigener Aufschläger ausgenommen) und in der Annahme. */
export function overlapForPhase(entries, phase) {
  if (phase !== 'serve' && phase !== 'receive') return [];
  return checkOverlap(positionsOf(entries), { exclude: phase === 'serve' ? [1] : [] });
}

/** Aufgabe eines Spielers nach dem Punkt (Ich-Perspektive). */
export function taskOf(id, formation) {
  if (formation.bench.includes(id)) return 'bench';
  const e = formation.entries.find((x) => x.id === id);
  if (!e) return 'bench';
  if (formation.phase === 'serve') {
    if (e.server) return 'serve';
    if (e.setter) return 'prepSet';
    return isFront(e.zone) ? 'blockReady' : 'defenseReady';
  }
  if (e.passer) return 'pass';
  if (e.setter) return 'toSetPoint';
  return isFront(e.zone) ? 'attackReady' : 'cover';
}
export const TASKS = ['serve', 'prepSet', 'blockReady', 'defenseReady', 'pass', 'toSetPoint', 'attackReady', 'cover', 'bench'];
