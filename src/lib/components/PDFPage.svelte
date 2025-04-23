<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { PDFService } from '$lib/services/pdfService';
  import type { PDFPage } from '$lib/services/pdfService';
  
  export let page: PDFPage;
  export let scale: number = 1.0;
  
  let editable = false;
  let textContent = page.textContent;
  let container: HTMLDivElement;
  
  // Einstellung für die Bearbeitbarkeit umschalten
  function toggleEdit() {
    if (!browser) return;
    editable = !editable;
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
  
  $: scaledWidth = page.width * scale;
  $: scaledHeight = page.height * scale;
</script>

<div class="pdf-page-container">
  <div 
    class="pdf-page"
    bind:this={container}
    style="width: {scaledWidth}px; height: {scaledHeight}px;"
  >
    <!-- Canvas-Anzeige der Seite -->
    {#if page.canvas && browser}
      <canvas 
        width={page.canvas.width} 
        height={page.canvas.height}
        style="width: {scaledWidth}px; height: {scaledHeight}px;"
        class:hidden={editable}
      >
        <img 
          src={page.canvas.toDataURL('image/png')} 
          alt={`Page ${page.pageNumber}`} 
          style="width: {scaledWidth}px; height: {scaledHeight}px;"
        />
      </canvas>
    {/if}
    
    <!-- Editierbarer Textbereich -->
    {#if editable && browser}
      <div class="text-editor">
        <textarea
          bind:value={textContent}
          style="width: {scaledWidth}px; height: {scaledHeight}px;"
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
  
  .hidden {
    display: none;
  }
  
  .overlay-actions {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    opacity: 0;
    transition: opacity 0.2s;
    
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
    
    textarea {
      padding: 1rem;
      font-family: Arial, sans-serif;
      font-size: 1rem;
      line-height: 1.5;
      border: 2px solid #3b82f6;
      resize: none;
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