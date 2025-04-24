<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { PDFService } from '$lib/services/pdfService';
  import type { PDFPage, TextFormatting, Point, Comment, ShapeElement } from '$lib/services/pdfService';
  import { currentDrawingTool, DrawingTool, ShapeType } from '$lib/services/pdfService';
  import { DrawingService } from '$lib/services/drawingService';
  import CommentMarker from './CommentMarker.svelte';
  // Importiere Tabellenbibliothek
  import { PdfTable } from '$lib/packages/table-lib';
  import { financialTableDesign, minimal, dataTableDesign, highContrastDesignConfig } from '$lib/packages/table-lib';
  import type { TableOptions } from '$lib/packages/table-lib';
  
  export let page: PDFPage;
  export let scale: number = 1.0;
  export let highlight: { index: number, length: number } | null = null;
  
  let editable = false;
  let textContent = page.textContent;
  let container: HTMLDivElement;
  let textEditorArea: HTMLTextAreaElement;
  let textOverlay: HTMLDivElement;
  let drawingCanvas: HTMLCanvasElement;
  let drawingCtx: CanvasRenderingContext2D | null;
  
  // Variablen für grafische Elemente
  let isDrawing = false;
  let startPoint: Point | null = null;
  let currentShape: any = null;
  let drawingTool = DrawingTool.NONE;
  
  // Variablen für Tabellenerstellung
  let tableOptionsVisible = false;
  let tableRows = 3;
  let tableColumns = 3;
  let tableDesign = 'financial'; // 'financial', 'data', 'minimal', 'highContrast'
  
  // Variablen für Kommentare und Auswahl
  let editingCommentId: string | null = null;
  let selectedShape: ShapeElement | null = null;
  let isDraggingShape = false;
  let dragOffset = { x: 0, y: 0 };

  // Variablen für Größenänderung
  let isResizing = false;
  let resizeHandle: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | null = null;
  let resizeStartPoint: Point | null = null;
  let resizeShapeId: string | null = null;
  let shiftKeyPressed = false; // Für Beibehaltung des Seitenverhältnisses

  // Variablen für Rotation
  let isRotating = false;
  let rotationStartAngle = 0;
  let rotationShapeId: string | null = null;

  // Variablen für skalierte Dimensionen
  let scaledWidth = 0;
  let scaledHeight = 0;

  // Variablen für Kontextmenü
  let showContextMenu = false;
  let contextMenuPosition = { x: 0, y: 0 };
  let contextMenuShapeId: string | null = null;
  
  // Abonniere das aktuelle Zeichenwerkzeug
  const unsubscribeDrawingTool = browser ? 
    currentDrawingTool.subscribe(value => {
      drawingTool = value;
    }) : 
    () => {};
  
  onMount(() => {
    if (browser) {
      if (drawingCanvas) {
        drawingCtx = drawingCanvas.getContext('2d');
        renderShapes();
      }
      
      // Event-Listener für Tastaturereignisse (global)
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    }
    
    return () => {
      unsubscribeDrawingTool();
      // Event-Listener entfernen
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  });
  
  // Größenberechnungen für die Skalierung
  $: {
    scaledWidth = page.width * scale;
    scaledHeight = page.height * scale;
    
    // Canvas-Größe anpassen, wenn sich die Skalierung ändert
    if (drawingCanvas) {
      drawingCanvas.width = scaledWidth;
      drawingCanvas.height = scaledHeight;
      renderShapes();
    }
  }
  
  /**
   * Alle Shapes auf den Canvas rendern
   */
  function renderShapes(): void {
    if (!drawingCtx || !page.shapes) return;
    
    // Canvas löschen
    drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    
    // Shapes zeichnen
    DrawingService.renderShapesToCanvas(drawingCtx, page.shapes, scale);
    
    // Aktuell gezeichnetes Element rendern, falls vorhanden
    if (currentShape) {
      DrawingService.renderShapesToCanvas(drawingCtx, [currentShape], scale);
    }
  }
  
  // Einstellung für die Bearbeitbarkeit umschalten
  function toggleEdit() {
    if (!browser) return;
    editable = !editable;
    
    if (editable) {
      // Aktuelle Formatierungsinformationen aus der Seite holen
      PDFService.setFormattingFromPage(page.pageNumber);
      
      // Fokus auf das Textfeld setzen
      setTimeout(() => {
        if (textEditorArea) {
          textEditorArea.focus();
        }
      }, 50);
    }
  }
  
  // Speichert den bearbeiteten Text
  function saveText() {
    if (!browser) return;
    if (textContent !== page.textContent) {
      PDFService.updatePageText(page.pageNumber, textContent);
    }
    editable = false;
  }
  
  // Abbrechen der Bearbeitung
  function cancelEdit() {
    if (!browser) return;
    textContent = page.textContent;
    editable = false;
  }
  
  // Beobachten von Änderungen an den Formatierungseigenschaften der Seite
  $: formattingStyle = generateFormattingStyle(page.formatting);
  
  // Scroll zum Suchergebnis, wenn vorhanden
  $: if (highlight && textOverlay && browser && !editable) {
    setTimeout(() => {
      try {
        // Erstelle ein Range-Objekt für die Textauswahl
        const range = document.createRange();
        const selection = window.getSelection();
        
        // Suche den Textknoten und setze den Range darauf
        if (textOverlay.firstChild && textOverlay.firstChild.firstChild) {
          const textNode = textOverlay.firstChild.firstChild;
          
          // Wählen mit dem Range-Objekt
          range.setStart(textNode, highlight.index);
          range.setEnd(textNode, highlight.index + highlight.length);
          
          // Leere die aktuelle Auswahl und füge unseren Range hinzu
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
          
          // Scrolle zum markierten Text
          const highlightElement = document.createElement('span');
          range.surroundContents(highlightElement);
          highlightElement.className = 'search-highlight';
          highlightElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch (e) {
        console.error('Fehler beim Hervorheben des Suchergebnisses:', e);
      }
    }, 100);
  }
  
  // Bei Änderung der Shapes, neu rendern
  $: if (page.shapes && drawingCtx) {
    renderShapes();
  }
  
  // Funktion zur Generierung von CSS aus Formatierungseigenschaften
  function generateFormattingStyle(formatting: TextFormatting): string {
    const styles = [];
    
    if (formatting.fontFamily) {
      styles.push(`font-family: ${formatting.fontFamily}, sans-serif`);
    }
    
    if (formatting.fontSize) {
      styles.push(`font-size: ${formatting.fontSize}px`);
    }
    
    if (formatting.isBold) {
      styles.push('font-weight: bold');
    }
    
    if (formatting.isItalic) {
      styles.push('font-style: italic');
    }
    
    if (formatting.isUnderline) {
      styles.push('text-decoration: underline');
    }
    
    return styles.join('; ');
  }
  
  // Mausposition zur PDF-Koordinate umrechnen
  function getPageCoordinates(event: MouseEvent): Point {
    if (!container) return { x: 0, y: 0 };
    
    const rect = container.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale
    };
  }
  
  // Funktion zum Hinzufügen eines Rotations-Handles zur Form
  function addRotationHandle(shape: ShapeElement): void {
    if (!shape.endPoint) return;

    // Position des Rotations-Handles berechnen (oben in der Mitte)
    const centerX = (shape.startPoint.x + shape.endPoint.x) / 2;
    const minY = Math.min(shape.startPoint.y, shape.endPoint.y);
    
    // Rotations-Handle anzeigen
    const handleElement = document.createElement('div');
    handleElement.className = 'rotation-handle';
    handleElement.style.position = 'absolute';
    handleElement.style.left = `${centerX * scale - 5}px`;
    handleElement.style.top = `${minY * scale - 20}px`;
    handleElement.style.width = '10px';
    handleElement.style.height = '10px';
    handleElement.style.borderRadius = '50%';
    handleElement.style.backgroundColor = '#3b82f6';
    handleElement.style.border = '2px solid white';
    handleElement.style.cursor = 'grab';
    handleElement.style.boxShadow = '0 0 3px rgba(0, 0, 0, 0.5)';
    handleElement.style.zIndex = '100';
    
    // Linie vom Center zum Handle
    const lineElement = document.createElement('div');
    lineElement.className = 'rotation-line';
    lineElement.style.position = 'absolute';
    lineElement.style.left = `${centerX * scale}px`;
    lineElement.style.top = `${minY * scale}px`;
    lineElement.style.width = '1px';
    lineElement.style.height = '20px';
    lineElement.style.backgroundColor = '#3b82f6';
    lineElement.style.transformOrigin = 'bottom';
    lineElement.style.transform = 'translateX(-50%) translateY(-100%)';
    lineElement.style.pointerEvents = 'none';
    
    // Event-Listener für Drag-Start
    handleElement.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isRotating = true;
      rotationShapeId = shape.id;
      
      // Mittelpunkt der Form berechnen
      const center = {
        x: ((shape.startPoint.x + shape.endPoint.x) / 2) * scale,
        y: ((shape.startPoint.y + shape.endPoint.y) / 2) * scale
      };
      
      // Startwinkel berechnen
      const startVector = {
        x: e.clientX - container.getBoundingClientRect().left - center.x,
        y: e.clientY - container.getBoundingClientRect().top - center.y
      };
      rotationStartAngle = Math.atan2(startVector.y, startVector.x) * (180 / Math.PI);
      
      // Bei Shape gespeicherter Winkel berücksichtigen
      rotationStartAngle -= shape.rotation || 0;
      
      // Cursor während der Rotation ändern
      document.body.style.cursor = 'grabbing';
    });
    
    // Zum Container hinzufügen
    container.appendChild(lineElement);
    container.appendChild(handleElement);
  }
  
  // Event-Handler für Zeichenoperationen
  function handleMouseDown(event: MouseEvent): void {
    if (editable) return;
    
    // Position ermitteln
    startPoint = getPageCoordinates(event);
    
    // Bei Auswahlwerkzeug nach vorhandenen Shapes suchen
    if (drawingTool === DrawingTool.SELECT) {
      const shape = DrawingService.findShapeAtPoint(page.pageNumber, startPoint);
      
      if (shape) {
        selectedShape = shape;
        
        // Prüfen, ob auf ein Resize-Handle geklickt wurde
        if (shape.endPoint) {
          resizeHandle = DrawingService.getResizeHandle(startPoint, shape);
          
          if (resizeHandle) {
            isResizing = true;
            resizeStartPoint = startPoint;
            resizeShapeId = shape.id;
            return;
          }
        }
        
        // Wenn kein Resize-Handle angeklickt wurde, als Drag behandeln
        isDraggingShape = true;
        dragOffset = {
          x: startPoint.x - shape.startPoint.x,
          y: startPoint.y - shape.startPoint.y
        };
      }
      
      return;
    }
    
    // Keine weiteren Aktionen, wenn kein Zeichenwerkzeug ausgewählt ist
    if (drawingTool === DrawingTool.NONE) return;
    
    isDrawing = true;
    
    // Für Text-Elemente mit verbesserter Vorschau
    if (drawingTool === DrawingTool.TEXT) {
      const text = prompt('Text eingeben:');
      if (text && text.trim()) {
        // Vorschau aktivieren
        const removePreview = DrawingService.showTextPreview(text);
        
        // Event-Listener für Klick auf PDF-Seite
        const handleTextPlacement = (e: MouseEvent) => {
          // Position ermitteln
          const point = getPageCoordinates(e);
          
          // Text an der gewählten Position hinzufügen
          const shape = DrawingService.createShape(point, undefined, text);
          DrawingService.addShape(page.pageNumber, shape);
          
          // Vorschau entfernen
          removePreview();
          
          // Event-Listener entfernen
          document.removeEventListener('click', handleTextPlacement);
          document.removeEventListener('keydown', handleKeyPress);
          
          // Werkzeug zurücksetzen
          DrawingService.setDrawingTool(DrawingTool.NONE);
        };
        
        // Event-Listener für ESC-Taste zum Abbrechen
        const handleKeyPress = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            removePreview();
            document.removeEventListener('click', handleTextPlacement);
            document.removeEventListener('keydown', handleKeyPress);
            DrawingService.setDrawingTool(DrawingTool.NONE);
          }
        };
        
        // Event-Listener hinzufügen
        document.addEventListener('click', handleTextPlacement, { once: true });
        document.addEventListener('keydown', handleKeyPress);
      }
      isDrawing = false;
      startPoint = null;
    } else {
      currentShape = DrawingService.createShape(startPoint);
    }
  }
  
  // Benutzerfreundlichen Namen für Shape-Typen zurückgeben
  function getShapeTypeName(type: ShapeType): string {
    switch (type) {
      case ShapeType.RECTANGLE: return 'Rechteck';
      case ShapeType.CIRCLE: return 'Kreis';
      case ShapeType.LINE: return 'Linie';
      case ShapeType.ARROW: return 'Pfeil';
      case ShapeType.TEXT: return 'Text';
      default: return 'Element';
    }
  }
  
  function handleMouseMove(event: MouseEvent): void {
    if (isRotating && rotationShapeId) {
      const shape = page.shapes.find(s => s.id === rotationShapeId);
      if (!shape || !shape.endPoint) return;
      
      // Mittelpunkt der Form berechnen
      const center = {
        x: ((shape.startPoint.x + shape.endPoint.x) / 2) * scale,
        y: ((shape.startPoint.y + shape.endPoint.y) / 2) * scale
      };
      
      // Aktuellen Winkel berechnen
      const currentVector = {
        x: event.clientX - container.getBoundingClientRect().left - center.x,
        y: event.clientY - container.getBoundingClientRect().top - center.y
      };
      const currentAngle = Math.atan2(currentVector.y, currentVector.x) * (180 / Math.PI);
      
      // Differenzwinkel berechnen
      let angleDiff = currentAngle - rotationStartAngle;
      
      // Wenn Shift-Taste gedrückt ist, auf 15-Grad-Schritte einrasten
      if (shiftKeyPressed) {
        angleDiff = Math.round(angleDiff / 15) * 15;
      }
      
      // Rotationswinkel aktualisieren (unter Berücksichtigung bereits vorhandener Rotation)
      const existingRotation = shape.rotation || 0;
      const newRotation = ((existingRotation + angleDiff) % 360 + 360) % 360;
      
      // Vorschau-Rotation anwenden
      if (selectedShape && selectedShape.id === rotationShapeId) {
        selectedShape = { ...selectedShape, rotation: newRotation };
        renderShapes();
      }
      
      return;
    }
    
    if (isResizing && resizeStartPoint && resizeShapeId && resizeHandle) {
      const currentPoint = getPageCoordinates(event);
      const shape = page.shapes.find(s => s.id === resizeShapeId);
      
      if (shape && shape.endPoint) {
        // Berechne den neuen Endpunkt basierend auf dem Resize-Handle
        let newEndPoint: Point;
        
        // Je nach angeklicktem Handle unterschiedliche Punkte anpassen
        switch (resizeHandle) {
          case 'topLeft':
            newEndPoint = {
              x: currentPoint.x,
              y: currentPoint.y
            };
            break;
          case 'topRight':
            newEndPoint = {
              x: currentPoint.x,
              y: shape.endPoint.y
            };
            break;
          case 'bottomLeft':
            newEndPoint = {
              x: shape.endPoint.x,
              y: currentPoint.y
            };
            break;
          case 'bottomRight':
            newEndPoint = currentPoint;
            break;
          default:
            newEndPoint = currentPoint;
        }
        
        // Klonen des aktuellen Shapes und Anpassen der Größe für die Vorschau
        const tempShape = { ...shape };
        tempShape.endPoint = newEndPoint;
        
        // Vorschau-Shape anzeigen
        selectedShape = tempShape;
        renderShapes();
      }
      return;
    }
    
    if (isDraggingShape && selectedShape) {
      const currentPoint = getPageCoordinates(event);
      
      // Berechne die neue Position des Shapes
      const newX = currentPoint.x - dragOffset.x;
      const newY = currentPoint.y - dragOffset.y;
      
      // Berechne die Differenz zwischen alter und neuer Position
      const deltaX = newX - selectedShape.startPoint.x;
      const deltaY = newY - selectedShape.startPoint.y;
      
      // Klonen des Shape-Objekts zur lokalen Bearbeitung
      const tempShape = { ...selectedShape };
      
      // Anpassen des Startpunkts
      tempShape.startPoint = {
        x: newX,
        y: newY
      };
      
      // Anpassen des Endpunkts, falls vorhanden
      if (tempShape.endPoint && selectedShape.endPoint) {
        tempShape.endPoint = {
          x: selectedShape.endPoint.x + deltaX,
          y: selectedShape.endPoint.y + deltaY
        };
      }
      
      // Lokale temporäre Version des Shapes zum Rendern verwenden
      selectedShape = tempShape;
      renderShapes();
      return;
    }
    
    if (!isDrawing || !startPoint) return;
    
    const currentPoint = getPageCoordinates(event);
    
    // Shape aktualisieren
    if (currentShape) {
      currentShape.endPoint = currentPoint;
      renderShapes();
    }
  }
  
  function handleMouseUp(event: MouseEvent): void {
    // Rotation-Handler
    if (isRotating && rotationShapeId) {
      const shape = page.shapes.find(s => s.id === rotationShapeId);
      if (!shape || !shape.endPoint) return;
      
      // Mittelpunkt der Form berechnen
      const center = {
        x: ((shape.startPoint.x + shape.endPoint.x) / 2) * scale,
        y: ((shape.startPoint.y + shape.endPoint.y) / 2) * scale
      };
      
      // Aktuellen Winkel berechnen
      const currentVector = {
        x: event.clientX - container.getBoundingClientRect().left - center.x,
        y: event.clientY - container.getBoundingClientRect().top - center.y
      };
      const currentAngle = Math.atan2(currentVector.y, currentVector.x) * (180 / Math.PI);
      
      // Differenzwinkel berechnen
      let angleDiff = currentAngle - rotationStartAngle;
      
      // Wenn Shift-Taste gedrückt ist, auf 15-Grad-Schritte einrasten
      if (shiftKeyPressed) {
        angleDiff = Math.round(angleDiff / 15) * 15;
      }
      
      // Rotationswinkel aktualisieren (unter Berücksichtigung bereits vorhandener Rotation)
      const existingRotation = shape.rotation || 0;
      const newRotation = ((existingRotation + angleDiff) % 360 + 360) % 360;
      
      // Rotation anwenden
      DrawingService.rotateShape(page.pageNumber, rotationShapeId, newRotation);
      
      // Status zurücksetzen
      isRotating = false;
      rotationShapeId = null;
      document.body.style.cursor = '';
      
      // Rotation-Handles entfernen
      const handles = document.querySelectorAll('.rotation-handle, .rotation-line');
      handles.forEach(handle => handle.remove());
      
      return;
    }

    if (isResizing && resizeShapeId && selectedShape?.endPoint) {
      // Größenänderung abschließen und speichern
      const currentPoint = getPageCoordinates(event);
      
      // Resize-Operation mit oder ohne Seitenverhältnisbeibehaltung durchführen
      DrawingService.resizeShape(
        page.pageNumber, 
        resizeShapeId, 
        selectedShape.endPoint, 
        shiftKeyPressed // Shift-Key bestimmt, ob das Seitenverhältnis beibehalten werden soll
      );
      
      // Resize-Status zurücksetzen
      isResizing = false;
      resizeHandle = null;
      resizeStartPoint = null;
      resizeShapeId = null;
      selectedShape = null;
      return;
    }
    
    if (isDraggingShape && selectedShape) {
      // Shape-Position aktualisieren, wenn es verschoben wurde
      const currentPoint = getPageCoordinates(event);
      const newPosition = {
        x: currentPoint.x - dragOffset.x,
        y: currentPoint.y - dragOffset.y
      };
      
      // Berechne die Delta-Bewegung (Wie weit wurde das Element verschoben)
      const deltaX = newPosition.x - selectedShape.startPoint.x;
      const deltaY = newPosition.y - selectedShape.startPoint.y;
      
      // Wenn eine signifikante Verschiebung stattgefunden hat, speichere die neue Position
      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        DrawingService.moveShape(page.pageNumber, selectedShape.id, deltaX, deltaY);
      }
      
      isDraggingShape = false;
      selectedShape = null;
      return;
    }
    
    if (!isDrawing || !startPoint) return;
    
    const endPoint = getPageCoordinates(event);
    
    // Für Kommentare
    if (drawingTool === DrawingTool.COMMENT) {
      // Prompt für Kommentartext anzeigen
      const commentText = prompt('Kommentar eingeben:');
      if (commentText && commentText.trim()) {
        PDFService.addComment(page.pageNumber, startPoint, commentText);
      }
    }
    // Form nur hinzufügen, wenn ausreichend gezogen wurde
    else if (
      drawingTool !== DrawingTool.TEXT && 
      currentShape &&
      (Math.abs(endPoint.x - startPoint.x) > 5 || Math.abs(endPoint.y - startPoint.y) > 5)
    ) {
      currentShape.endPoint = endPoint;
      DrawingService.addShape(page.pageNumber, currentShape);
    }
    
    // Zeichenvorgang beenden
    isDrawing = false;
    startPoint = null;
    currentShape = null;
    renderShapes();
  }
  
  // Handler für Kommentare
  function handleEditComment(commentId: string): void {
    const comment = page.comments.find(c => c.id === commentId);
    if (!comment) return;
    
    const newText = prompt('Kommentar bearbeiten:', comment.text);
    if (newText !== null) {
      PDFService.updateComment(page.pageNumber, commentId, newText);
    }
  }
  
  function handleDeleteComment(commentId: string): void {
    PDFService.removeComment(page.pageNumber, commentId);
  }
  
  // Tastendruck-Handler für Modifier-Tasten (z.B. Shift für proportionale Größenänderung)
  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Shift') {
      shiftKeyPressed = true;
    }
  }
  
  function handleKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Shift') {
      shiftKeyPressed = false;
    }
  }
  
  // Ausgewähltes Shape duplizieren
  function duplicateSelectedShape(): void {
    if (contextMenuShapeId) {
      DrawingService.duplicateShape(page.pageNumber, contextMenuShapeId);
      closeContextMenu();
    }
  }
  
  // Ausgewähltes Shape löschen
  function deleteSelectedShape(): void {
    if (contextMenuShapeId) {
      DrawingService.removeShape(page.pageNumber, contextMenuShapeId);
      closeContextMenu();
    }
  }

  // Ausgewähltes Shape rotieren
  function rotateSelectedShape(angle: number): void {
    if (contextMenuShapeId) {
      DrawingService.rotateShapeBy(page.pageNumber, contextMenuShapeId, angle);
      closeContextMenu();
    }
  }
  
  // Kontextmenü für Shapes
  function showShapeContextMenu(event: MouseEvent, shape: ShapeElement): void {
    event.preventDefault(); // Standard-Kontextmenü verhindern
    
    // Position berechnen (angepasst an die aktuelle Mausposition)
    contextMenuPosition = { x: event.clientX, y: event.clientY };
    contextMenuShapeId = shape.id;
    showContextMenu = true;
    
    // Event-Listener hinzufügen, um das Menü zu schließen, wenn irgendwo geklickt wird
    setTimeout(() => {
      document.addEventListener('click', closeContextMenu, { once: true });
    }, 10);
  }

  // Tabelle erstellen
  function createTable(): void {
    const tableOptions: TableOptions = {
      rows: tableRows,
      columns: tableColumns,
      design: tableDesign === 'financial' ? financialTableDesign :
              tableDesign === 'data' ? dataTableDesign :
              tableDesign === 'minimal' ? minimal :
              highContrastDesignConfig
    };
    
    const table = PdfTable.createTable(tableOptions);
    DrawingService.addTable(page.pageNumber, table);
    DrawingService.setDrawingTool(DrawingTool.NONE);
  }
