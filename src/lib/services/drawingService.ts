import { 
  type Point, 
  type ShapeElement, 
  ShapeType, 
  currentPdfDocument, 
  DrawingTool, 
  currentDrawingTool,
  currentDrawingProperties,
  currentFormatting,
} from './pdfService';


const { get } = await import('svelte/store');


/**
 * Service für Zeichenoperationen in PDF-Dateien
 */
export class DrawingService {
  /**
   * Fügt ein neues grafisches Element zu einer PDF-Seite hinzu
   * @param pageNumber Die Seitennummer
   * @param shape Das zu ergänzende grafische Element
   */
  static addShape(pageNumber: number, shape: ShapeElement): void {
    currentPdfDocument.update(doc => {
      if (!doc) return null;
      
      // Die betroffene Seite finden und das Element hinzufügen
      const updatedPages = doc.pages.map(page => {
        if (page.pageNumber === pageNumber) {
          return {
            ...page,
            shapes: [...page.shapes, shape]
          };
        }
        return page;
      });
      
      // Aktualisiertes Dokument zurückgeben
      return {
        ...doc,
        pages: updatedPages,
        modified: true
      };
    });
  }
  
  /**
   * Entfernt ein grafisches Element von einer PDF-Seite
   * @param pageNumber Die Seitennummer
   * @param shapeId Die ID des zu entfernenden Elements
   */
  static removeShape(pageNumber: number, shapeId: string): void {
    currentPdfDocument.update(doc => {
      if (!doc) return null;
      
      // Die betroffene Seite finden und das Element entfernen
      const updatedPages = doc.pages.map(page => {
        if (page.pageNumber === pageNumber) {
          return {
            ...page,
            shapes: page.shapes.filter(shape => shape.id !== shapeId)
          };
        }
        return page;
      });
      
      // Aktualisiertes Dokument zurückgeben
      return {
        ...doc,
        pages: updatedPages,
        modified: true
      };
    });
  }
  
  /**
   * Aktualisiert ein vorhandenes grafisches Element
   * @param pageNumber Die Seitennummer
   * @param updatedShape Das aktualisierte Element
   */
  static updateShape(pageNumber: number, updatedShape: ShapeElement): void {
    currentPdfDocument.update(doc => {
      if (!doc) return null;
      
      // Die betroffene Seite finden und das Element aktualisieren
      const updatedPages = doc.pages.map(page => {
        if (page.pageNumber === pageNumber) {
          return {
            ...page,
            shapes: page.shapes.map(shape => 
              shape.id === updatedShape.id ? updatedShape : shape
            )
          };
        }
        return page;
      });
      
      // Aktualisiertes Dokument zurückgeben
      return {
        ...doc,
        pages: updatedPages,
        modified: true
      };
    });
  }

  /**
   * Verschiebt ein grafisches Element zu einer neuen Position
   * @param pageNumber Die Seitennummer
   * @param shapeId Die ID des zu verschiebenden Elements
   * @param deltaX Änderung der X-Koordinate
   * @param deltaY Änderung der Y-Koordinate
   */
  static moveShape(pageNumber: number, shapeId: string, deltaX: number, deltaY: number): void {
    const doc = get(currentPdfDocument);
    if (!doc) return;
    
    const page = doc.pages.find(p => p.pageNumber === pageNumber);
    if (!page) return;
    
    const shape = page.shapes.find(s => s.id === shapeId);
    if (!shape) return;
    
    // Erstellung einer Kopie des Shapes mit aktualisierten Positionen
    const movedShape = { ...shape };
    
    // Startpunkt verschieben
    movedShape.startPoint = {
      x: shape.startPoint.x + deltaX,
      y: shape.startPoint.y + deltaY
    };
    
    // Endpunkt verschieben, falls vorhanden
    if (shape.endPoint) {
      movedShape.endPoint = {
        x: shape.endPoint.x + deltaX,
        y: shape.endPoint.y + deltaY
      };
    }
    
    // Shape aktualisieren
    this.updateShape(pageNumber, movedShape);
  }

