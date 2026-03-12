## TODO

Updated: 2026-03-12

This file is now intentionally short. The long transitional planning notes from the frontend-only era have been retired. `devlog.md` holds the product narrative and end goal; this file is the working task list for the next implementation window.

## Stable Baseline

The project is at a stable-enough checkpoint where:

- avatars can be created from shared presets or private uploads
- avatars can be customized with identity, prompt, and memory
- private animations can be uploaded and edited
- the viewer can load avatars and play configured VRMA-driven motion
- chat, credentials, memory, and conversation persistence are already wired through the backend

The next phase should build on this baseline rather than reintroducing frontend-only shortcuts.

## Current Rules

- No new frontend-only source of truth for assets, memory, credentials, or chat state.
- Keep the backend authoritative for LLM orchestration, ownership, and persistence.
- Keep `devlog.md` and `AGENTS.md` aligned with any roadmap changes.
- Prefer smaller, separable modules over growing large mixed-responsibility components.

## Next Priorities

### 1. Avatar believability

- improve persona consistency
- improve memory use in prompt assembly
- improve cue quality so avatar reactions feel intentional
- keep expression overlays facial-only and emotionally coherent

### 2. LLM orchestration

- add backend-brokered streaming chat
- normalize streaming events for text plus animation cues
- tighten cue validation against allowed avatar animation metadata
- harden retries, timeouts, and provider failure handling

### 3. Memory tool

- implement the single allowed LLM tool for memory updates
- keep updates scoped strictly to the authenticated user and selected avatar
- preserve revision history and auditability

### 4. Frontend cleanup

- continue splitting large UI surfaces where useful
- keep Manage and Viewer concerns separated
- remove any new duplicated transformation logic as it appears
- improve UX without weakening backend authority

### 5. Voice and hologram path

- add TTS after the text chat loop feels solid
- add STT after TTS
- only then move toward dedicated hologram hardware output

## Verification Baseline

Before closing a feature set, the minimum checks should be:

- `npm test`
- `npm run build`
- `docker compose exec -T php php bin/phpunit`
- Encryption requirements:
  - provider secrets must be encrypted at rest
  - never serialize raw secrets back to the frontend
  - only expose masked metadata such as provider name, active status, and default model

## Backend API Work

- Add credential endpoints:
  - `GET /api/llm/providers`
  - `GET /api/llm/credentials`
  - `POST /api/llm/credentials`
  - `PATCH /api/llm/credentials/{id}`
  - `DELETE /api/llm/credentials/{id}`
- Add avatar persona endpoints or extend existing avatar payload:
  - `GET /api/avatars/{id}`
  - `PATCH /api/avatars/{id}`
- Add animation endpoints:
  - `GET /api/avatars/{id}/animations`
  - `POST /api/avatars/{id}/animations`
  - `PATCH /api/animations/{id}`
  - `DELETE /api/animations/{id}`
- Add memory endpoints:
  - `GET /api/avatars/{id}/memory`
  - `PATCH /api/avatars/{id}/memory`
  - `GET /api/avatars/{id}/memory/revisions`
- Add conversation endpoints:
  - `GET /api/avatars/{id}/conversations`
  - `GET /api/conversations/{id}`
  - `GET /api/conversations/{id}/messages`
- Add streaming chat endpoint:
  - `POST /api/avatars/{id}/chat/stream`
- Add optional non-stream fallback endpoint:
  - `POST /api/avatars/{id}/chat`
- Streaming endpoint request body:

```json
{
  "message": "Hello there",
  "conversationId": 12,
  "provider": "openrouter",
  "model": "openai/gpt-4.1-mini",
  "includeRecentMessages": 12
}
```

- Streaming endpoint response should use SSE first:
  - `event: session.started`
  - `event: context.loaded`
  - `event: token`
  - `event: cue.emotion`
  - `event: cue.animation`
  - `event: tool.memory_update_requested`
  - `event: tool.memory_updated`
  - `event: message.completed`
  - `event: error`
- Ownership/security rules:
  - every avatar-scoped endpoint must enforce `avatar.owner == user`
  - a user must never see another user's memory, credentials, conversations, or animations
  - default animations may be globally readable, but user animations remain private unless later sharing is designed explicitly

## Backend LLM Service Layer

- Create a provider abstraction:
  - `LlmProviderInterface`
  - `OpenRouterProvider`
  - `MiniMaxProvider`
  - `GlmProvider`
