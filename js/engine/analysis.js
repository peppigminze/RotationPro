// Statistik & Schwachstellen – reine Auswertung der Antwort-Ereignisse
// event: { ts, src, focus, role, rot, phase, type, ok, ms, confused?: {rot, phase} }

export function summarize(events) {
  const n = events.length;
  if (!n) return { n: 0, acc: null, ms: null };
  const ok = events.filter((e) => e.ok).length;
  const timed = events.filter((e) => e.ms > 0);
  return { n, acc: ok / n, ms: timed.length ? timed.reduce((a, e) => a + e.ms, 0) / timed.length : null };
}

export function groupBy(events, keyFn) {
  const m = new Map();
  for (const e of events) { const k = keyFn(e); if (k == null) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(e); }
  return new Map([...m].map(([k, v]) => [k, summarize(v)]));
}

/** Zellen (Rolle × Rotation × Phase) mit schwacher Trefferquote */
export function weakCells(events, { minN = 3, maxAcc = 0.7 } = {}) {
  const g = groupBy(events.filter((e) => e.rot && e.phase && e.phase !== 'base'), (e) => `${e.role}|${e.rot}|${e.phase}`);
  return [...g].filter(([, s]) => s.n >= minN && s.acc < maxAcc)
    .map(([k, s]) => { const [role, rot, phase] = k.split('|'); return { role, rot: +rot, phase, ...s }; })
    .sort((a, b) => a.acc - b.acc || b.n - a.n);
}

/** Verwechslungen: gewählte Antwort stammte aus einer anderen Rotation/Phase */
export function confusions(events, { minN = 2 } = {}) {
  const m = new Map();
  for (const e of events) {
    if (e.ok || !e.confused || !e.rot) continue;
    const a = { rot: e.rot, phase: e.phase }, b = e.confused;
    const samePhase = a.phase === b.phase;
    const key = samePhase ? `rot|${Math.min(a.rot, b.rot)}|${Math.max(a.rot, b.rot)}|${a.phase}|${e.role}` : `phase|${a.rot}|${[a.phase, b.phase].sort().join('/')}|${e.role}`;
    m.set(key, (m.get(key) || 0) + 1);
  }
  return [...m].filter(([, n]) => n >= minN).map(([k, n]) => {
    const p = k.split('|');
    return p[0] === 'rot' ? { kind: 'rot', rots: [+p[1], +p[2]], phase: p[3], role: p[4], n } : { kind: 'phase', rot: +p[1], phases: p[2].split('/'), role: p[3], n };
  }).sort((a, b) => b.n - a.n);
}

/** Schwächste Rolle / Rotation / Phase (jeweils minN Antworten) */
export function weakest(events, field, minN = 4) {
  const g = groupBy(events, (e) => e[field] || null);
  return [...g].filter(([, s]) => s.n >= minN).sort((a, b) => a[1].acc - b[1].acc)[0] || null;
}

/** Trainingsvorschläge aus Schwachstellen */
export function suggestions(events) {
  const out = [];
  for (const c of confusions(events).slice(0, 2)) {
    if (c.kind === 'rot') out.push({ kind: 'confRot', role: c.role, rot: c.rots[0], rot2: c.rots[1], phase: c.phase, n: c.n, quiz: { roleFilter: c.role, types: ['myPos', 'rotWhere'], constraints: { rot: c.rots[0], phase: c.phase } } });
    else out.push({ kind: 'confPhase', role: c.role, rot: c.rot, phases: c.phases, n: c.n, quiz: { roleFilter: c.role, types: ['myPos'], constraints: { rot: c.rot, phase: c.phases[0] } } });
  }
  for (const w of weakCells(events).slice(0, 3)) {
    out.push({ kind: 'cell', role: w.role, rot: w.rot, phase: w.phase, acc: w.acc, quiz: { roleFilter: w.role, types: ['myPos'], constraints: { rot: w.rot, phase: w.phase } } });
  }
  const wt = weakest(events, 'type');
  if (wt && wt[1].acc < 0.75) out.push({ kind: 'type', type: wt[0], acc: wt[1].acc, quiz: { types: [wt[0]] } });
  return out.slice(0, 5);
}
