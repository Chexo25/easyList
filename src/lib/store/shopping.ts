import type { User } from '@supabase/supabase-js';
import { get, writable } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../db/supabase';
import type { Item, Meal, PlannedDay, Planning, ShoppingList } from '../types';
import { itemFromDb, itemToDb, mealFromDb, mealToDb, planningFromDb, planningToDb } from '../utils/transformers';

export const currentUser = writable<User | null>(null);
export const lists = writable<ShoppingList[]>([]);
export const isListsLoaded = writable(false);
export const currentListId = writable<string | null>(null);
export const items = writable<Item[]>([]);
export const syncMeals = writable<Meal[]>([]);
export const syncPlanning = writable<Planning>({});
export const syncError = writable<string | null>(null);
export const isNetworkOffline = writable(false);

let currentSyncId = 0;

function persistStore<T>(store: ReturnType<typeof writable<T>>, key: string) {
  if (typeof window === 'undefined') return;
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed !== null && parsed !== undefined) {
        store.set(parsed);
      }
    } catch {
      console.error('Failed to parse localStorage key:', key);
    }
  }
  store.subscribe((value) => {
    localStorage.setItem(key, JSON.stringify(value));
  });
}

persistStore(lists, 'easyList_lists_cache');
persistStore(currentListId, 'easyList_currentListId_cache');
persistStore(items, 'easyList_items_cache');
persistStore(syncMeals, 'easyList_syncMeals_cache');
persistStore(syncPlanning, 'easyList_syncPlanning_cache');

function monitorNetwork() {
  if (typeof window === 'undefined') return;

  isNetworkOffline.set(!navigator.onLine);

  window.addEventListener('online', () => {
    isNetworkOffline.set(false);
  });

  window.addEventListener('offline', () => {
    isNetworkOffline.set(true);
  });
}

monitorNetwork();

export async function initSync() {

  const savedLists = get(lists);
  if (savedLists.length > 0) isListsLoaded.set(true);

  const savedListId = get(currentListId);
  if (savedListId) {
    selectList(savedListId);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    currentUser.set(session.user);
    await loadLists(session.user.id);
  } else {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('Auth error:', error);
      syncError.set(error.message);
    } else if (data.user) {
      currentUser.set(data.user);
      await loadLists(data.user.id);
    }
  }
}

async function loadLists(userId: string) {
  const { data, error } = await supabase
    .from('list_members')
    .select('lists (id, name, share_code)')
    .eq('user_id', userId);

  if (!error && data) {
    const userLists: ShoppingList[] = data.map((d: Record<string, unknown>) => d.lists as ShoppingList).filter(Boolean);
    lists.set(userLists);

    const current = get(currentListId);
    if (!current && userLists.length > 0) {
      selectList(userLists[0].id);
    }
  }
  isListsLoaded.set(true);
}

export async function createNewList(name: string) {
  const user = get(currentUser);
  if (!user) return null;

  const { data: newList, error: listError } = await supabase.from('lists').insert([{ name }]).select().single();

  if (listError) return null;

  await supabase.from('list_members').insert([{ list_id: newList.id, user_id: user.id }]);

  await migrateLocalData(newList.id);

  await loadLists(user.id);
  selectList(newList.id);
  return newList;
}

export async function joinList(shareCode: string) {
  const user = get(currentUser);
  if (!user) return false;

  const { data: listToJoin } = await supabase.from('lists').select('id').eq('share_code', shareCode).single();

  if (!listToJoin) return false;

  const { error } = await supabase.from('list_members').insert([{ list_id: listToJoin.id, user_id: user.id }]);

  if (!error || error.code === '23505') {
    await loadLists(user.id);
    selectList(listToJoin.id);
    return true;
  }
  return false;
}

export async function updateListName(listId: string, newName: string) {
  const { error } = await supabase.from('lists').update({ name: newName }).eq('id', listId);

  if (error) {
    console.error('Error updating list name', error);
    return false;
  }

  const user = get(currentUser);
  if (user) await loadLists(user.id);
  return true;
}

export async function deleteList(listId: string) {
  const { error } = await supabase.from('lists').delete().eq('id', listId);

  if (error) {
    console.error('Error deleting list', error);
    return false;
  }

  const current = get(currentListId);
  if (current === listId) {
    const currentLists = get(lists);
    const otherList = currentLists.find((l) => l.id !== listId);
    if (otherList) {
      selectList(otherList.id);
    } else {
      currentListId.set(null);
    }
  }

  const user = get(currentUser);
  if (user) await loadLists(user.id);
  return true;
}

