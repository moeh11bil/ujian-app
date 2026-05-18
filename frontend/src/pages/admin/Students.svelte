<script lang="ts">
  import { user, token } from '../../stores/authStore';
  import { onMount, onDestroy } from 'svelte';
  import { fetchWithAuth, apiFetch } from '$lib/api';
  import toast from '../../lib/toast.js';
  import Modal from '../../components/Modal.svelte';
  import ToastContainer from '../../components/ToastContainer.svelte';

  // Variables for confirmation modal
  let showConfirmModal = false;
  let confirmCallback: any = null;
  let confirmMessage = '';

  // Variables for bulk operations modal
  let showBulkModal = false;
  let usersFile: any = null;

  function showConfirmation(message: string, callback: any) {
    confirmMessage = message;
    confirmCallback = callback;
    showConfirmModal = true;
  }

  async function confirmAction() {
    if (confirmCallback) {
      await confirmCallback();
    }
    hideConfirmation();
  }

  function hideConfirmation() {
    showConfirmModal = false;
    confirmCallback = null;
    confirmMessage = '';
  }

  function showBulkOperations() {
    showBulkModal = true;
  }

  function hideBulkModal() {
    showBulkModal = false;
    usersFile = null;
  }

  function handleUsersFile(e: any) {
    usersFile = e.target.files[0];
  }

  async function bulkImport() {
    if (!usersFile) {
      toast.error('Silakan pilih file Excel terlebih dahulu');
      return;
    }

    const formData = new FormData();
    formData.append('file', usersFile);

    try {
      const response: any = await apiFetch('/bulk/import/users', {
        method: 'POST',
        body: formData
      });

      toast.success(response.message || 'Data siswa berhasil diimpor');
      hideBulkModal();
      await fetchStudents();
    } catch (error: any) {
      console.error('Import error:', error);
      console.error('Error message:', error.message);
      toast.error(`Gagal mengimpor siswa: ${error.message}`);
    } finally {
      usersFile = null;
    }
  }

  async function handleExport(endpoint: string) {
    try {
      await apiFetch(endpoint);
      toast.success('Data berhasil diekspor');
    } catch (error: any) {
       toast.error(`Gagal mengekspor data: ${error.message}`);
    }
  }

  let students: any[] = [];
  let classes: any[] = [];
  let error = '';
  let searchTerm = '';
  let selectedClass = '';
  let currentPage = 1;
  let totalPages = 1;
  let limit = 20;
  let searchTimeout: any;
  let selectedStudents: number[] = [];
  let selectAll = false;

  function toggleSelectAll() {
    selectAll = !selectAll;
    selectedStudents = selectAll ? students.map(s => s.id) : [];
  }

  function toggleStudent(id: number) {
    if (selectedStudents.includes(id)) {
      selectedStudents = selectedStudents.filter(s => s !== id);
    } else {
      selectedStudents = [...selectedStudents, id];
    }
    selectAll = selectedStudents.length === students.length && students.length > 0;
  }

  async function bulkDeleteStudents() {
    if (selectedStudents.length === 0) return;
    const ids = selectedStudents;
    showConfirmation(`Apakah Anda yakin ingin menghapus ${ids.length} siswa?`, async () => {
      try {
        await apiFetch('/users/bulk-delete', {
          method: 'POST',
          body: { ids }
        });
        toast.success(`${ids.length} siswa berhasil dihapus`);
        selectedStudents = [];
        selectAll = false;
        await fetchStudents();
      } catch (error: any) {
        toast.error(error.message || 'Gagal menghapus siswa');
      }
    });
  }

  // Modal states
  let showAddModal = false;
  let showEditModal = false;
  let studentToEdit: any = null;

  // Form states
  let formData = {
    nama: '',
    nisn: '',
    no_peserta: '',
    password: '',
    role: 'siswa',
    kelas_id: ''
  };

  $: filteredStudents = students;

  let isInitialized = false;

  // Handle search input changes
  function onSearchChange() {
    if (isInitialized) {
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        fetchStudents(1);
      }, 500);
    }
  }

  // Handle class selection changes
  function onClassChange() {
    if (isInitialized) {
      fetchStudents(1);
    }
  }

  onMount(async () => {
    await Promise.all([
      fetchStudents(),
      fetchClasses()
    ]);
    isInitialized = true;
  });

  async function fetchStudents(page = 1) {
    try {
      const response: any = await apiFetch(`/users?role=siswa&limit=${limit}&page=${page}&search=${encodeURIComponent(searchTerm)}&kelas_id=${selectedClass}`);
      students = response?.data || [];
      currentPage = response?.pagination?.page || page;
      totalPages = response?.pagination?.totalPages || 1;
    } catch (err: any) {
      console.error('Error fetching students:', err);
      error = err.message || 'Terjadi kesalahan saat mengambil data siswa';
      students = [];
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      fetchStudents(page);
    }
  }

  function getPageNumbers() {
    const pages = [];
    const delta = 1;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    const leftEdge = 1;
    const rightEdge = totalPages;
    const leftStart = currentPage - delta;
    const rightEnd = currentPage + delta;

    if (leftStart > 2) {
      pages.push(leftEdge);
      pages.push('...');
    } else if (leftStart === 2) {
      pages.push(1);
    }

    const start = Math.max(leftStart, 2);
    const end = Math.min(rightEnd, totalPages - 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (rightEnd < totalPages - 1) {
      pages.push('...');
      pages.push(rightEdge);
    } else if (rightEnd === totalPages - 1) {
      pages.push(totalPages);
    }

    return pages;
  }

  async function fetchClasses() {
    try {
      const response: any = await apiFetch('/kelas?limit=1000');
      classes = response?.data || response || [];
    } catch (err: any) {
      console.error('Error fetching classes:', err);
    }
  }

  function openAddModal() {
    formData = {
      nama: '',
      nisn: '',
      no_peserta: '',
      password: '',
      role: 'siswa',
      kelas_id: ''
    };
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
  }

  function openEditModal(student: any) {
    studentToEdit = student;
    formData = {
      nama: student.nama,
      nisn: student.nisn || '',
      no_peserta: student.no_peserta || '',
      password: '',
      role: 'siswa',
      kelas_id: student.kelas_id || ''
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    studentToEdit = null;
  }

  async function addStudent() {
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: formData
      });
      
      toast.success('Siswa berhasil ditambahkan');
      closeAddModal();
      await fetchStudents();
    } catch (error: any) {
      console.error('Error adding student:', error);
      toast.error(error.message || 'Terjadi kesalahan saat menambahkan siswa');
    }
  }

  async function updateStudent() {
    try {
      const data: any = { ...formData };
      if (!data.password) delete data.password;

      await apiFetch(`/users/${studentToEdit.id}`, {
        method: 'PUT',
        body: data
      });
      
      toast.success('Data siswa berhasil diperbarui');
      closeEditModal();
      await fetchStudents();
    } catch (error: any) {
      console.error('Error updating student:', error);
      toast.error(error.message || 'Terjadi kesalahan saat memperbarui siswa');
    }
  }

  async function deleteStudent(id: number | string) {
    showConfirmation('Apakah Anda yakin ingin menghapus siswa ini?', async () => {
      try {
        await apiFetch(`/users/${id}`, {
          method: 'DELETE'
        });
        
        toast.success('Siswa berhasil dihapus');
        await fetchStudents();
      } catch (error: any) {
        console.error('Error deleting student:', error);
        toast.error(error.message || 'Terjadi kesalahan saat menghapus siswa');
      }
    });
  }

  async function resetUjian(userId: number | string) {
    showConfirmation('Apakah Anda yakin ingin me-reset status ujian siswa ini?', async () => {
      try {
        await apiFetch(`/hasil/reset-student/${userId}`, {
          method: 'DELETE'
        });
        toast.success('Status ujian siswa berhasil di-reset');
      } catch (error: any) {
        if (error.message && (error.message.includes('not found') || error.message.includes('404'))) {
           toast.error('Gagal me-reset: Siswa ini belum memiliki data hasil ujian.');
        } else {
           console.error('Error resetting student exam:', error);
           toast.error(error.message || 'Terjadi kesalahan saat me-reset status ujian');
        }
      }
    });
  }
