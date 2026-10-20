'use client';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { fmt, mkEvent, seedEvents, timeStr, type EventRow, type Level } from './data';
import { useInterval } from './kit';
import { cardMotion } from './motionPresets';

export type Filter = 'all' | Level;
type SortKey = keyof Pick<EventRow, 'ts' | 'svc' | 'lvl' | 'msg' | 'dur' | 'trace'>;
const COLS: [SortKey, string][] = [['ts', 'Time'], ['svc', 'Service'], ['lvl', 'Level'], ['msg', 'Message'], ['dur', 'Duration'], ['trace', 'Trace']];
const LVL_ORDER: Record<Level, number> = { error: 0, warn: 1, info: 2 };
const PER = 8;

/** Streaming event table: level filters, search, sortable columns, pagination. */
export function EventsTable({ live, filter, onFilter, index }: { live: boolean; filter: Filter; onFilter: (f: Filter) => void; index: number }) {
  const [rows, setRows] = useState<EventRow[]>(seedEvents);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'ts', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [newId, setNewId] = useState<number | null>(null);
  const [anim, setAnim] = useState(0); // bumps on every filter/sort/page change so rows stagger in again

  useInterval(() => {
    const e = mkEvent(Date.now());
    setRows((r) => [e, ...r].slice(0, 140));
    setNewId(e.id);
  }, live ? 3000 : null);

  const view = useMemo(() => {
    const s = sort.dir === 'asc' ? 1 : -1, k = sort.key, ql = q.trim().toLowerCase();
    return rows
      .filter((e) => (filter === 'all' || e.lvl === filter) && (!ql || `${e.svc} ${e.msg} ${e.trace}`.toLowerCase().includes(ql)))
      .sort((a, b) => { const A = k === 'lvl' ? LVL_ORDER[a.lvl] : a[k], B = k === 'lvl' ? LVL_ORDER[b.lvl] : b[k]; return (A > B ? 1 : A < B ? -1 : 0) * s; });
  }, [rows, filter, q, sort]);
  const pages = Math.max(1, Math.ceil(view.length / PER));
  const pg = Math.min(page, pages);
  const slice = view.slice((pg - 1) * PER, pg * PER);
  const counts = { all: rows.length, error: 0, warn: 0, info: 0 } as Record<Filter, number>;
  rows.forEach((e) => counts[e.lvl]++);
  const nums: (number | '…')[] = [];
  for (let p = 1; p <= pages; p++) { if (p === 1 || p === pages || Math.abs(p - pg) <= 1) nums.push(p); else if (nums[nums.length - 1] !== '…') nums.push('…'); }
  const go = (p: number) => { setPage(p); setAnim((a) => a + 1); };
  const sortBy = (k: SortKey) => { setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 'asc' ? 'desc' : 'asc') : k === 'ts' || k === 'dur' ? 'desc' : 'asc' })); setAnim((a) => a + 1); };
  const last = rows[0];

  return (
    <motion.article className="card ev-card" {...cardMotion(index)}>
      <div className="card-h"><h2>Events</h2><span className="sub">streaming · last {timeStr(last.ts)}</span></div>
      <div className="ev-tools">
        <div className="filters" role="group" aria-label="Filter by level">
          {(['all', 'error', 'warn', 'info'] as Filter[]).map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => { onFilter(f); go(1); }}>
              {f === 'all' ? 'All' : f === 'error' ? 'Errors' : f === 'warn' ? 'Warnings' : 'Info'}<span className="n">{counts[f]}</span>
            </button>
          ))}
        </div>
        <label className="ev-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span className="sr">Filter events</span>
          <input value={q} onChange={(e) => { setQ(e.target.value); go(1); }} placeholder="Filter by service or message" autoComplete="off" />
        </label>
      </div>
      <div className="tbl-wrap">
        <table aria-label="Events">
          <thead><tr>
            {COLS.map(([k, label]) => (
              <th key={k} aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button onClick={() => sortBy(k)}>{label}<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg></button>
              </th>
            ))}
          </tr></thead>
          <tbody key={anim}>
            {slice.length ? slice.map((e, i) => (
              <tr key={e.id} className={e.id === newId && pg === 1 && sort.key === 'ts' && sort.dir === 'desc' ? 'new' : anim ? 'enter' : 'enter'} style={{ ['--r' as string]: i }}>
                <td className="mono">{timeStr(e.ts)}</td><td>{e.svc}</td><td><span className={`lv ${e.lvl}`}>{e.lvl}</span></td>
                <td className="msg" title={e.msg}>{e.msg}</td><td className="mono">{fmt(e.dur)} ms</td><td className="mono">{e.trace}</td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="empty">No events match “{q || filter}”. Try another filter or clear the search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span className="num">{view.length ? (pg - 1) * PER + 1 : 0}–{Math.min(view.length, pg * PER)} of {view.length}</span>
        <div className="pages">
          <button aria-label="Previous page" disabled={pg === 1} onClick={() => go(pg - 1)}>‹</button>
          {nums.map((p, i) => p === '…' ? <span key={'e' + i} aria-hidden="true">…</span> :
            <button key={p} aria-label={`Page ${p}`} aria-current={p === pg ? 'page' : undefined} onClick={() => go(p)}>{p}</button>)}
          <button aria-label="Next page" disabled={pg === pages} onClick={() => go(pg + 1)}>›</button>
        </div>
      </div>
    </motion.article>
  );
}
