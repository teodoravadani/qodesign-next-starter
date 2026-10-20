'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { C, DEPLOYS, NEXT_DEPLOYS, R, REGIONS, RESOURCES, UPTIME, rand, type Deploy } from './data';
import { CountUp, TipRow, useInterval, useTip } from './kit';
import { cardMotion } from './motionPresets';

/** 90 days of uptime per service. Hover a day for details. */
export function Uptime({ index }: { index: number }) {
  const tip = useTip();
  return (
    <motion.article className="card up-card" {...cardMotion(index)}>
      <div className="card-h"><h2>Uptime</h2><span className="sub">last 90 days</span><div className="r"><span className="chip ok">SLO 99.95%</span></div></div>
      <div>
        {UPTIME.map((s, si) => (
          <div className="up-row" key={s.name}>
            <span className="nm">{s.name}</span>
            <div className="bars" role="img" aria-label={`${s.name}: ${s.pct.toFixed(2)}% uptime over 90 days`}>
              {s.days.map((d, i) => (
                <i key={i} className={d || undefined} style={{ animationDelay: `${500 + si * 60 + i * 5}ms` }}
                  onPointerEnter={(e) => {
                    const dt = new Date(Date.now() - (89 - i) * 864e5), rr = e.currentTarget.getBoundingClientRect();
                    tip.show(<><b>{s.name} · {dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</b>
                      <TipRow k="uptime" v={d === 'e' ? '97.92%' : d === 'w' ? '99.64%' : '100%'} />
                      <TipRow k="incidents" v={d === 'e' ? '1 outage' : d === 'w' ? '1 degraded' : 'none'} /></>, rr.left + rr.width / 2, rr.top);
                  }}
                  onPointerLeave={tip.hide} />
              ))}
            </div>
            <span className="pc">{s.pct.toFixed(2)}%</span>
          </div>
        ))}
      </div>
      <div className="up-axis" aria-hidden="true"><span>90d ago</span><span>45d</span><span>today</span></div>
      <div className="up-stats"><div><small>Incidents (30d)</small><b className="num">2</b></div><div><small>MTTR</small><b className="num">14 min</b></div><div><small>Last outage</small><b className="num">12 days ago</b></div></div>
    </motion.article>
  );
}

const BLOBS = [[60, 38, 44, 22], [100, 72, 18, 20], [170, 34, 22, 14], [182, 64, 18, 22], [240, 42, 48, 20], [284, 78, 16, 9]];
const DOTS: [number, number][] = [];
for (let y = 6; y < 96; y += 6) for (let x = 4; x < 320; x += 6) if (BLOBS.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1)) DOTS.push([x, y]);

export function Regions({ live, index }: { live: boolean; index: number }) {
  const reduce = useReducedMotion();
  const [ms, setMs] = useState(() => REGIONS.map((r) => r.ms));
  const [grown, setGrown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGrown(true), 300); return () => clearTimeout(t); }, []);
  useInterval(() => setMs((m) => m.map((v) => Math.max(8, Math.min(108, Math.round(v + (R() - 0.5) * 6))))), live ? 2000 : null);
  return (
    <motion.article className="card reg-card" {...cardMotion(index)}>
      <div className="card-h"><h2>Regions</h2><span className="sub">edge round-trip</span></div>
      <div className="globe" aria-hidden="true">
        <svg viewBox="0 0 320 96" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
          {DOTS.map(([x, y]) => <circle key={x + '-' + y} cx={x} cy={y} r="1.2" fill={C.line} />)}
          <path d="M96 40Q133 8 170 30M170 30Q223 4 276 38M96 40Q73 26 50 34M170 30Q198 30 226 52" fill="none" stroke={C.violet} strokeWidth="1" strokeDasharray="2 3" opacity=".7" />
          {REGIONS.map((r, i) => (
            <g key={r.n}>
              <circle cx={r.x} cy={r.y} r="3" fill={C[r.col]} />
              {!reduce && <motion.circle cx={r.x} cy={r.y} fill="none" stroke={C[r.col]} strokeWidth="1" initial={{ r: 3, opacity: 0.9 }} animate={{ r: 12, opacity: 0 }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.45, ease: 'linear' }} />}
            </g>
          ))}
        </svg>
      </div>
      <div className="reg">
        {REGIONS.map((r, i) => (
          <div className="reg-row" key={r.n}>
            <span className="flag" style={{ background: C[r.col] }} />
            <div><div className="nm">{r.n}<span>{r.c}</span></div><div className="track"><i style={{ width: grown ? `${Math.min(100, (ms[i] / 110) * 100)}%` : 0 }} /></div></div>
            <span className="ms num" style={{ color: ms[i] > 80 ? C.amber : undefined }}>{ms[i]} ms</span>
          </div>
        ))}
      </div>
    </motion.article>
  );
}

