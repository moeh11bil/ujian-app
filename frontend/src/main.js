import './app.css';
import './utils/routeTracker.js';
import App from './App.svelte';

const app = new App({
  target: document.getElementById('app')
});

export default app;