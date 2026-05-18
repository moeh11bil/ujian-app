# Form Validation Implementation Guide

## Completed Forms with Validation

### 1. Login Form (`pages/Login.svelte`)
- ✅ Email validation (format check)
- ✅ Password validation (min 6 chars)
- ✅ Real-time validation error clearing
- ✅ Visual feedback (red borders on invalid fields)

### 2. Validation Utilities (`utils/formValidation.js`)
The following validation functions are available:

| Function | Purpose | Used In |
|----------|---------|---------|
| `validateEmail` | Email format check | Login, Register, Profile |
| `validatePassword` | Password length check | Login, Register |
| `validateName` | Name format & length | Register, Profile |
| `validateRequired` | Required field check | All forms |
| `validateRange` | Number range validation | Exam duration, passing grade |
| `validateLength` | String length validation | Questions, Forum, Announcements |
| `validateLoginForm` | Complete login validation | Login.svelte |
| `validateRegisterForm` | Complete register validation | Register.svelte |
| `validateExamForm` | Exam form validation | Exams.svelte |
| `validateQuestionForm` | Question form validation | Questions.svelte |
| `validateClassForm` | Class form validation | Classes.svelte |
| `validateProfileForm` | Profile form validation | Profile.svelte |
| `validateResetRequestForm` | Reset request validation | ResetRequests.svelte |
| `validateForumTopicForm` | Forum topic validation | Forum.svelte |

## Forms That Need Validation Updates

The following forms should be updated to use the validation utilities:

### 3. Register Form (`pages/Register.svelte`)
**Status**: ⏳ Pending Update
**Required Fields**:
- nama (name validation)
- email (email validation)
- password (password validation)
- confirmPassword (match password)
- role (required, enum check)
- kelas_id (required for siswa role)

### 4. Profile Form (`pages/Profile.svelte`)
**Status**: ⏳ Pending Update
**Required Fields**:
- nama (name validation)
- email (email validation)
- profile_picture (file type & size validation)

### 5. Exam Form (`pages/Exams.svelte`)
**Status**: ⏳ Pending Update
**Required Fields**:
- judul (length 5-200 chars)
- durasi (range 1-480 minutes)
- passing_grade (range 0-100)
- waktu_mulai/waktu_selesai (date validation)

### 6. Question Form (`pages/Questions.svelte`, `ExamQuestionsManager.svelte`)
**Status**: ⏳ Pending Update
**Required Fields**:
- teks_soal (length 10-5000 chars)
- tipe_soal (required, enum check)
- pilihan_a/b/c/d/e (required for pilihan_ganda)
- kunci_jawaban (valid answer key)
- gambar files (file type & size validation)

### 7. Class Form (`pages/Classes.svelte`)
**Status**: ⏳ Pending Update
**Required Fields**:
- nama_kelas (length 2-100 chars)
- deskripsi (max 500 chars, optional)

## How to Add Validation to Forms

### Example: Adding Validation to Register Form

```javascript
import { validateRegisterForm } from '../utils/formValidation.js';

let formData = {
  nama: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'siswa',
  kelas_id: null
};
let validationErrors = {};

async function handleRegister() {
  // Clear previous errors
  validationErrors = {};
  
  // Validate form
  const validation = validateRegisterForm(formData);
  if (!validation.valid) {
    validationErrors = validation.errors;
    return;
  }
  
  // Proceed with registration...
}

function handleInput(fieldName) {
  if (validationErrors[fieldName]) {
    validationErrors = { ...validationErrors };
    delete validationErrors[fieldName];
  }
}
```

```svelte
<input 
  bind:value={formData.email} 
  on:input={() => handleInput('email')}
  class="input-field {validationErrors.email ? 'border-red-500' : ''}"
/>
{#if validationErrors.email}
  <p class="text-sm text-red-600">{validationErrors.email}</p>
{/if}
```

## Best Practices

1. **Always validate on submit** - Client-side validation is for UX, not security
2. **Show clear error messages** - Use Bahasa Indonesia, be specific
3. **Clear errors on input** - Don't make users wait until submit to see errors cleared
4. **Visual feedback** - Use red borders for invalid fields
5. **Validate early, validate often** - Better UX with real-time validation
6. **Backend validation is still required** - Client validation can be bypassed

## Next Steps

- [ ] Update Register.svelte with validation
- [ ] Update Profile.svelte with validation
- [ ] Update Exams.svelte with validation
- [ ] Update Questions.svelte with validation
- [ ] Update Classes.svelte with validation
- [ ] Add file upload validation (images, documents)
- [ ] Add real-time validation (on:input events)
- [ ] Add accessibility improvements (ARIA labels for errors)
