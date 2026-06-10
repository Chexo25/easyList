import { writable } from 'svelte/store';

const STORAGE_KEY = 'app-mode';

export type Mode = 'light' | 'dark';

function createModeStore() {
  const initial: Mode =
    typeof localStorage !== 'undefined'
      ? (localStorage.getItem(STORAGE_KEY) as Mode) || 'light'
      : 'light';

  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle(
      'dark',
      initial === 'dark'
    );
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
      const current =
        (localStorage.getItem(STORAGE_KEY) as Mode) || 'light';

      const next: Mode =
        current === 'dark' ? 'light' : 'dark';

      document.documentElement.classList.toggle(
        'dark',
        next === 'dark'
      );

      localStorage.setItem(STORAGE_KEY, next);
      internalSet(next);
    }
  };
}

export const mode = createModeStore();