- Provider interface responsibilities:
  - validate configuration
  - send chat requests
  - stream tokens
  - surface tool calls
  - normalize provider-specific deltas into one internal event format
  - map provider errors to project-standard API errors
- Add an orchestration service such as `AvatarChatService` to:
  - load avatar context
  - load memory
  - load recent history
  - load animation catalog
  - build the final prompt
  - call the selected provider
  - parse stream output
  - persist the conversation
  - execute the allowed memory tool if needed
- Add a `PromptBuilder` service to centralize prompt composition.
- Add a `CueParser` service to parse `{emotion:*}` and `{anim:*}` tags safely.
- Add a `MemoryService` to:
  - fetch authoritative `memory.md`
  - validate edits
  - append or patch content
  - create revision history
- Add rate limiting and timeout handling per user and per provider.

## Single Allowed Tool Call

- The only LLM tool must be memory update.
- No filesystem tool, no external API tool, no arbitrary code tool.
- Tool contract:

```json
{
  "tool": "update_memory",
  "payload": {
    "avatarId": 123,
    "operation": "append",
    "content": "- The user prefers short answers."
  }
}
```

- Validation rules:
  - `avatarId` must belong to the authenticated user
  - operation must be from an allowlist such as `append` or `replace_section`
  - content length must be capped
  - content must be markdown-safe text, not executable instructions
- Execution rules:
  - backend applies the update through `MemoryService`
  - backend records a revision entry
  - backend emits a `tool.memory_updated` stream event
- Important:
  - The tool is backend-executed only.
  - The frontend may display that memory changed, but it must never directly execute a tool on behalf of the model.

## Frontend Work

- Create an API layer under `src/api/` for:
  - auth token handling
  - avatars
  - animations
  - memory
  - LLM credentials
  - chat streaming
- Keep JWT in an explicit client auth layer and send it on every request.
- Add avatar settings UI for:
  - avatar name
  - avatar personality
  - avatar system prompt
  - provider selection
  - model selection
- Frontend page structure:
  - `Viewer` is the runtime screen and should stay focused on avatar selection, chat, and playback controls
  - `Manage` is the admin screen and should own CRUD for uploaded assets, personas, memory, credentials, and backend conversation inspection
  - do not collapse these back into one monolithic page
- Add LLM settings UI for:
  - adding provider credentials
  - switching active provider
  - testing provider connectivity
- Add memory UI:
  - load `memory.md` for the selected avatar
  - edit and save markdown
  - show revision metadata
  - surface when memory changed during a chat
- Add chat UI:
  - message list
  - streaming assistant bubble
  - retry last response
  - cancel in-flight stream
  - provider/model indicator
- Add stream consumer logic:
  - parse SSE events
  - append tokens incrementally
  - strip tags from visible text
  - trigger animation or emotion cues immediately
  - surface errors without breaking the viewer
- Add cue selection logic that consumes the local catalogs before backend metadata exists:
  - normalize the incoming tag
  - pick a weighted-random expression overlay from `expressions_vrma/catalog.json`
  - pick a weighted-random body action from `default_vrma/catalog.json`
  - keep neutral speech fallbacks for tagless replies
- Integrate the chat cue layer with `useHologramViewer`:
  - play validated animation tags
  - queue or debounce overlapping cues
  - fall back to idle when an action clip finishes
  - log unsupported cues for debugging
- Add frontend state boundaries:
  - auth state
  - selected avatar state
  - current conversation state
  - current memory snapshot state
  - streaming status state
- Manual deploy reminder:
  - In Google Cloud Console, under the `CJ-WAIFU` project, add the final deploy URL to the authorized auth origins/redirect settings for the existing Google OAuth client.
  - This is a manual release step performed by Matthew, not an in-app automation task.

## Frontend and Viewer Rules

- The frontend may fetch `memory.md` and show it to the user.
- The frontend may optimistically display the current memory snapshot in the chat inspector.
- The frontend must not be treated as the authoritative place where the final prompt is built.
- The backend should still rebuild prompt context using the stored memory and current avatar settings.
- Animation tags must only execute if they map to known animation metadata already loaded for the avatar.
- Unknown tags should not crash the UI or break the current animation state.

## Error Contract

- Use a consistent JSON error shape for non-stream endpoints:

