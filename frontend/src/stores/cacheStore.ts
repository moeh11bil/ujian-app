import { writable } from 'svelte/store';

const MAX_CACHE_SIZE = 50;
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

function evictCacheIfNeeded() {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

export const createCacheStore = (key: string, fetchFn: () => Promise<any>) => {
  const store = writable<any>(null);

  const refresh = async (force = false) => {
    const cached = cache.get(key);
    if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      store.set(cached.data);
      return;
    }

    try {
      const data = await fetchFn();
      evictCacheIfNeeded();
      cache.set(key, { data, timestamp: Date.now() });
      store.set(data);
    } catch (e) {
      console.error(`Error fetching ${key}:`, e);
      throw e;
    }
  };

  return {
    subscribe: store.subscribe,
    refresh
  };
};

export const invalidateCache = (key?: string) => {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
};
