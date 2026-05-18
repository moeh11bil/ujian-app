<script>
  import { onMount, onDestroy } from 'svelte';
  import { apiFetch, downloadStudentExamCard } from '$lib/api';
  import toast from '$lib/toast';
  import { navigate } from 'svelte-routing';

  export let id; // userId from route

  let student = null;
  let submissions = [];
  let selectedSubmission = null;
  let essayGrading = [];
  let showResetConfirm = false;
  let resetType = ''; // 'essay' or 'all'
  let resetTargetId = null;
  let downloadingCard = false;

  onMount(async () => {
    document.body.classList.add('admin-layout');
    await fetchStudentSubmissions();
  });

  onDestroy(() => {
    document.body.classList.remove('admin-layout');
  });

  async function fetchStudentSubmissions() {
    try {
      const data = await apiFetch(`/essay-grading/student/${id}/submissions`);
      submissions = data;
      
      if (submissions.length > 0) {
        student = {
          name: submissions[0].student_name,
          email: submissions[0].student_email,
          id: id
        };
      }
    } catch (error) {
      toast.push({ type: 'error', message: `Gagal memuat data: ${error.message}` });
    }
  }

  async function viewSubmissionDetail(submission) {
    selectedSubmission = submission;
    try {
      const data = await apiFetch(`/essay-grading/student/${id}/exam/${submission.ujian_id}`);
      essayGrading = data.essay_grading;
    } catch (error) {
      toast.push({ type: 'error', message: `Gagal memuat detail: ${error.message}` });
    }
  }

  function closeSubmissionDetail() {
    selectedSubmission = null;
    essayGrading = [];
  }

  function confirmReset(type, hasilId) {
    resetType = type;
    resetTargetId = hasilId;
    showResetConfirm = true;
  }

  function cancelReset() {
    showResetConfirm = false;
    resetType = '';
    resetTargetId = null;
  }

  async function executeReset() {
    try {
      if (resetType === 'essay') {
        await apiFetch(`/essay-grading/submission/${resetTargetId}/reset-essay`, {
          method: 'POST'
        });
        toast.push({ type: 'success', message: 'Nilai essay berhasil direset' });
      } else if (resetType === 'all') {
        await apiFetch(`/essay-grading/submission/${resetTargetId}/reset-all`, {
          method: 'DELETE'
        });
        toast.push({ type: 'success', message: 'Hasil ujian berhasil direset' });
        // Refresh submissions
        await fetchStudentSubmissions();
        selectedSubmission = null;
      }

      // Refresh data
      if (selectedSubmission && selectedSubmission.id === resetTargetId) {
        await viewSubmissionDetail(selectedSubmission);
      }
    } catch (error) {
      toast.push({ type: 'error', message: `Gagal reset: ${error.message}` });
    } finally {
      showResetConfirm = false;
      resetType = '';
      resetTargetId = null;
    }
  }

  async function handleDownloadExamCard() {
    if (!student || !student.id) {
      toast.push({ type: 'error', message: 'Data siswa tidak ditemukan' });
      return;
    }

    try {
      downloadingCard = true;
      await downloadStudentExamCard(student.id, false);
      toast.push({ type: 'success', message: 'Kartu ujian berhasil diunduh' });
    } catch (error) {
      toast.push({ type: 'error', message: `Gagal mengunduh: ${error.message}` });
    } finally {
      downloadingCard = false;
    }
  }

  function getGradeColor(grade) {
    const colors = {
      'A': 'bg-green-100 text-green-800',
      'B': 'bg-blue-100 text-blue-800',
      'C': 'bg-yellow-100 text-yellow-800',
      'D': 'bg-orange-100 text-orange-800',
      'E': 'bg-red-100 text-red-800'
    };
    return colors[grade] || 'bg-gray-100 text-gray-800';
  }

  function getStatusBadge(status) {
    if (status === 'pending') return { class: 'bg-amber-100 text-amber-800', text: 'Menunggu Nilai Essay' };
    if (status === 'partial') return { class: 'bg-blue-100 text-blue-800', text: 'Sedang Dinilai' };
    return { class: 'bg-green-100 text-green-800', text: 'Selesai Dinilai' };
  }

  function getScorePercentage(score, maxScore) {
    if (!maxScore || maxScore === 0) return 0;
    return ((score / maxScore) * 100).toFixed(2);
  }

  function getProgressBarColor(percentage) {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    if (percentage >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  }

  function formatScore(value) {
    const num = parseFloat(value || 0);
    if (Number.isInteger(num)) return num.toString();
    return parseFloat(num.toFixed(2)).toString();
  }

  function formatPercentage(value) {
    const num = parseFloat(value || 0);
    return parseFloat(num.toFixed(1)).toString();
  }
</script>


  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    {#if !student}
      <div class="text-center py-12">
        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">Data Siswa Tidak Ditemukan</h3>
        <p class="text-gray-500 mb-4">Siswa ini belum mengerjakan ujian apapun</p>
        <a href="/dashboard/results" class="text-indigo-600 hover:text-indigo-700">← Kembali ke Hasil Ujian</a>
      </div>
    {:else}
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <a href="/dashboard/results" class="text-indigo-600 hover:text-indigo-700 mr-4">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <div class="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white mr-4">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 class="text-3xl font-bold text-gray-900">Riwayat Ujian Siswa</h1>
              <p class="mt-1 text-gray-600">{student.name} - {student.email}</p>
            </div>
          </div>
          
          <!-- Download Exam Card Button -->
          <button
            on:click={handleDownloadExamCard}
            disabled={downloadingCard}
            class="btn btn-primary flex items-center {downloadingCard ? 'opacity-50 cursor-not-allowed' : ''}"
          >
            {#if downloadingCard}
              <svg class="animate-spin h-5 w-5 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Mengunduh...
            {:else}
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 9a2 2 0 01-2 2H9a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2v2zm-6 6l4-4 4 4m-4-4v12" />
              </svg>
              Unduh Kartu Ujian
            {/if}
          </button>
        </div>
      </div>

      <!-- Submissions List -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div class="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h2 class="text-xl font-bold text-gray-900">Riwayat Ujian ({submissions.length})</h2>
        </div>

        {#if submissions.length === 0}
          <div class="p-12 flex flex-col items-center justify-center text-gray-500">
            <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 class="text-lg font-medium text-gray-900 mb-1">Belum Ada Ujian</h3>
            <p class="text-gray-500">Siswa ini belum mengerjakan ujian apapun</p>
          </div>
        {:else}
          <div class="divide-y divide-gray-200">
            {#each submissions as submission}
              {@const statusBadge = getStatusBadge(submission.manual_grade_status)}
              {@const autoPercentage = getScorePercentage(submission.jumlah_benar || 0, submission.jumlah_soal || 0)}
              {@const essayPercentage = getScorePercentage(submission.total_essay_score || 0, submission.max_essay_score)}
              
              <div class="p-6 hover:bg-gray-50 transition-colors">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex-1">
                    <h3 class="text-lg font-bold text-gray-900">{submission.ujian_judul}</h3>
                    <p class="text-sm text-gray-500 mt-1">
                      Dikerjakan: {new Date(submission.waktu_selesai).toLocaleDateString('id-ID', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div class="text-right">
                    <div class="flex items-center space-x-2 mb-2">
                      <span class="px-3 py-1 text-sm font-semibold rounded-full {statusBadge.class}">
                        {statusBadge.text}
                      </span>
                      <span class="px-3 py-1 text-sm font-semibold rounded-full {getGradeColor(submission.grade || 'C')}">
                        Grade: {submission.grade || 'C'}
                      </span>
                    </div>
                    <span class="text-sm {submission.passed ? 'text-green-600' : 'text-red-600'} font-medium">
                      {submission.passed ? '✓ LULUS' : '✗ TIDAK LULUS'}
                    </span>
                  </div>
                </div>

                <!-- Score Cards -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div class="bg-indigo-50 rounded-lg p-3">
                    <div class="text-xs text-indigo-600 font-medium">Pilihan Ganda & Lainnya</div>
                    <div class="text-lg font-bold text-indigo-900">
                      {submission.jumlah_benar || 0}/{submission.jumlah_soal || 0} Benar
                    </div>
                    <div class="mt-1 w-full bg-indigo-200 rounded-full h-1.5">
                      <div class="{getProgressBarColor(autoPercentage)} h-1.5 rounded-full" style="width: {autoPercentage}%"></div>
                    </div>
                  </div>

                  <div class="bg-purple-50 rounded-lg p-3">
                    <div class="text-xs text-purple-600 font-medium">Essay</div>
                    <div class="text-lg font-bold text-purple-900">
                      {submission.essay_graded_count || 0}/{submission.total_essay_questions || 0} soal - Nilai: {formatScore(submission.total_essay_score)}
                    </div>
                    <div class="mt-1 w-full bg-purple-200 rounded-full h-1.5">
                      <div class="{getProgressBarColor(essayPercentage)} h-1.5 rounded-full" style="width: {essayPercentage}%"></div>
                    </div>
                  </div>

                  <div class="bg-gray-50 rounded-lg p-3">
                    <div class="text-xs text-gray-600 font-medium">Total</div>
                    <div class="text-lg font-bold text-gray-900">
                      {formatPercentage(submission.skor || 0)}/100
                    </div>
                  </div>

                  <div class="bg-emerald-50 rounded-lg p-3">
                    <div class="text-xs text-emerald-600 font-medium">Persentase</div>
                    <div class="text-lg font-bold {(submission.skor || 0) >= 70 ? 'text-emerald-600' : 'text-red-600'}">
                      {formatPercentage(submission.skor || 0)}%
                    </div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex space-x-2">
                  <a
                    href="/grading-detail/{submission.id}"
                    class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
                  >
                    <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Detail Penilaian
                  </a>
                  <button
                    on:click={() => viewSubmissionDetail(submission)}
                    class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Detail Essay
                  </button>

                  {#if submission.manual_grade_status !== 'pending'}
                    <button
                      on:click={() => confirmReset('essay', submission.id)}
                      class="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reset Nilai Essay
                    </button>
                  {/if}

                  <button
                    on:click={() => confirmReset('all', submission.id)}
                    class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Reset Ujian
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Submission Detail Modal -->
      {#if selectedSubmission}
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 class="text-xl font-bold text-gray-900">Detail Penilaian Essay</h3>
                <p class="text-xs text-gray-500 mt-1">Hanya menampilkan soal essay yang memerlukan penilaian manual</p>
              </div>
              <button on:click={closeSubmissionDetail} class="text-gray-400 hover:text-gray-600">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="p-6">
              <!-- Submission Info -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="text-center p-4 bg-indigo-50 rounded-lg">
                  <div class="text-sm text-indigo-600">Pilihan Ganda & Lainnya</div>
                  <div class="text-2xl font-bold text-indigo-900">{selectedSubmission.jumlah_benar || 0}/{selectedSubmission.jumlah_soal || 0}</div>
                </div>
                <div class="text-center p-4 bg-purple-50 rounded-lg">
                  <div class="text-sm text-purple-600">Essay</div>
                  <div class="text-2xl font-bold text-purple-900">{selectedSubmission.essay_graded_count || 0}/{selectedSubmission.total_essay_questions || 0} - {formatScore(selectedSubmission.total_essay_score)}</div>
                </div>
                <div class="text-center p-4 bg-gray-50 rounded-lg">
                  <div class="text-sm text-gray-600">Total</div>
                  <div class="text-2xl font-bold text-gray-900">{formatPercentage(selectedSubmission.skor || 0)}/100</div>
                </div>
                <div class="text-center p-4 bg-emerald-50 rounded-lg">
                  <div class="text-sm text-emerald-600">Persentase</div>
                  <div class="text-2xl font-bold {(selectedSubmission.skor || 0) >= 70 ? 'text-emerald-600' : 'text-red-600'}">{formatPercentage(selectedSubmission.skor || 0)}%</div>
                </div>
              </div>

              <!-- Essay Grading Details -->
              {#if essayGrading.length > 0}
                <h4 class="text-lg font-bold text-gray-900 mb-4">Detail Penilaian Essay</h4>
                <div class="space-y-4">
                  {#each essayGrading as essay}
                    <div class="bg-gray-50 rounded-lg p-4 border {essay.given_score > 0 ? 'border-green-200' : 'border-amber-200'}">
                      <div class="flex items-start justify-between mb-3">
                        <div>
                          <span class="text-sm font-semibold text-gray-700">Soal #{essay.nomor_urut}</span>
                          <span class="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                            Bobot: {essay.soal_bobot} poin
                          </span>
                        </div>
                        {#if essay.graded_by}
                          <div class="text-right">
                            <div class="text-lg font-bold {essay.given_score >= essay.soal_bobot * 0.8 ? 'text-green-600' : essay.given_score >= essay.soal_bobot * 0.6 ? 'text-yellow-600' : 'text-red-600'}">
                              {essay.given_score} / {essay.soal_bobot}
                            </div>
                            <div class="text-xs text-gray-500">
                              {getScorePercentage(essay.given_score, essay.soal_bobot)}%
                            </div>
                          </div>
                        {:else}
                          <span class="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                            Belum Dinilai
                          </span>
                        {/if}
                      </div>

                      <div class="mb-3">
                        <p class="text-sm text-gray-900 whitespace-pre-wrap">{essay.teks_soal}</p>
                      </div>

                      {#if essay.student_answer}
                        <div class="bg-white rounded-lg p-3 mb-3 border border-gray-200">
                          <p class="text-xs font-semibold text-gray-600 mb-1">Jawaban Siswa:</p>
                          <p class="text-sm text-gray-900 whitespace-pre-wrap">{essay.student_answer}</p>
                        </div>
                      {/if}

                      {#if essay.notes}
                        <div class="bg-green-50 rounded-lg p-3 border border-green-200">
                          <p class="text-xs font-semibold text-green-700 mb-1">Catatan Guru:</p>
                          <p class="text-sm text-green-900">{essay.notes}</p>
                        </div>
                      {/if}

                      {#if essay.grader_name}
                        <div class="mt-2 text-xs text-gray-500 text-right">
                          Dinilai oleh: {essay.grader_name} pada {new Date(essay.graded_at).toLocaleDateString('id-ID')}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="text-center py-8 text-gray-500">
                  <svg class="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>Belum ada penilaian essay</p>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- Reset Confirmation Modal -->
      {#if showResetConfirm}
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div class="text-center mb-4">
              <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-gray-900 mb-2">
                {resetType === 'essay' ? 'Reset Nilai Essay?' : 'Reset Ujian?'}
              </h3>
              <p class="text-gray-600">
                {resetType === 'essay' 
                  ? 'Nilai essay akan dihapus dan submission akan kembali ke status "Menunggu Nilai Essay". Nilai pilihan ganda tetap dipertahankan.' 
                  : 'Semua hasil ujian akan dihapus. Siswa dapat mengerjakan ulang ujian ini.'}
              </p>
            </div>

            <div class="flex space-x-3">
              <button
                on:click={cancelReset}
                class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                Batal
              </button>
              <button
                on:click={executeReset}
                class="flex-1 px-4 py-2 {resetType === 'essay' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'} text-white font-medium rounded-lg transition-colors"
              >
                Ya, Reset
              </button>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>

