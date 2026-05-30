# CHANGELOG — Genealogor

Format : [SemVer](https://semver.org) · Dates ISO 8601

---

## [Unreleased] — Migration prototype → production (Vite + React + TypeScript)

### Ajouté
- `CONTEXT.md` : documentation technique de référence pour la migration
- `CHANGELOG.md` : ce fichier

### À faire
Voir `CONTEXT.md` § Priorités de migration pour la liste complète.

---

## [0.1.0-prototype] — 2026-05-29

### Description
Prototype haute-fidélité fonctionnel livré dans `prototype/`.
Sert de référence exhaustive du comportement et du design attendus.

### Contenu
- 13 vues : Profil · Ascendance (éventail/pedigree/sablier) · Descendance · Frise · Carte ·
  Statistiques · Graphe · Comparer · Implications · Validation · Médias · Lab IA
- Parser GEDCOM 5.5.1 + sérialiseurs 5.5.1 et 7.0
- Import CSV
- Numérotation Sosa-Stradonitz + d'Aboville
- Carte Leaflet (Points / Migrations / Heatmap / Patronymes)
- Graphe d3-force
- Frise chronologique avec contexte historique
- Calendrier républicain (1792-1805)
- Gazetteer 101 départements INSEE + 97 URLs archives départementales
- Lab IA : recherche NL · OCR · bio · récit · suggestions · normalisation lieux · dédoublonnage
- Couche LLM unifiée (Claude / OpenRouter / Ollama)
- Masque « personnes vivantes » (floutage CSS)
- Favoris + récents (localStorage)
- Permaliens stables (URL state)
- Bottom-nav mobile + transitions slide + swipe-back
- Onboarding PWA + bannière d'installation
- Service worker manuel (offline-first)
- Livre généalogique PDF (HTML imprimable)
- Galerie médias + OCR d'acte (IndexedDB)
- Fusion de doublons
- Fiche imprimable A4 (business card)
- Mode présentation plein écran
- Auth optionnelle multi-utilisateur

### Stack
- React 18 UMD + Babel Standalone (in-browser)
- Tailwind CSS CDN
- Leaflet 1.9.4 CDN
- D3 v7 CDN
- MiniSearch 7.1.0 CDN
- JSZip 3.10.1 CDN
