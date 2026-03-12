# VRM Animator Dev Log

This file is the live project recap and the current end-goal reference for VRM Animator.

It is based on the repository history, the current codebase, the existing roadmap in `AGENTS.md`, and the active task list in `TODO.md`. It is not a full meeting log; it is the best code-backed summary of what has happened so far and what the project is driving toward.

## Project End Goal

The real goal of VRM Animator is to transform a 3D avatar, attached to one or more LLMs, into a believable conversational character that can chat with a user naturally.

The intended progression is:

1. Start with text-based discussion.
2. Make the avatar feel responsive, lifelike, and consistent through animation, memory, and personality.
3. Evolve that text interaction into full speech with speaking and listening.
4. Eventually drive a physical desktop-sized hologram setup through dedicated hardware output.

This means the primary product goal is not just "a viewer with chat." It is a personality-driven avatar system where the 3D character feels alive, remembers the user, reacts appropriately, and can be powered by one or multiple LLMs depending on the experience being built.

The hologram hardware path is a final destination, not the immediate milestone. Before hardware matters, the avatar itself needs to become convincing.

## What Has Happened So Far

### 1. Base viewer foundation landed

The project started as a frontend-first VRM viewer. The first working milestone was loading a VRM model into a Three.js scene and rendering a usable hologram-style viewer in the browser.

This phase established:

- the Vite + React frontend
- the initial `useHologramViewer` path
- the canvas-based avatar display
- the first iteration of camera and viewer controls

### 2. VRMA animation playback became real

After the base viewer worked, the project moved from static avatars to motion playback using real `.vrma` files.

That brought in:

- support for actual VRMA clips instead of placeholder behavior
- idle loops
- animation transitions
- blinking support
- smoother visual state changes in the viewer

At that point the project was no longer just a model loader; it became an avatar animator.

### 3. Shared demo content was added

To make the viewer usable without user uploads, shared example assets were added to the repository:

- default VRM avatars in `default_vrm/`
- default body animations in `default_vrma/`
- idle motion clips in `idle/`
- expression and mouth overlays in `expressions_vrma/`

This created the first practical out-of-the-box experience: pick an avatar, pick a motion, and see it animate.

### 4. Expression overlays and emotion scaffolding were introduced

The next milestone added facial and mouth-driven overlays, plus the first emotion-oriented animation planning.

That phase established:

- facial-only VRMA overlays
- mouth movement tests
- emotion-tagged expression catalogs
- the current split between body actions, idle states, and expression overlays

This was the bridge from simple playback toward LLM-driven reactions.

### 5. The backend became the authority

The project then shifted from a mostly frontend experiment into a real application with persistence and ownership rules.

The Symfony backend now provides:

- JWT auth with register and login
- refresh token rotation
- Google sign-in exchange to backend-issued JWT
- authenticated current-user access via `/api/me`
- private avatar ownership rules
- private animation ownership rules
- storage for uploaded assets
- backend-served shared asset catalogs

This was the structural turning point of the project.

### 6. Private asset creation and management now work

The current repo already supports the core creation flow you mentioned: users can create avatars and build a personal asset library.

Implemented today:

- upload private `.vrm` and `.glb` avatar files
- upload private `.vrma` animation files
- persist avatar records with identity fields
- persist animation records with metadata
- adopt shared default avatars into a personal library
- manage those assets from the frontend

This is the main reason the project now feels "sort of working": avatar creation, asset selection, and viewer playback are connected end to end.

### 7. Avatar identity and memory were added

The backend and frontend now support a more complete avatar definition than just a file on disk.

Current avatar-related persistence includes:

- avatar name
- backstory
- personality
- system prompt
- a primary persona record behind the avatar
- per-user, per-avatar `memory.md` content
- memory revision history

This means the project has already moved into persistent character-state territory.

### 8. LLM configuration and chat pipeline were added

The backend already contains the first real LLM integration layer rather than just a future placeholder.

What exists now:

- provider catalog endpoints
- OpenRouter, MiniMax, and GLM provider support
- encrypted per-user credential storage
- default model selection
- avatar chat endpoint
- prompt-building and cue parsing services
- conversation persistence
- conversation message persistence
- parsed emotion tags and animation tags stored with messages

The existing tests show chat already creates conversations and stores parsed assistant cues.

This matters because the project is no longer only about animation playback. It is now moving toward the real target: an avatar that can converse as a character.

### 9. The frontend was rebuilt around two real application surfaces

The frontend is no longer a single experimental page. It now has two dedicated authenticated work areas:

- `Viewer`: select an avatar, load it into the scene, test animations, and chat with the current avatar
- `Manage`: create assets, edit avatar identity, manage memory, configure LLM credentials, and inspect conversations

This is the current application shape and the correct foundation for the next stages.

## Current State On 2026-03-12

The project currently has:

- a React 18 + Vite frontend
- a Symfony 7.2 API backend
- JWT auth, refresh tokens, and Google auth exchange
- private avatar CRUD
- private animation CRUD
- authenticated upload and download for user-owned assets
- backend-served shared asset libraries
- avatar identity and persona editing
- memory editing with revision history
- LLM provider and credential management
- saved conversations and messages
- a working viewer with avatar loading, idle playback, action playback, and expression overlays
- a dedicated management UI

The biggest thing still missing is not the foundation. The biggest missing piece is the character layer: making the avatar feel responsive, lifelike, and personality-driven through better memory, stronger LLM orchestration, better cue handling, and eventually voice.

## What We Plan To Do Next

