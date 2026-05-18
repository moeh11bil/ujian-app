import { writable } from 'svelte/store';
import { navigate } from 'svelte-routing';

const initialPath = typeof window !== 'undefined' ? window.location.pathname : '/';
export const currentPath = writable(initialPath);

// Function to update the path
export function updatePath(newPath) {
  currentPath.set(newPath);
}

// Wrapper for svelte-routing navigate that also updates our store
export function navigateTo(path, options = {}) {
  navigate(path, options);
  currentPath.set(path);
}

// Listen to browser navigation events
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    currentPath.set(window.location.pathname);
  });
}