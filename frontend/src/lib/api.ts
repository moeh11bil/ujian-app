import { authActions } from '../stores/authStore';
import toast from './toast';
import type { ApiSuccessResponse, LoginResponse } from '../types/api';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Track active requests for aborting
const activeRequests = new Map<string, AbortController>();

class ApiClient {
  private async getHeaders(options: RequestInit = {}): Promise<HeadersInit> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = await this.getHeaders(options);
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
    const requestKey = `${options.method || 'GET'}:${url}`;

    // Abort previous request with same key
    if (activeRequests.has(requestKey)) {
      activeRequests.get(requestKey)?.abort();
      activeRequests.delete(requestKey);
    }

    const controller = new AbortController();
    activeRequests.set(requestKey, controller);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      activeRequests.delete(requestKey);

      if (response.status === 401 && !url.includes('/auth/login')) {
        authActions.logout();
        toast.error('Sesi Anda telah habis. Silakan login kembali.');
        throw new Error('Session expired.');
      }

      const contentType = response.headers.get('Content-Type') || '';
      
      if (!response.ok) {
        let errorMessage = `Error ${response.status}`;
        if (contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || errorData.message || errorMessage;
          } catch {
            // ignore parse error
          }
        }
        
        // Only show toast if not a controlled auth error
        if (errorMessage !== 'Invalid credentials') {
          toast.error(errorMessage);
        }
        throw new Error(errorMessage);
      }

      if (response.status === 204) {
        return null as any;
      }

      if (contentType.includes('application/pdf') || contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        return this.handleDownload(response) as any;
      }

      return response.json();
    } catch (error: any) {
      activeRequests.delete(requestKey);
      
      if (error.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      
      if (
        !error.message.includes('Session expired') && 
        !error.message.includes('Error') && 
        !error.message.includes('cancelled') &&
        !error.message.includes('Invalid credentials')
      ) {
        toast.error('Koneksi ke server gagal.');
      }
      throw error;
    }
  }

  private async handleDownload(response: Response): Promise<void> {
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'download';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = decodeURIComponent(filenameMatch[1].replace(/"/g, ''));
      }
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
    });
  }

  put<T>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  patch<T>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }
}

export const apiClient = new ApiClient();

// Auth
export const login = (credentials: any) => apiClient.post<LoginResponse>('/auth/login', credentials);

// Profile
// Exam Cards
export const downloadStudentExamCard = (studentId: number | string, includePassword = true) => 
  apiClient.get(`/exam-cards/student/${studentId}?include_password=${includePassword}`);
export const downloadClassExamCards = (kelasId: number | string, includePassword = false) => 
  apiClient.get(`/exam-cards/class/${kelasId}?include_password=${includePassword}`);
export const downloadAllExamCards = (includePassword = false) => 
  apiClient.get(`/exam-cards/all?include_password=${includePassword}`);
export const exportStudentsWithPasswords = () => 
  apiClient.get('/exam-cards/export-students-with-passwords');
export const getExamCardInfo = (kelasId: number | string) => 
  apiClient.get(`/exam-cards/${kelasId}/info`);

// Backward compatibility helper
export const fetchWithAuth = <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
  const method = (options.method || 'GET').toUpperCase();
  if (method === 'GET') return apiClient.get<T>(url, options);
  if (method === 'POST') return apiClient.post<T>(url, options.body, options);
  if (method === 'PUT') return apiClient.put<T>(url, options.body, options);
  if (method === 'DELETE') return apiClient.delete<T>(url, options);
  if (method === 'PATCH') return apiClient.patch<T>(url, options.body, options);
  return apiClient.get<T>(url, options);
};

export const apiFetch = <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
  let apiUrl = url;
  if (url.startsWith('/api/')) {
    apiUrl = url.substring(4);
  }
  return fetchWithAuth<T>(apiUrl, options);
};
