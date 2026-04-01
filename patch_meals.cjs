const fs = require('fs');
let code = fs.readFileSync('src/routes/meals/+page.svelte', 'utf8');

// Update imports
code = code.replace(
  "import * as Store from '$lib/store';",
  "import * as Store from '$lib/store';\n  import { syncMeals, addMealToSync, updateMealInSync, deleteMealFromSync, saveItems, items as syncItems } from '$lib/shoppingSyncStore';\n  import { get } from 'svelte/store';"
);

// Map meals
code = code.replace(
  "await Store.getMeals();",
  ""
);

code = code.replace(
  "let meals = $state<Meal[]>([]);",
  `let meals = $state<Meal[]>([]);
  $effect(() => {
    const unsub = syncMeals.subscribe(val => {
       meals = val.map(m => ({
          ...m,
          isFavorite: m.is_favorite
       }));
    });
    return unsub;
  });`
);

// Replace actions
code = code.replace(
  "await Store.addMeal(newMeal);",
  "await addMealToSync(newMeal);"
);

code = code.replace(
  "await Store.removeMeal(id);",
  "await deleteMealFromSync(id);"
);

// Handle addToShopping
code = code.replace(
  "let currentShopping = await Store.getIngredients();",
  "let currentShopping = get(syncItems).map(i => ({...i, isBought: i.is_bought}));"
);

code = code.replace(
  "await Store.saveIngredients(toSave);",
  "await saveItems(toSave);"
);

fs.writeFileSync('src/routes/meals/+page.svelte', code);
