import Dexie, { type Table } from 'dexie';

export interface Ingredient {
  id?: string;
  name: string;
  category: string;
}

export interface Meal {
  id?: string;
  name: string;
  description: string;
}

export interface MealIngredient {
  id?: string;
  mealId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
}

export interface ShoppingListItem {
  ingredientId: string;
  ingredientName: string;
  category: string;
  quantity: number;
  unit: string;
}

export class EasyListDB extends Dexie {
  ingredients!: Table<Ingredient>;
  meals!: Table<Meal>;
  mealIngredients!: Table<MealIngredient>;

  constructor() {
    super('easyListDB');
    this.version(1).stores({
      ingredients: 'id, name, category',
      meals: 'id, name',
      mealIngredients: 'id, mealId, ingredientId'
    });
  }
}

export const db = new EasyListDB();
