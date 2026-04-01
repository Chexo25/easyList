const fs = require('fs');

let code = fs.readFileSync('src/lib/shoppingSyncStore.ts', 'utf8');

// Add new stores
code = code.replace(
  "export const items = writable([]);",
  `export const items = writable([]);
export const syncMeals = writable([]);
export const syncPlanning = writable({});`
);

// Add subscription variables
code = code.replace(
  "let itemsSubscription = null;",
  `let itemsSubscription = null;
let mealsSubscription = null;
let planningSubscription = null;`
);

// Add selectList clearing and fetching for meals and planning
let selectListCode = `export async function selectList(listId) {
  currentListId.set(listId);
  
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
  if (itemsData) items.set(itemsData);

  // Fetch initial meals
  const { data: mealsData } = await supabase
    .from('meals')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: false });
  if (mealsData) syncMeals.set(mealsData);

  // Fetch initial planning
  const { data: planData } = await supabase
    .from('planning')
    .select('*')
    .eq('list_id', listId);
  if (planData) {
    const planObj = {};
    for (const p of planData) {
      planObj[p.date] = {
        date: p.date,
        lunch: p.lunch,
        dinner: p.dinner,
        lunchExcluded: p.lunch_excluded || [],
        dinnerExcluded: p.dinner_excluded || []
      };
    }
    syncPlanning.set(planObj);
  }

  // Nettoyer anciennes souscriptions
  if (itemsSubscription) await supabase.removeChannel(itemsSubscription);
  if (mealsSubscription) await supabase.removeChannel(mealsSubscription);
  if (planningSubscription) await supabase.removeChannel(planningSubscription);

  // Souscrire items
  itemsSubscription = supabase.channel(\`items_list_\${listId}\`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: \`list_id=eq.\${listId}\` }, (payload) => {
      items.update(current => {
        if (payload.eventType === 'INSERT') return [...current, payload.new];
        if (payload.eventType === 'UPDATE') return current.map(i => i.id === payload.new.id ? payload.new : i);
        if (payload.eventType === 'DELETE') return current.filter(i => i.id !== payload.old.id);
        return current;
      });
    }).subscribe();

  // Souscrire meals
  mealsSubscription = supabase.channel(\`meals_list_\${listId}\`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meals', filter: \`list_id=eq.\${listId}\` }, (payload) => {
      syncMeals.update(current => {
        if (payload.eventType === 'INSERT') return [...current, payload.new];
        if (payload.eventType === 'UPDATE') return current.map(m => m.id === payload.new.id ? payload.new : m);
        if (payload.eventType === 'DELETE') return current.filter(m => m.id !== payload.old.id);
        return current;
      });
    }).subscribe();

  // Souscrire planning
  planningSubscription = supabase.channel(\`planning_list_\${listId}\`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'planning', filter: \`list_id=eq.\${listId}\` }, (payload) => {
      syncPlanning.update(current => {
        const copy = { ...current };
        if (payload.eventType === 'DELETE') {
           // On find the date key (since ID is used for payload.old.id)
           for (const d in copy) {
              // Wait, Supabase only sends ID for deletions. 
              // We can't know the date purely from ID unless we store it.
              // Just reload or do nothing if we don't have ID in object. 
              // Actually, we can fetch all or just rely on UUID.
           }
           // For simplicity, let's just do a reload of planning on delete
           reloadPlanning(listId);
        } else {
           copy[payload.new.date] = {
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
`;

// Replace `selectList` implementation entirely
code = code.replace(/export async function selectList[\s\S]*?(?=\/\/ Ajouter, cocher)/, selectListCode + "\n\n");

// Add meal and planning helper functions
code += `
// --- Repas & Planning ---
export async function addMealToSync(meal) {
  const listId = get(currentListId);
  if (!listId) return;
  await supabase.from('meals').insert([{
    id: meal.id,
    list_id: listId,
    name: meal.name,
    ingredients: meal.ingredients,
    is_favorite: meal.isFavorite || false,
    type: meal.type || ''
  }]);
}

export async function updateMealInSync(id, updates) {
  const payload = { ...updates };
  if (payload.isFavorite !== undefined) {
    payload.is_favorite = payload.isFavorite;
    delete payload.isFavorite;
  }
  await supabase.from('meals').update(payload).eq('id', id);
}

export async function deleteMealFromSync(id) {
  await supabase.from('meals').delete().eq('id', id);
}

export async function updatePlannedDayInSync(date, updates) {
  const listId = get(currentListId);
  if (!listId) return;

  // Since we rely on date and list_id to be unique, we can attempt an upsert
  const currentPlan = get(syncPlanning);
  let payload = {
    list_id: listId,
    date,
    lunch: updates.lunch !== undefined ? updates.lunch : (currentPlan[date]?.lunch || null),
    dinner: updates.dinner !== undefined ? updates.dinner : (currentPlan[date]?.dinner || null),
    lunch_excluded: updates.lunchExcluded !== undefined ? updates.lunchExcluded : (currentPlan[date]?.lunchExcluded || []),
    dinner_excluded: updates.dinnerExcluded !== undefined ? updates.dinnerExcluded : (currentPlan[date]?.dinnerExcluded || [])
  };

  // Verifier si il existe déjà un UUID pour ce jour
  const { data: existing } = await supabase.from('planning').select('id').eq('list_id', listId).eq('date', date).single();
  if (existing) {
     payload.id = existing.id;
  }

  await supabase.from('planning').upsert(payload, { onConflict: 'list_id,date' });
}
`;

fs.writeFileSync('src/lib/shoppingSyncStore.ts', code);
