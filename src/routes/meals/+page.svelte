<script lang="ts">
  import { onMount } from 'svelte';
  import { v4 as uuidv4 } from 'uuid';
  import { syncMeals, addMealToSync, updateMealInSync, deleteMealFromSync, saveItems, items as syncItems } from '$lib/shoppingSyncStore';
  import { get } from 'svelte/store';
  import { toast } from 'svelte-sonner';
  import type { Meal, Ingredient } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Plus } from 'lucide-svelte';
  import MealCard from './MealCard.svelte';

  let meals = $state<Meal[]>([]);
  $effect(() => {
    const unsub = syncMeals.subscribe(val => {
       meals = val.map(m => ({
          ...m,
          ingredients: m.ingredients || [],
          isFavorite: m.is_favorite
       }));
    });
    return unsub;
  });
  let newMealName = $state('');

  onMount(async () => {
    try {
      // meals is now managed by syncMeals subscription
    } catch (err) {
      console.warn('Tauri store ready in browser?', err);
    }
  });

  let filterFavoriteOnly = $state(false);
  let filterType = $state('Tous');
  const catOptions = ['Tous', 'Entrée', 'Plat', 'Plat à emporter', 'Dessert', 'Goûter'];

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
    
    const newMeal: Meal = {
      id: uuidv4(),
      name: newMealName.trim(),
      ingredients: [],
      createdAt: Date.now()
    };
    
    meals = [newMeal, ...meals]; // Add to top of the list
    newMealName = '';
    
    // Blur to allow the new card to take focus
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    try {
      await addMealToSync(newMeal);
    } catch(err) {
      console.warn('Could not save to Tauri:', err);
    }
  }

  async function deleteMeal(id: string) {
    meals = meals.filter(m => m.id !== id);
    await deleteMealFromSync(id);
  }

  // Temporary function for adding a meal directly to the shopping list
  async function addMealToShopping(meal: Meal) {
    let currentShopping = get(syncItems).map(i => ({...i, isBought: i.is_bought}));
    
    let toSave: Ingredient[] = [...currentShopping];
    
    for (const ming of meal.ingredients) {
      let activeIndex = toSave.findIndex(i => i.name.toLowerCase() === ming.name.toLowerCase() && !i.isBought);
      
      if (activeIndex !== -1) {
        // Increment active ingredient
        let exist = toSave[activeIndex];
        let q = (exist.quantity || 0) + (ming.quantity || 1);
        let linked = exist.linkedMeals || [];
        if (!linked.includes(meal.name)) linked.push(meal.name);
        
        toSave[activeIndex] = { ...exist, quantity: q, linkedMeals: linked, category: ming.category, unit: ming.unit || exist.unit };
      } else {
        // Look for bought ingredient to reactivate
        let boughtIndex = toSave.findIndex(i => i.name.toLowerCase() === ming.name.toLowerCase() && i.isBought);
        if (boughtIndex !== -1) {
          let exist = toSave[boughtIndex];
          let linked = [meal.name]; // Reset the meal links for this new shop session
          toSave[boughtIndex] = { ...exist, isBought: false, quantity: ming.quantity || 1, linkedMeals: linked, category: ming.category, unit: ming.unit || exist.unit };
        } else {
          // Add totally new
          toSave.push({
            id: uuidv4(),
            name: ming.name,
            category: ming.category,
            isBought: false,
            createdAt: Date.now(),
            quantity: ming.quantity || 1,
            unit: ming.unit || '',
            linkedMeals: [meal.name]
          });
        }
      }
    }
    
    await saveItems(toSave);
    toast.success(`"${meal.name}" ajouté à la liste de courses !`);
  }

</script>

<div class="flex flex-col h-full min-h-0">
  <header class="sticky top-0 z-20 bg-background/95 backdrop-blur border-b shadow-sm pb-4">
    <div class="px-4 py-4">
      <h1 class="text-xl font-bold tracking-tight text-center">Mes Repas</h1>
    </div>
    
    <!-- Input in the header for easier access -->
    <div class="px-4">
      <form onsubmit={handleCreateMeal} class="flex gap-2 w-full max-w-md mx-auto">
        <Input 
          bind:value={newMealName} 
          placeholder="Nouveau repas (ex: Pâtes Bolo..)" 
          class="flex-1 h-12 rounded-xl text-base" 
          required 
        />
        <Button type="submit" size="icon" class="h-12 w-12 rounded-xl shrink-0">
          <Plus class="w-6 h-6" />
        </Button>
      </form>
    </div>
  </header>

  <main class="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
    <!-- Filters -->
    {#if meals.length > 0}
      <div class="flex flex-col gap-3 pb-2 border-b border-border/50">
        <label class="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" bind:checked={filterFavoriteOnly} class="rounded border-border text-primary accent-primary focus:ring-primary h-4 w-4" />
          <span class="font-medium">Uniquement Favoris ⭐</span>
        </label>
        
        <div class="flex flex-wrap gap-2">
          {#each catOptions as opt}
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
        <MealCard bind:meal={meals[meals.findIndex(m => m.id === meal.id)]} onDelete={deleteMeal} onAddToCart={addMealToShopping} />
      {/each}
    {/if}
  </main>
</div>
