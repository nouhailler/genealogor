import { useState, useEffect, useRef } from 'react';
import type { TabId } from '@/types/genealogy';

export interface DemoCallbacks {
  navigateTo: (id: string) => void;
  setActiveTab: (tab: TabId) => void;
  getPersonIds: () => string[];
}

interface Step {
  caption: string;
  target?: string;
  action?: (c: DemoCallbacks) => void;
  hold: number;
  click?: boolean;
}

const SCRIPT: Step[] = [
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

interface Props {
  callbacks: DemoCallbacks;
  onStop: () => void;
}

export function CinematicOverlay({ callbacks, onStop }: Props) {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [caption, setCaption] = useState('');
  const [captionKey, setCaptionKey] = useState(0);
  const [rippleKey, setRippleKey] = useState(0);
  const [showRipple, setShowRipple] = useState(false);
  const cbRef = useRef(callbacks);
  useEffect(() => { cbRef.current = callbacks; }, [callbacks]);

  useEffect(() => {
    let stopped = false;
    const pending: ReturnType<typeof setTimeout>[] = [];

    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => { if (!stopped) fn(); }, ms);
      pending.push(id);
      return id;
    };

    function run(idx: number) {
      if (stopped) return;
      const step = SCRIPT[idx % SCRIPT.length];

      setCaption(step.caption);
      setCaptionKey(k => k + 1);

      if (step.target) {
        const el = document.querySelector(step.target);
        if (el) {
          const r = el.getBoundingClientRect();
          setPos({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        }
      } else {
        setPos({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
      }

      const arrivalDelay = step.target ? 680 : 150;

      later(() => {
        if (step.click) {
          setShowRipple(true);
          setRippleKey(k => k + 1);
          later(() => setShowRipple(false), 450);
        }
        step.action?.(cbRef.current);
        later(() => run((idx + 1) % SCRIPT.length), step.hold);
      }, arrivalDelay);
    }

    later(() => run(0), 400);

    return () => {
      stopped = true;
      pending.forEach(clearTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        @keyframes _demo_ripple {
          0%   { transform: scale(0.2); opacity: 0.9; }
          100% { transform: scale(3.8); opacity: 0;   }
        }
        @keyframes _demo_caption_in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0);   }
        }
        @keyframes _demo_cursor_pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(245,158,11,0.22), 0 2px 10px rgba(0,0,0,0.35); }
          50%       { box-shadow: 0 0 0 9px rgba(245,158,11,0.1),  0 2px 10px rgba(0,0,0,0.35); }
        }
      `}</style>

      {/* Virtual cursor */}
      <div
        style={{
          position: 'fixed',
          left: pos.x - 14,
          top: pos.y - 14,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'rgba(245,158,11,0.9)',
          border: '2px solid #f59e0b',
          animation: '_demo_cursor_pulse 2s ease-in-out infinite',
          transition: 'left 0.62s cubic-bezier(0.4,0,0.2,1), top 0.62s cubic-bezier(0.4,0,0.2,1)',
          pointerEvents: 'none',
          zIndex: 99997,
        }}
      />

      {/* Click ripple */}
      {showRipple && (
        <div
          key={rippleKey}
          style={{
            position: 'fixed',
            left: pos.x - 16,
            top: pos.y - 16,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2.5px solid rgba(245,158,11,0.75)',
            pointerEvents: 'none',
            zIndex: 99996,
            animation: '_demo_ripple 0.5s ease-out forwards',
          }}
        />
      )}

      {/* Caption bar */}
      <div
        key={captionKey}
        style={{
          position: 'fixed',
          bottom: 40,
          left: '50%',
          background: 'rgba(12,12,20,0.9)',
          color: '#fff',
          borderRadius: 12,
          padding: '11px 26px',
          fontSize: 14,
          fontWeight: 500,
          maxWidth: 'min(560px, 90vw)',
          textAlign: 'center',
          backdropFilter: 'blur(14px)',
          zIndex: 99998,
          pointerEvents: 'none',
          boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
          border: '1px solid rgba(245,158,11,0.28)',
          animation: '_demo_caption_in 0.32s ease-out forwards',
          letterSpacing: '0.012em',
          lineHeight: 1.5,
        }}
      >
        <span style={{ color: '#f59e0b', marginRight: 8, fontSize: 11 }}>◉</span>
        {caption}
      </div>

      {/* Stop button */}
      <button
        onClick={onStop}
        style={{
          position: 'fixed',
          top: 56,
          right: 14,
          background: 'rgba(12,12,20,0.88)',
          color: 'rgba(255,255,255,0.72)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          padding: '5px 13px',
          fontSize: 12,
          cursor: 'pointer',
          zIndex: 99999,
          backdropFilter: 'blur(10px)',
          letterSpacing: '0.03em',
        }}
      >
        ✕ Arrêter
      </button>
    </>
  );
}
