# VRM Animator

VRM Animator is a React + Symfony application for building a conversational 3D avatar system.

The current product direction is:

1. Let a user create, customize, and view a VRM avatar.
2. Connect that avatar to one or more LLMs through a backend-controlled chat pipeline.
3. Make the avatar feel believable through memory, personality, and animation.
4. Extend text chat into full speech.
5. Eventually drive a physical desktop-sized hologram peripheral.

For the live project narrative and end-goal reference, see `devlog.md`. For contribution rules and architectural constraints, see `AGENTS.md`.

## Current State

The repo currently includes:

- a React 18 + Vite frontend with dedicated `Viewer` and `Manage` surfaces
- a Symfony 7.2 API backend
- JWT auth, refresh tokens, and Google auth exchange
- private avatar and animation CRUD
- backend-served shared asset libraries
- avatar identity, persona, and memory editing
- encrypted LLM credential storage
- AI connections for OpenRouter, OpenAI, Gemini, DeepSeek, MiniMax, and GLM
- persisted conversations and parsed assistant cues
- streamed chat events for live text and cue playback
- a working avatar viewer with idle, action, and expression playback
- browser speech synthesis for spoken avatar replies in the Viewer
- avatar-level speech preferences for browser voice gender and language selection

## Requirements

- Docker
- Docker Compose

## Quick Start

```bash
docker compose up -d --build
```

This starts:

| Service | URL / Port | Purpose |
|---------|-------------|---------|
| `php` | http://localhost:8080 | Symfony API backend |
| `node` | http://localhost:5173 | Vite frontend dev server |
| `database` | localhost:3307 | Main MariaDB service hosting both the app and test databases |
| `mailpit` | http://localhost:8025 | Local mail capture |

On first launch the PHP container installs Composer dependencies, generates the JWT keypair, and runs the main database migrations.

## Environment Files

This repo keeps committed `.env` templates with dummy values only. Real machine-specific values belong in `.env.local` files.

### Frontend

Create or update `./.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### Backend

Create or update `./backend/.env.local`:

```env
# Uncomment only if Symfony runs on the host instead of inside Docker.
# DATABASE_URL="mysql://vrm_user:vrm_pass@127.0.0.1:3307/vrm_animator?serverVersion=11.4.0-MariaDB"

GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
LLM_CREDENTIAL_ENCRYPTION_KEY=replace-this-with-a-long-random-local-secret
```

The frontend `VITE_GOOGLE_CLIENT_ID` and backend `GOOGLE_CLIENT_ID` intentionally use the same public Google OAuth client id. The browser needs it to start Google Sign-In, and the backend needs it to validate the returned token audience.
Keep `LLM_CREDENTIAL_ENCRYPTION_KEY` stable once you have saved AI connections. Changing it later will make older stored provider keys unreadable until you enter them again.

Do not commit real secrets from local env files into the tracked `.env` templates.

## ElevenLabs TTS Configuration

The app now supports backend-streamed ElevenLabs speech on a bring-your-own-key basis.

Important behavior:

- there is no shared ElevenLabs server key in the committed env files
- each user saves their own ElevenLabs API key through the authenticated TTS API or the `Manage -> Voice & Speech` UI
- saved TTS secrets are encrypted at rest by the backend using the same `LLM_CREDENTIAL_ENCRYPTION_KEY`
- if an avatar does not have both a saved TTS credential and a selected voice, the Viewer falls back to browser speech synthesis
- voice catalogs are now loaded through the paginated ElevenLabs voice search API so larger accounts are not truncated to a single page
- the avatar voice picker now searches across voice name and metadata tags, while also taking the avatar speech language into account when narrowing the list

### What The API Needs

To use the ElevenLabs path successfully, the current user needs:

- a valid JWT, because all TTS endpoints are private
- a saved ElevenLabs credential created through `POST /api/tts/credentials`
- an ElevenLabs key that can access the voice list and stream speech
- a stable backend `LLM_CREDENTIAL_ENCRYPTION_KEY`, otherwise previously saved keys become unreadable
- the PHP `curl` extension available in the backend runtime for remote audio streaming

If you use a restricted ElevenLabs key, it must also be allowed to read voices because the backend validates avatar voice selections against `GET /api/tts/credentials/{id}/voices`.

### Supported TTS Endpoints

- `GET /api/tts/providers`
- `GET /api/tts/credentials`
- `POST /api/tts/credentials`
- `PATCH /api/tts/credentials/{id}`
- `DELETE /api/tts/credentials/{id}`
- `GET /api/tts/credentials/{id}/voices`
- `GET /api/avatars/{id}/tts`
- `PATCH /api/avatars/{id}/tts`
- `POST /api/avatars/{id}/tts/stream`

The current provider list contains only `elevenlabs`, with these backend-advertised Text to Speech models:

- `eleven_flash_v2_5` as the low-latency default
- `eleven_v3` for the most expressive character delivery
- `eleven_multilingual_v2` for stronger multilingual and longer-form fallback use
- `eleven_flash_v2` as an older low-latency fallback

### Typical Flow

1. Save a user-owned ElevenLabs key with `POST /api/tts/credentials`.
2. Load available voices from `GET /api/tts/credentials/{id}/voices`.
3. Attach that credential and one voice to an avatar with `PATCH /api/avatars/{id}/tts`.
4. Stream speech from `POST /api/avatars/{id}/tts/stream`.

The avatar-level TTS payload also supports:

- `presentationGender` for the avatar's own presentation tag
- `speechVoiceGender` for browser fallback voice preference
- `speechLanguage` for browser fallback voice selection
- `ttsCredentialId` and `ttsVoiceId` for the remote ElevenLabs route

### Example Requests

Create an ElevenLabs connection:

```http
POST /api/tts/credentials
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "name": "Personal ElevenLabs",
  "secret": "your-elevenlabs-api-key",
  "defaultModel": "eleven_flash_v2_5",
  "isActive": true
}
```

Attach a saved connection and voice to an avatar:

```http
PATCH /api/avatars/123/tts
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "presentationGender": "female",
  "speechVoiceGender": "female",
  "speechLanguage": "en-US",
  "ttsCredentialId": 7,
  "ttsVoiceId": "voice_f_1"
}
```

Preview or stream speech:

```http
POST /api/avatars/123/tts/stream
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "text": "Hello from ElevenLabs."
}
```

For unsaved preview playback, the same stream endpoint also accepts temporary `ttsCredentialId` and `ttsVoiceId` overrides in the request body.

### Fallback Rules

- no saved ElevenLabs credential on the avatar: browser speech stays active
- saved credential but no selected voice: browser speech stays active
- remote playback failure during chat: the Viewer falls back to browser speech and keeps the reply usable
- deleting or rotating the backend encryption key after saving credentials: affected keys must be entered again before remote TTS can work

## Asset Model

Shared example assets are served by the backend from:

- `default_vrm/`
- `default_vrma/` including nested `idle/` and `thinking/` folders for shared body-motion categories
- `expressions_vrma/`

User uploads are stored privately by the backend under per-user storage directories and are only downloadable by the owning user.

Thinking body motions now belong in `default_vrma/thinking/`, while facial and mouth overlays remain in `expressions_vrma/`. The viewer treats thinking as a silent waiting state, so curated thinking clips should avoid speech-style mouth motion unless that behavior is intentional.

## Main Frontend Surfaces

### Viewer

- loads a selected avatar into the Three.js scene
- plays idle, action, and expression VRMA clips
- shows the current configured persona
- sends chat messages through the backend avatar chat pipeline
- streams assistant text and cue events back into the viewer for live movement and emotion playback
- uses browser speech synthesis to speak completed replies

### Manage

- creates avatars from shared presets or uploads
- uploads and edits private animation assets
- edits avatar identity and system prompt
- edits avatar memory and reviews memory revisions
- stores and updates LLM credentials
- lets each saved GLM connection choose between the standard API and the Coding subscription endpoint
- browses provider model catalogs directly in the AI Connection panel
- reviews saved conversations

## Current API Surface

### Auth and session

- `POST /api/register`
- `POST /api/login_check`
- `POST /api/token/refresh`
- `POST /api/auth/google`
- `GET /api/me`
- `PATCH /api/me`

### Shared libraries

- `GET /api/library/avatars`
- `GET /api/library/animations`
- `GET /api/library/shared-file`

### Avatars and files

- `GET /api/avatars`
- `POST /api/avatars`
- `GET /api/avatars/{id}`
- `PATCH /api/avatars/{id}`
- `DELETE /api/avatars/{id}`
- `POST /api/avatars/upload`
- `GET /api/avatars/{id}/file`

### Animations and files

- `GET /api/animations`
- `POST /api/animations`
- `GET /api/animations/{id}`
- `PATCH /api/animations/{id}`
- `DELETE /api/animations/{id}`
- `POST /api/animations/upload`
- `GET /api/animations/{id}/file`

### Persona, memory, and chat

- `GET /api/avatars/{id}/personas`
- `POST /api/avatars/{id}/personas`
- `PATCH /api/avatar-personas/{id}`
- `DELETE /api/avatar-personas/{id}`
- `GET /api/avatars/{id}/memory`
- `PATCH /api/avatars/{id}/memory`
- `GET /api/avatars/{id}/memory/revisions`
- `GET /api/avatars/{id}/conversations`
- `GET /api/conversations/{id}`
- `GET /api/conversations/{id}/messages`
- `POST /api/avatars/{id}/chat`
  - JSON mode by default
  - SSE mode when the request body includes `"stream": true`

### LLM configuration

- `GET /api/llm/providers`
- `GET /api/llm/providers/{provider}/models`
- `GET /api/llm/credentials`
- `POST /api/llm/credentials`
- `PATCH /api/llm/credentials/{id}`
- `DELETE /api/llm/credentials/{id}`

Supported AI connection providers in the current app are:

- `OpenRouter`
- `OpenAI`
- `Gemini`
- `DeepSeek`
- `MiniMax`
- `GLM`

OpenRouter models are fetched live and can be filtered by free or paid billing. The other providers currently use curated backend model catalogs under `backend/config/llm_models/`.

For GLM, each saved credential can choose its own endpoint mode in the AI Connection panel:

- `Standard API` uses `https://open.bigmodel.cn/api/paas/v4`
- `Coding subscription` uses `https://open.bigmodel.cn/api/coding/paas/v4`

