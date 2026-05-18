import { writable, derived } from 'svelte/store';

interface User {
  id: number;
  nama: string;
  email: string;
  role: string;
}

let _cachedToken: string | null = null;
let _cachedPayload: any = null;

// Helper to check token expiration
export function isTokenExpired(tokenString: string | null): boolean {
  if (!tokenString) return true;
  
  try {
    const token = tokenString.startsWith('Bearer ') ? tokenString.substring(7) : tokenString;
    
    if (token !== _cachedToken) {
      _cachedToken = token;
      _cachedPayload = JSON.parse(atob(token.split('.')[1]));
    }
    
    if (_cachedPayload.exp) {
      const now = Date.now() / 1000;
      return now >= _cachedPayload.exp;
    }
    return false;
  } catch (e) {
    console.error('Invalid token', e);
    _cachedToken = null;
    _cachedPayload = null;
    return true;
  }
}

// Helper to get user from token
function getUserFromToken(tokenString: string | null): User | null {
  if (!tokenString || isTokenExpired(tokenString)) return null;
  
  try {
    const token = tokenString.startsWith('Bearer ') ? tokenString.substring(7) : tokenString;
    
    if (token !== _cachedToken) {
      _cachedToken = token;
      _cachedPayload = JSON.parse(atob(token.split('.')[1]));
    }
    
    return {
      id: _cachedPayload.id,
      nama: _cachedPayload.nama,
      email: _cachedPayload.email,
      role: _cachedPayload.role
    };
  } catch (e) {
    console.error('Error decoding token', e);
    _cachedToken = null;
    _cachedPayload = null;
    return null;
  }
}

// Safer localStorage access
const getStoredToken = () => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

// Initial state
const initialToken = getStoredToken();
const initialUser = getUserFromToken(initialToken);

export const token = writable<string | null>(initialToken);
export const user = writable<User | null>(initialUser);
export const isAuthenticated = derived(token, ($token) => !!$token && !isTokenExpired($token));

// Actions
export const authActions = {
  login: (authToken: string) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('token', authToken);
    }
    token.set(authToken);
    user.set(getUserFromToken(authToken));
  },
  logout: () => {
    console.log('=== authActions.logout called ===');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    token.set(null);
    user.set(null);
    // Don't use window.location.href - let ProtectedRoute handle the redirect
    // The redirect will happen automatically because $token is now null
  },
  initialize: () => {
    console.log('=== authActions.initialize called ===');
    const currentToken = getStoredToken();
    console.log('Stored token:', currentToken ? 'exists' : 'none');
    
    // Don't auto-logout - just set the state
    // Let ProtectedRoute handle redirect logic
    if (currentToken && !isTokenExpired(currentToken)) {
      console.log('Token valid, setting user');
      token.set(currentToken);
      user.set(getUserFromToken(currentToken));
    } else {
      console.log('No valid token, keeping as logged out state');
      token.set(null);
      user.set(null);
    }
  }
};
