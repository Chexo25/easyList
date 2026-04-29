import { writable, get } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
 
import { supabase } from './supabase';
import { addToOfflineQueue, processOfflineQueue } from './offlineSync';
import type { User } from '@supabase/supabase-js';
import type { Ingredient, Meal, PlannedDay } from './types';

export const currentUser = writable<User | null>(null);

export const isNetworkOffline = writable(typeof navigator !== 'undefined' ? !navigator.onLine : false);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => isNetworkOffline.set(false));
  window.addEventListener('offline', () => isNetworkOffline.set(true));
  
  let wasOffline = false;
  setInterval(async () => {
    if (document.hidden) return;
      if (document.hidden) return;
      if (!navigator.onLine) {
      isNetworkOffline.set(true);
      wasOffline = true;
      return;
    }
    try {
      await fetch(import.meta.env.VITE_SUPABASE_URL + '/rest/v1/', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
      isNetworkOffline.set(false);
      
      // If we just came back online, process queue and reload
      if (wasOffline) {
        wasOffline = false;
        await processOfflineQueue();
        const u = get(currentUser);
        const lId = get(currentListId);
        if (u && !lId) await loadLists(u.id);
        if (lId) selectList(lId);
      }
    } catch {
      isNetworkOffline.set(true);
      wasOffline = true;
    }
  }, 10000);
}


function createCachedStore<T>(key: string, initialValue: T) {
  let storedValue = initialValue;
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        storedValue = JSON.parse(cached);
      } catch (e) {
        console.error("Erreur de parsing localStorage pour", key, e);
      }
    }
  }
  const store = writable<T>(storedValue);
  
  if (typeof window !== 'undefined') {
    store.subscribe((value) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
  }
  return store;
}

export const lists = createCachedStore<any[]>('easyList_lists_cache', []);
export const isListsLoaded = writable<boolean>(false);
export const currentListId = createCachedStore<string | null>('easyList_currentListId_cache', null);
export const items = createCachedStore<any[]>('easyList_items_cache', []);
export const syncMeals = createCachedStore<any[]>('easyList_syncMeals_cache', []);
export const syncPlanning = createCachedStore<any>('easyList_syncPlanning_cache', {});
export const syncError = writable<string | null>(null);

let itemsSubscription = null;
let mealsSubscription = null;
let planningSubscription = null;
let currentSyncId = 0;

// Initialiser l'authentification (crée ou récupère le compte anonyme)
export async function initSync() {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
      await processOfflineQueue();
      const u = get(currentUser);
      const listId = get(currentListId);
      if (u && !listId) await loadLists(u.id);
      if (listId) selectList(listId); // Reload to get fresh DB state
    });
    // Let's run it once on init
    await processOfflineQueue();
  }
  
  if (get(lists).length > 0) isListsLoaded.set(true);
  if (get(currentListId)) {
    // We already awaited the queue, so DB is up to date.
    selectList(get(currentListId));
  }

  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.user) {
    currentUser.set(session.user);
    await loadLists(session.user.id);
  } else {
    // Si pas de compte, on en crée un anonymement
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("Erreur Auth:", error);
      syncError.set(error.message);
    } else if (data.user) {
      currentUser.set(data.user);
      await loadLists(data.user.id);
    }
  }
}

// Charger toutes les listes auxquelles l'utilisateur a accès
async function loadLists(userId) {
  const { data, error } = await supabase
    .from('list_members')
    .select('lists (id, name, share_code)')
    .eq('user_id', userId);

  if (!error && data) {
    // Aplatir les données car Supabase imbrique la table jointe
    const userLists = data.map(d => d.lists).filter(Boolean);
    lists.set(userLists);
    
    const current = get(currentListId);
    if (!current && userLists.length > 0) {
      selectList(userLists[0].id);
    }
  }
  isListsLoaded.set(true);
}

