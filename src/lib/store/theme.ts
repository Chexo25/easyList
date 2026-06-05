import { writable } from 'svelte/store';

const STORAGE_KEY = 'app-theme';

export type ColorTheme = 'default' | 'ocean' | 'forest' | 'sunset';

function createThemeStore() {
  const initial: ColorTheme =
    typeof localStorage !== 'undefined'
      ? (localStorage.getItem(STORAGE_KEY) as ColorTheme) || 'default'
      : 'default';

  const { subscribe, set } = writable<ColorTheme>(initial);

  return {
    subscribe,
    set: (value: ColorTheme) => {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove(
          'theme-ocean',
          'theme-forest',
          'theme-sunset'
        );

        if (value !== 'default') {
          document.documentElement.classList.add(`theme-${value}`);
        }

        localStorage.setItem(STORAGE_KEY, value);
      }

      set(value);
    }
  };
}

export const theme = createThemeStore();