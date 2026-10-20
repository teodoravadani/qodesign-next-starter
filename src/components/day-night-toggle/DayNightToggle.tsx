'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';

export type DayNightToggleProps = {
  /** start in night mode (uncontrolled) */
  defaultNight?: boolean;
  /** control the state yourself; pair it with onChange */
  night?: boolean;
  /** called with the new state after every toggle */
  onChange?: (night: boolean) => void;
  /** width in px; everything scales from the 640 x 256 design */
  width?: number;
  /** accessible label */
  label?: string;
};

// same curves as the CSS version
const KNOB_EASE = [0.7, -0.3, 0.3, 1.3] as const;
const CSS_EASE = [0.25, 0.1, 0.25, 1] as const;
const STAR_EASE = [0.2, 0.8, 0.2, 1.2] as const;
const EASE_IN = [0.42, 0, 1, 1] as const;

const CLOUDS = [
  { w: 190, h: 70, right: 50, top: 150, delay: 0, opacity: 1 },
  { w: 138, h: 55, right: 188, top: 188, delay: 0.06, opacity: 1 },
  { w: 112, h: 48, right: 88, top: 88, delay: 0.12, opacity: 0.85 },
];
const CRATERS = [
  { s: 48, left: 48, top: 52 },
  { s: 30, left: 122, top: 120 },
  { s: 22, left: 72, top: 148 },
];

export default function DayNightToggle({
  defaultNight = false,
  night: controlled,
  onChange,
  width = 640,
  label = 'Dark mode',
}: DayNightToggleProps) {
  const [inner, setInner] = useState(defaultNight);
  const night = controlled ?? inner;
  const reduce = useReducedMotion();
  // under Reduce Motion everything cross-fades in 0.2 s instead of rolling and falling
  const T = (t: object) => (reduce ? { duration: 0.2 } : t);
  const scale = width / 640;

  // 22 stars, same pseudo-random layout as the HTML version
  const stars = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const r = (n: number) => Math.abs((Math.sin(i * 97.13 + n) * 43758.5453) % 1);
        return { left: 30 + r(1) * 340, top: 22 + r(2) * 212, delay: +(r(3) * 0.35).toFixed(2), size: 4 + r(4) * 6 };
      }),
    [],
  );

  const toggle = () => {
    const next = !night;
    setInner(next);
    onChange?.(next);
  };

  return (
    <div style={{ width, height: 256 * scale }}>
      <button
        type="button"
        role="switch"
        aria-checked={night}
        aria-label={label}
        onClick={toggle}
        className="relative block origin-top-left cursor-pointer overflow-hidden rounded-full border-0 p-0 outline-none focus-visible:ring-[10px] focus-visible:ring-[#8B6CFF] focus-visible:ring-offset-[8px] focus-visible:ring-offset-transparent"
        style={{
          width: 640,
          height: 256,
          transform: `scale(${scale})`,
          boxShadow: 'inset 0 10px 22px rgba(0,0,0,.25)',
          background: night ? 'linear-gradient(#0B1033, #27306B)' : 'linear-gradient(#5DB8FF, #A8DBFF)',
        }}
      >
        {stars.map((s, i) => (
          <motion.i
            key={i}
            className="absolute block rounded-full bg-white"
            style={{ left: s.left, top: s.top, width: s.size, height: s.size }}
            initial={false}
            animate={reduce ? { y: 0, opacity: night ? 1 : 0 } : { y: night ? 0 : -300, opacity: 1 }}
            transition={T({ duration: 0.7, ease: STAR_EASE, delay: s.delay })}
          />
        ))}
        {CLOUDS.map((c, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ width: c.w, height: c.h, right: c.right, top: c.top, opacity: c.opacity }}
            initial={false}
            animate={reduce ? { y: 0, opacity: night ? 0 : c.opacity } : { y: night ? 240 : 0, opacity: c.opacity }}
            transition={T({ duration: 0.8, ease: EASE_IN, delay: c.delay })}
          />
        ))}
        <motion.div
          className="absolute rounded-full"
          style={{ top: 22, left: 22, width: 212, height: 212 }}
          initial={false}
          animate={{
            x: night ? 384 : 0,
            rotate: night && !reduce ? 360 : 0,
            backgroundColor: night ? '#E9ECF5' : '#FFD23F',
            boxShadow: night ? '0 0 50px #9DB2FF' : '0 0 70px #FFD23F',
          }}
          transition={reduce ? { duration: 0.2 } : {
            x: { duration: 0.8, ease: KNOB_EASE },
            rotate: { duration: 0.8, ease: KNOB_EASE },
            backgroundColor: { duration: 0.8, ease: CSS_EASE },
            boxShadow: { duration: 0.8, ease: CSS_EASE },
          }}
        >
          {CRATERS.map((c, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-[#C3C9DB]"
              style={{ width: c.s, height: c.s, left: c.left, top: c.top }}
              initial={false}
              animate={{ opacity: night ? 1 : 0 }}
              transition={T({ duration: 0.5, delay: 0.3 })}
            />
          ))}
        </motion.div>
      </button>
    </div>
  );
}
