<script>
  import { logError } from '../utils/errorHandler.js';
  
  export let fallbackMessage = 'Terjadi kesalahan pada halaman ini';
  
  // Note: Svelte 4 doesn't have built-in error boundaries
  // This component provides graceful degradation through manual error handling
  // Use try/catch in parent components and pass errors here
  export let hasError = false;
  export let error = null;
  export let onReset = null;
  
  function handleReload() {
    window.location.reload();
  }
  
  function handleGoHome() {
    window.location.href = '/';
  }
  
  function handleReset() {
    if (onReset) {
      onReset();
    }
  }
</script>

{#if hasError}
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
    <div class="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
      <div class="text-center">
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
          <svg class="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h2 class="text-xl font-bold text-gray-900 mb-2">Oops! Terjadi Kesalahan</h2>
        <p class="text-gray-600 mb-6">{fallbackMessage}</p>
        
        {#if error && error.message}
          <details class="text-left bg-gray-100 rounded p-3 mb-4 text-sm">
            <summary class="cursor-pointer font-medium text-gray-700">Detail Error (klik untuk melihat)</summary>
            <pre class="mt-2 text-red-600 overflow-x-auto text-xs">{error.message}</pre>
          </details>
        {/if}
        
        <div class="flex gap-3 justify-center">
          <button
            on:click={handleGoHome}
            class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Kembali ke Beranda
          </button>
          <button
            on:click={handleReload}
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Muat Ulang Halaman
          </button>
          {#if onReset}
            <button
              on:click={handleReset}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Coba Lagi
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{:else}
  <slot />
{/if}
