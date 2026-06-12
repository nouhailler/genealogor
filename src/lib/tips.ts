// Per-view tips content and hidden-state persistence (localStorage-backed).
// Tip strings support the minimal inline markdown of renderInlineMd (**bold**, `code`).
import { useState, useCallback } from 'react';
import type { TabId } from '@/types/genealogy';

export const TIPS: Record<TabId, string[]> = {
  profile: [
    'Cliquez une **chip de relation** (parent, conjoint, enfant, fratrie) pour naviguer de fiche en fiche. Alt+← / Alt+→ pour revenir.',
    'Le crayon ✎ ouvre l\'**édition de la fiche** : nom, sexe, dates, lieu, profession, note. Tout est re-sérialisé en GEDCOM.',
    '★ met la personne en **favori** — retrouvez-la via le filtre ★ au-dessus de la liste.',
    'Le bouton **partager** copie un permalink : la personne et l\'onglet courants sont encodés dans l\'URL.',
    'Attachez photos et actes à un **fait précis** (naissance, mariage, décès…) dans la section Photos & Actes.',
  ],
  ancestors: [
    'Trois représentations : **éventail Sosa**, **pedigree** et **sablier** — basculez avec les boutons en haut de la vue.',
    'Numérotation **Sosa-Stradonitz** : la racine porte le n°1, le père d\'un N est 2N, sa mère 2N+1.',
    'Un **point orange** signale un ancêtre présent à plusieurs positions Sosa (implexe) — analyse détaillée dans l\'onglet Implications.',
    'Cliquez un secteur de l\'éventail pour **ouvrir la fiche** de cet ancêtre.',
  ],
  descendants: [
    'Cliquez **▸** pour déplier une branche, ou « tout déplier / replier » pour basculer l\'arbre entier.',
    'La numérotation **d\'Aboville** code la filiation : racine = 1, enfants = 1.1, 1.2…, petits-enfants = 1.1.1…',
    'Les enfants sont **triés par année de naissance** ; cliquez un nom pour ouvrir sa fiche.',
  ],
  implex: [
    'Le **taux d\'endogamie** = cases Sosa redondantes / cases occupées. 1-5 % est ordinaire, 10 %+ est marqué.',
    'Chaque ancêtre **multi-occurrent** est listé avec toutes ses positions Sosa — typique des mariages entre cousins.',
    'Un implexe élevé concentre l\'arbre : moins d\'ancêtres distincts que de cases théoriques.',
  ],
  compare: [
    'Recherchez une **seconde personne** dans le champ du comparateur pour l\'opposer à la personne sélectionnée.',
    '**Vert** = champs identiques · **orange** = divergents · neutre = vides. Pratique avant une fusion de doublons.',
    'Pour fusionner réellement deux fiches, passez par l\'onglet **Qualité → Doublons**.',
  ],
  graph: [
    '**Molette** = zoom · **glisser le fond** = déplacer · **glisser un nœud** = repositionner · **clic** = ouvrir la fiche.',
    'Filtres **Filiation / Mariages / Tout** pour alléger le réseau ; la taille d\'un nœud suit son nombre de mariages.',
    'Bleu = homme, magenta = femme — les couleurs suivent les tokens `--sex-m` / `--sex-f` du thème.',
  ],
  timeline: [
    'Filtrez par type : **Naissances / Mariages / Décès** — ou affichez tout, regroupé par décennie.',
    'Activez le **contexte historique** pour superposer Révolution, guerres et grands événements français.',
    'Cliquez un événement pour **ouvrir la fiche** de la personne concernée.',
  ],
  places: [
    'Les lieux sont listés avec leur **fréquence** — cliquez pour voir qui y est né, marié ou décédé.',
    'Variantes de graphie (« Paris », « Paris (Seine) »…) ? Utilisez **IA → Normalisation des lieux** pour les regrouper.',
    'Les **départements INSEE** sont reconnus et liés aux archives départementales correspondantes.',
  ],
  map: [
    'Quatre modes : **Points** · **Migrations** · **Heatmap** par décennie · **Patronymes** colorés.',
    'Le géocodage passe par **Nominatim** (1 requête/seconde) et le résultat est mis en cache localement.',
    'Les flèches de **migration** relient lieu de naissance et lieu de décès d\'une même personne.',
  ],
  media: [
    'Les fichiers locaux sont stockés dans **IndexedDB** — quasi illimité et 100 % hors-ligne.',
    'Pour attacher une photo à une personne, passez par la section **Photos & Actes de son profil**.',
    'Chaque pièce peut être liée à un **fait précis** (naissance, mariage, décès) et commentée.',
  ],
  stats: [
    'L\'**espérance de vie par cohorte** est la statistique la plus parlante sur l\'évolution d\'une famille.',
    'Les **branches mortes** listent les personnes nées après 1700 sans descendance enregistrée.',
    'Histogrammes par **décennie**, top patronymes/prénoms et records (longévité, fratries…).',
  ],
  validation: [
    'Trois sous-onglets : **Incohérences** (dates, âges, cycles) · **Complétude** · **Doublons**.',
    'La détection de doublons combine **Levenshtein** et **analyse IA sémantique** (provider requis).',
    'La fusion se fait **champ par champ** ; le plan de fusion est exportable en JSON.',
    'Les paires marquées « **pas un doublon** » sont mémorisées et ne réapparaissent plus.',
  ],
  ai: [
    'Configurez d\'abord un **provider** dans les Paramètres (⚙) : Claude, OpenAI, OpenRouter ou Ollama.',
    'La **recherche en langage naturel** transforme une phrase française en filtre appliqué localement.',
    'Le **récit familial** retrace une lignée ascendante sur 4 générations en 8-12 phrases.',
    'Tous les résultats IA sont **mis en cache** localement — pas de double facturation.',
  ],
};

const HIDDEN_KEY = 'genealogor.tipsHidden';

function readHidden(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '{}'); } catch { return {}; }
}

/** Per-view tip-bar visibility, persisted across sessions. */
export function useHiddenTips() {
  const [hidden, setHidden] = useState<Record<string, boolean>>(readHidden);

  const hide = useCallback((tab: TabId) => {
    setHidden((prev) => {
      const next = { ...prev, [tab]: true };
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setHidden({});
    try { localStorage.removeItem(HIDDEN_KEY); } catch { /* ignore */ }
  }, []);

  return { hidden, hide, resetAll };
}
