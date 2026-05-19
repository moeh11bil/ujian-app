<script>
  import { onMount, onDestroy } from 'svelte';
  import { fetchWithAuth, apiFetch } from '$lib/api';
  import toast from '../../lib/toast.js';
  import Modal from '../../components/Modal.svelte';
  import ToastContainer from '../../components/ToastContainer.svelte';

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

  let users = [];
  let loading = true;
  let error = null;
  let searchTerm = '';
  let currentPage = 1;
  let totalPages = 1;
  let limit = 50;
  let searchTimeout;

  // Modal states
  let showAddModal = false;
  let showEditModal = false;
  let userToEdit = null;

  let formData = {
    nama: '',
    email: '',
    password: '',
    role: 'guru'
  };

  function onSearchChange() {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      fetchUsers(1);
    }, 500);
  }

  onMount(async () => {
    document.body.classList.add('admin-layout');
    await fetchUsers();
  });

  onDestroy(() => {
    document.body.classList.remove('admin-layout');
  });

  async function fetchUsers(page = 1) {
    try {
      loading = true;
      error = null;
      const response = await apiFetch(`/users/by-roles?roles=admin,guru&limit=${limit}&page=${page}&search=${encodeURIComponent(searchTerm)}`);
      users = response?.data || [];
      currentPage = response?.pagination?.page || page;
      totalPages = response?.pagination?.totalPages || 1;
    } catch (err) {
      console.error('Error fetching users:', err);
      error = err.message || 'Terjadi kesalahan saat mengambil data';
      users = [];
    } finally {
      loading = false;
    }
  }

  function goToPage(page) {
    if (page >= 1 && page <= totalPages) {
      fetchUsers(page);
    }
  }

  function getPageNumbers() {
    const pages = [];
    const delta = 1;
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (currentPage - delta > 2) pages.push('...');
    const start = Math.max(currentPage - delta, 2);
    const end = Math.min(currentPage + delta, totalPages - 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage + delta < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
  }

  function openAddModal() {
    formData = { nama: '', email: '', password: '', role: 'guru' };
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
  }

  function openEditModal(user) {
    userToEdit = user;
    formData = {
      nama: user.nama,
      email: user.email || '',
      password: '',
      role: user.role
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    userToEdit = null;
  }

  async function addUser() {
    if (!formData.nama || !formData.email || !formData.password) {
      toast.warning('Silakan lengkapi semua field');
      return;
    }
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: formData
      });
      toast.success('Pengguna berhasil ditambahkan');
      closeAddModal();
      await fetchUsers();
    } catch (error) {
      toast.error(error.message || 'Gagal menambahkan pengguna');
    }
  }

  async function updateUser() {
    try {
      const data = { ...formData };
      if (!data.password) delete data.password;
      await apiFetch(`/users/${userToEdit.id}`, {
        method: 'PUT',
        body: data
      });
      toast.success('Data pengguna berhasil diperbarui');
      closeEditModal();
      await fetchUsers();
    } catch (error) {
      toast.error(error.message || 'Gagal memperbarui pengguna');
    }
  }

  function deleteUser(id) {
    showConfirmation('Apakah Anda yakin ingin menghapus pengguna ini?', async () => {
      try {
        await apiFetch(`/users/${id}`, {
          method: 'DELETE'
        });
        toast.success('Pengguna berhasil dihapus');
        await fetchUsers();
      } catch (error) {
        toast.error(error.message || 'Gagal menghapus pengguna');
      }
    });
  }

  function getRoleBadge(role) {
    if (role === 'admin') return { label: 'Admin', class: 'bg-purple-100 text-purple-700' };
    return { label: 'Guru', class: 'bg-blue-100 text-blue-700' };
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
  <div class="fixed inset-0 pointer-events-none overflow-hidden">
    <div class="absolute -top-40 -right-40 w-80 h-80 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
    <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
    <div class="absolute top-1/2 left-1/2 w-80 h-80 bg-pink-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
  </div>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
    <!-- Header -->
    <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="inline-flex items-center space-x-2 text-sm text-indigo-600 mb-2">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 002 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 005.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 009 7.5c0-1.255-.434-2.443-1.18-3.5z"/>
              <path d="M15.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 0011 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 0015.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 0019 7.5c0-1.255-.434-2.443-1.18-3.5z"/>
            </svg>
            <span>Manajemen Pengguna</span>
          </div>
          <h1 class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Pengguna (Admin & Guru)
          </h1>
          <p class="text-gray-600 mt-2">Kelola akun admin dan guru</p>
        </div>
        <button
          on:click={openAddModal}
          class="group px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          <svg class="w-5 h-5 mr-2 inline group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Tambah Pengguna
        </button>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <div class="bg-white rounded-2xl shadow-lg p-4 mb-6">
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="flex-1 relative">
          <svg class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            bind:value={searchTerm}
            on:input={onSearchChange}
            placeholder="Cari nama atau email..."
            class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
      </div>
    </div>

    <!-- Error State -->
    {#if error}
      <div class="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8">
        <div class="flex items-center space-x-3">
          <svg class="h-6 w-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-sm text-red-700">{error}</p>
        </div>
      </div>
    {/if}

    <!-- Loading State -->
    {#if loading}
      <div class="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div class="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-500">Memuat data...</p>
      </div>
    {:else if users.length === 0}
      <!-- Empty State -->
      <div class="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div class="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
          <svg class="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-800 mb-2">Belum Ada Pengguna</h3>
        <p class="text-gray-600 mb-6">Tambahkan admin atau guru untuk mulai mengelola sistem</p>
        <button
          on:click={openAddModal}
          class="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:-translate-y-1"
        >
          Tambah Pengguna
        </button>
      </div>
    {:else}
      <!-- Users Table -->
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama</th>
                <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal Dibuat</th>
                <th class="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#each users as user (user.id)}
                <tr class="hover:bg-gray-50 transition-colors duration-150">
                  <td class="px-6 py-4">
                    <div class="flex items-center space-x-3">
                      <div class="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        {user.nama.charAt(0).toUpperCase()}
                      </div>
                      <span class="text-sm font-medium text-gray-800">{user.nama}</span>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-600">{user.email || '-'}</td>
                  <td class="px-6 py-4">
                    {@const badge = getRoleBadge(user.role)}
                    <span class="px-3 py-1 text-xs font-semibold rounded-full {badge.class}">{badge.label}</span>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-500">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                  </td>
                  <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button
                        on:click={() => openEditModal(user)}
                        class="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-all duration-200 tooltip"
                        title="Edit"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                      <button
                        on:click={() => deleteUser(user.id)}
                        class="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-all duration-200 tooltip"
                        title="Hapus"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        {#if totalPages > 1}
          <div class="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-100">
            <p class="text-sm text-gray-600">
              Halaman {currentPage} dari {totalPages}
            </p>
            <div class="flex items-center gap-1">
              <button
                on:click={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 {currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'} transition-colors"
              >
                Prev
              </button>
              {#each getPageNumbers() as page}
                {#if page === '...'}
                  <span class="px-2 text-gray-400">...</span>
                {:else}
                  <button
                    on:click={() => goToPage(page)}
                    class="px-3 py-1.5 text-sm rounded-lg transition-colors {page === currentPage ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}"
                  >
                    {page}
                  </button>
                {/if}
              {/each}
              <button
                on:click={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 {currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'} transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Add Modal -->
<Modal show={showAddModal} onClose={closeAddModal} title="Tambah Pengguna Baru">
  <form on:submit|preventDefault={addUser} class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap</label>
      <input
        bind:value={formData.nama}
        type="text"
        required
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        placeholder="Contoh: Ahmad Fauzi"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
      <input
        bind:value={formData.email}
        type="email"
        required
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        placeholder="contoh@email.com"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
      <input
        bind:value={formData.password}
        type="password"
        required
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        placeholder="Minimal 6 karakter"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Role</label>
      <select
        bind:value={formData.role}
        class="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      >
        <option value="guru">Guru</option>
        <option value="admin">Admin</option>
      </select>
    </div>
    <div class="flex justify-end space-x-3 pt-4">
      <button type="button" on:click={closeAddModal} class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors">
        Batal
      </button>
      <button type="submit" class="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
        Simpan
      </button>
    </div>
  </form>
</Modal>

<!-- Edit Modal -->
<Modal show={showEditModal} onClose={closeEditModal} title="Edit Pengguna">
  <form on:submit|preventDefault={updateUser} class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap</label>
      <input
        bind:value={formData.nama}
        type="text"
        required
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
      <input
        bind:value={formData.email}
        type="email"
        required
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Password <span class="text-gray-400 font-normal">(kosongkan jika tidak diubah)</span>
      </label>
      <input
        bind:value={formData.password}
        type="password"
        class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        placeholder="Biarkan kosong jika tidak diubah"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Role</label>
      <select
        bind:value={formData.role}
        class="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      >
        <option value="guru">Guru</option>
        <option value="admin">Admin</option>
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
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scale-in {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
  .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
  .animation-delay-2000 { animation-delay: 2s; }
  .animation-delay-4000 { animation-delay: 4s; }
  @keyframes blob {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
  }
  .animate-blob { animation: blob 7s infinite; }
  .tooltip { position: relative; }
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
