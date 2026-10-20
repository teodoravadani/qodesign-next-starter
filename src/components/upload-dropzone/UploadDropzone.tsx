'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState,
} from 'react';
import './upload-dropzone.css';

export type UploadStatus = 'uploading' | 'done' | 'error';
export interface UploadItem {
  id: number; name: string; size: number; ext: string;
  progress: number; status: UploadStatus; message?: string; file?: File;
}
/** Real uploads: call onProgress(0-100) as bytes go out; resolve when done, reject to show Retry. */
export type Uploader = (file: File, onProgress: (pct: number) => void, signal: AbortSignal) => Promise<void>;
/** A File, or a fake file for demos: speed = share of the file per second, failAt = % where it fails once */
export type UploadInput = File | { name: string; size: number; simulate?: { speed?: number; failAt?: number | null } };

export interface UploadDropzoneProps {
  /** your uploader; without it uploads are simulated */
  upload?: Uploader;
  /** bytes; bigger files are refused with a message (default 50 MB) */
  maxSize?: number;
  /** passed to the file picker, e.g. "image/*,.pdf" */
  accept?: string;
  title?: string;
  hint?: string;
  /** small type chips under the hint */
  chips?: string[];
  onChange?: (items: UploadItem[]) => void;
  onAllDone?: (items: UploadItem[]) => void;
  /** fires on any real drag over the page (handy to pause a demo) */
  onUserActivity?: () => void;
}
export interface UploadDropzoneHandle {
  addFiles: (files: UploadInput[], from?: [number, number]) => void;
  setDragOver: (over: boolean, count?: number, at?: [number, number]) => void;
  shock: (x: number, y: number) => void;
  retry: (id: number) => void;
  clear: (animated?: boolean) => void;
  items: () => UploadItem[];
}

type Item = UploadItem & { speed: number; failAt: number | null; delay: number; from?: [number, number]; order: number; sim: boolean; ctrl?: AbortController; noRetry?: boolean };

