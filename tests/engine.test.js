import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotate, rotateBack, zoneAfter, checkOverlap, ZONE_XY, applyLibero, canLiberoReplace, liberoViolations, legalize, lineupAtRotation, mixedWarnings } from '../js/engine/core.js';
import { PRESET_SYSTEMS, getSystem, demoSquad, activeSetterId, rotationOf, autoLineup, recommendSystem, validateSystem, createCustomSystem, normalizeSystem } from '../js/engine/systems.js';
import { computeFormation, overlapForPhase, QUIZ_PHASES, taskOf } from '../js/engine/formation.js';

const L = ['a', 'b', 'c', 'd', 'e', 'f']; // a=Pos1 … f=Pos6

test('Rotation im Uhrzeigersinn: 2→1, 1→6, 6→5, 5→4, 4→3, 3→2', () => {
  const r = rotate(L);
  assert.equal(r[0], 'b'); // Pos1 ← vorher Pos2
  assert.equal(r[5], 'a'); // Pos6 ← vorher Pos1
  assert.equal(r[3], 'e'); // Pos4 ← vorher Pos5
  assert.equal(r[1], 'c'); // Pos2 ← vorher Pos3
});
test('Rückwärts-Rotation ist die Umkehrung', () => {
  assert.deepEqual(rotateBack(rotate(L)), L);
  assert.deepEqual(rotate(L, -2), rotateBack(L, 2));
});
test('6 Rotationen = Ausgangslage', () => assert.deepEqual(rotate(L, 6), L));
test('zoneAfter', () => {
  assert.equal(zoneAfter(2, 1), 1); assert.equal(zoneAfter(1, 1), 6); assert.equal(zoneAfter(4, 1), 3);
  assert.equal(zoneAfter(3, 3), 6); assert.equal(zoneAfter(6, -1), 1);
  for (let z = 1; z <= 6; z++) for (let k = -7; k <= 7; k++) assert.equal(rotate(L, k).indexOf(L[z - 1]) + 1, zoneAfter(z, k));
});
test('lineupAtRotation R1 = Basis', () => assert.deepEqual(lineupAtRotation(L, 1), L));

test('Grundpositionen sind überlappungsfrei', () => assert.equal(checkOverlap(ZONE_XY).length, 0));
test('Überlappung vorne/hinten wird erkannt', () => {
  const p = structuredClone(ZONE_XY); p[2].y = 7; // Pos 2 hinter Pos 1
  const e = checkOverlap(p);
  assert.ok(e.some((x) => x.type === 'frontBack' && x.a === 2 && x.b === 1));
});
test('Seitliche Überlappung wird erkannt', () => {
  const p = structuredClone(ZONE_XY); p[4].x = 5; // Pos 4 rechts von Pos 3
  assert.ok(checkOverlap(p).some((x) => x.type === 'lateral' && x.a === 4 && x.b === 3));
});
test('Diagonale Paare sind kein Fehler (z.B. Pos 4 hinter Pos 6)', () => {
  const p = structuredClone(ZONE_XY); p[4] = { x: 1.0, y: 6.5 }; p[5] = { x: 1.2, y: 7.5 };
  assert.equal(checkOverlap(p).length, 0);
});
test('Aufschläger (exclude) wird ignoriert', () => {
  const p = structuredClone(ZONE_XY); p[1] = { x: 2, y: 9.8 };
  assert.ok(checkOverlap(p).length > 0);
  assert.equal(checkOverlap(p, { exclude: [1] }).length, 0);
});
test('legalize repariert Überlappungen', () => {
  const p = structuredClone(ZONE_XY); p[2].y = 7; p[4].x = 5;
  assert.equal(checkOverlap(legalize(p)).length, 0);
});

