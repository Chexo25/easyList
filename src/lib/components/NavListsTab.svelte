<script lang="ts">
  import { List } from 'lucide-svelte';
  export let active = false;
</script>

<a href="/lists" class="flex flex-col items-center justify-center flex-1 h-full gap-1 pt-1 {active ? 'text-primary' : 'text-muted-foreground'}">
  <List class="w-5 h-5" />
  <span class="text-[10px] font-medium">Listes</span>
</a>
