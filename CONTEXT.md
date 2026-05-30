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

## État actuel : application de production (migration terminée)

La migration prototype → production est **complète**. L'application tourne sur Vite + React 19 +
TypeScript. Le dossier `prototype/` est conservé uniquement comme **référence visuelle** — ne pas
le modifier ni le supprimer.

### Stack en production

| Aspect | Choix |
|---|---|
| Build | Vite 8 |
| UI | React 19 + TypeScript 6 |
| Styles | Tailwind v4 (plugin Vite) + variables CSS `oklch` dans `src/styles/tokens.css` |
| State | `useState`/`useMemo` dans `App.tsx` (Zustand installé, non utilisé) |
| Persistance session | `localStorage` (datasets raw text + selectedId + activeTab) |
| Persistance médias | IndexedDB via `AttachmentStore` |
| Carte | react-leaflet + tuiles OpenStreetMap |
| Graphe | d3-force (npm) |
| Recherche | MiniSearch (npm) |
| PWA | vite-plugin-pwa (Workbox) |
| Export | jszip (npm) |

---

## Architecture source

```
src/
├── App.tsx                    # Shell : état global, routing par onglets, session localStorage
├── main.tsx                   # Point d'entrée React
├── types/genealogy.ts         # Tous les types TypeScript (source de vérité unique)
├── styles/tokens.css          # Variables CSS oklch (light/dark via data-theme sur <html>)
├── lib/                       # Logique métier pure (sans React), re-exportée via index.ts
│   ├── gedcom-parser.ts       # parse(text) → GenealogyData
│   ├── gedcom-serializer.ts   # serialize / download (GEDCOM 5.5.1 + 7.0)
│   ├── csv-importer.ts        # importCSV(text) → GenealogyData
│   ├── fulltext-search.ts     # search(query, individuals) via MiniSearch
│   ├── implex.ts              # Implex.compute — implexe / endogamie par génération
│   ├── descendance.ts         # Descendance.computeAboville
│   ├── republican-calendar.ts # Conversion grégorien ↔ républicain (1792-1805)
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
│   │   ├── SettingsPanel.tsx  # couche LLM (AiCall / AiCallMultimodal)
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

Configurables dans `SettingsPanel` → fournisseur : Claude / OpenRouter / Ollama.
Couche d'abstraction : `AiCall` / `AiCallMultimodal` dans `src/components/views/SettingsPanel.tsx`.

- Recherche langage naturel FR → filtre `AdvancedFilter` → appliqué localement.
- Vérification Wikipédia (opensearch FR + analyse plausibilité).
- OCR d'acte : image → champs structurés (modèle vision).
- Bio courte + récit familial long + suggestions de recherche + normalisation lieux + dédoublonnage sémantique.
- Tous les résultats IA mis en cache dans `localStorage`.

**⚠️ En production** : déplacer les clés API côté serveur (fonction serverless) — elles sont
actuellement stockées côté client dans `localStorage`.

---

## Roadmap

| Priorité | Tâche |
|---|---|
| 1 | Tests unitaires — parser GEDCOM, sérialiseurs, calendrier républicain, Sosa/Aboville |
| 2 | Sécuriser la couche IA via serverless (clés API côté serveur) |
| 3 | Virtualisation de la liste pour arbres > 10 000 individus (react-window) |
| 4 | Favoris & récents, long-press, haptique, transitions slide mobile |
| 5 | Accessibilité — audit clavier/ARIA des modales, sheets et graphe |
