<script lang="ts">
  import Navbar from '../components/Navbar.svelte';
  import Footer from '../components/Footer.svelte';
  import { authActions } from '../stores/authStore';

  // Handle logout
  function handleLogout() {
    authActions.logout();
  }
</script>

<div class="flex flex-col min-h-screen bg-gray-50">
  <Navbar />
  <main class="flex-grow">
    <slot />
  </main>
  <Footer />
</div>
