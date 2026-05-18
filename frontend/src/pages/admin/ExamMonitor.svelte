<script>
  import { onMount, onDestroy } from 'svelte';
  import { apiFetch } from '$lib/api';
  import toast from '../../lib/toast';
  import Modal from '../../components/Modal.svelte';


  let ubians = [];
  let selectedUjian = '';
  let activeSessions = [];
  let gradingStats = null;

  async function fetchActiveUjian() {
    try {
      // Fetch only exams that are currently active (status = 'aktif' and within time range)
      ubians = await apiFetch('/ujian/active/now');
    } catch (error) {
      toast.push({ type: 'error', message: `Gagal memuat daftar ujian: ${error.message}` });
    }
  }

  async function fetchGradingStats(ujianId) {
    if (!ujianId) {
      gradingStats = null;
      return;
    }
    try {
      const submissions = await apiFetch(`/essay-grading/exam/${ujianId}/submissions`);
      gradingStats = {
        total: submissions.length,
        pending: submissions.filter(s => s.manual_grade_status === 'pending').length,
        partial: submissions.filter(s => s.manual_grade_status === 'partial').length,
        completed: submissions.filter(s => s.manual_grade_status === 'completed').length
      };
    } catch (error) {
      console.error('Failed to fetch grading stats:', error);
    }
  }

  async function fetchActiveSessions(ujianId) {
    if (!ujianId) {
      activeSessions = [];
      return;
    }
    try {
      activeSessions = await apiFetch(`/exam-sessions/active/${ujianId}`);
    } catch (error) {
      toast.push({ type: 'error', message: `Gagal memuat sesi aktif: ${error.message}` });
      activeSessions = [];
    }
  }

  onMount(() => {
    document.body.classList.add('admin-layout');
    fetchActiveUjian();
  });

  onDestroy(() => {
    document.body.classList.remove('admin-layout');
  });

  function handleUjianChange(event) {
    selectedUjian = event.target.value;
    fetchActiveSessions(selectedUjian);
    fetchGradingStats(selectedUjian);
  }

  // Auto-refresh every 30 seconds when an exam is selected
  let refreshInterval;
  $: if (selectedUjian) {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      fetchActiveSessions(selectedUjian);
    }, 30000);
  }

  // Auto-refresh active exams list every minute
  let examsRefreshInterval;
  onMount(() => {
    examsRefreshInterval = setInterval(() => {
      fetchActiveUjian();
      // If an exam is selected, also refresh its sessions
      if (selectedUjian) {
        fetchActiveSessions(selectedUjian);
      }
    }, 60000);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (examsRefreshInterval) clearInterval(examsRefreshInterval);
  });

  function getStatusBadgeClass(session) {
    if (session.is_locked) return 'bg-red-600 text-white';
    if (session.session_status === 'active') return 'bg-green-100 text-green-700';
    if (session.session_status === 'submitted' || session.session_status === 'completed') return 'bg-blue-100 text-blue-700';
    if (session.session_status === 'idle' || session.session_status === 'expired') return 'bg-red-100 text-red-700';
    if (session.session_status === 'not_started') return 'bg-gray-100 text-gray-600';
    return 'bg-gray-100 text-gray-700';
  }

  function getStatusLabel(session) {
    if (session.is_locked) return 'Terkunci';
    const labels = {
      'active': 'Sedang Mengerjakan',
      'submitted': 'Sudah Submit',
      'completed': 'Selesai',
      'idle': 'Tidak Aktif',
      'expired': 'Kedaluwarsa',
      'not_started': 'Belum Mulai'
    };
    return labels[session.session_status] || session.session_status;
  }

  async function unlockSession(sessionId, userNama) {
    if (!confirm(`Yakin ingin membuka kunci sesi "${userNama}"?`)) return;
    try {
      await apiFetch(`/exam-sessions/unlock/${sessionId}`, { method: 'POST' });
      toast.push({ type: 'success', message: `Sesi "${userNama}" berhasil dibuka kembali` });
      fetchActiveSessions(selectedUjian);
    } catch (error) {
      toast.push({ type: 'error', message: `Gagal membuka sesi: ${error.message}` });
    }
  }

  // Violation modal state
  let showViolationModal = false;
  let violationUser = null;
  let violationList = [];

  async function openViolationModal(session) {
    violationUser = session;
    try {
      const allViolations = await apiFetch(`/violations/ujian/${selectedUjian}`);
      violationList = allViolations.filter(v => v.user_id === session.user_id);
    } catch (error) {
      violationList = [];
    }
    showViolationModal = true;
  }

  function closeViolationModal() {
    showViolationModal = false;
    violationUser = null;
    violationList = [];
  }
