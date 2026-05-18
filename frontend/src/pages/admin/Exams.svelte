<script>
  import { onMount, onDestroy } from 'svelte';
  import { fetchWithAuth, apiFetch, apiClient } from '$lib/api';
  import toast from '../../lib/toast.js';
  import Modal from '../../components/Modal.svelte';
  import ToastContainer from '../../components/ToastContainer.svelte';

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
      console.error('Invalid token in Exams.svelte', e);
    }
  }

  // Variables for confirmation modal
  let showConfirmModal = false;
  let confirmCallback = null;
  let confirmMessage = '';

  function showConfirmation(message, callback) {
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

  let exams = [];
  let kelas = [];
  let loading = true;
  let error = null;

  // Modal states
  let showAddModal = false;
  let showEditModal = false;
  let examToEdit = null;

  onMount(async () => {
    // Add admin layout class to body
    document.body.classList.add('admin-layout');

    // Fallback to localStorage if token is not passed as prop
    if (!token) {
      token = localStorage.getItem('token');
    }

    if (!token) {
      loading = false; // Stop loading if no token
      return;
    }

    await Promise.all([fetchExams(), fetchKelas()]);
  });

  // Cleanup function to remove class when component is destroyed
  onDestroy(() => {
    document.body.classList.remove('admin-layout');
  });

  async function fetchExams() {
    try {
      loading = true;
      error = null; // Reset error state
      const response = await fetchWithAuth('/ujian?limit=1000');
      const data = response?.data || response || [];
      exams = Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Error fetching exams:', err);
      error = err.message || 'Terjadi kesalahan saat mengambil data ujian';
      exams = [];
    } finally {
      loading = false;
    }
  }

  async function fetchKelas() {
    try {
      const response = await fetchWithAuth('/kelas?limit=1000');
      const data = response?.data || response || [];
      kelas = Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Error fetching kelas:', err);
      toast.error(err.message || 'Terjadi kesalahan saat mengambil data kelas');
      kelas = [];
    }
  }

  // 24-hour time options
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  // Helper to parse HH:mm into { h, m }
  function parseTime(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return { h: '00', m: '00' };
    const [h, m] = timeStr.split(':');
    return { h, m };
  }

  // Separate hour/minute select values for 24-hour format
  let jamMulaiH = '00', jamMulaiM = '00';
  let jamSelesaiH = '00', jamSelesaiM = '00';

  $: formExam.jam_mulai = `${jamMulaiH}:${jamMulaiM}`;
  $: formExam.jam_selesai = `${jamSelesaiH}:${jamSelesaiM}`;

  // Form state - use this for binding
  let formExam = {
    judul: '',
    durasi: '',
    tanggal_mulai: '',
    jam_mulai: '',
    tanggal_selesai: '',
    jam_selesai: '',
    status: 'nonaktif',
    kelas_id: ''
  };

  function openAddModal() {
    jamMulaiH = '08'; jamMulaiM = '00';
    jamSelesaiH = '16'; jamSelesaiM = '00';
    formExam = {
      judul: '',
      durasi: '',
      tanggal_mulai: '',
      jam_mulai: '08:00',
      tanggal_selesai: '',
      jam_selesai: '16:00',
      status: 'nonaktif',
      kelas_id: ''
    };
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
  }

  function openEditModal(exam) {
    examToEdit = exam;

    // Extract date and time components from datetime strings
    const extractDateTimeComponents = (dateString) => {
      if (!dateString) return { date: '', time: '' };
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return { date: '', time: '' }; // Invalid date

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      const formattedDate = `${year}-${month}-${day}`;
      const formattedTime = `${hours}:${minutes}`;

      return { date: formattedDate, time: formattedTime };
    };

    const waktuMulaiComponents = extractDateTimeComponents(exam.waktu_mulai);
    const waktuSelesaiComponents = extractDateTimeComponents(exam.waktu_selesai);

    // Set separate hour/minute select values
    const mulaiTime = parseTime(waktuMulaiComponents.time);
    const selesaiTime = parseTime(waktuSelesaiComponents.time);
    jamMulaiH = mulaiTime.h; jamMulaiM = mulaiTime.m;
    jamSelesaiH = selesaiTime.h; jamSelesaiM = selesaiTime.m;

    // Set form values to the exam being edited, with separate date and time
    formExam = {
      judul: exam.judul,
      durasi: exam.durasi,
      tanggal_mulai: waktuMulaiComponents.date,
      jam_mulai: waktuMulaiComponents.time,
      tanggal_selesai: waktuSelesaiComponents.date,
      jam_selesai: waktuSelesaiComponents.time,
      status: exam.status || 'nonaktif',
      kelas_id: exam.kelas_id || ''
    };

    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    examToEdit = null;
  }

  async function addExam() {
    if (!formExam.judul || !formExam.durasi) {
      toast.warning('Silakan lengkapi judul dan durasi ujian');
      return;
    }

    // Combine date and time for the backend
    const combineDateTime = (date, time) => {
      if (!date) return null;
      return time ? `${date}T${time}:00` : `${date}T00:00:00`;
    };

    // Prepare the exam data with proper date format for the backend
    const examData = {
      ...formExam,
      waktu_mulai: combineDateTime(formExam.tanggal_mulai, formExam.jam_mulai),
      waktu_selesai: combineDateTime(formExam.tanggal_selesai, formExam.jam_selesai)
    };

    // Remove the temporary date/time fields
    delete examData.tanggal_mulai;
    delete examData.jam_mulai;
    delete examData.tanggal_selesai;
    delete examData.jam_selesai;

    // Handle kelas_id - convert empty string to null
    if (examData.kelas_id === '') {
      examData.kelas_id = null;
    }

    try {
      await apiClient.post('/ujian', examData);

      await fetchExams(); // Refresh the list
      closeAddModal();
      toast.success('Ujian berhasil ditambahkan');

    } catch (error) {
      console.error('Error adding exam:', error);
      toast.error(error.message || 'Terjadi kesalahan saat menambahkan ujian');
    }
  }

  async function updateExam() {
    if (!formExam.judul || !formExam.durasi) {
      toast.warning('Silakan lengkapi judul dan durasi ujian');
      return;
    }

    // Combine date and time for the backend
    const combineDateTime = (date, time) => {
      if (!date) return null;
      return time ? `${date}T${time}:00` : `${date}T00:00:00`;
    };

    // Prepare the exam data with proper date format for the backend
    const examData = {
      judul: formExam.judul,
      durasi: parseInt(formExam.durasi) || null,
      waktu_mulai: combineDateTime(formExam.tanggal_mulai, formExam.jam_mulai),
      waktu_selesai: combineDateTime(formExam.tanggal_selesai, formExam.jam_selesai),
      status: formExam.status,
      kelas_id: formExam.kelas_id ? parseInt(formExam.kelas_id) : null
    };

    try {
      console.log('Sending exam data:', examData);
      await fetchWithAuth(`/ujian/${examToEdit.id}`, {
        method: 'PUT',
        body: examData
      });

      await fetchExams(); // Refresh the list
      closeEditModal();
      toast.success('Ujian berhasil diperbarui');
    } catch (error) {
      console.error('Error updating exam:', error);
      toast.error(error.message || 'Terjadi kesalahan saat memperbarui ujian');
    }
  }

  async function toggleStatus(exam) {
    try {
      // Toggle the status
      const newStatus = exam.status === 'aktif' ? 'nonaktif' : 'aktif';

      // Update only the status field
      await fetchWithAuth(`/ujian/${exam.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: newStatus
        })
      });

      await fetchExams(); // Refresh the list
      toast.success(`Status ujian berhasil diubah menjadi ${newStatus}`);
    } catch (error) {
      console.error('Error toggling exam status:', error);
      toast.error(error.message || 'Terjadi kesalahan saat mengubah status ujian');
    }
  }

  async function deleteExam(id) {
    const message = 'Apakah Anda yakin ingin menghapus ujian ini?';

    // Show custom confirmation modal
    showConfirmation(message, async () => {
      try {
        await fetchWithAuth(`/ujian/${id}`, {
          method: 'DELETE'
        });
        await fetchExams(); // Refresh the list
        toast.success('Ujian berhasil dihapus');
      } catch (error) {
        console.error('Error deleting exam:', error);
        toast.error(error.message || 'Terjadi kesalahan saat menghapus ujian');
      }
    });
  }
</script>


  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <!-- Animated Background -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden">
      <div class="absolute -top-40 -right-40 w-80 h-80 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div class="absolute top-1/2 left-1/2 w-80 h-80 bg-pink-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
      <!-- Header Section -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div class="inline-flex items-center space-x-2 text-sm text-indigo-600 mb-2">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 002 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 005.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 009 7.5c0-1.255-.434-2.443-1.18-3.5z"/>
                <path d="M15.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 0011 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 0015.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 0019 7.5c0-1.255-.434-2.443-1.18-3.5A7.968 7.968 0 0015.5 4z"/>
              </svg>
              <span>Dashboard Guru</span>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Manajemen Ujian & Soal
            </h1>
          </div>
          <button
            on:click={openAddModal}
            class="group px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <svg class="w-5 h-5 mr-2 inline group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Tambah Ujian
          </button>
        </div>
      </div>

      <!-- Tips Panel -->
      <div class="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-100 rounded-2xl p-6 mb-8">
        <div class="flex items-start space-x-3">
          <div class="p-2 bg-white rounded-xl shadow-sm">
            <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-gray-900 mb-2">💡 Tips Penggunaan:</h3>
            <ul class="space-y-1 text-sm text-gray-700">
              <li class="flex items-center space-x-2">
                <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                <span>Klik tombol "Kelola Soal" pada setiap ujian untuk mengelola soal secara spesifik untuk ujian tersebut</span>
              </li>
              <li class="flex items-center space-x-2">
                <span class="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                <span>Atau gunakan "Data Bank Soal" di sidebar untuk mengelola semua soal secara umum</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Exams List -->

      <!-- Error State -->
      {#if error}
        <div class="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8">
          <div class="flex items-center space-x-3">
            <div class="flex-shrink-0">
              <svg class="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-red-800">Error</h3>
              <p class="text-sm text-red-700 mt-1">{error || 'Terjadi kesalahan tidak terduga'}</p>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Exams List -->
      <div class="space-y-4">
          {#each exams as exam (exam.id)}
            <div class="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 overflow-hidden">
              <!-- Status Bar -->
              <div class="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
              
              <div class="p-6">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div class="flex-1">
                    <!-- Title -->
                    <div class="flex items-center space-x-3 mb-3">
                      <div class="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
                        <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                      </div>
                      <h2 class="text-xl font-bold text-gray-800">{exam.judul}</h2>
                    </div>
                    
                    <!-- Details Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div class="flex items-center space-x-2 text-gray-600">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span>{exam.durasi} menit</span>
                      </div>
                      <div class="flex items-center space-x-2 text-gray-600">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <span>{exam.waktu_mulai ? new Date(exam.waktu_mulai).toLocaleString('id-ID') : '-'}</span>
                      </div>
                      <div class="flex items-center space-x-2 text-gray-600">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <span>{exam.waktu_selesai ? new Date(exam.waktu_selesai).toLocaleString('id-ID') : '-'}</span>
                      </div>
                      <div class="flex items-center space-x-2 text-gray-600">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                        </svg>
                        <span>{exam.nama_kelas || 'Semua Kelas'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Actions -->
                  <div class="flex items-center gap-2">
                    <button 
                      on:click={() => toggleStatus(exam)} 
                      class="group relative px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 {exam.status === 'aktif' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}"
                    >
                      <div class="flex items-center space-x-1">
                        <div class="w-1.5 h-1.5 rounded-full {exam.status === 'aktif' ? 'bg-green-500' : 'bg-red-500'}"></div>
                        <span>{exam.status}</span>
                      </div>
                    </button>
                    
                    <button 
                      on:click={() => openEditModal(exam)} 
                      class="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-all duration-200 tooltip"
                      title="Edit Ujian"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    
                    <button 
                      on:click={() => deleteExam(exam.id)} 
                      class="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-all duration-200 tooltip"
                      title="Hapus Ujian"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                    
                    <a 
                      href={`/dashboard/exams/${exam.id}/questions`} 
                      class="p-2 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all duration-200 tooltip"
                      title="Kelola Soal"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          {/each}
          
          <!-- Empty State -->
          {#if exams.length === 0}
            <div class="bg-white rounded-2xl shadow-lg p-12 text-center">
              <div class="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                <svg class="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <h3 class="text-xl font-semibold text-gray-800 mb-2">Belum Ada Ujian</h3>
              <p class="text-gray-600 mb-6">Mulai dengan membuat ujian pertama Anda</p>
              <button
                on:click={openAddModal}
                class="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:-translate-y-1"
              >
                <svg class="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Tambah Ujian
              </button>
            </div>
          {/if}
        </div>
    </div>
  </div>

  <!-- Add Modal -->
  <Modal show={showAddModal} onClose={closeAddModal} title="Tambah Ujian Baru">
    <form on:submit|preventDefault={addExam} class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Judul Ujian</label>
        <input 
          bind:value={formExam.judul} 
          type="text" 
          required
          class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          placeholder="Contoh: Ujian Matematika Kelas 10"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Durasi (menit)</label>
        <input 
          bind:value={formExam.durasi} 
          type="number" 
          required
          class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          placeholder="Contoh: 60"
        />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Tanggal Mulai</label>
          <input 
            bind:value={formExam.tanggal_mulai} 
            type="date" 
            class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Jam Mulai (24h)</label>
          <div class="flex gap-1 items-center">
            <select bind:value={jamMulaiH} class="w-full px-3 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
              {#each hours as h}
                <option value={h}>{h}</option>
              {/each}
            </select>
            <span class="text-gray-500 font-bold text-lg">:</span>
            <select bind:value={jamMulaiM} class="w-full px-3 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
              {#each minutes as m}
                <option value={m}>{m}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Tanggal Selesai</label>
          <input 
            bind:value={formExam.tanggal_selesai} 
            type="date" 
            class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Jam Selesai (24h)</label>
          <div class="flex gap-1 items-center">
            <select bind:value={jamSelesaiH} class="w-full px-3 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
              {#each hours as h}
                <option value={h}>{h}</option>
              {/each}
            </select>
            <span class="text-gray-500 font-bold text-lg">:</span>
            <select bind:value={jamSelesaiM} class="w-full px-3 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
              {#each minutes as m}
                <option value={m}>{m}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Kelas</label>
        <select bind:value={formExam.kelas_id} class="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
          <option value="">Semua Kelas</option>
          {#each kelas as k}
            <option value={k.id}>{k.nama_kelas}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
        <select bind:value={formExam.status} class="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
        </select>
      </div>
      <div class="flex justify-end space-x-3 pt-4">
        <button type="button" on:click={closeAddModal} class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors">
          Batal
        </button>
        <button type="submit" class="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
          Simpan Ujian
        </button>
      </div>
    </form>
  </Modal>

  <!-- Edit Modal -->
  <Modal show={showEditModal} onClose={closeEditModal} title="Edit Data Ujian">
    <form on:submit|preventDefault={updateExam} class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Judul Ujian</label>
        <input 
          bind:value={formExam.judul} 
          type="text" 
          required
          class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Durasi (menit)</label>
        <input 
          bind:value={formExam.durasi} 
          type="number" 
          required
          class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          placeholder="Contoh: 60"
        />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Tanggal Mulai</label>
          <input 
            bind:value={formExam.tanggal_mulai} 
            type="date" 
            class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Jam Mulai (24h)</label>
          <div class="flex gap-1 items-center">
            <select bind:value={jamMulaiH} class="w-full px-3 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
              {#each hours as h}
                <option value={h}>{h}</option>
              {/each}
            </select>
            <span class="text-gray-500 font-bold text-lg">:</span>
            <select bind:value={jamMulaiM} class="w-full px-3 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
              {#each minutes as m}
                <option value={m}>{m}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Tanggal Selesai</label>
          <input 
            bind:value={formExam.tanggal_selesai} 
            type="date" 
            class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Jam Selesai (24h)</label>
          <div class="flex gap-1 items-center">
            <select bind:value={jamSelesaiH} class="w-full px-3 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
              {#each hours as h}
                <option value={h}>{h}</option>
              {/each}
            </select>
            <span class="text-gray-500 font-bold text-lg">:</span>
            <select bind:value={jamSelesaiM} class="w-full px-3 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
              {#each minutes as m}
                <option value={m}>{m}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Kelas</label>
        <select bind:value={formExam.kelas_id} class="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
          <option value="">Semua Kelas</option>
          {#each kelas as k}
            <option value={k.id}>{k.nama_kelas}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
        <select bind:value={formExam.status} class="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
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

  <!-- Confirmation Modal -->
  {#if showConfirmModal}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform animate-scale-in">
        <div class="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
          <h3 class="text-lg font-semibold text-white">Konfirmasi Hapus</h3>
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
            <button 
              on:click={hideConfirmation} 
              class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all"
            >
              Batal
            </button>
            <button 
              on:click={confirmAction} 
              class="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
            >
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
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  @keyframes scale-in {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  .animate-fade-in {
    animation: fade-in 0.3s ease-out forwards;
  }
  
  .animate-scale-in {
    animation: scale-in 0.3s ease-out forwards;
  }
  
  
  
  .animation-delay-2000 {
    animation-delay: 2s;
  }
  
  .animation-delay-4000 {
    animation-delay: 4s;
  }
  
  @keyframes blob {
    0%, 100% {
      transform: translate(0, 0) scale(1);
    }
    33% {
      transform: translate(30px, -50px) scale(1.1);
    }
    66% {
      transform: translate(-20px, 20px) scale(0.9);
    }
  }
  
  .animate-blob {
    animation: blob 7s infinite;
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
    font-size: 12px;
    border-radius: 6px;
    white-space: nowrap;
    margin-bottom: 8px;
    z-index: 50;
    pointer-events: none;
  }
</style>