  /**
   * Ändert die Größe eines grafischen Elements
   * @param pageNumber Die Seitennummer
   * @param shapeId Die ID des Elements, dessen Größe geändert werden soll
   * @param newEndPoint Der neue Endpunkt (bestimmt die neue Größe)
   * @param maintainAspectRatio Soll das Seitenverhältnis beibehalten werden? (optional)
   */
  static resizeShape(pageNumber: number, shapeId: string, newEndPoint: Point, maintainAspectRatio = false): void {
    const doc = get(currentPdfDocument);
    if (!doc) return;
    
    const page = doc.pages.find(p => p.pageNumber === pageNumber);
    if (!page) return;
    
    const shape = page.shapes.find(s => s.id === shapeId);
    if (!shape || !shape.endPoint) return;
    
    // Erstellung einer Kopie des Shapes mit aktualisierter Größe
    const resizedShape = { ...shape };
    
    if (maintainAspectRatio && shape.type !== ShapeType.LINE && shape.type !== ShapeType.ARROW) {
      // Berechnung des ursprünglichen Seitenverhältnisses
      const originalWidth = Math.abs(shape.endPoint.x - shape.startPoint.x);
      const originalHeight = Math.abs(shape.endPoint.y - shape.startPoint.y);
      const aspectRatio = originalWidth / originalHeight;
      
      // Berechnung der neuen Breite und Höhe
      let newWidth = Math.abs(newEndPoint.x - shape.startPoint.x);
      let newHeight = Math.abs(newEndPoint.y - shape.startPoint.y);
      
      // Anpassung der Werte, um das Seitenverhältnis beizubehalten
      if (newWidth / newHeight > aspectRatio) {
        newWidth = newHeight * aspectRatio;
      } else {
        newHeight = newWidth / aspectRatio;
      }
      
      // Berechnung des neuen Endpunkts unter Berücksichtigung der Richtung
      const signX = newEndPoint.x >= shape.startPoint.x ? 1 : -1;
      const signY = newEndPoint.y >= shape.startPoint.y ? 1 : -1;
      
      resizedShape.endPoint = {
        x: shape.startPoint.x + (newWidth * signX),
        y: shape.startPoint.y + (newHeight * signY)
      };
    } else {
      // Ohne Beibehaltung des Seitenverhältnisses - direkte Verwendung des neuen Endpunkts
      resizedShape.endPoint = newEndPoint;
    }
    
    // Shape aktualisieren
    this.updateShape(pageNumber, resizedShape);
  }

  /**
   * Prüft, ob ein Punkt auf einem Größenänderungs-Handle liegt
   * @param point Der zu prüfende Punkt
   * @param shape Das zu prüfende Shape
   * @param tolerance Toleranzbereich in Pixeln
   * @returns Position des Handles oder null
   */
  static getResizeHandle(point: Point, shape: ShapeElement, tolerance: number = 10): 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | null {
    if (!shape.endPoint) return null;
    
    // Berechne die Positionen der vier Eckpunkte
    const minX = Math.min(shape.startPoint.x, shape.endPoint.x);
    const maxX = Math.max(shape.startPoint.x, shape.endPoint.x);
    const minY = Math.min(shape.startPoint.y, shape.endPoint.y);
    const maxY = Math.max(shape.startPoint.y, shape.endPoint.y);
    
    // Prüfe jedes Handle
    // oben links
    if (Math.abs(point.x - minX) <= tolerance && Math.abs(point.y - minY) <= tolerance) {
      return 'topLeft';
    }
    
    // oben rechts
    if (Math.abs(point.x - maxX) <= tolerance && Math.abs(point.y - minY) <= tolerance) {
      return 'topRight';
    }
    
    // unten links
    if (Math.abs(point.x - minX) <= tolerance && Math.abs(point.y - maxY) <= tolerance) {
      return 'bottomLeft';
    }
    
    // unten rechts
    if (Math.abs(point.x - maxX) <= tolerance && Math.abs(point.y - maxY) <= tolerance) {
      return 'bottomRight';
    }
    
    return null;
  }

