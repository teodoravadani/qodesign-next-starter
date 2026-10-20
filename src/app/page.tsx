import { Nav } from '@/components/site/Nav';
import { Hero } from '@/components/site/Hero';
import { Uploads } from '@/components/site/Uploads';
import { Pricing } from '@/components/site/Pricing';
import { Footer } from '@/components/site/Footer';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Uploads />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
