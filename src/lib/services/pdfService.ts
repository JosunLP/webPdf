import { PDFDocument, rgb, StandardFonts, LineCapStyle } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
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

export enum ShapeType {
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  LINE = 'line',
  ARROW = 'arrow',
  TEXT = 'text'
}

// Interface für grafische Elemente
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
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  LINE = 'line',
  ARROW = 'arrow',
  TEXT = 'text'
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
    pdfjs = await import('pdfjs-dist');
    
    // Importieren des Workers direkt aus dem CDN
    const PDFJS_WORKER_SRC = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
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
      const pdfDoc = await pdfjs.getDocument({ data: fileArrayBuffer }).promise;
      
      const pages: PDFPage[] = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();
        
        // Erstellen eines Canvas für die Seite
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Rendern der Seite auf dem Canvas
        if (context) {
          await page.render({ canvasContext: context, viewport }).promise;
        }
        
        // Text aus dem Dokument extrahieren
        // Define a specific interface for PDF.js text items
        interface PDFTextItem {
          str?: string;
          [key: string]: unknown;  // Allow other properties
        }
        
        const textItems = textContent.items
          .filter((item: PDFTextItem) => 'str' in item)
          .map((item: PDFTextItem) => item.str)
          .join(' ');
        
        pages.push({
          pageNumber: i,
          textContent: textItems,
          width: viewport.width,
          height: viewport.height,
          canvas,
          formatting: {...defaultFormatting},
          shapes: [] // Initialisiere leeres Array für grafische Elemente
        });
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
      throw error;
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
      
      // Laden des gerade erstellten PDF-Dokuments
      return await this.loadPdfFromFile(pdfFile);
    } catch (error) {
      console.error('Fehler beim Erstellen des neuen PDF-Dokuments:', error);
      throw error;
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
              break;
            case ShapeType.CIRCLE:
              newPage.drawEllipse({
                x: shape.startPoint.x,
                y: shape.startPoint.y,
                xScale: shape.endPoint ? (shape.endPoint.x - shape.startPoint.x) / 2 : 0,
                yScale: shape.endPoint ? (shape.endPoint.y - shape.startPoint.y) / 2 : 0,
                color: rgb(...hexToRgb(shape.color)),
                borderWidth: shape.lineWidth,
                borderColor: rgb(...hexToRgb(shape.color)),
                opacity: shape.filled ? 1 : 0
              });
              break;
            case ShapeType.LINE:
              newPage.drawLine({
                start: shape.startPoint,
                end: shape.endPoint || shape.startPoint,
                thickness: shape.lineWidth,
                color: rgb(...hexToRgb(shape.color)),
                lineCap: LineCapStyle.Round
              });
              break;
            case ShapeType.ARROW:
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