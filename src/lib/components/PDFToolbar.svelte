<script lang="ts">
  import type { PDFDocumentInfo, TextFormatting } from '$lib/services/pdfService';
  import { currentFormatting, PDFService, DrawingTool, currentDrawingTool, currentDrawingProperties } from '$lib/services/pdfService';
  import { DrawingService } from '$lib/services/drawingService';
  import { onMount, onDestroy } from 'svelte';
  
  export let pdfDocument: PDFDocumentInfo | null = null;
  export let onFileOpen: () => void;
  export let onNewFile: () => void;
  export let onSaveFile: () => void;
  
  // Lokale Formatierungsvariablen, die später an das Dokument gebunden werden
  let fontSize = 12;
  let fontFamily = 'Arial';
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  
  // Zeichenvariablen
  let drawingTool = DrawingTool.NONE;
  let drawingColor = '#000000';
  let drawingLineWidth = 2;
  let drawingFilled = false;
  
  // Abonnieren der aktuellen Formatierung
  const unsubscribeFormatting = currentFormatting.subscribe(formatting => {
    fontSize = formatting.fontSize;
    fontFamily = formatting.fontFamily;
    isBold = formatting.isBold;
    isItalic = formatting.isItalic;
    isUnderline = formatting.isUnderline;
  });
  
  // Abonnieren des aktuellen Zeichenwerkzeugs
  const unsubscribeDrawingTool = currentDrawingTool.subscribe(tool => {
    drawingTool = tool;
  });
  
  // Abonnieren der aktuellen Zeicheneigenschaften
  const unsubscribeDrawingProperties = currentDrawingProperties.subscribe(props => {
    drawingColor = props.color;
    drawingLineWidth = props.lineWidth;
    drawingFilled = props.filled;
  });
  
  // Aktuelle Formatierung aktualisieren, wenn sich ein Wert ändert
  $: if (pdfDocument) {
    PDFService.updateFormatting({
      fontSize,
      fontFamily,
      isBold,
      isItalic,
      isUnderline
    });
  }
  
  // Zeichenwerkzeug umschalten
  function toggleDrawingTool(tool: DrawingTool): void {
    if (drawingTool === tool) {
      DrawingService.setDrawingTool(DrawingTool.NONE);
    } else {
      DrawingService.setDrawingTool(tool);
    }
  }
  
  // Zeicheneigenschaften aktualisieren
  $: if (pdfDocument) {
    DrawingService.updateDrawingProperties({
      color: drawingColor,
      lineWidth: drawingLineWidth,
      filled: drawingFilled
    });
  }
  
  onDestroy(() => {
    unsubscribeFormatting();
    unsubscribeDrawingTool();
    unsubscribeDrawingProperties();
  });
</script>

