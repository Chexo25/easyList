<script lang="ts">
  import { onDestroy } from 'svelte';
  import { lists, currentListId, createNewList, joinList, selectList, syncError, currentUser, updateListName, deleteList } from '$lib/store/shopping';
  import { Plus, Users, Key, List, Pencil, Trash2 } from 'lucide-svelte';
  import type { ShoppingList } from '$lib/types';

  let newListName = $state('');
  let shareCodeToJoin = $state('');
  let joinMessage = $state('');
  let joinStatus: 'idle' | 'loading' | 'success' | 'error' = $state('idle');
  let listToEdit: string | null = $state(null);
  let editedName = $state('');
  let listToDelete: string | null = $state(null);
  let isCreating = $state(false);

  let listsValue: ShoppingList[] = $state([]);
  let currentListIdValue: string | null = $state(null);
  let errValue: string | null = $state(null);
  let userValue = $state<unknown>(null);

  const unsubscribeLists = lists.subscribe(val => listsValue = val || []);
  const unsubscribeCurrent = currentListId.subscribe(val => currentListIdValue = val);
  const unsubscribeErr = syncError.subscribe(val => errValue = val);
  const unsubscribeUser = currentUser.subscribe(val => userValue = val);

  onDestroy(() => {
    unsubscribeLists();
    unsubscribeCurrent();
    unsubscribeErr();
    unsubscribeUser();
  });

  async function handleCreate() {
    if (!newListName.trim() || isCreating) return;
    isCreating = true;
    try {
      await createNewList(newListName);
      newListName = '';
    } finally {
      isCreating = false;
    }
  }

  async function handleEditSubmit(id: string) {
    if (!editedName.trim()) { listToEdit = null; return; }
    await updateListName(id, editedName);
    listToEdit = null;
    editedName = '';
  }

  async function handleJoin() {
    if (!shareCodeToJoin.trim()) return;
    joinMessage = 'Recherche...';
    joinStatus = 'loading';
    const success = await joinList(shareCodeToJoin.toLowerCase());
    if (success) {
      joinMessage = 'Liste rejointe !';
      joinStatus = 'success';
      shareCodeToJoin = '';
    } else {
      joinMessage = 'Code invalide ou erreur.';
      joinStatus = 'error';
    }
    setTimeout(() => { joinMessage = ''; joinStatus = 'idle'; }, 3000);
  }

  function confirmDelete() {
    if (listToDelete) {
      deleteList(listToDelete);
      listToDelete = null;
    }
  }
</script>