  /**
   * Findet ein Shape an einer bestimmten Position auf einer PDF-Seite
   * @param pageNumber Die Seitennummer
   * @param point Die zu prüfende Position
   * @param tolerance Toleranzbereich in Pixeln
   * @returns Das gefundene Shape oder null
   */
  static findShapeAtPoint(pageNumber: number, point: Point, tolerance: number = 5): ShapeElement | null {
    const doc = get(currentPdfDocument);
    if (!doc) return null;
    
    const page = doc.pages.find(p => p.pageNumber === pageNumber);
    if (!page || !page.shapes || page.shapes.length === 0) return null;
    
    // Von oben nach unten durch die Shapes gehen, um zuletzt gezeichnete zuerst zu erfassen
    for (let i = page.shapes.length - 1; i >= 0; i--) {
      const shape = page.shapes[i];
      
      if (this.isPointInShape(point, shape, tolerance)) {
        return shape;
      }
    }
    
    return null;
  }
  
  /**
   * Prüft, ob ein Punkt innerhalb eines Shapes liegt
   * @param point Der zu prüfende Punkt
   * @param shape Das zu prüfende Shape
   * @param tolerance Toleranzbereich in Pixeln
   * @returns true, wenn der Punkt im Shape liegt
   */
  private static isPointInShape(point: Point, shape: ShapeElement, tolerance: number = 5): boolean {
    switch (shape.type) {
      case ShapeType.RECTANGLE:
        return this.isPointInRectangle(point, shape, tolerance);
      case ShapeType.CIRCLE:
        return this.isPointInCircle(point, shape, tolerance);
      case ShapeType.LINE:
        return this.isPointOnLine(point, shape, tolerance);
      case ShapeType.ARROW:
        return this.isPointOnLine(point, shape, tolerance);
      case ShapeType.TEXT:
        return this.isPointNearTextPosition(point, shape, tolerance);
      case ShapeType.IMAGE:
        return this.isPointInRectangle(point, shape, tolerance);
      default:
        return false;
    }
  }
  
  /**
   * Prüft, ob ein Punkt innerhalb eines Rechtecks liegt
   */
  private static isPointInRectangle(point: Point, shape: ShapeElement, tolerance: number): boolean {
    if (!shape.endPoint) return false;
    
    // Rechteckgrenzen bestimmen (min/max, um negative Breite/Höhe zu berücksichtigen)
    const minX = Math.min(shape.startPoint.x, shape.endPoint.x) - tolerance;
    const maxX = Math.max(shape.startPoint.x, shape.endPoint.x) + tolerance;
    const minY = Math.min(shape.startPoint.y, shape.endPoint.y) - tolerance;
    const maxY = Math.max(shape.startPoint.y, shape.endPoint.y) + tolerance;
    
    // Prüfen, ob der Punkt innerhalb des Rechtecks liegt
    return point.x >= minX && point.x <= maxX && 
           point.y >= minY && point.y <= maxY;
  }
  
  /**
   * Prüft, ob ein Punkt innerhalb eines Kreises liegt
   */
  private static isPointInCircle(point: Point, shape: ShapeElement, tolerance: number): boolean {
    if (!shape.endPoint) return false;
    
    // Kreismittelpunkt und Radius berechnen
    const centerX = (shape.startPoint.x + shape.endPoint.x) / 2;
    const centerY = (shape.startPoint.y + shape.endPoint.y) / 2;
    const radiusX = Math.abs(shape.endPoint.x - shape.startPoint.x) / 2;
    const radiusY = Math.abs(shape.endPoint.y - shape.startPoint.y) / 2;
    
    // Abstand zum Mittelpunkt berechnen (unter Berücksichtigung der Ellipsenform)
    const dx = (point.x - centerX) / (radiusX + tolerance);
    const dy = (point.y - centerY) / (radiusY + tolerance);
    
    // Prüfen, ob der Punkt innerhalb der Ellipse liegt
    return (dx * dx + dy * dy) <= 1;
  }
  
  /**
   * Prüft, ob ein Punkt nahe einer Linie liegt
   */
  private static isPointOnLine(point: Point, shape: ShapeElement, tolerance: number): boolean {
    if (!shape.endPoint) return false;
    
    // Abstand eines Punktes zu einer Linie berechnen
    const distance = this.distanceFromPointToLine(
      point,
      shape.startPoint,
      shape.endPoint
    );
    
    // Als "auf der Linie" betrachten, wenn der Abstand kleiner als die Toleranz ist
    return distance <= tolerance + (shape.lineWidth / 2);
  }
  
