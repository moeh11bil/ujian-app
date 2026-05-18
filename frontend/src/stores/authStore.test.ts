import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

vi.hoisted(() => {
  const store: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { for (const key in store) delete store[key]; })
  };
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('location', { href: '' });
});

import { token, user, authActions, isTokenExpired } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    token.set(null);
    user.set(null);
  });

  it('should initialize with null if no token in localStorage', () => {
    authActions.initialize();
    expect(get(token)).toBeNull();
    expect(get(user)).toBeNull();
  });

  it('should login and set token/user', () => {
    // Helper to create a dummy JWT
    const payload = { id: 1, nama: 'Test User', email: 'test@example.com', role: 'siswa', exp: Date.now() / 1000 + 3600 };
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const encodedPayload = btoa(JSON.stringify(payload));
    const dummyToken = `${header}.${encodedPayload}.signature`;
    
    authActions.login(dummyToken);
    
    expect(localStorage.setItem).toHaveBeenCalledWith('token', dummyToken);
    expect(get(token)).toBe(dummyToken);
    expect(get(user)).toEqual({ id: 1, nama: 'Test User', email: 'test@example.com', role: 'siswa' });
  });

  it('should logout and clear token/user', () => {
    authActions.logout();
    
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(get(token)).toBeNull();
    expect(get(user)).toBeNull();
  });

  it('should identify expired tokens', () => {
    const expiredPayload = { exp: Date.now() / 1000 - 3600 };
    const expiredToken = `${btoa('{}')}.${btoa(JSON.stringify(expiredPayload))}.sig`;
    expect(isTokenExpired(expiredToken)).toBe(true);

    const validPayload = { exp: Date.now() / 1000 + 3600 };
    const validToken = `${btoa('{}')}.${btoa(JSON.stringify(validPayload))}.sig`;
    expect(isTokenExpired(validToken)).toBe(false);
  });
});
