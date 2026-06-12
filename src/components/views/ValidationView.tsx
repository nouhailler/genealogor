import { useState, useMemo } from 'react';
import type { Individual, Family } from '@/types/genealogy';
import { formatVital, Icon } from '@/components/ui-kit';
import MergeModal from '@/components/views/MergeModal';
import { isResolved, markResolved, unmarkResolved } from '@/lib/merge-resolved';
import type { DuplicatePair } from '@/components/views/MergeModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ValidationIssue {
  severity: 'error' | 'warn' | 'info';
  personId: string;
  person: Individual;
  code: string;
  message: string;
}

interface CompletenessField {
  field: string;
  label: string;
  count: number;
  total: number;
  pct: number;
}

// ── Validation logic ──────────────────────────────────────────────────────────

function runValidation(individuals: Map<string, Individual>, families: Map<string, Family>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const now = new Date().getFullYear();

  const cycleIds = new Set<string>();
  for (const p of individuals.values()) {
    if (cycleIds.has(p.id)) continue;
    const stack: { id: string; depth: number }[] = [{ id: p.id, depth: 0 }];
    const visitedThisRun = new Set<string>([p.id]);
    let found = false;
    while (stack.length && !found) {
      const { id, depth } = stack.pop()!;
      if (depth > 40) continue;
      const cur = individuals.get(id);
      if (!cur) continue;
      for (const fid of cur.famc || []) {
        const fam = families.get(fid);
        if (!fam) continue;
        for (const parentId of [fam.husband, fam.wife]) {
          if (!parentId) continue;
          if (parentId === p.id) {
            issues.push({
              severity: 'error',
              personId: p.id,
              person: p,
              code: 'ancestral-cycle',
              message: `Cycle généalogique : ${p.name.display} apparaît dans sa propre ascendance (${depth + 1} génération${depth + 1 > 1 ? 's' : ''})`,
            });
            cycleIds.add(p.id);
            found = true;
            break;
          }
          if (visitedThisRun.has(parentId)) continue;
          visitedThisRun.add(parentId);
          stack.push({ id: parentId, depth: depth + 1 });
        }
        if (found) break;
      }
    }
  }

  for (const p of individuals.values()) {
    const by = p.birth?.date?.year;
    const dy = p.death?.date?.year;
    if (by && (by < 1000 || by > now)) {
      issues.push({ severity: 'warn', personId: p.id, person: p, code: 'implausible-birth', message: `Année de naissance improbable : ${by}` });
    }
    if (by && dy && dy < by) {
      issues.push({ severity: 'error', personId: p.id, person: p, code: 'death-before-birth', message: `Décès (${dy}) avant naissance (${by})` });
    }
    if (by && dy && dy - by > 120) {
      issues.push({ severity: 'warn', personId: p.id, person: p, code: 'long-life', message: `Durée de vie inhabituelle : ${dy - by} ans` });
    }
    if (!p.name.surname && !p.name.given) {
      issues.push({ severity: 'warn', personId: p.id, person: p, code: 'no-name', message: 'Aucun nom renseigné' });
    }
    if (!by) {
      issues.push({ severity: 'info', personId: p.id, person: p, code: 'no-birth-date', message: 'Date de naissance manquante' });
    }
    for (const fid of p.famc || []) {
      const fam = families.get(fid);
      if (!fam) continue;
      for (const parentId of [fam.husband, fam.wife]) {
        if (!parentId) continue;
        const parent = individuals.get(parentId);
        if (!parent) continue;
        const py = parent.birth?.date?.year;
        const pd = parent.death?.date?.year;
        if (py && by && by - py < 12) {
          issues.push({ severity: 'error', personId: p.id, person: p, code: 'young-parent', message: `Parent ${parent.name.display} trop jeune (${by - py} ans à la naissance)` });
        }
        if (py && by && by - py > 70) {
          issues.push({ severity: 'warn', personId: p.id, person: p, code: 'old-parent', message: `Parent ${parent.name.display} âgé (${by - py} ans à la naissance)` });
        }
        if (pd && by && by > pd + 1) {
          issues.push({ severity: 'error', personId: p.id, person: p, code: 'born-after-parent-death', message: `Né(e) après le décès du parent ${parent.name.display}` });
        }
      }
    }
  }

  return issues;
}

function computeCompleteness(individuals: Map<string, Individual>): CompletenessField[] {
  const fields = ['birthDate', 'birthPlace', 'deathDate', 'deathPlace', 'surname', 'given', 'sex'];
  const counts: Record<string, number> = Object.fromEntries(fields.map((f) => [f, 0]));
  const total = individuals.size;
  for (const p of individuals.values()) {
    if (p.birth?.date?.display) counts.birthDate++;
    if (p.birth?.place) counts.birthPlace++;
    if (p.death?.date?.display) counts.deathDate++;
    if (p.death?.place) counts.deathPlace++;
    if (p.name.surname) counts.surname++;
    if (p.name.given) counts.given++;
    if (p.sex && p.sex !== 'U') counts.sex++;
  }
  const labels: Record<string, string> = {
    birthDate: 'Date de naissance', birthPlace: 'Lieu de naissance',
    deathDate: 'Date de décès', deathPlace: 'Lieu de décès',
    surname: 'Patronyme', given: 'Prénom', sex: 'Sexe',
  };
  return fields.map((f) => ({ field: f, label: labels[f], count: counts[f], total, pct: total ? (counts[f] / total) * 100 : 0 }));
}

