// Mock data and helpers for Orbit. Replace these with your own API calls.
export type RangeKey = '15m' | '1h' | '24h' | '7d';
export const RANGES: Record<RangeKey, { k: number; pts: number; u: string; labels: [string, string, string] }> = {
  '15m': { k: 0.92, pts: 30, u: 'min', labels: ['-15m', '-7m', 'now'] },
  '1h': { k: 1, pts: 48, u: 'min', labels: ['-60m', '-30m', 'now'] },
  '24h': { k: 1.12, pts: 48, u: 'h', labels: ['-24h', '-12h', 'now'] },
  '7d': { k: 1.25, pts: 42, u: 'd', labels: ['-7d', '-3d', 'now'] },
};
export const C = { lime: '#C6FF3D', violet: '#8B6CFF', cyan: '#5EE1FF', amber: '#FFB547', red: '#FF5C7A', line: '#262A36', text: '#F4F4F6', muted: '#8A8FA3' };
export type ColorKey = 'lime' | 'violet' | 'cyan' | 'amber' | 'red';

/** Seeded random, so the first frame always looks the same. */
export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const R = rng(7);
export const rand = (a: number, b: number) => a + (b - a) * R();
export const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export type KpiKey = 'rps' | 'p95' | 'err' | 'apdex';
export const KPIS: { key: KpiKey; label: string; unit?: string; base: number; d: number; jitter: number; color: ColorKey; delta: string; good: boolean; icon: string }[] = [
  { key: 'rps', label: 'Requests / sec', base: 12483, d: 0, jitter: 380, color: 'lime', delta: '+4.2%', good: true, icon: 'M3 12h4l3-8 4 16 3-8h4' },
  { key: 'p95', label: 'p95 latency', unit: 'ms', base: 182, d: 0, jitter: 9, color: 'violet', delta: '−12 ms', good: true, icon: 'M12 9v4l2 2M9 2h6M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0' },
  { key: 'err', label: 'Error rate', unit: '%', base: 0.42, d: 2, jitter: 0.05, color: 'red', delta: '+0.08 pt', good: false, icon: 'M12 3 2 21h20L12 3ZM12 10v4M12 17.5v.5' },
  { key: 'apdex', label: 'Apdex', unit: 'of 1.00', base: 0.97, d: 2, jitter: 0.008, color: 'cyan', delta: '+0.01', good: true, icon: 'M20 6 9 17l-5-5' },
];

export type Health = 'ok' | 'degraded';
export interface SvcNode { id: string; name: string; code: string; x: number; y: number; rps: number; p95: number; err: number }
export const NODES: SvcNode[] = [
  { id: 'edge', name: 'edge-proxy', code: 'EDGE', x: 64, y: 164, rps: 12480, p95: 21, err: 0.01 },
  { id: 'gw', name: 'api-gateway', code: 'API', x: 184, y: 164, rps: 11920, p95: 48, err: 0.05 },
  { id: 'auth', name: 'auth', code: 'AUTH', x: 316, y: 52, rps: 3410, p95: 64, err: 0.02 },
  { id: 'orders', name: 'orders', code: 'ORD', x: 330, y: 160, rps: 4820, p95: 142, err: 0.31 },
  { id: 'search', name: 'search', code: 'SRCH', x: 316, y: 262, rps: 2650, p95: 96, err: 0.08 },
  { id: 'pay', name: 'payments', code: 'PAY', x: 470, y: 96, rps: 1290, p95: 238, err: 0.62 },
  { id: 'pg', name: 'postgres', code: 'PG', x: 584, y: 160, rps: 6210, p95: 12, err: 0 },
  { id: 'redis', name: 'redis', code: 'RDS', x: 470, y: 200, rps: 9840, p95: 2, err: 0 },
  { id: 'kafka', name: 'kafka', code: 'KFK', x: 470, y: 280, rps: 3100, p95: 6, err: 0 },
];
export const EDGES: [string, string, number][] = [['edge','gw',1],['gw','auth',.45],['gw','orders',.7],['gw','search',.5],['orders','pay',.4],['orders','pg',.6],['orders','redis',.55],['auth','redis',.35],['pay','pg',.35],['search','redis',.45],['search','kafka',.3],['orders','kafka',.3],['auth','pg',.25]];

export interface Latency { p50: number[]; p95: number[]; p99: number[] }
export function genLatency(range: RangeKey): Latency {
  const n = RANGES[range].pts, f = RANGES[range].k, out: Latency = { p50: [], p95: [], p99: [] };
  let b = 70 * f;
  for (let i = 0; i < n; i++) {
    b += (R() - .5) * 8; b = Math.max(52 * f, Math.min(92 * f, b));
    const spike = i > n * .62 && i < n * .7 ? 1.7 : 1;
    out.p50.push(b); out.p95.push(b * 2.5 * spike + R() * 14); out.p99.push(b * 3.6 * spike + R() * 30);
  }
  return out;
}

