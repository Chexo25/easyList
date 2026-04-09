<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { lists, currentListId, createNewList, joinList, selectList, syncError, currentUser } from '$lib/shoppingSyncStore';
  import { Plus, Users, Key, List, Pencil, Trash2 } from 'lucide-svelte';
import { updateListName, deleteList } from '$lib/shoppingSyncStore';

  let newListName = '';
  let shareCodeToJoin = '';
  let joinMessage = '';
  let joinStatus: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  
  let listToEdit = null;
  let editedName = '';
  
  let listToDelete = null;

  async function handleEditSubmit(id) {
    if (!editedName.trim()) { listToEdit = null; return; }
    await updateListName(id, editedName);
    listToEdit = null;
    editedName = '';
  }
  
  async function confirmDelete() {
    if (listToDelete) {
      await deleteList(listToDelete);
      listToDelete = null;
    }
  }

  let listsValue = [];
  let currentListIdValue = null;
  let errValue = null;
  let userValue = null;

  const unsubscribeLists = lists.subscribe(val => listsValue = val);
  const unsubscribeCurrent = currentListId.subscribe(val => currentListIdValue = val);
  const unsubscribeErr = syncError.subscribe(val => errValue = val);
  const unsubscribeUser = currentUser.subscribe(val => userValue = val);

  onDestroy(() => {
    unsubscribeLists();
    unsubscribeCurrent();
    unsubscribeErr();
    unsubscribeUser();
  });

  let isCreating = false;

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

  async function handleJoin() {
    if (!shareCodeToJoin.trim()) return;
    joinMessage = 'Recherche...';
    joinStatus = 'loading';
    // On met en minuscule car Supabase génère son md5 en minuscule
    const success = await joinList(shareCodeToJoin.toLowerCase());
    if (success) {
      joinMessage = 'Liste rejointe !';
      joinStatus = 'success';
      shareCodeToJoin = '';
      setTimeout(() => { joinMessage = ''; joinStatus = 'idle'; }, 3000);
    } else {
      joinMessage = 'Code invalide ou erreur.';
      joinStatus = 'error';
      setTimeout(() => { joinMessage = ''; joinStatus = 'idle'; }, 3000);
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
    <!-- Liste des listes -->
    <div class="space-y-3">
      <h2 class="text-lg font-semibold flex items-center gap-2"><List class="w-5 h-5"/> Vos listes de courses</h2>
      {#if listsValue.length === 0}
        <p class="text-sm text-muted-foreground italic">Vous n'avez pas encore de liste.</p>
      {:else}
        {#each listsValue as list (list.id)}
          <button 
            type="button"
            class="w-full text-left p-4 border rounded-xl shadow-sm transition-all duration-200 {currentListIdValue === list.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-card-foreground hover:border-primary/50 cursor-pointer'}"
            on:click={() => selectList(list.id)}
          >
            <div class="flex justify-between items-start">
              {#if listToEdit === list.id}
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <form on:submit|preventDefault={() => handleEditSubmit(list.id)} class="flex gap-2 w-full" on:click={(e) => e.stopPropagation()}>
                  <!-- svelte-ignore a11y_autofocus -->
                  <input type="text" bind:value={editedName} class="flex-1 px-2 py-1 text-sm border rounded-md text-foreground" autofocus/>
                  <button type="submit" class="px-2 py-1 bg-primary text-white rounded-md text-xs">OK</button>
                  <button type="button" class="px-2 py-1 bg-muted text-muted-foreground rounded-md text-xs" on:click|stopPropagation={() => listToEdit = null}>X</button>
                </form>
              {:else}
                <h3 class="font-medium text-lg flex items-center gap-2">
                  {list.name}
                  <button type="button" class="text-muted-foreground hover:text-primary" on:click|stopPropagation={() => { listToEdit = list.id; editedName = list.name; }}>
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button type="button" class="text-muted-foreground hover:text-destructive" on:click|stopPropagation={() => listToDelete = list.id}>
                    <Trash2 class="w-4 h-4" />
                  </button>
                </h3>
              {/if}
              {#if currentListIdValue === list.id}
                <div class="px-2 py-1 bg-white/20 rounded-md text-xs font-semibold">Active</div>
              {/if}
            </div>
            
            <div class="mt-3 flex items-center gap-2 text-sm opacity-80 bg-black/5 dark:bg-white/10 p-2 rounded-md w-fit">
              <Key class="w-4 h-4" />
              Code de partage : <strong class="tracking-widest font-mono text-base uppercase">{list.share_code}</strong>
            </div>
          </button>
        {/each}
      {/if}
    </div>

    <hr />

    <!-- Actions (Créer et Rejoindre) -->
    <div class="grid grid-cols-1 gap-6">
      <div class="p-4 bg-card border rounded-xl shadow-sm">
        <h2 class="text-md font-semibold mb-3 flex items-center gap-2"><Plus class="w-4 h-4"/> Nouvelle liste</h2>
        <form on:submit|preventDefault={handleCreate} class="flex gap-2">
          <input type="text" placeholder="Ex: Courses maison..." bind:value={newListName} disabled={isCreating} class="flex-1 px-3 py-2 border rounded-md text-sm"/>
          <button type="submit" disabled={isCreating} class="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {isCreating ? 'Création...' : 'Créer'}
          </button>
        </form>
      </div>

      <div class="p-4 bg-card border rounded-xl shadow-sm">
        <h2 class="text-md font-semibold mb-3 flex items-center gap-2"><Users class="w-4 h-4"/> Rejoindre une liste</h2>
        <form on:submit|preventDefault={handleJoin} class="flex flex-col gap-2">
          <div class="flex gap-2">
            <input type="text" placeholder="Code à 6 caractères" bind:value={shareCodeToJoin} class="flex-1 px-3 py-2 border rounded-md text-sm font-mono tracking-widest uppercase"/>
            <button type="submit" class="px-4 py-2 border border-primary text-primary hover:bg-primary hover:text-white rounded-md text-sm font-medium transition-colors border-dashed">Rejoindre</button>
          </div>
          {#if joinMessage}
            <span class="text-xs font-medium {joinStatus === 'error' ? 'text-red-600' : joinStatus === 'success' ? 'text-green-600' : 'text-blue-600'}">{joinMessage}</span>
          {/if}
        </form>
      </div>
    </div>
  {/if}

  {#if listToDelete}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="bg-card w-full max-w-sm rounded-xl shadow-lg border p-6 space-y-4">
        <h2 class="text-xl font-semibold">Supprimer la liste ?</h2>
        <p class="text-sm text-muted-foreground">Êtes-vous sûr de vouloir supprimer cette liste ? Les membres n'y auront plus accès, mais certaines données liées pourraient être supprimées définitivement selon la configuration base de données.</p>
        <div class="flex items-center justify-end gap-3 pt-4">
          <button type="button" class="px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted" on:click={() => listToDelete = null}>Annuler</button>
          <button type="button" class="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90" on:click={confirmDelete}>Confirmer, supprimer</button>
        </div>
      </div>
    </div>
  {/if}

  {#if listToDelete}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="bg-card w-full max-w-sm rounded-xl shadow-lg border p-6 space-y-4">
        <h2 class="text-xl font-semibold">Supprimer la liste ?</h2>
        <p class="text-sm text-muted-foreground">Êtes-vous sûr de vouloir supprimer cette liste ? Les membres n'y auront plus accès, mais certaines données liées pourraient être supprimées définitivement selon la configuration base de données.</p>
        <div class="flex items-center justify-end gap-3 pt-4">
          <button type="button" class="px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted" on:click={() => listToDelete = null}>Annuler</button>
          <button type="button" class="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90" on:click={confirmDelete}>Confirmer, supprimer</button>
        </div>
      </div>
    </div>
  {/if}
</div>
