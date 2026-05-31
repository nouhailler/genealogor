# CONTEXT.md — Genealogor

## Ce que fait l'application

Genealogor est un visualiseur d'arbres généalogiques **100 % local** (offline-first, PWA).
L'utilisateur importe un fichier `.ged` (GEDCOM) ou `.csv`, et navigue à travers **13 vues** :
Profil · Ascendance (éventail/pedigree/sablier) · Descendance · Frise · Carte · Statistiques ·
Graphe relationnel · Comparer · Implications · Validation · Médias · Lab IA.

Aucune donnée ne quitte l'appareil, sauf appels IA (configurés par l'utilisateur) et géocodage
via Nominatim.

Cible : généalogistes francophones (calendrier républicain, départements INSEE, archives départ.).

---

## État actuel : production

La migration prototype → production est **complète**. L'application tourne sur Vite + React 19 +
TypeScript, déployée sur Netlify. Le dossier `prototype/` est conservé uniquement comme
**référence visuelle** — ne pas le modifier ni le supprimer.

### Stack

| Aspect | Choix |
|---|---|
| Build | Vite 8 |
| UI | React 19 + TypeScript 6 |
| Styles | Tailwind v4 (plugin Vite) + variables CSS `oklch` dans `src/styles/tokens.css` |
| State | `useState`/`useMemo` dans `App.tsx` (Zustand installé, non utilisé) |
| Persistance session | `localStorage` (datasets raw text + selectedId + activeTab + aiSettings) |
| Persistance médias | IndexedDB via `AttachmentStore` |
| Carte | react-leaflet + tuiles OpenStreetMap |
| Graphe | d3-force (npm) |
| Recherche | MiniSearch (npm) |
| PWA | vite-plugin-pwa (Workbox, registerType: autoUpdate) |
| Export | jszip (npm) |
| Tests | Vitest 4 (`vitest.config.ts` séparé de `vite.config.ts`) |

---

## Architecture source

```
.github/
└── PULL_REQUEST_TEMPLATE.md   # Checklist de validation post-déploiement (7 sections)

scripts/
└── validate-pwa.mjs           # Validation build PWA — 14 contrôles, modules Node natifs

public/
├── favicon.svg
├── icons.svg
└── icons/
    ├── icon-192.png            # PWA icon 192×192
    └── icon-512.png            # PWA icon 512×512 (maskable)

src/
├── App.tsx                    # Shell : état global, routing par onglets, session localStorage
├── main.tsx                   # Point d'entrée React
├── types/genealogy.ts         # Tous les types TypeScript (source de vérité unique)
├── styles/tokens.css          # Variables CSS oklch (light/dark via data-theme sur <html>)
├── lib/                       # Logique métier pure (sans React), re-exportée via index.ts
│   ├── gedcom-parser.ts       # parse(text) → GenealogyData
│   ├── gedcom-parser.test.ts  # 30 tests unitaires Vitest
│   ├── gedcom-serializer.ts   # serialize / download (GEDCOM 5.5.1 + 7.0)
│   ├── csv-importer.ts        # importCSV(text) → GenealogyData
│   ├── fulltext-search.ts     # search(query, individuals) via MiniSearch
│   ├── implex.ts              # Implex.compute — implexe / endogamie par génération
│   ├── descendance.ts         # Descendance.computeAboville
│   ├── sosa-aboville.test.ts  # 38 tests unitaires Vitest
│   ├── republican-calendar.ts # Conversion grégorien ↔ républicain (1792-1805)
│   ├── republican-calendar.test.ts # 36 tests unitaires Vitest
│   ├── place-gazetteer.ts     # 101 départements INSEE
│   ├── archives-templates.ts  # 97 URLs archives départementales + portails
│   ├── privacy.ts             # usePrivacy(), shouldMask()
│   ├── family-book.ts         # FamilyBook.generate (PDF HTML imprimable)
│   ├── attachment-store.ts    # AttachmentStore (IndexedDB)
│   ├── ai-features.ts         # AiFeatures (NL query, Wikipedia, bio, lieux…)
│   └── sample-ged.ts          # SAMPLE_GED (données d'exemple)
├── components/
│   ├── views/                 # 13 vues — une par TabId
│   │   ├── ProfileView.tsx
│   │   ├── AncestorsView.tsx  # + PedigreeChart.tsx + HourglassView.tsx
│   │   ├── DescendantsView.tsx
│   │   ├── ImplexView.tsx
│   │   ├── CompareView.tsx
│   │   ├── ForceGraphView.tsx
│   │   ├── TimelineView.tsx
│   │   ├── PlacesView.tsx
│   │   ├── GeoMapView.tsx
│   │   ├── MediaGallery.tsx
│   │   ├── StatsView.tsx      # inclut AgePyramid
│   │   ├── ValidationView.tsx
│   │   ├── AiLabView.tsx
│   │   ├── SettingsPanel.tsx  # couche LLM — aiCall / aiCallMultimodal (4 providers)
│   │   ├── BiographyPanel.tsx
│   │   ├── BusinessCard.tsx
│   │   ├── PresentationMode.tsx
│   │   └── MergeModal.tsx
│   ├── mobile/
│   │   ├── MobileShell.tsx    # MobileBottomNav + MobileMoreSheet
│   │   └── MobileOnboarding.tsx
│   ├── media/
│   │   ├── AttachmentDetail.tsx
│   │   └── AttachmentsSection.tsx
│   ├── ui-kit.tsx             # Icon, formatVital, sexLabel…
│   ├── AdvancedSearch.tsx
│   ├── UploadZone.tsx
│   ├── AuthGate.tsx
│   └── HelpPanel.tsx
└── store/                     # Vide — Zustand disponible si besoin
```

