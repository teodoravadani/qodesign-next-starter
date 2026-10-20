'use client';
import { animate, useReducedMotion } from 'framer-motion';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { C, fmt, type ColorKey } from './data';

/** setInterval that always calls the latest callback. */
export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms == null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** A number that eases from its last value to the new one (instant under Reduce Motion). */
export function CountUp({ value, decimals = 0, duration = 0.7, suffix = '', className }: { value: number; decimals?: number; duration?: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const from = useRef(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) { node.textContent = fmt(value, decimals) + suffix; from.current = value; return; }
    const c = animate(from.current, value, {
      duration, ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { from.current = v; node.textContent = fmt(v, decimals) + suffix; },
    });
    return () => c.stop();
  }, [value, decimals, duration, suffix, reduce]);
  return <b ref={ref} className={className}>{fmt(0, decimals) + suffix}</b>;
}

export function Spark({ data, color }: { data: number[]; color: ColorKey }) {
  const w = 110, h = 34;
  const mn = Math.min(...data), mx = Math.max(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - mn) / (mx - mn || 1)) * (h - 8)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`sp-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C[color]} stopOpacity=".35" />
          <stop offset="1" stopColor={C[color]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d}L${w} ${h}L0 ${h}Z`} fill={`url(#sp-${color})`} />
      <path d={d} fill="none" stroke={C[color]} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0] - 2} cy={last[1]} r="2.5" fill={C[color]} />
    </svg>
  );
}

/* One floating tooltip for the whole dashboard */
type TipApi = { show: (content: ReactNode, x: number, y: number) => void; hide: () => void };
const TipCtx = createContext<TipApi>({ show: () => {}, hide: () => {} });
export const useTip = () => useContext(TipCtx);
export function TipRow({ k, v }: { k: string; v: string }) {
  return <div className="r"><span>{k}</span><span>{v}</span></div>;
}
export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<{ content: ReactNode; x: number; y: number } | null>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const show = useCallback((content: ReactNode, x: number, y: number) => setTip({ content, x, y }), []);
  const hide = useCallback(() => setTip((t) => (t ? { ...t, content: t.content, x: -1, y: -1 } : null)), []);
  useEffect(() => {
    const el = ref.current;
    if (!el || !tip || tip.x < 0) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = tip.x + 14, top = tip.y - h - 12;
    if (left + w > window.innerWidth - 8) left = tip.x - w - 14;
    if (top < 8) top = tip.y + 16;
    setPos({ left: Math.max(8, left), top });
  }, [tip]);
  const on = !!tip && tip.x >= 0;
  return (
    <TipCtx.Provider value={{ show, hide }}>
      {children}
      <div ref={ref} className={`tip${on ? ' on' : ''}`} role="tooltip" style={{ left: pos.left, top: pos.top }}>
        {tip?.content}
      </div>
    </TipCtx.Provider>
  );
}
