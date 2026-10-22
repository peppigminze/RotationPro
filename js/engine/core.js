// RotationPro – Regel-Engine: Grundlagen (reine Logik, kein DOM)
// Koordinaten in Metern: x 0..9 (linke → rechte Seitenlinie, Blick vom eigenen Endfeld aufs Netz),
// y 0 (Netz) .. 9 (Grundlinie). Aufstellung = Array[6], Index i = Position (Zone) i+1.

export const ZONES = [1, 2, 3, 4, 5, 6];
export const FRONT_ZONES = [4, 3, 2];
export const BACK_ZONES = [5, 6, 1];
export const isFront = (z) => z === 2 || z === 3 || z === 4;
export const isBack = (z) => z === 1 || z === 5 || z === 6;

export const ROLES = ['S', 'OH', 'MB', 'OPP', 'L', 'U'];
export const PLAYABLE_ROLES = ['S', 'OH', 'MB', 'OPP', 'L'];

export const ZONE_XY = {
  4: { x: 1.5, y: 1.6 }, 3: { x: 4.5, y: 1.6 }, 2: { x: 7.5, y: 1.6 },
  5: { x: 1.5, y: 6.2 }, 6: { x: 4.5, y: 6.2 }, 1: { x: 7.5, y: 6.2 },
};

// Überlappungspaare (FIVB 7.4): vorne/hinten und links/rechts innerhalb einer Reihe
export const FRONT_BACK_PAIRS = [[4, 5], [3, 6], [2, 1]];
export const LATERAL_PAIRS = [[4, 3], [3, 2], [5, 6], [6, 1]]; // [links, rechts]

export const zoneOf = (lineup, id) => (id == null ? 0 : lineup.indexOf(id) + 1);
export const atZone = (lineup, z) => lineup[z - 1];

/** Zone nach `steps` Rotationen im Uhrzeigersinn (negativ = rückwärts). */
export function zoneAfter(zone, steps = 1) {
  return ((((zone - 1 - steps) % 6) + 6) % 6) + 1;
}

/** Dreht eine Aufstellung im Uhrzeigersinn (2→1, 1→6, 6→5, 5→4, 4→3, 3→2). */
export function rotate(lineup, steps = 1) {
  const n = (((steps % 6) + 6) % 6);
  return lineup.slice(n).concat(lineup.slice(0, n));
}

export const rotateBack = (lineup, steps = 1) => rotate(lineup, -steps);

/** Rotation Rk = Startaufstellung (R1) k-1 mal gedreht. */
export const lineupAtRotation = (base, r) => rotate(base, r - 1);
export const rotationNumber = (r) => ((((r - 1) % 6) + 6) % 6) + 1;

/** Überlappungsprüfung. positions: {zone: {x, y}}. exclude: Zonen, die ignoriert werden (z.B. Aufschläger). */
export function checkOverlap(positions, { exclude = [] } = {}) {
  const errs = [];
  const ok = (z) => positions[z] && !exclude.includes(z);
  for (const [f, b] of FRONT_BACK_PAIRS) {
    if (ok(f) && ok(b) && !(positions[f].y < positions[b].y)) errs.push({ type: 'frontBack', a: f, b });
  }
  for (const [l, r] of LATERAL_PAIRS) {
    if (ok(l) && ok(r) && !(positions[l].x < positions[r].x)) errs.push({ type: 'lateral', a: l, b: r });
  }
  return errs;
}

/** Verschiebt Spieler minimal, bis keine Überlappung mehr besteht (gewichtete Projektion). */
export function legalize(positions, { weights = {}, margin = 0.35, lateralMargin = margin, exclude = [], iterations = 160 } = {}) {
  const p = {};
  for (const z of Object.keys(positions)) p[z] = { ...positions[z] };
  const w = (z) => weights[z] ?? 1;
  const ok = (z) => p[z] && !exclude.includes(+z);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (const [f, b] of FRONT_BACK_PAIRS) {
      if (!ok(f) || !ok(b)) continue;
      const d = p[f].y + margin - p[b].y;
      if (d > 1e-6) {
        const wf = w(f), wb = w(b);
        p[f].y -= (d * wb) / (wf + wb); p[b].y += (d * wf) / (wf + wb); moved = true;
      }
    }
    for (const [l, r] of LATERAL_PAIRS) {
      if (!ok(l) || !ok(r)) continue;
      const d = p[l].x + lateralMargin - p[r].x;
      if (d > 1e-6) {
        const wl = w(l), wr = w(r);
        p[l].x -= (d * wr) / (wl + wr); p[r].x += (d * wl) / (wl + wr); moved = true;
      }
    }
    for (const z of Object.keys(p)) {
      if (!ok(+z)) continue;
      p[z].x = clamp(p[z].x, 0.35, 8.65); p[z].y = clamp(p[z].y, 0.35, 8.7);
    }
    if (!moved) break;
  }
  return p;
}

