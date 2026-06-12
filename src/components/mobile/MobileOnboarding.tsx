// First-launch onboarding (4 slides — full-screen on mobile, centred card on
// desktop) and PWA install banner. The useOnboarding hook lives in @/lib/onboarding.
import { useState, useEffect, useRef } from 'react';
import { markOnboarded } from '@/lib/onboarding';

// ── Constants ─────────────────────────────────────────────────────────────────


interface Slide {
  key: string;
  accent: string;
  title: string;
  body: string;
  icon: (color: string) => React.ReactElement;
}

const SLIDES: Slide[] = [
  {
    key: 'import',
    accent: 'var(--accent)',
    title: 'Importez votre arbre',
    body: 'Glissez un fichier GEDCOM (.ged) ou CSV. Tout reste sur votre appareil — aucune donnée n\'est envoyée en ligne.',
    icon: (c) => (
      <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    key: 'explore',
    accent: 'var(--sex-m, #2a6fdb)',
    title: 'Explorez chaque branche',
    body: 'Éventail Sosa, pedigree, sablier, frise, carte des migrations, statistiques… 13 vues pour parcourir votre généalogie.',
    icon: (c) => (
      <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <circle cx="19" cy="19" r="2" />
        <path d="M12 7v4M12 11l-6 6M12 11l6 6" />
      </svg>
    ),
  },
  {
    key: 'ai',
    accent: 'var(--warn, #c98a00)',
    title: 'Assistance intelligente',
    body: 'Recherche en langage naturel, lecture d\'actes scannés, vérification historique et récits familiaux générés par IA.',
    icon: (c) => (
      <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z" />
        <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
      </svg>
    ),
  },
  {
    key: 'guide',
    accent: 'var(--success, #1a9e5c)',
    title: 'Guidé à chaque écran',
    body: 'Chaque vue propose une astuce 💡, une aide contextuelle (touche ?) et une démo guidée ▶ pour découvrir toutes ses fonctions à votre rythme.',
    icon: (c) => (
      <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

// ── Onboarding ────────────────────────────────────────────────────────────────

interface OnboardingProps {
  onDone: () => void;
}

export function Onboarding({ onDone }: OnboardingProps) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i];
  const touchStart = useRef<number | null>(null);

  const finish = () => {
    markOnboarded();
    onDone();
  };

  const next = () => { if (last) return finish(); setI((v) => v + 1); };

  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (dx < -50 && !last) setI((v) => v + 1);
    else if (dx > 50 && i > 0) setI((v) => v - 1);
    touchStart.current = null;
  };

  // Desktop: arrows / Enter to advance, Escape to skip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); setI((v) => v - 1); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col sm:items-center sm:justify-center"
      style={{ background: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex flex-col flex-1 w-full sm:flex-none sm:w-[26rem] sm:min-h-[30rem] sm:rounded-2xl sm:border sm:border-[var(--border)] sm:bg-[var(--surface)] sm:shadow-2xl sm:pb-6">
        {/* Skip */}
        <div className="flex justify-end px-5 pt-4">
          {!last && (
            <button onClick={finish} className="text-[13px] font-medium text-[var(--ink-faint)] px-3 py-2 active:opacity-60 hover:text-[var(--ink)]">
              Passer
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 text-center">
          <div
            key={`icon-${slide.key}`}
            className="size-24 rounded-3xl grid place-items-center mb-8"
            style={{ background: `color-mix(in oklch, ${slide.accent} 14%, transparent)`, animation: 'tabFadeSlide 0.3s ease-out' }}
          >
            {slide.icon(slide.accent)}
          </div>
          <h2
            key={`title-${slide.key}`}
            className="text-2xl font-semibold tracking-tight text-[var(--ink)] mb-3"
            style={{ animation: 'tabFadeSlide 0.3s ease-out' }}
          >
            {slide.title}
          </h2>
          <p
            key={`body-${slide.key}`}
            className="text-[15px] leading-relaxed text-[var(--ink-muted)] max-w-sm"
            style={{ animation: 'tabFadeSlide 0.35s ease-out' }}
          >
            {slide.body}
          </p>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mb-6">
          {SLIDES.map((s, idx) => (
            <button
              key={s.key}
              onClick={() => setI(idx)}
              aria-label={`Écran ${idx + 1}`}
              style={{
                width: idx === i ? 24 : 8, height: 8, borderRadius: 999,
                background: idx === i ? 'var(--accent)' : 'var(--border-strong)',
                transition: 'all 0.25s ease-out',
              }}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="px-6">
          <button
            onClick={next}
            className="w-full h-12 rounded-full text-[15px] font-semibold active:opacity-80 hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            {last ? 'Commencer' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PWA install banner ────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallBanner() {
  const [canInstall, setCanInstall] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('genealogor.pwaDismissed') === '1'; } catch { return false; }
  });
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => { promptRef.current = null; setCanInstall(false); };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  const showBanner = (!dismissed && (canInstall || (isIOS && !isStandalone)));
  if (!showBanner) return null;

  const promptInstall = async () => {
    if (!promptRef.current) return;
    promptRef.current.prompt();
    await promptRef.current.userChoice;
    promptRef.current = null;
    setCanInstall(false);
  };

  const dismiss = () => {
    try { localStorage.setItem('genealogor.pwaDismissed', '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="fixed left-3 right-3 z-[150] rounded-xl shadow-lg flex items-center gap-3 px-4 py-3"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)', background: 'var(--bg)', border: '1px solid var(--border)', animation: 'sheetUp 0.3s ease-out' }}>
      <div className="size-10 rounded-lg grid place-items-center shrink-0" style={{ background: 'var(--accent-soft)' }}>
        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="var(--accent)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" /><polyline points="8 11 12 15 16 11" /><path d="M5 21h14" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-[var(--ink)]">Installer Genealogor</div>
        <div className="text-[11.5px] text-[var(--ink-muted)]">
          {isIOS ? 'Partager → « Sur l\'écran d\'accueil »' : 'Accès hors-ligne, plein écran'}
        </div>
      </div>
      {!isIOS && (
        <button onClick={() => void promptInstall()}
          className="shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold active:opacity-80"
          style={{ background: 'var(--ink)', color: 'var(--bg)' }}>
          Installer
        </button>
      )}
      <button onClick={dismiss} className="shrink-0 size-8 grid place-items-center rounded-full text-[var(--ink-faint)] active:bg-[var(--surface-hover)]" aria-label="Fermer">
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

