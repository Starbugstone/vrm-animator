## TODO

Updated: 2026-03-14

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
- Stay user-first: the app should be explicit, easy to use, and understandable even for people who are not technical.
- Keep launch readiness in scope: the product must ship with one ready-to-go male avatar and one ready-to-go female avatar sourced from the default library.
- Treat guided onboarding for non-technical users as a core requirement throughout implementation, not as optional polish.
- Treat hologram hardware as an optional power-user extension; the core shipped software product must remain complete and useful on its own.

## Next Priorities

### 1. Avatar believability

- improve persona consistency
- improve memory use in prompt assembly
- improve cue quality so avatar reactions feel intentional
- continue curating a core “thinking” movement and emotion VRMA set; the viewer now triggers a metadata-driven thinking presence while waiting for replies, and `default_vrma/thinking/` is the dedicated drop zone for those launch-ready clips
- keep expression overlays facial-only and emotionally coherent
- define and polish the two launch starter avatars from the default asset pool so they feel production-ready

### 2. LLM orchestration

- continue hardening the new provider-native upstream streaming path and fallback behavior with real-provider testing
- keep validating provider-specific stream quirks like MiniMax cumulative deltas and reasoning fields against real accounts
- harden the streamed event contract for text, cue, memory, and completion events
- continue tightening cue validation against allowed avatar animation metadata
- harden retries, timeouts, and provider failure handling
- keep provider model catalogs current as OpenAI, Gemini, DeepSeek, GLM, and MiniMax release new models
- keep model-specific prompt budgets aligned with provider model metadata as catalogs evolve
- make the starter avatars usable immediately once credentials are connected, without extra hidden setup

### 3. Memory tool

- move from inline memory tags to a stricter backend-only tool contract if provider support is reliable
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
- surface prerequisites early so users are told what is needed before they hit blocked states
- make the core software experience feel complete even without any hologram hardware

### 5. Voice and hologram path

- keep the current browser-speech fallback usable through avatar-level speech language and voice preferences
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
- Latest verified implementation window:
  - backend prompt rules now come from `backend/prompts/chat_rules.md`
  - backend prompt rules now explicitly instruct the LLM to place allowed `{emotion:...}` and `{anim:...}` tags inline when the reply tone or body language calls for them
  - `/api/avatars/{id}/chat` now supports streamed SSE playback when `stream: true`
  - streamed SSE playback now uses provider-native upstream deltas instead of replaying a buffered final completion
  - AI Connection now loads selectable model catalogs for OpenRouter, OpenAI, Gemini, DeepSeek, GLM, and MiniMax, with curated non-OpenRouter lists maintained in `backend/config/llm_models/`
  - GLM connections now store their own access mode so each saved credential can target either the standard API endpoint or the Coding subscription endpoint
  - chat prompt assembly now adapts to the selected model, with model-aware limits for history, memory, profile text, movement catalog size, and completion tokens
  - the stream transport now uses stall detection instead of a strict 60-second total timeout, can fall back to non-streamed completion when no usable streamed text arrives, and preserves partial viewer text on mid-stream failure
  - streamed cue events now include backend-resolved asset ids for movement and expression playback so the viewer no longer has to make the final streamed cue choice locally
  - viewer-side chat now consumes streamed text and cue events, plays movement and facial overlays from backend-resolved cues, and uses browser speech synthesis for spoken replies
  - assistant replies may append long-term memory entries through the restricted inline `{memory:...}` bridge, persisted through the existing avatar memory revision flow
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
  - choose the final streamed cue asset server-side for authoritative behavior
  - stream the normalized tag plus the resolved asset id back to the frontend
- Preferred end state:
  - frontend still supports local weighted random selection for preview mode
  - backend is now the source of truth for streamed production cue playback
  - both frontend and backend use the same normalized tag vocabulary
