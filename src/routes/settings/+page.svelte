<script lang="ts">
  import { mode } from '$lib/store/mode';
  import { theme } from '$lib/store/theme';
  import { Switch } from '$lib/components/ui/switch';
  import { Moon, Sun } from 'lucide-svelte';

  const themes = [
    { id: 'default', label: 'Défaut', color: 'bg-gray-300' },
    { id: 'ocean', label: 'Océan', color: 'bg-blue-500' },
    { id: 'forest', label: 'Cornichon', color: 'bg-green-500' },
    { id: 'sunset', label: 'Sunset', color: 'bg-orange-400' },
    { id: 'pink', label: 'Rose', color: 'bg-red-400' },
    { id: 'violet', label: 'Lila', color: 'bg-purple-500' }
  ];
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
          on:click={() => theme.set(t.id)}
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
  </div>

</div>