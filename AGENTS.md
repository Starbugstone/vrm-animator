# VRM Animator — Agent & Development Guide

This document defines project layout, technology stack, mandatory practices, and the product roadmap. All contributions and AI-assisted work **must** align with it.

`devlog.md` is the live project recap and the current end-goal reference for VRM Animator. It must be kept updated at all times as features land, plans change, or project direction shifts. When updating roadmap-facing work, keep `AGENTS.md`, `TODO.md`, and `devlog.md` aligned.

---

## 1. Project Layout

```
vrm-animator/
├── .docker/                      # Docker build & runtime
│   ├── php/                      # PHP/Apache (Symfony backend)
│   │   ├── Dockerfile
│   │   ├── entrypoint.sh
│   │   └── vhost.conf
│   └── node/                     # Node (Vite dev server)
│       └── Dockerfile
├── backend/                      # Symfony 7.2 API (PHP 8.3+)
│   ├── config/                   # Bundles, packages, routes
│   │   ├── packages/             # api_platform, doctrine, security, etc.
│   │   └── routes/
│   ├── migrations/
│   ├── public/
│   │   └── index.php
│   ├── src/
│   │   ├── Controller/           # HTTP controllers (e.g. AuthController)
│   │   ├── Entity/               # Doctrine entities (User, Avatar, …)
│   │   ├── Repository/           # Doctrine repositories
│   │   └── State/                # API Platform state providers/processors
│   ├── templates/
│   └── tests/                    # PHPUnit API tests
├── src/                          # React frontend source
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── CameraPopover.jsx
│   ├── useHologramViewer.js      # VRM/VRMA viewer hook
│   └── (future: api/, components/, hooks/, etc.)
├── default_vrm/                  # Third-party example VRM avatars (.vrm, .glb)
├── default_vrma/                 # Third-party example VRMA motions (.vrma)
├── expressions_vrma/             # Project facial and mouth VRMA overlays (.vrma)
├── idle/                         # Bundled idle clips (.vrma)
├── docker-compose.yml
├── package.json                  # Node (React, Vite, Three.js, @pixiv/three-vrm*)
├── vite.config.js
├── tailwind.config.js
├── AGENTS.md                     # This file
├── devlog.md                     # Live recap and end-goal reference
├── README.md
└── TODO.md
```

**Boundaries:**

- **Backend**: All persistent data, auth, and business rules. No UI. API-only.
- **Frontend**: All UI and client-side state. Communicates with backend only via HTTP/JSON and JWT.
- **Assets**: Example avatars/animations live in `default_vrm/` and `default_vrma/`; shared overlays live in `expressions_vrma/` and `idle/`; user-uploaded avatars and animations are stored in backend-managed per-user directories and served only to the owning user.

---

## 2. Technology Stack

| Layer        | Technology |
|-------------|------------|
| **Backend** | PHP 8.3+, Symfony 7.2, API Platform 4, Doctrine ORM 3, MariaDB 11, Lexik JWT, Nelmio CORS |
| **Frontend**| React 18, Vite 7, Tailwind CSS, Three.js, @pixiv/three-vrm, @pixiv/three-vrm-animation |
| **Runtime** | Docker Compose: `php` (Apache), `node` (Vite), `database` (MariaDB), `mailpit` |
| **Auth**    | JWT (stateless); register/login via `/api/register`, `/api/login_check` |

API docs: `http://localhost:8080/api/docs` when backend is running.

---

## 3. Mandatory Practices

### 3.1 General

- **SOLID, DRY, KISS, YAGNI**: Design for single responsibility, avoid duplication, keep solutions simple, add features only when required.
- **Readability**: Clear naming; comments explain *why*, not *what*. Follow existing project style.
- **Modularity**: Break complex logic into small, cohesive, loosely coupled functions/modules.
- **Dev Log Discipline**: `devlog.md` must be updated whenever meaningful implementation progress, roadmap changes, or architectural decisions happen.
- **Environment files**: When a local-only `.env.local` value is added or changed, update the corresponding committed `.env` template with a dummy placeholder value in the same key. Never copy or leak real values from `.env.local` into a committed `.env` file.

### 3.2 Backend (Symfony)

- **Stateless API**: No server-side session for API. Every request is authenticated via `Authorization: Bearer <JWT>`. Config must keep `stateless: true` for API firewalls.
- **API Platform**: Prefer declarative resources (entities + operations + state providers/processors). Use custom controllers only when necessary (e.g. register, login, or future memory/LLM endpoints).
- **Security**: Enforce ownership (e.g. `object.getOwner() == user`). Never expose another user’s data. Validate and sanitize all inputs.
- **Persistence**: All mutable state in DB (Doctrine). File storage for avatars/animations as configured (e.g. upload dir with stable paths/IDs).

