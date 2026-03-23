<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { db } from '$lib/db';
  import type { Meal, Ingredient, MealIngredient } from '$lib/db';

  const units = ['g', 'kg', 'ml', 'L', 'unité', 'c.à.s', 'c.à.c'];

  let meal: Meal | undefined;
  let mealIngredients: (MealIngredient & { ingredientName: string; category: string })[] = [];
  let allIngredients: Ingredient[] = [];

  let selectedIngredientId = '';
  let quantity = 1;
  let unit = units[0];
  let loading = true;
  let error = '';

  const mealId = $page.params.id;

  async function load() {
    if (!browser) return;
    try {
      meal = await db.meals.get(mealId);
      allIngredients = await db.ingredients.orderBy('name').toArray();

      const mis = await db.mealIngredients.where('mealId').equals(mealId).toArray();
      mealIngredients = mis.map((mi) => {
        const ing = allIngredients.find((i) => i.id === mi.ingredientId);
        return {
          ...mi,
          ingredientName: ing?.name ?? 'Ingrédient inconnu',
          category: ing?.category ?? 'autres'
        };
      });

      if (allIngredients.length > 0 && !selectedIngredientId) {
        selectedIngredientId = allIngredients[0].id ?? '';
      }
    } catch (e) {
      error = 'Erreur lors du chargement.';
    } finally {
      loading = false;
    }
  }

  async function addIngredientToMeal() {
    if (!selectedIngredientId || quantity <= 0) return;
    try {
      await db.mealIngredients.add({
        id: crypto.randomUUID(),
        mealId,
        ingredientId: selectedIngredientId,
        quantity,
        unit
      });
      quantity = 1;
      await load();
    } catch (e) {
      error = "Erreur lors de l'ajout.";
    }
  }

  async function removeMealIngredient(id: string) {
    try {
      await db.mealIngredients.delete(id);
      await load();
    } catch (e) {
      error = 'Erreur lors de la suppression.';
    }
  }

  onMount(load);
</script>

<div class="space-y-6">
  {#if loading}
    <p class="text-gray-400 text-center py-8">Chargement…</p>
  {:else if !meal}
    <div class="text-center py-12">
      <p class="text-gray-500">Repas introuvable.</p>
      <a href="/meals" class="text-emerald-600 text-sm mt-2 inline-block hover:underline">← Retour</a>
    </div>
  {:else}
    <div class="flex items-center gap-3">
      <a href="/meals" class="text-emerald-600 hover:text-emerald-800 transition text-sm">←</a>
      <div>
        <h2 class="text-2xl font-bold text-gray-800">{meal.name}</h2>
        {#if meal.description}
          <p class="text-sm text-gray-500 mt-0.5">{meal.description}</p>
        {/if}
      </div>
    </div>

    <!-- Add ingredient form -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wide">Ajouter un ingrédient</h3>

      {#if allIngredients.length === 0}
        <p class="text-sm text-gray-400">
          Aucun ingrédient disponible.
          <a href="/ingredients" class="text-emerald-600 hover:underline">Créer des ingrédients</a>
        </p>
      {:else}
        <div class="flex gap-2 flex-wrap">
          <select
            bind:value={selectedIngredientId}
            class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          >
            {#each allIngredients as ing (ing.id)}
              <option value={ing.id}>{ing.name}</option>
            {/each}
          </select>
          <input
            type="number"
            bind:value={quantity}
            min="0.1"
            step="0.1"
            class="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <select
            bind:value={unit}
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          >
            {#each units as u}
              <option value={u}>{u}</option>
            {/each}
          </select>
        </div>
        <button
          on:click={addIngredientToMeal}
          class="w-full bg-emerald-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-emerald-700 transition"
        >
          + Ajouter
        </button>
      {/if}
    </div>

    {#if error}
      <p class="text-red-500 text-sm">{error}</p>
    {/if}

    <!-- Ingredients in this meal -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-4 py-2 bg-gray-50 border-b border-gray-100">
        <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Ingrédients du repas</span>
      </div>
      {#if mealIngredients.length === 0}
        <p class="text-gray-400 text-center py-8 text-sm">Aucun ingrédient ajouté.</p>
      {:else}
        <ul class="divide-y divide-gray-50">
          {#each mealIngredients as mi (mi.id)}
            <li class="flex items-center justify-between px-4 py-3">
              <div>
                <span class="text-sm font-medium text-gray-800">{mi.ingredientName}</span>
                <span class="text-xs text-gray-400 ml-2">{mi.quantity} {mi.unit}</span>
                <span class="text-xs text-gray-300 ml-2">· {mi.category}</span>
              </div>
              <button
                on:click={() => mi.id && removeMealIngredient(mi.id)}
                class="text-red-400 hover:text-red-600 transition text-xs font-medium px-2 py-1 rounded-lg hover:bg-red-50"
                aria-label="Retirer l'ingrédient"
              >
                Retirer
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>