const sys51 = getSystem('5-1');
const d51 = demoSquad(sys51);
test('Libero ersetzt Mitte hinten, nicht vorne', () => {
  // R1: MB2 auf Pos 6
  const r = applyLibero(d51.lineup, d51.players, { liberos: d51.liberos });
  assert.equal(r.court[5], d51.liberos[0]);
  // R2: MB2 auf Pos 5
  const r2 = applyLibero(rotate(d51.lineup), d51.players, { liberos: d51.liberos });
  assert.equal(r2.court[4], d51.liberos[0]);
  // R3: MB2 auf Pos 4 (vorne) → Mitte wieder drin; MB1 auf Pos 1 → Libero ersetzt MB1 in der Annahme
  const l3 = rotate(d51.lineup, 2);
  const r3 = applyLibero(l3, d51.players, { liberos: d51.liberos, serving: false });
  assert.equal(r3.court[3], l3[3]);
  assert.equal(r3.court[0], d51.liberos[0]);
});
test('Mitte auf Pos 1 schlägt selbst auf (Libero darf nicht aufschlagen)', () => {
  const l3 = rotate(d51.lineup, 2);
  const r = applyLibero(l3, d51.players, { liberos: d51.liberos, serving: true });
  assert.equal(r.court[0], l3[0]);
  assert.equal(r.swaps.length, 0);
  const hobby = applyLibero(l3, d51.players, { liberos: d51.liberos, serving: true, rules: { liberoServe: true, liberoFront: false } });
  assert.equal(hobby.court[0], d51.liberos[0]);
});
test('Nie zwei Liberos gleichzeitig', () => {
  const sq = demoSquad({ ...sys51, liberos: 2 });
  for (let r = 0; r < 6; r++) for (const serving of [true, false]) for (const mode of ['single', 'perMiddle', 'receiveServe']) {
    const res = applyLibero(rotate(sq.lineup, r), sq.players, { liberos: sq.liberos, mode, serving });
    assert.ok(res.court.filter((id) => sq.players[id].role === 'L').length <= 1);
  }
});
test('Zwei Liberos: Annahme/Abwehr-Modus', () => {
  const sq = demoSquad({ ...sys51, liberos: 2 });
  const recv = applyLibero(sq.lineup, sq.players, { liberos: sq.liberos, mode: 'receiveServe', serving: false });
  const serv = applyLibero(sq.lineup, sq.players, { liberos: sq.liberos, mode: 'receiveServe', serving: true });
  assert.equal(recv.liberoOn, sq.liberos[0]);
  assert.equal(serv.liberoOn, sq.liberos[1]);
});
test('Zwei Liberos: pro Mitte', () => {
  const sq = demoSquad({ ...sys51, liberos: 2 });
  const mbs = sq.lineup.filter((id) => sq.players[id].role === 'MB');
  const r1 = applyLibero(sq.lineup, sq.players, { liberos: sq.liberos, mode: 'perMiddle' }); // MB2 hinten
  assert.equal(r1.swaps[0].out, mbs[1]); assert.equal(r1.liberoOn, sq.liberos[1]);
});
test('canLiberoReplace', () => {
  assert.equal(canLiberoReplace({ zone: 3 }).ok, false);
  assert.equal(canLiberoReplace({ zone: 1, serving: true }).reason, 'liberoServe');
  assert.equal(canLiberoReplace({ zone: 1, serving: false }).ok, true);
  assert.equal(canLiberoReplace({ zone: 5, justLeft: true }).reason, 'liberoRally');
  assert.equal(canLiberoReplace({ zone: 3, rules: { liberoFront: true } }).ok, true);
});
test('liberoViolations', () => {
  const c = d51.lineup.slice(); c[2] = d51.liberos[0];
  assert.ok(liberoViolations(c, d51.players).some((e) => e.type === 'liberoFront'));
});

test('Aktiver Zuspieler pro System', () => {
  const s42 = getSystem('4-2'), d = demoSquad(s42);
  assert.equal(activeSetterId(s42, d.lineup, d.players), d.lineup[3]); // vorne (Pos 4)
  const s62 = getSystem('6-2'), d2 = demoSquad(s62);
  assert.equal(activeSetterId(s62, d2.lineup, d2.players), d2.lineup[0]); // hinten (Pos 1)
  const s66 = getSystem('6-6'), d3 = demoSquad(s66);
  assert.equal(activeSetterId(s66, d3.lineup, d3.players), d3.lineup[2]); // Pos 3
});
test('rotationOf erkennt R1–R6', () => {
  for (let r = 1; r <= 6; r++) assert.equal(rotationOf(lineupAtRotation(d51.lineup, r), d51.players, sys51), r);
});
test('autoLineup setzt Rollen nach System', () => {
  const { lineup, liberos } = autoLineup(d51.list.slice().reverse(), sys51);
  assert.equal(rotationOf(lineup, d51.players, sys51), 1);
  assert.equal(liberos.length, 1);
});
test('Systemempfehlung', () => {
  assert.equal(recommendSystem({ S: 1, OH: 2, MB: 2, OPP: 1, L: 1 }), '5-1');
  assert.equal(recommendSystem({ S: 2, OH: 2, MB: 2 }, true), '6-2');
  assert.equal(recommendSystem({ S: 2, OH: 2, MB: 2 }, false), '4-2');
  assert.equal(recommendSystem({ U: 8 }), '6-6');
});
test('Systemvalidierung', () => {
  for (const s of PRESET_SYSTEMS) assert.deepEqual(validateSystem(s), [], s.id);
  const bad = createCustomSystem({ setters: 2, roles: ['S', 'S', 'MB', 'OH', 'OH', 'MB'] });
  assert.ok(validateSystem(bad).includes('sysSettersOpposite'));
  assert.ok(validateSystem(normalizeSystem({ ...bad, roles: ['L', 'OH', 'MB', 'S', 'OH', 'MB'] })).includes('sysNoLiberoInRotation'));
});

