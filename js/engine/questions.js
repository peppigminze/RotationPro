// Regelbasierter Fragengenerator. Jede Frage ist aus (type, params) deterministisch reproduzierbar.
import { getSystem, demoSquad, recommendSystem, PRESET_SYSTEMS } from './systems.js';
import { lineupAtRotation, zoneAfter, rotate, checkOverlap, canLiberoReplace, FRONT_BACK_PAIRS, LATERAL_PAIRS, isFront, ZONE_XY } from './core.js';
import { computeFormation, positionsOf, QUIZ_PHASES, taskOf } from './formation.js';
import { rng as makeRng } from './rng.js';

const T = (de, en) => ({ de, en });
const RN = {
  de: { S: 'Zuspieler', OH: 'Aussen', MB: 'Mitte', OPP: 'Diagonal', L: 'Libero', U: 'Allrounder' },
  en: { S: 'Setter', OH: 'Outside', MB: 'Middle', OPP: 'Opposite', L: 'Libero', U: 'All-rounder' },
};
const PH = {
  de: { serve: 'beim eigenen Aufschlag', receive: 'in der Annahme', attack: 'im Angriff', block: 'im Block', defense: 'in der Abwehr' },
  en: { serve: 'when your team serves', receive: 'in serve receive', attack: 'in attack', block: 'when blocking', defense: 'in defense' },
};
const pl = (p, L) => `${RN[L][p.role]} #${p.number}`;
const posT = (z) => T(`Pos. ${z}`, `Pos. ${z}`);

export const QTYPES = ['rotWhere', 'rotWho', 'overlap', 'libero', 'system', 'myPos'];
export const ROLE_TYPES = {
  S: ['rotWhere', 'rotWho', 'myPos', 'myPos', 'overlap', 'system'],
  OH: ['rotWhere', 'rotWho', 'myPos', 'myPos', 'overlap'],
  MB: ['rotWhere', 'rotWho', 'myPos', 'myPos', 'overlap', 'libero'],
  OPP: ['rotWhere', 'rotWho', 'myPos', 'myPos', 'overlap'],
  L: ['myPos', 'myPos', 'libero', 'libero', 'overlap'],
  U: ['rotWhere', 'rotWho', 'myPos', 'overlap', 'system'],
};

/** System, in dem die Rolle vorkommt (bevorzugt das eigene). */
export function systemFor(role, preferred, difficulty = 'medium') {
  const ok = (s) => (role === 'L' ? s.liberos > 0 : role === 'U' ? true : s.roles.includes(role));
  const pref = getSystem(preferred || '5-1');
  if (ok(pref) && (difficulty !== 'easy' || pref.id === preferred)) return pref.id;
  const cands = PRESET_SYSTEMS.filter(ok).map((s) => s.id);
  return cands.includes('5-1') ? '5-1' : cands[0];
}

const playerOf = (sq, role, idx = 1) => (role === 'L' ? sq.players[sq.liberos[idx - 1] || sq.liberos[0]] : sq.list.find((p) => p.role === role && p.idx === idx) || sq.list.find((p) => p.role === role));

function finishOptions(opts, r) {
  const seen = new Set();
  const uniq = opts.filter((o) => { const k = JSON.stringify(o.value); if (seen.has(k)) return false; seen.add(k); return true; });
  return r.shuffle(uniq).map((o, i) => ({ ...o, id: 'o' + i }));
}

