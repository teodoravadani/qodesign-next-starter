'use client';
import {
  AnimatePresence, motion, useReducedMotion,
} from 'framer-motion';
import React, {
  ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore,
} from 'react';
import './toast-stack.css';

/* ------------------------------------------------------------------ store */
export type ToastType = 'success' | 'error' | 'info' | 'loading';
export interface ToastAction { label: string; onClick: () => void; keepOpen?: boolean }
export interface ToastOptions { description?: ReactNode; action?: ToastAction; duration?: number }
export interface ToastData extends ToastOptions {
  id: number; type: ToastType; title: ReactNode;
  resolving?: boolean; bloom?: number;
}
type Msg = { title: ReactNode; description?: ReactNode };

let items: ToastData[] = [];
let seq = 0;
const exitDir = new Map<number, number>();
const listeners = new Set<() => void>();
const emit = () => { items = [...items]; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getItems = () => items;
const patch = (id: number, p: Partial<ToastData>) => { items = items.map((t) => (t.id === id ? { ...t, ...p } : t)); emit(); };

function create(type: ToastType, title: ReactNode, o: ToastOptions = {}) {
  const id = ++seq;
  items = [...items, { id, type, title, ...o }];
  emit();
  return id;
}
function dismiss(id: number, dir = 0) {
  if (!items.some((t) => t.id === id)) return;
  exitDir.set(id, dir);
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Fire toasts from anywhere: toast.success('Saved'), toast.promise(p, {...}) */
export const toast = Object.assign(
  (title: ReactNode, o?: ToastOptions) => create('info', title, o),
  {
    success: (title: ReactNode, o?: ToastOptions) => create('success', title, o),
    error: (title: ReactNode, o?: ToastOptions) => create('error', title, o),
    info: (title: ReactNode, o?: ToastOptions) => create('info', title, o),
    /** loading spinner → morphs into a success check (or an error) when the promise settles */
    promise<T>(p: Promise<T>, m: { loading: Msg; success: (v: T) => Msg; error?: (e: unknown) => Msg }, o: ToastOptions = {}) {
      const id = create('loading', m.loading.title, { ...o, description: m.loading.description });
      const born = Date.now();
      const settle = (type: ToastType, msg: Msg) => setTimeout(() => {
        // keep the spinner up for at least 600 ms so fast promises don't flash
        if (!items.some((t) => t.id === id)) return;
        if (type === 'success') patch(id, { resolving: true });
        setTimeout(() => {
          if (!items.some((t) => t.id === id)) return;
          patch(id, { type, title: msg.title, description: msg.description, resolving: false, bloom: Date.now() });
        }, reduced() ? 120 : 380);
      }, Math.max(0, 600 - (Date.now() - born)));
      p.then((v) => settle('success', m.success(v)), (e) => settle('error', m.error ? m.error(e) : { title: 'Something went wrong' }));
      return id;
    },
    dismiss: (id: number, direction = 0) => dismiss(id, direction),
    clear: () => {
      const ids = [...items].map((t) => t.id);
      ids.forEach((id, i) => setTimeout(() => dismiss(id), reduced() ? 0 : i * 70));
    },
  },
);

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Scripted demos (and tests) can drag a toast like a pointer would. */
type DragApi = { drag: (dx: number) => void; release: (velocity: number) => void };
const dragApis = new Map<number, DragApi>();
export const toastDrag = {
  move: (id: number, dx: number) => dragApis.get(id)?.drag(dx),
  release: (id: number, velocity = 0) => dragApis.get(id)?.release(velocity),
};
export const getToasts = () => items;

/* ------------------------------------------------------------------ icons */
const ICONS: Record<Exclude<ToastType, 'loading'>, ReactNode> = {
  success: (<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.5" /><path d="m7.8 12.3 2.8 2.8 5.6-5.8" /></svg>),
  error: (<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.2 2.6 19.5h18.8Z" /><path d="M12 9.5v4.3M12 16.8v.1" /></svg>),
  info: (<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.5" /><path d="M12 11v5.5M12 7.6v.1" /></svg>),
};
const Spinner = () => (
  <svg aria-hidden="true" className="qd-spin" viewBox="0 0 24 24" fill="none" strokeWidth="2.6" strokeLinecap="round">
    <circle className="qd-trk" cx="12" cy="12" r="9.5" />
    <circle className="qd-arc" cx="12" cy="12" r="9.5" pathLength={60} />
    <circle className="qd-fill" cx="12" cy="12" r="11" stroke="none" />
    <path className="qd-chk" d="m7.6 12.4 3 3 5.8-6" pathLength={1} strokeWidth="2.8" strokeLinejoin="round" />
  </svg>
);

function burst(host: HTMLElement) {
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('i');
    s.className = 'qd-spark';
    const a = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
    const d = 30 + Math.random() * 26;
    if (i % 3 === 1) s.style.background = '#F4F4F6';
    if (i % 3 === 2) { s.style.width = '4px'; s.style.height = '4px'; }
    host.appendChild(s);
    s.animate(
      [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.2)`, opacity: 0 }],
      { duration: 620 + Math.random() * 200, easing: 'cubic-bezier(.1,.8,.3,1)' },
    ).onfinish = () => s.remove();
  }
}

/* ------------------------------------------------------------------ toaster */
export interface ToasterProps {
  /** width of the stack in px (full width minus 24 px on phones) */
  width?: number;
  /** gap between toasts when the stack is fanned out */
  gap?: number;
  /** how many cards show in the collapsed deck */
  visibleToasts?: number;
  /** auto-dismiss after this many ms (paused while fanned out or loading) */
  duration?: number;
  /** blur + tint the content behind the fanned-out list */
  backdrop?: boolean;
  /** position: 'fixed' to the viewport (default) or 'absolute' inside a positioned parent */
  strategy?: 'fixed' | 'absolute';
  /** control the fan-out from outside (scripted demos); undefined = hover/focus */
  expanded?: boolean;
  /** pause every timer (scripted demos) */
  paused?: boolean;
  /** called when hover/focus wants the stack open or closed */
  onExpandedChange?: (open: boolean) => void;
}

const PEEK = 16;

export function Toaster({
  width = 432, gap = 10, visibleToasts = 3, duration = 5000, backdrop = true,
  strategy = 'fixed', expanded: controlled, paused = false, onExpandedChange,
}: ToasterProps) {
  const all = useSyncExternalStore(subscribe, getItems, getItems);
  const list = [...all].reverse();               // newest first
  const rm = useReducedMotion() ?? false;
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const region = useRef<HTMLElement>(null);
  const open = (controlled ?? (hover || focus)) && list.length > 0;

  useEffect(() => { onExpandedChange?.(hover || focus); }, [hover, focus, onExpandedChange]);
  useEffect(() => { if (!list.length) { setHover(false); setFocus(false); } }, [list.length]);

  // Alt+T jumps to the newest toast
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'KeyT') {
        e.preventDefault();
        (region.current?.querySelector<HTMLElement>('.qd-toast:not([inert])') ?? region.current)?.focus();
      }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  const setH = useCallback((id: number, h: number) => setHeights((m) => (m[id] === h ? m : { ...m, [id]: h })), []);
  const frontH = list.length ? heights[list[0].id] ?? 0 : 0;
  let acc = 0;
  const pos = list.map((t, i) => {
    const h = heights[t.id] ?? 0;
    if (open) { const y = -acc; acc += h + gap; return { y, s: 1, op: 1, h }; }
    return { y: -PEEK * i, s: 1 - i * 0.055, op: i < visibleToasts ? 1 - i * 0.12 : 0, h: i === 0 ? h : frontH };
  });
  const total = open ? Math.max(0, acc - gap) : list.length ? frontH + PEEK * Math.min(list.length - 1, visibleToasts - 1) : 0;
  const fixed = strategy === 'fixed' ? ' qd-fixed' : '';

  return (
    <>
      {backdrop && (
        <div className={`qd-scrim${fixed}${open ? ' on' : ''}`} aria-hidden="true" />
      )}
      <section
        ref={region}
        className={`qd-toaster${fixed}`}
        style={{ ['--qd-w' as string]: `${width}px` } as React.CSSProperties}
        aria-label="Notifications (Alt+T)"
        tabIndex={-1}
        onPointerEnter={(e) => { if (e.pointerType !== 'touch') setHover(true); }}
        onPointerLeave={() => setHover(false)}
        onFocus={() => setFocus(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocus(false); }}
        onClick={(e) => { if (!open && (e.target as HTMLElement).closest('.qd-toast')) setHover(true); }}
      >
        <ol aria-live="polite" aria-relevant="additions text" style={{ height: total }}>
          <AnimatePresence initial={false}>
            {list.map((t, i) => (
              <ToastItem
                key={t.id} t={t} i={i} pos={pos[i]} open={open} rm={rm}
                back={!open && i > 0} paused={paused || open} hideBar={paused} duration={t.duration ?? duration}
                onHeight={setH}
                yAbove={pos[i].y}
              />
            ))}
          </AnimatePresence>
        </ol>
        <div className={`qd-tw-head${open && list.length > 1 ? ' on' : ''}`} style={{ bottom: total + 8 }}>
          <p>Notifications<b>{list.length}</b></p>
          <button className="qd-clear" onClick={() => toast.clear()}>Clear all</button>
        </div>
      </section>
    </>
  );
}

function ToastItem({ t, i, pos, open, rm, back, paused, hideBar, duration, onHeight, yAbove }: {
  t: ToastData; i: number; pos: { y: number; s: number; op: number; h: number }; open: boolean; rm: boolean;
  back: boolean; paused: boolean; hideBar: boolean; duration: number; onHeight: (id: number, h: number) => void; yAbove: number;
}) {
  const el = useRef<HTMLLIElement>(null);
  const ico = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [won, setWon] = useState(false);
  const [bloomKey, setBloomKey] = useState(0);
  const [ringDone, setRingDone] = useState(false);
  const wasLoading = useRef(t.type === 'loading');

  // natural height (scrollHeight ignores the collapsed height we set)
  useLayoutEffect(() => {
    if (el.current) onHeight(t.id, el.current.scrollHeight);
  }, [t.id, t.title, t.description, t.type, onHeight]);

  // the payoff: ring flashes lime, check fills, sparks fly, toast pops
  useEffect(() => {
    if (!t.bloom) return;
    if (wasLoading.current) setRingDone(true);
    wasLoading.current = false;
    if (rm) return;
    setBloomKey(t.bloom); setWon(true);
    if (ico.current) burst(ico.current);
    el.current?.animate([{ scale: '1' }, { scale: '1.045' }, { scale: '.985' }, { scale: '1' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)', composite: 'add' });
    const k = setTimeout(() => setWon(false), 900);
    return () => clearTimeout(k);
  }, [t.bloom, rm]);

  // auto-dismiss timer with a draining bar; pauses while fanned out / loading
  const left = useRef(duration);
  useEffect(() => {
    const b = bar.current;
    const stop = paused || t.type === 'loading' || t.resolving;
    if (!b) return;
    if (stop) {
      b.style.transition = 'none';
      b.style.transform = `scaleX(${t.type === 'loading' || hideBar ? 0 : left.current / duration})`;
      return;
    }
    const start = performance.now();
    b.style.transition = 'none';
    b.style.transform = `scaleX(${left.current / duration})`;
    void b.offsetWidth;
    b.style.transition = `transform ${left.current}ms linear`;
    b.style.transform = 'scaleX(0)';
    const k = setTimeout(() => dismiss(t.id), left.current);
    return () => { clearTimeout(k); left.current = Math.max(0, left.current - (performance.now() - start)); };
  }, [paused, hideBar, t.type, t.resolving, t.id, duration]);

  // swipe to dismiss (pointer + scripted)
  const drag = useRef({ on: false, sx: 0, st: 0, pid: -1 });
  const release = useCallback((v: number) => {
    setDragging(false);
    setX((cur) => {
      if (Math.abs(cur) > 100 || Math.abs(v) > 0.6) { dismiss(t.id, Math.sign(cur || v)); return cur; }
      return 0;
    });
  }, [t.id]);
  useEffect(() => {
    dragApis.set(t.id, { drag: (dx) => { setDragging(true); setX(dx); }, release });
    return () => { dragApis.delete(t.id); };
  }, [t.id, release]);

  const dir = exitDir.get(t.id) ?? 0;
  const spring = rm ? { duration: 0.2 } : { type: 'spring' as const, stiffness: 420, damping: 27, mass: 0.9, delay: open ? i * 0.035 : 0 };
  const type = t.type;

  return (
    <motion.li
      ref={el}
      layout={false}
      tabIndex={back ? -1 : 0}
      role={type === 'error' ? 'alert' : 'status'}
      data-type={type}
      {...(back ? ({ inert: '' } as Record<string, string>) : {})}
      className={`qd-toast${back ? ' back' : ''}${dragging ? ' drag' : ''}${won ? ' won' : ''}${bloomKey ? ' bloom' : ''}`}
      style={{ height: pos.h || undefined, zIndex: 100 - i, pointerEvents: pos.op ? undefined : 'none', bottom: rm ? -pos.y : 0 }}
      initial={rm ? { opacity: 0 } : { opacity: 0, y: 90, scale: 0.9, x: 0 }}
      animate={rm
        ? { opacity: pos.op }
        : { opacity: dragging ? Math.max(0.15, 1 - Math.abs(x) / 320) : pos.op, y: pos.y, scale: pos.s, x, rotate: dragging ? x * 0.025 : 0 }}
      transition={dragging ? { duration: 0 } : spring}
      exit={rm
        ? { opacity: 0, transition: { duration: 0.2 } }
        : dir
          ? { x: dir * 440, rotate: dir * 14, opacity: 0, transition: { duration: 0.42, ease: [0.3, 0.7, 0.4, 1] } }
          : { y: yAbove + 18, scale: 0.9, opacity: 0, transition: { duration: 0.3 } }}
      onPointerDown={(e) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
        drag.current = { on: true, sx: e.clientX, st: performance.now(), pid: e.pointerId };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d.on || e.pointerId !== d.pid) return;
        setDragging(true); setX(e.clientX - d.sx);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (!d.on || e.pointerId !== d.pid) return;
        d.on = false;
        release((e.clientX - d.sx) / Math.max(1, performance.now() - d.st));
      }}
      onPointerCancel={() => { drag.current.on = false; release(0); }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || !['Escape', 'Delete', 'Backspace'].includes(e.key)) return;
        e.preventDefault();
        const next = e.currentTarget.nextElementSibling as HTMLElement | null;
        dismiss(t.id);
        (next ?? (e.currentTarget.closest('.qd-toaster') as HTMLElement | null))?.focus();
      }}
    >
      <div className={`qd-t-ring${t.resolving ? ' done' : ''}${ringDone ? ' done fade' : ''}`}><i /></div>
      <div key={bloomKey} className="qd-t-glow" />
      <div ref={ico} className={`qd-t-ico${t.resolving ? ' qd-ok' : ''}`}>
        {type === 'loading' ? <Spinner /> : ICONS[type]}
      </div>
      <div className="qd-t-txt">
        <p className="qd-t-title">{t.title}</p>
        {t.description && <p className="qd-t-desc">{t.description}</p>}
      </div>
      <div className="qd-t-side">
        {t.action && (
          <button
            className="qd-t-act"
            onClick={(e) => { e.stopPropagation(); t.action!.onClick(); if (!t.action!.keepOpen) dismiss(t.id); }}
          >
            {t.action.label}
          </button>
        )}
        <button className="qd-t-x" aria-label="Dismiss notification" onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div ref={bar} className="qd-t-bar" />
    </motion.li>
  );
}

export default Toaster;
