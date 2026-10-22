// Spielsysteme – konfigurierbar, Presets sind nur Daten
import { rotate, isFront, isBack } from './core.js';

export const PRESET_SYSTEMS = [
  {
    id: '5-1', preset: true, name: '5-1', players: 7, setters: 1, liberos: 1,
    setterRule: 'single', setterZone: 2,
    roles: ['S', 'OH', 'MB', 'OPP', 'OH', 'MB'],
    hobby: { mixed: false, simplified: false, liberoOptional: false },
    info: {
      de: {
        summary: 'Ein Zuspieler spielt in allen sechs Rotationen. Ihm gegenüber steht der Diagonalspieler.',
        pros: 'Immer derselbe Zuspieler, klare Rollen, maximal spezialisiert.',
        cons: 'In drei Rotationen nur zwei Angreifer vorne; viele Laufwege für den Zuspieler.',
        when: 'Ab ambitioniertem Vereinsniveau mit einem starken Zuspieler.',
      },
      en: {
        summary: 'One setter sets in all six rotations, with the opposite hitter across from them.',
        pros: 'Same setter every rally, clear roles, highly specialised.',
        cons: 'Only two front-row hitters in three rotations; long runs for the setter.',
        when: 'Competitive club teams with one strong setter.',
      },
    },
  },
  {
    id: '4-2', preset: true, name: '4-2', players: 6, setters: 2, liberos: 0,
    setterRule: 'front', setterZone: 2,
    roles: ['S', 'OH', 'MB', 'S', 'OH', 'MB'],
    hobby: { mixed: false, simplified: false, liberoOptional: true },
    info: {
      de: {
        summary: 'Zwei Zuspieler stehen sich gegenüber. Zugespielt wird immer von dem, der vorne steht.',
        pros: 'Einfach zu lernen, kurze Wege, Zuspieler immer am Netz.',
        cons: 'Nur zwei Angreifer vorne, Gegner kann den Block leichter stellen.',
        when: 'Einsteiger, Jugend und Hobbyteams.',
      },
      en: {
        summary: 'Two setters stand opposite each other. Whoever is in the front row sets.',
        pros: 'Easy to learn, short runs, setter always at the net.',
        cons: 'Only two front-row hitters, easier for the opponent to block.',
        when: 'Beginners, youth and recreational teams.',
      },
    },
  },
  {
    id: '6-2', preset: true, name: '6-2', players: 7, setters: 2, liberos: 1,
    setterRule: 'back', setterZone: 2,
    roles: ['S', 'OH', 'MB', 'S', 'OH', 'MB'],
    hobby: { mixed: false, simplified: false, liberoOptional: true },
    info: {
      de: {
        summary: 'Zwei Zuspieler; zugespielt wird immer von dem, der hinten steht. Der vordere greift diagonal an.',
        pros: 'Immer drei Angreifer vorne.',
        cons: 'Zwei Zuspieler mit Angriffsqualität nötig, mehr Wechsel und Laufwege.',
        when: 'Teams mit zwei Allroundern, die zuspielen und angreifen können.',
      },
      en: {
        summary: 'Two setters; the back-row one sets, the front-row one attacks as opposite.',
        pros: 'Always three front-row hitters.',
        cons: 'Needs two setters who can also hit; more movement.',
        when: 'Teams with two all-rounders who can both set and hit.',
      },
    },
  },
  {
    id: '6-6', preset: true, name: '6-6', players: 6, setters: 0, liberos: 0,
    setterRule: 'zone', setterZone: 3,
    roles: ['U', 'U', 'U', 'U', 'U', 'U'],
    hobby: { mixed: true, simplified: true, liberoOptional: true },
    info: {
      de: {
        summary: 'Keine Spezialisten: Alle rotieren durch alle Rollen. Wer auf Position 3 steht, spielt zu.',
        pros: 'Jeder lernt alles, fair für gemischte Hobbyteams, keine Positionswechsel.',
        cons: 'Wenig Spezialisierung, das Zuspiel wechselt jede Rotation.',
        when: 'Freizeit, Schule, Mixed-Plausch und erste Trainingsjahre.',
      },
      en: {
        summary: 'No specialists: everyone rotates through every role. Whoever is in position 3 sets.',
        pros: 'Everyone learns everything, fair for mixed recreational teams, no switching.',
        cons: 'Little specialisation, the setter changes every rotation.',
        when: 'Recreational play, school, mixed fun leagues, first years.',
      },
    },
  },
];

export const getSystem = (id, custom = []) => PRESET_SYSTEMS.find((s) => s.id === id) || custom.find((s) => s.id === id) || PRESET_SYSTEMS[0];

/** Neues eigenes System anlegen (Defaults wie 5-1). */
export function createCustomSystem(over = {}) {
  const sys = {
    id: 'sys_' + Math.random().toString(36).slice(2, 9), preset: false, name: 'Mein System',
    players: 8, setters: 1, liberos: 1, setterRule: 'single', setterZone: 3,
    roles: ['S', 'OH', 'MB', 'OPP', 'OH', 'MB'],
    hobby: { mixed: false, simplified: false, liberoOptional: false },
    info: { de: { summary: '', pros: '', cons: '', when: '' }, en: { summary: '', pros: '', cons: '', when: '' } },
    ...over,
  };
  return normalizeSystem(sys);
}