</script>


  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      <!-- Header Section -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div class="inline-flex items-center space-x-2 text-sm text-indigo-600 mb-2">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 002 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 005.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 009 7.5c0-1.255-.434-2.443-1.18-3.5z"/>
                <path d="M15.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 0011 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 0015.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 0019 7.5c0-1.255-.434-2.443-1.18-3.5A7.968 7.968 0 0015.5 4z"/>
              </svg>
              <span>Manajemen Akademik</span>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Data Siswa
            </h1>
            <p class="text-gray-600 mt-2">Kelola informasi dan akun siswa</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button 
              on:click={showBulkOperations} 
              class="group px-5 py-2.5 bg-gradient-to-r from-gray-600 to-gray-800 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              <svg class="w-5 h-5 mr-2 inline group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Impor/Ekspor
            </button>
            <button 
              on:click={openAddModal} 
              class="group px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              <svg class="w-5 h-5 mr-2 inline group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Tambah Siswa
            </button>
          </div>
        </div>
      </div>

      <!-- Filters and Search -->
      <div class="bg-white rounded-2xl shadow-lg p-5 mb-8">
        <div class="flex flex-col md:flex-row gap-4">
          <div class="flex-1 relative">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              bind:value={searchTerm}
              on:input={onSearchChange}
              placeholder="Cari nama atau email..."
              class="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            />
          </div>
          <div class="w-full md:w-72">
            <select
              bind:value={selectedClass}
              on:change={onClassChange}
              class="block w-full py-2.5 px-4 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            >
              <option value="">Semua Kelas</option>
              {#each classes as kelas}
                <option value={kelas.id}>{kelas.nama_kelas}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <!-- Error State -->
      {#if error}
        <div class="bg-red-50 border border-red-200 rounded-2xl p-6">
          <div class="flex items-center space-x-3">
            <div class="flex-shrink-0">
              <svg class="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-red-800">Error</h3>
              <p class="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      {/if}

      <!-- Table -->
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-gray-50 to-white">
          <div>
            <h2 class="text-lg font-semibold text-gray-800">Daftar Siswa</h2>
            <p class="text-sm text-gray-500 mt-0.5">
              Menampilkan {(currentPage - 1) * limit + 1} - {Math.min(currentPage * limit, parseInt(limit) === 10000 ? students.length : currentPage * limit)} dari {totalPages === 1 ? students.length : "banyak"} siswa
            </p>
          </div>
          <div class="flex items-center space-x-2">
            <label class="text-sm text-gray-600">Tampilkan:</label>
            <select
              bind:value={limit}
              on:change={() => fetchStudents(1)}
              class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={10000}>Semua</option>
            </select>
            <span class="text-sm text-gray-600">siswa</span>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
                  <input type="checkbox" checked={selectAll} on:change={toggleSelectAll}
                    class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer" />
                </th>
                <th class="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">No</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nama</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">NISN</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">NO. Peserta</th>
                <th class="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Kelas</th>
                <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">Aksi</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100">
              {#each students as student, idx (student.id)}
                <tr class="hover:bg-gray-50 transition-colors duration-150 {selectedStudents.includes(student.id) ? 'bg-indigo-50' : ''}">
                  <td class="px-3 py-4 text-center">
                    <input type="checkbox" checked={selectedStudents.includes(student.id)} on:change={() => toggleStudent(student.id)}
                      class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer" />
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 text-center">
                    {(currentPage - 1) * limit + idx + 1}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shadow-md">
                        {student.nama.charAt(0).toUpperCase()}
                      </div>
                      <div class="ml-3">
                        <div class="text-sm font-semibold text-gray-900">{student.nama}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{student.nisn || "-" }</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{student.no_peserta || "-"}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-center">
                    <span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700">
                      {student.nama_kelas || "Tanpa Kelas"}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="flex justify-end gap-1">
                      <button on:click={() => resetUjian(student.id)} class="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Reset Ujian">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      </button>
                      <a href="/student/{student.id}" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Detail">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </a>
                      <button on:click={() => openEditModal(student)} class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button on:click={() => deleteStudent(student.id)} class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Hapus">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if totalPages > 1}
        <div class="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-gray-50">
          <div class="flex items-center space-x-2">
            <button
              on:click={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>

            <div class="flex items-center space-x-1">
              {#each getPageNumbers() as page}
                {#if page === '...'}
                  <span class="px-3 py-1.5 text-gray-500">...</span>
                {:else}
                  <button
                    on:click={() => goToPage(page)}
                    class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 {currentPage === page ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}"
                  >
                    {page}
                  </button>
                {/if}
              {/each}
            </div>

            <button
              on:click={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>

          <div class="text-sm text-gray-600">
            Halaman {currentPage} dari {totalPages}
          </div>
        </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Bulk Action Bar -->
  {#if selectedStudents.length > 0}
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-scale-in">
    <div class="bg-white rounded-2xl shadow-2xl border border-red-100 px-5 py-3 flex items-center gap-4">
      <span class="text-sm font-medium text-gray-700">
        <span class="text-red-600 font-bold">{selectedStudents.length}</span> siswa terpilih
      </span>
      <div class="w-px h-6 bg-gray-200"></div>
      <button on:click={() => { selectedStudents = []; selectAll = false; }}
        class="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        Batal
      </button>
      <button on:click={bulkDeleteStudents}
        class="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg transition-all transform hover:scale-105 flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        Hapus Terpilih
      </button>
    </div>
  </div>
  {/if}


<!-- Add Modal -->
<Modal show={showAddModal} onClose={closeAddModal} title="Tambah Siswa Baru">
  <form on:submit|preventDefault={addStudent} class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap</label>
      <input
        type="text"
        bind:value={formData.nama}
        required
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
        placeholder="Nama siswa"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">NISN <span class="text-red-500">*</span></label>
      <input
        type="text"
        bind:value={formData.nisn}
        required
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
        placeholder="Nomor Induk Siswa Nasional (digunakan untuk login)"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">NO. Peserta</label>
      <input
        type="text"
        bind:value={formData.no_peserta}
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
        placeholder="Nomor Peserta Ujian"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
      <input
        type="password"
        bind:value={formData.password}
        required
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
        placeholder="Password minimal 6 karakter"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Kelas</label>
      <select
        bind:value={formData.kelas_id}
        required
        class="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
      >
        <option value="">Pilih Kelas</option>
        {#each classes as kelas}
          <option value={kelas.id}>{kelas.nama_kelas}</option>
        {/each}
      </select>
    </div>
    <div class="flex justify-end space-x-3 pt-4">
      <button type="button" on:click={closeAddModal} class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors">
        Batal
      </button>
      <button type="submit" class="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
        Simpan Siswa
      </button>
    </div>
  </form>
</Modal>

<!-- Edit Modal -->
<Modal show={showEditModal} onClose={closeEditModal} title="Edit Data Siswa">
  <form on:submit|preventDefault={updateStudent} class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap</label>
      <input
        type="text"
        bind:value={formData.nama}
        required
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">NISN <span class="text-red-500">*</span></label>
      <input
        type="text"
        bind:value={formData.nisn}
        required
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
        placeholder="Nomor Induk Siswa Nasional (digunakan untuk login)"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">NO. Peserta</label>
      <input
        type="text"
        bind:value={formData.no_peserta}
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
        placeholder="Nomor Peserta Ujian"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Password Baru</label>
      <input
        type="password"
        bind:value={formData.password}
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
        placeholder="Kosongkan jika tidak ingin mengubah password"
      />
      <p class="text-xs text-gray-500 mt-1">* Biarkan kosong jika tidak ingin mengubah password</p>
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Kelas</label>
      <select
        bind:value={formData.kelas_id}
        required
        class="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
      >
        <option value="">Pilih Kelas</option>
        {#each classes as kelas}
          <option value={kelas.id}>{kelas.nama_kelas}</option>
        {/each}
      </select>
    </div>
    <div class="flex justify-end space-x-3 pt-4">
      <button type="button" on:click={closeEditModal} class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors">
        Batal
      </button>
      <button type="submit" class="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
        Simpan Perubahan
      </button>
    </div>
  </form>
</Modal>

<!-- Bulk Operations Modal -->
<Modal show={showBulkModal} onClose={hideBulkModal} title="Impor & Ekspor Data Siswa" size="lg">
  <div class="space-y-5">
    <!-- Import Section -->
    <div class="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-5">
      <div class="flex items-center space-x-2 mb-4">
        <div class="p-1.5 bg-indigo-100 rounded-lg">
          <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
        <h3 class="text-sm font-semibold text-gray-900">Impor Data (Excel)</h3>
        <p class="text-xs text-gray-500">Format: NISN (wajib/login), Nama, Password, Kelas ID, No. Peserta, Email (opsional)</p>
      </div>
      <div class="space-y-3">
        <input 
          type="file" 
          accept=".xlsx, .xls"
          on:change={handleUsersFile}
          class="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors"
        />
        <div class="flex items-center justify-between">
          <button 
            on:click={bulkImport} 
            class="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            disabled={!usersFile}
          >
            Mulai Impor
          </button>
          <a on:click={() => handleExport('/bulk/template/users')} class="text-sm text-indigo-600 hover:text-indigo-700 cursor-pointer transition-colors" role="button" tabindex="0">
            Download Template Siswa →
          </a>
        </div>
      </div>
    </div>

    <!-- Export Section -->
    <div class="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-5">
      <div class="flex items-center space-x-2 mb-4">
        <div class="p-1.5 bg-emerald-100 rounded-lg">
          <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 class="text-sm font-semibold text-gray-900">Ekspor Data</h3>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button on:click={() => handleExport('/bulk/export/students')} class="px-4 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-800 transition-all text-sm">
          Ekspor Data Siswa
        </button>
        <button on:click={() => handleExport('/exam-cards/export-students-with-passwords')} class="px-4 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-800 transition-all text-sm">
          Ekspor Siswa & Password Ujian
        </button>
      </div>
    </div>
  </div>
  <div class="flex justify-end mt-6 pt-4 border-t border-gray-200">
    <button on:click={hideBulkModal} class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors">
      Tutup
    </button>
  </div>
</Modal>

<!-- Confirmation Modal -->
{#if showConfirmModal}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
      <div class="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
        <h3 class="text-lg font-semibold text-white">Konfirmasi</h3>
      </div>
      <div class="p-6">
        <div class="flex items-center space-x-3 mb-4">
          <div class="p-2 bg-red-100 rounded-full">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <p class="text-gray-700">{confirmMessage}</p>
        </div>
        <div class="flex justify-end space-x-3">
          <button on:click={hideConfirmation} class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors">
            Batal
          </button>
          <button on:click={confirmAction} class="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
            Ya, Lanjutkan
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<ToastContainer />

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
  
  .tooltip {
    position: relative;
  }
  
  .tooltip:hover::after {
    content: attr(title);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    background-color: #1f2937;
    color: white;
    font-size: 11px;
    border-radius: 6px;
    white-space: nowrap;
    margin-bottom: 8px;
    z-index: 50;
    pointer-events: none;
  }
</style>