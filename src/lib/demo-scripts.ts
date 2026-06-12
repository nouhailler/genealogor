// Demo scripts for the cinematic overlay (CinematicDemo.tsx) — pure data.
// TOUR_SCRIPT is the looping full-app tour; VIEW_DEMOS are short per-view
// guided demos played once from the tip bar or the help panel.
import type { TabId } from '@/types/genealogy';

export interface DemoCallbacks {
  navigateTo: (id: string) => void;
  setActiveTab: (tab: TabId) => void;
  getPersonIds: () => string[];
}

export interface Step {
  caption: string;
  target?: string;
  /** Position within the target rect as [fx, fy] fractions (default centre). */
  anchor?: [number, number];
  action?: (c: DemoCallbacks) => void;
  hold: number;
  click?: boolean;
}

// ── Full app tour ─────────────────────────────────────────────────────────────

export const TOUR_SCRIPT: Step[] = [
  {
    caption: 'Genealogor — explorez votre histoire familiale',
    hold: 2600,
  },
  {
    caption: 'Sélectionnez une personne dans la liste',
    target: '[data-demo-id="person-0"]',
    action: (c) => {
      const ids = c.getPersonIds();
      if (ids[0]) c.navigateTo(ids[0]);
      c.setActiveTab('profile');
    },
    hold: 2000,
    click: true,
  },
  {
    caption: 'Profil complet : naissance, décès, mariage, profession',
    target: '[data-demo-id="tab-profile"]',
    hold: 2600,
  },
  {
    caption: 'Arbre des ascendants — éventail, pedigree ou sablier',
    target: '[data-demo-id="tab-ancestors"]',
    action: (c) => c.setActiveTab('ancestors'),
    hold: 2500,
    click: true,
  },
  {
    caption: 'Descendants numérotés selon la méthode d\'Aboville',
    target: '[data-demo-id="tab-descendants"]',
    action: (c) => c.setActiveTab('descendants'),
    hold: 2500,
    click: true,
  },
  {
    caption: 'Graphe relationnel interactif — moteur d3-force',
    target: '[data-demo-id="tab-graph"]',
    action: (c) => c.setActiveTab('graph'),
    hold: 2500,
    click: true,
  },
  {
    caption: 'Frise chronologique de toute la famille',
    target: '[data-demo-id="tab-timeline"]',
    action: (c) => c.setActiveTab('timeline'),
    hold: 2200,
    click: true,
  },
  {
    caption: 'Carte des lieux — géocodage Nominatim',
    target: '[data-demo-id="tab-map"]',
    action: (c) => c.setActiveTab('map'),
    hold: 2200,
    click: true,
  },
  {
    caption: 'Statistiques et pyramide des âges de l\'arbre',
    target: '[data-demo-id="tab-stats"]',
    action: (c) => c.setActiveTab('stats'),
    hold: 2500,
    click: true,
  },
  {
    caption: 'Qualité : détection des incohérences et doublons',
    target: '[data-demo-id="tab-validation"]',
    action: (c) => c.setActiveTab('validation'),
    hold: 2200,
    click: true,
  },
  {
    caption: 'IA intégrée : biographies, OCR, recherche sémantique',
    target: '[data-demo-id="tab-ai"]',
    action: (c) => c.setActiveTab('ai'),
    hold: 2400,
    click: true,
  },
  {
    caption: 'Recherche instantanée dans toute la généalogie',
    target: '[data-demo-id="search-input"]',
    hold: 1800,
  },
  {
    caption: 'Passez à une autre personne et recommencez…',
    target: '[data-demo-id="person-1"]',
    action: (c) => {
      const ids = c.getPersonIds();
      const id = ids[1] ?? ids[0];
      if (id) c.navigateTo(id);
      c.setActiveTab('profile');
    },
    hold: 1600,
    click: true,
  },
];

// ── Per-view guided demos ─────────────────────────────────────────────────────
// Short non-looping scripts narrating the current view. Positions are anchored
// inside the view container (data-demo-id="view-container" in App.tsx).

const V = '[data-demo-id="view-container"]';