function levenshtein(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 4) return Math.abs(m - n);
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function findDuplicates(individuals: Map<string, Individual>): DuplicatePair[] {
  const all = Array.from(individuals.values());
  const norm = (s: string | undefined | null) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const sa = norm(a.name.surname), sb = norm(b.name.surname);
      const ga = norm(a.name.given), gb = norm(b.name.given);
      if (!sa && !sb) continue;
      const dSurname = levenshtein(sa, sb);
      const dGiven = levenshtein(ga, gb);
      if (dSurname > 2 || dGiven > 2) continue;
      let score = 0;
      if (sa === sb && sa) score += 40;
      else if (dSurname <= 1 && sa && sb) score += 25;
      if (ga === gb && ga) score += 30;
      else if (dGiven <= 1 && ga && gb) score += 18;
      const ay = a.birth?.date?.year, by = b.birth?.date?.year;
      if (ay && by) {
        const diff = Math.abs(ay - by);
        if (diff === 0) score += 25;
        else if (diff <= 2) score += 12;
        else if (diff > 5) score -= 30;
      }
      if (a.sex && b.sex && a.sex !== b.sex) score -= 30;
      if (score >= 60) pairs.push({ a, b, score });
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 sm:px-4 py-2.5 sm:py-3">
      <div className="text-[10px] sm:text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] truncate">{label}</div>
      <div className="text-xl sm:text-2xl font-semibold tabular-nums mt-1 leading-tight" style={{ color }}>{value}</div>
    </div>
  );
}

function SeverityDot({ severity }: { severity: 'error' | 'warn' | 'info' }) {
  const c = severity === 'error' ? 'var(--danger)' : severity === 'warn' ? 'var(--warn)' : 'var(--ink-faint)';
  return <span className="size-2 rounded-full mt-1.5 shrink-0" style={{ background: c }} />;
}

function DupCard({ person, onSelect }: { person: Individual; onSelect: (id: string) => void }) {
  return (
    <button onClick={() => onSelect(person.id)}
      className="text-left rounded border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] px-3 py-2">
      <div className="text-sm font-medium text-[var(--ink)] truncate">{person.name.display}</div>
      <div className="text-[11px] font-mono text-[var(--ink-faint)] mt-0.5">{formatVital(person)}</div>
      {person.birth?.place && <div className="text-[11px] text-[var(--ink-muted)] truncate">{person.birth.place}</div>}
    </button>
  );
}

