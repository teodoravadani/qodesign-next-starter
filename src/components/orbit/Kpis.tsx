'use client';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { KPIS, R, RANGES, type KpiKey, type RangeKey } from './data';
import { CountUp, Spark, useInterval } from './kit';
import { cardMotion } from './motionPresets';

type Series = Record<KpiKey, { val: number; hist: number[] }>;
function seed(): Series {
  const s = {} as Series;
  KPIS.forEach((k) => { s[k.key] = { val: k.base, hist: Array.from({ length: 24 }, () => k.base + (R() - 0.5) * k.jitter * 2) }; });
  return s;
}
const target = (key: KpiKey, base: number, f: number) => (key === 'apdex' ? Math.min(0.99, base * (2 - f) * 0.5 + base * 0.5) : key === 'rps' ? base * (2 - f) : base * f);

export function Kpis({ range, live }: { range: RangeKey; live: boolean }) {
  const [s, setS] = useState<Series>(seed);
  const [first, setFirst] = useState(true);
  useEffect(() => {
    const f = RANGES[range].k;
    setS((prev) => {
      const next = { ...prev };
      KPIS.forEach((k) => {
        const p = prev[k.key], v = target(k.key, k.base, f), last = p.hist[p.hist.length - 1];
        next[k.key] = { val: v, hist: p.hist.map((x) => x * (v / last)) };
      });
      return next;
    });
    const t = setTimeout(() => setFirst(false), 1500);
    return () => clearTimeout(t);
  }, [range]);
  useInterval(() => {
    setS((prev) => {
      const next = { ...prev };
      KPIS.forEach((k) => {
        const p = prev[k.key], nv = Math.max(0, p.val + (R() - 0.5) * k.jitter);
        next[k.key] = { val: p.val, hist: [...p.hist.slice(1), nv] };
      });
      return next;
    });
  }, live ? 1000 : null);
  return (
    <>
      {KPIS.map((k, i) => {
        const p = s[k.key];
        return (
          <motion.article key={k.key} className="card kpi" {...cardMotion(i)}>
            <div className="lbl">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={k.icon} /></svg>
              {k.label}
            </div>
            <div className="val">
              <CountUp value={p.hist[p.hist.length - 1]} decimals={k.d} duration={first ? 1.4 : 0.6} />
              {k.unit && <span>{k.unit}</span>}
            </div>
            <div className="foot">
              <span className={`delta ${k.good ? 'up' : 'down'}`}>{k.delta}<span className="vs">vs last week</span></span>
              <Spark data={p.hist} color={k.color} />
            </div>
          </motion.article>
        );
      })}
    </>
  );
}
