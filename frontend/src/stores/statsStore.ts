import { writable } from 'svelte/store';

// Global loading state
export const isLoading = writable(false);
export const error = writable<string | null>(null);

// Stats store
interface DashboardStats {
  totalStudents: number;
  totalExams: number;
  activeExams: number;
  recentResults: any[];
}

export const dashboardStats = writable<DashboardStats>({
  totalStudents: 0,
  totalExams: 0,
  activeExams: 0,
  recentResults: []
});
