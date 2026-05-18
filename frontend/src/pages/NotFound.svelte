<script>
  function goHome() {
    window.location.href = '/';
  }
</script>

<div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
  <div class="max-w-md text-center">
    <div class="text-9xl font-bold text-gray-700 mb-4">404</div>
    <h1 class="text-3xl font-bold text-gray-800 mb-4">Halaman Tidak Ditemukan</h1>
    <p class="text-gray-600 mb-8">
      Maaf, halaman yang Anda cari tidak dapat ditemukan. Mungkin telah dipindahkan atau dihapus.
    </p>
    <button 
      on:click={goHome}
      class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded"
    >
      Kembali ke Beranda
    </button>
  </div>
</div>