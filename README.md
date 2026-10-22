# RotationPro

Volleyball-Aufstellungen planen, Rotationen verstehen und die eigene Position trainieren – als installierbare, offline-fähige PWA (Deutsch/Englisch).

**Live:** https://peppigminze.github.io/RotationPro/

## Funktionen

- **Feld**: Spieler per Tap oder Drag & Drop auf Positionen 1–6 setzen, Bank, Rotation vor/zurück mit Animation, Reset. Phasen Aufschlag / Annahme / Angriff / Block / Abwehr mit Laufweg-Pfeilen, frei verschiebbare Spieler und Live-Überlappungs-Checker (FIVB 7.4). Export als Bild (Web Share API).
- **Systeme**: Presets 5-1, 4-2, 6-2, 6-6 mit Erklärung; eigener Editor (6–12 Spieler, 0–2 Zuspieler, 0–2 Liberos, Rollen pro Position, Hobby-Optionen: Mixed, vereinfachte Regeln, Libero optional).
- **Libero-Logik**: ersetzt die Mitte hinten, geht vorne raus, schlägt nicht auf (abschaltbar), 2 Liberos mit drei Wechsel-Logiken, Magenta-Markierung.
- **Kader**: mehrere Teams, Spieler (Name, Nummer, Rolle, Geschlecht), benannte Aufstellungen, „Das bin ich".
- **Lernen**: generierte Lektionen – Grundlagen, Systeme R1–R6, Rollen (Zuspieler, Aussen, Mitte, Diagonal, Libero) × Rotation × Phase, mit Animation und Fortschritt.
- **Quiz**: 6 regelbasierte Fragetypen (Rotation wo/wer, Überlappung finden, Libero-Wechsel, System passend zum Kader, „Du bist X in Rotation Y – wo stehst du?"), Fokus *Meine Position / Alle Rollen / Gemischt* (Verhältnis einstellbar), 3 Schwierigkeitsgrade, Spaced Repetition.
- **Match-Stress**: Ich-Perspektive, Team-Perspektive, Schiri-Blitz, Rotations-Rush – Timer, Leben, Streak-Multiplikator, Crunch Time, Timeout, Sound, Haptik, XP/Level, Tages-Challenge, Highscores.
- **Statistik**: nach Fokus, Rolle, Rotation × Phase (Heatmap), Reaktionszeit, erkannte Verwechslungen („R4 und R5 in der Annahme") und Trainingsvorschläge.
- **Taktiktafel**: Pfeile und Freihand-Laufwege, Spieler verschieben, Undo, speichern, teilen.

## Aufbau

```
js/engine/   Regel-Engine – reine Logik ohne DOM (Node-testbar)
  core.js        Positionen, Rotation, Überlappung, Libero, Mixed-Hinweise
  systems.js     Systeme (Daten), Validierung, aktiver Zuspieler, Auto-Aufstellung
  formation.js   Grundpositionen pro Phase, Aufgaben
  lessons.js     Lektionen und generierte Erklärtexte
  questions.js   Fragengenerator (deterministisch aus Seeds)
  srs.js         Spaced Repetition (Leitner)
  analysis.js    Statistik, Schwachstellen, Vorschläge
js/ui/       Spielfeld (SVG + Pointer Events), Speicher (IndexedDB), Helfer
js/modes/    Ansichten: Feld, Lernen, Quiz, Match, Statistik, Kader, Systeme, Taktik, Einstellungen
```

## Entwicklung

```bash
npm test                 # Unit-Tests der Regel-Engine (node:test)
node tools/build-sw.mjs  # Precache-Liste + Cache-Version des Service Workers aktualisieren
python3 -m http.server   # lokal starten → http://localhost:8000
```

Kein Build-Schritt, keine Abhängigkeiten. Alle Daten bleiben lokal auf dem Gerät.
