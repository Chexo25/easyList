<script lang="ts">
  import { get } from 'svelte/store';
  import { tick } from 'svelte';
  import { v4 as uuidv4 } from 'uuid';
  import { updateMealInSync, items as syncItems, addItem } from '$lib/store/shopping';
  import type { Meal, MealIngredient, Item } from '$lib/types';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Trash2, Plus, ShoppingCart, ChevronDown, ChevronUp, Check, Star, Pencil } from 'lucide-svelte';
  import { categories as defaultCategories } from '$lib/data/categories';
  import { searchLocalProducts, type Product } from '$lib/data/products';

  let { meal, onDelete, onAddToCart } = $props<{
    meal: Meal;
    onDelete: (id: string) => void;
    onAddToCart: (meal: Meal) => void;
  }>();

  const typeOptions = ['Entrée', 'Plat', 'Plat à emporter', 'Dessert', 'Goûter'];

  let addName = $state('');
  let addCategory = $state('');
  let addQty: number | undefined = $state();
  let addUnit = $state('');
  let isExpanded = $state(true);

  let editingIngredient: MealIngredient | null = $state(null);
  let editCategory = $state('');
  let editQty: number | undefined = $state();
  let editUnit = $state('');
  let showEditCategorySuggestions = $state(false);

  let filteredEditCategories = $derived(
    editCategory.trim()
      ? defaultCategories.filter(c => c.toLowerCase().includes(editCategory.toLowerCase()))
      : defaultCategories
  );

  function selectEditCategory(cat: string) {
    editCategory = cat;
    showEditCategorySuggestions = false;
  }

  function openEdit(ing: MealIngredient) {
    editingIngredient = ing;
    editCategory = ing.category || 'Autre';
    editQty = ing.quantity ?? undefined;
    editUnit = ing.unit || '';
  }

  async function saveEdit() {
    if (!editingIngredient) return;
    meal.ingredients = meal.ingredients.map((i: MealIngredient) =>
      i.id === editingIngredient!.id
        ? { ...i, category: editCategory || 'Autre', quantity: editQty ?? null, unit: editQty ? editUnit : '' }
        : i
    );
    await updateMealInSync(meal.id, { ingredients: meal.ingredients });
    editingIngredient = null;
  }

  let showSuggestions = $state(false);
  let showCategorySuggestions = $state(false);
  let apiProducts = $state<Product[]>([]);
  let isLoadingApi = $state(false);

  let knownProducts = $state<{ name: string; category: string }[]>([]);

  $effect(() => {
    const all: Item[] = get(syncItems) || [];
    knownProducts = Array.from(
      new Map(all.map(i => [i.name.toLowerCase(), { name: i.name, category: i.category }])).values()
    );
  });

  $effect(() => {
    const q = addName.trim();
    if (q.length < 2) {
      apiProducts = [];
      isLoadingApi = false;
      return;
    }
    const timeout = setTimeout(async () => {
      isLoadingApi = true;
      const res = await searchLocalProducts(q);
      if (addName.trim() === q) {
        apiProducts = res;
        isLoadingApi = false;
      }
    }, 400);
    return () => clearTimeout(timeout);
  });

  let filteredProducts = $derived(
    addName.trim() ? knownProducts.filter(p => p.name.toLowerCase().includes(addName.toLowerCase())) : []
  );

  let displayApiProducts = $derived(
    apiProducts.filter(apiP => !filteredProducts.some(fp => fp.name.toLowerCase() === apiP.name.toLowerCase()))
  );

  let filteredCategories = $derived(
    addCategory.trim()
      ? defaultCategories.filter(c => c.toLowerCase().includes(addCategory.toLowerCase()))
      : defaultCategories
  );

  async function selectProduct(product: { name: string; category: string }) {
    addName = product.name;
    addCategory = product.category;
    showSuggestions = false;
    await handleAddIngredient();
  }

  function selectCategory(cat: string) {
    addCategory = cat;
    showCategorySuggestions = false;
  }

  let addNameInput: HTMLInputElement | null = $state(null);

  let hasFocused = false;
  $effect(() => {
    if (addNameInput && !hasFocused && meal.createdAt && Date.now() - new Date(meal.createdAt).getTime() < 2000) {
      setTimeout(() => addNameInput?.focus(), 100);
      hasFocused = true;
    }
  });

  async function handleAddIngredient(e?: Event) {
    if (e) e.preventDefault();
    if (!addName.trim()) return;

    const ingredientName = addName.trim();
    const ingredientCategory = addCategory.trim() || 'Divers';

    const newIng: MealIngredient = {
      id: uuidv4(),
      name: ingredientName,
      category: ingredientCategory,
      quantity: addQty ?? null,
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
    addQty = undefined;
    addUnit = '';
    showSuggestions = false;
    showCategorySuggestions = false;
  }

  async function removeIngredient(ingId: string) {
    meal.ingredients = meal.ingredients.filter((i: MealIngredient) => i.id !== ingId);
    await updateMealInSync(meal.id, { ingredients: meal.ingredients });
  }
</script>

<div class="bg-card border rounded-2xl shadow-sm p-4 space-y-3 relative group {meal.isFavorite ? 'border-primary/50 bg-primary/5' : ''}">
  <div class="flex flex-col gap-2">
    <div class="flex justify-between items-start gap-4">
      <div class="flex-1 flex flex-col items-start gap-1">
        <input
          type="text"
          bind:value={meal.name}
          onchange={() => updateMealInSync(meal.id, { name: meal.name })}
          class="font-bold text-lg bg-transparent border-none outline-none focus:ring-0 w-full p-0"
        />
        <button
          class="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground no-underline"
          onclick={() => isExpanded = !isExpanded}
        >
          {meal.ingredients.length} ingrédient(s)
          {#if isExpanded}
            <ChevronUp class="w-3 h-3" />
          {:else}
            <ChevronDown class="w-3 h-3" />
          {/if}
        </button>
      </div>

      <div class="flex gap-1 shrink-0">
        <button
          class="p-2 rounded-full transition-colors {meal.isFavorite ? 'text-yellow-500 hover:bg-yellow-500/10' : 'text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10'}"
          onclick={() => { meal.isFavorite = !meal.isFavorite; updateMealInSync(meal.id, { isFavorite: meal.isFavorite }); }}
          title={meal.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Star class="w-4 h-4 {meal.isFavorite ? 'fill-current' : ''}" />
        </button>
        <button class="text-primary hover:text-primary/70 p-2 bg-primary/10 rounded-full" onclick={() => onAddToCart(meal)} title="Ajouter aux courses">
          <ShoppingCart class="w-4 h-4" />
        </button>
        <button class="text-destructive/50 hover:text-destructive p-2 hover:bg-destructive/10 rounded-full" onclick={() => onDelete(meal.id)} title="Supprimer le repas">
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
    </div>
    <div class="flex flex-wrap gap-1">
      {#each typeOptions as tOpt}
        <button
          class="text-[10px] px-2 py-0.5 rounded-md transition-colors border {meal.type === tOpt ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground hover:bg-primary/20'}"
          onclick={() => {
            meal.type = meal.type === tOpt ? undefined : tOpt;
            updateMealInSync(meal.id, { type: meal.type });
          }}
        >
          {tOpt}
        </button>
      {/each}
    </div>
  </div>

  {#if isExpanded}
    <div class="space-y-3 pt-2">
      <div class="space-y-2">
        {#each meal.ingredients as ing}
          <div class="flex items-center justify-between bg-muted/30 p-2 rounded-lg text-sm transition-colors hover:bg-muted/50">
            <div class="flex items-center gap-2 flex-1 flex-wrap">
              <span class="font-medium">{ing.name}</span>
              <span class="text-[10px] bg-muted px-2 py-0.5 rounded-md text-muted-foreground border">{ing.category}</span>
              {#if ing.quantity}
                <span class="text-primary font-semibold">{ing.quantity} {ing.unit}</span>
              {/if}
            </div>
            <div class="flex items-center space-x-1 shrink-0">
              <button type="button" class="text-primary/50 hover:text-primary p-1 bg-transparent hover:bg-primary/10 rounded-full transition-colors" onclick={() => openEdit(ing)}>
                <Pencil class="w-4 h-4" />
              </button>
              <button type="button" class="text-destructive/50 hover:text-destructive p-1 bg-transparent hover:bg-destructive/10 rounded-full transition-colors" onclick={() => removeIngredient(ing.id)}>
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        {/each}
      </div>

      <form onsubmit={handleAddIngredient} class="flex flex-col gap-2 pt-2 border-t border-border/50 relative">
        <div class="flex gap-2 relative">
          <div class="flex-1 relative">
            <Input bind:ref={addNameInput} bind:value={addName} onfocus={() => showSuggestions = true} placeholder="Ingredient (ex: Tomates)" class="w-full h-10 rounded-lg text-sm focus:ring-1" required autocomplete="off" />
          </div>
          <div class="w-1/3 relative">
            <Input bind:value={addCategory} onfocus={() => showCategorySuggestions = true} placeholder="Rayon" class="w-full h-10 rounded-lg text-sm" autocomplete="off" />
            {#if showCategorySuggestions}
              <div class="absolute right-0 left-[-100px] bottom-full mb-1 bg-card border rounded-xl shadow-lg z-40 overflow-hidden max-h-48 overflow-y-auto">
                {#if filteredCategories.length === 0}
                  <div class="px-3 py-2 text-sm text-muted-foreground text-center">Nouveau rayon...</div>
                {:else}
                  {#each filteredCategories as cat}
                    <button type="button" class="w-full text-left px-3 py-2 hover:bg-muted transition-colors text-sm border-b border-border/50 last:border-0 flex items-center justify-between" onclick={() => selectCategory(cat)}>
                      {cat}
                      {#if cat === addCategory}
                        <Check class="w-3.5 h-3.5 text-primary" />
                      {/if}
                    </button>
                  {/each}
                {/if}
              </div>
            {/if}
          </div>
        </div>

        {#if showSuggestions && addName.trim().length > 0}
          <div class="absolute left-0 right-0 bottom-full mb-1 bg-card border rounded-xl shadow-lg z-30 overflow-hidden max-h-48 overflow-y-auto">
            {#if !knownProducts.some(p => p.name.toLowerCase() === addName.trim().toLowerCase())}
              <button type="button" class="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 border-b border-border/50 bg-primary/5 text-primary" onclick={() => handleAddIngredient()}>
                <Plus class="w-4 h-4" />
                <span class="font-medium text-sm">Créer "{addName.trim()}"</span>
              </button>
            {/if}

            {#if filteredProducts.length > 0}
              <div class="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2 bg-muted/30">Suggestions</div>
              {#each filteredProducts as sp}
                <button type="button" class="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 border-b border-border/50 last:border-0" onclick={() => selectProduct(sp)}>
                  <span class="font-medium text-sm">{sp.name}</span>
                  {#if sp.category}
                    <span class="text-[10px] bg-background border px-2 py-0.5 rounded-md text-muted-foreground">{sp.category}</span>
                  {/if}
                </button>
              {/each}
            {/if}

            {#if displayApiProducts.length > 0}
              <div class="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2 bg-muted/30 flex justify-between items-center">
                <span>Suggestions</span>
                {#if isLoadingApi}
                  <span class="w-3 h-3 border-2 border-primary/50 border-t-primary rounded-full animate-spin"></span>
                {/if}
              </div>
              {#each displayApiProducts as sp}
                <button type="button" class="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 border-b border-border/50 last:border-0" onclick={() => selectProduct(sp)}>
                  <span class="font-medium text-sm">{sp.name}</span>
                  {#if sp.category}
                    <span class="text-[10px] bg-background border px-2 py-0.5 rounded-md text-muted-foreground">{sp.category}</span>
                  {/if}
                </button>
              {/each}
            {:else if isLoadingApi && addName.trim().length >= 2}
              <div class="px-3 py-4 text-xs text-muted-foreground text-center border-b border-border/50 last:border-0 flex items-center justify-center gap-2">
                <span class="w-3 h-3 border-2 border-primary/50 border-t-primary rounded-full animate-spin"></span>
                Recherche...
              </div>
            {/if}
          </div>
        {/if}

        {#if showSuggestions && addName.trim().length > 0 || showCategorySuggestions}
          <div class="fixed inset-0 z-20" aria-hidden="true" onclick={() => { showSuggestions = false; showCategorySuggestions = false; }}></div>
        {/if}

        <div class="flex gap-2">
          <Input type="number" bind:value={addQty} min="0.1" step="0.1" placeholder="Qté" class="w-1/3 h-10 rounded-lg text-sm text-center" />
          <Input bind:value={addUnit} placeholder="Unité (g, kg..)" class="flex-1 h-10 rounded-lg text-sm" />
          <Button type="submit" size="icon" class="h-10 w-10 rounded-lg shrink-0" onclick={() => showSuggestions = false}>
            <Plus class="w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>
  {/if}
</div>

<Dialog.Root open={!!editingIngredient} onOpenChange={(o) => { if (!o) editingIngredient = null; }}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Modifier {editingIngredient?.name}</Dialog.Title>
    </Dialog.Header>
    <div class="space-y-4 pt-4">
      <div class="space-y-2 relative">
        <Label>Rayon / Catégorie</Label>
        <Input bind:value={editCategory} placeholder="Ex: Fruits & Légumes" onfocus={() => showEditCategorySuggestions = true} onblur={() => setTimeout(() => showEditCategorySuggestions = false, 200)} autocomplete="off" />
        {#if showEditCategorySuggestions}
          <div class="absolute left-0 right-0 bottom-[60px] mb-1 bg-card border rounded-xl shadow-lg z-50 overflow-hidden max-h-48 overflow-y-auto">
            {#if filteredEditCategories.length === 0}
              <div class="px-3 py-2 text-sm text-muted-foreground text-center">Nouveau rayon...</div>
            {:else}
              {#each filteredEditCategories as cat}
                <button type="button" class="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors text-sm border-b border-border/50 last:border-0 flex items-center justify-between" onclick={() => selectEditCategory(cat)}>
                  {cat}
                  {#if cat === editCategory}
                    <Check class="w-3.5 h-3.5 text-primary" />
                  {/if}
                </button>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
      <div class="flex gap-2">
        <div class="flex-1 space-y-2">
          <Label>Quantité</Label>
          <Input type="number" min="0.1" step="0.1" bind:value={editQty} placeholder="Ex: 2" />
        </div>
        <div class="flex-1 space-y-2">
          <Label>Unité</Label>
          <Input bind:value={editUnit} placeholder="Ex: kg, L, boîtes" />
        </div>
      </div>
      <Button class="w-full mt-4" onclick={saveEdit}>Enregistrer</Button>
    </div>
  </Dialog.Content>
</Dialog.Root>
