const fs = require('fs');
let code = fs.readFileSync('src/lib/shoppingSyncStore.ts', 'utf8');

// Update addMealToSync
code = code.replace(
  /export async function addMealToSync\(meal\) \{[\s\S]*?\}\]\);\n  if \(error\) console\.error\('Error inserting meal:', error\);\n\}/,
`export async function addMealToSync(meal) {
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
}`
);

// Update updateMealInSync
code = code.replace(
  /export async function updateMealInSync\(id, updates\) \{[\s\S]*?  await supabase\.from\('meals'\)\.update\(payload\)\.eq\('id', id\);\n\}/,
`export async function updateMealInSync(id, updates) {
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
}`
);

// Update deleteMealFromSync
code = code.replace(
  /export async function deleteMealFromSync\(id\) \{\n  await supabase\.from\('meals'\)\.delete\(\)\.eq\('id', id\);\n\}/,
`export async function deleteMealFromSync(id) {
  syncMeals.update(current => current.filter(m => m.id !== id));
  const { error } = await supabase.from('meals').delete().eq('id', id);
  if (error) console.error('Error deleting meal:', error);
}`
);

// Update updatePlannedDayInSync
code = code.replace(
  /export async function updatePlannedDayInSync\(date, updates\) \{[\s\S]*?  if \(error\) console\.error\('Error upserting planning:', error\);\n\}/,
`export async function updatePlannedDayInSync(date, updates) {
  const listId = get(currentListId);
  if (!listId) return;

  const currentPlan = get(syncPlanning);
  let payload = {
    list_id: listId,
    date,
    lunch: updates.lunch !== undefined ? updates.lunch : (currentPlan[date]?.lunch || null),
    dinner: updates.dinner !== undefined ? updates.dinner : (currentPlan[date]?.dinner || null),
    lunch_excluded: updates.lunchExcluded !== undefined ? updates.lunchExcluded : (currentPlan[date]?.lunchExcluded || []),
    dinner_excluded: updates.dinnerExcluded !== undefined ? updates.dinnerExcluded : (currentPlan[date]?.dinnerExcluded || [])
  };

  const { data: existing } = await supabase.from('planning').select('id').eq('list_id', listId).eq('date', date).single();
  if (existing) {
     payload.id = existing.id;
  }
  if (!payload.id) payload.id = uuidv4();
  
  syncPlanning.update(current => ({
     ...current,
     [date]: {
        date,
        lunch: payload.lunch,
        dinner: payload.dinner,
        lunchExcluded: payload.lunch_excluded,
        dinnerExcluded: payload.dinner_excluded
     }
  }));

  const { error } = await supabase.from('planning').upsert(payload, { onConflict: 'list_id,date' });
  if (error) console.error('Error upserting planning:', error);
}`
);

fs.writeFileSync('src/lib/shoppingSyncStore.ts', code);
