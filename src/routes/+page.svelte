<script lang="ts">
  import { onMount } from 'svelte';
  import { v4 as uuidv4 } from 'uuid';
  import * as Store from '$lib/store';
  import type { Ingredient, Meal } from '$lib/store';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Badge } from '$lib/components/ui/badge';
  import * as Dialog from '$lib/components/ui/dialog';
  import { ArrowUp, Trash2, Info, Plus, ChevronDown, Utensils, Check, Pencil } from 'lucide-svelte';
  import { categories as defaultCategories } from '$lib/categories';
  import { searchProductsOFF, type OFFProduct } from '$lib/openFoodFacts';

  let ingredients = $state<Ingredient[]>([]);
  let meals = $state<Meal[]>([]);
  let addName = $state('');
  let addCategory = $state('');
  let addQty = $state<number | undefined>();
  let addUnit = $state('');

  let editingIngredient = $state<Ingredient | null>(null);
  let editCategory = $state('');
  let editQty = $state<number | undefined>();
  let editUnit = $state('');

  function openEdit(item: Ingredient) {
    editingIngredient = item;
    editCategory = item.category || 'Autre';
    editQty = item.quantity;
    editUnit = item.unit || '';
  }

  async function saveEdit() {
    if (!editingIngredient) return;
    const updated = {
      category: editCategory || 'Autre',
      quantity: editQty,
      unit: editQty ? editUnit : ''
    };
    ingredients = ingredients.map(i => i.id === editingIngredient!.id ? { ...i, ...updated } : i);
    await Store.updateIngredient(editingIngredient.id, updated);
    editingIngredient = null;
  }

  let showSuggestions = $state(false);
  let showCategorySuggestions = $state(false);
  let showEditCategorySuggestions = $state(false);
  let apiProducts = $state<OFFProduct[]>([]);
  let isLoadingApi = $state(false);

  // Debounced API call for OpenFoodFacts
  $effect(() => {
    const q = addName.trim();
    if (q.length < 2) {
      apiProducts = [];
      isLoadingApi = false;
      return;
    }
    
    // Instead of resolving immediately, we debounce properly and return a cleanup function
    const searchTimeout = setTimeout(async () => {
      isLoadingApi = true;
      const res = await searchProductsOFF(q);
      // Only inject results if the field still matches the query (prevents late overwrite artifacts)
      if (addName.trim() === q) {
        apiProducts = res;
        isLoadingApi = false;
      }
    }, 400);

    return () => clearTimeout(searchTimeout);
  });

  onMount(async () => {
    try {
      ingredients = await Store.getIngredients();
      meals = await Store.getMeals();
    } catch (err) {
      console.warn('Tauri store might not be ready in browser:', err);
      ingredients = [];
      meals = [];
    }
  });

  // Extract unique custom ingredients for autocomplete
  let knownProducts = $derived(
    Array.from(new Map(ingredients.map(i => [i.name.toLowerCase(), { name: i.name, category: i.category }])).values())
  );

  let filteredProducts = $derived(
    addName.trim() ? knownProducts.filter(p => p.name.toLowerCase().includes(addName.toLowerCase())) : []
  );

  let filteredMeals = $derived(
    addName.trim() ? meals.filter(m => m.name.toLowerCase().includes(addName.toLowerCase())) : []
  );

  let filteredCategories = $derived(
    addCategory.trim() 
      ? defaultCategories.filter(c => c.toLowerCase().includes(addCategory.toLowerCase()))
      : defaultCategories
  );

  let filteredEditCategories = $derived(
    editCategory.trim() 
      ? defaultCategories.filter(c => c.toLowerCase().includes(editCategory.toLowerCase()))
      : defaultCategories
  );

  // Filter out apiProducts that are already in filteredProducts to avoid duplicates
  let displayApiProducts = $derived(
    apiProducts.filter(apiP => !filteredProducts.some(fp => fp.name.toLowerCase() === apiP.name.toLowerCase()))
  );

  async function selectProduct(product: { name: string, category: string }) {
    addName = product.name;
    addCategory = product.category;
    showSuggestions = false;
    await handleAdd();
  }

  function selectCategory(cat: string) {
    addCategory = cat;
    showCategorySuggestions = false;
  }

  function selectEditCategory(cat: string) {
    editCategory = cat;
    showEditCategorySuggestions = false;
  }

  async function selectMeal(meal: Meal) {
    for (const ming of meal.ingredients) {
      let activeIndex = ingredients.findIndex(i => i.name.toLowerCase() === ming.name.toLowerCase() && !i.isBought);
      if (activeIndex !== -1) {
        ingredients[activeIndex].quantity = (ingredients[activeIndex].quantity || 0) + (ming.quantity || 1);
        if (!ingredients[activeIndex].linkedMeals?.includes(meal.name)) {
          ingredients[activeIndex].linkedMeals = [...(ingredients[activeIndex].linkedMeals || []), meal.name];
        }
      } else {
        let boughtIndex = ingredients.findIndex(i => i.name.toLowerCase() === ming.name.toLowerCase() && i.isBought);
        if (boughtIndex !== -1) {
          ingredients[boughtIndex].isBought = false;
          ingredients[boughtIndex].quantity = ming.quantity || 1;
          if (!ingredients[boughtIndex].linkedMeals?.includes(meal.name)) {
            ingredients[boughtIndex].linkedMeals = [...(ingredients[boughtIndex].linkedMeals || []), meal.name];
          }
        } else {
          ingredients.push({
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
    await Store.saveIngredients(ingredients);
    addName = '';
    showSuggestions = false;
    alert(`"${meal.name}" ajouté à la liste de courses !`);
  }

  async function handleAdd(e?: Event) {
    if (e) e.preventDefault();
    if (!addName.trim()) return;

    const ingredientName = addName.trim();
    const finalCategory = addCategory.trim() || 'Divers';

    // Existing UNBOUGHT ingredient?
    const existingIndex = ingredients.findIndex(i => i.name.toLowerCase() === ingredientName.toLowerCase() && !i.isBought);

    if (existingIndex !== -1) {
      const q1 = ingredients[existingIndex].quantity || 0;
      const q2 = addQty || 1;
      ingredients[existingIndex].quantity = q1 + q2;
      // Also update the category in case they changed it
      ingredients[existingIndex].category = finalCategory;
      if (addUnit.trim()) ingredients[existingIndex].unit = addUnit.trim();
      await Store.updateIngredient(ingredients[existingIndex].id, { 
        quantity: q1 + q2, 
        category: finalCategory,
        unit: ingredients[existingIndex].unit
      });
    } else {
      // Existing BOUGHT ingredient?
      const boughtIndex = ingredients.findIndex(i => i.name.toLowerCase() === ingredientName.toLowerCase() && i.isBought);
      if (boughtIndex !== -1) {
        ingredients[boughtIndex].isBought = false;
        ingredients[boughtIndex].quantity = addQty || 1;
        ingredients[boughtIndex].category = finalCategory;
        if (addUnit.trim()) ingredients[boughtIndex].unit = addUnit.trim();
        await Store.updateIngredient(ingredients[boughtIndex].id, {
          isBought: false,
          quantity: addQty || 1,
          category: finalCategory,
          unit: ingredients[boughtIndex].unit
        });
      } else {
        // Create new
        const newIng: Ingredient = {
          id: uuidv4(),
          name: ingredientName,
          category: finalCategory,
          isBought: false,
          createdAt: Date.now(),
          quantity: addQty,
          unit: addUnit.trim()
        };
        ingredients = [...ingredients, newIng];
        await Store.addIngredient(newIng);
      }
    }

    addName = '';
    addCategory = '';
    addQty = undefined;
    addUnit = '';
    showSuggestions = false;
    showCategorySuggestions = false;
  }

  async function toggleBought(item: Ingredient) {
    const nextStatus = !item.isBought;
    ingredients = ingredients.map(i => i.id === item.id ? { ...i, isBought: nextStatus } : i);
    await Store.updateIngredient(item.id, { isBought: nextStatus });
  }

  async function deleteIngredient(id: string) {
    ingredients = ingredients.filter(i => i.id !== id);
    await Store.removeIngredient(id);
  }

  let unboughtIngredients = $derived(
    ingredients
      .filter(i => !i.isBought)
      .sort((a, b) => {
        const catA = defaultCategories.indexOf(a.category);
        const catB = defaultCategories.indexOf(b.category);
        const orderA = catA === -1 ? 999 : catA;
        const orderB = catB === -1 ? 999 : catB;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      })
  );

  let boughtIngredients = $derived(
    ingredients
      .filter(i => i.isBought)
      .sort((a, b) => {
        const catA = defaultCategories.indexOf(a.category);
        const catB = defaultCategories.indexOf(b.category);
        const orderA = catA === -1 ? 999 : catA;
        const orderB = catB === -1 ? 999 : catB;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      })
  );
</script>

<div class="flex flex-col h-full min-h-0">
  <header class="sticky top-0 z-20 bg-background/95 backdrop-blur border-b shadow-sm pb-4">
    <div class="px-4 py-4">
      <h1 class="text-xl font-bold tracking-tight text-center">EasyList</h1>
    </div>
    
    <!-- Input in the header for easier access -->
    <div class="px-4 relative">
      <form onsubmit={handleAdd} class="flex flex-col gap-2 max-w-md mx-auto">
        <div class="flex gap-2">
          <div class="flex-1 relative">
            <Input 
              bind:value={addName} 
              onfocus={() => showSuggestions = true}
              placeholder="Rechercher / Ajouter..." 
              class="w-full h-12 rounded-xl text-base" 
              required 
              autocomplete="off"
            />
          </div>
          <div class="w-1/3 relative">
            <Input 
              bind:value={addCategory} 
              onfocus={() => showCategorySuggestions = true}
              placeholder="Rayon" 
              class="w-full h-12 rounded-xl text-sm" 
              autocomplete="off"
            />
            {#if showCategorySuggestions}
              <div class="absolute right-0 left-[-100px] top-14 bg-card border rounded-xl shadow-lg z-40 overflow-hidden max-h-48 overflow-y-auto">
                {#if filteredCategories.length === 0}
                  <div class="px-3 py-2 text-sm text-muted-foreground text-center">Nouveau rayon...</div>
                {:else}
                  {#each filteredCategories as cat}
                    <button type="button" class="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors text-sm border-b border-border/50 last:border-0 flex items-center justify-between" onclick={() => selectCategory(cat)}>
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
          <!-- Autocomplete Dropdown -->
          <div class="absolute left-4 right-4 top-[52px] bg-card border rounded-xl shadow-lg z-30 overflow-hidden max-h-64 overflow-y-auto">
            
            <!-- Option de création rapide si le nom n'existe pas exactement -->
            {#if !knownProducts.some(p => p.name.toLowerCase() === addName.trim().toLowerCase())}
              <button type="button" class="w-full text-left px-3 py-3 hover:bg-muted transition-colors flex items-center gap-2 border-b border-border/50 bg-primary/5 text-primary" onclick={() => handleAdd()}>
                <Plus class="w-4 h-4" />
                <span class="font-medium">Créer "{addName.trim()}"</span>
              </button>
            {/if}

            {#if filteredMeals.length > 0}
              <div class="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2 bg-muted/30">Repas</div>
              {#each filteredMeals as sm}
                <button type="button" class="w-full text-left px-3 py-3 hover:bg-muted transition-colors flex items-center justify-between border-b border-border/50 last:border-0" onclick={() => selectMeal(sm)}>
                  <span class="font-medium text-primary">{sm.name}</span>
                  <span class="text-xs text-muted-foreground">Ajouter le repas</span>
                </button>
              {/each}
            {/if}

            {#if filteredProducts.length > 0}
              <div class="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2 bg-muted/30">Ingrédients connus</div>
              {#each filteredProducts as sp}
                <button type="button" class="w-full text-left px-3 py-3 hover:bg-muted transition-colors flex items-center gap-2 border-b border-border/50 last:border-0" onclick={() => selectProduct(sp)}>
                  <span class="font-medium">{sp.name}</span>
                  {#if sp.category}
                    <span class="text-[10px] bg-background border px-2 py-0.5 rounded-md text-muted-foreground">{sp.category}</span>
                  {/if}
                </button>
              {/each}
            {/if}

            {#if displayApiProducts.length > 0}
              <div class="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2 bg-muted/30 flex justify-between items-center">
                <span>Suggestions OpenFoodFacts</span>
                {#if isLoadingApi}
                  <span class="w-3 h-3 border-2 border-primary/50 border-t-primary rounded-full animate-spin"></span>
                {/if}
              </div>
              {#each displayApiProducts as sp}
                <button type="button" class="w-full text-left px-3 py-3 hover:bg-muted transition-colors flex items-center gap-2 border-b border-border/50 last:border-0" onclick={() => selectProduct(sp)}>
                  <span class="font-medium">{sp.name}</span>
                  {#if sp.category}
                    <span class="text-[10px] bg-background border px-2 py-0.5 rounded-md text-muted-foreground">{sp.category}</span>
                  {/if}
                </button>
              {/each}
            {:else if isLoadingApi && addName.trim().length >= 2}
              <div class="px-3 py-4 text-sm text-muted-foreground text-center border-b border-border/50 last:border-0 flex items-center justify-center gap-2">
                <span class="w-4 h-4 border-2 border-primary/50 border-t-primary rounded-full animate-spin"></span>
                Recherche...
              </div>
            {/if}
          </div>
        {/if}

        <div class="flex gap-2">
          <Input 
            type="number" 
            bind:value={addQty} 
            min="0.1" 
            step="0.1"
            placeholder="Quantité"
            class="w-1/3 h-12 rounded-xl text-center" 
          />
          <Input 
            bind:value={addUnit} 
            placeholder="Unité (g, kg..)" 
            class="flex-1 h-12 rounded-xl text-sm" 
          />
          <Button type="submit" size="icon" class="h-12 w-12 rounded-xl shrink-0" onclick={() => showSuggestions = false}>
            <ArrowUp class="w-6 h-6" />
          </Button>
        </div>
      </form>
      
      <!-- Click outside listener simulation via an invisible overlay when suggestions are open -->
      {#if showSuggestions && addName.trim().length > 0 || showCategorySuggestions}
        <div class="fixed inset-0 z-20" aria-hidden="true" onclick={() => { showSuggestions = false; showCategorySuggestions = false; }}></div>
      {/if}
    </div>
  </header>

  <main class="flex-1 overflow-y-auto p-4 space-y-6 bg-muted/20">
    {#if ingredients.length === 0}
      <div class="text-center text-muted-foreground mt-10 space-y-2">
        <p class="text-lg font-medium">Aucun ingrédient.</p>
        <p class="text-sm">Ajoutez-en un ci-dessous !</p>
      </div>
    {:else}
      {#if unboughtIngredients.length === 0 && boughtIngredients.length > 0}
        <div class="text-center text-muted-foreground mt-6 space-y-1">
          <p class="text-lg font-medium">Tout est dans le caddie ! 🎉</p>
        </div>
      {/if}

      {#if unboughtIngredients.length > 0}
        <div class="bg-card border rounded-2xl shadow-sm overflow-hidden">
          {#each unboughtIngredients as item, index}
            <div class="flex items-center gap-4 p-4 {index !== unboughtIngredients.length - 1 ? 'border-b border-border/50' : ''} transition-colors hover:bg-muted/30">
              <Checkbox
                id="ing-{item.id}"
                checked={item.isBought}
                onCheckedChange={() => toggleBought(item)}
                class="rounded-full w-6 h-6 border-2 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground shrink-0"
              />
              
              <Label
                for="ing-{item.id}"
                class="flex-1 text-base font-medium cursor-pointer transition-all leading-none w-full"
              >
                {item.name} <span class="text-xs font-normal ml-2 bg-muted px-2 py-1 rounded-full no-underline mx-1 text-muted-foreground">{item.category}</span>
                {#if item.quantity}
                  <span class="text-sm text-primary font-bold ml-1">{item.quantity} {item.unit || ''}</span>
                {/if}
              </Label>

              <button class="text-primary/50 hover:text-primary p-2 transition-colors rounded-full hover:bg-primary/10 shrink-0" onclick={() => openEdit(item)} title="Modifier" aria-label="Modifier">
                <Pencil class="w-5 h-5" />
              </button>

              {#if item.linkedMeals && item.linkedMeals.length > 0}
                <Dialog.Root>
                  <Dialog.Trigger>
                    <button class="bg-primary/10 text-primary hover:bg-primary/20 transition-colors p-2 text-xs flex items-center gap-1.5 rounded-full font-medium" title="Voir les repas">
                      <Utensils class="w-3.5 h-3.5" /> {item.linkedMeals.length}
                    </button>
                  </Dialog.Trigger>
                  <Dialog.Content>
                    <Dialog.Header>
                      <Dialog.Title>Repas associés</Dialog.Title>
                      <Dialog.Description class="pt-4">
                        Ce produit ({item.name}) est prévu pour les repas suivants :
                      </Dialog.Description>
                    </Dialog.Header>
                    <div class="space-y-2 mt-4">
                      {#each item.linkedMeals as mealName}
                        <div class="px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm font-medium flex items-center gap-3">
                           <Utensils class="w-4 h-4 text-primary" /> {mealName}
                        </div>
                      {/each}
                    </div>
                  </Dialog.Content>
                </Dialog.Root>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if boughtIngredients.length > 0}
        <div class="pt-6 mt-8 border-t-2 border-border/60 border-dashed">
          <h2 class="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1 mb-3">Déjà pris</h2>
          <div class="bg-card/40 border border-border/50 rounded-2xl shadow-sm overflow-hidden">
            {#each boughtIngredients as item, index}
              <div class="flex items-center gap-4 p-4 {index !== boughtIngredients.length - 1 ? 'border-b border-border/50' : ''} transition-colors hover:bg-muted/30">
                <Checkbox
                  id="ing-{item.id}"
                  checked={item.isBought}
                  onCheckedChange={() => toggleBought(item)}
                  class="rounded-full w-6 h-6 border-2 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground shrink-0 opacity-70"
                />
                
                <Label
                  for="ing-{item.id}"
                  class="flex-1 text-base font-medium cursor-pointer transition-all leading-none line-through text-muted-foreground/60 w-full"
                >
                  {item.name} <span class="text-xs font-normal ml-2 bg-muted px-2 py-1 rounded-full no-underline mx-1">{item.category}</span>
                  {#if item.quantity}
                    <span class="text-sm font-bold ml-1">{item.quantity} {item.unit || ''}</span>
                  {/if}
                </Label>

                <div class="flex items-center gap-1 shrink-0">
                  <button type="button" class="text-primary/50 hover:text-primary p-2 transition-colors rounded-full hover:bg-primary/10" onclick={() => openEdit(item)}>
                    <Pencil class="w-5 h-5" />
                  </button>
                  <button type="button" class="text-destructive/50 hover:text-destructive p-2 transition-colors rounded-full hover:bg-destructive/10" onclick={() => deleteIngredient(item.id)}>
                    <Trash2 class="w-5 h-5" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </main>
</div>

<Dialog.Root open={!!editingIngredient} onOpenChange={(o) => { if (!o) editingIngredient = null; }}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Modifier {editingIngredient?.name}</Dialog.Title>
    </Dialog.Header>
    <div class="space-y-4 pt-4">
      <div class="space-y-2 relative">
        <Label>Rayon / Catégorie</Label>
        <Input 
          bind:value={editCategory} 
          placeholder="Ex: Fruits & Légumes" 
          onfocus={() => showEditCategorySuggestions = true}
          onblur={() => setTimeout(() => showEditCategorySuggestions = false, 200)}
          autocomplete="off"
        />
        {#if showEditCategorySuggestions}
          <div class="absolute left-0 right-0 top-[60px] bg-card border rounded-xl shadow-lg z-50 overflow-hidden max-h-48 overflow-y-auto">
            {#if filteredEditCategories.length === 0}
              <div class="px-3 py-2 text-sm text-muted-foreground text-center">Nouveau rayon...</div>
            {:else}
              {#each filteredEditCategories as cat}
                <button 
                  type="button" 
                  class="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors text-sm border-b border-border/50 last:border-0 flex items-center justify-between" 
                  onclick={() => selectEditCategory(cat)}
                >
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
