# CONTEXT.md — Genealogor : migration prototype → production

## Ce que fait l'application

Genealogor est un visualiseur d'arbres généalogiques **100 % local** (offline-first, PWA).
L'utilisateur importe un fichier `.ged` (GEDCOM) ou `.csv`, et navigue à travers **13 vues** :
Profil · Ascendance (éventail/pedigree/sablier) · Descendance · Frise · Carte · Statistiques ·
Graphe relationnel · Comparer · Implications · Validation · Médias · Lab IA.

Aucune donnée ne quitte l'appareil, sauf appels IA (configurés par l'utilisateur) et géocodage
via Nominatim.

Cible : généalogistes francophones (calendrier républicain, départements INSEE, archives départ.).

---

## État actuel : prototype HTML + React in-browser (Babel)

Le dossier `prototype/` contient un prototype haute-fidélité fonctionnel. Il n'est **pas** destiné
à la production : React et Babel tournent dans le navigateur, les modules s'attachent à `window.*`,
Tailwind est chargé via CDN. Tout le design (couleurs, typo, espacements, interactions) est
**définitif** — le reproduire fidèlement est la priorité.

Point d'entrée du prototype : `prototype/Genealogor.html`

---

## Stack cible : Vite + React 18 + TypeScript

| Aspect | Prototype | Cible |
|---|---|---|
| Build | Aucun (in-browser Babel) | Vite 5 |
| Langage | JS + JSX Babel | TypeScript 5 + TSX |
| Styles | Tailwind CDN + variables CSS | Tailwind v4 (PostCSS) + même tokens CSS |
| Modules | Globaux `window.*` | ES modules (`import`/`export`) |
| State | useState/useMemo monolithique | idem, ou Zustand si besoin |
| Persistance | localStorage + IndexedDB | idem |
| Cartes | Leaflet CDN | react-leaflet (npm) |
| Graphe | d3 CDN | d3 (npm) |
| PWA | sw.js manuel | vite-plugin-pwa (Workbox) |
| Recherche | MiniSearch CDN | minisearch (npm) |
| ZIP export | JSZip CDN | jszip (npm) |

---

## Architecture des fichiers du prototype

### Logique métier `.js` — portables directement (remplacer `window.X=` par `export`)

```
gedcom-parser.js       → GedcomParser.parse(text) → {individuals, families, errors}
gedcom-serializer.js   → GedcomSerializer.{serialize,download,serialize7,download7}
csv-importer.js        → CsvImporter
fulltext-search.js     → FullTextSearch.search
implex.js              → Implex.compute, Implex.isImplexedFor
descendance.js         → Descendance.computeAboville
historical-events.js   → HistoricalEvents
republican-calendar.js → RepublicanCalendar
place-gazetteer.js     → PlaceGazetteer (101 départements INSEE)
archives-templates.js  → ArchivesTemplates.linksFor (97 URLs archives + portails)
privacy.js             → Privacy, usePrivacy
family-book.js         → FamilyBook.generate (PDF HTML imprimable)
attachment-store.js    → AttachmentStore (IndexedDB)
sample.ged.js          → SAMPLE_GED (données d'exemple)
```

### UI `.jsx` — à réimplémenter en composants React modulaires

