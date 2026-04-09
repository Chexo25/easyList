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
  // Action: { table, operation: 'insert'|'update'|'delete'|'upsert', payload, match? }
  q.push({ ...action, timestamp: Date.now(), uuid: crypto.randomUUID() });
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
  
  // Clear the queue to prevent infinity loops if one crashes - we retry only cleanly
  // A better strategy would retain failed ones, but for this usecase, last-write-wins is enough.
  clearOfflineQueue();

  for (const action of queue) {
    try {
      const { table, operation, payload, match } = action;
      if (operation === 'insert') {
        const { error } = await supabase.from(table).insert([payload]);
        if (error && error.code !== '23505') throw error; // Ignore if already exists (e.g. duplicate item id)
      } else if (operation === 'update') {
        await supabase.from(table).update(payload).match(match);
      } else if (operation === 'delete') {
        await supabase.from(table).delete().match(match);
      } else if (operation === 'upsert') {
        await supabase.from(table).upsert([payload]);
      }
    } catch (e) {
      console.error('Failed to sync action', action, e);
      // Optional: push it back to the queue
      // addToOfflineQueue(action);
    }
  }
}