/** Leitet abhängige Felder ab (setterRule aus Anzahl Zuspieler). */
export function normalizeSystem(sys) {
  const s = { ...sys, roles: sys.roles.slice(0, 6) };
  while (s.roles.length < 6) s.roles.push('U');
  s.players = Math.max(6, Math.min(12, s.players | 0));
  s.setters = Math.max(0, Math.min(2, s.setters | 0));
  s.liberos = Math.max(0, Math.min(2, s.liberos | 0));
  if (s.setters === 0) s.setterRule = 'zone';
  else if (s.setters === 1) s.setterRule = 'single';
  else if (!['front', 'back'].includes(s.setterRule)) s.setterRule = 'front';
  return s;
}

/** Validiert ein System; gibt Fehler-Schlüssel zurück. */
export function validateSystem(sys) {
  const errs = [];
  const sCount = sys.roles.filter((r) => r === 'S').length;
  if (sys.roles.includes('L')) errs.push('sysNoLiberoInRotation');
  if (sys.setters > 0 && sCount !== sys.setters) errs.push('sysSetterCount');
  if (sys.setters === 0 && sCount > 0) errs.push('sysSetterCount');
  if (sys.players < 6 + (sys.hobby?.liberoOptional ? 0 : sys.liberos)) errs.push('sysTooFewPlayers');
  if (sys.setters === 2) {
    const i = sys.roles.indexOf('S'), j = sys.roles.lastIndexOf('S');
    if (j - i !== 3) errs.push('sysSettersOpposite');
  }
  return errs;
}

/** Wer spielt in dieser Aufstellung zu? */
export function activeSetterId(sys, court, players) {
  const ss = court.map((id, i) => ({ id, z: i + 1 })).filter((e) => players[e.id]?.role === 'S');
  if (sys.setterRule === 'zone') return court[(sys.setterZone || 3) - 1];
  if (sys.setterRule === 'front') { const f = ss.find((e) => isFront(e.z)); if (f) return f.id; }
  if (sys.setterRule === 'back') { const b = ss.find((e) => isBack(e.z)); if (b) return b.id; }
  if (ss.length) return ss[0].id;
  return court[2]; // Fallback: Position 3
}

/** Rolle, die ein Spieler in dieser Situation tatsächlich ausfüllt. */
export function effectiveRole(id, sys, court, players) {
  const r = players[id]?.role;
  if (id === activeSetterId(sys, court, players)) return 'S';
  if (r === 'S') return 'OPP'; // nicht aktiver Zuspieler (6-2/4-2) spielt diagonal
  return r || 'U';
}

/** In welcher Rotation (R1..R6) befindet sich diese Aufstellung bzgl. der System-Grundordnung? 0 = passt nicht. */
export function rotationOf(lineup, players, sys) {
  for (let r = 1; r <= 6; r++) {
    const base = rotate(lineup, -(r - 1));
    if (base.every((id, i) => sys.roles[i] === 'U' || players[id]?.role === sys.roles[i])) return r;
  }
  return 0;
}

/** Stellt Spieler automatisch nach Systemrollen auf (R1). */
export function autoLineup(playerList, sys) {
  const pool = playerList.filter((p) => p.role !== 'L');
  const used = new Set();
  const lineup = sys.roles.map((role) => {
    const p = pool.find((x) => !used.has(x.id) && (role === 'U' || x.role === role));
    if (p) { used.add(p.id); return p.id; }
    return null;
  });
  for (let i = 0; i < 6; i++) {
    if (lineup[i]) continue;
    const p = pool.find((x) => !used.has(x.id));
    if (p) { used.add(p.id); lineup[i] = p.id; }
  }
  const liberos = playerList.filter((p) => p.role === 'L').slice(0, Math.max(sys.liberos, 0)).map((p) => p.id);
  return { lineup, liberos };
}

/** Empfiehlt ein System für einen Kader. counts: {S, OH, MB, OPP, L, U}, setterCanAttack */
export function recommendSystem(c, setterCanAttack = false) {
  const spec = (c.OH || 0) + (c.MB || 0) + (c.OPP || 0);
  if ((c.S || 0) >= 2) return setterCanAttack ? '6-2' : '4-2';
  if ((c.S || 0) === 1 && spec >= 5) return '5-1';
  if ((c.S || 0) === 1) return '4-2';
  return '6-6';
}

const DEMO_NUMBERS = { S: [3, 9], OH: [7, 11], MB: [12, 4], OPP: [8], L: [1, 2], U: [5, 6, 10, 13, 14, 15] };

/** Demo-Kader passend zum System (für Quiz, Lernmodus, Minigame). */
export function demoSquad(sys) {
  const players = {};
  const list = [];
  const cnt = {};
  const add = (role) => {
    cnt[role] = (cnt[role] || 0) + 1;
    const n = (DEMO_NUMBERS[role] || [20])[cnt[role] - 1] ?? 20 + list.length;
    const p = { id: `d_${role}${cnt[role]}`, role, number: n, name: '', idx: cnt[role] };
    players[p.id] = p; list.push(p);
    return p.id;
  };
  const lineup = sys.roles.map((r) => add(r));
  const liberos = [];
  for (let i = 0; i < sys.liberos; i++) liberos.push(add('L'));
  return { players, list, lineup, liberos };
}
