<script lang="ts">
  import { onMount } from 'svelte';
  import { v4 as uuidv4 } from 'uuid';
  import * as Store from '$lib/store';
  import type { Ingredient } from '$lib/store';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Badge } from '$lib/components/ui/badge';
  import * as Dialog from '$lib/components/ui/dialog';
  import { ArrowUp, Trash2, Info } from 'lucide-svelte';

  let ingredients = $state<Ingredient[]>([]);
  let addName = $state('');
  let addCategory = $state('');
  let addQty = $state<number | undefined>();
  let addUnit = $state('');

  onMount(async () => {
    try {
      ingredients = await Store.getIngredients();
    } catch (err) {
      console.warn('Tauri store might not be ready in browser:', err);
      ingredients = [];
    }
  });

  async function handleAdd(e: Event) {
    e.preventDefault();
    if (!addName.trim()) return;

    const newIng: Ingredient = {
      id: uuidv4(),
      name: addName.trim(),
      category: addCategory.trim() || 'Divers',
      isBought: false,
      createdAt: Date.now(),
      quantity: addQty,
      unit: addUnit.trim()
    };

    ingredients = [...ingredients, newIng];
    addName = '';
    addCategory = '';
    addQty = undefined;
    addUnit = '';
    await Store.addIngredient(newIng);
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

  let unboughtIngredients = $derived(ingredients.filter(i => !i.isBought));

  let boughtIngredients = $derived(ingredients.filter(i => i.isBought));
</script>

<div class="flex flex-col h-[100dvh]">
  <header class="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-4 shrink-0 shadow-sm">
    <h1 class="text-xl font-bold tracking-tight text-center">EasyList</h1>
  </header>

  <main class="flex-1 overflow-y-auto p-4 space-y-6 pb-24 bg-muted/20">
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

              {#if item.linkedMeals && item.linkedMeals.length > 0}
                <Dialog.Root>
                  <Dialog.Trigger>
                    <button class="text-muted-foreground/60 hover:text-primary transition-colors p-1" title="Voir les repas">
                      <Info class="w-4 h-4" />
                    </button>
                  </Dialog.Trigger>
                  <Dialog.Content>
                    <Dialog.Header>
                      <Dialog.Title>Repas associés</Dialog.Title>
                      <Dialog.Description>Cet ingrédient est utilisé dans les repas suivants :</Dialog.Description>
                    </Dialog.Header>
                    <div class="space-y-2 mt-2">
                      {#each item.linkedMeals as mealName}
                        <div class="px-3 py-2 bg-muted rounded-md text-sm">{mealName}</div>
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
                
                <button type="button" class="text-destructive/50 hover:text-destructive p-2 transition-colors rounded-full hover:bg-destructive/10 shrink-0" onclick={() => deleteIngredient(item.id)}>
                  <Trash2 class="w-5 h-5" />
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </main>

  <footer class="mt-auto bg-background border-t p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] shrink-0 z-10 pb-6">
    <form onsubmit={handleAdd} class="flex flex-col gap-2 max-w-md mx-auto">
      <div class="flex gap-2">
        <Input 
          bind:value={addName} 
          placeholder="Ex: Tomates" 
          class="flex-1 h-12 rounded-xl" 
          required 
        />
        <Input 
          bind:value={addCategory} 
          placeholder="Rayon" 
          class="w-1/3 h-12 rounded-xl text-sm" 
        />
      </div>
      <div class="flex gap-2">
        <Input 
          type="number" 
          bind:value={addQty} 
          min="0.1" 
          step="0.1"
          placeholder="Qté"
          class="w-1/4 h-12 rounded-xl text-center" 
        />
        <Input 
          bind:value={addUnit} 
          placeholder="Unité (g, kg..)" 
          class="flex-1 h-12 rounded-xl text-sm" 
        />
        <Button type="submit" size="icon" class="h-12 w-12 rounded-xl shrink-0">
          <ArrowUp class="w-6 h-6" />
        </Button>
      </div>
    </form>
  </footer>
</div>
