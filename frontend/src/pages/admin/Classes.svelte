<script>
  import { onMount, onDestroy } from 'svelte';
  import { apiClient } from '$lib/api';
  import toast from '../../lib/toast.js';
  import Modal from '../../components/Modal.svelte';
  import ToastContainer from '../../components/ToastContainer.svelte';
  import { createCacheStore } from '../../stores/cacheStore';

  let token = localStorage.getItem('token');
  let user = null;

  const classesStore = createCacheStore('classes', async () => {
    const response = await apiClient.get('/kelas');
    const data = response?.data || response;
    if (!Array.isArray(data)) return [];
    for (let i = 0; i < data.length; i++) {
      try {
        data[i].exams = await apiClient.get(`/ujian/kelas/${data[i].id}`);
      } catch (examErr) {
        data[i].exams = [];
      }
    }
    return data;
  });

  $: if (token) {
    try {
      const tokenString = token.startsWith('Bearer ') ? token.substring(7) : token;
      const payload = JSON.parse(atob(tokenString.split('.')[1]));
      user = { id: payload.id, nama: payload.nama, email: payload.email, role: payload.role };
    } catch (e) {
      console.error('Invalid token in Classes.svelte', e);
    }
  }

  let loading = true;
  let showAddForm = false;

  // Modal states
  let showAddModal = false;
  let showEditModal = false;
  let classToEdit = null;

  onMount(async () => {
    document.body.classList.add('admin-layout');
    if (!token) token = localStorage.getItem('token');
    if (token) {
      try {
        await classesStore.refresh();
      } catch (e) {
        toast.error('Gagal memuat data kelas');
      }
    }
    loading = false;
  });

  onDestroy(() => {
    document.body.classList.remove('admin-layout');
  });

  let formClass = { nama_kelas: '', deskripsi: '' };

  function openAddModal() {
    formClass = { nama_kelas: '', deskripsi: '' };
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
  }

  function openEditModal(classItem) {
    classToEdit = classItem;
    formClass = { 
      nama_kelas: classItem.nama_kelas,
      deskripsi: classItem.deskripsi || '' 
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    classToEdit = null;
  }

  async function addClass() {
    if (!formClass.nama_kelas) {
      toast.warning('Silakan lengkapi nama kelas');
      return;
    }
    try {
      await apiClient.post('/kelas', formClass);
      await classesStore.refresh(true);
      closeAddModal();
      toast.success('Kelas berhasil ditambahkan');
    } catch (error) {
      toast.error(error.message || 'Terjadi kesalahan saat menambahkan kelas');
    }
  }

  async function updateClass() {
    if (!formClass.nama_kelas) {
      toast.warning('Silakan lengkapi nama kelas');
      return;
    }
    try {
      await apiClient.put(`/kelas/${classToEdit.id}`, { 
        nama_kelas: formClass.nama_kelas,
        deskripsi: formClass.deskripsi || ''
      });
      await classesStore.refresh(true);
      closeEditModal();
      toast.success('Kelas berhasil diperbarui');
    } catch (error) {
      toast.error(error.message || 'Terjadi kesalahan saat memperbarui kelas');
    }
  }

  async function deleteClass(id, nama_kelas) {
    showConfirmation(`Apakah Anda yakin ingin menghapus kelas "${nama_kelas}"?`, async () => {
      try {
        await apiClient.delete(`/kelas/${id}`);
        await classesStore.refresh(true);
        toast.success('Kelas berhasil dihapus');
      } catch (error) {
        toast.error(error.message || 'Terjadi kesalahan saat menghapus kelas');
      }
    });
  }

  let showAddStudentsModal = false;
  let selectedClass = null;
  let availableStudents = [];
  let selectedStudents = new Set();
  let selectedStudentsCount = 0;
  let showConfirmModal = false;
  let confirmCallback = null;
  let confirmMessage = '';
  let showViewStudentsModal = false;
  let studentsInClass = [];

  async function openAddStudentsModal(classItem) {
    selectedClass = classItem;
    showAddStudentsModal = true;
    try {
      const students = await apiClient.get('/users/students');
      availableStudents = students.filter(s => !s.kelas_id);
    } catch (error) {
      toast.error('Terjadi kesalahan saat memuat daftar siswa');
    }
  }

  async function viewStudentsInClass(classItem) {
    selectedClass = classItem;
    showViewStudentsModal = true;
    try {
      const classDetail = await apiClient.get(`/kelas/${classItem.id}`);
      studentsInClass = classDetail.students || [];
    } catch (error) {
      toast.error('Terjadi kesalahan saat memuat daftar siswa');
    }
  }

  async function removeStudentFromClass(student) {
    showConfirmation(`Keluarkan ${student.nama} dari kelas ${selectedClass.nama_kelas}?`, async () => {
      try {
        await apiClient.put(`/users/${student.id}`, { 
          nama: student.nama, 
          email: student.email, 
          role: 'siswa', 
          kelas_id: null 
        });
        await classesStore.refresh(true);
        showViewStudentsModal = false;
        toast.success('Siswa berhasil dikeluarkan dari kelas');
      } catch (error) {
        toast.error('Terjadi kesalahan: ' + error.message);
      }
    });
  }

  function toggleStudentSelection(studentId) {
    if (selectedStudents.has(studentId)) {
      selectedStudents.delete(studentId);
      selectedStudentsCount--;
    } else {
      selectedStudents.add(studentId);
      selectedStudentsCount++;
    }
  }

  function showConfirmation(message, callback) {
    confirmMessage = message;
    confirmCallback = callback;
    showConfirmModal = true;
  }

  async function confirmAction() {
    if (confirmCallback) await confirmCallback();
    hideConfirmation();
  }

  function hideConfirmation() {
    showConfirmModal = false;
    confirmCallback = null;
    confirmMessage = '';
  }

  async function assignStudentsToClass() {
    if (selectedStudentsCount === 0) return;
    showConfirmation(`Masukkan ${selectedStudentsCount} siswa ke kelas ${selectedClass.nama_kelas}?`, async () => {
      try {
        for (const studentId of selectedStudents) {
          const student = availableStudents.find(s => s.id === studentId);
          if (student) {
            await apiClient.put(`/users/${studentId}`, { 
              nama: student.nama, 
              email: student.email, 
              role: 'siswa', 
              kelas_id: Number(selectedClass.id) 
            });
          }
        }
        showAddStudentsModal = false;
        selectedStudents.clear();
        selectedStudentsCount = 0;
        await classesStore.refresh(true);
        toast.success('Siswa berhasil dimasukkan ke kelas.');
      } catch (error) {
        toast.error('Terjadi kesalahan: ' + error.message);
      }
    });
  }
</script>


  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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
              <span>Manajemen Akademik</span>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Manajemen Kelas
            </h1>
            <p class="text-gray-600 mt-2">Buat dan kelola kelas untuk mengorganisir siswa.</p>
          </div>
          <button 
            on:click={openAddModal} 
            class="group px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <svg class="w-5 h-5 mr-2 inline group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Tambah Kelas
          </button>
        </div>
      </div>

        <!-- Classes List -->
        <div class="space-y-4">
          {#if $classesStore && $classesStore.length > 0}
            {#each $classesStore as classItem, index}
              <div class="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
                <!-- Colored status bar -->
                <div class="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                
                <div class="p-6">
                  <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div class="flex-1">
                      <!-- Class Title -->
                      <div class="flex items-center space-x-3 mb-3">
                        <div class="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
                          <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                          </svg>
                        </div>
                        <h2 class="text-xl font-bold text-gray-800">{classItem.nama_kelas}</h2>
                      </div>
                      
                      <!-- Description -->
                      <p class="text-gray-600 text-sm mb-3 ml-12">
                        {classItem.deskripsi || 'Tidak ada deskripsi'}
                      </p>
                      
                      <!-- Student Count Button -->
                      <button 
                        on:click={() => viewStudentsInClass(classItem)} 
                        class="ml-12 inline-flex items-center space-x-2 text-sm text-indigo-600 hover:text-indigo-700 transition-colors group/btn"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                        </svg>
                        <span>{classItem.jumlah_siswa || 0} Siswa</span>
                        <svg class="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="flex items-center gap-2">
                      <button 
                        on:click={() => openEditModal(classItem)} 
                        class="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                        title="Edit Kelas"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                      
                      <button 
                        on:click={() => openAddStudentsModal(classItem)} 
                        class="p-2 text-sky-600 hover:bg-sky-100 rounded-xl transition-colors"
                        title="Tambah Siswa"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                        </svg>
                      </button>
                      
                      <button 
                        on:click={() => deleteClass(classItem.id, classItem.nama_kelas)} 
                        class="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors"
                        title="Hapus Kelas"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          {:else}
            <!-- Empty State -->
            <div class="bg-white rounded-2xl shadow-lg p-12 text-center">
              <div class="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                <svg class="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
              </div>
              <h3 class="text-xl font-semibold text-gray-800 mb-2">Belum Ada Kelas</h3>
              <p class="text-gray-600 mb-6">Mulai dengan membuat kelas pertama Anda</p>
              <button
                on:click={openAddModal}
                class="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:-translate-y-1"
              >
                <svg class="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Tambah Kelas
              </button>
            </div>
          {/if}
        </div>
    </div>
  </div>

  <!-- Modal Tambah Siswa -->
  {#if showAddStudentsModal}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-scale-in">
        <div class="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <h3 class="text-lg font-semibold text-white">Tambah Siswa: {selectedClass?.nama_kelas}</h3>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
          {#if availableStudents.length > 0}
            <div class="space-y-2">
              {#each availableStudents as student}
                <div class="flex items-center p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedStudents.has(student.id)} 
                    on:change={() => toggleStudentSelection(student.id)} 
                    class="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <label class="ml-3 flex-1 cursor-pointer">
                    <div class="font-medium text-gray-800">{student.nama}</div>
                    <div class="text-xs text-gray-500">{student.email}</div>
                  </label>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8">
              <svg class="w-16 h-16 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
              </svg>
              <p class="text-gray-500">Tidak ada siswa yang tersedia</p>
              <p class="text-sm text-gray-400 mt-1">Semua siswa sudah memiliki kelas</p>
            </div>
          {/if}
        </div>
        <div class="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button on:click={() => showAddStudentsModal = false} class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors">
            Batal
          </button>
          <button 
            on:click={assignStudentsToClass} 
            class="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={selectedStudentsCount === 0}
          >
            Masukkan ({selectedStudentsCount})
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal Lihat Siswa -->
  {#if showViewStudentsModal}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-scale-in">
        <div class="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <h3 class="text-lg font-semibold text-white">Siswa di Kelas: {selectedClass?.nama_kelas}</h3>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
          {#if studentsInClass.length > 0}
            <div class="space-y-2">
              {#each studentsInClass as student}
                <div class="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <div>
                    <p class="font-medium text-gray-800">{student.nama}</p>
                    <p class="text-sm text-gray-500">{student.email}</p>
                  </div>
                  <button 
                    on:click={() => removeStudentFromClass(student)} 
                    class="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors"
                    title="Keluarkan dari kelas"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8">
              <svg class="w-16 h-16 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
              <p class="text-gray-500">Belum ada siswa di kelas ini</p>
              <button 
                on:click={() => {
                  showViewStudentsModal = false;
                  openAddStudentsModal(selectedClass);
                }}
                class="mt-4 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
              >
                + Tambah Siswa
              </button>
            </div>
          {/if}
        </div>
        <div class="p-6 border-t border-gray-200 flex justify-end">
          <button on:click={() => showViewStudentsModal = false} class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Add Modal -->
  <Modal show={showAddModal} onClose={closeAddModal} title="Tambah Kelas Baru">
    <form on:submit|preventDefault={addClass} class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Nama Kelas</label>
        <input 
          bind:value={formClass.nama_kelas} 
          type="text" 
          required
          class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
          placeholder="Contoh: Matematika 10A, Bahasa Inggris 11B"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Deskripsi (Opsional)</label>
        <textarea 
          bind:value={formClass.deskripsi} 
          class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors" 
          placeholder="Deskripsi kelas, materi yang akan dipelajari, dll."
          rows="3"
        ></textarea>
      </div>
      <div class="flex justify-end space-x-3 pt-4">
        <button type="button" on:click={closeAddModal} class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors">
          Batal
        </button>
        <button type="submit" class="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
          Simpan Kelas
        </button>
      </div>
    </form>
  </Modal>

  <!-- Edit Modal -->
  <Modal show={showEditModal} onClose={closeEditModal} title="Edit Data Kelas">
    <form on:submit|preventDefault={updateClass} class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Nama Kelas</label>
        <input 
          bind:value={formClass.nama_kelas} 
          type="text" 
          required
          class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Deskripsi (Opsional)</label>
        <textarea 
          bind:value={formClass.deskripsi} 
          class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors" 
          placeholder="Deskripsi kelas, materi yang akan dipelajari, dll."
          rows="3"
        ></textarea>
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
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
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
</style>