---

## Modèle de données

```ts
interface GenealogyData {
  individuals: Map<PersonId, Individual>;   // PersonId = "@I1@"
  families:    Map<FamilyId, Family>;       // FamilyId = "@F1@"
  errors:      ParseError[];
}

interface Individual {
  id: PersonId;
  name: { given: string; surname: string; suffix?: string; display: string };
  sex: 'M' | 'F' | 'U';
  birth: GEvent | null;
  death: GEvent | null;
  occupation: string;
  note: string;
  famc: FamilyId[];   // familles où cet individu est enfant (→ parents)
  fams: FamilyId[];   // familles où cet individu est conjoint
}

interface Dataset extends GenealogyData {
  fileName: string;
  prefix: string;    // 3 chars, namespacing IDs lors de la fusion multi-fichiers
  rawText?: string;  // texte brut conservé pour la persistance localStorage
}
```

Types complets dans `src/types/genealogy.ts` (TabId, ViewProps, AppSettings, AdvancedFilter,
ValidationError, StatsAggregates, GeocodedPlace, DuplicateCandidate, etc.).

**Numérotation Sosa-Stradonitz** : racine = 1, père = 2N, mère = 2N+1, génération = floor(log2(sosa)).
**Numérotation d'Aboville** : `Descendance.computeAboville` dans `src/lib/descendance.ts`.

---

## Persistance de session (localStorage)

Au relancement de la PWA, la session est restaurée automatiquement sans action utilisateur.

| Clé | Contenu |
|---|---|
| `genealogor.savedDatasets` | JSON `[{fileName, prefix, text}]` — raw GEDCOM/CSV re-parsé au chargement |
| `genealogor.selectedId` | PersonId de la dernière personne sélectionnée |
| `genealogor.activeTab` | TabId du dernier onglet actif |
| `genealogor.theme` | `'light'` ou `'dark'` |
| `genealogor.aiSettings` | JSON `{provider, claude?, openai?, openrouter?, ollama?}` — config fournisseur IA |
| `genealogor.shortBios` · `narratives` · `semanticDedupeCache` · etc. | Caches des résultats IA |

Erreurs de quota `localStorage` silencieusement ignorées. Le reset mobile efface également ces clés.

---

## Design system / tokens CSS

Tokens dans `src/styles/tokens.css`, thème via `data-theme="light|dark"` sur `<html>`.
Toujours utiliser `var(--token)` — ne jamais coder une couleur en dur.

### Tokens principaux
```css
--bg · --surface · --surface-hover · --border · --border-strong
--ink · --ink-muted · --ink-faint
--accent · --accent-soft
--sex-m · --sex-f
--danger · --warn · --success
```

### Typographie
- **UI** : Inter 400/500/600/700 (Google Fonts)
- **Mono** : JetBrains Mono 400/500 (labels, dates, méta)
- **Serif** : Iowan Old Style / Palatino / Georgia (livre PDF uniquement)
- Base mobile : 14px body ; jamais < 10px pour le mono.

### Règles de forme
- Rayons : `rounded-md` cartes, `rounded-full` chips/boutons, `rounded-xl` / 28px sheets.
- Cibles tactiles mobile : ≥ 44px (`h-11` sur inputs).
- Paddings responsives : `px-4 sm:px-6`.

---

## Comportements implémentés

