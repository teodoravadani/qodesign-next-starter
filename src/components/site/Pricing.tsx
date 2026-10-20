'use client';
import { PricingSwitch, type Plan } from '@/components/pricing-switch/PricingSwitch';
import { toast } from '@/components/toast-stack/ToastStack';

const plans: Plan[] = [
  {
    id: 'solo', name: 'Solo', description: 'One person, a few side projects.', monthly: 9, yearly: 7,
    cta: 'Start free', features: ['10 monitors', '1-minute checks', 'Email alerts'],
  },
  {
    id: 'team', name: 'Team', description: 'A product with real users.', monthly: 29, yearly: 24,
    cta: 'Start a trial', featured: true, features: ['100 monitors', '30-second checks', 'Slack and SMS alerts', 'Status page'],
  },
  {
    id: 'scale', name: 'Scale', description: 'Several teams, one bill.', monthly: 99, yearly: 82,
    cta: 'Talk to us', features: ['Unlimited monitors', 'SSO and audit log', '1-year history'],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="reveal mx-auto max-w-6xl px-5 py-24">
      <div className="rounded-[32px] bg-ink px-4 pt-8 pb-4 sm:px-8 sm:pt-10">
        <PricingSwitch
          plans={plans}
          header={<h2 className="max-w-md text-3xl font-bold tracking-tight text-white sm:text-4xl">Pay for monitors, not seats.</h2>}
          onSelect={(plan, yearly) =>
            toast.info(`${plan.name}, billed ${yearly ? 'yearly' : 'monthly'}`, {
              description: 'Wire this to your checkout in Pricing.tsx.',
            })
          }
        />
      </div>
    </section>
  );
}
