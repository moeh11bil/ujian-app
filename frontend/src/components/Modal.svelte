<script>
  export let show = false;
  export let title = '';
  export let onClose;
  export let size = 'md'; // sm, md, lg, xl
  
  // Size classes
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg', 
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };
  
  // Handle Escape key
  function handleKeydown(e) {
    if (e.key === 'Escape' && onClose) {
      onClose();
    }
  }
  
  // Add event listener when modal opens
  $: if (show) {
    document.addEventListener('keydown', handleKeydown);
  }
  
  // Remove event listener when modal closes
  $: if (!show) {
    document.removeEventListener('keydown', handleKeydown);
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class={`${sizes[size]} bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-hidden flex flex-col`}>
      <div class="p-6 border-b border-gray-200">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-semibold text-gray-800">{title}</h3>
          {#if onClose}
            <button
              on:click={onClose}
              class="text-gray-500 hover:text-gray-700"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          {/if}
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-6">
        <slot></slot>
      </div>

      {#if $$slots.footer}
        <div class="p-6 border-t border-gray-200">
          <slot name="footer"></slot>
        </div>
      {/if}
    </div>
  </div>
{/if}