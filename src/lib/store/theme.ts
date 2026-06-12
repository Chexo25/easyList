import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'default' | 'ocean' | 'forest' | 'sunset' | 'violet' | 'rose';

const STORAGE_KEY = 'easyList_theme';

function createThemeStore() {
  const initial: Theme = browser
    ? (localStorage.getItem(STORAGE_KEY) as Theme) || 'default'
    : 'default';

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