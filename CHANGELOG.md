# CHANGELOG — Genealogor

Format : [SemVer](https://semver.org) · Dates ISO 8601

---

## [Unreleased] — 2026-05-31

### Ajouté — Qualité & déploiement
- `netlify.toml` : déploiement Netlify (SPA redirect `/*`, cache-control no-cache sur `sw.js`
  et `index.html`, Node 20, base Vite à `/`)
- `vitest.config.ts` : configuration Vitest séparée de `vite.config.ts`
- `npm run test` / `npm run test:watch` : 104 tests unitaires
- `scripts/validate-pwa.mjs` : 14 contrôles sur `dist/` (manifest, icônes, sw.js, base path) —
  modules Node natifs uniquement, aucun appel réseau
- `npm run validate:pwa` : lanceur du script
- `.github/PULL_REQUEST_TEMPLATE.md` : checklist de validation post-déploiement (7 sections)

### Ajouté — Icône PWA
- `public/icons/icon-192.png` + `icon-512.png` + variantes maskable : arbre généalogique
  3 générations, fond violet dégradé, étoile dorée sur le nœud racine
- `public/apple-touch-icon.png` : icône iOS 180×180
- `public/favicon.ico` : favicon 32×32
- `index.html` : balises `apple-touch-icon`, `theme-color`, titre et `lang="fr"`
- `vite.config.ts` : `theme_color`/`background_color` violet, 4 entrées d'icônes (any + maskable)

### Ajouté — Tests unitaires
- `src/lib/gedcom-parser.test.ts` : 30 cas
- `src/lib/republican-calendar.test.ts` : 36 cas (dont années sextiles)
- `src/lib/sosa-aboville.test.ts` : 38 cas

### Ajouté — Fournisseurs IA
- Fournisseur **Claude (Anthropic)** : implémentation réelle via
  `POST https://api.anthropic.com/v1/messages` — en-têtes `x-api-key`,
  `anthropic-dangerous-direct-browser-access: true`, support vision multimodal
- Fournisseur **ChatGPT (OpenAI)** : `POST https://api.openai.com/v1/chat/completions`,
  modèle par défaut `gpt-4o-mini`, support vision multimodal
- Menu Paramètres refondu : sélecteur 4 fournisseurs (Claude / ChatGPT / OpenRouter / Ollama),
  champs conditionnels, avertissement mixed-content HTTPS pour Ollama

### Modifié
- `src/components/views/SettingsPanel.tsx` : `ProviderId` union
  `'claude' | 'openai' | 'openrouter' | 'ollama'`
- `package.json` : scripts `test`, `test:watch`, `validate:pwa` ajoutés

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
