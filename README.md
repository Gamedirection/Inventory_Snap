# Inventory Snap

A self-hosted, mobile-first inventory management app. Capture photos of rooms and items, let AI propose what it sees, review and approve into a canonical inventory, with full movement history and audit trail.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TanStack Router/Query + Tailwind CSS |
| Mobile | Capacitor (Android APK target) |
| Backend | FastAPI + SQLAlchemy async + Pydantic v2 |
| Database | PostgreSQL 15 |
| Object storage | MinIO (S3-compatible) |
| Task queue | Celery + Redis |
| AI | Ollama (llava:7b default), OpenAI, Claude — provider fallback chain |
| Deployment | Docker Compose |

## Quick Start

```bash
cp .env.example .env
# Edit .env with your secrets (SECRET_KEY, MinIO credentials, etc.)

docker-compose up -d

# Pull the vision model (first run only — ~4.7 GB)
docker exec inventory_snap-ollama-1 ollama pull llava:7b

# Frontend dev server (hot reload)
cd frontend && npm install && npm run dev
```

App available at `http://localhost:5173` (Vite dev) or `http://localhost:80` (Nginx).

## Services

| Service | Port | Purpose |
|---|---|---|
| `backend` | 8000 | FastAPI API server |
| `frontend` | 5173 | Vite dev server (dev only) |
| `postgres` | 5432 | Primary database |
| `redis` | 6379 | Celery broker + result backend |
| `minio` | 9000 / 9001 | Object storage + admin console |
| `ollama` | 11434 | Local vision model server |
| `flower` | 5555 | Celery monitoring UI |
| `nginx` | 80 / 443 | Reverse proxy |

## AI Configuration

Set `AI_PROVIDER` in `.env` to `ollama`, `openai`, or `claude`. The system tries the primary provider first, then falls back through `AI_FALLBACK_CHAIN`.

```env
AI_PROVIDER=ollama
AI_FALLBACK_CHAIN=ollama,openai
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_VISION_MODEL=llava:7b

# Optional external providers
OPENAI_API_KEY=sk-...
CLAUDE_API_KEY=sk-ant-...
```

## Project Structure

```
Inventory_Snap/
├── docker-compose.yml
├── docker-compose.override.yml   # dev hot-reload mounts
├── .env.example
├── frontend/                     # React + Vite
│   └── src/
│       ├── api/                  # Axios client + TanStack Query hooks
│       ├── components/           # UI components by domain
│       ├── pages/                # Route pages
│       ├── store/                # Zustand stores (auth, camera, etc.)
│       └── lib/                  # Types, utils, constants
└── backend/                      # FastAPI
    └── app/
        ├── api/v1/               # Route handlers
        ├── db/models/            # SQLAlchemy models
        ├── schemas/              # Pydantic v2 schemas
        ├── services/             # Business logic
        ├── workers/              # Celery app + tasks
        └── ai/                   # Provider abstraction + pipeline
```

## Features

- **Photo capture** — take photos with your device camera or import from files; works offline, syncs when back online
- **AI proposals** — photos are processed by Ollama (or OpenAI/Claude) to detect objects and suggest inventory entries
- **Swipe review** — swipe UP to approve + rescan, DOWN to skip + rescan, LEFT to reject; edit any field before approving
- **Inventory management** — search, filter, and manage all items; full edit form with category, condition, owners, serial numbers, purchase info, and tags
- **Item location** — automatically derived from the most recent photo assigned to the item (no manual entry needed)
- **Floor plan maps** — upload a floor plan image, draw room outlines, and place item pins; click a pin to move it
- **Contact book** — owners are auto-saved as contacts when assigned to items; contacts show what they own across the inventory; site members automatically appear as contacts
- **Export / backup** — download a full XLSX export per site (items, locations, movements, photos, audit)
- **Multi-site** — manage multiple separate inventory sites; archive sites to hide without deleting data
- **Settings** — profile management, password change, per-site backup download, contact book management

## Item Conditions

`new` · `excellent` · `good` · `fair` · `poor` · `broken` · `in_repair` · `lost` · `misplaced` · `shared` · `stolen` · `archived` · `unknown`

## Core Invariant

**AI never writes to the `items` table.** Only `review_service.approve()` creates canonical inventory items. The AI pipeline only writes to `proposed_items`. This is enforced at the service layer.

## API

Base path: `/api/v1/`

- `POST /auth/register` — create account
- `POST /auth/login` — get JWT (JSON body: `{email, password}`)
- `GET/POST /sites/` — list and create sites
- `GET/POST /sites/{id}/locations` — location tree management
- `POST /sites/{id}/photos` — upload photo (triggers AI processing)
- `GET /sites/{id}/review/queue` — AI proposal review queue
- `POST /review/proposals/{id}/approve` — approve a proposal → creates item
- `POST /review/proposals/{id}/reject` — reject a proposal
- `GET /sites/{id}/items` — inventory search with filters (`search`, `category`, `condition`, `owner`)
- `GET /sites/{id}/items/{item_id}/movements` — movement history
- `POST /sites/{id}/export` — async export job (XLSX)
- `GET /sites/{id}/export/{job_id}/download` — download completed export
