import { useState, useMemo, useEffect } from 'react';
import type { Individual, Family } from '@/types/genealogy';
import { computeAboville } from '@/lib/descendance';
import { formatVital } from '@/components/ui-kit';

// ── Sub-components ────────────────────────────────────────────────────────────

interface DescendantNodeProps {
  person: Individual | undefined;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  onNavigate: (id: string) => void;
  abovilleMap: Map<string, string> | null;
}

function DescendantNode({ person, individuals, families, depth: _depth, expanded, toggle, onNavigate, abovilleMap }: DescendantNodeProps) {
  if (!person) return null;
  const childIds: string[] = [];
  for (const fid of person.fams || []) {
    const fam = families.get(fid);
    if (!fam) continue;
    for (const cid of fam.children || []) childIds.push(cid);
  }
  const isOpen = expanded.has(person.id);
  const sexAccent = person.sex === 'F' ? 'var(--sex-f)' : person.sex === 'M' ? 'var(--sex-m)' : 'var(--ink-faint)';
  const hasChildren = childIds.length > 0;
  const aboville = abovilleMap?.get(person.id);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 py-1.5">
        {hasChildren ? (
          <button
            onClick={() => toggle(person.id)}
            className="size-7 sm:size-5 grid place-items-center rounded text-[var(--ink-faint)] active:bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)] shrink-0"
            aria-label={isOpen ? 'Replier' : 'Déplier'}
          >
            <svg viewBox="0 0 24 24" className={`size-4 sm:size-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ) : (
          <span className="size-7 sm:size-5 inline-grid place-items-center shrink-0">
            <span className="size-1 rounded-full bg-[var(--border-strong)]" />
          </span>
        )}
        <button
          onClick={() => onNavigate(person.id)}
          className="group flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] min-w-0"
        >
          {aboville && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--ink-faint)] shrink-0">
              {aboville}
            </span>
          )}
          <span className="size-1.5 rounded-full shrink-0" style={{ background: sexAccent }} />
          <span className="text-sm font-medium text-[var(--ink)] truncate">{person.name.display}</span>
          <span className="text-[11px] font-mono text-[var(--ink-faint)] tabular-nums shrink-0">{formatVital(person)}</span>
          {hasChildren && (
            <span className="text-[10px] font-mono text-[var(--ink-faint)] shrink-0">· {childIds.length}</span>
          )}
        </button>
      </div>
      {isOpen && hasChildren && (
        <div className="ml-3 pl-3 sm:pl-4 border-l border-dashed border-[var(--border-strong)]">
          {childIds.map((cid) => {
            const child = individuals.get(cid);
            return (
              <DescendantNode
                key={cid}
                person={child}
                individuals={individuals}
                families={families}
                depth={_depth + 1}
                expanded={expanded}
                toggle={toggle}
                onNavigate={onNavigate}
                abovilleMap={abovilleMap}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main DescendantsView ──────────────────────────────────────────────────────

interface Props {
  person: Individual;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onNavigate: (id: string) => void;
}

export default function DescendantsView({ person, individuals, families, onNavigate }: Props) {
  const abovilleMap = useMemo(() => {
    return computeAboville(person, individuals, families, 10);
  }, [person, individuals, families]);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const set = new Set<string>();
    set.add(person.id);
    for (const fid of person.fams || []) {
      const fam = families.get(fid);
      if (!fam) continue;
      for (const cid of fam.children || []) set.add(cid);
    }
    return set;
  });

  useEffect(() => {
    const set = new Set<string>();
    set.add(person.id);
    for (const fid of person.fams || []) {
      const fam = families.get(fid);
      if (!fam) continue;
      for (const cid of fam.children || []) set.add(cid);
    }
    setExpanded(set);
  }, [person, families]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const stats = useMemo(() => {
    let total = 0, maxGen = 0;
    const visit = (id: string, gen: number) => {
      const p = individuals.get(id);
      if (!p) return;
      if (gen > 0) total++;
      if (gen > maxGen) maxGen = gen;
      for (const fid of p.fams || []) {
        const fam = families.get(fid);
        if (!fam) continue;
        for (const cid of fam.children || []) visit(cid, gen + 1);
      }
    };
    visit(person.id, 0);
    return { total, generations: maxGen };
  }, [person, individuals, families]);

  const expandAll = () => {
    const all = new Set<string>();
    const visit = (id: string) => {
      const p = individuals.get(id);
      if (!p || all.has(id)) return;
      all.add(id);
      for (const fid of p.fams || []) {
        const fam = families.get(fid);
        if (!fam) continue;
        for (const cid of fam.children || []) visit(cid);
      }
    };
    visit(person.id);
    setExpanded(all);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-4 border-b border-[var(--border)] shrink-0">
        <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">Descendance de</div>
        <h2 className="text-[17px] sm:text-xl font-semibold text-[var(--ink)] tracking-tight truncate">{person.name.display}</h2>
        <div className="text-[11px] font-mono text-[var(--ink-faint)] mt-2 flex items-center gap-2 sm:gap-3 flex-wrap">
          <span>{stats.total} descendant·e·s</span>
          <span>·</span>
          <span>{stats.generations} génération{stats.generations > 1 ? 's' : ''}</span>
          <span className="hidden sm:inline">·</span>
          <button onClick={expandAll} className="text-[var(--accent)] hover:underline active:opacity-70">tout déplier</button>
          <span>·</span>
          <button onClick={() => setExpanded(new Set([person.id]))} className="text-[var(--accent)] hover:underline active:opacity-70">tout replier</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-6 mobile-pb-safe">
        {stats.total === 0 ? (
          <div className="text-sm text-[var(--ink-faint)] italic">Aucun descendant connu.</div>
        ) : (
          <DescendantNode
            person={person}
            individuals={individuals}
            families={families}
            depth={0}
            expanded={expanded}
            toggle={toggle}
            onNavigate={onNavigate}
            abovilleMap={abovilleMap}
          />
        )}
      </div>
    </div>
  );
}