### Core priority order

The order of work should stay explicit:

1. Make the avatar believable.
2. Make the avatar conversationally strong.
3. Add full speech.
4. Only then push toward dedicated hologram hardware output.

That means memory, LLM integration, cue quality, and personality consistency come before hardware work.

### Near-term priorities

1. Finish backend-brokered streaming chat.
2. Normalize streaming cue events so the frontend can react while text is still arriving.
3. Move animation selection fully onto backend-authoritative metadata instead of relying on frontend-only scaffolding.
4. Tighten prompt assembly and cue validation so only allowed emotions and animations are used.
5. Connect the current chat flow more directly to visible avatar reactions in the viewer.
6. Improve personality consistency so the avatar feels like a character, not just a text endpoint with a model attached.

### Memory and tool-call priorities

1. Keep the single allowed tool model: memory update only.
2. Let the LLM request memory updates through a tightly scoped backend action.
3. Always inject the authoritative stored memory into prompt context.
4. Preserve revisioning and auditability for all memory changes.
5. Use memory to reinforce the illusion of relationship continuity between the user and the avatar.

### Personality and behavior priorities

1. Strengthen persona definition so each avatar has a stable voice, role, and style.
2. Make prompt construction consistently combine system rules, avatar identity, memory, and recent conversation.
3. Improve animation and expression selection so responses feel emotionally matched instead of mechanically triggered.
4. Support one or multiple LLM-backed behaviors without leaking provider complexity into the frontend.

### Product hardening priorities

1. Add rate limiting, retries, timeout handling, and provider health handling to the LLM pipeline.
2. Improve error shapes and frontend recovery paths.
3. Expand automated coverage around chat orchestration, ownership, and failure cases.
4. Continue cleaning up old frontend-only scaffolding once backend ownership is complete.

### UX priorities

1. Make viewer-side chat feel live instead of request-response only.
2. Keep the floating animation test tools useful for development while reducing confusion for normal usage.
3. Make shared asset adoption and personal library management more obvious.
4. Improve the Manage page so avatar setup flows in a clearer order: asset -> identity -> memory -> LLM -> chat.

### Longer-term goals

1. Add text-to-speech so avatar replies can be spoken aloud.
2. Add speech-to-text so voice commands use the same backend chat pipeline.
3. Build a more dedicated hologram mode on top of the existing viewer path.
4. Add the ability to project or drive the avatar through a physical desktop hologram peripheral.
5. Support richer avatar interactions without breaking the stateless JWT architecture or private ownership model.

### Future ideas

These are not the immediate roadmap, but they are valid expansion ideas for later.

#### Idea 1: Discord bot integration

Let a user chat with their avatar through Discord so the avatar is reachable away from the main app.

What this would need:

- a Discord bot application and token managed on the backend
- a secure link between a Discord identity, a project user account, and one or more owned avatars
- channel or DM routing rules so messages are sent to the correct avatar
- backend message orchestration that reuses the existing avatar chat pipeline instead of creating a separate logic path
- permission and ownership checks so one Discord user cannot access another user's avatar
- rate limiting, moderation controls, and abuse protection
- optional formatting rules to map avatar responses cleanly into Discord messages
- later, if voice is added, a decision on whether Discord text and Discord voice should share the same conversation memory or stay separate

#### Idea 2: Avatar-to-OpenClaw integration

Allow the avatar bot to communicate with an OpenClaw instance, possibly through Discord as well, using a separate channel or integration path.

What this would need:

- a clearly defined OpenClaw integration contract:
  - API, webhook, queue, or bot-to-bot messaging
- a dedicated backend adapter so OpenClaw communication stays separate from the core avatar chat services
- clear routing rules for when the avatar is talking to a human user versus when it is talking to OpenClaw
- separate conversation and memory boundaries so OpenClaw interaction does not pollute normal user memory unless explicitly intended
- identity and trust rules so only approved OpenClaw instances can connect
- logging and replayable conversation traces for debugging multi-agent behavior
- optional Discord bridge rules if this also runs through a dedicated Discord channel
- safeguards to avoid runaway bot loops, message storms, or recursive cross-bot chatter

If this idea becomes real, the safest approach would be to treat OpenClaw as another external integration handled by the backend, not as a direct frontend concern.

## Architectural Direction We Should Keep

- The backend must remain the authority for auth, ownership, memory, conversations, and LLM access.
- The frontend should remain responsible for presentation, local UI state, and realtime reaction to backend events.
- Shared assets should stay curated and globally readable, while user-owned assets remain private.
- Memory must remain scoped strictly to one user and one avatar.
- The allowed LLM tool surface should stay minimal and explicit.

## Known Gaps Between Vision And Current State

- Chat is persisted, but full streaming playback is still not finished.
- Cue parsing exists, but the live streaming event contract is not the final one yet.
- Some animation-tag logic still exists in local catalog scaffolding and needs to become fully backend-authoritative.
- Voice features are still future work.
- The avatar still needs stronger personality consistency and memory-driven behavior to feel convincingly alive.
- Multi-LLM orchestration is part of the long-term target, but the product is not there yet.
- The hologram experience exists as a viewer path, but not yet as a full voice-first product mode or a hardware-output pipeline.

## Maintenance Rule

When major features land, this file should be updated alongside `TODO.md` and any roadmap changes in `AGENTS.md`.

If `AGENTS.md`, `TODO.md`, and the running code diverge, this file should be treated as the human-readable project narrative and end-goal summary, while the code remains the technical source of truth.