### TTS configuration

- `GET /api/tts/providers`
- `GET /api/tts/credentials`
- `POST /api/tts/credentials`
- `PATCH /api/tts/credentials/{id}`
- `DELETE /api/tts/credentials/{id}`
- `GET /api/tts/credentials/{id}/voices`
- `GET /api/avatars/{id}/tts`
- `PATCH /api/avatars/{id}/tts`
- `POST /api/avatars/{id}/tts/stream`

API docs are available at `http://localhost:8080/api/docs`.

## Verification

### Frontend tests

```bash
npm test
```

### Frontend production build

```bash
npm run build
```

### Backend tests

```bash
docker compose up -d --build database php
docker compose exec -T php php bin/phpunit
```

The backend test suite uses a separate `vrm_animator_test` database on the same MariaDB service and bootstraps its own schema before running.

## Third-Party Example Assets

The files in `default_vrm/` and `default_vrma/` are included as example/demo assets only. This repository does not claim ownership of those files.

- Example VRM avatars were sourced from `https://hub.vroid.com/en/users/121271631`.
- Example VRMA motions, including the bundled idle variants now stored under `default_vrma/idle/`, were sourced from `https://vroid.booth.pm/items/5512385`.
- VRMA credit text: `Animation credits to pixiv Inc.'s VRoid Project`.

Ownership, copyright, and license terms remain with the original creators and publishers. Reuse, redistribution, and downstream usage must follow the original terms provided by those creators. See `default_vrm/source.txt`, `default_vrma/source.txt`, and the bundled upstream readme files in `default_vrma/` for the relevant notices.
