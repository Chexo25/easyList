<script lang="ts">
  import type { Component } from 'svelte';

  let { 
    href, 
    text, 
    active = false, 
    icon: Icon 
  } = $props<{
    href: string;
    text: string;
    active?: boolean;
    icon: Component<any>;
  }>();
</script>

<a {href} class="flex flex-col items-center justify-center flex-1 h-full gap-1 pt-1 {active ? 'text-primary' : 'text-muted-foreground'}">
  <Icon class="w-5 h-5" />
  <span class="text-[10px] font-medium">{text}</span>
</a>