export async function selectList(listId: string) {
  const oldListId = get(currentListId);
  const syncId = ++currentSyncId;
  currentListId.set(listId);

  try {
    supabase.removeAllChannels();
  } catch (err) {
    console.error('Error removing channels:', err);
  }

  const localItems = get(items).filter((i) => !i.listId);

  if (oldListId !== listId) {
    items.set([]);
    syncMeals.set([]);
    syncPlanning.set({});
  }

  const { data: itemsData } = await supabase
    .from('items')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: true });

  if (syncId !== currentSyncId) return;
  items.set([...localItems, ...(itemsData || []).map(itemFromDb)]);

  const currentMeals = get(syncMeals);
  const localMeals = currentMeals.filter((m) => !m.listId);

  const { data: mealsData } = await supabase
    .from('meals')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: false });

  if (syncId !== currentSyncId) return;
  syncMeals.set([...localMeals, ...(mealsData || []).map(mealFromDb)]);

  const currentPlan = get(syncPlanning);
  const localPlan: Planning = {};
  for (const d in currentPlan) {
    if (!currentPlan[d].id) {
      localPlan[d] = currentPlan[d];
    }
  }

  const { data: planData } = await supabase.from('planning').select('*').eq('list_id', listId);

  if (syncId !== currentSyncId) return;

  const planObj: Planning = { ...localPlan };
  if (planData) {
    for (const p of planData) {
      const day = planningFromDb(p);
      planObj[day.date] = day;
    }
  }
  syncPlanning.set(planObj);

  if (syncId !== currentSyncId) return;

  const uniqueSuffix = Date.now().toString(36);

  supabase
    .channel(`items_${listId}_${uniqueSuffix}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` },
      (payload) => {
        items.update((current) => {
          if (current.find((i) => i.id === payload.new.id)) {
            return current.map((i) => (i.id === payload.new.id ? itemFromDb(payload.new) : i));
          }
          return [itemFromDb(payload.new), ...current];
        });
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` },
      (payload) => {
        items.update((current) => current.map((i) => (i.id === payload.new.id ? itemFromDb(payload.new) : i)));
      },
    )
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'items' }, (payload) => {
      items.update((current) => current.filter((i) => i.id !== payload.old.id));
    })
    .subscribe();

  supabase
    .channel(`meals_${listId}_${uniqueSuffix}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'meals', filter: `list_id=eq.${listId}` },
      (payload) => {
        syncMeals.update((current) => {
          const m = mealFromDb(payload.new);
          if (current.find((x) => x.id === m.id)) {
            return current.map((x) => (x.id === m.id ? m : x));
          }
          return [m, ...current];
        });
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'meals', filter: `list_id=eq.${listId}` },
      (payload) => {
        syncMeals.update((current) => current.map((m) => (m.id === payload.new.id ? mealFromDb(payload.new) : m)));
      },
    )
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'meals' }, (payload) => {
      syncMeals.update((current) => current.filter((m) => m.id !== payload.old.id));
    })
    .subscribe();

  supabase
    .channel(`planning_${listId}_${uniqueSuffix}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'planning', filter: `list_id=eq.${listId}` },
      (payload) => {
        syncPlanning.update((current) => ({ ...current, [payload.new.date]: planningFromDb(payload.new) }));
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'planning', filter: `list_id=eq.${listId}` },
      (payload) => {
        syncPlanning.update((current) => ({ ...current, [payload.new.date]: planningFromDb(payload.new) }));
      },
    )
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'planning' }, (payload) => {
      syncPlanning.update((current) => {
        const copy = { ...current };
        const dateKey = Object.keys(copy).find((d) => copy[d].id === payload.old.id);
        if (dateKey) {
          delete copy[dateKey];
        } else {
          reloadPlanning(listId);
        }
        return copy;
      });
    })
    .subscribe();
}

async function reloadPlanning(listId: string) {
  const { data } = await supabase.from('planning').select('*').eq('list_id', listId);
  if (data) {
    const planObj: Planning = {};
    for (const p of data) {
      const day = planningFromDb(p);
      planObj[day.date] = day;
    }
    syncPlanning.set(planObj);
  }
}

async function dbOperation(operation: () => Promise<any>) {
  try {
    const { error } = await operation();
    if (error) console.error(error);
  } catch (e) {
    console.error(e);
  }
}

export async function addItem(item: Partial<Item>) {
  const id = item.id || crypto.randomUUID();
  const listId = get(currentListId);
  const newItem: Item = {
    id,
    listId,
    name: item.name || '',
    category: item.category || 'Divers',
    isBought: item.isBought ?? false,
    quantity: item.quantity ?? null,
    unit: item.unit || '',
    linkedMeals: item.linkedMeals || [],
    createdAt: new Date().toISOString(),
  };

  items.update((current) => [newItem, ...current]);

  if (!listId) return;

  const dbPayload = itemToDb(newItem);
  await dbOperation(() => supabase.from('items').insert([dbPayload]), {
    table: 'items',
    operation: 'insert',
    payload: dbPayload,
    match: null,
  });
}

export async function updateItem(id: string, updates: Partial<Item>) {
  // 1. update local immédiat
  items.update((current) =>
    current.map((i) =>
      i.id === id ? { ...i, ...updates } : i
    )
  );

  const listId = get(currentListId);
  if (!listId) return;

  // 2. update DB avec protection offline
  await dbOperation(
    () =>
      supabase
        .from('items')
        .update(itemToDbPartial(updates))
        .eq('id', id),
    {
      table: 'items',
      operation: 'update',
      payload: updates,
      match: { id },
    }
  );
}

function itemToDbPartial(
  updates: Partial<Item>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if ('name' in updates) payload.name = updates.name;
  if ('category' in updates) payload.category = updates.category;
  if ('isBought' in updates) payload.is_bought = updates.isBought;
  if ('quantity' in updates) payload.quantity = updates.quantity;
  if ('unit' in updates) payload.unit = updates.unit;
  if ('linkedMeals' in updates) payload.linked_meals = updates.linkedMeals;

  return payload;
}

export async function toggleItem(id: string, isBought: boolean) {
  items.update((current) => current.map((item) => (item.id === id ? { ...item, isBought } : item)));

  const listId = get(currentListId);
  if (!listId) return;

  const dbPayload = { is_bought: isBought };
  await dbOperation(() => supabase.from('items').update(dbPayload).eq('id', id), {
    table: 'items',
    operation: 'update',
    payload: dbPayload,
    match: { id },
  });
}

export async function deleteItem(id: string) {
  items.update((current) => current.filter((item) => item.id !== id));

  const listId = get(currentListId);
  if (!listId) return;

  await dbOperation(() => supabase.from('items').delete().eq('id', id), {
    table: 'items',
    operation: 'delete',
    payload: null,
    match: { id },
  });
}

export async function saveItems(itemsArray: Item[]) {
  const listId = get(currentListId);
  const payloads = itemsArray
    .filter((item) => item.id)
    .map((item) => itemToDb(item));

  if (payloads.length === 0) return;

  //update store local
  items.update((current) => {
    const map = new Map(current.map((i) => [i.id, i]));

    for (const p of payloads) {
      const existing = map.get(p.id as string);
      if (existing) {
        map.set(p.id as string, {
          ...existing,
          ...itemFromDb(p),
        });
      }
    }

    return Array.from(map.values());
  });

  if (!listId) return;

  //update item par item
  for (const p of payloads) {
    await dbOperation(
      () =>
        supabase
          .from('items')
          .update(p)
          .eq('id', p.id),
      {
        table: 'items',
        operation: 'update',
        payload: p,
        match: { id: p.id },
      }
    );
  }
}

export async function addMealToSync(meal: Meal) {
  meal.listId = get(currentListId);
  syncMeals.update((current) => {
    if (current.some(m => m.id === meal.id)) return current;
    return [meal, ...current];
  });

  const listId = get(currentListId);
  if (!listId) return;

  const dbPayload = mealToDb(meal);
  await dbOperation(() => supabase.from('meals').insert([dbPayload]), {
    table: 'meals',
    operation: 'insert',
    payload: dbPayload,
    match: null,
  });
}

export async function updateMealInSync(id: string, updates: Partial<Meal>) {
  const listId = get(currentListId);
  if (!listId) return;

  // 🔥 on récupère le meal COMPLET depuis le store
  const current = get(syncMeals);
  const meal = current.find(m => m.id === id);

  if (!meal) return;

  // 🔥 on merge correctement
  const merged = {
    ...meal,
    ...updates,
    listId
  };

  syncMeals.update((all) =>
    all.map((m) => (m.id === id ? merged : m))
  );

  const dbPayload = mealToDb(merged);

  await dbOperation(
    () => supabase.from('meals').update(dbPayload).eq('id', id),
    {
      table: 'meals',
      operation: 'update',
      payload: dbPayload,
      match: { id },
    }
  );
}

export async function deleteMealFromSync(id: string) {
  const currentMeals = get(syncMeals);
  const mealToDelete = currentMeals.find((m) => m.id === id);
  const mealName = mealToDelete?.name;

  syncMeals.update((current) => current.filter((m) => m.id !== id));

  if (mealName) {
    const currentItems = get(items);
    const updatedItems: Item[] = [];
    for (const item of currentItems) {
      if (item.linkedMeals.includes(mealName)) {
        updatedItems.push({ ...item, linkedMeals: item.linkedMeals.filter((n) => n !== mealName) });
      }
    }
    if (updatedItems.length > 0) {
      await saveItems(updatedItems);
    }
  }

  const currentPlan = get(syncPlanning);
  for (const dateStr in currentPlan) {
    const plannedDay = currentPlan[dateStr];
    const updates: Partial<PlannedDay> = {};
    let needsUpdate = false;

    if (plannedDay.lunch === id) {
      updates.lunch = null;
      needsUpdate = true;
    }
    if (plannedDay.dinner === id) {
      updates.dinner = null;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await updatePlannedDayInSync(dateStr, updates);
    }
  }

  const listId = get(currentListId);
  if (!listId) return;

  await dbOperation(() => supabase.from('meals').delete().eq('id', id), {
    table: 'meals',
    operation: 'delete',
    payload: null,
    match: { id },
  });
}

export async function updatePlannedDayInSync(date: string, updates: Partial<PlannedDay>) {
  const listId = get(currentListId);
  const currentPlan = get(syncPlanning);
  const existingId = currentPlan[date]?.id || uuidv4();

  const updatedDay: PlannedDay = {
    id: existingId,
    date,
    lunch: updates.lunch !== undefined ? updates.lunch : (currentPlan[date]?.lunch ?? null),
    dinner: updates.dinner !== undefined ? updates.dinner : (currentPlan[date]?.dinner ?? null),
    lunchExcluded: updates.lunchExcluded !== undefined ? updates.lunchExcluded : currentPlan[date]?.lunchExcluded || [],
    dinnerExcluded:
      updates.dinnerExcluded !== undefined ? updates.dinnerExcluded : currentPlan[date]?.dinnerExcluded || [],
  };

  syncPlanning.update((current) => ({ ...current, [date]: updatedDay }));

  if (!listId) return;

  const dbPayload = planningToDb({ ...updatedDay, listId });
  await dbOperation(() => supabase.from('planning').upsert(dbPayload, { onConflict: 'list_id,date' }), {
    table: 'planning',
    operation: 'upsert',
    payload: dbPayload,
    match: null,
  });
}

async function migrateLocalData(newListId: string) {
  const currentItems = get(items);
  const localItems = currentItems.filter((item) => !item.listId);
  if (localItems.length > 0) {
    const payloads = localItems.map((item) => itemToDb({ ...item, listId: newListId }));
    try {
      await supabase.from('items').insert(payloads);
    } catch (err) {
      console.error('Error migrating items:', err);
    }
  }

  const currentMeals = get(syncMeals);
  const localMeals = currentMeals.filter((meal) => !meal.listId);
  if (localMeals.length > 0) {
    const payloads = localMeals.map((meal) => mealToDb({ ...meal, listId: newListId }));
    try {
      await supabase.from('meals').insert(payloads);
    } catch (err) {
      console.error('Error migrating meals:', err);
    }
  }

  const currentPlan = get(syncPlanning);
  const localPlanDates = Object.keys(currentPlan).filter((date) => !currentPlan[date].id);
  if (localPlanDates.length > 0) {
    const payloads = localPlanDates.map((date) => planningToDb({ ...currentPlan[date], date, listId: newListId }));
    try {
      await supabase.from('planning').insert(payloads);
    } catch (err) {
      console.error('Error migrating planning:', err);
    }
  }
}
