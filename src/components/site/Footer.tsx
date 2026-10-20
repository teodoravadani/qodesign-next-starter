export function Footer() {
  return (
    <footer className="border-t border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-10 text-sm text-black/50 dark:text-white/50">
        <span className="font-semibold text-black dark:text-white">orbit</span>
        <span>© {new Date().getFullYear()}</span>
        <span className="ml-auto">
          Built with free components from{' '}
          <a
            className="underline decoration-volt decoration-2 underline-offset-4 hover:text-black dark:hover:text-white"
            href="https://qodesign.dev/?utm_source=github&utm_medium=starter&utm_campaign=next_starter"
          >
            qodesign
          </a>
        </span>
      </div>
    </footer>
  );
}