const CIRC = 2 * Math.PI * 26;
export function Cluster({ live, index }: { live: boolean; index: number }) {
  const [v, setV] = useState(() => RESOURCES.map(() => 0));
  useEffect(() => { const t = setTimeout(() => setV(RESOURCES.map((r) => r.v)), 200); return () => clearTimeout(t); }, []);
  useInterval(() => setV((cur) => cur.map((x) => Math.max(12, Math.min(94, Math.round(x + (R() - 0.5) * 8))))), live ? 2000 : null);
  return (
    <motion.article className="card res-card" {...cardMotion(index)}>
      <div className="card-h"><h2>Cluster</h2><span className="sub">42 nodes</span></div>
      <div className="rings">
        {RESOURCES.map((r, i) => (
          <div className="ringrow" key={r.n}>
            <svg viewBox="0 0 64 64" aria-hidden="true"><circle className="bg" cx="32" cy="32" r="26" />
              <circle className="fg" cx="32" cy="32" r="26" stroke={C[r.col]} strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - v[i] / 100)} /></svg>
            <div><CountUp value={v[i]} suffix="%" className="num" duration={1} /><small>{r.n} · {r.sub}</small></div>
          </div>
        ))}
      </div>
    </motion.article>
  );
}

export function Deploys({ live, index }: { live: boolean; index: number }) {
  const [deps, setDeps] = useState<Deploy[]>(DEPLOYS);
  const [nextIdx, setNextIdx] = useState(0);
  const [budget, setBudget] = useState(0);
  useEffect(() => { const t = setTimeout(() => setBudget(68), 500); return () => clearTimeout(t); }, []);
  useInterval(() => {
    const d = deps[0]; if (d.st !== 'run') return;
    const p = Math.min(100, (d.p ?? 0) + rand(6, 14));
    if (p < 100) { setDeps([{ ...d, p }, ...deps.slice(1)]); return; }
    setDeps([{ ...d, p: 100, st: 'ok', t: 'just now' }, ...deps.slice(1)]);
    setTimeout(() => {
      setDeps((cur) => [{ ...NEXT_DEPLOYS[nextIdx % NEXT_DEPLOYS.length], t: 'now', st: 'run', p: 4 } as Deploy, ...cur.map((x) => (x.t === 'just now' ? { ...x, t: '1 min ago' } : x))].slice(0, 4));
      setNextIdx((n) => n + 1);
    }, 2600);
  }, live ? 2000 : null);
  return (
    <motion.article className="card dep-card" {...cardMotion(index)}>
      <div className="card-h"><h2>Deploys</h2><span className="sub">today</span></div>
      <div className="deps" aria-live="polite">
        {deps.map((d, i) => (
          <motion.div key={d.sha} layout="position" initial={i === 0 && d.st === 'run' && d.p === 4 ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} className={`dep ${d.st}`}>
            <span className="pin"><i /></span>
            <div style={{ minWidth: 0 }}>
              <div className="t"><code>{d.sha}</code>{d.msg}</div>
              <div className="m">{d.svc} · {d.who} · {d.t}{d.note ? ' · ' + d.note : ''}</div>
              {d.st === 'run' && <div className="prog" role="progressbar" aria-label={`Rolling out ${d.sha}`} aria-valuenow={Math.round(d.p ?? 0)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${d.p}%` }} /></div>}
            </div>
            <span className={`chip ${d.st === 'ok' ? 'ok' : d.st === 'fail' ? 'err' : 'info'}`}>{d.st === 'ok' ? 'live' : d.st === 'fail' ? 'failed' : Math.round(d.p ?? 0) + '%'}</span>
          </motion.div>
        ))}
      </div>
      <div className="budget">
        <div className="budget-h"><span>Error budget · 30 days</span><CountUp value={budget} suffix="% left" className="num" duration={1.4} /></div>
        <div className="budget-track" role="progressbar" aria-label="Error budget left" aria-valuemin={0} aria-valuemax={100} aria-valuenow={budget}><i style={{ width: `${budget}%` }} /><em style={{ left: '25%' }} /></div>
        <div className="budget-f"><span>burn rate <b className="num">0.8×</b></span><span>13 m 4 s of downtime left</span></div>
      </div>
    </motion.article>
  );
}
