<script lang="ts">
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/api';
  import toast from '../../lib/toast.js';

  let backups: any[] = [];
  let loading = true;
  let creating = false;
  let restoring = false;

  onMount(() => {
    loadBackups();
  });

  async function loadBackups() {
    try {
      loading = true;
      const res: any = await apiFetch('/backup/list');
      backups = res?.data || [];
    } catch (err: any) {
      toast.error('Gagal memuat daftar backup');
    } finally {
      loading = false;
    }
  }

  async function createBackup() {
    try {
      creating = true;
      const res: any = await apiFetch('/backup/create', { method: 'POST' });
      toast.success(res.message || 'Backup berhasil dibuat');
      await loadBackups();
    } catch (err: any) {
      toast.error(err.message || 'Gagal membuat backup');
    } finally {
      creating = false;
    }
  }

  function downloadBackup(filename: string) {
    const token = localStorage.getItem('token');
    window.open(`/api/backup/download/${filename}?token=${token}`, '_blank');
  }

  async function restoreBackup(filename: string) {
    if (!confirm(`Yakin ingin me-restore dari backup "${filename}"?\nSemua data saat ini akan diganti dengan data dari backup.`)) return;
    try {
      restoring = true;
      const res: any = await apiFetch(`/backup/restore/${encodeURIComponent(filename)}`, { method: 'POST' });
      toast.success(res.message || 'Restore berhasil');
      await loadBackups();
    } catch (err: any) {
      toast.error(err.message || 'Gagal melakukan restore');
    } finally {
      restoring = false;
    }
  }

  async function deleteBackup(filename: string) {
    if (!confirm(`Hapus backup "${filename}"?`)) return;
    try {
      const res: any = await apiFetch(`/backup/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      toast.success(res.message || 'Backup berhasil dihapus');
      await loadBackups();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus backup');
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function getDBName() {
    // extract DB name from backup filename or just show generic
    return 'ujian_db';
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

    <!-- Header -->
    <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="inline-flex items-center space-x-2 text-sm text-indigo-600 mb-2">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 002 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 005.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 009 7.5c0-1.255-.434-2.443-1.18-3.5z"/>
              <path d="M15.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 0011 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 0015.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 0019 7.5c0-1.255-.434-2.443-1.18-3.5A7.968 7.968 0 0015.5 4z"/>
            </svg>
            <span>Pengaturan</span>
          </div>
          <h1 class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Backup & Restore
          </h1>
          <p class="text-gray-600 mt-2">Kelola backup database dan file aplikasi</p>
        </div>
        <button on:click={createBackup} disabled={creating}
          class="group px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {#if creating}
            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Membuat...
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Buat Backup Baru
          {/if}
        </button>
      </div>
    </div>

    <!-- Info Card -->
    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 mb-8">
      <div class="flex items-start gap-3">
        <div class="p-2 bg-blue-100 rounded-lg shrink-0">
          <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div class="text-sm text-blue-800">
          <p class="font-semibold mb-1">Informasi</p>
          <p>Backup mencakup seluruh database <strong>{getDBName()}</strong> dan file uploads. File backup disimpan di server dalam format <code>.tar.gz</code>.</p>
        </div>
      </div>
    </div>

    <!-- Backup List -->
    <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <h2 class="text-lg font-semibold text-gray-800">Daftar Backup</h2>
      </div>

      {#if loading}
        <div class="p-12 text-center">
          <svg class="w-8 h-8 mx-auto animate-spin text-indigo-600 mb-3" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p class="text-gray-500">Memuat daftar backup...</p>
        </div>
      {:else if backups.length === 0}
        <div class="p-12 text-center">
          <div class="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-800 mb-2">Belum Ada Backup</h3>
          <p class="text-sm text-gray-500">Klik tombol "Buat Backup Baru" untuk membuat backup pertama.</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nama File</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tanggal</th>
                <th class="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Ukuran</th>
                <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100">
              {#each backups as backup}
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{backup.filename}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(backup.created_at)}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">{backup.size}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="flex justify-end gap-1">
                      <button on:click={() => downloadBackup(backup.filename)}
                        class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Download">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                      </button>
                      <button on:click={() => restoreBackup(backup.filename)} disabled={restoring}
                        class="p-2 text-amber-600 hover:bg-amber-50 rounded-lg disabled:opacity-50" title="Restore">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                      </button>
                      <button on:click={() => deleteBackup(backup.filename)}
                        class="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Hapus">
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
      {/if}
    </div>
  </div>
</div>
