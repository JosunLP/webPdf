<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { PDFService } from '$lib/services/pdfService';
  import type { PDFPage, TextFormatting, Point } from '$lib/services/pdfService';
  import { currentDrawingTool, DrawingTool } from '$lib/services/pdfService';
  import { DrawingService } from '$lib/services/drawingService';
  
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
    if (drawingTool === DrawingTool.NONE || editable) return;
    
    isDrawing = true;
    startPoint = getPageCoordinates(event);
    
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
    
    // Form nur hinzufügen, wenn ausreichend gezogen wurde
    if (
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
        drawingTool === DrawingTool.TEXT ? 'text' : 'default'
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