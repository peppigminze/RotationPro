// Lektionen – aus der Regel-Engine generiert (Texte DE/EN), ohne DOM
import { getSystem, demoSquad } from './systems.js';
import { lineupAtRotation, isFront, FRONT_BACK_PAIRS, LATERAL_PAIRS } from './core.js';
import { computeFormation, QUIZ_PHASES } from './formation.js';

const T = (de, en) => ({ de, en });
const RN = {
  de: { S: 'Zuspieler', OH: 'Aussen', MB: 'Mitte', OPP: 'Diagonal', L: 'Libero', U: 'Allrounder' },
  en: { S: 'setter', OH: 'outside', MB: 'middle', OPP: 'opposite', L: 'libero', U: 'all-rounder' },
};
const ZN = {
  de: { 1: 'hinten rechts', 2: 'vorne rechts', 3: 'vorne Mitte', 4: 'vorne links', 5: 'hinten links', 6: 'hinten Mitte' },
  en: { 1: 'back right', 2: 'front right', 3: 'front middle', 4: 'front left', 5: 'back left', 6: 'back middle' },
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Welches System eignet sich, um eine Rolle zu zeigen? */
export function systemForRole(role, preferredId) {
  const pref = getSystem(preferredId || '5-1');
  const has = role === 'L' ? pref.liberos > 0 : pref.roles.includes(role);
  return has ? pref : getSystem('5-1');
}

/** Szene: Demo-Kader, Formation, eigener Spieler */
export function scene({ systemId, rot = 1, phase = 'base', role = null }) {
  const sys = getSystem(systemId);
  const sq = demoSquad(sys);
  const lineup = lineupAtRotation(sq.lineup, rot);
  const f = computeFormation({ sys, lineup, players: sq.players, liberos: sq.liberos, phase: phase === 'base' ? 'base' : phase });
  const mineId = role ? (role === 'L' ? sq.liberos[0] : sq.list.find((p) => p.role === role)?.id) : null;
  return { sys, sq, lineup, f, mineId };
}

function partnerText(f, players, zone, L) {
  const at = (z) => { const e = f.entries.find((x) => x.zone === z); return e ? RN[L][players[e.id]?.role === 'L' ? 'L' : e.role] : '?'; };
  const parts = [];
  for (const [a, b] of FRONT_BACK_PAIRS) {
    if (a === zone) parts.push(L === 'de' ? `vor ${at(b)} (Pos. ${b})` : `in front of the ${at(b)} (pos. ${b})`);
    if (b === zone) parts.push(L === 'de' ? `hinter ${at(a)} (Pos. ${a})` : `behind the ${at(a)} (pos. ${a})`);
  }
  for (const [l, r] of LATERAL_PAIRS) {
    if (l === zone) parts.push(L === 'de' ? `links von ${at(r)} (Pos. ${r})` : `left of the ${at(r)} (pos. ${r})`);
    if (r === zone) parts.push(L === 'de' ? `rechts von ${at(l)} (Pos. ${l})` : `right of the ${at(l)} (pos. ${l})`);
  }
  return L === 'de' ? ` Überlappung: Du musst ${parts.join(', ')} stehen.` : ` Overlap: you must stand ${parts.join(', ')}.`;
}

const lane = (x, L) => (x < 3 ? (L === 'de' ? 'links' : 'left') : x < 6 ? (L === 'de' ? 'Mitte' : 'middle') : (L === 'de' ? 'rechts' : 'right'));

/** Beschreibt, was die Rolle in Rotation/Phase tut. */
export function describeRole({ systemId, rot, phase, role }, L = 'de') {
  const { sq, f, mineId } = scene({ systemId, rot, phase, role });
  const P = sq.players;
  const e = f.entries.find((x) => x.id === mineId);
  const de = L === 'de';
  if (!e) {
    if (role === 'L') return de ? 'Die Mitte, die du ersetzen würdest, steht vorne oder schlägt gerade selbst auf – du wartest in der Wechselzone.' : 'The middle you would replace is in the front row or serving – you wait in the replacement zone.';
    return de ? 'Der Libero ersetzt dich in der Hinterreihe. Du kommst zurück, sobald du nach vorne (Pos. 4) rotierst – oder du schlägst auf Pos. 1 selbst auf.' : 'The libero replaces you in the back row. You return once you rotate to the front (pos. 4) – or you serve yourself from pos. 1.';
  }
  const where = de ? `Pos. ${e.zone} (${ZN.de[e.zone]})` : `pos. ${e.zone} (${ZN.en[e.zone]})`;
  const front = isFront(e.zone);
  let s = '';
  if (phase === 'serve') {
    if (e.server) s = de ? 'Du schlägst auf – von hinter der Grundlinie.' : 'You serve – from behind the end line.';
    else if (e.setter) s = de ? `Du stehst auf ${where}. Sobald der Aufschlag weg ist, läufst du zum Zuspielpunkt zwischen Pos. 2 und 3.` : `You start in ${where}. As soon as the serve is away, run to the setting spot between pos. 2 and 3.`;
    else s = front ? (de ? `Du stehst vorne auf ${where} – nach dem Aufschlag bereit zum Block.` : `You are in the front row, ${where} – ready to block after the serve.`)
      : (de ? `Du stehst hinten auf ${where} – nach dem Aufschlag gehst du in deine Abwehrposition.` : `You are in the back row, ${where} – after the serve move to your defense spot.`);
    if (!e.server) s += partnerText(f, P, e.zone, L);
  } else if (phase === 'receive') {
    if (e.passer) s = de ? `Rotationsposition ${where}. Du stehst im Annahmeriegel ${lane(e.x, 'de')} und nimmst den Aufschlag an.` : `Rotation spot ${where}. You are in the passing line on the ${lane(e.x, 'en')} and pass the serve.`;
    else if (e.setter) s = de ? `Rotationsposition ${where}. Du nimmst nicht an: Du stellst dich so nah wie erlaubt Richtung Netz (Zustellen) und spielst den zweiten Ball zu.` : `Rotation spot ${where}. You don't pass: get as close to the net as the rules allow and set the second ball.`;
    else if (front) s = e.role === 'MB' ? (de ? `Du stehst am Netz auf ${where}, nicht in der Annahme – bereit für den Schnellangriff.` : `You stay at the net in ${where}, not passing – ready for the quick attack.`)
      : (de ? `Du stehst am Netz auf ${where}, nicht in der Annahme, und bereitest deinen Anlauf vor.` : `You stay at the net in ${where}, not passing, and prepare your approach.`);
    else s = de ? `Du stehst hinten auf ${where}, ausserhalb des Annahmeriegels, und sicherst ab.` : `You stand back in ${where}, out of the passing line, and cover.`;
    s += partnerText(f, P, e.zone, L);
  } else if (phase === 'attack') {
    if (e.setter) s = de ? 'Du stehst am Zuspielpunkt zwischen Pos. 2 und 3 und verteilst den Ball.' : 'You are at the setting spot between pos. 2 and 3 and distribute the ball.';
    else if (front) {
      if (e.x < 2.5) s = de ? 'Anlauf über Pos. 4 (links) – Angriff über aussen.' : 'Approach on pos. 4 (left) – outside attack.';
      else if (e.x < 6) s = e.role === 'MB' ? (de ? 'Schnellangriff in der Mitte (Kurz/1er) – früh abspringen.' : 'Quick attack in the middle – jump early.') : (de ? 'Angriff über die Mitte.' : 'Attack through the middle.');
      else s = de ? 'Anlauf über Pos. 2 (rechts) – Angriff auf der Diagonalen.' : 'Approach on pos. 2 (right) – right-side attack.';
    } else if (e.x > 6) s = e.role === 'OPP' ? (de ? 'Hinterfeld-Angriff von Pos. 1 – Absprung hinter der 3-m-Linie.' : 'Back-row attack from pos. 1 – take off behind the 3 m line.') : (de ? 'Absichern hinten rechts.' : 'Cover back right.');
    else if (e.x > 3) s = e.role === 'OH' ? (de ? 'Hinterfeld-Angriff aus der Mitte (Pipe) – Absprung hinter der 3-m-Linie.' : 'Back-row attack in the middle (pipe) – take off behind the 3 m line.') : (de ? 'Absichern hinten Mitte.' : 'Cover back middle.');
    else s = de ? 'Absichern hinten links – Bälle aus dem Block auffangen.' : 'Cover back left – pick up balls off the block.';
    s = (de ? `Aus ${where}: ` : `From ${where}: `) + s;
  } else if (phase === 'block') {
    if (front) {
      if (e.y > 2) s = de ? 'Du löst dich vom Netz und sicherst Finten und kurze Bälle ab.' : 'You drop off the net and cover tips and short balls.';
      else if (e.x < 7.5) s = de ? 'Du läufst nach rechts und schliesst den Doppelblock.' : 'You slide right and close the double block.';
      else s = de ? 'Du stellst den Block rechts gegen den gegnerischen Aussenangriff.' : 'You set the block on the right against their outside attack.';
    } else if (e.x < 3) s = de ? 'Abwehr links an der Linie.' : 'Defend the left line.';
    else if (e.y > 7.5 && e.x < 6) s = de ? 'Abwehr tief in der Mitte.' : 'Defend deep middle.';
    else s = de ? 'Abwehr rechts hinter dem Block (Diagonale).' : 'Defend right behind the block (cross court).';
    s = (de ? `Aus ${where}: ` : `From ${where}: `) + s;
  } else if (phase === 'defense') {
    s = front ? (de ? `Am Netz ${lane(e.x, 'de')}, bereit zum Block.` : `At the net on the ${lane(e.x, 'en')}, ready to block.`)
      : (de ? `Abwehr hinten ${lane(e.x, 'de')} – Angriff lesen, tief bleiben.` : `Back-row defense on the ${lane(e.x, 'en')} – read the attack, stay low.`);
    s = (de ? `Aus ${where}: ` : `From ${where}: `) + s;
  } else {
    s = de ? `Rotationsposition ${where}.` : `Rotation spot ${where}.`;
  }
  return s;
}

/** Systemüberblick für eine Rotation/Phase */
export function describeSystem({ systemId, rot, phase }, L = 'de') {
  const { sq, f } = scene({ systemId, rot, phase });
  const P = sq.players;
  const de = L === 'de';
  const nm = (e) => cap(RN[L][P[e.id]?.role === 'L' ? 'L' : e.role]);
  const setter = f.entries.find((e) => e.setter);
  const sp = setter ? (de ? `Zuspiel: ${nm(setter)} von Pos. ${setter.zone} (${isFront(setter.zone) ? 'vorne' : 'hinten'}).` : `Setting: ${nm(setter)} from pos. ${setter.zone} (${isFront(setter.zone) ? 'front' : 'back'} row).`) : '';
  if (phase === 'receive') {
    const ps = f.entries.filter((e) => e.passer).map(nm);
    return `R${rot} – ${sp} ${de ? 'Annahme' : 'Passing'}: ${ps.join(', ')}.`;
  }
  if (phase === 'attack') {
    const hitters = f.entries.filter((e) => isFront(e.zone) && !e.setter).map(nm);
    const backAtt = f.entries.filter((e) => !isFront(e.zone) && !e.setter && (e.role === 'OPP' || e.role === 'OH')).map(nm);
    return `R${rot} – ${de ? `${hitters.length} Angreifer vorne` : `${hitters.length} front-row hitters`}: ${hitters.join(', ')}.` + (backAtt.length ? (de ? ` Hinterfeld: ${backAtt.join(', ')}.` : ` Back row: ${backAtt.join(', ')}.`) : '');
  }
  return `R${rot} – ${sp}`;
}

const GENERAL = [
  {
    id: 'g-rotation', tags: [], title: T('Positionen & Rotation', 'Positions & rotation'),
    steps: [
      { sys: '5-1', rot: 1, phase: 'base', text: T('Das Feld hat sechs Positionen. Vorne von links: 4, 3, 2. Hinten von links: 5, 6, 1. Das Netz ist oben.', 'The court has six positions. Front row from the left: 4, 3, 2. Back row from the left: 5, 6, 1. The net is at the top.') },
      { sys: '5-1', rot: 1, phase: 'serve', text: T('Aufgeschlagen wird immer von Position 1 – hinten rechts, hinter der Grundlinie.', 'The serve always comes from position 1 – back right, behind the end line.') },
      { sys: '5-1', rot: 2, phase: 'base', text: T('Gewinnt ihr den Aufschlag zurück (Side-out), rotiert ihr im Uhrzeigersinn: 2 → 1, 1 → 6, 6 → 5, 5 → 4, 4 → 3, 3 → 2.', 'When you win the serve back (side-out), rotate clockwise: 2 → 1, 1 → 6, 6 → 5, 5 → 4, 4 → 3, 3 → 2.') },
      { sys: '5-1', rot: 3, phase: 'base', text: T('Die Reihenfolge bleibt immer gleich. Wer neben wem steht, ändert sich nie – nur die Positionen wandern.', 'The order never changes. Who stands next to whom stays the same – only the positions move.') },
      { sys: '5-1', rot: 4, phase: 'base', text: T('Nach sechs Rotationen stehen alle wieder am Anfang. Wir nennen sie R1 bis R6; in R1 steht der Zuspieler auf Pos. 1.', 'After six rotations everyone is back at the start. We call them R1 to R6; in R1 the setter is in pos. 1.') },
      { sys: '5-1', rot: 1, phase: 'base', text: T('Schlägt ihr auf und gewinnt den Punkt, rotiert ihr nicht. Rotiert wird nur nach dem Side-out.', 'If you serve and win the point, you do not rotate. You only rotate after a side-out.') },
    ],
  },
  {
    id: 'g-overlap', tags: [], title: T('Überlappungsregel', 'Overlap rule'),
    steps: [
      { sys: '5-1', rot: 1, phase: 'base', text: T('Im Moment des Aufschlags müssen alle in der Rotationsordnung stehen. Danach dürfen sich alle frei bewegen.', 'At the moment of service everyone must be in rotation order. After that everyone may move freely.') },
      { sys: '5-1', rot: 1, phase: 'base', highlight: [4, 5], text: T('Vorne/hinten: Pos. 4 muss näher am Netz stehen als Pos. 5, Pos. 3 näher als 6, Pos. 2 näher als 1.', 'Front/back: pos. 4 must be closer to the net than pos. 5, pos. 3 closer than 6, pos. 2 closer than 1.') },
      { sys: '5-1', rot: 1, phase: 'base', highlight: [4, 3, 2], text: T('Seitlich in der Reihe: 4 links von 3, 3 links von 2. Hinten: 5 links von 6, 6 links von 1. Diagonale Paare zählen nicht.', 'Sideways in a row: 4 left of 3, 3 left of 2. Back row: 5 left of 6, 6 left of 1. Diagonal pairs do not count.') },
      { sys: '5-1', rot: 1, phase: 'receive', illegal: { 2: { x: 7.2, y: 7.4 } }, text: T('Fehler: Pos. 2 steht hinter Pos. 1. Das ist Überlappung – Punkt für den Gegner.', 'Fault: pos. 2 is behind pos. 1. That is an overlap – point for the opponent.') },
      { sys: '5-1', rot: 1, phase: 'receive', text: T('Korrekt: Der Zuspieler auf Pos. 1 steht knapp hinter und rechts von seinen Partnern und läuft erst nach dem Aufschlag zum Netz.', 'Correct: the setter in pos. 1 stays just behind and right of his partners and only runs to the net after the serve.') },
      { sys: '5-1', rot: 1, phase: 'serve', text: T('Der Aufschläger ist ausgenommen – er steht ja hinter der Grundlinie. Massgebend ist die Fussposition.', 'The server is exempt – they stand behind the end line. What counts is the position of the feet.') },
    ],
  },
  {
    id: 'g-libero', tags: ['L', 'MB'], title: T('Libero-Regeln', 'Libero rules'),
    steps: [
      { sys: '5-1', rot: 1, phase: 'base', text: T('Der Libero (andere Trikotfarbe) ersetzt meist die Mitte, sobald sie hinten steht (Pos. 1, 6, 5).', 'The libero (different jersey colour) usually replaces the middle once they are in the back row (pos. 1, 6, 5).') },
      { sys: '5-1', rot: 2, phase: 'base', text: T('Rotiert die Mitte weiter, bleibt der Libero für sie im Spiel …', 'As the middle keeps rotating, the libero stays in for them …') },
      { sys: '5-1', rot: 3, phase: 'receive', text: T('… bis sie nach vorne auf Pos. 4 kommt: Dann muss der Libero raus – er darf nicht vorne spielen. Gleichzeitig ersetzt er die andere Mitte, die jetzt hinten ist.', '… until they reach pos. 4: then the libero must leave – he may not play in the front row. At the same time he replaces the other middle, who is now in the back row.') },
      { sys: '5-1', rot: 3, phase: 'serve', text: T('Der Libero darf nicht aufschlagen. Steht die Mitte beim eigenen Aufschlag auf Pos. 1, schlägt sie selbst auf.', 'The libero may not serve. If the middle is in pos. 1 when your team serves, the middle serves.') },
      { sys: '5-1', rot: 1, phase: 'receive', text: T('Weitere Einschränkungen: kein Angriff über Netzhöhe, kein Block, kein oberes Zuspiel aus der Vorderzone für einen Angriff über Netzhöhe. Zwischen zwei Libero-Wechseln muss ein Ballwechsel liegen.', 'More limits: no attack above net height, no block, no overhand set from the front zone for an attack above the net. There must be a completed rally between two libero replacements.') },
      { sys: '5-1', rot: 1, phase: 'base', text: T('Mit zwei Liberos steht trotzdem immer nur einer auf dem Feld. Typisch: Annahme-Libero und Abwehr-Libero oder je einer pro Mitte.', 'With two liberos only one is on court at a time. Typical: a receive libero and a defense libero, or one per middle.') },
    ],
  },
  {
    id: 'g-phases', tags: [], title: T('Die fünf Spielphasen', 'The five phases'),
    steps: QUIZ_PHASES.map((ph) => ({ sys: '5-1', rot: 1, phase: ph, arrows: 'all', text: {
      serve: T('Aufschlag: Alle in Rotationsordnung, der Spieler auf Pos. 1 schlägt auf.', 'Serve: everyone in rotation order, the player in pos. 1 serves.'),
      receive: T('Annahme: Ein Riegel aus 2–3 Annehmenden, der Zuspieler geht Richtung Netz. Hier zählt die Überlappung.', 'Receive: a line of 2–3 passers, the setter heads to the net. Overlap counts here.'),
      attack: T('Angriff: Jetzt laufen alle auf ihre Spezialpositionen – Aussen links, Mitte zentral, Diagonal rechts.', 'Attack: everyone moves to their specialist spot – outside left, middle centre, opposite right.'),
      block: T('Block: Gegen einen Angriff über aussen stellen zwei Spieler einen Doppelblock, der dritte löst sich.', 'Block: against an outside attack two players form a double block, the third drops off.'),
      defense: T('Abwehr: Vorderreihe am Netz, Hinterreihe verteilt – bereit, den Angriff zu lesen.', 'Defense: front row at the net, back row spread – ready to read the attack.'),
    }[ph] })),
  },
];

const ROLE_INTRO = {
  S: [
    T('Als Zuspieler spielst du fast jeden zweiten Ball. Dein Ziel: der Zuspielpunkt zwischen Pos. 2 und 3, nahe am Netz.', 'As setter you play almost every second ball. Your target: the setting spot between pos. 2 and 3, close to the net.'),
    T('Zustellen: Stehst du hinten, läufst du nach dem gegnerischen Aufschlag sofort nach vorne. Vorher musst du die Überlappung einhalten – du versteckst dich hinter deinen Partnern.', 'Penetration: when you are in the back row, run forward as soon as the opponent serves. Before that you must respect the overlap – you hide behind your partners.'),
    T('Stehst du vorne, darfst du auch den zweiten Ball direkt rüberspielen und blockst auf der rechten Seite.', 'In the front row you may also dump the second ball and you block on the right side.'),
  ],
  OH: [
    T('Als Aussen bist du Annahme-Spieler und Hauptangreifer über Pos. 4.', 'As outside hitter you pass and you are the main attacker on pos. 4.'),
    T('In der Annahme bildest du mit dem Libero und dem zweiten Aussen den Riegel. Danach Anlauf von ausserhalb der Seitenlinie.', 'In serve receive you form the line with the libero and the other outside. Then start your approach from outside the sideline.'),
    T('Hinten greifst du aus der Mitte an (Pipe), im Block stehst du links gegen den gegnerischen Diagonalen.', 'In the back row you attack in the middle (pipe); in the block you are on the left against their opposite.'),
  ],
  MB: [
    T('Als Mitte bist du Blockspezialist und spielst den Schnellangriff.', 'As middle you are the block specialist and hit the quick attack.'),
    T('Libero-Wechsel: Hinten ersetzt dich meist der Libero. Auf Pos. 1 beim eigenen Aufschlag schlägst du selbst auf, danach wechselt der Libero für dich ein.', 'Libero swap: in the back row the libero usually replaces you. In pos. 1 on your own serve you serve yourself, then the libero comes in.'),
    T('Blockwege: Du startest in der Mitte, liest den Zuspieler und läufst seitlich (Sidestep/Kreuzschritt) zum Doppelblock.', 'Block footwork: start in the middle, read the setter and move sideways (shuffle/crossover) to close the double block.'),
  ],
  OPP: [
    T('Als Diagonal stehst du immer gegenüber dem Zuspieler – drei Positionen entfernt. Du nimmst kaum an.', 'As opposite you always stand across from the setter – three positions away. You rarely pass.'),
    T('Vorne greifst du über Pos. 2 an, hinten über Pos. 1 mit Absprung hinter der 3-m-Linie.', 'In the front row you attack on pos. 2, in the back row from pos. 1, taking off behind the 3 m line.'),
    T('Im Block stehst du rechts gegen den gegnerischen Aussenangriff.', 'In the block you are on the right against their outside attack.'),
  ],
  L: [
    T('Als Libero bist du der Annahme- und Abwehrspezialist – mit eigener Trikotfarbe.', 'As libero you are the passing and defense specialist – in a different jersey.'),
    T('Wechselzeitpunkte: vor dem Pfiff zum Aufschlag, in der Wechselzone, ohne Anmeldung beim Schreiber. Zwischen zwei Wechseln muss ein Ballwechsel liegen.', 'When to swap: before the whistle for service, in the replacement zone, no request needed. A rally must pass between two swaps.'),
    T('Einschränkungen: nicht vorne spielen, nicht aufschlagen, nicht blocken, nicht über Netzhöhe angreifen. In der Annahme stehst du meist in der Mitte des Riegels.', 'Limits: no front row, no serving, no blocking, no attacking above net height. In serve receive you usually take the middle of the line.'),
  ],
};

/** Alle Lektionen. mySystem bestimmt das System der Rollenlektionen. */
export function buildLessons(mySystem = '5-1') {
  const lessons = GENERAL.map((l) => ({ ...l, kind: 'general' }));
  for (const sid of ['5-1', '4-2', '6-2', '6-6']) {
    const sys = getSystem(sid);
    const steps = [{ sys: sid, rot: 1, phase: 'base', text: T(sys.info.de.summary + ' ' + sys.info.de.pros, sys.info.en.summary + ' ' + sys.info.en.pros) }];
    for (let r = 1; r <= 6; r++) {
      for (const ph of ['receive', 'attack']) steps.push({ sys: sid, rot: r, phase: ph, arrows: 'all', gen: { kind: 'system', systemId: sid, rot: r, phase: ph } });
    }
    steps.push({ sys: sid, rot: 1, phase: 'base', text: T('Nachteile: ' + sys.info.de.cons + ' Wann sinnvoll: ' + sys.info.de.when, 'Cons: ' + sys.info.en.cons + ' When it fits: ' + sys.info.en.when) });
    lessons.push({ id: 'sys-' + sid, kind: 'system', tags: sid === '6-6' ? [] : sid === '5-1' ? ['S', 'OPP'] : ['S'], title: T(`System ${sid}`, `${sid} system`), steps });
  }
  for (const role of ['S', 'OH', 'MB', 'OPP', 'L']) {
    const sys = systemForRole(role, mySystem);
    const steps = ROLE_INTRO[role].map((text) => ({ sys: sys.id, rot: 1, phase: role === 'L' || role === 'OH' ? 'receive' : role === 'MB' ? 'block' : 'attack', role, arrows: 'mine', text }));
    for (let r = 1; r <= 6; r++) steps.push({ sys: sys.id, rot: r, phase: 'receive', role, arrows: 'mine', phases: QUIZ_PHASES, gen: { kind: 'role', systemId: sys.id, rot: r, role } });
    lessons.push({ id: 'role-' + role, kind: 'role', tags: [role], title: T(`Rolle: ${RN.de[role]} (${sys.name})`, `Role: ${cap(RN.en[role])} (${sys.name})`), steps });
  }
  return lessons;
}

/** Text eines Schritts (generiert oder fest) */
export function stepText(step, phase, L = 'de') {
  if (step.gen?.kind === 'role') return describeRole({ ...step.gen, phase }, L);
  if (step.gen?.kind === 'system') return describeSystem({ ...step.gen, phase }, L);
  return step.text?.[L] || step.text?.de || '';
}
