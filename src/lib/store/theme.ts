import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'default' | 'ocean' | 'forest' | 'sunset' | 'violet' | 'rose';

const STORAGE_KEY = 'easyList_theme';

function applyTheme(value: Theme) {
  if (browser) {
    document.documentElement.dataset.theme = value === 'default' ? '' : value;
  }
}

const initial: Theme = browser
  ? (localStorage.getItem(STORAGE_KEY) as Theme) || 'default'
  : 'default';

applyTheme(initial);

const { subscribe, set: internalSet } = writable<Theme>(initial);

if (browser) {
  const unsubscribe = subscribe((value) => {
    localStorage.setItem(STORAGE_KEY, value);
    applyTheme(value);
  });
}

export const theme = {
  subscribe,
  set: (value: Theme) => {
    internalSet(value);
  }
};