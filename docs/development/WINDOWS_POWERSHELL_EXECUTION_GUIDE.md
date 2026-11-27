# OPHIREUM NETWORK — WINDOWS POWERSHELL 5.1+ EXECUTION GUIDE

**Local Windows Workspace:** `D:\Ophireum Multimedia Files\OMPNETWORK`  
**Shell Compatibility:** Windows PowerShell 5.1 and PowerShell 7+ (`pwsh`) — **Zero `&&` chaining, zero Bash/WSL required**  
**Node.js Requirement:** Node.js `22.x` (`node -v` must report `v22.*`)

---

## 1. Environment & Toolchain Preflight (Pure PowerShell 5.1)

```powershell
Set-Location "D:\Ophireum Multimedia Files\OMPNETWORK"
node -v
if ($LASTEXITCODE -ne 0) { throw "Node.js 22.x is not installed or not on PATH." }
npm -v
if ($LASTEXITCODE -ne 0) { throw "npm is not available on PATH." }
git status
git branch --show-current
if (Test-Path ".\bun.lock") { Remove-Item ".\bun.lock" -Force }
```

---

## 2. Clean Dependency Installation & Full Local Verification (Pure PowerShell 5.1)

Every step checks `$LASTEXITCODE` explicitly so Windows PowerShell 5.1 halts immediately on any failure:

```powershell
Set-Location "D:\Ophireum Multimedia Files\OMPNETWORK"

npm run clean
if ($LASTEXITCODE -ne 0) { throw "clean failed" }

npm ci --include=optional --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "typecheck failed" }

npm run lint
if ($LASTEXITCODE -ne 0) { throw "lint failed" }

npm test
if ($LASTEXITCODE -ne 0) { throw "npm test failed" }

npm run build:all
if ($LASTEXITCODE -ne 0) { throw "build:all failed" }

npm run smoke:prod
if ($LASTEXITCODE -ne 0) { throw "smoke:prod failed" }

npm run sbom
if ($LASTEXITCODE -ne 0) { throw "sbom generation failed" }

npm run test:e2e:list
if ($LASTEXITCODE -ne 0) { throw "test:e2e:list failed" }

npm audit --omit=dev --audit-level=high
if ($LASTEXITCODE -ne 0) { throw "npm audit reported high/critical production vulnerabilities" }
```

---

## 3. Standalone PostgreSQL Migrations (`000`–`007`) Against Railway PostgreSQL

### Step 3A — Dry-Run Plan (Read-Only)

```powershell
$env:DATABASE_URL = "postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>"
$env:DATABASE_SSL = "require"
npm run db:migrate:dry-run
if ($LASTEXITCODE -ne 0) { throw "db:migrate:dry-run failed" }
```

### Step 3B — Transactional Execution & Idempotency Re-Run

```powershell
npm run db:migrate
if ($LASTEXITCODE -ne 0) { throw "db:migrate failed" }

npm run db:migrate
if ($LASTEXITCODE -ne 0) { throw "idempotent db:migrate re-run failed" }

Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
```

---

## 4. Real PostgreSQL 16 Integration Suite Against Staging Database

```powershell
$env:TEST_DATABASE_URL = "postgresql://<STAGING_USER>:<STAGING_PASSWORD>@<STAGING_HOST>:<PORT>/<STAGING_DB>"
$env:DATABASE_SSL = "require"
npm run test:pg
if ($LASTEXITCODE -ne 0) { throw "test:pg failed against staging PostgreSQL 16" }
Remove-Item Env:\TEST_DATABASE_URL -ErrorAction SilentlyContinue
```

---

## 5. Multi-Browser Playwright E2E Execution on Windows (45 Tests Across 5 Projects)

```powershell
Set-Location "D:\Ophireum Multimedia Files\OMPNETWORK"

npx playwright install chromium firefox webkit
if ($LASTEXITCODE -ne 0) { throw "Playwright browser installation failed" }

npm run test:e2e
if ($LASTEXITCODE -ne 0) { throw "Playwright E2E suite failed" }
```

To run only the Pixel 7 mobile verification project:

```powershell
npx playwright test --project=mobile
if ($LASTEXITCODE -ne 0) { throw "Pixel 7 mobile E2E project failed" }
```

To open the interactive HTML Playwright report:

```powershell
npx playwright show-report
```

---

## 6. Live API Health, Readiness, Version & CORS Preflight Check

```powershell
$ApiBase = "https://api.ophireummultimedia.com"

Invoke-RestMethod -Uri "$ApiBase/healthz" -Method Get | ConvertTo-Json -Depth 4
Invoke-RestMethod -Uri "$ApiBase/api/health" -Method Get | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri "$ApiBase/api/ready" -Method Get | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri "$ApiBase/api/version" -Method Get | ConvertTo-Json -Depth 4

$preflight = Invoke-WebRequest -Uri "$ApiBase/api/portal/auth/register" -Method Options -Headers @{
  "Origin" = "https://ophireummultimedia.com"
  "Access-Control-Request-Method" = "POST"
  "Access-Control-Request-Headers" = "Content-Type"
}
$preflight.StatusCode
$preflight.Headers["Access-Control-Allow-Origin"]
```

---

## 7. Static Security Hygiene Gate (Pure PowerShell — Zero Bash `grep`)

All three checks below must return **empty output** (zero matches):

```powershell
Set-Location "D:\Ophireum Multimedia Files\OMPNETWORK"

Select-String -Path "src\components\*","src\portal\*","src\admin\*","src\legal\*" -Recurse -Pattern "SUPABASE_SERVICE_ROLE_KEY|ADMIN_SESSION_SECRET|GEMINI_API_KEY|RESEND_API_KEY|MFA_ENCRYPTION_KEY"
Select-String -Path "supabase\migrations\*.sql" -Pattern "USING \(true\)"
Select-String -Path "supabase\migrations\*.sql" -Pattern "live_payments_enabled.*true"
```

---

## 8. Controlled Recovery Branch Commit & Push (Never Directly to `main`)

```powershell
Set-Location "D:\Ophireum Multimedia Files\OMPNETWORK"
git status
git add .
git commit -m "fix(recovery): Pixel 7 mobile AI portal, zero horizontal overflow, /healthz, /api/version, cross-platform clean & CI concurrency"
if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
git push -u origin HEAD
if ($LASTEXITCODE -ne 0) { throw "git push failed" }
```
