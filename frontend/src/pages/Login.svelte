<script lang="ts">
  import { onMount } from 'svelte';
  import { login } from '$lib/api';
  import { validateLoginForm } from '../utils/formValidation.js';
  import { authActions, user, isAuthenticated } from '../stores/authStore';
  import toast from '$lib/toast';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import Card from '../components/ui/Card.svelte';

  let formData = {
    email: '',
    password: ''
  };
  let loading = false;
  let error = '';
  let validationErrors = {};

  // Show logout success toast and redirect logged-in users
  onMount(() => {
    if (window.location.search.includes('logout=1')) {
      toast.success('Anda telah berhasil logout');
      window.history.replaceState({}, '', '/login');
    }

    if ($isAuthenticated && $user) {
      if ($user.role === 'admin' || $user.role === 'guru') {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/exam-list';
      }
    }
  });

  async function handleLogin() {
    // Clear previous errors
    error = '';
    validationErrors = {};
    
    // Validate form
    const validation = validateLoginForm(formData);
    if (!validation.valid) {
      validationErrors = validation.errors;
      error = Object.values(validation.errors).join(', ');
      return;
    }

    loading = true;

    try {
      const data = (await login(formData)) as any;

      // Store token and user in store
      authActions.login(data.token);

      // Redirect based on role
      if (data.user.role === 'admin' || data.user.role === 'guru') {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/exam-list';
      }
    } catch (err: any) {
      const message = err.message || '';
      if (message.includes('Invalid credentials')) {
        error = 'NISN/Email atau kata sandi yang Anda masukkan salah.';
      } else {
        error = 'Terjadi kesalahan sistem atau koneksi. Mohon coba lagi.';
      }
      console.error('Login error:', err);
    } finally {
      loading = false;
    }
  }
  function handleInput(fieldName) {
    if (validationErrors[fieldName]) {
      validationErrors = { ...validationErrors };
      delete validationErrors[fieldName];
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
  <div class="w-full max-w-md">
    <div class="text-center mb-10">
      <h1 class="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Ujian Online</h1>
      <p class="mt-2 text-gray-600">Masuk ke akun Anda untuk melanjutkan</p>
    </div>

    <Card>
      <div slot="header" class="text-center">
        <h2 class="text-2xl font-bold text-gray-900">Masuk ke Akun</h2>
        <p class="mt-1 text-sm text-gray-600">Silakan masukkan NISN (siswa) atau email (admin/guru) dan password Anda</p>
      </div>

      <form class="space-y-6" on:submit|preventDefault={handleLogin}>
        <Input
          label="NISN / Email"
          id="email-address"
          name="email"
          type="text"
          autocomplete="username"
          bind:value={formData.email}
          on:focus={() => handleInput('email')}
          error={validationErrors.email}
          required
          placeholder="masukkan NISN atau email"
        />

        <Input
          label="Kata Sandi"
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          bind:value={formData.password}
          on:focus={() => handleInput('password')}
          error={validationErrors.password}
          required
          placeholder="masukkan kata sandi Anda"
        />

        {#if error}
          <div class="rounded-lg bg-red-50 border border-red-200 p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        {/if}

        <Button
          type="submit"
          loading={loading}
          className="w-full py-3.5 text-base block"
        >
          <span slot="loading">Sedang Masuk...</span>
          <span>Masuk ke Akun</span>
        </Button>
      </form>
    </Card>
  </div>
</div>
