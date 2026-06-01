#!/usr/bin/env node
// PWA build validator — modules Node natifs uniquement, aucun appel réseau.
// Usage : node scripts/validate-pwa.mjs [dist-dir]
// Exit 0 = tout vert, exit 1 = au moins un contrôle échoué.

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, process.argv[2] || 'dist');

// ── Helpers ───────────────────────────────────────────────────────────────────

const results = [];

function check(label, pass, detail = '') {
  results.push({ label, pass, detail });
  const icon = pass ? '✓' : '✗';
  const color = pass ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  const extra = detail ? `  ${pass ? '\x1b[90m' : '\x1b[33m'}${detail}${reset}` : '';
  console.log(`  ${color}${icon}${reset}  ${label}${extra}`);
}

function distPath(...parts) {
  return join(DIST, ...parts);
}

function readJson(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

// ── Contrôles ─────────────────────────────────────────────────────────────────

console.log('\n\x1b[1mValidation PWA — dist/\x1b[0m');
console.log(`  Répertoire : ${DIST}\n`);

// 1. index.html
const indexPath = distPath('index.html');
const indexExists = existsSync(indexPath);
check('dist/index.html existe', indexExists);

// 2. Service worker
const swCandidates = ['sw.js', 'service-worker.js', 'workbox-*.js'];
let swPath = null;
for (const name of ['sw.js', 'service-worker.js']) {
  const p = distPath(name);
  if (existsSync(p)) { swPath = p; break; }
}
// Fallback : cherche un sw généré par vite-plugin-pwa avec un hash
if (!swPath) {
  const { readdirSync } = await import('fs');
  try {
    const files = readdirSync(DIST);
    const sw = files.find((f) => /^sw[.\-]/.test(f) && f.endsWith('.js'));
    if (sw) swPath = distPath(sw);
  } catch { /* dist absent */ }
}
check('Service worker présent', !!swPath, swPath ? swPath.replace(DIST + '/', '') : 'sw.js introuvable');

// 3. manifest.webmanifest
const manifestPath = distPath('manifest.webmanifest');
const manifestExists = existsSync(manifestPath);
check('dist/manifest.webmanifest existe', manifestExists);

let manifest = null;
if (manifestExists) {
  try {
    manifest = readJson(manifestPath);
    check('manifest.webmanifest est du JSON valide', true);
  } catch (e) {
    check('manifest.webmanifest est du JSON valide', false, String(e));
  }
}

// 4. Champs obligatoires du manifest
if (manifest) {
  check('manifest.name défini',       !!manifest.name,       manifest.name || '(absent)');
  check('manifest.short_name défini', !!manifest.short_name, manifest.short_name || '(absent)');
  check('manifest.display === "standalone"',
    manifest.display === 'standalone', `display = "${manifest.display}"`);
  check('manifest.theme_color défini', !!manifest.theme_color, manifest.theme_color || '(absent)');

  // 5. Icônes 192 et 512
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const has192 = icons.some((ic) => typeof ic.sizes === 'string' && ic.sizes.includes('192'));
  const has512 = icons.some((ic) => typeof ic.sizes === 'string' && ic.sizes.includes('512'));
  check('Icône 192×192 déclarée dans le manifest', has192);
  check('Icône 512×512 déclarée dans le manifest', has512);

  // 6. Au moins une icône maskable
  const hasMaskable = icons.some(
    (ic) => typeof ic.purpose === 'string' && ic.purpose.includes('maskable'),
  );
  check('Au moins une icône avec purpose "maskable"', hasMaskable);

  // 7. Fichiers d'icône réellement présents dans dist/
  for (const ic of icons) {
    if (!ic.src) continue;
    // Les src peuvent être absolus ("/icons/…") ou relatifs
    const rel = ic.src.replace(/^\//, '');
    const iconFile = distPath(rel);
    const exists = existsSync(iconFile);
    check(`Fichier icône présent : ${ic.src}`, exists);
  }
}

// 8. Pas de base path erroné dans index.html
// Avec base:'/', Vite produit src="/assets/file.js".
// Avec base:'/subapp/', il produit src="/subapp/assets/file.js".
// On cherche ce second pattern : /MOT/assets/ indique un sous-chemin inatendu.
if (indexExists) {
  const html = readFileSync(indexPath, 'utf-8');
  const badBase = /(?:src|href)="\/[a-zA-Z][a-zA-Z0-9_-]+\/assets\//.test(html);
  check(
    'index.html sans base path absolu incorrect (ex: /genealogor/assets/)',
    !badBase,
    badBase ? 'Pattern /sous-chemin/assets/ détecté — vérifier vite.config.ts base' : '',
  );
}

// ── Résumé ────────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass).length;
const total  = results.length;

console.log('');
console.log('─'.repeat(50));
if (failed === 0) {
  console.log(`\x1b[32m\x1b[1m  ✓ ${passed}/${total} contrôles passés — build PWA valide\x1b[0m`);
} else {
  console.log(`\x1b[31m\x1b[1m  ✗ ${failed}/${total} contrôle(s) échoué(s)\x1b[0m`);
}
console.log('─'.repeat(50));
console.log('');

process.exit(failed > 0 ? 1 : 0);
