'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import React, {
  ReactNode, forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState,
} from 'react';
import './pricing-switch.css';

export interface Plan {
  id: string;
  name: string;
  /** small note next to the name, e.g. "up to 5 seats" */
  note?: string;
  description: string;
  /** USD per month when billed monthly */
  monthly: number;
  /** USD per month when billed yearly */
  yearly: number;
  cta: string;
  features: string[];
  featured?: boolean;
}

export interface PricingSwitchProps {
  plans: Plan[];
  /** heading block shown left of the switch */
  header?: ReactNode;
  /** controlled billing period; leave undefined to let the switch own it */
  yearly?: boolean;
  defaultYearly?: boolean;
  onYearlyChange?: (yearly: boolean) => void;
  /** called when a plan's button is pressed */
  onSelect?: (plan: Plan, yearly: boolean) => void;
  /** badge text shown when Yearly is on */
  yearlyBadge?: string;
  /** label shown on a button right after it's pressed */
  selectedLabel?: (plan: Plan) => string;
  /** force the hover lift on one plan (scripted demos) */
  highlight?: string | null;
  currency?: string;
}

export interface PricingSwitchHandle {
  /** scroll a plan into the middle on phones */
  centre: (id: string, smooth?: boolean) => void;
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- odometer: digit strips 0-9 ×4; every change rolls at least a full turn ---------------- */
function Odometer({ value, dir }: { value: number; dir: number }) {
  const host = useRef<HTMLSpanElement>(null);
  const st = useRef<{ pos: number; n: number; t?: number }[]>([]);
  const digits = String(value).split('').map(Number);
  const first = useRef(true);

  useLayoutEffect(() => {
    const strips = host.current ? [...host.current.querySelectorAll<HTMLSpanElement>('.qd-strip')] : [];
    if (first.current || st.current.length !== strips.length) {
      first.current = false;
      st.current = digits.map((n) => ({ pos: 10 + n, n }));
      strips.forEach((s, i) => { s.style.transition = 'none'; s.style.transform = `translateY(${-st.current[i].pos}em)`; });
      return;
    }
    const L = strips.length; const rm = reduced();
    strips.forEach((s, i) => {
      const o = st.current[i]; const n = digits[i]; const fromRight = L - 1 - i;
      let target: number;
      if (dir > 0) { target = o.pos + ((n - o.n + 10) % 10) + 10; if (target > 39) target -= 10; }
      else { target = o.pos - ((o.n - n + 10) % 10) - 10; if (target < 0) target += 10; }
      if (rm) target = 10 + n;
      const dur = rm ? 0 : 900 + fromRight * 160; const delay = rm ? 0 : (L - 1 - fromRight) * 70;
      s.style.transition = rm ? 'none' : `transform ${dur}ms cubic-bezier(.18,.9,.22,1.04) ${delay}ms`;
      s.style.transform = `translateY(${-target}em)`;
      o.n = n; o.pos = target;
      window.clearTimeout(o.t);
      o.t = window.setTimeout(() => { s.style.transition = 'none'; o.pos = 10 + n; s.style.transform = `translateY(${-o.pos}em)`; }, dur + delay + 60);
    });
    if (rm) host.current?.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 250 });
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className="qd-odo" aria-hidden="true" ref={host}>
      {digits.map((_, i) => (
        <span className="qd-dg" key={i}>
          <span className="qd-strip">{Array.from({ length: 40 }, (_, k) => <i key={k}>{k % 10}</i>)}</span>
        </span>
      ))}
    </span>
  );
}