// ---------- Generatoren ----------
const GEN = {
  /** Nach k Rotationen: Wo steht Spieler X? */
  rotWhere(p) {
    const r = makeRng(p.seed);
    const sys = getSystem(p.systemId); const sq = demoSquad(sys);
    const base = lineupAtRotation(sq.lineup, p.rot);
    const pid = playerOf(sq, p.role, p.idx).id;
    const z0 = base.indexOf(pid) + 1;
    const steps = p.k * p.dir;
    const z = zoneAfter(z0, steps);
    const target = ((p.rot - 1 + steps) % 6 + 6) % 6 + 1;
    const opts = [{ value: z, label: posT(z), correct: true }];
    for (const [d, o] of [[steps + 1, 1], [steps - 1, -1], [-steps, 0], [0, 0]]) {
      const zz = zoneAfter(z0, d);
      if (zz !== z) opts.push({ value: zz, label: posT(zz), correct: false, origin: { rot: ((p.rot - 1 + d) % 6 + 6) % 6 + 1 } });
    }
    while (new Set(opts.map((o) => o.value)).size < 4) { const zz = r.int(1, 6); if (!opts.some((o) => o.value === zz)) opts.push({ value: zz, label: posT(zz), correct: false }); }
    const P = sq.players[pid];
    const dirDe = p.dir < 0 ? ' rückwärts' : '', dirEn = p.dir < 0 ? ' backwards' : '';
    return {
      prompt: T(`Startaufstellung R${p.rot} (${sys.name}). Nach ${p.k} Rotation${p.k > 1 ? 'en' : ''}${dirDe}: Auf welcher Position steht ${pl(P, 'de')}?`,
        `Starting lineup R${p.rot} (${sys.name}). After ${p.k} rotation${p.k > 1 ? 's' : ''}${dirEn}: which position is the ${pl(P, 'en')} in?`),
      visual: { systemId: sys.id, rot: p.rot, phase: 'base', mineRole: p.role, mineIdx: p.idx, showLabels: true },
      options: finishOptions(opts.slice(0, 4), r),
      explanation: T(`Im Uhrzeigersinn wandert jeder eine Position weiter (2→1→6→5→4→3→2). Von Pos. ${z0} aus ${p.k}× ${p.dir < 0 ? 'zurück' : 'weiter'} ergibt Pos. ${z} (das ist R${target}).`,
        `Clockwise, everyone moves one spot (2→1→6→5→4→3→2). From pos. ${z0}, ${p.k}× ${p.dir < 0 ? 'back' : 'forward'} gives pos. ${z} (that is R${target}).`),
      tags: { roles: [p.role], rot: target, phase: 'base' },
    };
  },

  /** Nach k Rotationen: Wer steht auf Position Z? */
  rotWho(p) {
    const r = makeRng(p.seed);
    const sys = getSystem(p.systemId); const sq = demoSquad(sys);
    const base = lineupAtRotation(sq.lineup, p.rot);
    const after = rotate(base, p.k);
    const pid = playerOf(sq, p.role, p.idx).id;
    const zone = after.indexOf(pid) + 1;
    const target = ((p.rot - 1 + p.k) % 6) + 1;
    const opts = [{ value: pid, label: T(pl(sq.players[pid], 'de'), pl(sq.players[pid], 'en')), correct: true }];
    for (const d of [p.k - 1, p.k + 1, 0]) {
      const id = rotate(base, d)[zone - 1];
      opts.push({ value: id, label: T(pl(sq.players[id], 'de'), pl(sq.players[id], 'en')), correct: id === pid, origin: { rot: ((p.rot - 1 + d) % 6) + 1 } });
    }
    for (const id of r.shuffle(base)) opts.push({ value: id, label: T(pl(sq.players[id], 'de'), pl(sq.players[id], 'en')), correct: id === pid });
    const clean = finishOptions(opts.filter((o, i) => i === 0 || !o.correct), r).slice(0, 4);
    if (!clean.some((o) => o.correct)) clean[0] = { ...opts[0], id: clean[0].id };
    return {
      prompt: T(`Startaufstellung R${p.rot} (${sys.name}). Wer steht nach ${p.k} Rotation${p.k > 1 ? 'en' : ''} auf Position ${zone}?`,
        `Starting lineup R${p.rot} (${sys.name}). Who is in position ${zone} after ${p.k} rotation${p.k > 1 ? 's' : ''}?`),
      visual: { systemId: sys.id, rot: p.rot, phase: 'base', showLabels: true },
      options: r.shuffle(clean),
      explanation: T(`Auf Pos. ${zone} landet, wer ${p.k} Position${p.k > 1 ? 'en' : ''} „vorher" stand: Pos. ${zoneAfter(zone, -p.k)} in R${p.rot}.`,
        `Pos. ${zone} is taken by whoever stood ${p.k} spot${p.k > 1 ? 's' : ''} "earlier": pos. ${zoneAfter(zone, -p.k)} in R${p.rot}.`),
      tags: { roles: [p.role], rot: target, phase: 'base' },
    };
  },

  /** Finde den Überlappungsfehler */
  overlap(p) {
    const r = makeRng(p.seed);
    const sys = getSystem(p.systemId); const sq = demoSquad(sys);
    const f = computeFormation({ sys, lineup: lineupAtRotation(sq.lineup, p.rot), players: sq.players, liberos: sq.liberos, phase: p.phase });
    const pos = positionsOf(f.entries);
    const exclude = p.phase === 'serve' ? [1] : [];
    if (p.fault) {
      const [a, b] = p.fault.pair; const d = p.fault.delta;
      if (p.fault.kind === 'frontBack') pos[a] = { ...pos[a], y: pos[b].y + d };
      else pos[a] = { ...pos[a], x: pos[b].x + d };
    }
    const errs = checkOverlap(pos, { exclude });
    const pairs = [...FRONT_BACK_PAIRS, ...LATERAL_PAIRS].filter(([a, b]) => !exclude.includes(a) && !exclude.includes(b));
    const isErr = (a, b) => errs.some((e) => e.a === a && e.b === b);
    const roleAt = (z) => { const e = f.entries.find((x) => x.zone === z); return sq.players[e.id].role; };
    const lbl = (a, b) => T(`Pos. ${a} und Pos. ${b}`, `Pos. ${a} and pos. ${b}`);
    const opts = [];
    if (errs.length) opts.push({ value: [errs[0].a, errs[0].b], label: lbl(errs[0].a, errs[0].b), correct: true });
    const others = r.shuffle(pairs.filter(([a, b]) => !isErr(a, b))).slice(0, errs.length ? 2 : 3);
    others.forEach(([a, b]) => opts.push({ value: [a, b], label: lbl(a, b), correct: false }));
    opts.push({ value: 'none', label: T('Keine Überlappung', 'No overlap'), correct: !errs.length });
    const e0 = errs[0];
    const expl = e0
      ? (e0.type === 'frontBack'
        ? T(`Pos. ${e0.a} steht nicht näher am Netz als Pos. ${e0.b}. Vorne/hinten-Partner: 4–5, 3–6, 2–1.`, `Pos. ${e0.a} is not closer to the net than pos. ${e0.b}. Front/back partners: 4–5, 3–6, 2–1.`)
        : T(`Pos. ${e0.a} steht nicht links von Pos. ${e0.b}. Seitliche Partner: 4–3–2 vorne, 5–6–1 hinten.`, `Pos. ${e0.a} is not left of pos. ${e0.b}. Side partners: 4–3–2 front, 5–6–1 back.`))
      : T('Alle Partner stehen korrekt. Diagonale Positionen und der Aufschläger zählen nicht.', 'All partners are in order. Diagonal positions and the server do not count.');
    const involved = e0 ? [roleAt(e0.a), roleAt(e0.b)] : [p.role];
    return {
      prompt: T(`${sys.name}, R${p.rot}, ${PH.de[p.phase]}: Wo liegt der Überlappungsfehler?`, `${sys.name}, R${p.rot}, ${PH.en[p.phase]}: where is the overlap fault?`),
      visual: { systemId: sys.id, rot: p.rot, phase: p.phase, positions: pos, showZones: true, showLabels: true },
      options: finishOptions(opts, r).sort((a, b) => (a.value === 'none') - (b.value === 'none')),
      explanation: expl,
      tags: { roles: [...new Set([...involved, p.role])], rot: p.rot, phase: p.phase },
      errorZones: e0 ? [e0.a, e0.b] : [],
    };
  },

  /** Darf der Libero hier wechseln? */
  libero(p) {
    const r = makeRng(p.seed);
    const rot = (((3 - p.zone) % 6) + 6) % 6 + 1; // Mitte 1 steht in R1 auf Pos. 3
    const res = canLiberoReplace({ zone: p.zone, serving: p.serving, justLeft: p.justLeft });
    const sitDe = p.serving ? 'Euer Team schlägt als Nächstes auf.' : 'Der Gegner schlägt als Nächstes auf.';
    const sitEn = p.serving ? 'Your team serves next.' : 'The opponent serves next.';
    const jl = p.justLeft ? [' Der Libero wurde direkt vor dem letzten Pfiff ausgewechselt – ohne Ballwechsel dazwischen.', ' The libero was replaced right before this whistle – no rally in between.'] : ['', ''];
    const ex = {
      liberoFront: T('Nein – Pos. 2, 3 und 4 sind Vorderreihe. Der Libero darf dort nicht spielen.', 'No – pos. 2, 3 and 4 are front row. The libero may not play there.'),
      liberoServe: T('Nein – auf Pos. 1 wird gleich aufgeschlagen, und der Libero darf nicht aufschlagen.', 'No – pos. 1 serves next, and the libero may not serve.'),
      liberoRally: T('Nein – zwischen zwei Libero-Wechseln muss ein abgeschlossener Ballwechsel liegen.', 'No – there must be a completed rally between two libero replacements.'),
      liberoBack: T('Ja – Hinterreihe, kein eigener Aufschlag von dieser Position, und ein Ballwechsel liegt dazwischen.', 'Yes – back row, nobody needs to serve from here, and a rally has been played.'),
    }[res.reason];
    return {
      prompt: T(`Die Mitte steht auf Pos. ${p.zone}. ${sitDe}${jl[0]} Darf der Libero jetzt für sie einwechseln?`, `The middle is in pos. ${p.zone}. ${sitEn}${jl[1]} May the libero come in for them now?`),
      visual: { systemId: '5-1', rot, phase: 'base', noLibero: true, highlight: [p.zone], showLabels: true },
      options: [{ id: 'o0', value: true, label: T('Ja', 'Yes'), correct: res.ok }, { id: 'o1', value: false, label: T('Nein', 'No'), correct: !res.ok }],
      explanation: ex,
      tags: { roles: ['L', 'MB'], rot, phase: p.serving ? 'serve' : 'receive' },
      _r: r,
    };
  },

  /** Welches System passt zu diesem Kader? */
  system(p) {
    const r = makeRng(p.seed);
    const comp = { '5-1': { S: 1, OH: 2 + (p.v % 2), MB: 2, OPP: 1, L: 1 }, '6-2': { S: 2, OH: 2, MB: 2, L: 1 }, '4-2': { S: 2, OH: 2 + (p.v % 2), MB: 2 }, '6-6': { U: 6 + (p.v % 3) } }[p.target];
    const attack = p.target === '6-2';
    const ans = recommendSystem(comp, attack);
    const list = (L) => Object.entries(comp).map(([k, n]) => `${n}× ${RN[L][k]}`).join(', ');
    const extraDe = comp.S === 2 ? (attack ? ' Beide Zuspieler sind auch starke Angreifer.' : ' Die Zuspieler sind keine starken Angreifer.') : comp.U ? ' Alle spielen alles, niemand ist Spezialist.' : '';
    const extraEn = comp.S === 2 ? (attack ? ' Both setters are also strong hitters.' : ' The setters are not strong hitters.') : comp.U ? ' Everyone plays everything, no specialists.' : '';
    const why = {
      '5-1': T('Ein Zuspieler + Diagonal + 2 Aussen + 2 Mitten + Libero ist die klassische 5-1-Besetzung.', 'One setter + opposite + 2 outsides + 2 middles + libero is the classic 5-1 squad.'),
      '6-2': T('Zwei Zuspieler, die auch angreifen: 6-2 – der hintere spielt zu, vorne immer drei Angreifer.', 'Two setters who can also hit: 6-2 – the back-row one sets, always three hitters in front.'),
      '4-2': T('Zwei Zuspieler ohne Angriffsstärke: 4-2 – zugespielt wird von vorne, einfache Wege.', 'Two setters without hitting power: 4-2 – the front-row one sets, simple movement.'),
      '6-6': T('Ohne Spezialisten passt 6-6: Alle rotieren durch alle Rollen, Pos. 3 spielt zu.', 'Without specialists, 6-6 fits: everyone rotates through every role, pos. 3 sets.'),
    }[ans];
    return {
      prompt: T(`Euer Kader: ${list('de')}.${extraDe} Welches System passt am besten?`, `Your squad: ${list('en')}.${extraEn} Which system fits best?`),
      visual: null,
      options: finishOptions(['5-1', '4-2', '6-2', '6-6'].map((s) => ({ value: s, label: T(s, s), correct: s === ans })), r),
      explanation: why,
      tags: { roles: ['S', 'U'], rot: 0, phase: 'base' },
    };
  },

  /** Du bist Rolle X in Rx: Wo stehst du in Phase Y? (Antwort auf dem Feld) */
  myPos(p) {
    const r = makeRng(p.seed);
    const sys = getSystem(p.systemId); const sq = demoSquad(sys);
    const me = playerOf(sq, p.role, p.idx);
    const fAt = (rot, phase) => computeFormation({ sys, lineup: lineupAtRotation(sq.lineup, rot), players: sq.players, liberos: sq.liberos, phase });
    const f = fAt(p.rot, p.phase);
    const mine = f.entries.find((e) => e.id === me.id);
    const LETTERS = 'ABCD';
    const opts = [];
    const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1.15;
    const others = f.entries.filter((e) => e.id !== me.id);
    const addPos = (pt, correct, origin) => {
      if (!pt || opts.some((o) => o.pt && near(o.pt, pt))) return;
      if (!correct && others.some((o) => near(o, pt))) return;
      if (pt.y > 9.9 || pt.x < -0.5 || pt.x > 9.5) return;
      opts.push({ pt: { x: +pt.x.toFixed(2), y: +pt.y.toFixed(2) }, correct, origin });
    };
    if (mine) addPos(mine, true);
    for (const d of [1, -1, 2]) {
      const rr = ((p.rot - 1 + d) % 6 + 6) % 6 + 1;
      const e = fAt(rr, p.phase).entries.find((x) => x.id === me.id);
      if (e) addPos(e, false, { rot: rr, phase: p.phase });
    }
    for (const ph of r.shuffle(QUIZ_PHASES.filter((x) => x !== p.phase))) {
      const e = fAt(p.rot, ph).entries.find((x) => x.id === me.id);
      if (e) addPos(e, false, { rot: p.rot, phase: ph });
    }
    let guard = 0;
    while (opts.length < (mine ? 4 : 3) && guard++ < 40) addPos({ x: r.int(5, 85) / 10, y: r.int(5, 85) / 10 }, false);
    const markers = opts.slice(0, mine ? 4 : 3);
    const shuffled = r.shuffle(markers).map((o, i) => ({ id: 'o' + i, value: LETTERS[i], label: T(LETTERS[i], LETTERS[i]), correct: o.correct, pt: o.pt, origin: o.origin }));
    if (p.role === 'L' || p.role === 'MB') shuffled.push({ id: 'o9', value: 'bench', label: T('Ich bin nicht auf dem Feld', 'I am off court'), correct: !mine, bench: true });
    const task = taskOf(me.id, f);
    const TK = {
      serve: T('Du schlägst auf.', 'You serve.'), prepSet: T('Nach dem Aufschlag zum Zuspielpunkt.', 'After the serve, run to the setting spot.'),
      blockReady: T('Vorne, bereit zum Block.', 'Front row, ready to block.'), defenseReady: T('Hinten in die Abwehr.', 'Back row defense.'),
      pass: T('Du nimmst an.', 'You pass.'), toSetPoint: T('Du läufst zum Zuspielpunkt.', 'You run to the setting spot.'),
      attackReady: T('Du bereitest deinen Angriff vor.', 'You prepare your attack.'), cover: T('Du sicherst hinten ab.', 'You cover in the back.'),
      bench: T(p.role === 'L' ? 'Die Mitte ist vorne oder schlägt auf – der Libero ist draussen.' : 'Der Libero ersetzt dich hinten – du bist draussen.', p.role === 'L' ? 'The middle is in front or serving – the libero is out.' : 'The libero replaces you in the back row – you are out.'),
    }[task];
    return {
      prompt: T(`Du bist ${RN.de[p.role]} (${sys.name}) in R${p.rot}. Wo stehst du ${PH.de[p.phase]}?`, `You are the ${RN.en[p.role].toLowerCase()} (${sys.name}) in R${p.rot}. Where do you stand ${PH.en[p.phase]}?`),
      visual: { systemId: sys.id, rot: p.rot, phase: p.phase, hideId: me.id, markers: true, showLabels: true },
      options: shuffled,
      explanation: T(`Rotationsposition: Pos. ${mine ? mine.zone : (lineupAtRotation(sq.lineup, p.rot).indexOf(me.id) + 1 || '–')}. ${TK.de}`, `Rotation spot: pos. ${mine ? mine.zone : (lineupAtRotation(sq.lineup, p.rot).indexOf(me.id) + 1 || '–')}. ${TK.en}`),
      tags: { roles: [p.role], rot: p.rot, phase: p.phase },
      answerMode: 'court', mineId: me.id,
    };
  },
};