// Créer une nouvelle liste
export async function createNewList(name) {
  const user = get(currentUser);
  if (!user) return null;

  // 1. Créer la liste
  const { data: newList, error: listError } = await supabase
    .from('lists')
    .insert([{ name }])
    .select()
    .single();

  if (listError) return null;

  // 2. Associer l'utilisateur à cette liste
  await supabase
    .from('list_members')
    .insert([{ list_id: newList.id, user_id: user.id }]);

  // 3. Migrer les éléments locaux vers la nouvelle liste
  const currentItems = get(items);
  const localItems = currentItems.filter(item => !item.list_id);
  
  if (localItems.length > 0) {
    const itemsToInsert = localItems.map(item => ({
      ...item,
      list_id: newList.id
    }));
    
    try {
      await supabase.from('items').insert(itemsToInsert);
    } catch (err) {
      console.error('Error migrating items to new list:', err);
    }
  }

  const currentMeals = get(syncMeals);
  const localMeals = currentMeals.filter(meal => !meal.list_id);

  if (localMeals.length > 0) {
    const mealsToInsert = localMeals.map(meal => {
      const payload = { ...meal, list_id: newList.id };
      if (payload.createdAt !== undefined) {
        payload.created_at = new Date(payload.createdAt).toISOString();
        delete payload.createdAt;
      }
      if (payload.isFavorite !== undefined) {
        payload.is_favorite = payload.isFavorite;
        delete payload.isFavorite;
      }
      return payload;
    });

    try {
      await supabase.from('meals').insert(mealsToInsert);
    } catch (err) {
      console.error('Error migrating meals to new list:', err);
    }
  }

  const currentPlan = get(syncPlanning);
  const localPlanDates = Object.keys(currentPlan).filter(date => !currentPlan[date].list_id);

  if (localPlanDates.length > 0) {
    const planToInsert = localPlanDates.map(date => ({
      ...currentPlan[date],
      list_id: newList.id,
      lunch_excluded: currentPlan[date].lunchExcluded || [],
      dinner_excluded: currentPlan[date].dinnerExcluded || []
    }));

    // Clean up frontend formatted fields before sending to db
    planToInsert.forEach(p => {
      delete p.lunchExcluded;
      delete p.dinnerExcluded;
    });

    try {
      await supabase.from('planning').insert(planToInsert);
    } catch (err) {
      console.error('Error migrating planning to new list:', err);
    }
  }

  // 4. Recharger les listes et sélectionner la nouvelle
  await loadLists(user.id);
  selectList(newList.id);
  return newList;
}

// Rejoindre une liste existante avec le code de partage
export async function joinList(shareCode) {
  const user = get(currentUser);
  if (!user) return false;

  // 1. Trouver la liste correspondante
  const { data: listToJoin } = await supabase
    .from('lists')
    .select('id')
    .eq('share_code', shareCode)
    .single();

  if (!listToJoin) return false; // Code invalide

  // 2. S'y associer
  const { error } = await supabase
    .from('list_members')
    .insert([{ list_id: listToJoin.id, user_id: user.id }]);

  if (!error || error.code === '23505') { // 23505 = déjà membre
    await loadLists(user.id);
    selectList(listToJoin.id);
    return true;
  }
  return false;
}