function DuplicateRow({ pair, families, onSelect, onMerge, onResolvedChange }: {
  pair: DuplicatePair;
  families: Map<string, Family>;
  onSelect: (id: string) => void;
  onMerge: (pair: DuplicatePair) => void;
  onResolvedChange: () => void;
}) {
  const resolved = isResolved(pair.a.id, pair.b.id);
  void families; // families passed to MergeModal
  return (
    <div className={`rounded-md border bg-[var(--surface)] p-3 ${resolved ? 'border-[var(--border)] opacity-60' : 'border-[var(--border)]'}`}>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-mono text-[var(--ink-faint)]">Score Levenshtein : {pair.score}/100</div>
          <div className="h-1 w-20 bg-[var(--bg)] rounded-full overflow-hidden">
            <div className="h-full" style={{ width: `${pair.score}%`, background: pair.score > 80 ? 'var(--danger)' : 'var(--warn)' }} />
          </div>
          {resolved && <span className="text-[10px] font-mono text-[var(--ink-faint)] px-1.5 py-0.5 rounded bg-[var(--bg)]">résolu</span>}
        </div>
        <div className="flex items-center gap-1">
          {resolved ? (
            <button onClick={() => { unmarkResolved(pair.a.id, pair.b.id); onResolvedChange(); }}
              className="text-[11px] font-mono text-[var(--ink-muted)] hover:text-[var(--ink)] px-2 py-1 rounded hover:bg-[var(--surface-hover)]">
              Rouvrir
            </button>
          ) : (
            <>
              <button onClick={() => { markResolved(pair.a.id, pair.b.id); onResolvedChange(); }}
                className="text-[11px] font-mono text-[var(--ink-muted)] hover:text-[var(--ink)] px-2 py-1 rounded hover:bg-[var(--surface-hover)]">
                Ignorer
              </button>
              <button onClick={() => onMerge(pair)}
                className="text-[11px] font-mono text-[var(--accent)] hover:bg-[color:var(--accent)]/10 px-2 py-1 rounded flex items-center gap-1">
                <Icon.GitMerge className="size-3" /> Fusionner
              </button>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <DupCard person={pair.a} onSelect={onSelect} />
        <DupCard person={pair.b} onSelect={onSelect} />
      </div>
    </div>
  );
}

// ── Main ValidationView ───────────────────────────────────────────────────────

interface Props {
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onNavigate: (id: string) => void;
}

export default function ValidationView({ individuals, families, onNavigate }: Props) {
  const issues = useMemo(() => runValidation(individuals, families), [individuals, families]);
  const completeness = useMemo(() => computeCompleteness(individuals), [individuals]);
  const allDuplicates = useMemo(() => findDuplicates(individuals), [individuals]);
  const [tab, setTab] = useState<'issues' | 'completeness' | 'duplicates'>('issues');
  const [mergePair, setMergePair] = useState<DuplicatePair | null>(null);
  const [resolvedTick, setResolvedTick] = useState(0);

  const duplicates = useMemo(() => {
    void resolvedTick;
    return allDuplicates.filter((d) => !isResolved(d.a.id, d.b.id));
   
  }, [allDuplicates, resolvedTick]);

  const resolvedCount = allDuplicates.length - duplicates.length;
  const tick = () => setResolvedTick((t) => t + 1);

  const counts = {
    error: issues.filter((i) => i.severity === 'error').length,
    warn: issues.filter((i) => i.severity === 'warn').length,
    info: issues.filter((i) => i.severity === 'info').length,
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-[var(--border)] shrink-0">
        <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">Qualité des données</div>
        <h2 className="text-[17px] sm:text-xl font-semibold text-[var(--ink)] tracking-tight">Validation</h2>
      </div>
      <div className="border-b border-[var(--border)] px-4 sm:px-6 flex gap-0.5 overflow-x-auto no-scrollbar shrink-0">
        {([
          ['issues', `Incohérences (${issues.length})`],
          ['completeness', 'Complétude'],
          ['duplicates', `Doublons (${duplicates.length})`],
        ] as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as 'issues' | 'completeness' | 'duplicates')}
            className={`relative px-3 py-3 sm:py-2.5 text-[12.5px] sm:text-xs font-medium whitespace-nowrap ${tab === k ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'}`}>
            {l}
            {tab === k && <span className="absolute bottom-0 left-2 right-2 h-px bg-[var(--accent)]" />}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 mobile-pb-safe">
        {tab === 'issues' && (
          <div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-4 sm:mb-5">
              <Stat label="Erreurs" value={counts.error} color="var(--danger)" />
              <Stat label="Avertissements" value={counts.warn} color="var(--warn)" />
              <Stat label="Informations" value={counts.info} color="var(--ink-faint)" />
            </div>
            {issues.length === 0 ? (
              <div className="text-center text-sm text-[var(--ink-faint)] py-12">
                ✓ Aucune incohérence détectée.
              </div>
            ) : (
              <div className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)]">
                {issues.slice(0, 200).map((it, i) => (
                  <button key={i} onClick={() => onNavigate(it.personId)}
                    className="w-full text-left px-4 py-2.5 hover:bg-[var(--surface-hover)] flex items-start gap-3">
                    <SeverityDot severity={it.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-[var(--ink)]">
                        <span className="font-medium">{it.person.name.display}</span>
                        <span className="text-[var(--ink-muted)]"> — {it.message}</span>
                      </div>
                      <div className="text-[10px] font-mono text-[var(--ink-faint)] mt-0.5">{it.code}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === 'completeness' && (
          <div className="space-y-2">
            {completeness.map((c) => (
              <div key={c.field} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-sm font-medium text-[var(--ink)]">{c.label}</div>
                  <div className="text-[11px] font-mono text-[var(--ink-faint)] tabular-nums">
                    {c.count}/{c.total} · {c.pct.toFixed(0)}%
                  </div>
                </div>
                <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: 'var(--accent)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'duplicates' && (
          duplicates.length === 0 && resolvedCount === 0 ? (
            <div className="text-center text-sm text-[var(--ink-faint)] py-12">✓ Aucun doublon probable détecté.</div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-[var(--ink-faint)] px-1 pb-1">
                {duplicates.length} paire{duplicates.length !== 1 ? 's' : ''} à examiner{resolvedCount > 0 ? ` · ${resolvedCount} résolu${resolvedCount > 1 ? 's' : ''}` : ''}
              </div>
              {duplicates.length === 0 && (
                <div className="text-center text-sm text-[var(--ink-faint)] py-8">✓ Toutes les paires ont été examinées.</div>
              )}
              {duplicates.map((d, i) => (
                <DuplicateRow
                  key={i}
                  pair={d}
                  families={families}
                  onSelect={onNavigate}
                  onMerge={setMergePair}
                  onResolvedChange={tick}
                />
              ))}
            </div>
          )
        )}
      </div>
      {/* Merge modal */}
      {mergePair && (
        <MergeModal
          pair={mergePair}
          families={families}
          onClose={(changed) => { setMergePair(null); if (changed) tick(); }}
        />
      )}
      {/* Icon used to avoid unused import warning */}
      <span className="hidden"><Icon.AlertTriangle /></span>
    </div>
  );
}
