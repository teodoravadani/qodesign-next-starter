'use client';
import { UploadDropzone } from '@/components/upload-dropzone/UploadDropzone';
import { toast } from '@/components/toast-stack/ToastStack';

export function Uploads() {
  return (
    <section id="uploads" className="reveal mx-auto grid max-w-6xl items-center gap-10 px-5 py-24 md:grid-cols-[1fr_1.15fr]">
      <div>
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Drop a log. Get the line that broke.</h2>
        <p className="mt-5 max-w-md text-black/60 dark:text-white/60">
          Drag in a crash log or a zip of them. We match the stack trace to the deploy that shipped it.
        </p>
        <p className="mt-4 font-mono text-xs text-black/40 dark:text-white/40">
          Demo: uploads are simulated, nothing leaves your browser.
        </p>
      </div>
      <div className="rounded-3xl bg-ink p-3 sm:p-5">
        <UploadDropzone
          title="Drop log files here"
          hint="up to 50 MB each"
          chips={['LOG', 'TXT', 'ZIP', 'JSON']}
          onAllDone={(items) =>
            toast.success(`${items.length} file${items.length === 1 ? '' : 's'} uploaded`, {
              description: 'Matching stack traces to deploys…',
            })
          }
        />
      </div>
    </section>
  );
}
