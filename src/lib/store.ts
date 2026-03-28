import { LazyStore } from '@tauri-apps/plugin-store';

const isBrowser = typeof window !== 'undefined';
const isTauriEnv = isBrowser && (window as any).__TAURI_INTERNALS__ !== undefined;

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  isBought: boolean;
  createdAt: number;
  quantity?: number;
  unit?: string;
  linkedMeals?: string[]; // IDs des repas liés
}

export interface MealIngredient {
  id: string; // Fait le lien avec un ingrédient du catalogue, ou est généré
  name: string;
  category: string;
  quantity?: number;
  unit?: string;
}

export interface Meal {
  id: string;
  name: string;
  ingredients: MealIngredient[];
  createdAt: number;
  isFavorite?: boolean;
  type?: string; // 'Entrée', 'Plat', 'Dessert', 'Goûter', etc.
}

export interface PlannedDay {
  date: string; // YYYY-MM-DD
  lunch: string | null; // Meal ID or null
  dinner: string | null; // Meal ID or null
  lunchExcluded?: string[];
  dinnerExcluded?: string[];
}

export type Planning = Record<string, PlannedDay>;

// Create stores
export const store = new LazyStore('ingredients.bin');
export const mealStore = new LazyStore('meals.bin');
export const planStore = new LazyStore('planning.bin');

export async function getIngredients(): Promise<Ingredient[]> {
  if (!isTauriEnv && isBrowser) {
    const data = localStorage.getItem('ingredients.bin');
    return data ? JSON.parse(data) : [];
  }
  try {
    const ingredients = await store.get<Ingredient[]>('ingredients');
    return ingredients || [];
  } catch (e) {
    return [];
  }
}

export async function saveIngredients(ingredients: Ingredient[]) {
  if (!isTauriEnv && isBrowser) {
    localStorage.setItem('ingredients.bin', JSON.stringify(ingredients));
    return;
  }
  try {
    await store.set('ingredients', ingredients);
    await store.save(); // Save to disk
  } catch (e) {
    console.error("Failed to save ingredients to Tauri:", e);
  }
}

export async function addIngredient(ingredient: Ingredient) {
  const current = await getIngredients();
  current.push(ingredient);
  await saveIngredients(current);
}

export async function updateIngredient(id: string, updates: Partial<Ingredient>) {
  const current = await getIngredients();
  const index = current.findIndex(i => i.id === id);
  if (index !== -1) {
    current[index] = { ...current[index], ...updates };
    await saveIngredients(current);
  }
}

export async function removeIngredient(id: string) {
  const current = await getIngredients();
  const filtered = current.filter(i => i.id !== id);
  await saveIngredients(filtered);
}

export async function getMeals(): Promise<Meal[]> {
  if (!isTauriEnv && isBrowser) {
    const data = localStorage.getItem('meals.bin');
    return data ? JSON.parse(data) : [];
  }
  try {
    const meals = await mealStore.get<Meal[]>('meals');
    return meals || [];
  } catch (e) {
    return [];
  }
}

export async function saveMeals(meals: Meal[]) {
  if (!isTauriEnv && isBrowser) {
    localStorage.setItem('meals.bin', JSON.stringify(meals));
    return;
  }
  try {
    await mealStore.set('meals', meals);
    await mealStore.save();
  } catch (e) {
    console.error("Failed to save meals to Tauri:", e);
  }
}

export async function addMeal(meal: Meal) {
  const current = await getMeals();
  current.push(meal);
  await saveMeals(current);
}

export async function updateMeal(id: string, updates: Partial<Meal>) {
  const current = await getMeals();
  const index = current.findIndex(m => m.id === id);
  if (index !== -1) {
    current[index] = { ...current[index], ...updates };
    await saveMeals(current);
  }
}

export async function removeMeal(id: string) {
  const current = await getMeals();
  const filtered = current.filter(m => m.id !== id);
  await saveMeals(filtered);
}

export async function getPlanning(): Promise<Planning> {
  if (!isTauriEnv && isBrowser) {
    const data = localStorage.getItem('planning.bin');
    return data ? JSON.parse(data) : {};
  }
  try {
    const planning = await planStore.get<Planning>('planning');
    return planning || {};
  } catch (e) {
    return {};
  }
}

export async function savePlanning(planning: Planning) {
  if (!isTauriEnv && isBrowser) {
    localStorage.setItem('planning.bin', JSON.stringify(planning));
    return;
  }
  try {
    await planStore.set('planning', planning);
    await planStore.save();
  } catch (e) {
    console.error("Failed to save planning to Tauri:", e);
  }
}

export async function updatePlannedDay(date: string, updates: Partial<PlannedDay>) {
  const current = await getPlanning();
  if (!current[date]) {
    current[date] = { date, lunch: null, dinner: null };
  }
  current[date] = { ...current[date], ...updates };
  await savePlanning(current);
}
