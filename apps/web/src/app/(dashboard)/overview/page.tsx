import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Portfolio Overview</h1>
      <p className="text-muted-foreground">Your CS2 inventory and market intelligence.</p>
    </div>
  );
}
