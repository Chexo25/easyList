<script lang="ts">
  import { ShoppingCart, ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays, Utensils } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
  import * as Dialog from '$lib/components/ui/dialog';
  import { syncMeals, syncPlanning, updatePlannedDayInSync, saveItems, items as syncItems } from '$lib/store/shopping';
  import { get } from 'svelte/store';
  import { toast } from 'svelte-sonner';
  import { v4 as uuidv4 } from 'uuid';
  import type { Meal, PlannedDay, Planning, Item } from '$lib/types';

  let meals: Meal[] = $state([]);
  let planning: Planning = $state({});

  $effect(() => {
    const unsubM = syncMeals.subscribe(val => {
      meals = (val || []).map(m => ({
        ...m,
        ingredients: m.ingredients || [],
        isFavorite: m.isFavorite ?? false,
      }));
    });
    const unsubP = syncPlanning.subscribe(val => {
      const safe: Planning = {};
      const actualVal = val || {};
      for (const key in actualVal) {
        safe[key] = {
          ...actualVal[key],
          lunchExcluded: actualVal[key].lunchExcluded || [],
          dinnerExcluded: actualVal[key].dinnerExcluded || [],
        };
      }
      planning = safe;
    });
    return () => { unsubM(); unsubP(); };
  });

  let activeDate = $state(new Date());
  let activeTab = $state('day');

  function getStartOfWeek(d: Date) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date;
  }

  let weekDays = $derived.by(() => {
    const start = getStartOfWeek(activeDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  });

  function formatDate(d: Date) { return d.toISOString().split('T')[0]; }
  function getDayName(d: Date) { return d.toLocaleDateString('fr-FR', { weekday: 'long' }); }
  function getShortDayName(d: Date) { return d.toLocaleDateString('fr-FR', { weekday: 'short' }); }
  function getMonthName(d: Date) { return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }

  async function updatePlan(dateStr: string, updates: Partial<PlannedDay>) {
    await updatePlannedDayInSync(dateStr, updates);
  }

  // --- Meal selection dialog ---

  let mealSelectionOpen = $state(false);
  let selectionTarget = $state<{ date: string; type: 'lunch' | 'dinner' } | null>(null);

  function openMealSelection(date: string, type: 'lunch' | 'dinner') {
    selectionTarget = { date, type };
    mealSelectionOpen = true;
  }

  async function handleMealSelect(mealId: string | null) {
    if (selectionTarget) {
      const updates: Partial<PlannedDay> = selectionTarget.type === 'lunch'
        ? { lunch: mealId, lunchExcluded: [] }
        : { dinner: mealId, dinnerExcluded: [] };
      await updatePlan(selectionTarget.date, updates);
    }
    mealSelectionOpen = false;
  }

  // --- Ingredient exclusion dialog ---

  let detailsTarget = $state<{ date: string; type: 'lunch' | 'dinner'; meal: Meal; excluded: string[] } | null>(null);

  function openDetails(dateStr: string, type: 'lunch' | 'dinner', meal: Meal) {
    const plan = planning[dateStr];
    const excluded = plan ? (type === 'lunch' ? plan.lunchExcluded : plan.dinnerExcluded) || [] : [];
    detailsTarget = { date: dateStr, type, meal, excluded: [...excluded] };
  }

  async function toggleIngredientExclusion(ingName: string) {
    if (!detailsTarget) return;
    const nextEx = detailsTarget.excluded.includes(ingName)
      ? detailsTarget.excluded.filter(n => n !== ingName)
      : [...detailsTarget.excluded, ingName];

    detailsTarget.excluded = nextEx;

    const updates = detailsTarget.type === 'lunch'
      ? { lunchExcluded: nextEx }
      : { dinnerExcluded: nextEx };

    await updatePlan(detailsTarget.date, updates);
  }

  // --- Export dialog ---

  let exportDialogOpen = $state(false);
  let toExport = $state<{ id: string; date: string; label: string; meal: Meal; selected: boolean; excluded: string[] }[]>([]);

  function openExport() {
    const list: typeof toExport = [];
    for (const d of weekDays) {
      const str = formatDate(d);
      const plan = planning[str];
      if (plan) {
        if (plan.lunch) {
          const m = meals.find(x => x.id === plan.lunch);
          if (m) list.push({ id: uuidv4(), date: str, label: 'Midi', meal: m, selected: true, excluded: plan.lunchExcluded || [] });
        }
        if (plan.dinner) {
          const m = meals.find(x => x.id === plan.dinner);
          if (m) list.push({ id: uuidv4(), date: str, label: 'Soir', meal: m, selected: true, excluded: plan.dinnerExcluded || [] });
        }
      }
    }
    toExport = list;
    exportDialogOpen = true;
  }

  async function confirmExport() {
    const currentShopping: Item[] = get(syncItems).map(i => ({ ...i }));
    const toSave: Item[] = [...currentShopping];

    for (const exp of toExport.filter(e => e.selected)) {
      const meal = exp.meal;
      for (const ming of meal.ingredients) {
        if (exp.excluded.includes(ming.name)) continue;

        const activeIndex = toSave.findIndex(i => i.name.toLowerCase() === ming.name.toLowerCase() && !i.isBought);
        if (activeIndex !== -1) {
          const exist = toSave[activeIndex];
          toSave[activeIndex] = {
            ...exist,
            quantity: (exist.quantity || 0) + (ming.quantity || 1),
            linkedMeals: exist.linkedMeals.includes(meal.name) ? exist.linkedMeals : [...exist.linkedMeals, meal.name],
            category: ming.category,
            unit: ming.unit || exist.unit,
          };
        } else {
          const boughtIndex = toSave.findIndex(i => i.name.toLowerCase() === ming.name.toLowerCase() && i.isBought);
          if (boughtIndex !== -1) {
            toSave[boughtIndex] = {
              ...toSave[boughtIndex],
              isBought: false,
              quantity: ming.quantity || 1,
              linkedMeals: [meal.name],
              category: ming.category,
              unit: ming.unit || toSave[boughtIndex].unit,
            };
          } else {
            toSave.push({
              id: uuidv4(),
              listId: null,
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
    }

    await saveItems(toSave);
    exportDialogOpen = false;
    setTimeout(() => {
      toast.success("Les menus sélectionnés ont été ajoutés à la liste de courses !");
    }, 100);
  }
</script>

<div class="flex flex-col h-full min-h-0 w-full bg-background">
  <header class="shrink-0 bg-background/95 backdrop-blur border-b shadow-sm pb-2 z-20">
    <div class="px-4 py-3 flex items-center justify-between relative">
      <h1 class="text-xl font-bold tracking-tight">Planning</h1>
      <Button size="sm" variant="default" onclick={openExport}>
        <ShoppingCart class="w-4 h-4 mr-2" />
        Courses
      </Button>
    </div>

    <div class="flex items-center justify-between px-4 mb-3 mt-1">
      <Button variant="outline" size="icon" class="h-8 w-8" onclick={() => activeDate = new Date(activeDate.setDate(activeDate.getDate() - 7))}>
        <ChevronLeft class="w-4 h-4" />
      </Button>
      <span class="text-sm font-medium capitalize flex flex-col items-center">
        <span class="text-xs text-muted-foreground">Semaine du</span>
        {getMonthName(weekDays[0])} - {getMonthName(weekDays[6])}
      </span>
      <Button variant="outline" size="icon" class="h-8 w-8" onclick={() => activeDate = new Date(activeDate.setDate(activeDate.getDate() + 7))}>
        <ChevronRight class="w-4 h-4" />
      </Button>
    </div>

    <div class="px-4">
      <Tabs bind:value={activeTab} class="w-full">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="day">Jour</TabsTrigger>
          <TabsTrigger value="week">Semaine</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  </header>

  {#if activeTab === 'day'}
    {@const plan = planning[formatDate(activeDate)] || { lunch: null, dinner: null, lunchExcluded: [], dinnerExcluded: [] }}
    <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
      <div class="grid grid-cols-7 gap-1">
        {#each weekDays as d}
          <button
            class="flex flex-col items-center justify-center p-2 rounded-xl transition-all {formatDate(d) === formatDate(activeDate) ? 'bg-primary text-primary-foreground shadow-md scale-105' : 'bg-transparent text-muted-foreground hover:bg-muted'}"
            onclick={() => activeDate = d}
          >
            <span class="text-[10px] font-semibold uppercase">{getShortDayName(d).slice(0, 3)}</span>
            <span class="text-sm font-bold mt-1">{d.getDate()}</span>
          </button>
        {/each}
      </div>

      <!-- Lunch -->
      <div class="flex flex-col gap-3 mt-2">
        <div class="flex items-center gap-2">
          <div class="bg-amber-100 p-1.5 rounded text-amber-600"><Utensils class="w-4 h-4" /></div>
          <h3 class="text-lg font-semibold">Déjeuner</h3>
        </div>
        {#if plan.lunch}
          {@const meal = meals.find(m => m.id === plan.lunch)}
          {#if meal}
            <div class="border rounded-xl p-0 shadow-sm bg-card hover:bg-muted/30 transition-colors flex flex-col overflow-hidden">
              <button type="button" class="w-full p-4 flex justify-between items-center cursor-pointer text-left" onclick={() => openDetails(formatDate(activeDate), 'lunch', meal)}>
                <div class="flex-1 min-w-0">
                  <p class="font-bold truncate">{meal.name}</p>
                  <p class="text-xs text-muted-foreground mt-1 underline decoration-dashed underline-offset-2">Gérer les ingrédients : {meal.ingredients.length - (plan.lunchExcluded?.length || 0)} / {meal.ingredients.length}</p>
                </div>
                <div class="flex space-x-2 ml-4 shrink-0" onclick={(e) => e.stopPropagation()} role="presentation">
                  <Button variant="outline" size="icon" class="h-8 w-8 text-muted-foreground" onclick={() => openMealSelection(formatDate(activeDate), 'lunch')}>
                    <Utensils class="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" class="h-8 w-8 text-destructive border-red-100 bg-red-50 hover:bg-red-100" onclick={() => updatePlan(formatDate(activeDate), { lunch: null, lunchExcluded: [] })}>
                    <Trash2 class="w-4 h-4" />
                  </Button>
                </div>
              </button>
            </div>
          {/if}
        {:else}
          <button type="button" class="w-full py-6 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer" onclick={() => openMealSelection(formatDate(activeDate), 'lunch')}>
            <span class="bg-muted p-2 rounded-full"><Plus class="w-5 h-5" /></span>
            <span class="font-medium text-sm">Planifier un plat</span>
          </button>
        {/if}
      </div>

      <!-- Dinner -->
      <div class="flex flex-col gap-3 mt-4 mb-6">
        <div class="flex items-center gap-2">
          <div class="bg-indigo-100 p-1.5 rounded text-indigo-600"><Utensils class="w-4 h-4" /></div>
          <h3 class="text-lg font-semibold">Dîner</h3>
        </div>
        {#if plan.dinner}
          {@const meal = meals.find(m => m.id === plan.dinner)}
          {#if meal}
            <div class="border rounded-xl p-0 shadow-sm bg-card hover:bg-muted/30 transition-colors flex flex-col overflow-hidden">
              <button type="button" class="w-full p-4 flex justify-between items-center cursor-pointer text-left" onclick={() => openDetails(formatDate(activeDate), 'dinner', meal)}>
                <div class="flex-1 min-w-0">
                  <p class="font-bold truncate">{meal.name}</p>
                  <p class="text-xs text-muted-foreground mt-1 underline decoration-dashed underline-offset-2">Gérer les ingrédients : {meal.ingredients.length - (plan.dinnerExcluded?.length || 0)} / {meal.ingredients.length}</p>
                </div>
                <div class="flex space-x-2 ml-4 shrink-0" onclick={(e) => e.stopPropagation()} role="presentation">
                  <Button variant="outline" size="icon" class="h-8 w-8 text-muted-foreground" onclick={() => openMealSelection(formatDate(activeDate), 'dinner')}>
                    <Utensils class="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" class="h-8 w-8 text-destructive border-red-100 bg-red-50 hover:bg-red-100" onclick={() => updatePlan(formatDate(activeDate), { dinner: null, dinnerExcluded: [] })}>
                    <Trash2 class="w-4 h-4" />
                  </Button>
                </div>
              </button>
            </div>
          {/if}
        {:else}
          <button type="button" class="w-full py-6 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer" onclick={() => openMealSelection(formatDate(activeDate), 'dinner')}>
            <span class="bg-muted p-2 rounded-full"><Plus class="w-5 h-5" /></span>
            <span class="font-medium text-sm">Planifier un plat</span>
          </button>
        {/if}
      </div>
    </div>
  {/if}

  {#if activeTab === 'week'}
    <div class="flex-1 p-0 bg-muted/20 outline-none flex flex-col w-full relative overflow-y-auto">
      <div class="divide-y pb-20 w-full relative">
        {#each weekDays as d}
          {@const plan = planning[formatDate(d)] || { lunch: null, dinner: null }}
          <div class="p-4 bg-background w-full">
            <div class="font-semibold capitalize mb-3 flex items-center gap-2">
              <span class="text-primary"><CalendarDays class="w-4 h-4" /></span>
              {getDayName(d)} {d.getDate()}
            </div>
            <div class="grid grid-cols-2 gap-3">
              <button type="button" class="border rounded-xl p-3 flex flex-col items-center justify-center gap-2 min-h-[6rem] text-sm transition-colors cursor-pointer {plan.lunch ? 'bg-amber-50/50 border-amber-200' : 'border-dashed bg-muted/10 text-muted-foreground hover:bg-muted/40'}" onclick={() => openMealSelection(formatDate(d), 'lunch')}>
                <span class="text-[11px] font-bold uppercase tracking-wider {plan.lunch ? 'text-amber-700' : 'text-muted-foreground'} block w-full text-center">Midi</span>
                {#if plan.lunch}
                  {@const m = meals.find(x => x.id === plan.lunch)}
                  <span class="font-bold text-center leading-snug line-clamp-3 text-foreground break-words">{m ? m.name : '?'}</span>
                {:else}
                  <Plus class="w-5 h-5 opacity-40" />
                {/if}
              </button>
              <button type="button" class="border rounded-xl p-3 flex flex-col items-center justify-center gap-2 min-h-[6rem] text-sm transition-colors cursor-pointer {plan.dinner ? 'bg-indigo-50/50 border-indigo-200' : 'border-dashed bg-muted/10 text-muted-foreground hover:bg-muted/40'}" onclick={() => openMealSelection(formatDate(d), 'dinner')}>
                <span class="text-[11px] font-bold uppercase tracking-wider {plan.dinner ? 'text-indigo-700' : 'text-muted-foreground'} block w-full text-center">Soir</span>
                {#if plan.dinner}
                  {@const m = meals.find(x => x.id === plan.dinner)}
                  <span class="font-bold text-center leading-snug line-clamp-3 text-foreground break-words">{m ? m.name : '?'}</span>
                {:else}
                  <Plus class="w-5 h-5 opacity-40" />
                {/if}
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Meal selection dialog -->
<Dialog.Root bind:open={mealSelectionOpen}>
  <Dialog.Content class="max-w-[400px] w-[92vw] max-h-[85vh] p-0 overflow-hidden flex flex-col rounded-2xl">
    <Dialog.Header class="p-6 pb-2 shrink-0">
      <Dialog.Title class="text-xl">Modifier le repas</Dialog.Title>
    </Dialog.Header>
    <div class="px-6 py-2 shrink-0">
      <Button variant="outline" class="w-full text-destructive border-red-100 hover:bg-red-50 hover:text-destructive transition-colors" onclick={() => handleMealSelect(null)}>
        <Trash2 class="w-4 h-4 mr-2" /> Vider ce repas
      </Button>
    </div>
    <div class="overflow-y-auto px-6 py-4 space-y-2 flex-1 scrollbar-thin">
      <div class="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Vos recettes</div>
      {#each meals as meal (meal.id)}
        <button class="w-full text-left flex flex-col p-4 border rounded-xl hover:border-primary hover:bg-primary/5 focus:ring-2 focus:ring-primary outline-none transition-all" onclick={() => handleMealSelect(meal.id)}>
          <span class="font-bold">{meal.name}</span>
          <span class="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Utensils class="w-3 h-3" /> {meal.ingredients.length} ingrédients
          </span>
        </button>
      {/each}
      {#if meals.length === 0}
        <div class="text-center py-8">
          <div class="bg-muted inline-flex p-3 rounded-full mb-3 text-muted-foreground"><Utensils class="w-6 h-6" /></div>
          <p class="text-muted-foreground font-medium">Aucun repas disponible.</p>
          <p class="text-sm text-muted-foreground mt-1">Créez d'abord des repas dans l'onglet Repas !</p>
        </div>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>

<!-- Ingredient exclusion dialog -->
<Dialog.Root open={!!detailsTarget} onOpenChange={(v) => { if (!v) detailsTarget = null; }}>
  <Dialog.Content class="max-w-[400px] w-[92vw] max-h-[85vh] p-0 flex flex-col rounded-2xl overflow-hidden">
    {#if detailsTarget}
      <Dialog.Header class="p-6 pb-4 shrink-0 border-b">
        <Dialog.Title class="text-xl max-w-full truncate pr-4">{detailsTarget.meal.name}</Dialog.Title>
        <Dialog.Description class="mt-2 text-left">
          Décochez les ingrédients que vous possédez déjà pour ne pas les ajouter à la liste de courses.
        </Dialog.Description>
      </Dialog.Header>
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        {#each detailsTarget.meal.ingredients as ing}
          {@const included = !detailsTarget.excluded.includes(ing.name)}
          <label class="flex items-center justify-between p-3 border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors {included ? 'bg-card' : 'bg-muted/30 opacity-70'}">
            <div class="flex items-center gap-3">
              <input type="checkbox" class="w-5 h-5 rounded border-2 border-muted-foreground cursor-pointer focus:ring-0 focus:ring-offset-0 text-foreground accent-neutral-700" checked={included} onchange={() => toggleIngredientExclusion(ing.name)} />
              <span class="font-medium {included ? '' : 'line-through text-muted-foreground'}">{ing.name}</span>
            </div>
            {#if ing.quantity}
              <span class="text-sm text-muted-foreground">{ing.quantity} {ing.unit || ''}</span>
            {/if}
          </label>
        {/each}
      </div>
      <div class="p-4 bg-background border-t shrink-0 flex justify-end">
        <Button class="w-full" onclick={() => detailsTarget = null}>Terminé</Button>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- Export dialog -->
<Dialog.Root bind:open={exportDialogOpen}>
  <Dialog.Content class="max-w-[400px] w-[92vw] max-h-[85vh] p-0 flex flex-col rounded-2xl overflow-hidden">
    <Dialog.Header class="p-6 pb-4 shrink-0 border-b">
      <Dialog.Title class="text-xl">Ajouter aux courses</Dialog.Title>
      <Dialog.Description class="mt-2 text-left">
        Sélectionnez les repas de la semaine que vous souhaitez acheter.
      </Dialog.Description>
    </Dialog.Header>
    <div class="flex-1 overflow-y-auto p-2 scrollbar-thin">
      {#if toExport.length === 0}
        <div class="text-center py-10 px-4">
          <CalendarDays class="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p class="text-muted-foreground font-medium">Aucun repas prévu pour cette semaine.</p>
        </div>
      {:else}
        {#each toExport as exp (exp.id)}
          <label class="flex items-center gap-4 py-3 px-4 mx-2 my-1 border bg-card rounded-xl cursor-pointer hover:bg-muted transition-all {exp.selected ? 'border-primary/20' : 'opacity-60'}">
            <input type="checkbox" class="w-5 h-5 rounded border-2 border-muted-foreground text-foreground accent-neutral-700 focus:ring-0" bind:checked={exp.selected} />
            <div class="flex-1 min-w-0">
              <p class="font-bold flex items-center gap-2 truncate">{exp.meal.name}</p>
              <p class="text-xs font-semibold text-muted-foreground capitalize mt-1 flex items-center gap-1">
                <CalendarDays class="w-3 h-3" /> {getDayName(new Date(exp.date))} <span class="bg-secondary px-1.5 py-0.5 rounded text-[10px] ml-1">{exp.label}</span>
              </p>
            </div>
          </label>
        {/each}
      {/if}
    </div>
    <Dialog.Footer class="p-4 bg-background border-t shrink-0 gap-2 flex-col">
      <Button class="w-full" disabled={toExport.length === 0 || !toExport.some(e => e.selected)} onclick={confirmExport}>
        <ShoppingCart class="w-4 h-4 mr-2" />
        Ajouter à la liste
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