</script>


  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      <!-- Header Section -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20">
        <div class="flex items-center space-x-4">
          <div class="p-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <div class="inline-flex items-center space-x-2 text-sm text-indigo-600 mb-1">
              <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
              <span>Real-time Monitoring</span>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Pemantauan Ujian
            </h1>
            <p class="text-gray-600 mt-1">Monitor aktivitas siswa saat mengerjakan ujian secara real-time</p>
          </div>
        </div>
      </div>

      <!-- Selection Card -->
      <div class="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <label class="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
          <svg class="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Pilih Ujian yang Sedang Berlangsung
        </label>
        
        {#if ubians.length === 0}
          <div class="mt-4 p-5 bg-amber-50 border border-amber-200 rounded-xl">
            <div class="flex items-start space-x-3">
              <div class="p-2 bg-amber-100 rounded-lg">
                <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-amber-800">Tidak Ada Ujian Aktif</p>
                <p class="text-sm text-amber-700 mt-1">
                  Tidak ada ujian yang sedang berlangsung saat ini. Ujian akan muncul di sini ketika:
                </p>
                <ul class="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Status ujian adalah "aktif"</li>
                  <li>Waktu saat ini berada dalam rentang waktu_mulai dan waktu_selesai</li>
                </ul>
              </div>
            </div>
          </div>
        {:else}
          <div class="relative">
            <select
              id="ujian"
              on:change={handleUjianChange}
              class="block w-full px-5 py-3 text-base border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent rounded-xl bg-white appearance-none cursor-pointer transition-all hover:border-indigo-300"
            >
              <option value="">-- Pilih Ujian --</option>
              {#each ubians as ujian}
                <option value={ujian.id}>{ujian.judul}</option>
              {/each}
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        {/if}
      </div>

      <!-- Stats Summary -->
      {#if selectedUjian && activeSessions.length > 0}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <!-- Active Sessions Card -->
          <div class="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-xl hover:shadow-2xl transition-shadow">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-green-100 text-sm font-medium uppercase tracking-wider">Sedang Mengerjakan</p>
                <p class="text-4xl font-bold mt-2">{activeSessions.filter(s => s.session_status === 'active').length}</p>
              </div>
              <div class="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <!-- Submitted Sessions Card -->
          <div class="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-5 text-white shadow-xl hover:shadow-2xl transition-shadow">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-blue-100 text-sm font-medium uppercase tracking-wider">Sudah Submit</p>
                <p class="text-4xl font-bold mt-2">{activeSessions.filter(s => s.session_status === 'submitted' || s.session_status === 'completed').length}</p>
              </div>
              <div class="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {#if gradingStats && gradingStats.total > 0}
            <!-- Pending Grading Card -->
            <div class="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-xl hover:shadow-2xl transition-shadow">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-amber-100 text-sm font-medium uppercase tracking-wider">Perlu Dinilai</p>
                  <p class="text-4xl font-bold mt-2">{gradingStats.pending + gradingStats.partial}</p>
                </div>
                <div class="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <!-- Total Participants Card -->
            <div class="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-5 text-white shadow-xl hover:shadow-2xl transition-shadow">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-purple-100 text-sm font-medium uppercase tracking-wider">Total Peserta</p>
                  <p class="text-4xl font-bold mt-2">{activeSessions.length}</p>
                </div>
                <div class="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          {:else}
            <!-- Total Participants Card (full width when no grading stats) -->
            <div class="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-5 text-white shadow-xl hover:shadow-2xl transition-shadow">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-purple-100 text-sm font-medium uppercase tracking-wider">Total Peserta</p>
                  <p class="text-4xl font-bold mt-2">{activeSessions.length}</p>
                </div>
                <div class="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Grading Stats Card -->
        {#if gradingStats && gradingStats.total > 0}
          <div class="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div class="flex items-center justify-between mb-5 pb-3 border-b border-gray-200">
              <div class="flex items-center space-x-3">
                <div class="p-2 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 class="text-lg font-bold text-gray-800">Status Penilaian Essay</h3>
              </div>
              <a href="/dashboard/grading-queue" class="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center transition-colors group">
                <span>Ke Antrian Penilaian</span>
                <svg class="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="text-center p-4 bg-amber-50 rounded-xl border border-amber-200">
                <div class="text-3xl font-bold text-amber-600">{gradingStats.pending}</div>
                <div class="text-sm text-amber-700 mt-1 font-medium">Belum Dinilai</div>
              </div>
              <div class="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div class="text-3xl font-bold text-blue-600">{gradingStats.partial}</div>
                <div class="text-sm text-blue-700 mt-1 font-medium">Sedang Dinilai</div>
              </div>
              <div class="text-center p-4 bg-green-50 rounded-xl border border-green-200">
                <div class="text-3xl font-bold text-green-600">{gradingStats.completed}</div>
                <div class="text-sm text-green-700 mt-1 font-medium">Selesai Dinilai</div>
              </div>
            </div>
          </div>
        {/if}
      {/if}

      <!-- Sessions List -->
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div class="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div class="flex items-center space-x-3">
            <div class="p-2 bg-indigo-100 rounded-xl">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-800">Daftar Sesi Ujian</h2>
              <p class="text-gray-500 text-sm mt-0.5">
                {#if selectedUjian}
                  {activeSessions.length > 0 
                    ? `Menampilkan ${activeSessions.length} sesi untuk ujian yang dipilih` 
                    : 'Belum ada sesi aktif untuk ujian ini'}
                {:else}
                  Pilih ujian terlebih dahulu untuk melihat sesi
                {/if}
              </p>
            </div>
          </div>
        </div>

        {#if !selectedUjian}
          <div class="p-12 flex flex-col items-center justify-center">
            <div class="w-24 h-24 mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
              <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-800 mb-1">Pilih Ujian Terlebih Dahulu</h3>
            <p class="text-gray-500 text-center">Silakan pilih ujian dari dropdown di atas untuk melihat sesi ujian</p>
          </div>
        {:else if activeSessions.length === 0}
          <div class="p-12 flex flex-col items-center justify-center">
            <div class="w-24 h-24 mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
              <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-800 mb-1">Tidak Ada Sesi Aktif</h3>
            <p class="text-gray-500">Belum ada siswa yang mengerjakan ujian ini</p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Siswa</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Pelanggaran</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Waktu Mulai</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Terakhir Update</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-100">
                {#each activeSessions as session}
                  <tr class="hover:bg-gray-50 transition-colors duration-150">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {session.user_nama.charAt(0).toUpperCase()}
                        </div>
                        <div class="ml-3">
                          <div class="text-sm font-semibold text-gray-900">{session.user_nama}</div>
                          <div class="text-xs text-gray-500">{session.user_email}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium {getStatusBadgeClass(session)}">
                        {getStatusLabel(session)}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      {#if session.violations_count > 0}
                        <button
                          on:click={() => openViolationModal(session)}
                          class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors cursor-pointer"
                        >
                          {session.violations_count} pelanggaran
                        </button>
                      {:else}
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          0
                        </span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div class="flex items-center">
                        <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {#if session.started_at}
                          {new Date(session.started_at).toLocaleString('id-ID', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        {:else}
                          <span class="text-gray-400 italic">Belum mulai</span>
                        {/if}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div class="flex items-center">
                        <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {#if session.last_activity}
                          {new Date(session.last_activity).toLocaleString('id-ID', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        {:else}
                          <span class="text-gray-400 italic">-</span>
                        {/if}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      {#if session.is_locked}
                        <button
                          on:click={() => unlockSession(session.session_id, session.user_nama)}
                          class="inline-flex items-center px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-xl transition-all hover:shadow-md"
                        >
                          <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4-8v2m-6 8h12a2 2 0 012 2v6a2 2 0 01-2 2H10a2 2 0 01-2-2v-6a2 2 0 012-2z" />
                          </svg>
                          Buka Kunci
                        </button>
                      {:else}
                        <span class="text-xs text-gray-400">-</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  </div>


<!-- Violation Detail Modal -->
<Modal show={showViolationModal} onClose={closeViolationModal} title="Detail Pelanggaran" size="md">
  {#if violationUser}
    <div class="space-y-4">
      <div class="flex items-center space-x-3 pb-3 border-b border-gray-200">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
          {violationUser.user_nama.charAt(0).toUpperCase()}
        </div>
        <div>
          <p class="text-sm font-semibold text-gray-900">{violationUser.user_nama}</p>
          <p class="text-xs text-gray-500">{violationUser.user_email}</p>
        </div>
      </div>

      {#if violationList.length > 0}
        <div class="space-y-2 max-h-60 overflow-y-auto">
          {#each violationList as v, i}
            <div class="flex items-start space-x-3 p-3 bg-red-50 rounded-xl">
              <span class="text-xs font-bold text-red-600 mt-0.5">#{i + 1}</span>
              <div class="flex-1">
                <p class="text-sm font-medium text-red-800 capitalize">{v.violation_type.replace(/_/g, ' ')}</p>
                <p class="text-xs text-red-600 mt-0.5">
                  {new Date(v.created_at).toLocaleString('id-ID', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-gray-500 text-center py-6">Tidak ada data pelanggaran.</p>
      {/if}
    </div>
  {/if}
  <div slot="footer" class="flex justify-end">
    <button on:click={closeViolationModal} class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors">
      Tutup
    </button>
  </div>
</Modal>

<style>
  .admin-layout {
    background-color: #f9fafb;
  }
</style>