/** Zufällige Parameter für einen Fragetyp */
export function randomParams(type, r, { role = 'OH', difficulty = 'medium', systemId = '5-1' } = {}) {
  const seed = r.int(1, 2 ** 30);
  const sid = systemFor(role, systemId, difficulty);
  const sys = getSystem(sid);
  const roleIn = sys.roles.includes(role) || (role === 'L' && sys.liberos) ? role : sys.roles[0];
  const idx = roleIn === 'L' ? 1 : r.int(1, Math.max(1, sys.roles.filter((x) => x === roleIn).length));
  const phases = difficulty === 'easy' ? ['receive', 'serve'] : difficulty === 'medium' ? ['receive', 'serve', 'attack'] : QUIZ_PHASES;
  switch (type) {
    case 'rotWhere': return { seed, systemId: sid, role: roleIn === 'L' ? sys.roles[0] : roleIn, idx, rot: r.int(1, 6), k: difficulty === 'easy' ? r.int(1, 2) : r.int(1, 5), dir: difficulty === 'hard' && r.chance(0.4) ? -1 : 1 };
    case 'rotWho': return { seed, systemId: sid, role: roleIn === 'L' ? sys.roles[0] : roleIn, idx, rot: r.int(1, 6), k: difficulty === 'easy' ? 1 : r.int(1, 4) };
    case 'overlap': {
      const phase = r.pick(['receive', 'receive', 'serve']);
      const pairs = [...FRONT_BACK_PAIRS.map((x) => ['frontBack', x]), ...LATERAL_PAIRS.map((x) => ['lateral', x])].filter(([, pr]) => phase !== 'serve' || !pr.includes(1));
      const [kind, pair] = r.pick(pairs);
      const delta = difficulty === 'hard' ? 0.15 : difficulty === 'easy' ? 0.9 : 0.4;
      return { seed, systemId: sid, rot: r.int(1, 6), phase, role: roleIn, fault: r.chance(0.8) ? { kind, pair, delta } : null };
    }
    case 'libero': {
      const zone = r.int(1, 6);
      return { seed, zone, serving: r.chance(zone === 1 ? 0.6 : 0.4), justLeft: difficulty !== 'easy' && r.chance(0.2) && !isFront(zone) };
    }
    case 'system': return { seed, target: r.pick(['5-1', '4-2', '6-2', '6-6']), v: r.int(0, 5) };
    case 'myPos': {
      let rr = roleIn;
      return { seed, systemId: sid, role: rr, idx, rot: r.int(1, 6), phase: r.pick(phases) };
    }
    default: return { seed };
  }
}

