import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writable, type Writable } from 'svelte/store';

// PDF.js nur im Browser importieren
// Verhindern von serverseitigem Import, der den DOMMatrix-Fehler verursacht
let pdfjs: any = null;

// Interface für PDF-Seiten
export interface PDFPage {
  pageNumber: number;
  textContent: string;
  width: number;
  height: number;
  canvas?: HTMLCanvasElement;
}

// Interface für PDF-Dokumentinformationen
export interface PDFDocumentInfo {
  fileName: string;
  totalPages: number;
  pages: PDFPage[];
  modified: boolean;
}

// Store für das aktuelle PDF-Dokument
export const currentPdfDocument: Writable<PDFDocumentInfo | null> = writable(null);

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
        const textItems = textContent.items
          .filter((item: any) => 'str' in item)
          .map((item: any) => item.str)
          .join(' ');
        
        pages.push({
          pageNumber: i,
          textContent: textItems,
          width: viewport.width,
          height: viewport.height,
          canvas
        });
      }
      
      const documentInfo: PDFDocumentInfo = {
        fileName: file.name,
        totalPages: pdfDoc.numPages,
        pages,
        modified: false
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
      
      // TODO: Implementieren Sie hier die Logik, um die aktualisierten Daten zu speichern
      // Dies würde eine Konvertierung von Canvas/Textinhalten zurück zu einem PDF-Dokument beinhalten
      // Für eine vollständige Implementierung wäre eine umfangreichere Logik erforderlich
      
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
          return { ...page, textContent: newText };
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
}