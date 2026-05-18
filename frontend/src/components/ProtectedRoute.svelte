<script lang="ts">
  import { navigate } from 'svelte-routing';
  import { onMount } from 'svelte';
  import { user, token, isAuthenticated, isTokenExpired, authActions } from '../stores/authStore';

  export let component;
  export let allowedRoles;

  let resolvedComponent = null;
  let loading = false;

  async function resolveComponent() {
    if (typeof component === 'function' && component.constructor.name === 'AsyncFunction') {
      loading = true;
      try {
        resolvedComponent = await component();
      } catch (e) {
        console.error('Failed to load component', e);
      } finally {
        loading = false;
      }
    } else {
      resolvedComponent = component;
    }
  }

  $: if (component) resolveComponent();

  onMount(() => {
    // Check if token doesn't exist or is expired
    if (!$token || isTokenExpired($token)) {
      authActions.logout();
      navigate('/login', { replace: true });
    } else if ($user && allowedRoles && !allowedRoles.includes($user.role)) {
      if ($user.role === 'siswa') {
        navigate('/exam-list', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  });
</script>

{#if $isAuthenticated && ($user && allowedRoles ? allowedRoles.includes($user.role) : true)}
  {#if loading}
    <div class="flex items-center justify-center min-h-[200px]">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  {:else if resolvedComponent}
    <svelte:component this={resolvedComponent} {...$$restProps} />
  {/if}
{/if}
