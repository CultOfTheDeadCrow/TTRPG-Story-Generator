# TTRPG Story Engine

A local desktop GM tool for managing Shadowrun (or other) tabletop RPG campaigns with AI-powered story generation and session import.

---

## Features

- **Entity Management** — Create and maintain a knowledge base of Characters, Locations, and Events. Each entity tracks status, tags, description, notes, and a full change history.
- **AI Story Generation** — Select context entities, write a free-text prompt, and Claude streams a scene. Proposed knowledge-base updates are presented as a diff for review before anything is committed.
- **Session Protocol Import** — Paste raw session notes. Claude analyzes them against your full knowledge base, flags contradictions, and proposes updates (including new entities). Review and apply via the same diff pipeline.
- **Draft Resumption** — Save an in-progress generation as a draft and restore it later to continue where you left off.
- **Story and Session Archive** — Browse all past generated stories and imported sessions with full metadata.
- **Bilingual support** — Prompts and session notes can be in German or English; Claude resolves approximate references against entity names in either language.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 35 |
| Renderer | React 18 + TypeScript |
| Build tooling | electron-vite + Vite |
| UI components | shadcn/ui + Tailwind CSS v4 |
| Database | better-sqlite3 (SQLite, local file) |
| AI | Anthropic Claude SDK (Sonnet-class) |
| Tests | Vitest |

---

## Prerequisites

- **Node.js** LTS (v20 or later recommended)
- An **Anthropic API key** with access to a Claude Sonnet-class model

---

## Getting Started

```bash
git clone https://github.com/your-username/shadowrun-story-engine.git
cd shadowrun-story-engine
npm install
npm run dev
```

`npm install` runs `electron-rebuild` automatically via the `postinstall` script to compile `better-sqlite3` against the correct Electron ABI. No manual rebuild step is needed.

On first launch, open **Settings** (sidebar, bottom) and enter your Anthropic API key. The key is stored locally using Electron's `safeStorage` encryption.

---

## Build

```bash
npm run build
```

Produces a distributable via `electron-builder`:

- **Linux** — AppImage
- **macOS** — dmg
- **Windows** — NSIS installer

---

## Project Structure

```
src/
  main/         Electron main process: app lifecycle, DB initialization,
                IPC handlers, AI streaming service (ai.ts)
  preload/      contextBridge — exposes window.electronAPI to the renderer
  renderer/     React UI: entity management, story generator,
                session import, archive screens, diff-review component
  shared/       Shared TypeScript types used by main + renderer
tests/          Vitest unit tests (entity service, migrations, AI parsing)
```

---

## How It Works

There are two primary workflows, both flowing through the same diff-review-apply pipeline:

**Story Generation**

1. Select one or more context entities (Characters, Locations, Events)
2. Write a free-text narrative prompt
3. Claude streams a story response with structured KB update proposals embedded
4. Review each proposed field change as a diff — accept or reject individual updates
5. Apply: accepted changes are written to the DB with a change-history entry

**Session Protocol Import**

1. Paste free-form session notes (German or English)
2. Claude receives the full knowledge base plus the notes and returns a structured analysis: proposed entity updates, contradiction flags, and new entity suggestions
3. Review the diff — accept or reject each proposed change, add new entities as needed
4. Apply: all accepted changes are committed to the DB

Drafts from story generation are persisted to the DB so you can close the app mid-stream and resume later.

---

## Notes

- The app is **local-only** — no cloud sync, no remote database.
- The API key is stored on-device via Electron `safeStorage` and never leaves the machine except in requests to the Anthropic API.
- "Apply is final" by design — revert any update by editing the entity manually. Change history records every prior value.

---

## License

License: GPL v3
