const fs = require('fs');
let code = fs.readFileSync('src/routes/planning/+page.svelte', 'utf8');

// Update imports
code = code.replace(
  "import * as Store from '$lib/store';",
  "import * as Store from '$lib/store';\n  import { syncMeals, syncPlanning, updatePlannedDayInSync, saveItems, items as syncItems } from '$lib/shoppingSyncStore';\n  import { get } from 'svelte/store';"
);

// Variables state to sync
code = code.replace(
  "let meals = $state<Meal[]>([]);",
  `let meals = $state<Meal[]>([]);
  let planning = $state<Store.Planning>({});

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
code = code.replace(
  "let planning = $state<Store.Planning>({});",
  ""
);

code = code.replace(
  "meals = await Store.getMeals();",
  ""
);
code = code.replace(
  "planning = await Store.getPlanning();",
  ""
);
code = code.replace(
  "planning = await Store.getPlanning(); ",
  ""
);

code = code.replace(
  "await Store.updatePlannedDay(dateStr, updates);",
  "await updatePlannedDayInSync(dateStr, updates);"
);

code = code.replace(
  "let currentShopping = await Store.getIngredients();",
  "let currentShopping = get(syncItems).map(i => ({...i, isBought: i.is_bought}));"
);

code = code.replace(
  "await Store.saveIngredients(toSave);",
  "await saveItems(toSave);"
);

fs.writeFileSync('src/routes/planning/+page.svelte', code);
