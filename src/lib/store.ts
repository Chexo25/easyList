import { Store } from '@tauri-apps/plugin-store';

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
}

// Create stores
export const store = new Store('ingredients.bin');
export const mealStore = new Store('meals.bin');

export async function getIngredients(): Promise<Ingredient[]> {
  const ingredients = await store.get<Ingredient[]>('ingredients');
  return ingredients || [];
}

export async function saveIngredients(ingredients: Ingredient[]) {
  await store.set('ingredients', ingredients);
  await store.save(); // Save to disk
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
  const meals = await mealStore.get<Meal[]>('meals');
  return meals || [];
}

export async function saveMeals(meals: Meal[]) {
  await mealStore.set('meals', meals);
  await mealStore.save();
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

