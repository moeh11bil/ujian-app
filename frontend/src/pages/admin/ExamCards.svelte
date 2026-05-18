<script>
  import { onMount } from 'svelte';
  import { fetchWithAuth, downloadClassExamCards, downloadAllExamCards, exportStudentsWithPasswords, getExamCardInfo } from '$lib/api';
  import toast from '$lib/toast.js';

  let classes = [];
  let selectedClass = null;
  let classInfo = null;
  let includePassword = false;
  let searchQuery = '';

  $: filteredClasses = classes.filter(c => 
    c.nama_kelas.toLowerCase().includes(searchQuery.toLowerCase())
  );

  onMount(async () => {
    await loadClasses();
  });

  async function loadClasses() {
    try {
      const response = await fetchWithAuth('/kelas?limit=1000');
      classes = response?.data || response || [];
    } catch (error) {
      toast.error('Gagal memuat data kelas');
      console.error(error);
    }
  }

  async function loadClassInfo(kelasId) {
    try {
      classInfo = await getExamCardInfo(kelasId);
    } catch (error) {
      toast.error('Gagal memuat informasi kelas');
      console.error(error);
    }
  }

  async function handleSelectClass(kelas) {
    selectedClass = kelas;
    classInfo = null;
    await loadClassInfo(kelas.id);
  }

  async function handleDownloadClassCards() {
    if (!selectedClass) {
      toast.warning('Pilih kelas terlebih dahulu');
      return;
    }

    try {
      await downloadClassExamCards(selectedClass.id, includePassword);
      toast.success(`Kartu ujian kelas ${selectedClass.nama_kelas} berhasil diunduh`);
    } catch (error) {
      toast.error(error.message || 'Gagal mengunduh kartu ujian');
    }
  }

  async function handleDownloadAllCards() {
    try {
      await downloadAllExamCards(includePassword);
      toast.success('Semua kartu ujian berhasil diunduh');
    } catch (error) {
      toast.error(error.message || 'Gagal mengunduh kartu ujian');
    }
  }

  async function handleExportPasswords() {
    try {
      await exportStudentsWithPasswords();
      toast.success('Data siswa dengan password berhasil diekspor');
    } catch (error) {
      toast.error(error.message || 'Gagal mengekspor data');
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
</script>


  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      <!-- Header Section -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20">
        <div class="flex items-center space-x-4">
          <div class="p-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <div class="inline-flex items-center space-x-2 text-sm text-indigo-600 mb-1">
              <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
              <span>Generate & Download</span>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Kartu Ujian Siswa
            </h1>
            <p class="text-gray-600 mt-1">Generate dan unduh kartu ujian untuk semua siswa</p>
          </div>
        </div>
      </div>

      <!-- Action Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <!-- Download All Cards -->
        <div class="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
          <div class="h-1 bg-gradient-to-r from-blue-500 to-cyan-600"></div>
          <div class="p-6">
            <div class="flex items-center space-x-3 mb-4">
              <div class="p-2 bg-blue-100 rounded-xl">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                </svg>
              </div>
              <h3 class="text-lg font-bold text-gray-800">Semua Kartu Ujian</h3>
            </div>
            <p class="text-sm text-gray-600 mb-5">Unduh semua kartu ujian dari semua kelas dalam satu file PDF</p>
            <button
              on:click={handleDownloadAllCards}
              class="w-full py-2.5 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-[1.02] inline-flex items-center justify-center"
            >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Unduh Semua
            </button>
          </div>
        </div>

        <!-- Export Passwords -->
        <div class="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
          <div class="h-1 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
          <div class="p-6">
            <div class="flex items-center space-x-3 mb-4">
              <div class="p-2 bg-emerald-100 rounded-xl">
                <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <h3 class="text-lg font-bold text-gray-800">Data + Password</h3>
            </div>
            <p class="text-sm text-gray-600 mb-5">Ekspor data semua siswa lengkap dengan password login (Excel)</p>
            <button
              on:click={handleExportPasswords}
              class="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-[1.02] inline-flex items-center justify-center"
            >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Ekspor Excel
            </button>
          </div>
        </div>

        <!-- Options -->
        <div class="bg-white rounded-2xl shadow-lg p-6">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-purple-100 rounded-xl">
              <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <h3 class="text-lg font-bold text-gray-800">Pengaturan</h3>
          </div>
          <div class="space-y-3">
            <label class="flex items-center space-x-3 cursor-pointer">
              <input 
                type="checkbox" 
                bind:checked={includePassword}
                class="w-5 h-5 text-indigo-600 bg-gray-100 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <span class="text-sm text-gray-700 font-medium">Sertakan password di kartu</span>
            </label>
            <div class="p-3 bg-gray-50 rounded-xl">
              <p class="text-xs text-gray-500 flex items-center">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {#if includePassword}
                  Password akan ditampilkan di kartu ujian
                {:else}
                  Password tidak ditampilkan (hanya untuk referensi visual)
                {/if}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Class Selection -->
      <div class="bg-white rounded-2xl shadow-lg mb-8 overflow-hidden">
        <div class="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div class="flex items-center space-x-3">
            <div class="p-2 bg-indigo-100 rounded-xl">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
            </div>
            <h2 class="text-xl font-bold text-gray-800">Pilih Kelas</h2>
          </div>
        </div>
        
        <div class="p-6">
          <!-- Search -->
          <div class="relative mb-5">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Cari kelas..."
              class="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            />
          </div>

          <!-- Class List -->
          {#if filteredClasses.length === 0}
            <div class="text-center py-12">
              <div class="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                </svg>
              </div>
              <p class="text-gray-500">Tidak ada kelas ditemukan</p>
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {#each filteredClasses as kelas}
                <button
                  on:click={() => handleSelectClass(kelas)}
                  class="group text-left p-4 border-2 rounded-xl transition-all duration-300 {selectedClass && selectedClass.id === kelas.id ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'}"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <h3 class="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{kelas.nama_kelas}</h3>
                      {#if kelas.deskripsi}
                        <p class="text-sm text-gray-500 mt-1 truncate">{kelas.deskripsi}</p>
                      {/if}
                    </div>
                    {#if selectedClass && selectedClass.id === kelas.id}
                      <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                      </svg>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Class Info & Download -->
      {#if selectedClass && classInfo}
        <div class="bg-white rounded-2xl shadow-lg overflow-hidden animate-fade-in-up">
          <div class="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          
          <div class="p-6">
            <div class="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-200">
              <div class="p-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <h2 class="text-xl font-bold text-gray-800">
                Kartu Ujian: {classInfo.kelas.nama_kelas}
              </h2>
            </div>

            <!-- Info Summary -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div class="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-blue-600 mb-1 font-medium">Total Siswa</p>
                    <p class="text-3xl font-bold text-blue-700">{classInfo.studentCount}</p>
                  </div>
                  <div class="p-2 bg-white rounded-lg shadow-sm">
                    <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                    </svg>
                  </div>
                </div>
              </div>
              
              <div class="bg-gradient-to-r from-green-50 to-emerald-100 rounded-xl p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-green-600 mb-1 font-medium">Ujian Aktif</p>
                    <p class="text-3xl font-bold text-green-700">{classInfo.examCount}</p>
                  </div>
                  <div class="p-2 bg-white rounded-lg shadow-sm">
                    <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                    </svg>
                  </div>
                </div>
              </div>
              
              <div class="bg-gradient-to-r from-purple-50 to-pink-100 rounded-xl p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-purple-600 mb-1 font-medium">Format File</p>
                    <p class="text-3xl font-bold text-purple-700">PDF</p>
                  </div>
                  <div class="p-2 bg-white rounded-lg shadow-sm">
                    <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- Available Exams -->
            {#if classInfo.exams && classInfo.exams.length > 0}
              <div class="mb-6">
                <h3 class="font-semibold text-gray-800 mb-3 flex items-center">
                  <svg class="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Ujian Tersedia:
                </h3>
                <div class="space-y-2">
                  {#each classInfo.exams as exam}
                    <div class="flex items-center justify-between bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors">
                      <div>
                        <p class="font-medium text-gray-800">{exam.judul}</p>
                        <div class="flex items-center space-x-3 mt-1">
                          <p class="text-xs text-gray-500 flex items-center">
                            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            Durasi: {exam.durasi} menit
                          </p>
                        </div>
                      </div>
                      <div class="text-right">
                        <p class="text-sm text-gray-600">{exam.periode}</p>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {:else}
              <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <div class="flex items-center space-x-2">
                  <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <p class="text-amber-800 font-medium">Belum ada ujian aktif untuk kelas ini</p>
                </div>
              </div>
            {/if}

            <!-- Download Button -->
            <button
              on:click={handleDownloadClassCards}
              disabled={classInfo.studentCount === 0}
              class="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center text-lg font-semibold"
            >
              {#if classInfo.studentCount === 0}
                Tidak Ada Siswa
              {:else}
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Unduh {classInfo.studentCount} Kartu Ujian
              {/if}
            </button>

            <p class="text-sm text-gray-500 mt-3 text-center">
              File PDF akan berisi kartu ujian untuk semua {classInfo.studentCount} siswa di kelas {classInfo.kelas.nama_kelas}
            </p>
          </div>
        </div>
      {/if}

      <!-- Help Section -->
      <div class="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 mt-8 border border-blue-100">
        <div class="flex items-start space-x-3">
          <div class="p-2 bg-white rounded-xl shadow-sm">
            <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-gray-900 mb-3">💡 Petunjuk Penggunaan</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
              <ul class="space-y-2">
                <li class="flex items-start">
                  <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 mr-2"></span>
                  <span><strong>Unduh Semua:</strong> Generate kartu ujian untuk seluruh siswa dari semua kelas</span>
                </li>
                <li class="flex items-start">
                  <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 mr-2"></span>
                  <span><strong>Data + Password:</strong> Ekspor data siswa lengkap dengan password dalam format Excel</span>
                </li>
                <li class="flex items-start">
                  <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 mr-2"></span>
                  <span><strong>Pilih Kelas:</strong> Pilih kelas tertentu untuk generate kartu ujian</span>
                </li>
              </ul>
              <ul class="space-y-2">
                <li class="flex items-start">
                  <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 mr-2"></span>
                  <span>Kartu ujian berisi: NIS, Nama, Email, Kelas, Password, dan Daftar Ujian</span>
                </li>
                <li class="flex items-start">
                  <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 mr-2"></span>
                  <span>Setiap kartu memiliki kode verifikasi unik untuk keabsahan</span>
                </li>
                <li class="flex items-start">
                  <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 mr-2"></span>
                  <span>Kartu harus dibawa saat mengikuti ujian</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>


<style>
  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fade-in-up {
    animation: fade-in-up 0.4s ease-out forwards;
  }
</style>