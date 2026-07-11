/**
 * Timeline snapshot session-persistence coverage (M-D.5).
 */
import { describe, it, expect } from 'vitest';
import {
  readSnapshots,
  writeSnapshots,
  clearSnapshots,
  SNAPSHOT_STORAGE_KEY,
  type SnapshotStorageArea,
} from '../panel/snapshot-persistence';

function area(): SnapshotStorageArea & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    async get(k) { return { [k]: store.get(k) }; },
    async set(items) { for (const [k, v] of Object.entries(items)) store.set(k, v); },
    async remove(k) { store.delete(k); },
  };
}

describe('snapshot session persistence', () => {
  it('returns the empty default when nothing is stored', async () => {
    expect(await readSnapshots(area())).toEqual([]);
  });

  it('round-trips snapshots under timeline_snapshots_v1', async () => {
    const a = area();
    const snaps = [{ id: 1, commits: 3 }, { id: 2, commits: 5 }];
    await writeSnapshots(a, snaps);
    expect(a.store.get(SNAPSHOT_STORAGE_KEY)).toEqual(snaps);
    expect(await readSnapshots(a)).toEqual(snaps);
  });

  it('clears persisted snapshots', async () => {
    const a = area();
    await writeSnapshots(a, [{ id: 1 }]);
    await clearSnapshots(a);
    expect(await readSnapshots(a)).toEqual([]);
  });

  it('coerces a corrupt (non-array) value to the empty default', async () => {
    const a = area();
    await a.set({ [SNAPSHOT_STORAGE_KEY]: { not: 'an array' } });
    expect(await readSnapshots(a)).toEqual([]);
  });
});
