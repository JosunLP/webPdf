<script lang="ts">
  import { PDFService, type PDFDocumentInfo, type PDFPage } from '$lib/services/pdfService';
  import { onMount } from 'svelte';
  
  export let pdfDocument: PDFDocumentInfo | null = null;
  export let currentPage: number = 1;
  export let onPageChange: (pageNumber: number) => void;
  
  let thumbnailsVisible = false;
  let isDragging = false;
  let draggedPage: number | null = null;
  let dragOverPage: number | null = null;
  let miniaturContainer: HTMLDivElement;
  
  // Miniaturansichten sichtbar/unsichtbar schalten
  function toggleThumbnails(): void {
    thumbnailsVisible = !thumbnailsVisible;
  }
  
  // Zur vorherigen Seite wechseln
  function goToPreviousPage(): void {
    if (pdfDocument && currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }
  
  // Zur nächsten Seite wechseln
  function goToNextPage(): void {
    if (pdfDocument && currentPage < pdfDocument.totalPages) {
      onPageChange(currentPage + 1);
    }
  }
  
  // Neue Seite hinzufügen
  function addNewPageAfterCurrent(): void {
    if (pdfDocument) {
      PDFService.addNewPage(currentPage);
    }
  }
  
  // Aktuelle Seite löschen
  function deleteCurrentPage(): void {
    if (pdfDocument && pdfDocument.totalPages > 1) {
      const confirmDelete = confirm(`Möchten Sie die Seite ${currentPage} wirklich löschen?`);
      if (confirmDelete) {
        PDFService.deletePage(currentPage);
        // Zur vorherigen Seite wechseln, wenn die letzte Seite gelöscht wurde
        if (currentPage > pdfDocument.totalPages - 1) {
          onPageChange(pdfDocument.totalPages - 1);
        }
      }
    } else if (pdfDocument) {
      alert('Das Dokument muss mindestens eine Seite enthalten.');
    }
  }
  
  // Zu einer bestimmten Seite gehen
  function goToPage(pageNumber: number): void {
    if (pageNumber >= 1 && pageNumber <= (pdfDocument?.totalPages || 1)) {
      onPageChange(pageNumber);
      // Automatisch die Miniaturansicht schließen auf kleinen Bildschirmen
      if (window.innerWidth < 768) {
        thumbnailsVisible = false;
      }
    }
  }
  
  // Drag-and-Drop-Funktionen für die Seitenverschiebung
  function handleDragStart(pageNumber: number): void {
    draggedPage = pageNumber;
    isDragging = true;
  }
  
  function handleDragOver(event: DragEvent, pageNumber: number): void {
    event.preventDefault();
    dragOverPage = pageNumber;
  }
  
  function handleDragEnd(): void {
    isDragging = false;
    draggedPage = null;
    dragOverPage = null;
  }
  
  function handleDrop(event: DragEvent, targetPageNumber: number): void {
    event.preventDefault();
    if (draggedPage && draggedPage !== targetPageNumber) {
      PDFService.movePage(draggedPage, targetPageNumber - 1);
      onPageChange(targetPageNumber);
    }
    handleDragEnd();
  }
</script>

<div class="page-manager">
  <div class="navigation-controls">
    <button 
      class="nav-button"
      on:click={goToPreviousPage}
      disabled={!pdfDocument || currentPage <= 1}
      title="Vorherige Seite"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="m3.86 8.753 5.482 4.796c.646.566 1.658.106 1.658-.753V3.204a1 1 0 0 0-1.659-.753l-5.48 4.796a1 1 0 0 0 0 1.506z"/>
      </svg>
    </button>
    
    <div class="page-indicator">
      <span>{currentPage} / {pdfDocument ? pdfDocument.totalPages : 1}</span>
      <button 
        class="thumbnail-toggle" 
        on:click={toggleThumbnails}
        title="Miniaturansichten anzeigen/ausblenden"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M.5 1a.5.5 0 0 0 0 1h1.11l.401 1.607 1.498 7.985A.5.5 0 0 0 4 12h1a2 2 0 1 0 0 4 2 2 0 0 0 0-4h7a2 2 0 1 0 0 4 2 2 0 0 0 0-4h1a.5.5 0 0 0 .491-.408l1.5-8A.5.5 0 0 0 14.5 3H2.89l-.405-1.621A.5.5 0 0 0 2 1H.5zM6 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm7 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 5.5V7h1.5a.5.5 0 0 1 0 1H9v1.5a.5.5 0 0 1-1 0V8H6.5a.5.5 0 0 1 0-1H8V5.5a.5.5 0 0 1 1 0z"/>
        </svg>
      </button>
    </div>
    
    <button 
      class="nav-button"
      on:click={goToNextPage}
      disabled={!pdfDocument || currentPage >= (pdfDocument?.totalPages || 1)}
      title="Nächste Seite"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="m12.14 8.753-5.482 4.796c-.646.566-1.658.106-1.658-.753V3.204a1 1 0 0 1 1.659-.753l5.48 4.796a1 1 0 0 1 0 1.506z"/>
      </svg>
    </button>
  </div>
  
  <div class="page-actions">
    <button 
      class="action-button add-page"
      on:click={addNewPageAfterCurrent}
      disabled={!pdfDocument}
      title="Neue Seite hinzufügen"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
      </svg>
      <span>Seite hinzufügen</span>
    </button>
    
    <button 
      class="action-button delete-page"
      on:click={deleteCurrentPage}
      disabled={!pdfDocument || (pdfDocument && pdfDocument.totalPages <= 1)}
      title="Aktuelle Seite löschen"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
      </svg>
      <span>Seite löschen</span>
    </button>
  </div>
  
  {#if thumbnailsVisible && pdfDocument}
    <div class="thumbnails-container" bind:this={miniaturContainer}>
      {#each pdfDocument.pages as page}
        <div 
          class="thumbnail"
          class:active={currentPage === page.pageNumber}
          class:dragging={isDragging}
          class:drag-over={dragOverPage === page.pageNumber}
          draggable={true}
          on:click={() => goToPage(page.pageNumber)}
          on:dragstart={() => handleDragStart(page.pageNumber)}
          on:dragover={(e) => handleDragOver(e, page.pageNumber)}
          on:dragleave={handleDragEnd}
          on:dragend={handleDragEnd}
          on:drop={(e) => handleDrop(e, page.pageNumber)}
        >
          <div class="thumbnail-page-number">{page.pageNumber}</div>
          {#if page.canvas}
            <img 
              src={page.canvas.toDataURL('image/png')} 
              alt={`Miniaturansicht der Seite ${page.pageNumber}`}
              class="thumbnail-image"
            />
          {:else}
            <div class="thumbnail-placeholder">
              <span>Seite {page.pageNumber}</span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
  .page-manager {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1rem;
    background-color: #f9fafb;
    padding: 1rem;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .navigation-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
  }
  
  .nav-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: white;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    padding: 0.5rem;
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
      width: 1rem;
      height: 1rem;
    }
  }
  
  .page-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #374151;
    
    .thumbnail-toggle {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      color: #4b5563;
      
      &:hover {
        color: #1f2937;
      }
      
      svg {
        width: 1.25rem;
        height: 1.25rem;
      }
    }
  }
  
  .page-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;
    
    .action-button {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      border-radius: 0.25rem;
      border: none;
      cursor: pointer;
      transition: background-color 0.2s;
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      svg {
        width: 1rem;
        height: 1rem;
      }
      
      &.add-page {
        background-color: #10b981;
        color: white;
        
        &:hover:not(:disabled) {
          background-color: #059669;
        }
      }
      
      &.delete-page {
        background-color: #ef4444;
        color: white;
        
        &:hover:not(:disabled) {
          background-color: #dc2626;
        }
      }
    }
  }
  
  .thumbnails-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
    max-height: 300px;
    overflow-y: auto;
    padding: 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.25rem;
    background-color: white;
  }
  
  .thumbnail {
    position: relative;
    border: 2px solid #e5e7eb;
    border-radius: 0.25rem;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
    aspect-ratio: 1 / 1.414; // A4 Verhältnis
    
    &:hover {
      border-color: #9ca3af;
      transform: translateY(-2px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    &.active {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
    }
    
    &.dragging {
      opacity: 0.7;
    }
    
    &.drag-over {
      background-color: rgba(59, 130, 246, 0.1);
      border-color: #3b82f6;
    }
    
    .thumbnail-page-number {
      position: absolute;
      top: 0;
      left: 0;
      background-color: rgba(0, 0, 0, 0.5);
      color: white;
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-bottom-right-radius: 0.25rem;
    }
    
    .thumbnail-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background-color: white;
    }
    
    .thumbnail-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f3f4f6;
      color: #6b7280;
      font-size: 0.75rem;
      text-align: center;
      padding: 0.5rem;
    }
  }
</style>