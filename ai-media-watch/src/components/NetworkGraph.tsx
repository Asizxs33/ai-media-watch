import { useEffect, useMemo, useRef, useState } from 'react';
import type { Post, RequisiteType } from '../types';

const REQ_COLOR: Record<RequisiteType, string> = {
  kaspi: '#46e08a', card: '#ffb020', crypto: '#8b6dff', telegram: '#ceff1a',
  whatsapp: '#46e08a', phone: '#ffb020', link: '#8b6dff', promo: '#ceff1a', other: '#9498a1',
};

function riskColor(r: number) {
  if (r >= 70) return '#ff5640';
  if (r >= 40) return '#ffb020';
  return '#46e08a';
}

interface GNode {
  id: string;
  kind: 'account' | 'req';
  label: string;
  risk: number;
  reqType?: RequisiteType;
  accountCount: number; // для req: сколько аккаунтов связано
  x: number; y: number; vx: number; vy: number;
  r: number;
}
interface GLink { s: string; t: string }

const W = 820;
const H = 540;
const norm = (v: string) => v.toLowerCase().replace(/\s+/g, '');

export function NetworkGraph({ posts }: { posts: Post[] }) {
  const { nodes, links } = useMemo(() => buildGraph(posts), [posts]);

  const nodesRef = useRef<GNode[]>([]);
  const [, force] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const dragRef = useRef<{ id: string } | null>(null);
  const alphaRef = useRef(1);
  const svgRef = useRef<SVGSVGElement>(null);

  // init positions when graph data changes
  useEffect(() => {
    nodesRef.current = nodes.map((n, i) => ({
      ...n,
      x: W / 2 + Math.cos(i) * 120 + (Math.random() - 0.5) * 40,
      y: H / 2 + Math.sin(i) * 120 + (Math.random() - 0.5) * 40,
      vx: 0, vy: 0,
    }));
    alphaRef.current = 1;
  }, [nodes]);

  // force simulation
  useEffect(() => {
    let raf = 0;
    const adj = new Map<string, GNode>();
    const step = () => {
      const ns = nodesRef.current;
      ns.forEach((n) => adj.set(n.id, n));
      const alpha = alphaRef.current;

      // repulsion (O(n²) — графы здесь небольшие)
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i], b = ns[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy || 0.01;
          const d = Math.sqrt(d2);
          const repel = (4200 / d2) * alpha;
          const fx = (dx / d) * repel, fy = (dy / d) * repel;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      // spring along links
      const dist = 84;
      for (const l of links) {
        const a = adj.get(l.s), b = adj.get(l.t);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = ((d - dist) / d) * 0.045 * alpha;
        const fx = dx * f, fy = dy * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      // centering + integrate
      for (const n of ns) {
        n.vx += (W / 2 - n.x) * 0.004 * alpha;
        n.vy += (H / 2 - n.y) * 0.004 * alpha;
        if (dragRef.current?.id === n.id) { n.vx = 0; n.vy = 0; continue; }
        n.vx *= 0.82; n.vy *= 0.82;
        n.x += Math.max(-12, Math.min(12, n.vx));
        n.y += Math.max(-12, Math.min(12, n.vy));
        n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x));
        n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y));
      }
      alphaRef.current = Math.max(0.04, alpha * 0.992);
      force((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [links, nodes]);

  // drag handlers
  const toSvg = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };
  const onDown = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { id };
    alphaRef.current = Math.max(alphaRef.current, 0.5);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const p = toSvg(e);
    const n = nodesRef.current.find((x) => x.id === dragRef.current!.id);
    if (n) { n.x = p.x; n.y = p.y; n.vx = 0; n.vy = 0; }
  };
  const onUp = () => { dragRef.current = null; };

  const ns = nodesRef.current;
  const adj = new Map(ns.map((n) => [n.id, n] as const));
  const neighbors = useMemo(() => {
    if (!hover) return null;
    const set = new Set<string>([hover]);
    for (const l of links) {
      if (l.s === hover) set.add(l.t);
      if (l.t === hover) set.add(l.s);
    }
    return set;
  }, [hover, links]);

  if (nodes.length === 0) {
    return (
      <div className="bento p-16 text-center">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4 block" style={{ fontVariationSettings: "'FILL' 0" }}>hub</span>
        <p className="text-on-surface-variant font-code-sm text-code-sm">Связей пока нет — нужны посты с извлечёнными реквизитами</p>
      </div>
    );
  }

  const dim = (id: string) => (neighbors && !neighbors.has(id) ? 0.12 : 1);

  return (
    <div className="bento p-0 overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        style={{ aspectRatio: `${W}/${H}`, background: 'radial-gradient(ellipse at 50% 40%, rgba(206,255,26,0.04), transparent 70%)' }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {/* links */}
        {links.map((l, i) => {
          const a = adj.get(l.s), b = adj.get(l.t);
          if (!a || !b) return null;
          const active = neighbors && (neighbors.has(l.s) && neighbors.has(l.t));
          const op = neighbors ? (active ? 0.7 : 0.05) : 0.22;
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={active ? '#ceff1a' : '#ffffff'} strokeWidth={active ? 1.6 : 1} strokeOpacity={op} />
          );
        })}

        {/* nodes */}
        {ns.map((n) => {
          const isAcc = n.kind === 'account';
          const color = isAcc ? riskColor(n.risk) : REQ_COLOR[n.reqType ?? 'other'];
          const shared = !isAcc && n.accountCount > 1;
          return (
            <g key={n.id} transform={`translate(${n.x},${n.y})`} opacity={dim(n.id)}
               style={{ cursor: 'grab' }}
               onPointerDown={onDown(n.id)}
               onMouseEnter={() => setHover(n.id)}
               onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}>
              {shared && <circle r={n.r + 5} fill="none" stroke="#8b6dff" strokeWidth={1.5} strokeOpacity={0.8} />}
              {isAcc ? (
                <circle r={n.r} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2} />
              ) : (
                <rect x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} rx={3}
                  transform="rotate(45)" fill={color} fillOpacity={0.85} />
              )}
              {(isAcc || shared || hover === n.id) && (
                <text y={n.r + 13} textAnchor="middle"
                  fontSize={isAcc ? 11 : 9}
                  fontFamily="'JetBrains Mono', monospace"
                  fill={isAcc ? '#f2f3f5' : color}
                  style={{ pointerEvents: 'none' }}>
                  {isAcc ? `@${n.label}` : n.label.length > 18 ? n.label.slice(0, 17) + '…' : n.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-white/[0.06] text-[11px] text-on-surface-variant font-code-sm">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-error" /> аккаунт (риск)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-primary rotate-45 inline-block" /> реквизит</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-[#8b6dff]" /> общий = сеть</span>
        <span className="ml-auto text-on-surface-variant/50">тяни узлы · наведи для связей</span>
      </div>
    </div>
  );
}

function buildGraph(posts: Post[]): { nodes: GNode[]; links: GLink[] } {
  const accounts = new Map<string, { risk: number }>();
  const reqs = new Map<string, { type: RequisiteType; label: string; accounts: Set<string> }>();
  const linkSet = new Set<string>();
  const links: GLink[] = [];

  for (const post of posts) {
    const accId = `acc:${post.username}`;
    const prev = accounts.get(accId);
    accounts.set(accId, { risk: Math.max(prev?.risk ?? 0, post.riskScore) });

    for (const req of post.requisites ?? []) {
      if (!req.value?.trim()) continue;
      const reqId = `req:${req.type}:${norm(req.value)}`;
      const r = reqs.get(reqId);
      if (r) r.accounts.add(accId);
      else reqs.set(reqId, { type: req.type, label: req.value, accounts: new Set([accId]) });

      const key = `${accId}->${reqId}`;
      if (!linkSet.has(key)) { linkSet.add(key); links.push({ s: accId, t: reqId }); }
    }
  }

  const nodes: GNode[] = [];
  for (const [id, a] of accounts) {
    nodes.push({ id, kind: 'account', label: id.slice(4), risk: a.risk, accountCount: 0,
      x: 0, y: 0, vx: 0, vy: 0, r: 9 + a.risk / 9 });
  }
  for (const [id, r] of reqs) {
    nodes.push({ id, kind: 'req', label: r.label, risk: 0, reqType: r.type,
      accountCount: r.accounts.size, x: 0, y: 0, vx: 0, vy: 0, r: r.accounts.size > 1 ? 7 : 5 });
  }

  // отбрасываем реквизиты-«сироты», которые ни с чем не пересекаются и не несут смысла? — оставляем все
  return { nodes, links };
}
