import type { Item } from '$lib/types';

export function mergeOrCreateItem(
  current: Item[],
  name: string,
  category: string,
  quantity: number,
  unit: string,
  linkedMeal?: string
): { updatedItems: Item[]; newItem?: Item } {
  const activeIndex = current.findIndex(
    i => i.name.toLowerCase() === name.toLowerCase() && !i.isBought
  );

  if (activeIndex !== -1) {
    const existing = current[activeIndex];
    const updatedItems = [...current];
    updatedItems[activeIndex] = {
      ...existing,
      quantity: (existing.quantity || 0) + quantity,
      category,
      unit: unit || existing.unit,
      linkedMeals: linkedMeal && !existing.linkedMeals.includes(linkedMeal)
        ? [...existing.linkedMeals, linkedMeal]
        : existing.linkedMeals,
    };
    return { updatedItems };
  }

  const boughtIndex = current.findIndex(
    i => i.name.toLowerCase() === name.toLowerCase() && i.isBought
  );

  if (boughtIndex !== -1) {
    const updatedItems = [...current];
    updatedItems[boughtIndex] = {
      ...updatedItems[boughtIndex],
      isBought: false,
      quantity,
      category,
      unit,
      linkedMeals: linkedMeal ? [linkedMeal] : [],
    };
    return { updatedItems };
  }

  const newItem: Item = {
    id: crypto.randomUUID(),
    listId: null,
    name,
    category,
    isBought: false,
    createdAt: new Date().toISOString(),
    quantity,
    unit,
    linkedMeals: linkedMeal ? [linkedMeal] : [],
  };

  return { updatedItems: [...current, newItem], newItem };
}