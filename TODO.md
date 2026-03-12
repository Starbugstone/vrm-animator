## TODO

Updated: 2026-03-12

This file is intentionally short. `devlog.md` holds the product narrative and end goal; this file is the working task list for the next implementation window.

## Stable Baseline

The project is at a stable-enough checkpoint where:

- avatars can be created from shared presets or private uploads
- avatars can be customized with identity, prompt, and memory
- private animations can be uploaded and edited
- the viewer can load avatars and play configured VRMA-driven motion
- chat, credentials, memory, and conversation persistence are already wired through the backend

This baseline has been verified against the current repository. The next phase should build on it rather than restating already-landed CRUD and management work.

## Current Rules

- No new frontend-only source of truth for assets, memory, credentials, or chat state.
- Keep the backend authoritative for LLM orchestration, ownership, and persistence.
- Keep `devlog.md` and `AGENTS.md` aligned with any roadmap changes.
- Prefer smaller, separable modules over growing large mixed-responsibility components.
- Keep launch readiness in scope: the product must ship with one ready-to-go male avatar and one ready-to-go female avatar sourced from the default library.
- Treat guided onboarding for non-technical users as a core requirement throughout implementation, not as optional polish.

## Next Priorities

### 1. Avatar believability

- improve persona consistency
- improve memory use in prompt assembly
- improve cue quality so avatar reactions feel intentional
- keep expression overlays facial-only and emotionally coherent
- define and polish the two launch starter avatars from the default asset pool so they feel production-ready

### 2. LLM orchestration

- add backend-brokered streaming chat
- normalize streaming events for text plus animation cues
- tighten cue validation against allowed avatar animation metadata
- harden retries, timeouts, and provider failure handling
- make the starter avatars usable immediately once credentials are connected, without extra hidden setup

### 3. Memory tool

- implement the single allowed LLM tool for memory updates
- keep updates scoped strictly to the authenticated user and selected avatar
- preserve revision history and auditability

### 4. Frontend cleanup

- continue splitting large UI surfaces where useful
- break down `ManagePage`, `useWorkspace`, and `useHologramViewer` before they become harder to reason about
- keep Manage and Viewer concerns separated
- keep bundle splitting healthy so Three/VRM code does not dominate the main app chunk
- remove any new duplicated transformation logic as it appears
- improve UX without weakening backend authority
- add a guided tour / setup flow that walks non-technical users through avatar selection, identity setup, LLM setup, and first chat
- keep every setup surface biased toward plain language, clear sequencing, and obvious next actions

### 5. Voice and hologram path

- add TTS after the text chat loop feels solid
- add STT after TTS
- only then move toward dedicated hologram hardware output

## Spring-Cleaning Check

The current repo does not need destructive cleanup, but it does need routine maintenance in a few places:

- `TODO.md` previously drifted behind the implementation and has been pruned to current priorities
- the frontend production build needed explicit chunk splitting because the viewer stack is heavy
- the largest remaining cleanup targets are `src/useHologramViewer.js`, `src/components/ManagePage.jsx`, and `src/hooks/useWorkspace.js`
- backend test coverage is in place, but the suite still emits expected 404 noise and one PHPUnit deprecation that should be cleaned up when touching test infrastructure

## Verification Baseline

Before closing a feature set, the minimum checks should be:

- `npm test`
- `npm run build`
- `docker compose exec -T php php bin/phpunit`
- Encryption requirements:
  - provider secrets must be encrypted at rest
  - never serialize raw secrets back to the frontend
  - only expose masked metadata such as provider name, active status, and default model

## Follow-Up After Initial Release

- Add STT and TTS once text streaming is stable.
- Evaluate structured output in addition to inline cue tags if provider support is consistent.
- Consider optional semantic memory summarization so `memory.md` stays compact.
- Consider ephemeral provider sessions only if they preserve the same security guarantees as the backend proxy.
- Expand onboarding help after launch based on where non-technical users get stuck most often.

## Backend Integration Steps For The Catalogs

- Add first-class backend metadata fields for both body actions and expression overlays:
  - `name`
  - `description`
  - `tags`
  - `weight`
  - `kind` such as `action`, `expression`, `speech_fallback`, `reaction`
  - `channels` such as `mouth`, `eyes`, `face`, `body`
- Split animation storage logically:
  - body actions in the existing animation library
  - face/mouth overlays in a dedicated expression category
- During chat orchestration, the backend should:
  - normalize provider emotion tags into the shared vocabulary
  - resolve allowed candidate assets for the selected avatar
  - optionally choose the final asset server-side for authoritative behavior
  - stream either the normalized tag or the resolved asset id back to the frontend
- Preferred end state:
  - frontend still supports local weighted random selection for preview mode
  - backend becomes the source of truth for production
  - both frontend and backend use the same normalized tag vocabulary
