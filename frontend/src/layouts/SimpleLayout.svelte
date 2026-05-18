<script lang="ts">
  import { Link } from 'svelte-routing';
  import { token, authActions } from '../stores/authStore';
  import { onMount } from 'svelte';
  import Modal from '../components/Modal.svelte';
  import { navigateTo } from '../stores/routeStore';
  
  let showConfirmModal = false;
  let mobileMenuOpen = false;

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }
  
  // Handle logout
  function handleLogout() {
    showConfirmModal = true;
  }

  function confirmLogout() {
    authActions.logout();
    showConfirmModal = false;
    navigateTo('/login');
  }

  // Remove admin-layout class when student pages load
  onMount(() => {
    document.body.classList.remove('admin-layout');
  });
</script>

<div class="flex flex-col min-h-screen bg-gray-50">
  <!-- Header -->
  <header class="bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-200">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center h-16">
        <Link to="/exam-list" class="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent whitespace-nowrap">Ujian Online</Link>

        <!-- Desktop Navigation -->
        <div class="hidden md:flex items-center space-x-1">
          {#if $token}
            <Link to="/exam-list" class="px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 font-medium text-sm">Daftar Ujian</Link>
            <Link to="/hasil" class="px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 font-medium text-sm">Lihat Hasil</Link>
            <button on:click={handleLogout} class="ml-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg hover:from-red-600 hover:to-orange-600 transition-all duration-300 font-medium text-sm shadow-md hover:shadow-lg">
              Logout
            </button>
          {/if}
        </div>

        <!-- Mobile menu button -->
        <div class="md:hidden">
          <button on:click={toggleMobileMenu} class="text-gray-700 focus:outline-none p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Toggle mobile menu">
            {#if mobileMenuOpen}
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            {:else}
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            {/if}
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile menu dropdown -->
    {#if mobileMenuOpen && $token}
      <div class="md:hidden border-t border-gray-200 bg-white shadow-lg">
        <div class="px-4 py-3 space-y-1">
          <Link to="/exam-list" on:click={closeMobileMenu} class="block px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 font-medium text-sm">Daftar Ujian</Link>
          <Link to="/hasil" on:click={closeMobileMenu} class="block px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 font-medium text-sm">Lihat Hasil</Link>
          <button on:click={() => { closeMobileMenu(); handleLogout(); }} class="w-full text-left px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all duration-200 font-medium text-sm">
            Logout
          </button>
        </div>
      </div>
    {/if}
  </header>

  <!-- Main content -->
  <main class="flex-grow">
  <slot />
  </main>

  <Modal show={showConfirmModal} title="Konfirmasi Logout" onClose={() => showConfirmModal = false}>
  <p class="text-gray-700">Apakah Anda yakin ingin keluar dari sistem?</p>
  <svelte:fragment slot="footer">
  <div class="flex justify-end space-x-3">
  <button on:click={() => showConfirmModal = false} class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Batal</button>
  <button on:click={confirmLogout} class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Logout</button>
  </div>
  </svelte:fragment>
  </Modal>
  </div>
