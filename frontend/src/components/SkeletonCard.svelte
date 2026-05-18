<script>
  export let lines = 3;
</script>

<div class="animate-pulse bg-white rounded-lg shadow p-6">
  <div class="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
  {#each Array(lines) as _, i}
    <div class="h-3 bg-gray-200 rounded mb-2" style="width: {100 - (i * 10)}%"></div>
  {/each}
</div>
