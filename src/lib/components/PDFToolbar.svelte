<script lang="ts">
  import type { PDFDocumentInfo } from '$lib/services/pdfService';
  
  export let pdfDocument: PDFDocumentInfo | null = null;
  export let onFileOpen: () => void;
  export let onNewFile: () => void;
  export let onSaveFile: () => void;
  
  // Text-Formatierungsoptionen werden in Version 2 implementiert
  let fontSize = 16;
  let fontFamily = 'Arial';
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
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
  
  <!-- Basisformatierungen für Version 1 -->
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
  }
  
  .toolbar-section {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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