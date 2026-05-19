<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { apiFetch } from '$lib/api';
  import toast from '../../lib/toast.js';
  import Modal from '../../components/Modal.svelte';

  let info: any = null;
  let loading = true;
  let updating = false;
  let updateLogs: string[] = [];
  let updateDone = false;
  let jobId = '';
  let pollTimer: any = null;
  let showConfirmModal = false;
  let logsExpanded = false;

  const steps = [
    { key: 'start', label: 'Memulai proses update', weight: 5 },
    { key: 'git_pull', label: 'Git pull dari repository', weight: 15 },
    { key: 'backend_deps', label: 'Install backend dependencies', weight: 25 },
    { key: 'frontend_deps', label: 'Install frontend dependencies', weight: 20 },
    { key: 'build', label: 'Build frontend', weight: 25 },
    { key: 'restart', label: 'Restart server', weight: 10 },
  ];

  $: currentStep = getCurrentStep();
  $: progress = getProgress();
  $: currentLabel = currentStep ? steps.find(s => s.key === currentStep)?.label || '' : '';

  function getCurrentStep() {
    if (updateDone) return 'done';
    if (updateLogs.length === 0) return '';
    for (let i = updateLogs.length - 1; i >= 0; i--) {
      const log = updateLogs[i].toLowerCase();
      if (log.includes('server berhasil direstart')) return 'restart';
      if (log.includes('update selesai')) return 'restart';
      if (log.includes('build frontend')) return 'build';
      if (log.includes('install frontend')) return 'frontend_deps';
      if (log.includes('install backend')) return 'backend_deps';
      if (log.includes('git pull')) return 'git_pull';
      if (log.includes('memulai proses update')) return 'start';
    }
    return 'start';
  }

  function getProgress() {
    if (updateDone) return 100;
    let pct = 0;
    for (const s of steps) {
      if (currentStep === s.key) {
        pct += s.weight * 0.3;
        break;
      }
      pct += s.weight;
      const idx = steps.findIndex(st => st.key === currentStep);
      if (steps.indexOf(s) < idx) continue;
    }
    return Math.min(Math.round(pct), 99);
  }

  function openConfirmModal() {
    showConfirmModal = true;
  }

  function closeConfirmModal() {
    showConfirmModal = false;
  }

  async function confirmUpdate() {
    showConfirmModal = false;
    await applyUpdate();
  }

  onMount(() => {
    loadInfo();
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  async function loadInfo() {
    try {
      loading = true;
      const res: any = await apiFetch('/update/info');
      if (res?.success) {
        info = res.data;
        if (info.running) {
          toast.info('Update sedang berjalan, memantau progres...');
          logsExpanded = false;
          updating = true;
          startPolling();
        }
      }
    } catch (err: any) {
      toast.error('Gagal memuat info update');
    } finally {
      loading = false;
    }
  }

  async function applyUpdate() {
    try {
      const res: any = await apiFetch('/update/apply', { method: 'POST' });
      if (res?.success) {
        jobId = res.job_id;
        toast.success('Update dimulai');
        updating = true;
        updateDone = false;
        updateLogs = [];
        logsExpanded = false;
        startPolling();
      } else {
        toast.error(res.message || 'Gagal memulai update');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal memulai update');
    }
  }

  function startPolling() {
    pollTimer = setInterval(async () => {
      try {
        const res: any = await apiFetch(`/update/status/${jobId}`);
        if (res?.success && res.data) {
          updateLogs = res.data.logs.map((l: any) => l.message);
          if (res.data.done) {
            clearInterval(pollTimer);
            pollTimer = null;
            updating = false;
            updateDone = true;
            toast.success('Update selesai! Server akan restart...');
          }
        }
      } catch (e) {
        clearInterval(pollTimer);
        pollTimer = null;
        updating = false;
        updateDone = true;
        updateLogs = [...updateLogs, 'Server restart terdeteksi. Update selesai!'];
      }
    }, 2000);
  }

  function getStatusIcon() {
    if (!info) return 'question';
    if (info.behind === null || info.behind === -1) return 'question';
    if (info.behind > 0) return 'alert';
    return 'check';
  }

  function getStatusText() {
    if (!info) return 'Memuat...';
    if (!info.has_remote) return 'Remote belum diatur';
    if (info.behind === null) return 'Tidak bisa cek';
    if (info.behind === -1) return 'Gagal cek remote';
    if (info.behind > 0) return `${info.behind} commit di belakang`;
    return 'Sudah yang terbaru';
  }

  function getStatusColor() {
    if (!info) return 'text-gray-600 bg-gray-100';
    if (!info.has_remote || info.behind === null || info.behind === -1) return 'text-yellow-700 bg-yellow-100';
    if (info.behind > 0) return 'text-red-700 bg-red-100';
    return 'text-green-700 bg-green-100';
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

    <!-- Header -->
    <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="inline-flex items-center space-x-2 text-sm text-indigo-600 mb-2">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 002 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 005.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 009 7.5c0-1.255-.434-2.443-1.18-3.5z"/>
              <path d="M15.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 0011 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 0015.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 0019 7.5c0-1.255-.434-2.443-1.18-3.5z"/>
            </svg>
            <span>Pengaturan</span>
          </div>
          <h1 class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Update Aplikasi
          </h1>
          <p class="text-gray-600 mt-2">Periksa dan terapkan pembaruan aplikasi</p>
        </div>
      </div>
    </div>

    {#if loading}
      <div class="bg-white rounded-2xl shadow-lg p-12 text-center">
        <svg class="w-8 h-8 mx-auto animate-spin text-indigo-600 mb-3" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <p class="text-gray-500">Memuat informasi...</p>
      </div>
    {:else if info}
      <!-- Version Info Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="bg-white rounded-2xl shadow-lg p-5">
          <div class="text-xs text-gray-500 mb-1">Versi</div>
          <div class="text-2xl font-bold text-gray-800">v{info.version}</div>
        </div>
        <div class="bg-white rounded-2xl shadow-lg p-5">
          <div class="text-xs text-gray-500 mb-1">Branch</div>
          <div class="text-lg font-semibold text-gray-800 truncate">{info.branch}</div>
        </div>
        <div class="bg-white rounded-2xl shadow-lg p-5">
          <div class="text-xs text-gray-500 mb-1">Commit</div>
          <div class="text-lg font-semibold text-gray-800 font-mono">{info.commit}</div>
        </div>
        <div class="bg-white rounded-2xl shadow-lg p-5">
          <div class={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusColor()}`}>
            {#if getStatusIcon() === 'check'}
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
            {:else if getStatusIcon() === 'alert'}
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
            {:else}
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
            {/if}
            {getStatusText()}
          </div>
        </div>
      </div>

      <!-- Remote Info -->
      <div class="bg-white rounded-2xl shadow-lg p-5 mb-8">
        <div class="flex items-center gap-3 min-w-0">
          <svg class="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
          </svg>
          <div class="min-w-0">
            <div class="text-sm text-gray-500">Remote Repository</div>
            <div class="text-sm font-medium text-gray-800 truncate">{info.remote_url}</div>
          </div>
        </div>
      </div>

      <!-- Action Button -->
      <div class="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-800">Terapkan Pembaruan</h3>
            <p class="text-sm text-gray-500 mt-1">Update akan berjalan di background.</p>
          </div>
          <button on:click={openConfirmModal} disabled={updating || !info.has_remote}
            class="group px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap self-start"
          >
            {#if updating}
              <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Sedang berjalan...
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Update Sekarang
            {/if}
          </button>
        </div>

        <!-- Progress Area -->
        {#if updating || updateDone}
        <div class="mt-6 border-t border-gray-100 pt-6">
          {#if updateDone}
            <div class="flex items-center gap-3 mb-4">
              <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-gray-800">Update selesai!</p>
                <p class="text-xs text-gray-500">Server akan restart. Refresh halaman setelah beberapa saat.</p>
              </div>
            </div>
          {:else}
            <div class="flex items-center gap-3 mb-4">
              <svg class="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-gray-800 truncate">{currentLabel || 'Memulai...'}</p>
                <p class="text-xs text-gray-500">Progress: {progress}%</p>
              </div>
            </div>
          {/if}

          <!-- Progress Bar -->
          <div class="w-full bg-gray-200 rounded-full h-2.5 mb-4">
            <div class="h-2.5 rounded-full transition-all duration-500 ease-out {updateDone ? 'bg-green-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}" style="width: {progress}%"></div>
          </div>

          <!-- Step List -->
          <div class="space-y-1.5 mb-4">
            {#each steps as step}
              <div class="flex items-center gap-2 text-xs">
                {#if updateDone}
                  <svg class="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                {:else if steps.findIndex(s => s.key === currentStep) > steps.indexOf(step)}
                  <svg class="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                {:else if currentStep === step.key}
                  <svg class="w-3.5 h-3.5 text-indigo-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                {:else}
                  <svg class="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                  </svg>
                {/if}
                <span class="{steps.findIndex(s => s.key === currentStep) > steps.indexOf(step) ? 'text-gray-500' : currentStep === step.key ? 'text-indigo-700 font-medium' : 'text-gray-400'}">{step.label}</span>
              </div>
            {/each}
          </div>

          <!-- Toggle Logs -->
          <button on:click={() => logsExpanded = !logsExpanded} class="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
            <svg class="w-3.5 h-3.5 transition-transform {logsExpanded ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
            {logsExpanded ? 'Sembunyikan' : 'Tampilkan'} Detail Log
          </button>

          {#if logsExpanded}
          <div class="mt-3 bg-gray-900 rounded-xl p-4 font-mono text-xs max-h-64 overflow-y-auto space-y-1">
            {#each updateLogs as log}
              <div class="text-gray-300">{log}</div>
            {/each}
            {#if !updateDone}
              <div class="text-yellow-400 animate-pulse">⏳ Proses berjalan...</div>
            {:else}
              <div class="text-green-400">✓ Update selesai!</div>
            {/if}
          </div>
          {/if}
        </div>
        {/if}
      </div>

    {:else}
      <div class="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div class="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-800 mb-2">Gagal Memuat Info</h3>
        <button on:click={loadInfo} class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
          Coba Lagi
        </button>
      </div>
    {/if}
  </div>
</div>

<Modal show={showConfirmModal} title="Konfirmasi Update" onClose={closeConfirmModal}>
  <div class="space-y-4">
    <div class="flex items-start gap-3">
      <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
        <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <div>
        <p class="text-sm text-gray-600">Proses update akan menjalankan:</p>
        <ul class="mt-2 space-y-1 text-sm text-gray-600">
          <li class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
            Git pull dari remote repository
          </li>
          <li class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
            Install dependencies (backend & frontend)
          </li>
          <li class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
            Jalankan migrasi database
          </li>
          <li class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
            Build frontend
          </li>
          <li class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
            Restart server
          </li>
        </ul>
      </div>
    </div>
  </div>
  <div slot="footer" class="flex justify-end gap-3">
    <button
      on:click={closeConfirmModal}
      class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
    >
      Batal
    </button>
    <button
      on:click={confirmUpdate}
      class="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg rounded-lg transition-all"
    >
      Lanjutkan Update
    </button>
  </div>
</Modal>
