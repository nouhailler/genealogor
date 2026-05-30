# Handoff : Genealogor — visualiseur GEDCOM offline-first

## Vue d'ensemble

**Genealogor** est une application web de visualisation et d'analyse d'arbres généalogiques.
L'utilisateur importe un fichier **GEDCOM** (`.ged`) ou **CSV**, et l'app affiche sa généalogie
à travers **13 vues** (profil, ascendance en éventail/pedigree/sablier, descendance, frise
chronologique, carte géographique, statistiques, graphe relationnel, comparateur, implications,
validation qualité, médias, laboratoire IA).

Tout est **100 % local** : aucune donnée n'est envoyée sur un serveur (sauf appels IA explicitement
configurés par l'utilisateur et le géocodage de carte via Nominatim). L'app est **installable en PWA**
et **fonctionne hors-ligne**.

Cible : généalogistes francophones (interface en français, spécificités françaises : calendrier
républicain, départements INSEE, archives départementales).

---

## À propos des fichiers de ce bundle

⚠️ **Les fichiers de ce bundle sont un prototype fonctionnel écrit en HTML + React via Babel in-browser.**
Ce ne sont **pas** des fichiers de production prêts à déployer tels quels. Ils servent de **référence
exhaustive du comportement et du design attendus**.

La tâche pour Claude Code : **recréer cette application dans un vrai environnement de build**
(recommandé : **Vite + React + TypeScript**), en réutilisant la logique métier (les fichiers `.js`
purs sont déjà quasi production-ready) et en réimplémentant les vues `.jsx` comme de vrais composants
React modulaires. Si vous préférez un autre framework (Next.js, SvelteKit…), adaptez — mais React est
le choix le plus direct puisque le prototype est déjà en React.

Le prototype est **fidélité haute (hi-fi)** : couleurs, typographie, espacements et interactions sont
définitifs. Reproduisez-les fidèlement.

---

## Démarrer le prototype localement

Aucun build n'est nécessaire pour *voir* le prototype — il suffit de servir le dossier :

```bash
cd prototype/
python3 -m http.server 8000
# ouvrir http://localhost:8000/Genealogor.html
```

Au premier lancement sans fichier, un bouton « charger des données d'exemple » utilise `sample.ged.js`.

---

## Stack actuelle du prototype (à remplacer)

| Aspect | Prototype | Cible recommandée |
|---|---|---|
| Rendu | React 18 UMD + Babel Standalone (in-browser, `type="text/babel"`) | Vite + React 18 + TS, JSX compilé |
| Styles | Tailwind via CDN + variables CSS dans `<style>` | Tailwind en build (PostCSS) + le même fichier de tokens CSS |
| Modules | Globaux sur `window.*` (pas d'imports ES) | Imports/exports ES modules |
| State | `useState`/`useMemo` dans un gros `App()` | Idem, ou Zustand/Context si besoin |
| Persistance | `localStorage` + `IndexedDB` (pièces jointes) | Idem |
| Cartes | Leaflet via CDN | `react-leaflet` ou Leaflet npm |
| Graphe | d3-force via CDN | `d3` npm |
| PWA | `sw.js` manuel + `manifest.webmanifest` | `vite-plugin-pwa` (Workbox) |

### ⚠️ Pièges de migration (important)

1. **Globaux `window.*`** : chaque module du prototype s'attache à `window` (ex. `window.GedcomParser`,
   `window.AiFeatures`, `window.MUI`, `window.Privacy`). En migrant, convertissez-les en modules ES
   avec `export`/`import`. La logique métier dans les `.js` purs (parser, sérialiseurs, calendrier,
   gazetteer, implex, descendance) est **portable telle quelle** — il suffit de remplacer
   l'`(function(){ … window.X = … })()` par des `export`.
2. **Pas de collision de noms de styles** : non applicable hors prototype, mais notez que plusieurs
   composants partagent le scope global ici.
3. **Ordre de chargement** : dans le prototype, l'ordre des `<script>` dans `Genealogor.html` (lignes
   ~191-238) reflète les dépendances. Les `.js` métier se chargent avant les `.jsx` de vue.
