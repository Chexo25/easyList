<script lang="ts">
  import { mode } from '$lib/store/mode';
  import { theme } from '$lib/store/theme';
  import { Switch } from '$lib/components/ui/switch';
  import { Moon, Sun } from 'lucide-svelte';
</script>

<div class="p-4 space-y-6">

  <!-- DARK MODE SWITCH -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      {#if $mode === 'dark'}
        <Moon class="w-4 h-4" />
      {:else}
        <Sun class="w-4 h-4" />
      {/if}
      <span>{ $mode === 'dark' ? 'Mode sombre' : 'Mode clair' }</span>    
    </div>

    <Switch
      checked={$mode === 'dark'}
      onCheckedChange={(v) => mode.set(v ? 'dark' : 'light')}
    />
  </div>

  <!-- THEMES -->
  <div class="space-y-2">
    <p class="text-sm font-semibold text-muted-foreground">
      Thème couleur
    </p>

    <button on:click={() => theme.set('default')} class="border p-3 rounded-xl w-full text-left">
      Default
    </button>

    <button on:click={() => theme.set('ocean')} class="border p-3 rounded-xl w-full text-left">
      Ocean
    </button>

    <button on:click={() => theme.set('forest')} class="border p-3 rounded-xl w-full text-left">
      Forest
    </button>

    <button on:click={() => theme.set('sunset')} class="border p-3 rounded-xl w-full text-left">
      Sunset
    </button>
  </div>

</div>