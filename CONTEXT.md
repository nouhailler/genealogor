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
TypeScript, déployée sur Netlify. Le prototype de référence visuelle vit **hors de ce repo**, dans
`../design_handoff_genealogor/prototype/` (entrée `Genealogor.html` + ~45 modules `.jsx`/`.js`) —
ne pas le modifier ni le supprimer.

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
├── validate-pwa.mjs           # Validation build PWA — 14 contrôles, modules Node natifs
└── encrypt-gedcom.mjs         # Chiffrement GEDCOM local (PBKDF2 + AES-GCM-256)

public/
├── favicon.svg                # Logo Genealogor (éclair violet)
├── favicon.ico                # Favicon 32×32
├── apple-touch-icon.png       # Icône iOS 180×180
├── icon-source.svg            # Source SVG de l'icône PWA (arbre généalogique)
├── icons/
│   ├── icon-192.png           # PWA icon 192×192 (any)
│   ├── icon-512.png           # PWA icon 512×512 (any)
│   ├── icon-192-maskable.png  # PWA icon 192×192 (maskable, fond opaque)
│   └── icon-512-maskable.png  # PWA icon 512×512 (maskable, fond opaque)
└── data/
    ├── demo.ged               # GEDCOM fictif public (famille Bertrand, 15 individus)
    └── famille.ged.enc        # GEDCOM familial chiffré AES-GCM (binaire)

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
│   ├── historical-events.ts   # Événements historiques français (TimelineView)
│   ├── privacy.ts             # usePrivacy(), shouldMask()
│   ├── favorites.ts           # useFavorites(), useRecentlyViewed(), haptic()
│   ├── share.ts               # sharePerson() — Web Share API + fallback presse-papiers
│   ├── onboarding.ts          # useOnboarding(), markOnboarded()
│   ├── ai-client.ts           # aiCall / aiCallMultimodal — couche LLM (4 fournisseurs)
│   ├── advanced-filter.ts     # SearchFilter, applyAdvancedFilter, exportCSV/GEDCOM
│   ├── merge-resolved.ts      # Persistance des paires de doublons résolues
│   ├── family-book.ts         # FamilyBook.generate (PDF HTML imprimable)
│   ├── attachment-store.ts    # AttachmentStore (IndexedDB)
│   ├── ai-features.ts         # AiFeatures (NL query, Wikipedia, bio, lieux…)
│   └── sample-ged.ts          # SAMPLE_GED (données d'exemple)
├── components/
│   ├── views/                 # 13 vues — une par TabId
│   │   ├── ProfileView.tsx
│   │   ├── EditPersonModal.tsx # Édition in-app : nom, sexe, dates, lieu, profession, note
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
│   │   ├── SettingsPanel.tsx  # UI de configuration IA (la couche LLM est dans lib/ai-client.ts)
│   │   ├── BiographyPanel.tsx
│   │   ├── BusinessCard.tsx
│   │   ├── PresentationMode.tsx
│   │   └── MergeModal.tsx
│   ├── mobile/
│   │   ├── MobileShell.tsx    # MobileBottomNav + MobileMoreSheet (favoris/récents inclus)
│   │   ├── mobile-tabs.ts     # PRIMARY_MOBILE_TABS / OVERFLOW_TABS
│   │   └── MobileOnboarding.tsx
│   ├── media/
│   │   ├── AttachmentDetail.tsx
│   │   └── AttachmentsSection.tsx
│   ├── PassphraseScreen.tsx   # Écran de saisie passphrase (mode ?dataset=famille)
│   ├── ui-kit.tsx             # Icon, formatVital, sexLabel…
│   ├── AdvancedSearch.tsx     # UI des filtres (logique dans lib/advanced-filter.ts)
│   ├── UploadZone.tsx
│   └── HelpPanel.tsx
│   ├── CinematicDemo.tsx      # Démo cinématique — CinematicOverlay + DemoCallbacks
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
| `genealogor.favorites` | JSON `[PersonId]` — favoris (étoile dans ProfileView, chip ★ dans la liste) |
| `genealogor.recent` | JSON `[PersonId]` — 12 dernières personnes consultées |
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
- **Édition in-app** : bouton crayon dans `ProfileView` → `EditPersonModal` (nom, sexe, naissance, décès, profession, note) ; sauvegarde dans le dataset + re-sérialisation GEDCOM → persist localStorage.
- **Favoris & récents** : étoile dans `ProfileView`, chip ★ (filtre favoris) dans la liste, marqueur ★ sur les lignes, sections « Favoris / Récemment consultés » dans la feuille « Plus » mobile — `useFavorites`/`useRecentlyViewed` (`src/lib/favorites.ts`), haptique légère au toggle.
- **Partage** : bouton partage dans `ProfileView` → Web Share API, fallback copie presse-papiers (`src/lib/share.ts`) ; l'URL partagée est un permalink.
- **Permalinks** : l'URL reflète l'état courant (`?person=&tab=&q=&ft=1&fav=1&adv={json}`, `replaceState`) et est relue au chargement — priorité sur la session localStorage ; `?dataset=` est préservé.
- **Datasets pré-chargeables** : `?dataset=demo` (fetch + parse) et `?dataset=famille` (fetch + déchiffrement Web Crypto + parse) — session existante prioritaire.
- **Démo cinématique** : bouton ◉ (ambre) dans la topbar → `CinematicOverlay` (`src/components/CinematicDemo.tsx`) ; curseur animé CSS, ripple au clic, légende frosted-glass en bas, 13 phases en boucle couvrant toutes les vues principales ; `data-demo-id` sur les éléments cibles (onglets, liste, recherche).

