<script>
  import { onMount, onDestroy } from 'svelte';
  import { tick } from 'svelte';
  import { fetchWithAuth } from '$lib/api';
  import { dashboardStats, isLoading } from '../../stores/statsStore';
  import toast from '../../lib/toast';
  import Chart from 'chart.js/auto';

  let stats = null;
  let chartCanvas;
  let chartInstance;

  // Function to fetch dashboard statistics
  async function fetchDashboardStats() {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return;

    isLoading.set(true);
    
    try {
      const [usersRes, examsRes, resultsRes] = await Promise.all([
        fetchWithAuth('/users?limit=1000'),
        fetchWithAuth('/ujian'),
        fetchWithAuth('/hasil')
      ]);

      const users = usersRes?.data || usersRes || [];
      const exams = examsRes?.data || examsRes || [];
      const results = resultsRes?.data || resultsRes || [];

      dashboardStats.set({
        totalStudents: users.filter(u => u.role === 'siswa')?.length || 0,
        totalExams: exams?.length || 0,
        activeExams: exams.filter(e => e.status === 'aktif')?.length || 0,
        recentResults: results
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5) || []
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Gagal memuat data dashboard.');
    } finally {
      isLoading.set(false);
    }

    // Fetch statistics separately so it doesn't block main dashboard
    try {
      const statsRes = await fetchWithAuth('/statistics');
      console.log('Statistics response:', statsRes);
      stats = statsRes;
    } catch (error) {
      console.error('Error fetching statistics:', error);
      // Don't show error toast for statistics to avoid disturbing user
    }
  }

  function renderChart() {
    if (!stats || !chartCanvas) {
      console.log('Cannot render chart: stats=', stats, 'chartCanvas=', chartCanvas);
      return;
    }
    if (chartInstance) chartInstance.destroy();

    const ctx = chartCanvas.getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Siswa', 'Guru/Admin', 'Kelas', 'Ujian', 'Soal'],
        datasets: [{
          label: 'Data Sistem',
          data: [
            stats.totalStudents,
            stats.totalAdminsAndGurus,
            stats.totalKelas,
            stats.totalUjian,
            stats.totalSoal
          ],
          backgroundColor: [
            'rgba(99, 102, 241, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 10,
            cornerRadius: 8,
            titleColor: '#fff',
            bodyColor: '#e5e7eb'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0, 0, 0, 0.05)', drawBorder: false },
            ticks: { stepSize: 1 }
          },
          x: {
            grid: { display: false },
            ticks: { font: { weight: '500' } }
          }
        }
      }
    });
  }

  // Reactive statement - render chart when stats or chartCanvas is available
  $: if (stats && chartCanvas) {
    renderChart();
  }

  onMount(async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return;
    document.body.classList.add('admin-layout');
    await fetchDashboardStats();
  });

  onDestroy(() => {
    document.body.classList.remove('admin-layout');
    if (chartInstance) chartInstance.destroy();
  });
