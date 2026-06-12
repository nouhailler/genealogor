// Contextual help panel — content keyed by the current view.
import { Fragment } from 'react';
import { Icon } from '@/components/ui-kit';
import type { TabId } from '@/types/genealogy';

// ── Help content ──────────────────────────────────────────────────────────────

type HelpKey = TabId | 'home';

interface HelpSection {
  heading: string;
  body: string[];
  important?: boolean;
}

interface HelpContent {
  title: string;
  intro?: string;
  sections: HelpSection[];
}

const HELP: Record<string, HelpContent> = {
  home: {
    title: 'Bienvenue dans Genealogor',
    intro: 'Importez un fichier GEDCOM (ou CSV) pour commencer à explorer votre arbre généalogique.',
    sections: [
      {
        heading: '⚙️ Configurez l\'IA dès maintenant',
        important: true,
        body: [
          'Genealogor fonctionne **beaucoup mieux avec l\'IA activée**. Avant de charger votre fichier, ouvrez les Paramètres (⚙ en haut à droite) et choisissez un provider :',
          '• **Claude (intégré)** — par défaut dans cet environnement, aucune config requise.',
          '• **Ollama (local)** — gratuit et privé, mais nécessite Ollama installé sur votre machine.',
          '• **OpenRouter** — clé API gratuite, accès à de nombreux modèles `:free` (Llama, Mistral, Gemma, etc.).',
          'Sans IA : parsing, visualisation et détection algorithmique de doublons. **Avec IA** : biographies, détection sémantique de doublons, suggestions de recherche, normalisation des lieux, récits multi-générations.',
        ],
      },
      {
        heading: 'Comment commencer',
        body: [
          '1. Glissez-déposez votre fichier `.ged` (ou `.csv`) dans la zone d\'accueil, ou cliquez « Charger l\'exemple » pour une démo.',
          '2. Vous pouvez importer plusieurs fichiers — ils seront fusionnés avec préfixage des IDs.',
          '3. Vos données restent **100% locales** dans votre navigateur (IndexedDB). Rien n\'est envoyé sur un serveur sauf les appels IA.',
        ],
      },
      {
        heading: 'Formats supportés',
        body: [
          '**GEDCOM 5.5 / 5.5.1** — standard d\'export de Heredis, Gramps, MyHeritage, Ancestry, FamilySearch.',
          '**CSV** — colonnes minimales : `given, surname, sex, birthDate, birthPlace, deathDate, deathPlace, fatherId, motherId`. Équivalents FR acceptés.',
        ],
      },
    ],
  },

  profile: {
    title: 'Profil',
    intro: 'Vue détaillée d\'une personne et de ses relations familiales.',
    sections: [
      {
        heading: 'Sections',
        body: [
          '• **Vital** : naissance, décès, profession, mariages.',
          '• **Relations** : parents, conjoints, enfants, fratrie. Cliquez sur une chip pour naviguer.',
          '• **Arbre ascendant 3 générations** : grand-parents et parents en un coup d\'œil.',
          '• **Photos & Actes** : pièces jointes locales ou cloud, avec descriptif et fil de commentaires.',
          '• **Frise personnelle** : événements de la vie avec calcul d\'âge.',
        ],
      },
    ],
  },

  ancestors: {
    title: 'Ascendants — éventail Sosa',
    intro: 'Visualisation circulaire des ancêtres selon la numérotation Sosa-Stradonitz.',
    sections: [
      {
        heading: 'Numérotation Sosa',
        body: [
          'La personne pivot porte le numéro **1**. Son père est **2**, sa mère **3**, ses grand-parents **4-5-6-7**, etc. Pour tout N : le père est 2N, la mère est 2N+1.',
        ],
      },
      {
        heading: 'Marqueurs d\'implication',
        body: [
          'Un point orange signale un ancêtre apparaissant à **plusieurs positions Sosa** — signe de mariages entre cousins. Analysez en détail dans l\'onglet **Implications**.',
        ],
      },
    ],
  },

  descendants: {
    title: 'Descendants',
    intro: 'Arbre dépliant de la descendance avec numérotation Aboville.',
    sections: [
      {
        heading: 'Numérotation Aboville',
        body: [
          'Système hiérarchique : racine = **1**, enfants = **1.1, 1.2…**, petits-enfants = **1.1.1, 1.1.2…**. Triés par année de naissance.',
        ],
      },
      {
        heading: 'Navigation',
        body: [
          '• Cliquez ▸ pour déplier un nœud.',
          '• Utilisez « tout déplier » / « tout replier » pour basculer l\'arbre entier.',
        ],
      },
    ],
  },

  implex: {
    title: 'Implications & endogamie',
    intro: 'Analyse des ancêtres en multi-occurrence et calcul du taux de consanguinité.',
    sections: [
      {
        heading: 'Qu\'est-ce qu\'une implication ?',
        body: [
          'Quand un ancêtre apparaît à **plusieurs positions Sosa différentes**, on parle d\'implication. Signe de mariages entre cousins ou entre personnes du même village.',
        ],
      },
      {
        heading: 'Taux d\'endogamie',
        body: [
          '**Taux global** = (cases redondantes / cases occupées) × 100.',
          '• 0% = lignées totalement distinctes · 1-5% = ordinaire · 10%+ = marquée.',
        ],
      },
    ],
  },

  compare: {
    title: 'Comparateur',
    intro: 'Compare deux personnes côte à côte champ par champ.',
    sections: [
      {
        heading: 'Usage',
        body: [
          '1. Sélectionnez une personne dans la liste.',
          '2. Recherchez une seconde personne dans le comparateur.',
          '3. **Vert** = champs identiques · **Orange** = champs divergents · Neutre = vides.',
        ],
      },
    ],
  },

  graph: {
    title: 'Graphe relationnel',
    intro: 'Vue force-directed (D3) de tout votre arbre comme un réseau.',
    sections: [
      {
        heading: 'Interactions',
        body: [
          '• **Molette** = zoom · **Glisser le fond** = pan · **Glisser un nœud** = repositionner · **Clic** = ouvrir profil.',
        ],
      },
      {
        heading: 'Lecture visuelle',
        body: [
          '• **Couleur** : bleu = homme, magenta = femme.',
          '• **Taille** : proportionnelle au nombre de mariages.',
          '• **Filtres** : Filiation / Mariages / Tout.',
        ],
      },
    ],
  },

  timeline: {
    title: 'Frise chronologique',
    intro: 'Tous les événements datés regroupés par décennie.',
    sections: [
      {
        heading: 'Filtres & contexte',
        body: [
          '• **Tous / Naissances / Mariages / Décès** : restreint le type d\'événements.',
          '• **Contexte historique** : superpose les grands événements français (Révolution, guerres…).',
        ],
      },
    ],
  },

  places: {
    title: 'Lieux',
    intro: 'Liste des lieux uniques avec leur fréquence.',
    sections: [
      {
        heading: 'Normalisation',
        body: [
          'Si « Paris », « Paris (Seine) », « 75014 » sont des entrées distinctes, utilisez **IA → Normalisation des lieux** pour les regrouper.',
        ],
      },
    ],
  },

  map: {
    title: 'Carte géographique',
    intro: 'Géocodage et affichage sur OpenStreetMap (Leaflet).',
    sections: [
      {
        heading: 'Fonctionnement',
        body: [
          'Chaque lieu est géocodé via **Nominatim** (1 requête/seconde). Le résultat est **mis en cache localStorage**.',
          '4 modes : **Points** · **Migrations** · **Heatmap** décennale · **Patronymes** colorés.',
        ],
      },
    ],
  },

  media: {
    title: 'Médias',
    intro: 'Vue d\'ensemble de toutes les pièces jointes.',
    sections: [
      {
        heading: 'Stockage',
        body: [
          'Les fichiers locaux sont dans **IndexedDB** (quasi illimité). Les fichiers cloud sont de simples URLs externes.',
          'Pour attacher une photo à une personne spécifique, utilisez la section **Photos** de son profil.',
        ],
      },
    ],
  },

  stats: {
    title: 'Statistiques',
    intro: 'Vue d\'ensemble quantitative de votre arbre.',
    sections: [
      {
        heading: 'Sections',
        body: [
          '• **KPIs** : individus, familles, espérance moyenne, enfants/famille.',
          '• **Histogrammes** par décennie (naissances, décès).',
          '• **Top patronymes/prénoms** · **Records** · **Branches mortes** (nés après 1700 sans descendance).',
          '• **Espérance de vie par cohorte** : la stat la plus parlante pour comprendre l\'évolution sociale d\'une famille.',
        ],
      },
    ],
  },

  validation: {
    title: 'Qualité des données',
    intro: 'Détection automatique d\'incohérences, complétude et doublons.',
    sections: [
      {
        heading: 'Sous-onglets',
        body: [
          '• **Incohérences** : erreurs logiques (dates, âges, cycles).',
          '• **Complétude** : barres de progression par champ.',
          '• **Doublons** : algorithme Levenshtein + **analyse IA sémantique** (nécessite provider actif). Fusion champ par champ, plan JSON exportable.',
        ],
      },
    ],
  },

  ai: {
    title: 'Laboratoire IA',
    intro: 'Nécessite un provider configuré dans les Paramètres.',
    sections: [
      {
        heading: '⚠️ Configuration préalable',
        important: true,
        body: [
          'Ouvrez les **Paramètres (⚙)** et choisissez un provider : Claude, Ollama ou OpenRouter. Sans configuration, les fonctions IA échoueront.',
        ],
      },
      {
        heading: 'Fonctionnalités',
        body: [
          '• **Recherche NL** : phrase FR → filtre structuré appliqué localement.',
          '• **Suggestions** : les 5 fiches incomplètes les plus prometteuses à rechercher.',
          '• **Normalisation lieux** : regroupe les variantes de graphie.',
          '• **Récit familial** : 8-12 phrases retraçant une lignée ascendante sur 4 générations.',
          '• **Wikipédia** : recherche + analyse de plausibilité historique.',
          '• **Archives** : liens vers les archives départementales et portails généalogiques.',
        ],
      },
    ],
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  activeTab: TabId | null;
  dataLoaded: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  /** Launch the guided demo of the current view. */
  onStartDemo?: () => void;
  /** Re-show all dismissed tip bars. */
  onResetTips?: () => void;
}

export default function HelpPanel({ activeTab, dataLoaded, onClose, onOpenSettings, onStartDemo, onResetTips }: Props) {
  const key: HelpKey = !dataLoaded ? 'home' : (activeTab ?? 'profile');
  const content = HELP[key] ?? HELP.home;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg)] rounded-lg border border-[var(--border)] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Icon.Help className="size-4 text-[var(--accent)] shrink-0" />
            <div className="min-w-0">
              <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">Aide contextuelle</div>
              <h3 className="text-base font-semibold text-[var(--ink)] truncate">{content.title}</h3>
            </div>
          </div>
          <button onClick={onClose}
            className="size-8 grid place-items-center rounded-md text-[var(--ink-faint)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]">
            <Icon.X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {content.intro && (
            <p className="text-sm text-[var(--ink-muted)] leading-relaxed">{renderInline(content.intro)}</p>
          )}
          {content.sections.map((sec, i) => (
            <section key={i}
              className={`rounded-md p-4 ${sec.important ? 'border border-[var(--accent)] bg-[color:var(--accent)]/5' : 'border border-[var(--border)] bg-[var(--surface)]'}`}>
              <h4 className="text-sm font-medium text-[var(--ink)] mb-2">{sec.heading}</h4>
              <div className="space-y-2 text-sm text-[var(--ink-muted)] leading-relaxed">
                {sec.body.map((line, j) => <p key={j}>{renderInline(line)}</p>)}
              </div>
              {sec.important && (
                <button onClick={() => { onClose(); onOpenSettings(); }}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90">
                  <Icon.Settings className="size-3.5" /> Ouvrir les Paramètres
                </button>
              )}
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between gap-3 text-[11px] font-mono text-[var(--ink-faint)]">
          <span className="hidden sm:block">Raccourci : <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)]">?</kbd> pour ouvrir l'aide</span>
          <div className="flex items-center gap-2 ml-auto">
            {onResetTips && (
              <button onClick={onResetTips}
                className="text-xs font-mono px-3 py-1.5 rounded border border-[var(--border)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                title="Réafficher les bandeaux d'astuces masqués">
                💡 Réafficher les astuces
              </button>
            )}
            {onStartDemo && dataLoaded && (
              <button onClick={() => { onClose(); onStartDemo(); }}
                className="text-xs font-mono px-3 py-1.5 rounded border border-[var(--border)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                title="Démonstration guidée de la vue courante">
                ▶ Démo de cette vue
              </button>
            )}
            <button onClick={onClose}
              className="text-xs font-mono px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inline markdown renderer ──────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return <strong key={i} className="text-[var(--ink)]">{p.slice(2, -2)}</strong>;
    }
    if (/^`[^`]+`$/.test(p)) {
      return <code key={i} className="font-mono text-[var(--ink)] bg-[var(--surface)] px-1 py-0.5 rounded text-[0.9em]">{p.slice(1, -1)}</code>;
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}
