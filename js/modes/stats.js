// Statistik & Schwachstellen
import { t, addStrings } from '../i18n.js';
import { h, clear, segmented, fmtPct, fmtMs, select } from '../ui/dom.js';
import { state } from '../ui/store.js';
import { summarize, groupBy, weakCells, confusions, suggestions } from '../engine/analysis.js';
import { QUIZ_PHASES } from '../engine/formation.js';
import { playerLevel } from './game.js';

addStrings({
  de: {
    'st.title': 'Statistik', 'st.empty': 'Noch keine Antworten. Spiele ein Quiz oder ein Match – danach siehst du hier deine Stärken und Schwächen.',
    'st.answers': 'Antworten', 'st.acc': 'Trefferquote', 'st.time': 'Ø Reaktionszeit', 'st.byFocus': 'Nach Übungsfokus', 'st.byRole': 'Nach Rolle',
    'st.heat': 'Rotation × Phase', 'st.heatRole': 'Rolle', 'st.allRoles': 'Alle Rollen', 'st.weak': 'Schwachstellen', 'st.noWeak': 'Keine auffälligen Schwachstellen – weiter so. Ab 3 Antworten pro Situation wird ausgewertet.',
    'st.conf.rot': 'R{a} und R{b} {phase} werden oft verwechselt ({role}, {n}×).', 'st.conf.phase': 'In R{rot} werden {p1} und {p2} oft verwechselt ({role}, {n}×).',
    'st.cell': '{role} in R{rot} {phase}: nur {acc} richtig.', 'st.type': 'Fragetyp „{type}": {acc} richtig.', 'st.train': 'Gezielt üben',
    'st.src': 'Quelle', 'st.src.all': 'Alles', 'st.src.quiz': 'Quiz', 'st.src.game': 'Match', 'st.game': 'Match-Stress', 'st.played': '{n} Spiele', 'st.bestStreak': 'Längste Serie {n}',
    'qt.rotWhere': 'Wo nach X Rotationen', 'qt.rotWho': 'Wer steht wo', 'qt.overlap': 'Überlappung finden', 'qt.libero': 'Libero-Wechsel', 'qt.system': 'System wählen', 'qt.myPos': 'Meine Position', 'qt.team': 'Team aufstellen',
  },
  en: {
    'st.title': 'Stats', 'st.empty': 'No answers yet. Play a quiz or a match – then your strengths and weak spots show up here.',
    'st.answers': 'Answers', 'st.acc': 'Accuracy', 'st.time': 'Avg. reaction time', 'st.byFocus': 'By practice focus', 'st.byRole': 'By role',
    'st.heat': 'Rotation × phase', 'st.heatRole': 'Role', 'st.allRoles': 'All roles', 'st.weak': 'Weak spots', 'st.noWeak': 'No clear weak spots – keep going. Situations are evaluated from 3 answers on.',
    'st.conf.rot': 'R{a} and R{b} {phase} get mixed up often ({role}, {n}×).', 'st.conf.phase': 'In R{rot}, {p1} and {p2} get mixed up often ({role}, {n}×).',
    'st.cell': '{role} in R{rot} {phase}: only {acc} correct.', 'st.type': 'Question type "{type}": {acc} correct.', 'st.train': 'Practice this',
    'st.src': 'Source', 'st.src.all': 'All', 'st.src.quiz': 'Quiz', 'st.src.game': 'Match', 'st.game': 'Match stress', 'st.played': '{n} games', 'st.bestStreak': 'Longest streak {n}',
    'qt.rotWhere': 'Where after X rotations', 'qt.rotWho': 'Who is where', 'qt.overlap': 'Spot the overlap', 'qt.libero': 'Libero swap', 'qt.system': 'Pick a system', 'qt.myPos': 'My position', 'qt.team': 'Set up the team',
  },
});

let root, src = 'all', heatRole = '';

function bar(acc) {
  const pct = acc == null ? 0 : Math.round(acc * 100);
  return h('span', { class: 'acc-bar' }, h('span', { style: { width: pct + '%', background: acc == null ? 'transparent' : acc >= 0.8 ? 'var(--ok)' : acc >= 0.6 ? 'var(--warn)' : 'var(--err)' } }));
}

