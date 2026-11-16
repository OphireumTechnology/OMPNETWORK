# OPHIREUM NETWORK — Production Deployment Architecture & Rollback Guide

## 1. Architecture Overview (Static Frontend + Express Backend API)

GitHub Pages serves **only static files** (`dist/`). All transactional persistence, admin RBAC authentication, transactional email dispatch, calendar requests, and Gemini AI proxy routes live in `server.ts` (`src/server/app.ts`) and **must run on a stateful/managed Node.js host** (e.g., Google Cloud Run, Railway, or Render) alongside PostgreSQL/Supabase.

| Layer | Host Target | Build / Start Command | Critical Environment Variables |
| :--- | :--- | :--- | :--- |
| Frontend SPA | GitHub Pages (`https://ophireummultimedia.com/`) | `npm run build` (`dist/`) | `VITE_API_BASE_URL` (URL of Node API), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Backend API | Cloud Run / Railway / Render (`https://api.ophireummultimedia.com`) | `npm run start` (`tsx server.ts`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `GEMINI_API_KEY`, `ADMIN_SESSION_SECRET`, `ALLOWED_ORIGINS` |
| Database | Supabase Managed PostgreSQL | Run `supabase/migrations/001_phase1_security_and_persistence.sql` | Strict RLS enabled across all tables |

## 2. Database Migration Procedure

Before deploying application traffic:
1. Apply `/supabase/schema.sql` (new project) or `/supabase/migrations/001_phase1_security_and_persistence.sql` (existing database).
2. Insert initial active administrators into `public.admin_users`:
   ```sql
   INSERT INTO public.admin_users (email, full_name, role, is_active)
   VALUES ('executive@ophireummultimedia.com', 'Dhenze Languisan', 'super_admin', true)
   ON CONFLICT (email) DO UPDATE SET is_active = true, role = 'super_admin';
   ```
3. Verify no public `USING (true)` policies remain on `client_profiles`, `ai_conversation_sessions`, `solution_requests`, or `consultation_appointments`.

## 3. Railway Backend Connection, DNS/TLS & CORS Configuration

- **GitHub Pages Build (`VITE_API_BASE_URL`)**:
  - Local development leaves `VITE_API_BASE_URL` unset so all browser requests use same-origin `/api/*` routes on port `3000`.
  - GitHub Pages builds pass `VITE_API_BASE_URL` (defaulting to `https://api.ophireummultimedia.com` on authorized GitHub Pages hostnames).
- **Porkbun DNS & Railway Custom Domain Cutover**:
  - Verify `api.ophireummultimedia.com` CNAME points to your Railway service's assigned `*.up.railway.app` target (not `uixie.porkbun.com` / Porkbun parking proxy) and confirm TLS is active.
  - Verify live backend readiness via `curl -i https://api.ophireummultimedia.com/api/health` returning HTTP `200` with `dependencies.database.connected === true`.
- **Backend CORS & Railway `PORT`**:
  - Express binds `0.0.0.0:${PORT}` using Railway's injected `PORT` env variable (`resolveListenPort`).
  - On Railway, set:
    ```
    ALLOWED_ORIGINS=https://ophireummultimedia.com,https://www.ophireummultimedia.com,https://ophireumtechnology.github.io
    ```

## 4. Health & Readiness Verification

- Readiness endpoint: `GET /api/health`
- Expected healthy response checks:
  - `dependencies.database.connected === true`
  - `dependencies.email.configured === true`
  - `dependencies.adminAuth` configured
  - `version` matches deployed commit SHA (`GITHUB_SHA`)

## 5. Rollback Procedure

1. **GitHub Pages Frontend**: Re-run the `Deploy OMPNETWORK to GitHub Pages` workflow from the last verified tag/commit or revert the PR on `main`.
2. **Backend Node Service**: Route traffic back to the previous healthy container revision (e.g., Cloud Run traffic split `--to-revisions <previous>=100`).
3. **Database Migrations**: Migration `001_phase1_security_and_persistence.sql` is purely additive (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, tightened RLS) and backward-safe; never drop customer inquiry columns without backup snapshot.
