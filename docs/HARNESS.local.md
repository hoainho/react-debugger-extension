<!-- Regular file, NOT a symlink. Survives standalone clones. -->

# Harness — local pointer for `react-debugger-extension`

The authoritative harness lives at the workspace root, **not in this repo**.

- **In-workspace path:** `../../docs/HARNESS.md` (resolved by the symlinks at `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, `docs/HARNESS_BACKLOG.md`, `docs/templates/story.md`, `docs/evidence/README.md`)
- **Workspace canonical:** `/Users/nhonh/Documents/personal/docs/HARNESS.md`
- **If you cloned this repo standalone (outside the personal workspace):** the symlinks will be broken. To restore the harness:
  1. Re-clone inside `~/Documents/personal/`, OR
  2. Once published, install via `npx @nano-step/skill-manager get harness-init && bash ~/.config/opencode/skills/harness-init/scripts/install.sh --target "$PWD"`

Why a pointer instead of a copy? See [Consumption Model in HARNESS.md](../../docs/HARNESS.md#consumption-model) at the workspace root.
