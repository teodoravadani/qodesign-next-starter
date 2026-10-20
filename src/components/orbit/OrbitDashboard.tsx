'use client';
import { LayoutGroup, MotionConfig, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { type RangeKey } from './data';
import { EventsTable, type Filter } from './EventsTable';
import { Kpis } from './Kpis';
import { LatencyChart, type LatencyHandle } from './LatencyChart';
import { Cluster, Deploys, Regions, Uptime } from './Panels';
import { ServiceMap, type ServiceMapHandle } from './ServiceMap';
import { TooltipProvider, useInterval } from './kit';
import { spring } from './motionPresets';
import './orbit.css';

const NAV: { label: string; d: string; badge?: number }[] = [
  { label: 'Overview', d: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  { label: 'Services', d: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.5 7.5 11 15.5M15.5 7.5 13 15.5M9 6h6' },
  { label: 'Traces', d: 'M3 6h10M3 12h18M3 18h7M17 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM14 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' },
  { label: 'Logs', d: 'M4 5h16M4 10h16M4 15h10M4 20h7' },
  { label: 'Deploys', d: 'M12 3v12m0 0-4-4m4 4 4-4M5 21h14' },
  { label: 'Alerts', d: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2ZM10 21h4', badge: 3 },
  { label: 'Settings', d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1' },
];
const RANGE_KEYS: RangeKey[] = ['15m', '1h', '24h', '7d'];

export interface OrbitDashboardProps {
  /** Run the hands-free tour while nobody touches the page (it pauses for 4 s after any input). Default true. */
  autoplayDemo?: boolean;
  /** Called when a sidebar item is chosen. */
  onNavigate?: (label: string) => void;
}

/** Orbit: an infra observability dashboard. Free, MIT, by qodesign.dev. */
export function OrbitDashboard(props: OrbitDashboardProps) {
  // The demo data uses live clock times and random values, so it renders after mount.
  // This keeps the server HTML and the first client render identical (no hydration warning in Next.js).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="orbit" style={{ minHeight: '100vh' }} aria-busy="true" />;
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider><Dashboard {...props} /></TooltipProvider>
    </MotionConfig>
  );
}

function Dashboard({ autoplayDemo = true, onNavigate }: OrbitDashboardProps) {
  const [range, setRange] = useState<RangeKey>('1h');
  const [live, setLive] = useState(true);
  const [page, setPage] = useState('Overview');
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [degraded, setDegraded] = useState<string | null>(null);
  const tick = useRef(0);
  const map = useRef<ServiceMapHandle>(null);
  const lat = useRef<LatencyHandle>(null);
  const search = useRef<HTMLInputElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);

  // payments degrades and recovers on a loop, so the map always has something to show
  useInterval(() => {
    tick.current++;
    if (tick.current % 16 === 5) setDegraded('pay');
    if (tick.current % 16 === 13) setDegraded(null);
  }, live ? 1000 : null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menu) { setMenu(false); menuBtn.current?.focus(); }
      const tag = (document.activeElement?.tagName ?? '');
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(tag)) { e.preventDefault(); search.current?.focus(); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [menu]);

  // hands-free tour; real input wins, and the tour comes back 4 s after the last input
  useEffect(() => {
    if (!autoplayDemo) return;
    let lastInput = -1e9, stop = false;
    const mark = (e: Event) => { if (e.isTrusted) lastInput = performance.now(); };
    const markMove = (e: PointerEvent) => { if (e.pointerType === 'mouse') mark(e); };
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    evs.forEach((t) => addEventListener(t, mark, { passive: true }));
    addEventListener('pointermove', markMove, { passive: true });
    const idle = () => performance.now() - lastInput > 4000;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps: (() => Promise<void>)[] = [
      async () => { map.current?.showNode('gw'); await wait(1800); },
      async () => { map.current?.showNode('pay'); await wait(1800); },
      async () => {
        map.current?.showNode(null);
        const n = lat.current?.points() ?? 48;
        for (let i = Math.floor(n * 0.35); i < n * 0.8 && idle() && !stop; i++) { lat.current?.hover(i); await wait(reduce ? 160 : 55); }
        await wait(900); lat.current?.hover(null);
      },
      async () => { setRange('24h'); await wait(1900); },
      async () => { setFilter('error'); await wait(1900); setFilter('all'); await wait(600); },
      async () => { setRange('1h'); await wait(1600); },
    ];
    (async () => {
      await wait(2600);
      for (let s = 0; !stop; ) {
        if (!idle() || document.hidden) { await wait(500); continue; }
        await steps[s % steps.length](); s++;
        if (!idle()) { map.current?.showNode(null); lat.current?.hover(null); }
        await wait(700);
      }
    })();
    return () => { stop = true; evs.forEach((t) => removeEventListener(t, mark)); removeEventListener('pointermove', markMove); };
  }, [autoplayDemo]);

  const onRangeKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = RANGE_KEYS.indexOf(range), n = RANGE_KEYS[(i + (e.key === 'ArrowRight' ? 1 : RANGE_KEYS.length - 1)) % RANGE_KEYS.length];
    setRange(n); (e.currentTarget.querySelector(`[data-r="${n}"]`) as HTMLElement | null)?.focus(); e.preventDefault();
  };

  return (
    <div className="orbit">
      <div className="app">
        <aside className={`side${menu ? ' open' : ''}`} id="orbit-side" aria-label="Main navigation">
          <div className="brand">
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="5" fill="#C6FF3D" /><ellipse cx="14" cy="14" rx="12" ry="5" fill="none" stroke="#8B6CFF" strokeWidth="2" transform="rotate(-25 14 14)" /><circle cx="24" cy="9.5" r="2" fill="#F4F4F6" /></svg>
            <span>orbit</span>
          </div>
          <div className="env" role="group" aria-label="Environment"><div><b>production</b><br /><span>halcyon-cloud · 9 services</span></div><i className="dot" aria-hidden="true" /></div>
          <LayoutGroup id="orbit-nav">
            <nav className="nav">
              {NAV.map((n) => (
                <a key={n.label} href="#" aria-current={page === n.label ? 'page' : undefined}
                  onClick={(e) => { e.preventDefault(); setPage(n.label); setMenu(false); onNavigate?.(n.label); }}>
                  {page === n.label && <motion.div layoutId="nav-ind" className="nav-ind" style={{ transform: 'none' }} transition={spring} aria-hidden="true" />}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={n.d} /></svg>
                  <span>{n.label}</span>
                  {n.badge && <em className="badge">{n.badge}</em>}
                </a>
              ))}
            </nav>
          </LayoutGroup>
          <div className="side-foot">
            <div className="oncall"><small>On call this week</small><div className="who"><span className="av" style={{ background: '#5EE1FF' }}>MR</span><div><b style={{ fontSize: 13 }}>Maya Reyes</b><br /><small>until Sun 09:00</small></div></div></div>
            <div className="credit">Free template by <a href="https://qodesign.dev/?utm_source=github&utm_medium=demo&utm_campaign=free_repo" target="_blank" rel="noopener">qodesign.dev</a></div>
          </div>
        </aside>
        {/* the scrim is a pointer shortcut; keyboard users close the drawer with Esc or the close button */}
      <div className={`scrim${menu ? ' on' : ''}`} onClick={() => setMenu(false)} aria-hidden="true" role="presentation" />

        <main className="main">
          <header className="top">
            <button ref={menuBtn} className="menu-btn" aria-label="Open navigation" aria-expanded={menu} aria-controls="orbit-side" onClick={() => setMenu(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
            </button>
            <div className="crumbs"><small>halcyon-cloud / production</small><h1>{page}</h1></div>
            <div className="top-r">
              <label className="search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <span className="sr">Search</span><input ref={search} placeholder="Search services, traces, logs" autoComplete="off" /><kbd>/</kbd>
              </label>
              <LayoutGroup id="orbit-range">
                <div className="seg" role="radiogroup" aria-label="Time range" onKeyDown={onRangeKey}>
                  {RANGE_KEYS.map((r) => (
                    <button key={r} role="radio" data-r={r} aria-checked={range === r} tabIndex={range === r ? 0 : -1} onClick={() => setRange(r)}>
                      {range === r && <motion.span layoutId="range-pill" className="seg-pill" style={{ inset: 0, top: 0, bottom: 0, zIndex: -1 }} transition={spring} />}
                      {r}
                    </button>
                  ))}
                </div>
              </LayoutGroup>
              <button className="live" aria-pressed={live} onClick={() => setLive((l) => !l)}><i aria-hidden="true" />Live</button>
            </div>
          </header>

          <section className="grid" aria-label="Service health">
            <Kpis range={range} live={live} />
            <ServiceMap ref={map} live={live} degraded={degraded} index={4} />
            <LatencyChart ref={lat} range={range} live={live} index={5} />
            <Uptime index={6} />
            <Regions live={live} index={7} />
            <Cluster live={live} index={8} />
            <Deploys live={live} index={9} />
            <EventsTable live={live} filter={filter} onFilter={setFilter} index={10} />
          </section>
        </main>
      </div>
    </div>
  );
}

export default OrbitDashboard;
