<script>
  import SimpleLayout from '../../layouts/SimpleLayout.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { navigateTo } from '../../stores/routeStore.js';
  import { apiFetch } from '$lib/api';
  import toast from '../../lib/toast.js';
  import { currentPath } from '../../stores/routeStore.js';

  let token = localStorage.getItem('token');
  let user = null;

  $: if (token) {
    try {
      const tokenString = token.startsWith('Bearer ') ? token.substring(7) : token;
      const payload = JSON.parse(atob(tokenString.split('.')[1]));
      user = {
        id: payload.id,
        nama: payload.nama,
        email: payload.email,
        role: payload.role
      };
    } catch (e) {
      console.error('Invalid token', e);
    }
  }

  let exams = [];
  let userResults = {};
  let pendingRequests = {};
  let loading = true;
  let showConfirmModal = false;
  let confirmCallback = null;
  let confirmMessage = '';
  let isHumanVerified = false;
  let filterStatus = 'semua';
  let searchTerm = '';

  $: filteredExams = exams.filter(exam => {
    const status = getExamStatus(exam);
    if (filterStatus !== 'semua' && status !== filterStatus) return false;
    if (searchTerm && !exam.judul.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Subscribe to route changes and refresh data
  let unsubscribe;
  let dataInitialized = false;
  
  onMount(async () => {
    if (token && !dataInitialized) {
      dataInitialized = true;
      await Promise.all([fetchExams(), fetchUserResults(), fetchPendingRequests()]);
    }
    
    // Subscribe to route changes to refresh data when navigating back
    unsubscribe = currentPath.subscribe(async (path) => {
      if (path === '/exam-list' && token) {
        await Promise.all([fetchExams(), fetchUserResults(), fetchPendingRequests()]);
      }
    });
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });

  async function fetchPendingRequests() {
    try {
      const requests = await apiFetch(`/api/reset-requests/user/${user?.id}`);
      const requestsMap = {};
      requests.forEach(req => {
        if (req.status === 'pending') {
          requestsMap[req.ujian_id] = true;
        }
      });
      pendingRequests = requestsMap;
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  }

  async function fetchExams() {
    try {
      loading = true;
      const response = await apiFetch('/api/ujian?limit=1000');
      exams = response?.data || response || [];
    } catch (error) {
      toast.error('Gagal memuat ujian: ' + error.message);
    } finally {
      loading = false;
    }
  }

  async function fetchUserResults() {
    try {
      const results = await apiFetch(`/api/hasil/user/${user?.id}`);
      const takenExams = {};
      results.forEach(result => {
        takenExams[result.ujian_id] = true;
      });
      userResults = takenExams;
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  }

  function hasTakenExam(examId) {
    return userResults[examId] === true;
  }

  function getExamStatus(exam) {
    const now = new Date();
    const startTime = exam.waktu_mulai ? new Date(exam.waktu_mulai) : null;
    const endTime = exam.waktu_selesai ? new Date(exam.waktu_selesai) : null;

    if (!startTime || !endTime) return 'unknown';
    if (now < startTime) return 'upcoming';
    if (now >= startTime && now <= endTime) return 'ongoing';
    return 'ended';
  }

  function getStatusBadge(status) {
    const badges = {
      'upcoming': { class: 'bg-blue-100 text-blue-700 border-blue-200', text: 'Belum Dimulai', icon: 'clock' },
      'ongoing': { class: 'bg-green-100 text-green-700 border-green-200', text: 'Sedang Berlangsung', icon: 'play' },
      'ended': { class: 'bg-red-100 text-red-700 border-red-200', text: 'Sudah Selesai', icon: 'stop' },
      'unknown': { class: 'bg-gray-100 text-gray-600 border-gray-200', text: 'Tidak Diketahui', icon: 'question' }
    };
    return badges[status] || badges['unknown'];
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('id-ID', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit'
    });
  }

  function showConfirmation(message, callback) {
    confirmMessage = message;
    confirmCallback = callback;
    isHumanVerified = false;
    showConfirmModal = true;
  }

  function hideConfirmation() {
    showConfirmModal = false;
    confirmCallback = null;
    isHumanVerified = false;
  }

  async function confirmAction() {
    if (confirmCallback && isHumanVerified) {
      try {
        await confirmCallback();
        hideConfirmation();
      } catch (error) {
        toast.error(error.message || 'Gagal mengirim permintaan');
        hideConfirmation();
      }
    }
  }

  function startExam(exam) {
    // Check if exam time is finished
    const now = new Date();
    const endTime = exam.waktu_selesai ? new Date(exam.waktu_selesai) : null;
    
    const isFinished = endTime && now.getTime() > endTime.getTime();

    if (isFinished) {
      toast.error('Ujian sudah selesai, tidak bisa mengajukan reset.');
      return;
    }

    if (hasTakenExam(exam.id)) {
      showConfirmation(
        'Anda sudah mengerjakan ujian ini. Yakin ingin mengulang? (Perlu persetujuan admin)',
        () => requestReset(exam.id)
      );
    } else {
      navigateTo(`/exam/${exam.id}`);
    }
  }

  function handleLogout() {
    showConfirmation(
      'Yakin ingin keluar dari sistem?',
      () => {
        authActions.logout();
        navigateTo('/login');
      }
    );
  }

  async function requestReset(examId) {
    await apiFetch('/api/reset-requests', {
      method: 'POST',
      body: { ujian_id: examId }
    });
    toast.success('Permintaan reset berhasil dikirim. Hubungi admin untuk persetujuan.');
  }
</script>

<SimpleLayout>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      
      <!-- Header Section -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6 mb-4 sm:mb-8 border border-white/20">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div class="min-w-0">
            <div class="inline-flex items-center space-x-2 text-xs sm:text-sm text-indigo-600 mb-1 sm:mb-2">
              <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 002 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 005.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 009 7.5c0-1.255-.434-2.443-1.18-3.5z"/>
                <path d="M15.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 0011 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 0015.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 0019 7.5c0-1.255-.434-2.443-1.18-3.5A7.968 7.968 0 0015.5 4z"/>
              </svg>
              <span>Portal Siswa</span>
            </div>
            <h1 class="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Daftar Ujian
            </h1>
            <p class="text-gray-600 mt-0.5 sm:mt-1 text-xs sm:text-sm">Pilih ujian yang ingin kamu kerjakan</p>
          </div>
          {#if user?.nama}
            <div class="flex items-center space-x-3 px-3 sm:px-4 py-1.5 sm:py-2 bg-white rounded-xl shadow-sm shrink-0">
              <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm sm:text-lg shadow-md">
                {user.nama.charAt(0).toUpperCase()}
              </div>
              <div class="min-w-0 max-w-[160px] sm:max-w-none">
                <p class="text-xs sm:text-sm font-semibold text-gray-800 truncate">Halo, {user.nama}</p>
                <p class="text-[10px] sm:text-xs text-gray-500 capitalize truncate">{user.role || 'siswa'}</p>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Filter and Search Bar -->
      <div class="bg-white rounded-2xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-8">
        <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div class="flex-1 relative">
            <div class="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
              <svg class="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <input
              type="text"
              bind:value={searchTerm}
              placeholder="Cari ujian..."
              class="block w-full pl-10 sm:pl-11 pr-3 sm:pr-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            />
          </div>
          <select
            bind:value={filterStatus}
            class="w-full sm:w-44 lg:w-48 py-2 sm:py-2.5 px-3 sm:px-4 text-sm sm:text-base border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
          >
            <option value="semua">Semua Status</option>
            <option value="upcoming">Belum Dimulai</option>
            <option value="ongoing">Sedang Berlangsung</option>
            <option value="ended">Sudah Selesai</option>
          </select>
        </div>
      </div>

      {#if loading}
        <!-- Loading Skeleton -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each Array(6) as _, i}
            <div class="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse">
              <div class="h-16 bg-gray-200"></div>
              <div class="p-5 space-y-4">
                <div class="h-6 bg-gray-200 rounded w-3/4"></div>
                <div class="space-y-2">
                  <div class="h-4 bg-gray-200 rounded w-full"></div>
                  <div class="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
                <div class="h-10 bg-gray-200 rounded w-full"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else if exams.length > 0}
        {#if filteredExams.length > 0}
          <!-- Exam Cards Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each filteredExams as exam}
            {@const status = getExamStatus(exam)}
            {@const badge = getStatusBadge(status)}
            {@const taken = hasTakenExam(exam.id)}
            
            <div class="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden">
              <!-- Status Banner -->
              <div class="relative px-4 sm:px-5 py-2.5 sm:py-3 {status === 'ongoing' ? 'bg-gradient-to-r from-green-50 to-emerald-50' : status === 'upcoming' ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : 'bg-gradient-to-r from-gray-50 to-gray-100'} border-b">
                <div class="flex items-center justify-between gap-2">
                  <span class="inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold {badge.class} border whitespace-nowrap">
                    {#if status === 'ongoing'}
                      <span class="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                    {:else if status === 'upcoming'}
                      <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    {:else}
                      <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                      </svg>
                    {/if}
                    {badge.text}
                  </span>
                  {#if taken}
                    <span class="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200 whitespace-nowrap">
                      <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span class="hidden sm:inline">Sudah Dikerjakan</span>
                      <span class="sm:hidden">Selesai</span>
                    </span>
                  {/if}
                </div>
              </div>

              <!-- Exam Info -->
              <div class="p-4 sm:p-5">
                <h2 class="text-base sm:text-xl font-bold text-gray-800 mb-2 sm:mb-3 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                  {exam.judul}
                </h2>
                
                <div class="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-600 mb-4 sm:mb-5">
                  <div class="flex items-center justify-between p-2 sm:p-2.5 bg-gray-50 rounded-xl">
                    <div class="flex items-center">
                      <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span class="font-medium">Durasi</span>
                    </div>
                    <span class="font-semibold text-gray-800">{exam.durasi} menit</span>
                  </div>
                  
                  <div class="flex items-start p-2 sm:p-2.5 bg-gray-50 rounded-xl">
                    <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <div class="min-w-0">
                      <div class="text-[10px] sm:text-xs text-gray-500 mb-0.5">Mulai</div>
                      <div class="font-medium text-gray-700">{formatDateTime(exam.waktu_mulai)}</div>
                    </div>
                  </div>
                  
                  <div class="flex items-start p-2 sm:p-2.5 bg-gray-50 rounded-xl">
                    <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <div class="min-w-0">
                      <div class="text-[10px] sm:text-xs text-gray-500 mb-0.5">Selesai</div>
                      <div class="font-medium text-gray-700">{formatDateTime(exam.waktu_selesai)}</div>
                    </div>
                  </div>
                </div>

                <!-- Action Button -->
                {#if user?.role === 'siswa'}
                  {#if status === 'ongoing'}
                    {#if taken}
                      <div class="space-y-2">
                        <button
                          on:click={() => navigateTo('/hasil')}
                          class="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center"
                        >
                          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                          </svg>
                          Lihat Hasil
                        </button>
                        {#if pendingRequests[exam.id]}
                          <button
                            disabled
                            class="w-full py-3 px-4 bg-gray-100 text-gray-500 font-semibold rounded-xl cursor-not-allowed flex items-center justify-center border border-gray-200"
                          >
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            Menunggu Persetujuan
                          </button>
                        {:else}
                          <button
                            on:click={() => startExam(exam)}
                            class="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center"
                          >
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                            Minta Ujian Ulang
                          </button>
                        {/if}
                      </div>
                    {:else}
                      <button
                        on:click={() => startExam(exam)}
                        class="relative w-full py-3 px-4 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center overflow-hidden group/btn"
                      >
                        <span class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></span>
                        <svg class="w-5 h-5 mr-2 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Mulai Ujian Sekarang
                      </button>
                    {/if}
                  {:else if status === 'upcoming'}
                    <button
                      disabled
                      class="w-full py-3 px-4 bg-gray-100 text-gray-500 font-semibold rounded-xl cursor-not-allowed flex items-center justify-center border border-gray-200"
                    >
                      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      Belum Waktunya
                    </button>
                  {:else}
                    {#if taken}
                      <div class="space-y-2">
                        <button
                          on:click={() => navigateTo('/hasil')}
                          class="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center"
                        >
                          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                          </svg>
                          Lihat Hasil
                        </button>
                        {#if pendingRequests[exam.id]}
                          <button
                            disabled
                            class="w-full py-3 px-4 bg-gray-100 text-gray-500 font-semibold rounded-xl cursor-not-allowed flex items-center justify-center border border-gray-200"
                          >
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            Menunggu Persetujuan
                          </button>
                        {:else}
                          <button
                            on:click={() => startExam(exam)}
                            class="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center"
                          >
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                            Minta Ujian Ulang
                          </button>
                        {/if}
                      </div>
                    {:else}
                      <button
                        disabled
                        class="w-full py-3 px-4 bg-gray-100 text-gray-500 font-semibold rounded-xl cursor-not-allowed flex items-center justify-center border border-gray-200"
                      >
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                        </svg>
                        Waktu Ujian Sudah Lewat
                      </button>
                    {/if}
                  {/if}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <!-- No Filter Results -->
        <div class="bg-white rounded-2xl shadow-lg p-8 sm:p-12 text-center">
          <div class="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 sm:w-12 sm:h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <h3 class="text-lg sm:text-xl font-semibold text-gray-800 mb-1 sm:mb-2">Tidak Ditemukan</h3>
          <p class="text-sm sm:text-base text-gray-500">Tidak ada ujian yang sesuai dengan pencarian atau filter Anda.</p>
        </div>
      {/if}
    {:else}
      <!-- Empty State -->
        <div class="bg-white rounded-2xl shadow-lg p-8 sm:p-12 text-center">
          <div class="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 sm:w-12 sm:h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <h3 class="text-lg sm:text-xl font-semibold text-gray-800 mb-1 sm:mb-2">Belum Ada Ujian</h3>
          <p class="text-sm sm:text-base text-gray-500 max-w-md mx-auto mb-4 sm:mb-6">
            Silakan tunggu instruksi dari guru atau admin untuk ujian yang akan datang.
          </p>
          <button
            on:click={() => window.location.reload()}
            class="inline-flex items-center px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh Halaman
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Confirmation Modal -->
  {#if showConfirmModal}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" on:click={hideConfirmation}>
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in" on:click|stopPropagation>
        <div class="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h3 class="text-lg font-bold text-white">Konfirmasi</h3>
          </div>
        </div>
        <div class="p-6">
          <p class="text-gray-700 mb-5">{confirmMessage}</p>
          <label class="flex items-start cursor-pointer p-3 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              bind:checked={isHumanVerified}
              class="mt-1 h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
            />
            <span class="ml-3 text-sm text-gray-700">
              Saya yakin dan ingin melanjutkan
            </span>
          </label>
        </div>
        <div class="p-4 bg-gray-50 flex justify-end space-x-3 rounded-b-2xl">
          <button
            on:click={hideConfirmation}
            class="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
          >
            Batal
          </button>
          <button
            on:click={confirmAction}
            disabled={!isHumanVerified}
            class="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium rounded-xl hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ya, Lanjutkan
          </button>
        </div>
      </div>
    </div>
  {/if}
</SimpleLayout>

<style>
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes scale-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  .animate-fade-in {
    animation: fade-in 0.2s ease-out forwards;
  }
  
  .animate-scale-in {
    animation: scale-in 0.2s ease-out forwards;
  }
  
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>