  /**
   * Prüft, ob ein Punkt nahe einer Textposition liegt
   */
  private static isPointNearTextPosition(point: Point, shape: ShapeElement, tolerance: number): boolean {
    // Textgröße abschätzen (Durchschnitt für ein Textfeld)
    const fontSize = shape.textFormatting?.fontSize || 12;
    const textLength = (shape.text?.length || 0) * fontSize * 0.6; // Grobe Abschätzung
    
    // Rechteckbereich für den Text definieren
    const textArea = {
      minX: shape.startPoint.x - tolerance,
      maxX: shape.startPoint.x + textLength + tolerance,
      minY: shape.startPoint.y - fontSize - tolerance,
      maxY: shape.startPoint.y + tolerance
    };
    
    // Prüfen, ob der Punkt innerhalb des Textbereichs liegt
    return point.x >= textArea.minX && point.x <= textArea.maxX &&
           point.y >= textArea.minY && point.y <= textArea.maxY;
  }
  
  /**
   * Berechnet den Abstand eines Punktes zu einer Linie
   */
  private static distanceFromPointToLine(point: Point, lineStart: Point, lineEnd: Point): number {
    // Linienvektor
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    
    // Quadrat der Länge der Linie
    const lenSq = dx * dx + dy * dy;
    
    // Wenn die Linie ein Punkt ist, berechne den euklidischen Abstand
    if (lenSq === 0) {
      return Math.sqrt(
        (point.x - lineStart.x) * (point.x - lineStart.x) +
        (point.y - lineStart.y) * (point.y - lineStart.y)
      );
    }
    
    // Berechne den Projektionsfaktor
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
    
    if (t < 0) {
      // Jenseits des lineStart-Punktes
      return Math.sqrt(
        (point.x - lineStart.x) * (point.x - lineStart.x) +
        (point.y - lineStart.y) * (point.y - lineStart.y)
      );
    }
    
    if (t > 1) {
      // Jenseits des lineEnd-Punktes
      return Math.sqrt(
        (point.x - lineEnd.x) * (point.x - lineEnd.x) +
        (point.y - lineEnd.y) * (point.y - lineEnd.y)
      );
    }
    
    // Projektion fällt auf die Linie
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    
    return Math.sqrt(
      (point.x - projX) * (point.x - projX) +
      (point.y - projY) * (point.y - projY)
    );
  }
  
