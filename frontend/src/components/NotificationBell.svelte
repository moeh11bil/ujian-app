<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fetchWithAuth } from '$lib/api';
  import Modal from './Modal.svelte';
  import { user, token } from '../stores/authStore';

  let showNotifications = false;
  let resetRequests: any[] = [];
  let unreadCount = 0;
  let pollInterval: any;
  
  // Modal state
  let showConfirmModal = false;
  let modalTitle = '';
  let modalMessage = '';
  let confirmAction: () => Promise<void>;
  let requestToProcess: any = null;

  // Fungsi fetchResetRequests
  async function fetchResetRequests() {
    try {
      const response = await fetchWithAuth<any[]>('/reset-requests');
      resetRequests = response || [];
      unreadCount = resetRequests.length;
    } catch (error) {
      console.error('Error fetching reset requests:', error);
    }
  }

  // Fungsi toggleNotifications
  function toggleNotifications() {
    showNotifications = !showNotifications;
  }

  function openConfirm(type: 'approve' | 'reject', request: any) {
    requestToProcess = request;
    modalTitle = type === 'approve' ? 'Konfirmasi Persetujuan' : 'Konfirmasi Penolakan';
    modalMessage = type === 'approve' 
      ? `Apakah Anda yakin ingin menyetujui permintaan reset ujian dari ${request.user_nama}?`
      : `Apakah Anda yakin ingin menolak permintaan reset ujian dari ${request.user_nama}?`;
    
    confirmAction = type === 'approve' ? approveRequest : rejectRequest;
    showConfirmModal = true;
  }

  // Fungsi approveRequest
  async function approveRequest() {
    try {
      await fetchWithAuth(`/reset-requests/${requestToProcess.id}/approve`, {
        method: 'PATCH'
      });
      
      resetRequests = resetRequests.filter(req => req.id !== requestToProcess.id);
      unreadCount = resetRequests.length;
      showConfirmModal = false;
      requestToProcess = null;
    } catch (error: any) {
      console.error('Error approving reset request:', error);
      alert('Gagal menyetujui permintaan reset: ' + error.message);
      showConfirmModal = false;
    }
  }

  // Fungsi rejectRequest
  async function rejectRequest() {
    try {
      await fetchWithAuth(`/reset-requests/${requestToProcess.id}/reject`, {
        method: 'PATCH'
      });
      
      resetRequests = resetRequests.filter(req => req.id !== requestToProcess.id);
      unreadCount = resetRequests.length;
      showConfirmModal = false;
      requestToProcess = null;
    } catch (error: any) {
      console.error('Error rejecting reset request:', error);
      alert('Gagal menolak permintaan reset: ' + error.message);
      showConfirmModal = false;
    }
  }

  onMount(async () => {
    if ($token && $user && ($user.role === 'admin' || $user.role === 'guru')) {
      await fetchResetRequests();
      
      // Set up polling to check for new reset requests every 30 seconds
      pollInterval = setInterval(fetchResetRequests, 30000);
    }
  });

  // Clean up interval on component destroy
  onDestroy(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });
</script>

{#if $user && ($user.role === 'admin' || $user.role === 'guru')}
  <div class="relative">
    <button 
      on:click={toggleNotifications}
      class="relative p-2 text-gray-700 hover:text-gray-900 focus:outline-none"
      aria-label="Notifikasi"
      aria-expanded={showNotifications}
    >
      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {#if unreadCount > 0}
        <span class="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
          {unreadCount}
        </span>
      {/if}
    </button>

    {#if showNotifications}
      <div class="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
        <div class="py-1">
          <div class="px-4 py-2 border-b border-gray-200">
            <h3 class="text-sm font-medium text-gray-900">Permintaan Reset Ujian</h3>
          </div>
          
          {#if resetRequests.length > 0}
            <div class="max-h-96 overflow-y-auto">
              {#each resetRequests as request}
                <div class="px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium text-gray-900">{request.user_nama}</p>
                      <p class="text-sm text-gray-500 truncate">{request.ujian_judul}</p>
                      <p class="text-xs text-gray-400 mt-1">
                        {new Date(request.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div class="flex space-x-2">
                      <button 
                        on:click={() => openConfirm('approve', request)}
                        class="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                      >
                        Terima
                      </button>
                      <button 
                        on:click={() => openConfirm('reject', request)}
                        class="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                      >
                        Tolak
                      </button>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="px-4 py-6 text-center">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">Tidak ada permintaan</h3>
              <p class="mt-1 text-sm text-gray-500">Belum ada permintaan reset ujian saat ini.</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <Modal 
    show={showConfirmModal} 
    title={modalTitle} 
    onClose={() => showConfirmModal = false}
  >
    <p class="text-sm text-gray-600">{modalMessage}</p>
    <svelte:fragment slot="footer">
      <div class="flex justify-end space-x-3">
        <button 
          on:click={() => showConfirmModal = false}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Batal
        </button>
        <button 
          on:click={confirmAction}
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Konfirmasi
        </button>
      </div>
    </svelte:fragment>
  </Modal>
{/if}