```
app.jsx                → App (shell principal, state global, routing)
ui-kit.jsx             → Icon, formatVital, sexLabel…
auth-gate.jsx          → AuthGate (auth optionnelle multi-utilisateur)
upload-zone.jsx        → UploadZone (drag-drop .ged/.csv)
profile-view.jsx       → ProfileView, RepublicanBadge, ShortBioCaption, FactSourceBadge
ancestors-view.jsx     → AncestorsView, FanChart
pedigree-chart.jsx     → PedigreeChart (7 générations)
hourglass-chart.jsx    → HourglassView (Sosa + Aboville)
descendants-view.jsx   → DescendantsView (arbre repliable)
implex-view.jsx        → ImplexView
compare-view.jsx       → CompareView (2 fiches)
force-graph.jsx        → ForceGraphView (d3-force)
timeline-view.jsx      → TimelineView (frise par décennie)
places-view.jsx        → PlacesView (nuage de lieux)
geomap-view.jsx        → GeoMapView (Leaflet : Points/Migrations/Heatmap/Patronymes)
stats-view.jsx         → StatsView
age-pyramid.jsx        → AgePyramid
validation-view.jsx    → ValidationView, runValidation
ai-features.jsx        → AiLabView, AiFeatures (lab IA)
advanced-features.jsx  → AdvancedSearch, export CSV/print
settings-panel.jsx     → SettingsPanel, AiCall, AiCallMultimodal (couche LLM)
bio-ai.jsx             → BioAi (récit biographique long)
attachments-section.jsx→ AttachmentsSection
attachment-detail.jsx  → AttachmentDetail (modale + OCR + citation par fait)
media-store.jsx        → MediaGallery
merge-modal.jsx        → GenealogorMerge (fusion doublons)
business-card.jsx      → BusinessCard (fiche imprimable A4)
presentation-mode.jsx  → PresentationMode (plein écran)
help-panel.jsx         → HelpPanel
mobile-shell.jsx       → MobileBottomNav, MobileMoreSheet, useIsMobile
mobile-ui-kit.jsx      → MUI.* (Sheet, Segmented, PullToRefresh, Skeleton, haptic…)
mobile-onboarding.jsx  → MobileOnboarding, PWA install banner, sharePerson
history.jsx            → DEPRECATED — intégré dans app.jsx, à supprimer
```

---

## Modèle de données (TypeScript)

```ts
interface GenealogyData {
  individuals: Map<string, Individual>;
  families:    Map<string, Family>;
  errors:      Array<{ line?: number; message: string }>;
}

interface Individual {
  id: string;                  // "@I1@"
  name: { given: string; surname: string; suffix?: string; display: string };
  sex: "M" | "F" | "U";
  birth: GEvent | null;
  death: GEvent | null;
  occupation: string;
  note: string;
  famc: string[];              // familles où cet individu est enfant
  fams: string[];              // familles où cet individu est conjoint
}

interface Family {
  id: string;                  // "@F1@"
  husband: string | null;
  wife:    string | null;
  children: string[];
  marriage: GEvent | null;
}

interface GEvent {
  date: { raw: string; year: number|null; month: number|null; day: number|null; display: string };
  place: string;
}
```

**Numérotation Sosa-Stradonitz** : racine = 1, père = 2N, mère = 2N+1, génération = floor(log2(sosa)).
**Numérotation d'Aboville** : `descendance.js → Descendance.computeAboville`.

---

## Design system / tokens CSS

Les tokens sont des variables CSS déclarées dans `Genealogor.html` (à extraire vers `src/styles/tokens.css`).
Le thème bascule via `data-theme` sur `<html>`.

### Couleurs (light → dark)
```css
/* Light */
--bg:            oklch(0.995 0.003 250)   /* fond principal */
--surface:       oklch(0.975 0.004 250)   /* cartes/inputs */
--surface-hover: oklch(0.955 0.005 250)
--border:        oklch(0.91 0.006 250)
--border-strong: oklch(0.82 0.008 250)
--ink:           oklch(0.18 0.012 260)    /* texte principal */
--ink-muted:     oklch(0.42 0.01 260)
--ink-faint:     oklch(0.6 0.008 260)
--accent:        oklch(0.55 0.14 265)     /* indigo */
--accent-soft:   oklch(0.95 0.025 265)
--sex-m:         oklch(0.6 0.1 230)       /* bleu */
--sex-f:         oklch(0.62 0.13 350)     /* rose */
--danger:        oklch(0.55 0.18 25)
--warn:          oklch(0.62 0.13 70)
--success:       oklch(0.58 0.13 145)

/* Dark : voir Genealogor.html l.43-58 */
```

