<script lang="ts">
  import { mode } from '$lib/store/mode';
  import { theme } from '$lib/store/theme';
  import { Switch } from '$lib/components/ui/switch';
  import { Moon, Sun } from 'lucide-svelte';
  import { items } from '$lib/store/shopping';
  import { categoryOrder } from '$lib/store/categoryOrder';
  import { Button } from '$lib/components/ui/button';
  import { ArrowUp, ArrowDown } from 'lucide-svelte';

  const themes = [
    { id: 'default', label: 'Défaut', color: 'bg-gray-300' },
    { id: 'ocean', label: 'Océan', color: 'bg-blue-500' },
    { id: 'forest', label: 'Cornichon', color: 'bg-green-500' },
    { id: 'sunset', label: 'Sunset', color: 'bg-orange-400' },
    { id: 'pink', label: 'Rose', color: 'bg-red-400' },
    { id: 'violet', label: 'Lila', color: 'bg-purple-500' }
  ];

  let usedCategories = $derived(
    Array.from(
      new Set(
        $items
          .map(i => i.category)
          .filter(Boolean)
      )
    ).sort()
  );

  function moveUp(index: number) {
  categoryOrder.update(order => {
    if (index === 0) return order;

    const copy = [...order];

    [copy[index - 1], copy[index]] =
      [copy[index], copy[index - 1]];

    return copy;
  });
  }

function moveDown(index: number) {
  categoryOrder.update(order => {
    if (index >= order.length - 1) return order;

    const copy = [...order];

    [copy[index + 1], copy[index]] =
      [copy[index], copy[index + 1]];

    return copy;
  });
  }

  $effect(() => {
    const currentOrder = $categoryOrder;

    const missing = usedCategories.filter(
      c => !currentOrder.includes(c)
    );

    if (missing.length > 0) {
      categoryOrder.set([
        ...currentOrder,
        ...missing
      ]);
    }
  }); 
</script>

<div class="p-4 space-y-6">

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
          class="
            flex items-center gap-2 px-3 py-2 rounded-full border
            transition hover:bg-muted/40
            {$theme === t.id ? 'border-primary bg-muted/40' : 'border-border'}
          "
        >

          <!-- color dot -->
          <span class={`w-3 h-3 rounded-full ${t.color}`} />

          <!-- label -->
          <span class="text-sm">{t.label}</span>

          <!-- active indicator -->
          {#if $theme === t.id}
            <span class="w-2 h-2 rounded-full bg-primary ml-1"></span>
          {/if}

        </button>
      {/each}

    </div>

  </div>

  <!-- RAYONS ORDER -->
  <div class="space-y-3">

  <p class="text-sm font-semibold text-muted-foreground">
    Ordre des rayons
  </p>

  <div class="border rounded-xl divide-y">

    {#each $categoryOrder as category, index}

      <div class="flex items-center justify-between p-3">

        <span>{category}</span>

        <div class="flex gap-2">

          <Button variant="outline" size="icon" onclick={() => moveUp(index)}>
            <ArrowUp class="w-4 h-4" />
          </Button>

          <Button variant="outline" size="icon" onclick={() => moveDown(index)}>
            <ArrowDown class="w-4 h-4" />
          </Button>

        </div>

      </div>

    {/each}

  </div>

  </div>

</div>