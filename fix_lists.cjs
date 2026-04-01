const fs = require('fs');
let code = fs.readFileSync('src/routes/lists/+page.svelte', 'utf8');

// Add imports
code = code.replace(
  "import { Plus, Users, Key, List } from 'lucide-svelte';",
  "import { Plus, Users, Key, List, Pencil, Trash2 } from 'lucide-svelte';\nimport { updateListName, deleteList } from '$lib/shoppingSyncStore';"
);

// Add vars and methods inside the script
code = code.replace(
  "let joinMessage = '';",
  `let joinMessage = '';
  
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
  }`
);

// update the UI with modal and edit state
code = code.replace(
  `<h3 class="font-medium text-lg">{list.name}</h3>`,
  `{#if listToEdit === list.id}
                <form on:submit|preventDefault={() => handleEditSubmit(list.id)} class="flex gap-2 w-full" on:click|stopPropagation>
                  <input type="text" bind:value={editedName} class="flex-1 px-2 py-1 text-sm border rounded-md" autoFocus/>
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
              {/if}`
);

code = code.replace(
  `</div>\n  {/if}\n</div>`,
  `</div>
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
</div>`
);

fs.writeFileSync('src/routes/lists/+page.svelte', code);