4. **`window.AiCall` / `window.AiCallMultimodal`** (dans `settings-panel.jsx`) sont la couche
   d'abstraction LLM : ils routent vers Claude (`window.claude.complete`), OpenRouter, ou Ollama selon
   les réglages utilisateur. En production, remplacez par vos propres endpoints (idéalement une
   fonction serverless qui garde les clés API côté serveur).

---

## Modèle de données (cœur du système)

Le parser (`gedcom-parser.js → window.GedcomParser.parse(text)`) retourne :

```ts
{
  individuals: Map<string, Individual>,   // clé = ID GEDCOM, ex. "@I1@"
  families:    Map<string, Family>,
  errors:      Array<{ line?: number, message: string }>
}

interface Individual {
  id: string;                  // "@I1@"
  name: { given: string; surname: string; suffix?: string; display: string };
  sex: "M" | "F" | "U";
  birth: GEvent | null;
  death: GEvent | null;
  occupation: string;
  note: string;
  famc: string[];              // IDs des familles où l'individu est ENFANT (parents)
  fams: string[];              // IDs des familles où l'individu est CONJOINT
}

interface Family {
  id: string;                  // "@F1@"
  husband: string | null;      // ID individu
  wife: string | null;         // ID individu
  children: string[];          // IDs individus
  marriage: GEvent | null;
}

interface GEvent {
  date: { raw: string; year: number|null; month: number|null; day: number|null; display: string };
  place: string;
}
```

**Numérotation Sosa-Stradonitz** (ascendance) : la personne racine = 1, père = 2N, mère = 2N+1.
Génération = `floor(log2(sosa))`.
**Numérotation d'Aboville** (descendance) : calculée par `descendance.js → window.Descendance.computeAboville`.

---

## Architecture des fichiers

### Logique métier — `.js` purs (portables directement, aucune dépendance React)

| Fichier | Export global | Rôle |
|---|---|---|
| `gedcom-parser.js` | `GedcomParser.parse` | Parse un texte GEDCOM → `{individuals, families, errors}` |
| `gedcom-serializer.js` | `GedcomSerializer.{serialize,download,serialize7,download7}` | Export GEDCOM **5.5.1** et **7.0** |
| `csv-importer.js` | `CsvImporter` | Import CSV → même modèle de données |
| `fulltext-search.js` | `FullTextSearch.search` | Recherche plein-texte (notes, lieux, professions) |
| `implex.js` | `Implex.compute`, `Implex.isImplexedFor` | Calcul d'implexe / taux d'endogamie par génération |
| `descendance.js` | `Descendance.computeAboville` | Numérotation d'Aboville des descendants |
| `historical-events.js` | `HistoricalEvents` | Contexte historique pour la frise (Révolution, Empire…) |
| `republican-calendar.js` | `RepublicanCalendar` | Conversion grégorien ↔ républicain (1792-1805) |
| `place-gazetteer.js` | `PlaceGazetteer` | 101 départements INSEE + extraction depuis chaîne de lieu (longest-match) |
| `archives-templates.js` | `ArchivesTemplates.linksFor` | 97 URLs d'archives départementales + portails (Geneanet, Filae, FamilySearch…) |
| `privacy.js` | `Privacy`, `usePrivacy` | Masque « personnes vivantes » (floutage CSS conditionnel) |
| `family-book.js` | `FamilyBook.generate` | Génère un livre PDF (HTML imprimable, couverture + TOC + pages + index) |
| `attachment-store.js` | `AttachmentStore` | Pièces jointes en **IndexedDB** (+ `factKind` = citation par fait) |
| `sample.ged.js` | `SAMPLE_GED` | Jeu de données d'exemple |

### UI — `.jsx` (React, à réimplémenter en composants modulaires)

