# Wiki Templates

This directory contains the bootstrap content for the [GitHub Wiki](https://github.com/hoainho/react-debugger-extension/wiki). The wiki is **disabled by default** on this repo — the maintainer needs to enable it once before any of this can be published.

## Enabling the Wiki (one-time owner action)

1. Go to https://github.com/hoainho/react-debugger-extension/settings
2. Scroll to **Features**
3. Tick the **Wikis** checkbox
4. Optionally tick **Restrict editing to collaborators only** (recommended — see "Why restrict" below)

Once enabled, the wiki lives at https://github.com/hoainho/react-debugger-extension/wiki.

## Why a separate wiki at all?

The repo already has `README.md`, `CHANGELOG.md`, `DEBUGGING-GUIDE.md`, `EDGE-CASES.md`, `CONTRIBUTING.md`, `SECURITY.md`, plus the `openspec/` and `.sisyphus/` design surfaces. A wiki should **not duplicate** any of these. Its purpose is **living docs that change shape** — content where the structure itself evolves and where being able to edit without a PR is valuable:

- Architecture overviews that get re-drawn as the design evolves
- FAQs that grow organically from Q&A discussions
- Tutorial walkthroughs where step counts change with releases
- Cookbook recipes that community members add to over time

In-repo `.md` files are for **versioned, reviewed, canonical** content. The wiki is for **continuously edited reference**.

## Why restrict editing

GitHub wikis are public-edit by default once enabled. That's good for a Wikipedia-style community knowledge base, but for a smaller project it invites spam. Recommend restricting to collaborators only; promote trusted contributors as you see them.

## Pages in this directory

Each file maps 1:1 to a wiki page. Copy the file contents into a new wiki page with the same title.

| File | Wiki page title | Purpose |
|---|---|---|
| `Home.md` | `Home` | Landing page; replaces default `_Home` |
| `Architecture-Overview.md` | `Architecture Overview` | The 4-context message-passing chain, who owns what |
| `FAQ.md` | `FAQ` | Living frequently-asked-questions, seeded with the AMA examples |
| `Cookbook-Common-Recipes.md` | `Cookbook: Common Recipes` | Snippet library for typical debugging workflows |
| `Glossary.md` | `Glossary` | Domain terms (fiber, commit, render reason, CLS, etc.) |
| `Release-Process.md` | `Release Process` | Maintainer-facing checklist for cutting a release |

## Sidebar + Footer

GitHub Wiki supports a custom sidebar (`_Sidebar.md`) and footer (`_Footer.md`). After publishing the 6 pages, copy these:

**`_Sidebar.md`:**

```md
**Getting started**
* [Home](Home)
* [FAQ](FAQ)

**For users**
* [Cookbook: Common Recipes](Cookbook-Common-Recipes)
* [Glossary](Glossary)

**For contributors**
* [Architecture Overview](Architecture-Overview)
* [Release Process](Release-Process)

**External**
* [README](https://github.com/hoainho/react-debugger-extension/blob/main/README.md)
* [Discussions](https://github.com/hoainho/react-debugger-extension/discussions)
* [Issues](https://github.com/hoainho/react-debugger-extension/issues)
```

**`_Footer.md`:**

```md
Wiki content edited by collaborators. For canonical reference, see the [README](https://github.com/hoainho/react-debugger-extension) and [DEBUGGING-GUIDE](https://github.com/hoainho/react-debugger-extension/blob/main/DEBUGGING-GUIDE.md). For bugs → [Issues](https://github.com/hoainho/react-debugger-extension/issues). For chat → [Discussions](https://github.com/hoainho/react-debugger-extension/discussions).
```
