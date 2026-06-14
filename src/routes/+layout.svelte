<script lang="ts">
  import '../app.css';
  import { ShoppingCart, Utensils, CalendarDays, List, Settings } from 'lucide-svelte';
  import NavItem from '$lib/components/layout/NavItem.svelte';
  import { page } from '$app/state';
  import { onMount, onDestroy } from 'svelte';
  import { initSync, unsubscribePersist, syncError } from '$lib/store/shopping';
  import { Toaster } from "$lib/components/ui/sonner";
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';

  onDestroy(() => {
    unsubscribePersist.forEach(fn => fn?.());
  });

  let { children } = $props();

  onMount(() => {
    initSync();
  });

  $effect(() => {
    if ($syncError) {
      toast.error($syncError);
      syncError.set(null);
    }
  });

  // --- Swipe navigation ---

  const routes = ['/planning', '/meals', '/', '/lists', '/settings'];

  let touchStartX = 0;
  let touchStartY = 0;
  let currentIndex = $derived(routes.indexOf(page.url.pathname));
  let swipeOpacity = $state(1);

  function handleTouchMove(e: TouchEvent) {
    const deltaX = e.touches[0].clientX - touchStartX;
    if (Math.abs(deltaX) > 30) {
      swipeOpacity = Math.max(0.7, 1 - Math.abs(deltaX) / 400);
    }
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchEnd(e: TouchEvent) {
    swipeOpacity = 1;
    
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    if (Math.abs(deltaX) < 60) return;

    const currentIndex = routes.indexOf(page.url.pathname);
    if (currentIndex === -1) return;

    if (deltaX < 0 && currentIndex < routes.length - 1) {
      goto(routes[currentIndex + 1]);
    } else if (deltaX > 0 && currentIndex > 0) {
      goto(routes[currentIndex - 1]);
    }
  }

</script>

<div class="h-full w-full bg-muted/40 font-sans antialiased text-foreground overflow-hidden">
  <Toaster position="top-center" richColors />
  <main class="max-w-md mx-auto bg-background h-full shadow-xl relative sm:border-x flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-hidden">
    <div
      class="flex-1 flex flex-col w-full min-h-0 relative"
      role="main"
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
      style="opacity: {swipeOpacity}; transition: opacity 0.1s"
    >
      {@render children()}
    </div>

    <!-- Navbar -->
  <nav class="shrink-0 w-full bg-background border-t shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-50 relative h-[4rem]">
    <!-- Barre indicatrice -->
    {#if currentIndex !== -1}
      <div
        class="absolute top-0 h-0.5 bg-primary rounded-full transition-all duration-300"
        style="width: 20%; left: {currentIndex * 20}%"
      ></div>
    {/if}

    <div class="flex justify-around items-center h-full">
      <NavItem href="/planning" text="Planning" icon={CalendarDays} active={page.url.pathname === '/planning'} />
      <NavItem href="/meals" text="Repas" icon={Utensils} active={page.url.pathname === '/meals'} />
      <NavItem href="/" text="Courses" icon={ShoppingCart} active={page.url.pathname === '/'} featured />
      <NavItem href="/lists" text="Listes" icon={List} active={page.url.pathname === '/lists'} />
      <NavItem href="/settings" text="Paramètres" icon={Settings} active={page.url.pathname === '/settings'} />
    </div>
  </nav>
  </main>
</div>