### 3.3 Frontend (React)

- **No server state in UI**: Do not rely on server-side sessions. Use JWT for auth; store token securely (e.g. memory or httpOnly cookie if backend supports it); send token on each API request.
- **Separation**: Keep API calls in a dedicated layer (e.g. `src/api/` or services). Components should consume data via props/hooks, not raw fetch logic mixed with UI.
- **State**: Prefer local component state or a small, explicit state layer for client-only state. Server state should be fetched/updated via the stateless API.

### 3.4 Frontend–Backend Contract

- **Stateless only**: No cookies or server-side session storage for API auth. JWT in `Authorization` header.
- **JSON**: Request/response bodies are JSON. Use consistent DTOs/serialization groups (backend) and types/interfaces (frontend) for stability.
- **Errors**: Use HTTP status codes and a consistent error shape (e.g. RFC 7807 or a simple `{ message, errors? }`). Frontend must handle errors without assuming server-side session.

---

## 4. Roadmap

### Product Goal

- The primary goal is to turn a 3D avatar connected to one or more LLMs into a believable conversational character that can chat naturally with the user.
- The first interaction mode is text chat.
- The next major evolution is full speech with TTS and STT.
- The final hardware-oriented goal is to drive a physical desktop-sized hologram peripheral.
- Priority order matters: first make the avatar responsive, lifelike, and personality-driven through strong memory and LLM integration; only after that should hologram hardware become a focus.
- Launch readiness also requires a curated out-of-the-box experience: at least one launch-ready male avatar and one launch-ready female avatar must ship from the default asset set, ready to become usable as soon as LLM credentials are connected.
- The product must stay accessible to non-technical users. Guided onboarding, setup assistance, and clear in-app explanations are roadmap requirements, not optional polish.

### Phase 1: Auth, Default Content, and Persisted Avatars/Animations

- **User login**
  - Already: Register (`POST /api/register`), Login (`POST /api/login_check`), JWT.
  - Ensure frontend has a proper login/register flow and stores/uses JWT for all API calls; no session dependency.

- **Default avatars and animations**
  - Backend exposes or references a **curated set of default avatars and animations** (e.g. from `default_vrm/`, `default_vrma/`, `expressions_vrma/`, and `idle/` or from a DB seed). Frontend can list “default” assets and use them without requiring uploads.
  - Option: backend serves default asset list (and optionally files) so one source of truth.
  - For launch, curate at least two ready-to-go starter avatars from that default set:
    - one male-presenting avatar
    - one female-presenting avatar
  - Those launch avatars should come with polished identity defaults and a predictable setup path so the user is not forced to build a character from scratch before first use.

- **User-uploaded avatars and animations**
  - User can upload personal `.vrm`/`.glb` (avatars) and `.vrma` (animations).
  - Backend: persist files, link to `User` (and optionally to an `Avatar` entity or a new `Animation` entity). Existing Avatar API is extended or complemented for animations.
  - Frontend: upload UI, then list and select from “my avatars” and “my animations” plus defaults.

- **Animation metadata: description / keywords**
  - Each animation has **description** and **keywords** (state/emotion, when to play).
  - Stored in backend (e.g. `Animation` entity with `description`, `keywords` JSON or relation). Used later by the LLM to choose which animation to play.

### Phase 2: LLM Integration and Text Chat

- **Avatar wired to an LLM**
  - Integrate with **OpenRouter, MiniMax, and GLM** first; design so other LLM providers can be added (adapter/strategy pattern).
  - Backend: LLM adapter layer, configurable per user or per avatar (e.g. API keys via env or user settings). No API keys in frontend.
  - The launch-ready starter avatars must be compatible with this flow so that once a user plugs in valid credentials, they can immediately chat with either starter avatar.

- **Text-based conversation**
  - All communication between user and avatar is **text-based** at first: user sends message → backend sends to LLM with context → response returned to frontend; avatar can be shown as “speaking” the reply (e.g. in a chat bubble).
  - API: e.g. `POST /api/avatars/{id}/chat` or `/api/conversation` with `{ "message": "..." }`; response includes LLM reply and optionally suggested animation (see below).

- **Animation selection from LLM**
  - Backend (or a dedicated service) has access to animation metadata (description/keywords). LLM is given:
    - Conversation context.
    - List of available animations with description/keywords.
  - LLM responds with both **text** and **suggested animation id/name** (or keyword). Backend maps to an animation and returns it in the response; frontend plays that animation.

