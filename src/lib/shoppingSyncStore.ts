// Fichier supprimé
import { writable } from 'svelte/store';
import { fetchLists, fetchItems, addItem, updateItemChecked, removeItem, createList } from './supabaseApi';

export const lists = writable([]); // Toutes les listes disponibles
export const currentListId = writable(null); // ID de la liste sélectionnée
export const items = writable([]); // Articles de la liste sélectionnée
export const loading = writable(false);
export const error = writable(null);

// Charger toutes les listes (au démarrage ou après création)
export async function loadLists() {
  loading.set(true);
  try {
    const data = await fetchLists();
    lists.set(data);
    loading.set(false);
  } catch (e) {
    error.set(e.message);
    loading.set(false);
  }
}

// Sélectionner une liste et charger ses articles
export async function selectList(listId) {
  currentListId.set(listId);
  loading.set(true);
  try {
    const data = await fetchItems(listId);
    items.set(data);
    loading.set(false);
  } catch (e) {
    error.set(e.message);
    loading.set(false);
  }
}

// Ajouter un article (Optimistic UI)
export async function addItemToList(name) {
  const id = $currentListId;
  if (!id) return;
  // Optimistic UI : on ajoute localement
  items.update(arr => [...arr, { id: 'temp-' + Date.now(), name, checked: false, list_id: id }]);
  try {
    const item = await addItem(id, name);
    // On remplace l'item temporaire par l'item réel
    items.update(arr => arr.map(i => i.id.startsWith('temp-') && i.name === name ? item : i));
  } catch (e) {
    error.set(e.message);
  }
}

// Cocher/décocher un article (Optimistic UI)
export async function toggleItemChecked(itemId, checked) {
  items.update(arr => arr.map(i => i.id === itemId ? { ...i, checked } : i));
  try {
    await updateItemChecked(itemId, checked);
  } catch (e) {
    error.set(e.message);
  }
}

// Supprimer un article (Optimistic UI)
export async function deleteItem(itemId) {
  items.update(arr => arr.filter(i => i.id !== itemId));
  try {
    await removeItem(itemId);
  } catch (e) {
    error.set(e.message);
  }
}

// Créer une nouvelle liste
export async function createNewList(name) {
  try {
    const list = await createList(name);
    lists.update(arr => [...arr, list]);
    return list;
  } catch (e) {
    error.set(e.message);
  }
}

// Initialisation : charger les listes au démarrage
typeof window !== 'undefined' && loadLists();
