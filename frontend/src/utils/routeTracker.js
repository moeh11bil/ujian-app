import { updatePath } from '../stores/routeStore.js';

// Override browser history methods to track route changes
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(state, title, url) {
  originalPushState.apply(this, [state, title, url]);
  if (url) {
    const path = new URL(url, window.location.origin).pathname;
    updatePath(path);
  }
};

history.replaceState = function(state, title, url) {
  originalReplaceState.apply(this, [state, title, url]);
  if (url) {
    const path = new URL(url, window.location.origin).pathname;
    updatePath(path);
  }
};

// Listen for popstate events (browser back/forward)
window.addEventListener('popstate', function(event) {
  updatePath(window.location.pathname);
});

// Initialize the current path
updatePath(window.location.pathname);