const TYPES: Record<string, string> = { pdf: '#FF6B7A', png: '#B9A6FF', jpg: '#B9A6FF', jpeg: '#B9A6FF', gif: '#B9A6FF', webp: '#B9A6FF', svg: '#FF8FD1', zip: '#FFC85E', md: '#5EE1FF', txt: '#5EE1FF', mp4: '#5EE1FF', mov: '#5EE1FF', fig: '#FF8FD1' };
const fmt = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const extOf = (n: string) => (n.split('.').pop() || '').toLowerCase();
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function burst(host: HTMLElement, n = 14, dist = 34) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'qd-spark';
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4; const d = dist * (0.7 + Math.random() * 0.6);
    if (i % 3 === 1) s.style.background = '#F4F4F6';
    if (i % 3 === 2) { s.style.width = '4px'; s.style.height = '4px'; }
    host.appendChild(s);
    s.animate(
      [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.2)`, opacity: 0 }],
      { duration: 600 + Math.random() * 220, easing: 'cubic-bezier(.1,.8,.3,1)' },
    ).onfinish = () => s.remove();
  }
}
export { burst as uploadBurst };

const Doc = () => (<svg aria-hidden="true" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M15 9h10l6 6v18a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Z" /></svg>);

export const UploadDropzone = forwardRef<UploadDropzoneHandle, UploadDropzoneProps>(function UploadDropzone({
  upload, maxSize = 50 * 1024 * 1024, accept, title = 'Drop files here', hint = 'up to 50 MB each',
  chips = ['PDF', 'PNG', 'ZIP', 'MD', 'MP4'], onChange, onAllDone, onUserActivity,
}, ref) {
  const rm = useReducedMotion() ?? false;
  const items = useRef<Item[]>([]);
  const [, setV] = useState(0);
  const bump = () => setV((v) => v + 1);
  const [over, setOver] = useState<{ on: boolean; n?: number }>({ on: false });
  const [showEmpty, setShowEmpty] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [live, setLive] = useState('');
  const zone = useRef<HTMLDivElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const rows = useRef(new Map<number, HTMLLIElement>());
  const loop = useRef(0);
  const last = useRef(0);
  const seq = useRef(0);
  const cb = useRef({ onChange, onAllDone, onUserActivity, upload });
  cb.current = { onChange, onAllDone, onUserActivity, upload };

  const publicItems = (): UploadItem[] => items.current.map(({ id, name, size, ext, progress, status, message, file }) => ({ id, name, size, ext, progress, status, message, file }));
  const changed = () => { bump(); cb.current.onChange?.(publicItems()); };

  const finish = (o: Item) => {
    o.progress = 100; o.status = 'done';
    const el = rows.current.get(o.id)?.querySelector<HTMLElement>('.qd-ring');
    if (el && !reduced()) burst(el);
    setLive(`${o.name} uploaded.`);
    if (items.current.length && items.current.every((f) => f.status === 'done')) {
      setLive(`All ${items.current.length} files uploaded.`);
      cb.current.onAllDone?.(publicItems());
    }
  };
  const fail = (o: Item, msg: string) => {
    o.status = 'error'; o.message = msg; o.failAt = null;
    const el = rows.current.get(o.id);
    if (el && !reduced()) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
    setLive(`${o.name} failed. ${msg}.`);
  };

  const tick = useCallback((now: number) => {
    const dt = Math.min(0.05, (now - last.current) / 1000); last.current = now;
    let busy = false;
    items.current.forEach((o) => {
      if (o.status !== 'uploading' || !o.sim) return;
      busy = true;
      if (o.delay > 0) { o.delay -= dt; return; }
      const wob = 0.6 + 0.8 * Math.abs(Math.sin(now / 300 + o.id));
      o.progress = Math.min(100, o.progress + o.speed * 100 * dt * wob);
      if (o.failAt !== null && o.progress >= o.failAt) { o.progress = o.failAt; fail(o, `Connection dropped at ${Math.round(o.progress)}%`); }
      else if (o.progress >= 100) finish(o);
    });
    changed();
    loop.current = busy ? requestAnimationFrame(tick) : 0;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const kick = () => { if (!loop.current) { last.current = performance.now(); loop.current = requestAnimationFrame(tick); } };

  const startReal = (o: Item) => {
    const up = cb.current.upload;
    if (!up || !o.file) return;
    o.ctrl = new AbortController();
    up(o.file, (pct) => { o.progress = Math.max(0, Math.min(99.9, pct)); changed(); }, o.ctrl.signal)
      .then(() => { if (o.status === 'uploading') { finish(o); changed(); } })
      .catch((e) => { if (o.status === 'uploading' && !o.ctrl?.signal.aborted) { fail(o, e instanceof Error ? e.message : 'Upload failed'); changed(); } });
  };

  const addFiles = (list: UploadInput[], from?: [number, number]) => {
    const added = list.map((f, i) => {
      const isFile = typeof File !== 'undefined' && f instanceof File;
      const sim = isFile ? undefined : (f as { simulate?: { speed?: number; failAt?: number | null } }).simulate;
      const ext = extOf(f.name);
      const o: Item = {
        id: ++seq.current, name: f.name, size: f.size, ext, progress: 0, status: 'uploading',
        file: isFile ? (f as File) : undefined, speed: sim?.speed ?? 0.25 + Math.random() * 0.35, failAt: sim?.failAt ?? null,
        delay: 0, from, order: i, sim: !(isFile && cb.current.upload),
      };
      if (f.size > maxSize) { o.status = 'error'; o.message = `Too large · ${fmt(maxSize)} max`; o.noRetry = true; }
      return o;
    });
    items.current = [...items.current, ...added];
    setShowEmpty(false);
    setLive(`${added.length} file${added.length > 1 ? 's' : ''} added, uploading.`);
    added.forEach((o) => { if (o.status === 'uploading' && !o.sim) startReal(o); });
    changed(); kick();
  };
  const retry = (id: number) => {
    const o = items.current.find((x) => x.id === id);
    if (!o || o.status !== 'error' || o.noRetry) return;
    o.status = 'uploading'; o.message = ''; o.speed = Math.max(o.speed, 0.55); o.delay = 0.15;
    rows.current.get(id)?.classList.remove('shake');
    if (!o.sim) startReal(o);
    changed(); kick();
  };
  const remove = (id: number) => {
    const o = items.current.find((x) => x.id === id);
    o?.ctrl?.abort();
    items.current = items.current.filter((x) => x.id !== id);
    changed();
    if (items.current.length && items.current.every((f) => f.status === 'done')) cb.current.onAllDone?.(publicItems());
  };
  const clear = (animated = true) => {
    cancelAnimationFrame(loop.current); loop.current = 0;
    items.current.forEach((o) => o.ctrl?.abort());
    setClearing(animated && !reduced());
    items.current = [];
    setOver({ on: false });
    if (!animated || reduced()) setShowEmpty(true);
    changed();
  };
  const spot = (x: number, y: number) => {
    const r = zone.current?.getBoundingClientRect(); if (!r || !zone.current) return;
    zone.current.style.setProperty('--mx', `${x - r.left}px`); zone.current.style.setProperty('--my', `${y - r.top}px`);
  };
  const shock = (x: number, y: number) => {
    if (reduced() || !zone.current) return;
    const r = zone.current.getBoundingClientRect(); const s = document.createElement('i');
    s.className = 'qd-shock'; s.style.left = `${x - r.left}px`; s.style.top = `${y - r.top}px`;
    zone.current.appendChild(s); setTimeout(() => s.remove(), 720);
  };

  useImperativeHandle(ref, () => ({
    addFiles, retry, clear, shock, items: publicItems,
    setDragOver: (on, n, at) => { if (at) spot(at[0], at[1]); setOver({ on, n }); },
  }));

  // real drag & drop anywhere on the page; only the zone accepts
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types || [])].includes('Files');
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; };
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setOver({ on: false }); };
    const overH = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); cb.current.onUserActivity?.();
      const inZone = !!zone.current?.contains(e.target as Node);
      if (e.dataTransfer) e.dataTransfer.dropEffect = inZone ? 'copy' : 'none';
      if (inZone) { spot(e.clientX, e.clientY); setOver((o) => (o.on ? o : { on: true, n: e.dataTransfer?.items?.length })); } else setOver((o) => (o.on ? { on: false } : o));
    };
    const drop = (e: DragEvent) => {
      e.preventDefault(); depth = 0;
      const inZone = !!zone.current?.contains(e.target as Node);
      setOver({ on: false });
      if (!inZone || !e.dataTransfer?.files?.length) return;
      shock(e.clientX, e.clientY);
      addFiles([...e.dataTransfer.files], [e.clientX, e.clientY]);
    };
    addEventListener('dragenter', enter); addEventListener('dragleave', leave); addEventListener('dragover', overH); addEventListener('drop', drop);
    return () => { removeEventListener('dragenter', enter); removeEventListener('dragleave', leave); removeEventListener('dragover', overH); removeEventListener('drop', drop); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelAnimationFrame(loop.current), []);

  const list = items.current;
  const total = list.reduce((s, o) => s + o.size, 0) || 1;
  const pct = list.length ? (list.reduce((s, o) => s + (o.size * o.progress) / 100, 0) / total) * 100 : 0;
  const nDone = list.filter((o) => o.status === 'done').length;
  const nErr = list.filter((o) => o.status === 'error').length;
  const all = list.length > 0 && nDone === list.length;

  return (
    <div className="qd-upload">
      {/* hig-disable-next-line web/div-with-on-click-no-role -- pointer convenience only; the "browse your computer" button inside is the keyboard path */}
      <div
        ref={zone}
        className={`qd-zone${over.on ? ' over' : ''}`}
        onClick={(e) => { if (e.target !== pick.current) pick.current?.click(); }}
      >
        <svg aria-hidden="true" className="qd-edge"><rect x="1" y="1" rx="23" ry="23" style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }} /></svg>
        <div>
          <div className="qd-z-ico"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3M7 8l5-5 5 5" /><path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" /></svg></div>
          <p className="qd-z-t">{over.on ? (over.n ? `Release to upload ${over.n} file${over.n > 1 ? 's' : ''}` : 'Release to upload') : title}</p>
          <p className="qd-z-s">or <button type="button" className="qd-browse">browse your computer</button> · {hint}</p>
          {chips.length > 0 && <div className="qd-z-k" aria-hidden="true">{chips.map((c) => <span key={c}>{c}</span>)}</div>}
        </div>
        <input
          ref={pick} type="file" multiple hidden accept={accept}
          onChange={(e) => {
            const fs = [...(e.target.files || [])];
            if (fs.length && zone.current) { const r = zone.current.getBoundingClientRect(); addFiles(fs, [r.left + r.width / 2, r.top + r.height / 2]); }
            e.target.value = '';
          }}
        />
      </div>

      <section className="qd-panel" aria-label="Uploads">
        <div className={`qd-tot${all ? ' done' : ''}${nErr ? ' has-err' : ''}`}>
          <div className="qd-tot-row">
            <p className="qd-tot-l">
              {!list.length ? 'No files yet'
                : all ? (<><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>{list.length} files ready</>)
                  : nErr ? (<>{nDone} of {list.length} done · <span style={{ color: 'var(--err)' }}>{nErr} failed</span></>)
                    : `Uploading · ${nDone} of ${list.length} done`}
            </p>
            <span className="qd-tot-p">{Math.floor(pct)}%</span>
          </div>
          <div className="qd-track" role="progressbar" aria-label="Total upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(pct)}>
            <div className="qd-fillb" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
        </div>
        <ul className="qd-list">
          <AnimatePresence onExitComplete={() => { if (!items.current.length) { setShowEmpty(true); setClearing(false); } }}>
            {list.map((o, i) => (
              <Row
                key={o.id} o={o} rm={rm} index={i} clearing={clearing}
                bind={(el) => { if (el) rows.current.set(o.id, el); else rows.current.delete(o.id); }}
                onRetry={() => retry(o.id)} onRemove={() => remove(o.id)}
              />
            ))}
          </AnimatePresence>
        </ul>
        {showEmpty && !list.length && (<div className="qd-empty"><i /><i /><p>Dropped files show up here</p></div>)}
      </section>
      <p className="qd-sr" aria-live="polite">{live}</p>
    </div>
  );
});

function Row({ o, rm, index, clearing, bind, onRetry, onRemove }: {
  o: Item; rm: boolean; index: number; clearing: boolean;
  bind: (el: HTMLLIElement | null) => void; onRetry: () => void; onRemove: () => void;
}) {
  const el = useRef<HTMLLIElement | null>(null);
  // files fly from the drop point into their slot
  useLayoutEffect(() => {
    const li = el.current; if (!li) return;
    if (rm || !o.from) { li.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: o.order * 60, fill: 'backwards' }); return; }
    const r = li.getBoundingClientRect();
    const dx = o.from[0] - (r.left + r.width / 2); const dy = o.from[1] - (r.top + r.height / 2);
    const rot = (o.order % 2 ? 1 : -1) * (8 + o.order * 3);
    li.animate([
      { transform: `translate(${dx}px,${dy}px) scale(.3) rotate(${rot}deg)`, opacity: 0 },
      { opacity: 1, offset: 0.25 },
      { transform: `translate(${dx * 0.25}px,${dy * 0.25 - 30}px) scale(.9) rotate(${rot / 3}deg)`, offset: 0.7 },
      { transform: 'none', opacity: 1 },
    ], { duration: 760, delay: o.order * 95, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const p = Math.floor(o.progress);
  const meta = o.status === 'error' ? o.message : o.status === 'done' ? `${fmt(o.size)} · uploaded` : `${fmt((o.size * o.progress) / 100)} of ${fmt(o.size)}`;
  return (
    <motion.li
      ref={(n) => { el.current = n; bind(n); }}
      className={`qd-file${o.status === 'done' ? ' done' : ''}${o.status === 'error' ? ' err' : ''}`}
      exit={rm ? { opacity: 0, transition: { duration: 0.12 } } : clearing
        ? { opacity: 0, y: -10, scale: 0.97, transition: { duration: 0.24, delay: index * 0.05 } }
        : { opacity: 0, x: 30, scale: 0.96, transition: { duration: 0.26, ease: 'easeIn' } }}
    >
      <div className="qd-f-ico" style={{ ['--c' as string]: TYPES[o.ext] || '#8A8FA3' } as React.CSSProperties}><Doc /><span>{(o.ext || 'file').slice(0, 4).toUpperCase()}</span></div>
      <div className="qd-f-txt"><p className="qd-f-name">{o.name}</p><p className="qd-f-meta">{meta}</p></div>
      <div className="qd-f-side">
        <div className="qd-ring" role="progressbar" aria-label={`${o.name} upload progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}>
          <svg aria-hidden="true" viewBox="0 0 44 44" fill="none" strokeWidth="4" strokeLinecap="round"><circle className="qd-rt" cx="22" cy="22" r="17" /><circle className="qd-rp" cx="22" cy="22" r="17" pathLength={100} style={{ strokeDashoffset: 100 - o.progress }} /></svg>
          <b>{p}%</b>
          <span className="qd-ok"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 12.5 4 4 8-9" pathLength={1} /></svg></span>
        </div>
        <button className="qd-retry" aria-label={`Retry ${o.name}`} onClick={onRetry}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /></svg>Retry
        </button>
        <button className="qd-rm" aria-label={`Remove ${o.name}`} onClick={onRemove}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
    </motion.li>
  );
}

export default UploadDropzone;
