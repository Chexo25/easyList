export interface Item {
  id: string;
  listId: string | null;
  name: string;
  category: string;
  isBought: boolean;
  quantity: number | null;
  unit: string;
  linkedMeals: string[];
  createdAt: string;
}

export interface MealIngredient {
  id: string;
  name: string;
  category: string;
  quantity: number | null;
  unit: string;
}

export type MealType = 'Entrée' | 'Plat' | 'Plat à emporter' | 'Dessert' | 'Goûter' | null;

export interface Meal {
  id: string;
  listId: string | null;
  name: string;
  ingredients: MealIngredient[];
  createdAt: string;
  isFavorite: boolean;
  type: MealType;
}

export interface PlannedDay {
  id?: string;
  date: string;
  lunch: string | null;
  dinner: string | null;
  lunchExcluded: string[];
  dinnerExcluded: string[];
}

export type Planning = Record<string, PlannedDay>;

export interface ShoppingList {
  id: string;
  name: string;
  shareCode: string;
}