function burst(host: HTMLElement, n = 14, dist = 40) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'qd-spark';
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4; const d = dist * (0.7 + Math.random() * 0.6);
    if (i % 3 === 1) s.style.background = '#F4F4F6';
    if (i % 3 === 2) s.style.background = '#8B6CFF';
    host.appendChild(s);
    s.animate(
      [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.2)`, opacity: 0 }],
      { duration: 600 + Math.random() * 250, easing: 'cubic-bezier(.1,.8,.3,1)' },
    ).onfinish = () => s.remove();
  }
}

const Check = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20"><circle className="qd-cbg" cx="10" cy="10" r="10" /><path className="qd-ck" d="m5.8 10.4 2.7 2.7 5.7-6" pathLength={1} fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Arrow = () => (<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
const Tick = () => (<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
const Gift = () => (<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7Zm0 0h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z" /></svg>);

/* ---------------- the component ---------------- */
export const PricingSwitch = forwardRef<PricingSwitchHandle, PricingSwitchProps>(function PricingSwitch({
  plans, header, yearly: controlled, defaultYearly = false, onYearlyChange, onSelect,
  yearlyBadge = '2 months free', selectedLabel = (p) => (p.featured ? `${p.name} selected` : 'Selected'),
  highlight = null, currency = '$',
}, ref) {
  const [inner, setInner] = useState(defaultYearly);
  const yearly = controlled ?? inner;
  const rm = useReducedMotion() ?? false;
  const [dir, setDir] = useState(0);
  const [sweepKey, setSweepKey] = useState(0);
  const [boost, setBoost] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [active, setActive] = useState(Math.max(0, plans.findIndex((p) => p.featured)));
  const [live, setLive] = useState('');
  const badge = useRef<HTMLSpanElement>(null);
  const cardsEl = useRef<HTMLDivElement>(null);
  const featsRefs = useRef<(HTMLUListElement | null)[]>([]);
  const prev = useRef(yearly);
  const bM = useRef<HTMLButtonElement>(null);
  const bY = useRef<HTMLButtonElement>(null);

  const redraw = useCallback(() => {
    featsRefs.current.forEach((u) => { if (!u) return; u.classList.remove('drawn'); void u.offsetWidth; u.classList.add('drawn'); });
  }, []);
  useEffect(() => { requestAnimationFrame(redraw); }, [redraw]);

  // every change of period: direction, sweep, boost, redraw, announce
  useEffect(() => {
    if (prev.current === yearly) return;
    prev.current = yearly;
    setDir(yearly ? 1 : -1);
    redraw();
    if (!rm) {
      setSweepKey((k) => k + 1);
      setBoost(true);
      if (yearly && badge.current) burst(badge.current, 12, 34);
    }
    setLive(yearly ? `Yearly billing. ${yearlyBadge}.` : 'Monthly billing.');
    const k = setTimeout(() => setBoost(false), 1100);
    return () => clearTimeout(k);
  }, [yearly, rm, redraw, yearlyBadge]);

  const set = (y: boolean) => { if (y === yearly) return; if (controlled === undefined) setInner(y); onYearlyChange?.(y); };

  const centre = useCallback((id: string, smooth = true) => {
    const host = cardsEl.current; const c = host?.querySelector<HTMLElement>(`[data-plan="${id}"]`);
    if (!host || !c) return;
    host.scrollTo({ left: c.offsetLeft - (host.clientWidth - c.offsetWidth) / 2, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  }, []);
  useImperativeHandle(ref, () => ({ centre }), [centre]);
  useEffect(() => {
    const f = plans.find((p) => p.featured);
    if (f && window.matchMedia('(max-width:900px)').matches) centre(f.id, false);
  }, [plans, centre]);

  const choose = (p: Plan, el: HTMLElement) => {
    if (chosen) return;
    setChosen(p.id);
    if (!rm) burst(el, 16, 60);
    setLive(`${p.name} plan selected, ${yearly ? 'yearly' : 'monthly'} billing.`);
    onSelect?.(p, yearly);
    setTimeout(() => setChosen(null), 1400);
  };

  return (
    <section className="qd-pricing" aria-label="Pricing">
      <div className="qd-ps-top">
        <div>{header}</div>
        <div className="qd-sw-wrap">
          <div
            className={`qd-seg${yearly ? ' y' : ''}`}
            data-dir={dir || undefined}
            role="radiogroup"
            aria-label="Billing period"
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
              e.preventDefault();
              const y = e.key === 'Home' ? false : e.key === 'End' ? true : !yearly;
              set(y); (y ? bY : bM).current?.focus();
            }}
          >
            <span className="qd-pill" aria-hidden="true" />
            <button ref={bM} data-bill="m" role="radio" aria-checked={!yearly} tabIndex={yearly ? -1 : 0} onClick={() => set(false)}>Monthly</button>
            <button ref={bY} data-bill="y" role="radio" aria-checked={yearly} tabIndex={yearly ? 0 : -1} onClick={() => set(true)}>Yearly</button>
          </div>
          <span ref={badge} className={`qd-badge${yearly ? ' on' : ''}`}><Gift />{yearlyBadge}</span>
        </div>
      </div>

      <div
        ref={cardsEl}
        className={`qd-cards${yearly ? ' on-y' : ''}`}
        onScroll={(e) => {
          const host = e.currentTarget; const mid = host.scrollLeft + host.clientWidth / 2;
          let k = 0; let best = 1e9;
          [...host.children].forEach((c, i) => { const el = c as HTMLElement; const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid); if (d < best) { best = d; k = i; } });
          setActive(k);
        }}
      >
        {plans.map((p, ci) => {
          const v = yearly ? p.yearly : p.monthly;
          const billed = yearly ? `${currency}${p.yearly * 12} billed yearly` : 'billed monthly';
          return (
            <article
              key={p.id}
              data-plan={p.id}
              aria-labelledby={`qd-n-${p.id}`}
              className={`qd-card${p.featured ? ' feat' : ''}${highlight === p.id ? ' hov' : ''}${sweepKey ? ' sweep' : ''}${p.featured && boost ? ' boost' : ''}`}
              style={{ ['--d' as string]: `${ci * 0.08}s` } as React.CSSProperties}
            >
              {p.featured && (<><div className="qd-halo" aria-hidden="true" /><div className="qd-ring" aria-hidden="true"><i /></div><span className="qd-tag">MOST POPULAR</span></>)}
              <div className="qd-shine" aria-hidden="true" key={`s${sweepKey}`} />
              <div className="qd-pname"><h2 id={`qd-n-${p.id}`}>{p.name}</h2>{p.note && <span>{p.note}</span>}</div>
              <p className="qd-pdesc">{p.description}</p>
              <div className="qd-price">
                <span className="qd-cur" aria-hidden="true">{currency}</span>
                <Odometer value={v} dir={dir} />
                <span className="qd-per" aria-hidden="true">/mo</span>
                <span className="qd-sr">{`${currency}${v} per month, ${billed}`}</span>
              </div>
              <div className="qd-sub">
                <p>{billed}</p>
                <span className="qd-save" style={{ ['--d' as string]: `${0.25 + ci * 0.08}s` } as React.CSSProperties}>{`SAVE ${currency}${(p.monthly - p.yearly) * 12}/YR`}</span>
              </div>
              <button className="qd-cta" onClick={(e) => choose(p, e.currentTarget)}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={chosen === p.id ? 'on' : 'off'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    initial={rm ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={rm ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.9 }}
                    transition={{ duration: rm ? 0.12 : 0.18 }}
                  >
                    {chosen === p.id ? (<><Tick />{selectedLabel(p)}</>) : (<>{p.cta}<Arrow /></>)}
                  </motion.span>
                </AnimatePresence>
              </button>
              <ul className="qd-feats" ref={(el) => { featsRefs.current[ci] = el; }}>
                {p.features.map((f, k) => (
                  <li key={f} style={{ ['--d' as string]: `${ci * 0.08 + k * 0.06}s` } as React.CSSProperties}><Check />{f}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      <div className="qd-dots-m" aria-hidden="true">{plans.map((p, i) => <i key={p.id} className={i === active ? 'on' : ''} />)}</div>
      <p className="qd-sr" aria-live="polite">{live}</p>
    </section>
  );
});

export default PricingSwitch;
