<script lang="ts">
  import { useLocation } from 'svelte-routing';
  import { updatePath } from '../stores/routeStore';

  const location = useLocation();
  $: updatePath($location.pathname);
</script>

<slot />
