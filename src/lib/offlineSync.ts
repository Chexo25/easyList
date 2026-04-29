import { supabase } from './supabase';

const QUEUE_KEY = 'easyList_offline_queue';

export function getOfflineQueue() {
  if (typeof window === 'undefined') return [];
  const q = localStorage.getItem(QUEUE_KEY);
  return q ? JSON.parse(q) : [];
}

export function addToOfflineQueue(action) {
  if (typeof window === 'undefined') return;
  const q = getOfflineQueue();
  // Ne pas écraser le timestamp / uuid s'il est déjà là (re-tentative)
  if (!action.uuid) {
    action.timestamp = Date.now();
    action.uuid = crypto.randomUUID();
  }
  q.push(action);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function clearOfflineQueue() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(QUEUE_KEY);
}

export async function processOfflineQueue() {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;

  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  console.log(`Processing ${queue.length} offline actions...`);
  
  // Clear the queue now. Any new action during this process starts a fresh queue.
  clearOfflineQueue();

  for (const action of queue) {
    try {
      const { table, operation, payload, match } = action;
      let error = null;

      if (operation === 'insert') {
        const res = await supabase.from(table).insert([payload]);
        error = res.error;
        if (error && error.code === '23505') error = null; // Ignore duplicate
      } else if (operation === 'update') {
        const res = await supabase.from(table).update(payload).match(match);
        error = res.error;
      } else if (operation === 'delete') {
        const res = await supabase.from(table).delete().match(match);
        error = res.error;
      } else if (operation === 'upsert') {
        const res = await supabase.from(table).upsert([payload]);
        error = res.error;
      }

      if (error) {
        throw error;
      }
    } catch (e) {
      console.error('Failed to sync action', action, e);
      // Re-add to queue if it seems to be a network error or some unexpected fail
      // but avoid endless loops on strict payload errors (like bad schema).
      // Here we assume any error might resolve later, or we check specifically for "Failed to fetch"
      if (e.message === 'Failed to fetch' || String(e).includes('fetch') || e.code === 'PGRST301') {
        addToOfflineQueue(action);
      } else {
        // If it's a real database constraint error (other than 23505), maybe we just drop it
        // Or re-add it to be safe, up to you. Let's re-add but eventually it should be pruned if too old.
        // For now, re-queue only on fetch failures to avoid poison pills:
        if (!navigator.onLine || (e.message && e.message.includes('fetch'))) {
           addToOfflineQueue(action);
        } else {
           console.warn("Action dropped due to hard DB error:", e);
        }
      }
    }
  }
}
