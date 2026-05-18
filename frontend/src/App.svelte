<script lang="ts">
  import { Router, Route } from 'svelte-routing';
  import { onMount } from 'svelte';
  import { authActions } from './stores/authStore';
  import { currentPath } from './stores/routeStore';

  import Login from './pages/Login.svelte';
  import NotFound from './pages/NotFound.svelte';
  import ProtectedRoute from './components/ProtectedRoute.svelte';
  import AdminGuruLayout from './layouts/AdminGuruLayout.svelte';
  import RouteWatcher from './components/RouteWatcher.svelte';
  import ToastContainer from './components/ToastContainer.svelte';

  onMount(() => {
    authActions.initialize();
  });

  // Check if current route is admin route
  $: isAdminRoute = $currentPath.startsWith('/dashboard') || 
                   $currentPath.startsWith('/student') || 
                   $currentPath.startsWith('/grading') ||
                   $currentPath.startsWith('/bank-soal');
</script>

<Router>
  <ToastContainer />
  <RouteWatcher>
    <Route path="/" component={Login} />
    <Route path="/login" component={Login} />

    {#if isAdminRoute}
    <AdminGuruLayout>
       <!-- Admin Routes -->
       <Route path="/dashboard">
         <ProtectedRoute component={async () => (await import('./pages/admin/Dashboard.svelte')).default} allowedRoles={['admin', 'guru']} />
       </Route>
       <Route path="/dashboard/students">
         <ProtectedRoute component={async () => (await import('./pages/admin/Students.svelte')).default} allowedRoles={['admin', 'guru']} />
       </Route>
       <Route path="/dashboard/questions">
         <ProtectedRoute component={async () => (await import('./pages/admin/UnifiedQuestionBank.svelte')).default} allowedRoles={['admin', 'guru']} />
       </Route>
       <Route path="/dashboard/exams">
         <ProtectedRoute component={async () => (await import('./pages/admin/Exams.svelte')).default} allowedRoles={['admin', 'guru']} />
       </Route>
       <Route path="/dashboard/results">
         <ProtectedRoute component={async () => (await import('./pages/admin/Results.svelte')).default} allowedRoles={['admin', 'guru']} />
       </Route>
       <Route path="/dashboard/classes">
         <ProtectedRoute component={async () => (await import('./pages/admin/Classes.svelte')).default} allowedRoles={['admin', 'guru']} />
       </Route>
       <Route path="/dashboard/exams/:id/questions">
         <ProtectedRoute component={async () => (await import('./pages/admin/DashboardExamQuestions.svelte')).default} allowedRoles={['admin', 'guru']} />
       </Route>
       <Route path="/dashboard/exams/:id/preview" let:params>
         <ProtectedRoute component={async () => (await import('./pages/admin/ExamPreview.svelte')).default} allowedRoles={['admin', 'guru']} id={params.id} />
       </Route>
       <Route path="/dashboard/exam-monitor">
         <ProtectedRoute component={async () => (await import('./pages/admin/ExamMonitor.svelte')).default} allowedRoles={['admin', 'guru']} />
       </Route>
       <Route path="/dashboard/grading-queue">
         <ProtectedRoute component={async () => (await import('./pages/admin/GradingQueue.svelte')).default} allowedRoles={['admin', 'guru']} />
       </Route>
       <Route path="/grading/:id" let:params>
         <ProtectedRoute component={async () => (await import('./pages/admin/GradingInterface.svelte')).default} allowedRoles={['admin', 'guru']} id={params.id} />
       </Route>
       <Route path="/grading-detail/:id" let:params>
         <ProtectedRoute component={async () => (await import('./pages/admin/GradingDetail.svelte')).default} allowedRoles={['admin', 'guru']} id={params.id} />
       </Route>
       <Route path="/bank-soal">
         <ProtectedRoute component={async () => (await import('./pages/admin/UnifiedQuestionBank.svelte')).default} allowedRoles={['admin', 'guru']} />
       </Route>
       <Route path="/dashboard/exam-cards">
          <ProtectedRoute component={async () => (await import('./pages/admin/ExamCards.svelte')).default} allowedRoles={['admin', 'guru']} />
        </Route>
       <Route path="/dashboard/backup">
          <ProtectedRoute component={async () => (await import('./pages/admin/BackupRestore.svelte')).default} allowedRoles={['admin']} />
        </Route>
       <Route path="/student/:id" let:params>
         <ProtectedRoute component={async () => (await import('./pages/admin/StudentDetail.svelte')).default} allowedRoles={['admin', 'guru']} id={params.id} />
       </Route>
    </AdminGuruLayout>
    {/if}

    <!-- Student Routes (No Admin Layout) -->
    <Route path="/hasil">
      <ProtectedRoute component={async () => (await import('./pages/student/StudentResults.svelte')).default} allowedRoles={['siswa']} />
    </Route>
    <Route path="/exam-list">
      <ProtectedRoute component={async () => (await import('./pages/student/ExamList.svelte')).default} allowedRoles={['siswa']} />
    </Route>
    <Route path="/exam/:id" let:params>
      <ProtectedRoute component={async () => (await import('./pages/student/ExamInterface.svelte')).default} allowedRoles={['siswa']} id={params.id} />
    </Route>

    <Route path="*" component={NotFound} />
  </RouteWatcher>
</Router>
