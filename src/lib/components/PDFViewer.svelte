<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { PDFDocumentInfo } from '$lib/services/pdfService';
  import PDFPage from './PDFPage.svelte';
  
  export let document: PDFDocumentInfo;
  
  let currentPage = 1;
  let scale = 1.0;
  
  // Navigation zwischen den Seiten
  function nextPage() {
    if (currentPage < document.totalPages) {
      currentPage++;
    }
  }
  
  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
    }
  }
  
  // Zoom-Funktionen
  function zoomIn() {
    scale = Math.min(scale + 0.1, 3.0);
  }
  
  function zoomOut() {
    scale = Math.max(scale - 0.1, 0.5);
  }
  
  function resetZoom() {
    scale = 1.0;
  }
  
  // Tastatur-Navigation
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight' || event.key === ' ') {
      nextPage();
    } else if (event.key === 'ArrowLeft') {
      prevPage();
    } else if (event.key === '+') {
      zoomIn();
    } else if (event.key === '-') {
      zoomOut();
    } else if (event.key === '0') {
      resetZoom();
    }
  }
  
  let keydownHandler: ((e: KeyboardEvent) => void) | undefined;
  
  onMount(() => {
    // Sicherstellen, dass wir nur im Browser sind, bevor wir Event-Listener hinzufügen
    if (typeof window !== 'undefined') {
      keydownHandler = (e) => handleKeydown(e);
      window.addEventListener('keydown', keydownHandler);
    }
    
    return () => {
      if (typeof window !== 'undefined' && keydownHandler) {
        window.removeEventListener('keydown', keydownHandler);
      }
    };
  });
</script>

<div class="pdf-viewer">
  <div class="viewer-toolbar">
    <div class="navigation">
      <button class="nav-button" on:click={prevPage} disabled={currentPage <= 1}>
        <span>&#9664;</span>
      </button>
      <span class="page-info">Seite {currentPage} von {document.totalPages}</span>
      <button class="nav-button" on:click={nextPage} disabled={currentPage >= document.totalPages}>
        <span>&#9654;</span>
      </button>
    </div>
    
    <div class="zoom-controls">
      <button class="zoom-button" on:click={zoomOut}>-</button>
      <span class="zoom-level">{Math.round(scale * 100)}%</span>
      <button class="zoom-button" on:click={zoomIn}>+</button>
      <button class="zoom-button" on:click={resetZoom}>100%</button>
    </div>
  </div>
  
  <div class="document-container">
    {#if document.pages[currentPage - 1]}
      <PDFPage page={document.pages[currentPage - 1]} {scale} />
    {/if}
  </div>
</div>

<style lang="scss">
  .pdf-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: #f5f5f5;
  }
  
  .viewer-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background-color: #fff;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    
    .navigation {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      
      .nav-button {
        background: none;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        
        &:hover:not(:disabled) {
          background-color: #f3f4f6;
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
      
      .page-info {
        font-size: 0.875rem;
        color: #4b5563;
      }
    }
    
    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      
      .zoom-button {
        background: none;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        
        &:hover {
          background-color: #f3f4f6;
        }
      }
      
      .zoom-level {
        font-size: 0.875rem;
        color: #4b5563;
        width: 3rem;
        text-align: center;
      }
    }
  }
  
  .document-container {
    flex: 1;
    overflow: auto;
    display: flex;
    justify-content: center;
    padding: 2rem;
  }
</style>