### Typographie
- **UI** : Inter 400/500/600/700 (Google Fonts)
- **Mono** : JetBrains Mono 400/500 (labels, dates, méta)
- **Serif** : Iowan Old Style / Palatino / Georgia (livre PDF uniquement)
- Base mobile : 14px body ; jamais < 10px pour le mono.

### Keyframes à extraire
`sheetUp` · `spin` · `shimmer` · `starPop` · `slideFromRight` · `slideFromLeft` · `fadeIn` ·
`tabFadeSlide`. Easing iOS : `cubic-bezier(0.32, 0.72, 0, 1)`.

### Règles de forme
- Rayons : `rounded-md` cartes, `rounded-full` chips/boutons, `rounded-xl` / 28px sheets.
- Cibles tactiles mobile : ≥ 44px (classe `.touch-target`, `h-11` sur inputs).
- Paddings responsives : `px-4 sm:px-6`.

---

## Comportements clés à reproduire

- **Split-pane desktop** : `[liste | détail + tab-bar]`, colonne unique sur mobile < 768px.
- **Bottom-nav mobile** : 4 onglets primaires + feuille « Plus » (favoris/récents/secondaires).
- **Transitions** : slide right/left entre liste↔détail, swipe-back depuis bord gauche, `tabFadeSlide` entre onglets.
- **Permalink stable** : URL encode `person`, `tab`, `q`, `fav`, `ft`, `adv` — restauré au chargement.
- **Favoris & récents** : localStorage via `MUI.useFavorites` / `MUI.useRecentlyViewed`.
- **Long-press / clic droit** → menu contextuel (favori, profil, comparer, copier lien, exporter JSON, partager).
- **Masque vivants** (`Privacy`) : `filter: blur` sur personnes sans date de décès nées après `année-100`. Hover pour révéler.
- **Haptique** : `MUI.haptic(level)` (Vibration API) sur pull-to-refresh, long-press, actions destructives.
- **Citations par fait** : badge 📎 dans le profil selon `factKind` (birth/marriage/death/…).

---

## Fonctionnalités IA (toutes optionnelles)

- Recherche langage naturel FR → filtre JSON → appliqué localement.
- Vérification Wikipédia (opensearch FR + analyse plausibilité IA).
- OCR d'acte : image → champs structurés (modèle vision).
- Bio courte + récit familial long + suggestions de recherche + normalisation lieux + dédoublonnage sémantique.
- Tous les résultats IA mis en cache dans localStorage.
- Couche LLM (`AiCall` / `AiCallMultimodal`) route vers Claude, OpenRouter ou Ollama selon préférences.
- **En production** : déplacer les clés API côté serveur (fonction serverless).

---

## Pièges de migration

1. **Globaux `window.*`** : remplacer `(function(){ … window.X = … })()` par `export const X = …`.
2. **Ordre de chargement** : l'ordre des `<script>` dans `Genealogor.html` (l.192-238) reflète les dépendances — respecter cet ordre dans les imports ES.
3. **Couche LLM** : `AiCall` / `AiCallMultimodal` dans `settings-panel.jsx` → à sécuriser via serverless en prod.
4. **`history.jsx`** est déprécié — intégré dans `app.jsx`, **ne pas migrer**.
5. **Virtualisation** : pour arbres > 10k individus, virtualiser la liste (react-window) et mémoïser implexe et graphe.

---

## Priorités de migration

1. Setup Vite + React 18 + TypeScript + Tailwind v4 + vite-plugin-pwa
2. Extraire les tokens CSS → `src/styles/tokens.css`
3. Convertir les modules métier `.js` en ES modules (`src/lib/`)
4. Typer le modèle de données (`src/types/genealogy.ts`)
5. Implémenter le shell `App` avec state global + routing
6. Migrer les vues une par une (commencer par Profil, Ascendance, Descendants)
7. Intégrer Leaflet (react-leaflet) + D3 (npm)
8. PWA via vite-plugin-pwa
9. Tests unitaires sur les fonctions pures (parser, sérialiseurs, calendrier républicain, Sosa/Aboville)
10. Sécuriser la couche IA (serverless)