### Phase 3: Per-Avatar, Per-User Memory

- **memory.md per avatar per user**
  - Each (avatar, user) pair has a dedicated **memory** store (e.g. a `memory.md` file or DB-backed text field). No cross-user or cross-avatar mixing.

- **LLM tool call: update memory only**
  - LLMs can call a **single allowed tool**: “update my memory.” Backend exposes a **restricted API** for this:
    - Input: avatar id, user id (from JWT), and the memory update (e.g. append or structured patch).
    - Backend verifies: authenticated user owns this avatar session and is only updating **that** avatar’s memory **for this user**. No other tool calls (no arbitrary APIs, no file system, no other users’ data).
  - **Security**: Strict allowlist: only “update memory” with scoped parameters. All other tool calls rejected. Prefer a dedicated endpoint (e.g. `PATCH /api/avatars/{id}/memory` or `POST /api/avatars/{id}/memory/append`) so the LLM gateway only forwards this one action.

- **Memory retrieval for LLM context**
  - When the user chats with an avatar, backend **retrieves that avatar’s memory for this user** and injects it into the LLM context (e.g. as system or context block). So the avatar “remembers” the user via this memory only.

### Phase 4: Future — Voice and Hologram Module

- **Text-to-speech (TTS)**
  - Backend or a dedicated service converts LLM reply to speech; frontend plays it while avatar is “speaking.”

- **Vocal commands**
  - User speaks; speech-to-text (STT) sends text to the same chat/message API. Flow: voice → STT → text → existing LLM + memory + animation pipeline → optional TTS and animation.

- **Hologram module**
  - Pluggable **hologram module**: user can “generate” or view their avatar in **3D on desktop** and interact via **vocal commands** directly (same backend: STT → chat API → TTS + animation; frontend is a 3D hologram view instead of or in addition to the current 2D page).
  - Keep the current viewer path (`useHologramViewer`, `src/components/ViewerPage.jsx`) and add an optional build or route that loads a dedicated hologram UI (e.g. fullscreen, different camera, dedicated controls for voice-only).

### Cross-Cutting UX Requirement: Guided Setup

- The app must include a guided tour or onboarding flow that explains:
  - how to create or pick an avatar
  - how to configure identity, memory, and LLM credentials
  - how to reach a first successful conversation
- This guidance must be designed for non-technical users:
  - explain concepts in plain language
  - keep setup steps explicit and sequential
  - reduce blank-state confusion
  - make the safe next action obvious on each screen
- This is a cross-cutting product requirement and should influence frontend UX, backend defaults, and documentation at every phase rather than being postponed as a final pass.

---

## 5. Security Summary (Memory & Tool Calls)

- **Single tool**: Only “update memory” for the (avatar, user) pair. No other tool calls implemented or allowed.
- **API for memory**: Dedicated endpoint(s): read memory (for LLM context), append/patch memory (for LLM tool). Both scoped by `avatar id` + authenticated `user`.
- **No cross-user/cross-avatar access**: Memory and tool calls are strictly scoped so one user cannot read or write another user’s memory or another avatar’s memory for that user.

---

## 6. Reference: Current API Surface

- **Auth**: `POST /api/register`, `POST /api/login_check`, `POST /api/token/refresh`, `POST /api/auth/google`, `GET/PATCH /api/me`.
- **Shared Library**: `GET /api/library/avatars`, `GET /api/library/animations`, `GET /api/library/shared-file`.
- **Avatars** (JWT required): `GET/POST /api/avatars`, `GET/PATCH/DELETE /api/avatars/{id}`, `POST /api/avatars/upload`, `GET /api/avatars/{id}/file`.
- **Animations** (JWT required): `GET/POST /api/animations`, `GET/PATCH/DELETE /api/animations/{id}`, `POST /api/animations/upload`, `GET /api/animations/{id}/file`.
- **Personas and Memory**: `GET/POST /api/avatars/{id}/personas`, `PATCH/DELETE /api/avatar-personas/{id}`, `GET/PATCH /api/avatars/{id}/memory`, `GET /api/avatars/{id}/memory/revisions`.
- **Chat**: `GET /api/avatars/{id}/conversations`, `GET /api/conversations/{id}`, `GET /api/conversations/{id}/messages`, `POST /api/avatars/{id}/chat`.
- **LLM Config**: `GET /api/llm/providers`, `GET /api/llm/providers/openrouter/models`, `GET/POST /api/llm/credentials`, `PATCH/DELETE /api/llm/credentials/{id}`.
- **Docs**: `GET /api/docs` (public).

All API must remain **stateless** and use JWT for authentication.
