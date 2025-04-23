<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { currentPdfDocument, type PDFDocumentInfo, PDFService } from '$lib/services/pdfService';
  import PDFViewer from './PDFViewer.svelte';
  import PDFToolbar from './PDFToolbar.svelte';
  
  let pdfDocument: PDFDocumentInfo | null = null;
  let fileInput: HTMLInputElement;
  
  // Speichern Sie das Abonnement, um es später aufzuräumen
  const unsubscribe = browser ? currentPdfDocument.subscribe(value => {
    pdfDocument = value;
  }) : () => {};
  
  onDestroy(() => {
    // Abmelden beim Zerstören der Komponente
    unsubscribe();
  });
  
  // Datei-Handler
  async function handleFileSelect(event: Event) {
    if (!browser) return;
    
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    try {
      await PDFService.loadPdfFromFile(input.files[0]);
    } catch (error) {
      console.error('Fehler beim Laden der PDF-Datei:', error);
      alert('Die PDF-Datei konnte nicht geladen werden. Bitte versuchen Sie es mit einer anderen Datei.');
    }
    
    // Zurücksetzen des Datei-Inputs für erneutes Auswählen der gleichen Datei
    input.value = '';
  }
  
  // Neues PDF erstellen
  async function createNewPdf() {
    if (!browser) return;
    
    try {
      await PDFService.createNewPdf();
    } catch (error) {
      console.error('Fehler beim Erstellen eines neuen PDF-Dokuments:', error);
      alert('Es konnte kein neues PDF-Dokument erstellt werden.');
    }
  }
  
  // PDF speichern
  async function savePdf() {
    if (!browser || !pdfDocument) return;
    
    try {
      const pdfBlob = await PDFService.savePdf(pdfDocument);
      const url = URL.createObjectURL(pdfBlob);
      
      // Erstellen eines Download-Links und Klicken
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfDocument.fileName || 'dokument.pdf';
      a.click();
      
      // Aufräumen des Objekt-URLs
      URL.revokeObjectURL(url);
      
      // Markieren als nicht mehr modifiziert
      currentPdfDocument.update(doc => {
        if (!doc) return null;
        return { ...doc, modified: false };
      });
    } catch (error) {
      console.error('Fehler beim Speichern des PDF-Dokuments:', error);
      alert('Das PDF-Dokument konnte nicht gespeichert werden.');
    }
  }
</script>

<div class="pdf-editor">
  {#if browser}
    <input
      type="file"
      accept="application/pdf"
      on:change={handleFileSelect}
      bind:this={fileInput}
      class="hidden-input"
    />
    
    <PDFToolbar 
      {pdfDocument} 
      onFileOpen={() => fileInput?.click()} 
      onNewFile={createNewPdf} 
      onSaveFile={savePdf} 
    />
    
    <div class="editor-container">
      {#if pdfDocument}
        <PDFViewer document={pdfDocument} />
      {:else}
        <div class="empty-state">
          <h2>Kein Dokument geöffnet</h2>
          <p>Bitte öffnen Sie ein PDF-Dokument oder erstellen Sie ein neues Dokument.</p>
          <div class="empty-actions">
            <button class="btn primary" on:click={() => fileInput?.click()}>PDF öffnen</button>
            <button class="btn secondary" on:click={createNewPdf}>Neues Dokument</button>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="loading">Lädt PDF-Editor...</div>
  {/if}
</div>

<style lang="scss">
  .pdf-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }
  
  .hidden-input {
    display: none;
  }
  
  .editor-container {
    flex: 1;
    overflow: auto;
    background-color: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .empty-state {
    text-align: center;
    padding: 2rem;
    max-width: 500px;
    
    h2 {
      margin-bottom: 1rem;
      font-size: 1.5rem;
      font-weight: 600;
    }
    
    p {
      margin-bottom: 2rem;
      color: #666;
    }
    
    .empty-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      
      .btn {
        padding: 0.75rem 1.5rem;
        border-radius: 0.25rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
        
        &.primary {
          background-color: #3b82f6;
          color: white;
          
          &:hover {
            background-color: #2563eb;
          }
        }
        
        &.secondary {
          background-color: #e5e7eb;
          color: #374151;
          
          &:hover {
            background-color: #d1d5db;
          }
        }
      }
    }
  }
  
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    font-size: 1.2rem;
    color: #666;
  }
</style>