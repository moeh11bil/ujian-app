<script>
  import { onMount, onDestroy } from 'svelte';
  import { apiFetch } from '$lib/api';
  import toast from '../../lib/toast';
  import { navigate } from 'svelte-routing';

  export let id; // hasil_id from route

  let submission = null;
  let essays = [];
  let currentEssayIndex = 0;
  let saving = false;
  let showAllEssays = false;

  // Modal state
  let showConfirmModal = false;
  let confirmMessage = '';
  let confirmCallback = null;

  // Form data
  let currentScore = '';
  let currentNotes = '';

  async function fetchSubmission() {
    try {
      const data = await apiFetch(`/essay-grading/submission/${id}/essays`);
      submission = data.submission;
      essays = data.essays;
      
      if (essays.length > 0) {
        loadEssayForGrading(0);
      }
    } catch (error) {
      toast.error(`Gagal memuat data: ${error.message}`);
    }
  }

  function loadEssayForGrading(index) {
    if (essays[index]) {
      currentEssayIndex = index;
      const essay = essays[index];
      currentScore = essay.given_score?.toString() || '';
      currentNotes = essay.grading_notes || '';
    }
  }

  function selectEssay(index) {
    loadEssayForGrading(index);
  }

  async function submitGrade() {
    if (!currentScore || parseFloat(currentScore) < 0) {
      toast.error('Nilai harus antara 0 dan bobot maksimum');
      return;
    }

    const essay = essays[currentEssayIndex];
    const maxScore = essay.bobot;
    const score = parseFloat(currentScore);

    if (score > maxScore) {
      toast.error(`Nilai tidak boleh melebihi ${maxScore}`);
      return;
    }

    saving = true;
    try {
      await apiFetch(`/essay-grading/submission/${id}/essay/${essay.soal_id}/grade`, {
        method: 'POST',
        body: JSON.stringify({
          given_score: score,
          notes: currentNotes,
          student_answer: essay.student_answer || ''
        })
      });

      toast.success('Nilai berhasil disimpan');

      // Update local state
      essays[currentEssayIndex].given_score = score;
      essays[currentEssayIndex].grading_notes = currentNotes;
      essays[currentEssayIndex].is_graded = true;

      // Move to next ungraded essay or refresh
      const nextUngraded = essays.findIndex((e, i) => !e.is_graded && i !== currentEssayIndex);
      if (nextUngraded !== -1) {
        loadEssayForGrading(nextUngraded);
      }

      // Refresh submission data
      fetchSubmission();
    } catch (error) {
      toast.error(`Gagal menyimpan nilai: ${error.message}`);
    } finally {
      saving = false;
    }
  }

  async function submitAllGrades() {
    // Just confirm and submit - no need to warn about ungraded since user is explicitly clicking "Simpan & Selesai"
    submitAllGradesConfirmed();
  }

  function submitAllGradesConfirmed() {
    saving = true;

    // First, update the current essay's data with what's in the input fields
    if (essays[currentEssayIndex]) {
      essays[currentEssayIndex].given_score = currentScore ? parseFloat(currentScore) : 0;
      essays[currentEssayIndex].grading_notes = currentNotes;
    }

    // Now submit all grades
    const grades = essays.map(essay => ({
      soal_id: essay.soal_id,
      given_score: essay.given_score || 0,
      notes: essay.grading_notes || '',
      student_answer: essay.student_answer || ''
    }));

    apiFetch(`/essay-grading/submission/${id}/grade-all`, {
      method: 'POST',
      body: { grades }
    }).then(() => {
      toast.success('✅ Semua nilai berhasil disimpan dan penilaian selesai!');

      // Redirect after short delay
      setTimeout(() => {
        navigate('/dashboard/grading-queue');
      }, 1500);
    }).catch((error) => {
      toast.error(`Gagal menyimpan nilai: ${error.message}`);
    }).finally(() => {
      saving = false;
    });
    }

  function showConfirmation(message, callback) {
    confirmMessage = message;
    confirmCallback = callback;
    showConfirmModal = true;
  }

  function confirmAction() {
    if (confirmCallback) {
      confirmCallback();
    }
    showConfirmModal = false;
  }

  function hideConfirmation() {
    showConfirmModal = false;
    confirmCallback = null;
  }

  function getScoreColor(score, maxScore) {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  onMount(() => {
    document.body.classList.add('admin-layout');
    fetchSubmission();
  });

  onDestroy(() => {
    document.body.classList.remove('admin-layout');
  });
</script>


  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    {#if !submission}
      <div class="text-center py-12">
        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">Submission Tidak Ditemukan</h3>
        <p class="text-gray-500 mb-4">Data penilaian tidak tersedia</p>
        <a href="/dashboard/grading-queue" class="text-indigo-600 hover:text-indigo-700">← Kembali ke Antrian</a>
      </div>
    {:else}
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <a href="/dashboard/grading-queue" class="text-indigo-600 hover:text-indigo-700 text-sm flex items-center mb-2">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Kembali ke Antrian
            </a>
            <h1 class="text-3xl font-bold text-gray-900">Penilaian Essay</h1>
            <p class="mt-1 text-gray-600">{submission.ujian_judul}</p>
          </div>
          <div class="text-right">
            <div class="text-sm text-gray-600">Siswa</div>
            <div class="text-lg font-bold text-gray-900">{submission.student_name}</div>
            <div class="text-sm text-gray-500">{submission.student_email}</div>
          </div>
        </div>
      </div>

      <!-- Submission Info Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div class="text-sm text-gray-600">Status</div>
          <div class="mt-1 flex items-center">
            {#if submission.manual_grade_status === 'pending'}
              <span class="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">Menunggu</span>
            {:else if submission.manual_grade_status === 'partial'}
              <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">Proses</span>
            {:else}
              <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Selesai</span>
            {/if}
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div class="text-sm text-gray-600">Nilai PG</div>
          <div class="mt-1 text-2xl font-bold text-indigo-600">{submission.auto_grade_score}</div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div class="text-sm text-gray-600">Nilai Essay</div>
          <div class="mt-1 text-2xl font-bold text-purple-600">{submission.total_essay_score}</div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div class="text-sm text-gray-600">Total Sementara</div>
          <div class="mt-1 text-2xl font-bold text-gray-900">{submission.current_score}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Essay List Sidebar -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-4">
            <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h2 class="text-lg font-bold text-gray-900">Daftar Essay</h2>
              <p class="text-sm text-gray-600 mt-1">{essays.filter(e => e.is_graded).length} dari {essays.length} dinilai</p>
            </div>
            <div class="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {#each essays as essay, index}
                <button
                  on:click={() => selectEssay(index)}
                  class="w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors {currentEssayIndex === index ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      <div class="flex items-center">
                        <span class="text-sm font-semibold text-gray-900">Soal #{essay.nomor_urut}</span>
                        {#if essay.is_graded}
                          <svg class="w-4 h-4 text-green-500 ml-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                          </svg>
                        {/if}
                      </div>
                      <div class="text-xs text-gray-500 mt-1 line-clamp-2">{essay.teks_soal.substring(0, 50)}...</div>
                    </div>
                    {#if essay.is_graded}
                      <div class="text-right">
                        <div class="text-sm font-bold {getScoreColor(essay.given_score, essay.bobot)}">
                          {essay.given_score}/{essay.bobot}
                        </div>
                      </div>
                    {:else}
                      <div class="text-xs text-amber-600 font-medium">Belum dinilai</div>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          </div>
        </div>

        <!-- Grading Area -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-bold text-gray-900">Soal #{essays[currentEssayIndex]?.nomor_urut}</h2>
                <span class="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-semibold rounded-full">
                  Bobot: {essays[currentEssayIndex]?.bobot} poin
                </span>
              </div>
            </div>

            <div class="p-6">
              <!-- Question -->
              <div class="mb-6">
                <h3 class="text-sm font-semibold text-gray-700 mb-2">Pertanyaan:</h3>
                <div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p class="text-gray-900 whitespace-pre-wrap">{essays[currentEssayIndex]?.teks_soal}</p>
                </div>
              </div>

              <!-- Example Answer (for teacher reference) -->
              {#if essays[currentEssayIndex]?.contoh_jawaban}
                <div class="mb-6">
                  <h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <svg class="w-4 h-4 mr-1 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Pedoman Penilaian / Contoh Jawaban:
                  </h3>
                  <div class="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p class="text-gray-900 whitespace-pre-wrap">{essays[currentEssayIndex]?.contoh_jawaban}</p>
                  </div>
                </div>
              {/if}

              <!-- Student Answer -->
              <div class="mb-6">
                <h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <svg class="w-4 h-4 mr-1 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Jawaban Siswa:
                </h3>
                <div class="p-4 bg-white rounded-lg border-2 border-purple-200">
                  <p class="text-gray-900 whitespace-pre-wrap min-h-24">{essays[currentEssayIndex]?.student_answer || 'Tidak ada jawaban'}</p>
                </div>
              </div>

              <!-- Grading Form -->
              <div class="border-t border-gray-200 pt-6">
                <h3 class="text-sm font-semibold text-gray-700 mb-4">Penilaian</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Nilai (0 - {essays[currentEssayIndex]?.bobot})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={essays[currentEssayIndex]?.bobot}
                      bind:value={currentScore}
                      class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                      placeholder="Masukkan nilai"
                    />
                  </div>
                </div>

                <div class="mb-6">
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Catatan untuk Siswa (Opsional)
                  </label>
                  <textarea
                    bind:value={currentNotes}
                    rows="3"
                    class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Berikan feedback atau catatan untuk perbaikan..."
                  ></textarea>
                </div>

                <div>
                  <button
                    on:click={submitAllGrades}
                    disabled={saving}
                    class="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    {#if saving}
                      <svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Menyimpan...
                    {:else}
                      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Simpan & Selesai
                    {/if}
                  </button>
                  <p class="text-xs text-gray-500 mt-2 text-center">
                    Menyimpan semua nilai dan menyelesaikan penilaian
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Navigation Buttons -->
          <div class="mt-4 flex justify-between">
            <button
              on:click={() => currentEssayIndex > 0 && loadEssayForGrading(currentEssayIndex - 1)}
              disabled={currentEssayIndex === 0}
              class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Soal Sebelumnya
            </button>
            <button
              on:click={() => currentEssayIndex < essays.length - 1 && loadEssayForGrading(currentEssayIndex + 1)}
              disabled={currentEssayIndex === essays.length - 1}
              class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              Soal Berikutnya
              <svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Confirmation Modal -->
  {#if showConfirmModal}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">Konfirmasi</h3>
          <p class="text-gray-600">{confirmMessage}</p>
        </div>
        <div class="flex space-x-3">
          <button
            on:click={hideConfirmation}
            class="flex-1 py-3 px-4 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-all"
          >
            Batal
          </button>
          <button
            on:click={confirmAction}
            class="flex-1 py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all"
          >
            Ya, Konfirmasi
          </button>
        </div>
      </div>
    </div>
  {/if}


<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
