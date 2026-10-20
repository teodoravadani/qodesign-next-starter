'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import DayNightToggle from '@/components/day-night-toggle/DayNightToggle';

export function Nav() {
  // null until mounted, so the server and the first client render agree
  const [night, setNight] = useState<boolean | null>(null);
  useEffect(() => setNight(document.documentElement.classList.contains('dark')), []);

  const setTheme = (n: boolean) => {
    setNight(n);
    document.documentElement.classList.toggle('dark', n);
    try { localStorage.setItem('theme', n ? 'dark' : 'light'); } catch {}
  };

  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-paper/80 backdrop-blur-md dark:border-white/10 dark:bg-ink/80">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-volt font-mono text-sm text-ink">O</span>
          orbit
        </Link>
        <div className="hidden gap-6 text-sm text-black/60 sm:flex dark:text-white/60">
          <a href="#uploads" className="hover:text-black dark:hover:text-white">Logs</a>
          <a href="#pricing" className="hover:text-black dark:hover:text-white">Pricing</a>
          <Link href="/dashboard" className="hover:text-black dark:hover:text-white">Dashboard</Link>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="h-7 w-[70px]">
            {night !== null && <DayNightToggle width={70} night={night} onChange={setTheme} label="Dark mode" />}
          </div>
          <a
            href="#pricing"
            className="hidden rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white sm:inline-block dark:bg-white dark:text-ink"
          >
            Start free
          </a>
        </div>
      </nav>
    </header>
  );
}
