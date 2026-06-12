import { browser } from '$app/environment';
import type { writable } from 'svelte/store';

export function persistStore<T>(
  store: ReturnType<typeof writable<T>>,
  key: string
): (() => void) | undefined {
  if (!browser) return;

  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (parsed !== null && parsed !== undefined) {
        store.set(parsed);
      }
    }
  } catch {
    console.error('Failed to parse localStorage key:', key);
  }

  const unsubscribe = store.subscribe((value) => {
    localStorage.setItem(key, JSON.stringify(value));
  });

  return unsubscribe;
}