// ---------- Libero ----------
export const DEFAULT_RULES = { liberoServe: false, liberoFront: false, overlap: true };

/**
 * Welcher Libero ist aktiv?
 * mode: 'single' | 'perMiddle' (L1↔erste Mitte, L2↔zweite Mitte) | 'receiveServe' (L1 Annahme, L2 eigener Aufschlag/Abwehr)
 */
export function activeLiberoFor(liberos, mode, { serving, middleId, middles = [] } = {}) {
  if (!liberos || liberos.length === 0) return null;
  if (liberos.length === 1 || mode === 'single') return liberos[0];
  if (mode === 'receiveServe') return serving ? liberos[1] : liberos[0];
  if (mode === 'perMiddle') {
    const i = middles.indexOf(middleId);
    return liberos[i === 1 ? 1 : 0];
  }
  return liberos[0];
}

/**
 * Wendet die Libero-Logik auf eine Basisaufstellung (Rotationsreihenfolge) an.
 * Der Libero ersetzt die Mitte (replaceRole), sobald sie hinten steht (Pos. 1, 6, 5).
 * Steht die Mitte auf Pos. 1 und das eigene Team schlägt auf, schlägt die Mitte selbst auf (Standardregel).
 * Rotiert die Mitte nach vorne (Pos. 4), ist sie automatisch wieder auf dem Feld.
 * Rückgabe: { court, swaps:[{zone, out, in}], liberoOn }
 */
export function applyLibero(lineup, players, { liberos = [], mode = 'single', serving = false, rules = DEFAULT_RULES, replaceRole = 'MB' } = {}) {
  const court = lineup.slice();
  const res = { court, swaps: [], liberoOn: null };
  if (!liberos.length) return res;
  const role = (id) => players[id]?.role;
  const middles = lineup.filter((id) => role(id) === replaceRole);
  const order = rules.liberoFront ? [1, 6, 5, 4, 3, 2] : [1, 6, 5];
  for (const z of order) {
    const id = lineup[z - 1];
    if (role(id) !== replaceRole) continue;
    if (z === 1 && serving && !rules.liberoServe) continue;
    const lib = activeLiberoFor(liberos, mode, { serving, middleId: id, middles });
    if (!lib) continue;
    court[z - 1] = lib;
    res.swaps.push({ zone: z, out: id, in: lib });
    res.liberoOn = lib;
    break; // höchstens ein Libero gleichzeitig auf dem Feld
  }
  return res;
}

/** Darf der Libero den Spieler auf Zone z jetzt ersetzen? */
export function canLiberoReplace({ zone, serving = false, justLeft = false, rules = DEFAULT_RULES }) {
  if (isFront(zone) && !rules.liberoFront) return { ok: false, reason: 'liberoFront' };
  if (zone === 1 && serving && !rules.liberoServe) return { ok: false, reason: 'liberoServe' };
  if (justLeft) return { ok: false, reason: 'liberoRally' };
  return { ok: true, reason: 'liberoBack' };
}

/** Prüft ein konkretes Feld (court) auf Libero-Regelverstösse. */
export function liberoViolations(court, players, { serving = false, rules = DEFAULT_RULES } = {}) {
  const errs = [];
  const libs = court.map((id, i) => ({ id, zone: i + 1 })).filter((e) => players[e.id]?.role === 'L');
  if (libs.length > 1) errs.push({ type: 'liberoTwo', zones: libs.map((l) => l.zone) });
  for (const l of libs) {
    if (isFront(l.zone) && !rules.liberoFront) errs.push({ type: 'liberoFront', zones: [l.zone] });
    if (l.zone === 1 && serving && !rules.liberoServe) errs.push({ type: 'liberoServe', zones: [1] });
  }
  return errs;
}

// ---------- Gemischte Teams (Hobby) ----------
export function mixedWarnings(court, players, { minWomen = 2 } = {}) {
  const g = court.map((id) => players[id]?.gender || '');
  if (g.every((x) => !x)) return [];
  const w = [];
  const women = g.filter((x) => x === 'f').length;
  if (women < minWomen) w.push({ type: 'mixedMin', n: women, min: minWomen });
  for (let i = 0; i < 6; i++) {
    const a = g[i], b = g[(i + 1) % 6];
    if (a === 'm' && b === 'm') { w.push({ type: 'mixedAlt', zones: [i + 1, ((i + 1) % 6) + 1] }); break; }
  }
  return w;
}
