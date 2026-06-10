<script lang="ts">
  import type { ComponentType } from 'svelte';

  let {
    href,
    text,
    active = false,
    icon: Icon,
    featured = false
  } = $props<{
    href: string;
    text: string;
    active?: boolean;
    icon: ComponentType;
    featured?: boolean;
  }>();
</script>

<a
  {href}
  class="flex flex-col items-center justify-center flex-1 h-full gap-1 pt-1 transition relative
  {active
    ? 'text-primary'
    : 'text-muted-foreground'}"
>
  <!-- background spécial uniquement pour featured -->
  <div class="
    absolute inset-x-1 top-1 bottom-1 rounded-xl -z-10 transition
    {featured
      ? 'bg-primary/15 border border-primary/20 shadow-sm'
      : ''}
  "></div>

  <Icon class="w-5 h-5 {featured ? 'scale-110' : ''}" />

  <span class="
    text-[10px] font-medium
    {featured ? 'font-semibold' : ''}
  ">
    {text}
  </span>
</a>