# Thunderbird Mail AI Assistant

Eine Thunderbird-Extension zur automatischen E-Mail-Sortierung und Zusammenfassung mittels KI (Ollama/OpenAI).

## Projektstruktur

```
thunderbird-mail-ai/
├── manifest.json           # Extension-Manifest mit Berechtigungen und Metadaten
├── background_scripts/     
│   └── background.js      # Hauptlogik für KI-Integration und E-Mail-Verarbeitung
├── options/               # Einstellungsseite
│   ├── options.html      # UI für Einstellungen
│   ├── options.js        # Einstellungslogik
│   └── options.css       # Styling für Einstellungen
├── ui/                   # Popup-Interface
│   ├── popup.html       # Popup-UI für schnelle Aktionen
│   ├── popup.js        # Popup-Logik
│   └── styles.css      # Popup-Styling
```

## Funktionsweise

### Hauptfunktionen
1. **Automatische E-Mail-Sortierung**
   - Verarbeitet E-Mails aus konfigurierten Quellordnern
   - Analysiert Inhalte mittels KI
   - Verschiebt E-Mails in passende Zielordner
   - Erstellt Zusammenfassungen

2. **KI-Integration**
   - Primär: Lokale Verarbeitung via Ollama
   - Optional: OpenAI-Integration (noch nicht implementiert)
   - Konfigurierbarer Prompt für Analyse

3. **Konfiguration**
   - Quell- und Zielordner wählbar
   - Option für nur ungelesene E-Mails
   - Anpassbarer Verarbeitungs-Prompt
   - Zusammenfassungsordner wählbar

### Dateiübersicht

#### manifest.json
- Definiert Extension-Metadaten
- Legt Berechtigungen fest
- Konfiguriert UI-Integration

#### background.js
- Zentrale Verarbeitungslogik
- KI-API-Kommunikation
- E-Mail-Verarbeitung und -Verschiebung
- Zusammenfassungserstellung

#### options/
- Umfassende Konfigurationsoberfläche
- Ordnerauswahl und KI-Einstellungen
- Prompt-Konfiguration

#### ui/
- Popup für schnelle Einzelaktionen
- Direkte E-Mail-Analyse
- Einfache Zusammenfassungen

## Aktueller Status

### Funktioniert
- ✅ Grundlegende Extension-Struktur
- ✅ Ollama-Integration
- ✅ E-Mail-Extraktion
- ✅ Ordnerstruktur-Erkennung
- ✅ Einstellungs-UI
- ✅ Batch-Verarbeitung
- ✅ Ungelesene E-Mails Filter

### In Arbeit
- 🔄 Zuverlässige E-Mail-Inhaltsextraktion
- 🔄 Robuste Zusammenfassungserstellung
- 🔄 Fehlerbehandlung und Logging

### Noch zu implementieren
- ⏳ OpenAI-Integration
- ⏳ Fortschrittsanzeige bei Batch-Verarbeitung
- ⏳ Bessere Fehlerberichterstattung
- ⏳ Test-Suite
- ⏳ Mehrsprachigkeit
- ⏳ Backup-Funktion für verschobene E-Mails

## Bekannte Probleme
1. E-Mail-Inhalt wird manchmal nicht korrekt extrahiert
2. Zusammenfassungs-E-Mails werden nicht immer korrekt erstellt
3. Ordnerzuordnung könnte präziser sein
4. Fehlerbehandlung muss verbessert werden

## Nächste Schritte
1. E-Mail-Inhaltsextraktion verbessern
2. Zusammenfassungserstellung stabilisieren
3. Ordnerzuordnung optimieren
4. Fehlerbehandlung ausbauen
5. Test-Suite implementieren
6. OpenAI-Integration hinzufügen

## Entwicklungshinweise

### Installation
1. Ollama lokal installieren und starten (http://localhost:11434)
2. In Thunderbird:
   - Menü → Einstellungen → Erweiterungen & Themes
   - Zahnrad → Debug-Add-ons laden
   - Manifest.json auswählen

### Entwicklung
- `npm run build` für Build
- `npm run lint` für Linting
- `npm test` für Tests (noch zu implementieren)

### Debugging
- Thunderbird Entwicklerwerkzeuge: Strg+Shift+I
- Debug-Logs in der Browser-Konsole
- Erweiterungs-Debugger unter about:debugging

## Entwicklungsstand & Setup

### Aktuelles Setup
Die Extension ist derzeit als reines WebExtension-Projekt implementiert:
- Keine Build-Tools oder Bundler
- Direktes Laden der JavaScript-Dateien
- Manuelle Installation in Thunderbird

### Geplante Build-Infrastruktur
- npm und package.json sind vorbereitet, aber noch nicht in Verwendung
- Geplante Tools:
  - web-ext für Packaging und Testing
  - ESLint für Code-Qualität
  - Jest für Unit-Tests

### Nächste Infrastruktur-Schritte
1. Build-System einrichten
   - web-ext für Entwicklung und Packaging
   - Hot-Reload während der Entwicklung
2. Linting und Code-Formatierung
   - ESLint-Konfiguration
   - Prettier für konsistente Formatierung
3. Test-Framework
   - Jest für Unit-Tests
   - Integration Tests für Thunderbird-APIs
