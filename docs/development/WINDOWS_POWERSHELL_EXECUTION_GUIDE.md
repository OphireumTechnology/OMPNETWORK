# OPHIREUM NETWORK — WINDOWS POWERSHELL EXECUTION GUIDE (PHASE 76)

**Local Windows Workspace:** `D:\Ophireum Multimedia Files\OMPNETWORK`  
**Shell:** Windows PowerShell 5.1+ or PowerShell 7+ (`pwsh`) — **Zero Bash / WSL Required**  
**Node.js Requirement:** Node.js `22.x` (`node -v` must report `v22.*`)

---

## 1. Environment & Toolchain Preflight (PowerShell)

```powershell
Set-Location "D:\Ophireum Multimedia Files\OMPNETWORK"
node -v
npm -v
git status
git branch --show-current
```

Verify no competing lockfile exists:

```powershell
if (Test-Path ".\bun.lock") { Remove-Item ".\bun.lock" -Force }
```

---

## 2. Clean Dependency Installation & Full Local Verification

```powershell
Set-Location "D:\Ophireum Multimedia Files\OMPNETWORK"
npm ci --no-audit --no-fund
npm run typecheck
npm run lint
npm test
npm run build:all
npm run smoke:prod
npm run sbom
npm run test:e2e:list
npm audit --omit=dev --audit-level=high
```

---

## 3. Running Standalone PostgreSQL Migrations (`000`–`007`) Against Railway PostgreSQL

### Dry-Run First (Read-Only Plan)

```powershell
$env:DATABASE_URL = "postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>"
$env:DATABASE_SSL = "require"
npm run db:migrate:dry-run
```

### Execute Migrations Transactionally

```powershell
npm run db:migrate
```

### Re-Run Idempotency Check (Expected: `applied: []`, `skipped: [8 files]`)

```powershell
npm run db:migrate
```

### Clear Temporary Session Secret From Shell Memory

```powershell
Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
```

---

## 4. Running Real PostgreSQL 16 Integration Suite Against Live Staging DB

```powershell
$env:TEST_DATABASE_URL = "postgresql://<STAGING_USER>:<STAGING_PASSWORD>@<STAGING_HOST>:<PORT>/<STAGING_DB>"
$env:DATABASE_SSL = "require"
npm run test:pg
Remove-Item Env:\TEST_DATABASE_URL -ErrorAction SilentlyContinue
```

---

## 5. Running Full Multi-Browser Playwright E2E Suite on Windows

```powershell
Set-Location "D:\Ophireum Multimedia Files\OMPNETWORK"
npx playwright install chromium firefox webkit
npm run test:e2e
```

View interactive HTML Playwright report after execution:

```powershell
npx playwright show-report
```

---

## 6. PowerShell Live API & CORS Verification (Staging or Production)

```powershell
$ApiBase = "https://api.ophireummultimedia.com"

# 1. Health check
Invoke-RestMethod -Uri "$ApiBase/api/health" -Method Get | ConvertTo-Json -Depth 6

# 2. Readiness check
Invoke-RestMethod -Uri "$ApiBase/api/ready" -Method Get | ConvertTo-Json -Depth 6

# 3. Version check
Invoke-RestMethod -Uri "$ApiBase/api/version" -Method Get | ConvertTo-Json -Depth 4

# 4. CORS preflight check for https://ophireummultimedia.com
$preflight = Invoke-WebRequest -Uri "$ApiBase/api/portal/auth/register" -Method Options -Headers @{
  "Origin" = "https://ophireummultimedia.com"
  "Access-Control-Request-Method" = "POST"
  "Access-Control-Request-Headers" = "Content-Type"
}
$preflight.StatusCode
$preflight.Headers["Access-Control-Allow-Origin"]
```

---

## 7. PowerShell Static Security Hygiene Gate (No Bash `grep` Required)

```powershell
Set-Location "D:\Ophireum Multimedia Files\OMPNETWORK"

# Ensure no server secrets appear in client source
Select-String -Path "src\components\*","src\portal\*","src\admin\*","src\legal\*" -Recurse -Pattern "SUPABASE_SERVICE_ROLE_KEY|ADMIN_SESSION_SECRET|GEMINI_API_KEY|RESEND_API_KEY|MFA_ENCRYPTION_KEY"

# Ensure zero USING (true) RLS policies exist in supabase/migrations
Select-String -Path "supabase\migrations\*.sql" -Pattern "USING \(true\)"

# Ensure live_payments_enabled is never defaulted to true
Select-String -Path "supabase\migrations\*.sql" -Pattern "live_payments_enabled.*true"
```

All three commands must return **empty output** (zero matches).

---

## 8. Controlled Staging Branch Commit & Push Workflow (PowerShell)

Never push unreviewed changes directly to `main`:

```powershell
Set-Location "D:\Ophireum Multimedia Files\OMPNETWORK"
git checkout -b "release/rc2-native-postgresql"
git status
git add .
git commit -m "release(rc2): native Railway PostgreSQL runtime, Railpack build fix, Migration 007, AI governance & CI live PG16"
git push -u origin "release/rc2-native-postgresql"
```
