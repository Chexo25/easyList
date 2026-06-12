import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'easyList_mode';

export type Mode = 'light' | 'dark';

function createModeStore() {
  const initial: Mode = browser
    ? (localStorage.getItem(STORAGE_KEY) as Mode) || 'light'
    : 'light';

  if (browser) {
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }

  const { subscribe, set: internalSet } = writable<Mode>(initial);

  return {
    subscribe,

    set: (value: Mode) => {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle(
          'dark',
          value === 'dark'
        );
      }

      localStorage.setItem(STORAGE_KEY, value);
      internalSet(value);
    },

    toggle: () => {
      const next: Mode = get({ subscribe }) === 'dark' ? 'light' : 'dark';

      document.documentElement.classList.toggle('dark', next === 'dark');

      localStorage.setItem(STORAGE_KEY, next);
      internalSet(next);
    }
  };
}

export const mode = createModeStore();