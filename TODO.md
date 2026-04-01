## TODO

Updated: 2026-03-25

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
- keep tightening memory use in prompt assembly now that token diagnostics and manual LLM compression are in place
- test whether the new split between Relationship Memory and Long-Term Memory produces better character consistency in real chats
- refine the new long-term memory directive and compression prompt based on real chat behavior
- improve cue quality so avatar reactions feel intentional
- keep tuning speech-time cue pacing so long spoken replies stay lively without becoming repetitive
- keep refining the new avatar presence state machine plus reply-motion queue so conversational gestures and speech handoffs stay smooth under messy real-world provider timing
- continue polishing the core “thinking” movement and emotion VRMA set; `thinking` is now a first-class animation kind used for viewer wait states, and `default_vrma/thinking/` remains the dedicated drop zone for those launch-ready clips
- keep expression overlays facial-only and emotionally coherent
- define and polish the two launch starter avatars from the default asset pool so they feel production-ready

### 2. LLM orchestration

- continue hardening the new provider-native upstream streaming path and fallback behavior with real-provider testing
- keep validating provider-specific stream quirks like MiniMax cumulative deltas and reasoning fields against real accounts
- harden the streamed event contract for text, cue, memory, and completion events
- keep validating live chat routing after credential edits so changing a saved credential model or provider immediately affects subsequent turns instead of reusing stale conversation metadata
- continue tightening cue validation against allowed avatar animation metadata
- keep refining the new stage-direction normalization so raw provider habits like `*smiles*`, long descriptive action lines, legacy equals-style cue bundles, and `[laughing]` stay hidden from visible chat while still mapping cleanly into allowed avatar cues and compact ElevenLabs speech actions such as `[giggles]`, without stripping real spoken emphasis like `*say*`
- harden retries, timeouts, and provider failure handling
- keep provider model catalogs current as OpenAI, Gemini, DeepSeek, GLM, and MiniMax release new models
- keep model-specific prompt budgets aligned with provider model metadata as catalogs evolve
- make the starter avatars usable immediately once credentials are connected, without extra hidden setup

### 3. Memory tool

- move from inline memory tags to a stricter backend-only tool contract if provider support is reliable
- keep updates scoped strictly to the authenticated user and selected avatar
- preserve revision history and auditability
- decide how much automatic memory compression or summarization should happen without surprising the user
- improve memory structure beyond a single markdown document if long-term personality fidelity needs a richer model
- tune the new memory warning threshold once real prompt footprints are observed across multiple providers and models

### 4. Frontend cleanup

- continue splitting large UI surfaces where useful
- break down `ManagePage`, `useWorkspace`, and `useHologramViewer` before they become harder to reason about
- keep Manage and Viewer concerns separated
- keep bundle splitting healthy so Three/VRM code does not dominate the main app chunk
- remove any new duplicated transformation logic as it appears
- improve UX without weakening backend authority
- keep the new Viewer debug rail useful without turning it into a separate source of truth; if turn-history debug persistence is needed later, back it with the backend instead of reconstructing prompts in the browser
- add a guided tour / setup flow that walks non-technical users through avatar selection, identity setup, LLM setup, and first chat
- keep every setup surface biased toward plain language, clear sequencing, and obvious next actions
- surface prerequisites early so users are told what is needed before they hit blocked states
- make the core software experience feel complete even without any hologram hardware
- finish wiring the new Stitch-driven Control Center and Workspace redesign now that the shell and placeholder screens are live
- replace the new placeholder procedural controls with real runtime-backed settings for blinking, breathing, lip sync input, and tactile interaction
- keep iterating on the new live hologram projection tab: add calibration transport, stronger PIXELXL preset handling, and clearer fullscreen/second-screen guidance
- decide whether the Viewer should keep its current select dropdown for avatar switching or move fully to the planned searchable visual card list with avatar snapshots

### 5. Voice and hologram path

