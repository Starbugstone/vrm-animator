# Recap

## Branch Commit Scope

This branch commit captures the LLM and streaming stabilization pass across backend, frontend, model catalogs, testing, and browser smoke coverage.

### LLM and Streaming

- replaced buffered SSE replay with provider-native upstream streaming for the OpenAI-compatible providers
- added live streamed status, text, cue, memory, and completion events
- hardened timeout and stall behavior for long-lived streamed replies
- added non-stream fallback when a streamed turn fails before useful text arrives
- preserved partial streamed text in the viewer when a later stream failure happens
- fixed provider/model selection precedence so the selected credential wins over stale conversation metadata
- surfaced the actual provider and model in viewer stream status

### Provider Handling

- added static backend model catalogs for GLM and MiniMax
- sorted OpenRouter models newest-first while keeping free models first by default
- added model-aware prompt policies derived from provider model metadata
- moved MiniMax-specific auth error translation into the MiniMax provider instead of the generic base class
- made static model catalog loading auto-discover provider config files for future additions

### Prompt and Cue Reliability

- reduced prompt bloat by compacting memory, persona/profile text, history, and movement catalog context
- stopped feeding raw streamed provider payloads back into later prompt history
- added parsing support for bracket-style cue bundles such as `[emotion:happy | anim:Hand-on-hip | memory:...]`
- kept backend cue resolution authoritative for streamed avatar actions and expressions

### AI Connection and Persona Flow

- fixed create-vs-edit behavior in AI Connection so multiple credentials can be created cleanly
- fixed credential updates so editing name/model no longer requires re-entering the secret
- required a fresh secret when changing a credential to a different provider
- improved provider/model browsing in AI Connection for OpenRouter, GLM, and MiniMax

### Test and Verification Coverage

- expanded backend API and unit coverage around credentials, personas, prompt compaction, cue parsing, memory revision conflicts, animation metadata, and provider/model selection
- added frontend stream parser tests for SSE chunking and event dispatch
- added a real Playwright browser smoke test for the auth screen

### Verification Passed

- `docker compose exec -T php php bin/phpunit`
- `docker compose exec -T node npm test`
- `docker compose exec -T node npm run build`
- `docker compose exec -T node sh -lc 'PLAYWRIGHT_WEB_SERVER_COMMAND="npm run preview -- --host 127.0.0.1 --port 4173" PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$(which chromium-browser || which chromium)" npm run test:browser'`

### Known Residual Note

- PHPUnit still reports the existing risky streaming test notice about output buffers in `backend/tests/Api/ConversationTest.php`, but the suite passes.

## Next TODO Stage

The next implementation stage after this commit should focus on avatar believability while the LLM loop is active:

- add a clear "thinking" avatar reaction during provider preparation and waiting states
- use existing expression/action metadata first so the feature works with current assets
- keep the backend authoritative and avoid introducing a second frontend-only source of truth
