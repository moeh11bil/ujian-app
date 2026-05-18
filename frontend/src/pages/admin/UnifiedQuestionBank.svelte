<script>
  import { onMount, onDestroy } from 'svelte';
  import { fetchWithAuth, apiFetch } from '$lib/api';
  import Modal from '../../components/Modal.svelte';
  import ToastContainer from '../../components/ToastContainer.svelte';
  import toast from '../../lib/toast.js';

  let token = localStorage.getItem('token');
  let user = null;

  $: if (token) {
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
      console.error('Invalid token in UnifiedQuestionBank.svelte', e);
    }
  }

  // State variables
  let questions = [];
  let exams = [];
  let kelas = [];
  let subjects = [];
  let filterByClass = '';
  let filterBySubject = '';
  let filterByExam = '';
  let searchQuery = '';

   // Pagination state
   let currentPage = 1;
   let entriesPerPage = 10;
   const entriesOptions = [10, 25, 50, 100];

   // Reset to page 1 when filters or entries per page change
   function handleFilterOrPageChange() {
     currentPage = 1;
   }

   // Reactive statements to reset page when filters change
   $: filterByClass, handleFilterOrPageChange();
   $: filterByExam, handleFilterOrPageChange();
   $: searchQuery, handleFilterOrPageChange();
   $: entriesPerPage, handleFilterOrPageChange();

   // Safety check: ensure currentPage is valid
   $: if (currentPage > totalPages) {
     currentPage = 1;
     }

  // Question form state
  let newQuestion = {
    teks_soal: '',
    pilihan_a: '',
    pilihan_b: '',
    pilihan_c: '',
    pilihan_d: '',
    pilihan_e: '',
    kunci_jawaban: '',
    bobot: 1,
    kelas_id: '',
    ujian_id: '',
    tipe_soal: 'pilihan_ganda',
    jawaban_essay: '',
    jawaban_benar_salah: '',
    jawaban_multiple: [],
    gambar_soal: null,
    gambar_pilihan_a: null,
    gambar_pilihan_b: null,
    gambar_pilihan_c: null,
    gambar_pilihan_d: null,
    gambar_pilihan_e: null
  };
  
  // Image preview URLs
  let previewImages = {
    gambar_soal: '',
    gambar_pilihan_a: '',
    gambar_pilihan_b: '',
    gambar_pilihan_c: '',
    gambar_pilihan_d: '',
    gambar_pilihan_e: ''
  };
  
  // Image files to upload
  let imageFiles = {
    gambar_soal: null,
    gambar_pilihan_a: null,
    gambar_pilihan_b: null,
    gambar_pilihan_c: null,
    gambar_pilihan_d: null,
    gambar_pilihan_e: null
  };
  let isAddingQuestion = false;
  let isEditingQuestion = false;
  let editingQuestionId = null;

  // Modal state for add/edit question
  let showQuestionModal = false;
  let modalMode = 'add'; // 'add' or 'edit'

  // Filtered exams for filter dropdown based on selected class
  $: filteredExamsForFilter = filterByClass
    ? exams.filter(exam => !exam.kelas_id || exam.kelas_id == filterByClass)
    : exams;
  
  // Modal state
  let showConfirmModal = false;
  let confirmCallback = null;
  let confirmMessage = '';
  let showImportModal = false;
  let questionsFile = null;
  let importKelasId = '';
  let importUjianId = '';
  let prevImportKelasId = '';

  // Reset ujian when class changes
  $: {
    if (importKelasId !== prevImportKelasId) {
      importUjianId = '';
      prevImportKelasId = importKelasId;
    }
  }

  // Filtered exams based on selected class
  $: filteredExamsForImport = importKelasId 
    ? exams.filter(exam => !exam.kelas_id || exam.kelas_id == importKelasId)
    : [];

  // Filtered exams for question form based on selected class
  $: filteredExamsForQuestion = newQuestion.kelas_id 
    ? exams.filter(exam => !exam.kelas_id || exam.kelas_id == newQuestion.kelas_id)
    : exams;

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

  function openImportModal() {
    showImportModal = true;
  }

  function hideImportModal() {
    showImportModal = false;
    questionsFile = null;
    importKelasId = '';
    importUjianId = '';
    prevImportKelasId = '';
  }

  function handleQuestionsFile(e) {
    questionsFile = e.target.files[0];
  }

  async function handleImportQuestions() {
    if (!questionsFile) {
      toast.error('Pilih file untuk import pertanyaan');
      return;
    }
    if (!importKelasId) {
      toast.error('Pilih kelas untuk import pertanyaan');
      return;
    }
    if (!importUjianId) {
      toast.error('Pilih ujian untuk import pertanyaan');
      return;
    }
    const formData = new FormData();
    formData.append('file', questionsFile);
    formData.append('kelas_id', importKelasId);
    formData.append('ujian_id', importUjianId);
    try {
      await apiFetch('/bulk/import-questions', {
        method: 'POST',
        body: formData,
      });
      toast.success('Pertanyaan berhasil diimpor');
      hideImportModal();
      await fetchQuestions(); // Refresh the question list
    } catch (error) {
      toast.error(`Gagal mengimpor pertanyaan: ${error.message}`);
    }
  }

  async function handleExport(url) {
    try {
      const token = localStorage.getItem('token');
      const tokenString = token.startsWith('Bearer ') ? token.substring(7) : token;
      
      const response = await fetch(`http://localhost:3000${url}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenString}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const fileName = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') ||
                       'template-questions.xlsx';

      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
      toast.success('Template berhasil diunduh');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Gagal mengekspor data: ${error.message}`);
    }
  }

  onMount(async () => {
    // Add admin layout class to body
    document.body.classList.add('admin-layout');

    // Fallback to localStorage if token is not passed as prop
    if (!token) {
      token = localStorage.getItem('token');
    }

    if (!token) {
      return;
    }

    await Promise.all([fetchQuestions(), fetchExams(), fetchKelas()]);
  });

  // Cleanup function to remove class when component is destroyed
  onDestroy(() => {
    document.body.classList.remove('admin-layout');
  });

  async function fetchQuestions() {
    try {
      const response = await apiFetch('/api/soal?limit=1000');
      questions = response?.data || response || [];
    } catch (error) {
      console.error('Error fetching questions:', error);
      questions = [];
    }
  }

  async function fetchExams() {
    try {
      const response = await apiFetch('/api/ujian?limit=1000');
      exams = response?.data || response || [];
    } catch (error) {
      console.error('Error fetching exams:', error);
    }
  }

  async function fetchKelas() {
    try {
      const response = await apiFetch('/api/kelas?limit=1000');
      kelas = response?.data || response || [];
    } catch (error) {
      console.error('Error fetching kelas:', error);
    }
  }

  // Filter questions based on criteria
  $: filteredQuestions = questions.filter(question => {
    const matchesClass = !filterByClass || question.kelas_id == filterByClass;
    const matchesExam = !filterByExam || question.ujian_id == filterByExam;
    const matchesSearch = !searchQuery ||
      question.teks_soal.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (question.ujian_judul && question.ujian_judul.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesClass && matchesExam && matchesSearch;
  });

  // Pagination calculations
  $: totalPages = Math.ceil(filteredQuestions.length / entriesPerPage) || 1;
  $: startIndex = (currentPage - 1) * entriesPerPage;
  $: endIndex = startIndex + entriesPerPage;
  $: paginatedQuestions = filteredQuestions.slice(startIndex, endIndex);
  $: showingFrom = filteredQuestions.length === 0 ? 0 : startIndex + 1;
  $: showingTo = Math.min(endIndex, filteredQuestions.length);

  // Generate page numbers for pagination
  function getPageNumbers() {
    const pages = [];
    const delta = 1;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    const leftEdge = 1;
    const rightEdge = totalPages;
    const leftStart = currentPage - delta;
    const rightEnd = currentPage + delta;

    if (leftStart > 2) {
      pages.push(leftEdge);
      pages.push('...');
    } else if (leftStart === 2) {
      pages.push(1);
    }

    const start = Math.max(leftStart, 2);
    const end = Math.min(rightEnd, totalPages - 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (rightEnd < totalPages - 1) {
      pages.push('...');
      pages.push(rightEdge);
    } else if (rightEnd === totalPages - 1) {
      pages.push(totalPages);
    }

    return pages;
  }

  // Filtered exams based on selected class
  $: filteredExamsForImport = importKelasId
    ? exams.filter(exam => !exam.kelas_id || exam.kelas_id == importKelasId)
    : [];

  // Filtered exams for question form based on selected class
  $: filteredExamsForQuestion = newQuestion.kelas_id
    ? exams.filter(exam => !exam.kelas_id || exam.kelas_id == newQuestion.kelas_id)
    : exams;

  async function addQuestion() {
    try {
      // Validate based on question type
      if (!newQuestion.teks_soal) {
        toast.error('Soal wajib diisi');
        return;
      }
      
      if (newQuestion.tipe_soal === 'pilihan_ganda') {
        if (!newQuestion.pilihan_a || !newQuestion.pilihan_b || !newQuestion.pilihan_c || !newQuestion.pilihan_d || !newQuestion.kunci_jawaban) {
          toast.error('Lengkapi semua pilihan dan jawaban untuk pilihan ganda');
          return;
        }
      } else if (newQuestion.tipe_soal === 'essay') {
        if (!newQuestion.jawaban_essay) {
          toast.error('Jawaban contoh wajib diisi untuk essay');
          return;
        }
      } else if (newQuestion.tipe_soal === 'benar_salah') {
        if (!newQuestion.jawaban_benar_salah) {
          toast.error('Jawaban wajib dipilih untuk benar/salah');
          return;
        }
      } else if (newQuestion.tipe_soal === 'multiple_answer') {
        if (!newQuestion.pilihan_a || !newQuestion.pilihan_b || !newQuestion.pilihan_c || !newQuestion.pilihan_d) {
          toast.error('Lengkapi semua pilihan untuk multiple answer');
          return;
        }
        if (!newQuestion.jawaban_multiple || newQuestion.jawaban_multiple.length === 0) {
          toast.error('Pilih minimal satu jawaban untuk multiple answer');
          return;
        }
      }

      // Use FormData for file uploads
      const formData = new FormData();
      formData.append('tipe_soal', newQuestion.tipe_soal);
      formData.append('teks_soal', newQuestion.teks_soal);
      formData.append('pilihan_a', newQuestion.pilihan_a || '');
      formData.append('pilihan_b', newQuestion.pilihan_b || '');
      formData.append('pilihan_c', newQuestion.pilihan_c || '');
      formData.append('pilihan_d', newQuestion.pilihan_d || '');
      formData.append('pilihan_e', newQuestion.pilihan_e || '');
      formData.append('kunci_jawaban', newQuestion.kunci_jawaban || '');
      formData.append('bobot', newQuestion.bobot || 1);
      formData.append('jawaban_essay', newQuestion.jawaban_essay || '');
      formData.append('jawaban_benar_salah', newQuestion.jawaban_benar_salah || '');
      formData.append('jawaban_multiple', Array.isArray(newQuestion.jawaban_multiple) ? newQuestion.jawaban_multiple.join(',') : newQuestion.jawaban_multiple);
      
      if (newQuestion.kelas_id) formData.append('kelas_id', newQuestion.kelas_id);
      if (newQuestion.ujian_id) formData.append('ujian_id', newQuestion.ujian_id);

      // Append image files
      if (imageFiles.gambar_soal) formData.append('gambar_soal', imageFiles.gambar_soal);
      if (imageFiles.gambar_pilihan_a) formData.append('gambar_pilihan_a', imageFiles.gambar_pilihan_a);
      if (imageFiles.gambar_pilihan_b) formData.append('gambar_pilihan_b', imageFiles.gambar_pilihan_b);
      if (imageFiles.gambar_pilihan_c) formData.append('gambar_pilihan_c', imageFiles.gambar_pilihan_c);
      if (imageFiles.gambar_pilihan_d) formData.append('gambar_pilihan_d', imageFiles.gambar_pilihan_d);
      if (imageFiles.gambar_pilihan_e) formData.append('gambar_pilihan_e', imageFiles.gambar_pilihan_e);

      await apiFetch('/api/soal', {
        method: 'POST',
        body: formData
      });

      // Refresh questions and close modal
      await fetchQuestions();
      closeQuestionModal();
      toast.success('Soal berhasil ditambahkan');
    } catch (error) {
      console.error('Error adding question:', error);
      toast.error('Terjadi kesalahan saat menambahkan soal: ' + error.message);
    }
  }

  async function deleteQuestion(questionId) {
    const message = 'Apakah Anda yakin ingin menghapus soal ini?';

    // Show custom confirmation modal
    showConfirmation(message, async () => {
      try {
        await apiFetch(`/api/soal/${questionId}`, {
          method: 'DELETE'
        });

        // Refresh questions
        await fetchQuestions();
        toast.success('Soal berhasil dihapus');
      } catch (error) {
        console.error('Error deleting question:', error);
        toast.error('Terjadi kesalahan saat menghapus soal: ' + error.message);
      }
    });
  }

  function openQuestionModal(mode = 'add') {
    modalMode = mode;
    showQuestionModal = true;
    if (mode === 'add') {
      // Reset form for new question
      newQuestion = {
        teks_soal: '',
        pilihan_a: '',
        pilihan_b: '',
        pilihan_c: '',
        pilihan_d: '',
        pilihan_e: '',
        kunci_jawaban: '',
        bobot: 1,
        kelas_id: '',
        ujian_id: '',
        tipe_soal: 'pilihan_ganda',
        jawaban_essay: '',
        jawaban_benar_salah: '',
        jawaban_multiple: [],
        gambar_soal: null,
        gambar_pilihan_a: null,
        gambar_pilihan_b: null,
        gambar_pilihan_c: null,
        gambar_pilihan_d: null,
        gambar_pilihan_e: null
      };
      imageFiles = {
        gambar_soal: null,
        gambar_pilihan_a: null,
        gambar_pilihan_b: null,
        gambar_pilihan_c: null,
        gambar_pilihan_d: null,
        gambar_pilihan_e: null
      };
      previewImages = {
        gambar_soal: '',
        gambar_pilihan_a: '',
        gambar_pilihan_b: '',
        gambar_pilihan_c: '',
        gambar_pilihan_d: '',
        gambar_pilihan_e: ''
      };
    }
  }

  function closeQuestionModal() {
    showQuestionModal = false;
    isAddingQuestion = false;
    isEditingQuestion = false;
    editingQuestionId = null;
  }

  function handleEscKey(event) {
    if (event.key === 'Escape' && showQuestionModal) {
      closeQuestionModal();
    }
  }

  function startEditQuestion(question) {
    newQuestion = {
      ...question,
      kelas_id: question.kelas_id || '',
      ujian_id: question.ujian_id || '',
      bobot: question.bobot || 1,
      tipe_soal: question.tipe_soal || 'pilihan_ganda',
      jawaban_essay: question.jawaban_essay || '',
      jawaban_benar_salah: question.jawaban_benar_salah || '',
      jawaban_multiple: question.jawaban_multiple ? question.jawaban_multiple.split(',') : [],
      gambar_soal: question.gambar_soal || null,
      gambar_pilihan_a: question.gambar_pilihan_a || null,
      gambar_pilihan_b: question.gambar_pilihan_b || null,
      gambar_pilihan_c: question.gambar_pilihan_c || null,
      gambar_pilihan_d: question.gambar_pilihan_d || null,
      gambar_pilihan_e: question.gambar_pilihan_e || null
    };
    isEditingQuestion = true;
    editingQuestionId = question.id;
    modalMode = 'edit';
    showQuestionModal = true;
    
    // Set preview images for existing images
    previewImages = {
      gambar_soal: question.gambar_soal ? `http://localhost:3000/uploads/soal/${question.gambar_soal}` : '',
      gambar_pilihan_a: question.gambar_pilihan_a ? `http://localhost:3000/uploads/soal/${question.gambar_pilihan_a}` : '',
      gambar_pilihan_b: question.gambar_pilihan_b ? `http://localhost:3000/uploads/soal/${question.gambar_pilihan_b}` : '',
      gambar_pilihan_c: question.gambar_pilihan_c ? `http://localhost:3000/uploads/soal/${question.gambar_pilihan_c}` : '',
      gambar_pilihan_d: question.gambar_pilihan_d ? `http://localhost:3000/uploads/soal/${question.gambar_pilihan_d}` : '',
      gambar_pilihan_e: question.gambar_pilihan_e ? `http://localhost:3000/uploads/soal/${question.gambar_pilihan_e}` : ''
    };
    
    // Reset image files
    imageFiles = {
      gambar_soal: null,
      gambar_pilihan_a: null,
      gambar_pilihan_b: null,
      gambar_pilihan_c: null,
      gambar_pilihan_d: null,
      gambar_pilihan_e: null
    };
  }

  async function updateQuestion() {
    try {
      // Validate based on question type
      if (!newQuestion.teks_soal) {
        toast.error('Soal wajib diisi');
        return;
      }
      
      if (newQuestion.tipe_soal === 'pilihan_ganda') {
        if (!newQuestion.pilihan_a || !newQuestion.pilihan_b || !newQuestion.pilihan_c || !newQuestion.pilihan_d || !newQuestion.kunci_jawaban) {
          toast.error('Lengkapi semua pilihan dan jawaban untuk pilihan ganda');
          return;
        }
      } else if (newQuestion.tipe_soal === 'essay') {
        if (!newQuestion.jawaban_essay) {
          toast.error('Jawaban contoh wajib diisi untuk essay');
          return;
        }
      } else if (newQuestion.tipe_soal === 'benar_salah') {
        if (!newQuestion.jawaban_benar_salah) {
          toast.error('Jawaban wajib dipilih untuk benar/salah');
          return;
        }
      } else if (newQuestion.tipe_soal === 'multiple_answer') {
        if (!newQuestion.pilihan_a || !newQuestion.pilihan_b || !newQuestion.pilihan_c || !newQuestion.pilihan_d) {
          toast.error('Lengkapi semua pilihan untuk multiple answer');
          return;
        }
        if (!newQuestion.jawaban_multiple || newQuestion.jawaban_multiple.length === 0) {
          toast.error('Pilih minimal satu jawaban untuk multiple answer');
          return;
        }
      }

      // Use FormData for file uploads
      const formData = new FormData();
      formData.append('tipe_soal', newQuestion.tipe_soal);
      formData.append('teks_soal', newQuestion.teks_soal);
      formData.append('pilihan_a', newQuestion.pilihan_a || '');
      formData.append('pilihan_b', newQuestion.pilihan_b || '');
      formData.append('pilihan_c', newQuestion.pilihan_c || '');
      formData.append('pilihan_d', newQuestion.pilihan_d || '');
      formData.append('pilihan_e', newQuestion.pilihan_e || '');
      formData.append('kunci_jawaban', newQuestion.kunci_jawaban || '');
      formData.append('bobot', newQuestion.bobot || 1);
      formData.append('jawaban_essay', newQuestion.jawaban_essay || '');
      formData.append('jawaban_benar_salah', newQuestion.jawaban_benar_salah || '');
      formData.append('jawaban_multiple', Array.isArray(newQuestion.jawaban_multiple) ? newQuestion.jawaban_multiple.join(',') : newQuestion.jawaban_multiple);
      
      if (newQuestion.kelas_id) formData.append('kelas_id', newQuestion.kelas_id);
      if (newQuestion.ujian_id) formData.append('ujian_id', newQuestion.ujian_id);

      // Append image files
      if (imageFiles.gambar_soal) formData.append('gambar_soal', imageFiles.gambar_soal);
      if (imageFiles.gambar_pilihan_a) formData.append('gambar_pilihan_a', imageFiles.gambar_pilihan_a);
      if (imageFiles.gambar_pilihan_b) formData.append('gambar_pilihan_b', imageFiles.gambar_pilihan_b);
      if (imageFiles.gambar_pilihan_c) formData.append('gambar_pilihan_c', imageFiles.gambar_pilihan_c);
      if (imageFiles.gambar_pilihan_d) formData.append('gambar_pilihan_d', imageFiles.gambar_pilihan_d);
      if (imageFiles.gambar_pilihan_e) formData.append('gambar_pilihan_e', imageFiles.gambar_pilihan_e);

      // Append remove flags - always send if exists
      formData.append('remove_gambar_soal', newQuestion.remove_gambar_soal || '');
      formData.append('remove_gambar_pilihan_a', newQuestion.remove_gambar_pilihan_a || '');
      formData.append('remove_gambar_pilihan_b', newQuestion.remove_gambar_pilihan_b || '');
      formData.append('remove_gambar_pilihan_c', newQuestion.remove_gambar_pilihan_c || '');
      formData.append('remove_gambar_pilihan_d', newQuestion.remove_gambar_pilihan_d || '');
      formData.append('remove_gambar_pilihan_e', newQuestion.remove_gambar_pilihan_e || '');

      await apiFetch(`/api/soal/${editingQuestionId}`, {
        method: 'PUT',
        body: formData
      });

      // Refresh questions and close modal
      await fetchQuestions();
      closeQuestionModal();
      toast.success('Soal berhasil diperbarui');
    } catch (error) {
      console.error('Error updating question:', error);
      toast.error('Terjadi kesalahan saat memperbarui soal: ' + error.message);
    }
  }

  function cancelEdit() {
    closeQuestionModal();
  }

  function handleInputChange(event, field) {
    newQuestion = {
      ...newQuestion,
      [field]: event.target.value
    };
  }

  function handleImageUpload(event, field) {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        toast.error('Hanya file gambar (JPEG, PNG, GIF, WEBP) yang diperbolehkan');
        return;
      }
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran gambar maksimal 5MB');
        return;
      }
      
      imageFiles = { ...imageFiles, [field]: file };
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImages = { ...previewImages, [field]: e.target.result };
      };
      reader.readAsDataURL(file);
    }
  }

  function removeImage(field) {
    imageFiles = { ...imageFiles, [field]: null };
    previewImages = { ...previewImages, [field]: '' };
    // Mark for removal from server
    newQuestion = { ...newQuestion, [`remove_${field}`]: 'true' };
  }

  function handleFilterChange() {
    // Filters are applied via reactive statement
  }