- **Split-pane desktop** : `[liste | détail + tab-bar]`, colonne unique sur mobile < 768px.
- **Bottom-nav mobile** : 4 onglets primaires + feuille « Plus » (onglets secondaires, reset, ajout fichier).
- **Navigation historique** : pile `navStack` / `navIdx` dans `App.tsx` (Alt+← / Alt+→).
- **Persistance session** : localStorage — datasets, selectedId, activeTab restaurés au relancement PWA.
- **Multi-fichiers** : plusieurs `.ged`/`.csv` chargés simultanément, fusionnés par `mergeDatasets()`.
- **Recherche** : filtre nom simple + plein-texte MiniSearch (`FT`) + filtres avancés.
- **Masque vivants** (`Privacy`) : `filter: blur` sur personnes sans date de décès nées après `année-100`.
- **Citations par fait** : pièces jointes liées à un `factKind` (birth/marriage/death/…).
- **Export** : CSV et GEDCOM depuis la barre de liste ; GEDCOM 5.5.1 et 7.0 depuis le sérialiseur.

## Comportements non encore implémentés

- Favoris & récents (localStorage `useFavorites` / `useRecentlyViewed`)
- Long-press / clic droit → menu contextuel
- Haptique (Vibration API)
- Transitions slide entre liste↔détail et swipe-back mobile
- Partage via Web Share API (`sharePerson`)

---

## Fonctionnalités IA (toutes optionnelles)

Configurables dans `SettingsPanel` (icône ⚙️) → 4 fournisseurs.
Couche d'abstraction : `aiCall` / `aiCallMultimodal` exportées depuis `src/components/views/SettingsPanel.tsx`.

| Fournisseur | Endpoint | Auth | Modèle par défaut |
|---|---|---|---|
| Claude (Anthropic) | `https://api.anthropic.com/v1/messages` | `x-api-key` + `anthropic-dangerous-direct-browser-access: true` | `claude-haiku-4-5-20251001` |
| ChatGPT (OpenAI) | `https://api.openai.com/v1/chat/completions` | `Authorization: Bearer` | `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | `Authorization: Bearer` | configurable (liste auto) |
| Ollama | `{baseUrl}/api/generate` | aucune | `llama3.2` |

Fonctions : recherche NL · vérif Wikipedia · OCR d'acte · bio courte · récit familial ·
suggestions de recherche · normalisation de lieux · dédoublonnage sémantique.
Tous les résultats sont mis en cache dans `localStorage`.

**⚠️ Clés API** : stockées côté client dans `localStorage`. Pas de backend — choix assumé.
**⚠️ Ollama en prod** : bloqué par le navigateur depuis un site HTTPS (mixed content).
Un avertissement est affiché dans le panneau Paramètres. Usage local uniquement (`npm run dev`).

---

## Déploiement Netlify

Stratégie : repo unique, branche `deploy/netlify`, application 100 % statique.

| Aspect | Valeur |
|---|---|
| Fichier de config | `netlify.toml` à la racine |
| Commande build | `npm run build` → `dist/` |
| Node version | 20 |
| Redirects | `/* → /index.html` (SPA) |
| Cache | `Cache-Control: no-cache` sur `sw.js` et `index.html` |
| `base` Vite | non défini (sert à `/`) |

---

## Tests unitaires

Runner : **Vitest 4** (`npm run test` / `npm run test:watch`).
Config : `vitest.config.ts` (séparé de `vite.config.ts` pour ne pas polluer le build).

| Fichier | Suites | Tests | Couvre |
|---|---|---|---|
| `src/lib/gedcom-parser.test.ts` | 7 | 30 | parseLine, buildTree, parseDate, parseName, parseEvent, parseIndividual, parseFamily |
| `src/lib/republican-calendar.test.ts` | 6 | 36 | fromGregorian, format, formatGregorian, formatYear, isInPeriod — dont années sextiles |
| `src/lib/sosa-aboville.test.ts` | 10 | 38 | Sosa (numérotation, implexe, endogamie), Aboville (tri, maxGen, dédup), findDeadBranches, cohort |
| **Total** | **23** | **104** | |

---

## Validation & qualité

| Commande | Description |
|---|---|
| `npm run build` | TypeScript + Vite + génération `dist/sw.js` |
| `npm run test` | 104 tests unitaires Vitest |
| `npm run validate:pwa` | 14 contrôles sur `dist/` (manifest, icônes, sw, base path…) |
| `npm run lint` | ESLint TypeScript + react-hooks + react-refresh |

Le script `scripts/validate-pwa.mjs` utilise uniquement les modules Node natifs (fs, path, zlib).
Le template `.github/PULL_REQUEST_TEMPLATE.md` est chargé automatiquement à la création de PR.

---

## Roadmap

| Priorité | Tâche |
|---|---|
| 1 | Icônes PWA définitives (remplacer les placeholders solid-color par les vraies icônes) |
| 2 | Favoris & récents, long-press, haptique, transitions slide mobile |
| 3 | Accessibilité — audit clavier/ARIA des modales, sheets et graphe |
