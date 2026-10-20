'use client';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from '@/components/toast-stack/ToastStack';
import dashboardShot from '@/assets/dashboard.webp';

// Stand-in for your real signup call
const createWorkspace = () => new Promise<string>((resolve) => setTimeout(() => resolve('orbit-demo'), 1600));

export function Hero() {
  const start = () => {
    toast.promise(createWorkspace(), {
      loading: { title: 'Creating your workspace…' },
      success: (name) => ({ title: 'Workspace ready', description: `${name} is live. The first check runs in 30 s.` }),
      error: () => ({ title: 'That didn’t work', description: 'Try again in a minute.' }),
    });
  };

  return (
    <section className="mx-auto max-w-6xl px-5 pt-20 pb-16 sm:pt-28">
      <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1 font-mono text-xs dark:border-white/15">
        <span className="size-1.5 rounded-full bg-volt shadow-[0_0_10px_#c6ff3d]" />
        12 regions checking every 30 s
      </p>
      <h1 className="max-w-3xl text-5xl leading-[1.02] font-bold tracking-tight sm:text-7xl">
        Know your servers are down before your users do.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-black/60 dark:text-white/60">
        Uptime, latency and deploys on one screen. Set up in two minutes, no agent to install.
      </p>
      <div className="mt-9 flex flex-wrap items-center gap-3">
        <button
          onClick={start}
          className="rounded-full bg-volt px-6 py-3 font-semibold text-ink transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(198,255,61,.35)] active:translate-y-0"
        >
          Start free
        </button>
        <Link
          href="/dashboard"
          className="rounded-full border border-black/15 px-6 py-3 font-semibold transition hover:border-black/40 dark:border-white/20 dark:hover:border-white/50"
        >
          Open the live dashboard
        </Link>
      </div>

      <Link
        href="/dashboard"
        className="group mt-16 block overflow-hidden rounded-2xl border border-black/10 bg-ink shadow-[0_40px_120px_-30px_rgba(0,0,0,.45)] dark:border-white/10"
      >
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="ml-3 font-mono text-xs text-white/40">localhost:3000/dashboard</span>
        </div>
        <Image
          src={dashboardShot}
          alt="The Orbit dashboard: KPIs, a live service map and a latency chart"
          sizes="(max-width: 1200px) 100vw, 1152px"
          priority
          className="w-full transition duration-700 group-hover:scale-[1.015]"
        />
      </Link>
    </section>
  );
}
