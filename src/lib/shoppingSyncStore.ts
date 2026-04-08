import { writable, get } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

export const currentUser = writable(null);
export const lists = writable([]);
export const currentListId = writable(null);
export const items = writable([]);
export const syncMeals = writable([]);
export const syncPlanning = writable({});
export const syncError = writable(null);

let itemsSubscription = null;
let mealsSubscription = null;
let planningSubscription = null;
let currentSyncId = 0;

// Initialiser l'authentification (crée ou récupère le compte anonyme)
export async function initSync() {
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

  // 3. Recharger les listes et sélectionner la nouvelle
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

  // Vider les items actuels pour l'UX
  items.set([]);
  syncMeals.set([]);
  syncPlanning.set({});

  // Fetch initial items
  const { data: itemsData } = await supabase
    .from('items')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: true });
  if (syncId !== currentSyncId) return; // Un autre selectList a commencé
  if (itemsData) items.set(itemsData);

  // Fetch initial meals
  const { data: mealsData } = await supabase
    .from('meals')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: false });
  if (syncId !== currentSyncId) return; // Un autre selectList a commencé
  if (mealsData) {
    syncMeals.set(mealsData.map(m => ({ ...m, ingredients: m.ingredients || [] })));
  }

  // Fetch initial planning
  const { data: planData } = await supabase
    .from('planning')
    .select('*')
    .eq('list_id', listId);
  if (syncId !== currentSyncId) return; // Un autre selectList a commencé
  if (planData) {
    const planObj = {};
    for (const p of planData) {
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
  
  if (syncId !== currentSyncId) return; // Ne pas recréer si on a changé de liste

  const uniqueSuffix = Date.now().toString(36);

  // Souscrire items
  itemsSubscription = supabase.channel(`items_${listId}_${uniqueSuffix}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` }, (payload) => {
      items.update(current => {
        if (payload.eventType === 'INSERT') return [payload.new, ...current];
        if (payload.eventType === 'UPDATE') return current.map(i => i.id === payload.new.id ? payload.new : i);
        if (payload.eventType === 'DELETE') return current.filter(i => i.id !== payload.old.id);
        return current;
      });
    }).subscribe();

  // Souscrire meals
  mealsSubscription = supabase.channel(`meals_${listId}_${uniqueSuffix}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meals', filter: `list_id=eq.${listId}` }, (payload) => {
      syncMeals.update(current => {
        const safeNew = { ...payload.new, ingredients: payload.new?.ingredients || [] };
        if (payload.eventType === 'INSERT') {
          if (current.find(m => m.id === safeNew.id)) {
            return current.map(m => m.id === safeNew.id ? safeNew : m);
          }
          return [safeNew, ...current];
        }
        if (payload.eventType === 'UPDATE') return current.map(m => m.id === safeNew.id ? safeNew : m);
        if (payload.eventType === 'DELETE') return current.filter(m => m.id !== payload.old.id);
        return current;
      });
    }).subscribe();

  // Souscrire planning
  planningSubscription = supabase.channel(`planning_${listId}_${uniqueSuffix}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'planning', filter: `list_id=eq.${listId}` }, (payload) => {
      syncPlanning.update(current => {
        const copy = { ...current };
        if (payload.eventType === 'DELETE') {
           const dateKey = Object.keys(copy).find(d => copy[d].id === payload.old.id);
           if (dateKey) {
             delete copy[dateKey];
           } else {
             reloadPlanning(listId);
           }
        } else {
           copy[payload.new.date] = {
             id: payload.new.id,
             date: payload.new.date,
             lunch: payload.new.lunch,
             dinner: payload.new.dinner,
             lunchExcluded: payload.new.lunch_excluded || [],
             dinnerExcluded: payload.new.dinner_excluded || []
           };
        }
        return copy;
      });
    }).subscribe();
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
export async function addItem(name, category, quantity, unit, linkedMeals) {
  const listId = get(currentListId);
  if (!listId) return;
  await supabase.from('items').insert([{ 
    list_id: listId, 
    name, 
    category, 
    quantity, 
    unit, 
    linkedMeals 
  }]);
}

export async function updateItem(id, updates) {
  // updates peut contenir { category, quantity, unit, is_bought, linkedMeals }
  await supabase.from('items').update(updates).eq('id', id);
}

export async function toggleItem(id, is_bought) {
  await supabase.from('items').update({ is_bought }).eq('id', id);
}

export async function deleteItem(id) {
  await supabase.from('items').delete().eq('id', id);
}

export async function saveItems(itemsArray) {
  // Pour le traitement en masse (comme `saveIngredients`), bien qu'en temps réel on puisse faire des requêtes individuelles.
  const listId = get(currentListId);
  if (!listId) return;
  // Nettoyer les items existants et les remplacer (simplifié) n'est pas idéal,
  // donc pour éviter la perte de données, on va juste faire des upserts ou on ignore pour l'instant.
  // Dans le code, Store.saveIngredients() est appelé principalement pour l'ajout en masse des repas.
  for (const item of itemsArray) {
    if (item.id) {
       await supabase.from('items').upsert({
         id: item.id,
         list_id: listId,
         name: item.name,
         category: item.category,
         quantity: item.quantity,
         unit: item.unit,
         linked_meals: item.linkedMeals,
         is_bought: item.isBought ?? item.is_bought
       });
    }
  }
}

// --- Repas & Planning ---
export async function addMealToSync(meal) {
  const listId = get(currentListId);
  if (!listId) return;
  const payload = {
    id: meal.id,
    list_id: listId,
    name: meal.name,
    ingredients: meal.ingredients || [],
    is_favorite: meal.isFavorite || false,
    type: meal.type || '',
    created_at: new Date().toISOString()
  };
  
  syncMeals.update(current => {
    // avoid duplicates if realtime arrived first
    if (current.find(m => m.id === payload.id)) return current;
    return [payload, ...current];
  });

  const { error } = await supabase.from('meals').insert([payload]);
  if (error) console.error('Error inserting meal:', error);
}

export async function updateMealInSync(id, updates) {
  const payload = { ...updates };
  if (payload.isFavorite !== undefined) {
    payload.is_favorite = payload.isFavorite;
    delete payload.isFavorite;
  }
  
  syncMeals.update(current => 
    current.map(m => m.id === id ? { ...m, ...payload } : m)
  );

  const { error } = await supabase.from('meals').update(payload).eq('id', id);
  if (error) console.error('Error updating meal:', error);
}

export async function deleteMealFromSync(id) {
  syncMeals.update(current => current.filter(m => m.id !== id));
  const { error } = await supabase.from('meals').delete().eq('id', id);
  if (error) console.error('Error deleting meal:', error);
}

export async function updatePlannedDayInSync(date, updates) {
  const listId = get(currentListId);
  if (!listId) return;

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

  const { error } = await supabase.from('planning').upsert(payload, { onConflict: 'list_id,date' });
  if (error) {
    console.error('Error upserting planning:', error);
    // If it fails, fallback by reloading since local state might be out of sync
    reloadPlanning(listId);
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
