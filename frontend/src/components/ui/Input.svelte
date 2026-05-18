<script lang="ts">
  export let label = '';
  export let id = '';
  export let name = '';
  export let type = 'text';
  export let value = '';
  export let placeholder = '';
  export let error = '';
  export let required = false;
  export let disabled = false;
  export let className = '';

  const inputStyles = 'block w-full px-4 py-2.5 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 outline-none disabled:bg-gray-50 disabled:text-gray-500';
  const errorStyles = 'border-red-500 focus:ring-red-500 focus:border-red-500';
</script>

<div class={className}>
  {#if label}
    <label for={id} class="block text-sm font-medium text-gray-700 mb-1.5">
      {label}
      {#if required}<span class="text-red-500 ml-0.5">*</span>{/if}
    </label>
  {/if}

  {#if type === 'password'}
    <input
      {id}
      {name}
      type="password"
      bind:value
      {placeholder}
      {required}
      {disabled}
      class="{inputStyles} {error ? errorStyles : ''}"
      on:input
      on:focus
      on:blur
      {...$$restProps}
    />
  {:else if type === 'email'}
    <input
      {id}
      {name}
      type="email"
      bind:value
      {placeholder}
      {required}
      {disabled}
      class="{inputStyles} {error ? errorStyles : ''}"
      on:input
      on:focus
      on:blur
      {...$$restProps}
    />
  {:else if type === 'number'}
    <input
      {id}
      {name}
      type="number"
      bind:value
      {placeholder}
      {required}
      {disabled}
      class="{inputStyles} {error ? errorStyles : ''}"
      on:input
      on:focus
      on:blur
      {...$$restProps}
    />
  {:else if type === 'date'}
    <input
      {id}
      {name}
      type="date"
      bind:value
      {placeholder}
      {required}
      {disabled}
      class="{inputStyles} {error ? errorStyles : ''}"
      on:input
      on:focus
      on:blur
      {...$$restProps}
    />
  {:else}
    <input
      {id}
      {name}
      type="text"
      bind:value
      {placeholder}
      {required}
      {disabled}
      class="{inputStyles} {error ? errorStyles : ''}"
      on:input
      on:focus
      on:blur
      {...$$restProps}
    />
  {/if}

  {#if error}
    <p class="mt-1.5 text-sm text-red-600">{error}</p>
  {/if}
</div>