- keep the current browser-speech fallback usable through avatar-level speech language and voice preferences
- validate the new avatar-level no-voice text-only mode against longer replies so cue annotations, delayed gestures, and transcript rendering stay coherent without any audio playback
- harden the new ElevenLabs BYOK streaming TTS path now that avatar-level voice routing exists
- keep the browser-speech fallback reliable whenever an avatar has no ElevenLabs voice selected or remote playback fails
- route future browser boundary timing and ElevenLabs timestamp/alignment data through the new centralized speech clock before adding more reply-sync logic
- monitor how the refreshed ElevenLabs voice search, stricter avatar language/sex matching, the new tabbed Voice Library flow, and direct library sample playback behave against large real-world voice libraries
- keep broadening language matching in the ElevenLabs picker as more real-world metadata variants show up, especially labels that use full language names instead of locale codes
- decide whether more ElevenLabs controls should live at the credential level, avatar level, or stay hidden for first-time users
- add STT after TTS
- harden the new four-view hologram path around real hardware use: confirm the 10-inch prism orientation, add offset tuning, and keep main-viewer-to-projection sync reliable now that the projection tab mirrors live base and overlay motion, vertically flips all four panels, centers the four-view cross on the prism dot instead of the screen grid, exposes a center alignment dot, and supports fullscreen launch plus an in-tab exit control

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
  - the Viewer right rail now includes an LLM debug log for recent turns, showing the exact upstream prompt message payload and raw completion text so memory and prompt behavior can be inspected without opening backend logs
  - the Viewer left rail, stage, and right rail now keep independent desktop scrolling so long side panels do not push the avatar out of view
  - Manage now includes a dedicated `Voice & speech` section with backend-backed ElevenLabs BYOK credentials, per-avatar speech routing, avatar sex tags, voice overrides, and clear browser-speech fallback behavior
  - avatars now also support an explicit `speechMode`, so a user can disable all voice playback for plain text chat while still seeing cue annotations such as `[giggles]` in assistant replies
  - the workspace now keeps the last selected avatar as the per-user default on return instead of clearing that preference during initial bootstrap
  - avatars now persist `presentationGender` plus optional ElevenLabs voice attachment so shared starter avatars can default to a sensible voice filter without forcing a hard lock
  - avatars now also persist a `defaultFacingYaw`, and the Manage profile preview can save the current rotated T-pose view as the avatar's default starting direction for both Manage and Viewer loads
  - the viewer now prefers streamed ElevenLabs audio playback when an avatar has a saved remote voice, while falling back to browser speech if no remote voice is configured or playback fails
  - chat parsing now strips raw stage-direction markers like `*smiles*`, `**laughs**`, long descriptive action blocks, legacy bracket bundles like `[emotion=playful | anim:Dance Twirl | delay:1.2s]`, and `[laughing]` from visible assistant text, resolves matching cues against allowed avatar assets when possible, keeps short spoken-emphasis markers like `*say*` visible, and exposes a dedicated speech-only text variant for ElevenLabs playback with compact actions such as `[giggles]`
  - assistant replies may append long-term memory entries through the restricted inline `{memory:...}` bridge, persisted through the existing avatar memory revision flow
  - memory responses now include approximate prompt-footprint diagnostics, active provider/model details, and the exact memory-related prompt blocks shown in the Manage memory panel
  - the Manage memory panel can now trigger manual LLM-backed compression through `/api/avatars/{id}/memory/compress`, with the compressed result saved as a normal revision
  - memory now distinguishes Relationship Memory from Long-Term Memory, supports scoped `{memory:relationship|...}` and `{memory:long-term|...}` tags, and warns in Manage when the selected model is running short on reserved memory allowance
  - user-editable avatar system-prompt fields have been removed from the main product flow; avatar name, backstory, and personality are now framed as chat-only character data rather than true system instructions
- Encryption requirements:
  - provider secrets must be encrypted at rest
  - never serialize raw secrets back to the frontend
  - only expose masked metadata such as provider name, active status, and default model

## Follow-Up After Initial Release

- Expand beyond the first ElevenLabs voice flow only after the current TTS setup proves reliable in real use.
- Keep validating edge cases where an avatar language or sex change leaves an older saved ElevenLabs voice selected, so the picker stays explicit about hidden mismatches instead of silently showing the wrong voice inside `Available voices`.
- Add STT once TTS is stable.
- Evaluate structured output in addition to inline cue tags if provider support is consistent.
- Continue iterating on semantic memory summarization now that the first manual compression path exists.
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


## ideas - emotional state
- have the avatar keep an emotional memory from global memory to state the idle animations. if angry then prioritise angry idle stances, if happy then prioritise happy idle stances, worried the same and all other emotional possibilities possible with vrma posibilities.
- emotional memory. remember the actual state of the avatar and respond depending on that state (angry, happy, calm,ancious, flirty ... expand on the basic emotional states). These states should evolve depending on the discussion and situation and be updated
- make sur custom vrma uploaded animations have the emotional tags so the avatar can use them accordingly depending on emotional state
- use a bucket / weight system for emotions to value how the avatar feels the most inclined towards, can mix 2
- replys from LLM must include the actual top emotions and the app should ajust with the bucket implemented.


## Ideas - better avatar selection.
- We need a better avatar selection on the viewer page, probably an image of the avatar (not in 3D, just a jpeg snapshot to save on resources, so have an option to take a photo for the profile)
- a short description of the model, taken from the avatars profile
- this should be a list of wide cards in a scrollable and surchable list so power users that have meny avatars can easily search and switch between avatars

## Ideas - 3D hologram
- this is the end goal, we will need a button to open a new window dedicated to the hologram projection.
- for prototyping and cost, I'm using https://holusion.com/en/store/pixelxl so we have to work on the 4 camera projection to make this work
- the rotation and position of the hologram images need to be controlled from the main view port so some sort of communication between windows, needs to be carefuly detailed in the readme on how to use hologram projection
- the export tab now mirrors live viewer motion more closely, but it still needs per-device offset tuning and a documented calibration workflow for the PIXELXL prism
