<script>
  import { onMount, onDestroy } from 'svelte';
  import { apiFetch } from '$lib/api';
  import toast from '../../lib/toast';

  let user = null;

  $: {
    if (!user) {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('token');

      if (storedUser) {
        try {
          user = JSON.parse(storedUser);
        } catch (e) {
          console.error('Failed to parse stored user:', e);
        }
      } else if (storedToken) {
        try {
          const tokenString = storedToken.startsWith('Bearer ') ? storedToken.substring(7) : storedToken;
          const payload = JSON.parse(atob(tokenString.split('.')[1]));
          user = {
            id: payload.id,
            nama: payload.nama,
            email: payload.email,
            role: payload.role
          };
        } catch (e) {
          console.error('Failed to parse token:', e);
        }
      }
    }
  }

  let results = [];
  let selectedUjian = '';
  let ujianList = [];
  let expandedResult = null;
  let essayDetails = null;
  
  // Bulk reset
  let selectedResults = new Set();
  let showBulkResetModal = false;
  let bulkResetType = 'all'; // 'all' or 'essay_only'
  let bulkResetLoading = false;

  // Statistics
  let stats = {
    totalStudents: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 100,
    passedCount: 0,
    failedCount: 0,
    pendingGrading: 0
  };

  onMount(async () => {
    document.body.classList.add('admin-layout');
    await Promise.all([fetchResults(), fetchUjianList()]);
    calculateStats();
  });

  onDestroy(() => {
    document.body.classList.remove('admin-layout');
  });

  async function fetchResults() {
    try {
      const response = await apiFetch('/hasil');
      results = Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Error fetching results:', error);
      toast.push({ type: 'error', message: `Gagal memuat hasil: ${error.message}` });
      results = [];
    }
  }

  async function fetchUjianList() {
    try {
      const response = await apiFetch('/ujian?limit=1000');
      ujianList = response?.data || response || [];
    } catch (error) {
      console.error('Failed to fetch ujian list:', error);
    }
  }

  function calculateStats() {
    const filteredResults = results.filter(r => !selectedUjian || r.ujian_id === parseInt(selectedUjian));
    
    if (filteredResults.length === 0) {
      stats = {
        totalStudents: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        passedCount: 0,
        failedCount: 0,
        pendingGrading: 0
      };
      return;
    }

    const scores = filteredResults.map(r => parseFloat(r.skor) || 0);
    
    stats.totalStudents = filteredResults.length;
    stats.averageScore = scores.reduce((sum, score) => sum + score, 0) / stats.totalStudents;
    stats.highestScore = Math.max(...scores);
    stats.lowestScore = Math.min(...scores);
    stats.passedCount = filteredResults.filter(r => r.passed).length;
    stats.failedCount = filteredResults.filter(r => !r.passed).length;
    stats.pendingGrading = filteredResults.filter(r => r.manual_grade_status === 'pending' || r.manual_grade_status === 'partial').length;
  }

  async function viewEssayDetails(hasilId, ujianId) {
    try {
      const data = await apiFetch(`/essay-grading/submission/${hasilId}/essays`);
      essayDetails = data;
      expandedResult = hasilId;
    } catch (error) {
      toast.push({ type: 'error', message: `Gagal memuat detail essay: ${error.message}` });
    }
  }

  function closeEssayDetails() {
    essayDetails = null;
    expandedResult = null;
  }

  function getGradeColor(grade) {
    const colors = {
      'A': 'bg-green-100 text-green-700',
      'B': 'bg-blue-100 text-blue-700',
      'C': 'bg-yellow-100 text-yellow-700',
      'D': 'bg-orange-100 text-orange-700',
      'E': 'bg-red-100 text-red-700'
    };
    return colors[grade] || 'bg-gray-100 text-gray-700';
  }

  function getStatusBadge(status) {
    if (status === 'pending') return { class: 'bg-amber-100 text-amber-700', text: 'Menunggu Nilai Essay' };
    if (status === 'partial') return { class: 'bg-blue-100 text-blue-700', text: 'Sedang Dinilai' };
    return { class: 'bg-green-100 text-green-700', text: 'Selesai Dinilai' };
  }

  function getScorePercentage(score, maxScore) {
    if (!maxScore || maxScore === 0) return 0;
    return ((score / maxScore) * 100).toFixed(2);
  }

  function getProgressBarColor(percentage) {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    if (percentage >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  }

  function handleFilterChange() {
    calculateStats();
    selectedResults.clear();
  }

  function toggleSelectResult(hasilId) {
    if (selectedResults.has(hasilId)) {
      selectedResults.delete(hasilId);
    } else {
      selectedResults.add(hasilId);
    }
    // Force reactivity
    selectedResults = new Set(selectedResults);
  }

  function toggleSelectAll() {
    const filteredResults = results.filter(r => !selectedUjian || r.ujian_id === parseInt(selectedUjian));
    
    if (selectedResults.size === filteredResults.length && filteredResults.length > 0) {
      // Unselect all
      selectedResults.clear();
    } else {
      // Select all
      filteredResults.forEach(r => {
        selectedResults.add(r.id);
      });
    }
    
    // Force reactivity
    selectedResults = new Set(selectedResults);
  }

  function openBulkResetModal() {
    if (selectedResults.size === 0) {
      toast.error('Pilih minimal 1 hasil ujian untuk di-reset');
      return;
    }
    showBulkResetModal = true;
  }

  function closeBulkResetModal() {
    showBulkResetModal = false;
    bulkResetType = 'all';
  }

  async function executeBulkReset() {
    bulkResetLoading = true;
    try {
      const response = await apiFetch('/essay-grading/bulk-reset/submissions', {
        method: 'POST',
        body: JSON.stringify({
          hasil_ids: Array.from(selectedResults),
          reset_type: bulkResetType
        })
      });

      toast.success(response.message);
      
      // Refresh results
      await fetchResults();
      calculateStats();
      selectedResults.clear();
      closeBulkResetModal();
    } catch (error) {
      toast.error(`Gagal reset: ${error.message}`);
    } finally {
      bulkResetLoading = false;
    }
  }

  async function executeBulkResetExam() {
    if (!selectedUjian) {
      toast.error('Pilih ujian terlebih dahulu');
      return;
    }

    bulkResetLoading = true;
    try {
      const response = await apiFetch(`/essay-grading/bulk-reset/exam/${selectedUjian}`, {
        method: 'POST',
        body: JSON.stringify({
          reset_type: bulkResetType
        })
      });

      toast.success(response.message);
      
      // Refresh results
      await fetchResults();
      calculateStats();
      selectedResults.clear();
      closeBulkResetModal();
    } catch (error) {
      toast.error(`Gagal reset: ${error.message}`);
    } finally {
      bulkResetLoading = false;
    }
  }
</script>


  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      <!-- Header Section -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20">
        <div class="flex items-center space-x-4">
          <div class="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <div class="inline-flex items-center space-x-2 text-sm text-purple-600 mb-1">
              <span class="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
              <span>Analisis Nilai</span>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Hasil Ujian Siswa
            </h1>
            <p class="text-gray-600 mt-1">Kelola dan lihat hasil ujian dari semua siswa</p>
          </div>
        </div>
      </div>

      <!-- Filter Section -->
      <div class="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <div class="flex items-center space-x-3 mb-4">
          <div class="p-2 bg-indigo-100 rounded-lg">
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
            </svg>
          </div>
          <label class="block text-sm font-semibold text-gray-700">Filter berdasarkan ujian:</label>
        </div>
        <select 
          bind:value={selectedUjian}
          on:change={handleFilterChange}
          class="w-full md:w-96 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
        >
          <option value="">Semua Ujian</option>
          {#each ujianList as ujian}
            <option value={ujian.id}>{ujian.judul}</option>
          {/each}
        </select>
      </div>

      <!-- Statistics Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div class="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-4 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-indigo-100 text-xs font-medium uppercase tracking-wider">Total Siswa</div>
              <div class="text-3xl font-bold mt-1">{stats.totalStudents}</div>
            </div>
            <div class="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-4 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-blue-100 text-xs font-medium uppercase tracking-wider">Rata-rata Nilai</div>
              <div class="text-3xl font-bold mt-1">{stats.averageScore.toFixed(1)}%</div>
            </div>
            <div class="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-emerald-100 text-xs font-medium uppercase tracking-wider">Nilai Tertinggi</div>
              <div class="text-3xl font-bold mt-1">{stats.highestScore}%</div>
            </div>
            <div class="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-4 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-orange-100 text-xs font-medium uppercase tracking-wider">Nilai Terendah</div>
              <div class="text-3xl font-bold mt-1">{stats.lowestScore}%</div>
            </div>
            <div class="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-green-100 text-xs font-medium uppercase tracking-wider">Lulus</div>
              <div class="text-3xl font-bold mt-1">{stats.passedCount}</div>
            </div>
            <div class="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-amber-100 text-xs font-medium uppercase tracking-wider">Perlu Dinilai</div>
              <div class="text-3xl font-bold mt-1">{stats.pendingGrading}</div>
            </div>
            <div class="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Results Table -->
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div class="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 class="text-xl font-bold text-gray-800">Daftar Nilai Siswa</h2>
            <p class="text-gray-500 text-sm mt-0.5">
              {stats.totalStudents} siswa ditemukan
            </p>
          </div>
          <div class="flex items-center space-x-3">
            {#if selectedResults.size > 0}
              <div class="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">
                {selectedResults.size} dipilih
              </div>
            {/if}
            <button
              on:click={openBulkResetModal}
              disabled={selectedResults.size === 0 && !selectedUjian}
              class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {selectedResults.size > 0 ? 'Reset Dipilih' : 'Reset Semua'}
            </button>
          </div>
        </div>

        {#if results.filter(r => !selectedUjian || r.ujian_id === parseInt(selectedUjian)).length === 0}
          <div class="p-12 flex flex-col items-center justify-center">
            <div class="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
              <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-800 mb-1">Belum Ada Data</h3>
            <p class="text-gray-500">Belum ada hasil ujian untuk ditampilkan</p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-4 text-center w-12">
                    <input
                      type="checkbox"
                      checked={selectedResults.size === results.filter(r => !selectedUjian || r.ujian_id === parseInt(selectedUjian)).length && results.filter(r => !selectedUjian || r.ujian_id === parseInt(selectedUjian)).length > 0}
                      on:change={toggleSelectAll}
                      class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Siswa</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ujian</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tanggal</th>
                  <th class="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Nilai</th>
                  <th class="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Grade</th>
                  <th class="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-100">
                {#each results.filter(r => !selectedUjian || r.ujian_id === parseInt(selectedUjian)) as result}
                  {@const statusBadge = getStatusBadge(result.manual_grade_status)}
                  {@const finalPercentage = parseFloat(Number(result.skor || 0).toFixed(1))}
                  
                  <tr class="hover:bg-gray-50 transition-colors duration-150">
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        checked={selectedResults.has(result.id)}
                        on:change={() => toggleSelectResult(result.id)}
                        class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {result.user_nama ? result.user_nama.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div class="ml-3">
                          <div class="text-sm font-semibold text-gray-900">{result.user_nama}</div>
                          <div class="text-xs text-gray-500">{result.user_email}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-medium text-gray-900">{result.ujian_judul}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div class="flex items-center">
                        <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        {new Date(result.waktu_selesai).toLocaleDateString('id-ID', { 
                          day: 'numeric', 
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-center">
                        <div class="text-xl font-bold {finalPercentage >= 70 ? 'text-green-600' : 'text-red-600'}">
                          {finalPercentage}%
                        </div>
                        <div class="text-xs text-gray-500 mt-0.5">
                          {result.passed ? 'Lulus' : 'Tidak Lulus'}
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                      <span class="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full {getGradeColor(result.grade || 'C')}">
                        {result.grade || 'C'}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                      <span class="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full {statusBadge.class}">
                        {statusBadge.text}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                      <a 
                        href="/student/{result.user_id}"
                        class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
                      >
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Detail
                      </a>
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

  <!-- Bulk Reset Modal -->
  {#if showBulkResetModal}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in">
        <div class="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
          <div class="flex items-center justify-center">
            <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h3 class="text-xl font-bold text-white text-center mt-3">
            {selectedResults.size > 0 ? 'Reset Hasil Ujian Dipilih?' : 'Reset Semua Hasil Ujian?'}
          </h3>
        </div>
        
        <div class="p-6">
          <p class="text-gray-600 text-sm text-center mb-6">
            {selectedResults.size > 0
              ? `Anda akan mereset ${selectedResults.size} hasil ujian yang dipilih.`
              : `Anda akan mereset SEMUA hasil ujian${selectedUjian ? ' untuk ujian yang dipilih' : ''}.`}
          </p>

          <!-- Reset Type Selection -->
          <div class="mb-6">
            <label class="block text-sm font-semibold text-gray-700 mb-3">Jenis Reset:</label>
            <div class="space-y-3">
              <label class="flex items-start p-4 border-2 border-red-200 rounded-xl cursor-pointer hover:bg-red-50 transition-all duration-200">
                <input
                  type="radio"
                  name="reset_type"
                  checked={bulkResetType === 'all'}
                  on:change={() => bulkResetType = 'all'}
                  class="w-4 h-4 text-red-600 focus:ring-red-500 mt-1 cursor-pointer"
                />
                <div class="ml-3">
                  <div class="text-sm font-semibold text-gray-900">Reset Semua (Hapus Hasil Ujian)</div>
                  <div class="text-xs text-gray-600 mt-1">
                    Semua hasil ujian akan dihapus. Siswa dapat mengerjakan ulang ujian ini.
                  </div>
                </div>
              </label>

              <label class="flex items-start p-4 border-2 border-amber-200 rounded-xl cursor-pointer hover:bg-amber-50 transition-all duration-200">
                <input
                  type="radio"
                  name="reset_type"
                  checked={bulkResetType === 'essay_only'}
                  on:change={() => bulkResetType = 'essay_only'}
                  class="w-4 h-4 text-amber-600 focus:ring-amber-500 mt-1 cursor-pointer"
                />
                <div class="ml-3">
                  <div class="text-sm font-semibold text-gray-900">Reset Nilai Essay Saja</div>
                  <div class="text-xs text-gray-600 mt-1">
                    Hanya nilai essay yang direset. Nilai pilihan ganda tetap dipertahankan.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div class="flex space-x-3">
            <button
              on:click={closeBulkResetModal}
              disabled={bulkResetLoading}
              class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-300 disabled:opacity-50 transition-all"
            >
              Batal
            </button>
            <button
              on:click={selectedResults.size > 0 ? executeBulkReset : executeBulkResetExam}
              disabled={bulkResetLoading}
              class="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-xl hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {#if bulkResetLoading}
                <svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Memproses...
              {:else}
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Ya, Reset
              {/if}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}


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
</style>