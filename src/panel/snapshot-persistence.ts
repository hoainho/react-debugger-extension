/**
 * Timeline snapshot session-persistence (M-D.5).
 *
 * Persists captured timeline snapshots to `chrome.storage.session` so they
 * survive a panel reload / tab switch, but NOT a page reload (session scope is
 * intentional — snapshots are tied to the inspected page's session). Pure /
 * DI'd storage so it is unit-testable; the TimelineTab wiring (read on mount,
 * write on change) lands in S4 when that view is rebuilt as the Profiler.
 */

export const SNAPSHOT_STORAGE_KEY = 'timeline_snapshots_v1';

export interface SnapshotStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Read persisted snapshots; returns the empty default when none stored. */
export async function readSnapshots<T = unknown>(area: SnapshotStorageArea): Promise<T[]> {
  const rec = await area.get(SNAPSHOT_STORAGE_KEY);
  const value = rec?.[SNAPSHOT_STORAGE_KEY];
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function writeSnapshots<T = unknown>(area: SnapshotStorageArea, snapshots: T[]): Promise<void> {
  await area.set({ [SNAPSHOT_STORAGE_KEY]: snapshots });
}

export async function clearSnapshots(area: SnapshotStorageArea): Promise<void> {
  await area.remove(SNAPSHOT_STORAGE_KEY);
}
