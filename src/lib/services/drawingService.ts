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
   */
  static createShape(
    startPoint: Point, 
    endPoint?: Point, 
    text?: string
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
      textFormatting: shapeType === ShapeType.TEXT ? {...formatting} : undefined
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
      }
    });
  }
}