export function generate(type, params) {
  const q = GEN[type](params);
  delete q._r;
  return { type, params, key: type + ':' + JSON.stringify(params), answerMode: 'choice', ...q };
}

/**
 * Nächste Frage gemäss Übungsfokus.
 * focus: 'mine' | 'all' | 'mixed'; mix = Anteil eigene Rolle (0..100)
 */
export function nextQuestion({ focus = 'all', myRole = null, mix = 70, difficulty = 'medium', systemId = '5-1', seed, types, roleFilter, constraints = {} } = {}) {
  const r = makeRng(seed ?? Math.floor(Math.random() * 2 ** 30));
  const roles = ['S', 'OH', 'MB', 'OPP', 'L'];
  let role;
  if (roleFilter) role = roleFilter;
  else if (!myRole || focus === 'all') role = r.pick(roles);
  else if (focus === 'mine') role = myRole;
  else role = r.chance(mix / 100) ? myRole : r.pick(roles.filter((x) => x !== myRole));
  const pool = (types?.length ? ROLE_TYPES[role].filter((x) => types.includes(x)) : ROLE_TYPES[role]);
  const type = r.pick(pool.length ? pool : ROLE_TYPES[role]);
  const params = randomParams(type, r, { role, difficulty, systemId });
  if (constraints.rot && 'rot' in params) params.rot = type === 'rotWhere' || type === 'rotWho' ? ((((constraints.rot - 1 - params.k * (params.dir || 1)) % 6) + 6) % 6) + 1 : constraints.rot;
  if (constraints.phase && type === 'myPos') params.phase = constraints.phase;
  const q = generate(type, params);
  q.focusRole = role;
  q.isMine = !!myRole && q.tags.roles.includes(myRole);
  return q;
}

/** Antwort prüfen */
export const isCorrect = (q, optionId) => !!q.options.find((o) => o.id === optionId)?.correct;
