import { writable } from 'svelte/store';

const STORAGE_KEY = 'app-mode';

export type Mode = 'light' | 'dark';

function createModeStore() {
  const initial: Mode =
    typeof localStorage !== 'undefined'
      ? (localStorage.getItem(STORAGE_KEY) as Mode) || 'light'
      : 'light';

  const { subscribe, set } = writable<Mode>(initial);

  return {
    subscribe,
    set: (value: Mode) => {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', value === 'dark');
        localStorage.setItem(STORAGE_KEY, value);
      }
      set(value);
    },
    toggle: () => {
      const next = initial === 'dark' ? 'light' : 'dark';
      set(next);
    }
  };
}

export const mode = createModeStore();