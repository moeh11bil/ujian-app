<script lang="ts">
  import SimpleLayout from '../../layouts/SimpleLayout.svelte';
  import { user, token } from '../../stores/authStore';
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/api';
  import toast from '../../lib/toast.js';

  let results: any[] = [];
  let loading = true;

  onMount(async () => {
    if (!$token) {
      loading = false;
      return;
    }
    await fetchResults();
  });

   async function fetchResults() {
     try {
       loading = true;
       const response = await apiFetch<any[]>('/api/hasil');
       results = response || [];
     } catch (error: any) {
       toast.error('Gagal memuat hasil: ' + error.message);
     } finally {
       loading = false;
     }
   }

  function formatDuration(minutes: number) {
    if (!minutes) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hrs > 0) return `${hrs} jam ${mins} menit`;
    return `${mins} menit`;
  }
</script>

<SimpleLayout>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      <div class="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-8 text-white">
        <h1 class="text-3xl font-bold">Hasil Ujian Anda</h1>
        <p class="mt-2 text-blue-100 opacity-90">Riwayat performa dan nilai ujian yang telah Anda selesaikan</p>
      </div>
      
      <div class="p-6">
        <div class="flex items-center space-x-4 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div class="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
            {$user?.nama?.charAt(0).toUpperCase() || 'S'}
          </div>
          <div>
            <h2 class="text-lg font-bold text-gray-900">{$user?.nama || 'Siswa'}</h2>
            <p class="text-sm text-gray-600">{$user?.email || ''}</p>
          </div>
        </div>

        {#if loading}
          <div class="flex justify-center py-20">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        {:else if results.length === 0}
          <div class="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 class="mt-4 text-lg font-medium text-gray-900">Belum ada hasil ujian</h3>
            <p class="mt-2 text-gray-500 max-w-sm mx-auto">Selesaikan setidaknya satu ujian untuk melihat nilai dan statistik performa Anda di sini.</p>
          </div>
        {:else}
          <div class="overflow-x-auto rounded-xl border border-gray-200">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ujian</th>
                  <th scope="col" class="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal</th>
                  <th scope="col" class="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Durasi</th>
                  <th scope="col" class="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Benar/Salah</th>
                  <th scope="col" class="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Skor Akhir</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each results as result}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-bold text-gray-900">{result.ujian_judul}</div>
                      <div class="text-xs text-gray-500">{result.nama_kelas || 'Umum'}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {new Date(result.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                     <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                       {formatDuration(result.durasi)}
                     </td>
                     <td class="px-6 py-4 whitespace-nowrap text-center">
                       <div class="flex items-center justify-center space-x-2">
                         <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                           {result.jumlah_benar || 0} Benar
                         </span>
                         <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                           {(result.jumlah_soal || 0) - (result.jumlah_benar || 0)} Salah
                         </span>
                       </div>
                     </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                      <span class={`text-xl font-black ${result.skor >= 75 ? 'text-green-600' : result.skor >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {Math.round(result.skor)}
                      </span>
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
</SimpleLayout>