</script>

<div class="pdf-page-container">
  <div 
    class="pdf-page"
    bind:this={container}
    style="width: {scaledWidth}px; height: {scaledHeight}px;"
    data-page-number="{page.pageNumber}"
    on:mousedown={handleMouseDown}
    on:mousemove={handleMouseMove}
    on:mouseup={handleMouseUp}
    on:mouseleave={handleMouseUp}
    on:contextmenu={(e) => {
      if (drawingTool === DrawingTool.SELECT) {
        const point = getPageCoordinates(e);
        const shape = DrawingService.findShapeAtPoint(page.pageNumber, point);
        if (shape) {
          showShapeContextMenu(e, shape);
        }
      }
    }}
  >
    <!-- Canvas-Anzeige der Seite -->
    {#if page.canvas && browser && !editable}
      <canvas 
        width={page.canvas.width} 
        height={page.canvas.height}
        style="width: {scaledWidth}px; height: {scaledHeight}px;"
      >
        <img 
          src={page.canvas.toDataURL('image/png')} 
          alt={`Page ${page.pageNumber}`} 
          style="width: {scaledWidth}px; height: {scaledHeight}px;"
        />
      </canvas>
    {/if}
    
    <!-- Canvas für Zeichnungen -->
    {#if browser && !editable}
      <canvas 
        class="drawing-canvas" 
        bind:this={drawingCanvas}
        width={scaledWidth}
        height={scaledHeight}
      ></canvas>
    {/if}
    
    <!-- Kommentarmarker -->
    {#if page.comments}
      {#each page.comments as comment (comment.id)}
        <CommentMarker 
          {comment} 
          {scale} 
          on:editComment={e => handleEditComment(e.detail)}
          on:deleteComment={e => handleDeleteComment(e.detail)}
        />
      {/each}
    {/if}
    
    <!-- Resize-Handles für ausgewählte Shapes -->
    {#if selectedShape && selectedShape.endPoint && drawingTool === DrawingTool.SELECT && !isResizing && !isDraggingShape}
      <!-- Berechne die Positionen für die Handle-Punkte -->
      {@const minX = Math.min(selectedShape.startPoint.x, selectedShape.endPoint.x) * scale}
      {@const maxX = Math.max(selectedShape.startPoint.x, selectedShape.endPoint.x) * scale}
      {@const minY = Math.min(selectedShape.startPoint.y, selectedShape.endPoint.y) * scale}
      {@const maxY = Math.max(selectedShape.startPoint.y, selectedShape.endPoint.y) * scale}

      <!-- Handle für Top-Left -->
      <div 
        class="resize-handle top-left"
        style="left: {minX - 5}px; top: {minY - 5}px;"
      ></div>
      
      <!-- Handle für Top-Right -->
      <div 
        class="resize-handle top-right"
        style="left: {maxX - 5}px; top: {minY - 5}px;"
      ></div>
      
      <!-- Handle für Bottom-Left -->
      <div 
        class="resize-handle bottom-left"
        style="left: {minX - 5}px; top: {maxY - 5}px;"
      ></div>
      
      <!-- Handle für Bottom-Right -->
      <div 
        class="resize-handle bottom-right"
        style="left: {maxX - 5}px; top: {maxY - 5}px;"
      ></div>
      
      <!-- Rotations-Handle -->
      {@const centerX = (selectedShape.startPoint.x + selectedShape.endPoint.x) / 2 * scale}
      {@const minY = Math.min(selectedShape.startPoint.y, selectedShape.endPoint.y) * scale}
      <div 
        class="rotation-handle"
        style="left: {centerX - 5}px; top: {minY - 20}px;"
      ></div>
      <div 
        class="rotation-line"
        style="left: {centerX}px; top: {minY}px; height: 20px;"
      ></div>
    {/if}
    
    <!-- Editierbarer Textbereich -->
    {#if editable && browser}
      <div class="text-editor">
        <textarea
          bind:this={textEditorArea}
          bind:value={textContent}
          style="width: {scaledWidth}px; height: {scaledHeight}px; {formattingStyle}"
        ></textarea>
        <div class="editor-actions">
          <button class="action-button save" on:click={saveText}>Speichern</button>
          <button class="action-button cancel" on:click={cancelEdit}>Abbrechen</button>
        </div>
      </div>
    {:else if browser}
      <div class="overlay-actions">
        <button class="edit-button" on:click={toggleEdit}>
          Bearbeiten
        </button>
      </div>
      
      <!-- Formatierter Text-Overlay für die Vorschau -->
      {#if page.textContent}
        <div 
          class="text-overlay" 
          style="width: {scaledWidth}px; height: {scaledHeight}px;"
          bind:this={textOverlay}
        >
          <p style="{formattingStyle}">{page.textContent}</p>
        </div>
      {/if}
    {/if}
    
    <!-- Cursor-Stil basierend auf dem aktuellen Zeichenwerkzeug -->
    {#if drawingTool !== DrawingTool.NONE && !editable}
      <div class="cursor-overlay" style="cursor: {
        drawingTool === DrawingTool.RECTANGLE ? 'crosshair' : 
        drawingTool === DrawingTool.CIRCLE ? 'crosshair' : 
        drawingTool === DrawingTool.LINE ? 'crosshair' : 
        drawingTool === DrawingTool.ARROW ? 'crosshair' : 
        drawingTool === DrawingTool.TEXT ? 'text' : 
        drawingTool === DrawingTool.COMMENT ? 'pointer' : 'default'
      }"></div>
    {/if}
    
    <!-- Kontextmenü für Shapes -->
    {#if showContextMenu}
      <div 
        class="context-menu"
        style="left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px;"
      >
        <button on:click={duplicateSelectedShape}>Duplizieren</button>
        <button on:click={deleteSelectedShape}>Löschen</button>
        <div class="context-menu-separator"></div>
        <button on:click={() => rotateSelectedShape(90)}>90° im Uhrzeigersinn</button>
        <button on:click={() => rotateSelectedShape(-90)}>90° gegen Uhrzeigersinn</button>
        <button on:click={() => rotateSelectedShape(45)}>45° im Uhrzeigersinn</button>
        <button on:click={() => rotateSelectedShape(-45)}>45° gegen Uhrzeigersinn</button>
        <button on:click={() => rotateSelectedShape(180)}>180° drehen</button>
      </div>
    {/if}
    
    <!-- Tabellen-Dialog-Overlay -->
    {#if drawingTool === DrawingTool.TABLE && browser}
      <div class="table-dialog-overlay">
        <div class="table-dialog">
          <h3>Tabelle einfügen</h3>
          
          <div class="table-options">
            <div class="option-group">
              <label for="tableRows">Zeilen:</label>
              <input type="number" id="tableRows" bind:value={tableRows} min="1" max="20">
            </div>
            
            <div class="option-group">
              <label for="tableColumns">Spalten:</label>
              <input type="number" id="tableColumns" bind:value={tableColumns} min="1" max="20">
            </div>
            
            <div class="option-group">
              <label for="tableDesign">Design:</label>
              <select id="tableDesign" bind:value={tableDesign}>
                <option value="financial">Finanztabelle</option>
                <option value="data">Datentabelle</option>
                <option value="minimal">Minimal</option>
                <option value="highContrast">Hoher Kontrast</option>
              </select>
            </div>
          </div>
          
          <div class="table-preview">
            <div class="preview-container">
              <!-- Tabellen-Vorschau hier -->
              <div class="table-preview-grid"
                style="grid-template-columns: repeat({Math.min(tableColumns, 8)}, 1fr); 
                      grid-template-rows: repeat({Math.min(tableRows, 6)}, 20px);"
              >
                {#each Array(Math.min(tableRows, 6)) as _, rowIndex}
                  {#each Array(Math.min(tableColumns, 8)) as _, colIndex}
                    <div 
                      class="table-cell" 
                      class:header-cell={rowIndex === 0} 
                      class:first-col={colIndex === 0}
                      style="
                        background-color: {
                          tableDesign === 'highContrast' ? (rowIndex === 0 ? '#333' : '#000') :
                          tableDesign === 'data' ? (rowIndex === 0 ? '#f0f0f0' : (rowIndex % 2 === 0 ? '#fff' : '#f9f9f9')) :
                          tableDesign === 'financial' ? (rowIndex === 0 ? '#f5f5f5' : '#fff') :
                          rowIndex === 0 ? '#f8f8f8' : '#fff'
                        };
                        color: ${tableDesign === 'highContrast' ? '#fff' : '#000'};
                      "
                    ></div>
                  {/each}
                {/each}
              </div>
            </div>
          </div>
          
          <div class="table-actions">
            <button class="action-button cancel" on:click={() => {
              DrawingService.setDrawingTool(DrawingTool.NONE);
            }}>Abbrechen</button>
            <button class="action-button create" on:click={createTable}>Erstellen</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .pdf-page-container {
    margin-bottom: 1rem;
  }
  
  .pdf-page {
    position: relative;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    background-color: white;
  }
  
  .drawing-canvas {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 20;
  }
  
  .cursor-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 25;
  }
  
  .text-overlay {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    padding: 50px;
    box-sizing: border-box;
    overflow: hidden;
    z-index: 10;
    
    p {
      margin: 0;
      white-space: pre-wrap;
      line-height: 1.5;
    }
    
    :global(.search-highlight) {
      background-color: rgba(255, 255, 0, 0.4);
      border-radius: 2px;
      padding: 2px 0;
    }
  }
  
  .overlay-actions {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 30;
    
    .edit-button {
      background-color: rgba(59, 130, 246, 0.9);
      color: white;
      border: none;
      border-radius: 0.25rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      cursor: pointer;
      
      &:hover {
        background-color: rgba(37, 99, 235, 0.9);
      }
    }
  }
  
  .pdf-page:hover .overlay-actions {
    opacity: 1;
  }
  
  .text-editor {
    position: relative;
    z-index: 40;
    
    textarea {
      padding: 1rem;
      font-family: Arial, sans-serif;
      font-size: 1rem;
      line-height: 1.5;
      border: 2px solid #3b82f6;
      resize: none;
      box-sizing: border-box;
    }
    
    .editor-actions {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      display: flex;
      gap: 0.5rem;
      
      .action-button {
        border: none;
        border-radius: 0.25rem;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        cursor: pointer;
        
        &.save {
          background-color: #10b981;
          color: white;
          
          &:hover {
            background-color: #059669;
          }
        }
        
        &.cancel {
          background-color: #f43f5e;
          color: white;
          
          &:hover {
            background-color: #e11d48;
          }
        }
      }
    }
  }
  
  .resize-handle {
    position: absolute;
    width: 10px;
    height: 10px;
    background-color: #3b82f6;
    border: 2px solid white;
    border-radius: 50%;
    z-index: 50;
    cursor: pointer;
    box-shadow: 0 0 3px rgba(0, 0, 0, 0.5);
    
    &.top-left {
      cursor: nwse-resize;
    }
    
    &.top-right {
      cursor: nesw-resize;
    }
    
    &.bottom-left {
      cursor: nesw-resize;
    }
    
    &.bottom-right {
      cursor: nwse-resize;
    }
  }
  
  .rotation-handle {
    position: absolute;
    width: 10px;
    height: 10px;
    background-color: #3b82f6;
    border: 2px solid white;
    border-radius: 50%;
    z-index: 50;
    cursor: grab;
    box-shadow: 0 0 3px rgba(0, 0, 0, 0.5);
  }
  
  .rotation-line {
    position: absolute;
    width: 1px;
    background-color: #3b82f6;
    z-index: 50;
  }
  
  .context-menu {
    position: absolute;
    background-color: white;
    border: 1px solid #ddd;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border-radius: 0.25rem;
    z-index: 60;
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    
    button {
      background-color: transparent;
      border: none;
      padding: 0.5rem 1rem;
      text-align: left;
      cursor: pointer;
      font-size: 0.875rem;
      
      &:hover {
        background-color: #f3f4f6;
      }
    }
  }

  .context-menu-separator {
    height: 1px;
    background-color: #ddd;
    margin: 0.5rem 0;
  }

  .table-dialog-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 70;
  }

  .table-dialog {
    background-color: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    width: 400px;
    max-width: 90%;
  }

  .table-options {
    margin-bottom: 1rem;

    .option-group {
      margin-bottom: 0.5rem;

      label {
        display: block;
        font-weight: bold;
        margin-bottom: 0.25rem;
      }

      input,
      select {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 0.25rem;
        font-size: 0.875rem;
      }
    }
  }

  .table-preview {
    margin-bottom: 1rem;

    .preview-container {
      overflow: hidden;
      border: 1px solid #ddd;
      border-radius: 0.25rem;
      padding: 0.5rem;
      background-color: #f9f9f9;

      .table-preview-grid {
        display: grid;
        gap: 2px;

        .table-cell {
          border: 1px solid #ddd;
          background-color: #fff;
          height: 20px;
        }

        .header-cell {
          font-weight: bold;
          background-color: #f0f0f0;
        }

        .first-col {
          font-weight: bold;
        }
      }
    }
  }

  .table-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;

    .action-button {
      border: none;
      border-radius: 0.25rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      cursor: pointer;

      &.cancel {
        background-color: #f43f5e;
        color: white;

        &:hover {
          background-color: #e11d48;
        }
      }

      &.create {
        background-color: #10b981;
        color: white;

        &:hover {
          background-color: #059669;
        }
      }
    }
  }
</style>