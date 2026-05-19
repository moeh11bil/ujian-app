<script>
  import { onMount, onDestroy } from 'svelte';
  import { apiFetch, BASE_URL } from '$lib/api';
  import toast from '../../lib/toast';
  import { navigate } from 'svelte-routing';

  export let id; // hasil_id from route

  let previousPage = '/dashboard/grading-queue'; // fallback

  onMount(() => {
    const referrer = document.referrer;
    if (referrer && referrer.includes(window.location.hostname)) {
      const url = new URL(referrer);
      previousPage = url.pathname + url.search;
    }
  });

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate(previousPage);
    }
  }

  let submission = null;
  let questions = [];
  let currentSoalId = null;
  let saving = false;

  // Reactive current question
  $: uploadBase = BASE_URL.replace(/\/api\/?$/, '') || '';
  $: currentQuestion = questions.find(q => q.soal_id === currentSoalId) || null;
  $: currentIdx = questions.findIndex(q => q.soal_id === currentSoalId);

  let showConfirmModal = false;
  let confirmMessage = '';
  let confirmCallback = null;

  let filterType = 'all';
  let filterStatus = 'all';

  async function fetchSubmission() {
    try {
      const data = await apiFetch(`/essay-grading/submission/${id}/all-questions`);
      submission = data.submission;
      questions = data.questions;
      if (questions.length > 0) {
        selectQuestion(questions[0].soal_id);
      }
    } catch (error) {
      toast.error(`Gagal memuat data: ${error.message}`);
    }
  }

  function selectQuestion(soal_id) {
    currentSoalId = soal_id;
    const q = questions.find(q => q.soal_id == soal_id);
    if (q) {
      currentQuestion = q;
      currentIdx = questions.indexOf(q);
    }
  }

  function getFilteredQuestions() {
    return questions.filter(q => {
      if (filterType !== 'all' && q.tipe_soal !== filterType) return false;
      if (filterStatus !== 'all' && q.tipe_soal !== 'essay') {
        if (filterStatus === 'correct' && !q.is_correct) return false;
        if (filterStatus === 'incorrect' && q.is_correct) return false;
      }
      return true;
    });
  }

  function getQuestionTypeLabel(type) {
    const labels = {
      'pilihan_ganda': 'Pilihan Ganda',
      'essay': 'Essay / Uraian',
      'benar_salah': 'Benar / Salah',
      'multiple_answer': 'Pilihan Ganda Kompleks'
    };
    return labels[type] || type;
  }

  function getQuestionTypeColor(type) {
    const colors = {
      'pilihan_ganda': 'bg-blue-100 text-blue-800',
      'essay': 'bg-purple-100 text-purple-800',
      'benar_salah': 'bg-green-100 text-green-800',
      'multiple_answer': 'bg-amber-100 text-amber-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  }

  function getOptionLabel(option) {
    const labels = {
      'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E',
      'benar': 'Benar', 'salah': 'Salah'
    };
    return labels[option] || option;
  }

  function isOptionCorrect(question, option) {
    if (!question) return false;
    if (question.tipe_soal === 'pilihan_ganda') {
      return question.kunci_jawaban === option;
    } else if (question.tipe_soal === 'multiple_answer') {
      const correctAnswer = question.jawaban_multiple || question.kunci_jawaban;
      return correctAnswer?.split(',').map(a => a.trim()).includes(option);
    } else if (question.tipe_soal === 'benar_salah') {
      const correctBS = question.jawaban_benar_salah;
      if (!correctBS) return false;
      if (option === 'A' || option === 'benar') return correctBS === 'B';
      if (option === 'B' || option === 'salah') return correctBS === 'S';
    }
    return false;
  }

  function isOptionSelected(question, option) {
    if (!question?.student_answer) return false;
    if (question.tipe_soal === 'multiple_answer') {
      return question.student_answer.split(',').map(a => a.trim()).includes(option);
    }
    if (question.tipe_soal === 'benar_salah') {
      const studentAnswer = question.student_answer.toLowerCase();
      if (option === 'A' || option === 'benar') return studentAnswer === 'benar' || studentAnswer === 'b';
      if (option === 'B' || option === 'salah') return studentAnswer === 'salah' || studentAnswer === 's';
    }
    return question.student_answer === option;
  }

  function getScoreColor(score, maxScore) {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  function confirmAction() {
    if (confirmCallback) confirmCallback();
    showConfirmModal = false;
  }

  function hideConfirmation() {
    showConfirmModal = false;
    confirmCallback = null;
  }

  function showConfirmation(message, callback) {
    confirmMessage = message;
    confirmCallback = callback;
    showConfirmModal = true;
  }

  async function submitAllGrades() {
    const ungradedEssays = questions.filter(q => q.tipe_soal === 'essay' && !q.is_graded);
    if (ungradedEssays.length > 0) {
      showConfirmation(
        `Masih ada ${ungradedEssays.length} essay yang belum dinilai. Yakin ingin submit semua nilai?`,
        submitAllGradesConfirmed
      );
      return;
    }
    submitAllGradesConfirmed();
  }

  function submitAllGradesConfirmed() {
    saving = true;
    const grades = questions
      .filter(q => q.tipe_soal === 'essay')
      .map(essay => ({
        soal_id: essay.soal_id,
        given_score: essay.given_score || 0,
        notes: essay.grading_notes || '',
        student_answer: essay.student_answer || ''
      }));

    apiFetch(`/essay-grading/submission/${id}/grade-all`, {
      method: 'POST',
      body: { grades }
    }).then(() => {
      toast.success('Semua nilai berhasil disubmit!');
      setTimeout(() => goBack(), 1500);
    }).catch((error) => {
      toast.error(`Gagal submit nilai: ${error.message}`);
    }).finally(() => {
      saving = false;
    });
  }

  function goToPrev() {
    if (currentIdx > 0) {
      selectQuestion(questions[currentIdx - 1].soal_id);
    }
  }

  function goToNext() {
    if (currentIdx < questions.length - 1) {
      selectQuestion(questions[currentIdx + 1].soal_id);
    }
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
        <button on:click={goBack} class="text-indigo-600 hover:text-indigo-700">← Kembali</button>
      </div>
    {:else}
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <button on:click={goBack} class="text-indigo-600 hover:text-indigo-700 text-sm flex items-center mb-2">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Kembali
            </button>
            <h1 class="text-3xl font-bold text-gray-900">Detail Penilaian</h1>
            <p class="mt-1 text-gray-600">{submission.ujian_judul}</p>
          </div>
          <div class="text-right">
            <div class="text-sm text-gray-600">Siswa</div>
            <div class="mt-1 text-lg font-bold text-gray-900">{submission.student_name}</div>
            <div class="text-sm text-gray-500">{submission.student_email}</div>
          </div>
        </div>
      </div>

      <!-- Score Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div class="text-sm text-gray-600">Pilihan Ganda & Lainnya</div>
          <div class="mt-1 text-2xl font-bold text-blue-600">
            {submission.current_auto_score} / {submission.max_auto_score}
          </div>
          <div class="text-xs text-gray-500 mt-1">
            {submission.max_auto_score > 0 ? Math.round((submission.current_auto_score / submission.max_auto_score) * 100) : 0}% benar
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div class="text-sm text-gray-600">Essay</div>
          <div class="mt-1 text-2xl font-bold text-purple-600">
            {submission.current_essay_score} / {submission.max_essay_score}
          </div>
          <div class="text-xs text-gray-500 mt-1">
            {questions.filter(q => q.tipe_soal === 'essay' && q.is_graded).length} dari {questions.filter(q => q.tipe_soal === 'essay').length} dinilai
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div class="text-sm text-gray-600">Total Sementara</div>
          <div class="mt-1 text-2xl font-bold text-gray-900">
            {submission.current_auto_score + submission.current_essay_score} / {submission.max_auto_score + submission.max_essay_score}
          </div>
          <div class="text-xs text-gray-500 mt-1">
            {submission.max_auto_score + submission.max_essay_score > 0 
              ? Math.round(((submission.current_auto_score + submission.current_essay_score) / (submission.max_auto_score + submission.max_essay_score)) * 100) 
              : 0}%
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div class="text-sm text-gray-600">Status</div>
          <div class="mt-1">
            {#if submission.manual_grade_status === 'pending'}
              <span class="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">Menunggu</span>
            {:else if submission.manual_grade_status === 'partial'}
              <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">Proses</span>
            {:else}
              <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Selesai</span>
            {/if}
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div class="flex flex-wrap gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Tipe Soal</label>
            <select 
              bind:value={filterType}
              class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Semua Tipe</option>
              <option value="pilihan_ganda">Pilihan Ganda</option>
              <option value="benar_salah">Benar/Salah</option>
              <option value="multiple_answer">Multiple Answer</option>
              <option value="essay">Essay</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select 
              bind:value={filterStatus}
              class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Semua</option>
              <option value="correct">Benar</option>
              <option value="incorrect">Salah</option>
            </select>
          </div>
          <div class="flex-1"></div>
          <div class="text-sm text-gray-600 flex items-center">
            <span class="font-medium">{getFilteredQuestions().length}</span>
            <span class="mx-1">dari</span>
            <span class="font-medium">{questions.length}</span>
            <span class="ml-1">soal ditampilkan</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Question List Sidebar -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-4">
            <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h2 class="text-lg font-bold text-gray-900">Daftar Soal</h2>
              <p class="text-sm text-gray-600 mt-1">
                {questions.filter(q => q.is_graded || q.tipe_soal !== 'essay').length} dari {questions.length} dinilai
              </p>
            </div>
            <div class="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {#each getFilteredQuestions() as question}
                <button
                  on:click={() => selectQuestion(question.soal_id)}
                  class="w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors {currentSoalId === question.soal_id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-sm font-semibold text-gray-900">Soal #{question.nomor_urut}</span>
                        <span class="px-2 py-0.5 text-xs font-medium rounded-full {getQuestionTypeColor(question.tipe_soal)}">
                          {getQuestionTypeLabel(question.tipe_soal)}
                        </span>
                      </div>
                      <div class="text-xs text-gray-500 line-clamp-2">{question.teks_soal.substring(0, 50)}...</div>
                    </div>
                    <div class="text-right">
                      {#if question.tipe_soal === 'essay'}
                        {#if question.is_graded}
                          <div class="text-sm font-bold {getScoreColor(question.given_score, question.bobot)}">
                            {question.given_score}/{question.bobot}
                          </div>
                        {:else}
                          <div class="text-xs text-amber-600 font-medium">Belum dinilai</div>
                        {/if}
                      {:else}
                        {#if question.is_correct}
                          <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                          </svg>
                        {:else}
                          <svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                          </svg>
                        {/if}
                      {/if}
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        </div>

        <!-- Question Review Area -->
        <div class="lg:col-span-2">
          {#if currentQuestion}
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div class="flex items-center justify-between">
                  <h2 class="text-lg font-bold text-gray-900">
                    Soal #{currentQuestion.nomor_urut}
                    <span class="ml-2 px-3 py-1 text-sm font-medium rounded-full {getQuestionTypeColor(currentQuestion.tipe_soal)}">
                      {getQuestionTypeLabel(currentQuestion.tipe_soal)}
                    </span>
                  </h2>
                  <span class="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-semibold rounded-full">
                    Bobot: {currentQuestion.bobot} poin
                  </span>
                </div>
              </div>

              <div class="p-6">
                <!-- Question Text -->
                <div class="mb-6">
                  <h3 class="text-sm font-semibold text-gray-700 mb-2">Pertanyaan:</h3>
                  <div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p class="text-gray-900 whitespace-pre-wrap">{currentQuestion.teks_soal}</p>
                  </div>
                </div>

                <!-- Question Image (if any) -->
                {#if currentQuestion.gambar_soal}
                  <div class="mb-6">
                    <img
                      src="{uploadBase}/api/soal/images/{currentQuestion.gambar_soal}"
                      alt="Soal illustration"
                      class="max-w-full h-auto max-h-64 rounded-lg border border-gray-200"
                    />
                  </div>
                {/if}

                <!-- Answer Options for Multiple Choice -->
                {#if currentQuestion.tipe_soal === 'pilihan_ganda' || currentQuestion.tipe_soal === 'multiple_answer'}
                  <div class="mb-6">
                    <h3 class="text-sm font-semibold text-gray-700 mb-3">Pilihan Jawaban:</h3>
                    <div class="space-y-2">
                      {#each ['A', 'B', 'C', 'D', 'E'] as option}
                        {#if currentQuestion['pilihan_' + option.toLowerCase()]}
                          <div 
                            class="flex items-start p-3 rounded-lg border-2 {
                              isOptionCorrect(currentQuestion, option) 
                                ? 'border-green-500 bg-green-50' 
                                : ''
                            } {
                              isOptionSelected(currentQuestion, option) && !isOptionCorrect(currentQuestion, option)
                                ? 'border-red-500 bg-red-50'
                                : ''
                            } {
                              isOptionSelected(currentQuestion, option)
                                ? 'ring-2 ring-offset-1 ' + (isOptionCorrect(currentQuestion, option) ? 'ring-green-500' : 'ring-red-500')
                                : ''
                            }"
                          >
                            <span class="font-semibold text-gray-700 mr-3 w-6">{option}.</span>
                            <span class="text-gray-800 flex-1">
                              {currentQuestion['pilihan_' + option.toLowerCase()]}
                            </span>
                            {#if isOptionCorrect(currentQuestion, option)}
                              <svg class="w-5 h-5 text-green-500 ml-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                              </svg>
                            {/if}
                            {#if isOptionSelected(currentQuestion, option) && !isOptionCorrect(currentQuestion, option)}
                              <svg class="w-5 h-5 text-red-500 ml-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                              </svg>
                            {/if}
                          </div>
                        {/if}
                      {/each}
                    </div>
                  </div>
                {:else if currentQuestion.tipe_soal === 'benar_salah'}
                  <div class="mb-6">
                    <h3 class="text-sm font-semibold text-gray-700 mb-3">Pilihan Jawaban:</h3>
                    <div class="space-y-2">
                      {#each ['benar', 'salah'] as option}
                        <div 
                          class="flex items-center p-3 rounded-lg border-2 {
                            isOptionCorrect(currentQuestion, option) 
                              ? 'border-green-500 bg-green-50' 
                              : ''
                          } {
                            isOptionSelected(currentQuestion, option) && !isOptionCorrect(currentQuestion, option)
                              ? 'border-red-500 bg-red-50'
                              : ''
                          } {
                            isOptionSelected(currentQuestion, option)
                              ? 'ring-2 ring-offset-1 ' + (isOptionCorrect(currentQuestion, option) ? 'ring-green-500' : 'ring-red-500')
                              : ''
                          }"
                        >
                          <span class="font-semibold text-gray-800 flex-1 capitalize">{getOptionLabel(option)}</span>
                          {#if isOptionCorrect(currentQuestion, option)}
                            <svg class="w-5 h-5 text-green-500 ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                            </svg>
                          {/if}
                          {#if isOptionSelected(currentQuestion, option) && !isOptionCorrect(currentQuestion, option)}
                            <svg class="w-5 h-5 text-red-500 ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                            </svg>
                          {/if}
                        </div>
                      {/each}
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
                  <div class="p-4 bg-white rounded-lg border-2 {
                    currentQuestion.tipe_soal === 'essay' 
                      ? 'border-purple-200' 
                      : currentQuestion.is_correct 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-red-200 bg-red-50'
                  }">
                    {#if currentQuestion.tipe_soal === 'pilihan_ganda' || currentQuestion.tipe_soal === 'benar_salah'}
                      <p class="text-gray-900 font-medium">
                        {currentQuestion.student_answer 
                          ? getOptionLabel(currentQuestion.student_answer) 
                          : 'Tidak dijawab'}
                      </p>
                      <p class="text-sm mt-1 {currentQuestion.is_correct ? 'text-green-600' : 'text-red-600'}">
                        {currentQuestion.is_correct ? '✓ Benar' : '✗ Salah'}
                      </p>
                    {:else if currentQuestion.tipe_soal === 'multiple_answer'}
                      <p class="text-gray-900">
                        {#if currentQuestion.student_answer}
                          {currentQuestion.student_answer.split(',').map(opt => getOptionLabel(opt)).join(', ')}
                        {:else}
                          Tidak dijawab
                        {/if}
                      </p>
                      <p class="text-sm mt-1 {currentQuestion.is_correct ? 'text-green-600' : 'text-red-600'}">
                        {currentQuestion.is_correct ? '✓ Benar' : '✗ Salah'}
                      </p>
                    {:else}
                      <p class="text-gray-900 whitespace-pre-wrap min-h-24">{currentQuestion.student_answer || 'Tidak ada jawaban'}</p>
                    {/if}
                  </div>
                </div>

                <!-- Correct Answer Key (for non-essay) -->
                {#if currentQuestion.tipe_soal !== 'essay'}
                  <div class="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                    <h3 class="text-sm font-semibold text-green-800 mb-2 flex items-center">
                      <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Kunci Jawaban:
                    </h3>
                    <p class="text-green-900 font-medium">
                      {#if currentQuestion.tipe_soal === 'multiple_answer'}
                        {(currentQuestion.jawaban_multiple || currentQuestion.kunci_jawaban || '').split(',').map(opt => getOptionLabel(opt)).join(', ')}
                      {:else if currentQuestion.tipe_soal === 'benar_salah'}
                        {getOptionLabel(currentQuestion.jawaban_benar_salah === 'B' ? 'benar' : currentQuestion.jawaban_benar_salah === 'S' ? 'salah' : '')}
                      {:else}
                        {getOptionLabel(currentQuestion.kunci_jawaban)}
                      {/if}
                    </p>
                    <p class="text-sm text-green-700 mt-2">
                      Nilai otomatis: {currentQuestion.is_correct ? '+' : '0'}{currentQuestion.bobot} poin
                    </p>
                  </div>
                {/if}

                <!-- Essay Grading Section -->
                {#if currentQuestion.tipe_soal === 'essay'}
                  <!-- Example Answer -->
                  {#if currentQuestion.contoh_jawaban}
                    <div class="mb-6">
                      <h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                        <svg class="w-4 h-4 mr-1 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Pedoman Penilaian / Contoh Jawaban:
                      </h3>
                      <div class="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                        <p class="text-gray-900 whitespace-pre-wrap">{currentQuestion.contoh_jawaban}</p>
                      </div>
                    </div>
                  {/if}
                
                  <!-- Grading Form -->
                  <div class="border-t border-gray-200 pt-6">
                    <h3 class="text-sm font-semibold text-gray-700 mb-4">Penilaian</h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                          Nilai (0 - {currentQuestion.bobot})
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={currentQuestion.bobot}
                          bind:value={currentQuestion.given_score}
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
                        bind:value={currentQuestion.grading_notes}
                        rows="3"
                        class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Berikan feedback atau catatan untuk perbaikan..."
                      ></textarea>
                    </div>
                  </div>
                {/if}

                <!-- Navigation Buttons -->
                <div class="mt-8 flex justify-between items-center">
                  <button
                    on:click={goToPrev}
                    disabled={currentIdx === 0}
                    class="py-3 px-6 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    ← Sebelumnya
                  </button>
                  
                  {#if currentIdx < questions.length - 1}
                    <button
                      on:click={goToNext}
                      class="py-3 px-6 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-medium rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all"
                    >
                      Selanjutnya →
                    </button>
                  {:else}
                    <button
                      on:click={goBack}
                      class="py-3 px-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all inline-flex items-center"
                    >
                      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                      </svg>
                      Kembali
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
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

