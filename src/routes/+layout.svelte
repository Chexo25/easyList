<script lang="ts">
  import '../app.css';
  import { ShoppingCart, Utensils, CalendarDays, List, Settings } from 'lucide-svelte';
  import NavItem from '$lib/components/layout/NavItem.svelte';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { initSync } from '$lib/store/shopping';
  import { Toaster } from "$lib/components/ui/sonner";
  import { mode } from '$lib/store/mode';
  import { theme } from '$lib/store/theme';
  import { browser } from '$app/environment';
  import { unsubscribePersist } from '$lib/store/shopping';
  import { onDestroy } from 'svelte';

  onDestroy(() => {
    unsubscribePersist.forEach(fn => fn?.());
  });

  let { children } = $props();

  theme.subscribe((value) => {
    if (typeof document === 'undefined') return;

    document.documentElement.dataset.theme =
      value === 'default' ? '' : value;
  });

  onMount(() => {
    initSync();
  });
</script>

<div class="h-full w-full bg-muted/40 font-sans antialiased text-foreground overflow-hidden">
  <Toaster position="top-center" richColors />
  <main class="max-w-md mx-auto bg-background h-full shadow-xl relative sm:border-x flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-hidden">
    <div class="flex-1 flex flex-col w-full min-h-0 relative">
      {@render children()}
    </div>
    
    <!-- Navbar -->
    <nav class="shrink-0 w-full bg-background border-t shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-50 flex justify-around items-center h-[4rem]">
      <NavItem href="/meals" text="Repas" icon={Utensils} active={page.url.pathname === '/meals'} />

      <NavItem href="/planning" text="Planning" icon={CalendarDays} active={page.url.pathname === '/planning'} />

      <NavItem href="/" text="Courses" icon={ShoppingCart} active={page.url.pathname === '/'} featured />

      <NavItem href="/lists" text="Listes" icon={List} active={page.url.pathname === '/lists'} />

      <NavItem href="/settings" text="Paramètres" icon={Settings} active={page.url.pathname === '/settings'} />
    </nav>
  </main>
</div>