# CHANGELOG — Genealogor

Format : [SemVer](https://semver.org) · Dates ISO 8601

---

## [0.3.0] — 2026-06-01

### Ajouté — Jeux de données pré-chargeables
- **Mode démo** `?dataset=demo` : charge `public/data/demo.ged` (famille Bertrand fictive,
  4 générations, 15 individus, lieux français) via `fetch` → pipeline GEDCOM existant
- **Mode famille** `?dataset=famille` : charge `public/data/famille.ged.enc` (GEDCOM chiffré),
  affiche `PassphraseScreen`, déchiffre dans le navigateur via Web Crypto, injecte dans le
  pipeline GEDCOM existant
- `src/components/PassphraseScreen.tsx` : champ password, bouton Accéder, gestion d'erreur,
  note de confidentialité « rien n'est envoyé à un serveur »
- `scripts/encrypt-gedcom.mjs` : PBKDF2/SHA-256/250 000 iter + AES-GCM-256 ;
  passphrase via `GEDCOM_PASSPHRASE` ou saisie masquée — jamais en argument CLI
- `public/data/demo.ged` : GEDCOM 5.5.1 fictif (famille Bertrand, 5 familles)
- `public/data/famille.ged.enc` : GEDCOM familial chiffré (binaire committable)
- `npm run encrypt:gedcom` : lanceur du script de chiffrement
- **Session prioritaire** : session localStorage existante prime sur l'auto-chargement URL
- `.gitignore` : `*.ged` ignoré sauf `public/data/demo.ged`

### Ajouté — Édition in-app
- `src/components/views/EditPersonModal.tsx` : modal d'édition — prénom/nom, sexe,
  naissance (jour+mois+année+lieu), décès, profession, note
- Bouton crayon dans l'en-tête de `ProfileView` ; sauvegarde dans le dataset +
  re-sérialisation GEDCOM → persist automatique en `localStorage`

### Ajouté — Icône PWA
- `public/icon-source.svg` + `icons/icon-{192,512}{,-maskable}.png` : arbre généalogique
  3 générations, fond violet dégradé, étoile dorée sur le nœud racine, visages souriants
- `public/apple-touch-icon.png` : icône iOS 180×180
- `public/favicon.ico` : favicon 32×32
- `index.html` : balises `apple-touch-icon`, `theme-color`, titre `Genealogor`, `lang="fr"`
- `vite.config.ts` : `theme_color`/`background_color` violet, 4 entrées d'icônes (any + maskable)

### Ajouté — Qualité & déploiement
- `netlify.toml` : déploiement Netlify (SPA redirect, cache-control no-cache sw.js/index.html)
- `vitest.config.ts` + 104 tests unitaires (parser GEDCOM · calendrier républicain · Sosa/Aboville)
- `scripts/validate-pwa.mjs` : 14 contrôles sur `dist/` — modules Node natifs uniquement
- `.github/PULL_REQUEST_TEMPLATE.md` : checklist post-déploiement (7 sections)

### Ajouté — Fournisseurs IA
- Fournisseur **Claude (Anthropic)** : `POST https://api.anthropic.com/v1/messages`,
  en-têtes `x-api-key` + `anthropic-dangerous-direct-browser-access`, vision multimodal
- Fournisseur **ChatGPT (OpenAI)** : `POST https://api.openai.com/v1/chat/completions`,
  modèle par défaut `gpt-4o-mini`, vision multimodal
- Menu Paramètres refondu : sélecteur 4 fournisseurs, champs conditionnels,
  avertissement mixed-content HTTPS pour Ollama

---

## [0.2.0] — 2026-05-30

### Description
Migration prototype → production complète. Application Vite + React 19 + TypeScript,
PWA offline-first, déployable en statique.

### Ajouté
- 13 vues React : Profil · Ascendance (éventail Sosa / pedigree / sablier) · Descendants ·
  Frise chronologique · Carte Leaflet · Statistiques · Graphe d3-force · Comparer ·
  Implications · Qualité · Médias · Lab IA · Lieux
- Parser GEDCOM 5.5.1 → `{individuals, families}` + sérialiseurs GEDCOM 5.5.1 et 7.0
- Import CSV, export CSV
- Numérotation Sosa-Stradonitz + d'Aboville
- Calendrier républicain (1792–1805) avec conversion bidirectionnelle
- Gazetteer 101 départements INSEE + 97 URLs archives départementales
- Lab IA : recherche NL · Wikipedia · OCR · bio · récit · suggestions · normalisation lieux ·
  dédoublonnage sémantique — résultats mis en cache dans `localStorage`
- Couche LLM (OpenRouter + Ollama ; Claude placeholder)
- Masque « personnes vivantes » (floutage CSS)
- Persistance session `localStorage` : datasets, selectedId, activeTab, theme
- Pièces jointes IndexedDB + OCR d'acte
- Fusion de doublons, fiche imprimable A4, mode présentation plein écran
- Bottom-nav mobile + feuille « Plus », onboarding PWA
- Navigation historique (Alt+← / Alt+→)
- Multi-fichiers GEDCOM/CSV avec namespacing par préfixe 3 chars
- PWA (Workbox, registerType: autoUpdate, manifest standalone)
- `CLAUDE.md` + `CONTEXT.md` : documentation technique pour Claude Code

---

## [0.1.0-prototype] — 2026-05-29

### Description
Prototype haute-fidélité livré dans `prototype/`.
Sert de référence visuelle et comportementale exhaustive — ne pas modifier.

### Stack
React 18 UMD + Babel Standalone · Tailwind CDN · Leaflet CDN · D3 v7 CDN ·
MiniSearch CDN · JSZip CDN