```json
{
  "message": "Provider authentication failed",
  "errors": {
    "provider": ["Credential is invalid or expired"]
  }
}
```

- SSE error events should include:
  - a stable code
  - a user-safe message
  - whether retry is allowed
- Error classes to plan for:
  - invalid provider credential
  - rate limited
  - provider timeout
  - malformed tool call
  - invalid animation tag
  - stale conversation id
  - memory revision conflict

## Testing Work

- Backend unit tests:
  - prompt builder produces the expected context blocks
  - cue parser strips and normalizes tags correctly
  - memory service enforces ownership and revisions
  - tool executor rejects anything except `update_memory`
  - provider adapters normalize stream chunks correctly
- Backend API tests:
  - user can only access their own memory
  - user can only access their own credentials
  - chat stream refuses unauthorized avatar access
  - invalid tags are dropped from outgoing events
  - memory tool updates create revisions
- Frontend tests:
  - SSE consumer appends streamed text correctly
  - tags are hidden from visible chat text
  - cue events trigger the viewer integration
  - chat cancellation closes the stream cleanly
  - memory editor handles revision refresh
- Manual QA:
  - stream starts quickly after send
  - animation plays before full reply finishes
  - memory persists after refresh and re-login
  - a second user cannot read another user's memory or conversations

## Implementation Order

## Next Execution Plan

- [x] Step 1: Ship the auth, avatar, animation, and memory foundation
  - email/password and Google sign-in
  - avatar and animation upload plus ownership enforcement
  - avatar persona editing
  - backend `memory.md` and revision history
  - frontend integration for the current authenticated workspace
- [x] Step 2: Add provider credential storage and provider metadata APIs
  - add `LlmCredential` persistence or equivalent secure settings storage
  - encrypt provider secrets at rest
  - expose provider metadata endpoints without ever returning raw secrets
  - add backend tests for ownership and masking behavior
- [x] Step 3: Add conversation persistence and backend chat orchestration
  - add `Conversation` and `ConversationMessage`
  - add `LlmProviderInterface` plus first provider adapters
  - add `PromptBuilder`
  - add `CueParser`
  - assemble context from avatar profile, memory, animations, and recent messages
- [ ] Step 4: Add the first streaming chat endpoint
  - implement `POST /api/avatars/{id}/chat/stream`
  - stream SSE events for session start, tokens, cues, tool updates, completion, and errors
  - persist raw provider text plus normalized parsed cues
  - reject unauthorized avatar access and drop invalid cue tags
- [ ] Step 5: Add the frontend chat experience
  - add chat panel UI
  - add SSE consumer logic
  - stream visible assistant text incrementally
  - strip tags from user-visible text
  - connect cue events into `useHologramViewer`
- [ ] Step 6: Implement the single allowed tool call
  - allow only `update_memory`
  - validate avatar ownership, operation allowlist, and content limits
  - create revision records and surface memory changes in the UI
- [ ] Step 7: Harden and verify the LLM path
  - add rate limiting
  - add provider timeouts and retry policy
  - add provider health checks
  - expand backend and frontend automated tests
  - run manual QA for streaming, cue playback, memory persistence, and isolation

## Implementation Order

- Phase 1: Foundation
  - status: complete except for LLM credential storage and provider metadata endpoints
- Phase 2: Backend chat orchestration
  - status: not started
- Phase 3: Frontend chat and LLM settings UI
  - status: partially complete because the dedicated `Viewer` and `Manage` pages, avatar persona editor, memory editor, and LLM settings UI now exist
  - remaining: streaming chat UI, cue-driven chat playback, and conversation streaming controls
- Phase 4: Memory tool call
  - status: not started
- Phase 5: Hardening
  - status: partially complete for the current auth/upload/memory surface, but not started for the LLM streaming path

## Explicit Non-Goals For Initial LLM Release

- No direct browser-to-provider secret usage.
- No arbitrary tool calling.
- No cross-avatar shared memory.
- No cross-user shared memory.
- No voice or TTS in the first LLM integration milestone.
- No autonomous multi-step agents.

## Follow-Up After Initial Release

- Add STT and TTS once text streaming is stable.
- Evaluate structured output in addition to inline cue tags if provider support is consistent.
- Consider optional semantic memory summarization so `memory.md` stays compact.
- Consider ephemeral provider sessions only if they preserve the same security guarantees as the backend proxy.

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
