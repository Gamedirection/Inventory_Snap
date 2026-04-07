# Changelog

## [Unreleased] — 2026-04-07

### Session: AI Pipeline Debug + API Contract Fixes

#### Fixed

**Authentication**
- Login was sending form-encoded body; changed to JSON (`{email, password}`)
- `VITE_` prefix env var was baking the Docker-internal backend URL into the browser bundle; fixed by hardcoding `API_BASE = ''` in `constants.ts` so the browser always uses relative URLs through the Vite proxy
- Renamed `API_PROXY_TARGET` in `docker-compose.override.yml` (no `VITE_` prefix) so Vite can read it server-side without leaking it to the client

**Location creation**
- `MissingGreenlet` error: Pydantic `from_attributes=True` was accessing `loc.children` (a lazy SQLAlchemy relationship) outside an async context
- Fixed with `model_validator(mode="before")` on `LocationOut` that extracts only scalar fields from ORM objects

**Photo upload**
- 405 Method Not Allowed: backend only had `POST /photos/upload`, frontend called `POST /photos`
- Fixed by stacking `@router.post("")` on the same upload handler
- `PhotoOut.url` was missing; backend only set `original_url`; fixed by populating both in `_enrich_photo`

**Celery task registration**
- `KeyError: 'app.workers.tasks.ai_processing.process_photo'`: `autodiscover_tasks(["app.workers.tasks"])` looks for `tasks.py`, not sub-modules
- Fixed by using `include=[...]` in the `Celery(...)` constructor

**Ollama provider**
- `is_available()` returned `True` as long as the Ollama service was up, even with no models loaded; now checks that the configured model exists in the model list
- `DETECTION_PROMPT.format(location_context=...)` raised `KeyError: 'object_name'` because the example JSON in the prompt contains `{object_name}`, `{x}`, etc. which Python's `.format()` tried to interpolate; fixed by using `str.replace()` instead

**Frontend-backend API contract (~20 mismatches)**
- Items: `object_name`/`short_description` → `name`/`description` in request/response; `per_page` → `size`; `q`/`verified` → `search`/`is_verified`; `primary_thumbnail_url` → `primary_photo_url`
- Sites: added `item_count` and `member_count` to `SiteOut` (computed via subquery)
- Review queue: added inline `photo` object with presigned URL; added `proposals` array per photo; fixed count field name; added proposal-level endpoints without requiring `photo_id`; added bulk action endpoint
- Movements: changed from nested objects to flat joined fields (`from_location_name`, `to_location_name`, `moved_by_display_name`)
- Pydantic `model_config` updated with `populate_by_name: True` on schemas using `validation_alias`

#### Added
- `llava:7b` pulled as the default Ollama vision model (was referencing `llava:13b` which was never pulled)
- `GET /sites/{id}/review/queue/count` returns `{pending_count}` for badge display
- `POST /review/proposals/{id}/approve` and `/reject` endpoints (no `photo_id` in path)
- `POST /sites/{id}/review/bulk` for SwipeDeck batch approve/reject

---

## [0.1.0] — 2026-04-06

### Initial scaffold

Full greenfield build of the application. All services, models, schemas, routes, frontend pages, and Celery workers created from scratch.

**Backend**
- FastAPI app with async SQLAlchemy + Alembic migrations
- All DB models: `users`, `sites`, `site_memberships`, `locations`, `floor_maps`, `photos`, `proposed_items`, `items`, `item_photos`, `item_documents`, `movements`, `audit_logs`, `export_jobs`
- Full JWT auth (register, login, refresh, logout)
- RBAC dependency injection (`site_role_checker`)
- MinIO integration for photo and thumbnail storage
- Celery workers: `process_photo`, `generate_thumbnail`, `generate_export`
- AI provider abstraction: `OllamaProvider`, `OpenAIProvider`, `ClaudeProvider` with fallback chain
- Full API surface: auth, sites, locations, floor maps, photos, review, items, movements, export, admin, SSE events

**Frontend**
- React + Vite + TanStack Router (file-based, type-safe) + TanStack Query v5
- Zustand stores: auth, camera, review, offline
- All pages: auth, sites, map, camera, review, inventory, item detail
- SwipeDeck with swipe physics (review flow)
- Floor plan canvas with react-konva
- Offline support via Dexie (IndexedDB) + outbox processor
- Kraft-paper design tokens, Tailwind CSS

**Infrastructure**
- Docker Compose: postgres, redis, minio, minio-init, backend, celery-worker, celery-beat, flower, ollama, nginx
- `docker-compose.override.yml` for dev hot-reload mounts

---

## TODO

### Critical (blocks core flow)
- [ ] Verify end-to-end AI pipeline: photo upload → Celery task → Ollama inference → proposed_items in DB → review queue shows proposals
- [ ] SSE events: confirm frontend subscribes and review badge updates in real time after AI completes
- [ ] Review workflow: test approve/reject/bulk in the SwipeDeck UI; verify item created in inventory after approval

### High priority (Phase 5–7 from plan)
- [ ] Inventory page: search, filter, pagination all working with correct field names
- [ ] Item detail page: movement timeline, photo gallery, audit trail
- [ ] Item form: full 30+ field create/edit
- [ ] Movements: record and display item moves between locations
- [ ] Export: XLSX generation via Celery, download via presigned MinIO URL
- [ ] Audit log: writes on all mutation paths; viewable on item detail

### Medium priority
- [ ] Floor map: upload image, draw room shapes with react-konva, item pin overlays
- [ ] QR label print dialog
- [ ] Bulk edit bar in inventory list
- [ ] Offline sync: push/pull engine with conflict resolution modal
- [ ] PWA manifest + Workbox service worker

### Low priority / Polish
- [ ] Android APK: `npx cap add android`, AndroidManifest permissions, signed build
- [ ] Background sync via Capacitor BackgroundTask
- [ ] Rate limiting on auth endpoints (slowapi)
- [ ] JWT refresh token rotation + Redis blacklist
- [ ] MinIO SSE-S3 encryption at rest
- [ ] Nginx TLS (certbot service)
- [ ] pg_dump backup task to MinIO
- [ ] Playwright e2e tests for critical flows
- [ ] pytest + pytest-asyncio for backend service layer
- [ ] Accessibility (ARIA, keyboard nav)
- [ ] Production CORS lockdown
- [ ] Deployment guide in README
