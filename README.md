# VRM Animator

Local React/Vite dev shell for the `waifu_hologram_webpage.jsx` VRM hologram viewer, with a Symfony backend for user authentication and avatar management.

## Requirements

- Docker & Docker Compose

## Quick Start (Docker)

```bash
docker compose up -d --build
```

This starts four services:

| Service   | URL                      | Description                  |
|-----------|--------------------------|------------------------------|
| **PHP**   | http://localhost:8080     | Symfony API backend          |
| **Node**  | http://localhost:5173     | Vite frontend dev server     |
| **DB**    | localhost:3306            | MariaDB 11                   |
| **Mail**  | http://localhost:8025     | Mailpit (dev email catcher)  |

On first launch, the PHP container will automatically:
1. Install Composer dependencies
2. Generate JWT keypair
3. Run database migrations

## API Endpoints

### Authentication

| Method | Endpoint             | Description                      |
|--------|----------------------|----------------------------------|
| POST   | `/api/register`      | Create account, returns JWT      |
| POST   | `/api/login_check`   | Login with email/password, returns JWT |

### Avatars (requires `Authorization: Bearer <token>`)

| Method | Endpoint              | Description              |
|--------|-----------------------|--------------------------|
| GET    | `/api/avatars`        | List your avatars        |
| POST   | `/api/avatars`        | Create a new avatar      |
| GET    | `/api/avatars/{id}`   | Get avatar details       |
| PATCH  | `/api/avatars/{id}`   | Update an avatar         |
| DELETE | `/api/avatars/{id}`   | Delete an avatar         |

### API Documentation

Interactive API docs are available at `http://localhost:8080/api/docs`.

## Local Development (without Docker)

### Frontend only

```bash
npm install
npm run dev
```

Vite will print a local URL, usually `http://localhost:5173/`.

### Backend only

```bash
cd backend
composer install
php bin/console lexik:jwt:generate-keypair
php bin/console doctrine:migrations:migrate
symfony server:start
```

## Running Tests

### Backend (PHPUnit)

```bash
docker compose exec php bin/phpunit
```

### Frontend (Vitest)

```bash
docker compose exec node npx vitest run
```

## Project Structure

```
├── .docker/                  # Docker configuration
│   ├── php/                  # PHP/Apache Dockerfile & vhost
│   └── node/                 # Node Dockerfile
├── backend/                  # Symfony backend
│   ├── config/               # Symfony config (security, doctrine, etc.)
│   ├── src/
│   │   ├── Controller/       # AuthController (register)
│   │   ├── Entity/           # User, Avatar entities
│   │   ├── Repository/       # Doctrine repositories
│   │   └── State/            # API Platform state processors/providers
│   └── tests/                # PHPUnit tests
├── src/                      # React frontend source
├── docker-compose.yml        # Docker Compose config
├── package.json              # Node dependencies
└── vite.config.js            # Vite config
```

## Using the App

1. Run `docker compose up -d --build`.
2. Open `http://localhost:5173` for the VRM viewer frontend.
3. Register via `POST /api/register` with `{"email": "...", "password": "...", "displayName": "..."}`.
4. Use the returned JWT token to manage avatars via the API.
5. Upload `.vrm` or `.glb` avatars with the viewer's upload panel.
