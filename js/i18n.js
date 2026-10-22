// Zweisprachige Oberfläche (DE/EN). Module registrieren eigene Texte über addStrings().
const dict = { de: {}, en: {} };
let lang = 'de';

export function addStrings(s) {
  for (const l of ['de', 'en']) Object.assign(dict[l], s[l] || {});
}
export const setLang = (l) => { lang = l === 'en' ? 'en' : 'de'; document.documentElement.lang = lang; };
export const getLang = () => lang;

/** t('key', {n: 3}) – Platzhalter {n}. Fehlende Schlüssel fallen auf Deutsch, dann auf den Schlüssel zurück. */
export function t(key, params = {}) {
  let s = dict[lang][key] ?? dict.de[key] ?? key;
  if (typeof s === 'function') return s(params);
  return s.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
}

addStrings({
  de: {
    appName: 'RotationPro',
    'role.S': 'Zuspieler', 'role.OH': 'Aussen', 'role.MB': 'Mitte', 'role.OPP': 'Diagonal', 'role.L': 'Libero', 'role.U': 'Allrounder',
    'roleShort.S': 'Z', 'roleShort.OH': 'A', 'roleShort.MB': 'M', 'roleShort.OPP': 'D', 'roleShort.L': 'L', 'roleShort.U': 'U',
    'phase.base': 'Grundstellung', 'phase.serve': 'Aufschlag', 'phase.receive': 'Annahme', 'phase.attack': 'Angriff', 'phase.block': 'Block', 'phase.defense': 'Abwehr',
    'phaseIn.base': 'in der Grundstellung', 'phaseIn.serve': 'beim eigenen Aufschlag', 'phaseIn.receive': 'in der Annahme', 'phaseIn.attack': 'im Angriff', 'phaseIn.block': 'im Block', 'phaseIn.defense': 'in der Abwehr',
    'nav.field': 'Feld', 'nav.learn': 'Lernen', 'nav.quiz': 'Quiz', 'nav.game': 'Match', 'nav.more': 'Mehr',
    'focus.mine': 'Meine Position', 'focus.all': 'Alle Rollen', 'focus.mixed': 'Gemischt',
    pos: 'Pos. {z}', posLong: 'Position {z}', rot: 'R{r}',
    // Überlappung
    'ov.frontBack': '{a} (Pos. {za}) muss näher am Netz stehen als {b} (Pos. {zb}).',
    'ov.lateral': '{a} (Pos. {za}) muss weiter links stehen als {b} (Pos. {zb}).',
    'ov.none': 'Keine Überlappung – Aufstellung ist regelkonform.',
    'ov.title': 'Überlappungsfehler',
    'ov.serverFree': 'Der Aufschläger ist von der Überlappungsregel ausgenommen.',
    // Libero
    'lib.liberoFront': 'Der Libero darf nicht vorne (Pos. 2, 3, 4) spielen.',
    'lib.liberoServe': 'Der Libero darf nicht aufschlagen – auf Pos. 1 schlägt beim eigenen Aufschlag der Stammspieler auf.',
    'lib.liberoRally': 'Zwischen zwei Libero-Wechseln muss ein abgeschlossener Spielzug liegen.',
    'lib.liberoBack': 'Erlaubt: Der Libero darf jeden Spieler der Hinterreihe ersetzen.',
    'lib.liberoTwo': 'Es darf nur ein Libero gleichzeitig auf dem Feld stehen.',
    'lib.replaces': 'Libero ersetzt {name}',
    'mixed.mixedMin': 'Gemischtes Team: mindestens {min} Frauen auf dem Feld (aktuell {n}).',
    'mixed.mixedAlt': 'Gemischtes Team: Pos. {a} und {b} – Männer sollten in der Rotation nicht nebeneinander stehen.',
    'task.serve': 'Aufschlagen', 'task.prepSet': 'Nach dem Aufschlag zum Zuspielpunkt', 'task.blockReady': 'Am Netz, bereit zum Block',
    'task.defenseReady': 'Abwehrposition hinten', 'task.pass': 'Annehmen', 'task.toSetPoint': 'Zum Zuspielpunkt laufen',
    'task.attackReady': 'Anlauf vorbereiten (Angriff)', 'task.cover': 'Absichern hinten', 'task.bench': 'Ausgewechselt (Libero/Mitte)',
    save: 'Speichern', cancel: 'Abbrechen', del: 'Löschen', edit: 'Bearbeiten', close: 'Schliessen', add: 'Hinzufügen', back: 'Zurück', next: 'Weiter', start: 'Starten', done: 'Fertig', yes: 'Ja', no: 'Nein', ok: 'OK',
    'sys.title': 'System {name}', 'sys.pros': 'Vorteile', 'sys.cons': 'Nachteile', 'sys.when': 'Wann sinnvoll', 'sys.summary': 'Kurz erklärt',
    confirmDelete: '„{name}" wirklich löschen?', saved: 'Gespeichert', you: 'DU',
  },
  en: {
    'role.S': 'Setter', 'role.OH': 'Outside', 'role.MB': 'Middle', 'role.OPP': 'Opposite', 'role.L': 'Libero', 'role.U': 'All-rounder',
    'roleShort.S': 'S', 'roleShort.OH': 'OH', 'roleShort.MB': 'MB', 'roleShort.OPP': 'OP', 'roleShort.L': 'L', 'roleShort.U': 'U',
    'phase.base': 'Lineup', 'phase.serve': 'Serve', 'phase.receive': 'Receive', 'phase.attack': 'Attack', 'phase.block': 'Block', 'phase.defense': 'Defense',
    'phaseIn.base': 'in the base lineup', 'phaseIn.serve': 'when your team serves', 'phaseIn.receive': 'in serve receive', 'phaseIn.attack': 'in attack', 'phaseIn.block': 'when blocking', 'phaseIn.defense': 'in defense',
    'nav.field': 'Court', 'nav.learn': 'Learn', 'nav.quiz': 'Quiz', 'nav.game': 'Match', 'nav.more': 'More',
    'focus.mine': 'My position', 'focus.all': 'All roles', 'focus.mixed': 'Mixed',
    pos: 'Pos. {z}', posLong: 'Position {z}', rot: 'R{r}',
    'ov.frontBack': '{a} (pos. {za}) must be closer to the net than {b} (pos. {zb}).',
    'ov.lateral': '{a} (pos. {za}) must be further left than {b} (pos. {zb}).',
    'ov.none': 'No overlap – this lineup is legal.',
    'ov.title': 'Overlap fault',
    'ov.serverFree': 'The server is exempt from the overlap rule.',
    'lib.liberoFront': 'The libero may not play in the front row (pos. 2, 3, 4).',
    'lib.liberoServe': 'The libero may not serve – the regular player in pos. 1 serves when your team serves.',
    'lib.liberoRally': 'There must be a completed rally between two libero replacements.',
    'lib.liberoBack': 'Allowed: the libero may replace any back-row player.',
    'lib.liberoTwo': 'Only one libero may be on court at a time.',
    'lib.replaces': 'Libero replaces {name}',
    'mixed.mixedMin': 'Mixed team: at least {min} women on court (currently {n}).',
    'mixed.mixedAlt': 'Mixed team: pos. {a} and {b} – men should not stand next to each other in the rotation.',
    'task.serve': 'Serve', 'task.prepSet': 'After the serve, run to the setting spot', 'task.blockReady': 'At the net, ready to block',
    'task.defenseReady': 'Back-row defense position', 'task.pass': 'Pass the serve', 'task.toSetPoint': 'Run to the setting spot',
    'task.attackReady': 'Prepare your approach (attack)', 'task.cover': 'Cover in the back row', 'task.bench': 'Off court (libero swap)',
    save: 'Save', cancel: 'Cancel', del: 'Delete', edit: 'Edit', close: 'Close', add: 'Add', back: 'Back', next: 'Next', start: 'Start', done: 'Done', yes: 'Yes', no: 'No', ok: 'OK',
    'sys.title': '{name} system', 'sys.pros': 'Pros', 'sys.cons': 'Cons', 'sys.when': 'When it fits', 'sys.summary': 'In short',
    confirmDelete: 'Delete "{name}"?', saved: 'Saved', you: 'YOU',
  },
});