<div class="pdf-toolbar">
  <div class="toolbar-section file-actions">
    <button class="toolbar-button" on:click={onNewFile} title="Neues Dokument">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
      <span>Neu</span>
    </button>
    
    <button class="toolbar-button" on:click={onFileOpen} title="Datei öffnen">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
      </svg>
      <span>Öffnen</span>
    </button>
    
    <button 
      class="toolbar-button" 
      on:click={onSaveFile} 
      disabled={!pdfDocument || !pdfDocument.modified} 
      title="Datei speichern"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.012 1.244h3.218a2.25 2.25 0 0 0 2.012-1.244l.256-.512a2.25 2.25 0 0 1 2.012-1.244h3.86M12 3v8.25m0 0-3-3m3 3 3-3" />
      </svg>
      <span>Speichern</span>
    </button>
  </div>
  
  <div class="toolbar-separator"></div>
  
  <!-- Zeichenwerkzeuge -->
  <div class="toolbar-section drawing-tools">
    <button 
      class="toolbar-tool-button" 
      class:active={drawingTool === DrawingTool.RECTANGLE}
      on:click={() => toggleDrawingTool(DrawingTool.RECTANGLE)} 
      disabled={!pdfDocument}
      title="Rechteck zeichnen"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="4" y="4" width="16" height="16" stroke-width="2" />
      </svg>
    </button>
    
    <button 
      class="toolbar-tool-button" 
      class:active={drawingTool === DrawingTool.CIRCLE}
      on:click={() => toggleDrawingTool(DrawingTool.CIRCLE)} 
      disabled={!pdfDocument}
      title="Kreis zeichnen"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="9" stroke-width="2" />
      </svg>
    </button>
    
    <button 
      class="toolbar-tool-button" 
      class:active={drawingTool === DrawingTool.LINE}
      on:click={() => toggleDrawingTool(DrawingTool.LINE)} 
      disabled={!pdfDocument}
      title="Linie zeichnen"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <line x1="4" y1="20" x2="20" y2="4" stroke-width="2" />
      </svg>
    </button>
    
    <button 
      class="toolbar-tool-button" 
      class:active={drawingTool === DrawingTool.ARROW}
      on:click={() => toggleDrawingTool(DrawingTool.ARROW)} 
      disabled={!pdfDocument}
      title="Pfeil zeichnen"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
      </svg>
    </button>
    
    <button 
      class="toolbar-tool-button" 
      class:active={drawingTool === DrawingTool.TEXT}
      on:click={() => toggleDrawingTool(DrawingTool.TEXT)} 
      disabled={!pdfDocument}
      title="Text hinzufügen"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h18M7 3v18M17 3v18" />
      </svg>
    </button>
    
    <div class="drawing-properties">
      <input 
        type="color" 
        bind:value={drawingColor} 
        disabled={!pdfDocument || drawingTool === DrawingTool.NONE}
        title="Farbe wählen"
      />
      
      <select 
        bind:value={drawingLineWidth} 
        disabled={!pdfDocument || drawingTool === DrawingTool.NONE}
        title="Linienstärke"
      >
        <option value={1}>Dünn</option>
        <option value={2}>Mittel</option>
        <option value={4}>Dick</option>
        <option value={8}>Extra dick</option>
      </select>
      
      <label class="fill-checkbox">
        <input 
          type="checkbox" 
          bind:checked={drawingFilled} 
          disabled={!pdfDocument || (drawingTool !== DrawingTool.RECTANGLE && drawingTool !== DrawingTool.CIRCLE)}
          title="Gefüllt"
        />
        <span>Gefüllt</span>
      </label>
    </div>
  </div>
  
  <div class="toolbar-separator"></div>
  
  <!-- Formatierungen -->
  <div class="toolbar-section format-actions">
    <div class="select-wrapper">
      <select bind:value={fontFamily} disabled={!pdfDocument} class="font-select">
        <option value="Arial">Arial</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="Courier New">Courier New</option>
        <option value="Georgia">Georgia</option>
        <option value="Verdana">Verdana</option>
      </select>
    </div>
    
    <div class="select-wrapper">
      <select bind:value={fontSize} disabled={!pdfDocument} class="font-size-select">
        {#each Array.from({ length: 20 }, (_, i) => i + 8) as size}
          <option value={size}>{size}px</option>
        {/each}
      </select>
    </div>
    
    <div class="format-buttons">
      <button 
        class="toolbar-format-button" 
        class:active={isBold} 
        on:click={() => isBold = !isBold} 
        disabled={!pdfDocument}
        title="Fett"
      >
        <strong>B</strong>
      </button>
      
      <button 
        class="toolbar-format-button" 
        class:active={isItalic} 
        on:click={() => isItalic = !isItalic} 
        disabled={!pdfDocument}
        title="Kursiv"
      >
        <em>I</em>
      </button>
      
      <button 
        class="toolbar-format-button" 
        class:active={isUnderline} 
        on:click={() => isUnderline = !isUnderline} 
        disabled={!pdfDocument}
        title="Unterstrichen"
      >
        <u>U</u>
      </button>
    </div>
  </div>
  
  <div class="toolbar-separator"></div>
  
  <!-- PDF-Dokumentinfos -->
  <div class="document-info">
    {#if pdfDocument}
      <span class="filename">{pdfDocument.fileName}</span>
      {#if pdfDocument.modified}
        <span class="modified-indicator">•</span>
      {/if}
    {/if}
  </div>
</div>

<style lang="scss">
  .pdf-toolbar {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    background-color: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .toolbar-section {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .drawing-tools {
    .drawing-properties {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-left: 0.5rem;
      padding-left: 0.5rem;
      border-left: 1px solid #e5e7eb;
      
      input[type="color"] {
        width: 2rem;
        height: 2rem;
        padding: 0;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        cursor: pointer;
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
      
      select {
        height: 2rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0 0.5rem;
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
      
      .fill-checkbox {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.875rem;
        color: #4b5563;
        cursor: pointer;
        
        &:disabled, &.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        input[type="checkbox"] {
          margin: 0;
        }
      }
    }
  }
  
  .toolbar-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    background-color: white;
    color: #374151;
    cursor: pointer;
    transition: background-color 0.2s;
    
    &:hover:not(:disabled) {
      background-color: #f3f4f6;
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    svg {
      width: 1.25rem;
      height: 1.25rem;
    }
  }
  
  .toolbar-tool-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    background-color: white;
    color: #374151;
    cursor: pointer;
    transition: background-color 0.2s;
    
    &:hover:not(:disabled) {
      background-color: #f3f4f6;
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    &.active {
      background-color: #e5e7eb;
      border-color: #9ca3af;
      color: #1f2937;
    }
    
    svg {
      width: 1.25rem;
      height: 1.25rem;
    }
  }
  
  .toolbar-separator {
    width: 1px;
    height: 2rem;
    background-color: #e5e7eb;
  }
  
  .select-wrapper {
    position: relative;
    
    &::after {
      content: '';
      position: absolute;
      top: 50%;
      right: 0.5rem;
      transform: translateY(-50%);
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid #6b7280;
      pointer-events: none;
    }
    
    select {
      appearance: none;
      padding: 0.5rem 1.5rem 0.5rem 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 0.25rem;
      background-color: white;
      color: #374151;
      cursor: pointer;
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
    
    .font-select {
      min-width: 10rem;
    }
    
    .font-size-select {
      width: 5rem;
    }
  }
  
  .format-buttons {
    display: flex;
    gap: 0.25rem;
    
    .toolbar-format-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: 1px solid #d1d5db;
      border-radius: 0.25rem;
      background-color: white;
      color: #374151;
      cursor: pointer;
      
      &:hover:not(:disabled) {
        background-color: #f3f4f6;
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      &.active {
        background-color: #e5e7eb;
      }
    }
  }
  
  .document-info {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    
    .filename {
      font-size: 0.875rem;
      color: #4b5563;
      max-width: 15rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .modified-indicator {
      color: #dc2626;
      font-weight: bold;
      font-size: 1.25rem;
    }
  }
</style>