<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import type { Meal } from '$lib/db';

  let meals: Meal[] = [];
  let newName = '';
  let newDescription = '';
  let loading = true;
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

  async function addMeal() {
    if (!newName.trim()) return;
    try {
      await db.meals.add({
        id: crypto.randomUUID(),
        name: newName.trim(),
        description: newDescription.trim()
      });
      newName = '';
      newDescription = '';
      await loadMeals();
    } catch (e) {
      error = "Erreur lors de l'ajout.";
    }
  }

  async function deleteMeal(id: string) {
    try {
      await db.mealIngredients.where('mealId').equals(id).delete();
      await db.meals.delete(id);
      await loadMeals();
    } catch (e) {
      error = 'Erreur lors de la suppression.';
    }
  }

  onMount(loadMeals);
</script>

<div class="space-y-6">
  <h2 class="text-2xl font-bold text-gray-800">Repas</h2>

  <!-- Add form -->
  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
    <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wide">Créer un repas</h3>
    <input
      bind:value={newName}
      placeholder="Nom du repas"
      class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
      on:keydown={(e) => e.key === 'Enter' && addMeal()}
    />
    <textarea
      bind:value={newDescription}
      placeholder="Description (optionnelle)"
      rows="2"
      class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
    ></textarea>
    <button
      on:click={addMeal}
      disabled={!newName.trim()}
      class="w-full bg-emerald-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      + Créer
    </button>
  </div>

  {#if error}
    <p class="text-red-500 text-sm">{error}</p>
  {/if}

  <!-- Meal list -->
  {#if loading}
    <p class="text-gray-400 text-center py-8">Chargement…</p>
  {:else if meals.length === 0}
    <p class="text-gray-400 text-center py-8">Aucun repas pour l'instant.</p>
  {:else}
    <div class="space-y-3">
      {#each meals as meal (meal.id)}
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-start justify-between gap-3">
          <a href="/meals/{meal.id}" class="flex-1 min-w-0 group">
            <p class="font-semibold text-gray-800 group-hover:text-emerald-600 transition truncate">{meal.name}</p>
            {#if meal.description}
              <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">{meal.description}</p>
            {/if}
            <span class="text-xs text-emerald-600 mt-1 inline-block">Voir les ingrédients →</span>
          </a>
          <button
            on:click={() => meal.id && deleteMeal(meal.id)}
            class="text-red-400 hover:text-red-600 transition text-xs font-medium px-2 py-1 rounded-lg hover:bg-red-50 shrink-0"
            aria-label="Supprimer {meal.name}"
          >
            Supprimer
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
