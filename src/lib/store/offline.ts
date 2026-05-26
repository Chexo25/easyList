import { supabase } from '../db/supabase';

const QUEUE_KEY = 'easyList_offline_queue';

interface OfflineAction {
  table: string;
  operation: 'insert' | 'update' | 'delete' | 'upsert';
  payload: unknown;
  match: Record<string, unknown> | null;
  uuid?: string;
  timestamp?: number;
}

function getStore(): Storage | null {
  return typeof window !== 'undefined' ? localStorage : null;
}

export function getOfflineQueue(): OfflineAction[] {
  const store = getStore();
  if (!store) return [];
  const q = store.getItem(QUEUE_KEY);
  return q ? JSON.parse(q) : [];
}

export function addToOfflineQueue(action: OfflineAction) {
  const store = getStore();
  if (!store) return;
  const q = getOfflineQueue();
  q.push({
    ...action,
    timestamp: Date.now(),
    uuid: crypto.randomUUID(),
  });
  store.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function clearOfflineQueue() {
  const store = getStore();
  if (!store) return;
  store.removeItem(QUEUE_KEY);
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === 'Failed to fetch') return true;
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    String((err as Record<string, unknown>).message).includes('fetch')
  )
    return true;
  if (err && typeof err === 'object' && 'code' in err && (err as Record<string, unknown>).code === 'PGRST301')
    return true;
  return false;
}

export async function processOfflineQueue() {
  const store = getStore();
  if (!store) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  console.log(`Processing ${queue.length} offline actions...`);
  clearOfflineQueue();

  for (const action of queue) {
    try {
      const { table, operation, payload, match } = action;
      let error: unknown = null;

      if (operation === 'insert') {
        const res = await supabase.from(table).insert([payload]);
        error = res.error;
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as Record<string, unknown>).code === '23505'
        )
          error = null;
      } else if (operation === 'update') {
        let query = supabase.from(table).update(payload);
        if (match) query = query.match(match);
        const res = await query;
        error = res.error;
      } else if (operation === 'delete') {
        let query = supabase.from(table).delete();
        if (match) query = query.match(match);
        const res = await query;
        error = res.error;
      } else if (operation === 'upsert') {
        const res = await supabase.from(table).upsert([payload]);
        error = res.error;
      }

      if (error) throw error;
    } catch (e: unknown) {
      console.error('Failed to sync action', action, e);

      if (isNetworkError(e)) {
        addToOfflineQueue(action);
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        addToOfflineQueue(action);
      } else {
        console.warn('Action dropped due to hard DB error:', e);
      }
    }
  }
}
