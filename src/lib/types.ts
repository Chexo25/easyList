export interface Ingredient {
  id: string;
  list_id?: string;
  name: string;
  category: string;
  is_bought?: boolean;
  isBought?: boolean;
  createdAt?: number;
  quantity?: number;
  unit?: string;
  linkedMeals?: string[]; // IDs des repas liés
  linked_meals?: string[];
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
  list_id?: string;
  name: string;
  ingredients: MealIngredient[];
  createdAt?: number;
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
