# WebPDF Editor

Ein visueller Editor für PDF-Dateien, der in SvelteKit mit TypeScript und SASS entwickelt wurde.

## Funktionen

- **PDF öffnen**: Importieren und Anzeigen von vorhandenen PDF-Dateien
- **PDF bearbeiten**: Bearbeiten von Text in PDF-Dokumenten
- **PDF speichern**: Exportieren von bearbeiteten PDF-Dokumenten
- **PDF erstellen**: Erstellen neuer PDF-Dokumente von Grund auf

## Technologie-Stack

- **SvelteKit**: Framework für die Erstellung der Webanwendung
- **TypeScript**: Für typsichere Entwicklung
- **SASS/SCSS**: Für erweiterte Styling-Funktionen
- **Tailwind CSS**: Für schnelles und responsives Design
- **PDF.js**: Zum Rendern von PDF-Dokumenten im Browser
- **PDF-lib**: Zum Erzeugen und Bearbeiten von PDF-Dokumenten

## Erste Schritte

### Voraussetzungen

- Node.js (v18 oder höher)
- npm (v9 oder höher)

### Installation

1. Repository klonen:
   ```
   git clone [repository-url]
   cd webpdf
   ```

2. Abhängigkeiten installieren:
   ```
   npm install
   ```

3. Entwicklungsserver starten:
   ```
   npm run dev
   ```

4. Browser öffnen und zu `http://localhost:5173` navigieren

## Entwicklung

### Projektstruktur

- `src/lib/components/`: UI-Komponenten für den PDF-Editor
- `src/lib/services/`: Dienste für die PDF-Verarbeitung
- `src/routes/`: SvelteKit-Routen und Layouts

### Build

Um eine Produktionsversion zu erstellen:

```
npm run build
```

Die fertige Anwendung befindet sich im `build`-Ordner.

## Lizenz

MIT

## Roadmap für künftige Entwicklungen (Version 2+)

- Erweiterte Textformatierungsmöglichkeiten
- Einfügen und Bearbeiten von Bildern
- Formular-Feldern erstellen und bearbeiten
- Kommentare und Anmerkungen
- Kollaboratives Bearbeiten
