'use client';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { C, R, RANGES, genLatency, type Latency, type RangeKey } from './data';
import { TipRow, useInterval, useTip } from './kit';
import { cardMotion } from './motionPresets';

export type LatencyHandle = { hover: (i: number | null) => void; points: () => number };

/** Streaming p50 / p95 / p99 chart with a crosshair. Morphs when the range changes. */
export const LatencyChart = forwardRef<LatencyHandle, { range: RangeKey; live: boolean; index: number }>(function LatencyChart({ range, live, index }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 250 });
  const [S, setS] = useState<Latency>(() => genLatency(range));
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const tip = useTip();
  const first = useRef(true);
  const sRef = useRef(S); sRef.current = S;

  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 360, h: el.clientHeight || 250 }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // morph to the new range
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const next = genLatency(range), cur = sRef.current;
    if (reduce || cur.p50.length !== next.p50.length) { setS(next); return; }
    const from = { p50: cur.p50.slice(), p95: cur.p95.slice(), p99: cur.p99.slice() };
    const c = animate(0, 1, { duration: 0.6, ease: [0.16, 1, 0.3, 1], onUpdate: (p) => setS({
      p50: next.p50.map((v, i) => from.p50[i] + (v - from.p50[i]) * p),
      p95: next.p95.map((v, i) => from.p95[i] + (v - from.p95[i]) * p),
      p99: next.p99.map((v, i) => from.p99[i] + (v - from.p99[i]) * p),
    }) });
    return () => c.stop();
  }, [range, reduce]);

  useInterval(() => setS((cur) => {
    const f = RANGES[range].k, last = cur.p50[cur.p50.length - 1];
    const b = Math.max(52 * f, Math.min(92 * f, last + (R() - 0.5) * 10));
    return { p50: [...cur.p50.slice(1), b], p95: [...cur.p95.slice(1), b * 2.4 + R() * 16], p99: [...cur.p99.slice(1), b * 3.5 + R() * 34] };
  }), live ? 1000 : null);

  const { w: W, h: H } = size, pl = 34, pr = 6, pt = 8, pb = 22;
  const mx = Math.ceil(Math.max(...S.p99) / 100) * 100, n = S.p50.length;
  const X = (i: number) => pl + (i / (n - 1)) * (W - pl - pr), Y = (v: number) => pt + (1 - v / mx) * (H - pt - pb);
  const line = (a: number[]) => a.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  const area = (a: number[]) => line(a) + `L${X(n - 1)} ${H - pb}L${X(0)} ${H - pb}Z`;
  const L = RANGES[range].labels;

  // tooltip follows the hovered index (also while new points stream in)
  useEffect(() => {
    if (hover == null) return;
    const el = box.current; if (!el) return;
    const r = el.getBoundingClientRect(), i = Math.min(hover, n - 1), ago = n - 1 - i;
    tip.show(<>
      <b>{ago ? `${ago} ${RANGES[range].u} ago` : 'now'}</b>
      <TipRow k="p50" v={Math.round(S.p50[i]) + ' ms'} /><TipRow k="p95" v={Math.round(S.p95[i]) + ' ms'} /><TipRow k="p99" v={Math.round(S.p99[i]) + ' ms'} />
    </>, r.left + X(i) * (r.width / W), r.top + Y(S.p95[i]) * (r.height / H));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, S]);

  const setHoverIdx = (i: number | null) => { setHover(i); if (i == null) tip.hide(); };
  useImperativeHandle(ref, () => ({ hover: setHoverIdx, points: () => n }), [n]);
  const onMove = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width);
    setHoverIdx(Math.max(0, Math.min(n - 1, Math.round(((x - pl) / (W - pl - pr)) * (n - 1)))));
  };
  const hi = hover == null ? null : Math.min(hover, n - 1);

  return (
    <motion.article className="card lat-card" {...cardMotion(index)}>
      <div className="card-h"><h2>Latency</h2>
        <div className="r legend"><span><i style={{ background: C.cyan }} />p50</span><span><i style={{ background: C.violet }} />p95</span><span><i style={{ background: C.red }} />p99</span></div>
      </div>
      <div className={`lat${hi != null ? ' hover' : ''}`} ref={box} onPointerMove={onMove} onPointerLeave={() => setHoverIdx(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Latency over time: p50, p95 and p99">
          <defs>
            <linearGradient id="la95" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.violet} stopOpacity=".35" /><stop offset="1" stopColor={C.violet} stopOpacity="0" /></linearGradient>
            <linearGradient id="la50" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.cyan} stopOpacity=".22" /><stop offset="1" stopColor={C.cyan} stopOpacity="0" /></linearGradient>
            <clipPath id="latClip">
              <motion.rect x={pl} y={0} height={H} initial={{ width: reduce ? W - pl : 0 }} animate={{ width: W - pl }} transition={{ delay: 0.4, duration: 1.4, ease: [0.16, 1, 0.3, 1] }} />
            </clipPath>
          </defs>
          {[0, 1, 2, 3, 4].map((k) => { const v = (mx * k) / 4, y = Y(v); return (
            <g key={k}><line className="gl" x1={pl} x2={W - pr} y1={y} y2={y} /><text className="ax" x={pl - 6} y={y + 3} textAnchor="end">{Math.round(v)}</text></g>); })}
          {[0, 0.5, 1].map((p, i) => <text key={p} className="ax" x={pl + p * (W - pl - pr)} y={H - 6} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{L[i]}</text>)}
          <g clipPath="url(#latClip)">
            <path d={area(S.p95)} fill="url(#la95)" /><path d={area(S.p50)} fill="url(#la50)" />
            <path d={line(S.p99)} fill="none" stroke={C.red} strokeWidth="1.4" strokeDasharray="4 3" opacity=".85" />
            <path d={line(S.p95)} fill="none" stroke={C.violet} strokeWidth="2" />
            <path d={line(S.p50)} fill="none" stroke={C.cyan} strokeWidth="1.6" />
          </g>
          {hi != null && <>
            <line className="cross" x1={X(hi)} x2={X(hi)} y1={pt} y2={H - pb} />
            <circle className="dotp" cx={X(hi)} cy={Y(S.p50[hi])} r="4" fill={C.cyan} stroke="#0A0A0D" strokeWidth="2" />
            <circle className="dotp" cx={X(hi)} cy={Y(S.p95[hi])} r="4" fill={C.violet} stroke="#0A0A0D" strokeWidth="2" />
            <circle className="dotp" cx={X(hi)} cy={Y(S.p99[hi])} r="4" fill={C.red} stroke="#0A0A0D" strokeWidth="2" />
          </>}
        </svg>
      </div>
    </motion.article>
  );
});
