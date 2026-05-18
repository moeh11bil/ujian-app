export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    errors?: any[];
    details?: string;
    stack?: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: number;
    nama: string;
    email: string;
    role: string;
    kelas_id?: number | null;
  };
}
