import { writable } from 'svelte/store';

const STORAGE_KEY = 'category-order';

const defaultOrder = [
  'Fruits & Légumes',
  'Produits frais',
  'Viandes & Poissons',
  'Épicerie',
  'Surgelés',
  'Boissons',
  'Hygiène',
  'Autre'
];

function createCategoryOrderStore() {
  const initial =
    typeof localStorage !== 'undefined'
      ? JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      : null;

  const { subscribe, set, update } = writable<string[]>(
    initial || defaultOrder
  );

  return {
    subscribe,
    set: (value: string[]) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      set(value);
    },
    reset: () => set(defaultOrder)
  };
}

export const categoryOrder = createCategoryOrderStore();