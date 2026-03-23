<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/ingredients');
  });
</script>

<div class="flex items-center justify-center py-20">
  <p class="text-gray-500">Chargement…</p>
</div>
