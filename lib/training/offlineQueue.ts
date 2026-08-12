import { storageGet, storageRemove, storageSet } from '@/lib/utils/storage';
import type { WorkoutSet } from '@/types';

const QUEUE_KEY = 'reforge.offline.set_patches.v1';

export type QueuedSetPatch = {
  id: string;
  setId: string;
  patch: Partial<Pick<WorkoutSet, 'weight_kg' | 'reps' | 'completed' | 'notes' | 'rpe' | 'rir'>>;
  createdAt: string;
  attempts: number;
};

async function readQueue(): Promise<QueuedSetPatch[]> {
  const raw = await storageGet(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedSetPatch[];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedSetPatch[]) {
  if (items.length === 0) {
    await storageRemove(QUEUE_KEY);
    return;
  }
  await storageSet(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueSetPatch(
  setId: string,
  patch: QueuedSetPatch['patch'],
): Promise<void> {
  const queue = await readQueue();
  const existing = queue.findIndex((q) => q.setId === setId);
  const item: QueuedSetPatch = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    setId,
    patch,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  if (existing >= 0) {
    queue[existing] = {
      ...queue[existing],
      patch: { ...queue[existing].patch, ...patch },
      createdAt: item.createdAt,
    };
  } else {
    queue.push(item);
  }
  await writeQueue(queue);
}

export async function peekSetQueue(): Promise<QueuedSetPatch[]> {
  return readQueue();
}

export async function removeQueuedPatch(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((q) => q.id !== id));
}

export async function flushSetQueue(
  flushOne: (item: QueuedSetPatch) => Promise<void>,
): Promise<{ flushed: number; failed: number }> {
  const queue = await readQueue();
  let flushed = 0;
  let failed = 0;
  const remaining: QueuedSetPatch[] = [];

  for (const item of queue) {
    try {
      await flushOne(item);
      flushed += 1;
    } catch {
      failed += 1;
      remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }

  await writeQueue(remaining);
  return { flushed, failed };
}