function draw() {
  clear(root);
  const all = state.events.filter((e) => src === 'all' || e.src === src);
  root.append(h('h1', {}, t('st.title')),
    segmented(['all', 'quiz', 'game'].map((v) => ({ value: v, label: t('st.src.' + v) })), src, (v) => { src = v; draw(); }));
  const g = state.game;
  root.append(h('section', { class: 'card stat-game' }, h('h2', {}, t('st.game')),
    h('p', {}, `${t('gm.playerLevel', { n: playerLevel(g.xp) })} – ${t('gm.xp', { n: g.xp || 0 })} – ${t('st.played', { n: g.played || 0 })} – ${t('st.bestStreak', { n: g.bestStreak || 0 })}`)));
  if (!all.length) { root.append(h('p', { class: 'empty' }, t('st.empty'))); return; }
  const tot = summarize(all);
  root.append(h('div', { class: 'kpis' },
    h('div', { class: 'kpi' }, h('strong', {}, tot.n), h('span', {}, t('st.answers'))),
    h('div', { class: 'kpi' }, h('strong', {}, fmtPct(tot.acc)), h('span', {}, t('st.acc'))),
    h('div', { class: 'kpi' }, h('strong', {}, fmtMs(tot.ms)), h('span', {}, t('st.time')))));

  // Nach Fokus
  const byF = groupBy(all, (e) => e.focus);
  root.append(h('div', { class: 'section-title' }, h('h2', {}, t('st.byFocus'))),
    h('div', { class: 'list' }, ['mine', 'all', 'mixed'].map((f) => {
      const s = byF.get(f) || { n: 0, acc: null, ms: null };
      return h('div', { class: 'row-item stat-row' }, h('span', { class: 'grow' }, h('span', { class: 'title' }, t('focus.' + f)), h('span', { class: 'sub' }, ` ${s.n} – ${fmtMs(s.ms)}`)), bar(s.acc), h('strong', { class: 'acc-num' }, fmtPct(s.acc)));
    })));

  // Nach Rolle
  const byR = groupBy(all.filter((e) => e.role && e.role !== 'U'), (e) => e.role);
  root.append(h('div', { class: 'section-title' }, h('h2', {}, t('st.byRole'))),
    h('div', { class: 'list' }, ['S', 'OH', 'MB', 'OPP', 'L'].map((r) => {
      const s = byR.get(r) || { n: 0, acc: null, ms: null };
      return h('div', { class: 'row-item stat-row' + (r === state.settings.myRole ? ' on' : '') }, h('span', { class: 'role-dot r-' + r }),
        h('span', { class: 'grow' }, h('span', { class: 'title' }, t('role.' + r)), h('span', { class: 'sub' }, ` ${s.n} – ${fmtMs(s.ms)}`)), bar(s.acc), h('strong', { class: 'acc-num' }, fmtPct(s.acc)));
    })));

  // Heatmap
  const hev = all.filter((e) => e.rot && e.phase && e.phase !== 'base' && (!heatRole || e.role === heatRole));
  const cell = groupBy(hev, (e) => `${e.rot}|${e.phase}`);
  const table = h('div', { class: 'heat', role: 'table' },
    h('div', { class: 'heat-row head', role: 'row' }, h('span'), QUIZ_PHASES.map((p) => h('span', { role: 'columnheader' }, t('phase.' + p)))),
    [1, 2, 3, 4, 5, 6].map((r) => h('div', { class: 'heat-row', role: 'row' }, h('span', { class: 'heat-r', role: 'rowheader' }, 'R' + r),
      QUIZ_PHASES.map((p) => {
        const s = cell.get(`${r}|${p}`);
        const c = !s ? 'none' : s.acc >= 0.8 ? 'good' : s.acc >= 0.6 ? 'mid' : 'bad';
        return h('span', { class: 'heat-c ' + c, role: 'cell', title: s ? `${fmtPct(s.acc)} (${s.n})` : '–' }, s ? Math.round(s.acc * 100) : '·');
      }))));
  root.append(h('div', { class: 'section-title' }, h('h2', {}, t('st.heat')),
    select([{ value: '', label: t('st.allRoles') }, ...['S', 'OH', 'MB', 'OPP', 'L'].map((r) => ({ value: r, label: t('role.' + r) }))], heatRole, (v) => { heatRole = v; draw(); }, { class: 'sel-small', 'aria-label': t('st.heatRole') })),
    h('div', { class: 'heat-wrap' }, table));

  // Schwachstellen + Vorschläge
  const sug = suggestions(all);
  const box = h('div', { class: 'list' });
  const R = (r) => t('role.' + r);
  for (const s of sug) {
    let txt = '';
    if (s.kind === 'confRot') txt = t('st.conf.rot', { a: s.rot, b: s.rot2, phase: t('phaseIn.' + s.phase), role: R(s.role), n: s.n });
    else if (s.kind === 'confPhase') txt = t('st.conf.phase', { rot: s.rot, p1: t('phase.' + s.phases[0]), p2: t('phase.' + s.phases[1]), role: R(s.role), n: s.n });
    else if (s.kind === 'cell') txt = t('st.cell', { role: R(s.role), rot: s.rot, phase: t('phaseIn.' + s.phase), acc: fmtPct(s.acc) });
    else txt = t('st.type', { type: t('qt.' + s.type), acc: fmtPct(s.acc) });
    box.append(h('div', { class: 'row-item weak' }, h('span', { class: 'grow' }, txt),
      h('button', { class: 'btn small primary', onclick: () => { window.RP.pendingQuiz = s.quiz; location.hash = '#/quiz'; } }, t('st.train'))));
  }
  if (!sug.length) box.append(h('p', { class: 'muted' }, t('st.noWeak')));
  root.append(h('div', { class: 'section-title' }, h('h2', {}, t('st.weak'))), box);
}

export default { render(r) { root = r; draw(); } };