test('Alle Presets × Rotationen: Annahme und Aufschlag sind regelkonform', () => {
  for (const sys of PRESET_SYSTEMS) {
    const sq = demoSquad(sys);
    for (let r = 1; r <= 6; r++) {
      const lineup = lineupAtRotation(sq.lineup, r);
      for (const phase of QUIZ_PHASES) {
        const f = computeFormation({ sys, lineup, players: sq.players, liberos: sq.liberos, phase });
        assert.equal(f.entries.length, 6);
        assert.equal(f.entries.filter((e) => e.setter).length, 1, `${sys.id} R${r} ${phase}`);
        assert.ok(f.entries.filter((e) => e.libero).length <= 1);
        for (const e of f.entries) {
          if (e.server) continue;
          assert.ok(e.x >= 0 && e.x <= 9 && e.y >= 0 && e.y <= 9, `${sys.id} R${r} ${phase} ${e.id} ${e.x},${e.y}`);
        }
        assert.deepEqual(overlapForPhase(f.entries, phase), [], `${sys.id} R${r} ${phase}`);
        const lib = f.entries.find((e) => e.libero);
        if (lib) assert.ok([1, 5, 6].includes(lib.zone));
      }
    }
  }
});
test('Annahme 5-1: drei Annehmende, Zuspieler nicht dabei', () => {
  for (let r = 1; r <= 6; r++) {
    const f = computeFormation({ sys: sys51, lineup: lineupAtRotation(d51.lineup, r), players: d51.players, liberos: d51.liberos, phase: 'receive' });
    const ps = f.entries.filter((e) => e.passer);
    assert.equal(ps.length, 3);
    assert.ok(!ps.some((e) => e.setter));
    assert.ok(ps.some((e) => e.libero));
  }
});
test('Angriff 5-1: Aussen links, Diagonal rechts, Zuspieler am Zuspielpunkt', () => {
  const f = computeFormation({ sys: sys51, lineup: lineupAtRotation(d51.lineup, 4), players: d51.players, liberos: d51.liberos, phase: 'attack' });
  const oh = f.entries.find((e) => e.role === 'OH' && [2, 3, 4].includes(e.zone));
  assert.ok(oh.x < 2);
  const s = f.entries.find((e) => e.setter);
  assert.ok(s.y < 1.5 && s.x > 5);
});
test('Aufgaben (taskOf)', () => {
  const l3 = lineupAtRotation(d51.lineup, 3);
  const f = computeFormation({ sys: sys51, lineup: l3, players: d51.players, liberos: d51.liberos, phase: 'serve' });
  assert.equal(taskOf(l3[0], f), 'serve'); // MB1 auf Pos 1 schlägt auf
  const fr = computeFormation({ sys: sys51, lineup: l3, players: d51.players, liberos: d51.liberos, phase: 'receive' });
  assert.equal(taskOf(l3[0], fr), 'bench'); // in der Annahme ersetzt der Libero die Mitte
});
test('Mixed-Hinweise', () => {
  const players = { a: { gender: 'm' }, b: { gender: 'm' }, c: { gender: 'f' }, d: { gender: 'm' }, e: { gender: 'm' }, f: { gender: 'f' } };
  const w = mixedWarnings(L, players);
  assert.ok(w.some((x) => x.type === 'mixedAlt'));
});
