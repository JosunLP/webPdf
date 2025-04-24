<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { PDFService } from '$lib/services/pdfService';
  import type { PDFPage, TextFormatting, Point, Comment, ShapeElement } from '$lib/services/pdfService';
  import { currentDrawingTool, DrawingTool, ShapeType } from '$lib/services/pdfService';
  import { DrawingService } from '$lib/services/drawingService';
  import CommentMarker from './CommentMarker.svelte';
  
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
  
  // Variablen für die Zeichenfunktion
  let isDrawing = false;
  let startPoint: Point | null = null;
  let currentShape: any = null;
  let drawingTool = DrawingTool.NONE;
  
  // Variablen für Kommentare und Auswahl
  let editingCommentId: string | null = null;
  let selectedShape: ShapeElement | null = null;

  // Variablen für skalierte Dimensionen
  let scaledWidth = 0;
  let scaledHeight = 0;
  
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
    }
    
    return () => {
      unsubscribeDrawingTool();
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
        
        // Bestätigungsdialog anzeigen und das Element löschen, wenn bestätigt
        const confirmDelete = confirm(`Möchten Sie dieses Element (${getShapeTypeName(shape.type)}) löschen?`);
        if (confirmDelete) {
          DrawingService.removeShape(page.pageNumber, shape.id);
          selectedShape = null;
        }
      }
      
      return;
    }
    
    // Keine weiteren Aktionen, wenn kein Zeichenwerkzeug ausgewählt ist
    if (drawingTool === DrawingTool.NONE) return;
    
    isDrawing = true;
    
    // Für Text-Elemente brauchen wir einen Prompt
    if (drawingTool === DrawingTool.TEXT) {
      const text = prompt('Text eingeben:');
      if (text) {
        const shape = DrawingService.createShape(startPoint, undefined, text);
        DrawingService.addShape(page.pageNumber, shape);
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
    if (!isDrawing || !startPoint) return;
    
    const currentPoint = getPageCoordinates(event);
    
    // Shape aktualisieren
    if (currentShape) {
      currentShape.endPoint = currentPoint;
      renderShapes();
    }
  }
  
  function handleMouseUp(event: MouseEvent): void {
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
</script>

<div class="pdf-page-container">
  <div 
    class="pdf-page"
    bind:this={container}
    style="width: {scaledWidth}px; height: {scaledHeight}px;"
    on:mousedown={handleMouseDown}
    on:mousemove={handleMouseMove}
    on:mouseup={handleMouseUp}
    on:mouseleave={handleMouseUp}
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
</style>