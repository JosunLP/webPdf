import { PDFDocument, rgb, StandardFonts, LineCapStyle } from 'pdf-lib';
import type { PDFDocumentProxy, TextItem } from 'pdfjs-dist/types/src/display/api'; // Import TextItem
import { writable, type Writable, get } from 'svelte/store';

// Define interface for PDF.js
interface PDFJSStatic {
  getDocument(params: { data: ArrayBuffer }): { promise: Promise<PDFDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
}

// PDF.js nur im Browser importieren
// Verhindern von serverseitigem Import, der den DOMMatrix-Fehler verursacht
let pdfjs: PDFJSStatic | null = null;

// Interface für Textformatierungen
export interface TextFormatting {
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
}

// Kommentar-Interface hinzufügen
export interface Comment {
  id: string;
  pageNumber: number;
  position: Point;
  text: string;
  author: string;
  createdAt: Date;
  color: string;
}

// Standard-Textformatierung
export const defaultFormatting: TextFormatting = {
  fontFamily: 'Arial',
  fontSize: 12,
  isBold: false,
  isItalic: false,
  isUnderline: false
};

// Typen für grafische Elemente
export type Point = { x: number; y: number };

/**
 * Verschiedene Arten von Shapes, die auf einer PDF-Seite gezeichnet werden können
 */
export enum ShapeType {
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  LINE = 'line',
  ARROW = 'arrow',
  TEXT = 'text',
  IMAGE = 'image'
}

/**
 * Schnittstelle für grafische Elemente (Formen, Linien, etc.)
 */
export interface ShapeElement {
  id: string;
  type: ShapeType;
  startPoint: Point;
  endPoint?: Point;
  color: string;
  lineWidth: number;
  filled?: boolean;
  text?: string;
  textFormatting?: TextFormatting;
  imageData?: string;  // Base64-codiertes Bild
  imageWidth?: number; // Originalgröße
  imageHeight?: number; // Originalgröße
  rotation?: number;   // Rotation in Grad (0-360)
}

// Interface für PDF-Seiten
export interface PDFPage {
  pageNumber: number;
  textContent: string;
  width: number;
  height: number;
  canvas?: HTMLCanvasElement;
  formatting: TextFormatting;
  shapes: ShapeElement[]; // Array für grafische Elemente
  comments: Comment[]; // Array für Kommentare
}

// Interface für PDF-Dokumentinformationen
export interface PDFDocumentInfo {
  fileName: string;
  totalPages: number;
  pages: PDFPage[];
  modified: boolean;
  currentFormatting: TextFormatting;
}

// Interface für Suchergebnisse
export interface SearchResult {
  pageNumber: number;
  text: string;
  matchIndex: number;
  matchLength: number;
}

// Aktuelles Zeichenwerkzeug
export enum DrawingTool {
  NONE = 'none',
  SELECT = 'select',
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  LINE = 'line',
  ARROW = 'arrow',
  TEXT = 'text',
  COMMENT = 'comment',
  IMAGE = 'image',  // Neues Zeichenwerkzeug für Bilder
  TABLE = 'table'   // Neues Zeichenwerkzeug für Tabellen
}

// Store für das aktuelle PDF-Dokument
export const currentPdfDocument: Writable<PDFDocumentInfo | null> = writable(null);

// Store für die aktuelle Textformatierung
export const currentFormatting: Writable<TextFormatting> = writable({...defaultFormatting});

// Store für das aktuelle Zeichenwerkzeug
export const currentDrawingTool: Writable<DrawingTool> = writable(DrawingTool.NONE);

// Store für die aktuellen Zeicheneigenschaften
export const currentDrawingProperties: Writable<{
  color: string;
  lineWidth: number;
  filled: boolean;
}> = writable({
  color: '#000000',
  lineWidth: 2,
  filled: false
});

// Hilfsfunktion zum Laden von PDF.js nur im Browser
const loadPdfJs = async () => {
  if (typeof window !== 'undefined' && !pdfjs) {
    try {
      // Dynamisches Importieren von pdfjs-dist
      const pdfJsModule = await import('pdfjs-dist');
      
      if (!pdfJsModule) {
        console.error('PDF.js konnte nicht geladen werden');
        throw new Error('PDF.js konnte nicht geladen werden');
      }
      
      pdfjs = pdfJsModule as unknown as PDFJSStatic;
      
      // Worker-Konfiguration mit Fallback
      try {
        // Primär lokalen Worker verwenden (vorher kopiert in static-Ordner)
        const workerSrc = '/pdf.worker.min.js';
        console.log('PDF.js Worker-Pfad:', workerSrc);
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      } catch (workerError) {
        console.error('Fehler beim Setzen des Worker-Pfads:', workerError);
        // Bei Fehler versuchen, den CDN-Worker mit aktueller Version zu verwenden
        const PDFJS_WORKER_SRC = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.1.91/build/pdf.worker.min.mjs';
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
        console.log('CDN PDF.js Worker wird verwendet');
      }
    } catch (error) {
      console.error('Fehler beim Laden von PDF.js:', error);
      throw error;
    }
  }
  return pdfjs;
};

// PDF-Hilfsfunktionen
export class PDFService {
  /**
   * Lädt ein PDF-Dokument aus einer Datei
   */
  static async loadPdfFromFile(file: File): Promise<PDFDocumentInfo> {
    try {
      const pdfjs = await loadPdfJs();
      if (!pdfjs) throw new Error('PDF.js konnte nicht geladen werden.');
      
      const fileArrayBuffer = await file.arrayBuffer();
      
      // Prüfen, ob die Datei gültig ist und Daten enthält
      if (!fileArrayBuffer || fileArrayBuffer.byteLength === 0) {
        throw new Error('Die PDF-Datei ist leer oder beschädigt.');
      }
      
      // Timeout für das Laden des Dokuments setzen (30 Sekunden)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Zeitüberschreitung beim Laden des PDF-Dokuments.')), 30000);
      });
      
