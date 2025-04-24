import { 
  type Point, 
  type ShapeElement, 
  ShapeType, 
  currentPdfDocument, 
  DrawingTool, 
  currentDrawingTool,
  currentDrawingProperties
} from './pdfService';

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
    // Aktuelle Zeicheneigenschaften aus dem Store lesen
    let tool: DrawingTool = DrawingTool.NONE;
    let properties = { color: '#000000', lineWidth: 1, filled: false };
    
    // Einmalig aus den Stores lesen
    currentDrawingTool.subscribe(value => { tool = value; })();
    currentDrawingProperties.subscribe(value => { properties = value; })();
    
    // Eindeutige ID generieren
    const id = `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
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
      text: text
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
          
        case ShapeType.CIRCLE:
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
          
        case ShapeType.LINE:
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          break;
          
        case ShapeType.ARROW:
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