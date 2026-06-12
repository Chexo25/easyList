import type { Item, Meal, PlannedDay } from '../types';

export function itemFromDb(db: Record<string, unknown>): Item {
  return {
    id: db.id as string,
    listId: (db.list_id as string) ?? null,
    name: db.name as string,
    category: (db.category as string) || 'Divers',
    isBought: (db.is_bought as boolean) || false,
    quantity: (db.quantity as number | null) ?? null,
    unit: (db.unit as string) || '',
    linkedMeals: (db.linked_meals as string[]) || [],
    createdAt: (db.created_at as string) || new Date().toISOString(),
  };
}

export function mealFromDb(db: Record<string, unknown>): Meal {
  return {
    id: db.id as string,
    listId: (db.list_id as string) ?? null,
    name: db.name as string,
    ingredients: ((db.ingredients as Record<string, unknown>[]) || []).map((i) => ({
      id: String(i?.id || ''),
      name: String(i?.name || ''),
      category: String(i?.category || 'Divers'),
      quantity: (i?.quantity as number | undefined) ?? null,
      unit: String(i?.unit || ''),
    })),
    createdAt: (db.created_at as string) || new Date().toISOString(),
    isFavorite: (db.is_favorite as boolean) || false,
    type: (db.type as string | null) ?? null,
  };
}

export function planningFromDb(db: Record<string, unknown>): PlannedDay {
  return {
    id: db.id as string,
    date: db.date as string,
    lunch: (db.lunch as string | null) ?? null,
    dinner: (db.dinner as string | null) ?? null,
    lunchExcluded: (db.lunch_excluded as string[]) || [],
    dinnerExcluded: (db.dinner_excluded as string[]) || [],
  };
}

export function itemToDb(item: Partial<Item> & { id: string }): Record<string, unknown> {
  return {
    id: item.id,
    list_id: item.listId ?? null,
    name: item.name,
    category: item.category || null,
    is_bought: item.isBought ?? false,
    quantity: item.quantity ?? null,
    unit: item.unit || null,
    linked_meals: item.linkedMeals || [],
    created_at: item.createdAt ?? new Date().toISOString(),
  };
}

export function mealToDb(meal: Partial<Meal> & { id: string }): Record<string, unknown> {
  return {
    id: meal.id,
    list_id: meal.listId ?? null,
    name: meal.name,
    ingredients: meal.ingredients || [],
    created_at: meal.createdAt || new Date().toISOString(),
    is_favorite: meal.isFavorite ?? false,
    type: meal.type || null,
  };
}

export function planningToDb(plan: Partial<PlannedDay> & { listId: string }): Record<string, unknown> {
  return {
    id: plan.id,
    list_id: plan.listId ?? null,
    date: plan.date,
    lunch: plan.lunch ?? null,
    dinner: plan.dinner ?? null,
    lunch_excluded: plan.lunchExcluded || [],
    dinner_excluded: plan.dinnerExcluded || [],
  };
}
