<script lang="ts">
  import { navigate } from 'svelte-routing';
  import { onMount } from 'svelte';
  import NotificationBell from '../components/NotificationBell.svelte';
  import { user, token, authActions } from '../stores/authStore';
  import { currentPath, updatePath } from '../stores/routeStore';

  let sidebarOpen = false;
  let sidebarCollapsed = false;
  
  // Track which menu groups are expanded
  let expandedGroups = {
    utama: true,
    manajemen: false,
    ujian: false,
    penilaian: false
  };

  // Toggle sidebar on mobile
  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  // Toggle sidebar collapse
  function toggleSidebarCollapse() {
    sidebarCollapsed = !sidebarCollapsed;
  }

  // Toggle menu group expansion
  function toggleGroup(group: keyof typeof expandedGroups) {
    expandedGroups = { ...expandedGroups, [group]: !expandedGroups[group] };
  }

  function handleNavigate(to: string) {
    sidebarOpen = false;
    navigate(to);
    updatePath(to);
  }

  // Reaktif agar selalu mengikuti perubahan rute
  $: path = $currentPath;

  // Check if current path matches a route
  function isActive(paths: string | string[]) {
    const cp = path;
    return Array.isArray(paths) ? paths.some(p => cp === p || cp.startsWith(p + '/')) : cp === paths;
  }

  // Handle logout
  function handleLogout() {
    authActions.logout();
    navigate('/login?logout=1', { replace: true });
  }

  // Check if current route is student route (should not show admin sidebar)
  $: isStudentRoute = path.startsWith('/exam') || path.startsWith('/hasil') || path === '/exam-list';

  let appVersion = '';
  let updateBehind = 0;

  async function checkUpdate() {
    try {
      const res = await fetch('/api/update/info', {
        headers: $token ? { Authorization: `Bearer ${$token}` } : {}
      });
      const json = await res.json();
      if (json.success) {
        appVersion = json.data.version;
        updateBehind = json.data.behind || 0;
      }
    } catch (e) {}
  }

  onMount(() => {
    checkUpdate();
    const interval = setInterval(checkUpdate, 120000);
    return () => clearInterval(interval);
  });

  // Close sidebar when clicking outside (on larger screens)
  onMount(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      const menuButton = document.getElementById('menu-button');
      
      if (sidebar && menuButton &&
          !sidebar.contains(event.target as Node) &&
          !menuButton.contains(event.target as Node) &&
          window.innerWidth < 768) {
        sidebarOpen = false;
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });
</script>

