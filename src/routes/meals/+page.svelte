<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { v4 as uuidv4 } from 'uuid';
  import * as Store from '$lib/store';
  import type { Meal, MealIngredient, Ingredient } from '$lib/store';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { ArrowUp, Trash2, Plus, ArrowRight, ShoppingCart } from 'lucide-svelte';

  let meals = $state<Meal[]>([]);

  onMount(async () => {
    try {
      meals = await Store.getMeals();
    } catch (err) {
      console.warn('Tauri store ready in browser?', err);
    }
  });

  async function handleCreateMeal() {
    const newMeal: Meal = {
      id: uuidv4(),
      name: 'Nouveau Repas',
      ingredients: [],
      createdAt: Date.now()
    };
    meals = [...meals, newMeal];
    await Store.addMeal(newMeal);
    goto(`/meals/${newMeal.id}`);
  }

  async function deleteMeal(id: string) {
    meals = meals.filter(m => m.id !== id);
    await Store.removeMeal(id);
  }

  // Temporary function for adding a meal directly to the shopping list
  async function addMealToShopping(meal: Meal) {
    let currentShopping = await Store.getIngredients();
    
    let toSave: Ingredient[] = [...currentShopping];
    
    for (const ming of meal.ingredients) {
      let existingIndex = toSave.findIndex(i => i.name.toLowerCase() === ming.name.toLowerCase() && !i.isBought);
      
      if (existingIndex !== -1) {
        // Increment
        let exist = toSave[existingIndex];
        let q = (exist.quantity || 1) + (ming.quantity || 1);
        let linked = exist.linkedMeals || [];
        if (!linked.includes(meal.name)) linked.push(meal.name);
        
        toSave[existingIndex] = { ...exist, quantity: q, linkedMeals: linked };
      } else {
        // Add new
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
    
    await Store.saveIngredients(toSave);
    alert(`"${meal.name}" ajouté à la liste de courses !`);
  }

</script>

<div class="flex flex-col h-[100dvh]">
  <header class="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-4 shrink-0 shadow-sm">
    <h1 class="text-xl font-bold tracking-tight text-center">Mes Repas</h1>
  </header>

  <main class="flex-1 overflow-y-auto p-4 space-y-4 pb-24 bg-muted/20">
    {#if meals.length === 0}
      <div class="text-center text-muted-foreground mt-10">
        <p class="text-lg font-medium">Aucun repas.</p>
        <p class="text-sm mt-1">Créez votre premier menu !</p>
      </div>
    {:else}
      {#each meals as meal}
        <div class="bg-card border rounded-2xl shadow-sm p-4 space-y-3 relative group">
          <div class="flex justify-between items-start">
            <h2 class="text-lg font-bold">{meal.name}</h2>
            <div class="flex gap-2">
              <button class="text-primary hover:text-primary/70 p-2 bg-primary/10 rounded-full" onclick={() => addMealToShopping(meal)} title="Ajouter aux courses">
                <ShoppingCart class="w-4 h-4" />
              </button>
              <button class="text-destructive/50 hover:text-destructive p-2 hover:bg-destructive/10 rounded-full" onclick={() => deleteMeal(meal.id)} title="Supprimer le repas">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div class="text-sm text-muted-foreground">
            {meal.ingredients.length} ingrédient(s)
          </div>
          
          <a href="/meals/{meal.id}" class="w-full flex items-center justify-center gap-2 bg-muted/50 hover:bg-muted py-2 rounded-xl text-sm font-medium transition-colors">
            Modifier le repas <ArrowRight class="w-4 h-4" />
          </a>
        </div>
      {/each}
    {/if}
  </main>

  <footer class="mt-auto bg-background border-t p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] shrink-0 z-10">
    <Button onclick={handleCreateMeal} class="w-full h-14 rounded-xl text-base font-semibold shadow-sm flex items-center justify-center gap-2">
      <Plus class="w-5 h-5" /> Créer un nouveau repas
    </Button>
  </footer>
</div>
