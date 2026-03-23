<script lang="ts">
  import '../app.css';
  import Nav from '$lib/components/Nav.svelte';
</script>

<div class="min-h-screen bg-gray-50 flex flex-col">
  <header class="bg-emerald-600 text-white shadow-md sticky top-0 z-40">
    <div class="max-w-lg mx-auto px-4 h-14 flex items-center">
      <h1 class="text-xl font-bold tracking-tight">🛒 easyList</h1>
    </div>
  </header>

  <main class="flex-1 max-w-lg mx-auto w-full px-4 py-6 pb-24">
    <slot />
  </main>

  <Nav />
</div>
