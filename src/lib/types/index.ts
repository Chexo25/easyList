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

export interface Meal {
  id: string;
  listId: string | null;
  name: string;
  ingredients: MealIngredient[];
  createdAt: string;
  isFavorite: boolean;
  type: string | null;
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
  share_code: string;
}
