import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Alerts' };

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
      <p className="text-muted-foreground">Price alerts and notifications.</p>
    </div>
  );
}
