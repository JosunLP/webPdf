<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { PDFDocumentInfo, SearchResult } from '$lib/services/pdfService';
  import { PDFService } from '$lib/services/pdfService';
  import PDFPage from './PDFPage.svelte';
  import PageManager from './pageManagement/PageManager.svelte';
  
  export let document: PDFDocumentInfo;
  
  let currentPage = 1;
  let scale = 1.0;
  let viewMode: 'single' | 'multiple' = 'single';
  let pagesToShow = document?.pages || [];
  
  // Suchvariablen
  let showSearchBox = false;
  let searchTerm = '';
  let searchResults: SearchResult[] = [];
  let currentSearchIndex = 0;
  
  // Navigation zwischen den Seiten
  function nextPage() {
    if (viewMode === 'multiple') return;
    if (currentPage < document.totalPages) {
      currentPage++;
      updateVisiblePages();
    }
  }
  
  function prevPage() {
    if (viewMode === 'multiple') return;
    if (currentPage > 1) {
      currentPage--;
      updateVisiblePages();
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
  
  // Anzeigemodus umschalten
  function toggleViewMode() {
    viewMode = viewMode === 'single' ? 'multiple' : 'single';
    updateVisiblePages();
  }
  
  // Sichtbare Seiten aktualisieren
  function updateVisiblePages() {
    if (viewMode === 'single') {
      pagesToShow = [document.pages[currentPage - 1]];
    } else {
      pagesToShow = [...document.pages];
    }
  }
  
  // Suchbox umschalten
  function toggleSearchBox() {
    showSearchBox = !showSearchBox;
    if (!showSearchBox) {
      searchTerm = '';
      searchResults = [];
    }
  }
  
  // Suche durchführen
  function performSearch() {
    if (searchTerm.trim()) {
      searchResults = PDFService.searchText(searchTerm);
      currentSearchIndex = 0;
      
      // Zu erstem Ergebnis navigieren, falls vorhanden
      if (searchResults.length > 0) {
        navigateToSearchResult(0);
      }
    } else {
      searchResults = [];
    }
  }
  
  // Zum nächsten Suchergebnis navigieren
  function nextSearchResult() {
    if (searchResults.length === 0) return;
    
    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    navigateToSearchResult(currentSearchIndex);
  }
  
  // Zum vorherigen Suchergebnis navigieren
  function prevSearchResult() {
    if (searchResults.length === 0) return;
    
    currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    navigateToSearchResult(currentSearchIndex);
  }
  
  // Zu spezifischem Suchergebnis navigieren
  function navigateToSearchResult(index: number) {
    const result = searchResults[index];
    if (result) {
      // In Einzelseitenansicht wechseln, wenn wir im Mehrseiten-Modus sind
      if (viewMode === 'multiple') {
        viewMode = 'single';
      }
      
      // Zur Seite navigieren, die das Ergebnis enthält
      currentPage = result.pageNumber;
      updateVisiblePages();
      
      // Ergebnis hervorheben (wird in anderen Komponenten implementiert)
      // Dieser Teil kann später mit einem Event-System implementiert werden
    }
  }
  
  // Tastatur-Navigation
  function handleKeydown(event: KeyboardEvent) {
    if (viewMode === 'single') {
      if (event.key === 'ArrowRight' || event.key === ' ') {
        nextPage();
      } else if (event.key === 'ArrowLeft') {
        prevPage();
      }
    }
    
    if (event.key === '+') {
      zoomIn();
    } else if (event.key === '-') {
      zoomOut();
    } else if (event.key === '0') {
      resetZoom();
    }
    
    // Suche mit Strg+F öffnen
    if (event.key === 'f' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      toggleSearchBox();
    }
    
    // Enter-Taste zum Suchen verwenden
    if (event.key === 'Enter' && showSearchBox) {
      performSearch();
    }
    
    // Escape-Taste, um die Suche zu schließen
    if (event.key === 'Escape' && showSearchBox) {
      toggleSearchBox();
    }
  }
  
  // Beobachter für Änderungen am Suchbegriff
  $: if (searchTerm === '') {
    searchResults = [];
  }
  
  // Beobachter für Änderungen an der Dokumentanzahl
  $: if (document) {
    updateVisiblePages();
  }
  
  let keydownHandler: ((e: KeyboardEvent) => void) | undefined;
  
  onMount(() => {
    // Sicherstellen, dass wir nur im Browser sind, bevor wir Event-Listener hinzufügen
    if (typeof window !== 'undefined') {
      keydownHandler = (e) => handleKeydown(e);
      window.addEventListener('keydown', keydownHandler);
      updateVisiblePages();
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
      <button 
        class="nav-button" 
        on:click={prevPage} 
        disabled={viewMode === 'multiple' || currentPage <= 1}
        title="Vorherige Seite"
      >
        <span>&#9664;</span>
      </button>
      
      <span class="page-info">
        {#if viewMode === 'single'}
          Seite {currentPage} von {document.totalPages}
        {:else}
          Alle {document.totalPages} Seiten
        {/if}
      </span>
      
      <button 
        class="nav-button" 
        on:click={nextPage} 
        disabled={viewMode === 'multiple' || currentPage >= document.totalPages}
        title="Nächste Seite"
      >
        <span>&#9654;</span>
      </button>
    </div>
    
    <div class="view-mode">
      <button 
        class="view-mode-button"
        class:active={viewMode === 'single'}
        on:click={() => viewMode === 'multiple' && toggleViewMode()}
        title="Einzelseiten-Ansicht"
        aria-label="Einzelseiten-Ansicht"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z" />
        </svg>
      </button>
      <button 
        class="view-mode-button"
        class:active={viewMode === 'multiple'}
        on:click={() => viewMode === 'single' && toggleViewMode()}
        title="Mehrseiten-Ansicht"
        aria-label="Mehrseiten-Ansicht"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      </button>
    </div>
      <button 
        class="toolbar-button" 
        on:click={toggleSearchBox} 
        title="Suchen (Strg+F)"
        class:active={showSearchBox}
        aria-label="Suchen (Strg+F)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
    
    <div class="zoom-controls">
      <button class="zoom-button" on:click={zoomOut} title="Verkleinern">-</button>
      <span class="zoom-level">{Math.round(scale * 100)}%</span>
      <button class="zoom-button" on:click={zoomIn} title="Vergrößern">+</button>
      <button class="zoom-button" on:click={resetZoom} title="Zurücksetzen">100%</button>
    </div>
  </div>
  
  {#if showSearchBox}
    <div class="search-box">
      <div class="search-input-wrapper">
        <input
          type="text"
          bind:value={searchTerm}
          placeholder="Suchbegriff eingeben..."
          on:keydown={(e) => e.key === 'Enter' && performSearch()}
        />
        <button class="search-button" on:click={performSearch}>Suchen</button>
        <button class="close-button" on:click={toggleSearchBox}>×</button>
      </div>
      
      {#if searchResults.length > 0}
        <div class="search-results">
          <span class="result-counter">
            {currentSearchIndex + 1} von {searchResults.length} Ergebnissen
          </span>
          <div class="result-navigation">
            <button class="nav-button" on:click={prevSearchResult} title="Vorheriges Ergebnis">
              <span>&#9650;</span>
            </button>
            <button class="nav-button" on:click={nextSearchResult} title="Nächstes Ergebnis">
              <span>&#9660;</span>
            </button>
          </div>
        </div>
      {:else if searchTerm && searchResults.length === 0}
        <div class="no-results">
          Keine Ergebnisse gefunden für "{searchTerm}"
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Seitenverwaltung -->
  <PageManager 
    pdfDocument={document} 
    currentPage={currentPage} 
    onPageChange={(pageNumber) => {
      currentPage = pageNumber;
      updateVisiblePages();
    }}
  />
  
  <div class="document-container" class:multiple-pages={viewMode === 'multiple'}>
    {#each pagesToShow as page}
      <PDFPage 
        {page} 
        {scale} 
        highlight={showSearchBox && searchResults.length > 0 && page.pageNumber === searchResults[currentSearchIndex]?.pageNumber ? 
          {
            index: searchResults[currentSearchIndex].matchIndex,
            length: searchResults[currentSearchIndex].matchLength
          } : null
        }
      />
    {/each}
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
    
    .view-mode {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      
      .view-mode-button {
        background: none;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        padding: 0.25rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        
        &:hover:not(:disabled) {
          background-color: #f3f4f6;
        }
        
        &.active {
          background-color: #e5e7eb;
          border-color: #9ca3af;
        }
        
        svg {
          color: #4b5563;
        }
      }
    }
    
    .toolbar-button {
      background: none;
      border: 1px solid #d1d5db;
      border-radius: 0.25rem;
      padding: 0.25rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      
      &:hover {
        background-color: #f3f4f6;
      }
      
      &.active {
        background-color: #e5e7eb;
        border-color: #9ca3af;
      }
      
      svg {
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
  
  .search-box {
    padding: 0.5rem 1rem;
    background-color: #fff;
    border-bottom: 1px solid #e5e7eb;
    
    .search-input-wrapper {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      
      input {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        
        &:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
        }
      }
      
      .search-button {
        background-color: #3b82f6;
        color: white;
        border: none;
        border-radius: 0.25rem;
        padding: 0.5rem 1rem;
        cursor: pointer;
        font-size: 0.875rem;
        
        &:hover {
          background-color: #2563eb;
        }
      }
      
      .close-button {
        background: none;
        border: none;
        font-size: 1.5rem;
        color: #6b7280;
        cursor: pointer;
        padding: 0 0.25rem;
        
        &:hover {
          color: #374151;
        }
      }
    }
    
    .search-results {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid #f3f4f6;
      
      .result-counter {
        font-size: 0.75rem;
        color: #4b5563;
      }
      
      .result-navigation {
        display: flex;
        gap: 0.25rem;
        
        .nav-button {
          background: none;
          border: 1px solid #d1d5db;
          border-radius: 0.25rem;
          padding: 0.125rem 0.25rem;
          cursor: pointer;
          
          &:hover {
            background-color: #f3f4f6;
          }
          
          span {
            font-size: 0.75rem;
          }
        }
      }
    }
    
    .no-results {
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid #f3f4f6;
      font-size: 0.75rem;
      color: #ef4444;
    }
  }
  
  .document-container {
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    
    &.multiple-pages {
      align-items: center;
    }
  }
</style>