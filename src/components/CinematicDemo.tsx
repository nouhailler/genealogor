// Cinematic demo overlay — virtual cursor, ripple and captions driven by a
// step script. Scripts (full tour + per-view demos) live in @/lib/demo-scripts.
import { useState, useEffect, useRef } from 'react';
import { TOUR_SCRIPT } from '@/lib/demo-scripts';
import type { Step, DemoCallbacks } from '@/lib/demo-scripts';

interface Props {
  callbacks: DemoCallbacks;
  onStop: () => void;
  /** Custom step list — defaults to the full app tour. */
  script?: Step[];
  /** Loop forever (full tour) or stop after the last step (view demos). */
  loop?: boolean;
}

export function CinematicOverlay({ callbacks, onStop, script = TOUR_SCRIPT, loop = true }: Props) {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [caption, setCaption] = useState('');
  const [captionKey, setCaptionKey] = useState(0);
  const [rippleKey, setRippleKey] = useState(0);
  const [showRipple, setShowRipple] = useState(false);
  const cbRef = useRef(callbacks);
  useEffect(() => { cbRef.current = callbacks; }, [callbacks]);
  const onStopRef = useRef(onStop);
  useEffect(() => { onStopRef.current = onStop; }, [onStop]);

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
      const step = script[idx % script.length];

      setCaption(step.caption);
      setCaptionKey(k => k + 1);

      const el = step.target ? document.querySelector(step.target) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        const [fx, fy] = step.anchor ?? [0.5, 0.5];
        setPos({ x: r.left + r.width * fx, y: r.top + r.height * fy });
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
        later(() => {
          const next = idx + 1;
          if (next >= script.length && !loop) { onStopRef.current(); return; }
          run(next % script.length);
        }, step.hold);
      }, arrivalDelay);
    }

    later(() => run(0), 400);

    return () => {
      stopped = true;
      pending.forEach(clearTimeout);
    };
    // script/loop are fixed for the lifetime of one overlay mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
