<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import type { Meal, ShoppingListItem } from '$lib/db';

  const categories = [
    'légumes',
    'viande',
    'poisson',
    'produits laitiers',
    'féculents',
    'fruits',
    'épices',
    'autres'
  ];

  let meals: Meal[] = [];
  let selectedMealIds: Set<string> = new Set();
  let shoppingList: ShoppingListItem[] = [];
  let groupedList: Record<string, ShoppingListItem[]> = {};
  let generated = false;
  let loading = true;
  let generating = false;
  let error = '';

  async function loadMeals() {
    if (!browser) return;
    try {
      meals = await db.meals.orderBy('name').toArray();
    } catch (e) {
      error = 'Erreur lors du chargement des repas.';
    } finally {
      loading = false;
    }
  }

  function toggleMeal(id: string) {
    const next = new Set(selectedMealIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedMealIds = next;
  }

  async function generateList() {
    if (selectedMealIds.size === 0) return;
    generating = true;
    generated = false;
    shoppingList = [];
    error = '';
    try {
      const mealIds = Array.from(selectedMealIds);
      const allMealIngredients = await db.mealIngredients
        .where('mealId')
        .anyOf(mealIds)
        .toArray();

      const ingredientIds = [...new Set(allMealIngredients.map((mi) => mi.ingredientId))];
      const ingredients = await db.ingredients.where('id').anyOf(ingredientIds).toArray();
      const ingMap = new Map(ingredients.map((i) => [i.id, i]));

      // Aggregate by ingredientId + unit
      const aggregated = new Map<string, ShoppingListItem>();
      for (const mi of allMealIngredients) {
        const key = `${mi.ingredientId}__${mi.unit}`;
        const ing = ingMap.get(mi.ingredientId);
        if (!ing) continue;
        if (aggregated.has(key)) {
          aggregated.get(key)!.quantity += mi.quantity;
        } else {
          aggregated.set(key, {
            ingredientId: mi.ingredientId,
            ingredientName: ing.name,
            category: ing.category,
            quantity: mi.quantity,
            unit: mi.unit
          });
        }
      }

      shoppingList = Array.from(aggregated.values()).sort((a, b) =>
        a.ingredientName.localeCompare(b.ingredientName)
      );

      groupedList = shoppingList.reduce(
        (acc, item) => {
          const cat = item.category || 'autres';
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(item);
          return acc;
        },
        {} as Record<string, ShoppingListItem[]>
      );

      generated = true;
    } catch (e) {
      error = 'Erreur lors de la génération.';
    } finally {
      generating = false;
    }
  }

  onMount(loadMeals);
</script>

<div class="space-y-6">
  <h2 class="text-2xl font-bold text-gray-800">Liste de courses</h2>

  <!-- Meal selection -->
  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
    <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wide">Sélectionner les repas</h3>

    {#if loading}
      <p class="text-gray-400 text-sm text-center py-4">Chargement…</p>
    {:else if meals.length === 0}
      <p class="text-gray-400 text-sm text-center py-4">
        Aucun repas disponible.
        <a href="/meals" class="text-emerald-600 hover:underline">Créer des repas</a>
      </p>
    {:else}
      <div class="space-y-2">
        {#each meals as meal (meal.id)}
          <label
            class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition
              {selectedMealIds.has(meal.id ?? '') ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-transparent hover:bg-gray-100'}"
          >
            <input
              type="checkbox"
              checked={selectedMealIds.has(meal.id ?? '')}
              on:change={() => meal.id && toggleMeal(meal.id)}
              class="w-4 h-4 accent-emerald-600"
            />
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">{meal.name}</p>
              {#if meal.description}
                <p class="text-xs text-gray-400 truncate">{meal.description}</p>
              {/if}
            </div>
          </label>
        {/each}
      </div>

      <button
        on:click={generateList}
        disabled={selectedMealIds.size === 0 || generating}
        class="w-full bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? 'Génération…' : '🛒 Générer la liste'}
      </button>
    {/if}
  </div>

  {#if error}
    <p class="text-red-500 text-sm">{error}</p>
  {/if}

  <!-- Generated shopping list -->
  {#if generated}
    {#if shoppingList.length === 0}
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
        <p class="text-gray-400 text-sm">Les repas sélectionnés n'ont pas d'ingrédients.</p>
      </div>
    {:else}
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-800">📋 Votre liste</h3>
          <span class="text-xs text-gray-400">{shoppingList.length} article{shoppingList.length > 1 ? 's' : ''}</span>
        </div>

        {#each categories as cat}
          {#if groupedList[cat] && groupedList[cat].length > 0}
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div class="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">{cat}</span>
              </div>
              <ul class="divide-y divide-gray-50">
                {#each groupedList[cat] as item}
                  <li class="flex items-center justify-between px-4 py-3">
                    <span class="text-sm font-medium text-gray-800">{item.ingredientName}</span>
                    <span class="text-sm text-emerald-700 font-semibold">
                      {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)}
                      {item.unit}
                    </span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  {/if}
</div>
