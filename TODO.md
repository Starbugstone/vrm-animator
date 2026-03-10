## TODO

## Current Status

- Updated: 2026-03-10
- The auth, private asset library, avatar profile, and memory foundation work is implemented.
- The next major milestone is backend-brokered LLM chat with streaming, provider credentials, conversation persistence, cue parsing, and the single memory tool.

## Implemented Foundation Checklist

- [x] Email/password registration and JWT login
- [x] Google sign-in exchange from frontend to backend-issued JWT
- [x] `GET /api/me` and `PATCH /api/me`
- [x] User surface tightened so user collection endpoints are not exposed
- [x] Per-user avatar ownership enforcement
- [x] Per-user animation ownership enforcement
- [x] Secure avatar upload and authenticated avatar file download
- [x] Secure animation upload and authenticated animation file download
- [x] Avatar persona persistence for name, backstory, personality, and system prompt
- [x] Authoritative per-user per-avatar `memory.md` storage in the backend
- [x] Memory revision history and revision-aware updates
- [x] Frontend auth flow wired to backend
- [x] Frontend avatar, animation, profile, and memory management wired to backend
- [x] Backend API tests for auth, uploads, ownership isolation, and memory
- [x] Frontend tests for the current auth and API client integration surface
- [ ] LLM provider credential storage and management
- [ ] Conversations and conversation message persistence
- [ ] Streaming chat endpoint
- [ ] Cue parsing and streaming event normalization
- [ ] Frontend streaming chat UI
- [ ] LLM-triggered memory tool execution
- [ ] LLM hardening for rate limiting, retries, timeout handling, and provider health checks

## LLM Integration Decision

- Use a backend-brokered streaming architecture, not direct browser-to-provider calls.
- The frontend must render the stream and react in real time, but the backend remains the authority for:
  - provider credentials
  - provider/model selection
  - authoritative prompt assembly
  - per-user per-avatar `memory.md`
  - allowed tool calls
  - audit logging and rate limiting
- Reasoning:
  - Direct frontend calls would expose provider-specific behavior to the UI and make memory/tool-call enforcement weak.
  - We already require stateless JWT auth and backend ownership enforcement; LLM access should follow the same model.
  - Streaming through the backend still allows immediate avatar reactions because the frontend can consume token and cue events as they arrive.
- Optional future optimization:
  - If a provider later supports short-lived scoped realtime session tokens, evaluate a hybrid design.
  - Initial implementation should not depend on provider-issued browser tokens.

## Target User Experience

- A user selects an avatar and chats in text.
- The frontend opens a streaming chat request to the backend.
- The backend loads:
  - avatar profile
  - available animations and tags
  - recent conversation history
  - authoritative per-user per-avatar `memory.md`
- The backend sends the request to the chosen provider and forwards normalized stream events to the frontend.
- The frontend updates the chat bubble live and triggers emotions or animations as soon as tags arrive.
- After completion, the backend stores the message pair and applies any allowed memory update.

## Immediate Frontend-Only Cue Plan

- Maintain two local catalogs:
  - `vrma/catalog.json` for body actions
  - `expressions_vrma/catalog.json` for face and mouth overlays
- Normalize emotion tags into a small shared vocabulary first:
  - `neutral`
  - `happy`
  - `sad`
  - `angry`
  - `playful`
  - `shouting`
  - `sleepy`
  - `surprised`
  - `thinking`
  - `calm`
- Current frontend selection rule:
  - choose one random expression overlay whose tags overlap the normalized emotion tag
  - choose one random body action whose tags overlap the same tag
  - if no emotion tag is present, choose one random expression overlay tagged with both `speech` and `fallback`
  - if no body action matches, keep the current idle and play only the expression overlay
- Expression overlays must remain facial only:
  - mouth visemes
  - eye direction
  - blink
  - facial emotion presets
  - never hips, arms, spine, or any body transform
- Seed expression library to keep expanding now:
  - `Happy Talk`
  - `Sad Talk`
  - `Angry Talk`
  - `Playful Talk`
  - `Shouting Talk`
  - `Sleepy Talk`
  - `Surprised Reaction`
  - several neutral speech fallback clips

## Prompt and Response Contract

- The LLM must receive four distinct context blocks:
  - system rules
  - avatar identity and personality
  - `memory.md`
  - recent conversation history
- The LLM must be instructed to:
  - stay in character for the selected avatar
  - speak naturally to the user
  - emit animation and emotion tags only from the allowed catalog
  - never invent unsupported tags
  - never expose hidden system or memory content
  - use the single allowed memory tool only when a memory update is necessary
