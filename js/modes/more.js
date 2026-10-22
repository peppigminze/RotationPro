// Mehr: Einstieg zu Kader, Systemen, Statistik, Taktiktafel, Einstellungen
import { t, addStrings } from '../i18n.js';
import { h } from '../ui/dom.js';
import { state } from '../ui/store.js';

addStrings({
  de: { 'more.squad': 'Spieler, Teams und gespeicherte Aufstellungen', 'more.systems': 'Presets und eigene Systeme mit Erklärung', 'more.stats': 'Trefferquoten, Reaktionszeit, Schwachstellen', 'more.tactics': 'Laufwege und Pfeile aufs Feld zeichnen', 'more.settings': 'Sprache, Design, Regeln, Daten', level: 'Level {n}' },
  en: { 'more.squad': 'Players, teams and saved lineups', 'more.systems': 'Presets and custom systems with explanations', 'more.stats': 'Accuracy, reaction time, weak spots', 'more.tactics': 'Draw runs and arrows on the court', 'more.settings': 'Language, theme, rules, data', level: 'Level {n}' },
});

export default {
  render(root) {
    const items = ['squad', 'systems', 'stats', 'tactics', 'settings'];
    root.append(h('h1', {}, t('nav.more')),
      h('div', { class: 'list' }, items.map((id) => h('a', { class: 'row-item link-row', href: '#/' + id },
        h('div', { class: 'grow' }, h('div', { class: 'title' }, t('nav.' + id)), h('div', { class: 'sub' }, t('more.' + id))),
        h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')))));

  },
};
