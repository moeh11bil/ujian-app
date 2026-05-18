<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { writable } from 'svelte/store';
  import { navigate } from 'svelte-routing';
  import { navigateTo } from '../../stores/routeStore.js';
  import { apiFetch } from '$lib/api';
  import toast from '../../lib/toast.js';

  export let id; // Prop dari svelte-routing
  let examId = id;

  // Token
  let token = localStorage.getItem('token');

  // User info
  let user = null;

  // Modal
  let showConfirmModal = false;
  let confirmMessage = '';
  let confirmCallback = null;
  let showCompletionDialog = false;
  let examSubmissionError = null;

  // Exam state
  let exam = null;
  let questions = [];
  let currentQuestionIndex = 0;
  let answers = {};
  let timeLeft = writable(0);
  let timerInterval = null;
  let loading = true;
  let submitting = false;
  let isFullscreen = false;
  let timerWarning = false;
  let timerCritical = false;
  
  // LocalStorage keys (will be updated when examId is known)
  let storageKey = 'exam_progress_temp';
  let timerKey = 'exam_timer_temp';
    
  // Exam session tracking
  let sessionId = null;
  let heartbeatInterval = null;
  let tabSwitches = 0;
  let fullscreenExits = 0;

  // Violation warning modal
  let showViolationModal = false;
  let violationMessage = '';
  let violationType = '';
  let violationSeverity = 0;

  // Exam lock state
  let examLocked = false;
  let lockPollInterval = null;
  let unlockResolved = false;
  let nextLockThreshold = 3;

  // Guard against handlers firing after unmount (especially during HMR)
  let mounted = true;

  // Event listener refs for cleanup
  let visibilityHandler, fullscreenHandler, beforeunloadHandler, blurHandler, focusHandler, keydownHandler;
  let blurTimeout;

  // Load saved progress from localStorage
  function loadProgress() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const progress = JSON.parse(saved);
        answers = progress.answers || {};
        currentQuestionIndex = progress.currentQuestionIndex || 0;
        return true;
      }
    } catch (e) {
      console.error('Failed to load saved progress:', e);
    }
    return false;
  }

  // Save progress to localStorage
  function saveProgress() {
    try {
      const progress = {
        answers,
        currentQuestionIndex,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch (e) {
      console.error('Failed to save progress:', e);
    }
  }

  // Clear saved progress
  function clearProgress() {
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(timerKey);
    } catch (e) {
      console.error('Failed to clear progress:', e);
    }
  }

  onMount(async () => {
    if (!token) {
      token = localStorage.getItem('token');
    }

    if (!token) {
      loading = false;
      return;
    }

    // Get user info from token
    try {
      const tokenString = token.startsWith('Bearer ') ? token.substring(7) : token;
      const payload = JSON.parse(atob(tokenString.split('.')[1]));
      user = {
        id: payload.id,
        nama: payload.nama,
        email: payload.email,
        role: payload.role
      };
    } catch (e) {
      console.error('Failed to parse user from token:', e);
    }
    
    // Update storage keys with actual examId
    storageKey = `exam_progress_${examId}`;
    timerKey = `exam_timer_${examId}`;
    
    try {
      await Promise.all([fetchExamDetails(), fetchQuestions()]);
    } catch (error) {
      console.error('Error fetching exam data:', error);
      loading = false;
      return;
    }

    if (exam) {
      // Try to load saved progress first
      const hasSavedProgress = loadProgress();
      
      if (hasSavedProgress) {
        toast.info('Jawaban sebelumnya berhasil dipulihkan');
      }
      
      // Initialize answers for all questions (preserve saved answers)
      questions.forEach(q => {
        if (!(q.id in answers)) {
          if (q.tipe_soal === 'multiple_answer') {
            answers[q.id] = [];
          } else {
            answers[q.id] = '';
          }
        }
      });
      
      // Restore or start timer
      try {
        const savedTimer = localStorage.getItem(timerKey);
        let initialTime;
        if (savedTimer) {
          const timerData = JSON.parse(savedTimer);
          const elapsed = Math.floor((Date.now() - timerData.savedAt) / 1000);
          initialTime = Math.max(0, timerData.timeLeft - elapsed);
          
          if (initialTime <= 0) {
            clearProgress(); // Clear stale progress/timer
            toast.warning('Waktu ujian telah habis.');
          }
        } else {
          // Pastikan durasi ada dan valid
          if (exam.durasi && exam.durasi > 0) {
            initialTime = exam.durasi * 60;
          } else {
            console.error('Invalid exam duration:', exam.durasi);
            toast.error('Durasi ujian tidak valid, menggunakan default 60 menit');
            initialTime = 60 * 60; // Default 60 menit
          }
        }
        
        timeLeft.set(initialTime);
      } catch (e) {
        console.error('Error restoring timer:', e);
        timeLeft.set((exam.durasi && exam.durasi > 0 ? exam.durasi : 60) * 60);
      }
      
      // Pastikan timeLeft valid sebelum memulai timer
      let currentTime;
      timeLeft.subscribe(val => currentTime = val)();
      if (currentTime > 0) {
        startTimer();
      } else {
        toast.warning('Waktu ujian sudah habis');
      }
      
      // Start exam session for monitoring
      await startExamSession();

      // Set up violation detection listeners (store refs for cleanup)
      visibilityHandler = () => {
        if (document.hidden) {
          tabSwitches++;
          handleViolation('tab_switch');
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);

      fullscreenHandler = () => {
        if (!document.fullscreenElement) {
          fullscreenExits++;
          handleViolation('fullscreen_exit');
        }
      };
      document.addEventListener('fullscreenchange', fullscreenHandler);

      // Warn before page unload
      beforeunloadHandler = (e) => {
        e.preventDefault();
        e.returnValue = 'Anda yakin ingin meninggalkan ujian? Jawaban yang belum disimpan akan hilang.';
        return e.returnValue;
      };
      window.addEventListener('beforeunload', beforeunloadHandler);

      // Detect window focus loss with debounce (cancel if focus returns within 500ms)
      blurHandler = () => {
        clearTimeout(blurTimeout);
        blurTimeout = setTimeout(() => {
          handleViolation('window_blur');
        }, 500);
      };
      window.addEventListener('blur', blurHandler);

      // Cancel pending blur violation if focus returns quickly
      focusHandler = () => {
        if (blurTimeout) {
          clearTimeout(blurTimeout);
          blurTimeout = null;
        }
      };
      window.addEventListener('focus', focusHandler);

      // Detect Windows key / Command key press directly
      keydownHandler = (e) => {
        if (e.key === 'Meta') {
          handleViolation('windows_key');
        }
      };
      document.addEventListener('keydown', keydownHandler);
    } else {
      console.error('Exam not loaded, cannot start timer');
    }
    
    loading = false; // Set loading to false after everything is done
  });

  onDestroy(() => {
    mounted = false;
    if (timerInterval) clearInterval(timerInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (lockPollInterval) clearInterval(lockPollInterval);
    if (blurTimeout) clearTimeout(blurTimeout);

    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    if (fullscreenHandler) document.removeEventListener('fullscreenchange', fullscreenHandler);
    if (beforeunloadHandler) window.removeEventListener('beforeunload', beforeunloadHandler);
    if (blurHandler) window.removeEventListener('blur', blurHandler);
    if (focusHandler) window.removeEventListener('focus', focusHandler);
    if (keydownHandler) document.removeEventListener('keydown', keydownHandler);
  });

  async function fetchExamDetails() {
    try {
      exam = await apiFetch(`/api/ujian/${examId}`);
    } catch (error) {
      if (error.message.includes('already submitted')) {
        toast.info('Anda telah menyelesaikan ujian ini.');
        navigate('/exam-list');
      } else {
        toast.error('Gagal memuat ujian: ' + error.message);
        navigate('/exam-list');
      }
    }
  }

  async function startExamSession() {
    try {
      const response = await apiFetch("/api/exam-sessions/start", {
        method: "POST",
        body: { ujian_id: examId }
      });
      sessionId = response.sessionId;
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          isFullscreen = true;
        }
      } catch (err) { console.warn("Fullscreen request failed:", err); }
      startHeartbeat();
    } catch (error) { console.error("Failed to start exam session:", error); }
  }

  async function logViolation(type) {
    try {
      await apiFetch("/api/violations", {
        method: "POST",
        body: { ujian_id: examId, type }
      });
    } catch (error) {
      if (!error.message.toLowerCase().includes('cancelled') && error.name !== 'AbortError') {
        console.error("Failed to log violation:", error);
      }
    }
  }

  function handleViolation(type) {
    if (!mounted) return;
    violationSeverity++;
    const messages = {
      'tab_switch': 'Anda telah meninggalkan halaman ujian (berpindah tab/jendela).',
      'fullscreen_exit': 'Anda telah keluar dari mode layar penuh.',
      'window_blur': 'Anda meninggalkan layar ujian (menekan tombol Windows, Alt+Tab, atau beralih aplikasi).',
      'windows_key': 'Anda menekan tombol Windows. Harap tetap fokus pada ujian.'
    };

    let msg = messages[type] || 'Terjadi pelanggaran keamanan.';

    violationMessage = msg;
    violationType = type;
    showViolationModal = true;

    logViolation(type);

    if (violationSeverity >= nextLockThreshold && !examLocked) {
      examLocked = true;
      nextLockThreshold += 3;
      lockExamSession();
    }
  }

  function handleReturnToFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        isFullscreen = true;
        showViolationModal = false;
      }).catch(err => {
        console.error('Error attempting to re-enable fullscreen:', err);
        showViolationModal = false;
      });
    } else {
      showViolationModal = false;
    }
  }

  async function lockExamSession() {
    try {
      await apiFetch(`/api/exam-sessions/lock/${sessionId}`, { method: 'POST' });
      startLockPolling();
    } catch (error) {
      if (!error.message.toLowerCase().includes('cancelled') && error.name !== 'AbortError') {
        console.error('Failed to lock exam session:', error);
      }
    }
  }

  function startLockPolling() {
    if (lockPollInterval) clearInterval(lockPollInterval);
    lockPollInterval = setInterval(async () => {
      try {
        const result = await apiFetch(`/api/exam-sessions/status/${sessionId}`);
        if (!result.is_locked) {
          unlockResolved = true;
          clearInterval(lockPollInterval);
          lockPollInterval = null;
        }
      } catch (error) {
        console.error('Failed to check lock status:', error);
        if (error.message === 'Session expired.') {
          clearInterval(lockPollInterval);
          lockPollInterval = null;
        }
      }
    }, 5000);
  }

  function handleResumeAfterUnlock() {
    unlockResolved = false;
    examLocked = false;
    showViolationModal = false;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen request failed:', err);
      });
    }
  }

  function startHeartbeat() {
    heartbeatInterval = setInterval(async () => {
      if (sessionId) {
        try {
          await apiFetch(`/api/exam-sessions/heartbeat/${sessionId}`, {
            method: 'PUT',
            body: {
              tab_switches: tabSwitches,
              fullscreen_exits: fullscreenExits
            }
          });
        } catch (error) {
          console.error('Heartbeat failed:', error);
          if (error.message === 'Session expired.') {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
        }
      }
    }, 30000); // Every 30 seconds
  }

  async function endExamSession() {
    if (sessionId) {
      try {
        await apiFetch(`/api/exam-sessions/end/${sessionId}`, {
          method: 'POST'
        });
        
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      } catch (error) {
        console.error('Failed to end exam session:', error);
      }
    }
  }



  async function fetchQuestions() {
    try {
      // Try paket soal first
      try {
        const paketData = await apiFetch(`/api/paket-soal/student/questions/${examId}`);
        questions = paketData.questions || [];
      } catch (paketError) {
        // Fallback to regular questions
        questions = await apiFetch(`/api/soal/ujian/${examId}`);
      }

      // Initialize answers
      questions.forEach(q => {
        if (!(q.id in answers)) {
          if (q.tipe_soal === 'multiple_answer') {
            answers[q.id] = [];
          } else {
            answers[q.id] = '';
          }
        }
      });
    } catch (error) {
      toast.error('Gagal memuat soal: ' + error.message);
      navigate('/exam-list');
    }
    // Note: loading = false is now handled in onMount after both fetches complete
  }

  function startTimer() {
    timerInterval = setInterval(() => {
      timeLeft.update(time => {
        if (time <= 0) {
          clearInterval(timerInterval);
          toast.warning('Waktu ujian habis! Jawaban Anda sedang dikirim...');
          // End session before submitting
          endExamSession().then(() => {
            handleFinishExam(true);
          });
          return 0;
        }
        
        const newTime = time - 1;
        
        // Debugging
        if (newTime % 10 === 0) {
          console.log('Timer tick, timeLeft:', newTime);
        }
        
        // Save timer state every 5 seconds
        if (newTime % 5 === 0) {
          try {
            localStorage.setItem(timerKey, JSON.stringify({
              timeLeft: newTime,
              savedAt: Date.now()
            }));
          } catch (e) {
            // Ignore localStorage errors
          }
        }
        
        // Warning when less than 5 minutes
        if (newTime < 300) {
          timerWarning = true;
        }
        
        // Critical when less than 1 minute
        if (newTime < 60) {
          timerCritical = true;
          if (newTime === 60) {
            if ('vibrate' in navigator) {
              navigator.vibrate([200, 100, 200]);
            }
          }
        }
        
        return newTime;
      });
    }, 1000);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        isFullscreen = true;
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          isFullscreen = false;
        });
      }
    }
  }

  // Reactive wrapper for timer display
  $: currentTime = $timeLeft;
  
  // Reactive calculation for progress
  $: answeredCount = questions.filter(q => {
    const ans = answers[q.id];
    return q.tipe_soal === 'multiple_answer' ? (ans && ans.length > 0) : (ans && ans.toString().trim() !== '');
  }).length;

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function getTimerColor() {
    if (timerCritical) return 'text-red-600 bg-red-50 border-red-300 animate-pulse';
    if (timerWarning) return 'text-orange-600 bg-orange-50 border-orange-300';
    return 'text-indigo-600 bg-indigo-50 border-transparent';
  }

  function goToQuestion(index) {
    if (index >= 0 && index < questions.length) {
      currentQuestionIndex = index;
      saveProgress(); // Save when navigating
    }
  }

  function handleAnswerChange(questionId, value) {
    answers = {
      ...answers,
      [questionId]: value
    };
    saveProgress(); // Auto-save on answer change
  }

  function handleMultipleAnswerChange(questionId, option, checked) {
    const currentAnswers = answers[questionId] || [];
    let newAnswers;

    if (checked) {
      newAnswers = [...currentAnswers, option];
    } else {
      newAnswers = currentAnswers.filter(a => a !== option);
    }

    answers = {
      ...answers,
      [questionId]: newAnswers
    };
    saveProgress(); // Auto-save on answer change
  }

  function handleEssayChange(questionId, value) {
    answers = {
      ...answers,
      [questionId]: value
    };
    saveProgress(); // Auto-save on essay change
  }

  function getUnansweredQuestions() {
    return questions.filter(q => {
      const answer = answers[q.id];
      if (q.tipe_soal === 'multiple_answer') {
        return !answer || answer.length === 0;
      } else if (q.tipe_soal === 'essay') {
        return !answer || answer.trim() === '';
      } else {
        return !answer || answer === '';
      }
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
    confirmMessage = '';
  }

  async function handleFinishExam(force = false) {
    if (force) {
      await submitExam();
      return;
    }

    const unanswered = getUnansweredQuestions();

    if (unanswered.length > 0) {
      showConfirmation(
        `⚠️ Anda memiliki ${unanswered.length} soal yang belum dijawab. Yakin ingin menyelesaikan ujian?`,
        async () => {
          hideConfirmation();
          await submitExam();
        }
      );
    } else {
      showConfirmation('✅ Yakin ingin menyelesaikan ujian?', async () => {
        hideConfirmation();
        await submitExam();
      });
    }
  }

  async function submitExam() {
    if (submitting) return;

    submitting = true;
    toast.info('Mengirim jawaban... Mohon tunggu');

    try {
      // Format answers for submission
      const formattedAnswers = {};
      questions.forEach(q => {
        if (q.tipe_soal === 'multiple_answer') {
          formattedAnswers[q.id] = (answers[q.id] || []).sort().join(',');
        } else {
          formattedAnswers[q.id] = answers[q.id] || '';
        }
      });

      const result = await apiFetch('/api/hasil', {
        method: 'POST',
        body: {
          ujian_id: examId,
          jawaban_siswa: formattedAnswers
        }
      });

      // Clear saved progress after successful submission
      clearProgress();

      // Show success message
      submitting = false;
      showCompletionDialog = true;
      
      toast.success('✅ ' + (result.message || 'Ujian berhasil diselesaikan!'));
    } catch (error) {
      console.error('Submission error:', error);
      toast.error('❌ Gagal mengirim jawaban: ' + error.message);
      submitting = false;
      // Show error dialog
      showCompletionDialog = true;
      examSubmissionError = error.message;
    }
  }

  function getQuestionTypeLabel(type) {
    const labels = {
      'pilihan_ganda': 'Pilihan Ganda',
      'essay': 'Essay / Uraian',
      'benar_salah': 'Benar / Salah',
      'multiple_answer': 'Pilihan Ganda Kompleks'
    };
    return labels[type] || 'Pilihan Ganda';
  }
  
  function getAnsweredCount() {
    return questions.filter(q => {
      const ans = answers[q.id];
      return q.tipe_soal === 'multiple_answer' ? (ans && ans.length > 0) : (ans && ans.toString().trim() !== '');
    }).length;
  }
</script>

<svelte:head>
        <title>{exam?.judul || 'Ujian Online'}</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
  {#if loading}
    <div class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="relative">
          <div class="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="w-8 h-8 bg-indigo-100 rounded-full animate-pulse"></div>
          </div>
        </div>
        <p class="text-gray-600 mt-4 font-medium">Memuat ujian...</p>
      </div>
    </div>
  {:else}
    <!-- Header -->
    <header class="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-20 shadow-lg">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Left: Exam Title -->
          <div class="flex items-center flex-1 min-w-0">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mr-3 shadow-md">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <h1 class="text-sm sm:text-lg font-bold text-gray-800 truncate">{exam?.judul || 'Ujian'}</h1>
          </div>

          <!-- Right: User Info, Timer & Fullscreen -->
          <div class="flex items-center space-x-2 sm:space-x-4">
            <!-- User Info -->
            {#if user}
              <div class="hidden sm:flex items-center space-x-3 px-3 py-1.5 bg-white rounded-xl shadow-sm">
                <div class="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {user.nama.charAt(0).toUpperCase()}
                </div>
                <div class="text-right">
                  <p class="text-xs font-semibold text-gray-800">{user.nama}</p>
                  <p class="text-xs text-gray-500">{user.role || 'siswa'}</p>
                </div>
              </div>
            {/if}

            <!-- Timer -->
            <div class="flex items-center space-x-2 px-3 py-2 rounded-xl {getTimerColor()} border-2 shadow-sm transition-all duration-300">
              <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {#key currentTime}
                <span class="text-base sm:text-xl font-bold font-mono tracking-wider">{formatTime(currentTime)}</span>
              {/key}
            </div>

            <!-- Fullscreen Toggle -->
            <button
              on:click={toggleFullscreen}
              class="p-2 rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {#if isFullscreen}
                <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
                </svg>
              {:else}
                <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              {/if}
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      <!-- Exam Info Bar -->
      <div class="bg-white rounded-2xl shadow-lg p-5 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div class="flex items-center space-x-3">
            <span class="text-xl">⏱️</span>
            <div>
              <p class="text-xs text-gray-500">Durasi</p>
                <p class="font-bold text-gray-800">{exam?.durasi || 0} menit</p>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <span class="text-xl">📝</span>
            <div>
              <p class="text-xs text-gray-500">Total Soal</p>
              <p class="font-bold text-gray-800">{questions.length}</p>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <span class="text-xl">📊</span>
            <div>
              <p class="text-xs text-gray-500">Dijawab</p>
              <p class="font-bold text-green-600">{answeredCount} / {questions.length}</p>
            </div>
          </div>
        </div>
        
        <!-- Progress Bar -->
        <div class="mt-4">
          <div class="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div 
              class="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-500 ease-out" 
              style="width: {Math.round((answeredCount / questions.length) * 100)}%"
            ></div>
          </div>
          <p class="text-xs text-gray-500 mt-2 text-right">
            {Math.round((answeredCount / questions.length) * 100)}% Selesai
          </p>
        </div>
      </div>

      <!-- Mobile Question Navigator -->
      <details class="lg:hidden mb-6 bg-white rounded-2xl shadow-lg border border-gray-100">
        <summary class="p-4 font-bold text-gray-800 cursor-pointer hover:bg-gray-50 rounded-2xl transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>Navigasi Soal ({questions.length} soal)</span>
            </div>
            <svg class="w-5 h-5 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </summary>
        <div class="p-4 pt-0 border-t border-gray-100 mt-2">
          <div class="grid grid-cols-5 gap-2">
            {#each questions as question, index}
                <button
                  on:click={() => goToQuestion(index)}
                  class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-200 {index === currentQuestionIndex
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md scale-110'
                    : (answers[question.id] && (
                        (Array.isArray(answers[question.id]) && answers[question.id].length > 0) ||
                        (!Array.isArray(answers[question.id]) && answers[question.id] !== '' && answers[question.id]?.trim() !== '')
                      ))
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                  }"
                >
                  {index + 1}
                </button>
            {/each}
          </div>
        </div>
      </details>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <!-- Question Numbers Panel -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-2xl shadow-lg p-5 sticky top-24 border border-gray-100">
            <div class="flex items-center space-x-3 mb-5 pb-3 border-b border-gray-200">
              <div class="w-8 h-8 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </div>
              <h2 class="font-bold text-gray-800">Nomor Soal</h2>
            </div>
            
            <div class="grid grid-cols-5 gap-2 mb-6">
              {#each questions as question, index}
                <button
                  on:click={() => goToQuestion(index)}
                  class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-200 {index === currentQuestionIndex
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md scale-110'
                    : (answers[question.id] && (
                        (Array.isArray(answers[question.id]) && answers[question.id].length > 0) ||
                        (!Array.isArray(answers[question.id]) && answers[question.id] !== '' && answers[question.id]?.trim() !== '')
                      ))
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }"
                >
                  {index + 1}
                </button>
              {/each}
            </div>

            <div class="space-y-2 pt-3 border-t border-gray-200">
              <div class="flex items-center">
                <div class="w-4 h-4 bg-green-100 border border-green-200 rounded mr-3"></div>
                <span class="text-xs text-gray-600">Sudah dijawab</span>
              </div>
              <div class="flex items-center">
                <div class="w-4 h-4 bg-gray-50 border border-gray-200 rounded mr-3"></div>
                <span class="text-xs text-gray-600">Belum dijawab</span>
              </div>
              <div class="flex items-center">
                <div class="w-4 h-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded mr-3"></div>
                <span class="text-xs text-gray-600">Soal saat ini</span>
              </div>
            </div>

            <button
              on:click={handleFinishExam}
              disabled={submitting}
              class="w-full mt-6 py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {#if submitting}
                <svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Mengirim...
              {:else}
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Selesai & Kirim
              {/if}
            </button>
          </div>
        </div>

        <!-- Question Content -->
        <div class="lg:col-span-3">
          <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
            {#key currentQuestionIndex}
              {#if questions[currentQuestionIndex]}
                <!-- Question Type Badge -->
                <div class="px-6 pt-6 pb-3">
                  <span class="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-200">
                    <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {getQuestionTypeLabel(questions[currentQuestionIndex].tipe_soal)}
                  </span>
                </div>

                <div class="px-6 pb-3">
                  <div class="flex items-center space-x-2 text-sm text-gray-500 mb-3">
                    <span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                      {currentQuestionIndex + 1}
                    </span>
                    <span>dari {questions.length} soal</span>
                  </div>
                  <h2 class="text-xl font-bold text-gray-800 leading-relaxed">
                    {questions[currentQuestionIndex].teks_soal}
                  </h2>
                </div>
                
                {#if questions[currentQuestionIndex].gambar_soal}
                  <div class="px-6 pb-4">
                    <img
                      src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/soal/images/${questions[currentQuestionIndex].gambar_soal}`}
                      alt="Soal illustration"
                      loading="lazy"
                      class="max-w-full h-auto max-h-64 rounded-xl border border-gray-200 shadow-sm"
                    />
                  </div>
                {/if}

                {#if questions[currentQuestionIndex].bobot}
                  <div class="mx-6 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div class="flex items-center">
                      <svg class="w-5 h-5 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span class="text-sm font-medium text-amber-800">Bobot: {questions[currentQuestionIndex].bobot} poin</span>
                    </div>
                  </div>
                {/if}

                <!-- Answer Options based on question type -->
                <div class="px-6 pb-6">
                  {#if questions[currentQuestionIndex].tipe_soal === 'pilihan_ganda'}
                    <div class="space-y-3">
                      {#each ['A', 'B', 'C', 'D', 'E'] as option}
                        {#if questions[currentQuestionIndex]['pilihan_' + option.toLowerCase()]}
                          <label class="flex items-start p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-all duration-200 group">
                            <input
                              type="radio"
                              name="answer_{questions[currentQuestionIndex].id}"
                              value={option}
                              bind:group={answers[questions[currentQuestionIndex].id]}
                              on:change={() => handleAnswerChange(questions[currentQuestionIndex].id, option)}
                              class="mt-1 mr-4 h-5 w-5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span class="font-bold text-gray-700 mr-3 w-6">{option}.</span>
                            <span class="text-gray-700 flex-1 group-hover:text-gray-900">
                              {questions[currentQuestionIndex]['pilihan_' + option.toLowerCase()]}
                            </span>
                            {#if questions[currentQuestionIndex]['gambar_pilihan_' + option.toLowerCase()]}
                              <img 
                                src="http://localhost:3000/api/soal/images/{questions[currentQuestionIndex]['gambar_pilihan_' + option.toLowerCase()]}"
                                alt="Option {option}"
                                loading="lazy"
                                class="ml-4 max-w-32 h-auto rounded-lg border"
                              />
                            {/if}
                          </label>
                        {/if}
                      {/each}
                    </div>

                  {:else if questions[currentQuestionIndex].tipe_soal === 'benar_salah'}
                    <div class="space-y-3">
                      <label class="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50/30 cursor-pointer transition-all duration-200">
                        <input
                          type="radio"
                          name="answer_{questions[currentQuestionIndex].id}"
                          value="benar"
                          bind:group={answers[questions[currentQuestionIndex].id]}
                          on:change={() => handleAnswerChange(questions[currentQuestionIndex].id, 'benar')}
                          class="mr-4 h-5 w-5 text-green-600 focus:ring-green-500"
                        />
                        <span class="text-lg font-semibold text-gray-800">✅ Benar</span>
                      </label>
                      <label class="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/30 cursor-pointer transition-all duration-200">
                        <input
                          type="radio"
                          name="answer_{questions[currentQuestionIndex].id}"
                          value="salah"
                          bind:group={answers[questions[currentQuestionIndex].id]}
                          on:change={() => handleAnswerChange(questions[currentQuestionIndex].id, 'salah')}
                          class="mr-4 h-5 w-5 text-red-600 focus:ring-red-500"
                        />
                        <span class="text-lg font-semibold text-gray-800">❌ Salah</span>
                      </label>
                    </div>

                  {:else if questions[currentQuestionIndex].tipe_soal === 'multiple_answer'}
                    <div class="space-y-3">
                      {#each ['A', 'B', 'C', 'D', 'E'] as option}
                        {#if questions[currentQuestionIndex]['pilihan_' + option.toLowerCase()]}
                          <label class="flex items-start p-4 border-2 border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 cursor-pointer transition-all duration-200">
                            <input
                              type="checkbox"
                              value={option}
                              checked={(answers[questions[currentQuestionIndex].id] || []).includes(option)}
                              on:change={(e) => handleMultipleAnswerChange(questions[currentQuestionIndex].id, option, e.target.checked)}
                              class="mt-1 mr-4 h-5 w-5 text-purple-600 focus:ring-purple-500 rounded"
                            />
                            <span class="font-bold text-gray-700 mr-3 w-6">{option}.</span>
                            <span class="text-gray-700 flex-1">
                              {questions[currentQuestionIndex]['pilihan_' + option.toLowerCase()]}
                            </span>
                          </label>
                        {/if}
                      {/each}
                      <div class="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <p class="text-sm text-blue-800 flex items-center">
                          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          💡 Pilih semua jawaban yang benar (bisa lebih dari satu)
                        </p>
                      </div>
                    </div>

                  {:else if questions[currentQuestionIndex].tipe_soal === 'essay'}
                    <div>
                      <textarea
                        bind:value={answers[questions[currentQuestionIndex].id]}
                        on:input={() => handleEssayChange(questions[currentQuestionIndex].id, answers[questions[currentQuestionIndex].id])}
                        rows="8"
                        class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-800"
                        placeholder="Tulis jawaban Anda di sini..."
                      ></textarea>
                      <div class="flex justify-between items-center mt-2">
                        <p class="text-xs text-gray-500">
                          <span class="font-medium">{answers[questions[currentQuestionIndex].id]?.length || 0}</span> karakter
                        </p>
                        <p class="text-xs text-gray-400">
                          Gunakan format teks biasa
                        </p>
                      </div>
                    </div>
                  {/if}
                </div>

                <!-- Navigation Buttons -->
                <div class="px-6 pb-6 pt-4 border-t border-gray-100 bg-gray-50/50 flex justify-between">
                  <button
                    on:click={() => goToQuestion(currentQuestionIndex - 1)}
                    disabled={currentQuestionIndex === 0}
                    class="py-2.5 px-6 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 border border-gray-200 shadow-sm"
                  >
                    ← Sebelumnya
                  </button>

                  {#if currentQuestionIndex < questions.length - 1}
                    <button
                      on:click={() => goToQuestion(currentQuestionIndex + 1)}
                      class="py-2.5 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      Selanjutnya →
                    </button>
                  {/if}
                </div>
              {/if}
            {/key}
          </div>
        </div>
      </div>
    </main>
  {/if}

  <!-- Confirmation Modal -->
  {#if showConfirmModal}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
        <div class="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 class="text-xl font-bold text-white">Konfirmasi</h3>
          </div>
        </div>
        <div class="p-6">
          <p class="text-gray-700 text-center mb-6">{confirmMessage}</p>
          <div class="flex space-x-3">
            <button
              on:click={hideConfirmation}
              class="flex-1 py-3 px-4 bg-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-300 transition-all"
            >
              Batal
            </button>
            <button
              on:click={confirmAction}
              class="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
            >
              Ya, Konfirmasi
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Completion Dialog -->
  {#if showCompletionDialog}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
        {#if examSubmissionError}
          <div class="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-white">Gagal Mengirim</h3>
            </div>
          </div>
          <div class="p-6">
            <p class="text-gray-600 mb-4 text-center">Terjadi kesalahan saat mengirim jawaban</p>
            <div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p class="text-sm text-red-800 font-medium mb-2">Pesan Error:</p>
              <p class="text-sm text-red-700 bg-white p-2 rounded-lg border font-mono">{examSubmissionError}</p>
              <p class="text-xs text-red-600 mt-3 flex items-center">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Jangan panik! Jawaban mungkin sudah tersimpan. Hubungi guru.
              </p>
            </div>
            <div class="space-y-2">
              <button
                on:click={() => {
                  showCompletionDialog = false;
                  examSubmissionError = null;
                  navigateTo('/exam-list', { replace: true });
                }}
                class="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                Kembali ke Daftar Ujian
              </button>
              <button
                on:click={() => {
                  showCompletionDialog = false;
                  examSubmissionError = null;
                }}
                class="w-full py-3 px-4 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        {:else}
          <div class="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-white">Ujian Berhasil Dikirim!</h3>
            </div>
          </div>
          <div class="p-6">
            <p class="text-gray-600 text-center mb-4">Jawaban kamu sudah tersimpan di server</p>
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p class="text-sm text-blue-800 flex items-center">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                💡 Hasil ujian kamu akan tersedia setelah dinilai oleh guru.
              </p>
            </div>
            <button
              on:click={() => {
                showCompletionDialog = false;
                navigateTo('/exam-list', { replace: true });
              }}
              class="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              Kembali ke Daftar Ujian
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Violation Warning Modal -->
  {#if showViolationModal}
    {#if examLocked}
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in border-2 border-red-400">
          <div class="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-5">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-red-500/30 rounded-xl flex items-center justify-center">
                <svg class="w-7 h-7 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 1112 3a9 9 0 017.364 4.636z" />
                </svg>
              </div>
              <div>
                <h3 class="text-xl font-bold text-white">Ujian Terkunci</h3>
                <p class="text-sm text-gray-400 mt-0.5">Akumulasi pelanggaran mencapai batas maksimal</p>
              </div>
            </div>
          </div>
          <div class="p-6">
            <div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p class="text-sm text-red-800 text-center">
                Anda telah melakukan <strong>{violationSeverity} pelanggaran</strong>. Ujian telah dikunci untuk mencegah kecurangan lebih lanjut.
              </p>
            </div>
            <p class="text-gray-600 text-sm text-center mb-6">
              Silakan hubungi admin atau proktor untuk mereset ujian Anda.
            </p>
            {#if unlockResolved}
              <div class="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                <p class="text-sm text-green-700 text-center font-medium">
                  ✅ Admin telah mereset ujian Anda. Silakan lanjutkan.
                </p>
              </div>
              <button
                on:click={handleResumeAfterUnlock}
                class="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
              >
                Lanjutkan Ujian
              </button>
            {:else}
              <button
                disabled
                class="w-full py-3 px-4 bg-gray-300 text-gray-500 font-semibold rounded-xl cursor-not-allowed"
              >
                Minta Reset ke Admin/Proktor
              </button>
              <p class="text-xs text-gray-400 text-center mt-3">Tombol akan aktif setelah admin mereset ujian Anda</p>
            {/if}
          </div>
        </div>
      </div>
    {:else}
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
          <div class="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-white">Peringatan! Pelanggaran #{violationSeverity}</h3>
            </div>
          </div>
          <div class="p-6">
            <p class="text-gray-700 text-center mb-4 whitespace-pre-line">{violationMessage}</p>
            <p class="text-sm text-gray-500 text-center mb-6">Harap tetap fokus pada ujian dan jangan meninggalkan halaman ini.</p>
            <button
              on:click={handleReturnToFullscreen}
              class="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
            >
              Kembali ke Fullscreen
            </button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

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