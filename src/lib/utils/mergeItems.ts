import type { Item } from '$lib/types';

export function mergeOrCreateItem(
  current: Item[],
  name: string,
  category: string,
  quantity: number,
  unit: string,
  linkedMeal?: string,
  listId?: string | null
): Item[] {
  const activeIndex = current.findIndex(
    i => i.name.toLowerCase() === name.toLowerCase() && !i.isBought
  );

  if (activeIndex !== -1) {
    const existing = current[activeIndex];
    const updated = [...current];
    updated[activeIndex] = {
      ...existing,
      quantity: (existing.quantity || 0) + quantity,
      category,
      unit: unit || existing.unit,
      linkedMeals: linkedMeal && !existing.linkedMeals.includes(linkedMeal)
        ? [...existing.linkedMeals, linkedMeal]
        : existing.linkedMeals,
    };
    return updated;
  }

  const boughtIndex = current.findIndex(
    i => i.name.toLowerCase() === name.toLowerCase() && i.isBought
  );

  if (boughtIndex !== -1) {
    const updated = [...current];
    updated[boughtIndex] = {
      ...updated[boughtIndex],
      isBought: false,
      quantity,
      category,
      unit,
      linkedMeals: linkedMeal ? [linkedMeal] : [],
    };
    return updated;
  }

  return [...current, {
    id: crypto.randomUUID(),
    listId: listId ?? null,
    name,
    category,
    isBought: false,
    createdAt: new Date().toISOString(),
    quantity,
    unit,
    linkedMeals: linkedMeal ? [linkedMeal] : [],
  }];
}