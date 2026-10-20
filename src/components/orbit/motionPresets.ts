import type { MotionProps } from 'framer-motion';

/** Cards rise in one after another (70 ms apart). Reduce Motion is handled by <MotionConfig reducedMotion="user">. */
export const cardMotion = (i: number): MotionProps => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.07 },
});
export const spring = { type: 'spring', stiffness: 420, damping: 32 } as const;
