<script lang="ts">
  export let className = '';
  export let padding = 'p-6';
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden {className}">
  {#if $$slots.header}
    <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
      <slot name="header" />
    </div>
  {/if}
  <div class={padding}>
    <slot />
  </div>
  {#if $$slots.footer}
    <div class="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
      <slot name="footer" />
    </div>
  {/if}
</div>
