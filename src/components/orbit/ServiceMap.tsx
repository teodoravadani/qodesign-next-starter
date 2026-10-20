'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { C, EDGES, NODES, R, fmt, type Health, type SvcNode } from './data';
import { TipRow, useInterval, useTip } from './kit';
import { cardMotion } from './motionPresets';

const RING = 2 * Math.PI * 19;
const SVG_NS = 'http://www.w3.org/2000/svg';
export type ServiceMapHandle = { showNode: (id: string | null) => void };

/** Live service map: packets travel along the edges, rings show each service's share of traffic. */
export const ServiceMap = forwardRef<ServiceMapHandle, { live: boolean; degraded: string | null; index: number }>(function ServiceMap({ live, degraded, index }, ref) {
  const wrap = useRef<HTMLDivElement>(null);
  const pk = useRef<SVGGElement>(null);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const nodeEls = useRef<Record<string, SVGGElement | null>>({});
  const [vertical, setVertical] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [rps, setRps] = useState(() => NODES.map((n) => n.rps));
  const [ready, setReady] = useState(false);
  const reduce = useReducedMotion();
  const tip = useTip();
  const liveRef = useRef(live); liveRef.current = live;
  const reduceRef = useRef(reduce); reduceRef.current = reduce;
  const degRef = useRef(degraded); degRef.current = degraded;

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setVertical(el.clientWidth < 560));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => { const t = setTimeout(() => setReady(true), 400); return () => clearTimeout(t); }, []);
  useInterval(() => setRps((r) => r.map((v) => Math.max(10, v * (1 + (R() - 0.5) * 0.04)))), live ? 1000 : null);

  const pos = useCallback((n: SvcNode) => (vertical ? { x: 34 + (n.y - 52) * (272 / 228), y: 34 + (n.x - 64) * 0.74 } : { x: n.x, y: n.y }), [vertical]);
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const edgeD = (e: (typeof EDGES)[number]) => {
    const a = pos(byId[e[0]]), b = pos(byId[e[1]]);
    const mx = (a.x + b.x) / 2 + (vertical ? (b.x - a.x) * 0.12 + 8 : 0), my = (a.y + b.y) / 2 - (vertical ? 0 : (b.y - a.y) * 0.12 + 8);
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  };

  // packets: imperative rAF loop on plain SVG circles (cheap, no React renders per frame)
  useEffect(() => {
    const g = pk.current; if (!g) return;
    let visible = true;
    const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; });
    if (wrap.current) io.observe(wrap.current);
    const state = EDGES.map(() => ({ acc: R(), pk: [] as { c: SVGCircleElement; t: number; v: number }[] }));
    let last = performance.now(), raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(64, now - last) / 1000; last = now;
      if (liveRef.current && visible && !reduceRef.current && !document.hidden) {
        EDGES.forEach((e, i) => {
          const p = paths.current[i]; if (!p) return;
          const len = p.getTotalLength(), s = state[i];
          s.acc += dt * e[2] * 2.4;
          while (s.acc > 1) {
            s.acc -= 1;
            const warm = degRef.current === e[0] || degRef.current === e[1];
            const c = document.createElementNS(SVG_NS, 'circle');
            c.setAttribute('r', String(R() < 0.2 ? 2.6 : 1.8)); c.setAttribute('class', 'pkt');
            c.setAttribute('fill', warm && R() < 0.55 ? C.amber : R() < 0.3 ? C.lime : C.violet);
            g.appendChild(c); s.pk.push({ c, t: 0, v: 0.55 + R() * 0.5 });
          }
          s.pk = s.pk.filter((q) => {
            q.t += dt * q.v * (90 / len) * 2.2;
            if (q.t >= 1) { q.c.remove(); return false; }
            const pt = p.getPointAtLength(q.t * len);
            q.c.setAttribute('cx', pt.x.toFixed(1)); q.c.setAttribute('cy', pt.y.toFixed(1)); q.c.setAttribute('opacity', Math.sin(q.t * Math.PI).toFixed(2));
            return true;
          });
        });
      } else if (reduceRef.current) { state.forEach((s) => { s.pk.forEach((q) => q.c.remove()); s.pk = []; }); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); io.disconnect(); g.replaceChildren(); };
  }, []);

  const health = (id: string): Health => (degraded === id ? 'degraded' : 'ok');
  const stats = (n: SvcNode, i: number) => ({ rps: rps[i], p95: n.id === degraded ? 612 : n.p95, err: n.id === degraded ? 2.4 : n.err });
  const showNode = useCallback((id: string | null) => {
    setFocus(id);
    if (!id) { tip.hide(); return; }
    const i = NODES.findIndex((n) => n.id === id), n = NODES[i], el = nodeEls.current[id];
    if (!el) return;
    const r = el.getBoundingClientRect(), s = stats(n, i), h = health(id);
    tip.show(
      <>
        <b>{n.name} <span className={`chip ${h === 'ok' ? 'ok' : 'warn'}`}>{h === 'ok' ? 'healthy' : 'degraded'}</span></b>
        <TipRow k="throughput" v={fmt(Math.round(s.rps)) + '/s'} />
        <TipRow k="p95" v={Math.round(s.p95) + ' ms'} />
        <TipRow k="errors" v={s.err.toFixed(2) + '%'} />
      </>, r.right, r.top + r.height / 2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rps, degraded, tip]);
  useImperativeHandle(ref, () => ({ showNode }), [showNode]);

  const linked = (id: string) => !focus || id === focus || EDGES.some((e) => (e[0] === focus && e[1] === id) || (e[1] === focus && e[0] === id));
  const degCount = degraded ? 1 : 0;

  return (
    <motion.article className="card map-card" {...cardMotion(index)}>
      <div className="card-h">
        <h2>Service map</h2><span className="sub">live traffic between services</span>
        <div className="r">
          <span className="chip ok">{NODES.length - degCount} healthy</span>
          {degCount > 0 && <span className="chip warn">{degCount} degraded</span>}
        </div>
      </div>
      <div className={`map${focus ? ' focus' : ''}`} ref={wrap}>
        <svg viewBox={vertical ? '0 0 340 476' : '0 0 640 336'} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Service map. Use Tab to move between services.">
          <g>
            {EDGES.map((e, i) => (
              <path key={e[0] + e[1]} ref={(el) => { paths.current[i] = el; }} d={edgeD(e)}
                className={`edge ${degraded === e[0] || degraded === e[1] ? 'warm' : 'hot'}${!focus || e[0] === focus || e[1] === focus ? ' hl' : ''}`} />
            ))}
          </g>
          <g ref={pk} />
          <g>
            {NODES.map((n, i) => {
              const p = pos(n), h = health(n.id), col = h === 'ok' ? C.lime : C.amber;
              const share = Math.min(1, 0.5 + (n.rps / 14000) * 0.5);
              return (
                <g key={n.id} ref={(el) => { nodeEls.current[n.id] = el; }} className={`node${h !== 'ok' ? ' degraded' : ''}${linked(n.id) ? ' hl' : ''}`}
                  transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`} tabIndex={0} role="button" aria-label={`${n.name}: ${h === 'ok' ? 'healthy' : 'degraded'}`}
                  onPointerEnter={() => showNode(n.id)} onFocus={() => showNode(n.id)} onPointerLeave={() => showNode(null)} onBlur={() => showNode(null)}>
                  <circle r="22" className="halo" stroke={col} />
                  <circle r="19" className="core" stroke={C.line} />
                  <circle r="19" className="ring" stroke={col} strokeDasharray={RING} strokeDashoffset={ready ? RING * (1 - share) : RING} style={{ transitionDelay: `${i * 70}ms` }} />
                  <text y="3.5" className="code">{n.code}</text>
                  <text y="34">{n.name}</text>
                  <text y="46" className="m">{fmt(Math.round(rps[i]))}/s</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="map-legend" aria-hidden="true">
        <span><i style={{ background: C.lime }} />healthy</span><span><i style={{ background: C.amber }} />degraded</span>
        <span><i style={{ background: C.violet }} />request</span><span><i style={{ background: C.lime, opacity: 0.5 }} />ring = share of traffic</span>
      </div>
    </motion.article>
  );
});
