#!/usr/bin/env node
/**
 * Encrypt a GEDCOM file with PBKDF2 + AES-GCM for the famille dataset.
 * Usage: node scripts/encrypt-gedcom.mjs <input.ged> [output.enc]
 *
 * Passphrase: set GEDCOM_PASSPHRASE env var, or the script will prompt for it.
 *
 * Binary format: [ salt: 16 bytes ][ iv: 12 bytes ][ ciphertext+GCM-tag ]
 * Crypto params:  PBKDF2 / SHA-256 / 250 000 iterations / AES-GCM-256
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { webcrypto } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { subtle } = webcrypto;
const getRandomValues = (arr) => webcrypto.getRandomValues(arr);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ─────────────────────────────────────────────────────────────────

const [,, inputArg, outputArg] = process.argv;

if (!inputArg) {
  console.error('Usage: node scripts/encrypt-gedcom.mjs <input.ged> [output.enc]');
  process.exit(1);
}

const inputPath  = resolve(inputArg);
const outputPath = outputArg
  ? resolve(outputArg)
  : resolve(__dirname, '../public/data/famille.ged.enc');

// ── Read passphrase (env var or masked prompt) ───────────────────────────────

async function readPassphrase() {
  const env = process.env.GEDCOM_PASSPHRASE;
  if (env && env.trim()) return env.trim();

  // Interactive masked prompt (Linux/macOS)
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    process.stderr.write('Passphrase: ');
    // Disable echo
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    let passphrase = '';
    process.stdin.on('data', (char) => {
      const c = char.toString();
      if (c === '\n' || c === '\r' || c === '') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stderr.write('\n');
        rl.close();
        if (c === '') { reject(new Error('Interrupted')); return; }
        resolve(passphrase);
      } else if (c === '') {
        passphrase = passphrase.slice(0, -1);
      } else {
        passphrase += c;
      }
    });
    // Fallback for non-TTY (piped input)
    rl.on('line', (line) => { resolve(line.trim()); });
    rl.on('close', () => { if (!passphrase) resolve(''); });
  });
}

// ── Crypto ───────────────────────────────────────────────────────────────────

async function encrypt(plaintext, passphrase) {
  const enc     = new TextEncoder();
  const salt    = getRandomValues(new Uint8Array(16));
  const iv      = getRandomValues(new Uint8Array(12));

  const keyMaterial = await subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'],
  );
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', iterations: 250_000, salt },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const cipherBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  );

  // Binary layout: salt(16) | iv(12) | ciphertext+tag
  const result = new Uint8Array(16 + 12 + cipherBuf.byteLength);
  result.set(salt, 0);
  result.set(iv, 16);
  result.set(new Uint8Array(cipherBuf), 28);
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const plaintext  = readFileSync(inputPath, 'utf-8');
const passphrase = await readPassphrase();

if (!passphrase) {
  console.error('Error: empty passphrase — aborting.');
  process.exit(1);
}

const encrypted = await encrypt(plaintext, passphrase);
writeFileSync(outputPath, encrypted);

console.log(`✓ Encrypted ${inputPath}`);
console.log(`  → ${outputPath} (${encrypted.byteLength} bytes)`);
