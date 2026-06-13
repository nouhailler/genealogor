# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start Vite dev server (HMR)
npm run build        # tsc -b && vite build → dist/
npm run test         # Vitest — 104 unit tests (parser, calendars, Sosa/Aboville)
npm run lint         # ESLint (TypeScript + react-hooks + react-refresh) — keep at 0 errors
npm run preview      # serve the dist/ build locally
npm run validate:pwa # 14 checks on dist/ (manifest, icons, sw)
```

## Architecture

### Global state — `src/App.tsx`

All application state lives in `App.tsx` via `useState`/`useMemo`/`useRef`. There is no Zustand store in use yet (the package is installed but the `src/store/` directory is empty). Key state:

- `datasets: Dataset[]` — raw parsed files; merged on the fly by `mergeDatasets()` into a single `GenealogyData`
- `selectedId / activeTab` — which person and which tab is displayed
- `navStack / navIdx` refs — manual back/forward history (no router library)
- `privacy` — from `usePrivacy()` in `src/lib/privacy.ts`; `shouldMask()` blurs living persons

### Routing

No React Router. Tab navigation is plain `useState<TabId>`. `ViewRouter` (bottom of `App.tsx`) maps `TabId → view component`. Mobile layout uses an additional `mobilePane: 'list' | 'profile'` state to switch between the person list and the detail panel.

### `src/types/genealogy.ts`

Single source of truth for all TypeScript types: `Individual`, `Family`, `GDate`, `GEvent`, `GenealogyData`, `Dataset`, `TabId`, `ViewProps`, `PermalinkState`, `AdvancedFilter`, `ValidationError`, `StatsAggregates`, `GeocodedPlace`, `DuplicateCandidate`, etc. Read this file first when working on a new view.

### `src/lib/` — pure business logic

Framework-free TypeScript modules. All re-exported from `src/lib/index.ts`. Notable modules:

| Module | Main export |
|---|---|
| `gedcom-parser.ts` | `parse(text)` → `GenealogyData` |
| `gedcom-serializer.ts` | `serialize` / `download` / GEDCOM 7 variants |
| `csv-importer.ts` | `importCSV(text)` → `GenealogyData` |
| `fulltext-search.ts` | `search(query, individuals)` via MiniSearch |
| `implex.ts` | `Implex.compute` — Sosa implexe coefficient |
| `descendance.ts` | `Descendance.computeAboville` — Aboville numbering |
| `republican-calendar.ts` | French Republican calendar conversion |
| `place-gazetteer.ts` | 101 INSEE département codes |
| `archives-templates.ts` | 97 departmental archive URLs |
| `privacy.ts` | `usePrivacy()`, `shouldMask()` |
| `favorites.ts` | `useFavorites()`, `useRecentlyViewed()`, `haptic()` |
| `share.ts` | `sharePerson()` — Web Share API + clipboard fallback |
| `tips.ts` | per-view `TIPS` content + `useHiddenTips()` |
| `demo-scripts.ts` | `TOUR_SCRIPT` (full tour) + `VIEW_DEMOS` (per-view demos) |
| `ai-client.ts` | `aiCall` / `aiCallMultimodal` — 4 AI providers |
| `advanced-filter.ts` | `applyAdvancedFilter`, `exportCSV`, `exportGEDCOM` |
| `historical-events.ts` | French historical events for TimelineView |
| `attachment-store.ts` | IndexedDB attachment storage |
| `gphotos.ts` | `fetchAlbumImages`, `gphotoUrl`, `getGPhotosProxy`/`setGPhotosProxy` — Google Photos shared-album thumbnails |

### Google Photos (shared-album link)

A profile can carry a Google Photos **share link** in the custom GEDCOM tag `_GPHOTOS` (parsed/serialized in `gedcom-parser.ts`/`gedcom-serializer.ts`; field `Individual.gphotosAlbum`). `GooglePhotosSection.tsx` (rendered in `ProfileView`) extracts up to 10 `lh3.googleusercontent.com/pw/…` thumbnail URLs from the album page client-side and lets the user pick one as the profile **portrait** (tag `_PORTRAIT`, field `portraitUrl`), shown in the profile header and as a list avatar. Album pages aren't readable cross-origin, so the fetch goes through a generic CORS relay — Netlify function `netlify/functions/gphotos.mjs` by default, but the URL is **configurable in Settings** (`genealogor.gphotosProxy`) so the app stays portable for self-hosting. Extraction is cached 7 days (`genealogor.gphotosCache`). The official Photos Library API was locked down in March 2025, so this link-based scrape is the only durable path; it's unofficial and may break if Google changes the album-page format.

### `src/components/views/` — one file per tab

Each view receives props derived from `ViewProps` (`person`, `individuals`, `families`, `onNavigate`, `isPrivate`). Views receiving only the full dataset (not a selected person) omit `person`.

Special views: `AncestorsView` hosts `FanChart`, `PedigreeChart` (`PedigreeChart.tsx`), and `HourglassView` (`HourglassView.tsx`). `ForceGraphView` uses d3-force. `GeoMapView` uses react-leaflet.

### `src/components/mobile/`

- `MobileShell.tsx` — `MobileBottomNav` + `MobileMoreSheet` (bottom sheet with secondary tabs)
- `MobileOnboarding.tsx` — first-launch flow (4 slides, used on both mobile and desktop) + PWA install banner

### In-app guidance

`TipBar.tsx` (under the tab bar) shows rotating per-view tips from `src/lib/tips.ts`, with shortcuts to the per-view guided demo (`VIEW_DEMOS` in `src/lib/demo-scripts.ts`, played once by `CinematicOverlay`) and the contextual `HelpPanel`. Tip bars are dismissible per view (`genealogor.tipsHidden`) and restorable from the help panel footer.

### Design system

Tokens are in `src/styles/tokens.css` as CSS custom properties on `:root[data-theme="light|dark"]` (oklch colors). Theme is switched by setting `data-theme` on `<html>`. Always use `var(--token)` syntax — never hardcode colors. Key tokens: `--bg`, `--surface`, `--surface-hover`, `--border`, `--ink`, `--ink-muted`, `--ink-faint`, `--accent`, `--accent-soft`, `--sex-m`, `--sex-f`, `--danger`, `--warn`, `--success`.

Tailwind v4 is used via the `@tailwindcss/vite` plugin (no `tailwind.config.*` file). Touch targets on mobile must be ≥ 44px (`h-11`).

### Path alias

`@` maps to `src/`. Always use `@/…` imports, never relative paths from deep nesting.

### Multiple dataset support

Users can load several GEDCOM/CSV files simultaneously. `mergeDatasets()` in `App.tsx` merges them into one `GenealogyData`. Each `Dataset` carries a 3-char `prefix` to namespace IDs.

### Numbering conventions

- **Sosa-Stradonitz**: root = 1, father = 2n, mother = 2n+1, generation = `floor(log2(sosa))`
- **Aboville**: descendants coded as `"1.2.3"` — see `Descendance.computeAboville`

### Prototype reference

The high-fidelity design reference lives **outside this repo**, in
`../design_handoff_genealogor/prototype/` (entry point `Genealogor.html`, plus ~45 `.jsx`/`.js`
modules loaded via Babel in-browser). It is **not** a deployable build. When a UI behaviour is
unclear, consult the prototype — `mobile-ui-kit.jsx` in particular holds mobile patterns not yet
ported (long-press, pull-to-refresh, edge-swipe-back, skeletons). Do not delete or modify it.