export const VIEW_DEMOS: Record<TabId, Step[]> = {
  profile: [
    { caption: 'Le profil regroupe l\'état civil : naissance, décès, profession, mariages', target: V, anchor: [0.5, 0.18], hold: 3000 },
    { caption: 'Cliquez une chip — parent, conjoint, enfant — pour naviguer de fiche en fiche', target: V, anchor: [0.38, 0.45], hold: 3200, click: true },
    { caption: '★ favori · partage du permalink · ✎ édition de la fiche', target: V, anchor: [0.82, 0.1], hold: 3000 },
    { caption: 'Photos & actes : attachez vos documents à un fait précis', target: V, anchor: [0.5, 0.78], hold: 3000 },
  ],
  ancestors: [
    { caption: 'Trois modes : éventail Sosa, pedigree et sablier — boutons en haut de la vue', target: V, anchor: [0.5, 0.08], hold: 3200, click: true },
    { caption: 'Sosa-Stradonitz : racine = 1, père = 2N, mère = 2N+1', target: V, anchor: [0.5, 0.5], hold: 3000 },
    { caption: 'Un point orange = ancêtre en implexe (plusieurs positions Sosa)', target: V, anchor: [0.62, 0.4], hold: 3000 },
    { caption: 'Cliquez un secteur pour ouvrir la fiche de cet ancêtre', target: V, anchor: [0.45, 0.35], hold: 2800, click: true },
  ],
  descendants: [
    { caption: 'La descendance se déplie branche par branche avec ▸', target: V, anchor: [0.3, 0.3], hold: 3000, click: true },
    { caption: 'Numérotation d\'Aboville : 1 → 1.1, 1.2 → 1.1.1…', target: V, anchor: [0.35, 0.45], hold: 3000 },
    { caption: '« Tout déplier / replier » bascule l\'arbre entier', target: V, anchor: [0.5, 0.08], hold: 2800 },
  ],
  implex: [
    { caption: 'Le taux d\'endogamie mesure les cases Sosa redondantes', target: V, anchor: [0.5, 0.15], hold: 3000 },
    { caption: 'Chaque ancêtre multi-occurrent est listé avec toutes ses positions', target: V, anchor: [0.5, 0.55], hold: 3200 },
    { caption: '1-5 % est ordinaire · 10 %+ signale des mariages entre cousins', target: V, anchor: [0.5, 0.35], hold: 3000 },
  ],
  compare: [
    { caption: 'Comparez la personne sélectionnée à une seconde, champ par champ', target: V, anchor: [0.5, 0.12], hold: 3000 },
    { caption: 'Recherchez la seconde personne dans ce champ', target: V, anchor: [0.7, 0.12], hold: 2800, click: true },
    { caption: 'Vert = identique · orange = divergent — utile avant une fusion', target: V, anchor: [0.5, 0.5], hold: 3200 },
  ],
  graph: [
    { caption: 'Tout l\'arbre comme un réseau — moteur d3-force', target: V, anchor: [0.5, 0.45], hold: 3000 },
    { caption: 'Molette = zoom · glisser le fond = déplacer · glisser un nœud = repositionner', target: V, anchor: [0.4, 0.55], hold: 3200 },
    { caption: 'Filtres Filiation / Mariages / Tout pour alléger le réseau', target: V, anchor: [0.5, 0.06], hold: 2800, click: true },
    { caption: 'Cliquez un nœud pour ouvrir la fiche correspondante', target: V, anchor: [0.6, 0.4], hold: 2800, click: true },
  ],
  timeline: [
    { caption: 'Tous les événements datés, regroupés par décennie', target: V, anchor: [0.5, 0.3], hold: 3000 },
    { caption: 'Filtrez : Naissances / Mariages / Décès', target: V, anchor: [0.5, 0.07], hold: 2800, click: true },
    { caption: 'Le contexte historique superpose Révolution, guerres…', target: V, anchor: [0.75, 0.07], hold: 3000 },
  ],
  places: [
    { caption: 'Chaque lieu unique avec sa fréquence d\'apparition', target: V, anchor: [0.4, 0.3], hold: 3000 },
    { caption: 'Cliquez un lieu pour voir qui y est né, marié ou décédé', target: V, anchor: [0.4, 0.45], hold: 2800, click: true },
    { caption: 'Variantes de graphie ? IA → Normalisation des lieux les regroupe', target: V, anchor: [0.5, 0.2], hold: 3000 },
  ],
  map: [
    { caption: 'Géocodage Nominatim + affichage OpenStreetMap', target: V, anchor: [0.5, 0.45], hold: 3000 },
    { caption: '4 modes : Points · Migrations · Heatmap · Patronymes', target: V, anchor: [0.5, 0.07], hold: 3000, click: true },
    { caption: 'Les flèches de migration relient naissance et décès', target: V, anchor: [0.55, 0.5], hold: 3000 },
  ],
  media: [
    { caption: 'Toutes les pièces jointes de l\'arbre, en un seul endroit', target: V, anchor: [0.5, 0.3], hold: 3000 },
    { caption: 'Stockage IndexedDB : local, quasi illimité, hors-ligne', target: V, anchor: [0.5, 0.5], hold: 3000 },
    { caption: 'Pour attacher une photo à une personne : section Photos de son profil', target: V, anchor: [0.5, 0.7], hold: 3200 },
  ],
  stats: [
    { caption: 'KPIs : individus, familles, espérance moyenne, enfants/famille', target: V, anchor: [0.5, 0.1], hold: 3000 },
    { caption: 'Histogrammes des naissances et décès par décennie', target: V, anchor: [0.4, 0.4], hold: 3000 },
    { caption: 'L\'espérance de vie par cohorte raconte l\'évolution de la famille', target: V, anchor: [0.5, 0.65], hold: 3200 },
  ],
  validation: [
    { caption: 'Trois contrôles : Incohérences · Complétude · Doublons', target: V, anchor: [0.4, 0.07], hold: 3000, click: true },
    { caption: 'Erreurs logiques détectées : dates impossibles, âges aberrants, cycles', target: V, anchor: [0.5, 0.4], hold: 3200 },
    { caption: 'Doublons : Levenshtein + analyse IA sémantique, fusion champ par champ', target: V, anchor: [0.5, 0.55], hold: 3200 },
  ],
  ai: [
    { caption: 'Le Lab IA nécessite un provider configuré dans les Paramètres ⚙', target: V, anchor: [0.5, 0.1], hold: 3000 },
    { caption: 'Recherche en langage naturel : une phrase → un filtre appliqué localement', target: V, anchor: [0.5, 0.3], hold: 3200 },
    { caption: 'Récit familial, vérification Wikipedia, suggestions de recherche…', target: V, anchor: [0.5, 0.55], hold: 3200 },
    { caption: 'Tous les résultats sont mis en cache localement', target: V, anchor: [0.5, 0.75], hold: 2600 },
  ],
};
