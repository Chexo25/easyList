import { writable } from 'svelte/store';

export type Theme = 'default' | 'ocean' | 'forest' | 'sunset' | 'violet' | 'rose';

const STORAGE_KEY = 'app-theme';

function createThemeStore() {
  const initial =
    (typeof localStorage !== 'undefined'
      ? (localStorage.getItem(STORAGE_KEY) as Theme)
      : 'default') || 'default';

  const { subscribe, set } = writable<Theme>(initial);

  return {
    subscribe,

    set: (value: Theme) => {
      localStorage.setItem(STORAGE_KEY, value);
      set(value);
    }
  };
}

export const theme = createThemeStore();