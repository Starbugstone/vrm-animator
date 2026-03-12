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
- persisted conversations and parsed assistant cues
- a working avatar viewer with idle, action, and expression playback

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
| `database` | localhost:3307 | Main MariaDB database |
| `database_test` | localhost:3308 | Dedicated MariaDB database for backend tests |
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
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Do not commit real secrets from local env files into the tracked `.env` templates.

## Asset Model

Shared example assets are served by the backend from:

- `default_vrm/`
- `default_vrma/`
- `expressions_vrma/`
- `idle/`

User uploads are stored privately by the backend under per-user storage directories and are only downloadable by the owning user.

## Main Frontend Surfaces

### Viewer

- loads a selected avatar into the Three.js scene
- plays idle, action, and expression VRMA clips
- shows the current configured persona
- sends chat messages through the backend avatar chat pipeline

### Manage

- creates avatars from shared presets or uploads
- uploads and edits private animation assets
- edits avatar identity and system prompt
- edits avatar memory and reviews memory revisions
- stores and updates LLM credentials
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

### LLM configuration

- `GET /api/llm/providers`
- `GET /api/llm/providers/openrouter/models`
- `GET /api/llm/credentials`
- `POST /api/llm/credentials`
- `PATCH /api/llm/credentials/{id}`
- `DELETE /api/llm/credentials/{id}`

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
docker compose up -d database_test php
docker compose exec -T php php bin/phpunit
```

The backend test suite now uses the dedicated `database_test` service and bootstraps its own schema before running.

## Third-Party Example Assets

The files in `default_vrm/` and `default_vrma/` are included as example/demo assets only. This repository does not claim ownership of those files.

- Example VRM avatars were sourced from `https://hub.vroid.com/en/users/121271631`.
- Example VRMA motions were sourced from `https://vroid.booth.pm/items/5512385`.
- VRMA credit text: `Animation credits to pixiv Inc.'s VRoid Project`.

Ownership, copyright, and license terms remain with the original creators and publishers. Reuse, redistribution, and downstream usage must follow the original terms provided by those creators. See `default_vrm/source.txt`, `default_vrma/source.txt`, and the bundled upstream readme files in `default_vrma/` for the relevant notices.
