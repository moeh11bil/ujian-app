<script>
  import { onMount } from 'svelte';
  import { navigate } from 'svelte-routing';
  import { apiFetch } from '$lib/api';
  import toast from '../../lib/toast.js';
  import ToastContainer from '../../components/ToastContainer.svelte';
  import Modal from '../../components/Modal.svelte';

  let examId = null;
  let exam = null;
  let packages = [];
  let allQuestions = [];
  let loading = true;
  let showCreateModal = false;
  let showGenerateModal = false;
  let showAssignModal = false;
  let selectedPackage = null;  
  let newPackage = {
    nama_paket: '',
    kode_paket: '',
    deskripsi: ''
  };

  let generateOptions = {
    shuffle_options: false
  };

  let assignmentMode = 'round_robin';
  let students = [];

  let token = localStorage.getItem('token');

  onMount(async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    if (window.location.pathname) {
      const pathParts = window.location.pathname.split('/');
      if (pathParts.includes('dashboard') && pathParts.includes('exams')) {
        const examsIndex = pathParts.indexOf('exams');
        examId = pathParts[examsIndex + 1];
      }
    }

    await Promise.all([fetchExamDetails(), fetchPackages(), fetchQuestions()]);
    await fetchStudents();
  });

  async function fetchExamDetails() {
    try {
      exam = await apiFetch(`/api/ujian/${examId}`);
    } catch (error) {
      toast.error('Gagal memuat detail ujian: ' + error.message);
      navigate('/dashboard/exams');
    }
  }

  async function fetchPackages() {
    try {
      loading = true;
      packages = await apiFetch(`/api/paket-soal/ujian/${examId}`);
      
      try {
        const assignments = await apiFetch(`/api/paket-soal/student/assignments/${examId}`);
        const assignmentCount = {};
        assignments.forEach(a => {
          const kode = a.kode_paket || 'Unknown';
          assignmentCount[kode] = (assignmentCount[kode] || 0) + 1;
        });
        packages = packages.map(p => ({
          ...p,
          jumlah_siswa: assignmentCount[p.kode_paket] || 0
        }));
      } catch (e) {
        packages = packages.map(p => ({ ...p, jumlah_siswa: 0 }));
      }
    } catch (error) {
      toast.error('Gagal memuat paket: ' + error.message);
    } finally {
      loading = false;
    }
  }

  async function fetchQuestions() {
    try {
      const response = await apiFetch(`/api/soal/ujian/${examId}?limit=1000`);
      allQuestions = response?.data || response || [];
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  }

  async function fetchStudents() {
    try {
      const allStudentsRes = await apiFetch('/api/users/students?limit=1000');
      const allStudents = allStudentsRes?.data || allStudentsRes || [];
      try {
        const assignments = await apiFetch(`/api/paket-soal/student/assignments/${examId}`);
        const assignmentMap = {};
        assignments.forEach(a => { assignmentMap[a.user_id] = a.kode_paket; });
        students = allStudents.map(s => ({ ...s, paket_assigned: assignmentMap[s.id] || null }));
      } catch (e) {
        students = allStudents.map(s => ({ ...s, paket_assigned: null }));
      }
      if (exam?.kelas_id) {
        students = students.filter(s => s.kelas_id === exam.kelas_id);
      }
    } catch (error) {
      students = [];
    }
  }

  async function createPackage() {
    if (!newPackage.nama_paket || !newPackage.kode_paket) {
      toast.error('Nama paket dan kode paket wajib diisi');
      return;
    }
    try {
      await apiFetch('/api/paket-soal', {
        method: 'POST',
        body: JSON.stringify({ ujian_id: parseInt(examId), ...newPackage })
      });
      toast.success('Paket berhasil dibuat');
      showCreateModal = false;
      newPackage = { nama_paket: '', kode_paket: '', deskripsi: '' };
      await fetchPackages();
    } catch (error) {
      toast.error('Gagal membuat paket: ' + error.message);
    }
  }

  async function deletePackage(packageId) {
    if (!confirm('Apakah Anda yakin ingin menghapus paket ini?')) {
      return;
    }

    try {
      await apiFetch(`/api/paket-soal/${packageId}`, {
        method: 'DELETE'
      });

      toast.success('Paket berhasil dihapus');
      await fetchPackages();
    } catch (error) {
      console.error('Error deleting package:', error);
      toast.error('Gagal menghapus paket: ' + error.message);
    }
  }

  function generatePackage(packageId) {
    selectedPackage = packages.find(p => p.id === packageId);
    showGenerateModal = true;
  }

  async function confirmGenerate() {
    try {
      await apiFetch(`/api/paket-soal/${selectedPackage.id}/generate`, {
        method: 'POST',
        body: generateOptions
      });

      toast.success('Paket berhasil digenerate');
      showGenerateModal = false;
      generateOptions = { shuffle_options: false };
      await fetchPackages();
    } catch (error) {
      toast.error('Gagal generate paket: ' + error.message);
    }
  }

  async function bulkAssign() {
    try {
      const result = await apiFetch('/api/paket-soal/assign-bulk', {
        method: 'POST',
        body: {
          ujian_id: parseInt(examId),
          assignment_mode: assignmentMode
        }
      });

      toast.success(result.message || 'Berhasil assign paket ke siswa');
      await fetchStudents();
      await fetchPackages();
      closeModal();
    } catch (error) {
      console.error('Error bulk assigning:', error);
      toast.error('Gagal assign paket massal: ' + error.message);
    }
  }

  async function togglePackageActive(packageId, currentStatus) {
    try {
      const newStatus = !currentStatus;
      await apiFetch(`/api/paket-soal/${packageId}`, {
        method: 'PUT',
        body: { is_active: newStatus }
      });

      toast.success(`Paket ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`);
      await fetchPackages();
    } catch (error) {
      console.error('Error toggling package status:', error);
      toast.error('Gagal update status paket: ' + error.message);
    }
  }

  function openCreateModal() {
    showCreateModal = true;
    newPackage = { nama_paket: '', kode_paket: '', deskripsi: '' };
  }

  function closeModal() {
    showCreateModal = false;
    showGenerateModal = false;
    showAssignModal = false;
    selectedPackage = null;
  }

  function goToPreview() {
    navigate(`/dashboard/exams/${examId}/preview`);
  }

  function goToPackagePreview(paketId) {
    navigate(`/dashboard/exams/${examId}/preview?paket_id=${paketId}`);
  }

  function showAssignStudents() {
    showAssignModal = true;
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
    <!-- Header Card -->
    <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20 animate-fade-in-up">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div class="inline-flex items-center space-x-2 text-sm text-indigo-600 mb-2">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 002 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 005.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 009 7.5c0-1.255-.434-2.443-1.18-3.5z"/>
              <path d="M15.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 0011 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 0015.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 0019 7.5c0-1.255-.434-2.443-1.18-3.5A7.968 7.968 0 0015.5 4z"/>
            </svg>
            <span>Manajemen Paket Soal</span>
          </div>
          <h1 class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
            {exam?.judul || 'Memuat info ujian...'}
          </h1>
          <div class="flex items-center space-x-4 text-sm">
            {#if exam?.durasi}
              <div class="flex items-center space-x-1 text-gray-600">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Durasi: {exam.durasi} menit</span>
              </div>
            {/if}
            {#if exam?.kelas_id}
              <div class="flex items-center space-x-1 text-gray-600">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                <span>Kelas ID: {exam.kelas_id}</span>
              </div>
            {/if}
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <button
            on:click={() => { navigate('/dashboard/exams'); }}
            class="group px-5 py-2.5 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-300 shadow-sm hover:shadow-md border border-gray-200"
          >
            <svg class="w-5 h-5 mr-2 inline transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Kembali
          </button>
          <button
            on:click={showAssignStudents}
            class="group px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <svg class="w-5 h-5 mr-2 inline group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Assign Siswa
          </button>
          <button
            on:click={openCreateModal}
            class="group px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <svg class="w-5 h-5 mr-2 inline group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Buat Paket Baru
          </button>
        </div>
      </div>
    </div>

    <!-- Info Panel -->
    <div class="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100 rounded-2xl p-6 mb-8 animate-fade-in-up animation-delay-100">
      <div class="flex items-start space-x-3">
        <div class="p-2 bg-white rounded-xl shadow-sm">
          <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div>
          <h3 class="font-semibold text-gray-900 mb-1">Sistem Paket Soal</h3>
          <p class="text-sm text-gray-700">
            Setiap paket berisi soal yang sama dengan urutan nomor yang diacak. 
            Paket yang aktif akan tersedia untuk siswa yang telah di-assign.
          </p>
        </div>
      </div>
    </div>

    <!-- Packages Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each packages as paket, index}
          <div class="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 animate-fade-in-up" 
               style="animation-delay: {index * 100}ms">
            
            <!-- Package Header -->
            <div class="relative overflow-hidden rounded-t-2xl">
              <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
              <div class="p-5 pb-3">
                <div class="flex justify-between items-start mb-3">
                  <div class="flex-1">
                    <div class="flex items-center space-x-2 mb-2">
                      <div class="w-8 h-8 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center">
                        <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                      </div>
                      <h3 class="font-bold text-lg text-gray-800">{paket.nama_paket}</h3>
                    </div>
                    <div class="flex items-center space-x-3 text-sm">
                      <span class="px-2 py-1 text-xs font-medium rounded-full {paket.is_active ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}">
                        {paket.is_active ? '● Aktif' : '○ Nonaktif'}
                      </span>
                      <span class="text-gray-500">Kode: {paket.kode_paket}</span>
                    </div>
                  </div>
                </div>
                
                {#if paket.deskripsi}
                  <p class="text-sm text-gray-600 mt-2 line-clamp-2">{paket.deskripsi}</p>
                {/if}
                
                <!-- Stats -->
                <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  <div class="flex items-center space-x-1 text-sm text-gray-600">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                    </svg>
                    <span>{paket.jumlah_siswa || 0} Siswa</span>
                  </div>
                  <div class="text-xs text-gray-400">
                    ID: {paket.id}
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Package Actions -->
            <div class="px-5 pb-5 pt-2 flex justify-between items-center border-t border-gray-100">
              <div class="flex space-x-1">
                <button
                  on:click={() => goToPackagePreview(paket.id)}
                  class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200 tooltip"
                  title="Preview Soal"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button
                  on:click={() => generatePackage(paket.id)}
                  class="p-2 text-purple-600 hover:bg-purple-50 rounded-xl transition-all duration-200 tooltip"
                  title="Generate Soal"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  on:click={() => togglePackageActive(paket.id, paket.is_active)}
                  class="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-all duration-200 tooltip"
                  title={paket.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
                <button
                  on:click={() => deletePackage(paket.id)}
                  class="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 tooltip"
                  title="Hapus Paket"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div class="text-xs bg-gray-50 px-2 py-1 rounded-full text-gray-600">
                {paket.is_active ? 'Tersedia' : 'Tidak Aktif'}
              </div>
            </div>
          </div>
        {/each}
        
        <!-- Empty State -->
        {#if packages.length === 0}
          <div class="col-span-full">
            <div class="bg-white rounded-2xl shadow-lg p-12 text-center animate-fade-in-up">
              <div class="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                <svg class="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <h3 class="text-xl font-semibold text-gray-800 mb-2">Belum Ada Paket</h3>
              <p class="text-gray-600 mb-6">Mulai dengan membuat paket soal pertama Anda</p>
              <button
                on:click={openCreateModal}
                class="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:-translate-y-1"
              >
                <svg class="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Buat Paket Baru
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

<!-- Modals -->
<Modal show={showCreateModal} onClose={closeModal} title="Buat Paket Soal" size="md">
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Nama Paket</label>
      <input 
        bind:value={newPackage.nama_paket} 
        placeholder="Contoh: Paket A, Paket B" 
        class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Kode Paket</label>
      <input 
        bind:value={newPackage.kode_paket} 
        placeholder="Kode unik untuk paket (contoh: A, B, C)" 
        class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Deskripsi (Opsional)</label>
      <textarea 
        bind:value={newPackage.deskripsi} 
        placeholder="Deskripsi paket soal" 
        rows="3"
        class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      ></textarea>
    </div>
    <div class="flex space-x-3 pt-4">
      <button on:click={closeModal} class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all">
        Batal
      </button>
      <button on:click={createPackage} class="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all">
        Simpan
      </button>
    </div>
  </div>
</Modal>

<Modal show={showGenerateModal} onClose={closeModal} title="Generate Paket Soal" size="md">
  <div class="space-y-4">
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <p class="text-sm text-blue-800">
        Sistem akan mengacak soal untuk paket ini berdasarkan bank soal yang tersedia.
      </p>
    </div>
    <label class="flex items-center space-x-3 cursor-pointer">
      <input type="checkbox" bind:checked={generateOptions.shuffle_options} class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
      <span class="text-sm text-gray-700">Acak urutan pilihan jawaban (opsional)</span>
    </label>
    <div class="flex space-x-3 pt-4">
      <button on:click={closeModal} class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all">
        Batal
      </button>
      <button on:click={confirmGenerate} class="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all">
        Generate
      </button>
    </div>
  </div>
</Modal>

<Modal show={showAssignModal} onClose={closeModal} title="Assign Siswa ke Paket" size="lg">
  <div class="space-y-4">
    <div class="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
      <div class="flex items-center space-x-3 mb-3">
        <label class="text-sm font-medium text-gray-700">Mode Assign:</label>
        <select bind:value={assignmentMode} class="px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500">
          <option value="round_robin">Round Robin (Giliran)</option>
          <option value="random">Random (Acak)</option>
        </select>
        <button on:click={bulkAssign} class="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-lg transition-all">
          Assign Massal
        </button>
      </div>
      <p class="text-xs text-emerald-700">
        Sistem akan mendistribusikan paket secara merata ke semua siswa.
      </p>
    </div>
    
    <div class="max-h-80 overflow-y-auto">
      <div class="bg-gray-50 rounded-xl p-2">
        {#each students as student}
          <div class="p-3 hover:bg-white rounded-lg transition-all border-b border-gray-100 last:border-0">
            <div class="flex justify-between items-center">
              <div class="flex-1">
                <div class="font-medium text-gray-800">{student.nama}</div>
                <div class="text-xs text-gray-500">ID: {student.id}</div>
              </div>
              <div class="flex items-center space-x-2">
                <span class="px-2 py-1 text-xs rounded-full {student.paket_assigned ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
                  {student.paket_assigned || 'Belum Assign'}
                </span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
    
    <div class="flex justify-end pt-4">
      <button on:click={closeModal} class="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all">
        Tutup
      </button>
    </div>
  </div>
</Modal>



<ToastContainer />

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
    animation: fade-in-up 0.6s ease-out forwards;
  }
  
  .animation-delay-100 {
    animation-delay: 100ms;
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
  }
  
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
