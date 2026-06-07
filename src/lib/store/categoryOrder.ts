import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'easylist-category-order';

function load(): string[] {
  if (!browser) return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(value: string[]) {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function createCategoryOrderStore() {
  const store = writable<string[]>([]);

  if (browser) {
    store.set(load());
  }

  return {
    subscribe: store.subscribe,

    set: (value: string[]) => {
      store.set(value);
      save(value);
    },

    update: (fn: (v: string[]) => string[]) => {
      store.update((current) => {
        const next = fn(current);
        save(next);
        return next;
      });
    }
  };
}

export const categoryOrder = createCategoryOrderStore();