<div class="grid h-screen w-screen bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden admin-grid {sidebarOpen ? 'sidebar-open' : ''}" style="grid-template-columns: {!isStudentRoute && !sidebarCollapsed ? '288px' : isStudentRoute ? '0px' : '80px'} 1fr;">
   <!-- Sidebar Overlay (Mobile) -->
   {#if sidebarOpen && !isStudentRoute}
     <div class="fixed inset-0 bg-black/50 z-20 md:hidden" on:click={toggleSidebar}></div>
   {/if}

   {#if !isStudentRoute}
   <aside 
     id="sidebar" 
     class="relative h-full w-full bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#0f172a] text-slate-300 shadow-2xl flex flex-col z-30 transform {sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:static md:translate-x-0 transition-all duration-300 ease-in-out"
   >
    <!-- Header -->
    <div class="px-4 pt-8 pb-6 mb-4">
      <div class="flex items-center justify-between">
        {#if !sidebarCollapsed}
          <h1 class="text-xl font-bold text-white tracking-tight">EduPanel</h1>
        {:else}
          <span class="mx-auto text-lg font-bold text-white">EP</span>
        {/if}
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-4 space-y-6 custom-scrollbar">
      <!-- Group: Utama -->
      <div class="space-y-2">
        {#if !sidebarCollapsed}
          <div class="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <div class="w-1 h-1 bg-indigo-500 rounded-full"></div>
            <span>Utama</span>
          </div>
        {/if}
        <ul class="space-y-1">
          <li>
            <a 
              href="javascript:void(0)"
              on:click={() => handleNavigate('/dashboard')}
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 transition-colors duration-150 {['/dashboard'].some(p => $currentPath === p || $currentPath.startsWith(p + '/')) ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800/50 hover:text-white'}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {#if !sidebarCollapsed}<span class="text-sm">Dashboard</span>{/if}
            </a>
          </li>
          {#if $user?.role === 'admin'}
          <li>
            <a 
              href="javascript:void(0)"
              on:click={() => handleNavigate('/dashboard/students')}
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 transition-colors duration-150 {['/dashboard/students', '/student'].some(p => $currentPath === p || $currentPath.startsWith(p + '/')) ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800/50 hover:text-white'}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {#if !sidebarCollapsed}<span class="text-sm">Siswa</span>{/if}
            </a>
          </li>
          <li>
            <a 
              href="javascript:void(0)"
              on:click={() => handleNavigate('/dashboard/classes')} 
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 transition-colors duration-150 {['/dashboard/classes'].some(p => $currentPath === p || $currentPath.startsWith(p + '/')) ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800/50 hover:text-white'}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {#if !sidebarCollapsed}<span class="text-sm">Kelas</span>{/if}
            </a>
          </li>
          {/if}
        </ul>
      </div>

      <!-- Group: Konten -->
      <div class="space-y-2">
        {#if !sidebarCollapsed}
          <div class="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <div class="w-1 h-1 bg-emerald-500 rounded-full"></div>
            <span>Konten</span>
          </div>
        {/if}
        <ul class="space-y-1">
          <li>
            <a 
              href="javascript:void(0)"
              on:click={() => handleNavigate('/dashboard/questions')} 
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 transition-colors duration-150 {['/dashboard/questions', '/bank-soal'].some(p => $currentPath === p || $currentPath.startsWith(p + '/')) ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800/50 hover:text-white'}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {#if !sidebarCollapsed}<span class="text-sm">Bank Soal</span>{/if}
            </a>
          </li>
          <li>
            <a 
              href="javascript:void(0)"
              on:click={() => handleNavigate('/dashboard/exams')} 
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 transition-colors duration-150 {['/dashboard/exams'].some(p => $currentPath === p || $currentPath.startsWith(p + '/')) ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800/50 hover:text-white'}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {#if !sidebarCollapsed}<span class="text-sm">Ujian</span>{/if}
            </a>
          </li>
          {#if $user?.role === 'admin'}
          <li>
            <a 
              href="javascript:void(0)"
              on:click={() => handleNavigate('/dashboard/users')} 
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 transition-colors duration-150 {['/dashboard/users'].some(p => $currentPath === p || $currentPath.startsWith(p + '/')) ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800/50 hover:text-white'}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {#if !sidebarCollapsed}<span class="text-sm">Pengguna</span>{/if}
            </a>
          </li>
          {/if}
        </ul>
      </div>

      <!-- Group: Monitoring -->
      <div class="space-y-2">
        {#if !sidebarCollapsed}
          <div class="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <div class="w-1 h-1 bg-amber-500 rounded-full"></div>
            <span>Monitoring</span>
          </div>
        {/if}
        <ul class="space-y-1">
          <li>
            <a 
              href="javascript:void(0)"
              on:click={() => handleNavigate('/dashboard/exam-monitor')} 
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 transition-colors duration-150 {['/dashboard/exam-monitor', '/exam-monitor'].some(p => $currentPath === p || $currentPath.startsWith(p + '/')) ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800/50 hover:text-white'}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {#if !sidebarCollapsed}<span class="text-sm">Monitoring</span>{/if}
            </a>
          </li>
          <li>
            <a 
              href="javascript:void(0)"
              on:click={() => handleNavigate('/dashboard/exam-cards')} 
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 transition-colors duration-150 {['/dashboard/exam-cards'].some(p => $currentPath === p || $currentPath.startsWith(p + '/')) ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800/50 hover:text-white'}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-6 0l2-2m0 0l2 2m-2-2v6m0 0l-2-2m2 2l2-2" />
              </svg>
              {#if !sidebarCollapsed}<span class="text-sm">Kartu Ujian</span>{/if}
            </a>
          </li>
        </ul>
      </div>

      <!-- Group: Analisis -->
      <div class="space-y-2">
        {#if !sidebarCollapsed}
          <div class="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <div class="w-1 h-1 bg-rose-500 rounded-full"></div>
            <span>Analisis</span>
          </div>
        {/if}
        <ul class="space-y-1">
          <li>
            <a 
              href="javascript:void(0)"
              on:click={() => handleNavigate('/dashboard/results')} 
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 transition-colors duration-150 {['/dashboard/results'].some(p => $currentPath === p || $currentPath.startsWith(p + '/')) ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800/50 hover:text-white'}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {#if !sidebarCollapsed}<span class="text-sm">Hasil Ujian</span>{/if}
            </a>
          </li>
          <li>
            <a 
              href="javascript:void(0)"
              on:click={() => handleNavigate('/dashboard/grading-queue')} 
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 transition-colors duration-150 {['/dashboard/grading-queue', '/grading'].some(p => $currentPath === p || $currentPath.startsWith(p + '/')) ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800/50 hover:text-white'}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {#if !sidebarCollapsed}<span class="text-sm">Penilaian</span>{/if}
            </a>
          </li>
        </ul>
      </div>
      {#if $user?.role === 'admin'}
      <!-- Group: Pengaturan -->
      <div class="space-y-2">
        {#if !sidebarCollapsed}
          <div class="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <div class="w-1 h-1 bg-slate-500 rounded-full"></div>
            <span>Pengaturan</span>
          </div>
        {/if}
        <ul class="space-y-1">
          <li>
            <a 
              href="javascript:void(0)"
              on:click={() => handleNavigate('/dashboard/backup')} 
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 transition-colors duration-150 {['/dashboard/backup'].some(p => $currentPath === p || $currentPath.startsWith(p + '/')) ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800/50 hover:text-white'}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              {#if !sidebarCollapsed}<span class="text-sm">Backup & Restore</span>{/if}
            </a>
          </li>
          <li>
            <a 
              href="javascript:void(0)"
              on:click={() => handleNavigate('/dashboard/update')} 
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 transition-colors duration-150 relative {['/dashboard/update'].some(p => $currentPath === p || $currentPath.startsWith(p + '/')) ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800/50 hover:text-white'}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              {#if !sidebarCollapsed}
                <span class="text-sm flex-1">Update Aplikasi</span>
                {#if updateBehind > 0}
                  <span class="px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded-full">{updateBehind}</span>
                {/if}
              {:else if updateBehind > 0}
                <span class="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
              {/if}
            </a>
          </li>
        </ul>
      </div>
      {/if}
    </nav>

    <!-- Footer / Version & Logout -->
    <div class="p-4">
      {#if appVersion && !sidebarCollapsed}
        <div class="px-3 py-2 mb-2 text-xs text-slate-500">
          v{appVersion}
        </div>
      {/if}
    </div>
    <div class="p-4 pt-0 mt-auto border-t border-slate-800/50">
      <button 
        on:click={handleLogout} 
        class="w-full flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors duration-150"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        {#if !sidebarCollapsed}<span class="text-sm">Logout</span>{/if}
      </button>
    </div>
    </aside>
   {/if}

   <!-- Main content -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200">
      <div class="flex items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
          <button 
            id="menu-button" 
            on:click={toggleSidebar} 
            class="md:hidden text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-150"
            aria-label="Toggle sidebar"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <!-- Sidebar Collapse Toggle (Desktop) -->
          <button 
            on:click={toggleSidebarCollapse} 
            class="hidden md:flex text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors duration-150"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {#if !sidebarCollapsed}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            {/if}
          </button>
        </div>

        <div class="flex items-center space-x-3">
          <NotificationBell />
          
          <div class="flex items-center ml-2 pl-3 border-l border-gray-200">
            {#if $user && $user.nama}
              <div class="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-md">
                {$user.nama.charAt(0).toUpperCase()}
              </div>
              <div class="hidden sm:block ml-3">
                <p class="text-sm font-semibold text-gray-800">Halo, {$user.nama}</p>
                <p class="text-xs text-gray-500 capitalize">{$user.role || 'pengguna'}</p>
              </div>
            {:else if $token}
              <div class="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md">
                U
              </div>
              <div class="hidden sm:block ml-3">
                <p class="text-sm font-semibold text-gray-800">Memuat Profil...</p>
              </div>
            {:else}
              <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 shadow-md">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div class="hidden sm:block ml-3">
                <p class="text-sm font-semibold text-gray-800">Silakan Login</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </header>

    <!-- Page content -->
    <main class="flex-1 overflow-y-auto p-4 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100">
      <slot />
    </main>
  </div>
</div>

<style>
  /* Simple fade animation for overlay only */
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  .animate-fade-in {
    animation: fade-in 0.2s ease-out forwards;
  }
  
  /* Custom scrollbar for sidebar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(99, 102, 241, 0.4);
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(99, 102, 241, 0.6);
  }
  
  /* No transitions on route changes */
  :global(body) {
    transition: none;
  }
  
  /* Disable all route transition animations */
  :global(.route-transition) {
    transition: none !important;
    animation: none !important;
  }

  @media (max-width: 767px) {
    .admin-grid {
      grid-template-columns: 0px 1fr !important;
    }

    .admin-grid #sidebar {
      overflow: hidden !important;
    }

    .sidebar-open #sidebar {
      position: fixed !important;
      top: 0 !important;
      bottom: 0 !important;
      left: 0 !important;
      width: 18rem !important;
    }
  }
</style>