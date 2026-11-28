import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import {defineConfig, type Plugin} from 'vite';

const FORBIDDEN_PUBLIC_DIR_NAMES = new Set(['aistudio', 'playwright-report', 'test-results']);
const FORBIDDEN_PUBLIC_FILE_PATTERNS = [
  /^Paste_/i,
  /^\.env(\..+)?$/i,
  /\.(log|dump|sql|bak)$/i,
];
const FORBIDDEN_PUBLIC_SECRET_REGEX =
  /SUPABASE_SERVICE_ROLE_KEY|ADMIN_BOOTSTRAP_PASSWORD|ADMIN_SESSION_SECRET|PORTAL_SIGNING_SECRET|RESEND_API_KEY|GOOGLE_SERVICE_ACCOUNT|XENDIT_SECRET_KEY|PAYMONGO_SECRET_KEY|MAYA_SECRET_KEY|PAYPAL_CLIENT_SECRET|GOTYME_API_SECRET|CARD_GATEWAY_SECRET_KEY/;

function ophireumPublicAssetHygiene(): Plugin {
  const sanitizeAndVerifyDist = (distDir: string) => {
    if (!fs.existsSync(distDir)) return;

    const walk = (currentDir: string) => {
      for (const entry of fs.readdirSync(currentDir, {withFileTypes: true})) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(distDir, fullPath).replace(/\\/g, '/');

        // Backend server bundle lives in dist/server and is never deployed to GitHub Pages
        if (relPath === 'server' || relPath.startsWith('server/')) {
          continue;
        }

        if (entry.isDirectory()) {
          if (FORBIDDEN_PUBLIC_DIR_NAMES.has(entry.name)) {
            fs.rmSync(fullPath, {recursive: true, force: true});
            continue;
          }
          walk(fullPath);
          continue;
        }

        if (FORBIDDEN_PUBLIC_FILE_PATTERNS.some((pattern) => pattern.test(entry.name))) {
          fs.rmSync(fullPath, {force: true});
          continue;
        }

        // Scan text-like public artifacts for forbidden server secret identifiers
        const ext = path.extname(entry.name).toLowerCase();
        const isBinaryAsset = ['.png', '.jpg', '.jpeg', '.webp', '.ico', '.gif', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.wav', '.mp4'].includes(ext);
        if (!isBinaryAsset) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const match = content.match(FORBIDDEN_PUBLIC_SECRET_REGEX);
          if (match) {
            throw new Error(
              `[ophireum-public-asset-hygiene] Blocked build: forbidden server secret identifier (${match[0]}) found in public artifact dist/${relPath}`
            );
          }
        }
      }
    };

    walk(distDir);
  };

  return {
    name: 'ophireum-public-asset-hygiene',
    apply: 'build',
    closeBundle() {
      sanitizeAndVerifyDist(path.resolve(__dirname, 'dist'));
    },
  };
}

export default defineConfig(() => {
  return {
    // OMPNETWORK is served from the root of its custom domain.
    // Absolute asset paths are required so direct SPA routes such as
    // /portal/login can load the app when GitHub Pages serves the SPA fallback.
    base: '/',
    plugins: [react(), tailwindcss(), ophireumPublicAssetHygiene()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
