<script lang="ts">
  import { v4 as uuidv4 } from 'uuid';
  import { items as syncItems, syncMeals, lists, currentListId, saveItems, updateItem, deleteItem, addItem, isListsLoaded, isNetworkOffline } from '$lib/store/shopping';
  import { get } from 'svelte/store';
  import { toast } from 'svelte-sonner';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Badge } from '$lib/components/ui/badge';
  import * as Dialog from '$lib/components/ui/dialog';
  import { ArrowUp, Trash2, Plus, Utensils, Check, Pencil } from 'lucide-svelte';
  import { categories as defaultCategories } from '$lib/data/categories';
  import { searchLocalProducts, type Product } from '$lib/data/products';
  import { categoryOrder } from '$lib/store/categoryOrder';
  import type { Item, Meal } from '$lib/types';

  // --- State ---

  let items = $state<Item[]>([]);
  let isOffline = $state(false);
  let currentListName = $state('');
  let listsLoaded = $state(false);

  $effect(() => {
    const unsub1 = isNetworkOffline.subscribe(v => isOffline = v);
    const unsub2 = isListsLoaded.subscribe(v => listsLoaded = v);
    const unsub3 = lists.subscribe(ls => {
      const id = get(currentListId);
      currentListName = (ls || []).find(l => l?.id === id)?.name || '';
    });
    const unsub4 = currentListId.subscribe(id => {
      const ls = get(lists);
      currentListName = (ls || []).find(l => l?.id === id)?.name || '';
    });
    const unsub5 = syncItems.subscribe(val => { items = val || []; });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  });

  let meals = $derived($syncMeals || []);
  let addName = $state('');
  let addCategory = $state('');
  let addQty: number | undefined = $state();
  let addUnit = $state('');

  // --- Edit dialog ---

  let editingItem: Item | null = $state(null);
  let editCategory = $state('');
  let editQty: number | undefined = $state();
  let editUnit = $state('');

  function openEdit(item: Item) {
    editingItem = item;
    editCategory = item.category || 'Autre';
    editQty = item.quantity ?? undefined;
    editUnit = item.unit || '';
  }

  async function saveEdit() {
    if (!editingItem) return;
    const updated: Partial<Item> = {
      category: editCategory || 'Autre',
      quantity: editQty ?? null,
      unit: editQty ? editUnit : '',
    };
    items = items.map(i => i.id === editingItem!.id ? { ...i, ...updated } : i);
    await updateItem(editingItem.id, updated);
    editingItem = null;
  }

  // --- Search / Autocomplete ---

  let showSuggestions = $state(false);
  let showCategorySuggestions = $state(false);
  let showEditCategorySuggestions = $state(false);
  let apiProducts = $state<Product[]>([]);
  let isLoadingApi = $state(false);

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

  let knownProducts = $derived(
    Array.from(new Map(
      items.map(i => [i.name.toLowerCase(), { name: i.name, category: i.category }])
    ).values())
  );

  let filteredProducts = $derived(
    addName.trim()
      ? knownProducts.filter(p => p.name.toLowerCase().includes(addName.toLowerCase()))
      : []
  );

  let filteredMeals = $derived(
    addName.trim()
      ? meals.filter(m => m.name.toLowerCase().includes(addName.toLowerCase()))
      : []
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

  let displayApiProducts = $derived(
    apiProducts.filter(apiP => !filteredProducts.some(fp => fp.name.toLowerCase() === apiP.name.toLowerCase()))
  );

  // --- Actions ---

  async function selectProduct(product: { name: string; category: string }) {
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
    const updatedItems = [...items];
    for (const ming of meal.ingredients) {
      const activeIndex = updatedItems.findIndex(i => i.name.toLowerCase() === ming.name.toLowerCase() && !i.isBought);
      if (activeIndex !== -1) {
        const existing = updatedItems[activeIndex];
        updatedItems[activeIndex] = {
          ...existing,
          quantity: (existing.quantity || 0) + (ming.quantity || 1),
          linkedMeals: existing.linkedMeals.includes(meal.name)
            ? existing.linkedMeals
            : [...existing.linkedMeals, meal.name],
        };
      } else {
        const boughtIndex = updatedItems.findIndex(i => i.name.toLowerCase() === ming.name.toLowerCase() && i.isBought);
        if (boughtIndex !== -1) {
          updatedItems[boughtIndex] = {
            ...updatedItems[boughtIndex],
            isBought: false,
            quantity: ming.quantity || 1,
            linkedMeals: [meal.name],
          };
        } else {
          updatedItems.push({
            id: uuidv4(),
            listId: get(currentListId),
            name: ming.name,
            category: ming.category,
            isBought: false,
            createdAt: new Date().toISOString(),
            quantity: ming.quantity || 1,
            unit: ming.unit || '',
            linkedMeals: [meal.name],
          });
        }
      }
    }
    await saveItems(updatedItems);
    addName = '';
    showSuggestions = false;
    toast.success(`"${meal.name}" ajouté à la liste de courses !`);
  }

  async function handleAdd(e?: Event) {
    if (e) e.preventDefault();
    if (!addName.trim()) return;

    const name = addName.trim();
    const category = addCategory.trim() || 'Divers';
    const quantity = addQty || 1;
    const unit = addUnit.trim();

    const existingIndex = items.findIndex(i => i.name.toLowerCase() === name.toLowerCase() && !i.isBought);
    if (existingIndex !== -1) {
      const existing = items[existingIndex];
      const newQty = (existing.quantity || 0) + quantity;
      items[existingIndex] = { ...existing, quantity: newQty, category, unit: unit || existing.unit };
      await updateItem(existing.id, { quantity: newQty, category, unit: unit || existing.unit });
    } else {
      const boughtIndex = items.findIndex(i => i.name.toLowerCase() === name.toLowerCase() && i.isBought);
      if (boughtIndex !== -1) {
        items[boughtIndex] = { ...items[boughtIndex], isBought: false, quantity, category, unit, linkedMeals: [] };
        await updateItem(items[boughtIndex].id, { isBought: false, quantity, category, unit, linkedMeals: [] });
      } else {
        const newItem: Item = {
          id: uuidv4(),
          listId: get(currentListId),
          name,
          category,
          isBought: false,
          createdAt: new Date().toISOString(),
          quantity,
          unit,
          linkedMeals: [],
        };
        items = [...items, newItem];
        await addItem(newItem);
      }
    }

    addName = '';
    addCategory = '';
    addQty = undefined;
    addUnit = '';
    showSuggestions = false;
    showCategorySuggestions = false;
  }

  async function toggleBought(item: Item) {
    const nextStatus = !item.isBought;
    items = items.map(i => i.id === item.id ? {
      ...i,
      isBought: nextStatus,
      quantity: nextStatus ? null : i.quantity,
      unit: nextStatus ? '' : i.unit,
    } : i);
    await updateItem(item.id, { isBought: nextStatus, quantity: nextStatus ? null : item.quantity, unit: nextStatus ? '' : item.unit });
  }

  async function deleteIngredient(id: string) {
    items = items.filter(i => i.id !== id);
    await deleteItem(id);
  }

  // --- Derived ---

  function sortByCategory(items: Item[]) {
    const order = get(categoryOrder);

    return [...items].sort((a, b) => {

      const catA = order.indexOf(a.category);
      const catB = order.indexOf(b.category);

      const orderA = catA === -1 ? 999 : catA;
      const orderB = catB === -1 ? 999 : catB;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.name.localeCompare(b.name);
    });
  }

  let unboughtItems = $derived(sortByCategory(items.filter(i => !i.isBought)));
  let boughtItems = $derived(sortByCategory(items.filter(i => i.isBought)));

  let groupedUnbought = $derived(
    unboughtItems.reduce((acc, item) => {
      const cat = item.category || 'Divers';
      let group = acc.find(g => g.category === cat);
      if (!group) {
        group = { category: cat, items: [] as Item[] };
        acc.push(group);
      }
      group.items.push(item);
      return acc;
    }, [] as { category: string; items: Item[] }[])
  );
</script>

<div class="flex flex-col h-full min-h-0">
  <header class="sticky top-0 z-20 bg-background/95 backdrop-blur border-b shadow-sm pb-4">
    <div class="px-4 py-4">
      <h1 class="text-xl font-bold tracking-tight text-center">
        EasyList : {currentListName || (listsLoaded ? 'Créez votre liste' : 'Chargement...')}
      </h1>
      {#if currentListName}
        {#if isOffline}
          <p class="text-center text-xs text-destructive-foreground mt-1 flex items-center justify-center gap-1 bg-destructive/20 py-0.5 rounded-full w-max mx-auto px-2">
            <span class="inline-block w-2 h-2 rounded-full bg-destructive animate-pulse"></span>
            Hors ligne (Modifications non sauvegardées)
          </p>
        {:else}
          <p class="text-center text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <span class="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Synchronisé en temps réel
          </p>
        {/if}
      {/if}
    </div>

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
          <div class="absolute left-4 right-4 top-[52px] bg-card border rounded-xl shadow-lg z-30 overflow-hidden max-h-64 overflow-y-auto">
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
                <span>Suggestions</span>
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
          <Input type="number" bind:value={addQty} min="0.1" step="0.1" placeholder="Quantité" class="w-1/3 h-12 rounded-xl text-center" />
          <Input bind:value={addUnit} placeholder="Unité (g, kg..)" class="flex-1 h-12 rounded-xl text-sm" />
          <Button type="submit" size="icon" class="h-12 w-12 rounded-xl shrink-0" onclick={() => showSuggestions = false}>
            <ArrowUp class="w-6 h-6" />
          </Button>
        </div>
      </form>

      {#if showSuggestions && addName.trim().length > 0 || showCategorySuggestions}
        <div class="fixed inset-0 z-20" aria-hidden="true" onclick={() => { showSuggestions = false; showCategorySuggestions = false; }}></div>
      {/if}
    </div>
  </header>

  <main class="flex-1 overflow-y-auto p-4 space-y-6 bg-muted/20">
    {#if items.length === 0}
      <div class="text-center text-muted-foreground mt-10 space-y-2">
        <p class="text-lg font-medium">Aucun ingrédient.</p>
        <p class="text-sm">Ajoutez-en un ci-dessous !</p>
      </div>
    {:else}
      {#if unboughtItems.length === 0 && boughtItems.length > 0}
        <div class="text-center text-muted-foreground mt-6 space-y-1">
          <p class="text-lg font-medium">Tout est dans le caddie !</p>
        </div>
      {/if}

      {#if unboughtItems.length > 0}
        <div class="space-y-6">
          {#each groupedUnbought as group}
            <div class="space-y-2">
              <h2 class="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">{group.category}</h2>
              <div class="bg-card border rounded-2xl shadow-sm overflow-hidden">
                {#each group.items as item, index}
                  <div class="flex items-center gap-4 p-4 {index !== group.items.length - 1 ? 'border-b border-border/50' : ''} transition-colors hover:bg-muted/30">
                    <Checkbox
                      id="ing-{item.id}"
                      checked={item.isBought}
                      onCheckedChange={() => toggleBought(item)}
                      class="rounded-full w-6 h-6 border-2 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground shrink-0"
                    />
                    <Label for="ing-{item.id}" class="flex-1 text-base font-medium cursor-pointer transition-all leading-none w-full">
                      {item.name}
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
            </div>
          {/each}
        </div>
      {/if}

      {#if boughtItems.length > 0}
        <div class="pt-6 mt-8 border-t-2 border-border/60 border-dashed">
          <h2 class="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1 mb-3">Déjà pris</h2>
          <div class="bg-card/40 border border-border/50 rounded-2xl shadow-sm overflow-hidden">
            {#each boughtItems as item, index}
              <div class="flex items-center gap-4 p-4 {index !== boughtItems.length - 1 ? 'border-b border-border/50' : ''} transition-colors hover:bg-muted/30">
                <Checkbox
                  id="ing-{item.id}"
                  checked={item.isBought}
                  onCheckedChange={() => toggleBought(item)}
                  class="rounded-full w-6 h-6 border-2 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground shrink-0 opacity-70"
                />
                <Label for="ing-{item.id}" class="flex-1 text-base font-medium cursor-pointer transition-all leading-none line-through text-muted-foreground/60 w-full">
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

<Dialog.Root open={!!editingItem} onOpenChange={(o) => { if (!o) editingItem = null; }}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Modifier {editingItem?.name}</Dialog.Title>
    </Dialog.Header>
    <div class="space-y-4 pt-4">
      <div class="space-y-2 relative">
        <Label>Rayon / Catégorie</Label>
        <Input bind:value={editCategory} placeholder="Ex: Fruits & Légumes" onfocus={() => showEditCategorySuggestions = true} onblur={() => setTimeout(() => showEditCategorySuggestions = false, 200)} autocomplete="off" />
        {#if showEditCategorySuggestions}
          <div class="absolute left-0 right-0 top-[60px] bg-card border rounded-xl shadow-lg z-50 overflow-hidden max-h-48 overflow-y-auto">
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