<div class="h-full overflow-y-auto p-4 bg-muted/10 space-y-6">
  <div>
    <h1 class="text-2xl font-bold tracking-tight">Mes Listes</h1>
    <p class="text-sm text-muted-foreground mt-1">Sélectionnez la liste à utiliser ou rejoignez-en une via un code.</p>
  </div>

  {#if errValue}
    <div class="p-3 bg-red-100 text-red-700 rounded-md text-sm">{errValue}</div>
  {/if}

  {#if !userValue}
    <div class="p-3 bg-yellow-100 text-yellow-800 rounded-md text-sm">
      Connexion anonyme en cours... (Vérifiez votre connexion internet)
    </div>
  {:else}
    <div class="space-y-3">
      <h2 class="text-lg font-semibold flex items-center gap-2"><List class="w-5 h-5" /> Vos listes de courses</h2>
      {#if listsValue.length === 0}
        <p class="text-sm text-muted-foreground italic">Vous n'avez pas encore de liste.</p>
      {:else}
        {#each listsValue as list (list.id)}
          <div
            class="w-full text-left border rounded-xl shadow-sm transition-all duration-200 overflow-hidden {currentListIdValue === list.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-card-foreground hover:border-primary/50'}"
          >
            {#if listToEdit === list.id}
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <form onsubmit={(e) => { e.preventDefault(); handleEditSubmit(list.id); }} class="flex gap-2 w-full p-4">
                <input type="text" bind:value={editedName} class="flex-1 px-2 py-1 text-sm border rounded-md text-foreground" />
                <button type="submit" class="px-2 py-1 bg-primary text-white rounded-md text-xs">OK</button>
                <button type="button" class="px-2 py-1 bg-muted text-muted-foreground rounded-md text-xs" onclick={() => listToEdit = null}>X</button>
              </form>
            {:else}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div class="w-full p-4 cursor-pointer text-left" onclick={() => selectList(list.id)} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter') selectList(list.id); }}>
                <div class="flex justify-between items-start">
                  <h3 class="font-medium text-lg flex items-center gap-2">
                    {list.name}
                    <span class="inline-flex gap-1">
                      <button type="button" class="text-muted-foreground hover:text-primary" onclick={(e) => { e.stopPropagation(); listToEdit = list.id; editedName = list.name; }}>
                        <Pencil class="w-4 h-4" />
                      </button>
                      <button type="button" class="text-muted-foreground hover:text-destructive" onclick={(e) => { e.stopPropagation(); listToDelete = list.id; }}>
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </span>
                  </h3>
                  {#if currentListIdValue === list.id}
                    <div class="px-2 py-1 bg-white/20 rounded-md text-xs font-semibold">Active</div>
                  {/if}
                </div>
                <div class="mt-3 flex items-center gap-2 text-sm opacity-80 bg-black/5 dark:bg-white/10 p-2 rounded-md w-fit">
                  <Key class="w-4 h-4" />
                  Code de partage : <strong class="tracking-widest font-mono text-base uppercase">{list.share_code}</strong>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <hr />

    <div class="grid grid-cols-1 gap-6">
      <div class="p-4 bg-card border rounded-xl shadow-sm">
        <h2 class="text-md font-semibold mb-3 flex items-center gap-2"><Plus class="w-4 h-4" /> Nouvelle liste</h2>
        <form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="flex gap-2">
          <input type="text" placeholder="Ex: Courses maison..." bind:value={newListName} disabled={isCreating} class="flex-1 px-3 py-2 border rounded-md text-sm" />
          <button type="submit" disabled={isCreating} class="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0">
            {isCreating ? 'Création...' : 'Créer'}
          </button>
        </form>
      </div>

      <div class="p-4 bg-card border rounded-xl shadow-sm">
        <h2 class="text-md font-semibold mb-3 flex items-center gap-2"><Users class="w-4 h-4" /> Rejoindre une liste</h2>
        <form onsubmit={(e) => { e.preventDefault(); handleJoin(); }} class="flex flex-col gap-2">
          <div class="flex gap-2">
            <input type="text" placeholder="Code à 6 caractères" bind:value={shareCodeToJoin} class="flex-1 px-3 py-2 border rounded-md text-sm font-mono tracking-widest uppercase" />
            <button type="submit" class="px-4 py-2 border border-primary text-primary hover:bg-primary hover:text-white rounded-md text-sm font-medium transition-colors border-dashed shrink-0">Rejoindre</button>
          </div>
          {#if joinMessage}
            <span class="text-xs font-medium {joinStatus === 'error' ? 'text-red-600' : joinStatus === 'success' ? 'text-green-600' : 'text-blue-600'}">{joinMessage}</span>
          {/if}
        </form>
      </div>
    </div>
  {/if}
</div>

{#if listToDelete}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onclick={() => listToDelete = null} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="bg-card w-full max-w-sm rounded-xl shadow-lg border p-6 space-y-4" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <h2 class="text-xl font-semibold">Supprimer la liste ?</h2>
      <p class="text-sm text-muted-foreground">Êtes-vous sûr de vouloir supprimer cette liste ? Les membres n'y auront plus accès, mais certaines données liées pourraient être supprimées définitivement selon la configuration base de données.</p>
      <div class="flex items-center justify-end gap-3 pt-4">
        <button type="button" class="px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted" onclick={() => listToDelete = null}>Annuler</button>
        <button type="button" class="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90" onclick={confirmDelete}>Confirmer, supprimer</button>
      </div>
    </div>
  </div>
{/if}
