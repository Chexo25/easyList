const fs = require('fs');
let code = fs.readFileSync('src/routes/planning/+page.svelte', 'utf8');

// 1. Remove duplicate imports
code = code.replace(
  /import { syncMeals, syncPlanning, updatePlannedDayInSync, saveItems, items as syncItems } from '\$lib\/shoppingSyncStore';\s+import { get } from 'svelte\/store';/g,
  ""
);
code = code.replace(
  "import * as Store from '$lib/store';",
  "import * as Store from '$lib/store';\n  import { syncMeals, syncPlanning, updatePlannedDayInSync, saveItems, items as syncItems } from '$lib/shoppingSyncStore';\n  import { get } from 'svelte/store';"
);

// 2. Setup variables correctly
code = code.replace(
  "let meals: Meal[] = $state([]);",
  `let meals: Meal[] = $state([]);
  $effect(() => {
    const unsubM = syncMeals.subscribe(val => {
       meals = val.map(m => ({ ...m, isFavorite: m.is_favorite }));
    });
    const unsubP = syncPlanning.subscribe(val => {
       planning = val;
    });
    return () => { unsubM(); unsubP(); };
  });`
);

// 3. Remove await Store.getMeals(); etc
code = code.replace(/meals\s*=\s*await Store\.getMeals\(\);/g, "");
code = code.replace(/planning\s*=\s*await Store\.getPlanning\(\);/g, "");

// 4. Update the sync call that wasn't matched
code = code.replace(/await Store\.updatePlannedDay\(/g, "await updatePlannedDayInSync(");
code = code.replace(/await Store\.saveIngredients\(/g, "await saveItems(");
code = code.replace(/let currentShopping = await Store\.getIngredients\(\);/g, "let currentShopping = get(syncItems).map(i => ({...i, isBought: i.is_bought}));");

fs.writeFileSync('src/routes/planning/+page.svelte', code);