      // PDF-Dokument mit Timeout laden
      const loadPromise = pdfjs.getDocument({ data: fileArrayBuffer }).promise;
      const pdfDoc = await Promise.race([loadPromise, timeoutPromise]) as PDFDocumentProxy;
      
      if (!pdfDoc || !pdfDoc.numPages) {
        throw new Error('Das PDF-Dokument enthält keine Seiten.');
      }
      
      const pages: PDFPage[] = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        try {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          
          // Erstellen eines Canvas für die Seite
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // Rendern der Seite auf dem Canvas
          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
          }
          
          // Standardformatierung setzen
          const pageFormatting = {...defaultFormatting};
          
          // Extrahierte Shapes sammeln
          const shapes: ShapeElement[] = [];
          
          // Text aus dem Dokument extrahieren mit verbesserter Fehlerbehandlung und Formatierung
          let structuredText = '';
          let textItems: Array<{text: string, x: number, y: number, fontSize?: number, fontFamily?: string, fontWeight?: string, fontStyle?: string}> = [];
          
          try {
            // Verbesserte Textextraktion mit Formatierungsinformationen
            const textContent = await page.getTextContent();
            
            if (textContent && Array.isArray(textContent.items)) {
              // Durchgehen der Text-Items mit zusätzlichen Style-Informationen
              textItems = textContent.items
                .filter((item: unknown): item is TextItem =>
                  item !== null &&
                  typeof item === 'object' &&
                  'str' in item &&
                  typeof (item as { str: unknown }).str === 'string'
                )
                .map((item: TextItem) => {
                  // Extrahiere Formatierungsdetails aus dem PDF-Dokument
                  let fontSize = 12;
                  let fontFamily = 'Arial';
                  let fontWeight = 'normal';
                  let fontStyle = 'normal';
                  
                  // Style-Informationen extrahieren, wenn verfügbar
                  if (item.fontName) {
                    fontFamily = item.fontName.replace(/[+,]/g, '');
                    
                    // Versuchen, Formatierungsinformationen aus dem Font-Namen zu extrahieren
                    if (fontFamily.toLowerCase().includes('bold')) {
                      fontWeight = 'bold';
                    }
                    
                    if (fontFamily.toLowerCase().includes('italic') || fontFamily.toLowerCase().includes('oblique')) {
                      fontStyle = 'italic';
                    }
                  }
                  
                  // Schriftgröße extrahieren
                  if (item.transform && Array.isArray(item.transform) && item.transform.length >= 6) {
                    const scaleFactor = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);
                    fontSize = Math.round(scaleFactor);
                    
                    // Realistischeren Wert sicherstellen
                    if (fontSize < 6) fontSize = 10;
                    if (fontSize > 72) fontSize = 24;
                  }
                  
                  // Position extrahieren
                  const x = item.transform ? item.transform[4] : 0;
                  const y = item.transform ? item.transform[5] : 0;
                  
                  return {
                    text: item.str,
                    x: x,
                    y: y,
                    fontSize,
                    fontFamily,
                    fontWeight,
                    fontStyle
                  };
                });
              
              // Text nach Position sortieren (von oben nach unten, dann von links nach rechts)
              textItems.sort((a, b) => {
                // Toleranz für Zeilengleichheit (10 Pixel)
                const lineHeightTolerance = 10;
                const lineDiff = Math.abs(a.y - b.y);
                
                if (lineDiff <= lineHeightTolerance) {
                  // Auf gleicher Zeile, nach X-Position sortieren
                  return a.x - b.x;
                }
                // Nach Y-Position sortieren (von oben nach unten)
                return b.y - a.y;
              });
              
              // Strings mit Berücksichtigung der Zeilenumbrüche zusammenfügen
              let currentLine = -1;
              const lines: string[] = [];
              let currentLineText = '';
              const lineHeightTolerance = 10;
              
              for (let j = 0; j < textItems.length; j++) {
                const item = textItems[j];
                
                if (j === 0) {
                  // Erste Zeile
                  currentLine = item.y;
                  currentLineText = item.text;
                } else {
                  // Neue Zeile erkannt?
                  if (Math.abs(item.y - currentLine) > lineHeightTolerance) {
                    lines.push(currentLineText);
                    currentLineText = item.text;
                    currentLine = item.y;
                  } else {
                    // Zum aktuellen Text hinzufügen, mit Berücksichtigung von Wortabständen
                    const lastItem = textItems[j - 1];
                    const spaceNeeded = (item.x - (lastItem.x + lastItem.text.length * (lastItem.fontSize || 12) * 0.6)) > 5;
                    currentLineText += (spaceNeeded ? ' ' : '') + item.text;
                  }
                }
              }
              
              if (currentLineText) {
                lines.push(currentLineText);
              }
              
              structuredText = lines.join('\n');
              
              // Formatierung aus dem ersten Textelement extrahieren (falls vorhanden)
              if (textItems.length > 0) {
                const firstItem = textItems[0];
                pageFormatting.fontSize = firstItem.fontSize || 12;
                pageFormatting.fontFamily = firstItem.fontFamily || 'Arial';
                pageFormatting.isBold = firstItem.fontWeight === 'bold';
                pageFormatting.isItalic = firstItem.fontStyle === 'italic';
                
                // Textformatierungen zu Shapes hinzufügen
                for (const item of textItems) {
                  // Prüfen, ob die Formatierung vom Standard abweicht
                  const isFormatted = item.fontWeight === 'bold' || 
                                     item.fontStyle === 'italic' || 
                                     item.fontSize !== pageFormatting.fontSize;
                                     
                  // Nur spezielle Formatierungen als Text-Shapes speichern
                  if (isFormatted && item.text.trim()) {
                    const shapeId = `text-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                    shapes.push({
                      id: shapeId,
                      type: ShapeType.TEXT,
                      startPoint: { x: item.x, y: viewport.height - item.y },
                      color: '#000000',
                      lineWidth: 1,
                      text: item.text,
                      textFormatting: {
                        fontFamily: item.fontFamily || pageFormatting.fontFamily,
                        fontSize: item.fontSize || pageFormatting.fontSize,
                        isBold: item.fontWeight === 'bold',
                        isItalic: item.fontStyle === 'italic',
                        isUnderline: false
                      }
                    });
                  }
                }
              }
            }
          } catch (textError) {
            console.warn(`Konnte Text von Seite ${i} nicht laden:`, textError);
            structuredText = '';
          }
          
          try {
            // Extrahieren der Vektorgrafiken und Formen aus dem PDF
            // Operatoren abrufen (wenn unterstützt)
            const operatorList = await page.getOperatorList();
            
            if (operatorList && operatorList.fnArray && operatorList.argsArray) {
              // Durchsuchen der Operationen nach gängigen Zeichenbefehlen
              for (let j = 0; j < operatorList.fnArray.length; j++) {
                const opId = operatorList.fnArray[j];
                const args = operatorList.argsArray[j];
                
                // Prüfen, welcher Operator vorliegt und entsprechende Shape erstellen
                // Linien extrahieren
                if (opId === 1 /* OP_moveto */ && j < operatorList.fnArray.length - 2) {
                  const nextOpId = operatorList.fnArray[j+1];
                  const nextNextOpId = operatorList.fnArray[j+2];
                  
                  // Linie gefunden (moveTo + lineTo + stroke)
                  if (nextOpId === 2 /* OP_lineto */ && nextNextOpId === 33 /* OP_stroke */) {
                    const moveArgs = operatorList.argsArray[j];
                    const lineArgs = operatorList.argsArray[j+1];
                    
                    if (moveArgs && lineArgs && moveArgs.length >= 2 && lineArgs.length >= 2) {
                      const lineId = `line-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                      shapes.push({
                        id: lineId,
                        type: ShapeType.LINE,
                        startPoint: { 
                          x: moveArgs[0], 
                          y: viewport.height - moveArgs[1] 
                        },
                        endPoint: { 
                          x: lineArgs[0], 
                          y: viewport.height - lineArgs[1]
                        },
                        color: '#000000',
                        lineWidth: 2
                      });
                    }
                  }
                }
                
                // Rechtecke extrahieren
                if (opId === 84 /* OP_rectangle */ && args && args.length >= 4) {
                  const rectId = `rect-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                  
                  // Rechteck mit richtig orientierten Koordinaten erstellen
                  shapes.push({
                    id: rectId,
                    type: ShapeType.RECTANGLE,
                    startPoint: { 
                      x: args[0], 
                      y: viewport.height - args[1] - args[3] // y-Koordinate invertieren und Höhe abziehen
                    },
                    endPoint: { 
                      x: args[0] + args[2], 
                      y: viewport.height - args[1]
                    },
                    color: '#000000',
                    lineWidth: 1,
                    filled: false
                  });
                }
              }
            }
            
            // Versuch, kreisähnliche Objekte zu erkennen
            // Dies ist komplexer und erfordert möglicherweise eine tiefere Analyse des PDF-Inhalts...
            // Hier könnte zusätzliche Implementierung erfolgen
          } catch (operatorError) {
            console.warn(`Konnte Vektorgrafiken von Seite ${i} nicht extrahieren:`, operatorError);
          }
          
          pages.push({
            pageNumber: i,
            textContent: structuredText,
            width: viewport.width,
            height: viewport.height,
            canvas,
            formatting: pageFormatting,
            shapes: shapes, // Extrahierte Shapes hinzufügen
            comments: [] // Initialisiere leeres Kommentar-Array
          });
        } catch (pageError) {
          console.error(`Fehler beim Laden der Seite ${i}:`, pageError);
          // Füge eine Platzhalterseite hinzu, anstatt komplett zu fehlschlagen
          pages.push({
            pageNumber: i,
            textContent: `[Fehler beim Laden der Seite ${i}]`,
            width: 595, // Standard A4 Breite
            height: 842, // Standard A4 Höhe
            formatting: {...defaultFormatting},
            shapes: [],
            comments: [] // Initialisiere leeres Kommentar-Array
          });
        }
      }
      
      const documentInfo: PDFDocumentInfo = {
        fileName: file.name,
        totalPages: pdfDoc.numPages,
        pages,
        modified: false,
        currentFormatting: {...defaultFormatting}
      };
      
      // Aktualisieren des Stores
      currentPdfDocument.set(documentInfo);
      
      return documentInfo;
    } catch (error) {
      console.error('Fehler beim Laden des PDF-Dokuments:', error);
      throw new Error('Die PDF-Datei konnte nicht geladen werden. Bitte versuchen Sie es mit einer anderen Datei.');
    }
  }

  /**
   * Erstellt ein neues leeres PDF-Dokument
   */
  static async createNewPdf(fileName: string = 'Neues Dokument.pdf'): Promise<PDFDocumentInfo> {
    try {
      // Prüfen, ob wir im Browser sind
      if (typeof window === 'undefined') {
        throw new Error('Diese Funktion kann nur im Browser ausgeführt werden');
      }
      
      // Erstellen eines neuen PDF-Dokuments mit pdf-lib
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4 Größe
      
      try {
        // Fügen Sie eine Überschrift hinzu
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        page.setFont(helveticaFont);
        page.setFontSize(24);
        page.drawText('Neues Dokument', {
          x: 50,
          y: 800,
          color: rgb(0, 0, 0),
        });
        
        // Konvertieren zu ArrayBuffer
        const pdfBytes = await pdfDoc.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
        
        // Laden des gerade erstellten PDF-Dokuments mit verbesserter Fehlerbehandlung
        try {
          return await this.loadPdfFromFile(pdfFile);
        } catch (loadError) {
          console.error('Fehler beim Laden des neu erstellten PDFs:', loadError);
          
          // Erstelle ein einfaches Dokument mit Canvas anstatt zu versuchen, es zu laden
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 595;
          canvas.height = 842;
          
          if (ctx) {
            // Weißen Hintergrund zeichnen
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Überschrift zeichnen
            ctx.fillStyle = 'black';
            ctx.font = '24px Helvetica';
            ctx.fillText('Neues Dokument', 50, 50);
          }
          
          // Manuelles Erstellen des Dokument-Objekts
          const documentInfo: PDFDocumentInfo = {
            fileName: fileName,
            totalPages: 1,
            pages: [{
              pageNumber: 1,
              textContent: 'Neues Dokument',
              width: 595,
              height: 842,
              canvas: canvas,
              formatting: {...defaultFormatting},
              shapes: [],
              comments: [] // Initialisiere leeres Kommentar-Array
            }],
            modified: true,
            currentFormatting: {...defaultFormatting}
          };
          
          // Store aktualisieren
          currentPdfDocument.set(documentInfo);
          
          return documentInfo;
        }
      } catch (renderError) {
        console.error('Fehler beim Rendern des PDF-Dokuments:', renderError);
        throw new Error('Fehler beim Erstellen des PDF-Dokuments. Bitte versuchen Sie es erneut.');
      }
    } catch (error) {
      console.error('Fehler beim Erstellen des neuen PDF-Dokuments:', error);
      throw new Error('Fehler beim Erstellen des PDF-Dokuments. Bitte versuchen Sie es erneut.');
    }
  }

  /**
   * Speichert das bearbeitete PDF-Dokument
   */
  static async savePdf(documentInfo: PDFDocumentInfo): Promise<Blob> {
    try {
      // Erstellen eines neuen PDF-Dokuments mit den aktuellen Daten
      const pdfDoc = await PDFDocument.create();
      
      // Schriftarten laden
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
      const helveticaBoldOblique = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
      
      // Für jede Seite im Dokument
      for (const page of documentInfo.pages) {
        // Eine neue Seite mit den gleichen Abmessungen hinzufügen
        const newPage = pdfDoc.addPage([page.width, page.height]);
        
        // Formatierungsoptionen anwenden
        const fontSize = page.formatting.fontSize;
        
        // Schriftart basierend auf den Formatierungseigenschaften auswählen
        let font = helveticaFont;
        if (page.formatting.isBold && page.formatting.isItalic) {
          font = helveticaBoldOblique;
        } else if (page.formatting.isBold) {
          font = helveticaBoldFont;
        } else if (page.formatting.isItalic) {
          font = helveticaOblique;
        }
        
        newPage.setFont(font);
        newPage.setFontSize(fontSize);
        
        // Den Textinhalt der Seite hinzufügen
        if (page.textContent) {
          // Wir müssen den Text in Zeilen aufteilen, um ihn angemessen zu formatieren
          const lines = page.textContent.split('\n');
          const lineHeight = fontSize * 1.2;
          
          lines.forEach((line, index) => {
            // Text zeichnen
            newPage.drawText(line, {
              x: 50,
              y: page.height - 50 - (lineHeight * index), // Von oben nach unten
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0)
            });
            
            // Unterstreichung hinzufügen, wenn erforderlich
            if (page.formatting.isUnderline) {
              const textWidth = font.widthOfTextAtSize(line, fontSize);
              newPage.drawLine({
                start: { x: 50, y: page.height - 52 - (lineHeight * index) - fontSize/8 },
                end: { x: 50 + textWidth, y: page.height - 52 - (lineHeight * index) - fontSize/8 },
                thickness: fontSize / 20,
                color: rgb(0, 0, 0)
              });
            }
          });
        }

        // Grafische Elemente hinzufügen
        for (const shape of page.shapes) {
          switch (shape.type) {
            case ShapeType.RECTANGLE:
              // Bei Rotation die Canvas-Transformation anwenden
              if (shape.rotation) {
                const width = shape.endPoint ? shape.endPoint.x - shape.startPoint.x : 0;
                const height = shape.endPoint ? shape.endPoint.y - shape.startPoint.y : 0;
                const centerX = shape.startPoint.x + width / 2;
                const centerY = shape.startPoint.y + height / 2;
                
                // SVG-Transformation für Rotation anwenden
                const rotationTransform = `rotate(${shape.rotation}, ${centerX}, ${centerY})`;
                
                // Rechteck mit Transformation als SVG-Path zeichnen
                const rectPath = `M ${shape.startPoint.x},${shape.startPoint.y} l ${width},0 l 0,${height} l -${width},0 Z`;
                newPage.drawSvgPath(rectPath, {
                  transform: rotationTransform,
                  color: rgb(...hexToRgb(shape.color)),
                  borderWidth: shape.lineWidth,
                  borderColor: rgb(...hexToRgb(shape.color)),
                  opacity: shape.filled ? 1 : 0
                });
              } else {
                // Normales Rechteck ohne Rotation
                newPage.drawRectangle({
                  x: shape.startPoint.x,
                  y: shape.startPoint.y,
                  width: shape.endPoint ? shape.endPoint.x - shape.startPoint.x : 0,
                  height: shape.endPoint ? shape.endPoint.y - shape.startPoint.y : 0,
                  color: rgb(...hexToRgb(shape.color)),
                  borderWidth: shape.lineWidth,
                  borderColor: rgb(...hexToRgb(shape.color)),
                  opacity: shape.filled ? 1 : 0
                });
              }
              break;
            case ShapeType.CIRCLE: {
              const radiusX = shape.endPoint ? Math.abs(shape.endPoint.x - shape.startPoint.x) / 2 : 0;
              const radiusY = shape.endPoint ? Math.abs(shape.endPoint.y - shape.startPoint.y) / 2 : 0;
              const centerX = shape.startPoint.x + (shape.endPoint ? (shape.endPoint.x - shape.startPoint.x) / 2 : 0);
              const centerY = shape.startPoint.y + (shape.endPoint ? (shape.endPoint.y - shape.startPoint.y) / 2 : 0);
              
              if (shape.rotation) {
                // SVG-Path für Ellipse erstellen
                const ellipsePath = `M ${centerX},${centerY - radiusY} 
                  C ${centerX + radiusX * 0.55},${centerY - radiusY} ${centerX + radiusX},${centerY - radiusY * 0.55} ${centerX + radiusX},${centerY} 
                  C ${centerX + radiusX},${centerY + radiusY * 0.55} ${centerX + radiusX * 0.55},${centerY + radiusY} ${centerX},${centerY + radiusY} 
                  C ${centerX - radiusX * 0.55},${centerY + radiusY} ${centerX - radiusX},${centerY + radiusY * 0.55} ${centerX - radiusX},${centerY} 
                  C ${centerX - radiusX},${centerY - radiusY * 0.55} ${centerX - radiusX * 0.55},${centerY - radiusY} ${centerX},${centerY - radiusY} Z`;
                
                // SVG-Transformation für Rotation anwenden
                const rotationTransform = `rotate(${shape.rotation}, ${centerX}, ${centerY})`;
                
                // Ellipse mit Transformation als SVG-Path zeichnen
                newPage.drawSvgPath(ellipsePath, {
                  transform: rotationTransform,
                  color: rgb(...hexToRgb(shape.color)),
                  borderWidth: shape.lineWidth,
                  borderColor: rgb(...hexToRgb(shape.color)),
                  opacity: shape.filled ? 1 : 0
                });
              } else {
                // Normale Ellipse ohne Rotation
                newPage.drawEllipse({
                  x: centerX,
                  y: centerY,
                  xScale: radiusX,
                  yScale: radiusY,
                  color: rgb(...hexToRgb(shape.color)),
                  borderWidth: shape.lineWidth,
                  borderColor: rgb(...hexToRgb(shape.color)),
                  opacity: shape.filled ? 1 : 0
                });
              }
              break;
            }
            case ShapeType.LINE:
              if (shape.rotation && shape.endPoint) {
                // Mittelpunkt berechnen
                const centerX = (shape.startPoint.x + shape.endPoint.x) / 2;
                const centerY = (shape.startPoint.y + shape.endPoint.y) / 2;
                
                // SVG-Pfad für Linie erstellen
                const linePath = `M ${shape.startPoint.x},${shape.startPoint.y} L ${shape.endPoint.x},${shape.endPoint.y}`;
                
                // SVG-Transformation für Rotation anwenden
                const rotationTransform = `rotate(${shape.rotation}, ${centerX}, ${centerY})`;
                
                // Linie mit Rotation als SVG-Path zeichnen
                newPage.drawSvgPath(linePath, {
                  transform: rotationTransform,
                  stroke: rgb(...hexToRgb(shape.color)),
                  strokeWidth: shape.lineWidth,
                  opacity: 1
                });
              } else {
                // Normale Linie ohne Rotation
                newPage.drawLine({
                  start: shape.startPoint,
                  end: shape.endPoint || shape.startPoint,
                  thickness: shape.lineWidth,
                  color: rgb(...hexToRgb(shape.color)),
                  lineCap: LineCapStyle.Round
                });
              }
              break;
            case ShapeType.ARROW:
              if (shape.rotation && shape.endPoint) {
                // Mittelpunkt berechnen
                const centerX = (shape.startPoint.x + shape.endPoint.x) / 2;
                const centerY = (shape.startPoint.y + shape.endPoint.y) / 2;
                
                // Winkel und Pfeilgrößen
                const angle = Math.atan2(
                  shape.endPoint.y - shape.startPoint.y, 
                  shape.endPoint.x - shape.startPoint.x
                );
                const headSize = 15;
                
                // Punktkoordinaten für Pfeilspitze berechnen
                const p1 = shape.endPoint;
                const p2 = {
                  x: shape.endPoint.x - headSize * Math.cos(angle - Math.PI / 6),
                  y: shape.endPoint.y - headSize * Math.sin(angle - Math.PI / 6)
                };
                const p3 = {
                  x: shape.endPoint.x - headSize * Math.cos(angle + Math.PI / 6),
                  y: shape.endPoint.y - headSize * Math.sin(angle + Math.PI / 6)
                };
                
                // SVG-Pfad für Linie und Pfeilspitze
                const arrowPath = `M ${shape.startPoint.x},${shape.startPoint.y} 
                  L ${shape.endPoint.x},${shape.endPoint.y} 
                  M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y} Z`;
                
                // SVG-Transformation für Rotation anwenden
                const rotationTransform = `rotate(${shape.rotation}, ${centerX}, ${centerY})`;
                
                // Pfeil mit Rotation als SVG-Path zeichnen
                newPage.drawSvgPath(arrowPath, {
                  transform: rotationTransform,
                  stroke: rgb(...hexToRgb(shape.color)),
                  fill: rgb(...hexToRgb(shape.color)),
                  strokeWidth: shape.lineWidth,
                  opacity: 1
                });
              } else {
                // Pfeil ohne Rotation normal zeichnen
                // Linie zeichnen
                newPage.drawLine({
                  start: shape.startPoint,
                  end: shape.endPoint || shape.startPoint,
                  thickness: shape.lineWidth,
                  color: rgb(...hexToRgb(shape.color)),
                  lineCap: LineCapStyle.Round
                });
                
                // Pfeilspitze zeichnen
                if (shape.endPoint) {
                  const angle = Math.atan2(
                    shape.endPoint.y - shape.startPoint.y, 
                    shape.endPoint.x - shape.startPoint.x
                  );
                  const headSize = 15; // Größe der Pfeilspitze
                  
                  // Punkte für das Dreieck der Pfeilspitze berechnen
                  const p1 = shape.endPoint;
                  const p2 = {
                    x: shape.endPoint.x - headSize * Math.cos(angle - Math.PI / 6),
                    y: shape.endPoint.y - headSize * Math.sin(angle - Math.PI / 6)
                  };
                  const p3 = {
                    x: shape.endPoint.x - headSize * Math.cos(angle + Math.PI / 6),
                    y: shape.endPoint.y - headSize * Math.sin(angle + Math.PI / 6)
                  };
                  
                  // Dreieck für die Pfeilspitze zeichnen mit SVG Path
                  const trianglePath = `M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y} Z`;
                  newPage.drawSvgPath(trianglePath, {
                    color: rgb(...hexToRgb(shape.color)),
                    borderColor: rgb(...hexToRgb(shape.color)),
                    borderWidth: 0,
                    opacity: 1
                  });
                }
              }
              break;
            case ShapeType.TEXT:
              if (shape.text) {
                // Wähle die passende Schriftart basierend auf den Formatierungseigenschaften
                let textFont = helveticaFont;
                const formatting = shape.textFormatting || defaultFormatting;
                
                if (formatting.isBold && formatting.isItalic) {
                  textFont = helveticaBoldOblique;
                } else if (formatting.isBold) {
                  textFont = helveticaBoldFont;
                } else if (formatting.isItalic) {
                  textFont = helveticaOblique;
                }
                
                if (shape.rotation) {
                  // Text mit Rotation zeichnen
                  // Da PDFLib keine direkte Möglichkeit bietet, Text zu rotieren,
                  // verwenden wir eine Transformation auf die Seite
                  
                  // Aktuelle Seiten-Transformation speichern
                  const { width: textWidth } = textFont.widthOfTextAtSize(shape.text, formatting.fontSize);
                  
                  // Transformation anwenden (Übersetzung zur Position, Rotation, Rückübersetzung)
                  newPage.pushOperators(
                    // Aktuelle Matrix speichern
                    'q',
                    // Translation zur Textposition
                    `1 0 0 1 ${shape.startPoint.x} ${shape.startPoint.y} cm`,
                    // Rotation um die Textposition
                    `${Math.cos(shape.rotation * Math.PI / 180)} ${Math.sin(shape.rotation * Math.PI / 180)} ${-Math.sin(shape.rotation * Math.PI / 180)} ${Math.cos(shape.rotation * Math.PI / 180)} 0 0 cm`
                  );
                  
                  // Text an der Position (0,0) im transformierten Koordinatensystem zeichnen
                  newPage.drawText(shape.text, {
                    x: 0,
                    y: 0,
                    size: formatting.fontSize,
                    font: textFont,
                    color: rgb(...hexToRgb(shape.color))
                  });
                  
                  // Unterstreichung hinzufügen, falls erforderlich
                  if (formatting.isUnderline) {
                    newPage.drawLine({
                      start: { x: 0, y: -formatting.fontSize/8 },
                      end: { x: textWidth, y: -formatting.fontSize/8 },
                      thickness: formatting.fontSize / 20,
                      color: rgb(...hexToRgb(shape.color))
                    });
                  }
                  
                  // Transformation zurücksetzen
                  newPage.pushOperators('Q');
                } else {
                  // Normaler Text ohne Rotation
                  // Text zeichnen mit korrekter Formatierung
                  newPage.drawText(shape.text, {
                    x: shape.startPoint.x,
                    y: shape.startPoint.y,
                    size: formatting.fontSize,
                    font: textFont,
                    color: rgb(...hexToRgb(shape.color))
                  });
                  
                  // Unterstreichung hinzufügen, falls erforderlich
                  if (formatting.isUnderline) {
                    const textWidth = textFont.widthOfTextAtSize(shape.text, formatting.fontSize);
                    newPage.drawLine({
                      start: { x: shape.startPoint.x, y: shape.startPoint.y - formatting.fontSize/8 },
                      end: { x: shape.startPoint.x + textWidth, y: shape.startPoint.y - formatting.fontSize/8 },
                      thickness: formatting.fontSize / 20,
                      color: rgb(...hexToRgb(shape.color))
                    });
                  }
                }
              }
              break;
              
            case ShapeType.IMAGE:
              // Bild einfügen, wenn Bilddaten vorhanden sind
              if (shape.imageData && shape.endPoint) {
                try {
                  // Base64-Präfix entfernen und Bilddaten dekodieren
                  const base64Data = shape.imageData.replace(/^data:image\/\w+;base64,/, '');
                  
                  // Prüfen, ob es ein JPEG oder PNG ist und entsprechend einbetten
                  let embeddedImage;
                  if (shape.imageData.includes('data:image/jpeg')) {
                    // Browser-kompatible Konvertierung von Base64 zu Uint8Array
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                      bytes[i] = binaryString.charCodeAt(i);
                    }
                    embeddedImage = await pdfDoc.embedJpg(bytes);
                  } else {
                    // Standardmäßig als PNG behandeln
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                      bytes[i] = binaryString.charCodeAt(i);
                    }
                    embeddedImage = await pdfDoc.embedPng(bytes);
                  }
                  
                  // Bildgröße berechnen
                  const width = shape.endPoint.x - shape.startPoint.x;
                  const height = shape.endPoint.y - shape.startPoint.y;
                  
                  if (shape.rotation) {
                    // Mittelpunkt des Bildes für die Rotation berechnen
                    const centerX = shape.startPoint.x + width / 2;
                    const centerY = shape.startPoint.y + height / 2;
                    
                    // Transformation anwenden (Übersetzung zur Position, Rotation, Rückübersetzung)
                    newPage.pushOperators(
                      // Aktuelle Matrix speichern
                      'q',
                      // Translation zum Mittelpunkt des Bildes
                      `1 0 0 1 ${centerX} ${centerY} cm`,
                      // Rotation um den Mittelpunkt
                      `${Math.cos(shape.rotation * Math.PI / 180)} ${Math.sin(shape.rotation * Math.PI / 180)} ${-Math.sin(shape.rotation * Math.PI / 180)} ${Math.cos(shape.rotation * Math.PI / 180)} 0 0 cm`,
                      // Zurück zur Bildposition
                      `1 0 0 1 ${-centerX} ${-centerY} cm`
                    );
                    
                    // Bild an seiner normalen Position zeichnen
                    newPage.drawImage(embeddedImage, {
                      x: shape.startPoint.x,
                      y: page.height - shape.startPoint.y - height,
                      width,
                      height
                    });
                    
                    // Transformation zurücksetzen
                    newPage.pushOperators('Q');
                  } else {
                    // Normales Bild ohne Rotation zeichnen
                    newPage.drawImage(embeddedImage, {
                      x: shape.startPoint.x,
                      y: page.height - shape.startPoint.y - height,
                      width,
                      height
                    });
                  }
                } catch (error) {
                  console.error("Fehler beim Einbetten des Bildes ins PDF:", error);
                }
              }
              break;
          }
        }
      }
      
      // PDF-Datei speichern und als Blob zurückgeben
      const pdfBytes = await pdfDoc.save();
      return new Blob([pdfBytes], { type: 'application/pdf' });
    } catch (error) {
      console.error('Fehler beim Speichern des PDF-Dokuments:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert Textinhalt einer PDF-Seite
   */
  static updatePageText(pageNumber: number, newText: string): void {
    currentPdfDocument.update((doc) => {
      if (!doc) return null;
      
      // Finden der Seite und Aktualisieren des Textinhalts
      const updatedPages = doc.pages.map((page) => {
        if (page.pageNumber === pageNumber) {
          return { 
            ...page, 
            textContent: newText,
            // Aktuelle Formatierung auf die Seite übertragen
            formatting: {...doc.currentFormatting}
          };
        }
        return page;
      });
      
      // Zurückgeben des aktualisierten Dokuments
      return {
        ...doc,
        pages: updatedPages,
        modified: true
      };
    });
  }

  /**
   * Aktualisiert die aktuelle Formatierung im Dokument
   */
  static updateFormatting(formatting: Partial<TextFormatting>): void {
    currentPdfDocument.update((doc) => {
      if (!doc) return null;
      
      // Aktuelle Formatierung mit neuen Werten aktualisieren
      const updatedFormatting = {
        ...doc.currentFormatting,
        ...formatting
      };
      
      // Aktuelle Formatierung im Store aktualisieren
      currentFormatting.set(updatedFormatting);
      
      // Zurückgeben des aktualisierten Dokuments
      return {
        ...doc,
        currentFormatting: updatedFormatting,
        modified: true
      };
    });
  }
  
  /**
   * Setzt die aktuelle Formatierung basierend auf der aktuellen Seite
   */
  static setFormattingFromPage(pageNumber: number): void {
    currentPdfDocument.update((doc) => {
      if (!doc) return null;
      
      // Finden der aktuellen Seite
      const currentPage = doc.pages.find(page => page.pageNumber === pageNumber);
      if (!currentPage) return doc;
      
      // Formatierung der Seite als aktuelle Formatierung setzen
      currentFormatting.set({...currentPage.formatting});
      
      return {
        ...doc,
        currentFormatting: {...currentPage.formatting}
      };
    });
  }

  /**
   * Sucht nach Text im PDF-Dokument
   */
  static searchText(searchTerm: string): SearchResult[] {
    const results: SearchResult[] = [];
    
    // Aktuellen Dokumentstatus mit get-Funktion holen
    const doc = get(currentPdfDocument);
    
    if (!doc || !searchTerm.trim()) {
      return results;
    }
    
    // Groß-/Kleinschreibung ignorieren
    const term = searchTerm.toLowerCase();
    
    // Durchsuche jede Seite
    doc.pages.forEach(page => {
      const text = page.textContent.toLowerCase();
      let startIndex = 0;
      let matchIndex;
      
      // Finde alle Vorkommen des Suchbegriffs auf der Seite
      while ((matchIndex = text.indexOf(term, startIndex)) !== -1) {
        results.push({
          pageNumber: page.pageNumber,
          text: page.textContent.substring(matchIndex, matchIndex + term.length),
          matchIndex,
          matchLength: term.length
        });
        
        // Weitersuchen ab der nächsten Position
        startIndex = matchIndex + term.length;
      }
    });
    
    return results;
  }

  /**
   * Fügt einen neuen Kommentar zu einer Seite hinzu
   */
  static addComment(pageNumber: number, position: Point, text: string, author: string = 'Benutzer'): void {
    currentPdfDocument.update((doc) => {
      if (!doc) return null;
      
      const commentId = `comment-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const comment: Comment = {
        id: commentId,
        pageNumber,
        position,
        text,
        author,
        createdAt: new Date(),
        color: '#FFEB3B' // Standard Gelb für Kommentare
      };
      