## Comportements non encore implémentés

Référence : `../design_handoff_genealogor/prototype/mobile-ui-kit.jsx`.

- Long-press / clic droit → menu contextuel (`useLongPress`)
- Transitions slide entre liste↔détail et swipe-back mobile (`useEdgeSwipeBack`)
- Pull-to-refresh et skeletons de chargement (`PullToRefresh`, `Skeleton`)
- Haptique généralisée (le helper `haptic()` existe dans `src/lib/favorites.ts`, branché uniquement sur les favoris)

---

## Fonctionnalités IA (toutes optionnelles)

Configurables dans `SettingsPanel` (icône ⚙️) → 4 fournisseurs.
Couche d'abstraction : `aiCall` / `aiCallMultimodal` exportées depuis `src/lib/ai-client.ts`.

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
À proxifier ultérieurement via une Netlify Function.

---

## Déploiement Netlify

Stratégie : repo unique, branche `deploy/netlify`, application 100 % statique.

| Aspect | Valeur |
|---|---|
| Fichier de config | `netlify.toml` à la racine |
| Commande build | `npm run build` → `dist/` |
| Node version | 20 |
| Redirects | `/* → /index.html` (SPA) |
| Cache SW | `Cache-Control: no-cache` sur `sw.js` et `index.html` |
| `base` Vite | non défini (sert à `/`) |
| Ollama en prod | inopérant (mixed content HTTPS→HTTP) |
| Clés IA | côté client pour l'instant — à proxifier via Netlify Function |

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
| `npm run encrypt:gedcom` | Chiffre un GEDCOM → `public/data/famille.ged.enc` |

Le script `scripts/validate-pwa.mjs` utilise uniquement les modules Node natifs (fs, path, zlib).
Le template `.github/PULL_REQUEST_TEMPLATE.md` est chargé automatiquement à la création de PR.

---

## Jeux de données pré-chargeables

### Mode démo — `?dataset=demo`

Charge `public/data/demo.ged` (GEDCOM en clair, committable) via `fetch` → parser GEDCOM existant.

### Mode famille — `?dataset=famille`

Charge `public/data/famille.ged.enc` (binaire chiffré, committable) et affiche `PassphraseScreen`.
Déchiffrement **100 % côté navigateur** via Web Crypto API native (`crypto.subtle`).

**Paramètres crypto** (identiques Node ↔ navigateur) :
- Dérivation de clé : PBKDF2 / SHA-256 / 250 000 itérations / sel aléatoire 16 octets
- Chiffrement : AES-GCM 256 bits / nonce aléatoire 12 octets
- Format binaire : `[ sel : 16 o ][ IV : 12 o ][ texte chiffré + tag GCM ]`

### Chiffrer vos données familiales

```bash
GEDCOM_PASSPHRASE="votre-phrase-secrète" npm run encrypt:gedcom -- mes-donnees.ged
# Sortie par défaut : public/data/famille.ged.enc
```

### Limites et avertissements

| Sujet | Note |
|---|---|
| **Révocation** | La passphrase est partagée (pas d'utilisateurs individuels). Pour révoquer l'accès : changer la passphrase, re-chiffrer, redéployer. |
| **Persistance localStorage** | Après déchiffrement, les données sont persitées dans `localStorage` par la logique de session existante (acceptable en usage familial — à connaître). |
| **Service Worker** | `demo.ged` et `famille.ged.enc` ne sont **pas** pré-cachés par le SW (chargés au runtime via `fetch`). La config PWA n'est pas modifiée. |
| **Sécurité de la passphrase** | Ne jamais passer la passphrase en argument CLI (historique shell). Utiliser `GEDCOM_PASSPHRASE` ou la saisie masquée. |

---

## Roadmap

| Priorité | Tâche |
|---|---|
| 1 | Long-press (menu contextuel), transitions slide mobile, pull-to-refresh, skeletons |
| 2 | Accessibilité — audit clavier/ARIA des modales, sheets et graphe |
| 3 | Netlify Function proxy pour Ollama (mixed-content HTTPS→HTTP) |
