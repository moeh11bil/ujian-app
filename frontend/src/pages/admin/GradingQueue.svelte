<script>
  import { onMount, onDestroy } from 'svelte';
  import { apiFetch } from '$lib/api';
  import toast from '../../lib/toast';
  import { Link } from 'svelte-routing';


  let gradingQueue = [];
  let stats = {
    belum_diperiksa: 0,
    selesai_diperiksa: 0
  };

  let pagination = {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  };

  let filterStatus = '';
  let filterUjian = '';
  let ujianList = [];

  async function fetchStats() {
    try {
      const data = await apiFetch('/essay-grading/grading-stats');
      stats = {
        belum_diperiksa: (parseInt(data.pending) || 0) + (parseInt(data.partial) || 0),
        selesai_diperiksa: parseInt(data.completed) || 0
      };
    } catch (error) {
      console.error('Failed to fetch stats:', error);
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

  async function fetchGradingQueue() {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });
      
      if (filterStatus) params.append('status', filterStatus);
      if (filterUjian) params.append('ujian_id', filterUjian);

      const data = await apiFetch(`/essay-grading/grading-queue?${params.toString()}`);
      gradingQueue = data.data;
      pagination = data.pagination;
    } catch (error) {
      toast.push({ 
        type: 'error', 
        message: `Gagal memuat antrian: ${error.message}` 
      });
    }
  }

  onMount(() => {
    document.body.classList.add('admin-layout');
    fetchStats();
    fetchUjianList();
    fetchGradingQueue();
  });

  onDestroy(() => {
    document.body.classList.remove('admin-layout');
  });

  function handleFilterChange() {
    pagination.page = 1;
    fetchGradingQueue();
  }

  function handlePageChange(newPage) {
    pagination.page = newPage;
    fetchGradingQueue();
  }

  function getStatusBadgeClass(status) {
    if (status === 'pending' || status === 'partial') return 'bg-amber-100 text-amber-700';
    if (status === 'completed') return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-700';
  }

  function getStatusLabel(status) {
    const labels = {
      'pending': 'Belum Diperiksa',
      'partial': 'Belum Diperiksa',
      'completed': 'Selesai Diperiksa'
    };
    return labels[status] || status;
  }

  function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Baru saja';
    if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari yang lalu`;
  }
</script>


  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      <!-- Header Section -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20">
        <div class="flex items-center space-x-4">
          <div class="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <div class="inline-flex items-center space-x-2 text-sm text-purple-600 mb-1">
              <span class="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
              <span>Penilaian Essay</span>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Antrian Penilaian Essay
            </h1>
            <p class="text-gray-600 mt-1">Kelola dan periksa jawaban essay siswa</p>
          </div>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-amber-100 text-sm font-medium uppercase tracking-wider">Belum Diperiksa</p>
              <p class="text-5xl font-bold mt-2">{stats.belum_diperiksa}</p>
            </div>
            <div class="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
              <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-green-100 text-sm font-medium uppercase tracking-wider">Selesai Diperiksa</p>
              <p class="text-5xl font-bold mt-2">{stats.selesai_diperiksa}</p>
            </div>
            <div class="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
              <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters Section -->
      <div class="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <div class="flex items-center space-x-3 mb-4">
          <div class="p-2 bg-indigo-100 rounded-lg">
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
            </svg>
          </div>
          <label class="block text-sm font-semibold text-gray-700">Filter Data</label>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              bind:value={filterStatus}
              on:change={handleFilterChange}
              class="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            >
              <option value="">Semua Status</option>
              <option value="pending">Belum Diperiksa</option>
              <option value="completed">Selesai Diperiksa</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Ujian</label>
            <select 
              bind:value={filterUjian} 
              on:change={handleFilterChange}
              class="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            >
              <option value="">Semua Ujian</option>
              {#each ujianList as ujian}
                <option value={ujian.id}>{ujian.judul}</option>
              {/each}
            </select>
          </div>

          <div class="flex items-end">
            <button 
              on:click={fetchGradingQueue}
              class="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 flex items-center justify-center"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <!-- Queue Table -->
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div class="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div class="flex items-center space-x-3">
            <div class="p-2 bg-indigo-100 rounded-xl">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-800">Daftar Antrian Penilaian</h2>
              <p class="text-gray-500 text-sm mt-0.5">
                {pagination.total > 0 
                  ? `Menampilkan ${gradingQueue.length} dari ${pagination.total} antrian` 
                  : 'Tidak ada antrian'}
              </p>
            </div>
          </div>
        </div>

        {#if gradingQueue.length === 0}
          <div class="p-12 flex flex-col items-center justify-center">
            <div class="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
              <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-800 mb-1">Tidak Ada Antrian</h3>
            <p class="text-gray-500">Semua essay telah diperiksa atau belum ada submission</p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Siswa</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ujian</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Progress</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Waktu Submit</th>
                  <th class="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-100">
                {#each gradingQueue as submission}
                  <tr class="hover:bg-gray-50 transition-colors duration-150">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {submission.student_name.charAt(0).toUpperCase()}
                        </div>
                        <div class="ml-3">
                          <div class="text-sm font-semibold text-gray-900">{submission.student_name}</div>
                          <div class="text-xs text-gray-500">{submission.student_email}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <div class="text-sm font-semibold text-gray-900">{submission.ujian_judul}</div>
                      <div class="flex items-center text-xs text-gray-500 mt-0.5">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Durasi: {submission.durasi} menit
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full {getStatusBadgeClass(submission.manual_grade_status)}">
                        {getStatusLabel(submission.manual_grade_status)}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center space-x-2">
                        <div class="flex-1 bg-gray-200 rounded-full h-2.5 min-w-[100px]">
                          <div 
                            class="bg-gradient-to-r from-indigo-500 to-purple-600 h-2.5 rounded-full transition-all duration-500"
                            style="width: {(submission.graded_essay_count / submission.total_essay_questions) * 100}%"
                          ></div>
                        </div>
                        <span class="text-xs font-medium text-gray-600">
                          {submission.graded_essay_count}/{submission.total_essay_questions}
                        </span>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center text-sm text-gray-600">
                        <svg class="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        {formatTimeAgo(submission.submitted_at)}
                      </div>
                      <div class="text-xs text-gray-400 mt-0.5">
                        {new Date(submission.submitted_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                      <a
                        href="/grading/{submission.hasil_id}"
                        class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
                      >
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Nilai Essay
                      </a>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          {#if pagination.totalPages > 1}
            <div class="px-6 py-4 border-t border-gray-100 bg-gray-50">
              <div class="flex flex-col sm:flex-row justify-between items-center gap-3">
                <div class="text-sm text-gray-600">
                  Halaman {pagination.page} dari {pagination.totalPages}
                </div>
                <div class="flex space-x-2">
                  <button
                    on:click={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    class="px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
                  >
                    <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Sebelumnya
                  </button>
                  <button
                    on:click={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    class="px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
                  >
                    Selanjutnya
                    <svg class="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>


<style>
  /* No additional styles needed - using Tailwind utilities */
</style>