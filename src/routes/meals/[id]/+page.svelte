<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { v4 as uuidv4 } from 'uuid';
  import { updateMealInSync, syncMeals, items as syncItems, addItem } from '$lib/store/shopping';
  import type { Meal, MealIngredient, Item } from '$lib/types';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { ArrowLeft, ArrowUp, Trash2 } from 'lucide-svelte';

  let mealId = page.params.id;
  let meal = $state<Meal | null>(null);

  let addName = $state('');
  let addCategory = $state('');
  let addQty = $state(1);
  let addUnit = $state('');

  onMount(async () => {
    const meals = get(syncMeals);
    const found = meals.find(m => m.id === mealId);
    if (!found) {
      goto('/meals');
      return;
    }
    meal = { ...found, isFavorite: found.isFavorite ?? false };
  });

  async function handleAddIngredient(e: Event) {
    e.preventDefault();
    if (!meal || !addName.trim()) return;

    const ingredientName = addName.trim();
    const ingredientCategory = addCategory.trim() || 'Divers';

    const newIng: MealIngredient = {
      id: uuidv4(),
      name: ingredientName,
      category: ingredientCategory,
      quantity: addQty,
      unit: addUnit.trim(),
    };

    meal.ingredients = [...meal.ingredients, newIng];
    await updateMealInSync(meal.id, { ingredients: meal.ingredients });

    const allIngredients: Item[] = get(syncItems) || [];
    const existing = allIngredients.find(i => i.name.toLowerCase() === ingredientName.toLowerCase());

    if (!existing) {
      await addItem({
        id: uuidv4(),
        name: ingredientName,
        category: ingredientCategory,
        isBought: true,
      });
    }

    addName = '';
    addCategory = '';
    addQty = 1;
    addUnit = '';
  }

  async function removeIngredient(ingId: string) {
    if (!meal) return;
    meal.ingredients = meal.ingredients.filter(i => i.id !== ingId);
    await updateMealInSync(meal.id, { ingredients: meal.ingredients });
  }
</script>

{#if meal}
  <div class="flex flex-col h-full min-h-0">
    <header class="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-4 shrink-0 shadow-sm flex items-center gap-3">
      <a href="/meals" class="p-2 -ml-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft class="w-5 h-5" />
      </a>
      <input type="text" bind:value={meal.name} onchange={() => updateMealInSync(meal!.id, { name: meal!.name })} class="text-xl font-bold tracking-tight bg-transparent border-none outline-none focus:ring-0 w-full" />
    </header>

    <main class="flex-1 overflow-y-auto p-4 space-y-4 pb-32 bg-muted/20">
      <h2 class="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1">Ingrédients du repas</h2>

      {#if meal.ingredients.length === 0}
        <div class="text-center text-muted-foreground mt-8">
          <p>Aucun ingrédient pour ce repas.</p>
        </div>
      {:else}
        <div class="bg-card border rounded-2xl shadow-sm overflow-hidden divide-y divide-border/50">
          {#each meal.ingredients as ing}
            <div class="flex items-center gap-3 p-4 transition-colors hover:bg-muted/30">
              <div class="flex-1">
                <div class="font-medium flex items-center gap-2">
                  {ing.name}
                  <span class="text-[10px] bg-muted px-2 py-0.5 rounded-md font-normal text-muted-foreground">{ing.category}</span>
                </div>
                {#if ing.quantity}
                  <div class="text-sm text-primary font-semibold mt-0.5">{ing.quantity} {ing.unit}</div>
                {/if}
              </div>
              <button class="text-destructive/50 hover:text-destructive p-2 hover:bg-destructive/10 rounded-full" onclick={() => removeIngredient(ing.id)}>
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </main>

    <footer class="mt-auto bg-background border-t p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] shrink-0 z-10 pb-6">
      <form onsubmit={handleAddIngredient} class="flex flex-col gap-2 max-w-md mx-auto">
        <div class="flex gap-2">
          <Input bind:value={addName} placeholder="Ex: Pâtes" class="flex-1 h-12 rounded-xl" required />
          <Input bind:value={addCategory} placeholder="Rayon" class="w-1/3 h-12 rounded-xl text-sm" />
        </div>
        <div class="flex gap-2">
          <Input type="number" bind:value={addQty} min="0.1" step="0.1" class="w-1/4 h-12 rounded-xl text-center" required />
          <Input bind:value={addUnit} placeholder="Unité (g, kg..)" class="flex-1 h-12 rounded-xl text-sm" />
          <Button type="submit" size="icon" class="h-12 w-12 rounded-xl shrink-0">
            <ArrowUp class="w-6 h-6" />
          </Button>
        </div>
      </form>
    </footer>
  </div>
{:else}
  <div class="flex items-center justify-center h-full min-h-[50dvh] text-muted-foreground">
    <div class="flex flex-col items-center gap-2">
      <div class="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      <p>Chargement du repas...</p>
    </div>
  </div>
{/if}
