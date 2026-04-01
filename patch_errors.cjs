const fs = require('fs');
let code = fs.readFileSync('src/lib/shoppingSyncStore.ts', 'utf8');

code = code.replace(
  "import { writable, get } from 'svelte/store';",
  "import { writable, get } from 'svelte/store';\nimport { v4 as uuidv4 } from 'uuid';"
);

code = code.replace(
  /await supabase\.from\('meals'\)\.insert\(\[\{\s*id: meal\.id,\s*list_id: listId,\s*name: meal\.name,\s*ingredients: meal\.ingredients,\s*is_favorite: meal\.isFavorite \|\| false,\s*type: meal\.type \|\| ''\s*\}\]\);/,
  `const { error } = await supabase.from('meals').insert([{
    id: meal.id,
    list_id: listId,
    name: meal.name,
    ingredients: meal.ingredients || [],
    is_favorite: meal.isFavorite || false,
    type: meal.type || ''
  }]);\n  if (error) console.error('Error inserting meal:', error);`
);

code = code.replace(
  /await supabase\.from\('planning'\)\.upsert\(payload, \{ onConflict: 'list_id,date' \}\);/,
  `if (!payload.id) payload.id = uuidv4();\n  const { error } = await supabase.from('planning').upsert(payload, { onConflict: 'list_id,date' });\n  if (error) console.error('Error upserting planning:', error);`
);

fs.writeFileSync('src/lib/shoppingSyncStore.ts', code);
