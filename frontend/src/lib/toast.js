// Toast notification utility
import { onDestroy } from 'svelte';

// Store active toasts
let toasts = [];
let toastId = 0;

// Event dispatcher for toast events
const subscribers = [];

function subscribe(subscriber) {
  subscribers.push(subscriber);
  subscriber(toasts);
  
  return () => {
    const index = subscribers.indexOf(subscriber);
    if (index > -1) {
      subscribers.splice(index, 1);
    }
  };
}

function notify(message, type = 'info', duration = 5000) {
  const id = ++toastId;
  const toast = {
    id,
    message,
    type, // 'success', 'error', 'warning', 'info'
    duration
  };

  toasts = [...toasts, toast];
  subscribers.forEach(subscriber => subscriber(toasts));

  // Auto-remove toast after duration
  if (duration > 0) {
    setTimeout(() => {
      remove(id);
    }, duration);
  }

  return id;
}

function remove(id) {
  toasts = toasts.filter(t => t.id !== id);
  subscribers.forEach(subscriber => subscriber(toasts));
}

function success(message, duration = 5000) {
  return notify(message, 'success', duration);
}

function error(message, duration = 5000) {
  return notify(message, 'error', duration);
}

function warning(message, duration = 5000) {
  return notify(message, 'warning', duration);
}

function info(message, duration = 5000) {
  return notify(message, 'info', duration);
}

function dismiss(id) {
  remove(id);
}

// Backward compatibility wrapper for toast.push() pattern
function push(toastObj) {
  const { type = 'info', message, duration = 5000 } = toastObj;
  
  switch (type) {
    case 'success':
      return success(message, duration);
    case 'error':
      return error(message, duration);
    case 'warning':
      return warning(message, duration);
    case 'info':
    default:
      return info(message, duration);
  }
}

export default {
  subscribe,
  success,
  error,
  warning,
  info,
  notify,
  dismiss,
  push  // Backward compatibility
};