  /**
   * Erstellt ein neues Shape-Element basierend auf dem aktuellen Zeichenwerkzeug
   * @param startPoint Startpunkt des Elements
   * @param endPoint Endpunkt des Elements (optional)
   * @param text Textinhalt (nur für Text-Elemente)
   * @param imageData Base64-codierte Bilddaten (nur für Bild-Elemente)
   * @param imageWidth Ursprüngliche Bildbreite (nur für Bild-Elemente)
   * @param imageHeight Ursprüngliche Bildhöhe (nur für Bild-Elemente)
   */
  static createShape(
    startPoint: Point, 
    endPoint?: Point, 
    text?: string,
    imageData?: string,
    imageWidth?: number,
    imageHeight?: number
  ): ShapeElement {
    // Import 'get' for direct store access

    // Aktuelle Zeicheneigenschaften aus dem Store lesen using get
    const tool = get(currentDrawingTool);
    const properties = get(currentDrawingProperties);
    const formatting = get(currentFormatting);
    
    // Eindeutige ID generieren (verwendet substring statt veraltetem substr)
    const id = `shape-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    // Shape-Typ aus dem aktuellen Werkzeug ableiten
    let shapeType: ShapeType;
    switch (tool) {
      case DrawingTool.RECTANGLE: shapeType = ShapeType.RECTANGLE; break;
      case DrawingTool.CIRCLE: shapeType = ShapeType.CIRCLE; break;
      case DrawingTool.LINE: shapeType = ShapeType.LINE; break;
      case DrawingTool.ARROW: shapeType = ShapeType.ARROW; break;
      case DrawingTool.TEXT: shapeType = ShapeType.TEXT; break;
      case DrawingTool.IMAGE: shapeType = ShapeType.IMAGE; break;
      default: shapeType = ShapeType.RECTANGLE;
    }
    
    // Shape-Element erstellen
    return {
      id,
      type: shapeType,
      startPoint,
      endPoint,
      color: properties.color,
      lineWidth: properties.lineWidth,
      filled: properties.filled,
      text: text,
      // Textformatierung für Text-Elemente hinzufügen
      textFormatting: shapeType === ShapeType.TEXT ? {...formatting} : undefined,
      // Bilddaten für Bild-Elemente
      imageData: shapeType === ShapeType.IMAGE ? imageData : undefined,
      imageWidth: shapeType === ShapeType.IMAGE ? imageWidth : undefined,
      imageHeight: shapeType === ShapeType.IMAGE ? imageHeight : undefined
    };
  }
  
  /**
   * Fügt ein Bild zu einer PDF-Seite hinzu
   * @param pageNumber Die Seitennummer
   * @param position Die Position des Bildes
   * @param imageFile Die Bilddatei
   */
  static async addImage(pageNumber: number, position: Point, imageFile: File): Promise<void> {
    try {
      // Bild in Base64 konvertieren
      const base64Data = await this.fileToBase64(imageFile);
      
      // Originalgröße des Bildes ermitteln
      const dimensions = await this.getImageDimensions(base64Data);
      
      // Seitengröße ermitteln
      const doc = get(currentPdfDocument);
      if (!doc) return;
      
      const page = doc.pages.find(p => p.pageNumber === pageNumber);
      if (!page) return;
      
      // Maximale Größe für das Bild berechnen (80% der Seite)
      const maxWidth = page.width * 0.8;
      const maxHeight = page.height * 0.8;
      
      // Skalierungsfaktor berechnen
      let scale = 1;
      if (dimensions.width > maxWidth || dimensions.height > maxHeight) {
        const scaleWidth = maxWidth / dimensions.width;
        const scaleHeight = maxHeight / dimensions.height;
        scale = Math.min(scaleWidth, scaleHeight);
      }
      
      // Bildgröße berechnen
      const width = dimensions.width * scale;
      const height = dimensions.height * scale;
      
      // Endposition berechnen (zentriert um die Klickposition)
      const endPoint = {
        x: position.x + width,
        y: position.y + height
      };
      
      // Shape erstellen und hinzufügen
      const imageShape = this.createShape(
        position,
        endPoint,
        undefined,
        base64Data,
        dimensions.width,
        dimensions.height
      );
      
      this.addShape(pageNumber, imageShape);
    } catch (error) {
      console.error("Fehler beim Hinzufügen des Bildes:", error);
      alert("Das Bild konnte nicht hinzugefügt werden.");
    }
  }
  
  /**
   * Konvertiert eine Datei in Base64
   * @param file Die zu konvertierende Datei
   * @returns Base64-codierte Daten
   */
  private static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }
  
  /**
   * Ermittelt die Dimensionen eines Bildes
   * @param base64Data Base64-codierte Bilddaten
   * @returns Bildbreite und -höhe
   */
  private static getImageDimensions(base64Data: string): Promise<{width: number, height: number}> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height
        });
      };
      img.onerror = () => {
        reject(new Error("Bild konnte nicht geladen werden"));
      };
      img.src = base64Data;
    });
  }
  
  /**
   * Fügt ein Bild zum aktuellen Dokument hinzu
   * Der Nutzer wird aufgefordert, auf die Stelle zu klicken, an der das Bild eingefügt werden soll
   * @param imageFile Die Bilddatei
   */
  static addImageToDocument(imageFile: File): void {
    // Bildwerkzeug aktivieren
    DrawingService.setDrawingTool(DrawingTool.IMAGE);
    
    // Globalen Event-Listener für Klickereignis auf PDF-Seite hinzufügen
    const handleClick = (event: MouseEvent) => {
      // Ziel-Element identifizieren
      const target = event.target as HTMLElement;
      const pageElement = target.closest('.pdf-page');
      
      if (pageElement) {
        // Seitennummer extrahieren
        const pageNumber = parseInt(pageElement.getAttribute('data-page-number') || '1', 10);
        
        // Klickposition relativ zur Seite ermitteln
        const rect = pageElement.getBoundingClientRect();
        const position = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        };
        
        // Bild zur Seite hinzufügen
        DrawingService.addImage(pageNumber, position, imageFile);
        
        // Event-Listener entfernen und Werkzeug zurücksetzen
        document.removeEventListener('click', handleClick);
        DrawingService.setDrawingTool(DrawingTool.NONE);
      }
    };
    
    // Event-Listener hinzufügen
    document.addEventListener('click', handleClick, { once: true });
    
    // Hinweis anzeigen
    alert('Bitte klicken Sie auf die Stelle, an der das Bild eingefügt werden soll.');
  }
  
  /**
   * Zeigt eine Vorschau eines Bildes an, bevor es eingefügt wird
   * @param imageFile Die Bilddatei für die Vorschau
   * @returns Eine Funktion, die die Vorschau entfernt
   */
  static showImagePreview(imageFile: File): () => void {
    // Erstelle ein Vorschau-Container-Element
    const previewContainer = document.createElement('div');
    previewContainer.style.position = 'fixed';
    previewContainer.style.top = '0';
    previewContainer.style.left = '0';
    previewContainer.style.pointerEvents = 'none';
    previewContainer.style.zIndex = '9999';
    previewContainer.style.border = '2px dashed #3b82f6';
    previewContainer.style.borderRadius = '4px';
    previewContainer.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.5)';
    previewContainer.style.padding = '4px';
    previewContainer.style.background = 'rgba(255, 255, 255, 0.7)';
    
    // Bildelement erstellen
    const imagePreview = document.createElement('img');
    imagePreview.style.maxWidth = '300px';
    imagePreview.style.maxHeight = '300px';
    imagePreview.style.objectFit = 'contain';
    
    // Schriftart für Info-Text
    const infoStyle = 'color: #3b82f6; text-align: center; margin-top: 4px; font-size: 12px; font-family: Arial, sans-serif;';
    
    // Info-Text zur Anleitung
    const infoText = document.createElement('div');
    infoText.innerHTML = 'Klicken Sie, um das Bild einzufügen';
    infoText.style.cssText = infoStyle;
    
    // Dateigröße ermitteln und anzeigen
    const fileSizeInfo = document.createElement('div');
    const fileSize = (imageFile.size / 1024).toFixed(1);
    fileSizeInfo.innerHTML = `Größe: ${fileSize} KB | ${imageFile.type.split('/')[1].toUpperCase()}`;
    fileSizeInfo.style.cssText = infoStyle;
    
    // Base64-Vorschau erstellen
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        imagePreview.src = e.target.result as string;

        // Bild in Container einfügen
        previewContainer.appendChild(imagePreview);
        previewContainer.appendChild(infoText);
        previewContainer.appendChild(fileSizeInfo);
        document.body.appendChild(previewContainer);
      }
    };
    reader.readAsDataURL(imageFile);

    // Mausbewegungen verfolgen, um Vorschau zu bewegen
    const moveHandler = (e: MouseEvent) => {
      if (previewContainer) {
        previewContainer.style.transform = `translate(${e.clientX + 20}px, ${e.clientY + 20}px)`;
      }
    };

    // Event-Listener hinzufügen
    document.addEventListener('mousemove', moveHandler);
    
    // Funktion zurückgeben, die die Vorschau entfernt und Listeners aufräumt
    return () => {
      document.removeEventListener('mousemove', moveHandler);
      if (previewContainer && previewContainer.parentNode) {
        previewContainer.parentNode.removeChild(previewContainer);
      }
    };
  }
  
  /**
   * Zeigt eine Vorschau eines Textes an, während der Benutzer die Position wählt
   * @param text Der anzuzeigende Text
   * @returns Eine Funktion zum Entfernen der Vorschau
   */
  static showTextPreview(text: string): () => void {
    // Aktuelle Formatierungseinstellungen abrufen
    const formatting = get(currentFormatting);

    // Vorschau-Element erstellen
    const previewElement = document.createElement('div');
    previewElement.style.position = 'fixed';
    previewElement.style.pointerEvents = 'none';
    previewElement.style.zIndex = '9999';
    previewElement.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    previewElement.style.padding = '4px 8px';
    previewElement.style.border = '2px dashed #3b82f6';
    previewElement.style.borderRadius = '4px';
    previewElement.style.maxWidth = '400px';
    previewElement.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
    
    // Text mit Formatierung hinzufügen
    const textElement = document.createElement('div');
    textElement.innerText = text;
    textElement.style.fontFamily = formatting.fontFamily;
    textElement.style.fontSize = `${formatting.fontSize}px`;
    textElement.style.fontWeight = formatting.isBold ? 'bold' : 'normal';
    textElement.style.fontStyle = formatting.isItalic ? 'italic' : 'normal';
    textElement.style.textDecoration = formatting.isUnderline ? 'underline' : 'none';
    textElement.style.color = '#000000';
    textElement.style.margin = '0';
    textElement.style.padding = '0';
    
    // Info-Text hinzufügen
    const infoElement = document.createElement('div');
    infoElement.innerText = 'Klicken Sie, um diesen Text einzufügen';
    infoElement.style.fontSize = '11px';
    infoElement.style.color = '#3b82f6';
    infoElement.style.marginTop = '4px';
    infoElement.style.fontStyle = 'italic';
    
    // Vorschau zusammenbauen und zum DOM hinzufügen
    previewElement.appendChild(textElement);
    previewElement.appendChild(infoElement);
    document.body.appendChild(previewElement);
    
    // Mausbewegung verfolgen und Vorschau bewegen
    const moveHandler = (e: MouseEvent) => {
      previewElement.style.transform = `translate(${e.clientX + 15}px, ${e.clientY + 15}px)`;
    };
    
    document.addEventListener('mousemove', moveHandler);
    
    // Funktion zum Entfernen der Vorschau zurückgeben
    return () => {
      document.removeEventListener('mousemove', moveHandler);
      if (previewElement.parentNode) {
        previewElement.parentNode.removeChild(previewElement);
      }
    };
  }

  /**
   * Setzt das aktuelle Zeichenwerkzeug
   */
  static setDrawingTool(tool: DrawingTool): void {
    currentDrawingTool.set(tool);
  }
  
  /**
   * Aktualisiert die Zeicheneigenschaften
   */
  static updateDrawingProperties(properties: Partial<{
    color: string;
    lineWidth: number;
    filled: boolean;
  }>): void {
    currentDrawingProperties.update(current => ({
      ...current,
      ...properties
    }));
  }
  
  /**
   * Rendert alle grafischen Elemente einer Seite auf einen Canvas
   */
  static renderShapesToCanvas(
    ctx: CanvasRenderingContext2D,
    shapes: ShapeElement[],
    scale: number = 1.0
  ): void {
    if (!ctx || !shapes) return;
    
    // Jedes Element zeichnen
    shapes.forEach(shape => {
      // Zeichenattribute setzen
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = shape.lineWidth;
      
      // Skalierte Koordinaten berechnen
      const start = {
        x: shape.startPoint.x * scale,
        y: shape.startPoint.y * scale
      };
      
      const end = shape.endPoint ? {
        x: shape.endPoint.x * scale,
        y: shape.endPoint.y * scale
      } : start;
      
      // Je nach Typ des Elements unterschiedliche Zeichenoperationen ausführen
      switch (shape.type) {
        case ShapeType.RECTANGLE:
          ctx.beginPath();
          ctx.rect(
            start.x, 
            start.y, 
            end.x - start.x, 
            end.y - start.y
          );
          ctx.stroke();
          if (shape.filled) {
            ctx.fill();
          }
          break;
          
        case ShapeType.CIRCLE: {
          ctx.beginPath();
          const radiusX = Math.abs(end.x - start.x) / 2;
          const radiusY = Math.abs(end.y - start.y) / 2;
          const centerX = start.x + (end.x - start.x) / 2;
          const centerY = start.y + (end.y - start.y) / 2;
          
          // Ellipsen-API verwenden, wenn verfügbar
          if (ctx.ellipse) {
            ctx.ellipse(
              centerX, 
              centerY, 
              radiusX, 
              radiusY, 
              0, 
              0, 
              Math.PI * 2
            );
          } else {
            // Fallback für Browser ohne Ellipsen-Unterstützung
            const ratio = radiusY / radiusX;
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.scale(1, ratio);
            ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
            ctx.restore();
          }
          
          ctx.stroke();
          if (shape.filled) {
            ctx.fill();
          }
          break;
        }
          
        case ShapeType.LINE:
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          break;
          
        case ShapeType.ARROW: {
          // Linie zeichnen
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const headSize = 15 * scale; // Größe der Pfeilspitze
          
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          
          // Pfeilspitze zeichnen
          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(
            end.x - headSize * Math.cos(angle - Math.PI / 6),
            end.y - headSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            end.x - headSize * Math.cos(angle + Math.PI / 6),
            end.y - headSize * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
          break;
        }
        
        case ShapeType.TEXT:
          if (shape.text) {
            // Text-Formatierung anwenden
            const fontSize = shape.textFormatting?.fontSize || 12;
            const fontFamily = shape.textFormatting?.fontFamily || 'Arial';
            
            let fontStyle = '';
            if (shape.textFormatting?.isBold) fontStyle += 'bold ';
            if (shape.textFormatting?.isItalic) fontStyle += 'italic ';
            
            ctx.font = `${fontStyle}${fontSize * scale}px ${fontFamily}`;
            ctx.fillText(shape.text, start.x, start.y);
            
            // Unterstreichung, falls erforderlich
            if (shape.textFormatting?.isUnderline) {
              const textWidth = ctx.measureText(shape.text).width;
              ctx.beginPath();
              ctx.moveTo(start.x, start.y + 2);
              ctx.lineTo(start.x + textWidth, start.y + 2);
              ctx.stroke();
            }
          }
          break;

        case ShapeType.IMAGE:
          if (shape.imageData) {
            // Bild zeichnen, wenn Bilddaten vorhanden sind
            const img = new Image();
            img.onload = () => {
              const width = end.x - start.x;
              const height = end.y - start.y;
              ctx.drawImage(img, start.x, start.y, width, height);
            };
            img.src = shape.imageData;

            // Rahmen um das Bild zeichnen
            ctx.beginPath();
            ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
            ctx.stroke();
          }
          break;
      }
    });
  }

  /**
   * Dupliziert ein grafisches Element und verschiebt es leicht, damit es vom Original unterscheidbar ist
   * @param pageNumber Die Seitennummer
   * @param shapeId Die ID des zu duplizierenden Elements
   */
  static duplicateShape(pageNumber: number, shapeId: string): void {
    const doc = get(currentPdfDocument);
    if (!doc) return;
    
    const page = doc.pages.find(p => p.pageNumber === pageNumber);
    if (!page) return;
    
    const sourceShape = page.shapes.find(s => s.id === shapeId);
    if (!sourceShape) return;
    
    // Kopie des Shape-Objekts erstellen
    const duplicatedShape: ShapeElement = {
      ...JSON.parse(JSON.stringify(sourceShape)), // Deep copy erstellen
      id: `shape-${Date.now()}-${Math.random().toString(36).substring(2, 11)}` // Neue ID generieren
    };
    
    // Leicht versetzten, um sichtbar zu machen, dass es ein Duplikat ist
    const offset = 20; // 20 Pixel Versatz
    
    // Startpunkt verschieben
    duplicatedShape.startPoint = {
      x: sourceShape.startPoint.x + offset,
      y: sourceShape.startPoint.y + offset
    };
    
    // Endpunkt verschieben, falls vorhanden
    if (duplicatedShape.endPoint) {
      duplicatedShape.endPoint = {
        x: (sourceShape.endPoint?.x || 0) + offset,
        y: (sourceShape.endPoint?.y || 0) + offset
      };
    }
    
    // Dupliziertes Shape hinzufügen
    this.addShape(pageNumber, duplicatedShape);
  }
}