# VRM Animator

Local React/Vite shell for the hologram viewer in `waifu_hologram_webpage.jsx`, backed by a Symfony API for JWT auth and avatar metadata.

## Requirements

- Docker and Docker Compose

## Quick Start

```bash
docker compose up -d --build
```

This starts:

| Service | URL | Description |
|---------|-----|-------------|
| PHP | http://localhost:8080 | Symfony API backend |
| Node | http://localhost:5173 | Vite frontend dev server |
| DB | localhost:3306 | MariaDB 11 |
| Mail | http://localhost:8025 | Mailpit |

On first launch the PHP container installs Composer dependencies, generates the JWT keypair, and runs the database migrations.

## Asset Libraries

The viewer loads assets from all of these locations:

- `default_vrm/`: bundled third-party example VRM avatars.
- `default_vrma/`: bundled third-party example VRMA motions.
- `vrm/`: project VRM avatars.
- `vrma/`: project VRMA motions.
- `expressions_vrma/`: facial and mouth-only VRMA overlays.
- `idle/`: idle VRMA loops used as the return state after one-shot actions.
- Browser uploads: temporary VRM, GLB, or VRMA files added during the current session.

Browser uploads are viewer-local for the current session. They are not yet persisted by the backend.

## Tag Catalog Strategy

The project now keeps two local metadata catalogs that bridge the current frontend-only viewer and the future backend-driven LLM flow:

- `vrma/catalog.json`: body action tags and weighted random selection hints.
- `expressions_vrma/catalog.json`: facial/mouth expression tags and speech fallback pools.

Current selection rules:

- Pick body actions and expression overlays independently.
- If the LLM returns an emotion tag such as `happy`, `sad`, or `playful`, choose:
  - one random body action whose tags overlap the emotion tag
  - one random expression overlay whose tags overlap the same emotion tag
- If the LLM does not return an emotion tag, choose a random expression overlay tagged with both `speech` and `fallback`.
- Expression overlays must remain face-only and never drive body pose.

These catalogs are local scaffolding for now. Once the backend owns animation metadata, the same tags and weights should move into persisted records and be validated server-side.

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Create account and return a JWT |
| POST | `/api/login_check` | Login and return a JWT |

### Avatars

All avatar API requests are stateless and require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/avatars` | List your avatar records |
| POST | `/api/avatars` | Create an avatar record |
| GET | `/api/avatars/{id}` | Get one avatar record |
| PATCH | `/api/avatars/{id}` | Update an avatar record |
| DELETE | `/api/avatars/{id}` | Delete an avatar record |

API docs are available at `http://localhost:8080/api/docs`.

## Local Development

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd backend
composer install
php bin/console lexik:jwt:generate-keypair
php bin/console doctrine:migrations:migrate
symfony server:start
```

## Verification

### Backend tests

```bash
docker compose exec php bin/phpunit
```

### Frontend build check

```bash
npm run build
```

## Project Structure

```text
vrm-animator/
|- .docker/
|- backend/
|- src/
|- default_vrm/      # Third-party example VRM avatars
|- default_vrma/     # Third-party example VRMA motions
|- vrm/              # Project VRM assets
|- vrma/             # Project VRMA assets
|- expressions_vrma/ # Project facial/mouth VRMA overlays
|- idle/             # Idle VRMA clips
|- waifu_hologram_webpage.jsx
|- docker-compose.yml
|- package.json
`- vite.config.js
```

## Third-Party Example Assets

The files in `default_vrm/` and `default_vrma/` are included as example/demo assets only. This repository does not claim ownership of those files.

- Example VRM avatars were sourced from `https://hub.vroid.com/en/users/121271631`.
- Example VRMA motions were sourced from `https://vroid.booth.pm/items/5512385`.
- VRMA credit text: `Animation credits to pixiv Inc.'s VRoid Project`.

Ownership, copyright, and license terms remain with the original creators and publishers. Reuse, redistribution, and downstream usage must follow the original terms provided by those creators. See `default_vrm/source.txt`, `default_vrma/source.txt`, and the bundled upstream readme files in `default_vrma/` for the relevant notices.