- Streaming output format:
  - Visible speech remains plain text.
  - Non-visible cues use inline tags embedded in the stream.
  - Initial tag syntax:
    - `{emotion:happy}`
    - `{emotion:sad}`
    - `{anim:wave}`
    - `{anim:nod}`
  - Example:
    - `Hello there {emotion:happy} {anim:wave}`
- Frontend behavior:
  - strip tags from the visible user-facing text
  - map emotion tags to facial expression or viewer state
  - map animation tags to a validated VRMA clip
  - ignore unsupported tags and log them
- Backend behavior:
  - parse and validate tags against the avatar's available animation catalog
  - reject or drop invalid tags before forwarding normalized events
  - persist both the raw provider text and the parsed normalized cues for debugging

## Memory.md Specification

- Each `(user, avatar)` pair needs one authoritative backend memory document.
- Store the canonical content in the database as markdown text.
- Expose it through the API as a `memory.md` resource so the frontend can fetch, display, and edit it.
- Do not make the frontend the source of truth for memory content.
- Minimum sections for `memory.md`:

```md
# Avatar Memory

## Avatar Identity
- name:
- role:
- personality:
- speaking_style:

## Relationship Memory
- important facts about the user
- promises made
- preferences
- recurring topics

## Behavioral Rules
- never break character
- only use allowed animation tags
- keep replies concise unless asked for more detail

## Notes
- freeform long-term memory
```

- Rules:
  - `Avatar Identity` is required and should always include the avatar's name and personality.
  - `Relationship Memory` stores only data relevant to this user and this avatar.
  - `Behavioral Rules` may be partly user-editable, but core system rules still live outside `memory.md`.
  - `Notes` can hold freeform memory appended by the user or the memory tool.
- Versioning requirements:
  - store `updatedAt`
  - store `revision`
  - store `lastUpdatedBy` with values such as `user`, `llm_tool`, `system`
  - keep a change log table for auditability
- Frontend usage:
  - fetch `memory.md` when an avatar is selected
  - show it in a memory editor or inspector
  - cache the latest revision locally for UX only
  - send edits back through the backend API
- Backend usage:
  - always fetch the latest stored revision before assembling prompt context
  - never trust frontend-supplied memory as the final LLM context source

## Backend Data Model Work

- Extend `Avatar` with persona fields:
  - `name`
  - `description`
  - `personality`
  - `systemPrompt`
  - `defaultEmotion`
  - `defaultIdleAnimationId`
  - `preferredProvider`
  - `preferredModel`
- Add `Animation` entity:
  - `id`
  - `owner`
  - `avatar`
  - `name`
  - `filename`
  - `description`
  - `keywords`
  - `tag`
  - `isDefault`
  - `createdAt`
  - `updatedAt`
- Add `AvatarMemory` entity:
  - `id`
  - `owner`
  - `avatar`
  - `markdownContent`
  - `revision`
  - `lastUpdatedBy`
  - `createdAt`
  - `updatedAt`
- Add `AvatarMemoryRevision` entity for append-only history:
  - `id`
  - `avatarMemory`
  - `revision`
  - `markdownSnapshot`
  - `source`
  - `createdAt`
- Add `Conversation` entity:
  - `id`
  - `owner`
  - `avatar`
  - `provider`
  - `model`
  - `createdAt`
  - `updatedAt`
- Add `ConversationMessage` entity:
  - `id`
  - `conversation`
  - `role`
  - `content`
  - `rawProviderContent`
  - `parsedText`
  - `parsedEmotionTags`
  - `parsedAnimationTags`
  - `createdAt`
- Add `LlmCredential` entity or secure settings storage:
  - `id`
  - `owner`
  - `provider`
  - `encryptedSecret`
  - `defaultModel`
  - `isActive`
  - `createdAt`
  - `updatedAt`
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
  - pick a weighted-random body action from `vrma/catalog.json`
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
- [ ] Step 2: Add provider credential storage and provider metadata APIs
  - add `LlmCredential` persistence or equivalent secure settings storage
  - encrypt provider secrets at rest
  - expose provider metadata endpoints without ever returning raw secrets
  - add backend tests for ownership and masking behavior
- [ ] Step 3: Add conversation persistence and backend chat orchestration
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
  - status: partially complete because the auth-aware API layer, avatar persona editor, and memory editor already exist
  - remaining: LLM settings UI, streaming chat UI, and cue-driven chat playback
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