// Sélectionner une liste et charger ses articles avec synchronisation Temps Réel
export async function selectList(listId) {
  const oldListId = get(currentListId);
  const syncId = ++currentSyncId;
  currentListId.set(listId);
  
  try {
    // Fire and forget, don't await to avoid hanging
    supabase.removeAllChannels();
    itemsSubscription = null;
    mealsSubscription = null;
    planningSubscription = null;
  } catch (err) {
    console.error("Erreur removeAllChannels:", err);
  }

  // Preserve local items (without list_id) before clearing
  const localItems = get(items).filter(i => !i.list_id);

  // Vider les items actuels seulement si on change de liste
  if (oldListId !== listId) {
    items.set([]);
    syncMeals.set([]);
    syncPlanning.set({});
  }

  // Fetch initial items
  const { data: itemsData } = await supabase
    .from('items')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: true });
  if (syncId !== currentSyncId) return; // Un autre selectList a commencé
  if (itemsData) {
    // Merge with local items (without list_id)
    items.set([...localItems, ...itemsData]);
  } else {
    items.set(localItems);
  }

  // Fetch initial meals
  const currentMeals = get(syncMeals);
  const localMeals = currentMeals.filter(meal => !meal.list_id);

  const { data: mealsData } = await supabase
    .from('meals')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: false });
  if (syncId !== currentSyncId) return; // Un autre selectList a commencé
  if (mealsData) {
    const formattedData = mealsData.map(m => ({ ...m, ingredients: m.ingredients || [] }));
    syncMeals.set([...localMeals, ...formattedData]);
  } else {
    syncMeals.set(localMeals);
  }

  // Fetch initial planning
  const currentPlan = get(syncPlanning);
  const localPlanObj = {};
  for (const d in currentPlan) {
    if (!currentPlan[d].list_id) {
      localPlanObj[d] = currentPlan[d];
    }
  }

  const { data: planData } = await supabase
    .from('planning')
    .select('*')
    .eq('list_id', listId);
  if (syncId !== currentSyncId) return; // Un autre selectList a commencé
  
  const planObj = { ...localPlanObj };
  if (planData) {
    for (const p of planData) {
      planObj[p.date] = {
        id: p.id,
        date: p.date,
        lunch: p.lunch,
        dinner: p.dinner,
        lunchExcluded: p.lunch_excluded || [],
        dinnerExcluded: p.dinner_excluded || [],
        list_id: p.list_id
      };
    }
  }
  syncPlanning.set(planObj);
  
  if (syncId !== currentSyncId) return; // Ne pas recréer si on a changé de liste

  const uniqueSuffix = Date.now().toString(36);

  // Souscrire items
  itemsSubscription = supabase.channel(`items_${listId}_${uniqueSuffix}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` }, (payload) => {
      items.update(current => {
        if (current.find(i => i.id === payload.new.id)) {
          return current.map(i => i.id === payload.new.id ? payload.new : i);
        }
        return [payload.new, ...current];
      });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` }, (payload) => {
      items.update(current => current.map(i => i.id === payload.new.id ? payload.new : i));
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'items' }, (payload) => {
      items.update(current => current.filter(i => i.id !== payload.old.id));
    })
    .subscribe();

  // Souscrire meals
  mealsSubscription = supabase.channel(`meals_${listId}_${uniqueSuffix}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meals', filter: `list_id=eq.${listId}` }, (payload) => {
      syncMeals.update(current => {
        const safeNew = { ...payload.new, ingredients: payload.new?.ingredients || [] };
        if (current.find(m => m.id === safeNew.id)) {
          return current.map(m => m.id === safeNew.id ? safeNew : m);
        }
        return [safeNew, ...current];
      });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meals', filter: `list_id=eq.${listId}` }, (payload) => {
      syncMeals.update(current => {
        const safeNew = { ...payload.new, ingredients: payload.new?.ingredients || [] };
        return current.map(m => m.id === safeNew.id ? safeNew : m);
      });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'meals' }, (payload) => {
      syncMeals.update(current => current.filter(m => m.id !== payload.old.id));
    })
    .subscribe();

  // Souscrire planning
  planningSubscription = supabase.channel(`planning_${listId}_${uniqueSuffix}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'planning', filter: `list_id=eq.${listId}` }, (payload) => {
      syncPlanning.update(current => {
        const copy = { ...current };
        copy[payload.new.date] = {
          id: payload.new.id,
          date: payload.new.date,
          lunch: payload.new.lunch,
          dinner: payload.new.dinner,
          lunchExcluded: payload.new.lunch_excluded || [],
          dinnerExcluded: payload.new.dinner_excluded || []
        };
        return copy;
      });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'planning', filter: `list_id=eq.${listId}` }, (payload) => {
      syncPlanning.update(current => {
        const copy = { ...current };
        copy[payload.new.date] = {
          id: payload.new.id,
          date: payload.new.date,
          lunch: payload.new.lunch,
          dinner: payload.new.dinner,
          lunchExcluded: payload.new.lunch_excluded || [],
          dinnerExcluded: payload.new.dinner_excluded || []
        };
        return copy;
      });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'planning' }, (payload) => {
      syncPlanning.update(current => {
        const copy = { ...current };
        const dateKey = Object.keys(copy).find(d => copy[d].id === payload.old.id);
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

async function reloadPlanning(listId) {
  const { data } = await supabase.from('planning').select('*').eq('list_id', listId);
  if (data) {
    const planObj = {};
    for (const p of data) {
      planObj[p.date] = {
        id: p.id,
        date: p.date,
        lunch: p.lunch,
        dinner: p.dinner,
        lunchExcluded: p.lunch_excluded || [],
        dinnerExcluded: p.dinner_excluded || []
      };
    }
    syncPlanning.set(planObj);
  }
}


// Ajouter, cocher, modifier, supprimer un article
export async function addItem(idOrObj: any, name?: string, category?: string, quantity?: number, unit?: string, linkedMeals?: string[]) {
  let id = idOrObj;
  let isBought = false;
  if (typeof idOrObj === 'object' && idOrObj !== null) {
    id = idOrObj.id;
    name = idOrObj.name;
    category = idOrObj.category;
    quantity = idOrObj.quantity;
    unit = idOrObj.unit;
    linkedMeals = idOrObj.linkedMeals || idOrObj.linked_meals;
    isBought = idOrObj.isBought || idOrObj.is_bought || false;
  }
  if (!id) id = crypto.randomUUID(); // Fallback backward compatibility
  const listId = get(currentListId);
  
  const dbItem = { id, list_id: listId, name, category, quantity, unit, linked_meals: linkedMeals, is_bought: isBought };
  
  // Update optimistically
  items.update(current => [dbItem, ...current]);

  // Only sync if we have a list selected
  if (!listId) return;

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('Failed to fetch');
    const { error } = await supabase.from('items').insert([dbItem]);
    if (error) {
      if (error.message === 'Failed to fetch' || String(error).includes('fetch') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw error;
      }
      console.error("DB Error:", error);
      return;
    }
  } catch (err) {
    addToOfflineQueue({ table: 'items', operation: 'insert', payload: dbItem, match: null });
  }
}

export async function updateItem(id, updates) {
  // Update optimistically
  items.update(current => current.map(item => item.id === id ? { ...item, ...updates } : item));

  const listId = get(currentListId);
  if (!listId) return;

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('Failed to fetch');
    const { error } = await supabase.from('items').update(updates).eq('id', id);
    if (error) {
      if (error.message === 'Failed to fetch' || String(error).includes('fetch') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw error;
      }
      console.error("DB Error:", error);
      return;
    }
  } catch (err) {
    addToOfflineQueue({ table: 'items', operation: 'update', payload: updates, match: { id } });
  }
}

export async function toggleItem(id, is_bought) {
  // Update optimistically
  items.update(current => current.map(item => item.id === id ? { ...item, is_bought } : item));

  const listId = get(currentListId);
  if (!listId) return;

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('Failed to fetch');
    const { error } = await supabase.from('items').update({ is_bought }).eq('id', id);
    if (error) {
      if (error.message === 'Failed to fetch' || String(error).includes('fetch') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw error;
      }
      console.error("DB Error:", error);
      return;
    }
  } catch (err) {
    addToOfflineQueue({ table: 'items', operation: 'update', payload: { is_bought }, match: { id } });
  }
}

export async function deleteItem(id) {
  // Update optimistically
  items.update(current => current.filter(item => item.id !== id));

  const listId = get(currentListId);
  if (!listId) return;

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('Failed to fetch');
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) {
      if (error.message === 'Failed to fetch' || String(error).includes('fetch') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw error;
      }
      console.error("DB Error:", error);
      return;
    }
  } catch (err) {
    addToOfflineQueue({ table: 'items', operation: 'delete', payload: null, match: { id } });
  }
}

export async function saveItems(itemsArray) {
  const listId = get(currentListId);

  const payloads = [];
  for (const item of itemsArray) {
    if (item.id) {
       payloads.push({
         id: item.id,
         list_id: listId,
         name: item.name,
         category: item.category,
         quantity: item.quantity,
         unit: item.unit,
         linked_meals: item.linkedMeals ?? item.linked_meals,
         is_bought: item.isBought ?? item.is_bought
       });
    }
  }

  if (payloads.length > 0) {
    // Optimistic update
    items.update((current) => {
      const map = new Map(current.map(i => [i.id, i]));
      for (const p of payloads) {
        map.set(p.id, { ...map.get(p.id), ...p });
      }
      return Array.from(map.values());
    });

    if (!listId) return;

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('Failed to fetch');
      const { error } = await supabase.from('items').upsert(payloads);
      if (error) {
        if (error.message === 'Failed to fetch' || String(error).includes('fetch') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
          throw error;
        }
        console.error("DB Error in upsert:", error);
      }
    } catch (err) {
      for (const p of payloads) {
        addToOfflineQueue({ table: 'items', operation: 'upsert', payload: p, match: null });
      }
    }
  }
}

// --- Repas & Planning ---
export async function addMealToSync(meal) {
  const listId = get(currentListId);

  const payload = { 
    ...meal, 
    list_id: listId,
    created_at: new Date(meal.createdAt || Date.now()).toISOString(),
    is_favorite: meal.isFavorite || false
  };
  
  // Optimistic UI Update
  syncMeals.update(current => [{ ...payload, ingredients: payload.ingredients || [] }, ...current]);

  if (!listId) return;

  delete payload.createdAt;
  delete payload.isFavorite;

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('Failed to fetch');
    const { error } = await supabase.from('meals').insert([payload]);
    if (error) {
      if (error.message === 'Failed to fetch') throw error;
      console.error('Error inserting meal:', error);
    }
  } catch (err) {
    addToOfflineQueue({ table: 'meals', operation: 'insert', payload, match: null });
  }
}

export async function updateMealInSync(id, updates) {
  const payload = { ...updates };
  if (payload.createdAt !== undefined) {
    payload.created_at = new Date(payload.createdAt).toISOString();
    delete payload.createdAt;
  }
  if (payload.isFavorite !== undefined) {
    payload.is_favorite = payload.isFavorite;
    delete payload.isFavorite;
  }

  // Optimistic UI Update
  syncMeals.update(current => current.map(m => m.id === id ? { ...m, ...payload } : m));

  const listId = get(currentListId);
  if (!listId) return;

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('Failed to fetch');
    const { error } = await supabase.from('meals').update(payload).eq('id', id);
    if (error) {
      if (error.message === 'Failed to fetch') throw error;
      console.error('Error updating meal:', error);
    }
  } catch (err) {
    addToOfflineQueue({ table: 'meals', operation: 'update', payload, match: { id } });
  }
}

export async function deleteMealFromSync(id) {
  const currentMeals = get(syncMeals);
  const mealToDelete = currentMeals.find(m => m.id === id);
  const mealName = mealToDelete?.name;

  // Optimistic update
  syncMeals.update(current => current.filter(m => m.id !== id));

  // Clean up planning references to this meal
  const currentPlan = get(syncPlanning);
  for (const dateStr in currentPlan) {
    const plannedDay = currentPlan[dateStr];
    let needsUpdate = false;
    const updates: any = {};
    
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

  // Clean up the meal references in items list
  if (mealName) {
    const currentItems = get(items);
    const updatedItems = [];
    for (const item of currentItems) {
      const linked = item.linked_meals || item.linkedMeals || [];
      if (linked.includes(mealName)) {
        updatedItems.push({
          ...item,
          linkedMeals: linked.filter(n => n !== mealName),
          linked_meals: linked.filter(n => n !== mealName)
        });
      }
    }
    if (updatedItems.length > 0) {
      await saveItems(updatedItems);
    }
  }

  const listId = get(currentListId);
  if (!listId) return;

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('Failed to fetch');
    const { error } = await supabase.from('meals').delete().eq('id', id);
    if (error) {
      if (error.message === 'Failed to fetch') throw error;
      console.error('Error deleting meal:', error);
    }
  } catch (err) {
    addToOfflineQueue({ table: 'meals', operation: 'delete', payload: null, match: { id } });
  }
}

export async function updatePlannedDayInSync(date, updates) {
  const listId = get(currentListId);

  const currentPlan = get(syncPlanning);
  const existingId = currentPlan[date]?.id;

  let payload = {
    id: existingId || uuidv4(),
    list_id: listId,
    date,
    lunch: updates.lunch !== undefined ? updates.lunch : (currentPlan[date]?.lunch || null),
    dinner: updates.dinner !== undefined ? updates.dinner : (currentPlan[date]?.dinner || null),
    lunch_excluded: updates.lunchExcluded !== undefined ? updates.lunchExcluded : (currentPlan[date]?.lunchExcluded || []),
    dinner_excluded: updates.dinnerExcluded !== undefined ? updates.dinnerExcluded : (currentPlan[date]?.dinnerExcluded || [])
  };
  
  syncPlanning.update(current => ({
     ...current,
     [date]: {
        id: payload.id,
        date,
        lunch: payload.lunch,
        dinner: payload.dinner,
        lunchExcluded: payload.lunch_excluded,
        dinnerExcluded: payload.dinner_excluded
     }
  }));

  if (!listId) return;

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('Failed to fetch');
    const { error } = await supabase.from('planning').upsert(payload, { onConflict: 'list_id,date' });
    if (error) {
      if (error.message === 'Failed to fetch') throw error;
      console.error('Error upserting planning:', error);
      reloadPlanning(listId);
    }
  } catch (err) {
    addToOfflineQueue({ table: 'planning', operation: 'upsert', payload, match: null });
  }
}

export async function updateListName(listId, newName) {
  const { error } = await supabase
    .from('lists')
    .update({ name: newName })
    .eq('id', listId);
    
  if (error) {
    console.error('Error updating list name', error);
    return false;
  }
  
  const user = get(currentUser);
  if (user) await loadLists(user.id);
  return true;
}

export async function deleteList(listId) {
  const { error } = await supabase
    .from('lists')
    .delete()
    .eq('id', listId);
    
  if (error) {
    console.error('Error deleting list', error);
    return false;
  }

  const current = get(currentListId);
  if (current === listId) {
    // try to select another list if possible
    const currentLists = get(lists);
    const otherList = currentLists.find(l => l.id !== listId);
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