      // Finden der Seite und Hinzufügen des Kommentars
      const updatedPages = doc.pages.map((page) => {
        if (page.pageNumber === pageNumber) {
          return { 
            ...page, 
            comments: [...page.comments, comment]
          };
        }
        return page;
      });
      
      return {
        ...doc,
        pages: updatedPages,
        modified: true
      };
    });
  }
  
  /**
   * Entfernt einen Kommentar von einer Seite
   */
  static removeComment(pageNumber: number, commentId: string): void {
    currentPdfDocument.update((doc) => {
      if (!doc) return null;
      
      // Finden der Seite und Entfernen des Kommentars
      const updatedPages = doc.pages.map((page) => {
        if (page.pageNumber === pageNumber) {
          return { 
            ...page, 
            comments: page.comments.filter(comment => comment.id !== commentId)
          };
        }
        return page;
      });
      
      return {
        ...doc,
        pages: updatedPages,
        modified: true
      };
    });
  }
  
  /**
   * Aktualisiert einen bestehenden Kommentar
   */
  static updateComment(pageNumber: number, commentId: string, newText: string): void {
    currentPdfDocument.update((doc) => {
      if (!doc) return null;
      
      // Finden der Seite und Aktualisieren des Kommentars
      const updatedPages = doc.pages.map((page) => {
        if (page.pageNumber === pageNumber) {
          const updatedComments = page.comments.map(comment => {
            if (comment.id === commentId) {
              return { ...comment, text: newText };
            }
            return comment;
          });
          
          return { 
            ...page, 
            comments: updatedComments
          };
        }
        return page;
      });
      
      return {
        ...doc,
        pages: updatedPages,
        modified: true
      };
    });
  }
  
  /**
   * Gibt alle Kommentare für eine bestimmte Seite zurück
   */
  static getComments(pageNumber: number): Comment[] {
    const doc = get(currentPdfDocument);
    if (!doc) return [];
    
    const page = doc.pages.find(p => p.pageNumber === pageNumber);
    return page ? page.comments : [];
  }

  /**
   * Fügt eine neue leere Seite zum PDF-Dokument hinzu
   * @param position Optional: Position, an der die Seite eingefügt werden soll (standardmäßig am Ende)
   */
  static addNewPage(position?: number): void {
    currentPdfDocument.update((doc) => {
      if (!doc) return null;
      
      // Parameter validieren
      const insertPosition = position !== undefined && position >= 0 && position <= doc.pages.length
        ? position
        : doc.pages.length;
      
      // Standardgröße (A4)
      const width = 595;
      const height = 842;
      
      // Canvas erstellen (wenn wir im Browser sind)
      let canvas: HTMLCanvasElement | undefined;
      
      if (typeof window !== 'undefined') {
        canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        
        // Weißen Hintergrund zeichnen
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);
        }
      }
      
      // Neue Seitennummern berechnen
      const updatedPages = [...doc.pages];
      const newPage: PDFPage = {
        pageNumber: insertPosition + 1,
        textContent: '',
        width,
        height,
        canvas,
        formatting: { ...defaultFormatting },
        shapes: [],
        comments: []
      };
      
      // Seite an der gewünschten Position einfügen
      updatedPages.splice(insertPosition, 0, newPage);
      
      // Seitennummern aktualisieren
      const reindexedPages = updatedPages.map((page, index) => ({
        ...page,
        pageNumber: index + 1
      }));
      
      // Aktualisiertes Dokument zurückgeben
      return {
        ...doc,
        totalPages: reindexedPages.length,
        pages: reindexedPages,
        modified: true
      };
    });
  }
  
  /**
   * Löscht eine Seite aus dem PDF-Dokument
   * @param pageNumber Seitennummer der zu löschenden Seite
   */
  static deletePage(pageNumber: number): void {
    currentPdfDocument.update((doc) => {
      if (!doc) return null;
      
      // Prüfen, ob die Seite existiert
      const pageIndex = doc.pages.findIndex(page => page.pageNumber === pageNumber);
      if (pageIndex === -1) return doc;
      
      // Sicherstellen, dass mindestens eine Seite im Dokument verbleibt
      if (doc.pages.length <= 1) {
        alert('Das Dokument muss mindestens eine Seite enthalten.');
        return doc;
      }
      
      // Seite entfernen
      const updatedPages = [...doc.pages];
      updatedPages.splice(pageIndex, 1);
      
      // Seitennummern aktualisieren
      const reindexedPages = updatedPages.map((page, index) => ({
        ...page,
        pageNumber: index + 1
      }));
      
      // Aktualisiertes Dokument zurückgeben
      return {
        ...doc,
        totalPages: reindexedPages.length,
        pages: reindexedPages,
        modified: true
      };
    });
  }
  
  /**
   * Verschiebt eine Seite an eine neue Position im Dokument
   * @param currentPageNumber Aktuelle Seitennummer
   * @param newPosition Neue Position für die Seite (0-basierter Index)
   */
  static movePage(currentPageNumber: number, newPosition: number): void {
    currentPdfDocument.update((doc) => {
      if (!doc) return null;
      
      // Prüfen, ob die Seite existiert
      const pageIndex = doc.pages.findIndex(page => page.pageNumber === currentPageNumber);
      if (pageIndex === -1) return doc;
      
      // Sicherstellen, dass die neue Position gültig ist
      const validNewPosition = Math.max(0, Math.min(doc.pages.length - 1, newPosition));
      
      // Wenn die Seite bereits an der gewünschten Position ist
      if (pageIndex === validNewPosition) return doc;
      
      // Seite verschieben
      const updatedPages = [...doc.pages];
      const [movedPage] = updatedPages.splice(pageIndex, 1);
      updatedPages.splice(validNewPosition, 0, movedPage);
      
      // Seitennummern aktualisieren
      const reindexedPages = updatedPages.map((page, index) => ({
        ...page,
        pageNumber: index + 1
      }));
      
      // Aktualisiertes Dokument zurückgeben
      return {
        ...doc,
        pages: reindexedPages,
        modified: true
      };
    });
  }
}

/**
 * Hilfsfunktion zum Konvertieren von Hex-Farben in RGB
 */
function hexToRgb(hex: string): [number, number, number] {
  const bigint = parseInt(hex.replace('#', ''), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r / 255, g / 255, b / 255];
}