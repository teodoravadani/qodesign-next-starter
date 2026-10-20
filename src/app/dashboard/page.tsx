import type { Metadata } from 'next';
import { OrbitDashboard } from '@/components/orbit/OrbitDashboard';

export const metadata: Metadata = { title: 'Dashboard · Orbit' };

export default function DashboardPage() {
  return <OrbitDashboard />;
}