export type Day = '' | 'w' | 'e';
export const UPTIME = ['edge-proxy', 'api-gateway', 'orders', 'payments', 'search'].map((name, si) => {
  const days: Day[] = [];
  for (let d = 0; d < 90; d++) { const r = R(); days.push(r > .994 - si * .001 ? 'e' : r > .976 - si * .003 ? 'w' : ''); }
  if (name === 'payments') { days[86] = 'w'; days[88] = 'w'; }
  const pct = 100 - days.filter((x) => x === 'e').length * .023 - days.filter((x) => x === 'w').length * .004;
  return { name, days, pct };
});

export interface Region { n: string; c: string; ms: number; x: number; y: number; col: ColorKey }
export const REGIONS: Region[] = [
  { n: 'us-east-1', c: 'Virginia', ms: 18, x: 96, y: 40, col: 'lime' }, { n: 'us-west-2', c: 'Oregon', ms: 31, x: 50, y: 34, col: 'lime' },
  { n: 'eu-central-1', c: 'Frankfurt', ms: 24, x: 170, y: 30, col: 'lime' }, { n: 'ap-south-1', c: 'Mumbai', ms: 88, x: 226, y: 52, col: 'amber' },
  { n: 'ap-northeast-1', c: 'Tokyo', ms: 64, x: 276, y: 38, col: 'lime' },
];
export const RESOURCES: { n: string; v: number; col: ColorKey; sub: string }[] = [
  { n: 'CPU', v: 62, col: 'lime', sub: '264 of 424 cores' }, { n: 'Memory', v: 71, col: 'violet', sub: '1.4 of 2.0 TB' }, { n: 'Disk I/O', v: 38, col: 'cyan', sub: '2.1 GB/s peak' },
];

export interface Deploy { sha: string; svc: string; msg: string; who: string; t: string; st: 'run' | 'ok' | 'fail'; p?: number; note?: string }
export const DEPLOYS: Deploy[] = [
  { sha: 'a41f9c2', svc: 'orders', msg: 'cache order totals in redis', who: 'Maya R.', t: 'now', st: 'run', p: 18 },
  { sha: '9be0d17', svc: 'search', msg: 'bump index shards to 12', who: 'Jon K.', t: '42 min ago', st: 'ok' },
  { sha: '3c7a5e0', svc: 'payments', msg: 'retry idempotent captures', who: 'Lena V.', t: '2 h ago', st: 'fail', note: 'rolled back' },
  { sha: 'f02d8b4', svc: 'auth', msg: 'rotate session signing key', who: 'Sam O.', t: '4 h ago', st: 'ok' },
];
export const NEXT_DEPLOYS = [
  { sha: 'c88e214', svc: 'api-gateway', msg: 'tighten rate limits', who: 'Jon K.' }, { sha: '17ad0f3', svc: 'search', msg: 'warm cache on boot', who: 'Lena V.' },
  { sha: 'e5b9a61', svc: 'auth', msg: 'add trace sampling', who: 'Sam O.' }, { sha: '4d20c7b', svc: 'orders', msg: 'pool db connections', who: 'Maya R.' },
];

export type Level = 'error' | 'warn' | 'info';
export interface EventRow { id: number; ts: number; svc: string; lvl: Level; msg: string; dur: number; trace: string }
const SVCS = ['api-gateway', 'orders', 'payments', 'auth', 'search', 'edge-proxy', 'worker'];
const MSG: Record<Level, string[]> = {
  error: ['upstream timeout after 3000 ms', 'card capture failed: 502 from processor', 'deadlock detected on order_items', 'connection reset by peer', 'TLS handshake failed for client'],
  warn: ['slow query 1.8 s on SELECT orders', 'retry 2 of 3 for idempotency key', 'cache miss ratio above 30%', 'queue lag 4.2 s on order.created', 'p95 over budget for 5 min'],
  info: ['deploy a41f9c2 started', 'autoscaled to 14 replicas', 'cert renewed for api.halcyon.dev', 'health check passed', 'flag new-checkout at 25%'],
};
const hex = (n: number) => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(R() * 16)]).join('');
let evId = 0;
export function mkEvent(ts: number): EventRow {
  const r = R(), lvl: Level = r < .18 ? 'error' : r < .45 ? 'warn' : 'info';
  return { id: ++evId, ts, svc: SVCS[Math.floor(R() * SVCS.length)], lvl, msg: MSG[lvl][Math.floor(R() * 5)],
    dur: Math.round(lvl === 'error' ? rand(900, 3200) : lvl === 'warn' ? rand(300, 1900) : rand(4, 220)), trace: hex(8) };
}
export function seedEvents(): EventRow[] { const out: EventRow[] = []; let t = Date.now(); for (let i = 0; i < 64; i++) { t -= rand(2, 40) * 1000; out.push(mkEvent(t)); } return out; }
export const timeStr = (ts: number) => new Date(ts).toLocaleTimeString('en-GB', { hour12: false });
