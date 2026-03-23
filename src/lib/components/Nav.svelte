<script lang="ts">
  import { page } from '$app/stores';

  const navItems = [
    { href: '/ingredients', icon: '🥦', label: 'Ingrédients' },
    { href: '/meals', icon: '🍽️', label: 'Repas' },
    { href: '/shopping', icon: '🛒', label: 'Courses' }
  ];
</script>

<nav class="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
  <div class="flex justify-around items-center h-16 max-w-lg mx-auto">
    {#each navItems as item}
      <a
        href={item.href}
        class="flex flex-col items-center justify-center flex-1 h-full text-xs font-medium transition-colors
          {$page.url.pathname.startsWith(item.href)
          ? 'text-emerald-600'
          : 'text-gray-500 hover:text-emerald-500'}"
      >
        <span class="text-xl mb-0.5">{item.icon}</span>
        <span>{item.label}</span>
      </a>
    {/each}
  </div>
</nav>
