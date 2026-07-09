import { useEffect, useState } from 'react';
import { readSnapshots, writeSnapshots } from '../snapshot-persistence';

export interface ProfilerSnapshot {
  id: number;
  commits: number;
}

/**
 * Profiler view of the redesigned shell (S4-5). Wires the S3 session snapshot-
 * persistence helper: hydrates from chrome.storage.session on mount so captured
 * snapshots survive a panel reload / tab switch (the M-D.5 wiring deferred from S3).
 */
export function ProfilerView() {
  const [snapshots, setSnapshots] = useState<ProfilerSnapshot[]>([]);

  useEffect(() => {
    let live = true;
    if (typeof chrome !== 'undefined' && chrome.storage?.session) {
      const area = chrome.storage.session as unknown as Parameters<typeof readSnapshots>[0];
      readSnapshots<ProfilerSnapshot>(area).then((s) => {
        if (live) setSnapshots(s);
      });
    }
    return () => {
      live = false;
    };
  }, []);

  const capture = async (snap: ProfilerSnapshot) => {
    const next = [...snapshots, snap];
    setSnapshots(next);
    if (typeof chrome !== 'undefined' && chrome.storage?.session) {
      const area = chrome.storage.session as unknown as Parameters<typeof writeSnapshots>[0];
      await writeSnapshots(area, next);
    }
  };

  return (
    <div className="profiler-view" data-snapshot-count={snapshots.length}>
      <button type="button" onClick={() => void capture({ id: snapshots.length + 1, commits: 0 })}>
        Capture snapshot
      </button>
    </div>
  );
}
