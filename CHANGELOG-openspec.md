# OpenSpec Integration Changelog

## Summary
Added support for three additional productivity tools (spec-kit, ux-ui-promax, openspec) to the AI Sandbox Wrapper. All tools are installed **inside Docker containers only** (no host installation), making them available to all containerized AI tools.

## Timeline

### 2026-01-23 - Session 1: Initial OpenSpec Support
**Commit:** `ea7c1ca` - feat: add OpenSpec as optional additional tool in base image

- Added OpenSpec as an optional tool to install inside Docker containers
- Modified `lib/install-base.sh` to conditionally install OpenSpec
- Created mechanism to pass `INSTALL_OPENSPEC` environment variable
- Fixed scoped package name: `@fission-ai/openspec`

### 2026-01-23 - Session 1: Standalone Option (Later Reverted)
**Commit:** `3c63ad7` - feat: add OpenSpec as standalone tool option

- Created `lib/install-openspec.sh` for host installation
- Added OpenSpec to main AI tools menu
- Introduced dual installation modes: standalone and container
- **LATER REMOVED** - User clarified all additional tools should be container-only

### 2026-01-23 - Session 1: Menu Reorganization
**Commit:** `c5c637c` - refactor: move spec-kit, ux-ui-promax, openspec to Additional Tools menu

- Moved spec-kit, ux-ui-promax, and openspec from main AI tools menu
- Created separate "Additional Tools" menu for productivity tools
- Separated main AI tools (containerized + IDE) from additional tools

### 2026-01-23 - Session 1: Container-Only Refactor
**Commit:** `8d1d267` - refactor: make all additional tools container-only

**Key realization:** User clarified ALL additional tools should be container-only.

Changes:
- **Deleted** standalone installer scripts:
  - `lib/install-openspec.sh`
  - `lib/install-spec-kit.sh`
  - `lib/install-ux-ui-promax.sh`
- **Removed** `openspec-container` option (now just `openspec`)
- **Updated** `lib/install-base.sh` to install all three tools in base image
- **Removed** host aliases for additional tools
- Additional tools menu now only shown if containerized tools selected

### 2026-01-25 - Session 2: Spec-Kit Installation Fix
**Commit:** `eeae651` - fix: use correct spec-kit installation from GitHub

**Critical discovery:** User pointed out spec-kit is NOT from npm, it's from GitHub.

Fixed:
```bash
# WRONG (npm):
RUN npm install -g @letuscode/spec-kit

# CORRECT (pipx from GitHub):
RUN pipx install specify-cli --pip-args="git+https://github.com/github/spec-kit.git"
```

- spec-kit is a **Python CLI tool** installed via `pipx`
- Command name is `specify` (not `speckit`)
- Source: `github/spec-kit` GitHub repository

**Commit:** `b1a065c` - chore: regenerate base Dockerfile with correct spec-kit installation
- Regenerated Dockerfile with the correct installation command

**Commit:** `000ab70` - fix: use correct 'specify' command name for spec-kit
- Updated completion message in `setup.sh` to use `specify` instead of `speckit`

**Commit:** `5c6cfc2` - chore: make install-base.sh executable
- Fixed file permissions for `lib/install-base.sh`

**Commit:** `811e371` - fix: use bun instead of npm for uipro-cli installation
- Changed from `npm install -g` to `bun install -g` for uipro-cli
- Base image uses Bun runtime, not npm
- Ensures consistent package manager usage

## Final State

### Architecture
All three additional tools are installed **in the base Docker image** (`ai-base:latest`), making them available in ALL containerized AI tools without requiring separate installations.

### Installation Methods
| Tool | Method | Package/Source | Command |
|------|--------|----------------|---------|
| **spec-kit** | pipx (Python) | `git+https://github.com/github/spec-kit.git` | `specify` |
| **ux-ui-promax** | bun | `uipro-cli` | `uipro` |
| **openspec** | bun (local) | `@fission-ai/openspec` | `openspec` |

### Files Modified
1. **`setup.sh`**:
   - Main AI tools menu unchanged
   - Additional Tools menu (shown only if containerized tools selected)
   - Exports: `INSTALL_SPEC_KIT`, `INSTALL_UX_UI_PROMAX`, `INSTALL_OPENSPEC`

2. **`lib/install-base.sh`**:
   - Builds base Docker image with conditional tool installation
   - Generates `dockerfiles/base/Dockerfile` with correct RUN commands

3. **`dockerfiles/base/Dockerfile`**:
   - Generated file (recreated during setup)
   - Contains installation commands for all three tools

### Verification Status
✅ All package names verified:
- `@fission-ai/openspec` - Confirmed from npm registry
- `uipro-cli` - Confirmed from npm registry
- `github/spec-kit` - Confirmed from GitHub, installed via pipx

✅ All command names verified:
- `specify` - Correct for spec-kit
- `uipro` - Correct for ux-ui-promax
- `openspec` - Correct for openspec

## Testing Checklist

When testing the complete flow:

```bash
# 1. Run setup
./setup.sh

# 2. Select a containerized AI tool (e.g., claude, gemini)

# 3. Select all three additional tools:
#    - spec-kit
#    - ux-ui-promax
#    - openspec

# 4. After setup completes, verify installations:
docker run --rm ai-base:latest specify --version
docker run --rm ai-base:latest uipro --version
docker run --rm ai-base:latest openspec --version

# 5. Verify tools are available in AI containers:
ai-run claude
# Inside container:
which specify uipro openspec
```

## Key Technical Decisions

1. **Container-only installation** - No host pollution, all tools inside containers
2. **Base image installation** - All containerized AI tools inherit these tools
3. **Conditional installation** - Tools only installed if user selects them during setup
4. **Correct installation methods**:
   - Python tools (spec-kit) → pipx from GitHub
   - npm tools (ux-ui-promax) → npm global
   - Bun tools (openspec) → Local install with symlink

## Documentation Updates Needed

- [ ] Update README.md with additional tools section
- [ ] Add usage examples for each tool
- [ ] Document that tools are only available inside containers
- [ ] Add troubleshooting section for tool installation issues

## Known Issues / Limitations

1. **No host access**: Additional tools only available inside AI containers, not on host
2. **Base image rebuild**: Changing tool selection requires rebuilding base image
3. **All or nothing**: Can't select different tools for different AI containers (all inherit from base)

## Future Improvements

1. Consider per-tool Docker layers for faster rebuilds
2. Add option to install tools on host (optional)
3. Create unified config management for all three tools
4. Add integration tests for tool availability in containers
