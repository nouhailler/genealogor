import { useRef, useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { Individual, Family } from '@/types/genealogy';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  sex: 'M' | 'F' | 'U';
  year: number | null;
  person: Individual;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  kind: 'parent' | 'spouse';
}

// ── Main ForceGraphView ───────────────────────────────────────────────────────

interface Props {
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  onNavigate: (id: string) => void;
  focusId?: string;
}

export default function ForceGraphView({ individuals, families, onNavigate, focusId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const [highlight, setHighlight] = useState<string | null>(focusId ?? null);
  const [showLabels, setShowLabels] = useState(true);
  const [linkType, setLinkType] = useState<'parents' | 'spouses' | 'all'>('parents');

  // Suppress unused warning — highlight is kept for future use
  void highlight;

  const graph = useMemo<{ nodes: GraphNode[]; links: GraphLink[] }>(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const ids = new Set<string>();
    for (const p of individuals.values()) {
      nodes.push({
        id: p.id,
        label: p.name.display,
        sex: p.sex,
        year: p.birth?.date?.year ?? p.death?.date?.year ?? null,
        person: p,
      });
      ids.add(p.id);
    }
    if (linkType !== 'spouses') {
      for (const f of families.values()) {
        for (const cid of f.children || []) {
          if (!ids.has(cid)) continue;
          if (f.husband && ids.has(f.husband)) links.push({ source: f.husband, target: cid, kind: 'parent' });
          if (f.wife && ids.has(f.wife)) links.push({ source: f.wife, target: cid, kind: 'parent' });
        }
      }
    }
    if (linkType !== 'parents') {
      for (const f of families.values()) {
        if (f.husband && f.wife && ids.has(f.husband) && ids.has(f.wife)) {
          links.push({ source: f.husband, target: f.wife, kind: 'spouse' });
        }
      }
    }
    return { nodes, links };
  }, [individuals, families, linkType]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const width = 1000;
    const height = 700;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]).on('zoom', (e) => g.attr('transform', e.transform));
    svg.call(zoom);

    const sim = d3.forceSimulation<GraphNode, GraphLink>(graph.nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(graph.links).id((d) => d.id).distance(40).strength(0.6))
      .force('charge', d3.forceManyBody<GraphNode>().strength(-80))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<GraphNode>().radius(8))
      .stop();
    simRef.current = sim;

    const preTicks = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()));
    for (let i = 0; i < Math.min(preTicks, 300); i++) sim.tick();

    const link = g.append('g').attr('stroke', 'var(--border-strong)').attr('stroke-opacity', 0.6)
      .selectAll<SVGLineElement, GraphLink>('line').data(graph.links).join('line')
      .attr('stroke-width', (d) => d.kind === 'spouse' ? 1.5 : 1)
      .attr('stroke-dasharray', (d) => d.kind === 'spouse' ? '2 2' : null);

    const node = g.append('g')
      .selectAll<SVGCircleElement, GraphNode>('circle').data(graph.nodes).join('circle')
      .attr('r', (d) => 4 + (d.person.fams?.length || 0))
      .attr('fill', (d) => d.sex === 'F' ? 'var(--sex-f)' : d.sex === 'M' ? 'var(--sex-m)' : 'var(--ink-faint)')
      .attr('stroke', 'var(--bg)')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (_e, d) => onNavigate(d.id))
      .on('mouseenter', (_e, d) => setHighlight(d.id))
      .on('mouseleave', () => setHighlight(null))
      .call(
        d3.drag<SVGCircleElement, GraphNode>()
          .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    let label: d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null = null;
    if (showLabels) {
      label = g.append('g')
        .selectAll<SVGTextElement, GraphNode>('text').data(graph.nodes).join('text')
        .text((d) => d.label)
        .attr('font-size', 9)
        .attr('font-family', 'Inter, sans-serif')
        .attr('fill', 'var(--ink)')
        .attr('dx', 7)
        .attr('dy', 3)
        .style('pointer-events', 'none');
    }

    sim.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0);
      node.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0);
      if (label) label.attr('x', (d) => d.x ?? 0).attr('y', (d) => d.y ?? 0);
    });

    // Initial paint
    link
      .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
      .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
      .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
      .attr('y2', (d) => (d.target as GraphNode).y ?? 0);
    node.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0);
    if (label) label.attr('x', (d) => d.x ?? 0).attr('y', (d) => d.y ?? 0);

    if (focusId) {
      const focused = graph.nodes.find((n) => n.id === focusId);
      if (focused) {
        focused.fx = width / 2;
        focused.fy = height / 2;
      }
    }

    return () => { sim.stop(); };
  }, [graph, showLabels, focusId, onNavigate]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-[var(--border)] flex items-start justify-between flex-wrap gap-3 shrink-0">
        <div className="min-w-0">
          <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--ink-faint)] mb-1">Graphe relationnel</div>
          <h2 className="text-[17px] sm:text-xl font-semibold text-[var(--ink)] tracking-tight">{graph.nodes.length} nœuds · {graph.links.length} liens</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)]">
            {(['parents', 'spouses', 'all'] as const).map((k) => (
              <button key={k} onClick={() => setLinkType(k)}
                className={`px-2.5 py-1 text-[11.5px] sm:text-xs rounded ${linkType === k ? 'bg-[var(--bg)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink-muted)]'}`}>
                {k === 'parents' ? 'Filiation' : k === 'spouses' ? 'Mariages' : 'Tout'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)] cursor-pointer select-none">
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
            Étiquettes
          </label>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <svg ref={svgRef} className="w-full h-full" style={{ touchAction: 'none' }} />
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto text-[10px] sm:text-[10.5px] font-mono text-[var(--ink-faint)] bg-[var(--bg)]/85 backdrop-blur px-2 py-1 rounded pointer-events-none">
          <span className="hidden sm:inline">Glisser pour panner · molette pour zoomer · clic = ouvrir profil</span>
          <span className="sm:hidden">Pincez pour zoomer · touchez un nœud pour ouvrir</span>
        </div>
      </div>
    </div>
  );
}
