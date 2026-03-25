<script lang="ts">
  import '../app.css';
  import { ShoppingCart, Utensils } from 'lucide-svelte';
  import { page } from '$app/state';
  let { children } = $props();
</script>

<div class="min-h-screen bg-muted/40 font-sans antialiased text-foreground">
  <main class="max-w-md mx-auto bg-background min-h-[100dvh] shadow-xl relative sm:border-x flex flex-col">
    <div class="flex-1 flex flex-col h-full mb-16 relative">
      {@render children()}
    </div>
    
    <!-- Navbar -->
    <nav class="fixed bottom-0 w-full max-w-md bg-background border-t shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-50 flex justify-around items-center h-16">
      <a href="/" class="flex flex-col items-center justify-center flex-1 h-full gap-1 {page.url.pathname === '/' ? 'text-primary' : 'text-muted-foreground'}">
        <ShoppingCart class="w-5 h-5" />
        <span class="text-[10px] font-medium">Courses</span>
      </a>
      <a href="/meals" class="flex flex-col items-center justify-center flex-1 h-full gap-1 {page.url.pathname.startsWith('/meals') ? 'text-primary' : 'text-muted-foreground'}">
        <Utensils class="w-5 h-5" />
        <span class="text-[10px] font-medium">Repas</span>
      </a>
    </nav>
  </main>
</div>