</script>


  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      <!-- Header Section -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div class="inline-flex items-center space-x-2 text-sm text-indigo-600 mb-2">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 002 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 005.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 009 7.5c0-1.255-.434-2.443-1.18-3.5z"/>
                <path d="M15.5 4c-1.255 0-2.443.434-3.5 1.18A7.968 7.968 0 0011 7.5c0 1.255.434 2.443 1.18 3.5A7.968 7.968 0 0015.5 12c1.255 0 2.443-.434 3.5-1.18A7.968 7.968 0 0019 7.5c0-1.255-.434-2.443-1.18-3.5A7.968 7.968 0 0015.5 4z"/>
              </svg>
              <span>Manajemen Konten</span>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Bank Soal
            </h1>
            <p class="text-gray-600 mt-2">Kelola soal-soal untuk semua ujian dan kelas</p>
          </div>
          <button
            on:click={openImportModal}
            class="group px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <svg class="w-5 h-5 mr-2 inline group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Pertanyaan
          </button>
        </div>
      </div>

      <!-- Filters and Search -->
      <div class="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Filter Kelas</label>
            <select 
              bind:value={filterByClass}
              on:change={handleFilterChange}
              class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            >
              <option value="">Semua Kelas</option>
              {#each kelas as k}
                <option value={k.id}>{k.nama_kelas}</option>
              {/each}
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Filter Ujian</label>
            <select
              bind:value={filterByExam}
              on:change={handleFilterChange}
              class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            >
              <option value="">Semua Ujian</option>
              {#each filteredExamsForFilter as exam}
                <option value={exam.id}>{exam.judul}</option>
              {/each}
            </select>
          </div>
          
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-2">Cari Soal</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                bind:value={searchQuery}
                placeholder="Cari berdasarkan teks soal atau ujian..."
                class="w-full pl-11 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>
        </div>
        
        <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
          <button
            on:click={() => openQuestionModal('add')}
            class="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 inline-flex items-center"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Tambah Soal
          </button>
        </div>
      </div>

      <!-- Questions Table -->
        <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
          <!-- Table header with info -->
          <div class="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-gray-50 to-white">
            <div>
              <h2 class="text-lg font-semibold text-gray-800">Daftar Soal</h2>
              <p class="text-sm text-gray-500 mt-0.5">
                Menampilkan {showingFrom}-{showingTo} dari {filteredQuestions.length} soal
              </p>
            </div>
            
            <!-- Entries per page selector -->
            <div class="flex items-center space-x-2">
              <label class="text-sm text-gray-600">Tampilkan:</label>
              <select
                bind:value={entriesPerPage}
                class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              >
                {#each entriesOptions as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
              <span class="text-sm text-gray-600">soal</span>
            </div>
          </div>

          <!-- Table -->
          {#if filteredQuestions.length === 0}
            <div class="p-12 text-center">
              <div class="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                <svg class="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
              </div>
              <h3 class="text-lg font-medium text-gray-900 mb-2">Belum ada soal</h3>
              <p class="text-gray-500">Silakan tambahkan soal menggunakan tombol "Tambah Soal" di atas.</p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">No</th>
                    <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Pertanyaan</th>
                    <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Kelas</th>
                    <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ujian</th>
                    <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">Tipe</th>
                    <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">Jawaban</th>
                    <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">Bobot</th>
                    <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-100">
                  {#each paginatedQuestions as question, idx}
                    <tr class="hover:bg-gray-50 transition-colors duration-150">
                      <td class="px-3 py-2 text-sm text-gray-500 text-center">
                        {startIndex + idx + 1}
                      </td>
                      <td class="px-4 py-2">
                        <div class="text-sm text-gray-900 truncate max-w-[250px]" title={question.teks_soal}>
                          {question.teks_soal}
                        </div>
                       </td>
                      <td class="px-3 py-2 text-center">
                        {#if question.nama_kelas}
                          <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                            {question.nama_kelas}
                          </span>
                        {:else}
                          <span class="text-xs text-gray-400">-</span>
                        {/if}
                       </td>
                      <td class="px-3 py-2 text-sm text-gray-600 truncate max-w-[150px]" title={question.ujian_judul}>
                        {question.ujian_judul || '-'}
                       </td>
                      <td class="px-3 py-2 text-center">
                        {#if question.tipe_soal === 'pilihan_ganda'}
                          <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">PG</span>
                        {:else if question.tipe_soal === 'essay'}
                          <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-700">ES</span>
                        {:else if question.tipe_soal === 'benar_salah'}
                          <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-100 text-cyan-700">B/S</span>
                        {:else if question.tipe_soal === 'multiple_answer'}
                          <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-pink-100 text-pink-700">MA</span>
                        {/if}
                       </td>
                      <td class="px-3 py-2 text-center text-xs font-mono">
                        <span class="text-purple-700">{question.kunci_jawaban || question.jawaban_benar_salah || question.jawaban_multiple || '-'}</span>
                       </td>
                      <td class="px-3 py-2 text-center text-xs font-medium text-orange-700">
                        {question.bobot || 1}
                       </td>
                      <td class="px-3 py-2 text-right">
                        <div class="flex justify-end gap-1">
                          <button
                            on:click={() => startEditQuestion(question)}
                            class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            on:click={() => deleteQuestion(question.id)}
                            class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
              <div class="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-gray-50">
                <div class="flex items-center space-x-2">
                  <button
                    on:click={() => currentPage = Math.max(1, currentPage - 1)}
                    disabled={currentPage === 1}
                    class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Prev
                  </button>
                  
                  <!-- Page numbers -->
                  <div class="flex items-center space-x-1">
                    {#each getPageNumbers() as page}
                      {#if page === '...'}
                        <span class="px-3 py-1.5 text-gray-500">...</span>
                      {:else}
                        <button
                          on:click={() => currentPage = page}
                          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 {currentPage === page ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}"
                        >
                          {page}
                        </button>
                      {/if}
                    {/each}
                  </div>
                  
                  <button
                    on:click={() => currentPage = Math.min(totalPages, currentPage + 1)}
                    disabled={currentPage === totalPages}
                    class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
                  </button>
                </div>
                
                <div class="text-sm text-gray-600">
                  Halaman {currentPage} dari {totalPages}
                </div>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </div>

  <!-- Question Modal (Add/Edit) -->
  {#if showQuestionModal}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in" on:click={closeQuestionModal} on:keydown={handleEscKey} role="dialog" aria-modal="true">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 animate-scale-in" on:click|stopPropagation on:keydown|stopPropagation>
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white rounded-t-2xl">
          <div class="flex items-center space-x-3">
            <div class="p-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl">
              {#if modalMode === 'edit'}
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              {:else}
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              {/if}
            </div>
            <h3 class="text-xl font-bold text-gray-800">
              {#if modalMode === 'edit'}
                Edit Soal
              {:else}
                Tambah Soal Baru
              {/if}
            </h3>
          </div>
          <button on:click={closeQuestionModal} class="text-gray-400 hover:text-gray-600 transition-colors hover:rotate-90 duration-200">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div class="space-y-5">
            <!-- Soal -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">
                Soal <span class="text-red-500">*</span>
              </label>
              <textarea
                class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Masukkan pertanyaan..."
                rows="3"
                value={newQuestion.teks_soal}
                on:input={(e) => handleInputChange(e, 'teks_soal')}
              ></textarea>
              
              <!-- Gambar Soal -->
              <div class="mt-3">
                <label class="block text-xs text-gray-500 mb-2">Gambar Soal (Opsional)</label>
                {#if previewImages.gambar_soal}
                  <div class="relative inline-block">
                    <img src={previewImages.gambar_soal} alt="Gambar Soal" class="h-32 w-auto rounded-xl border border-gray-200 shadow-sm" />
                    <button
                      type="button"
                      on:click={() => removeImage('gambar_soal')}
                      class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-md"
                      title="Hapus gambar"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                {:else}
                  <label class="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div class="text-center">
                      <svg class="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span class="text-xs text-gray-500 mt-1">Upload Gambar Soal</span>
                    </div>
                    <input type="file" class="hidden" accept="image/*" on:change={(e) => handleImageUpload(e, 'gambar_soal')} />
                  </label>
                {/if}
              </div>
            </div>

            <!-- Tipe Soal -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Tipe Soal <span class="text-red-500">*</span></label>
              <select
                class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                value={newQuestion.tipe_soal}
                on:change={(e) => handleInputChange(e, 'tipe_soal')}
              >
                <option value="pilihan_ganda">Pilihan Ganda</option>
                <option value="essay">Essay</option>
                <option value="benar_salah">Benar/Salah</option>
                <option value="multiple_answer">Multiple Answer (Lebih dari satu jawaban)</option>
              </select>
            </div>

            <!-- Pilihan Jawaban (for Pilihan Ganda, Multiple Answer) -->
            {#if newQuestion.tipe_soal === 'pilihan_ganda' || newQuestion.tipe_soal === 'multiple_answer'}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Pilihan A -->
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-gray-700">Pilihan A <span class="text-red-500">*</span></label>
                  <input
                    type="text"
                    class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    placeholder="Pilihan A"
                    value={newQuestion.pilihan_a}
                    on:input={(e) => handleInputChange(e, 'pilihan_a')}
                  />
                  {#if previewImages.gambar_pilihan_a}
                    <div class="relative inline-block mt-2">
                      <img src={previewImages.gambar_pilihan_a} alt="Gambar Pilihan A" class="h-16 w-auto rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        on:click={() => removeImage('gambar_pilihan_a')}
                        class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                        title="Hapus gambar"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  {:else}
                    <label class="flex items-center justify-center w-full h-10 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors mt-2">
                      <div class="text-center">
                        <svg class="mx-auto h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input type="file" class="hidden" accept="image/*" on:change={(e) => handleImageUpload(e, 'gambar_pilihan_a')} />
                    </label>
                  {/if}
                </div>
                
                <!-- Pilihan B -->
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-gray-700">Pilihan B <span class="text-red-500">*</span></label>
                  <input
                    type="text"
                    class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    placeholder="Pilihan B"
                    value={newQuestion.pilihan_b}
                    on:input={(e) => handleInputChange(e, 'pilihan_b')}
                  />
                  {#if previewImages.gambar_pilihan_b}
                    <div class="relative inline-block mt-2">
                      <img src={previewImages.gambar_pilihan_b} alt="Gambar Pilihan B" class="h-16 w-auto rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        on:click={() => removeImage('gambar_pilihan_b')}
                        class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                        title="Hapus gambar"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  {:else}
                    <label class="flex items-center justify-center w-full h-10 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors mt-2">
                      <div class="text-center">
                        <svg class="mx-auto h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input type="file" class="hidden" accept="image/*" on:change={(e) => handleImageUpload(e, 'gambar_pilihan_b')} />
                    </label>
                  {/if}
                </div>
                
                <!-- Pilihan C -->
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-gray-700">Pilihan C <span class="text-red-500">*</span></label>
                  <input
                    type="text"
                    class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    placeholder="Pilihan C"
                    value={newQuestion.pilihan_c}
                    on:input={(e) => handleInputChange(e, 'pilihan_c')}
                  />
                  {#if previewImages.gambar_pilihan_c}
                    <div class="relative inline-block mt-2">
                      <img src={previewImages.gambar_pilihan_c} alt="Gambar Pilihan C" class="h-16 w-auto rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        on:click={() => removeImage('gambar_pilihan_c')}
                        class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                        title="Hapus gambar"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  {:else}
                    <label class="flex items-center justify-center w-full h-10 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors mt-2">
                      <div class="text-center">
                        <svg class="mx-auto h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input type="file" class="hidden" accept="image/*" on:change={(e) => handleImageUpload(e, 'gambar_pilihan_c')} />
                    </label>
                  {/if}
                </div>
                
                <!-- Pilihan D -->
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-gray-700">Pilihan D <span class="text-red-500">*</span></label>
                  <input
                    type="text"
                    class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    placeholder="Pilihan D"
                    value={newQuestion.pilihan_d}
                    on:input={(e) => handleInputChange(e, 'pilihan_d')}
                  />
                  {#if previewImages.gambar_pilihan_d}
                    <div class="relative inline-block mt-2">
                      <img src={previewImages.gambar_pilihan_d} alt="Gambar Pilihan D" class="h-16 w-auto rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        on:click={() => removeImage('gambar_pilihan_d')}
                        class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                        title="Hapus gambar"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  {:else}
                    <label class="flex items-center justify-center w-full h-10 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors mt-2">
                      <div class="text-center">
                        <svg class="mx-auto h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input type="file" class="hidden" accept="image/*" on:change={(e) => handleImageUpload(e, 'gambar_pilihan_d')} />
                    </label>
                  {/if}
                </div>
                
                <!-- Pilihan E -->
                <div class="md:col-span-2 space-y-2">
                  <label class="block text-sm font-medium text-gray-700">Pilihan E (Opsional)</label>
                  <input
                    type="text"
                    class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    placeholder="Pilihan E"
                    value={newQuestion.pilihan_e}
                    on:input={(e) => handleInputChange(e, 'pilihan_e')}
                  />
                  {#if previewImages.gambar_pilihan_e}
                    <div class="relative inline-block mt-2">
                      <img src={previewImages.gambar_pilihan_e} alt="Gambar Pilihan E" class="h-16 w-auto rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        on:click={() => removeImage('gambar_pilihan_e')}
                        class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                        title="Hapus gambar"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  {:else}
                    <label class="flex items-center justify-center w-full h-10 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors mt-2">
                      <div class="text-center">
                        <svg class="mx-auto h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input type="file" class="hidden" accept="image/*" on:change={(e) => handleImageUpload(e, 'gambar_pilihan_e')} />
                    </label>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- Essay Answer Field -->
            {#if newQuestion.tipe_soal === 'essay'}
              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-2">Jawaban Contoh (Pedoman Penskoran) <span class="text-red-500">*</span></label>
                <textarea
                  class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder="Masukkan jawaban contoh atau pedoman penskoran..."
                  rows="4"
                  value={newQuestion.jawaban_essay}
                  on:input={(e) => handleInputChange(e, 'jawaban_essay')}
                ></textarea>
              </div>
            {/if}

            <!-- Jawaban, Kelas, Ujian -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <!-- Jawaban for Pilihan Ganda -->
              {#if newQuestion.tipe_soal === 'pilihan_ganda'}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Jawaban Benar <span class="text-red-500">*</span></label>
                  <select
                    class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    value={newQuestion.kunci_jawaban}
                    on:change={(e) => handleInputChange(e, 'kunci_jawaban')}
                  >
                    <option value="">Pilih Jawaban</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                  </select>
                </div>
              {/if}
              
              <!-- Jawaban for Benar/Salah -->
              {#if newQuestion.tipe_soal === 'benar_salah'}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Jawaban Benar <span class="text-red-500">*</span></label>
                  <select
                    class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    value={newQuestion.jawaban_benar_salah}
                    on:change={(e) => handleInputChange(e, 'jawaban_benar_salah')}
                  >
                    <option value="">Pilih Jawaban</option>
                    <option value="benar">Benar</option>
                    <option value="salah">Salah</option>
                  </select>
                </div>
              {/if}
              
              <!-- Jawaban for Multiple Answer -->
              {#if newQuestion.tipe_soal === 'multiple_answer'}
                <div class="md:col-span-3">
                  <label class="block text-sm font-medium text-gray-700 mb-3">Jawaban Benar (Pilih lebih dari satu) <span class="text-red-500">*</span></label>
                  <div class="flex flex-wrap gap-6">
                    <label class="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                        checked={newQuestion.jawaban_multiple.includes('A')}
                        on:change={(e) => {
                          if (e.target.checked) {
                            newQuestion.jawaban_multiple = [...newQuestion.jawaban_multiple, 'A'];
                          } else {
                            newQuestion.jawaban_multiple = newQuestion.jawaban_multiple.filter(a => a !== 'A');
                          }
                        }}
                      />
                      <span class="text-gray-700">Pilihan A</span>
                    </label>
                    <label class="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                        checked={newQuestion.jawaban_multiple.includes('B')}
                        on:change={(e) => {
                          if (e.target.checked) {
                            newQuestion.jawaban_multiple = [...newQuestion.jawaban_multiple, 'B'];
                          } else {
                            newQuestion.jawaban_multiple = newQuestion.jawaban_multiple.filter(a => a !== 'B');
                          }
                        }}
                      />
                      <span class="text-gray-700">Pilihan B</span>
                    </label>
                    <label class="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                        checked={newQuestion.jawaban_multiple.includes('C')}
                        on:change={(e) => {
                          if (e.target.checked) {
                            newQuestion.jawaban_multiple = [...newQuestion.jawaban_multiple, 'C'];
                          } else {
                            newQuestion.jawaban_multiple = newQuestion.jawaban_multiple.filter(a => a !== 'C');
                          }
                        }}
                      />
                      <span class="text-gray-700">Pilihan C</span>
                    </label>
                    <label class="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                        checked={newQuestion.jawaban_multiple.includes('D')}
                        on:change={(e) => {
                          if (e.target.checked) {
                            newQuestion.jawaban_multiple = [...newQuestion.jawaban_multiple, 'D'];
                          } else {
                            newQuestion.jawaban_multiple = newQuestion.jawaban_multiple.filter(a => a !== 'D');
                          }
                        }}
                      />
                      <span class="text-gray-700">Pilihan D</span>
                    </label>
                    <label class="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                        checked={newQuestion.jawaban_multiple.includes('E')}
                        on:change={(e) => {
                          if (e.target.checked) {
                            newQuestion.jawaban_multiple = [...newQuestion.jawaban_multiple, 'E'];
                          } else {
                            newQuestion.jawaban_multiple = newQuestion.jawaban_multiple.filter(a => a !== 'E');
                          }
                        }}
                      />
                      <span class="text-gray-700">Pilihan E</span>
                    </label>
                  </div>
                </div>
              {/if}

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Kelas</label>
                <select
                  class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  bind:value={newQuestion.kelas_id}
                >
                  <option value="">Pilih Kelas</option>
                  {#each kelas as k}
                    <option value={k.id}>{k.nama_kelas}</option>
                  {/each}
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Ujian</label>
                <select
                  class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  bind:value={newQuestion.ujian_id}
                >
                  <option value="">Pilih Ujian</option>
                  {#each filteredExamsForQuestion as exam}
                    <option value={exam.id}>{exam.judul}</option>
                  {/each}
                </select>
              </div>
            </div>

            <!-- Bobot Nilai -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Bobot Nilai</label>
              <input
                type="number"
                class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Bobot nilai soal"
                min="1"
                value={newQuestion.bobot}
                on:input={(e) => handleInputChange(e, 'bobot')}
              />
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50 rounded-b-2xl">
          <button
            on:click={closeQuestionModal}
            class="px-5 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
          >
            Batal
          </button>
          {#if modalMode === 'edit'}
            <button
              on:click={updateQuestion}
              class="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !newQuestion.teks_soal ||
                (newQuestion.tipe_soal === 'pilihan_ganda' && (!newQuestion.pilihan_a || !newQuestion.pilihan_b || !newQuestion.pilihan_c || !newQuestion.pilihan_d || !newQuestion.kunci_jawaban)) ||
                (newQuestion.tipe_soal === 'essay' && !newQuestion.jawaban_essay) ||
                (newQuestion.tipe_soal === 'benar_salah' && !newQuestion.jawaban_benar_salah) ||
                (newQuestion.tipe_soal === 'multiple_answer' && (!newQuestion.pilihan_a || !newQuestion.pilihan_b || !newQuestion.pilihan_c || !newQuestion.pilihan_d || !newQuestion.jawaban_multiple || newQuestion.jawaban_multiple.length === 0))
              }
            >
              Perbarui Soal
            </button>
          {:else}
            <button
              on:click={addQuestion}
              class="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !newQuestion.teks_soal ||
                (newQuestion.tipe_soal === 'pilihan_ganda' && (!newQuestion.pilihan_a || !newQuestion.pilihan_b || !newQuestion.pilihan_c || !newQuestion.pilihan_d || !newQuestion.kunci_jawaban)) ||
                (newQuestion.tipe_soal === 'essay' && !newQuestion.jawaban_essay) ||
                (newQuestion.tipe_soal === 'benar_salah' && !newQuestion.jawaban_benar_salah) ||
                (newQuestion.tipe_soal === 'multiple_answer' && (!newQuestion.pilihan_a || !newQuestion.pilihan_b || !newQuestion.pilihan_c || !newQuestion.pilihan_d || !newQuestion.jawaban_multiple || newQuestion.jawaban_multiple.length === 0))
              }
            >
              Simpan Soal
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Confirmation Modal -->
  {#if showConfirmModal}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
        <div class="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
          <h3 class="text-lg font-semibold text-white">Konfirmasi</h3>
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
            <button on:click={hideConfirmation} class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors">
              Batal
            </button>
            <button on:click={confirmAction} class="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
              Ya, Lanjutkan
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Import Questions Modal -->
  {#if showImportModal}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
        <div class="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-semibold text-white">Import Pertanyaan</h3>
            <button on:click={hideImportModal} class="text-white/80 hover:text-white transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Pilih Kelas</label>
            <select
              bind:value={importKelasId}
              class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            >
              <option value="">-- Pilih Kelas --</option>
              {#each kelas as k}
                <option value={k.id}>{k.nama_kelas}</option>
              {/each}
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Pilih Ujian</label>
            <select
              bind:value={importUjianId}
              class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              disabled={!importKelasId}
            >
              <option value="">-- Pilih Ujian --</option>
              {#each filteredExamsForImport as exam}
                <option value={exam.id}>{exam.judul}</option>
              {/each}
            </select>
            {#if !importKelasId}
              <p class="text-xs text-gray-500 mt-1">Pilih kelas terlebih dahulu untuk menampilkan ujian</p>
            {/if}
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">File Excel</label>
            <input
              type="file"
              on:change={handleQuestionsFile}
              class="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-colors"
              accept=".xlsx,.xls,.csv"
            />
            <p class="text-xs text-gray-500 mt-2">Template perlu kolom: pertanyaan, pilihan_a, pilihan_b, pilihan_c, pilihan_d, pilihan_e, kunci_jawaban</p>
          </div>

          <button on:click={handleImportQuestions} class="w-full px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105">
            Import Pertanyaan
          </button>
          
          <button on:click={() => handleExport('/api/bulk/template/questions')} class="w-full text-center text-sm text-indigo-600 hover:text-indigo-700 hover:underline transition-colors mt-2">
            Download Template Excel →
          </button>
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
  
  .tooltip {
    position: relative;
  }
  
  .tooltip:hover::after {
    content: attr(title);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    background-color: #1f2937;
    color: white;
    font-size: 11px;
    border-radius: 6px;
    white-space: nowrap;
    margin-bottom: 8px;
    z-index: 50;
    pointer-events: none;
  }
</style>