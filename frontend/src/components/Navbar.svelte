<script lang="ts">
  import { Link } from 'svelte-routing';
  import { user, token, authActions } from '../stores/authStore';

  let showMenu = false;
  let showUserMenu = false;

  // Toggle mobile menu
  function toggleMenu() {
    showMenu = !showMenu;
  }

  // Toggle user menu
  function toggleUserMenu() {
    showUserMenu = !showUserMenu;
  }

  // Handle logout
  function handleLogout() {
    authActions.logout();
  }
</script>

<nav class="main-nav bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-200">
  <div class="container mx-auto px-4">
    <div class="flex justify-between items-center h-18 py-3">
      <Link to="/login" class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Ujian Online</Link>

      <!-- Desktop Navigation -->
      <div class="hidden md:flex items-center space-x-1">
        {#if $token && $user}
          <div class="relative">
            <button on:click={toggleUserMenu} class="px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 font-medium">
              {$user.nama}
            </button>
            {#if showUserMenu}
              <div class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20">
                {#if $user.role === 'admin' || $user.role === 'guru'}
                  <Link to="/dashboard" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" on:click={() => showUserMenu = false}>Dashboard</Link>
                {:else if $user.role === 'siswa'}
                  <Link to="/exam-list" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" on:click={() => showUserMenu = false}>Daftar Ujian</Link>
                {/if}
                <button on:click={handleLogout} class="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  Logout
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <Link to="/login" class="px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200 font-medium">Login</Link>
        {/if}
      </div>

      <!-- Mobile menu button -->
      <div class="md:hidden">
        <button on:click={toggleMenu} class="text-gray-700 focus:outline-none p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Toggle mobile menu" aria-expanded={showMenu}>
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {#if showMenu}
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            {:else}
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            {/if}
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile Navigation -->
    {#if showMenu}
      <div class="md:hidden py-4 border-t border-gray-200">
        {#if $token && $user}
          {#if $user.role === 'admin' || $user.role === 'guru'}
            <Link to="/dashboard" class="block py-3 px-4 text-gray-700 hover:bg-gray-100 transition-all duration-200 font-medium" on:click={() => showMenu = false}>Dashboard</Link>
          {:else if $user.role === 'siswa'}
            <Link to="/exam-list" class="block py-3 px-4 text-gray-700 hover:bg-gray-100 transition-all duration-200 font-medium" on:click={() => showMenu = false}>Daftar Ujian</Link>
          {/if}
          <button on:click={handleLogout} class="w-full mt-1 text-left px-4 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg hover:from-red-600 hover:to-orange-600 transition-all duration-300 font-medium">
            Logout
          </button>
        {:else}
          <Link to="/login" class="block py-3 px-4 text-gray-700 hover:bg-gray-100 transition-all duration-200 font-medium" on:click={() => showMenu = false}>Login</Link>
        {/if}
      </div>
    {/if}
  </div>
</nav>