import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, nextQuestion, randomParams, QTYPES, isCorrect } from '../js/engine/questions.js';
import { rng } from '../js/engine/rng.js';
import { review, due, INTERVALS } from '../js/engine/srs.js';
import { summarize, weakCells, confusions, suggestions } from '../js/engine/analysis.js';
import { buildLessons, stepText, describeRole } from '../js/engine/lessons.js';

test('Jeder Fragetyp × Rolle × Schwierigkeit erzeugt gültige Fragen (genau eine richtige Option)', () => {
  const r = rng(42);
  for (const type of QTYPES) for (const role of ['S', 'OH', 'MB', 'OPP', 'L']) for (const difficulty of ['easy', 'medium', 'hard']) for (let i = 0; i < 15; i++) {
    const q = generate(type, randomParams(type, r, { role, difficulty, systemId: r.pick(['5-1', '4-2', '6-2', '6-6']) }));
    assert.ok(q.prompt.de && q.prompt.en, type);
    assert.ok(q.options.length >= 2, type);
    assert.equal(q.options.filter((o) => o.correct).length, 1, `${type} ${role} ${JSON.stringify(q.params)} ${JSON.stringify(q.options)}`);
    assert.equal(new Set(q.options.map((o) => o.id)).size, q.options.length);
    assert.ok(q.explanation.de && q.explanation.en);
    assert.ok(q.tags.roles.length);
  }
});
test('Fragen sind aus (type, params) reproduzierbar', () => {
  const q = nextQuestion({ seed: 7, focus: 'all' });
  const q2 = generate(q.type, q.params);
  assert.deepEqual(q2.options, q.options);
  assert.equal(q2.key, q.key);
});
test('Rotationsfrage: Antwort stimmt mit der Engine überein', () => {
  const q = generate('rotWhere', { seed: 1, systemId: '5-1', role: 'S', idx: 1, rot: 1, k: 2, dir: 1 });
  // Zuspieler startet R1 auf Pos. 1 → nach 2 Rotationen Pos. 5
  assert.equal(q.options.find((o) => o.correct).value, 5);
});
test('Libero-Frage: Vorderreihe ist nie erlaubt, Pos. 1 bei eigenem Aufschlag nicht', () => {
  assert.equal(generate('libero', { seed: 1, zone: 3, serving: false, justLeft: false }).options.find((o) => o.correct).value, false);
  assert.equal(generate('libero', { seed: 1, zone: 1, serving: true, justLeft: false }).options.find((o) => o.correct).value, false);
  assert.equal(generate('libero', { seed: 1, zone: 6, serving: true, justLeft: false }).options.find((o) => o.correct).value, true);
});
test('Überlappungsfrage ohne Fehler → „Keine Überlappung" korrekt', () => {
  const q = generate('overlap', { seed: 3, systemId: '5-1', rot: 2, phase: 'receive', role: 'S', fault: null });
  assert.equal(q.options.find((o) => o.correct).value, 'none');
  const q2 = generate('overlap', { seed: 3, systemId: '5-1', rot: 2, phase: 'receive', role: 'S', fault: { kind: 'frontBack', pair: [4, 5], delta: 0.4 } });
  assert.deepEqual(q2.options.find((o) => o.correct).value, [4, 5]);
});
test('Fokus „Meine Position" liefert nur Fragen mit eigener Rolle', () => {
  for (const role of ['S', 'OH', 'MB', 'OPP', 'L']) for (let s = 0; s < 40; s++) {
    const q = nextQuestion({ seed: s, focus: 'mine', myRole: role });
    assert.ok(q.tags.roles.includes(role), `${role} ${q.type}`);
  }
});
test('Fokus „Gemischt" gewichtet ca. 70/30', () => {
  let mine = 0; const N = 600;
  for (let s = 0; s < N; s++) if (nextQuestion({ seed: s * 13 + 1, focus: 'mixed', myRole: 'OH', mix: 70 }).focusRole === 'OH') mine++;
  assert.ok(mine / N > 0.6 && mine / N < 0.8, String(mine / N));
});
test('Spaced Repetition: falsch → Box 1, fällig; richtig → nächste Box; nach Box 5 entfernt', () => {
  const q = nextQuestion({ seed: 5 });
  let items = review([], q, false, 0);
  assert.equal(items[0].box, 1);
  assert.equal(due(items, INTERVALS[0]).length, 1);
  assert.equal(due(items, 0).length, 0);
  for (let i = 0; i < 4; i++) items = review(items, q, true, 0);
  assert.equal(items[0].box, 5);
  items = review(items, q, true, 0);
  assert.equal(items.length, 0);
});
test('Analyse: Schwachstellen und Verwechslungen', () => {
  const ev = [];
  for (let i = 0; i < 4; i++) ev.push({ role: 'OH', rot: 4, phase: 'receive', ok: false, ms: 3000, type: 'myPos', confused: { rot: 5, phase: 'receive' } });
  ev.push({ role: 'OH', rot: 4, phase: 'receive', ok: true, ms: 2000, type: 'myPos' });
  assert.equal(summarize(ev).acc, 0.2);
  assert.equal(weakCells(ev)[0].rot, 4);
  const c = confusions(ev)[0];
  assert.deepEqual(c.rots, [4, 5]);
  assert.ok(suggestions(ev).length >= 1);
});
test('Lektionen: alle Schritte haben Text in DE und EN', () => {
  for (const sys of ['5-1', '4-2', '6-2', '6-6']) for (const l of buildLessons(sys)) for (const st of l.steps) for (const L of ['de', 'en']) {
    const ph = st.phases ? st.phases : [st.phase];
    for (const p of ph) assert.ok(stepText(st, p, L).length > 10, `${l.id} ${L} ${p}`);
  }
  assert.match(describeRole({ systemId: '5-1', rot: 3, phase: 'receive', role: 'MB' }, 'de'), /Libero|Netz|Pos/);
});
