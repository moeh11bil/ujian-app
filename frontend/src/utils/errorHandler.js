/**
 * Global Error Handler
 * Catches unhandled errors and displays user-friendly error page
 */

import { writable } from 'svelte/store';

// Global error store
export const globalError = writable(null);

// Track if we're showing an error
let hasFatalError = false;

/**
 * Log error to console and potentially a monitoring service
 */
export function logError(type, error, info = {}) {
  const errorData = {
    type,
    message: error.message || error,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...info
  };

  console.error(`[${type}]`, errorData);
  
  // You could send to Sentry or similar here
  
  return errorData;
}

/**
 * Handle fatal errors that can't be recovered from
 */
export function handleFatalError(error, info = {}) {
  if (hasFatalError) return; // Prevent multiple error screens
  hasFatalError = true;
  
  const errorInfo = logError('FatalError', error, info);
  
  globalError.set({
    hasError: true,
    error: error,
    message: 'Terjadi kesalahan fatal pada aplikasi',
    ...errorInfo
  });
  
  // Log to console in development
  if (import.meta.env.VITE_APP_ENV === 'development') {
    console.error('💥 Fatal Error:', error);
    console.error('Error Info:', info);
  }
}

/**
 * Reset error state (for recovery)
 */
export function resetError() {
  hasFatalError = false;
  globalError.set(null);
}

/**
 * Wrap async operations with error handling
 */
export async function withErrorHandling(asyncFn, errorHandler) {
  try {
    return await asyncFn();
  } catch (error) {
    if (errorHandler) {
      errorHandler(error);
    } else {
      logError('AsyncOperation', error);
      console.error('Unhandled error:', error);
    }
    throw error;
  }
}

// Listen for unhandled rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    logError('UnhandledRejection', event.reason);
    console.error('Unhandled Promise Rejection:', event.reason);
  });

  window.addEventListener('error', (event) => {
    // Don't handle errors from third-party scripts
    if (event.filename && !event.filename.includes(window.location.hostname)) {
      return;
    }
    
    logError('WindowError', event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });
}
