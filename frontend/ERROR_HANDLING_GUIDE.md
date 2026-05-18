# Error Handling in Svelte 4

Since Svelte 4 doesn't have built-in error boundaries like React, we use a different approach.

## Approach Used: Global Error Handler + Manual Error States

### Files Created:
1. `frontend/src/utils/errorHandler.js` - Global error handling utilities
2. `frontend/src/components/ErrorBoundary.svelte` - Reusable error display component

### How to Use ErrorBoundary Component:

```svelte
<script>
  import ErrorBoundary from '../components/ErrorBoundary.svelte';
  
  let hasError = false;
  let error = null;
  
  async function loadData() {
    try {
      // Your async code here
    } catch (err) {
      hasError = true;
      error = err;
    }
  }
  
  function handleReset() {
    hasError = false;
    error = null;
    loadData();
  }
</script>

<ErrorBoundary 
  hasError={hasError} 
  {error} 
  fallbackMessage="Gagal memuat data"
  onReset={handleReset}
>
  <!-- Your normal content here -->
  <div>...</div>
</ErrorBoundary>
```

### Global Error Handling:

The `errorHandler.js` automatically:
- Catches unhandled promise rejections
- Catches window errors
- Logs errors with context
- Prevents duplicate fatal error screens

### Best Practices:

1. **Wrap data loading in try/catch** at the page level
2. **Use ErrorBoundary component** to display errors gracefully
3. **Provide reset/retry buttons** for user recovery
4. **Log errors** using `logError()` for debugging
5. **Don't show technical errors** to users - use friendly messages

### Example: Page with Error Handling

```svelte
<script>
  import { onMount } from 'svelte';
  import ErrorBoundary from '../components/ErrorBoundary.svelte';
  import LoadingSpinner from '../components/LoadingSpinner.svelte';
  
  let loading = true;
  let hasError = false;
  let error = null;
  let data = [];
  
  onMount(async () => {
    try {
      loading = true;
      data = await fetchWithAuth('/api/data');
    } catch (err) {
      hasError = true;
      error = err;
    } finally {
      loading = false;
    }
  });
  
  function handleRetry() {
    hasError = false;
    error = null;
    loading = true;
    
    fetchWithAuth('/api/data')
      .then(result => {
        data = result;
        loading = false;
      })
      .catch(err => {
        hasError = true;
        error = err;
        loading = false;
      });
  }
</script>

{#if loading}
  <LoadingSpinner message="Memuat data..." />
{:else if hasError}
  <ErrorBoundary 
    hasError={true} 
    error={error}
    fallbackMessage="Gagal memuat data"
    onReset={handleRetry}
  />
{:else}
  <!-- Render data here -->
  <div>...</div>
{/if}
```
