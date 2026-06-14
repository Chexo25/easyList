<script lang="ts">
  import { syncMeals, addMealToSync, deleteMealFromSync, saveItems, currentListId, items as syncItems } from '$lib/store/shopping';  import { get } from 'svelte/store';
  import { toast } from 'svelte-sonner';
  import type { Meal } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Plus } from 'lucide-svelte';
  import MealCard from '$lib/components/meals/MealCard.svelte';
  import { mergeOrCreateItem } from '$lib/utils/mergeItems';
  import type { MealType } from '$lib/types';

  let meals = $derived(
    Array.from(new Map(($syncMeals || []).map(m => [m.id, m])).values())
      .map(m => ({
        ...m,
        ingredients: m.ingredients || [],
        isFavorite: m.isFavorite ?? false,
      }))
  );

  const typeOptions = ['Tous', 'Entrée', 'Plat', 'Plat à emporter', 'Dessert', 'Goûter'] as const;
  
  let newMealName = $state('');
  let filterFavoriteOnly = $state(false);
  let filterType: typeof typeOptions[number] = $state('Tous');
  let displayedMeals = $derived(
    meals.filter(m => {
      if (filterFavoriteOnly && !m.isFavorite) return false;
      if (filterType !== 'Tous' && m.type !== filterType) return false;
      return true;
    })
  );

  async function handleCreateMeal(e: Event) {
    e.preventDefault();
    if (!newMealName.trim()) return;

    const listId = get(currentListId);

    if (!listId) {
      toast.error('Créez d\'abord une liste de courses dans l\'onglet Listes.');
      return;
    }

    const newMeal = {
      id: crypto.randomUUID(),
      listId,
      name: newMealName.trim(),
      ingredients: [],
      createdAt: new Date().toISOString(),
      isFavorite: false,
      type: null as MealType
    };

    await addMealToSync(newMeal);
    newMealName = '';
  }

  async function deleteMeal(id: string) {
    meals = meals.filter(m => m.id !== id);
    await deleteMealFromSync(id);
  }

  async function addMealToShopping(meal: Meal) {
    let current = [...($syncItems || [])];

    for (const ming of meal.ingredients) {
      current = mergeOrCreateItem(current, ming.name, ming.category, ming.quantity || 1, ming.unit || '', meal.name, $currentListId);
    }

    await saveItems(current);
    toast.success(`"${meal.name}" ajouté à la liste de courses !`);
  }
  
</script>

<div class="flex flex-col h-full min-h-0">
  <header class="sticky top-0 z-20 bg-background/95 backdrop-blur border-b shadow-sm pb-4">
    <div class="px-4 py-4">
      <h1 class="text-xl font-bold tracking-tight text-center">Mes Repas</h1>
    </div>
    <div class="px-4">
      <form onsubmit={handleCreateMeal} class="flex gap-2 w-full max-w-md mx-auto">
        <Input bind:value={newMealName} placeholder="Nouveau repas (ex: Pâtes Bolo..)" class="flex-1 h-12 rounded-xl text-base" required />
        <Button type="submit" size="icon" class="h-12 w-12 rounded-xl shrink-0">
          <Plus class="w-6 h-6" />
        </Button>
      </form>
    </div>
  </header>

  <main class="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
    {#if meals.length > 0}
      <div class="flex flex-col gap-3 pb-2 border-b border-border/50">
        <label class="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" bind:checked={filterFavoriteOnly} class="rounded border-border text-primary accent-primary focus:ring-primary h-4 w-4" />
          <span class="font-medium">Uniquement Favoris</span>
        </label>
        <div class="flex flex-wrap gap-2">
          {#each typeOptions as opt}
            <button
              class="px-3 py-1 text-xs font-medium rounded-full border transition-colors {filterType === opt ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-muted-foreground'}"
              onclick={() => filterType = opt}
            >
              {opt}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if displayedMeals.length === 0}
      <div class="text-center text-muted-foreground mt-10">
        {#if meals.length === 0}
          <p class="text-lg font-medium">Aucun repas.</p>
          <p class="text-sm mt-1">Créez votre premier menu en haut !</p>
        {:else}
          <p class="text-lg font-medium">Aucun résultat pour ces filtres.</p>
        {/if}
      </div>
    {:else}
      {#each displayedMeals as meal (meal.id)}
        <MealCard {meal} onDelete={deleteMeal} onAddToCart={addMealToShopping} />
      {/each}
    {/if}
  </main>
</div>