| Fichier | Composant(s) | Rôle |
|---|---|---|
| `app.jsx` | `App` | **Shell principal** : state global, header, split-pane liste/détail, permalink, bottom-nav mobile, modales |
| `ui-kit.jsx` | `Icon`, helpers | Icônes SVG + utilitaires partagés (`formatVital`, `sexLabel`…) |
| `auth-gate.jsx` | `AuthGate` | Porte d'authentification optionnelle (multi-utilisateur léger) |
| `upload-zone.jsx` | `UploadZone` | Drag-drop / sélection de fichier `.ged`/`.csv` |
| `profile-view.jsx` | `ProfileView`, `RepublicanBadge`, `ShortBioCaption`, `FactSourceBadge` | Fiche détaillée |
| `ancestors-view.jsx` | `AncestorsView`, `FanChart` | Ascendance : éventail Sosa + sélecteur de mode (éventail/pedigree/sablier) |
| `pedigree-chart.jsx` | `PedigreeChart` | Pedigree rectangulaire (jusqu'à 7 gén.) |
| `hourglass-chart.jsx` | `HourglassView` | Sablier : ancêtres (Sosa) + descendants (Aboville) |
| `descendants-view.jsx` | `DescendantsView` | Arbre descendant repliable |
| `implex-view.jsx` | `ImplexView` | Implications & endogamie |
| `compare-view.jsx` | `CompareView` | Comparateur de 2 fiches (table desktop / cartes mobile) |
| `force-graph.jsx` | `ForceGraphView` | Graphe relationnel d3-force |
| `timeline-view.jsx` | `TimelineView` | Frise chronologique par décennie |
| `places-view.jsx` | `PlacesView` | Nuage de lieux (schématique) |
| `geomap-view.jsx` | `GeoMapView` | Carte Leaflet : modes Points / Migrations animées / Heatmap décennale / Patronymes |
| `stats-view.jsx` | `StatsView` | Statistiques agrégées |
| `age-pyramid.jsx` | `AgePyramid` | Pyramide des âges (au décès / vivants) |
| `validation-view.jsx` | `ValidationView`, `runValidation` | Qualité : incohérences, **détection de cycles**, complétude, doublons |
| `ai-features.jsx` | `AiLabView`, `AiFeatures` | Lab IA : langage naturel, Wikipédia, suggestions, normalisation lieux, récit, OCR, bio courte |
| `advanced-features.jsx` | `AdvancedSearch`, export CSV/print | Recherche avancée (sheet mobile) + utilitaires export |
| `settings-panel.jsx` | `SettingsPanel`, `AiCall`, `AiCallMultimodal` | Réglages + **couche LLM** (Claude/OpenRouter/Ollama) |
| `bio-ai.jsx` | `BioAi` | Récit biographique long généré |
| `attachments-section.jsx` | `AttachmentsSection` | Galerie pièces jointes d'une personne |
| `attachment-detail.jsx` | `AttachmentDetail` | Modale pièce jointe + **OCR d'acte** + citation par fait |
| `media-store.jsx` | `MediaGallery` | Galerie médias globale |
| `merge-modal.jsx` | `GenealogorMerge`, modale fusion | Fusion de doublons |
| `business-card.jsx` | `BusinessCard` | Fiche imprimable A4 |
| `presentation-mode.jsx` | `PresentationMode` | Mode présentation plein écran |
| `help-panel.jsx` | `HelpPanel` | Aide contextuelle |
| `history.jsx` | (déprécié, intégré dans `app.jsx`) | **À supprimer en migration** |

### Mobile / PWA

| Fichier | Export | Rôle |
|---|---|---|
| `mobile-shell.jsx` | `MobileBottomNav`, `MobileMoreSheet`, `useIsMobile` | Bottom-nav 4 items + feuille « Plus » (favoris/récents/onglets secondaires) |
| `mobile-ui-kit.jsx` | `MUI.*` | Primitives mobiles : `Sheet`, `Segmented`, `PullToRefresh`, `Skeleton`, `haptic`, `useLongPress`, `useFavorites`, `useRecentlyViewed`, `useEdgeSwipeBack`, `useViewport` |
| `mobile-onboarding.jsx` | `MobileOnboarding.*` | Onboarding 3 écrans, bannière d'install PWA, `sharePerson` (Web Share API) |
| `sw.js` | — | Service worker offline (stale-while-revalidate shell, cache-first CDN, LRU tuiles) |
| `manifest.webmanifest` | — | Manifeste PWA |

---

## Design system / tokens

Tous les tokens sont des **variables CSS** définies dans `Genealogor.html` (bloc `<style>`,
sélecteurs `[data-theme="light"]` et `[data-theme="dark"]`). Le thème bascule via l'attribut
`data-theme` sur `<html>`.

### Couleurs (mode clair → sombre)
```
--bg            fond principal      #fafafa  → #16161a
--surface       cartes/inputs       #f4f4f5  → #1e1e24
--surface-hover survol              ...
--ink           texte principal     #1a1a1a  → #ededed
--ink-muted     texte secondaire
--ink-faint     texte tertiaire/mono
--border        bordures
--border-strong bordures appuyées
--accent        indigo  oklch(~0.55 0.18 280)
--accent-soft   accent transparent
--sex-m         bleu (hommes)
--sex-f         rose/rouge (femmes)
--danger        rouge       oklch(0.55 0.18 25) → oklch(0.7 0.16 25)
--warn          orange      oklch(0.62 0.13 70) → oklch(0.78 0.13 80)
--success       vert        oklch(0.58 0.13 145) → oklch(0.72 0.13 145)
```
> Astuce : beaucoup de teintes dérivées utilisent `color-mix(in oklch, var(--x) N%, transparent)`.

### Typographie
- **Sans-serif UI** : `Inter` (400/500/600/700) — via Google Fonts
- **Mono** (labels, dates, méta) : `JetBrains Mono` (400/500)
- **Serif** (livre PDF uniquement) : Iowan Old Style / Palatino / Georgia
- Échelle mobile : `body` 14px ; titres de vue `text-[17px] sm:text-xl` ; jamais < 10px pour le mono.

### Espacements & formes
- Rayons : `rounded-md` (cartes), `rounded-full` (chips/boutons tactiles), `rounded-xl`/`28px` (sheets).
- Cibles tactiles mobile : **≥ 44px** (classe `.touch-target`, hauteurs `h-11` sur inputs).
- Paddings responsives : `px-4 sm:px-6` partout.

### Keyframes (dans `Genealogor.html`)
`sheetUp`, `spin`, `shimmer` (skeletons), `starPop` (favoris), `slideFromRight`/`slideFromLeft`
(transitions de pane mobile), `tabFadeSlide` (changement d'onglet). Easing iOS : `cubic-bezier(0.32,0.72,0,1)`.

---

## Comportements & interactions clés

- **Layout responsive** : desktop = split-pane `[liste | détail+onglets]` + tab bar horizontale ;
  mobile (< 768px) = une seule colonne, bottom-nav (4 onglets primaires + « Plus »), transitions slide
  entre liste↔détail, swipe-back depuis le bord gauche, swipe horizontal entre onglets.
- **Permalink stable** : `app.jsx` encode dans l'URL `person`, `tab`, `q` (recherche), `fav`, `ft`
  (plein-texte), `adv` (filtres avancés JSON). Restauré au chargement → un lien partagé rouvre la vue exacte.
- **Favoris & récents** : `localStorage` via `MUI.useFavorites` / `MUI.useRecentlyViewed`. Étoile sur
  chaque ligne, filtre « Favoris », sections dans la feuille « Plus ».
- **Long-press / clic droit** sur une ligne → menu contextuel (favori, profil, comparer, copier lien,
  exporter JSON, partager).
- **Masque vivants** (`Privacy`) : floute (CSS `filter: blur`) noms+dates des personnes sans date de
  décès et nées après un seuil (défaut année-100). Hover pour révéler. Toggle dans le header.
- **Haptique** : `MUI.haptic(level)` (Vibration API) sur pull-to-refresh, long-press, actions destructives.
- **Citations par fait** : une pièce jointe porte un `factKind` (`birth`/`marriage`/`death`/…) ; des
  badges 📎 apparaissent à côté du fait correspondant dans le profil.

### IA (toutes optionnelles, dégradent proprement si non configurées)
- **Recherche en langage naturel** : phrase FR → filtre JSON (`AiFeatures.naturalQuery`) → appliqué
  localement (`AiFeatures.applyQuery`, connaît 7 régions françaises).
- **Vérification Wikipédia** : API opensearch FR publique + analyse de plausibilité IA.
- **OCR d'acte** : image → champs structurés via `AiCallMultimodal` (modèle vision).
- **Bio courte** + **récit familial long** + **suggestions de recherche** + **normalisation de lieux** + **dédoublonnage sémantique**.
- Tous les résultats IA sont **mis en cache dans `localStorage`**.

---

## Ce qui reste à faire (suggestions pour Claude Code)

1. **Migrer vers Vite + React + TS** : convertir les globaux `window.*` en modules ES, typer le modèle
   de données (interfaces ci-dessus), compiler le JSX.
2. **Sécuriser la couche IA** : déplacer les clés API côté serveur (fonction serverless) au lieu de
   `localStorage`. Remplacer `AiCall`/`AiCallMultimodal`.
3. **Tests** : le parser GEDCOM, les sérialiseurs 5.5.1/7.0, la conversion républicaine, l'extraction
   de département et le calcul Sosa/Aboville sont des fonctions pures → cibles idéales de tests unitaires.
4. **Perf gros fichiers** : virtualiser la liste (react-window) pour les arbres de 10k+ individus ;
   mémoïser les calculs lourds (implexe, graphe).
5. **PWA propre** : `vite-plugin-pwa` (Workbox) au lieu du `sw.js` manuel.
6. **Supprimer `history.jsx`** (déprécié, déjà intégré dans `app.jsx`).
7. **Accessibilité** : audit clavier/ARIA des modales, sheets et du graphe.

---

## Dépendances externes (CDN dans le prototype)
- React 18 + ReactDOM (UMD) + Babel Standalone
- Tailwind CSS (CDN play)
- Leaflet 1.9.4 (carte) + tuiles OpenStreetMap
- d3-force (graphe)
- Google Fonts : Inter, JetBrains Mono
- APIs runtime : Nominatim (géocodage), Wikipedia FR (opensearch), + LLM configuré par l'utilisateur

## Fichiers
Tous les fichiers source du prototype sont dans `prototype/`. Point d'entrée : `prototype/Genealogor.html`
(l'ordre des `<script>` y documente les dépendances de chargement).

---

## Captures d'écran (`screenshots/`)

Aperçus des vues principales (desktop, mode clair) pour référence visuelle :

| Fichier | Vue |
|---|---|
| `01-accueil.png` | Écran d'accueil / import (drag-drop `.ged`/`.csv`) |
| `02-profil.png` | Fiche profil (vitals, profession, naissance/décès, mariage) |
| `03-ascendants.png` | Ascendance — éventail Sosa + sélecteur de mode (Éventail / Pedigree / Sablier) + nombre de générations |
| `04-descendants.png` | Arbre descendant repliable avec **numérotation d'Aboville** (1, 1.1, 1.1.1…) |
| `05-carte.png` | Carte géographique Leaflet (lieux géocodés, modes Points/Migrations/Heatmap/Patronymes) |
| `06-graphe.png` | Graphe relationnel d3-force |
| `07-frise.png` | Frise chronologique par décennie + contexte historique |
| `08-stats.png` | Statistiques agrégées (métriques, répartitions) |
| `09-qualite.png` | Validation qualité (incohérences, complétude, doublons) |
| `10-ia.png` | Laboratoire IA — onglet « Recherche en langage naturel » |

> Captures réalisées avec le jeu de données d'exemple (`sample.ged.js`, famille fictive Lefevre/Dubois).
> Le **mode sombre** existe aussi (toggle dans le header, via `data-theme="dark"`).
> Les vues **Implications**, **Comparer**, **Lieux**, **Médias**, ainsi que les variantes **Pedigree** et
> **Sablier** de l'ascendance, ne sont pas illustrées ici mais suivent le même langage visuel — voir le prototype.

---

## Configuration développement (Vite + React + TypeScript)

Ce projet utilise Vite avec React et TypeScript. Deux plugins officiels sont disponibles :

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) — utilise [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) — utilise SWC (plus rapide)

### React Compiler

Le React Compiler n'est pas activé par défaut (impact sur les performances de dev/build).
Pour l'activer : voir la [documentation officielle](https://react.dev/learn/react-compiler/installation).

### Configuration ESLint (règles TypeScript typées)

Pour une application en production, activer les règles lint type-aware dans `eslint.config.js` :

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      // ou pour des règles plus strictes :
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

Plugins React recommandés :

```js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      reactX.configs['recommended-typescript'],
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```
