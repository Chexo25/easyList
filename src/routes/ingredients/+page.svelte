<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import type { Ingredient } from '$lib/db';

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

  let ingredients: Ingredient[] = [];
  let newName = '';
  let newCategory = categories[0];
  let loading = true;
  let error = '';

  async function loadIngredients() {
    if (!browser) return;
    try {
      ingredients = await db.ingredients.orderBy('name').toArray();
    } catch (e) {
      error = 'Erreur lors du chargement des ingrédients.';
    } finally {
      loading = false;
    }
  }

  async function addIngredient() {
    if (!newName.trim()) return;
    try {
      await db.ingredients.add({
        id: crypto.randomUUID(),
        name: newName.trim(),
        category: newCategory
      });
      newName = '';
      await loadIngredients();
    } catch (e) {
      error = "Erreur lors de l'ajout.";
    }
  }

  async function deleteIngredient(id: string) {
    try {
      await db.ingredients.delete(id);
      await loadIngredients();
    } catch (e) {
      error = 'Erreur lors de la suppression.';
    }
  }

  function groupByCategory(list: Ingredient[]): Record<string, Ingredient[]> {
    return list.reduce(
      (acc, ing) => {
        const cat = ing.category || 'autres';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(ing);
        return acc;
      },
      {} as Record<string, Ingredient[]>
    );
  }

  $: grouped = groupByCategory(ingredients);

  onMount(loadIngredients);
</script>

<div class="space-y-6">
  <h2 class="text-2xl font-bold text-gray-800">Ingrédients</h2>

  <!-- Add form -->
  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
    <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wide">Ajouter un ingrédient</h3>
    <div class="flex gap-2">
      <input
        bind:value={newName}
        placeholder="Nom de l'ingrédient"
        class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        on:keydown={(e) => e.key === 'Enter' && addIngredient()}
      />
      <select
        bind:value={newCategory}
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
      >
        {#each categories as cat}
          <option value={cat}>{cat}</option>
        {/each}
      </select>
    </div>
    <button
      on:click={addIngredient}
      disabled={!newName.trim()}
      class="w-full bg-emerald-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      + Ajouter
    </button>
  </div>

  {#if error}
    <p class="text-red-500 text-sm">{error}</p>
  {/if}

  <!-- Ingredient list grouped by category -->
  {#if loading}
    <p class="text-gray-400 text-center py-8">Chargement…</p>
  {:else if ingredients.length === 0}
    <p class="text-gray-400 text-center py-8">Aucun ingrédient pour l'instant.</p>
  {:else}
    {#each categories as cat}
      {#if grouped[cat] && grouped[cat].length > 0}
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">{cat}</span>
          </div>
          <ul class="divide-y divide-gray-50">
            {#each grouped[cat] as ing (ing.id)}
              <li class="flex items-center justify-between px-4 py-3">
                <span class="text-sm text-gray-800 font-medium">{ing.name}</span>
                <button
                  on:click={() => ing.id && deleteIngredient(ing.id)}
                  class="text-red-400 hover:text-red-600 transition text-xs font-medium px-2 py-1 rounded-lg hover:bg-red-50"
                  aria-label="Supprimer {ing.name}"
                >
                  Supprimer
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    {/each}
  {/if}
</div>
