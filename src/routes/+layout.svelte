<script lang="ts">
  import '../app.css';
  import { ShoppingCart, Utensils, CalendarDays } from 'lucide-svelte';
  import NavListsTab from '$lib/components/NavListsTab.svelte';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { initSync } from '$lib/shoppingSyncStore';

  let { children } = $props();

  onMount(() => {
    // Initialise la session anonyme Supabase au démarrage de l'app
    initSync();
  });
</script>

<div class="h-full w-full bg-muted/40 font-sans antialiased text-foreground overflow-hidden">
  <main class="max-w-md mx-auto bg-background h-full shadow-xl relative sm:border-x flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-hidden">
    <div class="flex-1 flex flex-col w-full min-h-0 relative">
      {@render children()}
    </div>
    
    <!-- Navbar -->
    <nav class="shrink-0 w-full bg-background border-t shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-50 flex justify-around items-center h-[4rem]">
      <a href="/" class="flex flex-col items-center justify-center flex-1 h-full gap-1 pt-1 {page.url.pathname === '/' ? 'text-primary' : 'text-muted-foreground'}">
        <ShoppingCart class="w-5 h-5" />
        <span class="text-[10px] font-medium">Courses</span>
      </a>
      <a href="/meals" class="flex flex-col items-center justify-center flex-1 h-full gap-1 pt-1 {page.url.pathname.startsWith('/meals') ? 'text-primary' : 'text-muted-foreground'}">
        <Utensils class="w-5 h-5" />
        <span class="text-[10px] font-medium">Repas</span>
      </a>
      <a href="/planning" class="flex flex-col items-center justify-center flex-1 h-full gap-1 pt-1 {page.url.pathname.startsWith('/planning') ? 'text-primary' : 'text-muted-foreground'}">
        <CalendarDays class="w-5 h-5" />
        <span class="text-[10px] font-medium">Planning</span>
      </a>
      <NavListsTab active={page.url.pathname.startsWith('/lists')} />
    </nav>
  </main>
</div>
