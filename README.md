# 🌳 Genealogor

> Visualiseur d'arbres généalogiques **offline-first** — importez un fichier GEDCOM ou CSV et explorez votre famille à travers 13 vues interactives.

[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/licence-MIT-green)](LICENSE)

---

## ✨ Fonctionnalités

| Vue | Description |
|-----|-------------|
| 👤 **Profil** | Fiche détaillée : vitaux, profession, famille, pièces jointes, biographie IA |
| 🌲 **Ascendants** | Éventail Sosa, pedigree rectangulaire (7 générations), sablier |
| 🔽 **Descendants** | Arbre repliable avec numérotation d'Aboville |
| ⏳ **Frise** | Chronologie par décennie avec contexte historique |
| 🗺️ **Carte** | Leaflet — Points · Migrations animées · Heatmap · Patronymes |
| 📊 **Statistiques** | Pyramide des âges, longévité, répartition, espérance de vie par cohorte |
| 🕸️ **Graphe** | Réseau relationnel d3-force interactif |
| ⚖️ **Comparer** | Deux fiches côte à côte |
| 🔁 **Implications** | Calcul d'implexe et taux d'endogamie par génération |
| ✅ **Qualité** | Validation : incohérences, cycles, complétude, doublons potentiels |
| 🖼️ **Médias** | Galerie de pièces jointes (IndexedDB) + OCR d'acte |
| 🤖 **IA** | Recherche en langage naturel · Wikipedia · bio · suggestions · normalisation de lieux |
| 📍 **Lieux** | Nuage de lieux géographiques |

### 🔒 Privacy-first

Aucune donnée ne quitte votre appareil — sauf les appels IA que *vous* configurez (Claude / OpenRouter / Ollama) et le géocodage via Nominatim. Les personnes probablement vivantes sont automatiquement floutées.

### 📱 PWA installable

L'application s'installe sur l'écran d'accueil iOS/Android et fonctionne **hors-ligne**. La session est restaurée automatiquement au relancement (fichier, personne sélectionnée, onglet actif).

---

## 🚀 Démarrage rapide

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev

# Build de production
npm run build

# Prévisualiser le build
npm run preview
```

Ouvrez `http://localhost:5173`, importez un fichier `.ged` ou `.csv`, ou utilisez les **données d'exemple** intégrées.

---

## 🏗️ Stack technique

| Aspect | Choix |
|--------|-------|
| Build | [Vite 8](https://vitejs.dev) |
| UI | [React 19](https://react.dev) + [TypeScript 6](https://www.typescriptlang.org) |
| Styles | [Tailwind CSS v4](https://tailwindcss.com) (plugin Vite) + variables CSS `oklch` |
| Carte | [react-leaflet](https://react-leaflet.js.org) + tuiles OpenStreetMap |
| Graphe | [D3 v7](https://d3js.org) (d3-force) |
| Recherche | [MiniSearch](https://lucaong.github.io/minisearch/) |
| PWA | [vite-plugin-pwa](https://vite-pwa-org.netlify.app) (Workbox) |
| Persistance | `localStorage` + `IndexedDB` (pièces jointes) |

---

## 📐 Architecture

```
src/
├── App.tsx                  # Shell principal — état global, routing par onglets
├── types/genealogy.ts       # Tous les types TypeScript (source de vérité)
├── lib/                     # Logique métier pure (sans React)
│   ├── gedcom-parser.ts     # Parse GEDCOM 5.5.1 → {individuals, families}
│   ├── gedcom-serializer.ts # Export GEDCOM 5.5.1 et 7.0
│   ├── csv-importer.ts      # Import CSV → même modèle de données
│   ├── implex.ts            # Calcul d'implexe (Sosa-Stradonitz)
│   ├── descendance.ts       # Numérotation d'Aboville
│   ├── republican-calendar.ts # Calendrier républicain (1792-1805)
│   ├── place-gazetteer.ts   # 101 départements INSEE
│   ├── archives-templates.ts # 97 URLs d'archives départementales
│   └── ...
├── components/
│   ├── views/               # 13 vues (une par onglet)
│   ├── mobile/              # MobileShell, MobileOnboarding
│   ├── media/               # AttachmentDetail, AttachmentsSection
│   └── ui-kit.tsx           # Icônes SVG + helpers partagés
└── styles/tokens.css        # Variables CSS oklch (light/dark)
```

### Modèle de données GEDCOM

```
📜 GenealogyData
├── individuals : Map<"@I1@", Individual>
│   ├── name · sex · birth · death · occupation · note
│   ├── famc[] → familles où il est enfant
│   └── fams[] → familles où il est conjoint
└── families : Map<"@F1@", Family>
    ├── husband · wife
    ├── children[]
    └── marriage
```

**Numérotation Sosa-Stradonitz** : racine = 1, père = 2n, mère = 2n+1.
**Numérotation d'Aboville** : descendants codés `"1"`, `"1.1"`, `"1.2.3"`…

---

## 🇫🇷 Spécificités françaises

- 📅 Calendrier républicain (1792–1805) affiché automatiquement
- 🏛️ 101 départements INSEE avec extraction automatique depuis les chaînes de lieux
- 📁 Liens directs vers 97 services d'archives départementales + Geneanet, Filae, FamilySearch

---

## ⌨️ Raccourcis clavier

| Touche | Action |
|--------|--------|
| `/` ou `Ctrl+K` | Focuser la barre de recherche |
| `Alt+←` / `Alt+→` | Navigation arrière / avant dans l'historique |
| `?` | Ouvrir l'aide |

---

## 🤖 Couche IA (optionnelle)

Configurez votre fournisseur dans **Paramètres** (icône ⚙️) :

- **Claude** (Anthropic) — clé API côté client
- **OpenRouter** — accès multi-modèles
- **Ollama** — modèle local, 100 % offline

Fonctions disponibles : recherche en langage naturel · vérification Wikipedia · OCR d'acte · biographie courte · récit familial · suggestions de recherche · normalisation de lieux · détection de doublons sémantiques. Tous les résultats sont mis en cache dans `localStorage`.

> ⚠️ En production, déplacez les clés API côté serveur (fonction serverless).

---

## 📋 Roadmap

- [ ] Tests unitaires (parser GEDCOM, calendrier républicain, Sosa/Aboville)
- [ ] Virtualisation de la liste pour les arbres > 10 000 individus
- [ ] Sécurisation de la couche IA via serverless
- [ ] Accessibilité (audit clavier/ARIA)

---

## 🗂️ Prototype de référence

Le dossier `prototype/` contient le prototype haute-fidélité original (React + Babel in-browser). Il sert de référence visuelle et comportementale. Pour le lancer :

```bash
cd prototype/
python3 -m http.server 8000
# → http://localhost:8000/Genealogor.html
```
