<script lang="ts">
  import { mode } from '$lib/store/mode';
  import { theme } from '$lib/store/theme';
  import { Switch } from '$lib/components/ui/switch';
  import { Moon, Sun } from 'lucide-svelte';
  import { items } from '$lib/store/shopping';
  import { categoryOrder } from '$lib/store/categoryOrder';
  import { get } from 'svelte/store';
  import type { Theme } from '$lib/store/theme';

  const themes: { id: Theme; label: string; color: string }[] = [
    { id: 'default', label: 'Défaut', color: 'bg-gray-300' },
    { id: 'ocean', label: 'Schtroumpf', color: 'bg-blue-500' },
    { id: 'rose', label: 'Cerise', color: 'bg-red-400' },
    { id: 'forest', label: 'Cornichon', color: 'bg-green-500' },
    { id: 'sunset', label: 'Sunset', color: 'bg-orange-400' },
    { id: 'violet', label: 'Lavande', color: 'bg-purple-500' },
  ];

  let usedCategories = $derived(
    Array.from(new Set(($items || []).map(i => i.category).filter(Boolean))).sort()
  );

  let dragFromIndex: number | null = null;
  let dragToIndex: number | null = null;

  function handleDragStart(e: DragEvent, index: number) {
    dragFromIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    dragToIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDragEnd() {
    if (dragFromIndex === null || dragToIndex === null || dragFromIndex === dragToIndex) {
      dragFromIndex = null;
      dragToIndex = null;
      return;
    }

    categoryOrder.update(order => {
      const copy = [...order];
      const [moved] = copy.splice(dragFromIndex!, 1);
      copy.splice(dragToIndex!, 0, moved);
      return copy;
    });

    dragFromIndex = null;
    dragToIndex = null;
  }

  function removeCategory(index: number) {
    categoryOrder.update(order => order.filter((_, i) => i !== index));
  }

  $effect(() => {
    const missing = usedCategories.filter(c => !$categoryOrder.includes(c));
    if (missing.length > 0) {
      categoryOrder.set([...get(categoryOrder), ...missing]);
    }
  });
</script>

<div class="h-full overflow-y-auto p-4 space-y-6 pb-8">

  <!-- DARK MODE SWITCH -->
  <div class="flex items-center justify-between border rounded-xl p-4">

    <div class="flex items-center gap-2">
      {#if $mode === 'dark'}
        <Moon class="w-4 h-4" />
      {:else}
        <Sun class="w-4 h-4" />
      {/if}

      <span>
        { $mode === 'dark' ? 'Mode sombre' : 'Mode clair' }
      </span>
    </div>

    <Switch
      checked={$mode === 'dark'}
      onCheckedChange={(v) => mode.set(v ? 'dark' : 'light')}
    />
  </div>

  <!-- THEME SELECTOR -->
  <div class="space-y-3">

    <p class="text-sm font-semibold text-muted-foreground">
      Thème couleur
    </p>

    <div class="flex flex-wrap gap-3">
      {#each themes as t}
        <button
          onclick={() => theme.set(t.id)}
          class="flex items-center gap-2 px-3 py-2 rounded-full border transition hover:bg-muted/40
            {$theme === t.id ? 'border-primary bg-primary/10 font-semibold' : 'border-border'}"
        >
          <span class={`w-3 h-3 rounded-full shrink-0 ${t.color}`} />
          <span class="text-sm">{t.label}</span>
        </button>
      {/each}

    </div>

  </div>

  <!-- RAYONS ORDER -->
  <div class="space-y-3">
    <p class="text-sm font-semibold text-muted-foreground">Ordre des rayons</p>
    <p class="text-xs text-muted-foreground">Maintenez et glissez pour réordonner. Appuyez sur la croix pour retirer un rayon de la liste.</p>

    <div class="border rounded-xl divide-y overflow-hidden" role="list">
      {#if $categoryOrder.length === 0}
        <div class="p-4 text-sm text-muted-foreground text-center">
          Aucun rayon pour l'instant. Ajoutez des articles à votre liste pour les voir apparaître ici.
        </div>
      {/if}
      {#each $categoryOrder as category, index}
      <div
        class="flex items-center justify-between p-3 bg-card hover:bg-muted/30 transition-colors cursor-grab active:cursor-grabbing active:bg-muted/50 active:opacity-70"
        draggable="true"
        role="listitem"
        ondragstart={(e) => handleDragStart(e, index)}
        ondragover={(e) => handleDragOver(e, index)}
        ondragend={handleDragEnd}
      >
          <div class="flex items-center gap-3">
            <span class="text-muted-foreground/50 select-none">⠿</span>
            <span class="text-sm font-medium">{category}</span>
          </div>
          <button
            type="button"
            class="text-muted-foreground/50 hover:text-destructive transition-colors p-1 rounded-full hover:bg-destructive/10"
            onclick={() => removeCategory(index)}
            title="Retirer ce rayon"
          >
            ✕
          </button>
        </div>
      {/each}
    </div>
  </div>

</div>