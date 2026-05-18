<script>
  import { onMount, onDestroy } from 'svelte';
  import { navigate } from 'svelte-routing';
  import { apiFetch } from '$lib/api';
  import toast from '../../lib/toast.js';
  import ToastContainer from '../../components/ToastContainer.svelte';

  // Get the exam ID from the URL
  let examId = null;
  let paketId = null;
  if (window.location.pathname) {
    const pathParts = window.location.pathname.split('/');
    // URL pattern: /dashboard/exams/:id/preview
    // Find the index of 'exams' and get the next part
    const examsIndex = pathParts.indexOf('exams');
    if (examsIndex !== -1 && examsIndex < pathParts.length - 1) {
      examId = pathParts[examsIndex + 1];
    }
  }
  
  // Get paket_id from query string if present
  if (window.location.search) {
    const urlParams = new URLSearchParams(window.location.search);
    paketId = urlParams.get('paket_id');
    if (paketId) {
    }
  }

  let exam = null;
  let questions = [];
  let currentQuestionIndex = 0;
  
  // Image zoom modal state
  let zoomedImage = null;
  let zoomedImageAlt = '';

  onMount(async () => {
    const token = localStorage.getItem('token');
    
    // Add admin-layout class
    document.body.classList.add('admin-layout');
    
    if (!token) {
      toast.error('Token tidak ditemukan');
      navigate('/dashboard/exams');
      return;
    }

    if (!examId) {
      toast.error('ID Ujian tidak ditemukan');
      navigate('/dashboard/exams');
      return;
    }

    await fetchExamDetails();
    await fetchQuestions();
  });

  onDestroy(() => {
    // Remove admin-layout class
    document.body.classList.remove('admin-layout');
  });

  async function fetchExamDetails() {
    try {
      const response = await apiFetch(`/api/ujian/${examId}`);
      exam = response;
    } catch (error) {
      console.error('Error fetching exam details:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      toast.error('Terjadi kesalahan saat memuat ujian: ' + error.message);
      navigate('/dashboard/exams');
    }
  }

  async function fetchQuestions() {
    try {
      if (paketId) {
        // Fetch questions from specific package
        const paketData = await apiFetch(`/api/paket-soal/${paketId}`);
        questions = paketData.soal || [];
      } else {
        // Fetch all questions (default behavior)
        questions = await apiFetch(`/api/soal/ujian/${examId}`);
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Terjadi kesalahan saat memuat soal: ' + error.message);
      navigate('/dashboard/exams');
    }
  }

  function goToQuestion(index) {
    if (index >= 0 && index < questions.length) {
      currentQuestionIndex = index;
    }
  }

  function handleFinishPreview() {
    toast.info('Preview selesai - Ini hanya mode preview');
    navigate(`/dashboard/exams/${examId}/questions`);
  }

  // Helper function to check if an option is the correct answer
  function isCorrectAnswer(question, option) {
    if (!question) return false;
    
    const tipe = question.tipe_soal || 'pilihan_ganda';
    
    if (tipe === 'pilihan_ganda') {
      return question.kunci_jawaban && question.kunci_jawaban.toUpperCase() === option;
    } else if (tipe === 'benar_salah') {
      // jawaban_benar_salah contains 'B' for Benar or 'S' for Salah
      return question.jawaban_benar_salah && question.jawaban_benar_salah.toUpperCase() === option;
    } else if (tipe === 'multiple_answer') {
      if (!question.jawaban_multiple) return false;
      const answers = question.jawaban_multiple.toUpperCase().split(',').map(a => a.trim());
      return answers.includes(option);
    }
    return false;
  }

  function openImageZoom(src, alt) {
    zoomedImage = src;
    zoomedImageAlt = alt;
  }

  function closeImageZoom() {
    zoomedImage = null;
    zoomedImageAlt = '';
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">

    <div class="max-w-7xl mx-auto p-4 md:p-6">
      <!-- Preview Banner -->
      {#if paketId}
        <div class="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
          <div class="flex items-center">
            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 00-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div>
              <span class="font-semibold">Preview Paket Soal</span>
              <span class="ml-2 text-sm opacity-90">(Urutan soal sudah diacak sesuai paket)</span>
            </div>
          </div>
          <button
            on:click={() => navigate(`/dashboard/exams/${examId}/questions`)}
            class="text-white hover:text-gray-200 font-medium flex items-center"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Kembali
          </button>
        </div>
      {:else}
        <div class="bg-yellow-400 text-yellow-900 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
          <div class="flex items-center">
            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span class="font-semibold">Mode Preview Admin</span>
            <span class="ml-2 text-sm">(Tampilan ini sama dengan yang akan dilihat siswa)</span>
          </div>
          <button
            on:click={() => navigate(`/dashboard/exams/${examId}/questions`)}
            class="text-yellow-900 hover:text-yellow-700 font-medium flex items-center"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Kembali ke Manajemen Soal
          </button>
        </div>
      {/if}

      <!-- Exam header -->
      <div class="card mb-6 p-5 flex flex-col sm:flex-row justify-between items-center">
        <h1 class="text-xl md:text-2xl font-bold text-gray-900 mb-3 sm:mb-0">{exam.judul}</h1>
        <div class="flex items-center bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-lg">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span class="text-lg font-bold">Mode Preview</span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <!-- Questions navigation panel -->
        <div class="lg:col-span-1">
          <div class="card p-5">
            <h2 class="text-lg font-bold text-gray-900 mb-4">Nomor Soal</h2>
            <div class="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-5 gap-2 mb-6">
              {#each questions as question, index}
                <button
                  on:click={() => goToQuestion(index)}
                  class={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                    currentQuestionIndex === index
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg transform scale-110'
                      : 'bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {index + 1}
                </button>
              {/each}
            </div>

            <div class="mb-6 pt-4 border-t border-gray-200">
              <div class="flex items-center">
                <div class="w-4 h-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mr-2"></div>
                <span class="text-sm text-gray-600">Soal saat ini</span>
              </div>
            </div>

            <div class="text-center text-sm text-gray-600 mb-4">
              Total Soal: <span class="font-semibold text-blue-600">{questions.length}</span>
            </div>

            <button
              on:click={handleFinishPreview}
              class="w-full btn btn-secondary py-3.5 text-base font-semibold"
            >
              <svg class="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Kembali
            </button>
          </div>
        </div>

        <!-- Question content -->
        <div class="lg:col-span-3">
          <div class="card p-6 md:p-8">
            {#if questions[currentQuestionIndex]}
              <div class="mb-8">
                <div class="flex items-start justify-between mb-4">
                  <h2 class="text-lg md:text-xl font-bold text-gray-900">
                    Soal #{currentQuestionIndex + 1}
                  </h2>
                  <span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                    {questions[currentQuestionIndex].tipe_soal || 'pilihan_ganda'}
                  </span>
                </div>
                
                <!-- Question Image -->
                {#if questions[currentQuestionIndex]?.gambar_soal}
                  <div class="mb-4">
                    <p class="text-sm text-gray-600 mb-2">Gambar Soal:</p>
                    <div class="inline-block relative group cursor-pointer" on:click={() => openImageZoom(`http://localhost:3000/uploads/soal/${questions[currentQuestionIndex].gambar_soal}`, 'Gambar Soal')}>
                      <img 
                        src="http://localhost:3000/uploads/soal/{questions[currentQuestionIndex].gambar_soal}" 
                        alt="Gambar Soal" 
                        class="max-w-48 h-auto rounded-lg border-2 border-gray-200 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                        on:error={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-all duration-200 flex items-center justify-center">
                        <svg class="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                {/if}
                
                <p class="text-gray-900 whitespace-pre-wrap">{questions[currentQuestionIndex].teks_soal}</p>
              </div>

              <!-- Pilihan Ganda -->
              {#if questions[currentQuestionIndex]?.tipe_soal === 'pilihan_ganda' || !questions[currentQuestionIndex]?.tipe_soal}
                <div class="space-y-4">
                  <!-- Pilihan A -->
                  <div class="flex items-start p-4 border-2 rounded-xl transition-all duration-200 {isCorrectAnswer(questions[currentQuestionIndex], 'A') ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}">
                    <input
                      type="radio"
                      name="answer_{questions[currentQuestionIndex]?.id}"
                      value="A"
                      disabled
                      class="mt-1.5 mr-4 h-5 w-5 {isCorrectAnswer(questions[currentQuestionIndex], 'A') ? 'text-green-600' : 'text-gray-400'} cursor-not-allowed"
                    />
                    <span class="{isCorrectAnswer(questions[currentQuestionIndex], 'A') ? 'text-green-800 font-semibold' : 'text-gray-800'} flex-1">
                      <span class="mr-2">A.</span>
                      {questions[currentQuestionIndex]?.pilihan_a || '-'}
                    </span>
                    {#if isCorrectAnswer(questions[currentQuestionIndex], 'A')}
                      <span class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800">
                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        Benar
                      </span>
                    {/if}
                    {#if questions[currentQuestionIndex]?.gambar_pilihan_a}
                      <div 
                        class="ml-4 relative group cursor-pointer" 
                        on:click={() => openImageZoom(`http://localhost:3000/uploads/soal/${questions[currentQuestionIndex].gambar_pilihan_a}`, 'Gambar Pilihan A')}
                      >
                        <img 
                          src="http://localhost:3000/uploads/soal/{questions[currentQuestionIndex].gambar_pilihan_a}" 
                          alt="Gambar Pilihan A" 
                          class="w-16 h-16 object-cover rounded border-2 border-gray-200 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                          on:error={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded transition-all duration-200 flex items-center justify-center">
                          <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </div>
                      </div>
                    {/if}
                  </div>

                  <!-- Pilihan B -->
                  <div class="flex items-start p-4 border-2 rounded-xl transition-all duration-200 {isCorrectAnswer(questions[currentQuestionIndex], 'B') ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}">
                    <input
                      type="radio"
                      name="answer_{questions[currentQuestionIndex]?.id}"
                      value="B"
                      disabled
                      class="mt-1.5 mr-4 h-5 w-5 {isCorrectAnswer(questions[currentQuestionIndex], 'B') ? 'text-green-600' : 'text-gray-400'} cursor-not-allowed"
                    />
                    <span class="{isCorrectAnswer(questions[currentQuestionIndex], 'B') ? 'text-green-800 font-semibold' : 'text-gray-800'} flex-1">
                      <span class="mr-2">B.</span>
                      {questions[currentQuestionIndex]?.pilihan_b || '-'}
                    </span>
                    {#if isCorrectAnswer(questions[currentQuestionIndex], 'B')}
                      <span class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800">
                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        Benar
                      </span>
                    {/if}
                    {#if questions[currentQuestionIndex]?.gambar_pilihan_b}
                      <div 
                        class="ml-4 relative group cursor-pointer" 
                        on:click={() => openImageZoom(`http://localhost:3000/uploads/soal/${questions[currentQuestionIndex].gambar_pilihan_b}`, 'Gambar Pilihan B')}
                      >
                        <img 
                          src="http://localhost:3000/uploads/soal/{questions[currentQuestionIndex].gambar_pilihan_b}" 
                          alt="Gambar Pilihan B" 
                          class="w-16 h-16 object-cover rounded border-2 border-gray-200 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                          on:error={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded transition-all duration-200 flex items-center justify-center">
                          <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </div>
                      </div>
                    {/if}
                  </div>

                  <!-- Pilihan C -->
                  <div class="flex items-start p-4 border-2 rounded-xl transition-all duration-200 {isCorrectAnswer(questions[currentQuestionIndex], 'C') ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}">
                    <input
                      type="radio"
                      name="answer_{questions[currentQuestionIndex]?.id}"
                      value="C"
                      disabled
                      class="mt-1.5 mr-4 h-5 w-5 {isCorrectAnswer(questions[currentQuestionIndex], 'C') ? 'text-green-600' : 'text-gray-400'} cursor-not-allowed"
                    />
                    <span class="{isCorrectAnswer(questions[currentQuestionIndex], 'C') ? 'text-green-800 font-semibold' : 'text-gray-800'} flex-1">
                      <span class="mr-2">C.</span>
                      {questions[currentQuestionIndex]?.pilihan_c || '-'}
                    </span>
                    {#if isCorrectAnswer(questions[currentQuestionIndex], 'C')}
                      <span class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800">
                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        Benar
                      </span>
                    {/if}
                    {#if questions[currentQuestionIndex]?.gambar_pilihan_c}
                      <div 
                        class="ml-4 relative group cursor-pointer" 
                        on:click={() => openImageZoom(`http://localhost:3000/uploads/soal/${questions[currentQuestionIndex].gambar_pilihan_c}`, 'Gambar Pilihan C')}
                      >
                        <img 
                          src="http://localhost:3000/uploads/soal/{questions[currentQuestionIndex].gambar_pilihan_c}" 
                          alt="Gambar Pilihan C" 
                          class="w-16 h-16 object-cover rounded border-2 border-gray-200 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                          on:error={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded transition-all duration-200 flex items-center justify-center">
                          <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </div>
                      </div>
                    {/if}
                  </div>

                  <!-- Pilihan D -->
                  <div class="flex items-start p-4 border-2 rounded-xl transition-all duration-200 {isCorrectAnswer(questions[currentQuestionIndex], 'D') ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}">
                    <input
                      type="radio"
                      name="answer_{questions[currentQuestionIndex]?.id}"
                      value="D"
                      disabled
                      class="mt-1.5 mr-4 h-5 w-5 {isCorrectAnswer(questions[currentQuestionIndex], 'D') ? 'text-green-600' : 'text-gray-400'} cursor-not-allowed"
                    />
                    <span class="{isCorrectAnswer(questions[currentQuestionIndex], 'D') ? 'text-green-800 font-semibold' : 'text-gray-800'} flex-1">
                      <span class="mr-2">D.</span>
                      {questions[currentQuestionIndex]?.pilihan_d || '-'}
                    </span>
                    {#if isCorrectAnswer(questions[currentQuestionIndex], 'D')}
                      <span class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800">
                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        Benar
                      </span>
                    {/if}
                    {#if questions[currentQuestionIndex]?.gambar_pilihan_d}
                      <div 
                        class="ml-4 relative group cursor-pointer" 
                        on:click={() => openImageZoom(`http://localhost:3000/uploads/soal/${questions[currentQuestionIndex].gambar_pilihan_d}`, 'Gambar Pilihan D')}
                      >
                        <img 
                          src="http://localhost:3000/uploads/soal/{questions[currentQuestionIndex].gambar_pilihan_d}" 
                          alt="Gambar Pilihan D" 
                          class="w-16 h-16 object-cover rounded border-2 border-gray-200 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                          on:error={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded transition-all duration-200 flex items-center justify-center">
                          <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </div>
                      </div>
                    {/if}
                  </div>

                  <!-- Pilihan E (if exists) -->
                  {#if questions[currentQuestionIndex]?.pilihan_e || questions[currentQuestionIndex]?.gambar_pilihan_e}
                    <div class="flex items-start p-4 border-2 rounded-xl transition-all duration-200 {isCorrectAnswer(questions[currentQuestionIndex], 'E') ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}">
                      <input
                        type="radio"
                        name="answer_{questions[currentQuestionIndex]?.id}"
                        value="E"
                        disabled
                        class="mt-1.5 mr-4 h-5 w-5 {isCorrectAnswer(questions[currentQuestionIndex], 'E') ? 'text-green-600' : 'text-gray-400'} cursor-not-allowed"
                      />
                      <span class="{isCorrectAnswer(questions[currentQuestionIndex], 'E') ? 'text-green-800 font-semibold' : 'text-gray-800'} flex-1">
                        <span class="mr-2">E.</span>
                        {questions[currentQuestionIndex]?.pilihan_e || '-'}
                      </span>
                      {#if isCorrectAnswer(questions[currentQuestionIndex], 'E')}
                        <span class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800">
                          <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                          </svg>
                          Benar
                        </span>
                      {/if}
                      {#if questions[currentQuestionIndex]?.gambar_pilihan_e}
                        <div 
                          class="ml-4 relative group cursor-pointer" 
                          on:click={() => openImageZoom(`http://localhost:3000/uploads/soal/${questions[currentQuestionIndex].gambar_pilihan_e}`, 'Gambar Pilihan E')}
                        >
                          <img 
                            src="http://localhost:3000/uploads/soal/{questions[currentQuestionIndex].gambar_pilihan_e}" 
                            alt="Gambar Pilihan E" 
                            class="w-16 h-16 object-cover rounded border-2 border-gray-200 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                            on:error={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded transition-all duration-200 flex items-center justify-center">
                            <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}

              <!-- Benar/Salah -->
              {#if questions[currentQuestionIndex]?.tipe_soal === 'benar_salah'}
                <div class="space-y-4">
                  <div class="flex items-center p-4 border-2 rounded-xl transition-all duration-200 {isCorrectAnswer(questions[currentQuestionIndex], 'B') ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}">
                    <input
                      type="radio"
                      name="answer_{questions[currentQuestionIndex]?.id}"
                      value="benar"
                      disabled
                      class="mt-1.5 mr-4 h-5 w-5 {isCorrectAnswer(questions[currentQuestionIndex], 'B') ? 'text-green-600' : 'text-gray-400'} cursor-not-allowed"
                    />
                    <span class="{isCorrectAnswer(questions[currentQuestionIndex], 'B') ? 'text-green-800 font-semibold' : 'text-gray-800'} text-lg">Benar</span>
                    {#if isCorrectAnswer(questions[currentQuestionIndex], 'B')}
                      <span class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800">
                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        Benar
                      </span>
                    {/if}
                  </div>

                  <div class="flex items-center p-4 border-2 rounded-xl transition-all duration-200 {isCorrectAnswer(questions[currentQuestionIndex], 'S') ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}">
                    <input
                      type="radio"
                      name="answer_{questions[currentQuestionIndex]?.id}"
                      value="salah"
                      disabled
                      class="mt-1.5 mr-4 h-5 w-5 {isCorrectAnswer(questions[currentQuestionIndex], 'S') ? 'text-green-600' : 'text-gray-400'} cursor-not-allowed"
                    />
                    <span class="{isCorrectAnswer(questions[currentQuestionIndex], 'S') ? 'text-green-800 font-semibold' : 'text-gray-800'} text-lg">Salah</span>
                    {#if isCorrectAnswer(questions[currentQuestionIndex], 'S')}
                      <span class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800">
                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        Benar
                      </span>
                    {/if}
                  </div>
                </div>
              {/if}

              <!-- Multiple Answer -->
              {#if questions[currentQuestionIndex]?.tipe_soal === 'multiple_answer'}
                <div class="space-y-4">
                  <p class="text-sm text-gray-600 mb-2 font-semibold">Pilih lebih dari satu jawaban:</p>

                  {#if questions[currentQuestionIndex]?.pilihan_a || questions[currentQuestionIndex]?.gambar_pilihan_a}
                    <div class="flex items-start p-4 border-2 rounded-xl transition-all duration-200 {isCorrectAnswer(questions[currentQuestionIndex], 'A') ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}">
                      <input
                        type="checkbox"
                        name="answer_{questions[currentQuestionIndex]?.id}_A"
                        disabled
                        class="mt-1.5 mr-4 h-5 w-5 {isCorrectAnswer(questions[currentQuestionIndex], 'A') ? 'text-green-600' : 'text-gray-400'} cursor-not-allowed"
                      />
                      <span class="{isCorrectAnswer(questions[currentQuestionIndex], 'A') ? 'text-green-800 font-semibold' : 'text-gray-800'} flex-1">
                        <span class="mr-2">A.</span>
                        {questions[currentQuestionIndex]?.pilihan_a || '-'}
                      </span>
                      {#if isCorrectAnswer(questions[currentQuestionIndex], 'A')}
                        <span class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800">
                          <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                          </svg>
                          Benar
                        </span>
                      {/if}
                      {#if questions[currentQuestionIndex]?.gambar_pilihan_a}
                        <div
                          class="ml-4 relative group cursor-pointer"
                          on:click={() => openImageZoom(`http://localhost:3000/uploads/soal/${questions[currentQuestionIndex].gambar_pilihan_a}`, 'Gambar Pilihan A')}
                        >
                          <img
                            src="http://localhost:3000/uploads/soal/{questions[currentQuestionIndex].gambar_pilihan_a}"
                            alt="Gambar Pilihan A"
                            class="w-16 h-16 object-cover rounded border-2 border-gray-200 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                            on:error={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded transition-all duration-200 flex items-center justify-center">
                            <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}

                  {#if questions[currentQuestionIndex]?.pilihan_b || questions[currentQuestionIndex]?.gambar_pilihan_b}
                    <div class="flex items-start p-4 border-2 rounded-xl transition-all duration-200 {isCorrectAnswer(questions[currentQuestionIndex], 'B') ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}">
                      <input
                        type="checkbox"
                        name="answer_{questions[currentQuestionIndex]?.id}_B"
                        disabled
                        class="mt-1.5 mr-4 h-5 w-5 {isCorrectAnswer(questions[currentQuestionIndex], 'B') ? 'text-green-600' : 'text-gray-400'} cursor-not-allowed"
                      />
                      <span class="{isCorrectAnswer(questions[currentQuestionIndex], 'B') ? 'text-green-800 font-semibold' : 'text-gray-800'} flex-1">
                        <span class="mr-2">B.</span>
                        {questions[currentQuestionIndex]?.pilihan_b || '-'}
                      </span>
                      {#if isCorrectAnswer(questions[currentQuestionIndex], 'B')}
                        <span class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800">
                          <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                          </svg>
                          Benar
                        </span>
                      {/if}
                      {#if questions[currentQuestionIndex]?.gambar_pilihan_b}
                        <div
                          class="ml-4 relative group cursor-pointer"
                          on:click={() => openImageZoom(`http://localhost:3000/uploads/soal/${questions[currentQuestionIndex].gambar_pilihan_b}`, 'Gambar Pilihan B')}
                        >
                          <img
                            src="http://localhost:3000/uploads/soal/{questions[currentQuestionIndex].gambar_pilihan_b}"
                            alt="Gambar Pilihan B"
                            class="w-16 h-16 object-cover rounded border-2 border-gray-200 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                            on:error={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded transition-all duration-200 flex items-center justify-center">
                            <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}

                  {#if questions[currentQuestionIndex]?.pilihan_c || questions[currentQuestionIndex]?.gambar_pilihan_c}
                    <div class="flex items-start p-4 border-2 rounded-xl transition-all duration-200 {isCorrectAnswer(questions[currentQuestionIndex], 'C') ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}">
                      <input
                        type="checkbox"
                        name="answer_{questions[currentQuestionIndex]?.id}_C"
                        disabled
                        class="mt-1.5 mr-4 h-5 w-5 {isCorrectAnswer(questions[currentQuestionIndex], 'C') ? 'text-green-600' : 'text-gray-400'} cursor-not-allowed"
                      />
                      <span class="{isCorrectAnswer(questions[currentQuestionIndex], 'C') ? 'text-green-800 font-semibold' : 'text-gray-800'} flex-1">
                        <span class="mr-2">C.</span>
                        {questions[currentQuestionIndex]?.pilihan_c || '-'}
                      </span>
                      {#if isCorrectAnswer(questions[currentQuestionIndex], 'C')}
                        <span class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800">
                          <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                          </svg>
                          Benar
                        </span>
                      {/if}
                      {#if questions[currentQuestionIndex]?.gambar_pilihan_c}
                        <div
                          class="ml-4 relative group cursor-pointer"
                          on:click={() => openImageZoom(`http://localhost:3000/uploads/soal/${questions[currentQuestionIndex].gambar_pilihan_c}`, 'Gambar Pilihan C')}
                        >
                          <img
                            src="http://localhost:3000/uploads/soal/{questions[currentQuestionIndex].gambar_pilihan_c}"
                            alt="Gambar Pilihan C"
                            class="w-16 h-16 object-cover rounded border-2 border-gray-200 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                            on:error={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded transition-all duration-200 flex items-center justify-center">
                            <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}

                  {#if questions[currentQuestionIndex]?.pilihan_d || questions[currentQuestionIndex]?.gambar_pilihan_d}
                    <div class="flex items-start p-4 border-2 rounded-xl transition-all duration-200 {isCorrectAnswer(questions[currentQuestionIndex], 'D') ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}">
                      <input
                        type="checkbox"
                        name="answer_{questions[currentQuestionIndex]?.id}_D"
                        disabled
                        class="mt-1.5 mr-4 h-5 w-5 {isCorrectAnswer(questions[currentQuestionIndex], 'D') ? 'text-green-600' : 'text-gray-400'} cursor-not-allowed"
                      />
                      <span class="{isCorrectAnswer(questions[currentQuestionIndex], 'D') ? 'text-green-800 font-semibold' : 'text-gray-800'} flex-1">
                        <span class="mr-2">D.</span>
                        {questions[currentQuestionIndex]?.pilihan_d || '-'}
                      </span>
                      {#if isCorrectAnswer(questions[currentQuestionIndex], 'D')}
                        <span class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800">
                          <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                          </svg>
                          Benar
                        </span>
                      {/if}
                      {#if questions[currentQuestionIndex]?.gambar_pilihan_d}
                        <div
                          class="ml-4 relative group cursor-pointer"
                          on:click={() => openImageZoom(`http://localhost:3000/uploads/soal/${questions[currentQuestionIndex].gambar_pilihan_d}`, 'Gambar Pilihan D')}
                        >
                          <img
                            src="http://localhost:3000/uploads/soal/{questions[currentQuestionIndex].gambar_pilihan_d}"
                            alt="Gambar Pilihan D"
                            class="w-16 h-16 object-cover rounded border-2 border-gray-200 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                            on:error={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded transition-all duration-200 flex items-center justify-center">
                            <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}

                  {#if questions[currentQuestionIndex]?.pilihan_e || questions[currentQuestionIndex]?.gambar_pilihan_e}
                    <div class="flex items-start p-4 border-2 rounded-xl transition-all duration-200 {isCorrectAnswer(questions[currentQuestionIndex], 'E') ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}">
                      <input
                        type="checkbox"
                        name="answer_{questions[currentQuestionIndex]?.id}_E"
                        disabled
                        class="mt-1.5 mr-4 h-5 w-5 {isCorrectAnswer(questions[currentQuestionIndex], 'E') ? 'text-green-600' : 'text-gray-400'} cursor-not-allowed"
                      />
                      <span class="{isCorrectAnswer(questions[currentQuestionIndex], 'E') ? 'text-green-800 font-semibold' : 'text-gray-800'} flex-1">
                        <span class="mr-2">E.</span>
                        {questions[currentQuestionIndex]?.pilihan_e || '-'}
                      </span>
                      {#if isCorrectAnswer(questions[currentQuestionIndex], 'E')}
                        <span class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800">
                          <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                          </svg>
                          Benar
                        </span>
                      {/if}
                      {#if questions[currentQuestionIndex]?.gambar_pilihan_e}
                        <div
                          class="ml-4 relative group cursor-pointer"
                          on:click={() => openImageZoom(`http://localhost:3000/uploads/soal/${questions[currentQuestionIndex].gambar_pilihan_e}`, 'Gambar Pilihan E')}
                        >
                          <img
                            src="http://localhost:3000/uploads/soal/{questions[currentQuestionIndex].gambar_pilihan_e}"
                            alt="Gambar Pilihan E"
                            class="w-16 h-16 object-cover rounded border-2 border-gray-200 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                            on:error={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded transition-all duration-200 flex items-center justify-center">
                            <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}

              <!-- Essay -->
              {#if questions[currentQuestionIndex]?.tipe_soal === 'essay'}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Jawaban Essay:</label>
                  <textarea
                    class="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 cursor-not-allowed"
                    placeholder="Essay - hanya preview"
                    rows="8"
                    readonly
                  ></textarea>
                </div>
              {/if}

              <!-- Navigation buttons -->
              <div class="mt-8 flex justify-between">
                <button
                  on:click={() => goToQuestion(currentQuestionIndex - 1)}
                  disabled={currentQuestionIndex === 0}
                  class="btn btn-secondary py-2.5 px-6 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sebelumnya
                </button>

                <button
                  on:click={() => goToQuestion(currentQuestionIndex + 1)}
                  disabled={currentQuestionIndex === questions.length - 1}
                  class="btn btn-primary py-2.5 px-6 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Berikutnya
                </button>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>


  <!-- Image Zoom Modal -->
  {#if zoomedImage}
    <div 
      class="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
      on:click={closeImageZoom}
    >
      <div class="relative max-w-7xl max-h-screen overflow-auto">
        <button
          on:click={closeImageZoom}
          class="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
          title="Tutup"
        >
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img 
          src={zoomedImage} 
          alt={zoomedImageAlt} 
          class="max-w-full max-h-[90vh] object-contain"
        />
        <p class="text-white text-center mt-4 text-lg">{zoomedImageAlt}</p>
      </div>
    </div>
  {/if}

  <!-- Toast Container -->
  <svelte:component this={ToastContainer} />
</div>