</script>


  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      <!-- Header Section -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div class="inline-flex items-center space-x-2 text-sm text-indigo-600 mb-2">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
              <span>Selamat Datang</span>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p class="text-gray-600 mt-1">Statistik dan informasi terkini sistem ujian online</p>
          </div>
          <button 
            on:click={fetchDashboardStats}
            disabled={$isLoading}
            class="group px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
          >
            <svg class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {$isLoading ? 'Memuat...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      <!-- Stats Cards - Row 1 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <!-- Total Students -->
        <div class="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
          <div class="h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          <div class="p-5">
            <div class="flex items-center justify-between">
              <div class="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div class="text-right">
                <p class="text-3xl font-bold text-gray-800">{$dashboardStats.totalStudents}</p>
                <p class="text-sm text-gray-500 mt-1">Siswa Terdaftar</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Total Exams -->
        <div class="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
          <div class="h-1 bg-gradient-to-r from-green-500 to-emerald-600"></div>
          <div class="p-5">
            <div class="flex items-center justify-between">
              <div class="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div class="text-right">
                <p class="text-3xl font-bold text-gray-800">{$dashboardStats.totalExams}</p>
                <p class="text-sm text-gray-500 mt-1">Total Ujian</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Active Exams -->
        <div class="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
          <div class="h-1 bg-gradient-to-r from-amber-500 to-orange-600"></div>
          <div class="p-5">
            <div class="flex items-center justify-between">
              <div class="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="text-right">
                <p class="text-3xl font-bold text-gray-800">{$dashboardStats.activeExams}</p>
                <p class="text-sm text-gray-500 mt-1">Ujian Aktif</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Results Count -->
        <div class="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
          <div class="h-1 bg-gradient-to-r from-purple-500 to-pink-600"></div>
          <div class="p-5">
            <div class="flex items-center justify-between">
              <div class="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div class="text-right">
                <p class="text-3xl font-bold text-gray-800">{$dashboardStats.recentResults.length}</p>
                <p class="text-sm text-gray-500 mt-1">Hasil Terbaru</p>
              </div>
            </div>
          </div>
        </div>
      </div>

        <!-- Statistics API Cards - Row 2 -->
        {#if stats}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <!-- Guru/Admin -->
            <div class="bg-white rounded-2xl shadow-lg p-5 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div class="flex items-center justify-between">
                <div class="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div class="text-right">
                  <p class="text-3xl font-bold text-gray-800">{stats.totalAdminsAndGurus || 0}</p>
                  <p class="text-sm text-gray-500 mt-1">Guru/Admin</p>
                </div>
              </div>
            </div>

            <!-- Total Kelas -->
            <div class="bg-white rounded-2xl shadow-lg p-5 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div class="flex items-center justify-between">
                <div class="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div class="text-right">
                  <p class="text-3xl font-bold text-gray-800">{stats.totalKelas || 0}</p>
                  <p class="text-sm text-gray-500 mt-1">Total Kelas</p>
                </div>
              </div>
            </div>

            <!-- Total Soal -->
            <div class="bg-white rounded-2xl shadow-lg p-5 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div class="flex items-center justify-between">
                <div class="p-3 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div class="text-right">
                  <p class="text-3xl font-bold text-gray-800">{stats.totalSoal || 0}</p>
                  <p class="text-sm text-gray-500 mt-1">Total Soal</p>
                </div>
              </div>
            </div>

            <!-- Rata-rata Nilai -->
            <div class="bg-white rounded-2xl shadow-lg p-5 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div class="flex items-center justify-between">
                <div class="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 text-white shadow-lg">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div class="text-right">
                  <p class="text-3xl font-bold text-gray-800">{(stats.averageScore || 0).toFixed(1)}</p>
                  <p class="text-sm text-gray-500 mt-1">Rata-rata Nilai</p>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Statistics Charts & Info -->
        {#if stats}
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <!-- Chart Card -->
            <div class="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
              <div class="flex items-center space-x-3 mb-5 pb-3 border-b border-gray-200">
                <div class="p-2 bg-indigo-100 rounded-xl">
                  <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 class="text-lg font-bold text-gray-800">Ringkasan Sistem</h2>
              </div>
              <div class="h-80">
                <canvas bind:this={chartCanvas}></canvas>
              </div>
            </div>

            <!-- Exam Stats Card -->
            <div class="bg-white rounded-2xl shadow-lg p-6">
              <div class="flex items-center space-x-3 mb-5 pb-3 border-b border-gray-200">
                <div class="p-2 bg-green-100 rounded-xl">
                  <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h2 class="text-lg font-bold text-gray-800">Statistik Ujian</h2>
              </div>
              <div class="space-y-4">
                <div class="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <span class="text-gray-600 font-medium">Rata-rata Nilai</span>
                  <span class="font-bold text-indigo-600 text-2xl">{stats.averageScore ? stats.averageScore.toFixed(2) : '0'}</span>
                </div>
                <div class="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                  <span class="text-gray-600 font-medium">Ujian Populer</span>
                  <span class="font-bold text-gray-800 truncate max-w-[150px]">{stats.mostPopularUjian?.judul || '-'}</span>
                </div>
                <div class="flex justify-between items-center p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
                  <span class="text-gray-600 font-medium">Total Submission</span>
                  <span class="font-bold text-gray-800 text-xl">{stats.mostPopularUjian?.submission_count || '0'}</span>
                </div>
              </div>
            </div>

            <!-- User Engagement Card -->
            <div class="bg-white rounded-2xl shadow-lg p-6">
              <div class="flex items-center space-x-3 mb-5 pb-3 border-b border-gray-200">
                <div class="p-2 bg-purple-100 rounded-xl">
                  <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 class="text-lg font-bold text-gray-800">Siswa Teraktif</h2>
              </div>
              <div class="flex items-center space-x-5 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                <div class="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                  {stats.mostActiveStudent?.nama?.charAt(0).toUpperCase() || '?'}
                </div>
                <div class="flex-1">
                  <p class="font-bold text-gray-800 text-lg">{stats.mostActiveStudent?.nama || 'N/A'}</p>
                  <div class="flex items-center mt-2 text-sm text-gray-500">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>{stats.mostActiveStudent?.exam_count || 0} Ujian diikuti</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}

      <!-- Recent Results Section -->
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div class="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div class="flex items-center space-x-3">
            <div class="p-2 bg-indigo-100 rounded-xl">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-800">Hasil Ujian Terbaru</h2>
              <p class="text-gray-500 text-sm mt-0.5">Data hasil ujian terbaru dari siswa</p>
            </div>
          </div>
        </div>
        
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nama Siswa</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ujian</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Skor</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tanggal</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100">
              {#if $dashboardStats.recentResults.length > 0}
                {#each $dashboardStats.recentResults as result}
                  <tr class="hover:bg-gray-50 transition-colors duration-150">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                          {result.user_nama?.charAt(0).toUpperCase() || 'S'}
                        </div>
                        <div class="ml-3">
                          <div class="text-sm font-semibold text-gray-900">{result.user_nama}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-700">{result.ujian_judul}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-700">
                        {Math.round(result.skor)}%
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center text-sm text-gray-500">
                        <svg class="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        {new Date(result.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </td>
                  </tr>
                {/each}
              {:else}
                <tr>
                  <td colspan="4" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center">
                      <div class="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                        <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 class="text-lg font-semibold text-gray-800 mb-1">Tidak ada data hasil ujian</h3>
                      <p class="text-gray-500">Belum ada hasil ujian yang tersedia saat ini</p>
                    </div>
                  </td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>


<style>
  /* No additional styles needed - using Tailwind utilities */
</style>