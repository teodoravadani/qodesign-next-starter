import type { Metadata } from 'next';
import { Toaster } from '@/components/toast-stack/ToastStack';
import './globals.css';

export const metadata: Metadata = {
  title: 'Orbit: know your servers are down before your users do',
  description: 'A landing page starter for Next.js 15 and Tailwind v4, built from free qodesign components.',
};

// Runs before paint so a visitor who picked light mode doesn't see a dark flash.
const themeScript = `try{if(localStorage.getItem('theme')==='light')document.documentElement.classList.remove('dark')}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
