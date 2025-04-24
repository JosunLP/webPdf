<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { PDFService, type Comment, type Point } from '$lib/services/pdfService';
  import { browser } from '$app/environment';
  
  export let comment: Comment;
  export let scale: number = 1.0;
  
  // Event-Dispatcher für Bearbeiten und Löschen
  const dispatch = createEventDispatcher<{
    editComment: string;
    deleteComment: string;
  }>();
  
  let isOpen = false;
  let markerElement: HTMLButtonElement;
  let popupElement: HTMLDivElement;
  
  // Skalierte Position berechnen
  $: scaledPosition = {
    x: comment.position.x * scale,
    y: comment.position.y * scale
  };
  
  // Formatiertes Datum für die Anzeige
  $: formattedDate = formatDate(comment.createdAt);
  
  // Datum formatieren
  function formatDate(date: Date): string {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  // Kommentar-Popup umschalten
  function togglePopup(): void {
    isOpen = !isOpen;
  }
  
  // Kommentarbearbeitung aufrufen
  function handleEdit(): void {
    dispatch('editComment', comment.id);
    isOpen = false;
  }
  
  // Löschbestätigung anzeigen und Kommentar löschen
  function handleDelete(): void {
    const confirmDelete = confirm('Möchten Sie diesen Kommentar wirklich löschen?');
    if (confirmDelete) {
      dispatch('deleteComment', comment.id);
    }
    isOpen = false;
  }
  
  // Klick außerhalb des Popups erkennen und Popup schließen
  function handleClickOutside(event: MouseEvent): void {
    if (
      browser && 
      isOpen && 
      markerElement && 
      popupElement && 
      !markerElement.contains(event.target as Node) &&
      !popupElement.contains(event.target as Node)
    ) {
      isOpen = false;
    }
  }
  
  // Event-Listener für Klick außerhalb hinzufügen/entfernen
  $: if (browser && isOpen) {
    document.addEventListener('mousedown', handleClickOutside);
  } else if (browser) {
    document.removeEventListener('mousedown', handleClickOutside);
  }
  
  // Aufräumen beim Zerstören der Komponente
  onMount(() => {
    return () => {
      if (browser) {
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };
  });
</script>

<button 
  class="comment-marker"
  style="left: {scaledPosition.x}px; top: {scaledPosition.y}px;"
  bind:this={markerElement}
  on:click={togglePopup}
  type="button"
  aria-label="Kommentar anzeigen"
>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
  </svg>
</button>

{#if isOpen}
  <div 
    class="comment-popup"
    style="left: {scaledPosition.x + 20}px; top: {scaledPosition.y}px;"
    bind:this={popupElement}
  >
    <div class="comment-header">
      <div class="author">{comment.author}</div>
      <div class="date">{formattedDate}</div>
    </div>
    
    <div class="comment-body">
      {comment.text}
    </div>
    
    <div class="comment-actions">
      <button class="edit-button" on:click={handleEdit}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
        Bearbeiten
      </button>
      <button class="delete-button" on:click={handleDelete}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        Löschen
      </button>
    </div>
  </div>
{/if}
<style lang="scss">
  .comment-marker {
    position: absolute;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: #FFEB3B;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 30;
    color: #333;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transform: translate(-50%, -50%);
    transition: transform 0.1s ease;
    padding: 0;
    border: none;
    transform: translate(-50%, -50%);
    transition: transform 0.1s ease;
    
    &:hover {
      transform: translate(-50%, -50%) scale(1.1);
    }
    
    svg {
      width: 18px;
      height: 18px;
    }
  }
  
  .comment-popup {
    position: absolute;
    width: 280px;
    background-color: white;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 8px;
    z-index: 50;
    
    .comment-header {
      display: flex;
      justify-content: space-between;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
      
      .author {
        font-weight: 600;
        color: #333;
      }
      
      .date {
        font-size: 0.8rem;
        color: #666;
      }
    }
    
    .comment-body {
      padding: 8px 0;
      margin: 8px 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 0.9rem;
      line-height: 1.4;
    }
    
    .comment-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      
      button {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        font-size: 0.8rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        
        svg {
          fill: currentColor;
        }
        
        &.edit-button {
          background-color: #e5e7eb;
          color: #1f2937;
          
          &:hover {
            background-color: #d1d5db;
          }
        }
        
        &.delete-button {
          background-color: #fee2e2;
          color: #b91c1c;
          
          &:hover {
            background-color: #fecaca;
          }
        }
      }
    }
  }
</style>